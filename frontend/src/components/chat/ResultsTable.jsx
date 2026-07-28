import React from "react";
import "./ResultsTable.css";

export default function ResultsTable({ result, loading }) {
  if (loading) {
    return (
      <div className="results-state">
        <div className="spinner" />
        <p>Running query…</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="results-state muted">
        <p>Results will appear here after you run a query.</p>
      </div>
    );
  }

  if (result.rowCount === 0) {
    return (
      <div className="results-state muted">
        <p>Query ran successfully — 0 rows returned.</p>
      </div>
    );
  }

  return (
    <div className="results-table-wrap">
      <div className="results-meta">
        <span>{result.rowCount} row{result.rowCount !== 1 ? "s" : ""}</span>
        <span className="meta-sep">·</span>
        <span>{result.executionTime}ms</span>
        <span className="meta-sep">·</span>
        <span>{result.columns.length} column{result.columns.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {result.columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, i) => (
              <tr key={i}>
                {result.columns.map((col) => (
                  <td key={col}>
                    {row[col] === null
                      ? <span className="null-value">NULL</span>
                      : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
