import type { Deal, DealCandidate, DealSourceField, Evidence } from "./deal";
import { extractionToDeal, type DealExtraction, validateDealExtraction } from "./deal-extraction";

/** Local no-network extraction; every proposed fact keeps an exact source quote. */
export interface DealIntakeSegment {
  id: string;
  field: DealSourceField;
  text: string;
  order?: number;
  label?: string;
}

export interface DealIntake {
  dealId: string;
  segments: readonly DealIntakeSegment[];
  evidenceLabel?: string;
}

/** Legacy text/OCR call shape is preserved; structured fields use extractDealFromIntake. */
export function extractDealFromText(text: string, dealId = "text-intake", evidenceLabel = "User-supplied listing text", evidenceId = "user-input", sourceField: Extract<DealSourceField, "plain_text" | "ocr"> = "plain_text") {
  return extractDealFromIntake({
    dealId,
    evidenceLabel,
    segments: [{ id: evidenceId, field: sourceField, text, order: 0, label: evidenceLabel }],
  });
}
function extractSingleSourceText(text: string, dealId = "text-intake", evidenceLabel = "User-supplied listing text", evidenceId = "user-input") {
  const sourceText = text.trim();
  const extraction = validateDealExtraction(extractLocally(sourceText), sourceText);
  const evidence: Evidence = { id: evidenceId, source: "user", label: evidenceLabel, capturedAt: new Date().toISOString(), private: true };
  const deal = extractionToDeal({ extraction, evidence, dealId });
  deal.priceDisplays = moneyMentions(sourceText)
    .filter((mention) => mention.role === "conversion" && mention.currency !== null)
    .map((mention) => ({ amount: mention.amount, currency: mention.currency!, kind: "approximate_conversion" as const, evidenceId, quote: mention.quote }));
  return deal;
}

