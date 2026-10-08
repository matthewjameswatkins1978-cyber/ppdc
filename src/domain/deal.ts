import type { ResearchResult, ResearchRun } from "./research";

export type EvidenceSource = "user" | "paypal" | "channel3" | "parallel" | "carrier";
export type AssertionKind = "fact" | "paypal_rule" | "inference" | "unknown";
export type FindingSeverity = "green" | "amber" | "red";

export type DealSourceField = "title" | "item_specifics" | "description" | "seller_notes" | "payment_terms" | "delivery_terms" | "follow_up" | "plain_text" | "ocr";
export type CandidateSubject = "main_item" | "accessory" | "payment" | "delivery" | "checkout" | "other";
export type CandidatePolarity = "affirmed" | "negated";
export type CandidateModality = "asserted" | "conditional" | "uncertain";
export type CandidateTemporalStatus = "current" | "historical" | "corrected";
export type CandidateIntent = "requested" | "mentioned" | "rejected" | "conditional" | "accepted";

/** Original source text is retained per field; candidate offsets are relative to it. */
export interface DealSourceSegment {
  sourceId: string;
  fieldType: DealSourceField;
  originalText: string;
  order: number;
}

/** Proposed extraction only. It is source-bound and never grants payment authority. */
export interface DealCandidate {
  factType: "item" | "model" | "price" | "currency" | "condition" | "payment_method" | "delivery" | "claim" | "unknown";
  subject: CandidateSubject;
  value: string | number;
  sourceId: string;
  quote: string;
  startOffset: number;
  endOffset: number;
  polarity: CandidatePolarity;
  modality: CandidateModality;
  temporalStatus: CandidateTemporalStatus;
  intent?: CandidateIntent;
}
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
  sourceField?: DealSourceField;
  startOffset?: number;
  endOffset?: number;
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
  sourceSegments?: DealSourceSegment[];
  candidates?: DealCandidate[];
  findings: Finding[];
  conclusion?: string;
  researchRuns?: ResearchRun[];
  researchResults?: ResearchResult[];
  researchQuestions?: string[];
}
