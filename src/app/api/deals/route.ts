import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { Deal } from "@/domain/deal";
import { assessDeal, addEvidenceToDeal } from "@/domain/assessment";
import { extractDealFromText } from "@/domain/extract-text";
import { redactAnalysisEvidence, type AnalysisSource } from "@/domain/ai-analysis";
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
    const existing = typeof existingValue === "string" ? JSON.parse(existingValue) as Deal : undefined;
    // Client-held analysis is untrusted and is replaced only by a fresh server-validated result.
    if (existing) delete existing.aiAnalysis;
    if (!text && !(image instanceof File)) return NextResponse.json({ error: "Add listing text or an image first." }, { status: 400 });

    const dealId = existing?.id ?? randomUUID();
    const additions: Deal[] = [];
    const analysisSources: AnalysisSource[] = [];
    if (text) {
      const evidenceId = randomUUID();
      additions.push(extractDealFromText(text, dealId, existing ? "Follow-up message" : "User-supplied listing text", evidenceId));
      analysisSources.push({ source_id: evidenceId, speaker: evidenceSpeaker, kind: "user_supplied_text", text: redactAnalysisEvidence(text) });
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
          const reviewed = await analyzeEvidenceWithAstropods({
            sources: analysisSources,
            client: configured.client,
            model: configured.model,
            signal: request.signal,
          });
          result = { ...result, aiAnalysis: reviewed.analysis };
        } catch {
          aiAnalysisNotice = "AI review could not be completed or validated, so the deterministic local assessment is shown.";
        }
      }
    }
    return NextResponse.json({ deal: assessDeal(result), ...(aiAnalysisNotice ? { aiAnalysisNotice } : {}) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The deal could not be assessed." }, { status: 400 });
  }
}