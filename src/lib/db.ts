import initSqlJs, { Database } from "sql.js";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "inventoryops.db");

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
    initializeSchema(db);
    saveDb(db);
  }

  return db;
}

function initializeSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      canonical_name TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'mL',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS product_aliases (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      alias TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source_filename TEXT NOT NULL,
      upload_date TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'parsed',
      notes TEXT
    );
  `);

  db.run(`
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
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inventory_stock (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL UNIQUE,
      quantity_on_hand_ml REAL NOT NULL DEFAULT 0,
      last_updated TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `);
}

export function saveDb(database?: Database) {
  const d = database || db;
  if (!d) return;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const data = d.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

export function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): T[] {
  if (!db) throw new Error("Database not initialized");
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export function run(sql: string, params: unknown[] = []) {
  if (!db) throw new Error("Database not initialized");
  db.run(sql, params);
  saveDb();
}
