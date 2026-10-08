import assert from "node:assert/strict";
import test from "node:test";
import { extractDealFromIntake, extractDealFromText } from "./extract-text";
import { addEvidenceToDeal, assessDeal } from "./assessment";
import { questionsFor } from "./presentation";

const one = (field: Parameters<typeof extractDealFromIntake>[0]["segments"][number]["field"], text: string, id: string = field, order = 0) => ({ id, field, text, order });

test("source-aware intake preserves original fields and exact candidate offsets", () => {
  const intake = { dealId: "source-aware", segments: [one("title", "Nori Vela X7 countertop grinder", "title-1", 0), one("payment_terms", "PayPal Goods & Services accepted", "payment-2", 1), one("follow_up", "Actually, bank transfer only", "follow-up-3", 2)] } as const;
  const deal = extractDealFromIntake(intake);
  assert.deepEqual(deal.sourceSegments?.map(({ sourceId, fieldType, originalText, order }) => ({ sourceId, fieldType, originalText, order })), [
    { sourceId: "title-1", fieldType: "title", originalText: "Nori Vela X7 countertop grinder", order: 0 },
    { sourceId: "payment-2", fieldType: "payment_terms", originalText: "PayPal Goods & Services accepted", order: 1 },
    { sourceId: "follow-up-3", fieldType: "follow_up", originalText: "Actually, bank transfer only", order: 2 },
  ]);
  for (const candidate of deal.candidates ?? []) {
    const source = intake.segments.find(({ id }) => id === candidate.sourceId);
    assert.ok(source, `candidate source ${candidate.sourceId} exists`);
    assert.equal(source!.text.slice(candidate.startOffset, candidate.endOffset), candidate.quote);
  }
  assert.ok(deal.candidates?.some(({ factType, sourceId }) => factType === "payment_method" && sourceId === "payment-2"));
  assert.ok(deal.candidates?.some(({ factType, temporalStatus, sourceId }) => factType === "payment_method" && temporalStatus === "corrected" && sourceId === "follow-up-3"));
});

test("polarity is local to the right subject and delivery/payment assertion", () => {
  const deal = extractDealFromIntake({ dealId: "polarity", segments: [one("payment_terms", "Bank transfer accepted. No cash accepted.", "payment"), one("delivery_terms", "Shipping included. No collection.", "delivery"), one("description", "The item is not broken. The console is not working, but the checkout is not working.", "description"), one("seller_notes", "Item not tested; a separate item was tested and working.", "seller-notes")] });
  const candidates = deal.candidates ?? [];
  const candidate = (factType: string, subject: string, phrase: string) => candidates.find((entry) => entry.factType === factType && entry.subject === subject && entry.quote.toLowerCase().includes(phrase));
  assert.equal(candidate("payment_method", "payment", "bank transfer")?.polarity, "affirmed");
  const contrasts = extractDealFromIntake({ dealId: "contrast-polarity", segments: [one("payment_terms", "  nO   bAnK transfer; CASH accepted.", "contrast-payment"), one("delivery_terms", "No shipping. Collection available.", "contrast-delivery")] });
  assert.ok(contrasts.candidates?.some(({ factType, subject, polarity }) => factType === "payment_method" && subject === "payment" && polarity === "negated"));
  assert.ok(contrasts.candidates?.some(({ factType, subject, polarity }) => factType === "payment_method" && subject === "payment" && polarity === "affirmed"));
  assert.ok(contrasts.candidates?.some(({ factType, subject, polarity }) => factType === "delivery" && subject === "delivery" && polarity === "negated"));
  const deliveryAssessment = assessDeal(contrasts);
  assert.ok(deliveryAssessment.findings.some(({ ruleId }) => ruleId === "delivery-unavailable"));
  assert.ok(questionsFor(deliveryAssessment).some((question) => /collection|delivery option/i.test(question)));
  const negatedFault = extractDealFromIntake({ dealId: "not-because", segments: [one("description", "The item works, not because it is broken.", "negated-fault")] });
  assert.ok(negatedFault.candidates?.some(({ factType, value, polarity }) => factType === "condition" && value === "broken" && polarity === "negated"));
  const ocr = extractDealFromText("OCR listing £10", "ocr-source-test", "OCR screenshot", "ocr-source", "ocr");
  assert.equal(ocr.sourceSegments?.[0]?.fieldType, "ocr");
  assert.equal(candidate("payment_method", "payment", "cash")?.polarity, "negated");
  assert.equal(candidate("delivery", "delivery", "shipping included")?.polarity, "affirmed");
  assert.equal(candidate("delivery", "delivery", "collection")?.polarity, "negated");
  assert.equal(candidate("condition", "main_item", "broken")?.polarity, "negated");
  assert.equal(candidate("condition", "main_item", "not working")?.polarity, "affirmed");
  assert.equal(candidate("condition", "checkout", "not working")?.value, "not working");
  assert.doesNotMatch(deal.condition?.value ?? "", /checkout/i);
  assert.equal(candidate("condition", "main_item", "not tested")?.modality, "uncertain");
  assert.equal(candidate("condition", "main_item", "tested")?.polarity, "affirmed");
});

