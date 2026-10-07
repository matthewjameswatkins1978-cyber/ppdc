import assert from "node:assert/strict";
import test from "node:test";
import { dealFixtures } from "./fixtures";
import { createProtectionPassport } from "./protection-passport";
import { renderProtectionPassport } from "../server/checkout-pages";

test("Protection Passport snapshots normalized research provenance and sources", () => {
  const deal = structuredClone(dealFixtures[0]);
  deal.researchRuns = [{
    id: "research-1", provider: "channel3", purpose: "product_reference", safeQuery: "Fender Player Telecaster used UK",
    checkedAt: "2026-10-07T12:00:00.000Z", retrievedAt: "2026-10-07T11:59:59.000Z", delivery: "cache", outcome: "insufficient", resultIds: ["source-1"],
  }];
  deal.researchResults = [{ id: "source-1", title: "Fender Player Telecaster reference", url: "https://example.com/item", price: { amount: 500, currency: "GBP", condition: "used" } }];
  const passport = createProtectionPassport({ id: "passport-1", deal, paypalOrderId: "order-1", createdAt: "2026-10-07T12:01:00.000Z" });
  assert.equal(passport.researchRuns?.[0]?.delivery, "cache");
  assert.equal(passport.researchRuns?.[0]?.retrievedAt, "2026-10-07T11:59:59.000Z");
  assert.equal(passport.researchResults?.[0]?.id, "source-1");
  assert.equal(passport.researchResults?.[0]?.price?.currency, "GBP");
});

test("Protection Passport separates payment method in deal evidence from completed transaction route", () => {
  const deal = structuredClone(dealFixtures[0]);
  const passport = createProtectionPassport({ id: "passport-2", deal, paypalOrderId: "order-2", createdAt: "2026-10-07T12:01:00.000Z" });
  const html = renderProtectionPassport(passport);
  assert.equal(passport.statedPaymentMethod, undefined);
  assert.match(html, /Payment method in deal evidence:<\/strong> Not stated/);
  assert.match(html, /Payment completed through PayPal Sandbox/);
  assert.match(html, /COMPLETED/);
});
