import { z } from "zod";
import { extractDealFromIntake } from "../../../src/domain/extract-text.js";
import { assessDeal } from "../../../src/domain/assessment.js";
import { prioritizeBuyerQuestions } from "../../../src/domain/presentation.js";
import type { DealCandidate, DealSourceField } from "../../../src/domain/deal.js";
import { DEAL_SENSE_ADVISER_INSTRUCTIONS, EVIDENCE_AUDITOR_INSTRUCTIONS } from "./roles.js";

const SegmentSchema = z.object({
  id: z.string().min(1).max(80),
  field: z.enum(["title", "item_specifics", "description", "seller_notes", "payment_terms", "delivery_terms", "follow_up", "plain_text", "ocr"]),
  text: z.string().min(1).max(3000),
  order: z.number().int().nonnegative().optional(),
}).strict();
export const ExperimentRequestSchema = z.object({
  caseId: z.string().regex(/^AI001-[A-E]$/),
  segments: z.array(SegmentSchema).min(1).max(8),
}).strict();

const ProposalSchema = z.object({
  factType: z.enum(["item", "model", "price", "currency", "condition", "payment_method", "delivery", "claim", "unknown"]),
  subject: z.enum(["main_item", "accessory", "payment", "delivery", "checkout", "other"]),
  value: z.union([z.string(), z.number()]),
  sourceId: z.string(),
  quote: z.string().min(1),
  polarity: z.enum(["affirmed", "negated"]),
  temporalStatus: z.enum(["current", "historical", "corrected"]),
  intent: z.enum(["requested", "mentioned", "rejected", "conditional", "accepted"]).optional(),
}).strict();
const AuditorOutputSchema = z.object({
  proposals: z.array(ProposalSchema).max(20),
  uncertainties: z.array(z.string().max(300)).max(10),
}).strict();
const AdviserOutputSchema = z.object({
  summary: z.string().min(1).max(600),
  points: z.array(z.object({ text: z.string().min(1).max(350), evidenceIds: z.array(z.string()).min(1).max(5) }).strict()).max(6),
  questions: z.array(z.object({ text: z.string().min(1).max(220), evidenceIds: z.array(z.string()).max(5) }).strict()).max(4),
  unresolved: z.array(z.object({ text: z.string().min(1).max(250), evidenceIds: z.array(z.string()).max(5) }).strict()).max(8),
}).strict();

export type ModelRole = "evidence-auditor" | "deal-sense-adviser";
export type ModelCall = (role: ModelRole, system: string, input: unknown) => Promise<{ content: string; usage?: { inputTokens?: number; outputTokens?: number } }>;

const guidance = [
  { id: "PAYPAL-UK-FF-PURCHASE", text: "PayPal UK advises using Goods and Services for purchases from unfamiliar sellers. Friends and Family purchases are not eligible for PayPal Buyer Protection. This is a payment-protection consideration, not evidence of seller intent.", url: "https://www.paypal.com/uk/security/learn-about-scams" },
  { id: "PAYPAL-UK-BUYER-PROTECTION", text: "Buyer Protection applies only to eligible purchases and terms; PayPal determines eligibility. Do not promise coverage or an outcome.", url: "https://www.paypal.com/uk/legalhub/paypal/buyer-protection" },
] as const;

function parseModelJson<T>(content: string, schema: z.ZodType<T>): T {
  return schema.parse(JSON.parse(content));
}
function candidateMatches(proposal: z.infer<typeof ProposalSchema>, candidate: DealCandidate, sources: readonly { id: string; text: string }[]): boolean {
  const source = sources.find(({ id }) => id === candidate.sourceId);
  return Boolean(source && proposal.sourceId === candidate.sourceId && proposal.factType === candidate.factType && proposal.subject === candidate.subject
    && proposal.value === candidate.value && proposal.quote === candidate.quote && proposal.polarity === candidate.polarity
    && proposal.temporalStatus === candidate.temporalStatus && proposal.intent === candidate.intent
    && source.text.slice(candidate.startOffset, candidate.endOffset) === candidate.quote
    && candidate.endOffset - candidate.startOffset === candidate.quote.length);
}
const forbidden = /\b(?:scam|fraudster|trust score|trustworthy|guaranteed buyer protection|guaranteed coverage)\b|\b(?:you should|you must|I recommend you|tell the seller to)\s+(?:buy|purchase|pay|refuse|walk away)\b|\bdo not (?:buy|purchase|pay)\b/i;

