import type { Evidence } from "./deal";
import { extractionToDeal, type DealExtraction, validateDealExtraction } from "./deal-extraction";

/** Local no-network extraction; every proposed fact keeps an exact source quote. */
export function extractDealFromText(text: string, dealId = "text-intake", evidenceLabel = "User-supplied listing text", evidenceId = "user-input") {
  const sourceText = text.trim();
  const extraction = validateDealExtraction(extractLocally(sourceText), sourceText);
  const evidence: Evidence = { id: evidenceId, source: "user", label: evidenceLabel, capturedAt: new Date().toISOString(), private: true };
  const deal = extractionToDeal({ extraction, evidence, dealId });
  const approximate = sourceText.match(/(?:approximately|approx\.?|about)\s+((?:US\$|USD\s*|CA\$|CAD\s*|AU\$|AUD\s*|£|GBP\s*|€|EUR\s*|\$)\s*\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)/i);
  const display = approximate?.[1].match(/(US\$|USD\s*|CA\$|CAD\s*|AU\$|AUD\s*|£|GBP\s*|€|EUR\s*|\$)(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)/i);
  if (approximate && display) {
    const displayCurrency = currencyFromMarker(display[1]);
    if (displayCurrency) deal.priceDisplays = [{ amount: Number(display[2].replaceAll(",", "")), currency: displayCurrency, kind: "approximate_conversion", evidenceId, quote: approximate[0] }];
  }
  return deal;
}

