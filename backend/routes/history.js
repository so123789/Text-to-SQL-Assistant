const express = require("express");
const router = express.Router();
const { getHistory, clearHistory, deleteEntry } = require("../services/historyService");

router.get("/", (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json({ history: getHistory(limit) });
});

router.delete("/", (req, res) => {
  clearHistory();
  res.json({ message: "History cleared." });
});

router.delete("/:id", (req, res) => {
  deleteEntry(req.params.id);
  res.json({ message: "Entry deleted." });
});

module.exports = router;
