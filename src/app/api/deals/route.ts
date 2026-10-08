import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { Deal } from "@/domain/deal";
import { assessDeal, addEvidenceToDeal } from "@/domain/assessment";
import { extractDealFromText } from "@/domain/extract-text";
import { redactAnalysisEvidence, type AnalysisSource } from "@/domain/ai-analysis";
import { integrateValidatedAnalysis } from "@/domain/ai-deal-integration";
import { extractDealFromImage } from "@/server/extract-image";
import { analyzeEvidenceWithAstropods, configuredAstropodsAnalysis } from "@/server/astropods-analysis";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const text = String(form.get("text") ?? "").trim();
    const image = form.get("image");
    const aiConsent = form.get("aiConsent") === "true";
    const speakerValue = String(form.get("evidenceSpeaker") ?? "unknown");
    const evidenceSpeaker: AnalysisSource["speaker"] = speakerValue === "seller" || speakerValue === "buyer" ? speakerValue : "unknown";
    const existingValue = form.get("existingDeal");
    if (typeof existingValue === "string" && Buffer.byteLength(existingValue, "utf8") > 256_000) return NextResponse.json({ error: "Existing deal context must be 256 KB or smaller." }, { status: 413 });
    const existing = typeof existingValue === "string" ? JSON.parse(existingValue) as Deal : undefined;
    // Client-held analysis is untrusted and is replaced only by a fresh server-validated result.
    if (existing) delete existing.aiAnalysis;
    if (Buffer.byteLength(text, "utf8") > 32_000) return NextResponse.json({ error: "Text evidence must be 32 KB or smaller." }, { status: 413 });
    if (!text && !(image instanceof File)) return NextResponse.json({ error: "Add listing text or an image first." }, { status: 400 });

    const dealId = existing?.id ?? randomUUID();
    const additions: Deal[] = [];
    const analysisSources: AnalysisSource[] = [];
    if (text) {
      const evidenceId = randomUUID();
      additions.push(extractDealFromText(text, dealId, existing ? "Follow-up message" : "User-supplied listing text", evidenceId));
      additions.at(-1)!.evidence[0]!.speaker = evidenceSpeaker;
      analysisSources.push({ source_id: evidenceId, speaker: evidenceSpeaker, kind: "user_supplied_text", text: redactAnalysisEvidence(text), captured_at: additions.at(-1)!.evidence[0]!.capturedAt, timestamp_basis: "server" });
    }
    if (image instanceof File) {
      if (image.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Image must be 8 MB or smaller." }, { status: 413 });
      const evidenceId = randomUUID();
      additions.push(await extractDealFromImage({
        image: new Uint8Array(await image.arrayBuffer()), mimeType: image.type,
        dealId, evidenceId, modelAdapter: null,
        onOcrText: (ocrText) => analysisSources.push({
          source_id: evidenceId, speaker: evidenceSpeaker, kind: "photo_ocr", text: redactAnalysisEvidence(ocrText), target_entity: "unknown",
        }),
      }));
      additions.at(-1)!.evidence[0]!.speaker = evidenceSpeaker;
      const imageSource = analysisSources.find((source) => source.source_id === evidenceId);
      if (imageSource) {
        imageSource.captured_at = additions.at(-1)!.evidence[0]!.capturedAt;
        imageSource.timestamp_basis = "server";
      }
    }
    let result = additions[0]!;
    for (const addition of additions.slice(1)) result = addEvidenceToDeal(result, addition);
    if (existing) result = addEvidenceToDeal(existing, result);

    let aiAnalysisNotice: string | undefined;
    if (aiConsent) {
      let configured: ReturnType<typeof configuredAstropodsAnalysis>;
      try {
        configured = configuredAstropodsAnalysis();
      } catch {
        configured = undefined;
        aiAnalysisNotice = "AI review is unavailable because its server configuration is invalid. Your evidence was assessed locally and was not sent to Astropods.";
      }
      if (!aiAnalysisNotice && !configured) {
        aiAnalysisNotice = "AI review is disabled on this service. Your evidence was assessed locally and was not sent to Astropods.";
      } else if (!aiAnalysisNotice && analysisSources.length === 0) {
        aiAnalysisNotice = "No readable evidence was available for AI review. The local assessment is shown.";
      } else if (!aiAnalysisNotice && configured) {
        try {
          const history = existing ? buildPriorEvidenceSources(existing) : { sources: [], error: undefined };
          if (history.error) throw new Error("Earlier evidence cannot safely fit in this request.");
          const sources = [...history.sources, ...analysisSources];
          if (sources.length > 12 || new Set(sources.map(({ source_id }) => source_id)).size !== sources.length) throw new Error("Evidence source limit exceeded.");
          const reviewed = await analyzeEvidenceWithAstropods({
            sources,
            client: configured.client,
            model: configured.model,
            signal: request.signal,
          });
          result = { ...integrateValidatedAnalysis(result, reviewed.analysis), aiAnalysis: reviewed.analysis };
        } catch {
          aiAnalysisNotice = "AI review could not be completed or validated, so the deterministic local assessment is shown.";
        }
      }
    }
    return NextResponse.json({ deal: assessDeal(result), ...(aiAnalysisNotice ? { aiAnalysisNotice } : {}) });
  } catch {
    return NextResponse.json({ error: "The deal could not be assessed. Check the supplied text or image and try again." }, { status: 400 });
  }
}

