import assert from "node:assert/strict";
import test from "node:test";
import { productReferenceQuery, publicContextQuery } from "./research-query";

test("product research builds a compact query and removes obvious contact details", () => {
  const query = productReferenceQuery({ product: "Fender Player Telecaster", model: "2024", condition: "Used; email me at seller@example.com or call 07123 456789", locale: "UK" });
  assert.equal(query.purpose, "product_reference");
  assert.doesNotMatch(query.query, /seller@example|07123/);
  assert.match(query.query, /Fender Player Telecaster/);
});

test("public context uses only the public host and rejects non-web URLs", () => {
  assert.equal(publicContextQuery({ publicUrl: "https://example.com/private/path?token=secret", question: "check published return policy" }).query, "example.com check published return policy");
  assert.throws(() => publicContextQuery({ publicUrl: "javascript:alert(1)", question: "check it" }), /HTTP or HTTPS/);
});
