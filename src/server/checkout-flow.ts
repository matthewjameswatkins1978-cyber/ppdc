import "server-only";
import { createHash } from "node:crypto";
import type { Deal } from "@/domain/deal";
import { transitionPayment } from "@/domain/payment-state";
import { captureApprovedSandboxOrder, requireCompletedSandboxCapture, type PayPalCaptureOrder } from "@/domain/paypal-capture";
import { createProtectionPassport, type ProtectionPassport } from "@/domain/protection-passport";
import type { CheckoutRecord, CheckoutStore } from "./checkout-store";

export interface CheckoutGateway {
  createOrder(input: { amount: string; currency: "GBP"; requestId: string; returnUrl: string; cancelUrl: string }): Promise<{ id: string; links?: Array<{ rel: string; href: string }> }>;
  getOrder(orderId: string): Promise<PayPalCaptureOrder>;
  captureOrder(orderId: string, requestId: string): Promise<unknown>;
}

export type CheckoutResult =
  | { kind: "created"; record: CheckoutRecord }
  | { kind: "pending"; record: CheckoutRecord; paypalStatus: string }
  | { kind: "completed"; record: CheckoutRecord; passport: ProtectionPassport };

const dealLocks = new Map<string, Promise<void>>();

async function withDealLock<T>(dealId: string, work: () => Promise<T>): Promise<T> {
  const previous = dealLocks.get(dealId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  dealLocks.set(dealId, current);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (dealLocks.get(dealId) === current) dealLocks.delete(dealId);
  }
}

function stableRequestId(dealId: string, action: string): string {
  return createHash("sha256").update("ppdc:" + dealId + ":" + action).digest("hex").slice(0, 32);
}

function paymentAmount(deal: Deal): string {
  if (!deal.price || !Number.isFinite(deal.price.value) || deal.price.value <= 0) {
    throw new Error("Add a clear, positive deal price before continuing to PayPal Sandbox.");
  }
  if (deal.currency?.value !== "GBP") throw new Error("PayPal Sandbox checkout currently supports GBP deals only.");
  return deal.price.value.toFixed(2);
}

function validateDeal(deal: Deal): void {
  if (!deal.id || !Array.isArray(deal.evidence) || !Array.isArray(deal.findings) || !Array.isArray(deal.materialPromises) || !Array.isArray(deal.unknowns)) {
    throw new Error("The deal snapshot is incomplete.");
  }
  paymentAmount(deal);
}

export async function beginSandboxCheckout(input: {
  store: CheckoutStore;
  gateway: CheckoutGateway;
  deal: Deal;
  actionId: string;
  origin: string;
}): Promise<CheckoutRecord> {
  return withDealLock(input.deal.id, async () => {
    validateDeal(input.deal);
    if (!input.actionId || input.actionId.length > 120) throw new Error("A valid human Continue action is required.");
    let record = await input.store.get(input.deal.id);
    if (record?.payment.paypalOrderId) return record;

    if (!record) {
      const payment = transitionPayment({ status: "READY_FOR_DECISION" }, {
        type: "continue", actor: "human", actionId: input.actionId,
      });
      record = {
        dealId: input.deal.id,
        deal: structuredClone(input.deal),
        payment,
        createRequestId: stableRequestId(input.deal.id, "create"),
        captureRequestId: stableRequestId(input.deal.id, "capture"),
      };
      await input.store.save(record);
    } else if (record.payment.status !== "AUTHORIZED_FOR_PAYMENT") {
      throw new Error("This deal is no longer awaiting PayPal order creation.");
    }

    const order = await input.gateway.createOrder({
      amount: paymentAmount(record.deal),
      currency: "GBP",
      requestId: record.createRequestId,
      returnUrl: new URL("/checkout/return", input.origin).toString(),
      cancelUrl: new URL("/checkout/cancel", input.origin).toString(),
    });
    const approvalUrl = order.links?.find((link) => link.rel === "approve" || link.rel === "payer-action")?.href;
    const approvalHost = approvalUrl ? new URL(approvalUrl).hostname.toLowerCase() : "";
    if (!order.id || !approvalUrl || !/^https:\/\//i.test(approvalUrl) || !(approvalHost === "paypal.com" || approvalHost.endsWith(".paypal.com"))) {
      throw new Error("PayPal Sandbox did not return a valid approval link.");
    }
    record = {
      ...record,
      approvalUrl,
      payment: transitionPayment(record.payment, {
        type: "paypal_created", actionId: "created-" + record.createRequestId, orderId: order.id,
      }),
    };
    await input.store.save(record);
    return record;
  });
}

