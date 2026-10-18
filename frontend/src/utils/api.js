import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  timeout: 30000,
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message = err.response?.data?.error || err.message || "Request failed";
    throw new Error(message);
  }
);

export const sqlApi = {
  generate: (payload) => api.post("/sql/generate", payload),
  execute: (payload) => api.post("/sql/execute", payload),
  explain: (payload) => api.post("/sql/explain", payload),
  fix: (payload) => api.post("/sql/fix", payload),
  optimize: (payload) => api.post("/sql/optimize", payload),
};

export const schemaApi = {
  getDemo: () => api.get("/schema/demo"),
};

export const historyApi = {
  get: (limit = 50) => api.get(`/history?limit=${limit}`),
  clear: () => api.delete("/history"),
  delete: (id) => api.delete(`/history/${id}`),
};

export const uploadApi = {
  upload: (formData) =>
    fetch("/api/upload", { method: "POST", body: formData }).then((r) => r.json()),
  reset: () => api.post("/upload/reset"),
  status: () => api.get("/upload/status"),
};

function investigationSession() {
  const key = "sqlassist.investigationSession";
  let token = sessionStorage.getItem(key);
  if (!token) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    sessionStorage.setItem(key, token);
  }
  return token;
}

async function investigationRequest(path, options = {}) {
  const response = await fetch(`/api/investigation${path}`, {
    ...options,
    headers: { ...options.headers, "X-Investigation-Session": investigationSession() },
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const investigationApi = {
  upload: (file) => {
    const body = new FormData();
    body.append("file", file);
    return investigationRequest("/datasets", { method: "POST", body });
  },
  get: (id) => investigationRequest(`/datasets/${encodeURIComponent(id)}`),
  query: (id, sql) => investigationRequest(`/datasets/${encodeURIComponent(id)}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql }),
  }),
  investigate: (id, payload) => investigationRequest(`/datasets/${encodeURIComponent(id)}/investigate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }),
  delete: (id) => investigationRequest(`/datasets/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

export const healthApi = {
  get: () => api.get("/health"),
};

export default api;
