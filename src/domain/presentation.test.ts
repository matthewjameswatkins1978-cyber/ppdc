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

test("evidence guidance stays practical and specific to delivery information", () => {
  const deal = structuredClone(dealFixtures[0]);
  assert.ok(evidenceToKeep(deal).some((item) => item.includes("tracking")));
  deal.deliveryTerms = undefined;
  assert.ok(evidenceToKeep(deal).some((item) => item.includes("delivery or collection")));
});
