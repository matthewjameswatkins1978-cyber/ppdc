import assert from "node:assert/strict";
import test from "node:test";
import { buildPriorEvidenceSources, POST } from "./route";
import { configuredAstropodsAnalysis } from "@/server/astropods-analysis";

const configKeys = ["PPDC_ASTROPODS_ENABLED", "PPDC_ASTROPODS_MODE", "PPDC_ASTROPODS_BASE_URL", "PPDC_ASTROPODS_BEARER_TOKEN", "PPDC_ASTROPODS_DEPLOYMENT_ID"] as const;
const original = Object.fromEntries(configKeys.map((key) => [key, process.env[key]]));

test("Astropods consent is per request and configuration errors fall back to deterministic assessment", async () => {
  process.env.PPDC_ASTROPODS_ENABLED = "true";
  process.env.PPDC_ASTROPODS_MODE = "invalid-mode";
  const makeRequest = async (consent: boolean) => {
    const form = new FormData();
    form.set("text", "Used guitar, £275. PayPal Friends and Family requested.");
    form.set("aiConsent", String(consent));
    return POST(new Request("http://localhost:3000/api/deals", { method: "POST", body: form }));
  };
  try {
    const withoutConsent = await makeRequest(false);
    const localResult = await withoutConsent.json();
    assert.equal(withoutConsent.status, 200);
    assert.equal(localResult.deal.aiAnalysis, undefined);
    assert.equal(localResult.aiAnalysisNotice, undefined);
    assert.equal(localResult.deal.findings.find((finding: { category: string }) => finding.category === "payment")?.severity, "red");

    const withConsent = await makeRequest(true);
    const fallback = await withConsent.json();
    assert.equal(withConsent.status, 200);
    assert.equal(fallback.deal.aiAnalysis, undefined);
    assert.match(fallback.aiAnalysisNotice, /configuration is invalid.*assessed locally/i);
    assert.equal(fallback.deal.findings.find((finding: { category: string }) => finding.category === "payment")?.severity, "red");
  } finally {
    for (const key of configKeys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});

test("prior evidence context keeps order, timestamps, speakers, exact excerpts, and rejects unbounded or malformed history", () => {
  const history = {
    evidence: [
      { id: "earlier", source: "user", label: "Seller message", capturedAt: "2026-10-07T10:00:00.000Z", private: true, speaker: "seller" },
      { id: "later", source: "user", label: "Buyer note", capturedAt: "2026-10-07T11:00:00.000Z", private: true, speaker: "buyer" },
      { id: "public", source: "parallel", label: "Public result", capturedAt: "2026-10-07T11:30:00.000Z", private: false },
    ],
    evidenceRefs: [
      { evidenceId: "earlier", field: "condition", quote: "The headstock was repaired." },
      { evidenceId: "later", field: "repair", quote: "I can see the repair in this photo." },
    ],
  };
  const result = buildPriorEvidenceSources(history);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.sources.map(({ source_id }) => source_id), ["earlier", "later"]);
  assert.deepEqual(result.sources.map(({ speaker }) => speaker), ["seller", "buyer"]);
  assert.equal(result.sources[0]?.timestamp_basis, "client_reported");
  assert.equal(result.sources[0]?.text, "The headstock was repaired.");
  const invalid = buildPriorEvidenceSources({ ...history, evidenceRefs: [] });
  assert.ok(invalid.error);
  const oversized = buildPriorEvidenceSources({ evidence: [history.evidence[0]], evidenceRefs: [{ evidenceId: "earlier", quote: "x".repeat(4_001) }] });
  assert.ok(oversized.error);
});

test("Astropods stays unavailable in production until public access controls are implemented", () => {
  const keys = ["NODE_ENV", "PPDC_ASTROPODS_ENABLED", "PPDC_ASTROPODS_MODE", "PPDC_ASTROPODS_DEPLOYMENT_ID", "PPDC_ASTROPODS_BEARER_TOKEN"] as const;
  const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    Reflect.set(process.env, "NODE_ENV", "production");
    process.env.PPDC_ASTROPODS_ENABLED = "true";
    process.env.PPDC_ASTROPODS_MODE = "hosted";
    process.env.PPDC_ASTROPODS_DEPLOYMENT_ID = "synthetic";
    process.env.PPDC_ASTROPODS_BEARER_TOKEN = "test-only";
    assert.equal(configuredAstropodsAnalysis(), undefined);
  } finally {
    for (const key of keys) before[key] === undefined ? Reflect.deleteProperty(process.env, key) : Reflect.set(process.env, key, before[key]);
  }
});
