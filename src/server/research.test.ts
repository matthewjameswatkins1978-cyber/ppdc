import assert from "node:assert/strict";
import test from "node:test";
import { productReferenceQuery, publicContextQuery } from "@/domain/research-query";
import { searchChannel3, searchParallel } from "./research";

test("Channel3 adapter normalizes current offer schema and strips tracking query strings", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.CHANNEL3_API_KEY;
  process.env.CHANNEL3_API_KEY = "test-channel3-key";
  let requestBody: Record<string, unknown> = {};
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({ products: [{ title: "Fender Player II Telecaster", offers: [{
      url: "https://buy.trychannel3.com/item?tracking=private", domain: "example.com",
      price: { price: 949.99, currency: "USD" }, condition: "new",
    }] }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const result = await searchChannel3(productReferenceQuery({ product: "Fender Player Telecaster", condition: "used", locale: "UK" }));
    assert.equal(result.results[0]?.price?.amount, 949.99);
    assert.equal(result.results[0]?.price?.currency, "USD");
    assert.equal(result.results[0]?.price?.condition, "new");
    assert.equal(result.results[0]?.url, undefined);
    assert.equal(result.results[0]?.merchant, "example.com");
    assert.equal(JSON.stringify(result).includes("tracking=private"), false);
    assert.deepEqual(Object.keys(requestBody).sort(), ["limit", "query"]);
    assert.match(String(requestBody.query), /UK/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.CHANNEL3_API_KEY; else process.env.CHANNEL3_API_KEY = originalKey;
  }
});

test("Parallel adapter stores normalized public titles and safe URLs only", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.PARALLEL_API_KEY;
  process.env.PARALLEL_API_KEY = "test-parallel-key";
  let requestBody: Record<string, unknown> = {};
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({ results: [{ title: "Official Nikon Z6 II specifications", url: "https://camera.example/specs?session=private", excerpts: ["unneeded excerpt"] }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const query = publicContextQuery({ publicUrl: "https://www.gov.uk/ignored/private/path", question: "Nikon Z6 II specifications", locale: "UK" });
    const result = await searchParallel(query);
    assert.equal(result.results[0]?.url, "https://camera.example/specs");
    assert.equal(JSON.stringify(result).includes("unneeded excerpt"), false);
    assert.equal(JSON.stringify(result).includes("session=private"), false);
    assert.equal(String(requestBody.objective).includes("private/path"), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.PARALLEL_API_KEY; else process.env.PARALLEL_API_KEY = originalKey;
  }
});
