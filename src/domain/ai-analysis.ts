import { z } from "zod";

export const ANALYSIS_CONTRACT_VERSION = "ppdc-ai-analysis/1" as const;

/** Mask common contact and card-number patterns before optional external analysis. */
export function redactAnalysisEvidence(text: string): string {
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted email]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[redacted card number]")
    .replace(/(?<!\w)(?:\+\d{1,3}[\s().-]?)?(?:\(?0\d{2,5}\)?[\s().-]?)\d{3,4}[\s.-]?\d{3,4}(?!\w)/g, "[redacted phone number]");
}

export const AnalysisSourceSchema = z.object({
  source_id: z.string().min(1).max(120),
  speaker: z.enum(["seller", "buyer", "user", "document", "unknown"]),
  kind: z.enum(["marketplace_listing", "seller_message", "buyer_message", "photo_ocr", "document", "user_supplied_text"]),
  text: z.string().min(1).max(32_000),
  target_entity: z.enum(["main_item", "accessory", "unknown"]).optional(),
}).strict();
export type AnalysisSource = z.infer<typeof AnalysisSourceSchema>;

const AttributionSchema = z.enum(["seller_claim", "buyer_statement", "document_text", "observed_text", "unknown"]);
const EvidenceQuoteSchema = z.object({ source_id: z.string().min(1), quote: z.string().min(1).max(4_000) }).strict();
const CandidateSchema = z.object({
  field: z.string().min(1).max(80),
  value: z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()]),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable().optional(),
  attribution: AttributionSchema,
  evidence: z.array(EvidenceQuoteSchema).min(1).max(8),
}).strict();
const ContradictionCandidateSchema = z.object({
  value: z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()]),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable().optional(),
  attribution: AttributionSchema,
  evidence: z.array(EvidenceQuoteSchema).min(1).max(8),
}).strict();
const NoteSchema = z.object({
  field: z.string().min(1).max(80), text: z.string().min(1).max(500),
  evidence: z.array(EvidenceQuoteSchema).max(8),
}).strict();
const ProposedCaseSchema = z.object({
  case_id: z.string().min(1).max(120),
  candidate_facts: z.array(CandidateSchema).max(100),
  seller_claims: z.array(CandidateSchema).max(100),
  unknowns: z.array(NoteSchema).max(100),
  contradictions: z.array(z.object({
    field: z.string().min(1).max(80),
    candidates: z.array(ContradictionCandidateSchema).min(2).max(8),
    resolution: z.null(),
  }).strict()).max(50),
  buyer_questions: z.array(z.string().min(1).max(300)).max(20),
  abstentions: z.array(NoteSchema).max(100),
  explanation: z.string().max(500),
}).strict();
export const ProposedAnalysisResponseSchema = z.object({ cases: z.array(ProposedCaseSchema).length(1) }).strict();

export type CandidateObservation = z.infer<typeof CandidateSchema>;
export type AnalysisNote = z.infer<typeof NoteSchema>;
export interface TrustedAnalysisMetadata {
  provider: "astropods";
  model: string;
  promptVersion: string;
  requestId: string;
  conversationId: string;
  startedAt: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  validationStatus: "complete" | "partial";
}
export interface RejectedObservation { field: string; reason: string; }
export interface TrustedDealAnalysis {
  contractVersion: typeof ANALYSIS_CONTRACT_VERSION;
  status: "proposed";
  provenance: TrustedAnalysisMetadata;
  sourceAttribution: Array<Pick<AnalysisSource, "source_id" | "speaker" | "kind" | "target_entity">>;
  candidateFacts: CandidateObservation[];
  sellerClaims: CandidateObservation[];
  unknowns: AnalysisNote[];
  contradictions: Array<{ field: string; candidates: z.infer<typeof ContradictionCandidateSchema>[]; resolution: null }>;
  buyerQuestions: string[];
  abstentions: AnalysisNote[];
  explanation: string;
  rejected: RejectedObservation[];
}

