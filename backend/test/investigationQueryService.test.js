const test = require("node:test");
const assert = require("node:assert/strict");
const { inspectCSV } = require("../services/datasetService");
const { executeInvestigationQuery } = require("../services/investigationQueryService");

test("runs a bounded aggregate in an isolated DuckDB worker", async () => {
  const dataset = {
    id: "test-dataset",
    ...inspectCSV(Buffer.from("region,revenue\nWest,10.5\nWest,4.5\nEast,8\n")),
  };
  const result = await executeInvestigationQuery(
    dataset,
    "SELECT region, SUM(revenue) AS revenue FROM dataset GROUP BY region ORDER BY region",
  );
  assert.deepEqual(result.columns, ["region", "revenue"]);
  assert.deepEqual(result.rows, [["East", 8], ["West", 15]]);
  assert.equal(result.truncated, false);
  assert.equal(dataset.queryResults[0].id, result.id);
});

test("caps query output at 500 rows", async () => {
  const csv = `value\n${Array.from({ length: 600 }, (_, index) => index).join("\n")}\n`;
  const dataset = { id: "row-limit-dataset", ...inspectCSV(Buffer.from(csv)) };
  const result = await executeInvestigationQuery(dataset, "SELECT value FROM dataset ORDER BY value");
  assert.equal(result.returnedRows, 500);
  assert.equal(result.truncated, true);
});