/** Source-aware extraction keeps every segment separate until facts are reconciled. */
export function extractDealFromIntake(intake: DealIntake): Deal {
  if (!intake.segments.length) throw new Error("A deal intake must contain at least one source segment.");
  const seenIds = new Set<string>();
  const segments = intake.segments.map((segment, index) => {
    if (!segment.id.trim() || seenIds.has(segment.id)) throw new Error(`Source IDs must be non-empty and unique: ${segment.id}`);
    seenIds.add(segment.id);
    return { ...segment, order: segment.order ?? index };
  });
  const extracted = segments.map((segment) => ({
    segment,
    deal: extractSingleSourceText(segment.text, intake.dealId, segment.label ?? `${segment.field} evidence`, segment.id),
  }));
  const candidates = reconcileDealCandidates(extracted.flatMap(({ segment, deal }) => candidatesForSegment(segment, deal)), segments);
  const evidence = extracted.map(({ segment, deal }) => ({ ...deal.evidence[0]!, sourceRef: segment.field }));
  const evidenceRefs = extracted.flatMap(({ segment, deal }) =>
    (deal.evidenceRefs ?? []).flatMap((reference) => rangesOf(segment.text, reference.quote).map(({ start, end }) => ({
      ...reference, evidenceId: segment.id, sourceField: segment.field, startOffset: start, endOffset: end,
    }))),
  );
  for (const candidate of candidates) {
    if (!evidenceRefs.some((reference) => reference.evidenceId === candidate.sourceId && reference.field === candidateField(candidate.factType) && reference.startOffset === candidate.startOffset && reference.endOffset === candidate.endOffset)) {
      evidenceRefs.push({ field: candidateField(candidate.factType), evidenceId: candidate.sourceId, sourceField: segments.find(({ id }) => id === candidate.sourceId)!.field, quote: candidate.quote, startOffset: candidate.startOffset, endOffset: candidate.endOffset });
    }
  }

  const ordered = [...extracted].sort((a, b) => sourcePriority(a.segment.field) - sourcePriority(b.segment.field) || a.segment.order - b.segment.order);
  const conflicts: Deal["unknowns"] = [];
  const select = <T extends { value: unknown; evidenceIds: string[] }>(field: "item" | "model" | "price" | "currency", get: (deal: Deal) => T | undefined): T | undefined => {
    const values = ordered.flatMap(({ deal }) => get(deal) ? [get(deal)!] : []);
    const chosen = values[0];
    const alternatives = values.filter((value) => chosen && String(value.value).toLocaleLowerCase() !== String(chosen.value).toLocaleLowerCase());
    if (chosen && alternatives.length) {
      const all = [chosen, ...alternatives];
      conflicts.push({ key: `conflict_${field}`, value: `Evidence gives different ${field} values: ${all.map(({ value }) => `“${value}”`).join(" and ")}. The current value is not resolved.`, kind: "unknown", evidenceIds: [...new Set(all.flatMap(({ evidenceIds }) => evidenceIds))] });
    }
    return chosen;
  };
  const item = select("item", (deal) => deal.item);
  const model = select("model", (deal) => deal.model);
  const price = select("price", (deal) => deal.price);
  const currency = select("currency", (deal) => deal.currency);
  const activePayment = candidates.filter((candidate) => candidate.factType === "payment_method" && ["current", "corrected"].includes(candidate.temporalStatus) && candidate.polarity === "affirmed" && ["requested", "conditional", "accepted"].includes(candidate.intent ?? ""));
  const paymentMethod = activePayment.length ? {
    key: "payment_method", value: unique(activePayment.map(({ value }) => String(value))).join(" or "), kind: "fact" as const,
    evidenceIds: [...new Set(activePayment.map(({ sourceId }) => sourceId))],
  } : undefined;
  const deliveryCandidates = candidates.filter((candidate) => candidate.factType === "delivery" && ["current", "corrected"].includes(candidate.temporalStatus));
  const deliveryTerms = deliveryCandidates.length ? {
    key: "delivery_terms", value: unique(deliveryCandidates.map(({ quote }) => quote)).join("; "), kind: "fact" as const,
    evidenceIds: [...new Set(deliveryCandidates.map(({ sourceId }) => sourceId))],
  } : undefined;
  const conditionCandidates = candidates.filter((candidate) => candidate.factType === "condition" && candidate.subject !== "checkout" && ["current", "corrected"].includes(candidate.temporalStatus));
  const hasCheckoutFaultOnly = candidates.some((candidate) => candidate.factType === "condition" && candidate.subject === "checkout") && !conditionCandidates.length;
  const extractedConditions = ordered.flatMap(({ deal }) => deal.condition ? [deal.condition] : []);
  const condition = conditionCandidates.length
    ? { key: "condition", value: unique(conditionCandidates.map(({ quote }) => quote.replace(/,\s*(?=(?:good|fair|excellent|very good|poor|mint)\s+condition)/i, "; "))).join("; "), kind: "fact" as const, evidenceIds: [...new Set(conditionCandidates.map(({ sourceId }) => sourceId))] }
    : hasCheckoutFaultOnly ? undefined : extractedConditions[0];

  const materialPromises = ordered.flatMap(({ deal }) => deal.materialPromises).filter((fact, index, all) => all.findIndex((candidate) => candidate.value.toLocaleLowerCase() === fact.value.toLocaleLowerCase()) === index);
  const explicitUnknowns = ordered.flatMap(({ deal }) => deal.unknowns.filter((fact) => !String(fact.value).endsWith("not established by supplied text")));
  const unknowns = [...explicitUnknowns, ...conflicts];
  const absent = (key: string, fact: unknown) => { if (!fact) unknowns.push({ key, value: `${key} not established by supplied text`, kind: "unknown", evidenceIds: evidence.map(({ id }) => id) }); };
  absent("item", item); absent("model", model); absent("price", price); absent("currency", currency);
  absent("condition", condition); absent("payment method", paymentMethod); absent("delivery terms", deliveryTerms);
  return {
    id: intake.dealId, status: "draft", item, model, price, currency, condition, paymentMethod, deliveryTerms,
    materialPromises, unknowns, evidence, evidenceRefs, sourceSegments: segments.map(({ id, field, text, order }) => ({ sourceId: id, fieldType: field, originalText: text, order })),
    candidates, priceDisplays: ordered.flatMap(({ deal }) => deal.priceDisplays ?? []), findings: [],
  };
}

