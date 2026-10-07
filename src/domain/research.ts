export type ResearchProvider = "channel3" | "parallel";
export type ResearchPurpose = "product_reference" | "public_context";
export type ResearchDelivery = "live" | "cache" | "fixture";
export type ResearchOutcome = "results" | "insufficient" | "disagreement" | "unavailable";

export interface ResearchPrice {
  amount: number;
  currency: string;
  condition?: "new" | "used" | "refurbished";
}

/** A small, normalized source record. Raw provider payloads and request headers are never stored. */
export interface ResearchResult {
  id: string;
  title: string;
  url?: string;
  merchant?: string;
  price?: ResearchPrice;
}

/** Provenance for one user-requested search; query contains sanitized product facts only. */
export interface ResearchRun {
  id: string;
  provider: ResearchProvider;
  purpose: ResearchPurpose;
  safeQuery: string;
  checkedAt: string;
  retrievedAt?: string;
  delivery: ResearchDelivery;
  outcome: ResearchOutcome;
  resultIds: string[];
  message?: string;
}