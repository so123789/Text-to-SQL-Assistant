const path = require("node:path");
const { fork } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { validateReadOnlySQL } = require("./queryValidator");

const QUERY_TIMEOUT_MS = 5_000;
const MAX_GLOBAL_QUERIES = 2;
let activeQueries = 0;
const activeDatasets = new Set();

function serviceError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function runWorker(dataset, sql) {
  return new Promise((resolve, reject) => {
    const worker = fork(path.join(__dirname, "../workers/duckdbQueryWorker.js"), [], {
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      execArgv: ["--max-old-space-size=192"],
      windowsHide: true,
    });
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    const timer = setTimeout(() => {
      worker.kill();
      finish(reject, serviceError("Query exceeded the 5-second execution limit.", 408));
    }, QUERY_TIMEOUT_MS);
    worker.once("error", () => finish(reject, serviceError("The isolated query worker could not start.", 503)));
    worker.once("exit", (code) => {
      if (!settled && code !== 0) finish(reject, serviceError("Query execution failed in the isolated worker."));
    });
    worker.once("message", (message) => {
      if (message.ok) finish(resolve, message.result);
      else finish(reject, serviceError(message.error || "Query execution failed."));
    });
    worker.send({ columns: dataset.columns, rows: dataset.rows, sql });
  });
}

async function executeInvestigationQuery(dataset, inputSQL) {
  const sql = validateReadOnlySQL(inputSQL);
  if (activeQueries >= MAX_GLOBAL_QUERIES || activeDatasets.has(dataset.id)) {
    throw serviceError("Query capacity reached. Wait for the current query to finish.", 429);
  }
  activeQueries += 1;
  activeDatasets.add(dataset.id);
  const totalStartedAt = Date.now();
  try {
    const workerResult = await runWorker(dataset, sql);
    const result = {
      id: randomUUID(),
      sql,
      ...workerResult,
      totalTime: Date.now() - totalStartedAt,
      createdAt: new Date().toISOString(),
    };
    if (!dataset.queryResults) dataset.queryResults = [];
    dataset.queryResults.unshift(result);
    dataset.queryResults = dataset.queryResults.slice(0, 20);
    return result;
  } finally {
    activeQueries -= 1;
    activeDatasets.delete(dataset.id);
  }
}

module.exports = { QUERY_TIMEOUT_MS, executeInvestigationQuery };
