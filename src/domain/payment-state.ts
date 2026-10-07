export type PaymentStatus =
  | "DRAFT"
  | "READY_FOR_DECISION"
  | "NEED_MORE_INFO"
  | "DECLINED"
  | "AUTHORIZED_FOR_PAYMENT"
  | "PAYPAL_CREATED"
  | "PAYPAL_APPROVED"
  | "PAYPAL_CAPTURED"
  | "PASSPORT_CREATED";

export interface PaymentState {
  status: PaymentStatus;
  lastActionId?: string;
  paypalOrderId?: string;
  paypalCaptureId?: string;
}

export type PaymentEvent =
  | { type: "assessment_ready" }
  | { type: "need_more_info" }
  | { type: "decline"; actionId: string; actor: "human" | "model" }
  | { type: "continue"; actionId: string; actor: "human" | "model" }
  | { type: "paypal_created"; actionId: string; orderId: string }
  | { type: "paypal_approved"; actionId: string }
  | { type: "paypal_captured"; actionId: string; captureId: string }
  | { type: "passport_created"; actionId: string };

export function transitionPayment(state: PaymentState, event: PaymentEvent): PaymentState {
  if ("actionId" in event && event.actionId === state.lastActionId) return state;

  let status: PaymentStatus;
  switch (event.type) {
    case "assessment_ready":
      if (state.status !== "DRAFT" && state.status !== "NEED_MORE_INFO") throw new Error("Assessment cannot become ready from this state.");
      status = "READY_FOR_DECISION";
      break;
    case "need_more_info":
      if (state.status !== "READY_FOR_DECISION") throw new Error("More information can only be requested before a decision.");
      status = "NEED_MORE_INFO";
      break;
    case "decline":
      if (event.actor !== "human" || state.status !== "READY_FOR_DECISION") throw new Error("Only the human can decline a ready deal.");
      status = "DECLINED";
      break;
    case "continue":
      if (event.actor !== "human" || state.status !== "READY_FOR_DECISION") throw new Error("Only an explicit human decision can authorize payment.");
      status = "AUTHORIZED_FOR_PAYMENT";
      break;
    case "paypal_created":
      if (state.status !== "AUTHORIZED_FOR_PAYMENT") throw new Error("PayPal order creation requires human authorization.");
      status = "PAYPAL_CREATED";
      break;
    case "paypal_approved":
      if (state.status !== "PAYPAL_CREATED") throw new Error("PayPal must create the order before approval.");
      status = "PAYPAL_APPROVED";
      break;
    case "paypal_captured":
      if (state.status !== "PAYPAL_APPROVED") throw new Error("Only an approved PayPal order can be captured.");
      status = "PAYPAL_CAPTURED";
      break;
    case "passport_created":
      if (state.status !== "PAYPAL_CAPTURED") throw new Error("A passport requires confirmed payment capture.");
      status = "PASSPORT_CREATED";
      break;
  }

  return {
    ...state,
    status,
    ...( "actionId" in event ? { lastActionId: event.actionId } : {}),
    ...(event.type === "paypal_created" ? { paypalOrderId: event.orderId } : {}),
    ...(event.type === "paypal_captured" ? { paypalCaptureId: event.captureId } : {}),
  };
}