function candidatesForSegment(segment: DealIntakeSegment, deal: Deal): DealCandidate[] {
  const candidates: DealCandidate[] = [];
  const add = (factType: DealCandidate["factType"], subject: DealCandidate["subject"], value: string | number, quote: string, polarity: DealCandidate["polarity"] = "affirmed", modality: DealCandidate["modality"] = "asserted", temporalStatus: DealCandidate["temporalStatus"] = "current", intent?: DealCandidate["intent"]) => {
    for (const { start, end } of rangesOf(segment.text, quote)) candidates.push({ factType, subject, value, sourceId: segment.id, quote, startOffset: start, endOffset: end, polarity, modality, temporalStatus, ...(intent ? { intent } : {}) });
  };
  const factValues: [string, DealCandidate["factType"], DealCandidate["subject"], unknown][] = [
    ["item", "item", "main_item", deal.item?.value], ["model", "model", "main_item", deal.model?.value],
    ["price", "price", "main_item", deal.price?.value], ["currency", "currency", "main_item", deal.currency?.value],
  ];
  for (const [field, factType, subject, value] of factValues) {
    if (value === undefined) continue;
    for (const ref of deal.evidenceRefs ?? []) if (ref.field === field) add(factType, subject, value as string | number, ref.quote);
  }
  for (const fact of deal.materialPromises) for (const ref of deal.evidenceRefs ?? []) if (ref.field === "materialPromises" && rangesOf(segment.text, ref.quote).length && normalize(ref.quote).includes(normalize(fact.value))) add("claim", "other", fact.value, ref.quote);
  for (const fact of deal.unknowns) for (const ref of deal.evidenceRefs ?? []) if (ref.field === "unknowns" && rangesOf(segment.text, ref.quote).length) add("unknown", "other", fact.value, ref.quote, "affirmed", "uncertain");
  candidates.push(...paymentCandidates(segment), ...deliveryCandidates(segment), ...conditionCandidates(segment));
  return candidates;
}

