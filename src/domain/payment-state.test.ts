import assert from "node:assert/strict";
import test from "node:test";
import { transitionPayment, type PaymentState } from "./payment-state";

test("only an explicit human Continue action authorizes payment", () => {
  const ready: PaymentState = transitionPayment({ status: "DRAFT" }, { type: "assessment_ready" });
  assert.throws(() => transitionPayment(ready, { type: "continue", actor: "model", actionId: "model-action" }), /explicit human decision/);
  assert.equal(ready.status, "READY_FOR_DECISION");
  assert.equal(transitionPayment(ready, { type: "continue", actor: "human", actionId: "click-1" }).status, "AUTHORIZED_FOR_PAYMENT");
});

test("replaying the same action is idempotent and cannot advance payment twice", () => {
  const state = transitionPayment({ status: "READY_FOR_DECISION" }, { type: "continue", actor: "human", actionId: "click-1" });
  assert.deepEqual(transitionPayment(state, { type: "continue", actor: "human", actionId: "click-1" }), state);
  const created = transitionPayment(state, { type: "paypal_created", actionId: "order-1", orderId: "PP-1" });
  assert.deepEqual(transitionPayment(created, { type: "paypal_created", actionId: "order-1", orderId: "PP-1" }), created);
  assert.throws(() => transitionPayment(created, { type: "paypal_created", actionId: "order-2", orderId: "PP-2" }), /requires human authorization/);
});

test("order, approval, capture, and passport require authoritative sequential states", () => {
  const authorized = transitionPayment({ status: "READY_FOR_DECISION" }, { type: "continue", actor: "human", actionId: "click-1" });
  const created = transitionPayment(authorized, { type: "paypal_created", actionId: "order-1", orderId: "PP-1" });
  assert.throws(() => transitionPayment(created, { type: "paypal_captured", actionId: "capture-early", captureId: "CAP-1" }), /approved/);
  const approved = transitionPayment(created, { type: "paypal_approved", actionId: "approved-1" });
  const captured = transitionPayment(approved, { type: "paypal_captured", actionId: "capture-1", captureId: "CAP-1" });
  assert.equal(transitionPayment(captured, { type: "passport_created", actionId: "passport-1" }).status, "PASSPORT_CREATED");
});
