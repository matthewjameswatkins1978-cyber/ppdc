import type { Deal, Finding } from "./deal";
import { questionsFor } from "./presentation";
import { reconcileDealCandidates } from "./extract-text";

export function assessDeal(deal: Deal): Deal {
  const findings: Finding[] = [];
  const add = (finding: Omit<Finding, "id">) => findings.push({ ...finding, id: finding.ruleId ?? `finding-${findings.length + 1}` });
  const knownEvidence = (fact: { evidenceIds: string[] } | undefined) => fact?.evidenceIds ?? [];

  if (deal.item || deal.model) {
    const fact = deal.model ?? deal.item!;
    add({ severity: "green", category: "item", title: "Item is identified", explanation: `The supplied evidence identifies this as ${fact.value}.`, evidenceIds: knownEvidence(fact), ruleId: "item-identified", kind: "fact" });
  }
  const displayedConversions = (deal.priceDisplays ?? []).map(({ amount, currency }) => `${currency} ${amount} (approximate conversion)`).join(", ");
  if (deal.price && deal.currency) {
    add({ severity: "green", category: "price", title: "Price is stated", explanation: `The listing states ${deal.currency.value} ${deal.price.value}.${displayedConversions ? ` The marketplace also displays ${displayedConversions}.` : ""}`, evidenceIds: [...knownEvidence(deal.price), ...knownEvidence(deal.currency), ...(deal.priceDisplays ?? []).map(({ evidenceId }) => evidenceId)], ruleId: "price-stated", kind: "fact" });
  } else {
    add({ severity: "amber", category: "price", title: "Price needs confirming", explanation: "A clear price and currency were not both established from the supplied evidence.", evidenceIds: [], ruleId: "price-missing", kind: "unknown" });
  }

  const interpretedConditions = (deal.candidates ?? []).filter((candidate) => candidate.factType === "condition" && ["main_item", "accessory"].includes(candidate.subject) && ["current", "corrected"].includes(candidate.temporalStatus));
  const conditionConcern = interpretedConditions.length
    ? interpretedConditions.some((candidate) => candidate.modality === "uncertain" || (candidate.polarity === "affirmed" && /for parts|spares|faulty|damaged|damage|broken|no power|no charger|no controllers|no adapter|no strings|missing|not working|needs? repair/i.test(String(candidate.value))) || (candidate.polarity === "negated" && /\bworking\b/i.test(String(candidate.value))))
    : Boolean(deal.condition && /for parts|spares or repair|faulty|damaged|damage|broken|missing|no power|no charger|no controllers|no adapter|not tested|untested|no strings|needs? repair/i.test(deal.condition.value));
  if (deal.condition?.kind === "fact" && !conditionConcern && !/not stated|unknown|unclear/i.test(deal.condition.value)) {
    add({ severity: "green", category: "condition", title: "Condition is described", explanation: `The supplied evidence describes the condition as “${deal.condition.value}”. This is a seller description, not an independent inspection.`, evidenceIds: knownEvidence(deal.condition), ruleId: "condition-stated", kind: "fact" });
  } else {
    add({ severity: "amber", category: "condition", title: conditionConcern ? "Disclosed condition limits need review" : "Condition needs clarification", explanation: conditionConcern ? `The supplied evidence describes: ${deal.condition?.value}. This is a seller description, not an independent inspection or an assessment of intent.` : "The supplied evidence does not establish the item condition.", evidenceIds: knownEvidence(deal.condition), ruleId: conditionConcern ? "condition-disclosed-faults" : "condition-unknown", kind: conditionConcern ? "fact" : "unknown" });
  }

  const deliveryCandidates = (deal.candidates ?? []).filter((candidate) => candidate.factType === "delivery" && ["current", "corrected"].includes(candidate.temporalStatus));
  const availableDelivery = deliveryCandidates.filter((candidate) => candidate.polarity === "affirmed");
  const unavailableDelivery = deliveryCandidates.filter((candidate) => candidate.polarity === "negated");
  const conditionalDelivery = availableDelivery.some((candidate) => candidate.modality === "conditional");
  const deliveryEvidenceIds = [...new Set(deliveryCandidates.map(({ sourceId }) => sourceId))];
  if (unavailableDelivery.length && (!availableDelivery.length || unavailableDelivery.some((candidate) => /shipping|postage|delivery/i.test(String(candidate.value))))) {
    add({ severity: "amber", category: "delivery", title: "Some delivery options are unavailable", explanation: availableDelivery.length ? `The supplied evidence says ${unavailableDelivery.map(({ value }) => value).join(" and ")} is unavailable. It also states: ${availableDelivery.map(({ quote }) => quote).join("; ")}.` : `The supplied evidence says: ${deal.deliveryTerms?.value}. It does not establish a practical delivery or collection arrangement.`, evidenceIds: deliveryEvidenceIds, ruleId: "delivery-unavailable", kind: "fact" });
  } else if (conditionalDelivery || (deal.deliveryTerms && /varies|depends/i.test(deal.deliveryTerms.value))) {
    add({ severity: "amber", category: "delivery", title: "Final delivery arrangement needs confirmation", explanation: `The supplied evidence says: ${deal.deliveryTerms?.value}. Confirm which conditional option and cost apply.`, evidenceIds: deliveryEvidenceIds.length ? deliveryEvidenceIds : knownEvidence(deal.deliveryTerms), ruleId: "delivery-variable", kind: "unknown" });
  } else if (!deliveryCandidates.length && deal.deliveryTerms && /\b(?:no|not|without|unavailable)\s+(?:shipping|postage|delivery)\b|\b(?:shipping|postage|delivery)\s+(?:is\s+)?not\s+(?:offered|available|included)\b/i.test(deal.deliveryTerms.value)) {
    add({ severity: "amber", category: "delivery", title: "Shipping is not offered", explanation: `The supplied evidence says: ${deal.deliveryTerms.value}. It does not establish another delivery arrangement.`, evidenceIds: knownEvidence(deal.deliveryTerms), ruleId: "delivery-unavailable", kind: "fact" });
  } else if (deal.deliveryTerms) {
    add({ severity: "green", category: "delivery", title: "Delivery terms are stated", explanation: `The supplied evidence says: ${deal.deliveryTerms.value}. Check that the practical arrangement matches what you expect.`, evidenceIds: deliveryEvidenceIds.length ? deliveryEvidenceIds : knownEvidence(deal.deliveryTerms), ruleId: "delivery-stated", kind: "fact" });
  } else {
    add({ severity: "amber", category: "delivery", title: "Delivery or collection is unclear", explanation: "No delivery or collection arrangement was established from the supplied evidence.", evidenceIds: [], ruleId: "delivery-unknown", kind: "unknown" });
  }

  const paymentConflicts = deal.unknowns.filter((fact) => fact.key === "conflict_payment method" && /friends\s*(?:&|and)\s*family/i.test(String(fact.value)));
  const structuredFamilyCandidates = (deal.candidates ?? []).filter((candidate) => candidate.factType === "payment_method" && /friends\s*(?:&|and)\s*family/i.test(String(candidate.value)));
  const hasStructuredPaymentInterpretation = structuredFamilyCandidates.length > 0;
  const activeFamilyCandidates = structuredFamilyCandidates.filter((candidate) =>
    ["current", "corrected"].includes(candidate.temporalStatus) && candidate.polarity === "affirmed" && ["requested", "conditional", "accepted"].includes(candidate.intent ?? ""));
  const requestsFriendsFamily = hasStructuredPaymentInterpretation
    ? activeFamilyCandidates.length > 0
    : Boolean(deal.paymentMethod && /friends\s*(?:&|and)\s*family/i.test(deal.paymentMethod.value)) || paymentConflicts.length > 0;
  const paymentEvidenceIds = [...new Set([...(hasStructuredPaymentInterpretation ? activeFamilyCandidates.map(({ sourceId }) => sourceId) : knownEvidence(deal.paymentMethod)), ...paymentConflicts.flatMap(({ evidenceIds }) => evidenceIds)])].sort((a, b) => (deal.sourceSegments?.find(({ sourceId }) => sourceId === a)?.order ?? 0) - (deal.sourceSegments?.find(({ sourceId }) => sourceId === b)?.order ?? 0));
  if (requestsFriendsFamily) {
    add({ severity: "red", category: "payment", title: "Friends & Family is requested", explanation: "The supplied evidence requests or offers PayPal Friends & Family for an item purchase. PayPal UK states Friends & Family payments are not eligible for PayPal Buyer Protection; eligible Goods & Services purchases may qualify subject to terms: https://www.paypal.com/uk/legalhub/paypal/useragreement-full", whyItMatters: "This payment type does not provide PayPal Buyer Protection for the purchase.", recommendedAction: "You could ask whether the seller accepts PayPal Goods & Services for this item purchase.", evidenceIds: paymentEvidenceIds, ruleId: "friends-family-purchase", kind: "paypal_rule" });
  } else if (deal.paymentMethod) {
    add({ severity: "green", category: "payment", title: "A payment method is stated", explanation: `The supplied evidence states: ${deal.paymentMethod.value}. This checker has not verified the payment setup or protection eligibility.`, evidenceIds: knownEvidence(deal.paymentMethod), ruleId: "payment-stated", kind: "fact" });
  } else {
    add({ severity: "amber", category: "payment", title: "Payment method is not stated", explanation: "The supplied evidence does not establish how payment is expected to be made.", evidenceIds: [], ruleId: "payment-unknown", kind: "unknown" });
  }

  for (const conflict of deal.unknowns.filter((fact) => fact.key.startsWith("conflict_") && fact.key !== "conflict_payment method")) {
    add({ severity: "amber", category: "conflict", title: "Conflicting details need confirmation", explanation: String(conflict.value), evidenceIds: conflict.evidenceIds, ruleId: conflict.key, kind: "unknown" });
  }
  for (const [index, promise] of deal.materialPromises.entries()) {
    add({ severity: "amber", category: "seller-claim", title: "Seller claim is unverified", explanation: `The seller's statement “${promise.value}” is recorded, but has not been independently verified.`, evidenceIds: promise.evidenceIds, ruleId: `claim-${index + 1}`, kind: "fact" });
  }
  const questions = questionsFor(deal);
  const meaningfulUnknowns = deal.unknowns.filter((fact) => !String(fact.value).endsWith("not established by supplied text") && !fact.key.startsWith("conflict_") && !/does not state a specific payment method|does not state a specific payment method or delivery arrangement/i.test(String(fact.value)) && !unknownAlreadyCommunicated(String(fact.value), questions, deal, findings));
  if (meaningfulUnknowns.length > 0) {
    add({ severity: "amber", category: "unknowns", title: "Specific details remain unresolved", explanation: meaningfulUnknowns.map(({ value }) => value).join("; "), evidenceIds: [...new Set(meaningfulUnknowns.flatMap(({ evidenceIds }) => evidenceIds))], ruleId: "recorded-unknowns", kind: "unknown" });
  }

  const redCount = findings.filter(({ severity }) => severity === "red").length;
  const amberCount = findings.filter(({ severity }) => severity === "amber").length;
  const identity = deal.item?.value ?? deal.model?.value ?? "The item";
  const hasRepairDisclosure = deal.materialPromises.some(({ value }) => /professionally repaired|headstock.{0,40}repaired|repaired after/i.test(value));
  const conclusion = redCount
    ? `${identity} is described in the supplied evidence, but there is a concrete payment-protection concern to resolve before deciding. The evidence does not establish whether the seller is trustworthy; review the payment request and terms yourself.`
    : hasRepairDisclosure
      ? `${identity}: the seller-reported repair could help explain the asking price, but repair quality, current stability, and value remain unverified.`
      : amberCount
        ? `${identity} has some stated deal details, with ${amberCount} point${amberCount === 1 ? "" : "s"} still needing clarification or independent checking. No public price or seller checks have been run. Consider resolving the amber points before deciding.`
        : `${identity} has coherent stated terms in the evidence provided. This is not an independent verification of the item, seller, price, or payment protection; compare the details with what you expect before deciding.`;

  return { ...deal, status: "ready_for_decision", findings, conclusion };
}

