import type { Deal, Finding } from "./deal";

/** First-party questions are a presentation aid derived from current unknowns and research. */
export function questionsFor(deal: Deal): string[] {
  const candidates = deal.researchQuestions?.length ? [...deal.researchQuestions] : [];
  if (deal.paymentMethod && /friends\s*(?:&|and)\s*family/i.test(deal.paymentMethod.value)) candidates.push("Will you accept PayPal Goods & Services for this item purchase?");
  if (!deal.condition) candidates.push("Can you describe the item's condition and any repairs?");
  if (!deal.deliveryTerms) candidates.push("How will the item be delivered or collected, and will delivery be tracked?");
  if (!deal.paymentMethod) candidates.push("Which payment method is being requested for this purchase?");
  if (deal.unknowns.some((fact) => /price/i.test(`${fact.key} ${fact.value}`))) candidates.push("Can you explain how the asking price was set?");
  for (const conflict of deal.unknowns.filter((fact) => fact.key.startsWith("conflict_"))) candidates.push(`Can you confirm the agreed ${conflict.key.slice("conflict_".length)}?`);
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
