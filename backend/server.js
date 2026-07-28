const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const sqlRoutes = require("./routes/sql");
const schemaRoutes = require("./routes/schema");
const historyRoutes = require("./routes/history");
const healthRoutes = require("./routes/health");
const uploadRoutes = require("./routes/upload");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(morgan("dev"));
app.use(cors({ origin: ["http://localhost:5173", "http://localhost:3000"] }));
app.use(express.json({ limit: "2mb" }));

const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max: Number(process.env.RATE_LIMIT_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — please wait a moment." },
});
app.use("/api/sql", limiter);

app.use("/api/sql", sqlRoutes);
app.use("/api/schema", schemaRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/upload", uploadRoutes);

const path = require("path");

// Serve built frontend in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
  });
}

app.use((req, res) => res.status(404).json({ error: "Route not found" }));

app.use((err, req, res, next) => {
  console.error("[Server Error]", err.message);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`\n🚀 AI SQL Assistant backend running on http://localhost:${PORT}`);
  console.log(`   Groq key: ${process.env.GROQ_API_KEY ? "✅ loaded" : "❌ MISSING — add to .env"}\n`);
});
