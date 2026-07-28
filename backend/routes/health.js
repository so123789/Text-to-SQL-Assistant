const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    status: "ok",
    groqKey: !!process.env.GROQ_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
