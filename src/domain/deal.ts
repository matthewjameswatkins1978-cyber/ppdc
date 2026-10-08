import type { ResearchResult, ResearchRun } from "./research";

export type EvidenceSource = "user" | "paypal" | "channel3" | "parallel" | "carrier";
export type AssertionKind = "fact" | "paypal_rule" | "inference" | "unknown";
export type FindingSeverity = "green" | "amber" | "red";

export interface Evidence {
  id: string;
  source: EvidenceSource;
  sourceRef?: string;
  label: string;
  capturedAt: string;
  private: boolean;
}

export interface EvidenceReference {
  field: string;
  evidenceId: string;
  quote: string;
}

export interface DealFact<T = unknown> {
  key: string;
  value: T;
  kind: AssertionKind;
  evidenceIds: string[];
  confidence?: "high" | "medium" | "low";
}

export interface Finding {
  id: string;
  severity: FindingSeverity;
  category: string;
  title: string;
  explanation: string;
  whyItMatters?: string;
  recommendedAction?: string;
  evidenceIds: string[];
  ruleId?: string;
  kind: AssertionKind;
}

export interface Deal {
  id: string;
  status: "draft" | "assessing" | "ready_for_decision" | "paid";
  item?: DealFact<string>;
  model?: DealFact<string>;
  price?: DealFact<number>;
  currency?: DealFact<string>;
  priceDisplays?: { amount: number; currency: string; kind: "approximate_conversion"; evidenceId: string; quote: string }[];

  condition?: DealFact<string>;
  paymentMethod?: DealFact<string>;
  deliveryTerms?: DealFact<string>;
  materialPromises: DealFact<string>[];
  unknowns: DealFact<string>[];
  evidence: Evidence[];
  evidenceRefs?: EvidenceReference[];
  findings: Finding[];
  conclusion?: string;
  researchRuns?: ResearchRun[];
  researchResults?: ResearchResult[];
  researchQuestions?: string[];
}
