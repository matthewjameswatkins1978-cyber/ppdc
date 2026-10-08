import assert from "node:assert/strict";
import test from "node:test";
import { addEvidenceToDeal, assessDeal } from "./assessment";
import { dealFixtures } from "./fixtures";
import { beforePayFor, changedFacts, evidenceToKeep, formatQuestions, questionsFor } from "./presentation";

test("questions and copy output use current unresolved deal details", () => {
  const deal = structuredClone(dealFixtures.find((item) => item.id === "friends-family-request")!);
  const questions = questionsFor(deal);
  assert.ok(questions.some((question) => question.includes("Goods & Services")));
  assert.match(formatQuestions(questions), /^• /);
  assert.ok(formatQuestions(questions).includes("\n"));
});

test("Before you pay prioritizes existing concerns without changing the assessment", () => {
  const deal = assessDeal(structuredClone(dealFixtures.find((item) => item.id === "friends-family-request")!));
  const before = beforePayFor(deal);
  assert.equal(before[0]?.severity, "red");
  assert.equal(before.length, Math.min(3, deal.findings.length));
  assert.equal(beforePayFor(deal).length, before.length);
});

test("What changed only displays recorded fact conflicts with their source labels", () => {
  const first = structuredClone(dealFixtures[0]);
  const later = structuredClone(first);
  later.price = { key: "price", value: 499, kind: "fact", evidenceIds: ["follow-up"] };
  later.evidence = [{ id: "follow-up", source: "user", label: "Follow-up message", capturedAt: "2026-10-07T12:00:00.000Z", private: false }];
  const updated = addEvidenceToDeal(first, later);
  const changes = changedFacts(updated);
  assert.equal(changes.length, 1);
  assert.equal(changes[0]?.field, "price");
  assert.match(changes[0]?.text ?? "", /different price details/);
  assert.ok(changes[0]?.sources.includes("Follow-up message"));
});

test("repair unknowns lead to a concrete photo and stability question", () => {
  const deal = structuredClone(dealFixtures[0]);
  deal.unknowns = [{ key: "repair_history", value: "Headstock repair history remains unclear", kind: "unknown", evidenceIds: ["listing"] }];
  assert.ok(questionsFor(deal).some((question) => /close-up photos.*repair/i.test(question)));
});
test("payment and photo conflicts produce concrete clarification questions", () => {
  const deal = structuredClone(dealFixtures[0]);
  deal.paymentMethod = { key: "payment_method", value: "PayPal Goods & Services", kind: "fact", evidenceIds: ["listing"] };
  deal.unknowns = [
    { key: "conflict_payment method", value: "Evidence gives different payment method details: Goods & Services and Friends & Family", kind: "unknown", evidenceIds: ["listing", "follow-up"] },
    { key: "photo", value: "Current photo not shown", kind: "unknown", evidenceIds: ["follow-up"] },
  ];
  const questions = questionsFor(deal);
  assert.ok(questions.some((question) => question.includes("Goods & Services")));
  assert.ok(questions.some((question) => question.includes("current photo")));
});

test("validated AI questions reach the main question list without displacing the critical payment question", () => {
  const deal = structuredClone(dealFixtures[0]);
  deal.paymentMethod = { key: "payment_method", value: "PayPal Friends and Family", kind: "fact", evidenceIds: ["listing"] };
  deal.condition = { key: "condition", value: "used", kind: "fact", evidenceIds: ["listing"] };
  deal.deliveryTerms = { key: "delivery_terms", value: "tracked postage", kind: "fact", evidenceIds: ["listing"] };
  deal.aiAnalysis = {
    contractVersion: "ppdc-ai-analysis/1", status: "proposed",
    provenance: { provider: "astropods", model: "synthetic", promptVersion: "test", requestId: "req", conversationId: "conv", startedAt: "2026-10-08T00:00:00.000Z", latencyMs: 1, inputTokens: null, outputTokens: null, costUsd: null, validationStatus: "complete" },
    sourceAttribution: [], candidateFacts: [], sellerClaims: [], unknowns: [], contradictions: [],
    buyerQuestions: ["Can you include the original receipt?", "Can you include the original receipt?", "Should I pay now?"], abstentions: [], explanation: "", rejected: [],
  };
  const questions = questionsFor(deal);
  assert.ok(questions.length <= 4);
  assert.ok(questions.some((question) => /Goods & Services/i.test(question)));
  assert.equal(questions.filter((question) => /original receipt/i.test(question)).length, 1);
  assert.ok(!questions.some((question) => /Should I pay now/i.test(question)));
});
test("evidence guidance stays practical and specific to delivery information", () => {
  const deal = structuredClone(dealFixtures[0]);
  assert.ok(evidenceToKeep(deal).some((item) => item.includes("tracking")));
  deal.deliveryTerms = undefined;
  assert.ok(evidenceToKeep(deal).some((item) => item.includes("delivery or collection")));
});
