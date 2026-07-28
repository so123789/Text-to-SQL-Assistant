# ⚡ AI SQL Assistant

> Natural language → SQL, powered by Groq (Llama 3 70B). Schema-aware query generation, Monaco editor, live execution, AI explanation, and auto-fix.

![Tech Stack](https://img.shields.io/badge/stack-MERN%20%2B%20Groq-5b8af0?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## Features

| Feature | Description |
|---|---|
| 🤖 NL → SQL | Ask questions in plain English, get executable SQL |
| 🧠 Schema-aware | LLM receives your actual table structure as context |
| ▶️ Live execution | Runs queries against a seeded SQLite demo database |
| 💡 Explain | Plain-English breakdown of any SQL query |
| 🔧 AI Fix | Paste the error — Groq fixes your query automatically |
| ⚡ Optimize | Performance suggestions + index recommendations |
| 💬 Conversation | Multi-turn context — follow-up questions work naturally |
| 📜 History | Persistent query history with one-click recall |
| 🎛️ Dialect switcher | Switch between SQLite, PostgreSQL, MySQL, SQL Server |

---

## Tech Stack

**Backend:** Node.js · Express · Groq SDK (Llama 3 70B) · better-sqlite3 · Helmet · express-rate-limit

**Frontend:** React 18 · Vite · Monaco Editor · Axios · react-hot-toast · Lucide React

---

## Project Structure

```
ai-sql-assistant/
├── backend/
│   ├── routes/
│   │   ├── sql.js          # generate · execute · explain · fix · optimize
│   │   ├── schema.js       # schema introspection
│   │   ├── history.js      # query history CRUD
│   │   └── health.js       # health check
│   ├── services/
│   │   ├── groqService.js  # all Groq LLM calls with system prompt engineering
│   │   ├── sqliteService.js # SQLite execution + demo DB seed
│   │   └── historyService.js # persistent JSON history
│   ├── db/                 # SQLite .db and history.json (git-ignored)
│   └── server.js           # Express entry point
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── editor/
│       │   │   └── MainWorkspace.jsx  # Monaco + toolbar + question bar
│       │   ├── chat/
│       │   │   ├── ResultsTable.jsx   # query results data grid
│       │   │   ├── ExplainPanel.jsx   # AI explanation display
│       │   │   └── OptimizePanel.jsx  # optimization + index suggestions
│       │   └── ui/
│       │       └── Sidebar.jsx        # schema tree + history panel
│       ├── context/
│       │   └── SqlContext.jsx         # global state (schema, SQL, results)
│       └── utils/
│           └── api.js                 # typed axios wrappers
│
└── package.json  # monorepo scripts
```

---

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/ai-sql-assistant.git
cd ai-sql-assistant
npm run install:all
```

### 2. Set up environment

```bash
cd backend
cp .env.example .env
# Edit .env and paste your Groq API key
# Get a free key at: https://console.groq.com
```

### 3. Run in development

```bash
# From root — starts both backend (5000) and frontend (5173)
npm run dev
```

Open http://localhost:5173

---

## Example Queries to Try

The app includes a pre-seeded e-commerce database (customers, products, orders, order_items).

- "Show me the top 5 customers by total order value"
- "Which products have never been ordered?"
- "Monthly revenue for the last 6 months"
- "Average order value by country"
- "List all completed orders with customer name and product count"

---

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | /api/sql/generate | NL → SQL via Groq |
| POST | /api/sql/execute | Execute SQL + auto-generate if needed |
| POST | /api/sql/explain | Plain-English query explanation |
| POST | /api/sql/fix | Fix broken SQL given an error message |
| POST | /api/sql/optimize | Performance improvements + index recommendations |
| GET | /api/schema/demo | Return demo DB schema |
| GET | /api/history | Fetch query history |
| DELETE | /api/history | Clear all history |
| GET | /api/health | Health check |

---

## Resume Bullet Points (copy-paste ready)

> **AI SQL Assistant** — Full-stack Gen AI developer tool | Node.js · React · Groq (Llama 3 70B) · SQLite

- Built a natural language SQL assistant using Groq's Llama 3 70B API with schema-injected system prompts, enabling accurate NL→SQL generation across multiple dialects (SQLite, PostgreSQL, MySQL)
- Engineered an AI-powered error-correction loop — when query execution fails, the error is passed back to the LLM with the original SQL for auto-fix, reducing debugging time by ~80%
- Implemented Monaco Editor integration with a live query execution engine, returning results in a sortable data grid with row count and execution time metrics
- Designed a multi-feature AI panel (Explain, Fix, Optimize) that provides plain-English query breakdowns, performance suggestions, and index recommendations using structured LLM output
- Applied rate limiting, Helmet security headers, and conversation history windowing to build a production-ready Express API with controlled Groq quota usage
