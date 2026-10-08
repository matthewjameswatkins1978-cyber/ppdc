import type { Deal, Finding } from "./deal";

export function assessDeal(deal: Deal): Deal {
  const findings: Finding[] = [];
  const add = (finding: Omit<Finding, "id">) => findings.push({ ...finding, id: finding.ruleId ?? `finding-${findings.length + 1}` });
  const knownEvidence = (fact: { evidenceIds: string[] } | undefined) => fact?.evidenceIds ?? [];

  if (deal.item || deal.model) {
    const fact = deal.model ?? deal.item!;
    add({ severity: "green", category: "item", title: "Item is identified", explanation: `The supplied evidence identifies this as ${fact.value}.`, evidenceIds: knownEvidence(fact), ruleId: "item-identified", kind: "fact" });
  }
  if (deal.price && deal.currency) {
    add({ severity: "green", category: "price", title: "Price is stated", explanation: `The listing states ${deal.currency.value} ${deal.price.value}.`, evidenceIds: [...knownEvidence(deal.price), ...knownEvidence(deal.currency)], ruleId: "price-stated", kind: "fact" });
  } else {
    add({ severity: "amber", category: "price", title: "Price needs confirming", explanation: "A clear price and currency were not both established from the supplied evidence.", evidenceIds: [], ruleId: "price-missing", kind: "unknown" });
  }

  if (deal.condition?.kind === "fact" && !/not stated|unknown|unclear/i.test(deal.condition.value)) {
    add({ severity: "green", category: "condition", title: "Condition is described", explanation: `The supplied evidence describes the condition as “${deal.condition.value}”. This is a seller description, not an independent inspection.`, evidenceIds: knownEvidence(deal.condition), ruleId: "condition-stated", kind: "fact" });
  } else {
    add({ severity: "amber", category: "condition", title: "Condition needs clarification", explanation: "The supplied evidence does not establish the item's condition.", evidenceIds: knownEvidence(deal.condition), ruleId: "condition-unknown", kind: "unknown" });
  }

  if (deal.deliveryTerms) {
    add({ severity: "green", category: "delivery", title: "Delivery terms are stated", explanation: `The supplied evidence says: ${deal.deliveryTerms.value}. Check that the practical arrangement matches what you expect.`, evidenceIds: knownEvidence(deal.deliveryTerms), ruleId: "delivery-stated", kind: "fact" });
  } else {
    add({ severity: "amber", category: "delivery", title: "Delivery or collection is unclear", explanation: "No delivery or collection arrangement was established from the supplied evidence.", evidenceIds: [], ruleId: "delivery-unknown", kind: "unknown" });
  }

  const paymentConflicts = deal.unknowns.filter((fact) => fact.key === "conflict_payment method" && /friends\s*(?:&|and)\s*family/i.test(String(fact.value)));
  const requestsFriendsFamily = Boolean(deal.paymentMethod && /friends\s*(?:&|and)\s*family/i.test(deal.paymentMethod.value)) || paymentConflicts.length > 0;
  const paymentEvidenceIds = [...new Set([...knownEvidence(deal.paymentMethod), ...paymentConflicts.flatMap(({ evidenceIds }) => evidenceIds)])];
  if (requestsFriendsFamily) {
    add({ severity: "red", category: "payment", title: "Friends & Family is requested", explanation: "The supplied evidence asks for PayPal Friends & Family for a purchase. That payment type is not intended for buying goods and does not provide the same purchase protection as Goods & Services.", whyItMatters: "This can leave you without the purchase protections you may expect for an item purchase.", recommendedAction: "Do not use Friends & Family for this purchase. Ask for a suitable goods payment method and review the terms yourself.", evidenceIds: paymentEvidenceIds, ruleId: "friends-family-purchase", kind: "paypal_rule" });
  } else if (deal.paymentMethod) {
    add({ severity: "green", category: "payment", title: "A payment method is stated", explanation: `The supplied evidence states: ${deal.paymentMethod.value}. This checker has not verified the payment setup or protection eligibility.`, evidenceIds: knownEvidence(deal.paymentMethod), ruleId: "payment-stated", kind: "fact" });
  } else {
    add({ severity: "amber", category: "payment", title: "Payment method is not stated", explanation: "The supplied evidence does not establish how payment is expected to be made.", evidenceIds: [], ruleId: "payment-unknown", kind: "unknown" });
  }

  for (const [index, promise] of deal.materialPromises.entries()) {
    add({ severity: "amber", category: "seller-claim", title: "Seller claim is unverified", explanation: `The seller's statement “${promise.value}” is recorded, but has not been independently verified.`, evidenceIds: promise.evidenceIds, ruleId: `claim-${index + 1}`, kind: "fact" });
  }
  if (deal.unknowns.length > 0) {
    add({ severity: "amber", category: "unknowns", title: "Some details remain unknown", explanation: deal.unknowns.map(({ value }) => value).join("; "), evidenceIds: [...new Set(deal.unknowns.flatMap(({ evidenceIds }) => evidenceIds))], ruleId: "recorded-unknowns", kind: "unknown" });
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
  // Each reference is already bound to its source during extraction; do not collapse merged sources onto the first evidence item.
  const refs = addition.evidenceRefs ?? [];
  const item = mergeFact("item", existing.item, addition.item);
  const model = mergeFact("model", existing.model, addition.model);
  const price = mergeFact("price", existing.price, addition.price);
  const currency = mergeFact("currency", existing.currency, addition.currency);
  const condition = mergeFact("condition", existing.condition, addition.condition);
  const paymentMethod = mergeFact("payment method", existing.paymentMethod, addition.paymentMethod);
  const deliveryTerms = mergeFact("delivery terms", existing.deliveryTerms, addition.deliveryTerms);
  const knownFields = new Set([
    item && "item", model && "model", price && "price", currency && "currency",
    condition && "condition", paymentMethod && "payment method", deliveryTerms && "delivery terms",
  ].filter(Boolean));
  const retainedUnknowns = existing.unknowns.filter((fact) =>
    !String(fact.value).endsWith("not established by supplied text") || !knownFields.has(fact.key));
  const newUnknowns = addition.unknowns.filter((fact) => !String(fact.value).endsWith("not established by supplied text"));
  const merged: Deal = {
    ...existing, item, model, price, currency, condition, paymentMethod, deliveryTerms,
    materialPromises: [...existing.materialPromises, ...addition.materialPromises],
    unknowns: [...retainedUnknowns, ...newUnknowns, ...conflicts],
    evidence: [...existing.evidence, ...addition.evidence],
    evidenceRefs: [...(existing.evidenceRefs ?? []), ...refs],
  };
  return assessDeal(merged);
}
