import assert from "node:assert/strict";
import test from "node:test";
import { extractWithModel } from "../domain/deal-extraction";
import { recordedModelExtraction } from "../domain/recorded-extraction";
import { GeminiDealModelAdapter } from "./gemini-deal-model";

test("Gemini adapter requests private, tool-free structured output and validates the recorded response", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.PPDC_GEMINI_MODEL;
  process.env.GEMINI_API_KEY = "test-key-not-a-real-credential";
  process.env.PPDC_GEMINI_MODEL = "gemini-3.1-flash-lite";
  let requestBody: Record<string, unknown> | undefined;
  try {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(String(input), "https://generativelanguage.googleapis.com/v1beta/interactions");
      assert.equal(new Headers(init?.headers).get("x-goog-api-key"), "test-key-not-a-real-credential");
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({
        object: "interaction",
        status: "completed",
        steps: [{ type: "model_output", content: [{ type: "text", text: JSON.stringify(recordedModelExtraction) }] }],
      });
    }) as typeof fetch;

    const text = "For sale: Fender Player Telecaster. Used, good condition. Price GBP 450. Bank transfer only. Tracked postage included, dispatches in 2 days. Seller says includes original hard case. Serial number not shown.";
    const extraction = await extractWithModel(new GeminiDealModelAdapter(), text);
    assert.equal(extraction.paymentMethod, "Bank transfer only");
    assert.equal(requestBody?.model, "gemini-3.1-flash-lite");
    assert.equal(requestBody?.store, false);
    assert.equal("tools" in (requestBody ?? {}), false);
    assert.equal((requestBody?.response_format as { mime_type: string }).mime_type, "application/json");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.PPDC_GEMINI_MODEL;
    else process.env.PPDC_GEMINI_MODEL = originalModel;
  }
});
