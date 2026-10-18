import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { uploadApi } from "../utils/api";

const SqlContext = createContext(null);

export function SqlProvider({ children }) {
  const [schema, setSchema] = useState({});
  const [dialect, setDialect] = useState("SQLite");
  const [conversationHistory, setConversationHistory] = useState([]);
  const [currentSQL, setCurrentSQL] = useState("");
  const [queryResult, setQueryResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [schemaLoading, setSchemaLoading] = useState(true);
  // Keeps a browser-memory reference to a single CSV selected in SQL mode so
  // Investigation mode can offer it without asking the user to browse again.
  const [investigationCandidate, setInvestigationCandidate] = useState(null);

  // A full page reload starts a fresh SQL session and discards prior uploads.
  useEffect(() => {
    uploadApi.reset()
      .then(({ schema }) => setSchema(schema))
      .catch(console.error)
      .finally(() => setSchemaLoading(false));
  }, []);

  const addToHistory = useCallback((role, content) => {
    setConversationHistory((prev) => [...prev, { role, content }]);
  }, []);

  const clearConversation = useCallback(() => {
    setConversationHistory([]);
  }, []);

  return (
    <SqlContext.Provider value={{
      schema, setSchema, dialect, setDialect,
      conversationHistory, addToHistory, clearConversation,
      currentSQL, setCurrentSQL,
      queryResult, setQueryResult,
      isLoading, setIsLoading,
      schemaLoading,
      investigationCandidate, setInvestigationCandidate,
    }}>
      {children}
    </SqlContext.Provider>
  );
}

export function useSql() {
  const ctx = useContext(SqlContext);
  if (!ctx) throw new Error("useSql must be used within SqlProvider");
  return ctx;
}
