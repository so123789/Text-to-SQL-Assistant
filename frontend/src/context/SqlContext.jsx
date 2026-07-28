import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { schemaApi } from "../utils/api";

const SqlContext = createContext(null);

export function SqlProvider({ children }) {
  const [schema, setSchema] = useState({});
  const [dialect, setDialect] = useState("SQLite");
  const [conversationHistory, setConversationHistory] = useState([]);
  const [currentSQL, setCurrentSQL] = useState("");
  const [queryResult, setQueryResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [schemaLoading, setSchemaLoading] = useState(true);

  // Load demo schema on mount
  useEffect(() => {
    schemaApi.getDemo()
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
