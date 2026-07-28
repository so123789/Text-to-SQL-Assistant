import React from "react";
import { Toaster } from "react-hot-toast";
import { SqlProvider } from "./context/SqlContext";
import { ThemeProvider } from "./context/ThemeContext";
import Sidebar from "./components/ui/Sidebar";
import MainWorkspace from "./components/editor/MainWorkspace";
import "./App.css";

export default function App() {
  return (
    <ThemeProvider>
      <SqlProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--bg-raised)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              fontFamily: "Inter, sans-serif",
              fontSize: "13px",
            },
            success: { iconTheme: { primary: "var(--success)", secondary: "var(--bg-deep)" } },
            error:   { iconTheme: { primary: "var(--error)",   secondary: "var(--bg-deep)" } },
          }}
        />
        <div className="app-shell">
          <Sidebar />
          <MainWorkspace />
        </div>
      </SqlProvider>
    </ThemeProvider>
  );
}
