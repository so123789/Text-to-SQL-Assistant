import React, { useState, useRef, useEffect, useMemo } from "react";
import Editor from "@monaco-editor/react";
import toast from "react-hot-toast";
import {
  Play, Wand2, Lightbulb, Wrench, Zap, RotateCcw, Copy, ChevronDown, ChevronUp
} from "lucide-react";
import { useSql } from "../../context/SqlContext";
import { sqlApi } from "../../utils/api";
import ResultsTable from "../chat/ResultsTable";
import ExplainPanel from "../chat/ExplainPanel";
import OptimizePanel from "../chat/OptimizePanel";
import { buildSampleQuestions } from "../../utils/sampleQuestions";
import "./MainWorkspace.css";

const MIN_PANEL_H = 120;
const COLLAPSED_H = 38; // tab bar height
const MIN_EDITOR_H = 140;
const LS_KEY = "sqlassist.resultsPanel";

function loadPanelState() {
  try {
    const v = JSON.parse(localStorage.getItem(LS_KEY));
    if (v && typeof v.height === "number") return { height: v.height, collapsed: !!v.collapsed };
  } catch { /* ignore */ }
  return { height: 280, collapsed: false };
}

export default function MainWorkspace() {
  const {
    schema, dialect, conversationHistory, addToHistory,
    currentSQL, setCurrentSQL, queryResult, setQueryResult,
    isLoading, setIsLoading,
  } = useSql();

  const [question, setQuestion] = useState("");
  const [activePanel, setActivePanel] = useState("results"); // results | explain | optimize
  const [explanation, setExplanation] = useState(null);
  const [optimization, setOptimization] = useState(null);
  const [queryError, setQueryError] = useState(null);
  const editorRef = useRef(null);
  const sampleQuestions = useMemo(() => buildSampleQuestions(schema), [schema]);
  const workspaceRef = useRef(null);
  const [panel, setPanel] = useState(loadPanelState);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(panel)); } catch { /* ignore */ }
  }, [panel]);

  const maxPanelH = () => {
    const total = workspaceRef.current?.clientHeight ?? window.innerHeight;
    return Math.max(MIN_PANEL_H, total - MIN_EDITOR_H - 90);
  };

  // Keep panel within bounds when the window is resized
  useEffect(() => {
    const onResize = () =>
      setPanel((p) => (p.height > maxPanelH() ? { ...p, height: maxPanelH() } : p));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function startResize(e) {
    e.preventDefault();
    const startY = e.clientY;
    const startH = panel.collapsed ? COLLAPSED_H : panel.height;
    const max = maxPanelH();
    setDragging(true);

    const onMove = (ev) => {
      const next = startH + (startY - ev.clientY);
      if (next < MIN_PANEL_H / 2) {
        setPanel((p) => ({ ...p, collapsed: true }));
      } else {
        setPanel({ collapsed: false, height: Math.min(max, Math.max(MIN_PANEL_H, next)) });
      }
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const toggleCollapsed = () => setPanel((p) => ({ ...p, collapsed: !p.collapsed }));
  const showTab = (name) => { setActivePanel(name); setPanel((p) => ({ ...p, collapsed: false })); };

  // Sync external SQL changes into the editor
  useEffect(() => {
    if (currentSQL && editorRef.current) {
      editorRef.current.setValue(currentSQL);
    }
  }, [currentSQL]);

  const getEditorSQL = () => editorRef.current?.getValue()?.trim() || "";

  async function handleGenerate() {
    if (!question.trim()) return;
    setIsLoading(true);
    setQueryError(null);
    try {
      const { sql } = await sqlApi.generate({
        question,
        schema,
        dialect,
        conversationHistory,
      });
      setCurrentSQL(sql);
      editorRef.current?.setValue(sql);
      addToHistory("user", question);
      addToHistory("assistant", sql);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleExecute() {
    const sql = getEditorSQL();
    if (!sql) { toast.error("Write or generate a SQL query first."); return; }
    setIsLoading(true);
    setQueryError(null);
    setQueryResult(null);
    setActivePanel("results");
    try {
      const result = await sqlApi.execute({ sql, schema, dialect });
      if (result.error) {
        setQueryError(result.error);
        toast.error("Query failed — try AI Fix");
      } else {
        setQueryResult(result);
        toast.success(`${result.rowCount} row${result.rowCount !== 1 ? "s" : ""} · ${result.executionTime}ms`);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleExplain() {
    const sql = getEditorSQL();
    if (!sql) { toast.error("No SQL to explain."); return; }
    setIsLoading(true);
    setActivePanel("explain");
    try {
      const { explanation: text } = await sqlApi.explain({ sql, schema, dialect });
      setExplanation(text);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFix() {
    if (!queryError) { toast("No error to fix."); return; }
    const sql = getEditorSQL();
    setIsLoading(true);
    try {
      const { sql: fixedSQL } = await sqlApi.fix({ sql, error: queryError, schema, dialect });
      editorRef.current?.setValue(fixedSQL);
      setCurrentSQL(fixedSQL);
      setQueryError(null);
      toast.success("Query fixed — run it to verify.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOptimize() {
    const sql = getEditorSQL();
    if (!sql) { toast.error("No SQL to optimize."); return; }
    setIsLoading(true);
    setActivePanel("optimize");
    try {
      const result = await sqlApi.optimize({ sql, schema, dialect });
      setOptimization(result);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleCopy() {
    const sql = getEditorSQL();
    if (sql) { navigator.clipboard.writeText(sql); toast.success("Copied!"); }
  }

  function handleClear() {
    editorRef.current?.setValue("");
    setCurrentSQL("");
    setQueryResult(null);
    setQueryError(null);
    setExplanation(null);
    setOptimization(null);
    setQuestion("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  }

  return (
    <main className={`workspace ${dragging ? "is-resizing" : ""}`} ref={workspaceRef}>
      {/* Top — Question input */}
      <div className="question-bar">
        <div className="question-input-wrap">
          <Wand2 size={16} className="question-icon" />
          <input
            className="question-input"
            placeholder="Ask anything — e.g. 'Top 5 customers by revenue'"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            className="btn-generate"
            onClick={handleGenerate}
            disabled={isLoading || !question.trim()}
          >
            {isLoading ? "Thinking…" : "Generate SQL"}
          </button>
        </div>

        <div className="sample-questions">
          {sampleQuestions.map((q) => (
            <button
              key={q}
              className="sample-chip"
              onClick={() => { setQuestion(q); }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Middle — Monaco SQL Editor */}
      <div className="editor-section">
        <div className="editor-toolbar">
          <span className="toolbar-label">SQL Editor</span>
          <div className="toolbar-actions">
            <button className="toolbar-btn" onClick={handleCopy} title="Copy SQL">
              <Copy size={13} /> Copy
            </button>
            <button className="toolbar-btn" onClick={handleClear} title="Clear all">
              <RotateCcw size={13} /> Clear
            </button>
            <button
              className={`toolbar-btn ${queryError ? "btn-warning" : ""}`}
              onClick={handleFix}
              disabled={!queryError || isLoading}
              title="AI Fix error"
            >
              <Wrench size={13} /> Fix Error
            </button>
            <button className="toolbar-btn" onClick={handleExplain} disabled={isLoading} title="Explain query">
              <Lightbulb size={13} /> Explain
            </button>
            <button className="toolbar-btn" onClick={handleOptimize} disabled={isLoading} title="Optimize query">
              <Zap size={13} /> Optimize
            </button>
            <button className="btn-run" onClick={handleExecute} disabled={isLoading}>
              <Play size={13} /> Run
            </button>
          </div>
        </div>

        <div className="monaco-wrap">
          <Editor
            defaultValue="-- Generate SQL above, or write your own query here\n"
            language="sql"
            theme="vs-dark"
            options={{
              fontSize: 13,
              fontFamily: "IBM Plex Mono, Courier New, monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: "on",
              padding: { top: 12, bottom: 12 },
              wordWrap: "on",
              automaticLayout: true,
              renderLineHighlight: "line",
              lineDecorationsWidth: 4,
            }}
            onMount={(editor) => { editorRef.current = editor; }}
          />
        </div>

        {queryError && (
          <div className="error-banner">
            <span className="error-dot" />
            <span>{queryError}</span>
            <button className="error-fix-btn" onClick={handleFix} disabled={isLoading}>
              <Wrench size={12} /> AI Fix
            </button>
          </div>
        )}
      </div>

      {/* Bottom — Results / Explain / Optimize panels */}
      <div
        className={`results-section ${panel.collapsed ? "collapsed" : ""}`}
        style={{ height: panel.collapsed ? COLLAPSED_H : panel.height }}
      >
        <div
          className="resize-handle"
          onPointerDown={startResize}
          onDoubleClick={toggleCollapsed}
          role="separator"
          aria-orientation="horizontal"
          title="Drag to resize · double-click to collapse"
        />
        <div className="results-tabs">
          <button
            className={`results-tab ${activePanel === "results" ? "active" : ""}`}
            onClick={() => showTab("results")}
          >
            Results {queryResult ? `(${queryResult.rowCount})` : ""}
          </button>
          <button
            className={`results-tab ${activePanel === "explain" ? "active" : ""}`}
            onClick={() => showTab("explain")}
          >
            Explanation
          </button>
          <button
            className={`results-tab ${activePanel === "optimize" ? "active" : ""}`}
            onClick={() => showTab("optimize")}
          >
            Optimization
          </button>
          <button
            className="panel-toggle"
            onClick={toggleCollapsed}
            title={panel.collapsed ? "Expand panel" : "Collapse panel"}
            aria-label={panel.collapsed ? "Expand panel" : "Collapse panel"}
          >
            {panel.collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        <div className="results-body" hidden={panel.collapsed}>
          {activePanel === "results" && (
            <ResultsTable result={queryResult} loading={isLoading} />
          )}
          {activePanel === "explain" && (
            <ExplainPanel explanation={explanation} loading={isLoading} />
          )}
          {activePanel === "optimize" && (
            <OptimizePanel optimization={optimization} loading={isLoading}
              onApply={(sql) => { editorRef.current?.setValue(sql); setCurrentSQL(sql); }} />
          )}
        </div>
      </div>
    </main>
  );
}
