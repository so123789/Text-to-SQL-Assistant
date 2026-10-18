const { Parser } = require("node-sql-parser");

const parser = new Parser();
const MAX_SQL_LENGTH = 8_000;
const BLOCKED_FUNCTIONS = new Set([
  "read_csv", "read_csv_auto", "read_parquet", "read_json", "read_json_auto",
  "read_blob", "read_text", "glob", "query", "query_table", "getenv",
  "duckdb_secrets", "sqlite_scan", "postgres_scan", "mysql_scan",
  "delta_scan", "iceberg_scan",
]);

function validationError(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function visit(node, callback, seen = new Set()) {
  if (!node || typeof node !== "object" || seen.has(node)) return;
  seen.add(node);
  callback(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((item) => visit(item, callback, seen));
    else visit(value, callback, seen);
  }
}

function functionName(node) {
  if (node.type !== "function" && node.type !== "aggr_func") return null;
  const name = node.name;
  if (typeof name === "string") return name.toLowerCase();
  if (typeof name?.name === "string") return name.name.toLowerCase();
  if (Array.isArray(name?.name)) {
    return name.name.map((part) => part.value).filter(Boolean).join(".").toLowerCase();
  }
  return null;
}

function validateReadOnlySQL(input) {
  if (typeof input !== "string" || !input.trim()) throw validationError("SQL is required.");
  if (input.length > MAX_SQL_LENGTH) throw validationError(`SQL must be under ${MAX_SQL_LENGTH} characters.`);

  let ast;
  try {
    ast = parser.astify(input, { database: "Postgresql" });
  } catch {
    throw validationError("SQL could not be parsed. Use one standard SELECT statement.");
  }
  if (Array.isArray(ast)) {
    if (ast.length !== 1) throw validationError("Only one SQL statement is allowed.");
    [ast] = ast;
  }
  if (ast.type !== "select") throw validationError("Only read-only SELECT queries are allowed.");

  const cteNames = new Set();
  let invalidNestedStatement = false;
  let blockedFunction = null;
  let selectInto = false;
  let invalidTableSource = false;
  visit(ast, (node) => {
    if (Array.isArray(node.with)) {
      for (const cte of node.with) {
        const name = cte?.name?.value?.toLowerCase();
        if (name) cteNames.add(name);
        if (cte?.stmt?.type && cte.stmt.type !== "select") invalidNestedStatement = true;
      }
    }
    if (node.type === "select" && node.into?.position) selectInto = true;
    if (Array.isArray(node.from)) {
      for (const source of node.from) {
        if (!source.table && source.expr?.ast?.type !== "select") invalidTableSource = true;
      }
    }
    const name = functionName(node)?.split(".").pop();
    if (name && BLOCKED_FUNCTIONS.has(name)) blockedFunction = name;
  });

  if (cteNames.has("dataset")) throw validationError('A CTE cannot shadow the protected "dataset" table.');
  if (invalidNestedStatement || selectInto) throw validationError("Queries cannot create or modify data.");
  if (invalidTableSource) throw validationError("Table functions and external readers are disabled.");
  if (blockedFunction) throw validationError(`Function ${blockedFunction} is disabled for investigation queries.`);

  let tables;
  try {
    tables = parser.tableList(input, { database: "Postgresql" });
  } catch {
    throw validationError("SQL table references could not be validated.");
  }
  let usesDataset = false;
  for (const reference of tables) {
    const [, database, rawTable] = reference.split("::");
    const table = rawTable?.toLowerCase();
    if (table === "dataset" && database === "null") {
      usesDataset = true;
      continue;
    }
    if (database === "null" && cteNames.has(table)) continue;
    throw validationError(`Only the uploaded "dataset" table may be queried.`);
  }
  if (!usesDataset) throw validationError('The query must read from the uploaded "dataset" table.');

  return input.trim().replace(/;\s*$/, "");
}

module.exports = { MAX_SQL_LENGTH, validateReadOnlySQL };
