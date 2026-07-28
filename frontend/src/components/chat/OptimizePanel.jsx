import React from "react";
import { CheckCircle, Zap } from "lucide-react";
import toast from "react-hot-toast";
import "./OptimizePanel.css";

export default function OptimizePanel({ optimization, loading, onApply }) {
  if (loading) {
    return (
      <div className="panel-state">
        <div className="spinner" />
        <p>Optimizing query…</p>
      </div>
    );
  }

  if (!optimization) {
    return (
      <div className="panel-state muted">
        <p>Click <strong>Optimize</strong> to get AI-suggested performance improvements and index recommendations.</p>
      </div>
    );
  }

  return (
    <div className="optimize-panel">
      {optimization.suggestions?.length > 0 && (
        <section className="opt-section">
          <h3 className="panel-heading">Suggestions</h3>
          <ul className="opt-list">
            {optimization.suggestions.map((s, i) => (
              <li key={i} className="opt-item">
                <CheckCircle size={14} className="opt-icon" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {optimization.indexRecommendations?.length > 0 && (
        <section className="opt-section">
          <h3 className="panel-heading">Index Recommendations</h3>
          {optimization.indexRecommendations.map((idx, i) => (
            <code key={i} className="index-code">{idx}</code>
          ))}
        </section>
      )}

      {optimization.optimizedQuery && (
        <section className="opt-section">
          <div className="opt-query-header">
            <h3 className="panel-heading">Optimized Query</h3>
            <button
              className="btn-apply"
              onClick={() => { onApply(optimization.optimizedQuery); toast.success("Applied to editor"); }}
            >
              <Zap size={12} /> Apply
            </button>
          </div>
          <pre className="opt-query">{optimization.optimizedQuery}</pre>
        </section>
      )}
    </div>
  );
}
