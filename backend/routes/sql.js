const express = require("express");
const router = express.Router();
const { generateSQL, explainSQL, fixSQL, optimizeSQL } = require("../services/groqService");
const { executeQuery } = require("../services/sqliteService");
const { addEntry } = require("../services/historyService");

/**
 * POST /api/sql/generate
 * Body: { question, schema, dialect, conversationHistory }
 * Returns: { sql, model, usage }
 */
router.post("/generate", async (req, res, next) => {
  try {
    const { question, schema, dialect = "SQLite", conversationHistory = [] } = req.body;

    if (!question?.trim()) {
      return res.status(400).json({ error: "question is required." });
    }

    const result = await generateSQL({ question, schema, dialect, conversationHistory });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sql/execute
 * Body: { sql, question, dialect }
 * Generates SQL if not provided, then executes it.
 */
router.post("/execute", async (req, res, next) => {
  try {
    const { sql, question, schema, dialect = "SQLite", conversationHistory = [] } = req.body;

    let finalSQL = sql;

    // Auto-generate if only a question was given
    if (!finalSQL && question) {
      const generated = await generateSQL({ question, schema, dialect, conversationHistory });
      finalSQL = generated.sql;
    }

    if (!finalSQL?.trim()) {
      return res.status(400).json({ error: "sql or question is required." });
    }

    let queryResult, error;
    try {
      queryResult = await executeQuery(finalSQL);
    } catch (execErr) {
      error = execErr.message;
    }

    // Save to history regardless of success/failure
    addEntry({
      question: question || null,
      sql: finalSQL,
      dialect,
      rowCount: queryResult?.rowCount ?? null,
      executionTime: queryResult?.executionTime ?? null,
      error: error ?? null,
    });

    if (error) {
      return res.status(200).json({ sql: finalSQL, error });
    }

    res.json({ sql: finalSQL, ...queryResult });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sql/explain
 * Body: { sql, schema, dialect }
 */
router.post("/explain", async (req, res, next) => {
  try {
    const { sql, schema, dialect = "SQLite" } = req.body;
    if (!sql?.trim()) return res.status(400).json({ error: "sql is required." });

    const explanation = await explainSQL({ sql, schema, dialect });
    res.json({ explanation });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sql/fix
 * Body: { sql, error, schema, dialect }
 */
router.post("/fix", async (req, res, next) => {
  try {
    const { sql, error, schema, dialect = "SQLite" } = req.body;
    if (!sql?.trim() || !error?.trim()) {
      return res.status(400).json({ error: "sql and error are required." });
    }

    const fixedSQL = await fixSQL({ sql, error, schema, dialect });
    res.json({ sql: fixedSQL });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sql/optimize
 * Body: { sql, schema, dialect }
 */
router.post("/optimize", async (req, res, next) => {
  try {
    const { sql, schema, dialect = "SQLite" } = req.body;
    if (!sql?.trim()) return res.status(400).json({ error: "sql is required." });

    const result = await optimizeSQL({ sql, schema, dialect });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
