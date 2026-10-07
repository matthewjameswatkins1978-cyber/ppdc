import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { Deal } from "@/domain/deal";
import { assessDeal, addEvidenceToDeal } from "@/domain/assessment";
import { extractDealFromText } from "@/domain/extract-text";
import { extractDealFromImage } from "@/server/extract-image";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const text = String(form.get("text") ?? "").trim();
    const image = form.get("image");
    const existingValue = form.get("existingDeal");
    const existing = typeof existingValue === "string" ? JSON.parse(existingValue) as Deal : undefined;
    if (!text && !(image instanceof File)) return NextResponse.json({ error: "Add listing text or an image first." }, { status: 400 });

    const dealId = existing?.id ?? randomUUID();
    const additions: Deal[] = [];
    if (text) additions.push(extractDealFromText(text, dealId, "User-supplied listing text", randomUUID()));
    if (image instanceof File) {
      if (image.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Image must be 8 MB or smaller." }, { status: 413 });
      additions.push(await extractDealFromImage({
        image: new Uint8Array(await image.arrayBuffer()), mimeType: image.type,
        dealId, evidenceId: randomUUID(), modelAdapter: null,
      }));
    }
    let result = additions[0];
    for (const addition of additions.slice(1)) result = addEvidenceToDeal(result, addition);
    if (existing) result = addEvidenceToDeal(existing, result);
    return NextResponse.json({ deal: assessDeal(result) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The deal could not be assessed." }, { status: 400 });
  }
}