export function validateAuditorOutput(raw: string, candidates: readonly DealCandidate[], sources: readonly { id: string; text: string }[]) {
  const parsed = parseModelJson(raw, AuditorOutputSchema);
  const accepted: DealCandidate[] = [];
  const rejected: { proposal: unknown; reason: string }[] = [];
  for (const proposal of parsed.proposals) {
    const match = candidates.find((candidate) => candidateMatches(proposal, candidate, sources));
    if (match) accepted.push(match);
    else rejected.push({ proposal, reason: "No identical PPDC candidate with a matching source ID, quote, polarity, time, and offsets." });
  }
  return { parsed, accepted: deduplicateCandidates(accepted), rejected };
}
function deduplicateCandidates(items: DealCandidate[]): DealCandidate[] {
  return items.filter((item, index) => items.findIndex((other) => other.sourceId === item.sourceId && other.startOffset === item.startOffset && other.endOffset === item.endOffset && other.factType === item.factType) === index);
}

export function validateAdviserOutput(raw: string, allowedIds: ReadonlySet<string>) {
  const advice = parseModelJson(raw, AdviserOutputSchema);
  const entries = [
    ...advice.points.map((entry) => ({ ...entry, text: entry.text })),
    ...advice.questions.map((entry) => ({ ...entry, text: entry.text })),
    ...advice.unresolved.map((entry) => ({ ...entry, text: entry.text })),
  ];
  if (forbidden.test(advice.summary) || entries.some(({ text }) => forbidden.test(text))) throw new Error("Adviser output failed PPDC presentation validation.");
  if (entries.some(({ evidenceIds }) => evidenceIds.some((id) => !allowedIds.has(id)))) throw new Error("Adviser output cited evidence outside the validated input.");
  const questions = prioritizeBuyerQuestions(advice.questions.map(({ text }) => text), 4);
  return { ...advice, questions: advice.questions.filter(({ text }) => questions.includes(text)) };
}

export async function runExperiment(rawRequest: string, callModel: ModelCall) {
  const request = ExperimentRequestSchema.parse(JSON.parse(rawRequest));
  const sourceTextById = request.segments.map(({ id, text }) => ({ id, text }));
  const deal = assessDeal(extractDealFromIntake({
    dealId: request.caseId,
    segments: request.segments.map(({ id, field, text, order }) => ({ id, field: field as DealSourceField, text, order })),
  }));
  const auditorEnvelope = {
    caseId: request.caseId,
    originalSources: request.segments,
    deterministicExtraction: { item: deal.item, model: deal.model, price: deal.price, currency: deal.currency, condition: deal.condition, paymentMethod: deal.paymentMethod, deliveryTerms: deal.deliveryTerms, materialPromises: deal.materialPromises, unknowns: deal.unknowns, candidates: deal.candidates, findings: deal.findings },
    task: "Compare, then propose only exact candidate corrections/additions supported by the original source and supplied PPDC candidate list. Return {proposals, uncertainties}.",
  };
  const auditorResult = await callModel("evidence-auditor", EVIDENCE_AUDITOR_INSTRUCTIONS, auditorEnvelope);
  let audit: ReturnType<typeof validateAuditorOutput>;
  try {
    audit = validateAuditorOutput(auditorResult.content, deal.candidates ?? [], sourceTextById);
  } catch {
    audit = { parsed: { proposals: [], uncertainties: ["Auditor output did not pass its strict response schema."] }, accepted: [], rejected: [{ proposal: "<unparsed>", reason: "Invalid JSON or schema; fail closed." }] };
  }
  const acceptedIds = new Set(audit.accepted.map(({ sourceId }) => sourceId));
  const adviserEnvelope = {
    caseId: request.caseId,
    validatedDeterministicFacts: { item: deal.item, model: deal.model, price: deal.price, currency: deal.currency, condition: deal.condition, paymentMethod: deal.paymentMethod, deliveryTerms: deal.deliveryTerms, materialPromises: deal.materialPromises, unknowns: deal.unknowns, findings: deal.findings },
    auditorProposalsAcceptedByPPDC: audit.accepted,
    auditorSourceIdsAcceptedByPPDC: [...acceptedIds],
    curatedGuidance: guidance,
    allowedCitations: [...new Set([...deal.evidence.map(({ id }) => id), ...guidance.map(({ id }) => id)])],
    task: "Return {summary,points:[{text,evidenceIds}],questions:[{text,evidenceIds}],unresolved:[{text,evidenceIds}]}. Use only supplied facts and guidance. Cite every point. Ask at most four concise questions.",
  };
  const adviserResult = await callModel("deal-sense-adviser", DEAL_SENSE_ADVISER_INSTRUCTIONS, adviserEnvelope);
  const validatedAdvice = validateAdviserOutput(adviserResult.content, new Set(adviserEnvelope.allowedCitations));
  return {
    caseId: request.caseId,
    deterministic: { deal, findings: deal.findings },
    auditor: { proposals: audit.parsed.proposals, uncertainties: audit.parsed.uncertainties, accepted: audit.accepted, rejected: audit.rejected, usage: auditorResult.usage ?? null },
    adviser: { output: validatedAdvice, usage: adviserResult.usage ?? null },
    final: { deterministicFindings: deal.findings, explanation: validatedAdvice.summary, points: validatedAdvice.points, questions: validatedAdvice.questions, unresolved: validatedAdvice.unresolved },
  };
}