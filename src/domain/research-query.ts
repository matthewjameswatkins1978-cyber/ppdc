import type { Deal } from "./deal";
import type { ResearchProvider, ResearchPurpose } from "./research";

export interface SanitizedPublicQuery {
  query: string;
  purpose: ResearchPurpose;
  provider: ResearchProvider;
  product: string;
  model?: string;
  condition?: "new" | "used" | "refurbished";
  market?: string;
  locale?: string;
}

const riskyContent = /(?:[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\+?\d[\d\s().-]{7,}\d|\b\d{1,6}\s+[\p{L}.'-]+\s+(?:street|st\.?|road|rd\.?|lane|ln\.?|avenue|ave\.?|drive|dr\.?|close|court|way|crescent|postcode|postal)\b|\b(?:seller|buyer|phone|email|address|postcode|private chat|message transcript|payment account|paypal account|ignore (?:all |previous )?instructions|ai assistant|search for|look up)\b|https?:\/\/|www\.)/iu;

function productTerm(value: string | undefined, label: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > 100 || riskyContent.test(normalized)) {
    throw new Error(`The ${label} contains content that is not safe to send to public research.`);
  }
  const cleaned = normalized.replace(/[^\p{L}\p{N} .+'()/-]/gu, " ").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.split(" ").length > 10) throw new Error(`The ${label} is too broad for a safe public query.`);
  return cleaned;
}

function conditionBucket(value?: string): "new" | "used" | "refurbished" | undefined {
  if (!value) return undefined;
  if (/\b(?:new|brand new|sealed)\b/i.test(value)) return "new";
  if (/\b(?:refurbished|remanufactured)\b/i.test(value)) return "refurbished";
  if (/\b(?:used|second[ -]hand|pre[ -]owned|damaged|repair(?:ed)?|worn|fair|good condition)\b/i.test(value)) return "used";
  return undefined;
}

/** Build one product-only query from accepted structured facts; raw evidence is never read here. */
export function planProductResearch(deal: Deal, provider: ResearchProvider): SanitizedPublicQuery {
  const productFact = deal.item?.kind === "fact" && deal.item.evidenceIds.length > 0 ? deal.item : undefined;
  const modelFact = deal.model?.kind === "fact" && deal.model.evidenceIds.length > 0 ? deal.model : undefined;
  const model = productTerm(modelFact?.value, "model");
  const product = productTerm(productFact?.value ?? modelFact?.value, "product");
  if (!product) throw new Error("Add an evidence-backed product or model before checking public context.");
  const condition = conditionBucket(deal.condition?.kind === "fact" ? deal.condition.value : undefined);
  const market = deal.currency?.kind === "fact" && deal.currency.value === "GBP" ? "UK" : undefined;
  const identity = model && product && !model.toLocaleLowerCase().includes(product.toLocaleLowerCase()) && !product.toLocaleLowerCase().includes(model.toLocaleLowerCase()) ? `${model} ${product}` : model && model.length > product.length ? model : product;
  const terms = [identity, condition, market].filter(Boolean);
  const purpose: ResearchPurpose = provider === "channel3" ? "product_reference" : "public_context";
  const question = provider === "channel3" ? "product offers and specifications" : "official product specifications and model generation";
  return {
    query: `${terms.join(" ")} ${question}`.slice(0, 240),
    purpose,
    provider,
    product,
    ...(model ? { model } : {}),
    ...(condition ? { condition } : {}),
    ...(market ? { market, locale: "en-GB" } : {}),
  };
}

/** Compatibility helper for the existing smoke command; all terms still pass through the privacy guard. */
export function productReferenceQuery(input: { product: string; model?: string; condition?: string; locale?: string }): SanitizedPublicQuery {
  const product = productTerm(input.product, "product");
  const model = productTerm(input.model, "model");
  const condition = conditionBucket(input.condition);
  if (!product) throw new Error("A product reference query needs a product description.");
  const locale = input.locale && /^[A-Z]{2}$/i.test(input.locale) ? input.locale.toUpperCase() : undefined;
  const terms = [...new Set([model, product].filter((value): value is string => Boolean(value)))];
  return {
    query: `${terms.join(" ")} ${condition ?? ""} product offers and specifications ${locale ?? ""}`.replace(/\s+/g, " ").trim().slice(0, 240),
    purpose: "product_reference", provider: "channel3", product,
    ...(model ? { model } : {}), ...(condition ? { condition } : {}), ...(locale ? { market: locale, locale } : {}),
  };
}

/** Public URL mode exposes only its hostname and a vetted, non-personal question. */
export function publicContextQuery(input: { publicUrl: string; question: string; locale?: string }): SanitizedPublicQuery {
  let url: URL;
  try { url = new URL(input.publicUrl); } catch { throw new Error("Public context requires a valid public URL."); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Public context URL must use HTTP or HTTPS.");
  const question = productTerm(input.question, "public question");
  if (!question) throw new Error("Public context needs a focused question.");
  const host = url.hostname.toLowerCase();
  const locale = input.locale && /^[A-Z]{2}$/i.test(input.locale) ? input.locale.toUpperCase() : undefined;
  return { query: `${host} ${question}`.slice(0, 240), purpose: "public_context", provider: "parallel", product: host, ...(locale ? { market: locale, locale } : {}) };
}
