import assert from "node:assert/strict";
import test from "node:test";
import { dealFixtures } from "./fixtures";

test("the first five reusable fixtures cover core coherent, unclear, and protection states", () => {
  assert.equal(dealFixtures.length, 5);
  assert.deepEqual(dealFixtures.map(({ id }) => id), [
    "coherent-used-guitar",
    "cheap-damaged-guitar",
    "unexplained-low-price",
    "friends-family-request",
    "recipient-changed",
  ]);
  assert.ok(dealFixtures.every(({ evidence }) => evidence.length > 0));
  assert.ok(dealFixtures.every(({ evidence }) => evidence.every((item) => item.label.startsWith("Illustrative") || item.label.includes("Illustrative"))));
});
