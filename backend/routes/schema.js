const express = require("express");
const router = express.Router();
const { getDemoSchema } = require("../services/sqliteService");

// GET /api/schema/demo — return the demo database schema
router.get("/demo", async (req, res, next) => {
  try {
    const schema = await getDemoSchema();
    res.json({ schema });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
