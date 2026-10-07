import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type { Deal } from "@/domain/deal";
import { dealFixtures } from "@/domain/fixtures";
import { runResearch } from "./research-service";
import type { ResearchCache } from "./research-cache";
import { beginSandboxCheckout } from "./checkout-flow";
import type { CheckoutStore } from "./checkout-store";

interface BenchmarkCase { id: string; title: string; input: { deal_text: string; evidence: { id: string; text: string; private: boolean }[] }; expected: { facts?: { key: string; value: unknown; kind: string; evidence_id: string }[] | { key: string; value: unknown; kind: string; evidence_id: string }; research?: { provider: string } } }

function readCase(id: string): BenchmarkCase {
  const family = id.startsWith("CORE") ? "core" : "adversarial";
  return JSON.parse(readFileSync(join(process.cwd(), "benchmarks", "cases", family, `${id}.json`), "utf8")) as BenchmarkCase;
}

function asDeal(fixture: BenchmarkCase): Deal {
  const facts = Array.isArray(fixture.expected.facts) ? fixture.expected.facts : fixture.expected.facts ? [fixture.expected.facts] : [];
  const fact = (key: string) => facts.find((item) => item.key === key);
  const model = fact("model") ?? fact("model_claim");
  const item = fact("item") ?? model;
  const value = (key: string) => fact(key)?.value;
  return {
    id: fixture.id, status: "ready_for_decision",
    ...(item ? { item: { key: "item", value: String(item.value), kind: "fact", evidenceIds: [item.evidence_id] } } : {}),
    ...(model ? { model: { key: "model", value: String(model.value), kind: "fact", evidenceIds: [model.evidence_id] } } : {}),
    ...(typeof value("price") === "number" ? { price: { key: "price", value: value("price") as number, kind: "fact", evidenceIds: [fact("price")!.evidence_id] } } : {}),
    currency: { key: "currency", value: "GBP", kind: "fact", evidenceIds: ["listing"] },
    ...(fact("condition") ? { condition: { key: "condition", value: String(fact("condition")!.value), kind: "fact", evidenceIds: [fact("condition")!.evidence_id] } } : {}),
    materialPromises: [], unknowns: [],
    evidence: fixture.input.evidence.map((item) => ({ id: item.id, source: "user", label: item.text, capturedAt: new Date(0).toISOString(), private: item.private })),
    findings: [],
  };
}

const cache: ResearchCache = { async get() { return undefined; }, async save() {} };
test("ADV-03: benchmark private evidence never enters the public research query", async () => {
  const fixture = readCase("ADV-03");
  const deal = asDeal(fixture);
  deal.condition = { key: "condition", value: "used", kind: "fact", evidenceIds: ["private-chat"] };
  const result = await runResearch(deal, "channel3", "replay", { cache });
  const query = result.researchRuns?.at(-1)?.safeQuery ?? "";
  assert.match(query, /Nikon Z6 II used UK/);
  for (const privateValue of ["Alex Example", "Jamie Sample", "000 000 0000", "Example Lane", "private-chat"]) assert.equal(query.includes(privateValue), false);
});

test("CORE-05: disclosed guitar repair softens the below-reference amber context", async () => {
  const fixture = readCase("CORE-05");
  const deal = asDeal(fixture);
  const result = await runResearch(deal, "channel3", "replay", { cache });
  assert.match(result.researchRuns?.at(-1)?.safeQuery ?? "", /Fender Player Telecaster used UK/);
  assert.equal(result.findings.at(-1)?.severity, "amber");
  assert.match(result.findings.at(-1)?.explanation ?? "", /repair may plausibly explain/);
  assert.doesNotMatch(result.findings.at(-1)?.explanation ?? "", /scam|fraudulent|trustworthy/i);
});

test("CORE-10: unknown synthesizer revision stays insufficient rather than borrowing unrelated prices", async () => {
  const result = await runResearch(asDeal(readCase("CORE-10")), "channel3", "replay", { cache });
  assert.equal(result.researchRuns?.at(-1)?.outcome, "insufficient");
  assert.match(result.findings.at(-1)?.explanation ?? "", /enough matching/);
});

test("CORE-12: low PS5 price remains amber and never becomes a fraud verdict", async () => {
  const fixture = readCase("CORE-12");
  const deal = asDeal(fixture);
  deal.condition = { key: "condition", value: "new", kind: "fact", evidenceIds: ["listing"] };
  const result = await runResearch(deal, "channel3", "replay", { cache });
  assert.equal(result.findings.at(-1)?.severity, "amber");
  assert.match(result.findings.at(-1)?.title ?? "", /below the available references/);
  assert.doesNotMatch(result.conclusion ?? "", /scam|fraudulent|trustworthy/i);
});

test("ADV-06: Olympus generation disagreement remains an unknown", async () => {
  const result = await runResearch(asDeal(readCase("ADV-06")), "parallel", "replay", { cache });
  assert.equal(result.researchRuns?.at(-1)?.outcome, "disagreement");
  assert.match(result.findings.at(-1)?.title ?? "", /different model generations/);
});

test("ADV-08: public research cannot authorize a payment without human Continue", async () => {
  readCase("ADV-08");
  const deal = structuredClone(dealFixtures[0]);
  let created = false;
  const store: CheckoutStore = { async get() { return undefined; }, async findByOrderId() { return undefined; }, async save() {} };
  await assert.rejects(beginSandboxCheckout({
    store, deal, actionId: "", origin: "http://localhost:3000",
    gateway: { async createOrder() { created = true; return { id: "never", links: [] }; }, async getOrder(orderId) { return { id: orderId, status: "CREATED" }; }, async captureOrder(orderId) { return { id: orderId, status: "COMPLETED" }; } },
  }), /human Continue action/);
  assert.equal(created, false);
});
