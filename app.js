/* ===== Lịch sử Đảng — quiz engine ===== */
(function () {
  "use strict";

  var DATA = window.QUIZ_DATA || { chapters: [] };
  var STORE_KEY = "lsd_quiz_results_v2";

  // Rank ladder (LoL tiers) — advances with total correct answers across all Bài.
  var RANKS = [
    { key: "iron",        name: "Hạng Sắt",        min: 0 },
    { key: "bronze",      name: "Hạng Đồng",       min: 30 },
    { key: "silver",      name: "Hạng Bạc",        min: 70 },
    { key: "gold",        name: "Hạng Vàng",       min: 120 },
    { key: "platinum",    name: "Hạng Bạch Kim",   min: 180 },
    { key: "emerald",     name: "Hạng Lục Bảo",    min: 250 },
    { key: "diamond",     name: "Hạng Kim Cương",  min: 330 },
    { key: "master",      name: "Hạng Cao Thủ",    min: 410 },
    { key: "grandmaster", name: "Hạng Đại Cao Thủ", min: 460 },
    { key: "challenger",  name: "Hạng Thách Đấu",  min: 490 }
  ];

  /* ---------- storage ---------- */
  function loadResults() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveResults(r) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(r)); } catch (e) {}
  }
  var results = loadResults();

  /* ---------- flatten for dashboard ---------- */
  var FLAT = []; // {id, ch, q}
  DATA.chapters.forEach(function (ch) {
    (ch.questions || []).forEach(function (q) {
      FLAT.push({ id: q.id, ch: ch.title, q: q });
    });
  });

  /* ---------- elements ---------- */
  var tree = document.getElementById("tree");
  var content = document.getElementById("content");
  var crumb = document.getElementById("crumb");
  var lessonProgress = document.getElementById("lessonProgress");
  var welcome = document.getElementById("welcome");
  var dashModal = document.getElementById("dashModal");
  var dashBody = document.getElementById("dashBody");

  /* ---------- sidebar tree (one button per Bài) ---------- */
  function renderTree() {
    tree.innerHTML = "";
    DATA.chapters.forEach(function (ch, ci) {
      var total = 0, done = 0, correct = 0;
      ch.questions.forEach(function (q) {
        total++;
        var r = results[q.id];
        if (r) { done++; if (r.status === "correct") correct++; }
      });
      var b = document.createElement("button");
      b.className = "lesson-btn";
      b.setAttribute("data-ci", ci);
      b.innerHTML = "<span>" + esc(ch.title) + "</span><span class='lp'><span class='a'>" +
        correct + "</span>/<span class='w'>" + (total - correct) + "</span> (" + done + "/" + total + ")</span>";
      b.onclick = function () { selectBai(ci); closeSidebarMobile(); };
      tree.appendChild(b);
    });
  }

  /* ---------- select & render a Bài ---------- */
  var current = null;
  function selectBai(ci) {
    current = { ci: ci };
    welcome.style.display = "none";
    var ch = DATA.chapters[ci];
    crumb.textContent = ch.title;
    document.querySelectorAll(".lesson-btn").forEach(function (b) {
      b.classList.toggle("active", +b.getAttribute("data-ci") === ci);
    });
    renderBai(ci);
    scrollToProgress(ci);
    updateBaiProgress(ci);
  }

  function updateBaiProgress(ci) {
    var ch = DATA.chapters[ci];
    var t = ch.questions.length, d = 0, c = 0;
    ch.questions.forEach(function (q) {
      var r = results[q.id];
      if (r) { d++; if (r.status === "correct") c++; }
    });
    lessonProgress.innerHTML = "Đã làm <b>" + d + "/" + t + "</b> · Đúng <b style='color:var(--ok)'>" + c +
      "</b> · Sai <b style='color:var(--bad)'>" + (d - c) + "</b>";
  }

  function renderBai(ci) {
    var ch = DATA.chapters[ci];
    content.innerHTML = "";

    var bar = document.createElement("div");
    bar.className = "lesson-actions";
    var retry = document.createElement("button");
    retry.className = "mini-btn";
    retry.textContent = "↺ Làm lại bài này";
    retry.onclick = function () {
      if (confirm("Xóa kết quả \"" + ch.title + "\"?")) {
        ch.questions.forEach(function (q) { delete results[q.id]; });
        saveResults(results); renderBai(ci); renderTree(); updateBaiProgress(ci);
      }
    };
    bar.appendChild(retry);
    content.appendChild(bar);

    ch.questions.forEach(function (q, qi) { content.appendChild(buildCard(ci, qi, q)); });
    updateBaiProgress(ci);
  }

  function buildCard(ci, qi, q) {
    var id = q.id;
    var r = results[id];
    var card = document.createElement("div");
    card.className = "q-card";
    var opts = q.options || {};
    var letters = ["A", "B", "C", "D"];

    var no = document.createElement("div");
    no.className = "q-no"; no.textContent = (qi + 1);
    card.appendChild(no);

    var qt = document.createElement("div");
    qt.className = "q-text"; qt.textContent = q.q || "(câu hỏi)";
    card.appendChild(qt);

    if (q.tiet) {
      var tg = document.createElement("div");
      tg.className = "q-tiet"; tg.textContent = "Tiết " + q.tiet;
      card.appendChild(tg);
    }

    var wrap = document.createElement("div");
    wrap.className = "options";
    letters.forEach(function (L) {
      if (!opts[L]) return;
      var btn = document.createElement("button");
      btn.className = "opt";
      btn.innerHTML = '<span class="key">' + L + '</span><span class="oval">' + esc(opts[L]) + "</span>";
      btn.onclick = function () { onAnswer(ci, qi, q, L, card, btn); };
      wrap.appendChild(btn);
    });
    card.appendChild(wrap);

    var fb = document.createElement("div");
    fb.className = "feedback";
    card.appendChild(fb);

    if (r) { markCard(card, q, r.chosen, r.status, false); }
    return card;
  }

  function onAnswer(ci, qi, q, chosen, card, btn) {
    var id = q.id;
    if (results[id] && results[id].status === "correct") return; // chỉ khóa khi đã chọn đúng
    var isCorrect = (chosen === q.answer);
    if (isCorrect) {
      results[id] = { status: "correct", chosen: chosen };
      saveResults(results);
      markCard(card, q, chosen, "correct", true);
      playTone("correct");
    } else {
      results[id] = { status: "wrong", chosen: chosen };
      saveResults(results);
      markCard(card, q, chosen, "wrong", true);
      playTone("wrong");
    }
    if (current) { updateBaiProgress(current.ci); renderTree(); }
    updateRank();
  }

  function markCard(card, q, chosen, status, animate) {
    var opts = card.querySelectorAll(".opt");
    var fb = card.querySelector(".feedback");
    var correct = q.answer;

    opts.forEach(function (b) {
      b.classList.remove("locked", "correct", "wrong", "dim");
      b.disabled = false;
      var old = b.querySelector(".badge"); if (old) old.remove();
      var key = b.querySelector(".key").textContent;
      if (key === correct) {
        b.classList.add("correct");
        var bd = document.createElement("span"); bd.className = "badge"; bd.textContent = "✓ Đúng";
        b.appendChild(bd);
        // khi đang ở trạng thái sai, giữ đáp án đúng còn bấm được để user chọn cho xong
        if (status !== "wrong") b.disabled = true;
      } else if (key === chosen && status === "wrong") {
        b.classList.add("wrong", "locked");
        b.disabled = true;
      } else {
        b.classList.add("dim", "locked");
        b.disabled = true;
      }
    });

    fb.className = "feedback show " + (status === "correct" ? "ok" : "bad");
    if (status === "correct") {
      fb.innerHTML = '<span class="fb-title">✅ Chính xác</span>' +
        (q.explain ? "<b>Giải thích:</b> " + esc(q.explain) : "");
    } else {
      fb.innerHTML = '<span class="fb-title">❌ Chưa đúng — thử lại nhé</span>' +
        (q.hint ? "<b>Gợi ý:</b> " + esc(q.hint) + "<br>" : "") +
        "<span class='reveal-correct'>Đáp án đúng là: <b>" + correct + "</b>. " +
        (q.explain ? esc(q.explain) : "") + "</span>";
    }
  }

  /* ---------- dashboard ---------- */
  function openDashboard() {
    var total = FLAT.length, done = 0, correct = 0;
    FLAT.forEach(function (f) { if (results[f.id]) { done++; if (results[f.id].status === "correct") correct++; } });

    var acc = done ? Math.round((correct / done) * 100) : 0;
    var html = "";
    html += '<div class="stat-grid">';
    html += stat(total, "Tổng câu");
    html += stat(done, "Đã làm");
    html += stat(correct, "Đúng");
    html += stat(done - correct, "Sai");
    html += stat(acc + "%", "Tỉ lệ đúng");
    html += "</div>";

    var byCh = {};
    FLAT.forEach(function (f) {
      if (!byCh[f.ch]) byCh[f.ch] = { t: 0, d: 0, c: 0 };
      byCh[f.ch].t++;
      if (results[f.id]) { byCh[f.ch].d++; if (results[f.id].status === "correct") byCh[f.ch].c++; }
    });
    html += "<h3 style='font-family:var(--serif);margin:6px 0 10px'>Kết quả theo Bài</h3>";
    Object.keys(byCh).forEach(function (ch) {
      var o = byCh[ch];
      var a = o.d ? Math.round((o.c / o.d) * 100) : 0;
      html += '<div class="chapter-stat"><h4>' + esc(ch) + "</h4>";
      html += barRow("Đã làm " + o.d + "/" + o.t, a, o.c + "/" + o.d + " đúng");
      html += "</div>";
    });

    if (done === 0) html += "<p style='color:var(--ink-soft)'>Chưa có câu nào được làm. Hãy bắt đầu chọn bài học bên trái.</p>";
    dashBody.innerHTML = html;
    dashModal.classList.remove("hidden");
  }
  function stat(n, l) { return '<div class="stat"><div class="n">' + n + '</div><div class="l">' + l + "</div></div>"; }
  function barRow(name, pct, val) {
    return '<div class="bar-row"><span class="name">' + name + '</span>' +
      '<span class="bar-track"><span class="bar-fill" style="width:' + pct + '%"></span></span>' +
      '<span class="bar-val">' + val + " · " + pct + "%</span></div>";
  }

  /* ---------- rank ladder ---------- */
  function totalCorrect() {
    var c = 0;
    FLAT.forEach(function (f) { if (results[f.id] && results[f.id].status === "correct") c++; });
    return c;
  }
  function computeRank() {
    var correct = totalCorrect(), total = FLAT.length;
    var cur = RANKS[0], next = null;
    for (var i = 0; i < RANKS.length; i++) {
      if (correct >= RANKS[i].min) { cur = RANKS[i]; next = RANKS[i + 1] || null; }
    }
    var pct, sub;
    if (next) {
      var span = next.min - cur.min;
      var got = correct - cur.min;
      pct = span > 0 ? Math.max(0, Math.min(100, Math.round(got / span * 100))) : 100;
      sub = (next.min - correct) + " câu nữa → " + next.name;
    } else { pct = 100; sub = "Đạt rank cao nhất!"; }
    return { cur: cur, next: next, correct: correct, total: total, pct: pct, sub: sub };
  }
  function updateRank() {
    var rb = document.getElementById("rankBar");
    if (!rb) return;
    var r = computeRank();
    var fill = r.cur.key === "challenger" ? "var(--gold)" : "linear-gradient(90deg,var(--gold),#e6c057)";
    rb.innerHTML =
      '<img class="rank-emblem" src="ranks/' + r.cur.key + '.png" alt="' + r.cur.name + '">' +
      '<div class="rb-meta"><span class="rb-name">' + r.cur.name + "</span>" +
      '<span class="rb-sub">' + r.correct + "/" + r.total + " đúng · " + r.sub + "</span></div>" +
      '<span class="rb-track"><span class="rb-fill" style="width:' + r.pct + '%;background:' + fill + '"></span></span>' +
      '<span class="rb-pct">' + r.pct + "%</span>";
  }

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function closeSidebarMobile() {
    if (window.innerWidth <= 860) document.getElementById("sidebar").classList.remove("open");
  }

  var _audioCtx = null;
  function _getCtx() {
    if (!_audioCtx) { try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    return _audioCtx;
  }
  function _tone(ctx, freq, start, dur, vol) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(start); o.stop(start + dur + 0.03);
  }
  function playTone(kind) {
    var ctx = _getCtx(); if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    var t = ctx.currentTime;
    if (kind === "correct") {
      _tone(ctx, 587.33, t, 0.13, 0.16);
      _tone(ctx, 880.00, t + 0.13, 0.20, 0.16);
    } else {
      _tone(ctx, 207.65, t, 0.26, 0.13);
    }
  }

  function scrollToProgress(ci) {
    var ch = DATA.chapters[ci];
    var cards = content.querySelectorAll(".q-card");
    var target = null;
    for (var i = 0; i < ch.questions.length; i++) {
      var r = results[ch.questions[i].id];
      if (!(r && r.status === "correct")) { target = cards[i]; break; }
    }
    if (!target) target = cards[0];
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- wire controls ---------- */
  document.getElementById("btnDashboard").onclick = openDashboard;
  document.getElementById("btnDashClose").onclick = function () { dashModal.classList.add("hidden"); };
  dashModal.onclick = function (e) { if (e.target === dashModal) dashModal.classList.add("hidden"); };
  document.getElementById("btnMenu").onclick = function () { document.getElementById("sidebar").classList.toggle("open"); };
  document.getElementById("btnResetAll").onclick = function () {
    if (confirm("Xóa TOÀN BỘ tiến độ đã làm?")) {
      results = {}; saveResults(results); renderTree();
      if (current) { renderBai(current.ci); updateBaiProgress(current.ci); }
      lessonProgress.innerHTML = "";
      updateRank();
    }
  };

  /* ---------- init ---------- */
  renderTree();
  updateRank();

  if (!DATA.chapters.length) {
    content.innerHTML = "<div class='welcome'><h1>Chưa có dữ liệu</h1><p>File <code>data.js</code> chưa được tạo. Hãy chạy merge để sinh dữ liệu câu hỏi.</p></div>";
  }
})();
