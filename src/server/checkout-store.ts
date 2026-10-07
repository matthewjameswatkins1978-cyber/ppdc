import "server-only";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Deal } from "@/domain/deal";
import type { PaymentState } from "@/domain/payment-state";
import type { ProtectionPassport } from "@/domain/protection-passport";

export interface CheckoutRecord {
  dealId: string;
  deal: Deal;
  payment: PaymentState;
  createRequestId: string;
  captureRequestId: string;
  approvalUrl?: string;
  cancelledAt?: string;
  passport?: ProtectionPassport;
}

export interface CheckoutStore {
  get(dealId: string): Promise<CheckoutRecord | undefined>;
  findByOrderId(orderId: string): Promise<CheckoutRecord | undefined>;
  save(record: CheckoutRecord): Promise<void>;
}

const STORE_PATH = join(process.cwd(), ".cache", "phase2", "payments.sqlite");

/** Small SQLite store keeps payment snapshots atomic across concurrent app requests and restarts. */
export function createSqliteCheckoutStore(filename: string = STORE_PATH): CheckoutStore & { close(): void } {
  mkdirSync(dirname(filename), { recursive: true });
  const database = new DatabaseSync(filename);
  database.exec("PRAGMA busy_timeout = 5000;");
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("CREATE TABLE IF NOT EXISTS checkout_records (deal_id TEXT PRIMARY KEY, paypal_order_id TEXT, record_json TEXT NOT NULL);");
  database.exec("CREATE INDEX IF NOT EXISTS checkout_order_id ON checkout_records(paypal_order_id);");

  return {
    async get(dealId) {
      const row = database.prepare("SELECT record_json FROM checkout_records WHERE deal_id = ?").get(dealId) as { record_json: string } | undefined;
      return row ? JSON.parse(row.record_json) as CheckoutRecord : undefined;
    },
    async findByOrderId(orderId) {
      const row = database.prepare("SELECT record_json FROM checkout_records WHERE paypal_order_id = ?").get(orderId) as { record_json: string } | undefined;
      return row ? JSON.parse(row.record_json) as CheckoutRecord : undefined;
    },
    async save(record) {
      database.prepare(`INSERT INTO checkout_records (deal_id, paypal_order_id, record_json)
        VALUES (?, ?, ?)
        ON CONFLICT(deal_id) DO UPDATE SET paypal_order_id = excluded.paypal_order_id, record_json = excluded.record_json`)
        .run(record.dealId, record.payment.paypalOrderId ?? null, JSON.stringify(record));
    },
    close() { database.close(); },
  };
}

/** Delay filesystem work until a request uses the store; Next.js imports route modules during builds. */
export function createLazyCheckoutStore(createStore: () => CheckoutStore & { close(): void }): CheckoutStore & { close(): void } {
  let store: (CheckoutStore & { close(): void }) | undefined;
  const getStore = () => store ??= createStore();
  return {
    get: (dealId) => getStore().get(dealId),
    findByOrderId: (orderId) => getStore().findByOrderId(orderId),
    save: (record) => getStore().save(record),
    close: () => store?.close(),
  };
}

export const sqliteCheckoutStore = createLazyCheckoutStore(createSqliteCheckoutStore);
