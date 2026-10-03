const DEMO_TABLES = ["customers", "products", "orders", "order_items"];

export const DEMO_QUESTIONS = [
  "Show me the top 5 customers by total order value",
  "Which products have never been ordered?",
  "Monthly revenue trend for the last 6 months",
  "Average order value by country",
  "Orders with more than one item",
];

const isNumeric = (t = "") => /int|real|float|double|decimal|numeric/i.test(t);
const isText = (t = "") => /char|text|clob|^$/i.test(t);
const isIdLike = (c) => c.primaryKey || /(^id$|_id$|id$)/i.test(c.name);
const pretty = (s) => s.replace(/_/g, " ");

// Build suggestions from whatever schema is currently loaded.
export function buildSampleQuestions(schema) {
  const tables = Object.keys(schema || {});
  if (tables.length === 0) return [];

  const lower = tables.map((t) => t.toLowerCase());
  if (DEMO_TABLES.every((t) => lower.includes(t))) return DEMO_QUESTIONS;

  const out = [];
  const first = tables[0];
  out.push(`Show the first 10 rows of ${first}`);

  for (const t of tables.slice(0, 3)) {
    const cols = schema[t] || [];
    if (t !== first) out.push(`How many rows are in ${t}?`);
    const num = cols.find((c) => isNumeric(c.type) && !isIdLike(c));
    const cat = cols.find((c) => isText(c.type) && !isIdLike(c));
    if (num) out.push(`What is the average and maximum ${pretty(num.name)} in ${t}?`);
    if (cat) out.push(`Count rows in ${t} grouped by ${pretty(cat.name)}`);
    if (num && cat) out.push(`Total ${pretty(num.name)} by ${pretty(cat.name)} in ${t}, highest first`);
  }

  // Suggest a join if two tables share a column name
  outer: for (let i = 0; i < tables.length; i++) {
    for (let j = i + 1; j < tables.length; j++) {
      const a = new Set((schema[tables[i]] || []).map((c) => c.name.toLowerCase()));
      const shared = (schema[tables[j]] || []).find((c) => a.has(c.name.toLowerCase()) && isIdLike(c));
      if (shared) {
        out.push(`Join ${tables[i]} with ${tables[j]} on ${shared.name} and show 10 rows`);
        break outer;
      }
    }
  }

  return [...new Set(out)].slice(0, 5);
}
