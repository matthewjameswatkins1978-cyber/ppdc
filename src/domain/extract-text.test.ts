import assert from "node:assert/strict";
import test from "node:test";
import { extractDealFromText } from "./extract-text";
import { assessDeal } from "./assessment";
import { questionsFor } from "./presentation";

test("extracts a structured deal including payment and promised items", () => {
  const deal = extractDealFromText("For sale: Fender Player Telecaster. Used, good condition. £450. Tracked postage agreed. Bank transfer only. Seller says includes a hard case.");
  assert.equal(deal.model?.value, "Fender Player Telecaster");
  assert.equal(deal.price?.value, 450);
  assert.equal(deal.currency?.value, "GBP");
  assert.equal(deal.condition?.value, "Used; good condition");
  assert.match(deal.deliveryTerms?.value ?? "", /Tracked postage/);
  assert.equal(deal.paymentMethod?.value, "Bank transfer only");
  assert.equal(deal.materialPromises[0]?.value, "includes a hard case");
  assert.deepEqual(deal.unknowns, []);
  assert.equal(deal.evidence[0]?.private, true);
  assert.equal(deal.evidenceRefs?.find(({ field }) => field === "price")?.quote, "£450");
});

test("does not treat return postage as the item's delivery terms", () => {
  const deal = extractDealFromText("Nintendo Switch HAC-001. Price £150. Used. The listing states 60-day returns with seller-paid return postage.", "synthetic-return-postage");
  assert.equal(deal.deliveryTerms, undefined);
  assert.ok(deal.materialPromises.some(({ value }) => /60-day returns with seller-paid return postage/i.test(value)));
});
test("keeps absent required details unknown without inventing them", () => {
  const deal = extractDealFromText("A guitar is for sale. Seller says it sounds great.");
  assert.equal(deal.price, undefined);
  assert.equal(deal.condition, undefined);
  assert.equal(deal.paymentMethod, undefined);
  assert.equal(deal.deliveryTerms, undefined);
  assert.deepEqual(deal.unknowns.map(({ key }) => key), [
    "model", "price", "currency", "condition", "payment method", "delivery terms",
  ]);
});

test("recognizes currency and preserves explicit unknowns", () => {
  const deal = extractDealFromText("Item: camera. Price €300. Condition not disclosed. Collection only.");
  assert.equal(deal.item?.value, "camera");
  assert.equal(deal.currency?.value, "EUR");
  assert.equal(deal.unknowns[0]?.value, "Condition not disclosed");
  assert.equal(deal.deliveryTerms?.value, "Collection only");
});

test("does not guess a currency from a bare dollar symbol", () => {
  const deal = extractDealFromText("Item: camera. $300. Used. Collection only.");
  assert.equal(deal.price?.value, 300);
  assert.equal(deal.currency, undefined);
  assert.ok(deal.unknowns.some(({ key }) => key === "currency"));
});

test("preserves source-backed model, RAM conflict, disclosed fault, and approximate currency", () => {
  const text = "Nintendo Switch HAC-001. Title says 4GB RAM. Item specifics say RAM size 8 GB. Price: US$199.99, approximately £150.00. Condition: For parts or not working; no power. Seller says: “No charger included.”";
  const deal = assessDeal(extractDealFromText(text, "synthetic-conflict", "Synthetic listing", "synthetic-listing"));
  assert.equal(deal.model?.value, "Nintendo Switch HAC-001");
  assert.equal(deal.currency?.value, "USD");
  assert.equal(deal.price?.value, 199.99);
  assert.ok(deal.unknowns.some(({ key, value }) => key === "conflict_ram" && /4 GB.*8 GB/.test(value)));
  assert.deepEqual(deal.priceDisplays?.map(({ amount, currency, kind }) => ({ amount, currency, kind })), [{ amount: 150, currency: "GBP", kind: "approximate_conversion" }]);
  assert.equal(deal.priceDisplays?.[0]?.quote, "approximately £150.00");
  assert.ok(deal.findings.find(({ ruleId }) => ruleId === "price-stated")?.explanation.includes("marketplace also displays GBP 150"));
  assert.ok(!deal.unknowns.some(({ value }) => /approximate converted amount/.test(value)));
  assert.ok(deal.findings.some(({ ruleId, severity }) => ruleId === "conflict_ram" && severity === "amber"));
  assert.ok(deal.findings.some(({ ruleId, severity }) => ruleId === "condition-disclosed-faults" && severity === "amber"));
  assert.ok(deal.materialPromises.some(({ value }) => /No charger included/.test(value)));
  assert.match(deal.condition?.value ?? "", /No charger included/);
  assert.ok(deal.evidenceRefs?.some(({ quote }) => quote === "Title says 4GB RAM"));
  assert.ok(deal.evidenceRefs?.some(({ quote }) => quote === "Item specifics say RAM size 8 GB"));
  const questions = questionsFor(deal);
  assert.ok(questions.length <= 4);
  assert.ok(questions.some((question) => /4 GB or 8 GB/.test(question)));
});

