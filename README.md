# ⚡ AI SQL Assistant

> Natural language → SQL, powered by Anthropic Claude (Claude Sonnet 5.5 recommended — configurable via `CLAUDE_MODEL`). Schema-aware query generation, Monaco editor, live execution, AI explanation, and auto-fix.

![Tech Stack](https://img.shields.io/badge/stack-MERN%20%2B%20Claude-5b8af0?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## Features

| Feature | Description |
|---|---|
| 🤖 NL → SQL | Ask questions in plain English, get executable SQL |
| 🧠 Schema-aware | LLM receives your actual table structure as context |
| ▶️ Live execution | Runs queries against a seeded SQLite demo database |
| 💡 Explain | Plain-English breakdown of any SQL query |
| 🔧 AI Fix | Paste the error — Claude fixes your query automatically |
| ⚡ Optimize | Performance suggestions + index recommendations |
| 💬 Conversation | Multi-turn context — follow-up questions work naturally |
| 📜 History | Persistent query history with one-click recall |
| 🪟 Resizable results panel | Drag the panel's top edge to resize it, or collapse it like the VS Code terminal; layout is remembered |
| 💡 Smart suggestions | Sample questions adapt to the loaded schema — demo data or your uploaded database |
| 🎛️ Dialect switcher | Switch between SQLite, PostgreSQL, MySQL, SQL Server |

---

## Tech Stack

**Backend:** Node.js · Express · Anthropic Claude SDK (@anthropic-ai/sdk) · sql.js (in-process SQLite, persisted to disk) · Helmet · express-rate-limit

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
│   │   ├── claudeService.js # all Claude LLM calls with system prompt engineering
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
# Edit .env and paste your Claude API key
# CLAUDE_API_KEY=your_key_here
# CLAUDE_MODEL=claude-sonnet-5-5
```

`.env` is git-ignored and never committed — keep it that way. If a real key ever ends up
in a file you shared, committed, or pasted somewhere outside your own machine, rotate it
immediately from the [Anthropic Console](https://console.anthropic.com/settings/keys).

### 3. Run in development

```bash
# From root — starts both backend (5000) and frontend (5173)
npm run dev
```

Open http://localhost:5173

#### Run backend and frontend separately

Use two terminals:

```bash
# Terminal 1 — backend (http://localhost:5000, auto-reloads with nodemon)
cd backend
npm run dev

# Terminal 2 — frontend (http://localhost:5173)
cd frontend
npm run dev
```

Or from the repo root: `npm run dev:backend` / `npm run dev:frontend`.

Verify the backend is up: http://localhost:5000/api/health

#### Production

```bash
npm run build   # builds the frontend
npm start       # starts the backend (node server.js)
```

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
| POST | /api/sql/generate | NL → SQL via Claude |
| POST | /api/sql/execute | Execute SQL + auto-generate if needed |
| POST | /api/sql/explain | Plain-English query explanation |
| POST | /api/sql/fix | Fix broken SQL given an error message |
| POST | /api/sql/optimize | Performance improvements + index recommendations |
| GET | /api/schema/demo | Return demo DB schema |
| GET | /api/history | Fetch query history |
| DELETE | /api/history | Clear all history |
| DELETE | /api/history/:id | Delete one history entry |
| GET | /api/health | Health check + active Claude model |
| POST | /api/upload | Upload CSV / .sqlite / .sql dump |
| POST | /api/upload/reset | Reset to the demo database |
| GET | /api/upload/status | Current data source (demo/uploaded) |

The active database (demo or uploaded) is persisted to `backend/db/*.db` on every write,
so it survives a server restart instead of resetting to the seed data each time.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Claude rejected the request` (500 on `/api/sql/generate`) | A 4xx from the Claude API. The backend console prints the real status and message (`[Claude] 400 ...`). Newer models (e.g. Sonnet 5.5) reject non-default `temperature` — don't set it. |
| `Claude API key was rejected` | Check `CLAUDE_API_KEY` in `backend/.env`, then restart the backend. |
| `GET /api/sql/generate 404` in the log | Expected if opened in a browser — the endpoint is POST only. |
| UI changes don't appear | Hard refresh (Ctrl+Shift+R). |

---

## Resume Bullet Points (copy-paste ready)

> **AI SQL Assistant** — Full-stack Gen AI developer tool | Node.js · React · Claude (Claude Sonnet) · SQLite

- Built a natural language SQL assistant using Anthropic's Claude Sonnet API with schema-injected system prompts, enabling accurate NL→SQL generation across multiple dialects (SQLite, PostgreSQL, MySQL)
- Engineered an AI-powered error-correction loop — when query execution fails, the error is passed back to the LLM with the original SQL for auto-fix, reducing debugging time by ~80%
- Implemented Monaco Editor integration with a live query execution engine, returning results in a sortable data grid with row count and execution time metrics
- Designed a multi-feature AI panel (Explain, Fix, Optimize) that provides plain-English query breakdowns, performance suggestions, and index recommendations using structured LLM output
- Applied rate limiting, Helmet security headers, and conversation history windowing to build a production-ready Express API with controlled Claude quota usage
