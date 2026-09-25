// functions/engine-app.js — coverfo.com/engine-app : 7단계 엔진 화면 본체 (사이드 메뉴가 있는 /engine 안에 iframe 으로 들어감)
// 원본 HTML 은 engine-src/engine-app.html 이며, 이 파일은 그것을 문자열로 감싼 것입니다 (studio-app.js 와 같은 방식)
// © 2026 coverfo All Rights Reserved

const HTML = `<!DOCTYPE html>
<!-- © 2026 coverfo All Rights Reserved — coverfo 3D Orchestrator Engine™ v4.6 (coverfo.com / Cloudflare) -->
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>coverfo 엔진 — 앱 · 3D 에셋</title>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>
<style>
:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
*{box-sizing:border-box}
body{margin:0;background:#FCFCFD;color:#111;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:960px;margin:0 auto;padding:14px 14px 40px}
header{display:flex;align-items:center;justify-content:space-between;gap:10px;height:56px}
.logo{display:flex;align-items:center;gap:8px;text-decoration:none;color:#111;font-weight:800;font-size:19px;letter-spacing:-.02em}
.logo b{background:linear-gradient(90deg,#5B6CFF,#8B5CF6);-webkit-background-clip:text;background-clip:text;color:transparent}
.credit{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;background:#fff;border:1px solid rgba(0,0,0,.08);font-size:12.5px;font-weight:600;white-space:nowrap;cursor:default}
.credit i{width:7px;height:7px;border-radius:50%;background:#10B981;display:block}
.card{background:#fff;border:1px solid rgba(0,0,0,.06);border-radius:22px;padding:16px;box-shadow:0 16px 48px -28px rgba(0,0,0,.18);margin-top:10px}
.tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;background:#f4f4f6;padding:4px;border-radius:14px}
.tabs button{height:38px;border:0;border-radius:11px;background:transparent;font-size:14px;font-weight:700;color:#666;cursor:pointer;font-family:inherit}
.tabs button.on{background:#fff;color:#111;box-shadow:0 2px 8px -2px rgba(0,0,0,.12)}
textarea{width:100%;min-height:96px;margin-top:12px;padding:12px 14px;border-radius:14px;border:1px solid rgba(0,0,0,.1);font-size:16px;line-height:1.5;resize:vertical;outline:none;color:#111;font-family:inherit}
textarea:focus{border-color:#5B6CFF}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}
.chip{height:32px;padding:0 12px;border-radius:999px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12.5px;font-weight:600;color:#333;cursor:pointer;font-family:inherit}
.chip.on{background:#111;color:#fff;border-color:#111}
.chip.stop{color:#c0392b;display:none}
.chip.stop.show{display:inline-block}
.go{margin-left:auto;height:44px;padding:0 18px;border-radius:999px;border:0;background:#111;color:#fff;font-size:14px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:8px;font-family:inherit}
.go:disabled{opacity:.5;cursor:default}
.go .tag{padding:2px 8px;border-radius:999px;background:linear-gradient(135deg,#8B5CF6,#5B6CFF);font-size:10px;font-weight:700}
.hint{font-size:12px;color:#8a8a8a;margin-top:8px;line-height:1.5}
.msg{margin-top:12px;font-size:13.5px;line-height:1.55;padding:12px 14px;border-radius:14px;display:none}
.msg.on{display:block}
.msg.info{background:#f4f1fe;color:#5b3fd6}
.msg.err{background:#fff1f1;color:#c0392b}
.msg.ok{background:#ecfdf5;color:#0a7a52}
.msg a{color:inherit;font-weight:700}
.prog{height:6px;border-radius:999px;background:#eee;overflow:hidden;margin-top:12px;display:none}
.prog.on{display:block}
.prog i{display:block;height:100%;width:40%;background:linear-gradient(90deg,#5B6CFF,#8B5CF6);animation:sl 1.2s infinite}
@keyframes sl{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}
h3{font-size:14px;margin:18px 4px 8px;color:#333;display:flex;align-items:center;gap:8px}
h3 .sub{font-weight:500;color:#999;font-size:12px}
h3 .right{margin-left:auto}
/* 단계 카드 */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
.st{position:relative;background:#fff;border:1px solid rgba(0,0,0,.06);border-radius:16px;padding:12px 12px 10px;min-height:96px}
.st.dim{opacity:.45}
.st .num{font-size:10px;color:#999;letter-spacing:.1em}
.st .name{font-weight:800;font-size:13.5px;margin-top:2px}
.st .model{font-size:10px;color:#999;font-family:ui-monospace,Menlo,monospace;margin-top:2px;word-break:break-all}
.st .role{font-size:11.5px;color:#777;margin-top:2px}
.st .pill{position:absolute;top:10px;right:10px;font-size:10px;padding:3px 8px;border-radius:999px;background:#f4f4f6;color:#888}
.st.run .pill{background:#eef0ff;color:#5B6CFF}
.st.ok .pill{background:#ecfdf5;color:#047857}
.st.bad .pill{background:#fef2f2;color:#b91c1c}
.st.skip .pill{background:#f4f4f6;color:#b5b5b5}
.st .time{font-size:11px;color:#999;margin-top:6px}
.st .out{margin-top:6px;font-size:12px;color:#333}
.st .out pre{margin:0;white-space:pre-wrap;word-break:break-word;font-size:11px;background:#fafafa;border:1px solid rgba(0,0,0,.06);border-radius:8px;padding:8px;max-height:120px;overflow:auto}
.st .out img,.st .out video{width:100%;border-radius:10px;display:block;margin-top:6px;background:#000}
.st .out a{font-size:12px;color:#5B6CFF}
/* 로그 */
.log{background:#0b0b0e;color:#d7d7de;border-radius:14px;padding:12px 14px;font-family:ui-monospace,Menlo,monospace;font-size:11.5px;line-height:1.6;max-height:220px;overflow:auto;margin-top:10px}
.log .t{color:#6b6f80;margin-right:8px}
.log .ok{color:#7affa1}.log .bad{color:#ff7a7a}.log .run{color:#9bb0ff}
/* 3D 에셋 결과 */
.assets{display:none}
.assets.on{display:block}
.agrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.agrid .a{border-radius:14px;overflow:hidden;background:#f2f2f4;border:1px solid rgba(0,0,0,.05)}
.agrid .a img,.agrid .a video{width:100%;display:block;background:#000;aspect-ratio:1/1;object-fit:cover}
.agrid .a video{aspect-ratio:16/9}
.agrid .a .cap{display:flex;align-items:center;gap:6px;padding:6px 8px;font-size:11.5px;color:#555}
.agrid .a .cap button{margin-left:auto;height:26px;padding:0 10px;border-radius:8px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit}
#viewer{width:100%;aspect-ratio:16/9;border-radius:14px;background:#0f1117;display:none;margin-top:8px}
#viewer.on{display:block}
/* 앱 결과 */
.result{display:none}
.result.on{display:block}
.result iframe{width:100%;height:520px;border:1px solid rgba(0,0,0,.06);border-radius:14px;background:#fff}
.bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 10px}
.count{font-size:12.5px;color:#8a8a8a}
.btn{height:36px;padding:0 14px;border-radius:999px;border:1px solid rgba(0,0,0,.1);background:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;color:#111}
.btn.pri{background:#111;color:#fff;border-color:#111}
.btn.green{background:#10B981;color:#fff;border-color:#10B981}
.btn:disabled{opacity:.5;cursor:default}
/* 최근 만든 것 */
.hl{display:flex;flex-direction:column;gap:6px}
.hl .it{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 10px;border:1px solid rgba(0,0,0,.06);border-radius:12px;background:#fff;font-size:12.5px}
.hl .it .b{height:28px;padding:0 10px;border-radius:8px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit}
.hl .it .b.pri{background:#111;color:#fff;border-color:#111}
.hl .it .b.del{color:#c0392b}
.foot{margin-top:18px;font-size:12.5px;color:#888;text-align:center}
.foot a{color:#5B6CFF;font-weight:600;text-decoration:none}
@media(max-width:600px){.result iframe{height:380px}.agrid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <a class="logo" href="/" target="_top">cover<b>fo</b> <span style="font-weight:600;font-size:12px;color:#888;margin-left:2px">엔진</span></a>
    <span class="credit" id="status"><i style="background:#ccc"></i>확인 중…</span>
  </header>

  <div class="card">
    <div class="tabs">
      <button type="button" id="tab-app" class="on">🧊 앱 만들기</button>
      <button type="button" id="tab-3d">🎲 3D 에셋</button>
    </div>
    <textarea id="prompt" placeholder="무엇이든 시켜만 주세요!!"></textarea>
    <div class="row" id="opts">
      <button type="button" class="chip on" id="c-3d">3D 모델 포함</button>
      <button type="button" class="chip on" id="c-video">영상 포함</button>
      <button type="button" class="chip on" id="c-go">완성되면 채팅으로 이동</button>
      <button type="button" class="chip stop" id="stop">■ 중지</button>
    </div>
    <div class="row">
      <span class="hint" id="costhint"></span>
      <button class="go" id="go" type="button"><span id="golabel">엔진 실행</span><span class="tag" id="gocost">약 $0.5~1.5</span></button>
    </div>
    <div class="msg" id="msg"></div>
    <div class="prog" id="prog"><i></i></div>
  </div>

  <h3>진행 단계 <span class="sub" id="stagesub"></span></h3>
  <div class="grid" id="stages"></div>
  <div class="log" id="log"></div>

  <div class="card assets" id="assets">
    <div class="bar">
      <strong style="font-size:14px">3D 에셋 결과</strong>
      <span class="count" id="acount"></span>
      <span style="margin-left:auto"></span>
      <button class="btn pri" id="toApp">이 에셋으로 앱 만들기</button>
    </div>
    <div class="agrid" id="agrid"></div>
    <div id="viewer"></div>
  </div>

  <div class="card result" id="result">
    <div class="bar">
      <strong style="font-size:14px">결과 미리보기</strong>
      <span class="count" id="count"></span>
      <span style="margin-left:auto"></span>
      <button class="btn green" id="goChat">👀 채팅 워크벤치로 보내기</button>
      <button class="btn" id="copy">HTML 복사</button>
      <button class="btn" id="cancelGo">자동 이동 취소</button>
    </div>
    <iframe id="frame" sandbox="allow-scripts allow-same-origin"></iframe>
  </div>

  <h3>최근 만든 것 <span class="sub">이 브라우저에 최근 20건 · 채팅으로 보낸 결과는 왼쪽 "내 대화"에도 남습니다</span><button class="btn right" id="clearHist" style="height:28px;font-size:11px">내역 비우기</button></h3>
  <div class="hl" id="histList"></div>

  <div class="foot">이미지·영상만 필요하면 <a href="/studio" target="_top">스튜디오로 →</a></div>
</div>

<script>
(function () {
  /* ───────── 설정 ───────── */
  var STAGES = [
    { n: 1, key: 'stage1', name: 'Fable 5.1', role: '설계 확장 (spec)' },
    { n: 2, key: 'stage2', name: 'Astra 6', role: '에셋·디자인 조사' },
    { n: 3, key: 'stage3', name: 'Gemini 3 Flash Image', role: '사진급 이미지' },
    { n: 4, key: 'stage4', name: 'gpt image 2', role: '질감·조명 보정' },
    { n: 5, key: 'stage5', name: 'Veo 3.1', role: '4초 영상' },
    { n: 6, key: 'stage6', name: 'Meshy 3D', role: '이미지 → 3D 모델 (GLB)' },
    { n: 7, key: 'stage7', name: 'Opus 4.5', role: '최종 코딩 (index.html)' }
  ];
  var $ = function (id) { return document.getElementById(id); };
  var models = {}, mode = 'app';
  var running = false, aborted = false, ctrl = null, goTimer = null;
  var finalHtml = '', finalTitle = '';
  var LAST = null; // 마지막 실행의 에셋 (3D 에셋 → 앱 만들기 이어가기용)
  var q = new URLSearchParams(location.search);

  /* ───────── 화면 도우미 ───────── */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function log(kind, msg) {
    var box = $('log'), line = document.createElement('div');
    line.innerHTML = '<span class="t">' + new Date().toTimeString().slice(0, 8) + '</span><span class="' + kind + '">' + esc(msg) + '</span>';
    box.appendChild(line); box.scrollTop = box.scrollHeight;
  }
  function show(type, html) { var m = $('msg'); m.className = 'msg on ' + type; m.innerHTML = html; }
  function hideMsg() { $('msg').className = 'msg'; }
  function setBusy(b) {
    running = b; $('go').disabled = b; $('prog').className = b ? 'prog on' : 'prog';
    $('stop').className = 'chip stop' + (b ? ' show' : '');
  }
  function chipOn(id) { return $(id).className.indexOf(' on') >= 0; }
  function toggle(id) { var el = $(id); el.className = chipOn(id) ? 'chip' : 'chip on'; }
  function cleanTopUrl() {
    try { history.replaceState({}, '', '/engine-app'); } catch (e) {}
    try { if (window.top && window.top !== window && window.top.location.pathname === '/engine') window.top.history.replaceState({}, '', '/engine'); } catch (e) {}
  }
  function topGo(url) { try { (window.top || window).location.href = url; } catch (e) { location.href = url; } }

  function renderMode() {
    $('tab-app').className = mode === 'app' ? 'on' : '';
    $('tab-3d').className = mode === '3d' ? 'on' : '';
    $('c-go').style.display = mode === 'app' ? '' : 'none';
    $('costhint').textContent = mode === 'app'
      ? '설계부터 이미지·영상·3D·코드까지 한 번에 · 보통 5~10분'
      : '이미지 2장 · 영상 · 3D 모델(GLB) · 보통 3~7분';
    $('gocost').textContent = mode === 'app' ? '약 $0.5~1.5' : '약 $0.3~1.0';
    $('stagesub').textContent = mode === 'app' ? '7단계' : '2·7단계는 건너뜀';
    STAGES.forEach(function (s) {
      var el = $('st' + s.n); if (!el) return;
      var skip = (mode === '3d' && (s.n === 2 || s.n === 7)) || (s.n === 6 && !chipOn('c-3d')) || (s.n === 5 && !chipOn('c-video'));
      el.className = el.className.replace(' dim', '') + (skip && !running ? ' dim' : '');
    });
  }
  $('tab-app').addEventListener('click', function () { mode = 'app'; renderMode(); });
  $('tab-3d').addEventListener('click', function () { mode = '3d'; renderMode(); });
  ['c-3d', 'c-video', 'c-go'].forEach(function (id) { $(id).addEventListener('click', function () { toggle(id); renderMode(); }); });

  /* ───────── 로그인 토큰 (홈에서 로그인한 Supabase 세션, 같은 도메인이라 공유) ───────── */
  function token() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('sb-') === 0 && k.indexOf('-auth-token') > 0) {
          var v = JSON.parse(localStorage.getItem(k) || 'null');
          if (v && v.access_token) return v.access_token;
        }
      }
    } catch (e) {}
    return null;
  }
  function headers() { var h = { 'Content-Type': 'application/json' }; var t = token(); if (t) h['Authorization'] = 'Bearer ' + t; return h; }
  function post(url, body) {
    return fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(body || {}), signal: ctrl.signal })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || j.error) throw new Error(j.error || ('HTTP ' + r.status)); return j; }); });
  }
  function get(url) {
    return fetch(url, { headers: headers(), signal: ctrl.signal })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || j.error) throw new Error(j.error || ('HTTP ' + r.status)); return j; }); });
  }
  function sleep(ms) { return new Promise(function (res, rej) { var t = setTimeout(res, ms); ctrl.signal.addEventListener('abort', function () { clearTimeout(t); rej(new Error('중지됨')); }); }); }
  function saveFile(url, name) {
    return fetch(url).then(function (r) { return r.blob(); }).then(function (b) {
      var o = URL.createObjectURL(b); var a = document.createElement('a'); a.href = o; a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(o); a.remove(); }, 2000);
    }).catch(function () { window.open(url, '_blank'); });
  }

  /* ───────── 단계 카드 ───────── */
  function renderStages() {
    var g = $('stages'); g.innerHTML = '';
    STAGES.forEach(function (s) {
      var d = document.createElement('div');
      d.className = 'st'; d.id = 'st' + s.n;
      d.innerHTML = '<div class="num">STAGE ' + s.n + '</div><div class="name">' + s.name + '</div>' +
        '<div class="model" id="m' + s.n + '">' + esc(models[s.key] || '') + '</div>' +
        '<div class="role">' + s.role + '</div>' +
        '<span class="pill" id="p' + s.n + '">대기</span><div class="time" id="t' + s.n + '"></div><div class="out" id="o' + s.n + '"></div>';
      g.appendChild(d);
    });
    renderMode();
  }
  function setStage(n, state, label) { var el = $('st' + n); el.className = 'st ' + state; $('p' + n).textContent = label; }
  function setTime(n, ms) { $('t' + n).textContent = ms != null ? (ms / 1000).toFixed(1) + '초' : ''; }
  function out(n, html) { $('o' + n).innerHTML = html; }

  /* ───────── 주소 값: mode / prompt / auto ───────── */
  var autoRun = false;
  if (q.get('mode') === '3d') mode = '3d';
  if (q.get('prompt')) { $('prompt').value = q.get('prompt'); autoRun = q.get('auto') !== '0'; }

  /* ───────── 환경 확인 ───────── */
  fetch('/api/env-check').then(function (r) { return r.json(); }).then(function (j) {
    models = j.models || {};
    renderStages();
    var keys = ['ANTHROPIC_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'OPENAI_API_KEY', 'MESHY_API_KEY'];
    var missing = keys.filter(function (k) { return !j[k]; }).map(function (k) { return k.replace('_API_KEY', '').replace('GOOGLE_GENERATIVE_AI', 'GOOGLE'); });
    var st = $('status');
    st.innerHTML = '<i' + (missing.length ? ' style="background:#f59e0b"' : '') + '></i>' + (missing.length ? '키 없음: ' + esc(missing.join(', ')) : '준비됨') + ' · 중계 ' + esc(j.proxy || '?');
    st.title = keys.map(function (k) { return k + (j[k] ? ' ✓' : ' ✗'); }).join('\\n') + '\\n로그인 검사: ' + (j.auth === 'login-required' ? '켜짐' : '꺼짐') + '\\n' + (j.version || '');
    if (!j.MESHY_API_KEY) { $('c-3d').className = 'chip'; renderMode(); }
    var needLogin = (j.auth === 'login-required' && !token());
    if (needLogin) show('err', '로그인이 필요합니다. <a href="/" target="_top">홈으로 가서 로그인</a>한 뒤 다시 열어 주세요.');
    log('ok', '엔진 준비됨 — ' + (j.version || ''));
    if (autoRun && !needLogin && $('prompt').value.trim()) {
      autoRun = false; cleanTopUrl();
      log('run', '홈 화면에서 넘어옴 — 자동 실행합니다');
      setTimeout(run, 300);
    }
  }).catch(function () { renderStages(); $('status').innerHTML = '<i style="background:#ef4444"></i>설정 확인 실패'; log('bad', '/api/env-check 를 불러오지 못했습니다 (배포 확인 필요)'); });

  /* ───────── 이미지 줄이기 (워크벤치에 넣을 때 파일이 너무 커지지 않게) ───────── */
  function shrink(dataUrl, maxW) {
    return new Promise(function (res) {
      var img = new Image();
      img.onload = function () {
        var w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        res(c.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = function () { res(dataUrl); };
      img.src = dataUrl;
    });
  }

  /* ───────── 단계 실행 틀 ───────── */
  async function stage(n, fn) {
    if (aborted) return;
    var st = Date.now();
    setStage(n, 'run', '진행 중');
    try {
      await fn();
      if ($('p' + n).textContent === '진행 중') setStage(n, 'ok', '완료');
    } catch (e) {
      if (aborted) { setStage(n, 'skip', '중지'); throw e; }
      setStage(n, 'bad', '실패');
      out(n, '<pre>' + esc(e.message || e) + '</pre>');
      log('bad', '✗ ' + n + '단계 실패: ' + (e.message || e) + ' — 다음 단계로 넘어갑니다');
    } finally { setTime(n, Date.now() - st); }
  }
  function skipStage(n, why) { setStage(n, 'skip', '건너뜀'); out(n, '<pre>' + esc(why) + '</pre>'); log('ok', '⊘ ' + n + '단계 건너뜀: ' + why); }

  /* ───────── 7단계 (앱 코드) — 상태 S 를 받아 실행 ───────── */
  async function runStage7(S) {
    await stage(7, async function () {
      var r = await fetch('/api/stage7-opus', { method: 'POST', headers: headers(), signal: ctrl.signal,
        body: JSON.stringify({ prompt: S.prompt, spec: S.spec, research: S.research, assets: { image1: !!S.img1, image2: !!S.img2, video: !!S.videoUrl, model: !!S.modelUrl } }) });
      var ct = r.headers.get('content-type') || '';
      if (!r.ok || ct.indexOf('application/json') >= 0) {
        var ej = await r.json().catch(function () { return {}; });
        throw new Error(ej.error || ('HTTP ' + r.status));
      }
      var reader = r.body.getReader(), dec = new TextDecoder(), html = '', lastTick = 0;
      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        html += dec.decode(chunk.value, { stream: true });
        if (Date.now() - lastTick > 700) { lastTick = Date.now(); out(7, '<pre>코드 받는 중… ' + html.length + '자</pre>'); }
      }
      html += dec.decode();
      var em = html.match(/<!--CF_ERROR:([\\s\\S]*?)-->/);
      if (em) throw new Error(em[1]);
      var truncated = html.indexOf('<!--CF_TRUNCATED:') >= 0;
      html = html.replace(/\\n?<!--CF_TRUNCATED:[^>]*-->/g, '');
      html = html.trim().replace(/^\`\`\`html\\s*\\n?/, '').replace(/^\`\`\`\\s*\\n?/, '').replace(/\\n\`\`\`\\s*$/, '');
      if (!/<html[\\s>]/i.test(html)) throw new Error('HTML 이 돌아오지 않았습니다 (' + html.length + '자)');
      if (!truncated && !/<\\/html>\\s*$/i.test(html)) truncated = true;
      if (truncated) {
        if (!/<\\/body>/i.test(html)) html += '\\n</body>';
        if (!/<\\/html>/i.test(html)) html += '\\n</html>';
        log('bad', '⚠ 7단계 코드가 출력 길이 한도에 걸려 끝까지 오지 못했습니다 (' + html.length + '자). 화면 일부가 비거나 동작이 빠질 수 있습니다 — 요청 문장을 더 간단히 하거나 다시 실행해 주세요.');
      }
      if (S.img1 && html.indexOf('{{IMAGE_1}}') >= 0) html = html.split('{{IMAGE_1}}').join(await shrink('data:' + S.img1Mime + ';base64,' + S.img1, 768));
      if (S.img2 && html.indexOf('{{IMAGE_2}}') >= 0) html = html.split('{{IMAGE_2}}').join(await shrink('data:image/png;base64,' + S.img2, 768));
      if (S.videoUrl) html = html.split('{{VIDEO_URL}}').join(S.videoUrl);
      if (S.modelUrl) html = html.split('{{MODEL_URL}}').join(S.modelUrl);
      html = html.replace(/\\{\\{(IMAGE_1|IMAGE_2|VIDEO_URL|VIDEO_3D_URL|MODEL_URL)\\}\\}/g, '');
      finalHtml = html; finalTitle = S.title;
      out(7, '<pre>' + esc(html.slice(0, 600)) + '…</pre>');
      log(truncated ? 'bad' : 'ok', (truncated ? '△ 7단계 코드 잘림 (' : '✓ 7단계 코드 완료 (') + (models.stage7 || 'opus') + ', ' + html.length + '자)');
      showResult();
      if (truncated) setStage(7, 'bad', '잘림');
    });
  }

  /* ───────── 실행 ───────── */
  async function run() {
    var prompt = $('prompt').value.trim();
    if (!prompt) { show('err', '무엇을 만들지 적어 주세요.'); return; }
    if (running) return;
    hideMsg(); setBusy(true); aborted = false; ctrl = new AbortController();
    finalHtml = ''; finalTitle = '';
    $('result').className = 'card result'; $('assets').className = 'card assets'; $('viewer').className = ''; $('viewer').innerHTML = '';
    if (goTimer) { clearInterval(goTimer); goTimer = null; }
    STAGES.forEach(function (s) { setStage(s.n, '', '대기'); setTime(s.n, null); out(s.n, ''); });
    var want3D = chipOn('c-3d'), wantVideo = chipOn('c-video');
    var S = { prompt: prompt, title: prompt.slice(0, 40), spec: null, research: null, img1: null, img1Mime: 'image/png', img2: null, videoUrl: null, modelUrl: null, thumbUrl: null };
    LAST = S;
    log('run', '🚀 실행 시작 [' + (mode === 'app' ? '앱 만들기' : '3D 에셋') + '] — "' + prompt.slice(0, 60) + '"');
    show('info', mode === 'app' ? '앱을 만드는 중입니다… 보통 5~10분 걸려요. 이 화면을 닫지 마세요.' : '3D 에셋을 만드는 중입니다… 보통 3~7분 걸려요. 이 화면을 닫지 마세요.');

    try {
      await stage(1, async function () {
        var j = await post('/api/stage1-fable', { prompt: prompt });
        S.spec = j.spec; S.title = (S.spec && S.spec.title) || prompt.slice(0, 40);
        out(1, '<pre>' + esc(JSON.stringify(S.spec, null, 1).slice(0, 1200)) + '</pre>');
        log('ok', '✓ 1단계 설계 완료 (' + j.model + ')');
      });
      if (mode === 'app') {
        await stage(2, async function () {
          var j = await post('/api/stage2-astra', { spec: S.spec });
          S.research = j.research;
          out(2, '<pre>' + esc(JSON.stringify(S.research, null, 1).slice(0, 800)) + '</pre>');
          log('ok', '✓ 2단계 조사 완료 (' + j.model + ')');
        });
      } else skipStage(2, '3D 에셋 모드에서는 조사 단계를 건너뜁니다');
      var pImg = (S.spec && S.spec.promptForImage) || prompt;
      await stage(3, async function () {
        var j = await post('/api/stage3-gemini', { promptForImage: pImg });
        S.img1 = j.imageBase64; S.img1Mime = j.mimeType || 'image/png';
        out(3, '<img src="data:' + S.img1Mime + ';base64,' + S.img1 + '">');
        log('ok', '✓ 3단계 이미지 완료 (' + j.model + ')');
      });
      await stage(4, async function () {
        var j = await post('/api/stage4-gptimage', { styleGuide: S.spec && S.spec.styleGuide, promptForImage: pImg });
        S.img2 = j.imageBase64;
        if (S.img2) out(4, '<img src="data:image/png;base64,' + S.img2 + '">');
        log('ok', '✓ 4단계 이미지 완료 (' + j.model + ')');
      });
      if (wantVideo) {
        await stage(5, async function () {
          var j = await post('/api/stage5-veo', { promptForVideo: S.spec && S.spec.promptForVideo, promptForImage: pImg, imageBase64: S.img1, mimeType: S.img1Mime });
          log('run', '… 5단계 영상 만드는 중 (보통 1~3분): ' + j.operationName);
          out(5, '<pre>영상 생성 중… 기다려 주세요</pre>');
          var deadline = Date.now() + 240000;
          while (Date.now() < deadline) {
            await sleep(8000);
            var s = await get('/api/stage5-veo-status?name=' + encodeURIComponent(j.operationName));
            if (s.error) throw new Error(JSON.stringify(s.error).slice(0, 300));
            if (s.done && s.videoUri) {
              S.videoUrl = location.origin + '/api/stage5-veo-status?file=' + encodeURIComponent(s.videoUri);
              out(5, '<video src="' + S.videoUrl + '" controls muted playsinline></video>');
              log('ok', '✓ 5단계 영상 완료');
              return;
            }
            if (s.done) throw new Error('영상이 돌아오지 않았습니다');
            out(5, '<pre>영상 생성 중… ' + Math.round((deadline - Date.now()) / 1000) + '초 더 기다립니다</pre>');
          }
          throw new Error('4분 안에 끝나지 않아 영상 없이 진행합니다');
        });
      } else skipStage(5, '"영상 포함" 이 꺼져 있습니다');
      if (want3D) {
        await stage(6, async function () {
          var src = S.img2 ? { b: S.img2, m: 'image/png' } : (S.img1 ? { b: S.img1, m: S.img1Mime } : null);
          var subj = (S.spec && (S.spec.subject || S.spec.title || S.spec.appName)) || prompt.slice(0, 80);
          var j = await post('/api/stage6-meshy', { subject: subj, imageBase64: src && src.b, mimeType: src && src.m });
          if (j.skipped) { skipStage(6, j.reason); return; }
          log('run', '… 6단계 3D 모델 만드는 중 (보통 2~5분): ' + j.taskId);
          out(6, '<pre>3D 모델 생성 중… 기다려 주세요</pre>');
          var deadline = Date.now() + 420000;
          while (Date.now() < deadline) {
            await sleep(10000);
            var s = await get('/api/stage6-meshy-status?id=' + encodeURIComponent(j.taskId));
            if (s.status === 'SUCCEEDED' && s.glbUrl) {
              S.modelUrl = location.origin + '/api/stage6-meshy-status?file=' + encodeURIComponent(s.glbUrl);
              if (s.thumbnailUrl) S.thumbUrl = location.origin + '/api/stage6-meshy-status?file=' + encodeURIComponent(s.thumbnailUrl);
              out(6, (S.thumbUrl ? '<img src="' + esc(S.thumbUrl) + '" alt="3D 모델 미리보기">' : '') + '<a href="' + esc(S.modelUrl) + '" target="_blank">GLB 모델 열기</a>');
              log('ok', '✓ 6단계 3D 모델 완료');
              return;
            }
            if (s.status === 'FAILED' || s.status === 'CANCELED') throw new Error('Meshy 상태: ' + s.status + (s.error ? ' — ' + s.error : ''));
            out(6, '<pre>3D 모델 생성 중… ' + (s.progress != null ? s.progress + '%' : '') + ' (' + Math.round((deadline - Date.now()) / 1000) + '초 더 기다립니다)</pre>');
          }
          throw new Error('7분 안에 끝나지 않아 3D 모델 없이 진행합니다');
        });
      } else skipStage(6, '"3D 모델 포함" 이 꺼져 있습니다');
      if (mode === 'app') await runStage7(S);
      else { skipStage(7, '3D 에셋 모드 — 코드는 만들지 않습니다 ("이 에셋으로 앱 만들기" 로 이어갈 수 있음)'); showAssets(S); }
    } catch (e) {
      log('bad', '중지: ' + (e.message || e));
    }
    setBusy(false);
    if (aborted) show('err', '중지했습니다.'); else { log('ok', '🎉 실행 끝'); show('ok', mode === 'app' ? (finalHtml ? '완성됐습니다.' : '코드가 만들어지지 않았습니다. 로그를 확인해 주세요.') : '3D 에셋이 준비됐습니다.'); }
    var summary = STAGES.map(function (s) { return s.n + ':' + ($('p' + s.n).textContent || '').replace('진행 중', '중단'); }).join(' ');
    saveHist({ at: Date.now(), mode: mode, prompt: prompt, title: S.title, ok: !!finalHtml, size: finalHtml.length, html: finalHtml, stages: summary });
    renderMode();
  }

  /* ───────── 3D 에셋 결과 화면 ───────── */
  function showAssets(S) {
    var g = $('agrid'); g.innerHTML = '';
    function card(inner, cap, dl) {
      var d = document.createElement('div'); d.className = 'a';
      d.innerHTML = inner + '<div class="cap"><span>' + esc(cap) + '</span></div>';
      if (dl) { var b = document.createElement('button'); b.type = 'button'; b.textContent = '저장'; b.addEventListener('click', dl); d.querySelector('.cap').appendChild(b); }
      g.appendChild(d);
    }
    var n = 0;
    if (S.img1) { n++; var u1 = 'data:' + S.img1Mime + ';base64,' + S.img1; card('<img src="' + u1 + '" alt="">', '이미지 1 · Gemini', function () { saveFile(u1, 'coverfo-3d-image1.png'); }); }
    if (S.img2) { n++; var u2 = 'data:image/png;base64,' + S.img2; card('<img src="' + u2 + '" alt="">', '이미지 2 · gpt image', function () { saveFile(u2, 'coverfo-3d-image2.png'); }); }
    if (S.videoUrl) { n++; card('<video src="' + esc(S.videoUrl) + '" controls muted playsinline loop></video>', '영상 · Veo 3.1 · 4초', function () { saveFile(S.videoUrl, 'coverfo-3d-video.mp4'); }); }
    if (S.modelUrl) { n++; card(S.thumbUrl ? '<img src="' + esc(S.thumbUrl) + '" alt="">' : '<div style="aspect-ratio:1/1;display:grid;place-items:center;font-size:32px">🎲</div>', '3D 모델 · Meshy · GLB', function () { saveFile(S.modelUrl, 'coverfo-3d-model.glb'); }); }
    $('acount').textContent = n ? n + '개 에셋' : '만들어진 에셋이 없습니다';
    $('assets').className = 'card assets on';
    $('assets').scrollIntoView({ behavior: 'smooth' });
    if (S.modelUrl) viewGlb(S.modelUrl);
  }
  function viewGlb(url) {
    var v = $('viewer'); v.className = 'on'; v.innerHTML = '';
    Promise.all([import('three'), import('three/addons/loaders/GLTFLoader.js'), import('three/addons/controls/OrbitControls.js')]).then(function (m) {
      var THREE = m[0], GLTFLoader = m[1].GLTFLoader, OrbitControls = m[2].OrbitControls;
      var W = v.clientWidth, H = v.clientHeight || Math.round(W * 9 / 16);
      var scene = new THREE.Scene(); scene.background = new THREE.Color(0x0f1117);
      var cam = new THREE.PerspectiveCamera(45, W / H, 0.01, 1000);
      var ren = new THREE.WebGLRenderer({ antialias: true }); ren.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); ren.setSize(W, H); v.appendChild(ren.domElement);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x444466, 1.2));
      var dl = new THREE.DirectionalLight(0xffffff, 1.4); dl.position.set(3, 5, 4); scene.add(dl);
      var ctl = new OrbitControls(cam, ren.domElement); ctl.autoRotate = true; ctl.autoRotateSpeed = 2; ctl.enableDamping = true;
      new GLTFLoader().load(url, function (g) {
        var obj = g.scene; scene.add(obj);
        var box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
        obj.position.sub(c);
        var r = Math.max(size.x, size.y, size.z) || 1;
        cam.position.set(r * 1.2, r * 0.8, r * 1.6); cam.near = r / 100; cam.far = r * 100; cam.updateProjectionMatrix(); ctl.target.set(0, 0, 0);
      }, undefined, function (e) { log('bad', '3D 뷰어: 모델을 불러오지 못했습니다 — ' + (e && e.message ? e.message : e)); });
      (function loop() { requestAnimationFrame(loop); ctl.update(); ren.render(scene, cam); })();
    }).catch(function (e) { log('bad', '3D 뷰어를 열지 못했습니다 — ' + (e && e.message ? e.message : e)); });
  }
  $('toApp').addEventListener('click', async function () {
    if (!LAST || running) return;
    mode = 'app'; renderMode();
    hideMsg(); setBusy(true); aborted = false; ctrl = new AbortController();
    show('info', '준비된 에셋으로 앱 코드를 만드는 중입니다… (3~5분)');
    if (!LAST.research) {
      await stage(2, async function () {
        var j = await post('/api/stage2-astra', { spec: LAST.spec }); LAST.research = j.research;
        out(2, '<pre>' + esc(JSON.stringify(LAST.research, null, 1).slice(0, 800)) + '</pre>'); log('ok', '✓ 2단계 조사 완료 (' + j.model + ')');
      });
    }
    try { await runStage7(LAST); } catch (e) { log('bad', '중지: ' + (e.message || e)); }
    setBusy(false);
    show(finalHtml ? 'ok' : 'err', finalHtml ? '완성됐습니다.' : '코드가 만들어지지 않았습니다. 로그를 확인해 주세요.');
    var summary = STAGES.map(function (s) { return s.n + ':' + ($('p' + s.n).textContent || ''); }).join(' ');
    saveHist({ at: Date.now(), mode: 'app', prompt: LAST.prompt, title: LAST.title, ok: !!finalHtml, size: finalHtml.length, html: finalHtml, stages: summary });
  });

  /* ───────── 최근 만든 것 (localStorage, 최근 20건) ───────── */
  var HKEY = 'cf-engine-history';
  function readHist() { try { var v = JSON.parse(localStorage.getItem(HKEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function writeHist(list) { try { localStorage.setItem(HKEY, JSON.stringify(list.slice(0, 20))); } catch (e) { log('bad', '내역 저장 실패 (저장 공간 부족) — 오래된 항목을 지워 주세요'); } }
  function saveHist(entry) { var list = readHist(); list.unshift(entry); writeHist(list); renderHist(); }
  function renderHist() {
    var box = $('histList'); box.innerHTML = '';
    var list = readHist();
    if (!list.length) { box.innerHTML = '<div class="hint" style="padding:4px 2px">아직 없습니다.</div>'; return; }
    list.forEach(function (h, i) {
      var d = document.createElement('div'); d.className = 'it';
      var when = new Date(h.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      d.innerHTML = '<span style="color:#8a8a8a;flex:none">' + esc(when) + '</span>' +
        '<span style="flex:none;color:#666">' + (h.mode === '3d' ? '3D' : '앱') + '</span>' +
        '<span style="flex:1;min-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(h.prompt) + '">' + esc(h.title || h.prompt) + '</span>' +
        '<span style="flex:none;color:' + (h.ok ? '#047857' : '#b91c1c') + '">' + (h.ok ? '완성 ' + Math.round(h.size / 1000) + 'KB' : (h.mode === '3d' ? '에셋' : '미완성')) + '</span>' +
        (h.stages ? '<span style="flex:none;color:#8a8a8a" title="단계별 결과">' + esc(h.stages) + '</span>' : '');
      if (h.ok) {
        var b1 = document.createElement('button'); b1.className = 'b'; b1.textContent = '다시 보기';
        b1.addEventListener('click', function () { finalHtml = h.html; finalTitle = h.title; $('prompt').value = h.prompt || ''; $('result').className = 'card result on'; $('frame').srcdoc = h.html; $('count').textContent = '내역에서 불러옴'; $('result').scrollIntoView({ behavior: 'smooth' }); });
        var b2 = document.createElement('button'); b2.className = 'b pri'; b2.textContent = '채팅으로';
        b2.addEventListener('click', function () { finalHtml = h.html; finalTitle = h.title; $('prompt').value = h.prompt || ''; goChat(); });
        d.appendChild(b1); d.appendChild(b2);
      }
      var b3 = document.createElement('button'); b3.className = 'b del'; b3.textContent = '삭제';
      b3.addEventListener('click', function () { var l = readHist(); l.splice(i, 1); writeHist(l); renderHist(); });
      d.appendChild(b3);
      box.appendChild(d);
    });
  }
  $('clearHist').addEventListener('click', function () { if (confirm('내역을 모두 지울까요?')) { writeHist([]); renderHist(); } });
  renderHist();

  /* ───────── 앱 결과 → 채팅 워크벤치 ───────── */
  function showResult() {
    $('result').className = 'card result on';
    $('frame').srcdoc = finalHtml;
    $('result').scrollIntoView({ behavior: 'smooth' });
    if (chipOn('c-go')) {
      var left = 5;
      $('count').textContent = left + '초 뒤 채팅으로 이동합니다';
      goTimer = setInterval(function () {
        left--; $('count').textContent = left + '초 뒤 채팅으로 이동합니다';
        if (left <= 0) { clearInterval(goTimer); goTimer = null; goChat(); }
      }, 1000);
    } else $('count').textContent = '';
  }
  function goChat() {
    if (!finalHtml) return;
    try {
      sessionStorage.setItem('cf-engine-result', JSON.stringify({ title: finalTitle || '엔진 결과', html: finalHtml, prompt: $('prompt').value.trim() }));
    } catch (e) { alert('결과가 너무 커서 넘기지 못했습니다. HTML 복사를 이용해 주세요.'); return; }
    topGo('/chat?engine=1');
  }

  $('go').addEventListener('click', run);
  $('stop').addEventListener('click', function () { if (!running) return; aborted = true; ctrl.abort(); });
  $('goChat').addEventListener('click', function () { if (goTimer) { clearInterval(goTimer); goTimer = null; } goChat(); });
  $('cancelGo').addEventListener('click', function () { if (goTimer) { clearInterval(goTimer); goTimer = null; } $('count').textContent = '자동 이동을 취소했습니다'; });
  $('copy').addEventListener('click', function () { navigator.clipboard.writeText(finalHtml).then(function () { log('ok', 'HTML 을 복사했습니다'); }); });
  $('prompt').addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run(); });
  renderStages();
})();
</script>
</body>
</html>
`;

export async function onRequestGet() {
  return new Response(HTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      // 채팅 앱(/engine 부모 창)이 Cross-Origin-Embedder-Policy 를 쓰기 때문에, 그 안에 들어가는 이 문서도 같은 정책을 내야 표시됩니다
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
  });
}
