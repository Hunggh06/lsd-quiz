/* ===== Lịch sử Đảng — quiz engine ===== */
(function () {
  "use strict";

  var DATA = window.QUIZ_DATA || { chapters: [] };
  var STORE_KEY = "lsd_quiz_results_v2";

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
    if (results[id]) return; // already answered (locked)
    var isCorrect = (chosen === q.answer);
    var status = isCorrect ? "correct" : "wrong";
    results[id] = { status: status, chosen: chosen };
    saveResults(results);
    markCard(card, q, chosen, status, true);
    if (current) { updateBaiProgress(current.ci); renderTree(); }
  }

  function markCard(card, q, chosen, status, animate) {
    var opts = card.querySelectorAll(".opt");
    var fb = card.querySelector(".feedback");
    var correct = q.answer;

    opts.forEach(function (b) {
      b.classList.add("locked");
      var key = b.querySelector(".key").textContent;
      if (key === correct) {
        b.classList.add("correct");
        if (!b.querySelector(".badge")) {
          var bd = document.createElement("span"); bd.className = "badge"; bd.textContent = "✓ Đúng";
          b.appendChild(bd);
        }
      } else if (key === chosen && status === "wrong") {
        b.classList.add("wrong");
        if (!b.querySelector(".badge")) {
          var bd2 = document.createElement("span"); bd2.className = "badge"; bd2.textContent = "✗";
          b.appendChild(bd2);
        }
      } else {
        b.classList.add("dim");
      }
    });

    fb.className = "feedback show " + (status === "correct" ? "ok" : "bad");
    if (status === "correct") {
      fb.innerHTML = '<span class="fb-title">✅ Chính xác</span>' +
        (q.explain ? "<b>Giải thích:</b> " + esc(q.explain) : "");
    } else {
      fb.innerHTML = '<span class="fb-title">❌ Chưa đúng</span>' +
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

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function closeSidebarMobile() {
    if (window.innerWidth <= 860) document.getElementById("sidebar").classList.remove("open");
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
    }
  };

  /* ---------- init ---------- */
  renderTree();

  if (!DATA.chapters.length) {
    content.innerHTML = "<div class='welcome'><h1>Chưa có dữ liệu</h1><p>File <code>data.js</code> chưa được tạo. Hãy chạy merge để sinh dữ liệu câu hỏi.</p></div>";
  }
})();
