import assert from "node:assert/strict";
import test from "node:test";
import { extractDealFromText } from "./extract-text";

test("extracts a structured deal including payment and promised items", () => {
  const deal = extractDealFromText("For sale: Fender Player Telecaster. Used, good condition. £450. Tracked postage agreed. Bank transfer only. Seller says includes a hard case.");
  assert.equal(deal.model?.value, "Fender Player Telecaster");
  assert.equal(deal.price?.value, 450);
  assert.equal(deal.currency?.value, "GBP");
  assert.equal(deal.condition?.value, "Used");
  assert.match(deal.deliveryTerms?.value ?? "", /Tracked postage/);
  assert.equal(deal.paymentMethod?.value, "Bank transfer only");
  assert.equal(deal.materialPromises[0]?.value, "includes a hard case");
  assert.deepEqual(deal.unknowns, []);
  assert.equal(deal.evidence[0]?.private, true);
  assert.equal(deal.evidenceRefs?.find(({ field }) => field === "price")?.quote, "£450");
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
