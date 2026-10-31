/* coverfo 🌐 통역톡 — public/cf-trans.js (v295)
   · 홈의 🌐 통역톡 아이콘을 누르면 포도톡 창 대신 이 화면이 coverfo 안에서 바로 열린다 (채팅·일반채팅은 지금처럼 포도톡).
   · 칸 4개: 💬 1:1 동시통역 · 👪 다중 동시통역 · 🔄 마주보기 통역 · 📞 전화통역
   · 서버 /api/trans (coverfo 로그인 · coverfo 지갑). 번역 1개 = 0.1크레딧 (방 안의 다른 언어 수만큼, 혼자면 무료) · 마주보기 한 마디 0.1 · 전화 1분 6
   · 말하기 = 폰 받아쓰기(SpeechRecognition), 읽어주기 = 폰 음성(speechSynthesis) → 음성은 서버로 가지 않는다
   · 전화통역은 포도랑(podolang.kr) 전화통역 화면을 그대로 띄우고, coverfo 가 만든 12시간짜리 표로 coverfo 지갑에서 빠진다
   · 초대 링크: coverfo.com/#t=코드6자리 */
(function () {
  if (window.cfTransOpen) return;
  var VER = 'v295';
  var LANGS = [
    ['KO','한국어','🇰🇷','ko-KR'], ['EN','영어','🇺🇸','en-US'], ['VI','베트남어','🇻🇳','vi-VN'], ['ZH','중국어','🇨🇳','zh-CN'],
    ['TH','태국어','🇹🇭','th-TH'], ['JA','일본어','🇯🇵','ja-JP'], ['ID','인도네시아어','🇮🇩','id-ID'], ['UZ','우즈베크어','🇺🇿','uz-UZ'],
    ['NE','네팔어','🇳🇵','ne-NP'], ['MY','미얀마어','🇲🇲','my-MM'], ['KM','캄보디아어','🇰🇭','km-KH'], ['MN','몽골어','🇲🇳','mn-MN'],
    ['TL','필리핀어','🇵🇭','fil-PH'], ['RU','러시아어','🇷🇺','ru-RU'], ['ES','스페인어','🇪🇸','es-ES'], ['FR','프랑스어','🇫🇷','fr-FR'],
    ['DE','독일어','🇩🇪','de-DE'], ['PT','포르투갈어','🇧🇷','pt-BR'], ['IT','이탈리아어','🇮🇹','it-IT'], ['AR','아랍어','🇸🇦','ar-SA'],
    ['HI','힌디어','🇮🇳','hi-IN'], ['NL','네덜란드어','🇳🇱','nl-NL'], ['TR','터키어','🇹🇷','tr-TR'], ['UK','우크라이나어','🇺🇦','uk-UA']
  ];
  var L = function (c) { for (var i = 0; i < LANGS.length; i++) if (LANGS[i][0] === c) return LANGS[i]; return LANGS[0]; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); };
  var ls = { get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  function myLang() { var v = ls.get('cft_lang', ''); if (!v) { var g = String(navigator.language || 'ko').slice(0, 2).toUpperCase(); v = LANGS.some(function (x) { return x[0] === g; }) ? g : 'KO'; } return v; }
  function langSel(id, cur) { return '<select id="' + id + '" class="cft-sel">' + LANGS.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === cur ? ' selected' : '') + '>' + x[2] + ' ' + x[1] + '</option>'; }).join('') + '</select>'; }

  /* ── 모양 ── */
  var css = document.createElement('style'); css.id = 'cf-trans-css';
  css.textContent =
    '#cft{position:fixed;inset:0;z-index:10050;background:#f6f4fb;display:none;flex-direction:column;font-family:inherit;color:#1c1830}#cft.on{display:flex}' +
    '#cft .cft-bar{flex:none;display:flex;align-items:center;gap:8px;height:52px;padding:0 12px;background:#fff;border-bottom:1px solid #ece8f5}' +
    '#cft .cft-bar b{flex:1;font-size:16px}#cft .cft-x,#cft .cft-back{border:1px solid #e3def0;background:#fff;border-radius:999px;padding:7px 12px;font-size:13px;font-weight:700;cursor:pointer;color:#333}' +
    '#cft .cft-seg{flex:none;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:10px 12px;background:#fff;border-bottom:1px solid #ece8f5}' +
    '#cft .cft-seg button{border:2px solid #e6e1f2;background:#fff;border-radius:12px;padding:8px 2px;font-size:12px;font-weight:800;line-height:1.35;color:#6b6385;cursor:pointer}' +
    '#cft .cft-seg button.on{background:#6d28d9;border-color:#6d28d9;color:#fff}' +
    '#cft .cft-body{flex:1;overflow:auto;padding:14px 12px 24px;max-width:760px;width:100%;margin:0 auto;box-sizing:border-box}' +
    '#cft .cft-lead{font-size:13px;color:#5d566f;line-height:1.6;background:#fff;border-radius:14px;padding:12px 14px;margin-bottom:12px}' +
    '#cft .cft-card{background:#fff;border:1px solid #ebe6f5;border-radius:16px;padding:14px;margin-bottom:12px}' +
    '#cft .cft-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}#cft .cft-row>*{min-width:0}' +
    '#cft input.cft-in,#cft .cft-sel,#cft textarea.cft-in{border:1px solid #ddd6ec;border-radius:12px;padding:10px 12px;font-size:15px;background:#fff;color:#1c1830;font-family:inherit;box-sizing:border-box}' +
    '#cft input.cft-in{flex:1}#cft .cft-sel{max-width:100%}' +
    '#cft .cft-btn{border:0;border-radius:12px;padding:10px 14px;background:#6d28d9;color:#fff;font-weight:800;font-size:14px;cursor:pointer;white-space:nowrap}' +
    '#cft .cft-btn.g{background:#efeaf9;color:#5b21b6}#cft .cft-btn:disabled{opacity:.5}' +
    '#cft .cft-room{display:flex;gap:10px;align-items:center;background:#fff;border:1px solid #ebe6f5;border-radius:14px;padding:12px;margin-bottom:8px;cursor:pointer}' +
    '#cft .cft-room .av{font-size:24px}#cft .cft-room .mid{flex:1;min-width:0}#cft .cft-room .nm{font-weight:800;font-size:15px}' +
    '#cft .cft-room .lst{font-size:12.5px;color:#7a7390;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#cft .chip{display:inline-block;font-size:11px;font-weight:800;background:#efeaf9;color:#5b21b6;border-radius:999px;padding:2px 8px;margin-left:6px}' +
    '#cft .cft-chat{display:flex;flex-direction:column;gap:8px;padding-bottom:8px}' +
    '#cft .m{max-width:82%;padding:9px 12px;border-radius:14px;font-size:15px;line-height:1.5;word-break:break-word}#cft .m small{display:block;font-size:11.5px;opacity:.75;margin-top:3px}' +
    '#cft .m.me{align-self:flex-end;background:#6d28d9;color:#fff;border-bottom-right-radius:4px}#cft .m.you{align-self:flex-start;background:#fff;border:1px solid #ebe6f5;border-bottom-left-radius:4px}' +
    '#cft .m .who{font-size:11.5px;font-weight:800;color:#6d28d9;margin-bottom:2px}' +
    '#cft .cft-send{flex:none;display:flex;gap:8px;align-items:flex-end;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));background:#fff;border-top:1px solid #ece8f5}' +
    '#cft .cft-send textarea{flex:1;min-height:44px;max-height:120px;resize:none}#cft .mic{width:48px;height:44px;border-radius:12px;border:0;background:#efeaf9;font-size:20px;cursor:pointer}#cft .mic.on{background:#ef4444;color:#fff}' +
    '#cft .cft-err{background:#fff1f1;color:#b42318;border-radius:12px;padding:10px 12px;font-size:13px;margin:8px 0}' +
    '#cft .face{display:flex;flex-direction:column;gap:10px}#cft .side{background:#fff;border:1px solid #ebe6f5;border-radius:16px;padding:12px}#cft .side.top.flip{transform:rotate(180deg)}' +
    '#cft .side .big{min-height:56px;font-size:20px;font-weight:700;line-height:1.45;margin:8px 0;word-break:break-word}#cft .side .src{font-size:12px;color:#8a83a0}' +
    '#cft iframe.call{width:100%;min-height:620px;border:0;border-radius:14px;background:#fff}' +
    'body.cft-lock{overflow:hidden}';
  document.head.appendChild(css);
  var ov = document.createElement('div'); ov.id = 'cft'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
  ov.innerHTML = '<div class="cft-bar"><button type="button" class="cft-back" data-a="back" hidden>←</button><b id="cft-title">🌐 통역톡</b><button type="button" class="cft-x" data-a="close">✕ 닫기</button></div>' +
    '<div class="cft-seg" id="cft-seg"></div><div class="cft-body" id="cft-body"></div><div id="cft-foot"></div>';
  document.body.appendChild(ov);
  var $ = function (id) { return document.getElementById(id); };

  var S = { tab: ls.get('cft_tab', 'one'), room: null, after: 0, msgs: [], poll: null, rec: null, read: ls.get('cft_read', '1') === '1', busy: false };
  if (['one', 'multi', 'face', 'call'].indexOf(S.tab) < 0) S.tab = 'one';

  /* ── 로그인 토큰 · 서버 ── */
  function token() {
    try { var c = window.__cfSbClient; if (c && c.auth && c.auth.getSession) return c.auth.getSession().then(function (r) { var s = r && r.data && r.data.session; return s ? s.access_token : null; }); } catch (e) {}
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('sb-') === 0 && k.indexOf('-auth-token') > 0) { var v = JSON.parse(localStorage.getItem(k) || 'null'); if (v && v.access_token) return Promise.resolve(v.access_token); } } } catch (e) {}
    return Promise.resolve(null);
  }
  function api(body) {
    return token().then(function (t) {
      if (!t) { var e = new Error('login'); e.login = true; throw e; }
      return fetch('/api/trans', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || ('오류 ' + r.status)); e.status = r.status; e.login = r.status === 401; throw e; } return j; }); });
    });
  }
  function openLogin() {
    close();
    var els = document.querySelectorAll('button,a');
    for (var i = 0; i < els.length; i++) { var t = (els[i].textContent || '').trim(); if (t === '로그인하기' || t === '로그인') { els[i].click(); return; } }
  }
  function errBox(e) {
    if (e && e.login) return '<div class="cft-err">로그인이 필요해요. <button type="button" class="cft-btn" data-a="login" style="margin-left:6px">로그인하기</button></div>';
    var m = esc((e && e.message) || e);
    if (e && e.status === 402) m += ' <a href="/pricing#charge" style="font-weight:800;color:#6d28d9">충전하기</a>';
    return '<div class="cft-err">' + m + '</div>';
  }

  /* ── 말하기(받아쓰기) · 읽어주기 ── */
  function canMic() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
  function listen(lang, done, btn) {
    var R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) { alertBox('이 브라우저는 말로 입력을 지원하지 않아요. 글로 써 주세요.'); return; }
    if (S.rec) { try { S.rec.stop(); } catch (e) {} S.rec = null; if (btn) btn.classList.remove('on'); return; }
    var r = new R(); r.lang = L(lang)[3]; r.interimResults = false; r.maxAlternatives = 1;
    S.rec = r; if (btn) btn.classList.add('on');
    r.onresult = function (ev) { var t = ''; try { t = ev.results[0][0].transcript; } catch (e) {} if (t) done(t); };
    r.onend = function () { S.rec = null; if (btn) btn.classList.remove('on'); };
    r.onerror = function () { S.rec = null; if (btn) btn.classList.remove('on'); };
    try { r.start(); } catch (e) { S.rec = null; if (btn) btn.classList.remove('on'); }
  }
  function speak(text, lang) {
    try { if (!window.speechSynthesis || !text) return; var u = new SpeechSynthesisUtterance(text); u.lang = L(lang)[3]; speechSynthesis.speak(u); } catch (e) {}
  }
  function alertBox(m) { var b = $('cft-body'); var d = document.createElement('div'); d.className = 'cft-err'; d.textContent = m; b.insertBefore(d, b.firstChild); setTimeout(function () { d.remove(); }, 4000); }

  /* ── 화면 ── */
  function seg() {
    var T = [['one', '💬 1:1<br>동시통역'], ['multi', '👪 다중<br>동시통역'], ['face', '🔄 마주보기<br>통역'], ['call', '📞 전화<br>통역']];
    $('cft-seg').innerHTML = T.map(function (t) { return '<button type="button" class="' + (S.tab === t[0] ? 'on' : '') + '" data-a="tab" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join('');
    $('cft-seg').style.display = S.room ? 'none' : '';
  }
  function stopPoll() { if (S.poll) { clearInterval(S.poll); S.poll = null; } }
  function render() {
    stopPoll(); seg(); $('cft-foot').innerHTML = '';
    ov.querySelector('[data-a="back"]').hidden = !S.room;
    $('cft-title').textContent = S.room ? (S.room.name || '통역방') : '🌐 통역톡';
    if (S.room) return roomView();
    if (S.tab === 'face') return faceView();
    if (S.tab === 'call') return callView();
    listView();
  }

  /* 1:1 · 다중: 방 목록 */
  function listView() {
    var multi = S.tab === 'multi', b = $('cft-body');
    b.innerHTML = '<div class="cft-lead">' + (multi
      ? '여러 나라 사람이 <b>한 방에서 각자 자기 말로</b> 대화해요 (최대 10명). 말한 사람의 글이 방 안의 다른 언어로 번역돼요.'
      : '두 사람이 <b>각자 자기 폰에서 자기 말로</b> 대화해요. 상대에게는 상대 언어로 보이고, 폰이 읽어 줘요.') +
      '<br>💳 번역 1개 0.1크레딧 (방 안의 다른 언어 수만큼 · 같은 언어끼리는 무료) · 말한 사람만 차감</div>' +
      '<div class="cft-card"><div class="cft-row" style="margin-bottom:8px"><span style="font-size:13px;font-weight:800">내 언어</span>' + langSel('cft-mylang', myLang()) + '</div>' +
      '<div class="cft-row" style="margin-bottom:8px"><input class="cft-in" id="cft-nick" maxlength="20" placeholder="내 이름 (상대에게 보여요)" value="' + esc(ls.get('cft_nick', '')) + '"></div>' +
      '<div class="cft-row" style="margin-bottom:8px"><input class="cft-in" id="cft-name" maxlength="30" placeholder="방 이름 (선택)"><button type="button" class="cft-btn" data-a="create">＋ 방 만들기</button></div>' +
      '<div class="cft-row"><input class="cft-in" id="cft-code" maxlength="6" placeholder="초대 코드 6자리" style="text-transform:uppercase" value="' + esc(ls.get('cft_invite', '')) + '"><button type="button" class="cft-btn g" data-a="join">코드로 참여</button></div></div>' +
      '<div id="cft-list"><div class="cft-lead">내 통역방을 불러오는 중…</div></div>';
    api({ op: 'rooms', kind: S.tab }).then(function (j) {
      var rs = j.rooms || [];
      $('cft-list').innerHTML = rs.length ? rs.map(function (r) {
        return '<div class="cft-room" data-a="open" data-id="' + esc(r.id) + '" data-name="' + esc(r.name) + '" data-code="' + esc(r.code) + '" data-kind="' + esc(r.kind) + '"><div class="av">' + (r.kind === 'multi' ? '👪' : '💬') + '</div>' +
          '<div class="mid"><div class="nm">' + esc(r.name) + '<span class="chip">' + esc(r.code) + '</span><span class="chip">👥 ' + r.members + '</span></div>' +
          '<div class="lst">' + esc(r.langs.map(function (l) { return L(l)[2]; }).join(' ')) + ' · ' + esc(r.last_body ? (r.last_nick ? r.last_nick + ': ' : '') + r.last_body : '아직 대화가 없어요') + '</div></div></div>';
      }).join('') : '<div class="cft-lead">아직 통역방이 없어요. 방을 만들고 초대 코드를 상대에게 보내 주세요.</div>';
    }, function (e) { $('cft-list').innerHTML = errBox(e); });
  }
  function saveForm() {
    var l = $('cft-mylang'), n = $('cft-nick');
    if (l) ls.set('cft_lang', l.value); if (n) ls.set('cft_nick', n.value.trim());
    return { lang: l ? l.value : myLang(), nick: n ? n.value.trim() : ls.get('cft_nick', '') };
  }

  /* 통역방 대화 */
  function roomView() {
    var r = S.room;
    $('cft-body').innerHTML = '<div class="cft-card" style="padding:10px 12px"><div class="cft-row">' +
      '<span class="chip" style="margin:0">코드 ' + esc(r.code) + '</span><button type="button" class="cft-btn g" data-a="invite" style="padding:7px 10px;font-size:12.5px">🔗 초대 링크</button>' +
      langSel('cft-rlang', S.lang || myLang()) +
      '<button type="button" class="cft-btn g" data-a="read" style="padding:7px 10px;font-size:12.5px">' + (S.read ? '🔊 읽어주기 켬' : '🔇 읽어주기 끔') + '</button>' +
      '<button type="button" class="cft-btn g" data-a="leave" style="padding:7px 10px;font-size:12.5px">나가기</button>' + (r.mine ? '<button type="button" class="cft-btn g" data-a="del" style="padding:7px 10px;font-size:12.5px;color:#b42318">방 지우기</button>' : '') +
      '</div><div id="cft-mem" style="font-size:12px;color:#7a7390;margin-top:6px"></div></div><div class="cft-chat" id="cft-chat"></div>';
    $('cft-foot').innerHTML = '<div class="cft-send"><button type="button" class="mic" data-a="mic" title="말로 입력">🎤</button><textarea class="cft-in" id="cft-text" maxlength="500" placeholder="내 말로 쓰세요 · 상대 말로 번역돼요"></textarea><button type="button" class="cft-btn" data-a="send">보내기</button></div>';
    S.after = 0; S.msgs = []; S.first = true;
    pull(); S.poll = setInterval(pull, 2500);
  }
  function pull() {
    if (!S.room || S.pulling) return; S.pulling = true;
    api({ op: 'msgs', room: S.room.id, after: S.after }).then(function (j) {
      S.pulling = false; if (!S.room) return;
      if (j.room) { S.room.mine = j.room.mine; }
      if (j.me && !S.lang) { S.lang = j.me.lang; var sel = $('cft-rlang'); if (sel) sel.value = j.me.lang; }
      var mem = $('cft-mem'); if (mem && j.members) mem.textContent = '👥 ' + j.members.map(function (m) { return L(m.lang)[2] + ' ' + m.nick + (m.me ? '(나)' : ''); }).join(' · ');
      var box = $('cft-chat'); if (!box) return;
      (j.msgs || []).forEach(function (m) {
        S.after = Math.max(S.after, m.id);
        var d = document.createElement('div'); d.className = 'm ' + (m.mine ? 'me' : 'you');
        d.innerHTML = (m.mine ? '' : '<div class="who">' + L(m.lang)[2] + ' ' + esc(m.nick) + '</div>') + esc(m.text) + (m.text !== m.orig ? '<small>' + esc(m.orig) + '</small>' : '');
        box.appendChild(d);
        if (!m.mine && !S.first && S.read) speak(m.text, S.lang || myLang());
      });
      if (j.msgs && j.msgs.length) { var bd = $('cft-body'); bd.scrollTop = bd.scrollHeight; }
      S.first = false;
    }, function (e) { S.pulling = false; if (e && (e.status === 403 || e.login)) { stopPoll(); $('cft-chat').innerHTML = errBox(e); } });
  }
  function sendNow() {
    var ta = $('cft-text'); if (!ta || S.busy) return; var t = ta.value.trim(); if (!t) return;
    S.busy = true; var btn = ov.querySelector('[data-a="send"]'); if (btn) btn.disabled = true;
    api({ op: 'send', room: S.room.id, text: t }).then(function () { ta.value = ''; S.busy = false; if (btn) btn.disabled = false; pull(); },
      function (e) { S.busy = false; if (btn) btn.disabled = false; var box = $('cft-chat'); if (box) { var d = document.createElement('div'); d.innerHTML = errBox(e); box.appendChild(d.firstChild); } });
  }

  /* 🔄 마주보기: 폰 한 대 · 위(상대)·아래(나) */
  function faceView() {
    var a = ls.get('cft_fa', 'EN'), b = ls.get('cft_fb', myLang()), flip = ls.get('cft_flip', '1') === '1';
    $('cft-body').innerHTML = '<div class="cft-lead">폰 한 대를 <b>가운데 두고 마주 보며</b> 통역해요. 위쪽은 상대, 아래쪽은 나. 🎤 를 누르고 말하면 상대 말로 바꿔 보여 주고 읽어 줘요.<br>💳 한 마디 0.1크레딧 · 대화는 이 폰에만 남아요.</div>' +
      '<div class="face"><div class="side top' + (flip ? ' flip' : '') + '"><div class="cft-row">' + langSel('cft-fa', a) + '<button type="button" class="mic" data-a="fmic" data-s="a">🎤</button></div><div class="big" id="cft-fa-big"></div><div class="src" id="cft-fa-src"></div></div>' +
      '<div class="cft-row" style="justify-content:center"><label style="font-size:12.5px;color:#6b6385"><input type="checkbox" id="cft-flip"' + (flip ? ' checked' : '') + '> 위쪽 화면 뒤집기 (마주 앉았을 때)</label></div>' +
      '<div class="side bot"><div class="cft-row">' + langSel('cft-fb', b) + '<button type="button" class="mic" data-a="fmic" data-s="b">🎤</button></div><div class="big" id="cft-fb-big"></div><div class="src" id="cft-fb-src"></div>' +
      '<div class="cft-row"><input class="cft-in" id="cft-ftext" maxlength="500" placeholder="글로 써도 돼요 (내 말)"><button type="button" class="cft-btn" data-a="fsend">번역</button></div></div></div><div id="cft-flog"></div>';
  }
  function faceSay(side, text) {
    var a = $('cft-fa').value, b = $('cft-fb').value; ls.set('cft_fa', a); ls.set('cft_fb', b);
    var from = side === 'a' ? a : b, to = side === 'a' ? b : a, other = side === 'a' ? 'b' : 'a';
    $('cft-f' + side + '-src').textContent = '🗣 ' + text; $('cft-f' + other + '-big').textContent = '…';
    api({ op: 'translate', text: text, from: from, to: to }).then(function (j) {
      $('cft-f' + other + '-big').textContent = j.text; $('cft-f' + other + '-src').textContent = '';
      speak(j.text, to);
    }, function (e) { $('cft-f' + other + '-big').textContent = ''; $('cft-flog').innerHTML = errBox(e); });
  }

  /* 📞 전화통역: 포도랑 화면 + coverfo 표 */
  function callView() {
    var b = $('cft-body');
    b.innerHTML = '<div class="cft-lead">상대는 <b>그냥 전화를 받아</b> 평소처럼 말하면 돼요. 앱을 깔 필요도 없어요.<br><b>이어폰을 쓰세요.</b> 스피커로 들으면 통역 음성을 마이크가 다시 주워 말이 꼬여요.<br>💳 통화 1분 6크레딧 (coverfo 지갑 · 통화한 시간만큼, 분 단위 올림) · 통화는 포도랑(podolang.kr) 전화통역으로 연결돼요.</div><div id="cft-callbox"><div class="cft-lead">준비하는 중…</div></div>';
    api({ op: 'call_ticket' }).then(function (j) {
      $('cft-callbox').innerHTML = '<iframe class="call" allow="microphone; autoplay; clipboard-write" src="https://podolang.kr/?call&uid=' + encodeURIComponent(j.ticket) + '"></iframe>';
    }, function (e) { $('cft-callbox').innerHTML = errBox(e); });
  }
  window.addEventListener('message', function (ev) {
    try { if (!ev.data || ev.data.podolang !== 'h' || String(ev.origin || '').indexOf('podolang.kr') < 0) return; var f = ov.querySelector('iframe.call'); if (f) f.style.height = Math.max(620, ev.data.h | 0) + 'px'; } catch (e) {}
  });

  /* ── 누르기 ── */
  ov.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-a]') : null; if (!el) return;
    var a = el.getAttribute('data-a');
    if (a === 'close') return close();
    if (a === 'login') return openLogin();
    if (a === 'back') { S.room = null; S.lang = null; return render(); }
    if (a === 'tab') { S.tab = el.getAttribute('data-v'); ls.set('cft_tab', S.tab); return render(); }
    if (a === 'create') { var f = saveForm(); el.disabled = true; api({ op: 'create', kind: S.tab, name: ($('cft-name').value || '').trim(), lang: f.lang, nick: f.nick }).then(function (j) { S.room = j.room; S.room.mine = true; S.lang = f.lang; render(); }, function (er) { el.disabled = false; alertBox((er && er.message) || '방을 만들지 못했어요'); if (er && er.login) $('cft-body').insertAdjacentHTML('afterbegin', errBox(er)); }); return; }
    if (a === 'join') { var g = saveForm(), code = ($('cft-code').value || '').trim(); el.disabled = true; api({ op: 'join', code: code, lang: g.lang, nick: g.nick }).then(function (j) { ls.set('cft_invite', ''); S.room = j.room; S.lang = g.lang; S.tab = j.room.kind; render(); }, function (er) { el.disabled = false; $('cft-body').insertAdjacentHTML('afterbegin', errBox(er)); }); return; }
    if (a === 'open') { S.room = { id: el.getAttribute('data-id'), name: el.getAttribute('data-name'), code: el.getAttribute('data-code'), kind: el.getAttribute('data-kind') }; S.lang = null; return render(); }
    if (a === 'send') return sendNow();
    if (a === 'mic') return listen(S.lang || myLang(), function (t) { var ta = $('cft-text'); ta.value = (ta.value ? ta.value + ' ' : '') + t; sendNow(); }, el);
    if (a === 'read') { S.read = !S.read; ls.set('cft_read', S.read ? '1' : '0'); el.textContent = S.read ? '🔊 읽어주기 켬' : '🔇 읽어주기 끔'; return; }
    if (a === 'invite') {
      var link = location.origin + '/#t=' + S.room.code, msg = '🌐 coverfo 통역톡에 초대해요. 각자 자기 말로 대화하면 자동으로 번역돼요.\n' + link + '\n(초대 코드 ' + S.room.code + ')';
      if (navigator.share) { navigator.share({ text: msg }).then(function () {}, function () {}); return; }
      try { navigator.clipboard.writeText(msg).then(function () { alertBox('초대 링크를 복사했어요. 카카오톡·문자에 붙여 넣으세요.'); }); } catch (x) { alertBox(link); }
      return;
    }
    if (a === 'leave' || a === 'del') {
      if (!confirm(a === 'del' ? '방과 대화를 모두 지울까요? 되돌릴 수 없어요.' : '이 방에서 나갈까요?')) return;
      api({ op: a === 'del' ? 'delete' : 'leave', room: S.room.id }).then(function () { S.room = null; render(); }, function (er) { alertBox((er && er.message) || '실패'); });
      return;
    }
    if (a === 'fmic') { var s = el.getAttribute('data-s'); return listen(s === 'a' ? $('cft-fa').value : $('cft-fb').value, function (t) { faceSay(s, t); }, el); }
    if (a === 'fsend') { var ft = $('cft-ftext'); var tv = (ft.value || '').trim(); if (tv) { faceSay('b', tv); ft.value = ''; } return; }
  });
  ov.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'cft-rlang' && S.room) { S.lang = t.value; ls.set('cft_lang', t.value); api({ op: 'lang', room: S.room.id, lang: t.value }).then(function () { S.after = 0; $('cft-chat').innerHTML = ''; S.first = true; pull(); }, function (er) { alertBox(er.message); }); }
    if (t.id === 'cft-flip') { ls.set('cft_flip', t.checked ? '1' : '0'); var top = ov.querySelector('.side.top'); if (top) top.classList.toggle('flip', t.checked); }
    if (t.id === 'cft-fa') ls.set('cft_fa', t.value);
    if (t.id === 'cft-fb') ls.set('cft_fb', t.value);
  });
  ov.addEventListener('keydown', function (e) { if (e.target && e.target.id === 'cft-text' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendNow(); } });

  function open(tab) {
    if (tab) S.tab = tab;
    ov.classList.add('on'); document.body.classList.add('cft-lock');
    try { if (!(history.state && history.state.cft)) history.pushState({ cft: 1 }, ''); } catch (e) {}
    render();
  }
  function close(fromPop) {
    stopPoll(); if (S.rec) { try { S.rec.stop(); } catch (e) {} }
    try { speechSynthesis.cancel(); } catch (e) {}
    ov.classList.remove('on'); document.body.classList.remove('cft-lock');
    var cb = $('cft-callbox'); if (cb) cb.innerHTML = '';
    if (fromPop !== true) { try { if (history.state && history.state.cft) history.back(); } catch (e) {} }
  }
  window.addEventListener('popstate', function () {
    if (!ov.classList.contains('on')) return;
    if (S.room) { S.room = null; render(); try { history.pushState({ cft: 1 }, ''); } catch (e) {} return; }
    close(true);
  });
  window.cfTransOpen = open; window.cfTransClose = close;

  /* 홈의 🌐 통역톡 아이콘: 포도톡 창 대신 이 화면 (캡처 단계에서 먼저 받는다) */
  window.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('#cf-talk [data-tk="open"]') : null;
    if (!b) return;
    e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
    open();
  }, true);

  /* 초대 링크 coverfo.com/#t=ABC123 → 통역톡을 열고 코드를 채워 둔다 */
  function invite() {
    var m = String(location.hash || '').match(/^#t=([A-Za-z0-9]{6})$/);
    if (!m) return;
    ls.set('cft_invite', m[1].toUpperCase());
    try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) {}
    S.tab = 'one'; setTimeout(function () { open(); }, 600);
  }
  invite();
  window.addEventListener('hashchange', invite);
})();
