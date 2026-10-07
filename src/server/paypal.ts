import "server-only";

const SANDBOX_API = "https://api-m.sandbox.paypal.com";

interface OAuthResponse { access_token: string }
export interface PayPalOrder {
  id: string;
  status: "CREATED" | "SAVED" | "APPROVED" | "VOIDED" | "COMPLETED" | string;
  links?: Array<{ href: string; rel: string; method: string }>;
  purchase_units?: Array<{ payments?: { captures?: Array<{ id: string; status: string }> } }>;
}

function credentials() {
  if (process.env.PAYPAL_ENV && process.env.PAYPAL_ENV !== "sandbox") throw new Error("PPDC is configured for PayPal Sandbox only.");
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("PayPal Sandbox credentials are not configured.");
  return { clientId, clientSecret };
}

async function paypalFetch<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${SANDBOX_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`PayPal Sandbox request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

export async function getPayPalAccessToken(): Promise<string> {
  const { clientId, clientSecret } = credentials();
  const response = await fetch(`${SANDBOX_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`PayPal Sandbox OAuth failed (${response.status}).`);
  const payload = await response.json() as OAuthResponse;
  return payload.access_token;
}

export async function createPayPalOrder(input: { amount: string; currency: "GBP"; requestId: string; returnUrl: string; cancelUrl: string }): Promise<PayPalOrder> {
  if (!/^\d+\.\d{2}$/.test(input.amount) || Number(input.amount) <= 0) throw new Error("Amount must be a positive decimal with two places.");
  const token = await getPayPalAccessToken();
  return paypalFetch<PayPalOrder>("/v2/checkout/orders", token, {
    method: "POST",
    headers: { Prefer: "return=representation", "PayPal-Request-Id": input.requestId },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{ amount: { currency_code: input.currency, value: input.amount }, description: "PayPal Deal Checker Sandbox purchase" }],
      application_context: { return_url: input.returnUrl, cancel_url: input.cancelUrl, user_action: "PAY_NOW" },
    }),
  });
}

export async function getPayPalOrder(orderId: string): Promise<PayPalOrder> {
  return paypalFetch<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, await getPayPalAccessToken());
}

export async function capturePayPalOrder(orderId: string, requestId: string): Promise<PayPalOrder> {
  const token = await getPayPalAccessToken();
  return paypalFetch<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, token, {
    method: "POST",
    headers: { "PayPal-Request-Id": requestId },
    body: "{}",
  });
}
