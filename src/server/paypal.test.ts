import assert from "node:assert/strict";
import test from "node:test";
import { createPayPalOrder } from "./paypal";

test("PayPal Sandbox order carries the PPDC return/cancel URLs in current PayPal experience context", async () => {
  const oldId = process.env.PAYPAL_CLIENT_ID;
  const oldSecret = process.env.PAYPAL_CLIENT_SECRET;
  const oldEnv = process.env.PAYPAL_ENV;
  const originalFetch = globalThis.fetch;
  process.env.PAYPAL_CLIENT_ID = "test-sandbox-client";
  process.env.PAYPAL_CLIENT_SECRET = "test-sandbox-secret";
  process.env.PAYPAL_ENV = "sandbox";
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, init });
    if (url.endsWith("/v1/oauth2/token")) return new Response(JSON.stringify({ access_token: "recorded-test-access-token" }), { status: 200 });
    return new Response(JSON.stringify({ id: "ORDER-TEST", status: "CREATED", links: [] }), { status: 201 });
  };
  try {
    await createPayPalOrder({
      amount: "450.00", currency: "GBP", requestId: "stable-create-request-id",
      returnUrl: "http://localhost:3000/checkout/return", cancelUrl: "http://localhost:3000/checkout/cancel",
    });
    const orderRequest = requests[1];
    const body = JSON.parse(String(orderRequest.init?.body));
    assert.equal(body.payment_source.paypal.experience_context.return_url, "http://localhost:3000/checkout/return");
    assert.equal(body.payment_source.paypal.experience_context.cancel_url, "http://localhost:3000/checkout/cancel");
    assert.equal(body.payment_source.paypal.experience_context.user_action, "PAY_NOW");
    assert.equal(body.purchase_units[0].amount.value, "450.00");
    assert.equal(orderRequest.init?.headers && (orderRequest.init.headers as Record<string, string>)["PayPal-Request-Id"], "stable-create-request-id");
    assert.equal("application_context" in body, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldId === undefined) delete process.env.PAYPAL_CLIENT_ID; else process.env.PAYPAL_CLIENT_ID = oldId;
    if (oldSecret === undefined) delete process.env.PAYPAL_CLIENT_SECRET; else process.env.PAYPAL_CLIENT_SECRET = oldSecret;
    if (oldEnv === undefined) delete process.env.PAYPAL_ENV; else process.env.PAYPAL_ENV = oldEnv;
  }
});
