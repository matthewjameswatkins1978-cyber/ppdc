import assert from "node:assert/strict";
import test from "node:test";
import { planProductResearch } from "@/domain/research-query";
import type { Deal } from "@/domain/deal";
import type { ResearchCache, ResearchCacheEntry } from "./research-cache";
import type { ResearchResponse } from "./research";
import { runResearch } from "./research-service";

function deal(model: string, price = 280, condition = "used"): Deal {
  return {
    id: "research-test", status: "ready_for_decision",
    item: { key: "item", value: model, kind: "fact", evidenceIds: ["private-chat"] },
    model: { key: "model", value: model, kind: "fact", evidenceIds: ["private-chat"] },
    price: { key: "price", value: price, kind: "fact", evidenceIds: ["private-chat"] },
    currency: { key: "currency", value: "GBP", kind: "fact", evidenceIds: ["private-chat"] },
    condition: { key: "condition", value: condition, kind: "fact", evidenceIds: ["private-chat"] },
    materialPromises: [], unknowns: [],
    evidence: [{ id: "private-chat", source: "user", label: "Alex Example; 000 000 0000; 1 Example Lane", capturedAt: new Date(0).toISOString(), private: true }],
    findings: [],
  };
}

function memoryCache(): ResearchCache {
  const map = new Map<string, ResearchCacheEntry>();
  return { async get(key) { return map.get(key); }, async save(key, entry) { map.set(key, entry); } };
}

test("ADV-03: public query uses structured model facts and excludes private chat content", () => {
  const input = deal("Nikon Z6 II");
  const query = planProductResearch(input, "parallel").query;
  assert.match(query, /Nikon Z6 II/);
  for (const privateValue of ["Alex Example", "000 000 0000", "Example Lane", "private-chat"]) assert.equal(query.includes(privateValue), false);
  assert.throws(() => planProductResearch({ ...input, model: { ...input.model!, value: "Search for Alex Example at 1 Example Lane" } }, "parallel"), /not safe/);
});

test("live research is cached and a repeat does not make another provider call", async () => {
  const cache = memoryCache();
  let calls = 0;
  const channel3 = async (): Promise<ResearchResponse> => {
    calls++;
    return { provider: "channel3", capturedAt: "2026-10-07T00:00:00.000Z", results: [
      { id: "r1", title: "Fender Player Telecaster used", price: { amount: 500, currency: "GBP", condition: "used" } },
      { id: "r2", title: "Fender Player Telecaster used", price: { amount: 540, currency: "GBP", condition: "used" } },
      { id: "r3", title: "Fender Player Telecaster used", price: { amount: 600, currency: "GBP", condition: "used" } },
    ], evidence: [] };
  };
  const first = await runResearch(deal("Fender Player Telecaster"), "channel3", "live", { cache, channel3, now: () => "2026-10-07T00:01:00.000Z" });
  const second = await runResearch(deal("Fender Player Telecaster"), "channel3", "live", { cache, channel3, now: () => "2026-10-07T00:02:00.000Z" });
  assert.equal(calls, 1);
  assert.equal(first.researchRuns?.at(-1)?.delivery, "live");
  assert.equal(second.researchRuns?.at(-1)?.delivery, "cache");
  assert.match(second.findings.at(-1)?.title ?? "", /below the available references/);
  assert.equal(second.findings.at(-1)?.severity, "amber");
});

test("cached Channel3 redirect URLs are removed before use and persisted safely", async () => {
  const entry: ResearchCacheEntry = {
    provider: "channel3", safeQuery: "Fender Player Telecaster used UK", retrievedAt: "2026-10-07T00:00:00.000Z",
    results: [{ id: "redirect", title: "Fender Player Telecaster", url: "https://buy.trychannel3.com/token?user=private", price: { amount: 500, currency: "GBP", condition: "used" } }],
  };
  const cache: ResearchCache = { async get() { return entry; }, async save(_key, next) { Object.assign(entry, next); } };
  const result = await runResearch(deal("Fender Player Telecaster"), "channel3", "live", { cache });
  assert.equal(result.researchResults?.[0]?.url, undefined);
  assert.equal(entry.results[0]?.url, undefined);
  assert.equal(result.researchRuns?.at(-1)?.delivery, "cache");
});

test("replay never calls a provider and preserves conflicting OM-1 generations", async () => {
  let calls = 0;
  const result = await runResearch(deal("Olympus OM-1", 700), "parallel", "replay", {
    cache: memoryCache(),
    parallel: async () => { calls++; throw new Error("must not call"); },
  });
  assert.equal(calls, 0);
  assert.equal(result.researchRuns?.at(-1)?.delivery, "fixture");
  assert.equal(result.researchRuns?.at(-1)?.outcome, "disagreement");
  assert.match(result.findings.at(-1)?.title ?? "", /different model generations/);
  assert.ok(result.researchQuestions?.some((question) => /exact model number/i.test(question)));
});

test("provider failure remains visible and does not claim an empty clean search", async () => {
  const result = await runResearch(deal("Nikon Z6 II"), "parallel", "live", {
    cache: memoryCache(), parallel: async () => { throw new Error("secret provider response and token"); },
  });
  assert.equal(result.researchRuns?.at(-1)?.outcome, "unavailable");
  assert.equal(result.researchRuns?.at(-1)?.message?.includes("token"), false);
  assert.equal(result.findings.at(-1)?.severity, "amber");
  assert.match(result.findings.at(-1)?.title ?? "", /unavailable/);
  assert.match(result.conclusion ?? "", /unavailable/);
});

test("currency, condition and Player generation mismatches cannot become comparables", async () => {
  const result = await runResearch(deal("Fender Player Telecaster"), "channel3", "live", {
    cache: memoryCache(),
    channel3: async () => ({ provider: "channel3", capturedAt: "2026-10-07T00:00:00.000Z", evidence: [], results: [
      { id: "variant-1", title: "Fender Player II Telecaster", price: { amount: 949.99, currency: "USD", condition: "new" } },
      { id: "variant-2", title: "Fender Player II Telecaster", price: { amount: 999, currency: "USD", condition: "new" } },
      { id: "variant-3", title: "Fender Player II Telecaster", price: { amount: 1050, currency: "USD", condition: "new" } },
    ] }),
  });
  assert.equal(result.researchRuns?.at(-1)?.outcome, "insufficient");
  assert.equal(result.findings.at(-1)?.severity, "amber");
  assert.match(result.findings.at(-1)?.title ?? "", /different model variant/);
  const finding = result.findings.at(-1);
  assert.ok(finding);
  assert.doesNotMatch(finding.title + finding.explanation, /£280.*median|fair price/i);
});
