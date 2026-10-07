import { NextResponse } from "next/server";
import { handleSandboxReturn } from "@/server/checkout-flow";
import { sqliteCheckoutStore } from "@/server/checkout-store";
import { renderCheckoutFailure, renderPendingCheckout, renderProtectionPassport, checkoutPageHeaders } from "@/server/checkout-pages";
import { createPayPalOrder, getPayPalOrder, capturePayPalOrder } from "@/server/paypal";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("token");
  if (!orderId) {
    return new NextResponse(renderCheckoutFailure(), { status: 400, headers: checkoutPageHeaders });
  }
  const retryUrl = "/checkout/return?token=" + encodeURIComponent(orderId);
  try {
    const result = await handleSandboxReturn({
      store: sqliteCheckoutStore,
      gateway: { createOrder: createPayPalOrder, getOrder: getPayPalOrder, captureOrder: capturePayPalOrder },
      orderId,
    });
    if (result.kind === "completed") {
      return new NextResponse(renderProtectionPassport(result.passport), { headers: checkoutPageHeaders });
    }
    if (result.kind === "pending") {
      return new NextResponse(renderPendingCheckout(result.paypalStatus, retryUrl), { headers: checkoutPageHeaders });
    }
    return new NextResponse(renderCheckoutFailure(retryUrl), { status: 502, headers: checkoutPageHeaders });
  } catch {
    return new NextResponse(renderCheckoutFailure(retryUrl), { status: 502, headers: checkoutPageHeaders });
  }
}
