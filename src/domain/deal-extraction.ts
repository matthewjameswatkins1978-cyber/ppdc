import { z } from "zod";
import type { Deal, DealFact, Evidence } from "./deal";

export const extractionFields = [
  "item", "model", "price", "currency", "condition", "paymentMethod",
  "deliveryTerms", "materialPromises", "unknowns",
] as const;

export const DealExtractionSchema = z.object({
  item: z.string().nullable(),
  model: z.string().nullable(),
  price: z.number().nonnegative().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  condition: z.string().nullable(),
  paymentMethod: z.string().nullable(),
  deliveryTerms: z.string().nullable(),
  materialPromises: z.array(z.string()),
  unknowns: z.array(z.string()),
  evidenceRefs: z.array(z.object({
    field: z.enum(extractionFields),
    quote: z.string().min(1),
  }).strict()),
}).strict();

/** JSON Schema supported by Gemini's structured response format. Zod revalidates output locally. */
export const DealExtractionJsonSchema = {
  type: "object",
  properties: {
    item: { type: ["string", "null"] },
    model: { type: ["string", "null"] },
    price: { type: ["number", "null"] },
    currency: { type: ["string", "null"] },
    condition: { type: ["string", "null"] },
    paymentMethod: { type: ["string", "null"] },
    deliveryTerms: { type: ["string", "null"] },
    materialPromises: { type: "array", items: { type: "string" } },
    unknowns: { type: "array", items: { type: "string" } },
    evidenceRefs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          field: { type: "string", enum: extractionFields },
          quote: { type: "string" },
        },
        required: ["field", "quote"],
      },
    },
  },
  required: ["item", "model", "price", "currency", "condition", "paymentMethod", "deliveryTerms", "materialPromises", "unknowns", "evidenceRefs"],
} as const;

export type DealExtraction = z.infer<typeof DealExtractionSchema>;
export type ExtractionField = typeof extractionFields[number];

/** Every accepted model result must be schema-valid and traceable to the supplied OCR text. */
export function validateDealExtraction(value: unknown, sourceText: string): DealExtraction {
  const parsed = DealExtractionSchema.parse(value);
  const normalizedSource = normalizeQuote(sourceText);
  for (const reference of parsed.evidenceRefs) {
    if (!normalizedSource.includes(normalizeQuote(reference.quote))) {
      throw new Error(`Extraction evidence quote for ${reference.field} is not present in the supplied text.`);
    }
  }
  for (const field of extractionFields) {
    const hasValue = field === "materialPromises" || field === "unknowns"
      ? parsed[field].length > 0
      : parsed[field] !== null;
    if (hasValue && field !== "unknowns" && !parsed.evidenceRefs.some((ref) => ref.field === field)) {
      throw new Error(`Extraction field ${field} has a value without an evidence reference.`);
    }
  }
  return parsed;
}

export interface DealModelAdapter {
  readonly provider: string;
  extract(sourceText: string): Promise<unknown>;
}

export async function extractWithModel(adapter: DealModelAdapter, sourceText: string): Promise<DealExtraction> {
  return validateDealExtraction(await adapter.extract(sourceText), sourceText);
}

export function extractionToDeal(input: {
  extraction: DealExtraction;
  evidence: Evidence;
  dealId: string;
}): Deal {
  const { extraction: result, evidence, dealId } = input;
  const fact = <T,>(key: string, value: T): DealFact<T> => ({ key, value, kind: "fact", evidenceIds: [evidence.id] });
  const used = new Set(result.evidenceRefs.map(({ field }) => field));
  const absent = (field: ExtractionField, label: string) => used.has(field) ? [] : [{
    key: label, value: `${label} not established by supplied text`, kind: "unknown" as const, evidenceIds: [evidence.id],
  }];
  const unknownFacts = result.unknowns.map((value, index) => {
    const conflictField = value.match(/^Conflicting ([\w ]+?) specifications:/i)?.[1]?.trim().toLocaleLowerCase().replace(/\s+/g, "_");
    return fact(conflictField ? `conflict_${conflictField}` : `unknown_${index + 1}`, value);
  });
  unknownFacts.push(...absent("item", "item"), ...absent("model", "model"), ...absent("price", "price"),
    ...absent("currency", "currency"), ...absent("condition", "condition"),
    ...absent("paymentMethod", "payment method"), ...absent("deliveryTerms", "delivery terms"));
  return {
    id: dealId,
    status: "draft",
    ...(result.item !== null ? { item: fact("item", result.item) } : {}),
    ...(result.model !== null ? { model: fact("model", result.model) } : {}),
    ...(result.price !== null ? { price: fact("price", result.price) } : {}),
    ...(result.currency !== null ? { currency: fact("currency", result.currency) } : {}),
    ...(result.condition !== null ? { condition: fact("condition", result.condition) } : {}),
    ...(result.paymentMethod !== null ? { paymentMethod: fact("payment_method", result.paymentMethod) } : {}),
    ...(result.deliveryTerms !== null ? { deliveryTerms: fact("delivery_terms", result.deliveryTerms) } : {}),
    materialPromises: result.materialPromises.map((value, index) => fact(`claim_${index + 1}`, value)),
    unknowns: unknownFacts,
    evidence: [evidence],
    evidenceRefs: result.evidenceRefs.map(({ field, quote }) => ({ field, evidenceId: evidence.id, quote })),
    findings: [],
  };
}

function normalizeQuote(text: string): string {
  return text.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}
