import assert from "node:assert/strict";
import test from "node:test";
import { addEvidenceToDeal, assessDeal } from "./assessment";
import { extractDealFromText } from "./extract-text";
import { questionsFor } from "./presentation";

test("conflict questions use both observed values and work across products", () => {
  for (const [earlier, later] of [[4, 8], [8, 16], [16, 32]]) {
    const deal = extractDealFromText(`Model: Nori Vela Tablet X7. Title says ${earlier} GB RAM. Item specifics say RAM ${later} GB. Price: £200.`);
    const question = questionsFor(deal).find((candidate) => candidate.includes("confirm whether the ram"));
    assert.ok(question, `missing conflict question for ${earlier} GB / ${later} GB`);
    assert.ok(question.includes(`${earlier} GB`));
    assert.ok(question.includes(`${later} GB`));
  }

  const otherProduct = extractDealFromText("Model: Nori Vela Mini PC X7. Title says 16 GB RAM. Item specifics say RAM 32 GB. Price: £240.");
  const question = questionsFor(otherProduct).find((candidate) => candidate.includes("confirm whether the ram"));
  assert.ok(question);
  assert.ok(question.includes("16 GB"));
  assert.ok(question.includes("32 GB"));
  assert.doesNotMatch(question, /laptop/i);
});

test("conflict questions preserve the actual values when evidence is added", () => {
  const original = assessDeal(extractDealFromText("Model: Nori Vela Tablet X7. Asking price £200.", "identity-conflict", "Listing", "listing"));
  const addition = extractDealFromText("Model: Nori Vela Tablet X9.", "identity-conflict", "Seller message", "message");
  const updated = addEvidenceToDeal(original, addition);
  const questions = questionsFor(updated);
  assert.ok(questions.some((question) => question.includes("Nori Vela Tablet X7") && question.includes("Nori Vela Tablet X9")));
});
test("Friends and Family remains the top question when more than four concerns compete", () => {
  const deal = extractDealFromText([
    "Model: Nori Vela Espresso Grinder X7.",
    "Asking price: £240.",
    "Used; repaired motor; condition not independently checked.",
    "Battery health unknown; repair records not shown; exact cosmetic marks unknown; accessories not listed.",
    "Delivery varies; no returns accepted.",
    "PayPal Friends & Family only.",
  ].join(" "));
  deal.unknowns.push(
    { key: "battery_health", value: "Battery health unknown", kind: "unknown", evidenceIds: ["user-input"] },
    { key: "repair_history", value: "Repair history not shown", kind: "unknown", evidenceIds: ["user-input"] },
    { key: "cosmetic_marks", value: "Exact cosmetic marks unknown", kind: "unknown", evidenceIds: ["user-input"] },
    { key: "accessories", value: "Accessories not listed", kind: "unknown", evidenceIds: ["user-input"] },
  );
  const questions = questionsFor(deal);
  assert.equal(questions.length, 4);
  assert.match(questions[0]!, /Goods & Services/);
  assert.ok(!questions.some((question) => /should i buy|safe to buy|pay now/i.test(question)));
});

test("original asking price is separated from conversions and other amounts", () => {
  const before = extractDealFromText("Approximate marketplace conversion: £150. Seller asking price: US$200. Postage: £20. Return postage: £8. Previous price was US$250. VAT: £12.");
  assert.equal(before.price?.value, 200);
  assert.equal(before.currency?.value, "USD");
  assert.deepEqual(before.priceDisplays?.map(({ amount, currency }) => ({ amount, currency })), [{ amount: 150, currency: "GBP" }]);
  assert.equal(before.deliveryTerms?.value?.startsWith("Postage: £20"), true);

  const after = extractDealFromText("Asking price US$200; approximate conversion £150.");
  assert.equal(after.price?.value, 200);
  assert.equal(after.currency?.value, "USD");
  assert.deepEqual(after.priceDisplays?.map(({ amount, currency }) => ({ amount, currency })), [{ amount: 150, currency: "GBP" }]);

  const previousOnly = extractDealFromText("Previous price was £250; the current amount is not shown.");
  assert.equal(previousOnly.price, undefined);
  assert.ok(previousOnly.unknowns.some(({ value }) => /previous price.*current asking price remains unknown/i.test(value)));

  const ambiguous = extractDealFromText("The listing mentions US$200 or £160 but does not say which amount is payable.");
  assert.equal(ambiguous.price, undefined);
  assert.equal(ambiguous.currency, undefined);
  assert.ok(ambiguous.unknowns.some(({ value }) => /original asking price is unclear/i.test(value)));
});

test("a conversion alone never becomes checkout price authority", () => {
  const deal = assessDeal(extractDealFromText("Approximate conversion: £150; original asking amount is not shown."));
  assert.equal(deal.price, undefined);
  assert.equal(deal.currency, undefined);
  assert.ok(deal.priceDisplays?.some(({ amount, currency }) => amount === 150 && currency === "GBP"));
  assert.ok(deal.findings.some(({ ruleId }) => ruleId === "price-missing"));
  assert.ok(questionsFor(deal).some((question) => /current asking price and currency/i.test(question)));
});

test("assessment is stable on repeated runs and after more evidence arrives", () => {
  const first = assessDeal(extractDealFromText("Model: Nori Vela Espresso Grinder X7. Asking price £240. Used. Battery health unknown; accessories not listed; delivery varies.", "stable-deal", "Listing", "listing"));
  const again = assessDeal(first);
  assert.deepEqual(again.findings, first.findings);
  assert.equal(again.conclusion, first.conclusion);
  assert.deepEqual(questionsFor(again), questionsFor(first));

  const addition = extractDealFromText("Seller says the motor was repaired last year; repair record not shown.", "stable-deal", "Seller message", "message");
  const updated = addEvidenceToDeal(first, addition);
  const updatedAgain = assessDeal(updated);
  assert.deepEqual(updatedAgain.findings, updated.findings);
  assert.equal(updatedAgain.conclusion, updated.conclusion);
  assert.ok(updated.evidence.some(({ id }) => id === "message"));
});

test("generic labelled models extract without named-product rules and preserve missing details", () => {
  const deal = extractDealFromText("Model: Nori Vela X7 countertop espresso grinder. Asking price: CA$240. Specs: 240V power; 1.8 litre capacity. Condition and included accessories are not stated.");
  assert.equal(deal.model?.value, "Nori Vela X7 countertop espresso grinder");
  assert.equal(deal.price?.value, 240);
  assert.equal(deal.currency?.value, "CAD");
  assert.equal(deal.condition, undefined);
  assert.ok(deal.unknowns.some(({ value }) => /condition and included accessories are not stated/i.test(value)));
  assert.doesNotMatch(JSON.stringify(deal), /coffee machine brand/i);
});