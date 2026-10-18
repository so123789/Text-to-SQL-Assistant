const express = require("express");
const multer = require("multer");
const { LIMITS, createStore, toPreview } = require("../services/datasetService");
const { executeInvestigationQuery } = require("../services/investigationQueryService");
const { investigateDataset } = require("../services/investigationAgentService");

function createInvestigationRouter(store = createStore(), investigate = investigateDataset) {
  const router = express.Router();
  let activeUploads = 0;
  const timer = setInterval(store.sweep, 60_000);
  timer.unref();

  const upload = multer({
    storage: multer.memoryStorage(),
    // Busboy counts the closing multipart boundary when enforcing `parts`.
    limits: { fileSize: LIMITS.bytes, files: 1, fields: 0, parts: 2 },
  }).single("file");

  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    const owner = req.get("X-Investigation-Session");
    if (!/^[a-f0-9]{64}$/.test(owner || "")) {
      return res.status(401).json({ error: "A valid investigation session is required." });
    }
    req.datasetOwner = owner;
    next();
  });

  router.post("/datasets", (req, res, next) => {
    if (activeUploads >= 2) return res.status(503).json({ error: "Uploads are busy. Try again shortly." });
    activeUploads += 1;
    let released = false;
    const release = () => {
      if (!released) { released = true; activeUploads -= 1; }
    };
    res.once("close", release);
    req.setTimeout(15_000, () => req.destroy());
    upload(req, res, (error) => {
      try {
        if (error) {
          const tooLarge = error.code === "LIMIT_FILE_SIZE";
          throw Object.assign(new Error(tooLarge ? "CSV exceeds 2 MiB." : "Upload exactly one CSV file and no extra fields."), { status: tooLarge ? 413 : 400 });
        }
        if (!req.file || !/\.csv$/i.test(req.file.originalname)) {
          throw Object.assign(new Error("Choose one .csv file."), { status: 400 });
        }
        const safeFilename = req.file.originalname.replace(/[\\/]/g, "_").slice(0, 200);
        const dataset = store.put(req.datasetOwner, req.file.buffer, safeFilename);
        res.status(201).json(toPreview(dataset));
      } catch (err) {
        next(err);
      } finally {
        release();
        req.setTimeout(0);
      }
    });
  });

  router.get("/datasets/:id", (req, res, next) => {
    try { res.json(toPreview(store.get(req.datasetOwner, req.params.id))); }
    catch (error) { next(error); }
  });

  router.post("/datasets/:id/query", async (req, res, next) => {
    try {
      const dataset = store.get(req.datasetOwner, req.params.id);
      const result = await executeInvestigationQuery(dataset, req.body?.sql);
      res.json(result);
    } catch (error) { next(error); }
  });

  router.post("/datasets/:id/investigate", async (req, res, next) => {
    try {
      const dataset = store.get(req.datasetOwner, req.params.id);
      const result = await investigate(dataset, {
        question: req.body?.question,
        conversationHistory: req.body?.conversationHistory ?? [],
      });
      res.json(result);
    } catch (error) { next(error); }
  });

  router.delete("/datasets/:id", (req, res, next) => {
    try { store.delete(req.datasetOwner, req.params.id); res.sendStatus(204); }
    catch (error) { next(error); }
  });

  return router;
}

module.exports = { createInvestigationRouter };
