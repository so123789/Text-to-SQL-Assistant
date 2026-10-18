import React, { useRef, useState } from "react";
import { Bot, FileSpreadsheet, Play, Send, ShieldCheck, Trash2, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { investigationApi } from "../../utils/api";
import { useSql } from "../../context/SqlContext";
import "./InvestigationWorkspace.css";

const TYPE_COLORS = {
  INTEGER: "#8b5cf6", DECIMAL: "#3b82f6", TEXT: "#14b8a6",
  DATE: "#f59e0b", BOOLEAN: "#ec4899", UNKNOWN: "#64748b",
};

function formatNumber(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function scalePosition(value, min, max) {
  if (min === max) return 50;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

export default function InvestigationWorkspace() {
  const { investigationCandidate } = useSql();
  const [dataset, setDataset] = useState(null);
  const [busy, setBusy] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [querySql, setQuerySql] = useState("SELECT * FROM dataset LIMIT 25;");
  const [queryResult, setQueryResult] = useState(null);
  const [queryError, setQueryError] = useState(null);
  const [agentQuestion, setAgentQuestion] = useState("Why did revenue fall in September?");
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentConversation, setAgentConversation] = useState([]);
  const [agentResult, setAgentResult] = useState(null);
  const [agentError, setAgentError] = useState(null);
  const inputRef = useRef(null);

  const typeCounts = dataset?.columns.reduce((counts, column) => {
    counts[column.type] = (counts[column.type] || 0) + 1;
    return counts;
  }, {}) || {};
  const typeEntries = Object.entries(typeCounts);
  let pieCursor = 0;
  const pieGradient = typeEntries.map(([type, count]) => {
    const start = pieCursor;
    pieCursor += (count / dataset.columns.length) * 360;
    return `${TYPE_COLORS[type] || TYPE_COLORS.UNKNOWN} ${start}deg ${pieCursor}deg`;
  }).join(", ");
  const numericColumns = dataset?.columns.filter((column) => column.numeric) || [];
  const categoricalColumns = dataset?.columns.filter((column) => column.topValues?.length) || [];

  async function upload(file) {
    if (!file) return;
    setBusy(true);
    try {
      const next = await investigationApi.upload(file);
      setDataset(next);
      setQueryResult(null);
      setQueryError(null);
      setAgentConversation([]);
      setAgentResult(null);
      setAgentError(null);
      toast.success(`Loaded ${next.rowCount.toLocaleString()} rows`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    if (!dataset) return;
    setBusy(true);
    try {
      await investigationApi.delete(dataset.id);
      setDataset(null);
      setQueryResult(null);
      setQueryError(null);
      setAgentConversation([]);
      setAgentResult(null);
      setAgentError(null);
      toast.success("Dataset deleted");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function runQuery() {
    if (!dataset || !querySql.trim()) return;
    setQuerying(true);
    setQueryError(null);
    try {
      setQueryResult(await investigationApi.query(dataset.id, querySql));
    } catch (error) {
      setQueryResult(null);
      setQueryError(error.message);
    } finally {
      setQuerying(false);
    }
  }

  async function runAgent(event) {
    event?.preventDefault();
    const question = agentQuestion.trim();
    if (!dataset || !question || agentBusy) return;
    setAgentBusy(true);
    setAgentError(null);
    try {
      const result = await investigationApi.investigate(dataset.id, {
        question,
        conversationHistory: agentConversation,
      });
      setAgentResult(result);
      const assistantText = result.status === "needs_clarification"
        ? result.question
        : result.report?.answer || result.message;
      setAgentConversation((current) => [
        ...current,
        { role: "user", content: question },
        ...(assistantText ? [{ role: "assistant", content: assistantText }] : []),
      ].slice(-6));
      setAgentQuestion("");
    } catch (error) {
      setAgentError(error.message);
    } finally {
      setAgentBusy(false);
    }
  }

  return (
    <main className="investigation-workspace">
      <header className="investigation-header">
        <div>
          <p className="eyebrow">DATA INVESTIGATION</p>
          <h1>Understand your sales CSV</h1>
          <p>Start by checking the columns, inferred types, missing values, and a small sample.</p>
        </div>
        {dataset && <button className="delete-dataset" onClick={remove} disabled={busy}><Trash2 size={14} /> Delete dataset</button>}
      </header>

      {!dataset ? (
        <div className="empty-investigation">
          {investigationCandidate && (
            <section className="reuse-csv-card">
              <FileSpreadsheet size={22} />
              <div>
                <strong>Use the CSV already selected in SQL Assistant?</strong>
                <span>{investigationCandidate.name}</span>
              </div>
              <button onClick={() => upload(investigationCandidate)} disabled={busy}>
                {busy ? "Validating…" : "Use this CSV"}
              </button>
            </section>
          )}
          <button className="csv-dropzone" disabled={busy} onClick={() => inputRef.current?.click()}>
            <Upload size={30} />
            <strong>{busy ? "Validating CSV…" : investigationCandidate ? "Choose a different CSV" : "Choose a sales CSV"}</strong>
            <span>UTF-8 · up to 2 MiB · 10,000 rows · 50 columns</span>
          </button>
        </div>
      ) : (
        <section className="dataset-preview">
          <div className="dataset-summary">
            <FileSpreadsheet size={22} />
            <div><strong>{dataset.filename}</strong><span>{dataset.rowCount.toLocaleString()} rows · {dataset.columns.length} columns · expires {new Date(dataset.expiresAt).toLocaleTimeString()}</span></div>
            <button onClick={() => inputRef.current?.click()} disabled={busy}>Replace CSV</button>
          </div>
          <div className="summary-metrics">
            <article><strong>{dataset.rowCount.toLocaleString()}</strong><span>Rows</span></article>
            <article><strong>{dataset.columns.length}</strong><span>Columns</span></article>
            <article><strong>{(dataset.summary.completeness * 100).toFixed(1)}%</strong><span>Complete cells</span></article>
            <article><strong>{dataset.summary.duplicateRows.toLocaleString()}</strong><span>Duplicate rows</span></article>
          </div>
          <section className="agent-panel">
            <div className="agent-heading">
              <div className="agent-icon"><Bot size={20} /></div>
              <div>
                <h2>Investigation agent</h2>
                <p>Claude inspects the schema, runs bounded read-only queries, and separates measured patterns from possible explanations.</p>
              </div>
              <span className="agent-limit">8 tool calls max</span>
            </div>
            {agentConversation.length > 0 && (
              <div className="agent-conversation">
                {agentConversation.map((message, index) => (
                  <div className={`agent-message ${message.role}`} key={`${message.role}-${index}`}>
                    <strong>{message.role === "user" ? "You" : "Agent"}</strong>
                    <span>{message.content}</span>
                  </div>
                ))}
              </div>
            )}
            <form className="agent-composer" onSubmit={runAgent}>
              <textarea
                value={agentQuestion}
                onChange={(event) => setAgentQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") runAgent(event);
                }}
                maxLength={2000}
                placeholder={agentResult?.status === "needs_clarification" ? "Answer the clarification question…" : "Ask a question about this dataset…"}
                aria-label="Question for the investigation agent"
              />
              <button type="submit" disabled={agentBusy || !agentQuestion.trim()}>
                <Send size={14} /> {agentBusy ? "Investigating…" : agentResult?.status === "needs_clarification" ? "Send answer" : "Investigate"}
              </button>
            </form>
            <p className="agent-privacy"><ShieldCheck size={12} /> Aggregates are preferred; tool results are bounded before they are sent to Claude.</p>
            {agentError && <div className="agent-error">{agentError}</div>}
            {agentResult?.status === "needs_clarification" && (
              <div className="clarification-card"><strong>Clarification needed</strong><p>{agentResult.question}</p></div>
            )}
            {agentResult?.status === "incomplete" && (
              <div className="agent-error"><strong>Investigation stopped safely.</strong> {agentResult.message}</div>
            )}
            {agentResult?.status === "completed" && (
              <div className="agent-report">
                <div className="report-answer"><span>Answer</span><p>{agentResult.report.answer}</p></div>
                {agentResult.report.observations.length > 0 && (
                  <div className="report-section">
                    <h3>Observed in the data</h3>
                    {agentResult.report.observations.map((item, index) => (
                      <article key={index}><p>{item.statement}</p><small>Evidence {item.evidenceIds.map((id) => id.slice(0, 8)).join(", ")}</small></article>
                    ))}
                  </div>
                )}
                {agentResult.report.possibleExplanations.length > 0 && (
                  <div className="report-section hypotheses">
                    <h3>Possible explanations, not proven causes</h3>
                    {agentResult.report.possibleExplanations.map((item, index) => (
                      <article key={index}><p>{item.statement}</p><small>{item.whyNotProven} · Evidence {item.evidenceIds.map((id) => id.slice(0, 8)).join(", ")}</small></article>
                    ))}
                  </div>
                )}
                {agentResult.report.limitations.length > 0 && (
                  <div className="report-limitations"><strong>Limits of this answer</strong><ul>{agentResult.report.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
                )}
                <div className="agent-run-summary">{agentResult.toolCalls} tool calls · {agentResult.providerCalls} model turns · {(agentResult.latencyMs / 1000).toFixed(1)} seconds</div>
              </div>
            )}
          </section>
          <div className="profile-grid">
            {dataset.columns.map((column) => (
              <article key={column.name} className="profile-card">
                <strong title={column.name}>{column.name}</strong>
                <span>{column.type}</span>
                <small>{column.missing.toLocaleString()} missing · {column.uniqueCount.toLocaleString()} unique</small>
                {column.date && <small>{column.date.min} → {column.date.max}</small>}
              </article>
            ))}
          </div>
          <div className="profile-visuals">
            <section className="visual-card">
              <h2>Column types</h2>
              <div className="pie-layout">
                <div className="type-pie" style={{ background: `conic-gradient(${pieGradient})` }} aria-label="Pie chart of inferred column types">
                  <span>{dataset.columns.length}<small>columns</small></span>
                </div>
                <div className="pie-legend">
                  {typeEntries.map(([type, count]) => (
                    <div key={type}><i style={{ background: TYPE_COLORS[type] || TYPE_COLORS.UNKNOWN }} /><span>{type}</span><strong>{count}</strong></div>
                  ))}
                </div>
              </div>
            </section>
            <section className="visual-card">
              <h2>Missing values</h2>
              <div className="missing-bars">
                {dataset.columns.map((column) => {
                  const percent = dataset.rowCount ? (column.missing / dataset.rowCount) * 100 : 0;
                  return (
                    <div className="missing-column" key={column.name} title={`${column.name}: ${percent.toFixed(1)}% missing`}>
                      <div><i style={{ height: `${percent}%` }} /></div>
                      <strong>{percent.toFixed(0)}%</strong>
                      <span>{column.name}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
          {numericColumns.length > 0 && (
            <section className="analysis-section">
              <div className="section-heading">
                <h2>Numeric distributions and outliers</h2>
                <span>Outlier candidates use the 1.5×IQR rule.</span>
              </div>
              <div className="numeric-grid">
                {numericColumns.map((column) => {
                  const profile = column.numeric;
                  const domain = profile.max - profile.min;
                  const histogramMax = Math.max(...profile.histogram.map((bin) => bin.count));
                  return (
                    <article className="numeric-card" key={column.name}>
                      <div className="numeric-title"><strong>{column.name}</strong><span className={profile.outlierCount ? "outlier-badge" : "clean-badge"}>{profile.outlierCount} outliers</span></div>
                      <div className="stat-row"><span>Min <b>{formatNumber(profile.min)}</b></span><span>Median <b>{formatNumber(profile.median)}</b></span><span>Max <b>{formatNumber(profile.max)}</b></span></div>
                      <div className="boxplot" title={`Q1 ${formatNumber(profile.q1)}, median ${formatNumber(profile.median)}, Q3 ${formatNumber(profile.q3)}`}>
                        <i className="whisker" style={{ left: `${scalePosition(profile.whiskerMin, profile.min, profile.max)}%`, width: `${domain ? ((profile.whiskerMax - profile.whiskerMin) / domain) * 100 : 0}%` }} />
                        <i className="quartile-box" style={{ left: `${scalePosition(profile.q1, profile.min, profile.max)}%`, width: `${domain ? ((profile.q3 - profile.q1) / domain) * 100 : 0}%` }} />
                        <i className="median-line" style={{ left: `${scalePosition(profile.median, profile.min, profile.max)}%` }} />
                      </div>
                      <div className="histogram" aria-label={`Histogram for ${column.name}`}>
                        {profile.histogram.map((bin, index) => <i key={index} title={`${formatNumber(bin.start)}–${formatNumber(bin.end)}: ${bin.count}`} style={{ height: `${(bin.count / histogramMax) * 100}%` }} />)}
                      </div>
                      <small>Mean {formatNumber(profile.mean)} · Q1 {formatNumber(profile.q1)} · Q3 {formatNumber(profile.q3)}</small>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
          {categoricalColumns.length > 0 && (
            <section className="analysis-section">
              <div className="section-heading"><h2>Most frequent values</h2><span>Top five non-empty values per categorical column.</span></div>
              <div className="category-grid">
                {categoricalColumns.map((column) => {
                  const largest = column.topValues[0].count;
                  return <article className="category-card" key={column.name}>
                    <strong>{column.name}</strong>
                    {column.topValues.map((item) => <div className="category-row" key={item.value} title={item.value}>
                      <span>{item.value}</span><div><i style={{ width: `${(item.count / largest) * 100}%` }} /></div><b>{item.count}</b>
                    </div>)}
                  </article>;
                })}
              </div>
            </section>
          )}
          <section className="query-console">
            <div className="query-console-heading">
              <div><ShieldCheck size={17} /><span><strong>Read-only query</strong><small>Only the isolated <code>dataset</code> table is available.</small></span></div>
              <button onClick={runQuery} disabled={querying || !querySql.trim()}><Play size={13} /> {querying ? "Running…" : "Run query"}</button>
            </div>
            <textarea
              value={querySql}
              onChange={(event) => setQuerySql(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") runQuery();
              }}
              spellCheck="false"
              aria-label="Read-only SQL query"
            />
            <div className="query-hints"><span>Ctrl/⌘ + Enter to run</span><span>5-second limit · 500 rows · 1 MB output</span></div>
            {queryError && <div className="query-error">{queryError}</div>}
            {queryResult && (
              <div className="query-result">
                <div className="query-result-meta">
                  <span>Result <code>{queryResult.id.slice(0, 8)}</code></span>
                  <span>{queryResult.returnedRows} rows{queryResult.truncated ? " (truncated)" : ""} · {queryResult.totalTime} ms total</span>
                </div>
                <div className="preview-table-wrap">
                  <table className="preview-table">
                    <thead><tr>{queryResult.columns.map((column, index) => <th key={`${column}-${index}`}>{column}</th>)}</tr></thead>
                    <tbody>{queryResult.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((value, index) => <td key={index}>{value === null ? <em>NULL</em> : String(value)}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
          <div className="preview-table-wrap">
            <table className="preview-table">
              <thead><tr>{dataset.columns.map((column) => <th key={column.name}>{column.name}</th>)}</tr></thead>
              <tbody>{dataset.sampleRows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((value, index) => <td key={index}>{value || <em>missing</em>}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <p className="preview-note">Showing the first {dataset.sampleRows.length} rows. The full dataset stays in backend memory for 30 minutes and is isolated by this browser tab’s secret.</p>
        </section>
      )}
      <input ref={inputRef} type="file" accept=".csv,text/csv" hidden onChange={(event) => upload(event.target.files?.[0])} />
    </main>
  );
}
