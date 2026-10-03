const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    status: "ok",
    claudeKey: !!(process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY),
    model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
