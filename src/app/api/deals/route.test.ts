import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "./route";

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