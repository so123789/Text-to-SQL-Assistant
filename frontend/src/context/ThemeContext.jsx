import React, { createContext, useContext, useState, useEffect } from "react";

// ── Theme definitions ─────────────────────────────────────────────────────────
export const THEMES = {
  dark: {
    label: "Dark",
    emoji: "🌑",
    vars: {
      "--bg-deep":    "#0d0f14",
      "--bg-surface": "#13161f",
      "--bg-raised":  "#1a1e2a",
      "--bg-hover":   "#222638",
      "--border":     "#2a2f40",
      "--border-lit": "#3d4460",
      "--text-primary":   "#e8eaf0",
      "--text-secondary": "#8b91a8",
      "--text-muted":     "#555c72",
      "--accent":      "#5b8af0",
      "--accent-dim":  "rgba(91,138,240,0.15)",
      "--accent-glow": "rgba(91,138,240,0.35)",
      "--success": "#3ecf7a",
      "--warning": "#f0a444",
      "--error":   "#f05b5b",
    },
  },
  light: {
    label: "Light",
    emoji: "☀️",
    vars: {
      "--bg-deep":    "#f0f2f8",
      "--bg-surface": "#ffffff",
      "--bg-raised":  "#f7f8fc",
      "--bg-hover":   "#edf0f8",
      "--border":     "#dde1ef",
      "--border-lit": "#c2c8e0",
      "--text-primary":   "#1a1d2e",
      "--text-secondary": "#4a5068",
      "--text-muted":     "#9099b8",
      "--accent":      "#3b6ef0",
      "--accent-dim":  "rgba(59,110,240,0.10)",
      "--accent-glow": "rgba(59,110,240,0.25)",
      "--success": "#1aa85c",
      "--warning": "#d48800",
      "--error":   "#d63c3c",
    },
  },
  midnight: {
    label: "Midnight",
    emoji: "🌌",
    vars: {
      "--bg-deep":    "#07080d",
      "--bg-surface": "#0d0f18",
      "--bg-raised":  "#121520",
      "--bg-hover":   "#191c2c",
      "--border":     "#1e2235",
      "--border-lit": "#2d3250",
      "--text-primary":   "#cdd6f4",
      "--text-secondary": "#7480a8",
      "--text-muted":     "#3d4460",
      "--accent":      "#89b4fa",
      "--accent-dim":  "rgba(137,180,250,0.12)",
      "--accent-glow": "rgba(137,180,250,0.30)",
      "--success": "#a6e3a1",
      "--warning": "#fab387",
      "--error":   "#f38ba8",
    },
  },
  forest: {
    label: "Forest",
    emoji: "🌿",
    vars: {
      "--bg-deep":    "#0b1010",
      "--bg-surface": "#111a18",
      "--bg-raised":  "#172220",
      "--bg-hover":   "#1e2e2b",
      "--border":     "#243530",
      "--border-lit": "#344d47",
      "--text-primary":   "#d4e6df",
      "--text-secondary": "#7aaa96",
      "--text-muted":     "#445f58",
      "--accent":      "#4ecba0",
      "--accent-dim":  "rgba(78,203,160,0.13)",
      "--accent-glow": "rgba(78,203,160,0.30)",
      "--success": "#4ecba0",
      "--warning": "#f0c060",
      "--error":   "#f07070",
    },
  },
  sunset: {
    label: "Sunset",
    emoji: "🌅",
    vars: {
      "--bg-deep":    "#100c14",
      "--bg-surface": "#18121e",
      "--bg-raised":  "#201828",
      "--bg-hover":   "#281e32",
      "--border":     "#302440",
      "--border-lit": "#4a3660",
      "--text-primary":   "#f0e6ff",
      "--text-secondary": "#a882cc",
      "--text-muted":     "#5a4070",
      "--accent":      "#d080ff",
      "--accent-dim":  "rgba(208,128,255,0.13)",
      "--accent-glow": "rgba(208,128,255,0.30)",
      "--success": "#80ffb0",
      "--warning": "#ffb060",
      "--error":   "#ff6080",
    },
  },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKey] = useState(
    () => localStorage.getItem("sqlai-theme") || "dark"
  );

  // Apply CSS variables to :root whenever theme changes
  useEffect(() => {
    const theme = THEMES[themeKey] || THEMES.dark;
    const root = document.documentElement;
    Object.entries(theme.vars).forEach(([key, val]) => {
      root.style.setProperty(key, val);
    });
    localStorage.setItem("sqlai-theme", themeKey);
  }, [themeKey]);

  return (
    <ThemeContext.Provider value={{ themeKey, setThemeKey, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
