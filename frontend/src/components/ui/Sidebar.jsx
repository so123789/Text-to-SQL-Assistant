import React, { useState } from "react";
import { Database, History, ChevronRight, ChevronDown, Table2, Hash, Upload } from "lucide-react";
import { useSql } from "../../context/SqlContext";
import UploadDB from "./UploadDB";
import ThemeSwitcher from "./ThemeSwitcher";
import "./Sidebar.css";

export default function Sidebar() {
  const { schema, schemaLoading, dialect, setDialect } = useSql();
  const [activeTab, setActiveTab] = useState("schema");
  const [expandedTables, setExpandedTables] = useState({});
  const [showUpload, setShowUpload] = useState(false);

  const toggleTable = (name) =>
    setExpandedTables((prev) => ({ ...prev, [name]: !prev[name] }));

  return (
    <>
      <aside className="sidebar">
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="logo-icon">⚡</span>
            <span className="logo-text">SQL<span className="logo-accent">AI</span></span>
          </div>
          <select
            className="dialect-select"
            value={dialect}
            onChange={(e) => setDialect(e.target.value)}
          >
            <option>SQLite</option>
            <option>PostgreSQL</option>
            <option>MySQL</option>
            <option>SQL Server</option>
          </select>
        </div>

        {/* Upload button */}
        <button className="upload-db-btn" onClick={() => setShowUpload(true)}>
          <Upload size={13} />
          Upload Your Database
        </button>

        {/* Tabs */}
        <div className="sidebar-tabs">
          <button
            className={`sidebar-tab ${activeTab === "schema" ? "active" : ""}`}
            onClick={() => setActiveTab("schema")}
          >
            <Database size={14} /> Schema
          </button>
          <button
            className={`sidebar-tab ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            <History size={14} /> History
          </button>
        </div>

        {/* Body */}
        <div className="sidebar-body">
          {activeTab === "schema" && (
            <SchemaPanel
              schema={schema}
              loading={schemaLoading}
              expandedTables={expandedTables}
              toggleTable={toggleTable}
            />
          )}
          {activeTab === "history" && <HistoryPanel />}
        </div>

        {/* Footer — theme switcher + model badge */}
        <div className="sidebar-footer">
          <ThemeSwitcher />
          <span className="model-badge">llama-3.3-70b</span>
        </div>
      </aside>

      {showUpload && <UploadDB onClose={() => setShowUpload(false)} />}
    </>
  );
}

function SchemaPanel({ schema, loading, expandedTables, toggleTable }) {
  if (loading) return <div className="sidebar-placeholder">Loading schema…</div>;
  const tables = Object.entries(schema);
  if (tables.length === 0) return <div className="sidebar-placeholder">No schema loaded.</div>;

  return (
    <div className="schema-tree">
      <p className="schema-label">
        {tables.length} table{tables.length !== 1 ? "s" : ""}
      </p>
      {tables.map(([tableName, columns]) => (
        <div key={tableName} className="schema-table">
          <button className="schema-table-header" onClick={() => toggleTable(tableName)}>
            {expandedTables[tableName]
              ? <ChevronDown size={12} />
              : <ChevronRight size={12} />}
            <Table2 size={13} className="table-icon" />
            <span>{tableName}</span>
            <span className="col-count">{columns.length}</span>
          </button>
          {expandedTables[tableName] && (
            <div className="schema-columns">
              {columns.map((col) => (
                <div key={col.name} className="schema-column">
                  {col.primaryKey
                    ? <Hash size={10} className="pk-icon" />
                    : <span className="col-dot" />}
                  <span className="col-name">{col.name}</span>
                  <span className="col-type">{col.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function HistoryPanel() {
  const [history, setHistory] = useState([]);
  const { setCurrentSQL } = useSql();

  React.useEffect(() => {
    import("../../utils/api").then(({ historyApi }) => {
      historyApi.get(30).then((d) => setHistory(d.history)).catch(() => {});
    });
  }, []);

  if (history.length === 0)
    return <div className="sidebar-placeholder">No queries yet. Start asking!</div>;

  return (
    <div className="history-list">
      {history.map((entry) => (
        <button
          key={entry.id}
          className={`history-entry ${entry.error ? "has-error" : ""}`}
          onClick={() => setCurrentSQL(entry.sql)}
          title={entry.sql}
        >
          <span className="history-question">{entry.question || entry.sql}</span>
          <span className="history-meta">
            {entry.rowCount != null
              ? `${entry.rowCount} rows`
              : entry.error ? "Error" : ""}
          </span>
        </button>
      ))}
    </div>
  );
}
