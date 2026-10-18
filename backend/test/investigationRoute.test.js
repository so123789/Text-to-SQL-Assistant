const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createInvestigationRouter } = require("../routes/investigation");

async function withServer(run, investigate) {
  const app = express();
  app.use(express.json({ limit: "20kb" }));
  app.use("/api/investigation", createInvestigationRouter(undefined, investigate));
  app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.message }));
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("uploads, reads, isolates, and deletes a dataset through the API", async () => {
  await withServer(async (baseUrl) => {
    const owner = "a".repeat(64);
    const otherOwner = "b".repeat(64);
    const body = new FormData();
    body.append("file", new Blob(["month,revenue\n2026-09,90\n"], { type: "text/csv" }), "sales.csv");

    const uploaded = await fetch(`${baseUrl}/api/investigation/datasets`, {
      method: "POST",
      headers: { "X-Investigation-Session": owner },
      body,
    });
    const dataset = await uploaded.json();
    assert.equal(uploaded.status, 201, dataset.error);
    assert.equal(dataset.filename, "sales.csv");
    assert.equal(dataset.rowCount, 1);
    assert.equal(dataset.sampleRows[0][1], "90");
    assert.equal(uploaded.headers.get("cache-control"), "no-store");

    const hidden = await fetch(`${baseUrl}/api/investigation/datasets/${dataset.id}`, {
      headers: { "X-Investigation-Session": otherOwner },
    });
    assert.equal(hidden.status, 404);

    const queried = await fetch(`${baseUrl}/api/investigation/datasets/${dataset.id}/query`, {
      method: "POST",
      headers: { "X-Investigation-Session": owner, "Content-Type": "application/json" },
      body: JSON.stringify({ sql: "SELECT SUM(revenue) AS total FROM dataset" }),
    });
    assert.equal(queried.status, 200);
    const queryResult = await queried.json();
    // DuckDB JSON preserves BIGINT values as strings to avoid precision loss.
    assert.deepEqual(queryResult.rows, [["90"]]);

    const unsafe = await fetch(`${baseUrl}/api/investigation/datasets/${dataset.id}/query`, {
      method: "POST",
      headers: { "X-Investigation-Session": owner, "Content-Type": "application/json" },
      body: JSON.stringify({ sql: "DROP TABLE dataset" }),
    });
    assert.equal(unsafe.status, 400);

    const deleted = await fetch(`${baseUrl}/api/investigation/datasets/${dataset.id}`, {
      method: "DELETE",
      headers: { "X-Investigation-Session": owner },
    });
    assert.equal(deleted.status, 204);
  });
});

test("requires a valid session secret", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/investigation/datasets/id`);
    assert.equal(response.status, 401);
  });
});

test("passes only the owner's dataset and bounded conversation input to the agent", async () => {
  let received;
  const investigate = async (dataset, input) => {
    received = { dataset, input };
    return {
      status: "needs_clarification",
      question: "Which revenue definition should I use?",
      actions: [],
      usage: { totalTokens: 4 },
      model: "test-model",
      providerCalls: 1,
      toolCalls: 0,
      latencyMs: 2,
    };
  };
  await withServer(async (baseUrl) => {
    const owner = "c".repeat(64);
    const body = new FormData();
    body.append("file", new Blob(["date,revenue\n2026-09-01,90\n"], { type: "text/csv" }), "sales.csv");
    const upload = await fetch(`${baseUrl}/api/investigation/datasets`, {
      method: "POST",
      headers: { "X-Investigation-Session": owner },
      body,
    });
    const dataset = await upload.json();

    const response = await fetch(`${baseUrl}/api/investigation/datasets/${dataset.id}/investigate`, {
      method: "POST",
      headers: { "X-Investigation-Session": owner, "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "Why did revenue fall?",
        conversationHistory: [{ role: "assistant", content: "Earlier answer" }],
      }),
    });
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.status, "needs_clarification");
    assert.equal(received.dataset.id, dataset.id);
    assert.equal(received.input.question, "Why did revenue fall?");
    assert.equal(received.input.conversationHistory.length, 1);
  }, investigate);
});
