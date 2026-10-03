const Anthropic = require("@anthropic-ai/sdk");

const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
const anthropic = new Anthropic({ apiKey });

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929";

/**
 * Clean markdown code block markers from SQL if present.
 */
function cleanSQL(text) {
  if (!text) return "";
  return text
    .replace(/^```(?:sql)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/**
 * Extract text content from an Anthropic message response.
 */
function extractText(response) {
  if (!response?.content) return "";
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

/**
 * Normalize usage tokens for compatibility.
 */
function extractUsage(response) {
  const input = response.usage?.input_tokens ?? 0;
  const output = response.usage?.output_tokens ?? 0;
  return {
    prompt_tokens: input,
    completion_tokens: output,
    total_tokens: input + output,
    input_tokens: input,
    output_tokens: output,
  };
}

/**
 * Call the Anthropic Messages API, translating low-level SDK/HTTP errors
 * into messages that are safe and useful to show a user — never leaking
 * the API key or raw stack traces.
 */
async function callClaude(params) {
  if (!apiKey) {
    throw new Error("Claude API key is not configured on the server. Set CLAUDE_API_KEY in backend/.env.");
  }
  try {
    return await anthropic.messages.create(params);
  } catch (err) {
    const status = err?.status;
    console.error(`[Claude] ${status ?? "network"} ${err?.message ?? err}`);
    if (status === 401) throw new Error("Claude API key was rejected. Check CLAUDE_API_KEY in backend/.env.");
    if (status === 429) throw new Error("Claude API rate limit reached — please wait a moment and try again.");
    if (status === 529 || status === 503) throw new Error("Claude is temporarily overloaded — please try again shortly.");
    if (status >= 400 && status < 500) throw new Error("Claude rejected the request — please rephrase and try again.");
    throw new Error("Couldn't reach Claude right now — please try again.");
  }
}

/**
 * Format and sanitize conversation history for Anthropic's Messages API.
 * Ensures roles strictly alternate and start with a 'user' turn.
 */
function formatMessages(conversationHistory = [], question) {
  const valid = [];
  for (const msg of conversationHistory.slice(-6)) {
    if (!msg || !msg.content) continue;
    const role = msg.role === "assistant" ? "assistant" : "user";
    if (valid.length > 0 && valid[valid.length - 1].role === role) {
      valid[valid.length - 1].content += `\n${msg.content}`;
    } else {
      valid.push({ role, content: msg.content });
    }
  }

  while (valid.length > 0 && valid[0].role !== "user") {
    valid.shift();
  }

  if (valid.length > 0 && valid[valid.length - 1].role === "user") {
    valid[valid.length - 1].content += `\n${question}`;
  } else {
    valid.push({ role: "user", content: question });
  }

  return valid;
}

/**
 * Build schema context string from the user's schema object.
 * Format: CREATE TABLE statements so the LLM understands column types precisely.
 */
function buildSchemaContext(schema) {
  if (!schema || Object.keys(schema).length === 0) {
    return "No schema provided — generate general SQL.";
  }

  return Object.entries(schema)
    .map(([table, columns]) => {
      const cols = columns
        .map((c) => `  ${c.name} ${c.type}${c.primaryKey ? " PRIMARY KEY" : ""}${c.notNull ? " NOT NULL" : ""}`)
        .join(",\n");
      return `CREATE TABLE ${table} (\n${cols}\n);`;
    })
    .join("\n\n");
}

/**
 * Generate SQL from a natural language question using Claude.
 */
async function generateSQL({ question, schema, dialect = "SQLite", conversationHistory = [] }) {
  const schemaContext = buildSchemaContext(schema);

  const systemPrompt = `You are an expert ${dialect} SQL assistant. Your job is to convert natural language questions into correct, efficient SQL queries.

DATABASE SCHEMA:
${schemaContext}

RULES:
1. Return ONLY a valid SQL query — no markdown, no backticks, no explanation.
2. Use only the tables and columns defined in the schema above.
3. Prefer readable aliases and proper JOINs over subqueries when possible.
4. Always end the query with a semicolon.
5. If the question is ambiguous, write the most reasonable interpretation.
6. For aggregations, always include appropriate GROUP BY clauses.
7. Never use DROP, DELETE, or UPDATE unless the user explicitly asks for DML.
8. Write a single statement only — never chain multiple statements with semicolons.`;

  const messages = formatMessages(conversationHistory, question);

  const response = await callClaude({
    model: MODEL,
    system: systemPrompt,
    messages,
    max_tokens: 1024,
  });

  const rawText = extractText(response);
  const sql = cleanSQL(rawText);
  if (!sql) throw new Error("Claude returned an empty response.");

  return {
    sql,
    model: MODEL,
    usage: extractUsage(response),
  };
}

/**
 * Explain a SQL query in plain English.
 */
async function explainSQL({ sql, schema, dialect = "SQLite" }) {
  const schemaContext = buildSchemaContext(schema);

  const systemPrompt = `You are a SQL tutor. Explain SQL queries clearly for developers who are learning.

DATABASE SCHEMA:
${schemaContext}

RULES:
1. Give a clear step-by-step explanation.
2. Explain what each clause does in plain English.
3. Mention any performance considerations if relevant.
4. Keep it concise — max 5 bullet points.
5. Format as a numbered list.`;

  const response = await callClaude({
    model: MODEL,
    system: systemPrompt,
    messages: [
      { role: "user", content: `Explain this ${dialect} query:\n\n${sql}` },
    ],
    max_tokens: 1024,
  });

  return extractText(response);
}

/**
 * Fix a broken SQL query, given the error message.
 */
async function fixSQL({ sql, error, schema, dialect = "SQLite" }) {
  const schemaContext = buildSchemaContext(schema);

  const systemPrompt = `You are an expert ${dialect} SQL debugger.

DATABASE SCHEMA:
${schemaContext}

RULES:
1. Return ONLY the corrected SQL query — no markdown, no backticks.
2. Fix the specific error mentioned by the user.
3. Preserve the original intent of the query.
4. End with a semicolon.
5. Write a single statement only — never chain multiple statements with semicolons.`;

  const response = await callClaude({
    model: MODEL,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `This SQL query has an error:\n\n${sql}\n\nError: ${error}\n\nPlease fix it.`,
      },
    ],
    max_tokens: 1024,
  });

  const rawText = extractText(response);
  return cleanSQL(rawText);
}

/**
 * Suggest query optimizations.
 */
async function optimizeSQL({ sql, schema, dialect = "SQLite" }) {
  const schemaContext = buildSchemaContext(schema);

  const systemPrompt = `You are a ${dialect} performance expert. Analyze SQL queries and suggest optimizations.

DATABASE SCHEMA:
${schemaContext}

Respond in valid JSON format only (no explanation outside JSON):
{
  "optimizedQuery": "...",
  "suggestions": ["suggestion 1", "suggestion 2"],
  "indexRecommendations": ["CREATE INDEX ..."]
}`;

  const response = await callClaude({
    model: MODEL,
    system: systemPrompt,
    messages: [
      { role: "user", content: `Optimize this query:\n\n${sql}` },
    ],
    max_tokens: 1024,
  });

  let raw = extractText(response);
  // Strip markdown ```json ... ``` if Claude included it
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    return JSON.parse(raw);
  } catch {
    return { optimizedQuery: sql, suggestions: [raw], indexRecommendations: [] };
  }
}

module.exports = { generateSQL, explainSQL, fixSQL, optimizeSQL };
