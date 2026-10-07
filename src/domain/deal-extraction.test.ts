import assert from "node:assert/strict";
import test from "node:test";
import { extractWithModel, validateDealExtraction } from "./deal-extraction";
import { recordedCodexOcrResponse, recordedGeminiOcrExtraction, recordedGeminiOcrSource, recordedModelExtraction } from "./recorded-extraction";

const fictionalOcr = "For sale: Fender Player Telecaster, sunburst. Used, good condition. Price GBP 450. Bank transfer only. Tracked postage included, dispatches in 2 days. Seller says includes original hard case. Serial number not shown.";

test("accepts recorded structured model output with evidence grounded in OCR", async () => {
  let calls = 0;
  const extraction = await extractWithModel({
    provider: "recorded-fixture",
    async extract() { calls += 1; return recordedModelExtraction; },
  }, fictionalOcr);

  assert.equal(calls, 1);
  assert.equal(extraction.paymentMethod, "Bank transfer only");
  assert.equal(extraction.price, 450);
  assert.equal(extraction.evidenceRefs.length, 9);
});

test("rejects fabricated evidence and invalid fields", () => {
  assert.throws(() => validateDealExtraction({
    ...recordedModelExtraction,
    evidenceRefs: [...recordedModelExtraction.evidenceRefs, { field: "price", quote: "£1" }],
  }, fictionalOcr), /not present/);
  assert.throws(() => validateDealExtraction({ ...recordedModelExtraction, currency: "pounds" }, fictionalOcr));
});

test("rejects a recorded model inference that lacks a source quote", () => {
  const ocr = "For sale: Fender Player Telecaster. Used, good condition. Price GBP 450. Bank transfer only. Tracked postage included. Dispatches in 2 days. Seller says includes original hard case. Serial number not shown.";
  assert.throws(() => validateDealExtraction(recordedCodexOcrResponse, ocr), /item has a value without an evidence reference/);
});

test("accepts the sanitized live Gemini OCR fixture and retains its evidence-backed fields", () => {
  const result = validateDealExtraction(recordedGeminiOcrExtraction, recordedGeminiOcrSource);
  assert.equal(result.item, "Fender Player Telecaster");
  assert.equal(result.price, 450);
  assert.equal(result.currency, "GBP");
  assert.equal(result.evidenceRefs.length, 9);
  assert.throws(() => validateDealExtraction({
    ...recordedGeminiOcrExtraction,
    item: "guitar",
    evidenceRefs: recordedGeminiOcrExtraction.evidenceRefs.filter(({ field }) => field !== "item"),
  }, recordedGeminiOcrSource), /item has a value without an evidence reference/);
});
