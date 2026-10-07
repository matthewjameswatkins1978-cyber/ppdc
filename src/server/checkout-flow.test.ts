import assert from "node:assert/strict";
import test from "node:test";
import { dealFixtures } from "@/domain/fixtures";
import type { Deal } from "@/domain/deal";
import type { PayPalCaptureOrder } from "@/domain/paypal-capture";
import { beginSandboxCheckout, handleSandboxReturn, markSandboxCancelled } from "./checkout-flow";
import type { CheckoutRecord, CheckoutStore } from "./checkout-store";

class MemoryStore implements CheckoutStore {
  records = new Map<string, CheckoutRecord>();
  async get(id: string) { return this.records.get(id); }
  async findByOrderId(id: string) { return [...this.records.values()].find((record) => record.payment.paypalOrderId === id); }
  async save(record: CheckoutRecord) { this.records.set(record.dealId, structuredClone(record)); }
}

function payableDeal(): Deal {
  const deal = structuredClone(dealFixtures[0]);
  deal.id = "phase2-checkout-test";
  return deal;
}

function completedOrder(deal: Deal): PayPalCaptureOrder {
  const amount = deal.price!.value.toFixed(2);
  return {
    id: "ORDER-1",
    status: "COMPLETED",
    purchase_units: [{
      amount: { currency_code: "GBP", value: amount },
      payments: { captures: [{ id: "CAPTURE-1", status: "COMPLETED", amount: { currency_code: "GBP", value: amount } }] },
    }],
  };
}

function gateway(deal: Deal, statuses: string[] = ["APPROVED", "APPROVED", "COMPLETED"]) {
  const calls = { creates: 0, captures: 0, reads: 0, requestIds: [] as string[] };
  return {
    calls,
    async createOrder(input: { requestId: string }) {
      calls.creates += 1;
      calls.requestIds.push(input.requestId);
      return { id: "ORDER-1", links: [{ rel: "approve", href: "https://www.sandbox.paypal.com/checkoutnow" }] };
    },
    async getOrder(orderId: string) {
      calls.reads += 1;
      const status = statuses[Math.min(calls.reads - 1, statuses.length - 1)];
      return status === "COMPLETED" ? completedOrder(deal) : { id: orderId, status };
    },
    async captureOrder(_orderId: string, requestId: string) {
      calls.captures += 1;
      calls.requestIds.push(requestId);
      return { status: "COMPLETED" };
    },
  };
}

async function start(store: MemoryStore, deal: Deal, api: ReturnType<typeof gateway>) {
  return beginSandboxCheckout({ store, gateway: api, deal, actionId: "human-click-1", origin: "http://localhost:3000" });
}

test("order creation requires the explicit Continue action and a valid deal", async () => {
  const deal = payableDeal();
  const store = new MemoryStore();
  const api = gateway(deal);
  await assert.rejects(beginSandboxCheckout({ store, gateway: api, deal, actionId: "", origin: "http://localhost:3000" }), /human Continue action/);
  assert.equal(api.calls.creates, 0);
  assert.equal(await store.get(deal.id), undefined);
});

test("PayPal CREATED remains pending and cannot create a Passport", async () => {
  const deal = payableDeal(); const store = new MemoryStore(); const api = gateway(deal, ["CREATED"]);
  await start(store, deal, api);
  const result = await handleSandboxReturn({ store, gateway: api, orderId: "ORDER-1" });
  assert.equal(result.kind, "pending");
  assert.equal((await store.get(deal.id))?.passport, undefined);
  assert.equal(api.calls.captures, 0);
});

test("an APPROVED PayPal order is captured and a fresh COMPLETED read creates the Passport", async () => {
  const deal = payableDeal(); const store = new MemoryStore(); const api = gateway(deal);
  await start(store, deal, api);
  const result = await handleSandboxReturn({ store, gateway: api, orderId: "ORDER-1", now: () => new Date("2026-10-07T12:00:00.000Z") });
  assert.equal(result.kind, "completed");
  assert.equal(result.record.payment.status, "PASSPORT_CREATED");
  assert.equal(result.passport.price, 450);
  assert.equal(result.passport.paypalOrderId, "ORDER-1");
  assert.equal(api.calls.captures, 1);
  assert.equal(api.calls.reads, 3);
});

test("a final non-COMPLETED PayPal response cannot create a Passport", async () => {
  const deal = payableDeal(); const store = new MemoryStore(); const api = gateway(deal, ["APPROVED", "APPROVED", "PENDING"]);
  await start(store, deal, api);
  await assert.rejects(handleSandboxReturn({ store, gateway: api, orderId: "ORDER-1" }), /not COMPLETED/);
  assert.equal((await store.get(deal.id))?.passport, undefined);
});

test("cancelled checkout records cancellation without capturing or creating a Passport", async () => {
  const deal = payableDeal(); const store = new MemoryStore(); const api = gateway(deal);
  await start(store, deal, api);
  const record = await markSandboxCancelled(store, "ORDER-1", () => new Date("2026-10-07T12:00:00.000Z"));
  assert.equal(record?.cancelledAt, "2026-10-07T12:00:00.000Z");
  assert.equal(record?.passport, undefined);
  assert.equal(api.calls.captures, 0);
});

test("duplicate Continue calls reuse one PayPal order and stable idempotency key", async () => {
  const deal = payableDeal(); const store = new MemoryStore(); const api = gateway(deal);
  const first = await start(store, deal, api);
  const second = await beginSandboxCheckout({ store, gateway: api, deal, actionId: "human-click-2", origin: "http://localhost:3000" });
  assert.equal(first.payment.paypalOrderId, second.payment.paypalOrderId);
  assert.equal(api.calls.creates, 1);
  assert.equal(new Set(api.calls.requestIds).size, 1);
});

test("simultaneous Continue requests cannot create two PayPal orders", async () => {
  const deal = payableDeal(); const store = new MemoryStore(); const api = gateway(deal);
  const requests = ["human-click-a", "human-click-b"].map((actionId) => beginSandboxCheckout({
    store, gateway: api, deal, actionId, origin: "http://localhost:3000",
  }));
  const results = await Promise.all(requests);
  assert.equal(results[0].payment.paypalOrderId, results[1].payment.paypalOrderId);
  assert.equal(api.calls.creates, 1);
});

test("duplicate return/capture handling is idempotent after completion", async () => {
  const deal = payableDeal(); const store = new MemoryStore(); const api = gateway(deal);
  await start(store, deal, api);
  const first = await handleSandboxReturn({ store, gateway: api, orderId: "ORDER-1" });
  const second = await handleSandboxReturn({ store, gateway: api, orderId: "ORDER-1" });
  assert.equal(first.kind, "completed");
  assert.equal(second.kind, "completed");
  assert.equal(api.calls.captures, 1);
  assert.equal(first.passport.id, second.passport.id);
});

test("a PayPal read failure after return never marks payment complete", async () => {
  const deal = payableDeal(); const store = new MemoryStore(); const api = gateway(deal);
  await start(store, deal, api);
  const broken = { ...api, async getOrder() { throw new Error("network down"); } };
  await assert.rejects(handleSandboxReturn({ store, gateway: broken, orderId: "ORDER-1" }), /network down/);
  assert.equal((await store.get(deal.id))?.passport, undefined);
  assert.equal((await store.get(deal.id))?.payment.status, "PAYPAL_CREATED");
});
