import "server-only";
import { createHash } from "node:crypto";
import type { Evidence } from "../domain/deal";
import type { ResearchResult } from "../domain/research";
import type { SanitizedPublicQuery } from "../domain/research-query";

export interface ResearchResponse {
  provider: "channel3" | "parallel";
  capturedAt: string;
  results: ResearchResult[];
  evidence: Evidence[];
}

function apiKey(name: "CHANNEL3_API_KEY" | "PARALLEL_API_KEY"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function isRecord(payload: unknown): payload is Record<string, unknown> {
  return typeof payload === "object" && payload !== null && !Array.isArray(payload);
}

function rows(payload: unknown, keys: string[]): Record<string, unknown>[] {
  if (!isRecord(payload)) return [];
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  return [];
}

const personalData = /(?:[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\+?\d[\d\s().-]{7,}\d|\b\d{1,6}\s+[\p{L}.'-]+\s+(?:street|st\.?|road|rd\.?|lane|ln\.?|avenue|ave\.?|drive|dr\.?|close|court|way|crescent|postcode|postal)\b)/iu;

function safeLabel(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, 180);
  return cleaned && !personalData.test(cleaned) ? cleaned : undefined;
}

function safeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    if (personalData.test(url.href)) return `${url.origin}/`;
    return url.href.slice(0, 500);
  } catch { return undefined; }
}

function safeCatalogUrl(value: unknown): string | undefined {
  const url = safeUrl(value);
  if (!url) return undefined;
  try { return new URL(url).hostname.toLowerCase() === "buy.trychannel3.com" ? undefined : url; }
  catch { return undefined; }
}

function safePrice(value: unknown): ResearchResult["price"] {
  if (!isRecord(value)) return undefined;
  const amount = typeof value.amount === "number" ? value.amount : value.price;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return undefined;
  if (typeof value.currency !== "string" || !/^[A-Z]{3}$/.test(value.currency)) return undefined;
  const condition = typeof value.condition === "string" && ["new", "used", "refurbished"].includes(value.condition.toLowerCase())
    ? value.condition.toLowerCase() as "new" | "used" | "refurbished"
    : undefined;
  return { amount, currency: value.currency, ...(condition ? { condition } : {}) };
}

function resultId(provider: ResearchResponse["provider"], title: string, url: string | undefined, price: ResearchResult["price"]): string {
  const key = [provider, title.toLowerCase(), url ?? "", price ? `${price.amount}:${price.currency}:${price.condition ?? ""}` : ""].join("|");
  return `${provider}-${createHash("sha256").update(key).digest("hex").slice(0, 16)}`;
}

function evidenceFor(provider: ResearchResponse["provider"], results: ResearchResult[], capturedAt: string): Evidence[] {
  return results.map((result) => ({
    id: result.id,
    source: provider,
    ...(result.url ? { sourceRef: result.url } : {}),
    label: result.title,
    capturedAt,
    private: false,
  }));
}

function createResult(provider: ResearchResponse["provider"], rawTitle: unknown, rawUrl: unknown, price?: unknown, merchant?: unknown): ResearchResult | undefined {
  const title = safeLabel(rawTitle);
  if (!title) return undefined;
  const url = safeUrl(rawUrl);
  const safeMerchant = safeLabel(merchant);
  const cleanedPrice = safePrice(price);
  return {
    id: resultId(provider, title, url, cleanedPrice),
    title,
    ...(url ? { url } : {}),
    ...(safeMerchant ? { merchant: safeMerchant } : {}),
    ...(cleanedPrice ? { price: cleanedPrice } : {}),
  };
}

function channel3Results(payload: unknown): ResearchResult[] {
  const output: ResearchResult[] = [];
  for (const product of rows(payload, ["products", "results", "items", "data"]).slice(0, 5)) {
    const title = product.title ?? product.name;
    const offers = Array.isArray(product.offers) ? product.offers.filter(isRecord).slice(0, 4) : [];
    if (offers.length === 0) {
      const result = createResult("channel3", title, product.url ?? product.product_url);
      if (result) output.push(result);
      continue;
    }
    for (const offer of offers) {
      const rawPrice = isRecord(offer.price) ? offer.price : undefined;
      const price = rawPrice ? {
        amount: rawPrice.price ?? rawPrice.amount,
        currency: rawPrice.currency,
        condition: offer.condition,
      } : undefined;
      const result = createResult("channel3", title, safeCatalogUrl(offer.url ?? offer.product_url ?? product.url), price, offer.domain ?? offer.merchant);
      if (result) output.push(result);
    }
  }
  return output.slice(0, 12);
}

function parallelResults(payload: unknown): ResearchResult[] {
  return rows(payload, ["results", "items", "data"]).slice(0, 10).flatMap((item) => {
    const result = createResult("parallel", item.title, item.url);
    return result ? [result] : [];
  });
}

export async function searchChannel3(query: SanitizedPublicQuery): Promise<ResearchResponse> {
  if (query.provider !== "channel3" || query.purpose !== "product_reference") throw new Error("Channel3 is reserved for product-reference queries.");
  const response = await fetch("https://api.trychannel3.com/v1/search", {
    method: "POST",
    headers: { "x-api-key": apiKey("CHANNEL3_API_KEY"), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: query.query, limit: 5 }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Channel3 search failed (${response.status}).`);
  const payload: unknown = await response.json();
  const capturedAt = new Date().toISOString();
  const results = channel3Results(payload);
  return { provider: "channel3", capturedAt, results, evidence: evidenceFor("channel3", results, capturedAt) };
}

export async function searchParallel(query: SanitizedPublicQuery): Promise<ResearchResponse> {
  if (query.provider !== "parallel" || query.purpose !== "public_context") throw new Error("Parallel is reserved for broader public-context queries.");
  const response = await fetch("https://api.parallel.ai/v1/search", {
    method: "POST",
    headers: { "x-api-key": apiKey("PARALLEL_API_KEY"), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ objective: `Find public product information relevant to: ${query.query}`, search_queries: [query.query], mode: "turbo" }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Parallel search failed (${response.status}).`);
  const payload: unknown = await response.json();
  const capturedAt = new Date().toISOString();
  const results = parallelResults(payload);
  return { provider: "parallel", capturedAt, results, evidence: evidenceFor("parallel", results, capturedAt) };
}
