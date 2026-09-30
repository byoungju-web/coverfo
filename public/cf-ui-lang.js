/* coverfo 화면 언어 — 포도톡(pt2.js)의 "화면 언어"와 같은 방식
   ① 자동(위치 따름): 폰 시간대로 나라를 어림해 그 나라 말로 (준비 안 된 말이면 영어)
   ② 화면의 한국어 글자를 모아 번역해 바꿔 넣고, 한 번 번역한 문장은 이 기기(localStorage)에 적어 둔다 → 다음부터 즉시
   ③ 번역기: 구글(무료) → MyMemory(무료) 순. 키 필요 없음
   ④ 같은 값을 답변 언어(cf-answer-lang)에도 넣어 AI 답변·렌즈 분석·음성 인식 언어가 함께 바뀐다
   홈(landing-html.ts)과 채팅(/chat, root.tsx)에서 같은 파일을 쓴다. */
(function () {
  if (window.cfUiLang) return;
  var LANGS = [
    ["auto", "🌐", "자동(위치 따름)"],
    ["ko", "🇰🇷", "한국어"],
    ["en", "🇺🇸", "English"],
    ["zh", "🇨🇳", "中文"],
    ["hi", "🇮🇳", "हिन्दी"],
    ["es", "🇪🇸", "Español"],
    ["fr", "🇫🇷", "Français"],
    ["de", "🇩🇪", "Deutsch"]
  ];
  var TZ = {
    Seoul: ["ko", "대한민국"], Pyongyang: ["ko", "조선"],
    Tokyo: ["ja", "일본"], Shanghai: ["zh", "중국"], Chongqing: ["zh", "중국"], Hong_Kong: ["zh", "홍콩"], Taipei: ["zh", "대만"], Macau: ["zh", "마카오"],
    Kolkata: ["hi", "인도"], Calcutta: ["hi", "인도"],
    Madrid: ["es", "스페인"], Mexico_City: ["es", "멕시코"], Bogota: ["es", "콜롬비아"], Buenos_Aires: ["es", "아르헨티나"], Santiago: ["es", "칠레"], Lima: ["es", "페루"],
    Paris: ["fr", "프랑스"], Brussels: ["fr", "벨기에"],
    Berlin: ["de", "독일"], Vienna: ["de", "오스트리아"], Zurich: ["de", "스위스"],
    New_York: ["en", "미국"], Chicago: ["en", "미국"], Denver: ["en", "미국"], Los_Angeles: ["en", "미국"], Phoenix: ["en", "미국"], Anchorage: ["en", "미국"], Honolulu: ["en", "미국"],
    Toronto: ["en", "캐나다"], Vancouver: ["en", "캐나다"], London: ["en", "영국"], Dublin: ["en", "아일랜드"],
    Sydney: ["en", "호주"], Melbourne: ["en", "호주"], Auckland: ["en", "뉴질랜드"], Singapore: ["en", "싱가포르"], Manila: ["en", "필리핀"],
    Bangkok: ["th", "태국"], Ho_Chi_Minh: ["vi", "베트남"], Jakarta: ["id", "인도네시아"]
  };
  function LS(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function LSS(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function tzGuess() {
    try { var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; var city = tz.split("/").pop(); if (TZ[city]) return TZ[city]; } catch (e) {}
    try { var nl = (navigator.language || "").slice(0, 2).toLowerCase(); for (var i = 1; i < LANGS.length; i++) if (LANGS[i][0] === nl) return [nl, ""]; } catch (e2) {}
    return ["ko", "대한민국"];
  }
  function pick() { return LS("cf_ui") || "auto"; }
  function lang() {
    var p = pick(); if (p !== "auto") return p;
    var g = tzGuess()[0];
    for (var i = 1; i < LANGS.length; i++) if (LANGS[i][0] === g) return g;
    return "en";
  }
  function where() { var g = tzGuess(); return g[1] || ""; }
  function cache(l) { try { return JSON.parse(LS("cf_uic_" + l) || "{}"); } catch (e) { return {}; } }
  function cacheSave(l, o) { LSS("cf_uic_" + l, JSON.stringify(o)); }

  /* ── 번역기 (무료) ── */
  function trGoogle(text, to, ok, fail) {
    try {
      var u = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=" + encodeURIComponent(to) + "&dt=t&q=" + encodeURIComponent(text);
      var t = setTimeout(function () { t = null; fail(); }, 8000);
      fetch(u).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) {
        if (t === null) return; clearTimeout(t);
        var seg = d && d[0]; if (!seg || !seg.length) { fail(); return; }
        var out = ""; for (var i = 0; i < seg.length; i++) out += (seg[i][0] || "");
        out = out.trim(); if (!out) { fail(); return; } ok(out);
      })["catch"](function () { if (t === null) return; clearTimeout(t); fail(); });
    } catch (e) { fail(); }
  }
  function trMyMemory(text, to, ok, fail) {
    try {
      var u = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) + "&langpair=" + encodeURIComponent("ko|" + to);
      var t = setTimeout(function () { t = null; fail(); }, 8000);
      fetch(u).then(function (r) { return r.json(); }).then(function (d) {
        if (t === null) return; clearTimeout(t);
        var x = d && d.responseData && d.responseData.translatedText;
        if (x && !/MYMEMORY WARNING|INVALID|NO QUERY/i.test(x)) ok(String(x).trim()); else fail();
      })["catch"](function () { if (t === null) return; clearTimeout(t); fail(); });
    } catch (e) { fail(); }
  }
  function translateOne(text, to, done) { trGoogle(text, to, done, function () { trMyMemory(text, to, done, function () { done(""); }); }); }

  var Q = [], busy = false, seen = {}, paintT = null;
  function step() {
    var job = Q.shift(); if (!job) { busy = false; return; }
    busy = true;
    translateOne(job.t, job.l, function (out) {
      if (out) { var c = cache(job.l); c[job.t] = out; cacheSave(job.l, c); if (paintT) clearTimeout(paintT); paintT = setTimeout(paintNow, 220); }
      setTimeout(step, 80);
    });
  }
  var KO = /[가-힣]/;
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, CODE: 1, PRE: 1, NOSCRIPT: 1 };
  function skipEl(pn) {
    if (!pn) return true;
    if (SKIP[pn.nodeName]) return true;
    try {
      if (pn.closest && pn.closest("[data-cf-noui], .cm-editor, .cm-content, [contenteditable=true], pre, code")) return true;
    } catch (e) {}
    return false;
  }
  function paintNow() {
    var l = lang(); if (l === "ko") return;
    var c = cache(l), miss = [];
    var walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
      if (!n.nodeValue || !KO.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
      if (skipEl(n.parentNode)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    } });
    var n, list = []; while ((n = walk.nextNode())) list.push(n);
    list.forEach(function (node) {
      var raw = node.__ko || node.nodeValue, key = raw.trim(); if (!key) return;
      node.__ko = raw;
      if (c[key]) { node.nodeValue = raw.replace(key, c[key]); return; }
      if (!seen[l + "|" + key]) { seen[l + "|" + key] = 1; miss.push(key); }
    });
    [].forEach.call(document.querySelectorAll("input[placeholder],textarea[placeholder],[title]"), function (el) {
      var isTitle = !el.hasAttribute("placeholder");
      var raw = el.__ko || el.getAttribute(isTitle ? "title" : "placeholder") || "";
      if (!KO.test(raw)) return;
      el.__ko = raw;
      if (c[raw]) { el.setAttribute(isTitle ? "title" : "placeholder", c[raw]); return; }
      if (!seen[l + "|" + raw]) { seen[l + "|" + raw] = 1; miss.push(raw); }
    });
    miss.slice(0, 80).forEach(function (t) { Q.push({ t: t, l: l }); });
    if (miss.length && !busy) step();
  }
  var obs = null, obsT = null;
  function watch() {
    if (lang() === "ko") return;
    if (obs) return;
    try {
      obs = new MutationObserver(function () { if (obsT) clearTimeout(obsT); obsT = setTimeout(paintNow, 160); });
      obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (e) {}
    paintNow();
  }
  function set(v) {
    LSS("cf_ui", v);
    /* 답변 언어도 같이 — 채팅 답변·렌즈 분석·음성 인식이 같은 말을 쓴다 */
    LSS("cf-answer-lang", v === "auto" ? "auto" : v);
    seen = {};
    if (obs) { try { obs.disconnect(); } catch (e) {} obs = null; }
    if (lang() === "ko") { location.reload(); return; }   /* 한국어로 되돌릴 때는 새로 고쳐 원문을 되살린다 */
    watch();
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  /* 설정 칸에 넣는 칩 HTML (홈 사이드바·채팅 사이드바 공용). data-cf-noui: 이 칸 글자는 번역하지 않는다 */
  function chipsHtml() {
    var p = pick();
    return '<div class="cf-ui-lang" data-cf-noui="1">' +
      LANGS.map(function (x) { return '<button type="button" class="cf-ui-chip' + (p === x[0] ? " on" : "") + '" data-cf-ui="' + x[0] + '">' + x[1] + " " + x[2] + "</button>"; }).join("") +
      "</div>" + (where() ? '<div class="cf-ui-where" data-cf-noui="1">📍 지금 위치 · <b>' + esc(where()) + "</b></div>" : "");
  }
  function mount(el) {
    if (!el) return;
    el.innerHTML = chipsHtml();
    el.addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest("[data-cf-ui]") : null; if (!b) return;
      e.preventDefault(); e.stopPropagation();
      set(b.getAttribute("data-cf-ui"));
      el.innerHTML = chipsHtml();
    });
  }
  if (!document.getElementById("cf-ui-lang-css")) {
    var st = document.createElement("style"); st.id = "cf-ui-lang-css";
    st.textContent = ".cf-ui-lang{display:flex;flex-wrap:wrap;gap:6px;padding:4px 0 2px}" +
      ".cf-ui-chip{border:1.5px solid transparent;background:#f1edfb;color:#222;border-radius:999px;padding:7px 11px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit}" +
      ".cf-ui-chip.on{background:#fff;border-color:#6d28d9;color:#5b21b6}" +
      ".cf-ui-where{font-size:11.5px;color:#777;margin-top:6px}" +
      "html[data-theme=dark] .cf-ui-chip{background:#2a2540;color:#eee}html[data-theme=dark] .cf-ui-chip.on{background:#1b1533;border-color:#a78bfa;color:#e9d5ff}html[data-theme=dark] .cf-ui-where{color:#aaa}";
    (document.head || document.documentElement).appendChild(st);
  }
  window.cfUiLang = { LANGS: LANGS, pick: pick, lang: lang, where: where, set: set, chipsHtml: chipsHtml, mount: mount, paint: paintNow, watch: watch };
  if (document.body) watch(); else document.addEventListener("DOMContentLoaded", watch);
})();
