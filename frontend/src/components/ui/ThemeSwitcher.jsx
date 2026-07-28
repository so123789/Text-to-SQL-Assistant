import React, { useState, useRef, useEffect } from "react";
import { Palette, Check } from "lucide-react";
import { useTheme, THEMES } from "../../context/ThemeContext";
import "./ThemeSwitcher.css";

export default function ThemeSwitcher() {
  const { themeKey, setThemeKey } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef();

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="theme-switcher" ref={ref}>
      <button
        className="theme-trigger"
        onClick={() => setOpen((p) => !p)}
        title="Switch theme"
      >
        <Palette size={14} />
        <span>{THEMES[themeKey]?.emoji}</span>
      </button>

      {open && (
        <div className="theme-dropdown">
          <p className="theme-dropdown-label">Theme</p>
          {Object.entries(THEMES).map(([key, theme]) => (
            <button
              key={key}
              className={`theme-option ${themeKey === key ? "active" : ""}`}
              onClick={() => { setThemeKey(key); setOpen(false); }}
            >
              <span className="theme-emoji">{theme.emoji}</span>
              <span className="theme-name">{theme.label}</span>
              {themeKey === key && <Check size={12} className="theme-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
