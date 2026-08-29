const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const SCORES_FILE = path.join(__dirname, "scores.json");

app.use(express.json());
app.use(express.static(__dirname));

function loadScores() {
  try { return JSON.parse(fs.readFileSync(SCORES_FILE, "utf8")); }
  catch (e) { return []; }
}
function saveScores(list) {
  try { fs.writeFileSync(SCORES_FILE, JSON.stringify(list, null, 2)); } catch (e) {}
}

app.post("/api/submit", function (req, res) {
  const body = req.body || {};
  const name = String(body.name || "").trim().slice(0, 24);
  const score = Math.max(0, Math.min(1000000, parseInt(body.score, 10) || 0));
  if (!name) { res.status(400).json({ ok: false, error: "missing name" }); return; }
  const list = loadScores();
  let found = null;
  for (let i = 0; i < list.length; i++) { if (list[i].name === name) { found = list[i]; break; } }
  if (found) {
    if (score > found.score) found.score = score;
    found.updatedAt = Date.now();
  } else {
    list.push({ name: name, score: score, updatedAt: Date.now() });
  }
  saveScores(list);
  res.json({ ok: true });
});

app.get("/api/leaderboard", function (req, res) {
  const list = loadScores().slice().sort(function (a, b) { return b.score - a.score; });
  const top = list.slice(0, 100).map(function (e, i) {
    return { rank: i + 1, name: e.name, score: e.score, updatedAt: e.updatedAt };
  });
  res.json(top);
});

app.listen(PORT, function () { console.log("Quiz server listening on " + PORT); });
