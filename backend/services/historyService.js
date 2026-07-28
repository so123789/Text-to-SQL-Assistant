const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const HISTORY_FILE = path.join(__dirname, "../db/history.json");

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
    }
  } catch {
    // corrupted file — start fresh
  }
  return [];
}

function saveHistory(history) {
  fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(-100), null, 2)); // keep last 100
}

function addEntry({ question, sql, dialect, rowCount, executionTime, error }) {
  const history = loadHistory();
  const entry = {
    id: uuidv4(),
    question,
    sql,
    dialect,
    rowCount: rowCount ?? null,
    executionTime: executionTime ?? null,
    error: error ?? null,
    createdAt: new Date().toISOString(),
  };
  history.unshift(entry);
  saveHistory(history);
  return entry;
}

function getHistory(limit = 50) {
  return loadHistory().slice(0, limit);
}

function clearHistory() {
  saveHistory([]);
}

function deleteEntry(id) {
  const history = loadHistory().filter((e) => e.id !== id);
  saveHistory(history);
}

module.exports = { addEntry, getHistory, clearHistory, deleteEntry };
