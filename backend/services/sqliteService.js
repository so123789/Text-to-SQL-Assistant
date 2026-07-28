const initSqlJs = require("sql.js");
const path = require("path");
let SQL = null;         // sql.js engine (loaded once)
let db = null;          // active database
let dbMode = "demo";    // "demo" | "uploaded"

// ─── Engine init ────────────────────────────────────────────────────────────


async function getSQLEngine() {
  if (!SQL) SQL = await initSqlJs({
    locateFile: () => path.join(__dirname, "../../node_modules/sql.js/dist/sql-wasm.wasm")
  });
  return SQL;
}

async function getDb() {
  if (db) return db;
  const engine = await getSQLEngine();
  db = new engine.Database();
  seedDemoData(db);
  dbMode = "demo";
  return db;
}

// ─── Upload handlers ─────────────────────────────────────────────────────────

/**
 * Load a .sqlite / .db file uploaded as a Buffer.
 */
async function loadSQLiteFile(buffer) {
  const engine = await getSQLEngine();
  db = new engine.Database(new Uint8Array(buffer));
  dbMode = "uploaded";
  return getDemoSchema(); // return schema of loaded DB
}

/**
 * Parse one or more CSVs and create one table per file.
 * csvFiles: [{ originalname, buffer }]
 */
async function loadCSVFiles(csvFiles) {
  const engine = await getSQLEngine();
  db = new engine.Database();
  dbMode = "uploaded";

  for (const file of csvFiles) {
    const tableName = file.originalname
      .replace(/\.csv$/i, "")
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .toLowerCase();

    const text = file.buffer.toString("utf-8");
    const rows = parseCSV(text);
    if (rows.length < 2) continue; // need at least header + 1 row

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Infer column types from first data row
    const colDefs = headers.map((h, i) => {
      const val = dataRows[0]?.[i] ?? "";
      const type = isNumeric(val) ? "REAL" : "TEXT";
      return `"${h}" ${type}`;
    });

    db.run(`CREATE TABLE IF NOT EXISTS "${tableName}" (${colDefs.join(", ")})`);

    const placeholders = headers.map(() => "?").join(", ");
    const insertSQL = `INSERT INTO "${tableName}" VALUES (${placeholders})`;

    for (const row of dataRows) {
      if (row.length === 0 || row.every((c) => c === "")) continue;
      const values = headers.map((_, i) => {
        const v = row[i] ?? null;
        return isNumeric(v) ? Number(v) : v;
      });
      try { db.run(insertSQL, values); } catch { /* skip bad rows */ }
    }
  }

  return getDemoSchema();
}

/**
 * Load raw SQL (CREATE + INSERT statements) as a string.
 */
async function loadSQLDump(sqlText) {
  const engine = await getSQLEngine();
  db = new engine.Database();
  dbMode = "uploaded";
  db.run(sqlText);
  return getDemoSchema();
}

/**
 * Reset back to the built-in demo database.
 */
async function resetToDemo() {
  const engine = await getSQLEngine();
  db = new engine.Database();
  seedDemoData(db);
  dbMode = "demo";
  return getDemoSchema();
}

function getCurrentMode() { return dbMode; }

// ─── Query execution ─────────────────────────────────────────────────────────

async function executeQuery(sql) {
  const database = await getDb();
  const start = Date.now();

  const normalized = sql.trim().toUpperCase();
  if (
    normalized.startsWith("DROP") ||
    normalized.startsWith("TRUNCATE") ||
    (normalized.startsWith("DELETE") && !normalized.includes("WHERE"))
  ) {
    throw new Error("Destructive queries without WHERE are disabled in demo mode.");
  }

  const rawResult = database.exec(sql.replace(/;$/, ""));
  const executionTime = Date.now() - start;
  const { columns, rows } = resultToObjects(rawResult);

  return { columns, rows, rowCount: rows.length, executionTime };
}