const FORBIDDEN_FACT_FIELDS = new Set([
  "seller_intent", "seller_trust", "trustworthiness", "fraud_probability", "fraud", "risk_score",
  "severity", "paypal_protection_eligibility", "buyer_protection", "market_comparison", "fair_price",
  "price_fairness", "purchase_decision", "payment_authorization", "capture_permission", "repair_quality", "repair_stability",
]);
const ALLOWED_FACT_FIELDS = new Set([
  "item", "item_description", "model", "generation", "product_generation", "storage_capacity", "variant",
  "price", "currency", "condition", "payment_method", "delivery_terms", "repair_history", "repair_detail",
  "current_function", "material_claim", "accessory",
]);
const ITEM_IDENTITY_FIELDS = new Set(["item", "model", "generation", "product_generation", "storage_capacity", "variant"]);

/** Validate untrusted model proposals against server-supplied source text and conservative field semantics. */
export function validateProposedAnalysis(
  value: unknown,
  sources: AnalysisSource[],
  metadata: Omit<TrustedAnalysisMetadata, "validationStatus">,
): TrustedDealAnalysis {
  const parsed = ProposedAnalysisResponseSchema.parse(value).cases[0]!;
  const sourceMap = new Map(sources.map((source) => [source.source_id, source]));
  const rejected: RejectedObservation[] = [];
  const admittedClaims: CandidateObservation[] = [];
  const admittedFacts: CandidateObservation[] = [];

  const checkEvidence = (field: string, valueToCheck: unknown, attribution: z.infer<typeof AttributionSchema>, evidence: z.infer<typeof EvidenceQuoteSchema>[], currency?: string | null) => {
    if (!evidence.length) return "No supporting quote was supplied.";
    const normalizedField = normalizeField(field);
    if (FORBIDDEN_FACT_FIELDS.has(normalizedField)) return `PPDC rules, seller trust, price verdicts, repair quality, and payment authority cannot be set by model analysis (${field}).`;
    if (!ALLOWED_FACT_FIELDS.has(normalizedField)) return `PPDC does not admit model facts for unsupported field ${field}.`;
    for (const ref of evidence) {
      const source = sourceMap.get(ref.source_id);
      if (!source) return `Unknown evidence source: ${ref.source_id}.`;
      if (!source.text.includes(ref.quote)) return `Evidence quote for ${field} is not an exact substring of source ${ref.source_id}.`;
      if (!attributionMatches(source.speaker, attribution)) return `Attribution for ${field} conflicts with source ${ref.source_id}.`;
      if (ITEM_IDENTITY_FIELDS.has(normalizedField) && source.kind === "photo_ocr" && source.target_entity !== "main_item") {
        return "A label or OCR text not linked to the main item cannot establish the item's identity or generation.";
      }
      if (!quoteSupports(field, valueToCheck, ref.quote, currency)) return `Quote from ${ref.source_id} does not directly support ${field}.`;
    }
    return null;
  };

  for (const fact of parsed.candidate_facts) {
    const reason = checkEvidence(fact.field, fact.value, fact.attribution, fact.evidence, fact.currency);
    if (reason) rejected.push({ field: fact.field, reason }); else admittedFacts.push(fact);
  }
  for (const claim of parsed.seller_claims) {
    if (claim.attribution !== "seller_claim") {
      rejected.push({ field: claim.field, reason: "Seller-claim entries must remain attributed to the seller." });
      continue;
    }
    const invalid = claim.evidence.find((ref) => {
      const source = sourceMap.get(ref.source_id);
      return !source || source.speaker !== "seller" || !source.text.includes(ref.quote)
        || !String(claim.value).trim() || !ref.quote.toLocaleLowerCase().includes(String(claim.value).toLocaleLowerCase());
    });
    if (invalid) rejected.push({ field: claim.field, reason: "Seller claim is not directly present in an attributed seller source quote." });
    else admittedClaims.push(claim);
  }

  const admittedContradictions: TrustedDealAnalysis["contradictions"] = [];
  for (const contradiction of parsed.contradictions) {
    const field = normalizeField(contradiction.field);
    const normalizedValues = contradiction.candidates.map((candidate) => normalizedValue(candidate.value));
    const distinct = new Set(normalizedValues).size > 1;
    const candidateErrors = contradiction.candidates.map((candidate) =>
      checkEvidence(contradiction.field, candidate.value, candidate.attribution, candidate.evidence, candidate.currency));
    if (FORBIDDEN_FACT_FIELDS.has(field) || !distinct || candidateErrors.some(Boolean)) {
      rejected.push({
        field: contradiction.field,
        reason: FORBIDDEN_FACT_FIELDS.has(field)
          ? "The alleged conflict concerns a policy or judgement PPDC does not infer from model output."
          : !distinct ? "Contradiction candidates do not state different values for the same field."
            : candidateErrors.find(Boolean) ?? "Contradiction evidence was not supported.",
      });
      continue;
    }
    admittedContradictions.push(contradiction);
  }

  const allowedNoteFields = new Set([
    "item", "item_description", "model", "generation", "model_generation", "product_generation", "storage_capacity", "variant",
    "price", "currency", "condition", "payment_method", "delivery_terms", "repair_history", "repair_detail",
    "repair_quality", "repair_stability", "accessory", "warranty", "returns", "delivery_timeframe", "seller_identity",
  ]);
  const trustedNotes = (notes: AnalysisNote[], label: string) => notes.flatMap((note) => {
    const field = normalizeField(note.field);
    const invalidQuote = note.evidence.some((ref) => {
      const source = sourceMap.get(ref.source_id);
      return !source || !source.text.includes(ref.quote);
    });
    if (!allowedNoteFields.has(field) || invalidQuote) {
      rejected.push({ field: note.field, reason: `${label} has an unsupported field or unknown/non-matching evidence.` });
      return [];
    }
    const text = label === "Unknown" ? `${field.replaceAll("_", " ")} is not established by the supplied evidence.`
      : `No supported inference was admitted for ${field.replaceAll("_", " ")}.`;
    return [{ ...note, field, text }];
  });
  const questions = prioritizeBuyerQuestions(parsed.buyer_questions);
  const groundedQuotes = [...admittedFacts, ...admittedClaims, ...admittedContradictions.flatMap(({ candidates }) => candidates)]
    .flatMap((observation) => observation.evidence.map((ref) => ref.quote));
  const uniqueGroundedQuotes = [...new Set(groundedQuotes)].slice(0, 3);
  if (parsed.explanation && !sources.some((source) => source.text.includes(parsed.explanation))) {
    rejected.push({ field: "explanation", reason: "Free-form explanation is not an exact source quote; PPDC replaced it with a quote-grounded summary." });
  }
  const explanation = uniqueGroundedQuotes.length
    ? `Evidence-backed excerpts: ${uniqueGroundedQuotes.map((quote) => `“${quote}”`).join(" · ")}.`
    : "No material model observation passed PPDC's evidence checks.";
  const validationStatus = rejected.length ? "partial" : "complete";

  return {
    contractVersion: ANALYSIS_CONTRACT_VERSION,
    status: "proposed",
    provenance: { ...metadata, validationStatus },
    sourceAttribution: sources.map(({ source_id, speaker, kind, target_entity }) => ({ source_id, speaker, kind, ...(target_entity ? { target_entity } : {}) })),
    candidateFacts: admittedFacts,
    sellerClaims: admittedClaims,
    unknowns: trustedNotes(parsed.unknowns, "Unknown"),
    contradictions: admittedContradictions,
    buyerQuestions: questions,
    abstentions: trustedNotes(parsed.abstentions, "Abstention"),
    explanation,
    rejected,
  };
}