function paymentCandidates(segment: DealIntakeSegment): DealCandidate[] {
  const pattern = /PayPal\s+(?:Friends\s*(?:&|and)\s*Family|Goods\s*(?:&|and)\s*Services)|Friends\s*(?:&|and)\s*Family|Goods\s*(?:&|and)\s*Services|bank\s+transfer|cash(?:\s+on\s+(?:collection|pickup))?|(?:credit|debit)?\s*card(?:\s+payment)?|bank\s+payment/gi;
  const matches = [...segment.text.matchAll(pattern)];
  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const methodEnd = start + match[0].length;
    const range = clauseRange(segment.text, start);
    const previous = matches[index - 1];
    const previousEnd = previous ? (previous.index ?? 0) + previous[0].length : range.start;
    const nextStart = matches[index + 1]?.index ?? range.end;
    const before = segment.text.slice(Math.max(range.start, start - 48), start);
    const after = segment.text.slice(methodEnd, Math.min(range.end, methodEnd + 48));
    const local = segment.text.slice(previousEnd, nextStart);
    const isFamily = /friends\s*(?:&|and)\s*family/i.test(match[0]);
    const directNegation = /\b(?:no|not|never|without|reject(?:ed)?|declin(?:ed|e)|don['’]?t\s+(?:accept|use)|do\s+not\s+(?:accept|use)|won['’]?t\s+(?:accept|use)|cannot\s+(?:accept|use)|can['’]?t\s+(?:accept|use))\s*$/i.test(before)
      || /^\s*(?:is\s+)?(?:not\s+(?:needed|accepted|required|requested|for\s+(?:this\s+)?purchase)|isn['’]?t\s+(?:needed|accepted|required)|not\s+for\s+(?:this\s+)?purchase)\b/i.test(after);
    const inheritsNegation = Boolean(previous && /^\s*(?:or|and)\s*$/i.test(segment.text.slice(previousEnd, start))
      && /\b(?:no|not|never|without|reject(?:ed)?|declin(?:ed|e)|don['’]?t|do\s+not|won['’]?t|cannot|can['’]?t)\b/i.test(segment.text.slice(Math.max(range.start, (previous.index ?? 0) - 48), previous.index)));
    const negated = directNegation || inheritsNegation;
    const context = `${before.slice(-35)} ${local} ${after.slice(0, 30)}`;
    const conditional = /\b(?:if|when|unless|depending\s+on|only\s+if)\b/i.test(context);
    const mentionOnly = /\b(?:guidance|policy|example|mentioned|mention|help\s+text|not\s+covered|isn['’]?t\s+covered|aren['’]?t\s+covered)\b/i.test(local)
      && !/\b(?:seller\s+(?:asks?|requests?|prefers?|requires?)|please\s+pay|use\s+(?:paypal\s+)?|(?:only|preferred|easiest))\b/i.test(context);
    const correctionCue = /\b(?:correction|corrected|actually|instead|updated|changed\s+to|now\s+accepts?)\b/i.test(before.slice(-48));
    const historicalCue = /\b(?:previously\s+(?:suggested|offered|requested)|used\s+to|was\s+previously|no\s+longer)\b/i.test(local)
      || /\b(?:previously\s+(?:suggested|offered|requested)|used\s+to|was\s+previously|no\s+longer)\b/i.test(before.slice(-48));
    const explicitAction = /\b(?:seller\s+(?:asks?|requests?|prefers?|requires?|accepts?)|please\s+pay|pay\s+by|use\s+(?:paypal\s+)?|requested|preferred|easiest|only|accept(?:s|ed)?|is\s+(?:okay|fine))\b/i.test(context);
    const paymentField = segment.field === "payment_terms" || segment.field === "plain_text";
    const intent: DealCandidate["intent"] = negated ? "rejected"
      : mentionOnly || (!paymentField && !explicitAction) ? "mentioned"
        : conditional ? "conditional"
          : explicitAction || (paymentField && !/\b(?:guidance|policy|example|mentioned|not\s+covered)\b/i.test(local))
            ? (isFamily ? "requested" : "accepted")
            : "mentioned";
    const temporalStatus: DealCandidate["temporalStatus"] = historicalCue ? "historical" : correctionCue ? "corrected" : "current";
    const value = isFamily ? "PayPal Friends & Family"
      : /goods\s*(?:&|and)\s*services/i.test(match[0]) ? "PayPal Goods & Services"
        : match[0].trim() + (/\bonly\b/i.test(after) ? " only" : "");
    return { factType: "payment_method", subject: "payment", value, sourceId: segment.id,
      quote: segment.text.slice(range.start, range.end), startOffset: range.start, endOffset: range.end,
      polarity: negated ? "negated" : "affirmed", modality: conditional ? "conditional" : "asserted", temporalStatus, intent };
  });
}

function deliveryCandidates(segment: DealIntakeSegment): DealCandidate[] {
  const matches = [...segment.text.matchAll(/shipping|postage|delivery|courier|collection|pickup/gi)];
  return matches.flatMap((match, index) => {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const range = clauseRange(segment.text, start);
    const previous = matches[index - 1];
    const previousEnd = previous ? (previous.index ?? 0) + previous[0].length : range.start;
    const before = segment.text.slice(Math.max(range.start, start - 45), start);
    const after = segment.text.slice(end, Math.min(range.end, end + 50));
    if (/\breturn\s*$/i.test(before) || (match[0].toLocaleLowerCase() === "pickup" && /\bcash(?:\s+on)?\s*$/i.test(before))) return [];
    const directNegation = /\b(?:no|not|never|without|unavailable|doesn['’]?t\s+offer|does\s+not\s+offer)\s*$/i.test(before)
      || /\b(?:not\s+(?:available|offered|included)|unavailable|(?:is|are)\s+(?:both\s+)?unavailable)\b/i.test(after);
    const inheritedNegation = Boolean(previous
      && /^\s*(?:or|and)\s*$/i.test(segment.text.slice(previousEnd, start))
      && /\b(?:no|not|never|without|unavailable|doesn['’]?t\s+offer|does\s+not\s+offer)\b/i.test(segment.text.slice(Math.max(range.start, (previous.index ?? 0) - 45), previous.index)));
    const conditional = /\b(?:if|when|unless|varies|depends|depending|subject\s+to)\b/i.test(`${before.slice(-24)} ${after.slice(0, 35)}`);
    return [{ factType: "delivery", subject: "delivery", value: match[0].toLocaleLowerCase(), sourceId: segment.id,
      quote: segment.text.slice(range.start, range.end), startOffset: range.start, endOffset: range.end,
      polarity: directNegation || inheritedNegation ? "negated" : "affirmed", modality: conditional ? "conditional" : "asserted", temporalStatus: "current" }];
  });
}

function conditionCandidates(segment: DealIntakeSegment): DealCandidate[] {
  const pattern = /for\s+parts\s+or\s+not\s+working|not\s+tested|untested|not\s+working|for\s+parts|spares?\s+(?:or\s+)?repairs?|needs?\s+repair|no\s+(?:power|chargers?(?:\s+included)?|controllers?(?:\s+included)?|adapters?(?:\s+included)?|strings(?:\s+included)?)|good\s+condition|fair\s+condition|second[- ]hand|refurbished|used|broken|damage|damaged|faulty|working|tested|missing/gi;
  return [...segment.text.matchAll(pattern)].map((match) => {
    const start = match.index ?? 0;
    const range = clauseRange(segment.text, start);
    const prefix = segment.text.slice(range.start, start).toLocaleLowerCase();
    const lastIndex = (terms: string[]) => Math.max(-1, ...terms.map((term) => prefix.lastIndexOf(term)));
    const checkoutIndex = lastIndex(["checkout", "payment page", "order page", "website"]);
    const accessoryIndex = lastIndex(["charger", "adapter", "controller", "case", "strings", "accessory", "accessories"]);
    const itemIndex = lastIndex(["item", "console", "laptop", "guitar", "phone", "camera", "device", "product", "screen", "keyboard", "bicycle"]);
    const checkout = checkoutIndex > Math.max(accessoryIndex, itemIndex) && start - range.start - checkoutIndex <= 60;
    const accessory = /\b(?:charger|adapter|controller|case|strings|accessory|accessories)\b/i.test(match[0]) || (accessoryIndex > itemIndex && start - range.start - accessoryIndex <= 60);
    const testedUnknown = /^(?:not\s+tested|untested)$/i.test(match[0]);
    const negated = /\bnot\s+because\b/i.test(prefix)
      || /\b(?:not|no|never|without|isn['’]?t|aren['’]?t|doesn['’]?t)\s*$/i.test(prefix);
    return {
      factType: "condition", subject: checkout ? "checkout" : accessory ? "accessory" : "main_item",
      value: testedUnknown ? "tested" : match[0].toLocaleLowerCase(), sourceId: segment.id,
      quote: conditionRange(segment.text, start), startOffset: segment.text.lastIndexOf(conditionRange(segment.text, start), start), endOffset: segment.text.lastIndexOf(conditionRange(segment.text, start), start) + conditionRange(segment.text, start).length,
      polarity: negated ? "negated" : "affirmed", modality: testedUnknown ? "uncertain" : "asserted", temporalStatus: "current",
    };
  });
}

function clauseRange(text: string, offset: number): { start: number; end: number } {
  let start = offset; let end = offset;
  while (start > 0 && !/[.!?;\n]/.test(text[start - 1]!)) start--;
  while (end < text.length && !/[.!?;\n]/.test(text[end]!)) end++;
  while (start < end && /\s/.test(text[start]!)) start++;
  while (end > start && /\s/.test(text[end - 1]!)) end--;
  return { start, end };
}

function conditionRange(text: string, offset: number): string {
  const range = clauseRange(text, offset);
  let start = range.start;
  let end = range.end;
  const contrast = /,\s*(?:but|although|however)\b|\s+but\s+/gi;
  for (const match of text.slice(range.start, range.end).matchAll(contrast)) {
    const delimiterStart = range.start + (match.index ?? 0);
    const delimiterEnd = delimiterStart + match[0].length;
    if (delimiterStart < offset) start = Math.max(start, delimiterEnd);
    else { end = Math.min(end, delimiterStart); break; }
  }
  while (start < end && /\s/.test(text[start]!)) start++;
  while (end > start && /\s/.test(text[end - 1]!)) end--;
  return text.slice(start, end);
}
function rangesOf(text: string, quote: string): { start: number; end: number }[] {
  if (!quote) return [];
  const ranges: { start: number; end: number }[] = []; let offset = 0;
  while (offset <= text.length - quote.length) {
    const start = text.indexOf(quote, offset); if (start < 0) break;
    ranges.push({ start, end: start + quote.length }); offset = start + Math.max(quote.length, 1);
  }
  return ranges;
}

function candidateField(factType: DealCandidate["factType"]): string {
  return ({ item: "item", model: "model", price: "price", currency: "currency", condition: "condition", payment_method: "paymentMethod", delivery: "deliveryTerms", claim: "materialPromises", unknown: "unknowns" })[factType];
}

function sourcePriority(field: DealSourceField): number {
  return ({ title: 0, item_specifics: 1, description: 2, seller_notes: 3, payment_terms: 4, delivery_terms: 5, follow_up: 6, plain_text: 7, ocr: 8 })[field];
}

export function reconcileDealCandidates(candidates: DealCandidate[], segments: readonly { id: string; order?: number }[]): DealCandidate[] {
  const orders = new Map(segments.map((segment, index) => [segment.id, segment.order ?? index]));
  const corrections = candidates.filter((candidate) => candidate.factType === "payment_method" && candidate.temporalStatus === "corrected");
  if (!corrections.length) return candidates;
  const methodOffset = (candidate: DealCandidate) => {
    const method = /friends\s*(?:&|and)\s*family|goods\s*(?:&|and)\s*services|bank\s+transfer|cash(?:\s+on\s+(?:collection|pickup))?|(?:credit|debit)?\s*card(?:\s+payment)?|bank\s+payment/i;
    const valueMethod = String(candidate.value).replace(/^PayPal /i, "");
    const offset = candidate.quote.toLocaleLowerCase().indexOf(valueMethod.toLocaleLowerCase());
    return candidate.startOffset + Math.max(0, offset);
  };
  return candidates.map((candidate) => {
    if (candidate.factType !== "payment_method" || candidate.temporalStatus !== "current") return candidate;
    const candidateOrder = orders.get(candidate.sourceId) ?? -1;
    const superseded = corrections.some((correction) => {
      if (correction.sourceId === candidate.sourceId) return methodOffset(correction) > methodOffset(candidate);
      return (orders.get(correction.sourceId) ?? -1) > candidateOrder;
    });
    return superseded ? { ...candidate, temporalStatus: "historical" } : candidate;
  });
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

  const unknowns: string[] = [];
  const addUnknown = (value: string, quote?: string) => {
    const cleaned = value.trim();
    if (!cleaned || unknowns.includes(cleaned)) return;
    unknowns.push(cleaned); ref("unknowns", quote ?? cleaned);
  };
  const mentions = moneyMentions(text);
  const askingMentions = uniqueMoney(mentions.filter((mention) => mention.role === "asking"));
  const unlabelledMentions = uniqueMoney(mentions.filter((mention) => mention.role === "candidate"));
  const eligible = askingMentions.length ? askingMentions : unlabelledMentions;
  const primary = eligible.length === 1 ? eligible[0] : undefined;
  const price = primary?.amount ?? null;
  const currency = primary?.currency ?? null;
  if (primary) {
    ref("price", primary.amountQuote);
    if (currency) ref("currency", primary.amountQuote);
  } else if (eligible.length > 1) {
    addUnknown("The original asking price is unclear because multiple current-looking monetary amounts are present.", eligible[0]?.amountQuote);
    for (const mention of eligible.slice(1)) ref("unknowns", mention.amountQuote);
  } else if (mentions.some((mention) => mention.role === "historical")) {
    const historical = mentions.find((mention) => mention.role === "historical")!;
    addUnknown("Only a previous price is established; the current asking price remains unknown.", historical.amountQuote);
  } else if (mentions.some((mention) => mention.role === "conversion")) {
    const conversion = mentions.find((mention) => mention.role === "conversion")!;
    addUnknown("An approximate displayed amount is present, but the original asking price is not established.", conversion.amountQuote);
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
  for (const match of text.matchAll(/[^\n.!?]*(?:battery health|battery duration|exact year|included accessories|delivery cost|maintenance history|repair history|exact cosmetic defects|individual faults|which units work|accessories are not stated|not stated|not shown|not disclosed|unknown|unclear|unconfirmed|not confirmed|not specified|does not establish|does not identify|does not state)[^\n.!?]*/gi)) addUnknown(match[0].trim(), match[0]);
  return { item, model, price, currency, condition, paymentMethod, deliveryTerms, materialPromises, unknowns, evidenceRefs };
}

function firstMatch(text: string, patterns: RegExp[]): RegExpMatchArray | null {
  for (const pattern of patterns) { const match = text.match(pattern); if (match) return match; }
  return null;
}
function matches(text: string, pattern: RegExp): string[] { return [...text.matchAll(pattern)].map((match) => match[0].trim()); }
function unique(values: string[]): string[] { return [...new Set(values.map((value) => value.replace(/\s+/g, " ").trim()))]; }
type MoneyRole = "conversion" | "postage" | "historical" | "asking" | "candidate" | "other";
interface MoneyMention { amount: number; currency: string | null; marker: string; amountQuote: string; quote: string; role: MoneyRole; }
function moneyMentions(text: string): MoneyMention[] {
  const pattern = /(US\$|USD\s*|CA\$|CAD\s*|AU\$|AUD\s*|£|GBP\s*|€|EUR\s*|\$)\s*(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)/gi;
  return [...text.matchAll(pattern)].map((match) => {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const leftBound = Math.max(text.lastIndexOf("\n", start - 1), text.lastIndexOf(".", start - 1), text.lastIndexOf("!", start - 1), text.lastIndexOf("?", start - 1), text.lastIndexOf(";", start - 1)) + 1;
    const rightCandidates = ["\n", ".", "!", "?", ";"].map((mark) => text.indexOf(mark, end)).filter((index) => index >= 0);
    const rightBound = rightCandidates.length ? Math.min(...rightCandidates) : text.length;
    const left = text.slice(leftBound, start).toLocaleLowerCase();
    const right = text.slice(end, rightBound).toLocaleLowerCase();
    const label = left.slice(-70);
    let role: MoneyRole = "candidate";
    if (/\breturn\s+(?:postage|shipping|delivery)\s*[:=]?\s*$/.test(label) || /^\s*(?:return\s+)?(?:postage|shipping|delivery)\b/.test(right)) role = "postage";
    else if (/\b(?:postage|shipping|delivery|courier|dispatch|tax|vat|fee|deposit|balance|refund|saving)\s*[:=]?\s*$/.test(label)) role = "other";
    else if (/\b(?:approximately|approx\.?|about|conversion|converted|equivalent)\s*[:=]?\s*$/.test(label)) role = "conversion";
    else if (/\b(?:was|previously|formerly|paid|purchased\s+for|cost|previous\s+price|old\s+price|reduced\s+from|listed\s+previously)\s*$/.test(label)) role = "historical";
    else if (/\b(?:asking(?:\s+price)?|original\s+asking\s+price|current(?:\s+asking)?(?:\s+price)?|price(?:\s+shown)?(?:\s+as)?|buy\s+it\s+now|listed\s+(?:at|for)|now|reduced\s+to)\s*(?:(?:is|:|=|of|as)\s*)?$/.test(label)) role = "asking";
    else if (/\b(?:return\s+postage|postage|shipping|delivery|courier|fee|deposit|tax|vat)\b/.test(label)) role = "other";
    const approximate = left.match(/\b(?:approximately|approx\.?|about)\s*$/i);
    const quote = role === "conversion" && approximate ? text.slice(start - approximate[0].length, end).trim() : match[0];
    return { amount: Number(match[2]!.replaceAll(",", "")), currency: currencyFromMarker(match[1]!), marker: match[1]!, amountQuote: match[0], quote, role };
  });
}
function uniqueMoney(mentions: MoneyMention[]): MoneyMention[] {
  const seen = new Set<string>();
  return mentions.filter((mention) => {
    const key = `${mention.currency ?? mention.marker}:${mention.amount}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
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
