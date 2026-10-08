import type { Deal, DealFact } from "./deal";
import type { CandidateObservation, TrustedDealAnalysis } from "./ai-analysis";

const FIELD_MAP: Record<string, "item" | "model" | "condition" | "paymentMethod" | "deliveryTerms"> = {
  item: "item", item_description: "item", model: "model", generation: "model", product_generation: "model",
  condition: "condition", payment_method: "paymentMethod", delivery_terms: "deliveryTerms",
};

/** Admit only validated, evidence-backed observations. Conflicts stay unresolved; assessment rules are untouched. */
export function integrateValidatedAnalysis(deal: Deal, analysis: TrustedDealAnalysis): Deal {
  const result: Deal = { ...deal, materialPromises: [...deal.materialPromises], unknowns: [...deal.unknowns] };
  const sourceMap = new Map(analysis.sourceAttribution.map((source) => [source.source_id, source]));
  const conflicted = new Set(analysis.contradictions.map((item) => normalize(item.field)));
  const observations = [...analysis.candidateFacts, ...analysis.sellerClaims];

  for (const observation of observations) {
    const field = normalize(observation.field);
    const evidenceIds = [...new Set(observation.evidence.map(({ source_id }) => source_id))];
    if (field === "repair_history" || field === "repair_detail") {
      const sourceSpeaker = observation.evidence.some(({ source_id }) => sourceMap.get(source_id)?.speaker === "seller");
      if (sourceSpeaker && typeof observation.value === "string" && !result.materialPromises.some((claim) => claim.value.toLocaleLowerCase() === String(observation.value).toLocaleLowerCase())) {
        result.materialPromises.push({ key: "repair_disclosure", value: `Seller stated: ${observation.value}`, kind: "fact", evidenceIds });
      }
      continue;
    }
    const target = FIELD_MAP[field];
    if (!target || typeof observation.value !== "string") continue;
    if (conflicted.has(field) || (field === "payment_method" && conflicted.has("payment_method"))) {
      addConflict(result, field, observation, evidenceIds);
      continue;
    }
    const current = result[target] as DealFact<string> | undefined;
    if (!current) {
      result[target] = { key: target, value: observation.value, kind: "fact", evidenceIds };
    } else if (current.value.trim().toLocaleLowerCase() === observation.value.trim().toLocaleLowerCase()) {
      result[target] = { ...current, evidenceIds: [...new Set([...current.evidenceIds, ...evidenceIds])] };
    } else {
      addConflict(result, field, observation, [...current.evidenceIds, ...evidenceIds]);
    }
  }

  for (const contradiction of analysis.contradictions) {
    const values = contradiction.candidates.map((candidate) => String(candidate.value));
    const evidenceIds = [...new Set(contradiction.candidates.flatMap((candidate) => candidate.evidence.map((ref) => ref.source_id)))];
    addUnknown(result, `conflict_${normalize(contradiction.field)}`, `Evidence gives different ${normalize(contradiction.field).replaceAll("_", " ")} details: ${values.join(" / ")}. Compare both source records.`, evidenceIds);
  }
  for (const unknown of analysis.unknowns) {
    const key = normalize(unknown.field);
    if (result[key as keyof Deal] === undefined) addUnknown(result, key, unknown.text, unknown.evidence.map(({ source_id }) => source_id));
  }
  return result;
}

function addConflict(deal: Deal, field: string, observation: CandidateObservation, evidenceIds: string[]) {
  addUnknown(deal, `conflict_${field}`, `Evidence gives different ${field.replaceAll("_", " ")} details: ${String(observation.value)}. Compare both source records.`, evidenceIds);
}

function addUnknown(deal: Deal, key: string, value: string, evidenceIds: string[]) {
  if (deal.unknowns.some((item) => item.key === key && item.evidenceIds.join("|") === evidenceIds.join("|"))) return;
  deal.unknowns.push({ key, value, kind: "unknown", evidenceIds: [...new Set(evidenceIds)] });
}

function normalize(field: string) { return field.trim().toLocaleLowerCase().replaceAll(" ", "_").replaceAll("-", "_"); }
