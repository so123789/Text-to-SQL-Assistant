const express = require("express");
const multer = require("multer");
const router = express.Router();
const { loadCSVFiles, loadSQLiteFile, loadSQLDump, resetToDemo, getCurrentMode } = require("../services/sqliteService");

// Store files in memory (no disk writes needed — sql.js is in-memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = [".csv", ".sqlite", ".db", ".sql"];
    const ext = "." + file.originalname.split(".").pop().toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`Unsupported file type: ${ext}. Allowed: ${allowed.join(", ")}`));
  },
});

/**
 * POST /api/upload
 * Accepts: one or more CSV files, a .sqlite/.db file, or a .sql dump
 */
router.post("/", upload.array("files", 10), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded." });
    }

    const files = req.files;
    const firstExt = files[0].originalname.split(".").pop().toLowerCase();

    let schema;

    if (firstExt === "sqlite" || firstExt === "db") {
      schema = await loadSQLiteFile(files[0].buffer);
    } else if (firstExt === "sql") {
      const sqlText = files[0].buffer.toString("utf-8");
      schema = await loadSQLDump(sqlText);
    } else {
      // CSV — can be multiple files, one table each
      schema = await loadCSVFiles(files.map(f => ({ originalname: f.originalname, buffer: f.buffer })));
    }

    const tableCount = Object.keys(schema).length;
    res.json({
      message: `Loaded ${files.length} file(s) → ${tableCount} table(s)`,
      schema,
      mode: "uploaded",
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/upload/reset — go back to demo database
 */
router.post("/reset", async (req, res, next) => {
  try {
    const schema = await resetToDemo();
    res.json({ message: "Reset to demo database", schema, mode: "demo" });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/upload/status
 */
router.get("/status", (req, res) => {
  res.json({ mode: getCurrentMode() });
});

module.exports = router;
