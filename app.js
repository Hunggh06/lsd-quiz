/* ===== Lịch sử Đảng — quiz engine ===== */
(function () {
  "use strict";

  var DATA = window.QUIZ_DATA || { chapters: [] };
  var STORE_KEY = "lsd_quiz_results_v2";

  // Rank ladder (LoL tiers) — advances with total correct answers across all Bài.
  var RANKS = [
    { key: "1",  name: "Hạng Sắt",        min: 0 },
    { key: "2",  name: "Hạng Đồng",       min: 30 },
    { key: "3",  name: "Hạng Bạc",        min: 70 },
    { key: "4",  name: "Hạng Vàng",       min: 120 },
    { key: "5",  name: "Hạng Bạch Kim",   min: 180 },
    { key: "6",  name: "Hạng Lục Bảo",    min: 250 },
    { key: "7",  name: "Hạng Kim Cương",  min: 330 },
    { key: "8",  name: "Hạng Cao Thủ",    min: 410 },
    { key: "9",  name: "Hạng Đại Cao Thủ", min: 460 },
    { key: "10", name: "Hạng Thách Đấu",  min: 490 }
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
  var answerSeq = 0;
  for (var k in results) { if (results[k] && typeof results[k].seq === "number" && results[k].seq > answerSeq) answerSeq = results[k].seq; }
  answerSeq++;

  var PNAME_KEY = "lsd_player_name";
  var playerName = "";
  try { playerName = localStorage.getItem(PNAME_KEY) || ""; } catch (e) {}
  var lastUploaded = -1;
  var currentStreak = 0;   // chuỗi đúng liên tiếp (sạch, không từng sai) - reset khi sai
  var lastRankKey = null;  // rank key lần trước để phát hiện thăng hạng

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
        if (r) { done++; if (countsForRank(r)) correct++; }
      });
      var b = document.createElement("button");
      b.className = "lesson-btn";
      b.setAttribute("data-ci", ci);
      b.innerHTML = "<span class='lt'>" + esc(ch.title) + "</span>" +
        (ch.subtitle ? "<span class='ls'>" + esc(ch.subtitle) + "</span>" : "") +
        "<span class='lp'><span class='a'>" + correct + "</span>/<span class='w'>" +
        (total - correct) + "</span> (" + done + "/" + total + ")</span>";
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
    crumb.textContent = ch.title + (ch.subtitle ? " — " + ch.subtitle : "");
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
      if (r) { d++; if (countsForRank(r)) c++; }
    });
    lessonProgress.innerHTML = "Đã làm <b>" + d + "/" + t + "</b> · Đúng <b style='color:var(--ok)'>" + c +
      "</b> · Sai <b style='color:var(--bad)'>" + (d - c) + "</b>";
  }

  function renderBai(ci) {
    var ch = DATA.chapters[ci];
    content.innerHTML = "";

    var hd = document.createElement("h2");
    hd.className = "lesson-heading";
    hd.textContent = ch.title + (ch.subtitle ? " — " + ch.subtitle : "");
    content.appendChild(hd);

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

    if (r) { markCard(card, q, r.status, r.status === "wrong" ? (r.wrongs || []) : null); }
    return card;
  }

  function onAnswer(ci, qi, q, chosen, card, btn) {
    var id = q.id;
    if (results[id] && results[id].status === "correct") return; // đã chọn đúng -> khóa hẳn
    var now = Date.now();
    var isCorrect = (chosen === q.answer);
    if (isCorrect) {
      var prevTs = (results[id] && results[id].ts) || now;
      var prevSeq = (results[id] && typeof results[id].seq === "number") ? results[id].seq : answerSeq++;
      results[id] = { status: "correct", chosen: chosen, ts: prevTs, seq: prevSeq, everWrong: !!(results[id] && results[id].everWrong) };
      saveResults(results);
      markCard(card, q, "correct", null);
      playTone("correct");
    } else {
      var rec = (results[id] && results[id].status === "wrong") ? results[id] : { status: "wrong", wrongs: [], ts: now };
      if (!rec.wrongs) rec.wrongs = [];
      if (rec.wrongs.indexOf(chosen) === -1) rec.wrongs.push(chosen);
      rec.status = "wrong";
      rec.everWrong = true;
      if (!rec.ts) rec.ts = now;
      if (typeof rec.seq !== "number") rec.seq = answerSeq++;
      results[id] = rec;
      saveResults(results);
      markCard(card, q, "wrong", rec.wrongs);
      speakWrong();
    }
    if (isCorrect) {
      // câu từng trả lời sai (sửa lại đúng) vẫn tính là gãy chuỗi
      if (results[id] && results[id].everWrong) currentStreak = 0;
      else currentStreak++;
    } else {
      currentStreak = 0; // sai cái là ngắt chuỗi luôn
    }
    updateCombo();
    if (current) { updateBaiProgress(current.ci); renderTree(); }
    updateRank();
  }

  function markCard(card, q, status, wrongs) {
    var opts = card.querySelectorAll(".opt");
    var fb = card.querySelector(".feedback");
    var correct = q.answer;

    opts.forEach(function (b) {
      b.classList.remove("locked", "correct", "wrong", "dim");
      b.disabled = false;
      var old = b.querySelector(".badge"); if (old) old.remove();
      var key = b.querySelector(".key").textContent;

      if (status === "correct") {
        if (key === correct) {
          b.classList.add("correct");
          var bd = document.createElement("span"); bd.className = "badge"; bd.textContent = "✓ Đúng";
          b.appendChild(bd);
        } else {
          b.classList.add("dim");
        }
        b.disabled = true;
      } else {
        // đang đoán: chỉ khóa những phương án ĐÃ bấm sai; không lộ đáp án đúng
        if (wrongs && wrongs.indexOf(key) !== -1) {
          b.classList.add("wrong", "locked");
          var bx = document.createElement("span"); bx.className = "badge"; bx.textContent = "✗";
          b.appendChild(bx);
          b.disabled = true;
        }
      }
    });

    fb.className = "feedback show " + (status === "correct" ? "ok" : "bad");
    if (status === "correct") {
      fb.innerHTML = '<span class="fb-title">✅ Chính xác</span>' +
        (q.explain ? "<b>Giải thích:</b> " + esc(q.explain) : "");
    } else {
      fb.innerHTML = '<span class="fb-title">❌ Chưa đúng — thử lại nhé</span>' +
        (q.hint ? "<b>Gợi ý:</b> " + esc(q.hint) : "");
    }
  }

  /* ---------- dashboard ---------- */
  function openDashboard() {
    var total = FLAT.length, done = 0, correct = 0;
    FLAT.forEach(function (f) { if (results[f.id]) { done++; if (countsForRank(results[f.id])) correct++; } });

    var acc = done ? Math.round((correct / done) * 100) : 0;

    var order = [];
    FLAT.forEach(function (f) { var r = results[f.id]; if (r) order.push(r); });
    order.sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); });
    var bestC = 0, runC = 0, bestW = 0, runW = 0;
    order.forEach(function (r) {
      if (r.status === "correct" && !r.everWrong) { runC++; if (runC > bestC) bestC = runC; runW = 0; }
      else { runW++; if (runW > bestW) bestW = runW; runC = 0; }
    });

    var html = "";
    html += '<div class="stat-grid">';
    html += stat(total, "Tổng câu");
    html += stat(done, "Đã làm");
    html += stat(correct, "Đúng");
    html += stat(done - correct, "Sai");
    html += stat(acc + "%", "Tỉ lệ đúng");
    html += stat(bestC, "Chuỗi đúng dài nhất");
    html += stat(bestW, "Chuỗi sai dài nhất");
    html += stat(currentStreak, "Chuỗi đang có");
    html += "</div>";

    var byCh = {};
    FLAT.forEach(function (f) {
      if (!byCh[f.ch]) byCh[f.ch] = { t: 0, d: 0, c: 0 };
      byCh[f.ch].t++;
      if (results[f.id]) { byCh[f.ch].d++; if (countsForRank(results[f.id])) byCh[f.ch].c++; }
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
  function countsForRank(r) {
    return !!(r && r.status === "correct" && !r.everWrong);
  }
  function totalCorrect() {
    var c = 0;
    FLAT.forEach(function (f) { if (countsForRank(results[f.id])) c++; });
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
    var r = computeRank();
    var fill = r.cur.key === "10" ? "var(--gold)" : "linear-gradient(90deg,var(--gold),#e6c057)";
    var rb = document.getElementById("rankBar");
    if (rb) {
      rb.innerHTML =
        '<img class="rank-emblem" src="ranks/' + r.cur.key + '.png" alt="' + r.cur.name + '">' +
        '<div class="rb-meta"><span class="rb-name">' + r.cur.name + "</span>" +
        '<span class="rb-sub">' + r.correct + "/" + r.total + " đúng · " + r.sub + "</span></div>" +
        '<span class="rb-track"><span class="rb-fill" style="width:' + r.pct + '%;background:' + fill + '"></span></span>' +
        '<span class="rb-pct">' + r.pct + "%</span>";
    }
    var big = document.getElementById("rankBig");
    if (big) {
      big.innerHTML =
        '<img class="rb-emblem" src="ranks/' + r.cur.key + '.png" alt="' + r.cur.name + '">' +
        '<div class="rb-info"><div class="rb-name">' + r.cur.name + "</div>" +
        '<div class="rb-sub">' + r.correct + "/" + r.total + " câu đúng</div>" +
        '<span class="rb-track"><span class="rb-fill" style="width:' + r.pct + '%;background:' + fill + '"></span></span>' +
        '<div class="rb-foot"><span>' + r.sub + "</span><span>" + r.pct + "%</span></div></div>";
        big.title = "Bấm để xem các mốc rank";
    }
    if (lastRankKey !== null) {
      var curK = parseInt(r.cur.key, 10), lastK = parseInt(lastRankKey, 10);
      if (curK > lastK) { playRankUp(curK); showRankUpAnim(r.cur); }
    }
    lastRankKey = r.cur.key;
    uploadScore();
  }

  function openRankModal() {
    var r = computeRank();
    var body = document.getElementById("rankBody");
    body.innerHTML = RANKS.map(function (rk) {
      var reached = r.correct >= rk.min, cur = rk.key === r.cur.key;
      return '<div class="rank-row' + (cur ? " cur" : "") + (reached ? " reached" : "") + '">' +
        '<img class="rank-emblem-sm" src="ranks/' + rk.key + '.png" alt="' + rk.name + '">' +
        '<div class="rr-meta"><span class="rr-name">' + rk.name + '</span>' +
        '<span class="rr-min">Từ ' + rk.min + ' câu đúng</span></div>' +
        (cur ? '<span class="rr-badge">ĐANG Ở ĐÂY</span>'
          : (reached ? '<span class="rr-ok">✓</span>' : '<span class="rr-lock">🔒</span>')) +
        '</div>';
    }).join("") +
    '<div class="rank-note">Tổng <b>' + r.correct + '/' + r.total + '</b> câu đúng · rank hiện tại: <b>' + r.cur.name + '</b></div>';
    document.getElementById("rankModal").classList.remove("hidden");
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
  var WRONG_TAUNTS = [
    "Sai mẹ mày rồi!",
    "Óc lợn có thế cũng sai!",
    "Trật lất rồi ông nội ơi!",
    "Ngốc ơi, sai bét rồi!",
    "Học bài đâu mà trả lời bậy thế?",
    "Lại sai nữa rồi, cố lên đi!",
    "Đáp án này thì cũng sai được á?",
    "Não cá vàng thế không biết à?",
    "Sai quá sai, thử lại đi!",
    "Chơi dở hơi, sai tưng bừng luôn!",
    "Chó Khôi cũng làm được mày à?",
    "Chó Tuấn cười mày bây giờ đấy!",
    "Chó Minh Bell🐧 còn biết mày sai rồi!",
    "Chó Kiên Corgi chuyên Hưng Yên cũng chê mày đấy!",
    "Chuyên Tin Bắc Giang đcmm, sai bét rồi!",
    "Thằng Chó Khôi xem thường mày rồi!",
    "Chó Tuấn bảo mày ngu lắm!",
    "Chó Minh Bell🐧🐧 cười ẻ nhìn mày kìa!",
    "Chó Kiên Corgi chuyên Hưng Yên lắc đầu với mày!",
    "Chuyên Tin Bắc Giang đcmm, học đi rồi trả lời!"
  ];
  function speakWrong() {
    try {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(WRONG_TAUNTS[Math.floor(Math.random() * WRONG_TAUNTS.length)]);
      u.lang = "vi-VN";
      u.rate = 1.05; u.pitch = 1.0;
      window.speechSynthesis.speak(u);
    } catch (e) {}
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

  /* ---------- leaderboard + player name ---------- */
  function uploadScore() {
    if (!playerName) return;
    var r = computeRank();
    if (r.correct === lastUploaded) return;
    lastUploaded = r.correct;
    try {
      fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: playerName, score: r.correct })
      }).catch(function () {});
    } catch (e) {}
  }
  function renderPlayerName() {
    var el = document.getElementById("playerName");
    if (el) el.textContent = playerName ? ("👤 " + playerName) : "";
  }
  function ensureName() {
    if (playerName) { renderPlayerName(); return; }
    var m = document.getElementById("nameModal");
    var input = document.getElementById("nameInput");
    m.classList.remove("hidden");
    input.value = "";
    setTimeout(function () { input.focus(); }, 30);
  }
  function submitName() {
    var input = document.getElementById("nameInput");
    var v = (input.value || "").trim().slice(0, 24);
    if (!v) { input.focus(); return; }
    playerName = v;
    try { localStorage.setItem(PNAME_KEY, v); } catch (e) {}
    document.getElementById("nameModal").classList.add("hidden");
    renderPlayerName();
    uploadScore();
  }
  function openLeaderboard() {
    var body = document.getElementById("lbBody");
    body.innerHTML = "<p style='color:var(--ink-soft)'>Đang tải…</p>";
    document.getElementById("leaderboardModal").classList.remove("hidden");
    fetch("/api/leaderboard")
      .then(function (r) { return r.json(); })
      .then(function (list) {
        if (!list || !list.length) {
          body.innerHTML = "<p style='color:var(--ink-soft)'>Chưa có ai trên bảng xếp hạng. Hãy làm bài để lên top!</p>";
          return;
        }
        var rows = list.map(function (e) {
          var me = (e.name === playerName) ? " me" : "";
          var rk = rankFromScore(e.score);
          return "<tr class='lb-row" + me + "'><td>" + e.rank + "</td><td>" + esc(e.name) + "</td><td>" + e.score + "</td>" +
            "<td class='lb-rank'><img src='ranks/" + rk.key + ".png' alt='" + rk.name + "'><span>" + rk.name + "</span></td></tr>";
        }).join("");
        body.innerHTML =
          "<table class='lb-table'><thead><tr><th>#</th><th>Tên</th><th>Câu đúng</th><th>Hạng</th></tr></thead><tbody>" + rows + "</tbody></table>";
      })
      .catch(function () {
        body.innerHTML = "<p style='color:var(--bad)'>Không tải được bảng xếp hạng (có thể chưa bật server).</p>";
      });
  }

  function rankFromScore(score) {
    var cur = RANKS[0];
    for (var i = 0; i < RANKS.length; i++) { if (score >= RANKS[i].min) cur = RANKS[i]; }
    return cur;
  }
  function playCombo(streak) {
    var ctx = _getCtx(); if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    var t = ctx.currentTime;
    var step = Math.min(streak - 1, 14);
    _tone(ctx, 523.25 * Math.pow(2, step / 12), t, 0.12, 0.13);
  }
  function playRankUp(tier) {
    var ctx = _getCtx(); if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    var t = ctx.currentTime;
    var base = 523.25 * Math.pow(2, (Math.min(tier, 10) - 1) / 12);
    [0, 4, 7, 12].forEach(function (semi, i) {
      _tone(ctx, base * Math.pow(2, semi / 12), t + i * 0.09, 0.18, 0.15);
    });
  }
  var prevStreak = 0;
  function updateCombo() {
    var el = document.getElementById("comboBadge");
    if (!el) return;
    // chuỗi đứt: vỡ đôi rồi biến mất, sau đó reset về trạng thái gốc
    if (prevStreak > 0 && currentStreak === 0) { prevStreak = 0; breakCombo(); return; }
    prevStreak = currentStreak;
    var scale = 1 + Math.min(currentStreak, 25) * 0.022;          // càng nhiều câu càng to, tăng tí tẹo
    var hue = 28 + (Math.min(currentStreak, 25) / 25) * 252;       // cam (28) -> tím (280) dần
    el.style.setProperty("--combo-scale", scale.toFixed(3));
    el.style.setProperty("--combo-hue", hue.toFixed(0));
    el.style.background = "linear-gradient(135deg, hsl(var(--combo-hue),85%,55%), hsl(calc(var(--combo-hue) + 18),85%,62%))";
    el.innerHTML = currentStreak >= 1 ? ("🔥 <b>x" + currentStreak + "</b>") : "🔥";
    el.classList.add("show");
    if (currentStreak >= 1) {
      el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
      playCombo(currentStreak);
    }
  }
  function breakCombo() {
    var el = document.getElementById("comboBadge");
    if (!el) return;
    var cs = getComputedStyle(el);
    el.classList.add("breaking"); // badge thật mờ dần
    for (var s = -1; s <= 1; s += 2) {
      var half = document.createElement("div");
      half.className = "combo-half";
      half.textContent = "🔥";
      half.style.position = "fixed";
      half.style.right = "18px";
      half.style.bottom = "18px";
      half.style.zIndex = "61";
      half.style.background = el.style.background || cs.background;
      half.style.color = "#fff";
      half.style.fontWeight = cs.fontWeight;
      half.style.fontSize = cs.fontSize;
      half.style.fontFamily = cs.fontFamily;
      half.style.padding = "9px 15px";
      half.style.borderRadius = "999px";
      half.style.boxShadow = cs.boxShadow;
      half.style.transition = "transform .5s ease, opacity .5s ease";
      half.style.clipPath = s < 0 ? "inset(0 50% 0 0)" : "inset(0 0 0 50%)";
      document.body.appendChild(half);
      void half.offsetWidth;
      half.style.transform = "translateX(" + (s * 150) + "px) rotate(" + (s * 28) + "deg)";
      half.style.opacity = "0";
      (function (h) { setTimeout(function () { if (h.parentNode) h.parentNode.removeChild(h); }, 540); })(half);
    }
    setTimeout(function () { el.classList.remove("breaking"); }, 540);
  }
  function showRankUpAnim(rank) {
    var fx = document.getElementById("rankUpFx");
    if (!fx) return;
    fx.innerHTML = "<div class='ru-card'><img src='ranks/" + rank.key + ".png' alt='" + rank.name + "'>" +
      "<div class='ru-title'>THĂNG HẠNG!</div><div class='ru-name'>" + rank.name + "</div></div>";
    fx.classList.remove("show"); void fx.offsetWidth; fx.classList.add("show");
    setTimeout(function () { fx.classList.remove("show"); }, 1800);
  }

  /* ---------- wire controls ---------- */
  document.getElementById("btnDashboard").onclick = openDashboard;
  document.getElementById("btnDashClose").onclick = function () { dashModal.classList.add("hidden"); };
  dashModal.onclick = function (e) { if (e.target === dashModal) dashModal.classList.add("hidden"); };
  document.getElementById("rankBig").addEventListener("click", openRankModal);
  document.getElementById("btnRankClose").onclick = function () { document.getElementById("rankModal").classList.add("hidden"); };
  document.getElementById("rankModal").onclick = function (e) { if (e.target === document.getElementById("rankModal")) document.getElementById("rankModal").classList.add("hidden"); };
  document.getElementById("btnMenu").onclick = function () { document.getElementById("sidebar").classList.toggle("open"); };
  document.getElementById("btnResetAll").onclick = function () {
    if (confirm("Xóa TOÀN BỘ tiến độ đã làm?")) {
      results = {}; saveResults(results); renderTree();
      if (current) { renderBai(current.ci); updateBaiProgress(current.ci); }
      lessonProgress.innerHTML = "";
      updateRank();
    }
  };
  document.getElementById("btnLeaderboard").onclick = openLeaderboard;
  document.getElementById("btnLbClose").onclick = function () { document.getElementById("leaderboardModal").classList.add("hidden"); };
  document.getElementById("leaderboardModal").onclick = function (e) { if (e.target === document.getElementById("leaderboardModal")) document.getElementById("leaderboardModal").classList.add("hidden"); };
  document.getElementById("nameInput").addEventListener("keydown", function (e) { if (e.key === "Enter") submitName(); });
  document.getElementById("btnNameOk").onclick = submitName;

  /* ---------- init ---------- */
  renderTree();
  updateRank();
  updateCombo();
  ensureName();

  if (!DATA.chapters.length) {
    content.innerHTML = "<div class='welcome'><h1>Chưa có dữ liệu</h1><p>File <code>data.js</code> chưa được tạo. Hãy chạy merge để sinh dữ liệu câu hỏi.</p></div>";
  }
})();
