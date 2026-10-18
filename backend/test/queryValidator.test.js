const test = require("node:test");
const assert = require("node:assert/strict");
const { validateReadOnlySQL } = require("../services/queryValidator");

test("accepts a single SELECT over the protected dataset", () => {
  assert.equal(
    validateReadOnlySQL("SELECT region, SUM(revenue) FROM dataset GROUP BY region;"),
    "SELECT region, SUM(revenue) FROM dataset GROUP BY region",
  );
  assert.match(
    validateReadOnlySQL("WITH monthly AS (SELECT * FROM dataset) SELECT COUNT(*) FROM monthly"),
    /^WITH monthly/,
  );
});

test("rejects writes, multiple statements, and other tables", () => {
  assert.throws(() => validateReadOnlySQL("DELETE FROM dataset"), /read-only SELECT/);
  assert.throws(() => validateReadOnlySQL("SELECT * FROM dataset; SELECT 1"), /one SQL statement/);
  assert.throws(() => validateReadOnlySQL("SELECT * FROM users"), /Only the uploaded/);
  assert.throws(() => validateReadOnlySQL("SELECT 1"), /must read from/);
  assert.throws(() => validateReadOnlySQL("WITH dataset AS (SELECT 1) SELECT * FROM dataset"), /cannot shadow/);
});

test("rejects external readers and dynamic query functions", () => {
  assert.throws(
    () => validateReadOnlySQL("SELECT d.* FROM dataset d, read_csv('/etc/passwd') f"),
    /disabled|could not be parsed/,
  );
  assert.throws(
    () => validateReadOnlySQL("SELECT query_table('dataset') FROM dataset"),
    /disabled/,
  );
  assert.throws(
    () => validateReadOnlySQL("SELECT * FROM dataset, duckdb_settings()"),
    /Table functions/,
  );
});
