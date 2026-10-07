import assert from "node:assert/strict";
import test from "node:test";
import { addEvidenceToDeal, assessDeal } from "./assessment";
import { dealFixtures } from "./fixtures";
import { extractDealFromText } from "./extract-text";

test("clear fixture has grounded green findings without implying independent verification", () => {
  const deal = assessDeal(dealFixtures[0]);
  assert.ok(deal.findings.some((finding) => finding.severity === "green"));
  assert.match(deal.conclusion ?? "", /No public price or seller checks have been run/i);
});

test("an unclear bargain receives amber questions, not an accusation", () => {
  const deal = assessDeal(dealFixtures[2]);
  assert.ok(deal.findings.some((finding) => finding.severity === "amber"));
  assert.ok(deal.findings.every((finding) => finding.severity !== "red"));
  assert.doesNotMatch(deal.conclusion ?? "", /scam|fraudulent/i);
});

test("Friends & Family request is a red finding tied to its evidence", () => {
  const deal = assessDeal(dealFixtures[3]);
  const finding = deal.findings.find((item) => item.ruleId === "friends-family-purchase");
  assert.equal(finding?.severity, "red");
  assert.deepEqual(finding?.evidenceIds, ["listing"]);
});

test("new evidence updates the same deal and retains both provenance records", () => {
  const first = extractDealFromText("For sale: Used guitar. £300. PayPal Goods & Services. Tracked postage.", "same-deal", "Listing", "evidence-1");
  const assessed = assessDeal(first);
  const second = extractDealFromText("Seller says includes original case. Serial number not shown.", "same-deal", "Seller message", "evidence-2");
  const updated = addEvidenceToDeal(assessed, second);
  assert.equal(updated.id, "same-deal");
  assert.deepEqual(updated.evidence.map(({ id }) => id), ["evidence-1", "evidence-2"]);
  assert.ok(updated.materialPromises[0].evidenceIds.includes("evidence-2"));
  assert.ok(updated.evidenceRefs?.some(({ evidenceId }) => evidenceId === "evidence-2"));
  assert.ok(updated.unknowns.every(({ value }) => !String(value).endsWith("not established by supplied text") || String(value).startsWith("model ")));
});

test("conflicting new price evidence keeps the first value and records both sources", () => {
  const first = extractDealFromText("Used guitar £300", "same-deal", "Listing", "evidence-1");
  const second = extractDealFromText("Used guitar £250", "same-deal", "Seller message", "evidence-2");
  const updated = addEvidenceToDeal(first, second);
  assert.equal(updated.price?.value, 300);
  const conflict = updated.unknowns.find(({ key }) => key === "conflict_price");
  assert.deepEqual(conflict?.evidenceIds, ["evidence-1", "evidence-2"]);
});