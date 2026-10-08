import type { Deal, Finding } from "./deal";

/** First-party questions are a presentation aid derived from current unknowns and research. */
export function questionsFor(deal: Deal, proposedQuestions: string[] = []): string[] {
  const detailText = [
    ...deal.unknowns.map(({ value, key }) => `${key} ${value}`),
    deal.condition?.value ?? "",
    ...deal.materialPromises.map(({ value }) => value),
  ].join(" ").toLocaleLowerCase();
  const unknownText = deal.unknowns.map(({ value }) => value).join(" ").toLocaleLowerCase();
  const candidates: string[] = [];

  for (const conflict of deal.unknowns.filter((fact) => fact.key.startsWith("conflict_"))) {
    const property = conflict.key.slice("conflict_".length).replaceAll("_", " ");
    const values = conflictValues(String(conflict.value));
    candidates.push(values.length >= 2
      ? `Can you confirm whether the ${property} is ${values[0]} or ${values[1]}, and share evidence showing which value is correct?`
      : `The supplied sources disagree about ${property}. Which value is correct, and can you share evidence to confirm it?`);
  }
  const familyPaymentCandidates = (deal.candidates ?? []).filter((candidate) => candidate.factType === "payment_method" && /friends\s*(?:&|and)\s*family/i.test(String(candidate.value)));
  const activeFamilyRequest = familyPaymentCandidates.some((candidate) => ["current", "corrected"].includes(candidate.temporalStatus) && candidate.polarity === "affirmed" && ["requested", "conditional", "accepted"].includes(candidate.intent ?? ""));
  if (familyPaymentCandidates.length ? activeFamilyRequest : Boolean((deal.paymentMethod && /friends\s*(?:&|and)\s*family/i.test(deal.paymentMethod.value)) || deal.unknowns.some((fact) => fact.key === "conflict_payment method" && /friends\s*(?:&|and)\s*family/i.test(String(fact.value))))) {
    candidates.push("Will you accept PayPal Goods & Services for this item purchase?");
  }
  if (/battery health|battery duration|battery runtime/.test(unknownText)) candidates.push("What is the battery health or typical runtime, and can you share a recent battery report?");
  if (/repair history|headstock|truss rod|repaired/.test(detailText)) candidates.push("Can you share current close-up photos of the repair and explain whether it affects operation or stability?");
  if (/maintenance history|repair history|repairs were done/.test(detailText)) candidates.push("What maintenance or repairs have been carried out, and can you share any records or current photos?");
  if (/which units work|individual faults|job lot|each unit/.test(detailText)) candidates.push("Which specific item works, what fault applies to each other item, and what accessories are included?");
  const jobLotDetailsAsked = /which units work|individual faults|job lot|each unit/.test(detailText);
  if (!jobLotDetailsAsked && /for parts|spares or repair|faulty|no power|cpu fault|untested|not tested|broken|missing|no strings|needs? repair/.test(detailText)) candidates.push("What tests or repairs have been completed, and which functions or parts are still known to be faulty?");
  if (/screen|cosmetic defects|scratches|scuffs/.test(unknownText)) candidates.push("Can you describe the exact screen or cosmetic marks and share clear close-up photos?");
  if (deal.priceDisplays?.length) candidates.push("Which amount and currency will be charged at checkout, given the approximate conversion shown?");
  if (/original asking price is unclear|current asking price remains unknown/.test(unknownText) || !deal.price) candidates.push("What is the current asking price and currency?");
  if (!deal.paymentMethod) candidates.push("Which payment method is being requested for this purchase?");
  if (deal.deliveryTerms && /\b(?:no|not|without|unavailable)\s+(?:shipping|postage|delivery)\b|\b(?:shipping|postage|delivery)\s+(?:is\s+)?not\s+(?:offered|available|included)\b/i.test(deal.deliveryTerms.value)) candidates.push("Is collection available, or is there another delivery option?");
  else if (!deal.deliveryTerms) candidates.push("How will the item be delivered or collected, and what will delivery cost?");
  else if (/varies|depends/i.test(deal.deliveryTerms.value)) candidates.push("What delivery method and final delivery cost apply to this item?");
  if (/exact year|model year/.test(unknownText)) candidates.push("Can you confirm the model year and share matching item details?");
  if (/condition-specific seller note|condition-specific details/i.test(unknownText)) candidates.push("Can you confirm any condition-specific faults or repairs?");
  if (!jobLotDetailsAsked && /included accessories|accessories are not stated|accessories are unknown|accessories[^.!?]{0,60}(?:included|listed|stated|unknown)/.test(unknownText)) candidates.push("Please confirm exactly which accessories are included and which are missing?");
  if (/region[^.!?]{0,40}(?:unknown|unclear|unconfirmed|not confirmed)/.test(unknownText)) candidates.push("Which region is the item from, and are there any compatibility limits?");
  if (/no returns accepted|buyer-paid return postage|seller-paid return postage/.test(detailText)) candidates.push("What return period applies, and who pays return postage if a return is accepted?");
  if (/current photo.*not shown|current photos? unavailable/i.test(detailText)) candidates.push("Can you share a current photo showing the exact item and model label?");
  if (!deal.condition) candidates.push("Can you describe the item's condition and any repairs?");
  candidates.push(...proposedQuestions);
  return prioritizeBuyerQuestions(candidates);
}

/** Shared deterministic cap for first-party and later model-proposed questions. */
export function prioritizeBuyerQuestions(questions: string[], maximum = 4): string[] {
  const seen = new Set<string>();
  return questions.map((question) => question.trim()).filter((question) => {
    const key = question.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return question.endsWith("?") && !/(?:should i (?:buy|pay)|pay (?:now|a deposit)|safe to buy|seller (?:is )?trustworthy|is this (?:a )?scam|(?:fake|counterfeit|stolen|fraud|legit|trustworthy)|authorize payment|(?:send|transfer|pay|deposit)\s+(?:the\s+)?(?:money|payment|deposit))/i.test(question);
  }).map((question, index) => ({ question, index, score: questionPriority(question) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, maximum).map(({ question }) => question);
}

function questionPriority(question: string): number {
  if (/friends\s*(?:&|and)\s*family|goods\s*(?:&|and)\s*services|payment protection|payee|bank transfer only/i.test(question)) return 100;
  if (/payment method|how .*pay/i.test(question)) return 65;
  if (/conflicting|sources disagree|confirm.*(?:model|generation|variant|storage|ram|memory|identity)|which specific item/i.test(question)) return 90;
  if (/repair|damage|fault|tests|broken|working|condition|stability/i.test(question)) return 80;
  if (/compatibility|region/i.test(question)) return 75;
  if (/return period|return postage/i.test(question)) return 65;
  if (/battery|maintenance|delivery|shipping|postage|collection|tracking|asking price|currency|checkout/i.test(question)) return 65;
  if (/price|comparable|market|value/i.test(question)) return 60;
  if (/screen|cosmetic|accessor|included|receipt|record|warranty|return/i.test(question)) return 40;
  return 30;
}

function conflictValues(value: string): string[] {
  const quoted = [...value.matchAll(/[“"]([^”"]+)[”"]/g)]
    .map((match) => match[1]?.trim()).filter((part): part is string => Boolean(part));
  if (quoted.length >= 2) return [...new Set(quoted)].slice(0, 2);
  const parts = [...value.matchAll(/\b(?:says?|say|lists?|list|states?|state)\s+(.+?)(?=\s+while\s+|[.;]|$)/gi)]
    .map((match) => match[1]?.trim()).filter((part): part is string => Boolean(part));
  return [...new Set(parts)].slice(0, 2);
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
