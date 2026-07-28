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

export default api;
