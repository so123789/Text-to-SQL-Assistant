import React, { useEffect, useState } from "react";
import { BarChart3, Database, Sparkles } from "lucide-react";
import { healthApi } from "../../utils/api";
import ThemeSwitcher from "./ThemeSwitcher";
import "./TopNav.css";

function formatModelName(modelId) {
  if (!modelId) return "Model offline";
  const match = modelId.match(/^claude-([a-z]+)-(\d+)-(\d+)/);
  if (!match) return modelId;
  const [, family, major, minor] = match;
  return `Claude ${family[0].toUpperCase()}${family.slice(1)} ${major}.${minor}`;
}

export default function TopNav({ mode, setMode }) {
  const [modelLabel, setModelLabel] = useState(null);

  useEffect(() => {
    healthApi.get()
      .then((data) => setModelLabel(formatModelName(data.model)))
      .catch(() => setModelLabel(null));
  }, []);

  return (
    <header className="top-nav">
      <div className="top-brand">
        <span className="brand-mark"><Sparkles size={18} /></span>
        <span className="brand-copy"><strong>QueryLab</strong><small>AI data workspace</small></span>
      </div>

      <nav className="primary-nav" aria-label="Main navigation">
        <button className={mode === "sql" ? "active" : ""} onClick={() => setMode("sql")}>
          <Database size={15} /> SQL Assistant
        </button>
        <button className={mode === "investigation" ? "active" : ""} onClick={() => setMode("investigation")}>
          <BarChart3 size={15} /> Data Investigation
        </button>
      </nav>

      <div className="top-actions">
        <span className={`model-status ${modelLabel ? "online" : ""}`}>
          <i /> {modelLabel || "Checking model"}
        </span>
        <ThemeSwitcher />
      </div>
    </header>
  );
}
