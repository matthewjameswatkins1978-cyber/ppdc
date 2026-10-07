import assert from "node:assert/strict";
import test from "node:test";
import { captureApprovedSandboxOrder, requireCompletedSandboxCapture } from "./paypal-capture";

const recordedCompletedOrder = {
  id: "SANDBOX-ORDER-RECORDED",
  status: "COMPLETED",
  purchase_units: [{
    amount: { currency_code: "GBP", value: "1.00" },
    payments: { captures: [{ id: "SANDBOX-CAPTURE-RECORDED", status: "COMPLETED", amount: { currency_code: "GBP", value: "1.00" } }] },
  }],
};

test("accepts a recorded PayPal server response with a completed matching capture", () => {
  assert.deepEqual(requireCompletedSandboxCapture(recordedCompletedOrder, { amount: "1.00", currency: "GBP" }), {
    orderId: "SANDBOX-ORDER-RECORDED", captureId: "SANDBOX-CAPTURE-RECORDED",
  });
});

test("refuses unapproved, incomplete, or mismatched captures", () => {
  assert.throws(() => requireCompletedSandboxCapture({ ...recordedCompletedOrder, status: "CREATED" }, { amount: "1.00", currency: "GBP" }), /not COMPLETED/);
  assert.throws(() => requireCompletedSandboxCapture({ ...recordedCompletedOrder, purchase_units: [{ payments: { captures: [{ id: "x", status: "PENDING" }] } }] }, { amount: "1.00", currency: "GBP" }), /no completed capture/);
  assert.throws(() => requireCompletedSandboxCapture(recordedCompletedOrder, { amount: "2.00", currency: "GBP" }), /does not match/);
});

test("captures an approved order once, then requires a fresh completed PayPal read", async () => {
  const calls: string[] = [];
  const approved = { id: "SANDBOX-ORDER-RECORDED", status: "APPROVED" };
  const captureResponse = { id: "SANDBOX-ORDER-RECORDED", status: "COMPLETED" };
  const gateway = {
    async getOrder(orderId: string) {
      calls.push(`GET ${orderId}`);
      return calls.length === 1 ? approved : recordedCompletedOrder;
    },
    async captureOrder(orderId: string, requestId: string) {
      calls.push(`CAPTURE ${orderId} ${requestId}`);
      return captureResponse;
    },
  };

  const result = await captureApprovedSandboxOrder({
    gateway,
    orderId: "SANDBOX-ORDER-RECORDED",
    requestId: "stable-capture-request-id",
    expected: { amount: "1.00", currency: "GBP" },
  });

  assert.deepEqual(calls, [
    "GET SANDBOX-ORDER-RECORDED",
    "CAPTURE SANDBOX-ORDER-RECORDED stable-capture-request-id",
    "GET SANDBOX-ORDER-RECORDED",
  ]);
  assert.equal(result.finalState.status, "COMPLETED");
  assert.deepEqual(result.receipt, { orderId: "SANDBOX-ORDER-RECORDED", captureId: "SANDBOX-CAPTURE-RECORDED" });
});

test("does not capture an order until PayPal reports APPROVED", async () => {
  let captureCalled = false;
  await assert.rejects(captureApprovedSandboxOrder({
    gateway: {
      async getOrder(orderId) { return { id: orderId, status: "CREATED" }; },
      async captureOrder() { captureCalled = true; return {}; },
    },
    orderId: "SANDBOX-ORDER-RECORDED",
    requestId: "stable-capture-request-id",
    expected: { amount: "1.00", currency: "GBP" },
  }), /CREATED, not APPROVED/);
  assert.equal(captureCalled, false);
});
