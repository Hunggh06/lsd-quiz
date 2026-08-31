/* ===== Hệ thống Ôn tập Môn học — Đa môn (LSD & PLDC) ===== */
(function () {
  "use strict";

  /* ---------- Data sources ---------- */
  var LSD_DATA = window.QUIZ_DATA || { chapters: [] };
  var LSD_ESSAY_DATA = window.ESSAY_DATA || { questions: [] };
  var PLDC_DATA = window.PLDC_DATA || { trac_nghiem: [], dung_sai: [], qppl: [], thua_ke: [] };

  /* ---------- State ---------- */
  var SUBJ_KEY = "last_selected_subject";
  var currentSubject = localStorage.getItem(SUBJ_KEY) || "lsd";
  if (currentSubject !== "lsd" && currentSubject !== "pldc") currentSubject = "lsd";

  var LSD_STORE_KEY = "lsd_quiz_results_v2";
  var LSD_ESSAY_KEY = "lsd_essay_learned_v1";
  var PLDC_STORE_KEY = "pldc_quiz_results_v1";
  var PNAME_KEY = "lsd_player_name";

  /* ---------- Storage helpers ---------- */
  function loadResults(key) {
    try { return JSON.parse(localStorage.getItem(key)) || {}; }
    catch (e) { return {}; }
  }
  function saveResults(key, r) {
    try { localStorage.setItem(key, JSON.stringify(r)); } catch (e) {}
  }

  var lsdResults = loadResults(LSD_STORE_KEY);
  var pldcResults = loadResults(PLDC_STORE_KEY);
  var essayLearned = loadResults(LSD_ESSAY_KEY);
  var playerName = "";
  try { playerName = localStorage.getItem(PNAME_KEY) || ""; } catch (e) {}

  var currentStreak = 0;
  var prevStreak = 0;
  var lastLsdRankKey = null;
  var lastPldcRankKey = null;
  var lastUploadedLsd = -1;
  var lastUploadedPldc = -1;

  /* ---------- Rank LADDERS ---------- */
  var LSD_RANKS = [
    { key: "1",  name: "Hạng Sắt",        min: 0 },
    { key: "2",  name: "Hạng Đồng",       min: 30 },
    { key: "3",  name: "Hạng Bạc",        min: 70 },
    { key: "4",  name: "Hạng Vàng",       min: 120 },
    { key: "5",  name: "Hạng Bạch Kim",   min: 180 },
    { key: "6",  name: "Hạng Lục Bảo",    min: 250 },
    { key: "7",  name: "Hạng Kim Cương",  min: 330 },
    { key: "8",  name: "Hạng Cao Thủ",    min: 410 },
    { key: "9",  name: "Hạng Đại Cao Thủ", min: 460 },
    { key: "10", name: "Hạng Thách Đấu",  min: 550 }
  ];

  var PLDC_RANKS = [
    { key: "1",  name: "Hạng Sắt",        min: 0 },
    { key: "2",  name: "Hạng Đồng",       min: 15 },
    { key: "3",  name: "Hạng Bạc",        min: 30 },
    { key: "4",  name: "Hạng Vàng",       min: 50 },
    { key: "5",  name: "Hạng Bạch Kim",   min: 75 },
    { key: "6",  name: "Hạng Lục Bảo",    min: 100 },
    { key: "7",  name: "Hạng Kim Cương",  min: 125 },
    { key: "8",  name: "Hạng Cao Thủ",    min: 150 },
    { key: "9",  name: "Hạng Đại Cao Thủ", min: 180 },
    { key: "10", name: "Hạng Thách Đấu",  min: 200 }
  ];

  /* Active mode within subject */
  var lsdMode = "trac_nghiem"; // "trac_nghiem" | "tu_luan"
  var pldcMode = "trac_nghiem"; // "trac_nghiem" | "dung_sai" | "qppl" | "thua_ke"
  var currentView = null; // { type: 'lsd_bai', ci: 0 } or { type: 'pldc_tn', ci: 0 } etc.
  var qnavCells = [];

  /* ---------- DOM elements ---------- */
  var tree = document.getElementById("tree");
  var content = document.getElementById("content");
  var welcome = document.getElementById("welcome");
  var qnav = document.getElementById("qnav");
  var qnavTitle = document.getElementById("qnavTitle");
  var qnavGrid = document.getElementById("qnavGrid");
  var lessonProgress = document.getElementById("lessonProgress");
  var sidebarModeTabs = document.getElementById("sidebarModeTabs");
  var brandMark = document.getElementById("brandMark");
  var brandTitle = document.getElementById("brandTitle");
  var brandSub = document.getElementById("brandSub");
  var btnSubjectLSD = document.getElementById("btnSubjectLSD");
  var btnSubjectPLDC = document.getElementById("btnSubjectPLDC");
  var dashModal = document.getElementById("dashModal");
  var dashBody = document.getElementById("dashBody");

  /* ---------- Audio / Web Audio helpers ---------- */
  var _audioCtx = null;
  function _getCtx() {
    if (!_audioCtx) {
      var Cls = window.AudioContext || window.webkitAudioContext;
      if (Cls) _audioCtx = new Cls();
    }
    return _audioCtx;
  }
  function _tone(ctx, freq, start, dur, gainVal) {
    try {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(gainVal || 0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur);
    } catch (e) {}
  }
  function playCorrect() {
    var ctx = _getCtx(); if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    var t = ctx.currentTime;
    _tone(ctx, 587.33, t, 0.1, 0.15);
    _tone(ctx, 880, t + 0.08, 0.18, 0.18);
  }
  function playWrong() {
    var ctx = _getCtx(); if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    var t = ctx.currentTime;
    _tone(ctx, 220, t, 0.15, 0.2);
    _tone(ctx, 164.81, t + 0.1, 0.25, 0.22);
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

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showToast(msg) {
    var t = document.getElementById("toastMsg");
    if (!t) {
      t = document.createElement("div");
      t.id = "toastMsg";
      t.className = "toast-msg";
      document.body.appendChild(t);
    }
    t.innerHTML = "📋 " + esc(msg);
    t.classList.remove("show");
    void t.offsetWidth;
    t.classList.add("show");
    setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  function closeSidebarMobile() {
    var s = document.getElementById("sidebar");
    if (s) s.classList.remove("open");
  }

  /* ---------- Rank Calculation ---------- */
  function countsForRank(r) {
    return !!(r && (r.status === "correct" || r.everCorrect));
  }

  function computeRankLSD() {
    var correct = 0, total = 0;
    LSD_DATA.chapters.forEach(function (ch) {
      (ch.questions || []).forEach(function (q) {
        total++;
        if (countsForRank(lsdResults[q.id])) correct++;
      });
    });
    var currentRank = LSD_RANKS[0];
    var nextRank = null;
    for (var i = 0; i < LSD_RANKS.length; i++) {
      if (correct >= LSD_RANKS[i].min) {
        currentRank = LSD_RANKS[i];
        nextRank = LSD_RANKS[i + 1] || null;
      }
    }
    return { correct: correct, total: total, current: currentRank, next: nextRank };
  }

  function computeRankPLDC() {
    var correct = 0, total = 0;
    (PLDC_DATA.trac_nghiem || []).forEach(function (ch) {
      (ch.questions || []).forEach(function (q) {
        total++;
        if (countsForRank(pldcResults[q.id])) correct++;
      });
    });
    (PLDC_DATA.dung_sai || []).forEach(function (q) {
      total++;
      if (countsForRank(pldcResults[q.id])) correct++;
    });
    var currentRank = PLDC_RANKS[0];
    var nextRank = null;
    for (var i = 0; i < PLDC_RANKS.length; i++) {
      if (correct >= PLDC_RANKS[i].min) {
        currentRank = PLDC_RANKS[i];
        nextRank = PLDC_RANKS[i + 1] || null;
      }
    }
    return { correct: correct, total: total, current: currentRank, next: nextRank };
  }

  function updateRank() {
    var rInfo = currentSubject === "lsd" ? computeRankLSD() : computeRankPLDC();
    var lastKey = currentSubject === "lsd" ? lastLsdRankKey : lastPldcRankKey;

    if (lastKey && lastKey !== rInfo.current.key) {
      showRankUpAnim(rInfo.current);
      playRankUp(parseInt(rInfo.current.key, 10));
    }
    if (currentSubject === "lsd") lastLsdRankKey = rInfo.current.key;
    else lastPldcRankKey = rInfo.current.key;

    var el = document.getElementById("rankBig");
    if (!el) return;
    var pct = 100;
    var nextText = "Tối đa";
    if (rInfo.next) {
      var span = rInfo.next.min - rInfo.current.min;
      var prog = rInfo.correct - rInfo.current.min;
      pct = Math.min(100, Math.max(0, Math.round((prog / span) * 100)));
      nextText = rInfo.correct + "/" + rInfo.next.min + " để lên " + rInfo.next.name;
    }

    el.innerHTML =
      "<img src='ranks/" + rInfo.current.key + ".png' alt='" + esc(rInfo.current.name) + "' class='rb-img'>" +
      "<div class='rb-info'>" +
      "<div class='rb-tier'>" + esc(rInfo.current.name) + "</div>" +
      "<div class='rb-sub'>" + rInfo.correct + "/" + rInfo.total + " câu đúng (" + nextText + ")</div>" +
      "<div class='rb-bar'><div class='rb-bar-fill' style='width:" + pct + "%'></div></div>" +
      "</div>";

    uploadScore();
  }

  function showRankUpAnim(rank) {
    var fx = document.getElementById("rankUpFx");
    if (!fx) return;
    fx.innerHTML = "<div class='ru-card'><img src='ranks/" + rank.key + ".png' alt='" + rank.name + "'>" +
      "<div class='ru-title'>THĂNG HẠNG!</div><div class='ru-name'>" + rank.name + "</div></div>";
    fx.classList.remove("show"); void fx.offsetWidth; fx.classList.add("show");
    setTimeout(function () { fx.classList.remove("show"); }, 1800);
  }

  function uploadScore() {
    if (!playerName) return;
    var rInfo = currentSubject === "lsd" ? computeRankLSD() : computeRankPLDC();
    var lastUp = currentSubject === "lsd" ? lastUploadedLsd : lastUploadedPldc;
    if (rInfo.correct === lastUp) return;
    if (currentSubject === "lsd") lastUploadedLsd = rInfo.correct;
    else lastUploadedPldc = rInfo.correct;

    try {
      fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: playerName, score: rInfo.correct, subject: currentSubject })
      }).catch(function () {});
    } catch (e) {}
  }

  /* ---------- Switch Subject ---------- */
  function setSubject(subj) {
    currentSubject = subj;
    localStorage.setItem(SUBJ_KEY, subj);
    document.body.setAttribute("data-subject", subj);

    if (subj === "lsd") {
      btnSubjectLSD.classList.add("active");
      btnSubjectPLDC.classList.remove("active");
      brandMark.textContent = "ĐCSVN";
      brandTitle.textContent = "Lịch sử Đảng";
      brandSub.textContent = "Trắc nghiệm & Tự luận";
      renderLsdModeTabs();
    } else {
      btnSubjectPLDC.classList.add("active");
      btnSubjectLSD.classList.remove("active");
      brandMark.textContent = "PLDC";
      brandTitle.textContent = "Pháp luật đại cương";
      brandSub.textContent = "HAUI - 4 Dạng ôn tập";
      renderPldcModeTabs();
    }

    currentView = null;
    showWelcome();
    renderTree();
    updateRank();
    updateQnavVisibility();
  }

  /* ---------- Sidebar Mode Tabs ---------- */
  function renderLsdModeTabs() {
    sidebarModeTabs.innerHTML =
      "<button id='tabTracNghiem' class='mode-tab " + (lsdMode === "trac_nghiem" ? "active" : "") + "'>🎯 Trắc nghiệm</button>" +
      "<button id='tabTuLuan' class='mode-tab " + (lsdMode === "tu_luan" ? "active" : "") + "'>📝 Tự luận (8 câu)</button>";

    document.getElementById("tabTracNghiem").onclick = function () {
      lsdMode = "trac_nghiem";
      renderLsdModeTabs();
      renderTree();
      selectLsdBai(0);
      closeSidebarMobile();
    };
    document.getElementById("tabTuLuan").onclick = function () {
      lsdMode = "tu_luan";
      renderLsdModeTabs();
      renderTree();
      selectLsdEssay();
      closeSidebarMobile();
    };
  }

  function renderPldcModeTabs() {
    sidebarModeTabs.innerHTML =
      "<button id='tabPldcTN' class='mode-tab " + (pldcMode === "trac_nghiem" ? "active" : "") + "'>🎯 Trắc nghiệm ABCD</button>" +
      "<button id='tabPldcDS' class='mode-tab " + (pldcMode === "dung_sai" ? "active" : "") + "'>⚖️ Nhận định Đúng/Sai</button>" +
      "<button id='tabPldcQPPL' class='mode-tab " + (pldcMode === "qppl" ? "active" : "") + "'>📜 Cấu trúc QPPL & VPPL</button>" +
      "<button id='tabPldcTK' class='mode-tab " + (pldcMode === "thua_ke" ? "active" : "") + "'>💼 Chia thừa kế & Tình huống</button>";

    document.getElementById("tabPldcTN").onclick = function () {
      pldcMode = "trac_nghiem";
      renderPldcModeTabs();
      renderTree();
      selectPldcTN(0);
      closeSidebarMobile();
    };
    document.getElementById("tabPldcDS").onclick = function () {
      pldcMode = "dung_sai";
      renderPldcModeTabs();
      renderTree();
      selectPldcDS();
      closeSidebarMobile();
    };
    document.getElementById("tabPldcQPPL").onclick = function () {
      pldcMode = "qppl";
      renderPldcModeTabs();
      renderTree();
      selectPldcQPPL();
      closeSidebarMobile();
    };
    document.getElementById("tabPldcTK").onclick = function () {
      pldcMode = "thua_ke";
      renderPldcModeTabs();
      renderTree();
      selectPldcTK();
      closeSidebarMobile();
    };
  }

  /* ---------- Render Tree Sidebar ---------- */
  function renderTree() {
    tree.innerHTML = "";
    if (currentSubject === "lsd") {
      if (lsdMode === "tu_luan") {
        var b = document.createElement("button");
        b.className = "lesson-btn active";
        var count = 0;
        LSD_ESSAY_DATA.questions.forEach(function (q) { if (essayLearned[q.id]) count++; });
        b.innerHTML = "<span class='lt'>📝 8 Câu hỏi Tự luận</span><span class='ls'>Trọng tâm Kỳ II</span>" +
          "<span class='lp'><span class='a'>" + count + "</span>/<span>8 đã thuộc</span></span>";
        b.onclick = selectLsdEssay;
        tree.appendChild(b);
        return;
      }
      LSD_DATA.chapters.forEach(function (ch, ci) {
        var total = 0, done = 0, correct = 0;
        ch.questions.forEach(function (q) {
          total++;
          var r = lsdResults[q.id];
          if (r) { done++; if (countsForRank(r)) correct++; }
        });
        var b = document.createElement("button");
        b.className = "lesson-btn" + (currentView && currentView.type === "lsd_bai" && currentView.ci === ci ? " active" : "");
        b.innerHTML = "<span class='lt'>" + esc(ch.title) + "</span>" +
          (ch.subtitle ? "<span class='ls'>" + esc(ch.subtitle) + "</span>" : "") +
          "<span class='lp'><span class='a'>" + correct + "</span>/<span class='w'>" +
          (total - correct) + "</span> (" + done + "/" + total + ")</span>";
        b.onclick = function () { selectLsdBai(ci); closeSidebarMobile(); };
        tree.appendChild(b);
      });
    } else {
      /* PLDC Tree */
      if (pldcMode === "trac_nghiem") {
        (PLDC_DATA.trac_nghiem || []).forEach(function (ch, ci) {
          var total = 0, done = 0, correct = 0;
          ch.questions.forEach(function (q) {
            total++;
            var r = pldcResults[q.id];
            if (r) { done++; if (countsForRank(r)) correct++; }
          });
          var b = document.createElement("button");
          b.className = "lesson-btn" + (currentView && currentView.type === "pldc_tn" && currentView.ci === ci ? " active" : "");
          b.innerHTML = "<span class='lt'>" + esc(ch.title) + "</span>" +
            (ch.subtitle ? "<span class='ls'>" + esc(ch.subtitle) + "</span>" : "") +
            "<span class='lp'><span class='a'>" + correct + "</span>/<span class='w'>" +
            (total - correct) + "</span> (" + done + "/" + total + ")</span>";
          b.onclick = function () { selectPldcTN(ci); closeSidebarMobile(); };
          tree.appendChild(b);
        });
      } else if (pldcMode === "dung_sai") {
        var totalDS = (PLDC_DATA.dung_sai || []).length;
        var doneDS = 0, correctDS = 0;
        (PLDC_DATA.dung_sai || []).forEach(function (q) {
          var r = pldcResults[q.id];
          if (r) { doneDS++; if (countsForRank(r)) correctDS++; }
        });
        var bDS = document.createElement("button");
        bDS.className = "lesson-btn active";
        bDS.innerHTML = "<span class='lt'>⚖️ Nhận định Đúng / Sai</span><span class='ls'>Tổng hợp toàn bộ chương</span>" +
          "<span class='lp'><span class='a'>" + correctDS + "</span>/<span class='w'>" + (totalDS - correctDS) + "</span> (" + doneDS + "/" + totalDS + ")</span>";
        bDS.onclick = selectPldcDS;
        tree.appendChild(bDS);
      } else if (pldcMode === "qppl") {
        var bQP = document.createElement("button");
        bQP.className = "lesson-btn active";
        bQP.innerHTML = "<span class='lt'>📜 Cấu trúc QPPL & VPPL</span><span class='ls'>Phân tích Giả định - Quy định - Chế tài</span>";
        bQP.onclick = selectPldcQPPL;
        tree.appendChild(bQP);
      } else if (pldcMode === "thua_ke") {
        var bTK = document.createElement("button");
        bTK.className = "lesson-btn active";
        bTK.innerHTML = "<span class='lt'>💼 Chia thừa kế & Tình huống</span><span class='ls'>Phương pháp giải & Đề thi mẫu</span>";
        bTK.onclick = selectPldcTK;
        tree.appendChild(bTK);
      }
    }
  }

  /* ---------- Welcome Screen ---------- */
  function showWelcome() {
    welcome.style.display = "block";
    content.innerHTML = "";
    content.appendChild(welcome);

    if (currentSubject === "lsd") {
      welcome.innerHTML =
        '<div class="welcome-essay-banner" id="btnWelcomeEssay">' +
          '<div class="web-content">' +
            '<span class="web-tag">🔥 Đề cương tự luận mới nhất</span>' +
            '<h2>📝 8 Câu hỏi Tự luận Lịch sử Đảng (Kỳ II)</h2>' +
            '<p>Tổng hợp cô đọng, gạch đầu dòng siêu ngắn, dễ thuộc, kèm mẹo làm câu Đúng/Sai và phần liên hệ sinh viên.</p>' +
          '</div>' +
          '<button class="ghost-btn web-btn">Vào ôn Tự luận ngay →</button>' +
        '</div>' +
        '<h1>Ôn tập Lịch sử Đảng Cộng sản Việt Nam</h1>' +
        '<p>Hơn 300 câu trắc nghiệm ABCD chia theo chương &amp; bài. Chọn đáp án để nhận phản hồi: ' +
        '<span class="tag ok">xanh</span> kèm giải thích khi đúng, <span class="tag bad">đỏ</span> kèm gợi ý khi sai.</p>' +
        '<ul class="welcome-tips">' +
          '<li>📝 <b>Mục Tự luận riêng biệt:</b> Ôn nhanh 8 câu tự luận trọng tâm kèm phân tích và mẹo Đúng/Sai.</li>' +
          '<li>🟩 Chọn đúng → tô xanh &amp; giải thích lý do.</li>' +
          '<li>🟥 Chọn sai → tô đỏ &amp; hiện gợi ý + đáp án đúng.</li>' +
          '<li>📊 Mở <b>Thống kê</b> để xem kết quả, tỉ lệ đúng theo chương.</li>' +
          '<li>💾 Tiến độ lưu tự động trên trình duyệt này.</li>' +
        '</ul>';

      var bWe = document.getElementById("btnWelcomeEssay");
      if (bWe) bWe.onclick = selectLsdEssay;
    } else {
      welcome.innerHTML =
        '<div class="welcome-essay-banner" style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border-color:#93c5fd">' +
          '<div class="web-content">' +
            '<span class="web-tag" style="background:#1e3a8a">⚖️ Môn học Pháp luật đại cương</span>' +
            '<h2 style="color:#1e3a8a">💼 Tổng hợp Đề cương &amp; 4 Dạng bài Ôn tập Chuẩn</h2>' +
            '<p style="color:#1e40af">Hệ thống đầy đủ Trắc nghiệm ABCD, 100+ câu nhận định Đúng/Sai có giải thích, phân tích Cấu trúc QPPL và Hướng dẫn giải chi tiết Bài tập Chia thừa kế (Điều 644, 651, 652 BLDS 2015).</p>' +
          '</div>' +
        '</div>' +
        '<h1>Ôn tập Pháp luật đại cương (HAUI)</h1>' +
        '<p>Cấu trúc ôn tập 4 dạng bài bám sát đề thi kết thúc học phần:</p>' +
        '<ul class="welcome-tips">' +
          '<li>🎯 <b>Trắc nghiệm 4 lựa chọn (ABCD):</b> Đầy đủ các chương kèm giải thích điều luật cụ thể.</li>' +
          '<li>⚖️ <b>Nhận định Đúng / Sai:</b> Luyện nhận định nhanh kèm căn cứ pháp lý và phân tích điểm mấu chốt.</li>' +
          '<li>📜 <b>Cấu trúc QPPL &amp; Vi phạm PL:</b> Hướng dẫn bóc tách Giả định - Quy định - Chế tài và 4 yếu tố cấu thành.</li>' +
          '<li>💼 <b>Chia thừa kế &amp; Tình huống:</b> Hướng dẫn phương pháp giải từng bước kèm sơ đồ gia phả trực quan.</li>' +
          '<li>⚠️ <b>Tag [Nghi vấn kết quả]:</b> Tự động cảnh báo và đối chiếu các câu có đáp án tài liệu cũ mâu thuẫn hoặc căn cứ luật đã sửa đổi.</li>' +
        '</ul>';
    }
  }

  function updateQnavVisibility() {
    if (!qnav) return;
    if (currentView) qnav.classList.remove("hidden");
    else qnav.classList.add("hidden");
  }

  /* ========================================================
     LSD RENDERING (Trắc nghiệm & Tự luận)
     ======================================================== */
  function selectLsdBai(ci) {
    currentView = { type: "lsd_bai", ci: ci };
    welcome.style.display = "none";
    renderTree();
    renderLsdBai(ci);
    renderLsdQnav(ci);
    updateLsdProgress(ci);
    updateQnavVisibility();
  }

  function selectLsdEssay() {
    currentView = { type: "lsd_essay" };
    welcome.style.display = "none";
    renderTree();
    renderLsdEssay();
    renderLsdEssayQnav();
    updateLsdEssayProgress();
    updateQnavVisibility();
  }

  function renderLsdBai(ci) {
    content.innerHTML = "";
    var ch = LSD_DATA.chapters[ci];
    if (!ch) return;

    var h = document.createElement("div");
    h.className = "lesson-heading";
    h.textContent = ch.title + (ch.subtitle ? " — " + ch.subtitle : "");
    content.appendChild(h);

    ch.questions.forEach(function (q, qi) {
      var card = createQuestionCard(q, qi, "lsd", function (optKey) {
        handleAnswer(q, optKey, "lsd", function () {
          updateLsdProgress(ci);
          refreshLsdQnav(ci);
        });
      });
      content.appendChild(card);
    });
  }

  function renderLsdQnav(ci) {
    var ch = LSD_DATA.chapters[ci];
    if (!ch) return;
    qnavGrid.innerHTML = "";
    qnavCells = [];
    qTitle("Câu hỏi " + ch.title);

    ch.questions.forEach(function (q, qi) {
      var cell = document.createElement("div");
      var r = lsdResults[q.id];
      cell.className = "qnav-cell" + (r ? (r.status === "correct" ? " ok" : " bad") : "");
      cell.textContent = qi + 1;
      cell.onclick = function () {
        var cards = content.querySelectorAll(".q-card");
        if (cards[qi]) cards[qi].scrollIntoView({ behavior: "smooth", block: "center" });
      };
      qnavGrid.appendChild(cell);
      qnavCells.push(cell);
    });
  }

  function refreshLsdQnav(ci) {
    var ch = LSD_DATA.chapters[ci];
    if (!ch) return;
    ch.questions.forEach(function (q, qi) {
      var cell = qnavCells[qi];
      if (!cell) return;
      var r = lsdResults[q.id];
      cell.className = "qnav-cell" + (r ? (r.status === "correct" ? " ok" : " bad") : "");
    });
  }

  function updateLsdProgress(ci) {
    var ch = LSD_DATA.chapters[ci];
    if (!ch) return;
    var total = ch.questions.length, correct = 0, done = 0;
    ch.questions.forEach(function (q) {
      var r = lsdResults[q.id];
      if (r) { done++; if (r.status === "correct") correct++; }
    });
    if (lessonProgress) {
      lessonProgress.innerHTML =
        "<div class='qp-row'>" +
        "<span class='qp-item ok'>Đúng: <b>" + correct + "</b></span>" +
        "<span class='qp-item bad'>Sai: <b>" + (done - correct) + "</b></span>" +
        "<span class='qp-item'>Còn lại: <b>" + (total - done) + "</b></span>" +
        "</div>";
    }
  }

  function renderLsdEssay() {
    content.innerHTML = "";
    var qs = LSD_ESSAY_DATA.questions || [];
    var container = document.createElement("div");
    container.className = "essay-container";

    var hero = document.createElement("div");
    hero.className = "essay-hero";
    hero.innerHTML =
      '<div class="essay-hero-head"><span class="essay-hero-badge">ĐỀ CƯƠNG TRỌNG TÂM</span>' +
      '<span style="font-size:12px;color:var(--gold);font-weight:700">KỲ II NĂM HỌC 2025 - 2026</span></div>' +
      '<h1>📝 8 Câu hỏi Tự luận Lịch sử Đảng</h1>' +
      '<p>Đề cương rút gọn, gạch đầu dòng then chốt, tích hợp phân tích Đúng/Sai và liên hệ thực tế sinh viên.</p>';
    container.appendChild(hero);

    qs.forEach(function (q) {
      var isL = !!essayLearned[q.id];
      var card = document.createElement("div");
      card.id = "essayCard_" + q.id;
      card.className = "essay-card" + (isL ? " learned" : "");

      var head = document.createElement("div");
      head.className = "essay-card-header";
      head.innerHTML =
        "<div class='ec-no'>Câu " + q.id + "</div>" +
        "<div class='ec-title-wrap'>" +
        "<div class='ec-title'>" + esc(q.title) + "</div>" +
        "<div class='ec-tags'>" + (q.tags || []).map(function (t) { return "<span class='ec-tag'>" + esc(t) + "</span>"; }).join("") + "</div>" +
        "</div>" +
        "<div class='ec-actions'>" +
        "<button class='btn-learn-check" + (isL ? " is-learned" : "") + "'>" + (isL ? "✓ Đã thuộc" : "Đánh dấu đã thuộc") + "</button>" +
        "<span class='ec-chev'>▼</span>" +
        "</div>";

      var body = document.createElement("div");
      body.className = "essay-card-body";

      var shortBox = "<div class='essay-short-box'><div class='esb-title'>⚡ Tóm tắt siêu ngắn:</div><ul class='esb-list'>" +
        (q.shortPoints || []).map(function (p) { return "<li>" + p + "</li>"; }).join("") + "</ul></div>";

      var secHtml = "<div class='essay-sections-wrap'>" +
        (q.sections || []).map(function (s) {
          var cls = "essay-sec";
          if (s.heading && s.heading.indexOf("Đúng/Sai") !== -1) cls += " sec-tips";
          if (s.heading && s.heading.indexOf("Liên hệ") !== -1) cls += " sec-lienhe";
          return "<div class='" + cls + "'><div class='essay-sec-head'>" + esc(s.heading) + "</div>" +
            "<div class='essay-sec-items'>" + (s.items || []).map(function (it) { return "<div>" + it + "</div>"; }).join("") + "</div></div>";
        }).join("") + "</div>";

      body.innerHTML = shortBox + secHtml;

      head.onclick = function (e) {
        if (e.target.closest(".btn-learn-check")) {
          essayLearned[q.id] = !essayLearned[q.id];
          saveResults(LSD_ESSAY_KEY, essayLearned);
          card.classList.toggle("learned", !!essayLearned[q.id]);
          var btn = head.querySelector(".btn-learn-check");
          btn.classList.toggle("is-learned", !!essayLearned[q.id]);
          btn.textContent = essayLearned[q.id] ? "✓ Đã thuộc" : "Đánh dấu đã thuộc";
          updateLsdEssayProgress();
          refreshLsdEssayQnav();
          return;
        }
        card.classList.toggle("open");
      };

      card.appendChild(head);
      card.appendChild(body);
      container.appendChild(card);
    });

    content.appendChild(container);
  }

  function renderLsdEssayQnav() {
    var qs = LSD_ESSAY_DATA.questions || [];
    qnavGrid.innerHTML = "";
    qnavCells = [];
    qTitle("Tự luận 8 câu");
    qs.forEach(function (q) {
      var cell = document.createElement("div");
      cell.className = "qnav-cell" + (essayLearned[q.id] ? " ok" : "");
      cell.textContent = "C" + q.id;
      cell.onclick = function () {
        var card = document.getElementById("essayCard_" + q.id);
        if (card) {
          card.classList.add("open");
          card.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      };
      qnavGrid.appendChild(cell);
      qnavCells.push(cell);
    });
  }

  function refreshLsdEssayQnav() {
    var qs = LSD_ESSAY_DATA.questions || [];
    qs.forEach(function (q, qi) {
      var cell = qnavCells[qi];
      if (!cell) return;
      cell.className = "qnav-cell" + (essayLearned[q.id] ? " ok" : "");
    });
  }

  function updateLsdEssayProgress() {
    var qs = LSD_ESSAY_DATA.questions || [];
    var total = qs.length, count = 0;
    qs.forEach(function (q) { if (essayLearned[q.id]) count++; });
    if (lessonProgress) {
      lessonProgress.innerHTML =
        "<div class='qp-row'>" +
        "<span class='qp-item ok'>Đã thuộc: <b>" + count + "/" + total + "</b></span>" +
        "<span class='qp-item'>Chưa thuộc: <b>" + (total - count) + "</b></span>" +
        "</div>";
    }
  }

  /* ========================================================
     PLDC RENDERING (4 Dạng bài)
     ======================================================== */
  function selectPldcTN(ci) {
    currentView = { type: "pldc_tn", ci: ci };
    welcome.style.display = "none";
    renderTree();
    renderPldcTN(ci);
    renderPldcTNQnav(ci);
    updatePldcTNProgress(ci);
    updateQnavVisibility();
  }

  function selectPldcDS() {
    currentView = { type: "pldc_ds" };
    welcome.style.display = "none";
    renderTree();
    renderPldcDS();
    renderPldcDSQnav();
    updatePldcDSProgress();
    updateQnavVisibility();
  }

  function selectPldcQPPL() {
    currentView = { type: "pldc_qppl" };
    welcome.style.display = "none";
    renderTree();
    renderPldcQPPL();
    qnav.classList.add("hidden");
  }

  function selectPldcTK() {
    currentView = { type: "pldc_tk" };
    welcome.style.display = "none";
    renderTree();
    renderPldcTK();
    qnav.classList.add("hidden");
  }

  function renderPldcTN(ci) {
    content.innerHTML = "";
    var ch = PLDC_DATA.trac_nghiem[ci];
    if (!ch) return;

    var h = document.createElement("div");
    h.className = "lesson-heading";
    h.textContent = ch.title + (ch.subtitle ? " — " + ch.subtitle : "");
    content.appendChild(h);

    ch.questions.forEach(function (q, qi) {
      var card = createQuestionCard(q, qi, "pldc", function (optKey) {
        handleAnswer(q, optKey, "pldc", function () {
          updatePldcTNProgress(ci);
          refreshPldcTNQnav(ci);
        });
      });
      content.appendChild(card);
    });
  }

  function renderPldcTNQnav(ci) {
    var ch = PLDC_DATA.trac_nghiem[ci];
    if (!ch) return;
    qnavGrid.innerHTML = "";
    qnavCells = [];
    qTitle(ch.title);

    ch.questions.forEach(function (q, qi) {
      var cell = document.createElement("div");
      var r = pldcResults[q.id];
      cell.className = "qnav-cell" + (r ? (r.status === "correct" ? " ok" : " bad") : "");
      cell.textContent = qi + 1;
      cell.onclick = function () {
        var cards = content.querySelectorAll(".q-card");
        if (cards[qi]) cards[qi].scrollIntoView({ behavior: "smooth", block: "center" });
      };
      qnavGrid.appendChild(cell);
      qnavCells.push(cell);
    });
  }

  function refreshPldcTNQnav(ci) {
    var ch = PLDC_DATA.trac_nghiem[ci];
    if (!ch) return;
    ch.questions.forEach(function (q, qi) {
      var cell = qnavCells[qi];
      if (!cell) return;
      var r = pldcResults[q.id];
      cell.className = "qnav-cell" + (r ? (r.status === "correct" ? " ok" : " bad") : "");
    });
  }

  function updatePldcTNProgress(ci) {
    var ch = PLDC_DATA.trac_nghiem[ci];
    if (!ch) return;
    var total = ch.questions.length, correct = 0, done = 0;
    ch.questions.forEach(function (q) {
      var r = pldcResults[q.id];
      if (r) { done++; if (r.status === "correct") correct++; }
    });
    if (lessonProgress) {
      lessonProgress.innerHTML =
        "<div class='qp-row'>" +
        "<span class='qp-item ok'>Đúng: <b>" + correct + "</b></span>" +
        "<span class='qp-item bad'>Sai: <b>" + (done - correct) + "</b></span>" +
        "<span class='qp-item'>Còn lại: <b>" + (total - done) + "</b></span>" +
        "</div>";
    }
  }

  function renderPldcDS() {
    content.innerHTML = "";
    var qs = PLDC_DATA.dung_sai || [];

    var hero = document.createElement("div");
    hero.className = "lesson-heading";
    hero.textContent = "⚖️ Nhận định Đúng / Sai — Toàn bộ học phần";
    content.appendChild(hero);

    qs.forEach(function (q, qi) {
      var card = document.createElement("div");
      card.className = "ds-card";
      card.id = "dsCard_" + q.id;

      var qTitleDiv = document.createElement("div");
      qTitleDiv.className = "ds-q-text";
      qTitleDiv.innerHTML = "<b>Câu " + (qi + 1) + ":</b> " + esc(q.q) +
        (q.isDoubt ? " <span class='tag-doubt'>⚠️ Nghi vấn kết quả</span>" : "");
      card.appendChild(qTitleDiv);

      var btnGroup = document.createElement("div");
      btnGroup.className = "ds-btn-group";

      var btnD = document.createElement("button");
      btnD.className = "ds-btn";
      btnD.textContent = "Đúng (Đ)";

      var btnS = document.createElement("button");
      btnS.className = "ds-btn";
      btnS.textContent = "Sai (S)";

      var explainBox = document.createElement("div");
      explainBox.className = "ds-explain-box";
      explainBox.style.display = "none";

      var doubtBox = "";
      if (q.isDoubt && q.doubtNote) {
        doubtBox = "<div class='doubt-box'><strong>⚠️ Phân tích nghi vấn:</strong> " + esc(q.doubtNote) + "</div>";
      }

      function updateCardState(selectedVal) {
        var isCorrect = (selectedVal === q.answer || (selectedVal === "Đ" && q.answer === "Đúng") || (selectedVal === "S" && q.answer === "Sai"));
        btnD.disabled = true;
        btnS.disabled = true;

        if (selectedVal === "Đ") {
          btnD.classList.add(isCorrect ? "selected-correct" : "selected-wrong");
          if (!isCorrect) btnS.classList.add("selected-correct");
        } else {
          btnS.classList.add(isCorrect ? "selected-correct" : "selected-wrong");
          if (!isCorrect) btnD.classList.add("selected-correct");
        }

        explainBox.style.display = "block";
        explainBox.innerHTML = "<strong>Đáp án: " + (q.answer === "Đ" ? "ĐÚNG" : "SAI") + "</strong>. " + esc(q.explain) + doubtBox;

        pldcResults[q.id] = {
          selected: selectedVal,
          status: isCorrect ? "correct" : "wrong",
          everCorrect: isCorrect,
          answeredAt: Date.now()
        };
        saveResults(PLDC_STORE_KEY, pldcResults);

        if (isCorrect) {
          currentStreak++;
          playCorrect();
        } else {
          currentStreak = 0;
          playWrong();
        }
        updateCombo();
        updateRank();
        renderTree();
        updatePldcDSProgress();
        refreshPldcDSQnav();
      }

      btnD.onclick = function () { updateCardState("Đ"); };
      btnS.onclick = function () { updateCardState("S"); };

      btnGroup.appendChild(btnD);
      btnGroup.appendChild(btnS);
      card.appendChild(btnGroup);
      card.appendChild(explainBox);

      var saved = pldcResults[q.id];
      if (saved && saved.selected) {
        updateCardState(saved.selected);
      }

      content.appendChild(card);
    });
  }

  function renderPldcDSQnav() {
    var qs = PLDC_DATA.dung_sai || [];
    qnavGrid.innerHTML = "";
    qnavCells = [];
    qTitle("Nhận định Đúng/Sai");

    qs.forEach(function (q, qi) {
      var cell = document.createElement("div");
      var r = pldcResults[q.id];
      cell.className = "qnav-cell" + (r ? (r.status === "correct" ? " ok" : " bad") : "");
      cell.textContent = qi + 1;
      cell.onclick = function () {
        var card = document.getElementById("dsCard_" + q.id);
        if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
      };
      qnavGrid.appendChild(cell);
      qnavCells.push(cell);
    });
  }

  function refreshPldcDSQnav() {
    var qs = PLDC_DATA.dung_sai || [];
    qs.forEach(function (q, qi) {
      var cell = qnavCells[qi];
      if (!cell) return;
      var r = pldcResults[q.id];
      cell.className = "qnav-cell" + (r ? (r.status === "correct" ? " ok" : " bad") : "");
    });
  }

  function updatePldcDSProgress() {
    var qs = PLDC_DATA.dung_sai || [];
    var total = qs.length, correct = 0, done = 0;
    qs.forEach(function (q) {
      var r = pldcResults[q.id];
      if (r) { done++; if (r.status === "correct") correct++; }
    });
    if (lessonProgress) {
      lessonProgress.innerHTML =
        "<div class='qp-row'>" +
        "<span class='qp-item ok'>Đúng: <b>" + correct + "</b></span>" +
        "<span class='qp-item bad'>Sai: <b>" + (done - correct) + "</b></span>" +
        "<span class='qp-item'>Còn lại: <b>" + (total - done) + "</b></span>" +
        "</div>";
    }
  }

  function renderPldcQPPL() {
    content.innerHTML = "";
    var list = PLDC_DATA.qppl || [];

    var hero = document.createElement("div");
    hero.className = "lesson-heading";
    hero.textContent = "📜 Phân tích Cấu trúc QPPL & Vi phạm Pháp luật";
    content.appendChild(hero);

    list.forEach(function (item, idx) {
      var card = document.createElement("div");
      card.className = "qppl-card";

      var head = document.createElement("div");
      head.className = "qppl-head";
      head.innerHTML = "<h3>" + esc(item.title) + "</h3><span>▼ Mở rộng</span>";

      var body = document.createElement("div");
      body.className = "qppl-body";

      var a = item.analysis || {};
      var sit = item.situation || {};

      body.innerHTML =
        "<div class='clause-box'><strong>Điều luật: " + esc(item.clause) + "</strong><br>" + esc(item.content) + "</div>" +
        "<div class='analysis-grid'>" +
        "<div class='analysis-item'><div class='analysis-label'>📍 Giả định:</div><div class='analysis-detail'>" + esc(a.gia_dinh) + "<br><em>" + esc(a.gia_dinh_gt) + "</em></div></div>" +
        "<div class='analysis-item'><div class='analysis-label'>📝 Quy định:</div><div class='analysis-detail'>" + esc(a.quy_dinh) + "<br><em>" + esc(a.quy_dinh_gt) + "</em></div></div>" +
        "<div class='analysis-item'><div class='analysis-label'>⚖️ Chế tài:</div><div class='analysis-detail'>" + esc(a.che_tai) + "<br><em>" + esc(a.che_tai_gt) + "</em></div></div>" +
        "<div class='analysis-item' style='background:#f0fdf4;border-color:#bbf7d0'><div class='analysis-label' style='color:#166534'>🎯 Hình thức thực hiện pháp luật:</div><div class='analysis-detail'><b>" + esc(a.hinh_thuc) + "</b></div></div>" +
        "</div>" +
        (sit.text ?
          "<div class='problem-box'><strong>⚡ Tình huống thực tế:</strong><p>" + esc(sit.text) + "</p>" +
          "<div style='margin-top:10px;display:grid;gap:8px'>" +
          (sit.elements || []).map(function (el) {
            return "<div><b>• " + esc(el.name) + ":</b> " + esc(el.detail) + "</div>";
          }).join("") +
          "</div></div>" : "");

      head.onclick = function () {
        var isOpen = body.style.display !== "none";
        body.style.display = isOpen ? "none" : "grid";
        head.querySelector("span").textContent = isOpen ? "▼ Mở rộng" : "▲ Thu gọn";
      };

      card.appendChild(head);
      card.appendChild(body);
      content.appendChild(card);
    });
  }

  function renderPldcTK() {
    content.innerHTML = "";
    var list = PLDC_DATA.thua_ke || [];

    var hero = document.createElement("div");
    hero.className = "lesson-heading";
    hero.textContent = "💼 Bài tập Chia thừa kế & Tình huống (Theo BLDS 2015)";
    content.appendChild(hero);

    list.forEach(function (item, idx) {
      var card = document.createElement("div");
      card.className = "thua-ke-card";

      var head = document.createElement("div");
      head.className = "thua-ke-head";
      head.innerHTML = "<h3>" + esc(item.title) + "</h3><span>▼ Xem lời giải</span>";

      var body = document.createElement("div");
      body.className = "thua-ke-body";

      body.innerHTML =
        "<div class='problem-box'><strong>Đề bài:</strong><br>" + esc(item.problem) + "</div>" +
        (item.diagram ? "<div class='diagram-box'><strong>Sơ đồ gia phả:</strong>\\n" + esc(item.diagram) + "</div>" : "") +
        "<div style='display:grid;gap:12px'>" +
        (item.steps || []).map(function (st) {
          return "<div class='step-box'><div class='step-title'>" + esc(st.title) + "</div><div class='step-content'>" + esc(st.content) + "</div></div>";
        }).join("") +
        "</div>";

      head.onclick = function () {
        var isOpen = body.style.display !== "none";
        body.style.display = isOpen ? "none" : "grid";
        head.querySelector("span").textContent = isOpen ? "▼ Xem lời giải" : "▲ Thu gọn";
      };

      card.appendChild(head);
      card.appendChild(body);
      content.appendChild(card);
    });
  }

  /* ========================================================
     GENERIC QUESTION CARD RENDERER (ABCD)
     ======================================================== */
  function createQuestionCard(q, qi, subj, onSelect) {
    var card = document.createElement("div");
    card.className = "q-card";
    card.id = "qCard_" + q.id;

    var head = document.createElement("div");
    head.className = "q-head";

    var doubtBadge = q.isDoubt ? " <span class='tag-doubt'>⚠️ Nghi vấn kết quả</span>" : "";
    head.innerHTML = "<span class='q-num'>Câu " + (qi + 1) + "</span>" +
      "<div class='q-text'>" + esc(q.q) + doubtBadge + "</div>";
    card.appendChild(head);

    var optWrap = document.createElement("div");
    optWrap.className = "q-options";

    var expBox = document.createElement("div");
    expBox.className = "q-explain";
    expBox.style.display = "none";

    var hintBox = document.createElement("div");
    hintBox.className = "q-hint";
    hintBox.style.display = "none";
    if (q.hint) hintBox.innerHTML = "💡 <b>Gợi ý nhớ:</b> " + esc(q.hint);

    var doubtBox = "";
    if (q.isDoubt && q.doubtNote) {
      doubtBox = "<div class='doubt-box'><strong>⚠️ Phân tích nghi vấn:</strong> " + esc(q.doubtNote) + "</div>";
    }

    var store = subj === "lsd" ? lsdResults : pldcResults;
    var r = store[q.id];

    var btnMap = {};
    for (var k in q.options) {
      (function (optKey) {
        var btn = document.createElement("button");
        btn.className = "opt-btn";
        btn.innerHTML = "<span class='opt-key'>" + optKey + "</span><span class='opt-val'>" + esc(q.options[optKey]) + "</span>";
        btn.onclick = function () {
          if (card.classList.contains("answered-ok")) return;
          onSelect(optKey);
        };
        btnMap[optKey] = btn;
        optWrap.appendChild(btn);
      })(k);
    }
    card.appendChild(optWrap);
    card.appendChild(hintBox);
    card.appendChild(expBox);

    if (r) {
      applyCardResult(card, q, r, btnMap, expBox, hintBox, doubtBox);
    }

    return card;
  }

  function handleAnswer(q, optKey, subj, onDone) {
    var store = subj === "lsd" ? lsdResults : pldcResults;
    var isCorrect = (optKey === q.answer);
    var storeKey = subj === "lsd" ? LSD_STORE_KEY : PLDC_STORE_KEY;

    var prev = store[q.id] || {};
    store[q.id] = {
      selected: optKey,
      status: isCorrect ? "correct" : "wrong",
      everCorrect: prev.everCorrect || isCorrect,
      answeredAt: Date.now()
    };
    saveResults(storeKey, store);

    if (isCorrect) {
      currentStreak++;
      playCorrect();
    } else {
      currentStreak = 0;
      playWrong();
    }

    updateCombo();
    updateRank();
    renderTree();

    var card = document.getElementById("qCard_" + q.id);
    if (card) {
      var expBox = card.querySelector(".q-explain");
      var hintBox = card.querySelector(".q-hint");
      var btnMap = {};
      card.querySelectorAll(".opt-btn").forEach(function (b) {
        var k = b.querySelector(".opt-key").textContent.trim();
        btnMap[k] = b;
      });
      var doubtBox = (q.isDoubt && q.doubtNote) ? "<div class='doubt-box'><strong>⚠️ Phân tích nghi vấn:</strong> " + esc(q.doubtNote) + "</div>" : "";
      applyCardResult(card, q, store[q.id], btnMap, expBox, hintBox, doubtBox);
    }

    if (onDone) onDone();
  }

  function applyCardResult(card, q, r, btnMap, expBox, hintBox, doubtBox) {
    for (var k in btnMap) {
      btnMap[k].classList.remove("chosen-ok", "chosen-bad", "reveal-ok");
    }
    if (r.status === "correct") {
      card.classList.add("answered-ok");
      card.classList.remove("answered-bad");
      if (btnMap[r.selected]) btnMap[r.selected].classList.add("chosen-ok");
      if (expBox) {
        expBox.style.display = "block";
        expBox.innerHTML = "<strong>Chính xác!</strong> " + esc(q.explain) + (doubtBox || "");
      }
      if (hintBox) hintBox.style.display = "none";
    } else {
      card.classList.remove("answered-ok");
      card.classList.add("answered-bad");
      if (btnMap[r.selected]) btnMap[r.selected].classList.add("chosen-bad");
      if (btnMap[q.answer]) btnMap[q.answer].classList.add("reveal-ok");
      if (expBox) {
        expBox.style.display = "block";
        expBox.innerHTML = "<strong>Đáp án đúng là " + q.answer + ".</strong> " + esc(q.explain) + (doubtBox || "");
      }
      if (hintBox && q.hint) hintBox.style.display = "block";
    }
  }

  function qTitle(t) {
    if (qnavTitle) qnavTitle.textContent = t;
  }

  /* ---------- Combo animation ---------- */
  function updateCombo() {
    var el = document.getElementById("comboBadge");
    if (!el) return;
    if (prevStreak > 0 && currentStreak === 0) {
      prevStreak = 0;
      breakCombo();
      return;
    }
    prevStreak = currentStreak;
    var scale = 1 + Math.min(currentStreak, 25) * 0.022;
    var hue = 28 + (Math.min(currentStreak, 25) / 25) * 252;
    el.style.setProperty("--combo-scale", scale.toFixed(3));
    el.style.setProperty("--combo-hue", hue.toFixed(0));
    el.style.background = "linear-gradient(135deg, hsl(var(--combo-hue),85%,55%), hsl(calc(var(--combo-hue) + 18),85%,62%))";
    el.innerHTML = currentStreak >= 1 ? ("🔥 <b>x" + currentStreak + "</b>") : "🔥";
    el.classList.add("show");
    if (currentStreak >= 1) {
      el.classList.remove("pop");
      void el.offsetWidth;
      el.classList.add("pop");
      playCombo(currentStreak);
    }
  }

  function breakCombo() {
    var el = document.getElementById("comboBadge");
    if (!el) return;
    el.classList.remove("show");
  }

  /* ---------- Leaderboard Modal ---------- */
  var activeLbSubj = "lsd";
  function openLeaderboard() {
    activeLbSubj = currentSubject;
    var m = document.getElementById("leaderboardModal");
    m.classList.remove("hidden");
    updateLbTabs();
    fetchLeaderboard(activeLbSubj);
  }

  function updateLbTabs() {
    var btnLsd = document.getElementById("btnLbLsd");
    var btnPldc = document.getElementById("btnLbPldc");
    if (btnLsd) btnLsd.classList.toggle("active", activeLbSubj === "lsd");
    if (btnPldc) btnPldc.classList.toggle("active", activeLbSubj === "pldc");
  }

  function fetchLeaderboard(subj) {
    var body = document.getElementById("lbBody");
    body.innerHTML = "<p style='color:var(--ink-soft)'>Đang tải bảng xếp hạng " + (subj === "lsd" ? "Lịch sử Đảng" : "Pháp luật đại cương") + "…</p>";

    fetch("/api/leaderboard?subject=" + subj)
      .then(function (r) { return r.json(); })
      .then(function (list) {
        if (!list || !list.length) {
          body.innerHTML = "<p style='color:var(--ink-soft)'>Chưa có dữ liệu bảng xếp hạng môn này. Hãy làm bài để lên top!</p>";
          return;
        }
        var ranksLadder = subj === "lsd" ? LSD_RANKS : PLDC_RANKS;
        function getRk(score) {
          var cur = ranksLadder[0];
          for (var i = 0; i < ranksLadder.length; i++) {
            if (score >= ranksLadder[i].min) cur = ranksLadder[i];
          }
          return cur;
        }
        var rows = list.map(function (e) {
          var me = (e.name === playerName) ? " me" : "";
          var rk = getRk(e.score);
          return "<tr class='lb-row" + me + "'><td>" + e.rank + "</td><td>" + esc(e.name) + "</td><td>" + e.score + "</td>" +
            "<td class='lb-rank'><img src='ranks/" + rk.key + ".png' alt='" + rk.name + "'><span>" + rk.name + "</span></td></tr>";
        }).join("");
        body.innerHTML =
          "<table class='lb-table'><thead><tr><th>#</th><th>Tên</th><th>Câu đúng</th><th>Hạng</th></tr></thead><tbody>" + rows + "</tbody></table>";
      })
      .catch(function () {
        body.innerHTML = "<p style='color:var(--bad)'>Không tải được bảng xếp hạng.</p>";
      });
  }

  /* ---------- Dashboard Modal ---------- */
  function openDashboard() {
    dashModal.classList.remove("hidden");
    if (currentSubject === "lsd") {
      var rInfo = computeRankLSD();
      dashBody.innerHTML =
        "<h3>📊 Tiến độ Lịch sử Đảng</h3>" +
        "<p>Tổng số câu đúng: <b>" + rInfo.correct + "/" + rInfo.total + "</b> (" + (rInfo.total ? Math.round((rInfo.correct / rInfo.total) * 100) : 0) + "%)</p>" +
        "<p>Hạng hiện tại: <b>" + rInfo.current.name + "</b></p>";
    } else {
      var rInfoP = computeRankPLDC();
      dashBody.innerHTML =
        "<h3>📊 Tiến độ Pháp luật đại cương</h3>" +
        "<p>Tổng số câu đúng (Trắc nghiệm + Đúng/Sai): <b>" + rInfoP.correct + "/" + rInfoP.total + "</b> (" + (rInfoP.total ? Math.round((rInfoP.correct / rInfoP.total) * 100) : 0) + "%)</p>" +
        "<p>Hạng hiện tại: <b>" + rInfoP.current.name + "</b></p>";
    }
  }

  /* ---------- Rank modal ---------- */
  function openRankModal() {
    var ranks = currentSubject === "lsd" ? LSD_RANKS : PLDC_RANKS;
    var rInfo = currentSubject === "lsd" ? computeRankLSD() : computeRankPLDC();
    var modal = document.getElementById("rankModal");
    var body = document.getElementById("rankBody");
    body.innerHTML =
      "<p>Môn hiện tại: <b>" + (currentSubject === "lsd" ? "Lịch sử Đảng" : "Pháp luật đại cương") + "</b></p>" +
      "<div class='rank-list'>" +
      ranks.map(function (rk) {
        var isCur = (rk.key === rInfo.current.key) ? " cur" : "";
        return "<div class='rank-item" + isCur + "'>" +
          "<img src='ranks/" + rk.key + ".png' alt='" + rk.name + "'>" +
          "<div><strong>" + rk.name + "</strong><span>Từ " + rk.min + " câu đúng</span></div>" +
          "</div>";
      }).join("") +
      "</div>";
    modal.classList.remove("hidden");
  }

  /* ---------- Player Name ---------- */
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

  /* ---------- Wire top events & Initialization ---------- */
  btnSubjectLSD.onclick = function () { setSubject("lsd"); };
  btnSubjectPLDC.onclick = function () { setSubject("pldc"); };

  document.getElementById("btnDashboard").onclick = openDashboard;
  document.getElementById("btnDashClose").onclick = function () { dashModal.classList.add("hidden"); };
  dashModal.onclick = function (e) { if (e.target === dashModal) dashModal.classList.add("hidden"); };

  document.getElementById("rankBig").onclick = openRankModal;
  document.getElementById("btnRankClose").onclick = function () { document.getElementById("rankModal").classList.add("hidden"); };
  document.getElementById("rankModal").onclick = function (e) { if (e.target === document.getElementById("rankModal")) document.getElementById("rankModal").classList.add("hidden"); };

  document.getElementById("btnLeaderboard").onclick = openLeaderboard;
  document.getElementById("btnLbClose").onclick = function () { document.getElementById("leaderboardModal").classList.add("hidden"); };
  document.getElementById("leaderboardModal").onclick = function (e) { if (e.target === document.getElementById("leaderboardModal")) document.getElementById("leaderboardModal").classList.add("hidden"); };

  var btnLbLsd = document.getElementById("btnLbLsd");
  if (btnLbLsd) {
    btnLbLsd.onclick = function () {
      activeLbSubj = "lsd";
      updateLbTabs();
      fetchLeaderboard("lsd");
    };
  }
  var btnLbPldc = document.getElementById("btnLbPldc");
  if (btnLbPldc) {
    btnLbPldc.onclick = function () {
      activeLbSubj = "pldc";
      updateLbTabs();
      fetchLeaderboard("pldc");
    };
  }

  document.getElementById("btnNameOk").onclick = submitName;
  document.getElementById("nameInput").addEventListener("keydown", function (e) { if (e.key === "Enter") submitName(); });
  document.getElementById("btnMenu").onclick = function () { document.getElementById("sidebar").classList.toggle("open"); };

  document.getElementById("btnResetAll").onclick = function () {
    if (confirm("Xóa TOÀN BỘ tiến độ môn " + (currentSubject === "lsd" ? "Lịch sử Đảng" : "Pháp luật đại cương") + "?")) {
      if (currentSubject === "lsd") {
        lsdResults = {};
        saveResults(LSD_STORE_KEY, lsdResults);
      } else {
        pldcResults = {};
        saveResults(PLDC_STORE_KEY, pldcResults);
      }
      renderTree();
      showWelcome();
      updateRank();
      updateQnavVisibility();
    }
  };

  /* Initialize */
  setSubject(currentSubject);
  ensureName();
})();
