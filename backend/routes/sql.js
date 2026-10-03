const express = require("express");
const router = express.Router();
const { generateSQL, explainSQL, fixSQL, optimizeSQL } = require("../services/claudeService");
const { executeQuery } = require("../services/sqliteService");
const { addEntry } = require("../services/historyService");

const ALLOWED_DIALECTS = ["SQLite", "PostgreSQL", "MySQL", "SQL Server"];
const MAX_QUESTION_LENGTH = 1000;
const MAX_SQL_LENGTH = 8000;
const MAX_ERROR_LENGTH = 2000;

function validateDialect(dialect) {
  return ALLOWED_DIALECTS.includes(dialect) ? dialect : "SQLite";
}

/**
 * POST /api/sql/generate
 * Body: { question, schema, dialect, conversationHistory }
 * Returns: { sql, model, usage }
 */
router.post("/generate", async (req, res, next) => {
  try {
    const { question, schema, conversationHistory = [] } = req.body;
    const dialect = validateDialect(req.body.dialect);

    if (!question?.trim()) {
      return res.status(400).json({ error: "question is required." });
    }
    if (question.length > MAX_QUESTION_LENGTH) {
      return res.status(400).json({ error: `question must be under ${MAX_QUESTION_LENGTH} characters.` });
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
    const { sql, question, schema, conversationHistory = [] } = req.body;
    const dialect = validateDialect(req.body.dialect);

    let finalSQL = sql;

    // Auto-generate if only a question was given
    if (!finalSQL && question) {
      const generated = await generateSQL({ question, schema, dialect, conversationHistory });
      finalSQL = generated.sql;
    }

    if (!finalSQL?.trim()) {
      return res.status(400).json({ error: "sql or question is required." });
    }
    if (finalSQL.length > MAX_SQL_LENGTH) {
      return res.status(400).json({ error: `sql must be under ${MAX_SQL_LENGTH} characters.` });
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
    const { sql, schema } = req.body;
    const dialect = validateDialect(req.body.dialect);
    if (!sql?.trim()) return res.status(400).json({ error: "sql is required." });
    if (sql.length > MAX_SQL_LENGTH) {
      return res.status(400).json({ error: `sql must be under ${MAX_SQL_LENGTH} characters.` });
    }

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
    const { sql, error, schema } = req.body;
    const dialect = validateDialect(req.body.dialect);
    if (!sql?.trim() || !error?.trim()) {
      return res.status(400).json({ error: "sql and error are required." });
    }
    if (sql.length > MAX_SQL_LENGTH || error.length > MAX_ERROR_LENGTH) {
      return res.status(400).json({ error: "sql or error message is too long." });
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
    const { sql, schema } = req.body;
    const dialect = validateDialect(req.body.dialect);
    if (!sql?.trim()) return res.status(400).json({ error: "sql is required." });
    if (sql.length > MAX_SQL_LENGTH) {
      return res.status(400).json({ error: `sql must be under ${MAX_SQL_LENGTH} characters.` });
    }

    const result = await optimizeSQL({ sql, schema, dialect });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
