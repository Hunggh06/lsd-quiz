/* ===== Lịch sử Đảng — quiz engine ===== */
(function () {
  "use strict";

  var DATA = window.QUIZ_DATA || { chapters: [] };
  var ESSAY_DATA = window.ESSAY_DATA || { questions: [] };
  var STORE_KEY = "lsd_quiz_results_v2";
  var ESSAY_KEY = "lsd_essay_learned_v1";

  function loadEssayLearned() {
    try { return JSON.parse(localStorage.getItem(ESSAY_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveEssayLearned(obj) {
    try { localStorage.setItem(ESSAY_KEY, JSON.stringify(obj)); } catch (e) {}
  }
  var essayLearned = loadEssayLearned();
  var essayFilter = "";
  var essayShortOnly = false;

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
    { key: "10", name: "Hạng Thách Đấu",  min: 550 }
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
      FLAT.push({ id: q.id, ch: ch.title, q: q, tong: !!ch.tong });
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
  var qnav = document.getElementById("qnav");
  var qnavGrid = document.getElementById("qnavGrid");

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
  function updateQnavVisibility() {
    if (!qnav) return;
    if (current) qnav.classList.remove("hidden");
    else qnav.classList.add("hidden");
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

  function selectEssay() {
    current = { isEssay: true };
    welcome.style.display = "none";
    if (crumb) crumb.textContent = "Ôn thi Tự Luận — 8 câu hỏi trọng tâm (Kỳ II 2025-2026)";
    document.querySelectorAll(".lesson-btn").forEach(function (b) {
      b.classList.remove("active");
    });
    var enb = document.getElementById("btnEssayNav");
    if (enb) enb.classList.add("active");
    var tabTL = document.getElementById("tabTuLuan");
    var tabTN = document.getElementById("tabTracNghiem");
    if (tabTL) tabTL.classList.add("active");
    if (tabTN) tabTN.classList.remove("active");
    renderEssay();
    renderEssayQnav();
    updateQnavVisibility();
    updateEssayProgress();
  }

  function updateEssayProgress() {
    var qs = (window.ESSAY_DATA && window.ESSAY_DATA.questions) || [];
    var total = qs.length || 8;
    var count = 0;
    qs.forEach(function (q) {
      if (essayLearned[q.id]) count++;
    });
    var qTitle = document.getElementById("qnavTitle");
    if (qTitle) qTitle.textContent = "Tự luận trọng tâm";
    if (lessonProgress) {
      lessonProgress.innerHTML =
        "<div class='qp-row'>" +
        "<span class='qp-item ok'>Đã thuộc: <b>" + count + "/" + total + "</b></span>" +
        "<span class='qp-item'>Chưa thuộc: <b>" + (total - count) + "</b></span>" +
        "</div>";
    }
  }

  function renderEssayQnav() {
    var qs = (window.ESSAY_DATA && window.ESSAY_DATA.questions) || [];
    qnavGrid.innerHTML = "";
    qnavCells = [];
    qs.forEach(function (q, qi) {
      var cell = document.createElement("div");
      cell.className = "qnav-cell" + (essayLearned[q.id] ? " done" : "");
      cell.textContent = "C" + q.id;
      cell.title = q.title;
      cell.onclick = function () {
        var card = document.getElementById("essayCard_" + q.id);
        if (card) {
          card.classList.add("open");
          card.scrollIntoView({ behavior: "smooth", block: "start" });
          qnavCells.forEach(function (c) { c.classList.remove("active"); });
          cell.classList.add("active");
        }
      };
      qnavGrid.appendChild(cell);
      qnavCells.push(cell);
    });
  }

  function refreshEssayQnav() {
    var qs = (window.ESSAY_DATA && window.ESSAY_DATA.questions) || [];
    qs.forEach(function (q, qi) {
      var cell = qnavCells[qi];
      if (!cell) return;
      if (essayLearned[q.id]) cell.classList.add("done");
      else cell.classList.remove("done");
    });
  }

  function renderEssay() {
    content.innerHTML = "";
    var ed = window.ESSAY_DATA || { questions: [] };
    var qs = ed.questions || [];

    var container = document.createElement("div");
    container.className = "essay-container";

    var hero = document.createElement("div");
    hero.className = "essay-hero";
    hero.innerHTML =
      '<div class="essay-hero-head"><span class="essay-hero-badge">ĐỀ CƯƠNG TRỌNG TÂM</span>' +
      '<span style="font-size:12px;color:var(--gold);font-weight:700">KỲ II NĂM HỌC 2025 - 2026</span></div>' +
      '<h1 class="essay-hero-title">8 Câu Hỏi Tự Luận Lịch Sử Đảng</h1>' +
      '<div class="essay-hero-sub">Tóm tắt cô đọng bằng các ý chính, gạch đầu dòng then chốt, kèm mẹo làm câu Đúng/Sai và phần liên hệ sinh viên.</div>' +
      '<div class="exam-structure-box">' +
      '<div class="es-item"><b>Cấu trúc đề thi (10 điểm):</b></div>' +
      '<div class="es-item"><b>• Phần 1 (4.0đ):</b> 20 câu trắc nghiệm ABCD chuẩn hóa.</div>' +
      '<div class="es-item"><b>• Phần 2 (6.0đ):</b> 2 câu tự luận (Câu 1: 3.0đ dạng Đúng/Sai giải thích; Câu 2: 3.0đ dạng Phân tích chuyên đề + Liên hệ thực tiễn / Trách nhiệm SV).</div>' +
      '</div>';
    container.appendChild(hero);

    var toolbar = document.createElement("div");
    toolbar.className = "essay-toolbar";

    var searchWrap = document.createElement("div");
    searchWrap.className = "essay-search-wrap";
    searchWrap.innerHTML =
      '<span class="essay-search-icon">🔍</span>' +
      '<input type="text" id="essaySearchInput" class="essay-search-input" placeholder="Tìm kiếm theo từ khóa (vd: 1930, chuyển hướng, Pháp, kinh tế thị trường...)" value="' + esc(essayFilter) + '">';
    toolbar.appendChild(searchWrap);

    var btnExpandAll = document.createElement("button");
    btnExpandAll.className = "essay-tool-btn";
    btnExpandAll.innerHTML = "📖 Mở tất cả";
    btnExpandAll.onclick = function () {
      document.querySelectorAll(".essay-card").forEach(function (c) { c.classList.add("open"); });
    };
    toolbar.appendChild(btnExpandAll);

    var btnCollapseAll = document.createElement("button");
    btnCollapseAll.className = "essay-tool-btn";
    btnCollapseAll.innerHTML = "📕 Thu gọn";
    btnCollapseAll.onclick = function () {
      document.querySelectorAll(".essay-card").forEach(function (c) { c.classList.remove("open"); });
    };
    toolbar.appendChild(btnCollapseAll);

    var btnModeToggle = document.createElement("button");
    btnModeToggle.className = "essay-tool-btn" + (essayShortOnly ? " active" : "");
    btnModeToggle.innerHTML = essayShortOnly ? "⚡ Đang xem: Siêu ngắn" : "📑 Đang xem: Đầy đủ";
    btnModeToggle.onclick = function () {
      essayShortOnly = !essayShortOnly;
      renderEssay();
    };
    toolbar.appendChild(btnModeToggle);

    var btnCopyAll = document.createElement("button");
    btnCopyAll.className = "essay-tool-btn";
    btnCopyAll.innerHTML = "📋 Sao chép 8 câu";
    btnCopyAll.onclick = function () {
      copyAllEssayText();
    };
    toolbar.appendChild(btnCopyAll);

    container.appendChild(toolbar);

    var cardsWrap = document.createElement("div");
    cardsWrap.style.display = "grid";
    cardsWrap.style.gap = "16px";

    var filteredQs = qs.filter(function (q) {
      if (!essayFilter) return true;
      var term = essayFilter.toLowerCase();
      var inTitle = q.title.toLowerCase().indexOf(term) !== -1;
      var inTags = (q.tags || []).some(function (t) { return t.toLowerCase().indexOf(term) !== -1; });
      var inSummary = (q.shortSummary || []).some(function (s) { return s.toLowerCase().indexOf(term) !== -1; });
      var inSections = (q.sections || []).some(function (sec) {
        return sec.heading.toLowerCase().indexOf(term) !== -1 ||
          (sec.items || []).some(function (it) { return it.toLowerCase().indexOf(term) !== -1; });
      });
      return inTitle || inTags || inSummary || inSections;
    });

    if (!filteredQs.length) {
      var noRes = document.createElement("div");
      noRes.style.padding = "30px";
      noRes.style.textAlign = "center";
      noRes.style.color = "var(--ink-soft)";
      noRes.innerHTML = "<p style='font-size:16px'>Không tìm thấy câu hỏi phù hợp với từ khóa \"<b>" + esc(essayFilter) + "</b>\"</p>";
      cardsWrap.appendChild(noRes);
    } else {
      filteredQs.forEach(function (q) {
        cardsWrap.appendChild(buildEssayCard(q));
      });
    }

    container.appendChild(cardsWrap);
    content.appendChild(container);

    var sin = document.getElementById("essaySearchInput");
    if (sin) {
      sin.oninput = function (e) {
        essayFilter = e.target.value;
        renderEssay();
        var nsin = document.getElementById("essaySearchInput");
        if (nsin) { nsin.focus(); nsin.selectionStart = nsin.selectionEnd = nsin.value.length; }
      };
    }
  }

  function buildEssayCard(q) {
    var card = document.createElement("div");
    card.id = "essayCard_" + q.id;
    var isLearned = !!essayLearned[q.id];
    card.className = "essay-card open" + (isLearned ? " learned" : "");

    var header = document.createElement("div");
    header.className = "essay-card-header";

    var noBadge = document.createElement("div");
    noBadge.className = "ec-no";
    noBadge.textContent = q.number;
    header.appendChild(noBadge);

    var titleWrap = document.createElement("div");
    titleWrap.className = "ec-title-wrap";

    var titleEl = document.createElement("div");
    titleEl.className = "ec-title";
    titleEl.innerHTML =
      '<span style="display:inline-block;background:var(--accent);color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;margin-right:6px;vertical-align:middle">CÂU HỎI ' + q.id + '</span>' +
      '<span>' + esc(q.title) + '</span>';
    titleWrap.appendChild(titleEl);

    if (q.tags && q.tags.length) {
      var tagsEl = document.createElement("div");
      tagsEl.className = "ec-tags";
      q.tags.forEach(function (t) {
        var tp = document.createElement("span");
        tp.className = "ec-tag";
        tp.textContent = t;
        tagsEl.appendChild(tp);
      });
      titleWrap.appendChild(tagsEl);
    }
    header.appendChild(titleWrap);

    var actions = document.createElement("div");
    actions.className = "ec-actions";

    var btnLearn = document.createElement("button");
    btnLearn.className = "btn-learn-check" + (isLearned ? " is-learned" : "");
    btnLearn.innerHTML = isLearned ? "✓ Đã thuộc" : "⭐ Đánh dấu thuộc";
    btnLearn.onclick = function (e) {
      e.stopPropagation();
      essayLearned[q.id] = !essayLearned[q.id];
      if (!essayLearned[q.id]) delete essayLearned[q.id];
      saveEssayLearned(essayLearned);
      card.classList.toggle("learned", !!essayLearned[q.id]);
      btnLearn.className = "btn-learn-check" + (essayLearned[q.id] ? " is-learned" : "");
      btnLearn.innerHTML = essayLearned[q.id] ? "✓ Đã thuộc" : "⭐ Đánh dấu thuộc";
      updateEssayProgress();
      refreshEssayQnav();
    };
    actions.appendChild(btnLearn);

    var btnCopy = document.createElement("button");
    btnCopy.className = "btn-ec-copy";
    btnCopy.title = "Sao chép câu hỏi và đáp án này";
    btnCopy.innerHTML = "📋 Copy";
    btnCopy.onclick = function (e) {
      e.stopPropagation();
      copySingleEssayText(q);
    };
    actions.appendChild(btnCopy);

    var chev = document.createElement("span");
    chev.className = "ec-chev";
    chev.innerHTML = "▼";
    actions.appendChild(chev);

    header.appendChild(actions);

    header.onclick = function () {
      card.classList.toggle("open");
    };

    card.appendChild(header);

    var body = document.createElement("div");
    body.className = "essay-card-body";

    var ansDivider = document.createElement("div");
    ansDivider.style.display = "flex";
    ansDivider.style.alignItems = "center";
    ansDivider.style.gap = "8px";
    ansDivider.style.margin = "0 0 14px";
    ansDivider.style.paddingBottom = "6px";
    ansDivider.style.borderBottom = "2px solid var(--accent)";
    ansDivider.innerHTML =
      '<span style="background:var(--accent);color:#fff;font-family:var(--serif);font-size:12px;font-weight:700;padding:3px 10px;border-radius:4px">ĐÁP ÁN TỰ LUẬN TRỌNG TÂM</span>' +
      '<span style="font-size:12px;color:var(--ink-soft);font-weight:500">(Gạch đầu dòng cốt lõi — Dễ học — Dễ nhớ)</span>';
    body.appendChild(ansDivider);

    var shortBox = document.createElement("div");
    shortBox.className = "essay-short-box";
    shortBox.innerHTML =
      '<div class="esb-title">⚡ 10 GIÂY GHI NHỚ (ĐÁP ÁN RÚT GỌN)</div>' +
      '<ul class="esb-list">' +
      (q.shortSummary || []).map(function (s) { return "<li>" + s + "</li>"; }).join("") +
      '</ul>';
    body.appendChild(shortBox);

    if (!essayShortOnly) {
      var secWrap = document.createElement("div");
      secWrap.className = "essay-sections-wrap";

      (q.sections || []).forEach(function (sec) {
        var sBox = document.createElement("div");
        var extraClass = "";
        if (sec.heading.indexOf("Mẹo") !== -1) extraClass = " sec-tips";
        else if (sec.heading.indexOf("Liên hệ") !== -1) extraClass = " sec-lienhe";

        sBox.className = "essay-sec" + extraClass;
        sBox.innerHTML =
          '<div class="essay-sec-head">' + sec.heading + '</div>' +
          '<div class="essay-sec-items">' +
          (sec.items || []).map(function (it) {
            return "<div>" + it + "</div>";
          }).join("") +
          '</div>';
        secWrap.appendChild(sBox);
      });
      body.appendChild(secWrap);
    }

    card.appendChild(body);
    return card;
  }

  function copySingleEssayText(q) {
    var lines = [];
    lines.push(q.number + ": " + q.title);
    lines.push("----------------------------------------");
    lines.push("TÓM TẮT SIÊU NGẮN:");
    (q.shortSummary || []).forEach(function (s) {
      lines.push("• " + s.replace(/<[^>]+>/g, ""));
    });
    lines.push("");
    (q.sections || []).forEach(function (sec) {
      lines.push("[" + sec.heading.replace(/<[^>]+>/g, "") + "]");
      (sec.items || []).forEach(function (it) {
        lines.push(it.replace(/<[^>]+>/g, ""));
      });
      lines.push("");
    });
    navigator.clipboard.writeText(lines.join("\n")).then(function () {
      showToast("Đã sao chép " + q.number + " vào bộ nhớ tạm!");
    });
  }

  function copyAllEssayText() {
    var qs = (window.ESSAY_DATA && window.ESSAY_DATA.questions) || [];
    var all = ["8 CÂU HỎI TỰ LUẬN TRỌNG TÂM ÔN THI LỊCH SỬ ĐẢNG (KỲ II 2025-2026)\n=======================================================\n"];
    qs.forEach(function (q) {
      all.push("=== " + q.number + ": " + q.title + " ===\n");
      all.push("TÓM TẮT CỐT LÕI:");
      (q.shortSummary || []).forEach(function (s) {
        all.push("• " + s.replace(/<[^>]+>/g, ""));
      });
      all.push("\nNỘI DUNG CHI TIẾT:");
      (q.sections || []).forEach(function (sec) {
        all.push("\n" + sec.heading.replace(/<[^>]+>/g, ""));
        (sec.items || []).forEach(function (it) {
          all.push(it.replace(/<[^>]+>/g, ""));
        });
      });
      all.push("\n-------------------------------------------------------\n");
    });
    navigator.clipboard.writeText(all.join("\n")).then(function () {
      showToast("Đã sao chép toàn bộ 8 câu Tự luận!");
    });
  }

  function selectBai(ci) {
    current = { ci: ci };
    welcome.style.display = "none";
    var enb = document.getElementById("btnEssayNav");
    if (enb) enb.classList.remove("active");
    var tabTL = document.getElementById("tabTuLuan");
    var tabTN = document.getElementById("tabTracNghiem");
    if (tabTL) tabTL.classList.remove("active");
    if (tabTN) tabTN.classList.add("active");
    var ch = DATA.chapters[ci];
    if (crumb) crumb.textContent = ch.title + (ch.subtitle ? " — " + ch.subtitle : "");
    document.querySelectorAll(".lesson-btn").forEach(function (b) {
      b.classList.toggle("active", +b.getAttribute("data-ci") === ci);
    });
    renderBai(ci);
    renderQnav(ci);
    updateQnavVisibility();
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
    var w = d - c;
    var qTitle = document.getElementById("qnavTitle");
    if (qTitle) qTitle.textContent = ch.title + (ch.subtitle ? " — " + ch.subtitle : "");
    if (lessonProgress) {
      lessonProgress.innerHTML =
        "<div class='qp-row'>" +
        "<span class='qp-item'>Đã làm: <b>" + d + "/" + t + "</b></span>" +
        "<span class='qp-item ok'>Đúng: <b>" + c + "</b></span>" +
        "<span class='qp-item bad'>Sai: <b>" + w + "</b></span>" +
        "</div>";
    }
  }

  /* ---------- Question Navigator ---------- */
  var qnavCells = []; // array of cell elements indexed by qi

  function renderQnav(ci) {
    var ch = DATA.chapters[ci];
    qnavGrid.innerHTML = "";
    qnavCells = [];
    ch.questions.forEach(function (q, qi) {
      var cell = document.createElement("div");
      cell.className = "qnav-cell";
      cell.textContent = qi + 1;
      cell.setAttribute("data-qi", qi);
      cell.onclick = function () {
        var cards = content.querySelectorAll(".q-card");
        var target = cards[qi];
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        qnavCells.forEach(function (c) { c.classList.remove("active"); });
        cell.classList.add("active");
      };
      qnavGrid.appendChild(cell);
      qnavCells.push(cell);
    });
    refreshQnav();
  }

  function refreshQnav() {
    if (current && current.isEssay) {
      refreshEssayQnav();
      return;
    }
    var ch = DATA.chapters[current && current.ci];
    if (!ch) return;
    ch.questions.forEach(function (q, qi) {
      var r = results[q.id];
      var cell = qnavCells[qi];
      if (!cell) return;
      cell.classList.remove("done", "miss");
      if (r) {
        if (r.status === "correct") cell.classList.add("done");
        else if (r.status === "wrong") cell.classList.add("miss");
      }
    });
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
        saveResults(results); renderBai(ci); renderQnav(ci); renderTree(); updateBaiProgress(ci);
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
    if (results[id]) return;
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
    if (current) { updateBaiProgress(current.ci); renderTree(); refreshQnav(); }
    updateRank();
  }

  function markCard(card, q, status, wrongs) {
    var opts = card.querySelectorAll(".opt");
    var fb = card.querySelector(".feedback");
    var correct = q.answer;
    var corrText = (q.options && q.options[correct]) ? esc(q.options[correct]) : "";

    opts.forEach(function (b) {
      b.classList.remove("locked", "correct", "wrong", "dim");
      b.disabled = false;
      var old = b.querySelector(".badge"); if (old) old.remove();
      var key = b.querySelector(".key").textContent;

      if (key === correct) {
        b.classList.add("correct");
        b.disabled = true;
        var bd = document.createElement("span"); bd.className = "badge"; bd.textContent = "✓ Đúng";
        b.appendChild(bd);
      } else if (wrongs && wrongs.indexOf(key) !== -1) {
        b.classList.add("wrong", "locked");
        b.disabled = true;
        var bx = document.createElement("span"); bx.className = "badge"; bx.textContent = "✗";
        b.appendChild(bx);
      } else {
        b.classList.add("dim");
        b.disabled = true;
      }
    });

    fb.className = "feedback show " + (status === "correct" ? "ok" : "bad");
    if (status === "correct") {
      fb.innerHTML = '<span class="fb-title">✅ Chính xác</span>' +
        (q.explain ? "<b>Giải thích:</b> " + esc(q.explain) : "");
    } else {
      fb.innerHTML = '<span class="fb-title">❌ Chưa đúng — Đáp án đúng: ' + correct +
        (corrText ? " (" + corrText + ")" : "") + '</span>' +
        (q.explain ? "<b>Giải thích:</b> " + esc(q.explain) : "");
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
  // Rank score: Bài 1-10 dùng clean-correct (+1); mục "Câu hỏi tổng hợp" (tong)
  // dùng cơ chế ±1: đúng +1, từng sai -1 (net có thể âm).
  function rankScore() {
    var s = 0;
    FLAT.forEach(function (f) {
      var r = results[f.id];
      if (f.tong) {
        if (r && r.status === "correct") s += 1;
        if (r && r.everWrong) s -= 1;
      } else {
        if (countsForRank(r)) s += 1;
      }
    });
    return s;
  }
  function computeRank() {
    var correct = rankScore(), total = FLAT.length;
    var cur = RANKS[0], next = null;
    for (var i = 0; i < RANKS.length; i++) {
      if (correct >= RANKS[i].min) { cur = RANKS[i]; next = RANKS[i + 1] || null; }
    }
    var pct, sub;
    if (next) {
      var span = next.min - cur.min;
      var got = correct - cur.min;
      pct = span > 0 ? Math.max(0, Math.min(100, Math.round(got / span * 100))) : 100;
      sub = (next.min - correct) + " điểm nữa → " + next.name;
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
        '<span class="rb-sub">' + r.correct + "/" + r.total + " điểm · " + r.sub + "</span></div>" +
        '<span class="rb-track"><span class="rb-fill" style="width:' + r.pct + '%;background:' + fill + '"></span></span>' +
        '<span class="rb-pct">' + r.pct + "%</span>";
    }
    var big = document.getElementById("rankBig");
    if (big) {
      big.innerHTML =
        '<img class="rb-emblem" src="ranks/' + r.cur.key + '.png" alt="' + r.cur.name + '">' +
        '<div class="rb-info"><div class="rb-name">' + r.cur.name + "</div>" +
        '<div class="rb-sub">' + r.correct + "/" + r.total + " điểm</div>" +
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
        '<span class="rr-min">Từ ' + rk.min + ' điểm</span></div>' +
        (cur ? '<span class="rr-badge">ĐANG Ở ĐÂY</span>'
          : (reached ? '<span class="rr-ok">✓</span>' : '<span class="rr-lock">🔒</span>')) +
        '</div>';
    }).join("") +
    '<div class="rank-note">Tổng <b>' + r.correct + '/' + r.total + '</b> điểm · rank hiện tại: <b>' + r.cur.name + '</b></div>';
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

  var btnTabTN = document.getElementById("tabTracNghiem");
  if (btnTabTN) {
    btnTabTN.onclick = function () {
      if (current && current.isEssay) {
        selectBai(0);
      }
      btnTabTN.classList.add("active");
      var tTL = document.getElementById("tabTuLuan");
      if (tTL) tTL.classList.remove("active");
      closeSidebarMobile();
    };
  }
  var btnTabTL = document.getElementById("tabTuLuan");
  if (btnTabTL) {
    btnTabTL.onclick = function () {
      selectEssay();
      closeSidebarMobile();
    };
  }

  var btnEssay = document.getElementById("btnEssayNav");
  if (btnEssay) {
    btnEssay.onclick = function () {
      selectEssay();
      closeSidebarMobile();
    };
  }
  var btnWlEssay = document.getElementById("btnWelcomeEssay");
  if (btnWlEssay) {
    btnWlEssay.onclick = function () {
      selectEssay();
      closeSidebarMobile();
    };
  }

  /* ---------- wire controls ---------- */
  document.getElementById("btnDashboard").onclick = openDashboard;
  var btnToggle = document.getElementById("btnToggleQnav");
  if (btnToggle) {
    btnToggle.onclick = function () {
      updateQnavVisibility();
    };
  }
  document.getElementById("btnDashClose").onclick = function () { dashModal.classList.add("hidden"); };
  dashModal.onclick = function (e) { if (e.target === dashModal) dashModal.classList.add("hidden"); };
  document.getElementById("rankBig").addEventListener("click", openRankModal);
  document.getElementById("btnRankClose").onclick = function () { document.getElementById("rankModal").classList.add("hidden"); };
  document.getElementById("rankModal").onclick = function (e) { if (e.target === document.getElementById("rankModal")) document.getElementById("rankModal").classList.add("hidden"); };
  document.getElementById("btnMenu").onclick = function () { document.getElementById("sidebar").classList.toggle("open"); };
  document.getElementById("btnResetAll").onclick = function () {
    if (confirm("Xóa TOÀN BỘ tiến độ đã làm?")) {
      results = {}; saveResults(results); renderTree();
      if (current) { renderBai(current.ci); updateBaiProgress(current.ci); refreshQnav(); }
      else { welcome.style.display = "block"; updateQnavVisibility(); if (lessonProgress) lessonProgress.innerHTML = ""; }
      updateRank();
    }
  };
  document.getElementById("btnLeaderboard").onclick = openLeaderboard;
  document.getElementById("btnLbClose").onclick = function () { document.getElementById("leaderboardModal").classList.add("hidden"); };
  document.getElementById("leaderboardModal").onclick = function (e) { if (e.target === document.getElementById("leaderboardModal")) document.getElementById("leaderboardModal").classList.add("hidden"); };
  document.getElementById("nameInput").addEventListener("keydown", function (e) { if (e.key === "Enter") submitName(); });
  document.getElementById("btnNameOk").onclick = submitName;

  renderTree();
  updateRank();
  updateCombo();
  ensureName();
  updateQnavVisibility();

  if (!DATA.chapters.length) {
    content.innerHTML = "<div class='welcome'><h1>Chưa có dữ liệu</h1><p>File <code>data.js</code> chưa được tạo. Hãy chạy merge để sinh dữ liệu câu hỏi.</p></div>";
  }
})();
