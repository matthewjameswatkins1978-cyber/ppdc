import "server-only";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ResearchProvider, ResearchResult } from "@/domain/research";

export interface ResearchCacheEntry {
  provider: ResearchProvider;
  safeQuery: string;
  retrievedAt: string;
  results: ResearchResult[];
  error?: string;
}

export interface ResearchCache {
  get(key: string): Promise<ResearchCacheEntry | undefined>;
  save(key: string, entry: ResearchCacheEntry): Promise<void>;
}

export function researchCacheKey(provider: ResearchProvider, safeQuery: string): string {
  return createHash("sha256").update(["ppdc-research-v1", provider, safeQuery.toLocaleLowerCase().replace(/\s+/g, " ").trim()].join("\0")).digest("hex");
}

const STORE_PATH = join(process.cwd(), ".cache", "phase2", "payments.sqlite");

/** Stores only normalized public results; no Deal snapshot, credentials, headers, or raw provider payloads. */
export function createSqliteResearchCache(filename: string = STORE_PATH): ResearchCache & { close(): void } {
  mkdirSync(dirname(filename), { recursive: true });
  const database = new DatabaseSync(filename);
  database.exec("PRAGMA busy_timeout = 5000;");
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("CREATE TABLE IF NOT EXISTS research_cache (cache_key TEXT PRIMARY KEY, entry_json TEXT NOT NULL);");
  return {
    async get(key) {
      const row = database.prepare("SELECT entry_json FROM research_cache WHERE cache_key = ?").get(key) as { entry_json: string } | undefined;
      if (!row) return undefined;
      try { return JSON.parse(row.entry_json) as ResearchCacheEntry; } catch { return undefined; }
    },
    async save(key, entry) {
      database.prepare(`INSERT INTO research_cache (cache_key, entry_json) VALUES (?, ?)
        ON CONFLICT(cache_key) DO UPDATE SET entry_json = excluded.entry_json`).run(key, JSON.stringify(entry));
    },
    close() { database.close(); },
  };
}

export const sqliteResearchCache = createSqliteResearchCache();