async function getDemoSchema() {
  const database = await getDb();
  const tablesResult = database.exec(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  );
  const tables = tablesResult[0]?.values?.map((r) => r[0]) || [];

  const schema = {};
  for (const table of tables) {
    const colResult = database.exec(`PRAGMA table_info("${table}")`);
    const { rows } = resultToObjects(colResult);
    schema[table] = rows.map((c) => ({
      name: c.name,
      type: c.type,
      primaryKey: c.pk === 1,
      notNull: c.notnull === 1,
    }));
  }
  return schema;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resultToObjects(result) {
  if (!result || result.length === 0) return { columns: [], rows: [] };
  const { columns, values } = result[0];
  const rows = (values || []).map((row) => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
  return { columns, rows };
}

function isNumeric(val) {
  return val !== "" && val !== null && val !== undefined && !isNaN(Number(val));
}

/**
 * Minimal RFC-4180 CSV parser — handles quoted fields and commas inside quotes.
 */
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  return lines.map((line) => {
    const fields = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        fields.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur.trim());
    return fields;
  }).filter((r) => r.length > 0);
}

// ─── Demo seed ────────────────────────────────────────────────────────────────

function seedDemoData(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL, city TEXT, country TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      category TEXT NOT NULL, price REAL NOT NULL, stock INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending', total REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL, quantity INTEGER NOT NULL, unit_price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  [["Alice Johnson","alice@email.com","New York","USA"],["Bob Smith","bob@email.com","London","UK"],
   ["Priya Sharma","priya@email.com","Bengaluru","India"],["Carlos Mendes","carlos@email.com","São Paulo","Brazil"],
   ["Emma Weber","emma@email.com","Berlin","Germany"],["Yuki Tanaka","yuki@email.com","Tokyo","Japan"],
   ["Omar Hassan","omar@email.com","Dubai","UAE"],["Sofia Rossi","sofia@email.com","Milan","Italy"]]
  .forEach(([n,e,c,co]) => db.run("INSERT INTO customers (name,email,city,country) VALUES (?,?,?,?)",[n,e,c,co]));

  [["Wireless Headphones","Electronics",89.99,150],["Mechanical Keyboard","Electronics",129.99,80],
   ["Running Shoes","Footwear",74.99,200],["Yoga Mat","Fitness",34.99,300],
   ["Coffee Maker","Kitchen",59.99,90],["Standing Desk","Furniture",399.99,25],
   ["Notebook Set","Stationery",14.99,500],["Water Bottle","Fitness",24.99,400]]
  .forEach(([n,c,p,s]) => db.run("INSERT INTO products (name,category,price,stock) VALUES (?,?,?,?)",[n,c,p,s]));

  [[1,"completed",219.98],[2,"completed",129.99],[3,"shipped",109.98],[4,"pending",399.99],
   [5,"completed",74.99],[1,"completed",34.99],[3,"completed",184.98],[6,"shipped",59.99],
   [7,"pending",24.99],[8,"completed",544.98]]
  .forEach(([c,s,t]) => db.run("INSERT INTO orders (customer_id,status,total) VALUES (?,?,?)",[c,s,t]));

  [[1,1,1,89.99],[1,2,1,129.99],[2,2,1,129.99],[3,1,1,89.99],[3,3,1,74.99],
   [4,6,1,399.99],[5,3,1,74.99],[6,4,1,34.99],[7,1,1,89.99],[7,5,1,59.99],
   [8,5,1,59.99],[9,8,1,24.99],[10,6,1,399.99],[10,2,1,129.99]]
  .forEach(([o,p,q,u]) => db.run("INSERT INTO order_items (order_id,product_id,quantity,unit_price) VALUES (?,?,?,?)",[o,p,q,u]));
}

module.exports = { executeQuery, getDemoSchema, loadCSVFiles, loadSQLiteFile, loadSQLDump, resetToDemo, getCurrentMode };
