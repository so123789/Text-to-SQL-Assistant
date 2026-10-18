const test = require("node:test");
const assert = require("node:assert/strict");
const { inspectCSV, createStore } = require("../services/datasetService");

test("profiles valid CSV data", () => {
  const result = inspectCSV(Buffer.from(
    "date,revenue,region,note\n2026-09-01,12.50,West,\n2026-09-02,8,East,\"promo, ended\"\n",
  ));
  assert.equal(result.rowCount, 2);
  assert.deepEqual(result.columns.map(({ name, type, missing }) => ({ name, type, missing })), [
    { name: "date", type: "DATE", missing: 0 },
    { name: "revenue", type: "DECIMAL", missing: 0 },
    { name: "region", type: "TEXT", missing: 0 },
    { name: "note", type: "TEXT", missing: 1 },
  ]);
  assert.equal(result.sampleRows[1][3], "promo, ended");
  assert.equal(result.summary.missingCells, 1);
  assert.equal(result.summary.duplicateRows, 0);
  assert.equal(result.columns[1].numeric.median, 10.25);
  assert.equal(result.columns[2].uniqueCount, 2);
  assert.deepEqual(result.columns[2].topValues, [
    { value: "East", count: 1 },
    { value: "West", count: 1 },
  ]);
});

test("identifies numeric outlier candidates with the IQR rule", () => {
  const result = inspectCSV(Buffer.from("value\n10\n11\n12\n13\n100\n"));
  assert.equal(result.columns[0].numeric.outlierCount, 1);
  assert.equal(result.columns[0].numeric.whiskerMax, 13);
  assert.equal(result.columns[0].numeric.max, 100);
  assert.equal(result.columns[0].numeric.histogram.reduce((sum, bin) => sum + bin.count, 0), 5);
});

test("rejects malformed records and invalid UTF-8", () => {
  assert.throws(() => inspectCSV(Buffer.from("a,b\n1\n")), /Malformed CSV/);
  assert.throws(() => inspectCSV(Buffer.from([0xc3, 0x28])), /UTF-8/);
});

test("rejects duplicate and empty column names", () => {
  assert.throws(() => inspectCSV(Buffer.from("Name,name\na,b\n")), /unique/);
  assert.throws(() => inspectCSV(Buffer.from("a,\n1,2\n")), /Column names/);
});

test("isolates owners, deletes datasets, and expires them", () => {
  let clock = 1_000;
  const store = createStore(() => clock);
  const first = store.put("owner-a", Buffer.from("a\n1\n"), "a.csv");
  assert.equal(store.get("owner-a", first.id).rowCount, 1);
  assert.throws(() => store.get("owner-b", first.id), /not found/);
  store.delete("owner-a", first.id);
  assert.throws(() => store.get("owner-a", first.id), /not found/);

  const second = store.put("owner-a", Buffer.from("a\n2\n"), "b.csv");
  clock += 30 * 60 * 1000;
  assert.throws(() => store.get("owner-a", second.id), /expired/);
});
