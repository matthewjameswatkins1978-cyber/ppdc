import "server-only";
import type { Evidence, EvidenceSource } from "../domain/deal";
import type { SanitizedPublicQuery } from "../domain/research-query";

export interface SearchResult {
  title: string;
  url?: string;
  excerpt?: string;
  price?: string;
  merchant?: string;
}

export interface ResearchResponse {
  provider: "channel3" | "parallel";
  capturedAt: string;
  results: SearchResult[];
  evidence: Evidence[];
}

function apiKey(name: "CHANNEL3_API_KEY" | "PARALLEL_API_KEY"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pickList(payload: unknown): Record<string, unknown>[] {
  if (!isRecord(payload)) return [];
  for (const key of ["results", "products", "items", "data"]) {
    const value = payload[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  return [];
}

function evidenceFor(source: EvidenceSource, rows: SearchResult[], capturedAt: string): Evidence[] {
  return rows.map((row, index) => ({
    id: `${source}-${index + 1}`,
    source,
    ...(row.url ? { sourceRef: row.url } : {}),
    label: row.title,
    capturedAt,
    private: false,
  }));
}

export async function searchChannel3(query: SanitizedPublicQuery): Promise<ResearchResponse> {
  if (query.purpose !== "product_reference") throw new Error("Channel3 is reserved for product-reference queries.");
  const response = await fetch("https://api.trychannel3.com/v1/search", {
    method: "POST",
    headers: { "x-api-key": apiKey("CHANNEL3_API_KEY"), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: query.query, limit: 5 }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Channel3 search failed (${response.status}).`);
  const payload: unknown = await response.json();
  const capturedAt = new Date().toISOString();
  const results = pickList(payload).map((item) => {
    const offers = Array.isArray(item.offers) ? item.offers.filter(isRecord) : [];
    const offer = offers[0];
    const priceValue = offer && typeof offer.price === "string" ? offer.price : typeof item.price === "string" ? item.price : undefined;
    return {
      title: typeof item.title === "string" ? item.title : typeof item.name === "string" ? item.name : "Product reference",
      ...(typeof item.url === "string" ? { url: item.url } : typeof item.product_url === "string" ? { url: item.product_url } : {}),
      ...(priceValue ? { price: priceValue } : {}),
      ...(offer && typeof offer.merchant === "string" ? { merchant: offer.merchant } : {}),
    };
  });
  return { provider: "channel3", capturedAt, results, evidence: evidenceFor("channel3", results, capturedAt) };
}

export async function searchParallel(query: SanitizedPublicQuery): Promise<ResearchResponse> {
  if (query.purpose !== "public_context") throw new Error("Parallel is reserved for broader public-context queries.");
  const response = await fetch("https://api.parallel.ai/v1/search", {
    method: "POST",
    headers: { "x-api-key": apiKey("PARALLEL_API_KEY"), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ objective: `Find public information relevant to: ${query.query}`, search_queries: [query.query], mode: "turbo" }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Parallel search failed (${response.status}).`);
  const payload: unknown = await response.json();
  const capturedAt = new Date().toISOString();
  const results = pickList(payload).map((item) => ({
    title: typeof item.title === "string" ? item.title : "Public web source",
    ...(typeof item.url === "string" ? { url: item.url } : {}),
    ...(Array.isArray(item.excerpts) && typeof item.excerpts[0] === "string" ? { excerpt: item.excerpts[0].slice(0, 500) } : {}),
  }));
  return { provider: "parallel", capturedAt, results, evidence: evidenceFor("parallel", results, capturedAt) };
}
