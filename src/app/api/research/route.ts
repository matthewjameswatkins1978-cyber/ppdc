import { NextResponse } from "next/server";
import { z } from "zod";
import type { Deal } from "@/domain/deal";
import { runResearch } from "@/server/research-service";

export const runtime = "nodejs";

const fact = z.object({ key: z.string(), value: z.unknown(), kind: z.string(), evidenceIds: z.array(z.string()) }).passthrough();
const dealSchema = z.object({
  id: z.string().min(1).max(100), status: z.enum(["draft", "assessing", "ready_for_decision", "paid"]),
  item: fact.optional(), model: fact.optional(), price: fact.optional(), currency: fact.optional(), condition: fact.optional(),
  paymentMethod: fact.optional(), deliveryTerms: fact.optional(), materialPromises: z.array(fact), unknowns: z.array(fact),
  evidence: z.array(z.object({ id: z.string(), source: z.string(), label: z.string(), capturedAt: z.string(), private: z.boolean() }).passthrough()),
  evidenceRefs: z.array(z.object({ field: z.string(), evidenceId: z.string(), quote: z.string() })).optional(),
  findings: z.array(z.object({ id: z.string(), severity: z.enum(["green", "amber", "red"]), category: z.string(), title: z.string(), explanation: z.string(), evidenceIds: z.array(z.string()), kind: z.string() }).passthrough()),
  conclusion: z.string().optional(),
}).passthrough();

export async function POST(request: Request) {
  const configuredOrigin = process.env.PPDC_PUBLIC_ORIGIN ?? "http://localhost:3000";
  let expectedOrigin: string;
  try { expectedOrigin = new URL(configuredOrigin).origin; } catch { return NextResponse.json({ error: "Research origin is not configured." }, { status: 500 }); }
  if (request.headers.get("origin") !== expectedOrigin) return NextResponse.json({ error: "Research must be started from this Deal Checker page." }, { status: 403 });
  const parsed = z.object({ deal: dealSchema, provider: z.enum(["channel3", "parallel"]), mode: z.enum(["live", "replay"]).default("live") }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The deal or research request is invalid." }, { status: 400 });
  try {
    const deal = await runResearch(parsed.data.deal as Deal, parsed.data.provider, parsed.data.mode);
    return NextResponse.json({ deal }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The research request could not be prepared safely." }, { status: 400 });
  }
}
