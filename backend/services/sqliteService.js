const initSqlJs = require("sql.js");
const path = require("path");
const fs = require("fs");

let SQL = null;
let db = null;
let dbMode = "demo";

const DB_DIR = path.join(__dirname, "../db");
const DEMO_DB_PATH = path.join(DB_DIR, "demo.db");
const UPLOADED_DB_PATH = path.join(DB_DIR, "uploaded.db");

// -------------------- SQL Engine --------------------

async function getSQLEngine() {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (file) =>
        path.join(
          process.cwd(),
          "node_modules",
          "sql.js",
          "dist",
          file
        ),
    });
  }

  return SQL;
}

/**
 * Persist the in-memory database to disk so data survives server restarts.
 * Silent no-op on failure (e.g. read-only filesystem) — persistence is a
 * convenience, not a requirement for the app to function.
 */
function persist() {
  if (!db) return;
  try {
    fs.mkdirSync(DB_DIR, { recursive: true });
    const targetPath = dbMode === "uploaded" ? UPLOADED_DB_PATH : DEMO_DB_PATH;
    const data = db.export();
    fs.writeFileSync(targetPath, Buffer.from(data));
  } catch (err) {
    console.error("[sqliteService] Failed to persist database:", err.message);
  }
}

/**
 * On first access, restore whichever database was active when the server
 * last ran: an uploaded database takes priority, otherwise the demo DB
 * (loading it from disk if present, or seeding + saving a fresh copy).
 */
async function getDb() {
  if (db) return db;

  const engine = await getSQLEngine();

  if (fs.existsSync(UPLOADED_DB_PATH)) {
    db = new engine.Database(new Uint8Array(fs.readFileSync(UPLOADED_DB_PATH)));
    dbMode = "uploaded";
    return db;
  }

  if (fs.existsSync(DEMO_DB_PATH)) {
    db = new engine.Database(new Uint8Array(fs.readFileSync(DEMO_DB_PATH)));
    dbMode = "demo";
    return db;
  }

  db = new engine.Database();
  seedDemoData(db);
  dbMode = "demo";
  persist();

  return db;
}

// -------------------- Upload Handlers --------------------

async function loadSQLiteFile(buffer) {
  const engine = await getSQLEngine();

  db = new engine.Database(new Uint8Array(buffer));

  dbMode = "uploaded";
  persist();

  return getDemoSchema();
}

async function loadCSVFiles(csvFiles) {
  const engine = await getSQLEngine();

  db = new engine.Database();

  dbMode = "uploaded";

  for (const file of csvFiles) {
    const tableName = file.originalname
      .replace(/\.csv$/i, "")
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .toLowerCase();

    const text = file.buffer.toString("utf8");

    const rows = parseCSV(text);

    if (rows.length < 2) continue;

    const headers = rows[0];

    const dataRows = rows.slice(1);

    const columns = headers.map((header, index) => {
      const value = dataRows[0][index];

      return `"${header}" ${isNumeric(value) ? "REAL" : "TEXT"}`;
    });

    db.run(
      `CREATE TABLE "${tableName}" (${columns.join(",")})`
    );

    const placeholders = headers.map(() => "?").join(",");

    const insertSQL = `INSERT INTO "${tableName}" VALUES (${placeholders})`;

    for (const row of dataRows) {
      if (row.length === 0) continue;

      const values = headers.map((_, index) => {
        const value = row[index];

        return isNumeric(value) ? Number(value) : value;
      });

      try {
        db.run(insertSQL, values);
      } catch (err) {}
    }
  }

  persist();

  return getDemoSchema();
}

async function loadSQLDump(sqlText) {
  const engine = await getSQLEngine();

  db = new engine.Database();

  db.run(sqlText);

  dbMode = "uploaded";
  persist();

  return getDemoSchema();
}

async function resetToDemo() {
  const engine = await getSQLEngine();

  // Drop any persisted uploaded database — the demo DB becomes current again.
  try {
    if (fs.existsSync(UPLOADED_DB_PATH)) fs.unlinkSync(UPLOADED_DB_PATH);
  } catch (err) {
    console.error("[sqliteService] Failed to remove uploaded database:", err.message);
  }

  if (fs.existsSync(DEMO_DB_PATH)) {
    db = new engine.Database(new Uint8Array(fs.readFileSync(DEMO_DB_PATH)));
  } else {
    db = new engine.Database();
    seedDemoData(db);
    persist();
  }

  dbMode = "demo";

  return getDemoSchema();
}

function getCurrentMode() {
  return dbMode;
}

// -------------------- Query Execution --------------------

const DESTRUCTIVE_KEYWORDS = ["DROP", "TRUNCATE", "ALTER", "ATTACH", "DETACH", "VACUUM", "REINDEX"];

/**
 * Reject anything that looks like more than one SQL statement. This is a
 * conservative heuristic (it doesn't parse string literals), which is fine
 * here since it can only make the check stricter, never let something slip
 * through — a semicolon inside a quoted string will just cause an
 * occasional false "multiple statements" rejection, not a security gap.
 */
function hasMultipleStatements(sql) {
  const withoutTrailing = sql.trim().replace(/;\s*$/, "");
  return withoutTrailing.includes(";");
}

function assertSafeToExecute(sql) {
  const trimmed = sql.trim();
  const normalized = trimmed.toUpperCase();

  if (hasMultipleStatements(trimmed)) {
    throw new Error("Only a single SQL statement can be run at a time.");
  }

  const firstWord = normalized.split(/\s+/)[0];
  if (DESTRUCTIVE_KEYWORDS.includes(firstWord)) {
    throw new Error(`${firstWord} statements are disabled for safety.`);
  }

  if (firstWord === "DELETE" && !normalized.includes("WHERE")) {
    throw new Error("DELETE without a WHERE clause is disabled — it would remove every row.");
  }

  if (firstWord === "UPDATE" && !normalized.includes("WHERE")) {
    throw new Error("UPDATE without a WHERE clause is disabled — it would modify every row.");
  }

  if (firstWord === "PRAGMA" && /WRITABLE_SCHEMA|JOURNAL_MODE\s*=/.test(normalized)) {
    throw new Error("This PRAGMA statement is disabled for safety.");
  }
}