function unknownAlreadyCommunicated(value: string, questions: string[], deal: Deal, currentFindings: Finding[]): boolean {
  const text = value.toLocaleLowerCase();
  const questionText = questions.join(" ").toLocaleLowerCase();
  const conditionFinding = currentFindings.some(({ ruleId }) => ruleId === "condition-disclosed-faults");
  const checks: boolean[] = [];
  const requireQuestion = (source: RegExp, question: RegExp, alternative = false) => {
    if (!source.test(text)) return;
    checks.push(question.test(questionText) || alternative);
  };

  requireQuestion(/battery health|battery duration|battery runtime/, /battery/);
  requireQuestion(/cosmetic defects|screen marks|scratches|scuffs/, /screen marks|close-up photos/);
  requireQuestion(/exact year|model year/, /exact year|model year/);
  requireQuestion(/included accessories|accessories/, /accessories/);
  requireQuestion(/condition-specific seller note/, /condition-specific faults|condition-specific details|faults or repairs/);
  requireQuestion(/which units work|individual faults|each laptop|job lot/, /which specific item|which exact laptop/);
  requireQuestion(/maintenance history/, /maintenance or repairs/);
  requireQuestion(/repair history|whether any repairs|repairs were done/, /repair|repairs/);
  requireQuestion(/tests were performed|what tests|testing beyond|not tested/, /tests or repairs/);
  requireQuestion(/payment method/, /payment method/, currentFindings.some(({ ruleId }) => ruleId === "payment-unknown"));
  requireQuestion(/delivery cost|delivery arrangement|how it will be delivered/, /delivery method|delivered|delivery or collection/, currentFindings.some(({ ruleId }) => ruleId === "delivery-unknown"));
  requireQuestion(/region/, /region.*compatibility|compatibility.*region/);
  requireQuestion(/return postage|return period|returns/, /return period|return postage/);
  requireQuestion(/broken|damaged|missing|no power|no charger|no controllers|no adapter|no os|hard drive|no strings|not working/, /condition|faulty|tests or repairs/, conditionFinding);

  return checks.length > 0 && checks.every(Boolean);
}
export function addEvidenceToDeal(existing: Deal, addition: Deal): Deal {
  const conflicts: Deal["unknowns"] = [];
  const mergeFact = <T extends { value: string | number; evidenceIds: string[] }>(
    field: string, current: T | undefined, incoming: T | undefined,
  ): T | undefined => {
    if (!incoming) return current;
    if (!current) return incoming;
    const same = String(current.value).trim().toLocaleLowerCase() === String(incoming.value).trim().toLocaleLowerCase();
    const evidenceIds = [...new Set([...current.evidenceIds, ...incoming.evidenceIds])];
    if (same) return { ...current, evidenceIds };
    conflicts.push({
      key: "conflict_" + field,
      value: "Evidence gives different " + field + " details: “" + current.value + "” and “" + incoming.value + "”. Compare both source records.",
      kind: "unknown",
      evidenceIds,
    });
    return current;
  };
  const refs = validateEvidenceReferences(addition.evidenceRefs ?? [], addition.evidence, addition.sourceSegments);
  const orderOffset = Math.max(-1, ...(existing.sourceSegments ?? []).map(({ order }) => order)) + 1;
  const existingSourceIds = new Set((existing.sourceSegments ?? []).map(({ sourceId }) => sourceId));
  for (const segment of addition.sourceSegments ?? []) {
    if (!segment.sourceId.trim() || existingSourceIds.has(segment.sourceId)) throw new Error(`Duplicate or invalid source ID: ${segment.sourceId}`);
    existingSourceIds.add(segment.sourceId);
  }
  const sourceSegments = [...(existing.sourceSegments ?? []), ...(addition.sourceSegments ?? []).map((segment, index) => ({ ...segment, order: orderOffset + index }))];
  const candidates = reconcileDealCandidates([...(existing.candidates ?? []), ...(addition.candidates ?? [])], sourceSegments.map(({ sourceId, order }) => ({ id: sourceId, order })));
  const currentPayments = candidates.filter((candidate) => candidate.factType === "payment_method" && ["current", "corrected"].includes(candidate.temporalStatus) && candidate.polarity === "affirmed" && ["requested", "conditional", "accepted"].includes(candidate.intent ?? ""));


  const item = mergeFact("item", existing.item, addition.item);
  const model = mergeFact("model", existing.model, addition.model);
  const price = mergeFact("price", existing.price, addition.price);
  const currency = mergeFact("currency", existing.currency, addition.currency);
  const condition = mergeFact("condition", existing.condition, addition.condition);
  const paymentMethod = mergeFact("payment method", existing.paymentMethod, addition.paymentMethod);
  if ((addition.candidates ?? []).some((candidate) => candidate.factType === "payment_method" && candidate.temporalStatus === "corrected")) {
    for (let index = conflicts.length - 1; index >= 0; index--) if (conflicts[index]?.key === "conflict_payment method") conflicts.splice(index, 1);
  }
  const reconciledPaymentMethod = currentPayments.length ? { key: "payment_method", value: [...new Set(currentPayments.map(({ value }) => String(value)))].join(" or "), kind: "fact" as const, evidenceIds: [...new Set(currentPayments.map(({ sourceId }) => sourceId))] } : paymentMethod;
  const deliveryTerms = mergeFact("delivery terms", existing.deliveryTerms, addition.deliveryTerms);
  const knownFields = new Set([
    item && "item", model && "model", price && "price", currency && "currency",
    condition && "condition", paymentMethod && "payment method", deliveryTerms && "delivery terms",
  ].filter(Boolean));
  const retainedUnknowns = existing.unknowns.filter((fact) =>
    !String(fact.value).endsWith("not established by supplied text") || !knownFields.has(fact.key));
  const newUnknowns = addition.unknowns.filter((fact) => !String(fact.value).endsWith("not established by supplied text"));
  const merged: Deal = {
    ...existing, item, model, price, currency, condition, paymentMethod: reconciledPaymentMethod, deliveryTerms,
    sourceSegments, candidates,
    materialPromises: [...existing.materialPromises, ...addition.materialPromises],
    priceDisplays: [...(existing.priceDisplays ?? []), ...(addition.priceDisplays ?? [])],
    unknowns: [...retainedUnknowns, ...newUnknowns, ...conflicts],
    evidence: [...existing.evidence, ...addition.evidence],
    evidenceRefs: validateEvidenceReferences([...(existing.evidenceRefs ?? []), ...refs], [...existing.evidence, ...addition.evidence], sourceSegments, sourceSegments),
  };
  return assessDeal(merged);
}
function validateEvidenceReferences(
  references: NonNullable<Deal["evidenceRefs"]>,
  evidence: Deal["evidence"],
  sourceSegments: Deal["sourceSegments"],
  knownSegments: Deal["sourceSegments"] = sourceSegments,
): NonNullable<Deal["evidenceRefs"]> {
  const evidenceIds = new Set(evidence.map(({ id }) => id));
  if (!sourceSegments?.length) return references.filter(({ evidenceId }) => evidenceIds.has(evidenceId)).map((reference) => ({ ...reference }));
  const valid: NonNullable<Deal["evidenceRefs"]> = [];
  for (const reference of references) {
    if (!evidenceIds.has(reference.evidenceId)) continue;
    const segment = knownSegments?.find(({ sourceId }) => sourceId === reference.evidenceId);
    if (!segment) {
      if (reference.sourceField === undefined && reference.startOffset === undefined && reference.endOffset === undefined) valid.push({ ...reference });
      continue;
    }
    if (reference.sourceField && reference.sourceField !== segment.fieldType) continue;
    let start = reference.startOffset;
    let end = reference.endOffset;
    if (start === undefined || end === undefined) {
      const first = segment.originalText.indexOf(reference.quote);
      if (first < 0 || segment.originalText.indexOf(reference.quote, first + Math.max(reference.quote.length, 1)) >= 0) continue;
      start = first;
      end = first + reference.quote.length;
    }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > segment.originalText.length) continue;
    if (segment.originalText.slice(start, end) !== reference.quote) continue;
    valid.push({ ...reference, sourceField: segment.fieldType, startOffset: start, endOffset: end });
  }
  return valid;
}