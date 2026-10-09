import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { extractDealFromIntake } from "../../../src/domain/extract-text.js";
import { assessDeal } from "../../../src/domain/assessment.js";
import { runExperiment, validateAdviserOutput, validateAuditorOutput, type ModelCall, type ModelRole } from "./pipeline.js";

const sources = [{ id: "pay", text: "Seller requests PayPal Friends & Family." }];
const deal = assessDeal(extractDealFromIntake({ dealId: "AI001-B", segments: [{ id: "pay", field: "payment_terms", text: sources[0]!.text }] }));
const ff = deal.candidates!.find((candidate) => candidate.factType === "payment_method" && candidate.intent === "requested")!;
const proposal = { factType: ff.factType, subject: ff.subject, value: ff.value, sourceId: ff.sourceId, quote: ff.quote, polarity: ff.polarity, temporalStatus: ff.temporalStatus, intent: ff.intent };

test("auditor proposal is accepted only when it exactly matches a source-bound PPDC candidate", () => {
  const good = validateAuditorOutput(JSON.stringify({ proposals: [proposal], uncertainties: [] }), deal.candidates!, sources);
  assert.equal(good.accepted.length, 1);
  const altered = validateAuditorOutput(JSON.stringify({ proposals: [{ ...proposal, value: "PayPal Goods & Services" }], uncertainties: [] }), deal.candidates!, sources);
  assert.equal(altered.accepted.length, 0);
  assert.equal(altered.rejected.length, 1);
});

test("separate role prompts run in order and adviser sees only PPDC-accepted proposals", async () => {
  const calls: { role: ModelRole; input: any }[] = [];
  const mock: ModelCall = async (role, _system, input) => {
    calls.push({ role, input });
    if (role === "evidence-auditor") return { content: JSON.stringify({ proposals: [proposal], uncertainties: [] }), usage: { inputTokens: 10, outputTokens: 5 } };
    assert.equal((input as any).auditorProposalsAcceptedByPPDC.length, 1);
    assert.equal((input as any).validatedDeterministicFacts.findings.some((f: any) => f.ruleId === "friends-family-purchase"), true);
    return { content: JSON.stringify({ summary: "The supplied payment terms mention Friends & Family, which is not eligible for PayPal Buyer Protection for purchases.", points: [{ text: "The seller's message requests Friends & Family for this item.", evidenceIds: ["pay"] }], questions: [{ text: "Would the seller accept Goods & Services for this purchase?", evidenceIds: ["pay", "PAYPAL-UK-FF-PURCHASE"] }], unresolved: [] }), usage: { inputTokens: 20, outputTokens: 8 } };
  };
  const input = JSON.stringify({ caseId: "AI001-B", segments: [{ id: "pay", field: "payment_terms", text: sources[0]!.text }] });
  const result = await runExperiment(input, mock);
  assert.deepEqual(calls.map(({ role }) => role), ["evidence-auditor", "deal-sense-adviser"]);
  assert.equal(calls[1]!.input.originalSources, undefined);
  assert.equal(result.deterministic.findings.some((f) => f.ruleId === "friends-family-purchase"), true);
  assert.equal(result.auditor.accepted.length, 1);
  assert.equal(result.adviser.usage?.outputTokens, 8);
});

test("malformed auditor output fails closed and cannot add facts to adviser input", async () => {
  let adviserAccepted = -1;
  const mock: ModelCall = async (role, _system, input) => {
    if (role === "evidence-auditor") return { content: JSON.stringify({ proposals: [{ ...proposal, quote: "made up" }], uncertainties: [], severity: "red" }) };
    adviserAccepted = (input as any).auditorProposalsAcceptedByPPDC.length;
    return { content: JSON.stringify({ summary: "The payment details are recorded.", points: [], questions: [], unresolved: [] }) };
  };
  await runExperiment(JSON.stringify({ caseId: "AI001-B", segments: [{ id: "pay", field: "payment_terms", text: sources[0]!.text }] }), mock);
  assert.equal(adviserAccepted, 0);
});

test("PPDC rejects adviser authority, trust claims, and unknown citations", () => {
  assert.throws(() => validateAdviserOutput(JSON.stringify({ summary: "You should buy this now.", points: [], questions: [], unresolved: [] }), new Set()), /validation/);
  assert.throws(() => validateAdviserOutput(JSON.stringify({ summary: "The item details are stated.", points: [{ text: "A claim.", evidenceIds: ["not-supplied"] }], questions: [], unresolved: [] }), new Set(["source"])), /cited evidence/);
});
test("five new synthetic cases exercise the requested boundaries without live model calls", async () => {
  const fixtures = JSON.parse(readFileSync(new URL("../synthetic-cases.json", import.meta.url), "utf8")) as any[];
  assert.deepEqual(fixtures.map((item) => item.caseId), ["AI001-A", "AI001-B", "AI001-C", "AI001-D", "AI001-E"]);
  const outputs = [];
  for (const fixture of fixtures) {
    const roles: ModelRole[] = [];
    const mock: ModelCall = async (role) => {
      roles.push(role);
      return role === "evidence-auditor"
        ? { content: JSON.stringify({ proposals: [], uncertainties: [] }) }
        : { content: JSON.stringify({ summary: "The supplied details are recorded; some points remain unconfirmed.", points: [], questions: [], unresolved: [] }) };
    };
    const { coverage, ...caseInput } = fixture;
    outputs.push(await runExperiment(JSON.stringify(caseInput), mock));
    assert.deepEqual(roles, ["evidence-auditor", "deal-sense-adviser"]);
  }
  assert.equal(outputs[0]!.deterministic.findings.some((finding) => finding.ruleId === "friends-family-purchase"), false);
  assert.equal(outputs[1]!.deterministic.findings.some((finding) => finding.ruleId === "friends-family-purchase"), true);
  assert.equal(outputs[2]!.deterministic.findings.some((finding) => finding.ruleId === "friends-family-purchase"), false);
  assert.ok(outputs[3]!.deterministic.deal.unknowns.some((unknown) => unknown.key.startsWith("conflict_")));
  assert.ok(outputs[4]!.deterministic.deal.unknowns.length > 0);
});