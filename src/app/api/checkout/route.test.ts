import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "./route";

test("checkout API requires a same-origin browser action before it can contact PayPal", async () => {
  const response = await POST(new Request("http://localhost:3000/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deal: {}, actionId: "forged-cross-origin-action" }),
  }));
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /Deal Checker page/);
});
