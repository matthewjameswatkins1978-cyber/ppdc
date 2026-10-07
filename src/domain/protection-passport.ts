import type { Deal, EvidenceReference, Finding } from "./deal";
import type { ResearchResult, ResearchRun } from "./research";

export interface ProtectionPassport {
  id: string;
  dealId: string;
  paypalOrderId: string;
  createdAt: string;
  item?: string;
  model?: string;
  price: number;
  currency: string;
  statedCondition?: string;
  /** Seller-declared payment method from Deal evidence; distinct from the verified transaction route. */
  statedPaymentMethod?: string;
  deliveryTerms?: string;
  paymentRoute: "PayPal Sandbox";
  materialPromises: string[];
  evidenceReferences: EvidenceReference[];
  findings: Finding[];
  unresolvedUnknowns: string[];
  conclusion?: string;
  researchRuns?: ResearchRun[];
  researchResults?: ResearchResult[];
}

/** Build a point-in-time record after the server verifies a completed PayPal capture. */
export function createProtectionPassport(input: {
  id: string;
  deal: Deal;
  paypalOrderId: string;
  createdAt: string;
}): ProtectionPassport {
  const { deal } = input;
  if (!deal.price || !deal.currency) throw new Error("A passport requires an agreed price and currency.");
  return {
    id: input.id,
    dealId: deal.id,
    paypalOrderId: input.paypalOrderId,
    createdAt: input.createdAt,
    ...(deal.item ? { item: deal.item.value } : {}),
    ...(deal.model ? { model: deal.model.value } : {}),
    price: deal.price.value,
    currency: deal.currency.value,
    ...(deal.condition ? { statedCondition: deal.condition.value } : {}),
    ...(deal.paymentMethod ? { statedPaymentMethod: deal.paymentMethod.value } : {}),
    ...(deal.deliveryTerms ? { deliveryTerms: deal.deliveryTerms.value } : {}),
    paymentRoute: "PayPal Sandbox",
    materialPromises: deal.materialPromises.map((fact) => fact.value),
    evidenceReferences: structuredClone(deal.evidenceRefs ?? []),
    findings: structuredClone(deal.findings),
    unresolvedUnknowns: deal.unknowns.map((fact) => fact.value),
    ...(deal.conclusion ? { conclusion: deal.conclusion } : {}),
    researchRuns: structuredClone(deal.researchRuns ?? []),
    researchResults: structuredClone(deal.researchResults ?? []),
  };
}