test("Friends and Family interpretation distinguishes request, mention, rejection, conditions and corrections", () => {
  const cases = [["PayPal Friends & Family requested", true], ["Friends & Family is merely mentioned in the help text", false], ["No Friends & Family needed", false], ["Friends & Family if posted; cash on collection", true], ["Friends & Family requested, later corrected: Goods & Services only", false], ["No cash pickup; PayPal Goods & Services accepted", false]] as const;
  for (const [text, shouldFlag] of cases) {
    const deal = assessDeal(extractDealFromIntake({ dealId: text, segments: [one("payment_terms", text)] }));
    assert.equal(deal.findings.some(({ ruleId }) => ruleId === "friends-family-purchase"), shouldFlag, text);
    assert.ok((deal.candidates ?? []).some(({ factType }) => factType === "payment_method"), text);
  }
});

test("F&F protection claim is explained with a current UK source and neutral wording", () => {
  const deal = assessDeal(extractDealFromIntake({ dealId: "false-protection-claim", segments: [one("payment_terms", "Seller says Friends & Family has full Buyer Protection; please pay that way.", "payment-claim")] }));
  const finding = deal.findings.find(({ ruleId }) => ruleId === "friends-family-purchase");
  assert.ok(finding);
  assert.match(finding!.explanation, /Friends & Family payments are not eligible for PayPal Buyer Protection/i);
  assert.match(finding!.explanation, /https:\/\/www\.paypal\.com\/uk\/legalhub\/paypal\/useragreement-full/);
  assert.doesNotMatch(finding!.recommendedAction ?? "", /do not pay|do not use|refuse/i);
  assert.ok(finding!.evidenceIds.includes("payment-claim"));
  assert.ok(questionsFor(deal).length <= 4);
});

test("source attribution never borrows a quote from another advert field", () => {
  const deal = extractDealFromIntake({ dealId: "field-boundary", segments: [one("title", "Friends & Family console bundle", "title"), one("payment_terms", "No Friends & Family needed; Goods & Services accepted", "payment")] });
  const fAndF = (deal.candidates ?? []).filter(({ factType, value }) => factType === "payment_method" && /friends/i.test(String(value)));
  assert.ok(fAndF.length > 0);
  assert.ok(fAndF.some(({ sourceId, intent }) => sourceId === "payment" && intent === "rejected"));
  assert.ok(fAndF.some(({ sourceId, intent }) => sourceId === "title" && intent === "mentioned"));
  assert.ok(!deal.findings.some(({ ruleId }) => ruleId === "friends-family-purchase"));
});

test("assessment remains stable when re-run on a structured multi-source intake", () => {
  const deal = assessDeal(extractDealFromIntake({ dealId: "repeat", segments: [one("payment_terms", "Friends & Family only", "payment", 0), one("follow_up", "Correction: Goods & Services only", "follow-up", 1)] }));
  const again = assessDeal(deal);
  assert.deepEqual(again.findings, deal.findings);
  assert.equal(again.conclusion, deal.conclusion);
  assert.deepEqual(questionsFor(again), questionsFor(deal));
  const earlier = assessDeal(extractDealFromIntake({ dealId: "add-evidence", segments: [one("payment_terms", "Friends & Family only", "old-payment", 0)] }));
  const correction = extractDealFromIntake({ dealId: "add-evidence", segments: [one("follow_up", "Correction: PayPal Goods & Services only", "new-payment", 0)] });
  const updated = addEvidenceToDeal(earlier, correction);
  assert.ok(updated.candidates?.some(({ sourceId, temporalStatus }) => sourceId === "old-payment" && temporalStatus === "historical"));
  assert.ok(!updated.findings.some(({ ruleId }) => ruleId === "friends-family-purchase"));
  assert.match(updated.paymentMethod?.value ?? "", /Goods & Services/i);
  assert.ok(!updated.unknowns.some(({ key }) => key === "conflict_payment method"));
  assert.deepEqual(assessDeal(updated).findings, updated.findings);
});