import { Capacitor } from "@capacitor/core";
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from "@capacitor-community/sqlite";
import { defineCustomElements as defineJeepSqlite } from "jeep-sqlite/loader";

/**
 * Capacitor SQLite bootstrap. Same pattern used in `mean-streets`:
 *
 * - One DB connection per process, lazily opened, retried on failure.
 * - Web platform spins up a `<jeep-sqlite>` element that backs SQLite
 *   with IndexedDB; native uses the platform's sqlite3.
 * - Every write goes through `withDatabaseWriteLock` so concurrent
 *   callers serialise instead of stomping each other.
 *
 * Schema is one generic key-value table (`app_kv`). Each persistence
 * module (e.g. `seed-bundle.ts`) carves out its own namespace inside
 * that table — no per-module table proliferation.
 */

const DB_NAME = "bioluminescent_sea";
const DB_VERSION = 1;

const sqlite = new SQLiteConnection(CapacitorSQLite);
let connectionPromise: Promise<SQLiteDBConnection> | null = null;
let webReadyPromise: Promise<void> | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

const SCHEMA = `
CREATE TABLE IF NOT EXISTS app_kv (
  namespace TEXT NOT NULL,
  item_key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (namespace, item_key)
);
`;

export async function getDatabase(): Promise<SQLiteDBConnection> {
  if (!connectionPromise) {
    connectionPromise = initializeDatabase().catch((error) => {
      // Drop the rejected promise so the next caller retries instead
      // of awaiting a permanently-poisoned connection.
      connectionPromise = null;
      throw error;
    });
  }
  return connectionPromise;
}

async function initializeDatabase(): Promise<SQLiteDBConnection> {
  await prepareWebStore();
  await sqlite.checkConnectionsConsistency();
  const existing = await sqlite.isConnection(DB_NAME, false);
  const db = existing.result
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(
        DB_NAME,
        false,
        "no-encryption",
        DB_VERSION,
        false,
      );
  await db.open();
  await db.execute(SCHEMA);
  return db;
}

async function prepareWebStore(): Promise<void> {
  if (Capacitor.getPlatform() !== "web") return;
  if (webReadyPromise) return webReadyPromise;

  webReadyPromise = (async () => {
    const basePath = `${import.meta.env.BASE_URL}assets`;
    defineJeepSqlite(window);
    await customElements.whenDefined("jeep-sqlite");
    if (!document.querySelector("jeep-sqlite")) {
      const element = document.createElement("jeep-sqlite");
      element.setAttribute("autosave", "true");
      element.setAttribute("wasmpath", basePath);
      document.body.appendChild(element);
    }
    await sqlite.initWebStore();
  })();

  return webReadyPromise;
}

async function flushWebStore(database = DB_NAME): Promise<void> {
  if (Capacitor.getPlatform() !== "web") return;
  await sqlite.saveToStore(database);
}

/**
 * Every write must be serialised — IndexedDB on web is async and racy,
 * and SQLite WAL mode tolerates concurrent reads but not concurrent
 * writers from the same process. The chain swallows errors so a failed
 * write doesn't poison subsequent waiters.
 */
export async function withDatabaseWriteLock<T>(
  action: (db: SQLiteDBConnection) => Promise<T>,
): Promise<T> {
  const prior = writeQueue.catch(() => undefined);
  const next = prior.then(async () => {
    const db = await getDatabase();
    const result = await action(db);
    await flushWebStore();
    return result;
  });
  writeQueue = next.catch(() => undefined);
  return next;
}

/** Read a row from `app_kv`; returns `null` if no row exists. */
export async function readKv(
  namespace: string,
  key: string,
): Promise<string | null> {
  const db = await getDatabase();
  const result = await db.query(
    "SELECT value FROM app_kv WHERE namespace = ? AND item_key = ? LIMIT 1",
    [namespace, key],
  );
  const row = result.values?.[0] as { value?: string } | undefined;
  return row?.value ?? null;
}

/** Upsert a row in `app_kv` under the write lock. */
export async function writeKv(
  namespace: string,
  key: string,
  value: string,
): Promise<void> {
  await withDatabaseWriteLock(async (db) => {
    await db.run(
      `INSERT INTO app_kv (namespace, item_key, value, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(namespace, item_key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
      [namespace, key, value, new Date().toISOString()],
    );
  });
}

/** Delete a row in `app_kv` under the write lock. */
export async function deleteKv(namespace: string, key: string): Promise<void> {
  await withDatabaseWriteLock(async (db) => {
    await db.run(
      "DELETE FROM app_kv WHERE namespace = ? AND item_key = ?",
      [namespace, key],
    );
  });
}

export async function closeDatabase(): Promise<void> {
  const existing = await sqlite.isConnection(DB_NAME, false);
  if (existing.result) {
    await sqlite.closeConnection(DB_NAME, false);
  }
  connectionPromise = null;
}