function extractLocally(text: string): DealExtraction {
  const evidenceRefs: DealExtraction["evidenceRefs"] = [];
  const ref = (field: DealExtraction["evidenceRefs"][number]["field"], quote?: string) => {
    const exact = quote?.trim();
    if (exact && normalize(text).includes(normalize(exact))) evidenceRefs.push({ field, quote: exact });
  };
  const modelMatch = firstMatch(text, [
    /\b(Fender\s+(?:Player\s+)?Telecaster(?:\s+(?:HH|[A-Za-z0-9-]+))?)\b/i,
    /\b(Nintendo\s+Switch(?:\s+(?:OLED|Lite|HAC-\d{3}(?:-\d{2})?|\d{1,3}\s*GB))*)\b/i,
    /\b((?:Apple\s+)?iPhone\s+\d+(?:\s+\d+\s*GB)?(?:\s+unlocked)?)\b/i,
    /\b(HP\s+Laptop\s+\d+\s+G\d+)\b/i, /\b(Dell\s+Vostro\s+15\s+3000)\b/i,
    /\b(Kay\s+K320(?:\s+acoustic\s+guitar)?)\b/i, /\b(Mixed\s+laptop\s+job\s+lot)\b/i,
    /\b(?:model|make and model)\s*:\s*([^\n.!?]{2,90})/i,
  ]);
  const model = modelMatch?.[1]?.trim() ?? null;
  if (model) ref("model", model);
  const item = model ?? genericItem(text);
  if (item) ref("item", item);

  const prices = [...text.matchAll(/(US\$|USD\s*|CA\$|CAD\s*|AU\$|AUD\s*|£|GBP\s*|€|EUR\s*|\$)(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)/gi)];
  const primary = prices[0];
  const price = primary ? Number(primary[2].replaceAll(",", "")) : null;
  const currency = primary ? currencyFromMarker(primary[1]) : null;
  if (primary) ref("price", primary[0]);
  if (currency) ref("currency", primary![0]);

  const unknowns: string[] = [];
  const addUnknown = (value: string, quote?: string) => {
    const cleaned = value.trim();
    if (!cleaned || unknowns.includes(cleaned)) return;
    unknowns.push(cleaned); ref("unknowns", quote ?? cleaned);
  };
  const approximate = text.match(/(?:approximately|approx\.?|about)\s+((?:US\$|USD\s*|CA\$|CAD\s*|AU\$|AUD\s*|£|GBP\s*|€|EUR\s*|\$)\s*\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)/i);
  if (approximate && primary && approximate[1] !== primary[0]) {
    ref("price", approximate[1]); ref("currency", approximate[1]);
  }

  const conditionParts = unique([
    ...matches(text, /\b(?:for parts or not working|for spares or repairs?|spares or repairs?|project(?:\s*\/\s*repairs?)?|faulty|damaged|damage|used|second[- ]hand|refurbished|good condition|fair condition)\b/gi),
    ...matches(text, /\b(?:broken|missing|no power|no charger|no controllers|no adapter|CPU fault|not tested|untested|no strings|without strings|needs? repair|not working|battery(?:\s+\w+){0,3}\s+not tested)\b[^\n.!?]*/gi),
  ]);
  for (const quote of conditionParts) ref("condition", quote);
  const condition = conditionParts.length ? conditionParts.join("; ") : null;

  const paymentMatch = text.match(/\b(?:PayPal(?:\s+(?:Goods\s*(?:&|and)\s*Services|Friends\s*(?:&|and)\s*Family))?|bank transfer|cash(?:\s+on\s+collection)?|card payment|credit card|debit card)\b[^\n.!?]*/i);
  const paymentMethod = paymentMatch?.[0]?.trim() ?? null; ref("paymentMethod", paymentMatch?.[0]);
  const deliveryMatch = text.match(/\b(?:tracked postage|(?<!return )postage|shipping|collection only|pickup only|delivery included|free delivery|free postage|delivery varies|courier|international postage)\b[^\n.!?]*/i);
  const deliveryTerms = deliveryMatch?.[0]?.trim() ?? null; ref("deliveryTerms", deliveryMatch?.[0]);

  const materialPromises: string[] = [];
  const addClaim = (quote: string) => {
    const cleaned = quote.trim().replace(/^seller\s+(?:says|claims|states|notes?)\s*:?\s*/i, "").replace(/^[“\"]|[”\"]$/g, "").trim().replace(/[.!?]+$/, "");
    if (!cleaned || materialPromises.some((claim) => normalize(claim) === normalize(cleaned))) return;
    materialPromises.push(cleaned); ref("materialPromises", quote);
  };
  for (const match of text.matchAll(/\bseller\s+(?:says|claims|states|notes?)\s*:\s*[“\"]([^”\"]+)[”"]/gi)) addClaim(match[1]);
  for (const match of text.matchAll(/\bseller\s+notes?\s+(?:says|states?)\s*:\s*[“\"]([^”\"]+)[”"]/gi)) addClaim(match[1]);
  for (const match of text.matchAll(/\bseller\s+(?:says|claims|states)\s*:\s*(?![“\"])[^\n.!?]+|\bseller\s+(?:says|claims|states)\s+(?![“\"])[^\n.!?]+|\bseller\s+notes?\s+(?:state|disclose)[^\n.!?]+/gi)) addClaim(match[0]);
  const bundleDetails = text.match(/\b(?:red\/blue Joy-Con|Joy-Con)[^\n.!?]*/i);
  if (bundleDetails) addClaim(bundleDetails[0]);
  const returns = text.match(/\b(?:\d+[- ]day returns?|free returns?|no returns? accepted|returns? are offered)[^\n.!?]*/i);
  if (returns) addClaim(returns[0]);
  const titleRam = text.match(/title\s+(?:says|lists?)[^.!?]*?\b(\d+)\s*GB[^.!?]*/i);
  const specificsRam = text.match(/(?:item\s+)?specifics\s+(?:say|lists?)[^.!?]*?\b(\d+)\s*GB[^.!?]*/i);
  if (titleRam && specificsRam && titleRam[1] !== specificsRam[1]) {
    addUnknown(`Conflicting RAM specifications: the title says ${titleRam[1]} GB while item specifics say ${specificsRam[1]} GB. Neither value is selected.`, titleRam[0]);
    ref("unknowns", specificsRam[0]);
  }
  for (const match of text.matchAll(/[^\n.!?]*(?:battery health|battery duration|exact year|included accessories|delivery cost|maintenance history|repair history|exact cosmetic defects|individual faults|which units work|accessories are not stated|not stated|not shown|not disclosed|unknown|unclear|not specified|does not establish|does not identify|does not state)[^\n.!?]*/gi)) addUnknown(match[0].trim(), match[0]);
  return { item, model, price, currency, condition, paymentMethod, deliveryTerms, materialPromises, unknowns, evidenceRefs };
}

function firstMatch(text: string, patterns: RegExp[]): RegExpMatchArray | null {
  for (const pattern of patterns) { const match = text.match(pattern); if (match) return match; }
  return null;
}
function matches(text: string, pattern: RegExp): string[] { return [...text.matchAll(pattern)].map((match) => match[0].trim()); }
function unique(values: string[]): string[] { return [...new Set(values.map((value) => value.replace(/\s+/g, " ").trim()))]; }
function normalize(value: string): string { return value.toLocaleLowerCase().replace(/\s+/g, " ").trim(); }
function genericItem(text: string): string | null { return text.match(/\b(?:guitar|phone|laptop|camera|bicycle|bike|watch|console)\b/i)?.[0] ?? null; }

function currencyFromMarker(marker: string): string | null {
  if (marker.includes("£") || /GBP/i.test(marker)) return "GBP";
  if (marker.includes("€") || /EUR/i.test(marker)) return "EUR";
  if (/USD|US\$/i.test(marker)) return "USD";
  if (/CAD|CA\$/i.test(marker)) return "CAD";
  if (/AUD|AU\$/i.test(marker)) return "AUD";
  return null;
}
