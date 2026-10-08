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

test("004A-R1 keeps source references bound through multi-source evidence merges", () => {
  const base = extractDealFromIntake({ dealId: "provenance-merge", segments: [
    one("title", "Nintendo Switch OLED; Nintendo Switch OLED", "title-source"),
    one("seller_notes", "Nintendo Switch OLED; charger faulty", "notes-source"),
    one("payment_terms", "Friends & Family requested", "payment-source"),
  ] });
  const addition = extractDealFromIntake({ dealId: "provenance-merge", segments: [
    one("follow_up", "Correction: Goods & Services only", "correction-source"),
    one("delivery_terms", "Courier available; return postage is buyer paid", "delivery-source"),
    one("ocr", "Nintendo Switch OLED", "ocr-source"),
  ] });
  const merged = addEvidenceToDeal(base, addition);
  assert.deepEqual(merged.sourceSegments?.map(({ sourceId }) => sourceId), ["title-source", "notes-source", "payment-source", "correction-source", "delivery-source", "ocr-source"]);
  for (const ref of merged.evidenceRefs ?? []) {
    const source: { sourceId: string; fieldType: string; originalText: string; order: number } | undefined = merged.sourceSegments?.find(({ sourceId }) => sourceId === ref.evidenceId);
    assert.ok(source, `reference source exists: ${ref.evidenceId}`);
    assert.ok(ref.startOffset !== undefined && ref.endOffset !== undefined, `reference offsets exist: ${ref.field}`);
    assert.equal(source!.originalText.slice(ref.startOffset, ref.endOffset), ref.quote);
  }
  assert.ok(merged.evidenceRefs?.some((ref) => ref.evidenceId === "ocr-source" && ref.quote === "Nintendo Switch OLED"));
  assert.ok(merged.evidenceRefs?.some((ref) => ref.evidenceId === "title-source" && ref.quote === "Nintendo Switch OLED"));
  assert.ok(merged.candidates?.some(({ sourceId, temporalStatus }) => sourceId === "payment-source" && temporalStatus === "historical"));
  const invalidAddition = structuredClone(addition);
  invalidAddition.evidenceRefs?.push({ field: "item", evidenceId: "ocr-source", sourceField: "title", quote: "Nintendo Switch OLED", startOffset: 0, endOffset: 19 });
  invalidAddition.evidenceRefs?.push({ field: "item", evidenceId: "missing-source", quote: "Nintendo Switch OLED", startOffset: 0, endOffset: 19 });
  const validated = addEvidenceToDeal(base, invalidAddition);
  assert.ok(!validated.evidenceRefs?.some(({ evidenceId }) => evidenceId === "missing-source"));
  assert.ok(!validated.evidenceRefs?.some(({ evidenceId, sourceField }) => evidenceId === "ocr-source" && sourceField === "title"));
  assert.throws(() => addEvidenceToDeal(base, base), /Duplicate or invalid source ID/);
  const legacy = structuredClone(base);
  delete legacy.sourceSegments;
  legacy.evidenceRefs = legacy.evidenceRefs?.map(({ sourceField, startOffset, endOffset, ...reference }) => reference);
  const withLegacy = addEvidenceToDeal(legacy, addition);
  assert.ok(withLegacy.evidenceRefs?.some(({ evidenceId, startOffset }) => evidenceId === "title-source" && startOffset === undefined));
  assert.deepEqual(assessDeal(merged).findings, merged.findings);
});

test("004A-R1 scopes payment negation, intent, and corrections to each method", () => {
  const cases: Array<[string, boolean, RegExp[]]> = [
    ["I don't accept bank transfer; use Friends & Family.", true, [/bank transfer/i, /friends/i]],
    ["No cash or Friends & Family; Goods & Services only.", false, [/cash/i, /friends/i, /goods/i]],
    ["PayPal guidance says Friends & Family isn't covered. Seller accepts Goods & Services.", false, [/guidance/i, /accepts/i]],
    ["Friends & Family requested, correction: postage is £5.", true, [/friends/i]],
    ["Friends & Family requested. Correction: Goods & Services only.", false, [/goods/i]],
    ["Friends & Family if posted; cash on collection.", true, [/friends/i, /cash/i]],
    ["Friends & Family was previously suggested, but the seller now accepts Goods & Services only.", false, [/friends/i, /goods/i]],
    ["No Friends & Family needed.", false, [/friends/i]],
    ["Seller mentions Friends & Family as an example, but accepts Goods & Services.", false, [/example/i, /accepts/i]],
  ];
  for (const [text, shouldFlag, expected] of cases) {
    const deal = assessDeal(extractDealFromIntake({ dealId: text, segments: [one("payment_terms", text)] }));
    assert.equal(deal.findings.some(({ ruleId }) => ruleId === "friends-family-purchase"), shouldFlag, text);
    for (const matcher of expected) assert.ok((deal.candidates ?? []).some(({ factType, quote }) => factType === "payment_method" && matcher.test(quote)), `${text}: candidate ${matcher}`);
  }
  const deliveryMention = extractDealFromIntake({ dealId: "delivery-payment-mention", segments: [one("delivery_terms", "£12 postage if bank transfer.")] });
  assert.equal(deliveryMention.paymentMethod, undefined);
  assert.ok(deliveryMention.candidates?.some(({ factType, intent }) => factType === "payment_method" && intent === "mentioned"));
  const unrelatedCorrection = assessDeal(extractDealFromIntake({ dealId: "unrelated-correction", segments: [one("payment_terms", "Friends & Family requested, correction: postage is £5.")] }));
  assert.ok(unrelatedCorrection.findings.some(({ ruleId }) => ruleId === "friends-family-purchase"));
  assert.ok(unrelatedCorrection.candidates?.some(({ value, temporalStatus }) => /friends/i.test(String(value)) && temporalStatus === "current"));
});

