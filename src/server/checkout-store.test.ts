import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { dealFixtures } from "@/domain/fixtures";
import { createSqliteCheckoutStore } from "./checkout-store";

test("SQLite checkout records survive reopening and can be found by PayPal order ID", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ppdc-checkout-"));
  const filename = join(directory, "payments.sqlite");
  try {
    const first = createSqliteCheckoutStore(filename);
    const deal = structuredClone(dealFixtures[0]);
    deal.id = "sqlite-persistence-test";
    const record = {
      dealId: deal.id,
      deal,
      payment: { status: "PAYPAL_CREATED" as const, paypalOrderId: "ORDER-PERSISTED" },
      createRequestId: "create-key",
      captureRequestId: "capture-key",
    };
    await first.save(record);
    first.close();

    const reopened = createSqliteCheckoutStore(filename);
    assert.deepEqual(await reopened.get(deal.id), record);
    assert.deepEqual(await reopened.findByOrderId("ORDER-PERSISTED"), record);
    assert.equal(await reopened.findByOrderId("UNKNOWN-ORDER"), undefined);
    reopened.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
