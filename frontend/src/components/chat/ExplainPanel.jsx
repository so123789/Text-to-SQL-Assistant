import React from "react";
import "./ExplainPanel.css";

export default function ExplainPanel({ explanation, loading }) {
  if (loading) {
    return (
      <div className="panel-state">
        <div className="spinner" />
        <p>Analyzing query…</p>
      </div>
    );
  }

  if (!explanation) {
    return (
      <div className="panel-state muted">
        <p>Click <strong>Explain</strong> in the toolbar to get a plain-English breakdown of your query.</p>
      </div>
    );
  }

  // Parse numbered list from AI response
  const lines = explanation
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => l.replace(/^\d+\.\s*/, "").trim());

  return (
    <div className="explain-panel">
      <h3 className="panel-heading">Query Explanation</h3>
      <ol className="explain-list">
        {lines.map((line, i) => (
          <li key={i} className="explain-item">
            <span className="explain-num">{i + 1}</span>
            <span>{line}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
