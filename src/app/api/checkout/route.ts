import { NextResponse } from "next/server";
import { z } from "zod";
import type { Deal } from "@/domain/deal";
import { beginSandboxCheckout } from "@/server/checkout-flow";
import { sqliteCheckoutStore } from "@/server/checkout-store";
import { createPayPalOrder, getPayPalOrder, capturePayPalOrder } from "@/server/paypal";
import { getPublicOrigin } from "@/server/public-origin";

export const runtime = "nodejs";

const factSchema = z.object({ key: z.string(), value: z.unknown(), kind: z.string(), evidenceIds: z.array(z.string()) }).passthrough();
const dealSchema = z.object({
  id: z.string().min(1).max(100),
  status: z.enum(["draft", "assessing", "ready_for_decision", "paid"]),
  item: factSchema.optional(), model: factSchema.optional(),
  price: factSchema.extend({ value: z.number().finite().positive() }).optional(),
  currency: factSchema.extend({ value: z.string() }).optional(),
  condition: factSchema.optional(), paymentMethod: factSchema.optional(), deliveryTerms: factSchema.optional(),
  materialPromises: z.array(factSchema), unknowns: z.array(factSchema),
  evidence: z.array(z.object({ id: z.string(), source: z.string(), label: z.string(), capturedAt: z.string(), private: z.boolean() }).passthrough()),
  evidenceRefs: z.array(z.object({ field: z.string(), evidenceId: z.string(), quote: z.string() })).optional(),
  findings: z.array(z.object({ id: z.string(), severity: z.enum(["green", "amber", "red"]), category: z.string(), title: z.string(), explanation: z.string(), evidenceIds: z.array(z.string()), kind: z.string() }).passthrough()),
  conclusion: z.string().optional(),
}).passthrough();


export async function POST(request: Request) {
  try {
    const origin = getPublicOrigin();
    if (request.headers.get("origin") !== origin) {
      return NextResponse.json({ error: "Checkout must be started from this Deal Checker page." }, { status: 403 });
    }
    const body: unknown = await request.json();
    const parsed = z.object({ deal: dealSchema, actionId: z.string().min(1).max(120) }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "The deal or Continue action is invalid." }, { status: 400 });

    const result = await beginSandboxCheckout({
      store: sqliteCheckoutStore,
      gateway: {
        createOrder: createPayPalOrder,
        getOrder: getPayPalOrder,
        captureOrder: capturePayPalOrder,
      },
      deal: parsed.data.deal as Deal,
      actionId: parsed.data.actionId,
      origin,
    });
    return NextResponse.json({
      status: result.payment.status,
      orderId: result.payment.paypalOrderId,
      approvalUrl: result.approvalUrl,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "PayPal Sandbox checkout could not be started." }, { status: 400 });
  }
}