/** Use only bounded exact excerpts already present in browser-held provenance; never send full prior submissions. */
export function buildPriorEvidenceSources(value: unknown): { sources: AnalysisSource[]; error?: string } {
  if (!value || typeof value !== "object") return { sources: [], error: "invalid deal" };
  const record = value as { evidence?: unknown; evidenceRefs?: unknown };
  if (!Array.isArray(record.evidence) || !Array.isArray(record.evidenceRefs ?? [])) return { sources: [], error: "invalid history" };
  if (record.evidence.some((entry) => !entry || typeof entry !== "object")) return { sources: [], error: "invalid evidence entry" };
  const evidence = record.evidence.filter((entry) => (entry as { source?: unknown }).source === "user") as Deal["evidence"];
  if (evidence.length > 10) return { sources: [], error: "too many sources" };
  const refs = record.evidenceRefs as Array<{ evidenceId?: unknown; quote?: unknown }>;
  if (refs.some((ref) => !ref || typeof ref !== "object" || typeof ref.evidenceId !== "string" || typeof ref.quote !== "string" || !ref.quote.trim())) return { sources: [], error: "invalid evidence quote" };
  const userIds = new Set(evidence.map((entry) => entry?.id));
  if (refs.some((ref) => !userIds.has(ref.evidenceId as string))) return { sources: [], error: "orphaned evidence quote" };
  const ids = new Set<string>();
  const sources: AnalysisSource[] = [];
  let totalBytes = 0;
  for (const item of evidence) {
    if (!item || typeof item.id !== "string" || !item.id || item.id.length > 120 || ids.has(item.id)
      || typeof item.capturedAt !== "string" || !Number.isFinite(Date.parse(item.capturedAt))) return { sources: [], error: "invalid source metadata" };
    ids.add(item.id);
    if (typeof item.label !== "string" || item.label.length > 200) return { sources: [], error: "invalid source label" };
    const quotes = refs.filter((ref) => ref?.evidenceId === item.id).map((ref) => ref.quote);
    if (!quotes.length || quotes.some((quote) => typeof quote !== "string" || !quote.trim() || quote.length > 4_000)) return { sources: [], error: "missing or oversized source excerpt" };
    const text = quotes.join("\n");
    totalBytes += Buffer.byteLength(text, "utf8");
    if (totalBytes > 32_000) return { sources: [], error: "history exceeds byte limit" };
    const speaker = item.speaker === "seller" || item.speaker === "buyer" ? item.speaker : "unknown";
    sources.push({ source_id: item.id, speaker, kind: /photo|image|screenshot|ocr/i.test(item.label) ? "photo_ocr" : "user_supplied_text", text: redactAnalysisEvidence(text), captured_at: item.capturedAt, timestamp_basis: "client_reported" });
  }
  return { sources };
}
