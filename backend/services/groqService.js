const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = "llama-3.3-70b-versatile";

/**
 * Build a tight schema context string from the user's schema object.
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
 * Generate SQL from a natural language question.
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
7. Never use DROP, DELETE, or UPDATE unless the user explicitly asks for DML.`;

  const messages = [
    ...conversationHistory.slice(-6), // Keep last 3 turns for context
    { role: "user", content: question },
  ];

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    temperature: 0.1, // Low temp for deterministic SQL
    max_tokens: 1024,
  });

  const sql = response.choices[0]?.message?.content?.trim();
  if (!sql) throw new Error("Groq returned an empty response.");

  return {
    sql,
    model: MODEL,
    usage: response.usage,
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

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Explain this ${dialect} query:\n\n${sql}` },
    ],
    temperature: 0.3,
    max_tokens: 512,
  });

  return response.choices[0]?.message?.content?.trim();
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
4. End with a semicolon.`;

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `This SQL query has an error:\n\n${sql}\n\nError: ${error}\n\nPlease fix it.`,
      },
    ],
    temperature: 0.1,
    max_tokens: 1024,
  });

  return response.choices[0]?.message?.content?.trim();
}

/**
 * Suggest query optimizations.
 */
async function optimizeSQL({ sql, schema, dialect = "SQLite" }) {
  const schemaContext = buildSchemaContext(schema);

  const systemPrompt = `You are a ${dialect} performance expert. Analyze SQL queries and suggest optimizations.

DATABASE SCHEMA:
${schemaContext}

Respond in JSON format:
{
  "optimizedQuery": "...",
  "suggestions": ["suggestion 1", "suggestion 2"],
  "indexRecommendations": ["CREATE INDEX ..."]
}`;

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Optimize this query:\n\n${sql}` },
    ],
    temperature: 0.2,
    max_tokens: 1024,
  });

  const raw = response.choices[0]?.message?.content?.trim();
  try {
    return JSON.parse(raw);
  } catch {
    return { optimizedQuery: sql, suggestions: [raw], indexRecommendations: [] };
  }
}

module.exports = { generateSQL, explainSQL, fixSQL, optimizeSQL };
