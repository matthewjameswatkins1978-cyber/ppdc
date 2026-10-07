export type ResearchPurpose = "product_reference" | "public_context";

/** Query values are separate from Evidence so private conversations cannot be passed to search adapters by accident. */
export interface SanitizedPublicQuery {
  query: string;
  purpose: ResearchPurpose;
  locale?: string;
}

function cleanQuery(value: string): string {
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, " ")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

export function productReferenceQuery(input: { product: string; model?: string; condition?: string; locale?: string }): SanitizedPublicQuery {
  const terms = [input.product, input.model, input.condition].filter(Boolean).map((term) => cleanQuery(term!)).filter(Boolean);
  if (terms.length === 0) throw new Error("A product reference query needs a product description.");
  return { query: `${terms.join(" ")} retail reference price${input.locale ? ` ${cleanQuery(input.locale)}` : ""}`, purpose: "product_reference", ...(input.locale ? { locale: input.locale } : {}) };
}

export function publicContextQuery(input: { publicUrl: string; question: string; locale?: string }): SanitizedPublicQuery {
  let url: URL;
  try { url = new URL(input.publicUrl); } catch { throw new Error("Public context requires a valid public URL."); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Public context URL must use HTTP or HTTPS.");
  const host = url.hostname.toLowerCase();
  return { query: `${host} ${cleanQuery(input.question)}`.trim().slice(0, 240), purpose: "public_context", ...(input.locale ? { locale: input.locale } : {}) };
}
