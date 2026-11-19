/* coverfo 🌐 포도랑 번역 기능 — public/cf-podolang.js (v407)
   · 홈 'AI에게 물어보기' 칸의 🎥 영상통화 번역 · 🎙️ 음성통화 번역 · 🎧 오디오·스트림 번역 · ⌨️ 텍스트 번역 · 👂 라이브 청취 를 누르면
     포도랑(podolang.kr) 화면을 coverfo 안 전체 화면 창으로 띄운다 (전화통역과 같은 방식).
   · 요금은 coverfo 지갑: /api/trans 의 'call_ticket'(12시간 표)을 포도랑에 넘기면, 포도랑 서버가 그 표로 coverfo 지갑에서 뺀다.
     (텍스트 번역 1번 0.1 · 라이브 청취 · 오디오 · 영상 · 음성 통화 번역 말한 시간 1분 0.5 — 포도랑과 같은 값)
   · 결제 · 충전 코드는 건드리지 않는다. 로그인이 안 돼 있으면 coverfo 로그인 창을 연다. */
(function () {
  if (window.cfPodolangOpen) return;
  var MODES = {
    video: { t: '영상통화 번역', ic: '🎥', allow: 'camera; microphone; autoplay; clipboard-write' },
    voice: { t: '음성통화 번역', ic: '🎙️', allow: 'microphone; autoplay; clipboard-write' },
    audio: { t: '오디오·스트림 번역', ic: '🎧', allow: 'autoplay; clipboard-write' },
    text:  { t: '텍스트 번역', ic: '⌨️', allow: 'clipboard-write' },
    live:  { t: '라이브 청취', ic: '👂', allow: 'microphone; autoplay; clipboard-write' }
  };

  var css = document.createElement('style'); css.id = 'cf-podolang-css';
  css.textContent =
    '#cfpl{position:fixed;inset:0;z-index:10055;background:#f4f7fb;display:none;flex-direction:column;font-family:inherit;color:#1c1830}#cfpl.on{display:flex}' +
    '#cfpl .bar{flex:none;display:flex;align-items:center;gap:8px;height:52px;padding:0 12px;background:#fff;border-bottom:1px solid #e6ebf3}' +
    '#cfpl .bar b{flex:1;font-size:16px;font-weight:800}' +
    '#cfpl .bar button{border:1px solid #dfe5ef;background:#fff;border-radius:999px;padding:7px 14px;font-size:13px;font-weight:700;cursor:pointer;color:#1c1830}' +
    '#cfpl iframe{flex:1;width:100%;border:0;background:#fff}' +
    '#cfpl .msg{margin:24px auto;max-width:420px;background:#fff;border:1px solid #e6ebf3;border-radius:16px;padding:18px;font-size:14px;line-height:1.6;text-align:center}' +
    '#cfpl .msg button{margin-top:12px;border:0;border-radius:12px;padding:10px 16px;background:#2f6bff;color:#fff;font-weight:800;font-size:14px;cursor:pointer}' +
    'body.cfpl-lock{overflow:hidden}';
  document.head.appendChild(css);

  var ov = document.createElement('div'); ov.id = 'cfpl'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
  ov.innerHTML = '<div class="bar"><b id="cfpl-t"></b><button type="button" id="cfpl-x">닫기</button></div><div id="cfpl-body" style="flex:1;display:flex;flex-direction:column;min-height:0"></div>';
  function mount() { if (!ov.parentNode && document.body) document.body.appendChild(ov); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }

  /* coverfo 로그인 키 (cf-trans.js 와 같은 방법) */
  function token() {
    try { var c = window.__cfSbClient; if (c && c.auth && c.auth.getSession) return c.auth.getSession().then(function (r) { var s = r && r.data && r.data.session; return s ? s.access_token : null; }); } catch (e) {}
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('sb-') === 0 && k.indexOf('-auth-token') > 0) { var v = JSON.parse(localStorage.getItem(k) || 'null'); if (v && v.access_token) return Promise.resolve(v.access_token); } } } catch (e) {}
    return Promise.resolve(null);
  }
  function ticket() {
    return token().then(function (t) {
      if (!t) { var e = new Error('login'); e.login = true; throw e; }
      return fetch('/api/trans', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ op: 'call_ticket' }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.ticket) { var e = new Error(j.error || ('오류 ' + r.status)); e.login = r.status === 401; throw e; } return j.ticket; }); });
    });
  }
  function openLogin() {
    close();
    var els = document.querySelectorAll('button,a');
    for (var i = 0; i < els.length; i++) { var t = (els[i].textContent || '').trim(); if (t === '로그인하기' || t === '로그인') { els[i].click(); return; } }
  }

  function close(fromPop) {
    ov.classList.remove('on'); document.body.classList.remove('cfpl-lock');
    $('cfpl-body').innerHTML = '';   // iframe 을 지워 카메라 · 마이크 · 통화를 끈다
    if (fromPop !== true) { try { if (history.state && history.state.cfpl) history.back(); } catch (e) {} }
  }
  ov.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.id === 'cfpl-x') { close(); return; }
    if (t && t.getAttribute && t.getAttribute('data-a') === 'login') { openLogin(); return; }
  });
  window.addEventListener('popstate', function () { if (ov.classList.contains('on')) close(true); });   // 폰 뒤로가기 = 닫기

  window.cfPodolangOpen = function (mode) {
    var m = MODES[mode]; if (!m) return false;
    mount();
    $('cfpl-t').textContent = m.ic + ' ' + m.t;
    $('cfpl-body').innerHTML = '<div class="msg">여는 중…</div>';
    ov.classList.add('on'); document.body.classList.add('cfpl-lock');
    try { if (!(history.state && history.state.cfpl)) history.pushState({ cfpl: 1 }, ''); } catch (e) {}   // 폰 뒤로가기 = 닫기
    ticket().then(function (tk) {
      if (!ov.classList.contains('on')) return;
      $('cfpl-body').innerHTML = '<iframe title="' + esc(m.t) + '" allow="' + m.allow + '" src="https://podolang.kr/?embed=' + mode + '&uid=' + encodeURIComponent(tk) + '"></iframe>';
    }).catch(function (e) {
      $('cfpl-body').innerHTML = e && e.login
        ? '<div class="msg">로그인이 필요해요.<br>요금은 coverfo 크레딧에서 나가요.<br><button type="button" data-a="login">로그인하기</button></div>'
        : '<div class="msg">열지 못했어요.<br>' + esc((e && e.message) || e) + '</div>';
    });
    return true;
  };
})();