function markApproved(record: CheckoutRecord): CheckoutRecord {
  if (record.payment.status !== "PAYPAL_CREATED") return record;
  return {
    ...record,
    payment: transitionPayment(record.payment, {
      type: "paypal_approved", actionId: "approved-" + record.createRequestId,
    }),
  };
}

function markCaptured(record: CheckoutRecord, captureId: string): CheckoutRecord {
  let next = markApproved(record);
  if (next.payment.status === "PAYPAL_APPROVED") {
    next = {
      ...next,
      payment: transitionPayment(next.payment, {
        type: "paypal_captured", actionId: "captured-" + record.captureRequestId, captureId,
      }),
    };
  }
  return next;
}

function passportFor(record: CheckoutRecord, orderId: string, now: () => Date): ProtectionPassport {
  return createProtectionPassport({
    id: "passport-" + stableRequestId(record.dealId, "passport").slice(0, 16),
    deal: record.deal,
    paypalOrderId: orderId,
    createdAt: now().toISOString(),
  });
}

async function completeFromVerifiedOrder(input: {
  record: CheckoutRecord;
  order: PayPalCaptureOrder;
  orderId: string;
  store: CheckoutStore;
  now: () => Date;
}): Promise<CheckoutResult> {
  const receipt = requireCompletedSandboxCapture(input.order, {
    amount: paymentAmount(input.record.deal), currency: "GBP",
  });
  let record = markCaptured(input.record, receipt.captureId);
  if (!record.passport) {
    const passport = passportFor(record, input.orderId, input.now);
    record = {
      ...record,
      payment: transitionPayment(record.payment, {
        type: "passport_created", actionId: "passport-" + stableRequestId(record.dealId, "passport"),
      }),
      passport,
      cancelledAt: undefined,
    };
  }
  await input.store.save(record);
  return { kind: "completed", record, passport: record.passport! };
}

/** PayPal redirect parameters are identifiers only. Fresh server GETs decide all state changes. */
export async function handleSandboxReturn(input: {
  store: CheckoutStore;
  gateway: CheckoutGateway;
  orderId: string;
  now?: () => Date;
}): Promise<CheckoutResult> {
  const initial = await input.store.findByOrderId(input.orderId);
  if (!initial) throw new Error("This PayPal order is not associated with a saved PPDC checkout.");
  return withDealLock(initial.dealId, async () => {
    let record = await input.store.get(initial.dealId);
    if (!record || record.payment.paypalOrderId !== input.orderId) throw new Error("The PayPal order does not match this deal.");
    const now = input.now ?? (() => new Date());
    const freshOrder = await input.gateway.getOrder(input.orderId);
    if (freshOrder.id !== input.orderId) throw new Error("PayPal returned a different order than expected.");

    if (freshOrder.status === "COMPLETED") {
      return completeFromVerifiedOrder({ record, order: freshOrder, orderId: input.orderId, store: input.store, now });
    }
    if (freshOrder.status !== "APPROVED") return { kind: "pending", record, paypalStatus: freshOrder.status };

    record = markApproved(record);
    await input.store.save(record);
    const captured = await captureApprovedSandboxOrder({
      gateway: input.gateway,
      orderId: input.orderId,
      requestId: record.captureRequestId,
      expected: { amount: paymentAmount(record.deal), currency: "GBP" },
    });
    return completeFromVerifiedOrder({
      record,
      order: captured.finalState,
      orderId: input.orderId,
      store: input.store,
      now,
    });
  });
}

export async function markSandboxCancelled(
  store: CheckoutStore,
  orderId: string,
  now: () => Date = () => new Date(),
): Promise<CheckoutRecord | undefined> {
  const record = await store.findByOrderId(orderId);
  if (!record) return undefined;
  return withDealLock(record.dealId, async () => {
    const current = await store.get(record.dealId);
    if (!current || current.payment.paypalOrderId !== orderId) return undefined;
    if (!current.cancelledAt && !current.passport) {
      current.cancelledAt = now().toISOString();
      await store.save(current);
    }
    return current;
  });
}
