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
    { key: "2",  name: "Hạng Đồng",       min: 10 },
    { key: "3",  name: "Hạng Bạc",        min: 20 },
    { key: "4",  name: "Hạng Vàng",       min: 35 },
    { key: "5",  name: "Hạng Bạch Kim",   min: 50 },
    { key: "6",  name: "Hạng Lục Bảo",    min: 65 },
    { key: "7",  name: "Hạng Kim Cương",  min: 75 },
    { key: "8",  name: "Hạng Cao Thủ",    min: 85 },
    { key: "9",  name: "Hạng Đại Cao Thủ", min: 95 },
    { key: "10", name: "Hạng Thách Đấu",  min: 100 }
  ];

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
      "<img src='ranks/" + rInfo.current.key + ".png' alt='" + esc(rInfo.current.name) + "' class='rb-emblem'>" +
      "<div class='rb-info'>" +
      "<div class='rb-name'>" + esc(rInfo.current.name) + "</div>" +
      "<div class='rb-sub'>" + rInfo.correct + "/" + rInfo.total + " câu đúng (" + nextText + ")</div>" +
      "<div class='rb-track'><span class='rb-fill' style='width:" + pct + "%'></span></div>" +
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
      brandSub.textContent = "Trắc nghiệm & Tình huống";
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
      "<button id='tabPldcQPPL' class='mode-tab " + (pldcMode === "qppl" ? "active" : "") + "'>📜 Cấu trúc 16 Điều luật</button>" +
      "<button id='tabPldcTH' class='mode-tab " + (pldcMode === "tinh_huong" ? "active" : "") + "'>⚡ 16 Tình huống VPPL & QHPL</button>" +
      "<button id='tabPldcTK' class='mode-tab " + (pldcMode === "thua_ke" ? "active" : "") + "'>💼 7 Bài tập Chia thừa kế</button>";

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
    document.getElementById("tabPldcTH").onclick = function () {
      pldcMode = "tinh_huong";
      renderPldcModeTabs();
      renderTree();
      selectPldcTH();
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
        bQP.innerHTML = "<span class='lt'>📜 16 Điều luật Cấu trúc QPPL</span><span class='ls'>Giả định - Quy định - Chế tài - Hình thức thực hiện</span>";
        bQP.onclick = selectPldcQPPL;
        tree.appendChild(bQP);
      } else if (pldcMode === "tinh_huong") {
        var bTH = document.createElement("button");
        bTH.className = "lesson-btn active";
        bTH.innerHTML = "<span class='lt'>⚡ 16 Tình huống VPPL & QHPL</span><span class='ls'>Phân tích 4 yếu tố cấu thành & Cấu trúc QHPL</span>";
        bTH.onclick = selectPldcTH;
        tree.appendChild(bTH);
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
        '<div class="welcome-essay-banner" id="btnWelcomePLDC">' +
          '<div class="web-content">' +
            '<span class="web-tag">⚖️ Môn học Pháp luật đại cương</span>' +
            '<h2>💼 Tổng hợp Đề cương &amp; 4 Dạng bài Ôn tập Chuẩn (HAUI)</h2>' +
            '<p>Hệ thống đầy đủ Trắc nghiệm ABCD, nhận định Đúng/Sai có giải thích, phân tích Cấu trúc QPPL và Hướng dẫn giải chi tiết Bài tập Chia thừa kế (Điều 644, 651, 652 BLDS 2015).</p>' +
          '</div>' +
          '<button class="ghost-btn web-btn">Vào ôn Trắc nghiệm ngay →</button>' +
        '</div>' +
        '<h1>Ôn tập Pháp luật đại cương</h1>' +
        '<p>Cấu trúc ôn tập 4 dạng bài bám sát đề thi kết thúc học phần:</p>' +
        '<ul class="welcome-tips">' +
          '<li>🎯 <b>Trắc nghiệm 4 lựa chọn (ABCD):</b> Đầy đủ các chương kèm giải thích điều luật cụ thể.</li>' +
          '<li>⚖️ <b>Nhận định Đúng / Sai:</b> Luyện nhận định nhanh kèm căn cứ pháp lý và phân tích điểm mấu chốt.</li>' +
          '<li>📜 <b>Cấu trúc QPPL &amp; Vi phạm PL:</b> Hướng dẫn bóc tách Giả định - Quy định - Chế tài và 4 yếu tố cấu thành.</li>' +
          '<li>💼 <b>Chia thừa kế &amp; Tình huống:</b> Hướng dẫn phương pháp giải từng bước kèm sơ đồ gia phả trực quan.</li>' +
          '<li>⚠️ <b>Tag [Nghi vấn kết quả]:</b> Tự động cảnh báo và đối chiếu các câu có đáp án tài liệu cũ mâu thuẫn hoặc căn cứ luật đã sửa đổi.</li>' +
        '</ul>';

      var bWp = document.getElementById("btnWelcomePLDC");
      if (bWp) bWp.onclick = function () { selectPldcTN(0); };
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
      cell.className = "qnav-cell" + (r ? (r.status === "correct" ? " done" : " miss") : "");
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
      cell.className = "qnav-cell" + (r ? (r.status === "correct" ? " done" : " miss") : "");
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
      '<h1 class="essay-hero-title">📝 8 Câu hỏi Tự luận Lịch sử Đảng</h1>' +
      '<p class="essay-hero-sub">Đề cương rút gọn, gạch đầu dòng then chốt, tích hợp phân tích Đúng/Sai và liên hệ thực tế sinh viên.</p>';
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
      cell.className = "qnav-cell" + (essayLearned[q.id] ? " done" : "");
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
      cell.className = "qnav-cell" + (essayLearned[q.id] ? " done" : "");
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

  function selectPldcTH() {
    currentView = { type: "pldc_tinh_huong" };
    welcome.style.display = "none";
    renderTree();
    renderPldcTH();
    qnav.classList.add("hidden");
  }

  function selectPldcTK() {
    currentView = { type: "pldc_thua_ke" };
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
      cell.className = "qnav-cell" + (r ? (r.status === "correct" ? " done" : " miss") : "");
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
      cell.className = "qnav-cell" + (r ? (r.status === "correct" ? " done" : " miss") : "");
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

      var qNo = document.createElement("span");
      qNo.className = "q-no";
      qNo.textContent = "Câu " + (qi + 1);
      card.appendChild(qNo);

      var qText = document.createElement("div");
      qText.className = "ds-q-text";
      var doubtTag = q.isDoubt ? " <span class='tag-doubt'>⚠️ Nghi vấn</span>" : "";
      qText.innerHTML = esc(q.q) + doubtTag;
      card.appendChild(qText);

      var btnWrap = document.createElement("div");
      btnWrap.className = "ds-btn-wrap";

      var btnD = document.createElement("button");
      btnD.className = "ds-opt-btn";
      btnD.innerHTML = "<span class='key' style='background:#e3f3e8;color:#1f7a44'>Đ</span> Đúng";

      var btnS = document.createElement("button");
      btnS.className = "ds-opt-btn";
      btnS.innerHTML = "<span class='key' style='background:#fbe7e5;color:#b3261e'>S</span> Sai";

      var fbBox = document.createElement("div");
      fbBox.className = "feedback";

      function updateCard(selectedVal) {
        var isCorrect = (selectedVal === q.answer || (selectedVal === "Đ" && q.answer === "Đúng") || (selectedVal === "S" && q.answer === "Sai"));
        btnD.classList.add("locked");
        btnS.classList.add("locked");

        if (selectedVal === "Đ") {
          btnD.classList.add(isCorrect ? "correct" : "wrong");
          if (!isCorrect) btnS.classList.add("correct");
        } else {
          btnS.classList.add(isCorrect ? "correct" : "wrong");
          if (!isCorrect) btnD.classList.add("correct");
        }

        fbBox.className = "feedback show " + (isCorrect ? "ok" : "bad");
        var doubtBox = (q.isDoubt && q.doubtNote) ? "<div class='doubt-box'><strong>⚠️ Phân tích nghi vấn:</strong> " + esc(q.doubtNote) + "</div>" : "";
        fbBox.innerHTML = "<span class='fb-title'>" + (isCorrect ? "Chính xác! Đáp án là " + (q.answer === "Đ" ? "ĐÚNG" : "SAI") : "Đáp án đúng là " + (q.answer === "Đ" ? "ĐÚNG" : "SAI")) + "</span>" +
          "<div>" + esc(q.explain) + "</div>" + doubtBox;

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

      btnD.onclick = function () { updateCard("Đ"); };
      btnS.onclick = function () { updateCard("S"); };

      btnWrap.appendChild(btnD);
      btnWrap.appendChild(btnS);
      card.appendChild(btnWrap);
      card.appendChild(fbBox);

      var saved = pldcResults[q.id];
      if (saved && saved.selected) {
        updateCard(saved.selected);
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
      cell.className = "qnav-cell" + (r ? (r.status === "correct" ? " done" : " miss") : "");
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
      cell.className = "qnav-cell" + (r ? (r.status === "correct" ? " done" : " miss") : "");
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
    var list = PLDC_DATA.qppl_dieu_luat || [];
    var container = document.createElement("div");
    container.className = "essay-container";

    var hero = document.createElement("div");
    hero.className = "essay-hero";
    hero.innerHTML =
      '<div class="essay-hero-head"><span class="essay-hero-badge">CẤU TRÚC ĐIỀU LUẬT (QPPL)</span></div>' +
      '<h1 class="essay-hero-title">📜 Phân tích Cấu trúc 16 Điều luật Mẫu</h1>' +
      '<p class="essay-hero-sub">Phân tích chuyên sâu 3 bộ phận Giả định - Quy định - Chế tài và xác định chính xác Hình thức thực hiện pháp luật (Tuân thủ / Thi hành / Sử dụng / Áp dụng).</p>';
    container.appendChild(hero);

    list.forEach(function (item, idx) {
      var card = document.createElement("div");
      card.className = "essay-card";

      var head = document.createElement("div");
      head.className = "essay-card-header";
      head.innerHTML =
        "<div class='ec-no'>Điều " + (idx + 1) + "</div>" +
        "<div class='ec-title-wrap'>" +
        "<div class='ec-title'>" + esc(item.title) + "</div>" +
        "<div class='ec-tags'><span class='ec-tag'>" + esc(item.clause) + "</span></div>" +
        "</div>" +
        "<div class='ec-actions'><span class='ec-chev'>▼</span></div>";

      var body = document.createElement("div");
      body.className = "essay-card-body";

      var clauseHtml = "<div class='essay-short-box'><div class='esb-title'>📖 Trích dẫn điều luật:</div><p style='margin:0;line-height:1.6;font-size:16px'>" + esc(item.content) + "</p></div>";

      var analysisHtml = "<div class='essay-sections-wrap'>" +
        "<div class='essay-sec'><div class='essay-sec-head'>📍 1. Giả định</div><div class='essay-sec-items'><b>Nội dung:</b> " + esc(item.gia_dinh) + "<br><em>Giải thích: " + esc(item.gia_dinh_gt) + "</em></div></div>" +
        "<div class='essay-sec'><div class='essay-sec-head'>📝 2. Quy định</div><div class='essay-sec-items'><b>Nội dung:</b> " + esc(item.quy_dinh) + "<br><em>Giải thích: " + esc(item.quy_dinh_gt) + "</em></div></div>" +
        "<div class='essay-sec'><div class='essay-sec-head'>⚖️ 3. Chế tài</div><div class='essay-sec-items'><b>Nội dung:</b> " + esc(item.che_tai) + "<br><em>Giải thích: " + esc(item.che_tai_gt) + "</em></div></div>" +
        "<div class='essay-sec sec-lienhe'><div class='essay-sec-head'>🎯 4. Hình thức thực hiện pháp luật</div><div class='essay-sec-items'><b>" + esc(item.hinh_thuc) + "</b><br><em>Giải thích: " + esc(item.hinh_thuc_gt) + "</em></div></div>" +
        (item.vi_du ? "<div class='essay-sec sec-tips'><div class='essay-sec-head'>💡 5. Ví dụ minh họa thực tế</div><div class='essay-sec-items'><div>" + esc(item.vi_du) + "</div></div></div>" : "") +
        "</div>";

      body.innerHTML = clauseHtml + analysisHtml;
      head.onclick = function () { card.classList.toggle("open"); };

      card.appendChild(head);
      card.appendChild(body);
      container.appendChild(card);
    });

    content.appendChild(container);
  }

  function renderPldcTH() {
    content.innerHTML = "";
    var list = PLDC_DATA.qppl_tinh_huong || [];
    var container = document.createElement("div");
    container.className = "essay-container";

    var hero = document.createElement("div");
    hero.className = "essay-hero";
    hero.innerHTML =
      '<div class="essay-hero-head"><span class="essay-hero-badge">TÌNH HUỐNG THỰC TẾ</span></div>' +
      '<h1 class="essay-hero-title">⚡ 16 Bài tập Tình huống Vi phạm PL &amp; Quan hệ PL</h1>' +
      '<p class="essay-hero-sub">Phân tích rành mạch 4 yếu tố cấu thành vi phạm pháp luật (Mặt khách quan, Mặt chủ quan, Khách thể, Chủ thể) và 3 yếu tố cấu thành quan hệ pháp luật (Chủ thể, Khách thể, Nội dung).</p>';
    container.appendChild(hero);

    list.forEach(function (item, idx) {
      var card = document.createElement("div");
      card.className = "essay-card";

      var typeBadge = item.type === "vppl" ? "Vi phạm pháp luật" : "Quan hệ pháp luật";
      var head = document.createElement("div");
      head.className = "essay-card-header";
      head.innerHTML =
        "<div class='ec-no'>TH " + (idx + 1) + "</div>" +
        "<div class='ec-title-wrap'>" +
        "<div class='ec-title'>" + esc(item.title) + "</div>" +
        "<div class='ec-tags'><span class='ec-tag'>" + typeBadge + "</span></div>" +
        "</div>" +
        "<div class='ec-actions'><span class='ec-chev'>▼</span></div>";

      var body = document.createElement("div");
      body.className = "essay-card-body";

      var probHtml = "<div class='essay-short-box'><div class='esb-title'>📋 Đề bài tình huống:</div><p style='margin:0;line-height:1.6;font-size:16px'>" + esc(item.problem) + "</p></div>";

      var conclusionHtml = item.conclusion ?
        "<div class='essay-sec sec-tips'><div class='essay-sec-head'>🎯 Kết luận trách nhiệm pháp lý</div><div class='essay-sec-items'><b>" + esc(item.conclusion) + "</b></div></div>" : "";

      var elementsHtml = "<div class='essay-sections-wrap'>" +
        conclusionHtml +
        (item.elements || []).map(function (el) {
          var cls = "essay-sec";
          if (el.label && (el.label.includes("Khách quan") || el.label.includes("Chủ thể"))) cls += " sec-tips";
          if (el.label && (el.label.includes("Nội dung") || el.label.includes("Trách nhiệm"))) cls += " sec-lienhe";
          var itemsList = el.items || (el.content ? [el.content] : []);
          return "<div class='" + cls + "'><div class='essay-sec-head'>" + esc(el.label) + "</div>" +
            "<div class='essay-sec-items'>" +
            itemsList.map(function (it) { return "<div>" + esc(it) + "</div>"; }).join("") +
            "</div></div>";
        }).join("") +
        "</div>";

      body.innerHTML = probHtml + elementsHtml;
      head.onclick = function () { card.classList.toggle("open"); };

      card.appendChild(head);
      card.appendChild(body);
      container.appendChild(card);
    });

    content.appendChild(container);
  }

  function renderPldcTK() {
    content.innerHTML = "";
    var list = PLDC_DATA.thua_ke || [];
    var container = document.createElement("div");
    container.className = "essay-container";

    var hero = document.createElement("div");
    hero.className = "essay-hero";
    hero.innerHTML =
      '<div class="essay-hero-head"><span class="essay-hero-badge">CHIA THỪA KẾ (BLDS 2015)</span></div>' +
      '<h1 class="essay-hero-title">💼 Bài tập Chia thừa kế &amp; Tình huống thực tế</h1>' +
      '<p class="essay-hero-sub">Phương pháp giải từng bước: Tính di sản, phân định di chúc/pháp luật, áp dụng Điều 644 (người thừa kế không phụ thuộc di chúc) và thừa kế thế vị Điều 652.</p>';
    container.appendChild(hero);

    list.forEach(function (item, idx) {
      var card = document.createElement("div");
      card.className = "essay-card";

      var head = document.createElement("div");
      head.className = "essay-card-header";
      head.innerHTML =
        "<div class='ec-no'>Bài " + (idx + 1) + "</div>" +
        "<div class='ec-title-wrap'><div class='ec-title'>" + esc(item.title) + "</div></div>" +
        "<div class='ec-actions'><span class='ec-chev'>▼</span></div>";

      var body = document.createElement("div");
      body.className = "essay-card-body";

      var probHtml = "<div class='essay-short-box'><div class='esb-title'>📋 Đề bài:</div><p style='margin:0;line-height:1.6;font-size:16px'>" + esc(item.problem) + "</p></div>";
      var diagHtml = item.diagram ? "<div class='diagram-paper-box'><strong>Sơ đồ gia phả:</strong>\n" + esc(item.diagram) + "</div>" : "";

      var stepsHtml = "<div class='essay-sections-wrap'>" +
        (item.steps || []).map(function (st) {
          return "<div class='essay-sec'><div class='essay-sec-head'>" + esc(st.title) + "</div>" +
            "<div class='essay-sec-items' style='white-space:pre-line'>" + esc(st.content) + "</div></div>";
        }).join("") +
        "</div>";

      body.innerHTML = probHtml + diagHtml + stepsHtml;

      head.onclick = function () { card.classList.toggle("open"); };

      card.appendChild(head);
      card.appendChild(body);
      container.appendChild(card);
    });

    content.appendChild(container);
  }

  /* ========================================================
     GENERIC QUESTION CARD RENDERER (ABCD)
     ======================================================== */
  function createQuestionCard(q, qi, subj, onSelect) {
    var card = document.createElement("div");
    card.className = "q-card";
    card.id = "qCard_" + q.id;

    var qNo = document.createElement("span");
    qNo.className = "q-no";
    qNo.textContent = "Câu " + (qi + 1);
    card.appendChild(qNo);

    var qText = document.createElement("div");
    qText.className = "q-text";
    var doubtTag = q.isDoubt ? " <span class='tag-doubt'>⚠️ Nghi vấn kết quả</span>" : "";
    qText.innerHTML = esc(q.q) + doubtTag;
    card.appendChild(qText);

    var optWrap = document.createElement("div");
    optWrap.className = "options";

    var fbBox = document.createElement("div");
    fbBox.className = "feedback";

    var store = subj === "lsd" ? lsdResults : pldcResults;
    var r = store[q.id];

    var btnMap = {};
    for (var k in q.options) {
      (function (optKey) {
        var btn = document.createElement("button");
        btn.className = "opt";
        btn.innerHTML = "<span class='key'>" + optKey + "</span><span class='oval'>" + esc(q.options[optKey]) + "</span>";
        btn.onclick = function () {
          if (card.classList.contains("answered-ok")) return;
          onSelect(optKey);
        };
        btnMap[optKey] = btn;
        optWrap.appendChild(btn);
      })(k);
    }
    card.appendChild(optWrap);
    card.appendChild(fbBox);

    if (r) {
      applyCardResult(card, q, r, btnMap, fbBox);
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
      var fbBox = card.querySelector(".feedback");
      var btnMap = {};
      card.querySelectorAll(".opt").forEach(function (b) {
        var k = b.querySelector(".key").textContent.trim();
        btnMap[k] = b;
      });
      applyCardResult(card, q, store[q.id], btnMap, fbBox);
    }

    if (onDone) onDone();
  }

  function applyCardResult(card, q, r, btnMap, fbBox) {
    for (var k in btnMap) {
      btnMap[k].classList.remove("correct", "wrong", "dim");
    }
    var doubtBox = (q.isDoubt && q.doubtNote) ? "<div class='doubt-box'><strong>⚠️ Phân tích nghi vấn:</strong> " + esc(q.doubtNote) + "</div>" : "";

    if (r.status === "correct") {
      card.classList.add("answered-ok");
      if (btnMap[r.selected]) btnMap[r.selected].classList.add("correct");
      for (var optK in btnMap) {
        if (optK !== r.selected) btnMap[optK].classList.add("dim");
      }
      if (fbBox) {
        fbBox.className = "feedback show ok";
        fbBox.innerHTML = "<span class='fb-title'>✓ Chính xác!</span><div>" + esc(q.explain) + "</div>" + doubtBox;
      }
    } else {
      card.classList.remove("answered-ok");
      if (btnMap[r.selected]) btnMap[r.selected].classList.add("wrong");
      if (btnMap[q.answer]) btnMap[q.answer].classList.add("correct");
      for (var optKey in btnMap) {
        if (optKey !== r.selected && optKey !== q.answer) btnMap[optKey].classList.add("dim");
      }
      if (fbBox) {
        fbBox.className = "feedback show bad";
        var hintHtml = q.hint ? "<div style='margin-top:6px;color:var(--hint)'>💡 <b>Gợi ý:</b> " + esc(q.hint) + "</div>" : "";
        fbBox.innerHTML = "<span class='fb-title'>✗ Chưa chính xác (Đáp án đúng là " + q.answer + ")</span><div>" + esc(q.explain) + "</div>" + hintHtml + doubtBox;
      }
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
        "<div class='stat-grid'>" +
        "<div class='stat'><div class='n'>" + rInfo.correct + "</div><div class='l'>Câu đúng</div></div>" +
        "<div class='stat'><div class='n'>" + rInfo.total + "</div><div class='l'>Tổng câu</div></div>" +
        "<div class='stat'><div class='n'>" + (rInfo.total ? Math.round((rInfo.correct / rInfo.total) * 100) : 0) + "%</div><div class='l'>Hoàn thành</div></div>" +
        "</div>" +
        "<p>Hạng hiện tại: <b>" + rInfo.current.name + "</b></p>";
    } else {
      var rInfoP = computeRankPLDC();
      dashBody.innerHTML =
        "<h3>📊 Tiến độ Pháp luật đại cương</h3>" +
        "<div class='stat-grid'>" +
        "<div class='stat'><div class='n'>" + rInfoP.correct + "</div><div class='l'>Câu đúng</div></div>" +
        "<div class='stat'><div class='n'>" + rInfoP.total + "</div><div class='l'>Tổng câu</div></div>" +
        "<div class='stat'><div class='n'>" + (rInfoP.total ? Math.round((rInfoP.correct / rInfoP.total) * 100) : 0) + "%</div><div class='l'>Hoàn thành</div></div>" +
        "</div>" +
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
      "<p style='margin:0 0 12px;color:var(--ink-soft)'>Môn hiện tại: <b>" + (currentSubject === "lsd" ? "Lịch sử Đảng" : "Pháp luật đại cương") + "</b></p>" +
      "<div class='rank-list'>" +
      ranks.map(function (rk) {
        var isCur = (rk.key === rInfo.current.key) ? " cur" : "";
        return "<div class='rank-row" + isCur + "'>" +
          "<img src='ranks/" + rk.key + ".png' alt='" + rk.name + "' class='rank-emblem-sm'>" +
          "<div class='rr-meta'><span class='rr-name'>" + rk.name + "</span><span class='rr-min'>Từ " + rk.min + " câu đúng</span></div>" +
          (isCur ? "<span class='rr-badge'>Hiện tại</span>" : "") +
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