async function executeQuery(sql) {
  if (!sql?.trim()) {
    throw new Error("No SQL provided.");
  }

  assertSafeToExecute(sql);

  const database = await getDb();

  const start = Date.now();

  const normalized = sql.trim().toUpperCase();
  const isWrite = /^(INSERT|UPDATE|DELETE|CREATE|REPLACE)/.test(normalized);

  const result = database.exec(sql.replace(/;\s*$/, ""));

  const executionTime = Date.now() - start;

  if (isWrite) {
    persist();
  }

  const { columns, rows } = resultToObjects(result);

  return {
    columns,
    rows,
    rowCount: rows.length,
    executionTime,
  };
}

async function getDemoSchema() {
  const database = await getDb();

  const tablesResult = database.exec(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  );

  const tables =
    tablesResult[0]?.values?.map((row) => row[0]) || [];

  const schema = {};

  for (const table of tables) {
    const result = database.exec(
      `PRAGMA table_info("${table}")`
    );

    const { rows } = resultToObjects(result);

    schema[table] = rows.map((column) => ({
      name: column.name,
      type: column.type,
      primaryKey: column.pk === 1,
      notNull: column.notnull === 1,
    }));
  }

  return schema;
}

// -------------------- Helpers --------------------

function resultToObjects(result) {
  if (!result || result.length === 0) {
    return {
      columns: [],
      rows: [],
    };
  }

  const { columns, values } = result[0];

  const rows = values.map((row) => {
    const obj = {};

    columns.forEach((column, index) => {
      obj[column] = row[index];
    });

    return obj;
  });

  return {
    columns,
    rows,
  };
}

function isNumeric(value) {
  return (
    value !== "" &&
    value !== null &&
    value !== undefined &&
    !isNaN(Number(value))
  );
}

// -------------------- CSV Parser --------------------

function parseCSV(text) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");

  return lines
    .map((line) => {
      const fields = [];

      let current = "";

      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === "," && !inQuotes) {
          fields.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }

      fields.push(current.trim());

      return fields;
    })
    .filter((row) => row.length > 0);
}

// -------------------- Demo Database --------------------

function seedDemoData(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      city TEXT,
      country TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      price REAL,
      stock INTEGER
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      status TEXT,
      total REAL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      product_id INTEGER,
      quantity INTEGER,
      unit_price REAL,
      FOREIGN KEY(order_id) REFERENCES orders(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    );
  `);

  const customers = [
    ["Alice Johnson","alice@email.com","New York","USA"],
    ["Bob Smith","bob@email.com","London","UK"],
    ["Priya Sharma","priya@email.com","Bengaluru","India"],
    ["Carlos Mendes","carlos@email.com","São Paulo","Brazil"],
    ["Emma Weber","emma@email.com","Berlin","Germany"],
    ["Yuki Tanaka","yuki@email.com","Tokyo","Japan"],
    ["Omar Hassan","omar@email.com","Dubai","UAE"],
    ["Sofia Rossi","sofia@email.com","Milan","Italy"]
  ];

  customers.forEach((c) => {
    db.run(
      "INSERT INTO customers(name,email,city,country) VALUES(?,?,?,?)",
      c
    );
  });

    const products = [
    ["Wireless Headphones","Electronics",89.99,150],
    ["Mechanical Keyboard","Electronics",129.99,80],
    ["Running Shoes","Footwear",74.99,200],
    ["Yoga Mat","Fitness",34.99,300],
    ["Coffee Maker","Kitchen",59.99,90],
    ["Standing Desk","Furniture",399.99,25],
    ["Notebook Set","Stationery",14.99,500],
    ["Water Bottle","Fitness",24.99,400]
  ];

  products.forEach((p) => {
    db.run(
      "INSERT INTO products(name,category,price,stock) VALUES(?,?,?,?)",
      p
    );
  });

  const orders = [
    [1,"completed",219.98],
    [2,"completed",129.99],
    [3,"shipped",109.98],
    [4,"pending",399.99],
    [5,"completed",74.99],
    [1,"completed",34.99],
    [3,"completed",184.98],
    [6,"shipped",59.99],
    [7,"pending",24.99],
    [8,"completed",544.98]
  ];

  orders.forEach((o) => {
    db.run(
      "INSERT INTO orders(customer_id,status,total) VALUES(?,?,?)",
      o
    );
  });

  const orderItems = [
    [1,1,1,89.99],
    [1,2,1,129.99],
    [2,2,1,129.99],
    [3,1,1,89.99],
    [3,3,1,74.99],
    [4,6,1,399.99],
    [5,3,1,74.99],
    [6,4,1,34.99],
    [7,1,1,89.99],
    [7,5,1,59.99],
    [8,5,1,59.99],
    [9,8,1,24.99],
    [10,6,1,399.99],
    [10,2,1,129.99]
  ];

  orderItems.forEach((item) => {
    db.run(
      "INSERT INTO order_items(order_id,product_id,quantity,unit_price) VALUES(?,?,?,?)",
      item
    );
  });
}

// -------------------- Exports --------------------

module.exports = {
  executeQuery,
  getDemoSchema,
  loadCSVFiles,
  loadSQLiteFile,
  loadSQLDump,
  resetToDemo,
  getCurrentMode,
};