/** Keep the highest-impact questions first and cap the user-facing list. */
export function prioritizeBuyerQuestions(questions: string[], maximum = 4): string[] {
  const unique = [...new Set(questions.map((question) => question.trim()).filter(Boolean))]
    .filter((question) => !/(?:should i (?:buy|pay)|pay (?:now|a deposit)|safe to buy|seller (?:is )?trustworthy|is this (?:a )?scam|authorize payment|reveal.*(?:prompt|secret))/i.test(question));
  return unique.map((question, index) => ({ question, index, score: questionPriority(question) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, maximum).map(({ question }) => question);
}

function questionPriority(question: string): number {
  if (/friends\s*(?:&|and)\s*family|goods\s*(?:&|and)\s*services|payment method|protection|payee|payment/i.test(question)) return 100;
  if (/which (?:item|model|generation|variant)|confirm.*(?:model|generation|variant|storage)|exact item|identity/i.test(question)) return 90;
  if (/repair|damage|works|working|condition|stability|authentic/i.test(question)) return 80;
  if (/price|comparable|market|value/i.test(question)) return 70;
  if (/delivery|shipping|postage|collection|tracking/i.test(question)) return 60;
  if (/accessor|included|receipt|record|warranty|return/i.test(question)) return 40;
  return 30;
}

function attributionMatches(speaker: AnalysisSource["speaker"], attribution: z.infer<typeof AttributionSchema>): boolean {
  if (speaker === "seller") return attribution === "seller_claim";
  if (speaker === "buyer" || speaker === "user") return attribution === "buyer_statement" || attribution === "unknown";
  if (speaker === "document") return attribution === "document_text" || attribution === "unknown";
  return attribution === "observed_text" || attribution === "unknown";
}

function quoteSupports(field: string, value: unknown, quote: string, currency?: string | null): boolean {
  const normalizedField = normalizeField(field);
  const valueText = normalizedValue(value);
  if (FORBIDDEN_FACT_FIELDS.has(normalizedField)) return false;
  if (normalizedField === "price") {
    if (typeof value !== "number") return false;
    const price = quote.match(/(£|€|\bGBP\b|\bEUR\b|\bUSD\b|\$)\s*(\d[\d,]*(?:\.\d{1,2})?)/i);
    const marker = price?.[1]?.toUpperCase();
    const quotedCurrency = marker === "£" || marker === "GBP" ? "GBP" : marker === "€" || marker === "EUR" ? "EUR" : marker === "USD" ? "USD" : null;
    return Boolean(price && currency && quotedCurrency === currency && Number(price[2]!.replaceAll(",", "")) === value);
  }
  if (normalizedField === "currency") {
    const expected = typeof value === "string" ? value.toUpperCase() : "";
    const symbol = quote.match(/£|€|\bGBP\b|\bEUR\b|\bUSD\b|\$/i)?.[0]?.toUpperCase();
    const actual = symbol === "£" || symbol === "GBP" ? "GBP" : symbol === "€" || symbol === "EUR" ? "EUR" : symbol === "USD" ? "USD" : null;
    return actual !== null && actual === expected;
  }
  if (normalizedField === "payment_method") {
    if (!valueText) return false;
    const aliases: Record<string, RegExp> = {
      "paypal goods and services": /paypal\s+(?:goods\s*(?:&|and)\s*services)/i,
      "paypal friends and family": /paypal\s+(?:friends\s*(?:&|and)\s*family)/i,
      "bank transfer": /bank\s+transfer/i,
      "cash": /\bcash\b/i,
    };
    const pattern = aliases[valueText];
    return pattern ? pattern.test(quote) : quote.toLocaleLowerCase().includes(valueText);
  }
  if (ITEM_IDENTITY_FIELDS.has(normalizedField) || ["condition", "delivery_terms", "repair_history", "repair_detail", "item_description"].includes(normalizedField)) {
    return typeof value === "string" && value.length > 0 && quote.toLocaleLowerCase().includes(value.toLocaleLowerCase());
  }
  if (value === null || value === undefined) return false;
  return quote.toLocaleLowerCase().includes(valueText);
}

function normalizeField(field: string): string {
  return field.trim().toLocaleLowerCase().replace(/[\s-]+/g, "_");
}
function normalizedValue(value: unknown): string {
  return String(value).trim().toLocaleLowerCase().replace(/\s+/g, " ");
}
