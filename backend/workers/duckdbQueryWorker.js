const { DuckDBInstance, dateValue } = require("@duckdb/node-api");

const TYPE_MAP = {
  INTEGER: "BIGINT",
  DECIMAL: "DOUBLE",
  BOOLEAN: "BOOLEAN",
  DATE: "DATE",
  TEXT: "VARCHAR",
  UNKNOWN: "VARCHAR",
};
const MAX_RETURNED_ROWS = 500;
const MAX_OUTPUT_BYTES = 1_000_000;

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function appendCell(appender, type, rawValue) {
  const value = rawValue.trim();
  if (!value) return appender.appendNull();
  if (type === "INTEGER") return appender.appendBigInt(BigInt(value));
  if (type === "DECIMAL") return appender.appendDouble(Number(value));
  if (type === "BOOLEAN") return appender.appendBoolean(value.toLowerCase() === "true");
  if (type === "DATE") {
    const [year, month, day] = value.split("-").map(Number);
    return appender.appendDate(dateValue({ year, month, day }));
  }
  return appender.appendVarchar(rawValue);
}

function boundRows(rows) {
  const kept = [];
  let bytes = 2;
  let truncated = rows.length > MAX_RETURNED_ROWS;
  for (const original of rows.slice(0, MAX_RETURNED_ROWS)) {
    const row = original.map((value) => typeof value === "string" && value.length > 1_000
      ? `${value.slice(0, 1_000)}…`
      : value);
    const rowBytes = Buffer.byteLength(JSON.stringify(row));
    if (bytes + rowBytes > MAX_OUTPUT_BYTES) {
      truncated = true;
      break;
    }
    kept.push(row);
    bytes += rowBytes;
  }
  return { rows: kept, truncated };
}

async function execute({ columns, rows, sql }) {
  const instance = await DuckDBInstance.create(":memory:", {
    threads: "1",
    max_memory: "128MB",
    max_temp_directory_size: "0B",
    enable_external_access: "false",
    autoload_known_extensions: "false",
    autoinstall_known_extensions: "false",
    allow_community_extensions: "false",
  });
  const connection = await instance.connect();
  try {
    const definitions = columns.map((column) =>
      `${quoteIdentifier(column.name)} ${TYPE_MAP[column.type] || "VARCHAR"}`);
    await connection.run(`CREATE TABLE dataset (${definitions.join(", ")})`);
    const appender = await connection.createAppender("dataset");
    try {
      for (const row of rows) {
        row.forEach((value, index) => appendCell(appender, columns[index].type, value));
        appender.endRow();
      }
      appender.flushSync();
    } finally {
      appender.closeSync();
    }
    await connection.run("SET lock_configuration = true");

    const extracted = await connection.extractStatements(sql);
    if (extracted.count !== 1) throw new Error("Only one SQL statement is allowed.");

    const startedAt = performance.now();
    const reader = await connection.runAndReadAll(
      `SELECT * FROM (${sql}) AS bounded_investigation_result LIMIT ${MAX_RETURNED_ROWS + 1}`,
    );
    const executionTime = Math.round((performance.now() - startedAt) * 10) / 10;
    const bounded = boundRows(reader.getRowsJson());
    return {
      columns: reader.columnNames(),
      rows: bounded.rows,
      returnedRows: bounded.rows.length,
      truncated: bounded.truncated,
      executionTime,
    };
  } finally {
    connection.closeSync();
    instance.closeSync();
  }
}

process.once("message", async (message) => {
  try {
    const result = await execute(message);
    process.send({ ok: true, result }, () => process.exit(0));
  } catch (error) {
    process.send({ ok: false, error: String(error.message || error).slice(0, 500) }, () => process.exit(1));
  }
});
