import type { Deal, Finding } from "./deal";

/** First-party questions are a presentation aid derived from current unknowns and research. */
export function questionsFor(deal: Deal): string[] {
  const detailText = [
    ...deal.unknowns.map(({ value, key }) => `${key} ${value}`),
    deal.condition?.value ?? "",
    ...deal.materialPromises.map(({ value }) => value),
  ].join(" ").toLocaleLowerCase();
  const unknownText = deal.unknowns.map(({ value }) => value).join(" ").toLocaleLowerCase();

  const candidates: string[] = [];
  for (const conflict of deal.unknowns.filter((fact) => fact.key.startsWith("conflict_"))) {
    if (/ram|memory/i.test(`${conflict.key} ${conflict.value}`)) candidates.push("Can you confirm whether the laptop has 4 GB or 8 GB RAM, and share a system screen showing the installed memory?");
    else candidates.push(`Can you confirm the agreed ${conflict.key.slice("conflict_".length)} and provide evidence showing which detail is correct?`);
  }
  if (/battery health|battery duration/.test(unknownText)) candidates.push("What is the battery health or typical runtime, and can you share a recent battery report?");
  if (/screen|cosmetic defects|scratches|scuffs/.test(unknownText)) candidates.push("Can you describe the exact screen marks and share clear close-up photos in good light?");
  if (/which units work|individual faults|job lot|each laptop/.test(detailText)) candidates.push("Which exact laptop works, what fault applies to each other unit, and what accessories are included?");
  if (/maintenance history/.test(detailText)) candidates.push("What maintenance or repairs have been carried out, and when was the instrument last serviced?");
  if (/repair history|headstock|truss rod|repaired/.test(detailText)) candidates.push("Can you share current close-up photos of the repair and explain whether it affects operation or stability?");
  const jobLotDetailsAsked = /which units work|individual faults|job lot|each laptop/.test(detailText);
  if (!jobLotDetailsAsked && /for parts|spares or repair|faulty|no power|cpu fault|untested|not tested|broken|missing|no strings|needs? repair/.test(detailText)) candidates.push("What tests or repairs have been completed, and which functions or parts are still known to be faulty?");
  if (!jobLotDetailsAsked && !/exact year/.test(unknownText) && /included accessories|accessories are not stated|accessories are unknown|accessories[^.!?]{0,50}included/i.test(unknownText)) candidates.push("Please confirm exactly which accessories are included and which are missing.");
  if (deal.priceDisplays?.length) candidates.push("Which currency and amount will be charged at checkout? The listing shows an approximate conversion.");
  if ((deal.paymentMethod && /friends\s*(?:&|and)\s*family/i.test(deal.paymentMethod.value)) || deal.unknowns.some((fact) => fact.key === "conflict_payment method" && /friends\s*(?:&|and)\s*family/i.test(String(fact.value)))) candidates.push("Will you accept PayPal Goods & Services for this item purchase?");
  if (/current photo.*not shown|current photos? unavailable/i.test(detailText)) candidates.push("Can you share a current photo showing the exact item and model label?");
  if (/exact year|model year/i.test(unknownText)) candidates.push(/model year/i.test(unknownText) ? "Can you confirm the guitar model year and share the matching item details?" : "Can you confirm the guitar exact year, any condition-specific details, and included accessories?");
  if (!deal.price) candidates.push("What is the agreed asking price and currency?");
  if (!deal.paymentMethod) candidates.push("Which payment method is being requested for this purchase?");
  if (!deal.deliveryTerms) candidates.push("How will the item be delivered or collected, and what will delivery cost?");
  else if (/varies|depends/i.test(deal.deliveryTerms.value)) candidates.push("What delivery method and final delivery cost apply to this item?");
  if (!deal.condition) candidates.push("Can you describe the item's condition and any repairs?");
  return [...new Set(candidates)].slice(0, 4);
}
/** Surface existing findings only; severity controls order, not a new assessment. */
export function beforePayFor(deal: Deal): Finding[] {
  const priority = { red: 0, amber: 1, green: 2 };
  return [...deal.findings].sort((a, b) => priority[a.severity] - priority[b.severity]).slice(0, 3);
}

/** Conflicts are explicitly represented by addEvidenceToDeal; do not invent a timeline. */
export function changedFacts(deal: Deal) {
  return deal.unknowns.filter((fact) => fact.key.startsWith("conflict_")).map((fact) => ({
    field: fact.key.slice("conflict_".length), text: fact.value,
    sources: [...new Set(fact.evidenceIds.map((id) => deal.evidence.find((item) => item.id === id)?.label).filter(Boolean))],
  }));
}

export function evidenceToKeep(deal: Deal): string[] {
  const items = ["Keep a copy of the original listing and seller messages."];
  if (deal.condition || deal.materialPromises.length) items.push("Keep clear photos and the seller's written condition or repair statements.");
  if (!deal.deliveryTerms) items.push("Keep the agreed delivery or collection details once confirmed.");
  else items.push("Keep the agreed delivery terms and any tracking or collection record.");
  items.push("Keep the payment confirmation and this assessment snapshot.");
  return [...new Set(items)];
}

export const formatQuestions = (questions: string[]) => questions.map((question) => `• ${question}`).join("\n");
