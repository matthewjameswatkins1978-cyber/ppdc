import assert from "node:assert/strict";
import test from "node:test";
import { dealFixtures } from "./fixtures";
import { integrateValidatedAnalysis } from "./ai-deal-integration";
import type { TrustedDealAnalysis } from "./ai-analysis";

const metadata = { provider: "astropods", model: "synthetic", promptVersion: "test", requestId: "req", conversationId: "conv", startedAt: "2026-10-08T00:00:00.000Z", latencyMs: 1, inputTokens: null, outputTokens: null, costUsd: null, validationStatus: "complete" } as const;

test("integrates only allowed missing facts, records repair statements as unverified claims, and preserves contradictions", () => {
  const deal = structuredClone(dealFixtures[0]);
  deal.model = undefined;
  const analysis: TrustedDealAnalysis = {
    contractVersion: "ppdc-ai-analysis/1", status: "proposed", provenance: metadata,
    sourceAttribution: [
      { source_id: "seller-note", speaker: "seller", kind: "seller_message" },
      { source_id: "buyer-note", speaker: "buyer", kind: "buyer_message" },
    ],
    candidateFacts: [
      { field: "model", value: "Fender Player Telecaster", attribution: "seller_claim", evidence: [{ source_id: "seller-note", quote: "Fender Player Telecaster" }] },
      { field: "payment_method", value: "PayPal Goods & Services", attribution: "seller_claim", evidence: [{ source_id: "seller-note", quote: "PayPal Goods & Services" }] },
      { field: "price", value: 900, currency: "GBP", attribution: "seller_claim", evidence: [{ source_id: "seller-note", quote: "£900" }] },
    ], sellerClaims: [
      { field: "repair_history", value: "headstock was repaired", attribution: "seller_claim", evidence: [{ source_id: "seller-note", quote: "headstock was repaired" }] },
    ], unknowns: [], contradictions: [{ field: "condition", resolution: null, candidates: [
      { value: "good", attribution: "seller_claim", evidence: [{ source_id: "seller-note", quote: "good" }] },
      { value: "damaged", attribution: "buyer_statement", evidence: [{ source_id: "buyer-note", quote: "damaged" }] },
    ] }], buyerQuestions: [], abstentions: [], explanation: "", rejected: [],
  };
  const result = integrateValidatedAnalysis(deal, analysis);
  assert.equal(result.model?.value, "Fender Player Telecaster");
  assert.equal(result.paymentMethod?.value, "PayPal Goods & Services");
  assert.equal(result.price?.value, deal.price?.value);
  assert.ok(result.materialPromises.some(({ value, evidenceIds }) => /Seller stated: headstock was repaired/.test(value) && evidenceIds.includes("seller-note")));
  assert.ok(result.unknowns.some(({ key, value }) => key === "conflict_condition" && /good \/ damaged/.test(value)));
});
