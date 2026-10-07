import type { Evidence } from "./deal";
import { extractionToDeal, type DealExtraction, validateDealExtraction } from "./deal-extraction";

/** A local, no-network baseline extractor. It makes no claims beyond text it can quote. */
export function extractDealFromText(text: string, dealId = "text-intake", evidenceLabel = "User-supplied listing text", evidenceId = "user-input") {
  const sourceText = text.trim();
  const extraction = validateDealExtraction(extractLocally(sourceText), sourceText);
  const evidence: Evidence = {
    id: evidenceId, source: "user", label: evidenceLabel,
    capturedAt: new Date().toISOString(), private: true,
  };
  return extractionToDeal({ extraction, evidence, dealId });
}

function extractLocally(text: string): DealExtraction {
  const evidenceRefs: DealExtraction["evidenceRefs"] = [];
  const ref = (field: DealExtraction["evidenceRefs"][number]["field"], quote: string | undefined) => {
    if (quote?.trim()) evidenceRefs.push({ field, quote: quote.trim() });
  };
  const modelMatch = text.match(/\b(Fender\s+(?:Player\s+)?Telecaster(?:\s+[A-Za-z0-9-]+)?)\b/i)
    ?? text.match(/\b(?:model|make and model)\s*:\s*([^\n.!?]{2,90})/i);
  const model = modelMatch ? (modelMatch[1] ?? modelMatch[0]).trim() : null;
  ref("model", modelMatch?.[0]);

  const itemMatch = text.match(/(?:for sale\s*:?|selling\s*:?|item\s*:?|product\s*:?)[\s-]*([^\n.!?]{2,100})/i)
    ?? text.match(/\b(a|an)\s+(guitar|phone|laptop|camera|bicycle|bike|watch|console)\b/i);
  const item = itemMatch ? (itemMatch[2] ? `${itemMatch[1]} ${itemMatch[2]}` : itemMatch[1].trim()) : model;
  ref("item", itemMatch?.[0] ?? modelMatch?.[0]);

  const priceMatch = text.match(/(£|GBP\s*|€|EUR\s*|\$|USD\s*)(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)/i);
  const price = priceMatch ? Number(priceMatch[2].replaceAll(",", "")) : null;
  const currency = priceMatch ? currencyFromMarker(priceMatch[1]) : null;
  ref("price", priceMatch?.[0]);
  if (currency !== null) ref("currency", priceMatch?.[0]);

  const conditionMatch = text.match(/\b(new|used|second[ -]hand|refurbished|damaged|needs repair|good condition|fair condition)\b/i);
  const condition = conditionMatch?.[0] ?? null;
  ref("condition", conditionMatch?.[0]);

  const paymentMatch = text.match(/\b(?:PayPal(?:\s+(?:Goods\s*(?:&|and)\s*Services|Friends\s*(?:&|and)\s*Family))?|bank transfer|cash(?:\s+on\s+collection)?|card payment|credit card|debit card)\b[^\n.!?]*/i);
  const paymentMethod = paymentMatch?.[0]?.trim() ?? null;
  ref("paymentMethod", paymentMatch?.[0]);

  const deliveryMatch = text.match(/\b(?:tracked postage|postage|shipping|collection only|pickup only|delivery included|free delivery|courier)\b[^\n.!?]*/i);
  const deliveryTerms = deliveryMatch?.[0]?.trim() ?? null;
  ref("deliveryTerms", deliveryMatch?.[0]);

  const claimMatches = [...text.matchAll(/\b(?:seller says|seller claims|includes|comes with|tested and working|fully working)\b[^\n.!?]*/gi)];
  const materialPromises = claimMatches.map((match) => match[0].replace(/^seller\s+(?:says|claims)\s+/i, "").trim());
  for (const match of claimMatches) ref("materialPromises", match[0]);

  const unknownMatches = [...text.matchAll(/[^\n.!?]*(?:not shown|not disclosed|unknown|unclear|not specified)[^\n.!?]*/gi)];
  const unknowns = unknownMatches.map((match) => match[0].trim());
  for (const match of unknownMatches) ref("unknowns", match[0]);

  return {
    item, model, price, currency, condition, paymentMethod, deliveryTerms,
    materialPromises, unknowns, evidenceRefs,
  };
}

function currencyFromMarker(marker: string): string | null {
  if (marker.includes("£") || /GBP/i.test(marker)) return "GBP";
  if (marker.includes("€") || /EUR/i.test(marker)) return "EUR";
  if (/USD/i.test(marker)) return "USD";
  return null; // A bare $ is shared by several currencies and cannot identify one safely.
}
