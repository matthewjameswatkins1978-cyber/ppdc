import { NextResponse } from "next/server";
import { markSandboxCancelled } from "@/server/checkout-flow";
import { sqliteCheckoutStore } from "@/server/checkout-store";
import { renderCancelledCheckout, renderCheckoutFailure, renderProtectionPassport, checkoutPageHeaders } from "@/server/checkout-pages";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("token");
  if (orderId) {
    try {
      const record = await markSandboxCancelled(sqliteCheckoutStore, orderId);
      if (record?.passport) return new NextResponse(renderProtectionPassport(record.passport), { headers: checkoutPageHeaders });
    } catch {
      return new NextResponse(renderCheckoutFailure(), { status: 503, headers: checkoutPageHeaders });
    }
  }
  return new NextResponse(renderCancelledCheckout(), { headers: checkoutPageHeaders });
}