test("004A-R1 projects condition polarity and subject into buyer-facing facts", () => {
  const cases: Array<[string, boolean, string | undefined]> = [
    ["The item is broken.", true, "broken"],
    ["The item is not broken.", false, "not broken"],
    ["The item works, not because it is broken.", false, "not because it is broken"],
    ["The item is faulty.", true, "faulty"],
    ["The item is not faulty.", false, "not faulty"],
    ["There is no damage.", false, "no damage"],
    ["The item is not working.", true, "not working"],
    ["The item was not tested.", true, "not tested"],
    ["The item was tested and is working.", false, "tested and is working"],
    ["The checkout is not working.", false, undefined],
    ["The charger is faulty, but the main item works.", true, "charger is faulty"],
  ];
  for (const [text, shouldConcern, visiblePhrase] of cases) {
    const deal = assessDeal(extractDealFromIntake({ dealId: text, segments: [one("description", text)] }));
    const conditionFinding = deal.findings.find(({ category }) => category === "condition");
    if (text.startsWith("The checkout")) assert.notEqual(conditionFinding?.ruleId, "condition-disclosed-faults", text);
    else if (shouldConcern) assert.equal(conditionFinding?.severity, "amber", text);
    else if (!text.startsWith("The checkout")) assert.notEqual(conditionFinding?.severity, "amber", text);
    if (visiblePhrase) assert.match(deal.condition?.value ?? "", new RegExp(visiblePhrase.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"), text);
    if (/not broken|not faulty|no damage|not because/i.test(text)) assert.doesNotMatch(conditionFinding?.explanation ?? "", /describes:.*(?:broken|faulty|damage)/i, text);
    assert.ok(questionsFor(deal).length <= 4, text);
  }
  const accessory = assessDeal(extractDealFromIntake({ dealId: "accessory", segments: [one("description", "The charger is faulty, but the main item works.")] }));
  assert.ok(accessory.candidates?.some(({ factType, subject, value }) => factType === "condition" && subject === "accessory" && value === "faulty"));
  const repeated = extractDealFromIntake({ dealId: "repeated-condition", segments: [one("description", "The item is faulty, but the item is faulty.", "repeated")] });
  const repeatedCandidates = repeated.candidates?.filter(({ factType }) => factType === "condition") ?? [];
  assert.equal(repeatedCandidates.length, 2);
  for (const candidate of repeatedCandidates) assert.equal(repeated.sourceSegments?.[0]?.originalText.slice(candidate.startOffset, candidate.endOffset), candidate.quote);
});

test("004A-R1 keeps delivery and collection availability distinct", () => {
  const cases: Array<[string, string[], string[]]> = [
    ["Shipping included.", ["shipping"], []],
    ["No shipping.", [], ["shipping"]],
    ["Collection only; shipping unavailable.", ["collection"], ["shipping"]],
    ["No collection or pickup.", [], ["collection", "pickup"]],
    ["No shipping or collection.", [], ["shipping", "collection"]],
    ["Shipping and collection are both unavailable.", [], ["shipping", "collection"]],
    ["Courier available if buyer pays.", ["courier"], []],
    ["No cash pickup; courier available.", ["courier"], []],
    ["Return postage is paid by the buyer.", [], []],
  ];
  for (const [text, offered, unavailable] of cases) {
    const deal = assessDeal(extractDealFromIntake({ dealId: text, segments: [one("delivery_terms", text)] }));
    for (const option of offered) assert.ok(deal.candidates?.some(({ factType, quote, polarity }) => factType === "delivery" && quote.toLowerCase().includes(option) && polarity === "affirmed"), `${text}: ${option} offered`);
    for (const option of unavailable) assert.ok(deal.candidates?.some(({ factType, quote, polarity }) => factType === "delivery" && quote.toLowerCase().includes(option) && polarity === "negated"), `${text}: ${option} unavailable`);
    assert.ok(questionsFor(deal).length <= 4);
  }
});