const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

function getScoresFile(subject) {
  const s = String(subject || "lsd").toLowerCase().trim();
  if (s === "pldc") {
    return path.join(__dirname, "scores_pldc.json");
  }
  const lsdFile = path.join(__dirname, "scores_lsd.json");
  const oldFile = path.join(__dirname, "scores.json");
  if (!fs.existsSync(lsdFile) && fs.existsSync(oldFile)) {
    try {
      fs.copyFileSync(oldFile, lsdFile);
    } catch (e) {}
  }
  return lsdFile;
}

function loadScores(subject) {
  const file = getScoresFile(subject);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return [];
  }
}

function saveScores(subject, list) {
  const file = getScoresFile(subject);
  try {
    fs.writeFileSync(file, JSON.stringify(list, null, 2));
  } catch (e) {}
}

app.post("/api/submit", function (req, res) {
  const body = req.body || {};
  const subject = String(body.subject || "lsd").toLowerCase().trim();
  const name = String(body.name || "").trim().slice(0, 24);
  const score = Math.max(0, Math.min(1000000, parseInt(body.score, 10) || 0));

  if (!name) {
    res.status(400).json({ ok: false, error: "missing name" });
    return;
  }

  const list = loadScores(subject);
  let found = null;
  for (let i = 0; i < list.length; i++) {
    if (list[i].name === name) {
      found = list[i];
      break;
    }
  }

  if (found) {
    if (score > found.score) found.score = score;
    found.updatedAt = Date.now();
  } else {
    list.push({ name: name, score: score, updatedAt: Date.now() });
  }

  saveScores(subject, list);
  res.json({ ok: true });
});

app.get("/api/leaderboard", function (req, res) {
  const subject = String(req.query.subject || "lsd").toLowerCase().trim();
  const list = loadScores(subject).slice().sort(function (a, b) {
    return b.score - a.score;
  });
  const top = list.slice(0, 100).map(function (e, i) {
    return { rank: i + 1, name: e.name, score: e.score, updatedAt: e.updatedAt };
  });
  res.json(top);
});

app.listen(PORT, function () {
  console.log("Quiz server listening on " + PORT);
});
