import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "inventoryops.db");

let db: Database.Database | null = null;

export async function getDb(): Promise<Database.Database> {
  if (db) return db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  initializeSchema(db);

  return db;
}

function initializeSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      canonical_name TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'mL',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_aliases (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      alias TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source_filename TEXT NOT NULL,
      upload_date TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'parsed',
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory_requirements (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      required_quantity_ml REAL NOT NULL,
      original_quantity REAL NOT NULL,
      original_unit TEXT NOT NULL,
      flagged INTEGER NOT NULL DEFAULT 0,
      flag_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory_stock (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL UNIQUE,
      quantity_on_hand_ml REAL NOT NULL DEFAULT 0,
      last_updated TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_req_product  ON inventory_requirements(product_id);
    CREATE INDEX IF NOT EXISTS idx_req_project  ON inventory_requirements(project_id);
    CREATE INDEX IF NOT EXISTS idx_stock_product ON inventory_stock(product_id);
    CREATE INDEX IF NOT EXISTS idx_aliases_product ON product_aliases(product_id);
  `);
}

export function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): T[] {
  if (!db) throw new Error("Database not initialized");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db.prepare(sql).all(...(params as any[])) as T[];
}

export function run(sql: string, params: unknown[] = []) {
  if (!db) throw new Error("Database not initialized");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db.prepare(sql).run(...(params as any[]));
}
