/* coverfo 💬 채팅 · 👥 일반채팅 — public/cf-chat.js (v296 · v299: 알림을 누르면 #cr=방ID 로 그 방 열기)
   · 홈의 💬 채팅 · 👥 일반채팅 아이콘을 누르면 포도톡 창 대신 이 화면이 coverfo 안에서 바로 열린다 (🌐 통역톡은 cf-trans.js)
   · 💬 채팅 = 둘이서 (1:1, 2명) · 👥 일반채팅 = 코드로만 들어오는 방 (100명) · 🌏 오픈채팅 = 목록에 보여 누구나 들어오는 방
   · 서버 /api/chat (coverfo 로그인) · 무료 — 크레딧을 쓰지 않는다
   · 초대 링크: coverfo.com/#c=코드6자리 · 대화는 30일 뒤 자동 삭제 · 차단·신고 */
(function () {
  if (window.cfChatOpen) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); };
  var ls = { get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  function myNick() { return ls.get('cfc_nick', '') || ls.get('cft_nick', ''); }
  function hhmm(t) { try { var d = new Date(t); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); } catch (e) { return ''; } }

  /* ── 모양 (통역톡과 같은 결) ── */
  var css = document.createElement('style'); css.id = 'cf-chat-css';
  css.textContent =
    '#cfc{position:fixed;inset:0;z-index:10050;background:#f6f4fb;display:none;flex-direction:column;font-family:inherit;color:#1c1830}#cfc.on{display:flex}' +
    '#cfc .c-bar{flex:none;display:flex;align-items:center;gap:8px;height:52px;padding:0 12px;background:#fff;border-bottom:1px solid #ece8f5}' +
    '#cfc .c-bar b{flex:1;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#cfc .c-x,#cfc .c-back{border:1px solid #e3def0;background:#fff;border-radius:999px;padding:7px 12px;font-size:13px;font-weight:700;cursor:pointer;color:#333}' +
    '#cfc .c-seg{flex:none;display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:10px 12px;background:#fff;border-bottom:1px solid #ece8f5}' +
    '#cfc .c-seg button{border:2px solid #e6e1f2;background:#fff;border-radius:12px;padding:10px 2px;font-size:13.5px;font-weight:800;color:#6b6385;cursor:pointer}#cfc .c-seg button.on{background:#6d28d9;border-color:#6d28d9;color:#fff}' +
    '#cfc .c-body{flex:1;overflow:auto;padding:14px 12px 24px;max-width:760px;width:100%;margin:0 auto;box-sizing:border-box}' +
    '#cfc .c-lead{font-size:13px;color:#5d566f;line-height:1.6;background:#fff;border-radius:14px;padding:12px 14px;margin-bottom:12px}' +
    '#cfc .c-card{background:#fff;border:1px solid #ebe6f5;border-radius:16px;padding:14px;margin-bottom:12px}' +
    '#cfc .c-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}#cfc .c-row>*{min-width:0}' +
    '#cfc input.c-in,#cfc textarea.c-in{border:1px solid #ddd6ec;border-radius:12px;padding:10px 12px;font-size:15px;background:#fff;color:#1c1830;font-family:inherit;box-sizing:border-box}#cfc input.c-in{flex:1}' +
    '#cfc .c-btn{border:0;border-radius:12px;padding:10px 14px;background:#6d28d9;color:#fff;font-weight:800;font-size:14px;cursor:pointer;white-space:nowrap}' +
    '#cfc .c-btn.g{background:#efeaf9;color:#5b21b6}#cfc .c-btn.s{padding:7px 10px;font-size:12.5px}#cfc .c-btn:disabled{opacity:.5}' +
    '#cfc .c-room{display:flex;gap:10px;align-items:center;background:#fff;border:1px solid #ebe6f5;border-radius:14px;padding:12px;margin-bottom:8px;cursor:pointer}' +
    '#cfc .c-room .av{font-size:24px}#cfc .c-room .mid{flex:1;min-width:0}#cfc .c-room .nm{font-weight:800;font-size:15px}#cfc .c-room .tm{font-size:11.5px;color:#9a93ad}' +
    '#cfc .c-room .lst{font-size:12.5px;color:#7a7390;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#cfc .chip{display:inline-block;font-size:11px;font-weight:800;background:#efeaf9;color:#5b21b6;border-radius:999px;padding:2px 8px;margin-left:6px}' +
    '#cfc .c-chat{display:flex;flex-direction:column;gap:6px;padding-bottom:8px}' +
    '#cfc .m{max-width:80%;padding:9px 12px;border-radius:14px;font-size:15px;line-height:1.5;word-break:break-word;white-space:pre-wrap}#cfc .m .t{display:block;font-size:11px;opacity:.7;margin-top:2px;text-align:right}' +
    '#cfc .m.me{align-self:flex-end;background:#6d28d9;color:#fff;border-bottom-right-radius:4px}#cfc .m.you{align-self:flex-start;background:#fff;border:1px solid #ebe6f5;border-bottom-left-radius:4px;cursor:pointer}' +
    '#cfc .m .who{font-size:11.5px;font-weight:800;color:#6d28d9;margin-bottom:2px;white-space:normal}#cfc .m .act{display:none;gap:6px;margin-top:6px;white-space:normal}#cfc .m.sel .act{display:flex}' +
    '#cfc .c-send{flex:none;display:flex;gap:8px;align-items:flex-end;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));background:#fff;border-top:1px solid #ece8f5}' +
    '#cfc .c-send textarea{flex:1;min-height:44px;max-height:120px;resize:none}#cfc .mic{width:48px;height:44px;border-radius:12px;border:0;background:#efeaf9;font-size:20px;cursor:pointer}#cfc .mic.on{background:#ef4444;color:#fff}' +
    '#cfc .c-err{background:#fff1f1;color:#b42318;border-radius:12px;padding:10px 12px;font-size:13px;margin:8px 0}#cfc .c-ok{background:#ecfdf3;color:#067647;border-radius:12px;padding:10px 12px;font-size:13px;margin:8px 0}' +
    '#cfc label.ck{font-size:13px;color:#4a4460;display:flex;gap:6px;align-items:center}' +
    'body.cfc-lock{overflow:hidden}';
  document.head.appendChild(css);
  var ov = document.createElement('div'); ov.id = 'cfc'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
  ov.innerHTML = '<div class="c-bar"><button type="button" class="c-back" data-a="back" hidden>←</button><b id="cfc-title">💬 채팅</b><button type="button" class="c-x" data-a="close">✕ 닫기</button></div>' +
    '<div class="c-seg" id="cfc-seg"></div><div class="c-body" id="cfc-body"></div><div id="cfc-foot"></div>';
  document.body.appendChild(ov);
  var $ = function (id) { return document.getElementById(id); };

  /* mode: direct(💬 채팅) | gen(👥 일반채팅) | pub(🌏 오픈채팅) */
  var S = { mode: 'direct', room: null, after: 0, poll: null, rec: null, busy: false, mem: false };

  /* ── 로그인 토큰 · 서버 (통역톡과 같은 방식) ── */
  function token() {
    try { var c = window.__cfSbClient; if (c && c.auth && c.auth.getSession) return c.auth.getSession().then(function (r) { var s = r && r.data && r.data.session; return s ? s.access_token : null; }); } catch (e) {}
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('sb-') === 0 && k.indexOf('-auth-token') > 0) { var v = JSON.parse(localStorage.getItem(k) || 'null'); if (v && v.access_token) return Promise.resolve(v.access_token); } } } catch (e) {}
    return Promise.resolve(null);
  }
  function api(body) {
    return token().then(function (t) {
      if (!t) { var e = new Error('login'); e.login = true; throw e; }
      return fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || ('오류 ' + r.status)); e.status = r.status; e.login = r.status === 401; throw e; } return j; }); });
    });
  }
  function openLogin() {
    close();
    var els = document.querySelectorAll('button,a');
    for (var i = 0; i < els.length; i++) { var t = (els[i].textContent || '').trim(); if (t === '로그인하기' || t === '로그인') { els[i].click(); return; } }
  }
  function errBox(e) {
    if (e && e.login) return '<div class="c-err">로그인이 필요해요. <button type="button" class="c-btn" data-a="login" style="margin-left:6px">로그인하기</button></div>';
    return '<div class="c-err">' + esc((e && e.message) || e) + '</div>';
  }
  function note(m, ok) { var b = $('cfc-body'); var d = document.createElement('div'); d.className = ok ? 'c-ok' : 'c-err'; d.textContent = m; b.insertBefore(d, b.firstChild); b.scrollTop = 0; setTimeout(function () { d.remove(); }, 4000); }

  /* ── 말로 입력 (폰 받아쓰기 · 음성은 서버로 가지 않음) ── */
  function listen(done, btn) {
    var R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) { note('이 브라우저는 말로 입력을 지원하지 않아요. 글로 써 주세요.'); return; }
    if (S.rec) { try { S.rec.stop(); } catch (e) {} S.rec = null; if (btn) btn.classList.remove('on'); return; }
    var r = new R(); r.lang = navigator.language || 'ko-KR'; r.interimResults = false; r.maxAlternatives = 1;
    S.rec = r; if (btn) btn.classList.add('on');
    r.onresult = function (ev) { var t = ''; try { t = ev.results[0][0].transcript; } catch (e) {} if (t) done(t); };
    r.onend = r.onerror = function () { S.rec = null; if (btn) btn.classList.remove('on'); };
    try { r.start(); } catch (e) { S.rec = null; if (btn) btn.classList.remove('on'); }
  }

  /* ── 화면 ── */
  function stopPoll() { if (S.poll) { clearInterval(S.poll); S.poll = null; } }
  function render() {
    stopPoll(); $('cfc-foot').innerHTML = '';
    ov.querySelector('[data-a="back"]').hidden = !S.room;
    var direct = S.mode === 'direct';
    $('cfc-title').textContent = S.room ? (S.room.name || '채팅') : (direct ? '💬 채팅' : S.mode === 'pub' ? '🌏 오픈채팅' : '👥 일반채팅');
    var sg = $('cfc-seg');
    sg.style.display = (S.room || direct) ? 'none' : '';
    sg.innerHTML = '<button type="button" class="' + (S.mode === 'gen' ? 'on' : '') + '" data-a="mode" data-v="gen">💬 일반채팅</button><button type="button" class="' + (S.mode === 'pub' ? 'on' : '') + '" data-a="mode" data-v="pub">🌏 오픈채팅</button>';
    if (S.room) return roomView();
    if (S.mode === 'pub') return pubView();
    listView();
  }
  function roomRow(r, btn) {
    var av = r.kind === 'direct' ? '💬' : (r.pub ? '🌏' : '👥');
    return '<div class="c-room" data-a="open" data-id="' + esc(r.id) + '" data-name="' + esc(r.name) + '" data-code="' + esc(r.code) + '" data-kind="' + esc(r.kind) + '" data-pub="' + (r.pub ? 1 : 0) + '" data-mine="' + (r.mine ? 1 : 0) + '"><div class="av">' + av + '</div>' +
      '<div class="mid"><div class="nm">' + esc(r.name) + (r.kind === 'direct' ? '' : '<span class="chip">👥 ' + r.members + '</span>') + '</div>' +
      '<div class="lst">' + esc(r.last_body ? (r.last_nick ? r.last_nick + ': ' : '') + r.last_body : '아직 대화가 없어요') + '</div></div>' +
      (btn || '<div class="tm">' + esc(r.last_body ? hhmm(r.last_at) : '') + '</div>') + '</div>';
  }

  /* 💬 채팅 · 👥 일반채팅: 내 방 목록 + 만들기 + 코드로 참여 */
  function listView() {
    var direct = S.mode === 'direct';
    $('cfc-body').innerHTML = '<div class="c-lead">' + (direct
      ? '<b>둘이서</b> 이야기해요. 방을 만들고 초대 링크를 상대에게 보내면 상대가 눌러서 들어와요.'
      : '<b>초대한 사람만</b> 들어오는 방이에요 (최대 100명). 🌏 오픈채팅으로 만들면 목록에 보여 누구나 들어올 수 있어요.') +
      '<br>💳 무료 · 대화는 30일 뒤 자동으로 지워져요.</div>' +
      '<div class="c-card"><div class="c-row" style="margin-bottom:8px"><input class="c-in" id="cfc-nick" maxlength="20" placeholder="내 이름 (상대에게 보여요)" value="' + esc(myNick()) + '"></div>' +
      '<div class="c-row" style="margin-bottom:8px"><input class="c-in" id="cfc-name" maxlength="30" placeholder="방 이름' + (direct ? ' (선택)' : '') + '"><button type="button" class="c-btn" data-a="create">＋ 방 만들기</button></div>' +
      (direct ? '' : '<div class="c-row" style="margin-bottom:8px"><label class="ck"><input type="checkbox" id="cfc-pub"> 🌏 오픈채팅으로 (누구나 목록에서 보고 들어옴)</label></div>') +
      '<div class="c-row"><input class="c-in" id="cfc-code" maxlength="6" placeholder="초대 코드 6자리" style="text-transform:uppercase" value="' + esc(ls.get('cfc_invite', '')) + '"><button type="button" class="c-btn g" data-a="join">코드로 참여</button></div></div>' +
      '<div id="cfc-list"><div class="c-lead">내 채팅방을 불러오는 중…</div></div>';
    api({ op: 'rooms', kind: direct ? 'direct' : 'group' }).then(function (j) {
      var rs = j.rooms || [];
      if (!$('cfc-list')) return;   /* 그새 방으로 들어갔으면(목록 칸이 없으면) 그냥 둔다 */
      $('cfc-list').innerHTML = rs.length ? rs.map(function (r) { return roomRow(r); }).join('')
        : '<div class="c-lead">' + (direct ? '1:1 대화가 없어요. 방을 만들고 초대 링크를 보내 보세요.' : '방이 없어요. 새로 만들어 보세요!') + '</div>';
    }, function (e) { if ($('cfc-list')) $('cfc-list').innerHTML = errBox(e); });
  }

  /* 🌏 오픈채팅: 공개방 목록 */
  function pubView() {
    $('cfc-body').innerHTML = '<div class="c-lead"><b>누구나</b> 보고 들어오는 방이에요. 전화번호·주소 같은 개인정보는 올리지 마세요. 불쾌한 말은 눌러서 🚫 차단 · 🚨 신고할 수 있어요.<br>💳 무료</div>' +
      '<div class="c-card"><div class="c-row"><input class="c-in" id="cfc-q" maxlength="30" placeholder="방 이름 찾기"><button type="button" class="c-btn g" data-a="find">찾기</button></div>' +
      '<div class="c-row" style="margin-top:8px"><button type="button" class="c-btn" data-a="mode" data-v="gen">＋ 오픈채팅 만들기</button></div></div>' +
      '<div id="cfc-list"><div class="c-lead">오픈채팅을 불러오는 중…</div></div>';
    loadPub('');
  }
  function loadPub(q) {
    api({ op: 'public', q: q }).then(function (j) {
      var rs = j.rooms || [];
      if (!$('cfc-list')) return;
      $('cfc-list').innerHTML = rs.length ? rs.map(function (r) {
        return roomRow(r, '<button type="button" class="c-btn ' + (r.joined ? 'g ' : '') + 's" data-a="pjoin" data-id="' + esc(r.id) + '">' + (r.joined ? '입장' : '참여') + '</button>');
      }).join('') : '<div class="c-lead">' + (q ? '찾는 방이 없어요.' : '공개방이 없어요. 👥 일반채팅에서 방을 만들 때 <b>🌏 오픈채팅으로</b>를 켜면 여기에 보여요.') + '</div>';
    }, function (e) { if ($('cfc-list')) $('cfc-list').innerHTML = errBox(e); });
  }
  function saveNick() { var n = $('cfc-nick'); var v = n ? n.value.trim() : myNick(); if (n) ls.set('cfc_nick', v); return v; }

  /* 채팅방 */
  function roomView() {
    var r = S.room;
    $('cfc-body').innerHTML = '<div class="c-card" style="padding:10px 12px"><div class="c-row" id="cfc-tools"></div><div id="cfc-mem" style="font-size:12px;color:#7a7390;margin-top:6px"></div></div><div class="c-chat" id="cfc-chat"></div>';
    tools();
    $('cfc-foot').innerHTML = '<div class="c-send"><button type="button" class="mic" data-a="mic" title="말로 입력">🎤</button><textarea class="c-in" id="cfc-text" maxlength="1000" placeholder="메시지를 쓰세요"></textarea><button type="button" class="c-btn" data-a="send">보내기</button></div>';
    S.after = 0; S.first = true; S.mem = false;
    pull(); S.poll = setInterval(function () { if (!document.hidden) pull(); }, 2500);
  }
  function tools(blocked) {
    var r = S.room, t = $('cfc-tools'); if (!t) return;
    t.innerHTML = '<span class="chip" style="margin:0">' + (r.kind === 'direct' ? '💬 1:1' : r.pub ? '🌏 오픈' : '👥 일반') + ' · ' + esc(r.code) + '</span>' +
      '<button type="button" class="c-btn g s" data-a="invite">🔗 초대</button>' +
      '<button type="button" class="c-btn g s" data-a="mem">👥 참여자</button>' +
      '<button type="button" class="c-btn g s" data-a="mynick">✏️ 내 이름</button>' +
      (r.mine ? '<button type="button" class="c-btn g s" data-a="rename">방 이름</button>' : '') +
      (blocked ? '<button type="button" class="c-btn g s" data-a="unblock">차단 풀기 (' + blocked + ')</button>' : '') +
      '<button type="button" class="c-btn g s" data-a="leave">나가기</button>' +
      (r.mine ? '<button type="button" class="c-btn g s" data-a="del" style="color:#b42318">방 지우기</button>' : '');
  }
  function pull() {
    if (!S.room || S.pulling) return; S.pulling = true;
    api({ op: 'msgs', room: S.room.id, after: S.after }).then(function (j) {
      S.pulling = false; if (!S.room) return;
      if (j.room) {
        var ch = j.room.mine !== S.room.mine || j.room.name !== S.room.name || (j.blocked || 0) !== (S.blocked || 0);
        S.room.mine = j.room.mine; S.room.name = j.room.name; S.room.pub = j.room.pub; S.room.kind = j.room.kind; S.room.code = j.room.code; S.blocked = j.blocked || 0;
        $('cfc-title').textContent = S.room.name || '채팅';
        if (ch) tools(S.blocked);
      }
      var mem = $('cfc-mem');
      if (mem && j.members) mem.textContent = S.mem ? '👥 ' + j.members.map(function (m) { return (m.owner ? '👑' : '') + m.nick + (m.me ? '(나)' : ''); }).join(' · ') : '👥 ' + j.members.length + '명' + (j.me ? ' · 나: ' + j.me.nick : '');
      var box = $('cfc-chat'); if (!box) return;
      (j.msgs || []).forEach(function (m) {
        S.after = Math.max(S.after, m.id);
        if (m.hidden) return;
        var d = document.createElement('div'); d.className = 'm ' + (m.mine ? 'me' : 'you'); d.setAttribute('data-mid', m.id);
        d.innerHTML = (m.mine ? '' : '<div class="who">' + esc(m.nick) + '</div>') + esc(m.text) + '<span class="t">' + esc(hhmm(m.at)) + '</span>' +
          (m.mine ? '' : '<div class="act"><button type="button" class="c-btn g s" data-a="block" data-m="' + m.id + '">🚫 차단</button><button type="button" class="c-btn g s" data-a="report" data-m="' + m.id + '">🚨 신고</button></div>');
        box.appendChild(d);
      });
      if ((j.msgs && j.msgs.length) || S.first) { var bd = $('cfc-body'); bd.scrollTop = bd.scrollHeight; }
      if (S.first && j.msgs && !j.msgs.length) box.innerHTML = '<div class="c-lead" id="cfc-empty">아직 대화가 없어요. 첫 말을 건네 보세요!' + (S.room.kind === 'direct' ? ' 상대가 아직 없다면 🔗 초대를 눌러 링크를 보내 주세요.' : '') + '</div>';
      else if (j.msgs && j.msgs.length) { var em = $('cfc-empty'); if (em) em.remove(); }
      S.first = false;
    }, function (e) { S.pulling = false; if (e && (e.status === 403 || e.status === 404 || e.login)) { stopPoll(); var b = $('cfc-chat'); if (b) b.innerHTML = errBox(e); } });
  }
  function sendNow() {
    var ta = $('cfc-text'); if (!ta || S.busy) return; var t = ta.value.trim(); if (!t) return;
    S.busy = true; var btn = ov.querySelector('[data-a="send"]'); if (btn) btn.disabled = true;
    api({ op: 'send', room: S.room.id, text: t }).then(function () { ta.value = ''; S.busy = false; if (btn) btn.disabled = false; pull(); },
      function (e) { S.busy = false; if (btn) btn.disabled = false; var box = $('cfc-chat'); if (box) { var d = document.createElement('div'); d.innerHTML = errBox(e); box.appendChild(d.firstChild); } });
  }
  function enter(room) { S.room = room; S.blocked = 0; render(); }

  /* ── 누르기 ── */
  ov.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-a]') : null;
    if (!el) { var bub = e.target.closest ? e.target.closest('.m.you') : null; if (bub) bub.classList.toggle('sel'); return; }
    var a = el.getAttribute('data-a');
    if (a === 'close') return close();
    if (a === 'login') return openLogin();
    if (a === 'back') { S.room = null; return render(); }
    if (a === 'mode') { S.mode = el.getAttribute('data-v'); ls.set('cfc_seg', S.mode); render(); if (S.mode === 'gen' && el.textContent.indexOf('만들기') >= 0) { var p = $('cfc-pub'); if (p) p.checked = true; var nm = $('cfc-name'); if (nm) nm.focus(); } return; }
    if (a === 'create') {
      var nick = saveNick(), pub = !!($('cfc-pub') && $('cfc-pub').checked);
      el.disabled = true;
      api({ op: 'create', kind: S.mode === 'direct' ? 'direct' : 'group', name: ($('cfc-name').value || '').trim(), nick: nick, pub: pub }).then(function (j) { enter(j.room); },
        function (er) { el.disabled = false; $('cfc-body').insertAdjacentHTML('afterbegin', errBox(er)); });
      return;
    }
    if (a === 'join') {
      var nk = saveNick(), code = ($('cfc-code').value || '').trim(); el.disabled = true;
      api({ op: 'join', code: code, nick: nk }).then(function (j) { ls.set('cfc_invite', ''); S.mode = j.room.kind === 'direct' ? 'direct' : 'gen'; enter(j.room); },
        function (er) { el.disabled = false; $('cfc-body').insertAdjacentHTML('afterbegin', errBox(er)); });
      return;
    }
    if (a === 'find') return loadPub(($('cfc-q').value || '').trim());
    if (a === 'pjoin') {
      e.stopPropagation(); el.disabled = true;
      api({ op: 'join', room: el.getAttribute('data-id'), nick: myNick() }).then(function (j) { enter(j.room); }, function (er) { el.disabled = false; note((er && er.message) || '들어가지 못했어요'); });
      return;
    }
    if (a === 'open') {
      if (S.mode === 'pub') { var pb = el.querySelector('[data-a="pjoin"]'); if (pb) pb.click(); return; }
      return enter({ id: el.getAttribute('data-id'), name: el.getAttribute('data-name'), code: el.getAttribute('data-code'), kind: el.getAttribute('data-kind'), pub: el.getAttribute('data-pub') === '1', mine: el.getAttribute('data-mine') === '1' });
    }
    if (a === 'send') return sendNow();
    if (a === 'mic') return listen(function (t) { var ta = $('cfc-text'); ta.value = (ta.value ? ta.value + ' ' : '') + t; ta.focus(); }, el);
    if (a === 'mem') { S.mem = !S.mem; S.after = S.after; return pull(); }
    if (a === 'invite') {
      var link = location.origin + '/#c=' + S.room.code, msg = '💬 coverfo 채팅에 초대해요. 눌러서 들어오세요.\n' + link + '\n(초대 코드 ' + S.room.code + ')';
      if (navigator.share) { navigator.share({ text: msg }).then(function () {}, function () {}); return; }
      try { navigator.clipboard.writeText(msg).then(function () { note('초대 링크를 복사했어요. 카카오톡·문자에 붙여 넣으세요.', true); }); } catch (x) { note(link, true); }
      return;
    }
    if (a === 'mynick') {
      var nv = prompt('이 방에서 쓸 내 이름', ''); if (nv == null || !nv.trim()) return;
      api({ op: 'nick', room: S.room.id, nick: nv.trim() }).then(function () { ls.set('cfc_nick', nv.trim()); note('이름을 바꿨어요. 앞으로 보내는 말부터 새 이름으로 보여요.', true); pull(); }, function (er) { note(er.message); });
      return;
    }
    if (a === 'rename') {
      var rn = prompt('새 방 이름', S.room.name || ''); if (rn == null || !rn.trim()) return;
      api({ op: 'rename', room: S.room.id, name: rn.trim() }).then(function (j) { S.room.name = j.name; $('cfc-title').textContent = j.name; }, function (er) { note(er.message); });
      return;
    }
    if (a === 'leave' || a === 'del') {
      if (!confirm(a === 'del' ? '방과 대화를 모두 지울까요? 되돌릴 수 없어요.' : '이 방에서 나갈까요?')) return;
      api({ op: a === 'del' ? 'delete' : 'leave', room: S.room.id }).then(function () { S.room = null; render(); }, function (er) { note((er && er.message) || '실패'); });
      return;
    }
    if (a === 'block') {
      if (!confirm('이 사람을 차단할까요? 이 사람의 말이 나에게 보이지 않아요 (모든 방).')) return;
      api({ op: 'block', msg: el.getAttribute('data-m') }).then(function () { var box = $('cfc-chat'); if (box) box.innerHTML = ''; S.after = 0; S.first = true; note('차단했어요.', true); pull(); }, function (er) { note(er.message); });
      return;
    }
    if (a === 'unblock') {
      if (!confirm('차단한 사람을 모두 풀까요?')) return;
      api({ op: 'unblock_all' }).then(function () { var box = $('cfc-chat'); if (box) box.innerHTML = ''; S.after = 0; S.first = true; S.blocked = 0; tools(0); pull(); }, function (er) { note(er.message); });
      return;
    }
    if (a === 'report') {
      var why = prompt('신고 이유를 적어 주세요 (예: 욕설, 광고, 사기)', ''); if (why == null) return;
      api({ op: 'report', msg: el.getAttribute('data-m'), reason: why }).then(function () { note('신고했어요. 운영자가 확인할게요.', true); }, function (er) { note(er.message); });
      return;
    }
  });
  ov.addEventListener('keydown', function (e) {
    if (e.target && e.target.id === 'cfc-text' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendNow(); }
    if (e.target && e.target.id === 'cfc-q' && e.key === 'Enter') { e.preventDefault(); loadPub(e.target.value.trim()); }
  });

  function open(mode) {
    S.mode = mode === 'direct' ? 'direct' : (mode === 'pub' ? 'pub' : (mode === 'gen' ? (ls.get('cfc_seg', 'gen') === 'pub' ? 'pub' : 'gen') : 'gen'));
    S.room = null;
    ov.classList.add('on'); document.body.classList.add('cfc-lock');
    try { if (!(history.state && history.state.cfc)) history.pushState({ cfc: 1 }, ''); } catch (e) {}
    render();
  }
  function close(fromPop) {
    stopPoll(); if (S.rec) { try { S.rec.stop(); } catch (e) {} }
    ov.classList.remove('on'); document.body.classList.remove('cfc-lock');
    if (fromPop !== true) { try { if (history.state && history.state.cfc) history.back(); } catch (e) {} }
  }
  window.addEventListener('popstate', function () {
    if (!ov.classList.contains('on')) return;
    if (S.room) { S.room = null; render(); try { history.pushState({ cfc: 1 }, ''); } catch (e) {} return; }
    close(true);
  });
  window.cfChatOpen = open; window.cfChatClose = close;

  /* 홈의 💬 채팅 · 👥 일반채팅 아이콘: 포도톡 창 대신 이 화면 (캡처 단계에서 먼저 받는다) */
  window.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('#cf-talk [data-tk="direct"], #cf-talk [data-tk="general"]') : null;
    if (!b) return;
    e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
    open(b.getAttribute('data-tk') === 'direct' ? 'direct' : 'gen');
  }, true);

  /* 초대 링크 coverfo.com/#c=ABC123 → 채팅을 열고 코드를 채워 둔다 */
  function invite() {
    var m = String(location.hash || '').match(/^#c=([A-Za-z0-9]{6})$/);
    if (!m) return;
    ls.set('cfc_invite', m[1].toUpperCase());
    try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) {}
    setTimeout(function () { open('direct'); }, 600);
  }
  invite();
  window.addEventListener('hashchange', invite);

  /* v299 🔔 알림을 누르면 coverfo.com/#cr=방ID → 그 채팅방을 바로 연다 (이름·종류는 첫 메시지를 받을 때 채워짐) */
  function fromPush() {
    var m = String(location.hash || '').match(/^#cr=([0-9a-f-]{36})$/);
    if (!m) return;
    try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) {}
    setTimeout(function () { open('gen'); enter({ id: m[1], name: '채팅', code: '', kind: 'group', pub: false, mine: false }); }, 600);
  }
  fromPush();
  window.addEventListener('hashchange', fromPush);
})();