test("recognizes adjacent laptop generations and Switch OLED without guessing", () => {
  const hp = assessDeal(extractDealFromText("HP Laptop 250 G8. Price £80. Condition: For parts or not working. Seller notes disclose a broken screen and no charger. Battery runtime not tested."));
  assert.equal(hp.model?.value, "HP Laptop 250 G8");
  assert.ok(hp.findings.some(({ ruleId, severity }) => ruleId === "condition-disclosed-faults" && severity === "amber"));
  assert.ok(hp.materialPromises.some(({ value }) => /broken screen and no charger/i.test(value)));

  const oled = assessDeal(extractDealFromText("Nintendo Switch OLED 64GB. Price £100. Condition: Used. Seller says: “good condition and perfect working order”. No charger included. Delivery varies; no returns accepted."));
  assert.equal(oled.model?.value, "Nintendo Switch OLED 64GB");
  assert.ok(oled.findings.some(({ ruleId, severity }) => ruleId === "condition-disclosed-faults" && severity === "amber"));
  assert.ok(oled.materialPromises.some(({ value }) => /good condition and perfect working order/i.test(value)));
  assert.ok(!questionsFor(oled).some((question) => /accessories are included/i.test(question)));
});
test("keeps unasked details visible beyond the question cap and explains variable delivery", () => {
  const deal = assessDeal(extractDealFromText("Apple iPhone 13, 128 GB, unlocked. Price £220. Used. Battery health and exact cosmetic defects are not stated. No charger included. Delivery varies; no returns accepted.", "synthetic-specific-unknowns"));
  const questions = questionsFor(deal);
  assert.ok(deal.unknowns.some(({ value }) => /Battery health and exact cosmetic defects/.test(value)));
  const unknownFinding = deal.findings.find(({ ruleId }) => ruleId === "recorded-unknowns");
  assert.match(unknownFinding?.explanation ?? "", /exact cosmetic defects/);
  assert.ok(deal.findings.some(({ ruleId, severity }) => ruleId === "delivery-variable" && severity === "amber"));
  assert.ok(questions.some((question) => /final delivery cost/i.test(question)));
  assert.ok(questions.length <= 4);
});
test("treats seller-reported damage and an unknown model year as open details", () => {
  const deal = assessDeal(extractDealFromText("Fender Player Telecaster. Price £500. Used. Model year: Unknown. Seller says normal-use damage, but no problem playing. Delivery varies.", "synthetic-model-year"));
  assert.equal(deal.model?.value, "Fender Player Telecaster");
  assert.ok(deal.materialPromises.some(({ value }) => /normal-use damage/i.test(value)));
  assert.ok(deal.findings.some(({ ruleId, severity }) => ruleId === "condition-disclosed-faults" && severity === "amber"));
  assert.ok(questionsFor(deal).some((question) => /model year/i.test(question)));
  assert.ok(!deal.findings.some(({ ruleId }) => ruleId === "recorded-unknowns"));
});
test("does not show an umbrella Unknowns card for only absent standard fields", () => {
  const deal = assessDeal(extractDealFromText("A guitar is for sale.", "synthetic-unknowns"));
  assert.ok(deal.unknowns.length > 0);
  assert.ok(!deal.findings.some(({ ruleId }) => ruleId === "recorded-unknowns"));
});
