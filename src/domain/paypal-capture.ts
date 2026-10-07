export interface PayPalCaptureOrder {
  id: string;
  status: string;
  purchase_units?: Array<{
    amount?: { currency_code?: string; value?: string };
    payments?: { captures?: Array<{ id?: string; status?: string; amount?: { currency_code?: string; value?: string } }> };
  }>;
}

export interface PayPalCaptureGateway {
  getOrder(orderId: string): Promise<PayPalCaptureOrder>;
  captureOrder(orderId: string, requestId: string): Promise<unknown>;
}

/** Validate the server's final order representation before treating Sandbox checkout as complete. */
export function requireCompletedSandboxCapture(
  order: PayPalCaptureOrder,
  expected: { amount: string; currency: string },
): { orderId: string; captureId: string } {
  if (order.status !== "COMPLETED") throw new Error(`PayPal order is ${order.status}, not COMPLETED.`);
  const unit = order.purchase_units?.[0];
  const capture = unit?.payments?.captures?.find(({ status }) => status === "COMPLETED");
  if (!capture?.id) throw new Error("PayPal completed order contains no completed capture ID.");
  const amount = capture.amount ?? unit?.amount;
  if (amount?.value !== expected.amount || amount.currency_code !== expected.currency) {
    throw new Error("PayPal completed capture amount does not match the expected Sandbox order.");
  }
  return { orderId: order.id, captureId: capture.id };
}

/** Read approval, capture once with the caller's idempotency key, then verify a fresh PayPal read. */
export async function captureApprovedSandboxOrder(input: {
  gateway: PayPalCaptureGateway;
  orderId: string;
  requestId: string;
  expected: { amount: string; currency: string };
}): Promise<{ finalState: PayPalCaptureOrder; receipt: { orderId: string; captureId: string } }> {
  const before = await input.gateway.getOrder(input.orderId);
  if (before.status !== "APPROVED") throw new Error(`Refusing capture: PayPal reports ${before.status}, not APPROVED.`);
  await input.gateway.captureOrder(input.orderId, input.requestId);
  const finalState = await input.gateway.getOrder(input.orderId);
  const receipt = requireCompletedSandboxCapture(finalState, input.expected);
  return { finalState, receipt };
}
