const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
require("dotenv").config();

const sqlRoutes     = require("./routes/sql");
const schemaRoutes  = require("./routes/schema");
const historyRoutes = require("./routes/history");
const healthRoutes  = require("./routes/health");
const uploadRoutes  = require("./routes/upload");

const app  = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === "production";

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan(isProd ? "combined" : "dev"));
app.use(cors({ origin: isProd ? false : ["http://localhost:5173", "http://localhost:3000"] }));
app.use(express.json({ limit: "2mb" }));

const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max:      Number(process.env.RATE_LIMIT_MAX) || 30,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: "Too many requests — please wait a moment." },
});
app.use("/api/sql", limiter);

app.use("/api/sql",     sqlRoutes);
app.use("/api/schema",  schemaRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/health",  healthRoutes);
app.use("/api/upload",  uploadRoutes);

// Serve built React app in production
if (isProd) {
  const distPath = path.join(__dirname, "../frontend/dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.use((req, res) => res.status(404).json({ error: "Route not found" }));

app.use((err, req, res, next) => {
  console.error("[Error]", err.message);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server on port ${PORT} [${isProd ? "production" : "development"}]`);
  console.log(`   Groq key: ${process.env.GROQ_API_KEY ? "✅ loaded" : "❌ MISSING"}\n`);
});