import "dotenv/config";
import { randomUUID } from "node:crypto";
import { capturePayPalOrder, createPayPalOrder, getPayPalOrder } from "../src/server/paypal";
import { captureApprovedSandboxOrder } from "../src/domain/paypal-capture";

const [action, orderId] = process.argv.slice(2);

if (process.env.PAYPAL_ENV && process.env.PAYPAL_ENV !== "sandbox") throw new Error("Smoke script only permits PAYPAL_ENV=sandbox.");

if (action === "create") {
  const origin = process.env.PPDC_LOCAL_ORIGIN ?? "http://localhost:3000";
  const order = await createPayPalOrder({
    amount: "1.00",
    currency: "GBP",
    requestId: randomUUID(),
    returnUrl: `${origin}/?paypal=approved`,
    cancelUrl: `${origin}/?paypal=cancelled`,
  });
  const approval = order.links?.find(({ rel }) => rel === "approve")?.href;
  if (!approval) throw new Error("PayPal did not return an approval link.");
  console.log(`Sandbox order created: ${order.id} (${order.status}, GBP 1.00)`);
  console.log("Open this PayPal Sandbox approval link in a browser and sign in as the sandbox buyer:");
  console.log(approval);
  console.log("After approval redirects back, run: npm run paypal:smoke -- capture " + order.id);
} else if (action === "capture" && orderId) {
  const { finalState, receipt } = await captureApprovedSandboxOrder({
    gateway: { getOrder: getPayPalOrder, captureOrder: capturePayPalOrder },
    orderId,
    requestId: randomUUID(),
    expected: { amount: "1.00", currency: "GBP" },
  });
  console.log(`Sandbox order confirmed by a fresh PayPal API read: ${receipt.orderId} (${finalState.status}, GBP 1.00)`);
  console.log(`Capture reference: ${receipt.captureId}`);
} else {
  throw new Error("Usage: npm run paypal:smoke -- create | capture <sandbox-order-id>");
}
