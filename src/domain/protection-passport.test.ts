import assert from "node:assert/strict";
import test from "node:test";
import { dealFixtures } from "./fixtures";
import { createProtectionPassport } from "./protection-passport";

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
