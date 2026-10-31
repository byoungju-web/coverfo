/* coverfo 🍇 포도야 비서 · 🔌 고급기능 — public/cf-podoya.js (v301)
   · v301: 🧩 포도야 기능 도구형 10칸 — 작명 · 운세 · 퀴즈생성 · 여행플래너 · AI 학습 · 발표자료 · AI가계부 · 냉장고요리 · AI 명함 (1번 1크레딧 · 가계부 적기는 무료)
           🗣️ 말로 열기 → coverfo 🗣️ 소리 (같은 일: 말하면 앱·사이트를 열어 줌)
   · v300: 🧩 포도야 기능 대화형 4칸 (🤗 AI 컴패니언 · 🇺🇸 영어회화 · 👵 시니어 · 💼 사장님비서) 을 coverfo 대화 화면으로 — 답 1번 0.2크레딧 · 대화는 이 폰에만
   · v298: 2차 (업무 자동화 · 내 기억 · 상품 시작하기)
   · v299: 🧩 포도야 기능(격자) · 📁 저장루틴(= 커넥션 허브 2.0 레시피) 을 coverfo 안에서 · 소리 "○○ 루틴 실행해" → 레시피 (window.cfRoutineRun)
           사이드바 설정: 🧠 내 기억 · 🔔 알림 · 🚫 차단한 사람 · 🛡️ 오픈채팅 안전 수칙 · 📞 전화통역 기록 (data-cfp-view)
   · 홈의 '포도야 비서' · '🔌 고급기능' 을 누르면 포도톡 창 대신 이 화면이 coverfo 안에서 바로 열린다 (하단 탭 없음)
   · 서버 /api/podoya (coverfo 로그인 · coverfo 지갑): 해외 응대 1 · 문서 만들기 1 · 웹 스크래핑 1 · 시맨틱 검색 1 · 유튜브→블로그 2 · 리서치 3 크레딧
   · coverfo 에 이미 있는 것은 그리로 연결: 대화로 시키기·에이전트팀 → 홈 입력칸 / 커넥션 허브 → 허브 2.0(/hub) / 친구에게 알리기 → 공유
   · 아직 옮기지 않은 것(루틴·매일 리포트·아침 알림·집안 기기·발송 채널)은 포도톡 화면을 탭 없이 띄운다 (landing 의 window.cfTalkOpen) */
(function () {
  if (window.cfPodoyaOpen) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); };
  var ls = { get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var COST = { intl: 1, doc: 1, scrape: 1, search: 1, yt: 2, research: 3, work: 2, launch: 1, img: 2 };
  var TITLE = { assist: '🍇 포도야 비서', adv: '🔌 고급기능', intl: '🌍 해외 응대', doc: '📄 문서 만들기', scrape: '🔍 웹 스크래핑', search: '🧠 시맨틱 검색', yt: '🎬 유튜브 → 블로그', research: '📊 리서치 파이프라인', work: '📊 업무 자동화', launch: '🎨 상품 시작하기', me: '🧠 내 기억', feat: '🧩 포도야 기능', routine: '📁 저장루틴', notify: '🔔 알림', blocks: '🚫 차단한 사람', safety: '🛡️ 오픈채팅 안전 수칙', calls: '📞 전화통역 기록' };
  var HOMES = ['assist', 'adv', 'feat', 'routine', 'me', 'notify', 'blocks', 'safety', 'calls'];
  var DOC_KINDS = [['quote', '📋', '견적서'], ['inv', '🌍', 'INVOICE'], ['state', '🧾', '거래명세서'], ['order', '📦', '발주서'], ['recpt', '🧻', '영수증']];

  /* ── 모양 (통역톡·채팅과 같은 결) ── */
  var css = document.createElement('style'); css.id = 'cf-podoya-css';
  css.textContent =
    '#cfp{position:fixed;inset:0;z-index:10050;background:#f6f4fb;display:none;flex-direction:column;font-family:inherit;color:#1c1830}#cfp.on{display:flex}' +
    '#cfp .p-bar{flex:none;display:flex;align-items:center;gap:8px;height:52px;padding:0 12px;background:#fff;border-bottom:1px solid #ece8f5}' +
    '#cfp .p-bar b{flex:1;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#cfp .p-x,#cfp .p-back{border:1px solid #e3def0;background:#fff;border-radius:999px;padding:7px 12px;font-size:13px;font-weight:700;cursor:pointer;color:#333}' +
    '#cfp .p-body{flex:1;overflow:auto;padding:14px 12px 32px;max-width:760px;width:100%;margin:0 auto;box-sizing:border-box}' +
    '#cfp .p-lead{font-size:13px;color:#5d566f;line-height:1.6;background:#fff;border-radius:14px;padding:12px 14px;margin-bottom:12px}' +
    '#cfp .p-sec{font-size:12px;font-weight:800;color:#9a93ad;margin:16px 4px 6px}' +
    '#cfp .p-list{background:#fff;border:1px solid #ebe6f5;border-radius:16px;overflow:hidden}' +
    '#cfp .p-row{display:flex;align-items:center;gap:12px;width:100%;background:#fff;border:0;border-bottom:1px solid #f1eef7;padding:13px 14px;cursor:pointer;font-family:inherit;text-align:left;color:inherit}#cfp .p-row:last-child{border-bottom:0}' +
    '#cfp .p-row .ic{font-size:21px;width:28px;text-align:center;flex:none}#cfp .p-row .mid{flex:1;min-width:0}#cfp .p-row .nm{font-size:15px;font-weight:800}#cfp .p-row .sub{display:block;font-size:12px;color:#8a83a0;margin-top:2px;line-height:1.45}' +
    '#cfp .tag{flex:none;font-size:10.5px;font-weight:800;border-radius:7px;padding:2px 7px;background:#efeaf9;color:#5b21b6}#cfp .tag.g{background:#ecfdf3;color:#067647}#cfp .tag.o{background:#f4f4f5;color:#71717a}' +
    '#cfp .p-card{background:#fff;border:1px solid #ebe6f5;border-radius:16px;padding:14px;margin-bottom:12px}' +
    '#cfp .p-lb{font-size:12.5px;font-weight:800;color:#4a4460;margin:10px 2px 5px}#cfp .p-lb:first-child{margin-top:0}' +
    '#cfp input.p-in,#cfp textarea.p-in{width:100%;border:1px solid #ddd6ec;border-radius:12px;padding:11px 12px;font-size:15px;background:#fff;color:#1c1830;font-family:inherit;box-sizing:border-box}#cfp textarea.p-in{min-height:96px;resize:vertical;line-height:1.55}' +
    '#cfp .p-chips{display:flex;flex-wrap:wrap;gap:6px}#cfp .p-chips button{flex:1;min-width:72px;border:1.5px solid #e6e1f2;background:#fff;border-radius:10px;padding:9px 6px;font-size:12.5px;font-weight:800;color:#6b6385;cursor:pointer;font-family:inherit}#cfp .p-chips button.on{border-color:#6d28d9;background:#f5f3ff;color:#5b21b6}' +
    '#cfp .p-btn{width:100%;border:0;border-radius:12px;padding:13px 14px;background:#6d28d9;color:#fff;font-weight:800;font-size:15px;cursor:pointer;margin-top:12px;font-family:inherit}#cfp .p-btn.g{background:#efeaf9;color:#5b21b6;margin-top:8px}#cfp .p-btn:disabled{opacity:.55}' +
    '#cfp .p-two{display:flex;gap:8px}#cfp .p-two .p-btn{margin-top:10px}' +
    '#cfp .p-out{margin-top:12px}#cfp .p-res{background:#fff;border:1.5px solid #e5dcfb;border-radius:14px;padding:13px;font-size:14px;line-height:1.75;white-space:pre-wrap;word-break:break-word}' +
    '#cfp .p-res h4{margin:0 0 6px;font-size:13px;color:#6d28d9}#cfp .p-mut{font-size:12px;color:#8a83a0;line-height:1.6}' +
    '#cfp .p-err{background:#fff1f1;color:#b42318;border-radius:12px;padding:10px 12px;font-size:13px;margin-top:10px;line-height:1.55}#cfp .p-ok{background:#ecfdf3;color:#067647;border-radius:12px;padding:10px 12px;font-size:13px;margin-top:10px}' +
    '#cfp .p-wait{color:#6d28d9;font-size:13px;font-weight:700;margin-top:10px}' +
    '#cfp .p-src a{display:block;font-size:12.5px;color:#4338ca;text-decoration:none;padding:5px 0;border-top:1px solid #f1eef7;word-break:break-all}' +
    '#cfp .paper{overflow:auto;border:1px solid #e6e6e6;border-radius:12px;background:#fff}#cfp details summary{cursor:pointer;font-size:13px;font-weight:800;color:#4a4460}' +
    '#cfp .t-chat{display:flex;flex-direction:column;gap:8px;padding-bottom:6px}#cfp .t-m{max-width:84%;padding:10px 13px;border-radius:15px;font-size:15px;line-height:1.6;white-space:pre-wrap;word-break:break-word}' +
    '#cfp .t-m.me{align-self:flex-end;background:#6d28d9;color:#fff;border-bottom-right-radius:4px}#cfp .t-m.ai{align-self:flex-start;background:#fff;border:1px solid #ebe6f5;border-bottom-left-radius:4px}' +
    '#cfp .t-m .t-tools{display:flex;gap:6px;margin-top:6px;white-space:normal}#cfp .t-m .t-tools button{border:0;background:#f3f0fa;color:#5b21b6;border-radius:8px;padding:4px 9px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit}' +
    '#cfp.big .t-m{font-size:19px;line-height:1.7}#cfp .t-send{flex:none;display:flex;gap:8px;align-items:flex-end;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));background:#fff;border-top:1px solid #ece8f5}' +
    '#cfp .t-send textarea{flex:1;min-height:46px;max-height:130px;resize:none;border:1px solid #ddd6ec;border-radius:12px;padding:11px 12px;font-size:15px;font-family:inherit;box-sizing:border-box}#cfp.big .t-send textarea{font-size:18px}' +
    '#cfp .t-mic{width:50px;height:46px;border:0;border-radius:12px;background:#efeaf9;font-size:21px;cursor:pointer}#cfp .t-mic.on{background:#ef4444;color:#fff}#cfp .t-go{border:0;border-radius:12px;height:46px;padding:0 16px;background:#6d28d9;color:#fff;font-weight:800;font-size:15px;cursor:pointer}' +
    'body.cfp-lock{overflow:hidden}';
  document.head.appendChild(css);
  var ov = document.createElement('div'); ov.id = 'cfp'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
  ov.innerHTML = '<div class="p-bar"><button type="button" class="p-back" data-a="back" hidden>←</button><b id="cfp-title">🍇 포도야 비서</b><button type="button" class="p-x" data-a="close">✕ 닫기</button></div><div class="p-body" id="cfp-body"></div><div id="cfp-foot"></div>';
  document.body.appendChild(ov);
  var $ = function (id) { return document.getElementById(id); };
  var S = { home: 'assist', view: 'assist', tone: '정중', kind: 'quote', busy: false, last: null };

  /* ── 로그인 토큰 · 서버 (통역톡과 같은 방식) ── */
  function token() {
    try { var c = window.__cfSbClient; if (c && c.auth && c.auth.getSession) return c.auth.getSession().then(function (r) { var s = r && r.data && r.data.session; return s ? s.access_token : null; }); } catch (e) {}
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('sb-') === 0 && k.indexOf('-auth-token') > 0) { var v = JSON.parse(localStorage.getItem(k) || 'null'); if (v && v.access_token) return Promise.resolve(v.access_token); } } } catch (e) {}
    return Promise.resolve(null);
  }
  function api(body, path) {
    return token().then(function (t) {
      if (!t) { var e = new Error('login'); e.login = true; throw e; }
      return fetch(path || '/api/podoya', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || ('오류 ' + r.status)); e.status = r.status; e.login = r.status === 401; throw e; } return j; }); });
    });
  }
  function openLogin() {
    close();
    var els = document.querySelectorAll('button,a');
    for (var i = 0; i < els.length; i++) { var t = (els[i].textContent || '').trim(); if (t === '로그인하기' || t === '로그인') { els[i].click(); return; } }
  }
  function errBox(e) {
    if (e && e.login) return '<div class="p-err">로그인이 필요해요. <button type="button" class="p-btn" data-a="login" style="width:auto;margin:0 0 0 6px;padding:7px 12px;font-size:13px">로그인하기</button></div>';
    var m = esc((e && e.message) || e);
    if (e && e.status === 402) m += ' <a href="/pricing#charge" style="font-weight:800;color:#6d28d9">충전하기</a>';
    return '<div class="p-err">' + m + '</div>';
  }
  function copy(text, msgEl) {
    var ok = function () { if (msgEl) msgEl.innerHTML = '<div class="p-ok">✅ 복사했어요</div>'; };
    try { navigator.clipboard.writeText(text).then(ok, function () { fallback(); }); } catch (e) { fallback(); }
    function fallback() { try { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); ok(); } catch (x) {} }
  }
  function share(text, title, msgEl) {
    if (navigator.share) { navigator.share({ title: title || 'coverfo', text: text }).then(function () {}, function () {}); return; }
    copy(text, msgEl);
  }

  /* ── 화면 ── */
  function row(a, ic, nm, sub, tag, tagCls) {
    return '<button type="button" class="p-row" data-a="' + a + '"><span class="ic">' + ic + '</span><span class="mid"><span class="nm">' + nm + '</span><span class="sub">' + sub + '</span></span>' + (tag ? '<span class="tag ' + (tagCls || '') + '">' + tag + '</span>' : '') + '<span style="color:#c9c3d8;font-size:18px">›</span></button>';
  }
  function render() {
    $('cfp-title').textContent = S.view === 'talk' ? TALKS[S.persona].t : S.view === 'tool' ? TU[S.tool].t : (TITLE[S.view] || '🍇 포도야 비서');
    $('cfp-foot').innerHTML = ''; try { speechSynthesis.cancel(); } catch (e) {}
    if (S.view !== 'talk') ov.classList.remove('big');
    ov.querySelector('[data-a="back"]').hidden = (S.view === S.home);
    var b = $('cfp-body'); b.scrollTop = 0;
    if (S.view === 'assist') return assistView(b);
    if (S.view === 'adv') return advView(b);
    if (S.view === 'feat') return featView(b);
    if (S.view === 'talk') return talkView(b);
    if (S.view === 'tool') return S.tool === 'ledger' ? ledgerView(b) : toolUI(b);
    if (S.view === 'routine') return routineView(b);
    if (S.view === 'notify') return notifyView(b);
    if (S.view === 'blocks') return blocksView(b);
    if (S.view === 'safety') return safetyView(b);
    if (S.view === 'calls') return callsView(b);
    return toolView(b, S.view);
  }
  function assistView(b) {
    b.innerHTML = '<div class="p-lead">🍇 <b>coverfo 크레딧으로 바로</b> 시킬 수 있어요. 키를 넣을 필요 없어요.<br>발송·환불처럼 되돌릴 수 없는 일은 실행 전에 항상 확인해요.</div>' +
      '<div class="p-sec">일 시키기</div><div class="p-list">' +
      row('go-chat', '💬', '대화로 시키기', '홈 입력칸에 적고 「무엇이든 물어보기」', 'coverfo') +
      row('go-agent', '🤖', '에이전트팀으로 실행', '홈 입력칸 「무엇이든 시켜만 주세요」에 적어서 여러 단계로', 'coverfo') +
      row('t-intl', '🌍', '해외 응대', '받은 메일 번역 + 그 나라 말로 답장', COST.intl + '크레딧') +
      row('t-doc', '📄', '문서 만들기', '견적서·거래명세서·INVOICE 를 PDF로', COST.doc + '크레딧') +
      row('t-work', '📊', '업무 자동화', '말만 하면 엑셀·데이터를 정리해요', COST.work + '크레딧') +
      row('t-launch', '🎨', '상품 시작하기', '이름·설명·가격 + 디자인 3장', COST.launch + '크레딧~') +
      row('pt-routine', '📁', '루틴', '저장한 것 · 추천 루틴 담기', '포도톡', 'o') +
      row('pt-report', '📊', '매일 리포트', '아침에 매출·트래픽을 한 장으로', '포도톡', 'o') +
      row('pt-report', '🔔', '아침 알림', '정해진 시각에 깨워줘요', '포도톡', 'o') +
      '</div><div class="p-sec">비서에게 알려주기</div><div class="p-list">' +
      row('t-me', '🧠', '내 기억', '상호·말투·거래처를 기억해서 답에 반영', '무료', 'g') +
      row('go-hub', '🔗', '커넥션 허브', 'Gmail·슬랙·노션 등 외부앱 연결 (허브 2.0)', 'coverfo') +
      row('pt-home', '🏠', '집안 기기', '불·플러그·에어컨을 말로', '포도톡', 'o') +
      row('pt-deliver', '📮', '발송 채널', '결과를 어디로 받을지 (포도톡·텔레그램)', '포도톡', 'o') +
      '</div><div class="p-sec">알리기</div><div class="p-list">' +
      row('go-share', '📣', '친구에게 알리기', '카톡으로 coverfo 링크 보내기') +
      '</div><div class="p-mut" style="margin:14px 4px 0">「포도톡」 표시는 아직 포도톡 화면으로 열려요 (아래 탭 없이). 차례로 coverfo 로 옮겨요.</div>';
  }
  function advView(b) {
    b.innerHTML = '<div class="p-lead">🔌 웹을 읽고 찾아서 정리해 주는 기능이에요. <b>키를 넣을 필요 없이</b> coverfo 크레딧으로 바로 돌아가요.</div><div class="p-list">' +
      row('t-scrape', '🔍', '웹 스크래핑', '경쟁사 사이트·상품·리뷰 페이지를 읽어 요약', COST.scrape + '크레딧') +
      row('t-search', '🧠', '시맨틱 검색', '찾고 싶은 것을 말로 — 웹을 찾아 근거와 함께 정리', COST.search + '크레딧') +
      row('t-yt', '🎬', '유튜브 → 블로그', '영상 자막을 블로그 글로 변환', COST.yt + '크레딧') +
      row('t-research', '📊', '리서치 파이프라인', '검색 → 페이지 읽기 → 종합 → 보고서 초안', COST.research + '크레딧') +
      '</div>';
  }
  function runBtn(op, label) { return '<button type="button" class="p-btn" data-a="run" data-op="' + op + '">' + label + ' · ' + COST[op] + '크레딧</button><div class="p-out" id="cfp-out"></div>'; }
  function toolView(b, v) {
    var h = '';
    if (v === 'intl') {
      h = '<div class="p-lead">받은 메일을 그대로 붙여 넣으면 <b>무슨 말인지 알려 주고</b>, <b>그 나라 말로 답장</b>을 써 드려요. 상대 언어는 알아서 알아봐요.</div><div class="p-card">' +
        '<div class="p-lb">받은 메일 / 메시지</div><textarea class="p-in" id="cfp-a" placeholder="여기에 그대로 붙여 넣으세요 (영어·일본어·중국어… 아무거나)"></textarea>' +
        '<div class="p-lb">답장에 담을 내용 <span style="font-weight:600;color:#9a93ad">(한국어로 편하게)</span></div><textarea class="p-in" id="cfp-b" style="min-height:66px" placeholder="예: 재고 있고 다음 주 발송 가능. 100개 이상이면 10% 할인"></textarea>' +
        '<div class="p-lb">말투</div><div class="p-chips" data-g="tone">' + ['정중', '친근', '간결'].map(function (t) { return '<button type="button" data-a="tone" data-v="' + t + '" class="' + (S.tone === t ? 'on' : '') + '">' + t + '</button>'; }).join('') + '</div>' +
        runBtn('intl', '🌍 번역하고 답장 써 주기') + '</div>';
    } else if (v === 'doc') {
      var me = docMe();
      h = '<div class="p-lead">"대박상사에 사과 10박스 개당 3만원 견적" 처럼 적으면 표로 만들어 줘요. <b>PDF로 저장</b>하거나 <b>카톡으로 바로</b> 보낼 수 있어요.</div><div class="p-card">' +
        '<div class="p-lb">어떤 문서를 만들까요</div><div class="p-chips">' + DOC_KINDS.map(function (k) { return '<button type="button" data-a="kind" data-v="' + k[0] + '" class="' + (S.kind === k[0] ? 'on' : '') + '">' + k[1] + ' ' + k[2] + '</button>'; }).join('') + '</div>' +
        '<div class="p-lb">내용</div><textarea class="p-in" id="cfp-a" style="min-height:76px" placeholder="예: 대박상사에 사과 10박스 개당 3만원, 배송비 5천원"></textarea>' +
        runBtn('doc', '✨ 문서 만들기') +
        '<details style="margin-top:12px"><summary>🏢 내 사업자 정보 (문서에 찍혀요 · 이 폰에만 저장)</summary><div style="padding-top:8px">' +
        [['biz', '상호'], ['bizno', '사업자등록번호'], ['tel', '연락처'], ['addr', '주소']].map(function (f) { return '<div class="p-lb">' + f[1] + '</div><input class="p-in" data-me="' + f[0] + '" value="' + esc(me[f[0]] || '') + '">'; }).join('') +
        '<button type="button" class="p-btn g" data-a="saveme">저장</button><div id="cfp-me-msg"></div></div></details></div>';
    } else if (v === 'scrape') {
      h = '<div class="p-lead">페이지 주소를 넣으면 coverfo 가 대신 읽어서 <b>핵심만 요약</b>해 줘요. 로그인해야 보이는 페이지나 화면을 스크립트로 그리는 일부 사이트는 못 읽을 수 있어요.</div><div class="p-card">' +
        '<div class="p-lb">페이지 주소</div><input class="p-in" id="cfp-a" inputmode="url" placeholder="https://…">' +
        '<div class="p-lb">원하는 것 <span style="font-weight:600;color:#9a93ad">(선택)</span></div><input class="p-in" id="cfp-b" placeholder="예: 가격과 할인 조건만 뽑아줘">' +
        runBtn('scrape', '🔍 읽고 요약하기') + '</div>';
    } else if (v === 'search') {
      h = '<div class="p-lead">키워드가 아니라 <b>궁금한 것을 문장으로</b> 적으세요. 웹을 찾아 근거 링크와 함께 정리해 줘요.</div><div class="p-card">' +
        '<div class="p-lb">무엇을 찾을까요</div><input class="p-in" id="cfp-a" placeholder="예: 1인 카페 창업 최신 트렌드">' + runBtn('search', '🧠 찾아서 정리하기') + '</div>';
    } else if (v === 'yt') {
      h = '<div class="p-lead">유튜브 영상의 <b>자막</b>을 가져와 <b>블로그 글</b>로 바꿔 줘요. 자막을 못 가져오는 영상은 자막을 직접 붙여 넣어도 돼요 (크레딧은 그때만 빠져요).</div><div class="p-card">' +
        '<div class="p-lb">유튜브 주소</div><input class="p-in" id="cfp-a" inputmode="url" placeholder="https://www.youtube.com/watch?v=…">' +
        '<details style="margin-top:10px"><summary>자막 직접 붙여 넣기 (선택)</summary><textarea class="p-in" id="cfp-b" style="margin-top:8px" placeholder="유튜브 → 더보기 → 스크립트 표시 → 전체 복사"></textarea></details>' +
        runBtn('yt', '🎬 블로그 글 만들기') + '</div>';
    } else if (v === 'research') {
      h = '<div class="p-lead"><b>검색 → 페이지 읽기 → 종합 → 초안</b>까지 한 번에. 근거 번호가 붙은 보고서 초안을 만들어 줘요 (30초~1분 걸려요).</div><div class="p-card">' +
        '<div class="p-lb">주제</div><input class="p-in" id="cfp-a" placeholder="예: 2026년 무인카페 창업 시장 동향">' + runBtn('research', '📊 리서치 시작') + '</div>';
    } else if (v === 'work') {
      var PRE = [['📊 매출 정리', '올린 파일에서 월별 매출 합계를 내고, 막대그래프로 그려줘'], ['🏆 베스트셀러', '올린 파일에서 품목별 판매량과 매출을 집계해서 많이 팔린 순서대로 표로 보여줘'], ['🧾 부가세 계산', '올린 파일의 금액 합계, 부가세(10%), 공급가액을 계산해서 표로 정리해줘'], ['📦 발주 목록', '올린 파일에서 재고가 부족한 품목(수량 10 이하)을 찾아 발주 목록을 만들어줘'], ['🧹 데이터 정리', '올린 파일을 깔끔하게 정리(빈칸·중복 제거)하고 요약 통계를 보여줘']];
      h = '<div class="p-lead">엑셀·CSV 를 올리고 <b>하고 싶은 일을 말로</b> 적으면, AI 가 처리 방법(파이썬)을 만들고 <b>이 폰 안에서</b> 바로 돌려 결과를 보여 줘요. 파일은 서버에 올라가지 않아요 (앞부분 몇 줄만 방법을 짜는 데 써요).<br>처음 한 번은 계산 도구(약 10MB)를 받느라 조금 걸려요.</div><div class="p-card">' +
        '<div class="p-lb">① 파일 <span style="font-weight:600;color:#9a93ad">(엑셀·CSV · 선택)</span></div>' +
        '<label style="display:block;border:1.5px dashed #d6cfe8;border-radius:12px;padding:14px;text-align:center;cursor:pointer;font-size:13.5px;color:#6b6385"><input type="file" id="cfp-file" accept=".csv,.xlsx,.xls,.txt,.json,.tsv" style="display:none"><span id="cfp-fname">📂 눌러서 파일 고르기 (없어도 돼요)</span></label>' +
        '<div class="p-lb">② 무엇을 하고 싶으세요?</div><div class="p-chips" style="margin-bottom:8px">' + PRE.map(function (x) { return '<button type="button" data-a="preset" data-p="' + esc(x[1]) + '">' + x[0] + '</button>'; }).join('') + '</div>' +
        '<textarea class="p-in" id="cfp-a" placeholder="예: 매출 엑셀에서 상위 5개 품목만 뽑아서 그래프로 그려줘"></textarea>' +
        runBtn('work', '⚙️ 자동으로 처리하기') + '</div>';
    } else if (v === 'launch') {
      h = '<div class="p-lead">팔고 싶은 걸 말해 보세요. <b>이름·설명·가격·인스타 글</b>을 잡아 주고, 원하면 <b>디자인 3장</b>도 그려 드려요 (한 장 ' + COST.img + '크레딧).</div><div class="p-card">' +
        '<div class="p-lb">무엇을 팔고 싶으세요?</div><textarea class="p-in" id="cfp-a" style="min-height:70px" placeholder="예: 강아지 그림 티셔츠 / 수제 원두 드립백 / 캘리그라피 엽서"></textarea>' +
        runBtn('launch', '✨ 상품으로 만들기') + '</div>';
    } else if (v === 'me') {
      h = '<div class="p-lead">🧠 여기 적어 두면 매번 설명하지 않아도 돼요. <b>해외 응대 · 문서 만들기 · 상품 시작하기</b> 답에 반영돼요.<br>coverfo 계정에 저장돼서 다른 폰에서도 같아요 · 무료 · 탈퇴하면 함께 지워져요.</div><div id="cfp-mebox"><div class="p-wait">불러오는 중…</div></div>';
      b.innerHTML = h; return meLoad();
    }
    b.innerHTML = h;
  }

  /* ── 실행 ── */
  function val(id) { var e = $(id); return e ? String(e.value || '').trim() : ''; }
  function run(op, btn) {
    if (S.busy) return;
    if (op === 'work') return runWork(btn);
    var body = { op: op };
    if (op === 'intl') { body.text = val('cfp-a'); body.my = val('cfp-b'); body.tone = S.tone; if (!body.text) return say('받은 메일을 붙여 넣어 주세요'); }
    if (op === 'doc') { body.text = val('cfp-a'); body.kind = S.kind; if (!body.text) return say('무엇을 만들지 적어 주세요'); }
    if (op === 'scrape') { body.url = val('cfp-a'); body.ask = val('cfp-b'); if (!body.url) return say('페이지 주소를 넣어 주세요'); }
    if (op === 'search' || op === 'research') { body.q = val('cfp-a'); if (body.q.length < 2) return say('찾을 내용을 적어 주세요'); }
    if (op === 'yt') { body.url = val('cfp-a'); body.transcript = val('cfp-b'); if (!body.url && !body.transcript) return say('유튜브 주소를 넣어 주세요'); }
    if (op === 'launch') { body.q = val('cfp-a'); if (!body.q) return say('뭘 팔고 싶은지 적어 주세요'); }
    S.busy = true; btn.disabled = true;
    var out = $('cfp-out'); out.innerHTML = '<div class="p-wait">⏳ ' + (op === 'research' ? '찾아서 읽는 중… (30초~1분)' : op === 'yt' ? '자막을 가져와 글을 쓰는 중…' : '만드는 중…') + '</div>';
    api(body).then(function (j) { S.busy = false; btn.disabled = false; S.last = j; show(op, j); },
      function (e) { S.busy = false; btn.disabled = false; out.innerHTML = errBox(e); });
  }
  function say(m) { var o = $('cfp-out'); if (o) o.innerHTML = '<div class="p-err">' + esc(m) + '</div>'; }
  function srcList(list) {
    if (!list || !list.length) return '';
    return '<div class="p-res p-src" style="margin-top:10px;white-space:normal"><h4>근거 링크</h4>' + list.map(function (s, i) { return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">[' + (i + 1) + '] ' + esc(s.title || s.url) + '</a>'; }).join('') + '</div>';
  }
  function tools(kind) {
    return '<div class="p-two"><button type="button" class="p-btn" data-a="copy" data-k="' + kind + '">📋 복사</button><button type="button" class="p-btn g" data-a="share" data-k="' + kind + '" style="margin-top:10px">💬 공유</button></div><div id="cfp-msg"></div>';
  }
  function show(op, j) {
    var o = $('cfp-out'), paid = '<div class="p-mut" style="margin-top:8px">💳 ' + j.cost + '크레딧 사용</div>';
    if (op === 'intl') {
      o.innerHTML = '<div class="p-res" style="white-space:normal;background:#faf9fc;border-color:#ece8f5"><h4>📩 무슨 말이냐면 <span class="tag">' + esc(j.lang) + '</span></h4><div style="white-space:pre-wrap">' + esc(j.summary) + '</div>' +
        (j.points && j.points.length ? '<div style="margin-top:8px;font-size:13px">' + j.points.map(function (p) { return '▪ ' + esc(p); }).join('<br>') + '</div>' : '') + '</div>' +
        '<div class="p-res" style="margin-top:10px"><h4>✍️ 이렇게 답장하면 돼요 (' + esc(j.lang) + ')</h4>' + esc(j.reply) + '</div>' +
        '<details style="margin-top:8px"><summary>한국어로 확인하기</summary><div class="p-mut" style="white-space:pre-wrap;margin-top:6px">' + esc(j.replyKo) + '</div></details>' +
        tools('reply') + '<button type="button" class="p-btn g" data-a="intl2doc">🌍 INVOICE 같이 만들기</button>' +
        '<div class="p-mut" style="margin-top:8px">⚠️ 보내기 전에 <b>가격·납기</b>는 꼭 직접 확인하세요.</div>' + paid;
    } else if (op === 'doc') {
      o.innerHTML = '<div class="paper">' + paper(j) + '</div><div class="p-two"><button type="button" class="p-btn" data-a="print">📄 PDF로 저장</button><button type="button" class="p-btn g" data-a="share" data-k="doc" style="margin-top:10px">💬 공유</button></div><div id="cfp-msg"></div>' +
        '<div class="p-mut" style="margin-top:8px">📄 PDF로 저장을 누르면 인쇄 화면이 떠요 → 프린터를 <b>"PDF로 저장"</b>으로 바꾸면 파일이 만들어져요.</div>' + paid;
    } else if (op === 'scrape') {
      o.innerHTML = '<div class="p-res"><h4>' + esc(j.title || '요약') + '</h4>' + esc(j.summary) + '</div>' + tools('summary') + paid;
    } else if (op === 'search') {
      o.innerHTML = '<div class="p-res">' + esc(j.answer) + '</div>' + srcList(j.sources) + tools('answer') + paid;
    } else if (op === 'yt') {
      o.innerHTML = '<div class="p-res">' + esc(j.blog) + '</div>' + tools('blog') + paid;
    } else if (op === 'research') {
      o.innerHTML = '<div class="p-res">' + esc(j.report) + '</div>' + srcList(j.sources) + tools('report') + paid;
    } else if (op === 'launch') {
      var hash = (j.hash || []).map(function (x) { return '#' + x; }).join(' ');
      o.innerHTML = '<div class="p-res" style="white-space:normal"><div style="font-size:17px;font-weight:900">' + esc(j.name) + '</div><div style="color:#6d28d9;font-weight:700;font-size:13px">' + esc(j.tag) + '</div>' +
        '<div style="white-space:pre-wrap;margin-top:8px;font-size:13.5px">' + esc(j.desc) + '</div>' +
        '<div style="margin-top:10px;padding-top:10px;border-top:1px solid #f1eef7"><b style="font-size:20px">' + won(j.price) + '원</b> <span class="p-mut">' + esc(j.priceWhy) + '</span></div>' +
        (j.target ? '<div class="p-mut">🎯 ' + esc(j.target) + '</div>' : '') + '</div>' +
        '<div class="p-lb" style="margin-top:14px">🎨 디자인</div><div id="cfp-imgs" style="display:flex;gap:7px"></div>' +
        (j.imgs && j.imgs.length ? '<button type="button" class="p-btn g" data-a="imgs" id="cfp-imgbtn">🎨 디자인 ' + j.imgs.length + '장 만들기 · ' + (COST.img * j.imgs.length) + '크레딧</button>' : '<div class="p-mut">이미지 아이디어가 없어요</div>') +
        '<div class="p-lb" style="margin-top:14px">📸 인스타에 올릴 글</div><div class="p-res" style="background:#faf9fc;border-color:#ece8f5;font-size:13px">' + esc(j.insta) + '\n\n' + esc(hash) + '</div>' +
        '<div class="p-two"><button type="button" class="p-btn" data-a="share" data-k="insta">📸 인스타 글 보내기</button><button type="button" class="p-btn g" data-a="copy" data-k="prod" style="margin-top:10px">📋 상품 정보 복사</button></div>' +
        '<button type="button" class="p-btn g" data-a="pododa">🍇 포도다에서 팔기</button><div id="cfp-msg"></div>' +
        '<div class="p-mut" style="margin-top:8px">⚠️ 가격·원가는 꼭 직접 확인하세요.</div>' + paid;
    }
  }

  /* 🎨 상품 디자인: 한 장씩 따로 그려 받는다 (한 장 실패해도 나머지는 그대로 · 실패한 장은 크레딧을 돌려받음) */
  function makeImgs(btn) {
    var j = S.last; if (!j || !j.imgs || !j.imgs.length || S.imgBusy) return;
    S.imgBusy = true; btn.disabled = true; btn.textContent = '⏳ 그리는 중… (1분쯤 걸려요)';
    var box = $('cfp-imgs'); var left = j.imgs.length, okN = 0;
    box.innerHTML = j.imgs.map(function (p, i) { return '<div style="flex:1;min-width:0" id="cfp-im' + i + '"><div style="aspect-ratio:1;border-radius:10px;background:#f1eef7;display:flex;align-items:center;justify-content:center;font-size:12px;color:#8a83a0">⏳</div></div>'; }).join('');
    j.imgs.forEach(function (p, i) {
      api({ op: 'img', prompt: p }).then(function (r) {
        okN++;
        $('cfp-im' + i).innerHTML = '<img src="' + r.img + '" alt="" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;border:1px solid #eee"><a href="' + r.img + '" download="coverfo-design-' + (i + 1) + '.png" class="p-btn g" style="display:block;text-align:center;text-decoration:none;font-size:12px;padding:7px;margin-top:5px">저장</a>';
      }, function (e) {
        $('cfp-im' + i).innerHTML = '<div class="p-err" style="font-size:11.5px;margin:0">' + esc((e && e.message) || '실패') + '</div>';
      }).then(function () {
        if (--left) return;
        S.imgBusy = false; btn.disabled = false; btn.textContent = okN ? '🎨 다시 그리기 · ' + (COST.img * j.imgs.length) + '크레딧' : '🎨 다시 시도';
        if (okN) $('cfp-msg').innerHTML = '<div class="p-mut" style="margin-top:6px">💳 ' + (COST.img * okN) + '크레딧 사용 · 그림을 길게 누르거나 [저장]을 누르세요</div>';
      });
    });
  }

  /* 📊 업무 자동화: 파일은 폰에만 · 파이썬은 따로 떨어진 작업 칸(Web Worker)에서 돌린다 → 이 페이지의 로그인 정보에 손댈 수 없다 */
  var PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
  var XLSX_JS = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  var W = { file: null, worker: null };
  function loadScript(src) { return new Promise(function (ok, no) { var x = document.createElement('script'); x.src = src; x.onload = ok; x.onerror = function () { no(new Error('도구를 받지 못했어요')); }; document.head.appendChild(x); }); }
  function pickFile(inp) {
    var f = inp.files && inp.files[0]; W.file = null; if (!f) return;
    var lb = $('cfp-fname');
    if (f.size > 5 * 1024 * 1024) { lb.textContent = '⚠️ 5MB 이하 파일만 돼요'; return; }
    lb.textContent = '⏳ ' + f.name + ' 읽는 중…';
    var done = function (text) { W.file = { name: f.name, text: text }; lb.textContent = '📄 ' + f.name + ' (' + Math.max(1, Math.round(f.size / 1024)) + 'KB)'; };
    var fail = function (e) { lb.textContent = '⚠️ 파일을 읽지 못했어요: ' + ((e && e.message) || e); };
    var rd = new FileReader();
    if (/\.(xlsx|xls)$/i.test(f.name)) {
      rd.onload = function () {
        (window.XLSX ? Promise.resolve() : loadScript(XLSX_JS)).then(function () {
          var wb = window.XLSX.read(new Uint8Array(rd.result), { type: 'array' });
          done(window.XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]));
        }).catch(fail);
      };
      rd.readAsArrayBuffer(f);
    } else { rd.onload = function () { done(String(rd.result || '')); }; rd.readAsText(f, 'utf-8'); }
  }
  function pyWorker() {
    if (W.worker) return W.worker;
    var src = "importScripts('" + PYODIDE + "pyodide.js');var py=null;" +
      "onmessage=async function(e){try{if(!py){postMessage({st:'계산 도구 준비 중… (처음 한 번 · 10~30초)'});py=await loadPyodide({indexURL:'" + PYODIDE + "'});}" +
      "postMessage({st:'⚙️ 실행 중…'});py.globals.set('DATA',e.data.data||'');py.runPython('import sys, io\\n_out=io.StringIO()\\nsys.stdout=_out');var err='';" +
      "try{await py.runPythonAsync(e.data.code);}catch(x){err=String(x&&x.message||x);}" +
      "var out=py.runPython('sys.stdout=sys.__stdout__\\n_out.getvalue()');postMessage({done:1,out:String(out||''),err:err});}catch(x){postMessage({done:1,out:'',err:String(x&&x.message||x),boot:1});}};";
    W.worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    return W.worker;
  }
  function pyRun(code, data, status) {
    return new Promise(function (ok) {
      var w = pyWorker(), t = setTimeout(function () { try { w.terminate(); } catch (e) {} W.worker = null; ok({ out: '', err: '시간이 너무 오래 걸려 멈췄어요 (2분)' }); }, 120000);
      w.onmessage = function (e) { var m = e.data || {}; if (m.st) { status(m.st); return; } if (m.done) { clearTimeout(t); if (m.boot) { try { w.terminate(); } catch (x) {} W.worker = null; } ok(m); } };
      w.onerror = function (e) { clearTimeout(t); try { w.terminate(); } catch (x) {} W.worker = null; ok({ out: '', err: '계산 도구를 받지 못했어요 (인터넷을 확인해 주세요)', boot: 1 }); };
      w.postMessage({ code: code, data: data });
    });
  }
  function runWork(btn) {
    var ask = val('cfp-a'); if (!ask) return say('무엇을 하고 싶은지 적어 주세요');
    var f = W.file, out = $('cfp-out');
    var st = function (m) { out.innerHTML = '<div class="p-wait">' + esc(m) + '</div>'; };
    var body = { op: 'work', ask: ask, preview: f ? f.text.slice(0, 1200) : '', fname: f ? f.name : '' };
    S.busy = true; btn.disabled = true; st('🧠 AI 가 처리 방법을 만드는 중…');
    var finish = function () { S.busy = false; btn.disabled = false; };
    api(body).then(function (j) {
      var cost = j.cost;
      return pyRun(j.code, f ? f.text : '', st).then(function (r) {
        if (!r.err || r.boot) return { j: j, r: r, cost: cost };
        st('🔧 오류가 나서 한 번 고치는 중… (추가 크레딧 없음)');
        return api({ op: 'work', ask: ask, preview: body.preview, fname: body.fname, fix: { code: j.code, error: r.err.slice(-1200) }, t: j.t }).then(function (j2) {
          return pyRun(j2.code, f ? f.text : '', st).then(function (r2) { return { j: j2, r: r2, cost: cost }; });
        }, function () { return { j: j, r: r, cost: cost }; });
      });
    }).then(function (x) {
      finish(); S.last = { result: x.r.out, code: x.j.code };
      out.innerHTML = (x.r.err ? '<div class="p-err">실행 오류: ' + esc(x.r.err.slice(-600)) + '<br>요청을 조금 바꿔 다시 시도해 보세요.</div>' : '') +
        (x.r.out ? '<div class="p-res" style="font-family:ui-monospace,Menlo,monospace;font-size:12.5px;line-height:1.55;overflow:auto;white-space:pre">' + esc(x.r.out) + '</div>' + tools('result') : (x.r.err ? '' : '<div class="p-mut">출력이 없어요</div>')) +
        '<details style="margin-top:10px"><summary>🔧 실행한 코드 보기</summary><pre style="font-size:11.5px;background:#faf9fc;border:1px solid #ece8f5;border-radius:10px;padding:10px;overflow:auto;margin-top:6px">' + esc(x.j.code) + '</pre></details>' +
        '<div class="p-mut" style="margin-top:8px">💳 ' + x.cost + '크레딧 사용</div>';
    }, function (e) { finish(); out.innerHTML = errBox(e); });
  }

  /* 🧠 내 기억 */
  var ME_F = [['name', '내 이름 / 호칭', '예: 이병주 · 사장님'], ['biz', '상호 (사업체명)', '예: 포도상회'], ['job', '하는 일 / 업종', '예: 온라인 농산물 판매'], ['tone', '메시지 말투', '예: 정중하고 짧게 · 이모지 조금'], ['hours', '영업 / 근무시간', '예: 평일 9시~18시, 주말 휴무'], ['note', '기타', '예: 견적은 항상 부가세 별도로 표기']];
  function meLoad() {
    api({ op: 'me_get' }).then(function (j) { S.me = j.me || {}; meDraw(); }, function (e) { var b = $('cfp-mebox'); if (b) b.innerHTML = errBox(e); });
  }
  function meDraw(msg) {
    var m = S.me || {}, facts = Array.isArray(m.facts) ? m.facts : [], b = $('cfp-mebox'); if (!b) return;
    b.innerHTML = '<div class="p-card">' + ME_F.map(function (f) {
      return '<div class="p-lb">' + f[1] + '</div>' + (f[0] === 'note' ? '<textarea class="p-in" style="min-height:60px" data-mek="' + f[0] + '" placeholder="' + esc(f[2]) + '">' + esc(m[f[0]] || '') + '</textarea>' : '<input class="p-in" data-mek="' + f[0] + '" placeholder="' + esc(f[2]) + '" value="' + esc(m[f[0]] || '') + '">');
    }).join('') + '<button type="button" class="p-btn" data-a="mesave">💾 저장</button></div>' +
      '<div class="p-card"><div class="p-lb">기억해 둔 사실 <span style="color:#9a93ad">(' + facts.length + '/40)</span></div>' +
      (facts.length ? facts.map(function (f, i) { return '<div style="display:flex;gap:8px;align-items:flex-start;padding:8px 0;border-top:1px solid #f1eef7"><span style="flex:1;font-size:13.5px;line-height:1.5;word-break:break-word">• ' + esc(f) + '</span><button type="button" data-a="medel" data-i="' + i + '" style="border:0;background:none;color:#b9b2c9;font-size:18px;cursor:pointer">×</button></div>'; }).join('') : '<div class="p-mut">아직 없어요. 아래에 한 줄씩 적어 주세요.</div>') +
      '<div style="display:flex;gap:7px;margin-top:10px"><input class="p-in" id="cfp-fact" maxlength="200" placeholder="예: 거래처 ○○상사 담당은 김대리"><button type="button" class="p-btn" data-a="meadd" style="width:auto;margin:0;padding:0 16px">＋</button></div></div>' +
      '<button type="button" class="p-btn g" data-a="meclear" style="color:#b42318">기억 전체 지우기</button>' + (msg || '');
  }
  function meCollect() { var m = S.me || {}; Array.prototype.forEach.call(ov.querySelectorAll('[data-mek]'), function (x) { m[x.getAttribute('data-mek')] = x.value.trim(); }); return m; }
  function meSave(m, note) {
    api({ op: 'me_save', data: m }).then(function (j) { S.me = j.me; meDraw('<div class="p-ok">' + note + '</div>'); }, function (e) { var b = $('cfp-mebox'); if (b) b.insertAdjacentHTML('beforeend', errBox(e)); });
  }

  /* 📄 문서 (ai.html 과 같은 모양) */
  function prodText(d) { return (d.name || '') + '\n' + (d.tag || '') + '\n\n' + (d.desc || '') + '\n\n가격: ' + won(d.price) + '원' + (d.priceWhy ? ' (' + d.priceWhy + ')' : ''); }
  function docMe() { try { var m = JSON.parse(ls.get('cfp_docme', '{}')); return m && typeof m === 'object' ? m : {}; } catch (e) { return {}; } }
  function won(n) { return (Number(n) || 0).toLocaleString('ko-KR'); }
  function today() { var d = new Date(); return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.'; }
  function paper(d) {
    var me = docMe(), sum = 0, EN = d.kind === 'inv', CUR = d.cur || 'USD';
    var L = EN ? { item: 'Description', qty: 'Qty', price: 'Unit Price', amt: 'Amount', to: 'BILL TO', from: 'FROM', sub: 'Subtotal', tot: 'TOTAL', note: 'Notes' }
      : { item: '품명', qty: '수량', price: '단가', amt: '금액', to: '', from: '공급자', sub: '공급가액', tot: '합계', note: '비고' };
    var td = 'padding:7px 8px;border:1px solid #ddd';
    var rows = d.items.map(function (it, i) {
      var q = Number(it.qty) || 1, p = Number(it.price) || 0, amt = q * p; sum += amt;
      return '<tr><td style="' + td + ';text-align:center">' + (i + 1) + '</td><td style="' + td + '">' + esc(it.name) + '</td><td style="' + td + ';text-align:center">' + q + (it.unit ? ' ' + esc(it.unit) : '') + '</td><td style="' + td + ';text-align:right">' + won(p) + '</td><td style="' + td + ';text-align:right">' + won(amt) + '</td></tr>';
    }).join('');
    var vat = EN ? 0 : Math.round(sum * 0.1);
    return '<div style="font-family:inherit;color:#111;background:#fff;padding:14px">' +
      '<div style="text-align:center;font-size:22px;font-weight:900;letter-spacing:' + (EN ? '3px' : '6px') + ';margin-bottom:14px">' + esc(EN ? 'INVOICE' : d.kn) + '</div>' +
      '<table style="width:100%;font-size:12px;margin-bottom:10px"><tr><td style="vertical-align:top;width:50%">' + (EN ? '<div style="font-size:10px;color:#888">' + L.to + '</div>' : '') +
      '<div style="font-weight:800">' + esc(d.to || '') + (d.to && !EN ? ' 귀중' : '') + '</div><div style="color:#666">' + today() + '</div></td>' +
      '<td style="vertical-align:top;border:1px solid #ddd;padding:7px 9px"><div style="font-size:10px;color:#888">' + L.from + '</div>' +
      (me.biz ? '<div style="font-weight:800">' + esc(me.biz) + '</div>' : '') + (me.bizno ? '<div>' + esc(me.bizno) + '</div>' : '') + (me.addr ? '<div>' + esc(me.addr) + '</div>' : '') + (me.tel ? '<div>' + esc(me.tel) + '</div>' : '') +
      (!me.biz && !me.bizno && !me.tel && !me.addr ? '<div style="color:#bbb">내 사업자 정보를 넣어 주세요</div>' : '') + '</td></tr></table>' +
      '<div style="border:2px solid #111;padding:9px;text-align:center;font-size:14px;font-weight:900;margin-bottom:10px">' + (EN ? 'TOTAL &nbsp; ' + esc(CUR) + ' ' + won(sum) : '합계 금액 (부가세 포함) &nbsp; ₩ ' + won(sum + vat)) + '</div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f3f3f3"><th style="' + td + ';width:34px">No</th><th style="' + td + '">' + L.item + '</th><th style="' + td + ';width:70px">' + L.qty + '</th><th style="' + td + ';width:82px">' + L.price + '</th><th style="' + td + ';width:88px">' + L.amt + '</th></tr></thead><tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td colspan="4" style="' + td + ';text-align:right">' + L.sub + '</td><td style="' + td + ';text-align:right">' + won(sum) + '</td></tr>' +
      (EN ? '' : '<tr><td colspan="4" style="' + td + ';text-align:right">부가세 (10%)</td><td style="' + td + ';text-align:right">' + won(vat) + '</td></tr>') +
      '<tr style="background:#f3f3f3;font-weight:900"><td colspan="4" style="' + td + ';text-align:right">' + L.tot + '</td><td style="' + td + ';text-align:right">' + (EN ? esc(CUR) + ' ' + won(sum) : won(sum + vat)) + '</td></tr></tfoot></table>' +
      (d.note ? '<div style="font-size:11.5px;color:#555;margin-top:10px">' + L.note + ': ' + esc(d.note) + '</div>' : '') + '</div>';
  }
  function docText(d) {
    var me = docMe(), sum = 0, EN = d.kind === 'inv', CUR = d.cur || 'USD';
    var lines = d.items.map(function (it) {
      var q = Number(it.qty) || 1, p = Number(it.price) || 0; sum += q * p;
      return EN ? '· ' + it.name + ' ' + q + (it.unit ? ' ' + it.unit : '') + ' x ' + CUR + ' ' + won(p) + ' = ' + CUR + ' ' + won(q * p) : '· ' + it.name + ' ' + q + (it.unit || '') + ' × ' + won(p) + '원 = ' + won(q * p) + '원';
    });
    if (EN) return 'INVOICE  ' + today() + (d.to ? '\nBill to: ' + d.to : '') + '\n\n' + lines.join('\n') + '\n\nTOTAL ' + CUR + ' ' + won(sum) + (d.note ? '\n\nNotes: ' + d.note : '') + (me.biz ? '\n\n— ' + me.biz + (me.tel ? ' · ' + me.tel : '') : '');
    var vat = Math.round(sum * 0.1);
    return '[' + d.kn + '] ' + today() + (d.to ? '\n받는 곳: ' + d.to : '') + '\n\n' + lines.join('\n') + '\n\n공급가액 ' + won(sum) + '원\n부가세 ' + won(vat) + '원\n합계 ' + won(sum + vat) + '원' + (d.note ? '\n\n비고: ' + d.note : '') + (me.biz ? '\n\n— ' + me.biz + (me.tel ? ' · ' + me.tel : '') : '');
  }
  function printDoc(d) {
    var html = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(d.kind === 'inv' ? 'INVOICE' : d.kn) + '</title><style>body{margin:0;font-family:-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}@page{margin:14mm}</style></head><body>' + paper(d) + '</body></html>';
    var f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(f);
    var w = f.contentWindow; w.document.open(); w.document.write(html); w.document.close();
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} setTimeout(function () { f.remove(); }, 60000); }, 250);
  }



  /* ══════════ v300 💬 대화형 4칸 (성격은 포도톡 ai.html 그대로 · 대화는 이 폰에만 · 답 1번 0.2크레딧) ══════════ */
  var TALKS = {
    companion: { t: '🤗 AI 컴패니언', lang: 'ko-KR', read: true, hi: '안녕! 나는 포도야 🍇 오늘 하루 어땠어? 편하게 아무 얘기나 해 줘.', lead: '다정한 AI 친구 <b>포도</b>와 편하게 이야기해요. 반말로 들어 주고 응원해 줘요.', ph: '편하게 말해 줘…' },
    english: { t: '🇺🇸 영어회화', lang: 'en-US', read: true, hi: "Hi! I'm Leo 😊 Let's practice English together. How's your day going?", lead: '영어 친구 <b>Leo</b>와 짧게 주고받으며 연습해요. 틀린 표현은 끝에 한국어로 살짝 알려 줘요. 🎤 를 누르고 영어로 말해 보세요.', ph: 'Type in English…' },
    senior: { t: '👵 시니어', lang: 'ko-KR', read: true, big: true, hi: '안녕하세요. 궁금한 것을 편하게 물어보세요. 🎤 를 누르고 말씀하셔도 돼요.', lead: '어르신을 위한 <b>쉽고 짧은</b> 도우미예요. 글자가 크고, 답을 소리로 읽어 드려요.', ph: '예) 김치찌개 끓이는 법 알려줘' },
    biz: { t: '💼 사장님비서', lang: 'ko-KR', read: false, hi: '사장님, 무엇을 써 드릴까요? 위에서 할 일과 말투를 고르고 내용을 적어 주세요.', lead: '리뷰 답변·홍보 문구·안내 문자·문의 답변·가게 소개글을 바로 써 드려요. <b>🧠 내 기억</b>의 상호·말투가 반영돼요.', ph: '' }
  };
  var BIZ_T = [['리뷰 답변', '고객 리뷰를 붙여 넣어 주세요 (예: 음식은 맛있는데 대기가 길었어요)'], ['홍보 문구', '홍보할 내용 (예: 신메뉴 흑임자 라떼 출시, 주말 20% 할인)'], ['안내 문자', '전할 내용 (예: 이번 주 수요일 임시 휴무)'], ['견적·문의', '고객 문의 (예: 단체 10명 예약 가능한가요?)'], ['가게 소개글', '가게 정보 (예: 5년 된 동네 베이커리, 천연발효빵 전문)']];
  function tKey() { return 'cfp_talk_' + S.persona; }
  function tHist() { try { var a = JSON.parse(ls.get(tKey(), '[]')); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function tSave(a) { ls.set(tKey(), JSON.stringify(a.slice(-40))); }
  function tRead() { return ls.get('cfp_read_' + S.persona, TALKS[S.persona].read ? '1' : '0') === '1'; }
  function talkView(b) {
    var P = TALKS[S.persona], biz = S.persona === 'biz';
    S.bizTask = S.bizTask || '리뷰 답변'; S.bizTone = S.bizTone || '정중하게';
    ov.classList.toggle('big', !!P.big);
    b.innerHTML = '<div class="p-lead">' + P.lead + '<br>💳 답 1번 0.2크레딧 · 대화는 이 폰에만 저장돼요.</div>' +
      (biz ? '<div class="p-card" style="padding:12px"><div class="p-lb">할 일</div><div class="p-chips">' + BIZ_T.map(function (x) { return '<button type="button" data-a="btask" data-v="' + x[0] + '" class="' + (S.bizTask === x[0] ? 'on' : '') + '">' + x[0] + '</button>'; }).join('') + '</div>' +
        '<div class="p-lb">말투</div><div class="p-chips">' + ['정중하게', '친근하게', '간결하게'].map(function (x) { return '<button type="button" data-a="btone" data-v="' + x + '" class="' + (S.bizTone === x ? 'on' : '') + '">' + x + '</button>'; }).join('') + '</div></div>' : '') +
      '<div style="display:flex;gap:6px;justify-content:flex-end;margin:0 0 8px"><button type="button" class="p-btn g" data-a="tread" style="width:auto;margin:0;padding:7px 11px;font-size:12.5px">' + (tRead() ? '🔊 읽어주기 켬' : '🔇 읽어주기 끔') + '</button><button type="button" class="p-btn g" data-a="tclear" style="width:auto;margin:0;padding:7px 11px;font-size:12.5px">🗑 대화 지우기</button></div>' +
      '<div class="t-chat" id="cfp-tchat"></div>';
    $('cfp-foot').innerHTML = '<div class="t-send"><button type="button" class="t-mic" data-a="tmic" title="말로 입력">🎤</button><textarea id="cfp-tin" maxlength="2000" placeholder="' + esc(biz ? BIZ_T.filter(function (x) { return x[0] === S.bizTask; })[0][1] : P.ph) + '"></textarea><button type="button" class="t-go" data-a="tsend">보내기</button></div>';
    tDraw();
  }
  function tBubble(m, i) {
    var biz = S.persona === 'biz';
    return '<div class="t-m ' + (m.role === 'user' ? 'me' : 'ai') + '">' + (m.tag ? '<div style="font-size:11.5px;font-weight:800;opacity:.75;margin-bottom:2px">' + esc(m.tag) + '</div>' : '') + esc(m.content) +
      (m.role === 'assistant' && i >= 0 ? '<div class="t-tools"><button type="button" data-a="tcopy" data-i="' + i + '">📋 복사</button>' + (biz ? '<button type="button" data-a="tshare" data-i="' + i + '">💬 공유</button>' : '<button type="button" data-a="tsay" data-i="' + i + '">🔊 듣기</button>') + '</div>' : '') + '</div>';
  }
  function tDraw() {
    var box = $('cfp-tchat'); if (!box) return;
    var h = tHist();
    box.innerHTML = tBubble({ role: 'assistant', content: TALKS[S.persona].hi }, -1) + h.map(tBubble).join('');
    var bd = $('cfp-body'); bd.scrollTop = bd.scrollHeight;
  }
  function tSpeak(text) {
    try { if (!window.speechSynthesis || !text) return; speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(String(text).replace(/\(💡[\s\S]*$/, '').slice(0, 600)); u.lang = TALKS[S.persona].lang; u.rate = S.persona === 'senior' ? 0.9 : 1; speechSynthesis.speak(u); } catch (e) {}
  }
  function tSend() {
    var ta = $('cfp-tin'); if (!ta || S.busy) return; var t = ta.value.trim(); if (!t) return;
    var h = tHist(), biz = S.persona === 'biz';
    h.push({ role: 'user', content: t, tag: biz ? S.bizTask + ' · ' + S.bizTone : '' });
    tSave(h); ta.value = ''; tDraw();
    var box = $('cfp-tchat'); box.insertAdjacentHTML('beforeend', '<div class="t-m ai" id="cfp-twait">…</div>'); $('cfp-body').scrollTop = 1e9;
    S.busy = true;
    /* 사장님비서는 한 건씩 따로 쓰는 일이라 이번 글만 보낸다. 나머지는 앞 대화(최근 12개)를 함께 보낸다 */
    var send = biz ? [{ role: 'user', content: t }] : h.slice(-12).map(function (m) { return { role: m.role, content: m.content }; });
    api({ op: 'talk', persona: S.persona, msgs: send, task: S.bizTask, tone: S.bizTone }).then(function (j) {
      S.busy = false; var w = $('cfp-twait'); if (w) w.remove();
      var h2 = tHist(); h2.push({ role: 'assistant', content: j.text }); tSave(h2); tDraw();
      if (tRead()) tSpeak(j.text);
    }, function (e) {
      S.busy = false; var w = $('cfp-twait'); if (w) w.outerHTML = errBox(e);
      var h2 = tHist(); if (h2.length && h2[h2.length - 1].role === 'user' && h2[h2.length - 1].content === t) { h2.pop(); tSave(h2); }
      var ta2 = $('cfp-tin'); if (ta2 && !ta2.value) ta2.value = t;
    });
  }
  function tMic(btn) {
    var R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) { alert('이 브라우저는 말로 입력을 지원하지 않아요. 글로 써 주세요.'); return; }
    if (S.rec) { try { S.rec.stop(); } catch (e) {} S.rec = null; btn.classList.remove('on'); return; }
    var r = new R(); r.lang = TALKS[S.persona].lang; r.interimResults = false; S.rec = r; btn.classList.add('on');
    r.onresult = function (ev) { var x = ''; try { x = ev.results[0][0].transcript; } catch (e) {} if (x) { var ta = $('cfp-tin'); ta.value = (ta.value ? ta.value + ' ' : '') + x; if (S.persona !== 'biz') tSend(); } };
    r.onend = r.onerror = function () { S.rec = null; btn.classList.remove('on'); };
    try { r.start(); } catch (e) { S.rec = null; btn.classList.remove('on'); }
  }


  /* ══════════ v301 🧩 도구형 (지시문은 서버 functions/api/podoya.js · 1번 1크레딧) ══════════ */
  var TU = {
    naming: { t: '✍️ 작명', lead: '가게·아기·반려동물·채널 이름 후보를 6~8개 지어 드려요.', btn: '✨ 이름 짓기',
      chips: [{ k: 'target', l: '무엇의 이름', o: ['가게/브랜드', '아기', '반려동물', '유튜브 채널', '닉네임'] }, { k: 'styles', l: '스타일 (여러 개 가능)', multi: 1, o: ['한글', '영어', '세련된', '귀여운', '고급스러운', '짧고 임팩트'] }],
      fields: [{ k: 'kw', l: '키워드 · 분위기', ph: '예: 따뜻한 감성 카페, 동네 빵집' }] },
    fortune: { t: '🔮 운세', lead: '사주 · 타로 · 꿈해몽을 <b>재미로</b> 봐요.', btn: '🔮 보기',
      chips: [{ k: 'mode', l: '무엇을 볼까요', o: ['사주', '타로', '꿈해몽'] }],
      fields: [{ k: 'q', area: 1, ph: function (f) { return ({ 사주: '생년월일과 태어난 시간 (예: 1990년 3월 5일 오전 8시경, 남)', 타로: '고민이나 궁금한 점 (예: 올해 이직운이 좋을까?)', 꿈해몽: '꾼 꿈을 적어 주세요 (예: 맑은 강에서 큰 물고기를 잡았어)' })[f.mode || '사주']; } }] },
    quiz: { t: '❓ 퀴즈생성', lead: '주제나 공부한 내용을 넣으면 퀴즈와 정답·해설을 만들어 줘요.', btn: '❓ 퀴즈 만들기',
      chips: [{ k: 'count', l: '문제 수', o: ['3', '5', '10'], d: '5' }, { k: 'type', l: '형식', o: ['객관식', 'OX', '주관식'] }, { k: 'level', l: '난이도', o: ['쉬움', '보통', '어려움'], d: '보통' }],
      fields: [{ k: 'topic', area: 1, ph: '예: 한국사 조선시대 / 공부한 내용을 붙여 넣어도 돼요' }] },
    travel: { t: '🧳 여행플래너', lead: '목적지와 기간을 고르면 날짜별 일정을 짜 드려요. <b>출장</b>을 고르면 경비 예상과 챙길 것까지.', btn: '🧳 일정 짜기',
      chips: [{ k: 'mode', l: '종류', o: ['관광', '출장'] }, { k: 'days', l: '기간', o: ['당일치기', '1박2일', '2박3일', '3박4일', '4박5일 이상'], d: '2박3일' },
        { k: 'styles', l: '여행 스타일 (여러 개 가능)', multi: 1, o: ['관광/명소', '맛집', '자연', '쇼핑', '힐링/휴양', '액티비티', '사진 명소'], when: function (f) { return f.mode !== '출장'; } }],
      fields: [{ k: 'dest', l: '목적지', ph: '예: 제주도, 도쿄, 다낭' }, { k: 'purpose', l: '출장 목적', ph: '예: 거래처 미팅 2건, 전시회', when: function (f) { return f.mode === '출장'; } },
        { k: 'budget', l: '예산', ph: '예: 200만원 / 1500 USD', when: function (f) { return f.mode === '출장'; } }] },
    study: { t: '📚 AI 학습', lead: '모르는 문제를 적거나 <b>사진으로 찍어</b> 올리면 단계별로 풀이해 줘요.', btn: '📚 풀이 보기', photo: 1,
      chips: [{ k: 'subject', l: '과목', o: ['수학', '영어', '과학', '국어/사회', '요약', '자유'] }], fields: [{ k: 'q', area: 1, ph: '예: 이차방정식 x²-5x+6=0 풀어줘 (사진만 올려도 돼요)' }] },
    fridge: { t: '🍳 냉장고요리', lead: '가진 재료를 적거나 <b>냉장고 사진</b>을 올리면 만들 수 있는 요리를 추천해 줘요.', btn: '🍳 요리 추천받기', photo: 1,
      chips: [{ k: 'type', l: '원하는 종류', o: ['아무거나', '한식', '양식', '중식', '일식', '간단요리'] }], fields: [{ k: 'ing', l: '가진 재료', ph: '예: 계란, 양파, 김치 (사진만 올려도 돼요)' }] },
    card: { t: '📇 AI 명함', lead: '명함을 찍으면 이름·회사·전화·메일을 읽어 줘요. 저장한 명함은 <b>이 폰에만</b> 남고, 폰 연락처로도 저장할 수 있어요.', btn: '🤖 명함 읽기', photo: 2, chips: [], fields: [] },
    ppt: { t: '📽️ 발표자료', lead: '주제를 넣으면 <b>장표 개요</b>(제목·핵심 문장·발표 메모)를 만들고 장표로 보여 줘요. PDF로 저장할 수 있어요.', btn: '📽️ 발표자료 만들기',
      chips: [{ k: 'slides', l: '장 수', o: ['5', '8', '10'], d: '8' }], fields: [{ k: 'topic', area: 1, l: '주제 · 담을 내용', ph: '예: 우리 동네 빵집 신메뉴 소개 — 흑임자 라떼, 주말 할인, 단체 주문' }, { k: 'who', l: '듣는 사람 (선택)', ph: '예: 투자자 / 직원 / 손님' }] },
    ledger: { t: '💰 AI가계부' }
  };
  function tf() { if (!S.tf) { S.tf = {}; (TU[S.tool].chips || []).forEach(function (c) { S.tf[c.k] = c.multi ? [] : (c.d || c.o[0]); }); } return S.tf; }
  function toolUI(b) {
    var U = TU[S.tool], f = tf(), h = '<div class="p-lead">' + U.lead + '<br>💳 1번 1크레딧</div><div class="p-card">';
    (U.chips || []).forEach(function (c) {
      if (c.when && !c.when(f)) return;
      h += '<div class="p-lb">' + c.l + '</div><div class="p-chips">' + c.o.map(function (o) { var on = c.multi ? f[c.k].indexOf(o) >= 0 : f[c.k] === o; return '<button type="button" data-a="tchip" data-k="' + c.k + '" data-v="' + esc(o) + '" class="' + (on ? 'on' : '') + '">' + esc(o) + (c.k === 'count' || c.k === 'slides' ? (c.k === 'slides' ? '장' : '문제') : '') + '</button>'; }).join('') + '</div>';
    });
    (U.fields || []).forEach(function (x) {
      if (x.when && !x.when(f)) return;
      var ph = typeof x.ph === 'function' ? x.ph(f) : x.ph;
      h += (x.l ? '<div class="p-lb">' + x.l + '</div>' : '<div style="height:10px"></div>') + (x.area ? '<textarea class="p-in" data-tf="' + x.k + '" placeholder="' + esc(ph) + '">' + esc(f[x.k] || '') + '</textarea>' : '<input class="p-in" data-tf="' + x.k + '" placeholder="' + esc(ph) + '" value="' + esc(f[x.k] || '') + '">');
    });
    if (U.photo) h += '<div class="p-lb">' + (U.photo === 2 ? '명함 사진' : '사진 <span style="font-weight:600;color:#9a93ad">(선택)</span>') + '</div><label style="display:block;border:1.5px dashed #d6cfe8;border-radius:12px;padding:12px;text-align:center;cursor:pointer;font-size:13.5px;color:#6b6385"><input type="file" id="cfp-photo" accept="image/*" style="display:none"><span id="cfp-photo-l">' + (f._img ? '🖼️ 사진 준비됨 · 바꾸려면 누르기' : '📷 눌러서 찍거나 고르기') + '</span></label>' + (f._img ? '<img src="' + f._img + '" alt="" style="display:block;max-width:100%;max-height:220px;margin:8px auto 0;border-radius:10px">' : '');
    h += '<button type="button" class="p-btn" data-a="trun">' + U.btn + ' · 1크레딧</button><div class="p-out" id="cfp-out"></div></div>';
    if (S.tool === 'card') h += '<div class="p-sec">저장한 명함</div><div id="cfp-cards"></div>';
    b.innerHTML = h;
    if (S.tool === 'card') cardList();
    if (S.last) toolShow(S.last);
  }
  function tfCollect() { var f = tf(); Array.prototype.forEach.call(ov.querySelectorAll('[data-tf]'), function (x) { f[x.getAttribute('data-tf')] = x.value.trim(); }); return f; }
  /* 사진은 폰에서 긴 변 1280px JPEG 로 줄여서 보낸다 */
  function shrink(file, cb) {
    var rd = new FileReader();
    rd.onload = function () {
      var im = new Image();
      im.onload = function () { var m = 1280, w = im.width, hh = im.height, r = Math.min(1, m / Math.max(w, hh)); var c = document.createElement('canvas'); c.width = Math.round(w * r); c.height = Math.round(hh * r); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); cb(c.toDataURL('image/jpeg', 0.85)); };
      im.onerror = function () { cb(''); }; im.src = rd.result;
    };
    rd.readAsDataURL(file);
  }
  function toolRun(btn) {
    if (S.busy) return;
    var f = tfCollect(), U = TU[S.tool], body = { op: 'tool', kind: S.tool };
    Object.keys(f).forEach(function (k) { if (k !== '_img') body[k] = f[k]; });
    if (f.mode && S.tool === 'travel') body.mode = f.mode === '출장' ? 'biz' : 'tour';
    if (U.photo && f._img) body.img = f._img;
    if (U.photo === 2 && !f._img) return say('명함 사진을 올려 주세요');
    S.busy = true; btn.disabled = true; $('cfp-out').innerHTML = '<div class="p-wait">⏳ ' + (body.img ? '사진을 읽는 중…' : '만드는 중…') + '</div>';
    api(body).then(function (j) { S.busy = false; btn.disabled = false; S.last = j; toolShow(j); }, function (e) { S.busy = false; btn.disabled = false; $('cfp-out').innerHTML = errBox(e); });
  }
  function toolShow(j) {
    var o = $('cfp-out'); if (!o) return; var paid = '<div class="p-mut" style="margin-top:8px">💳 ' + j.cost + '크레딧 사용</div>';
    if (j.card) { o.innerHTML = cardForm(j.card) + paid; return; }
    if (j.deck) { o.innerHTML = deckHtml(j.deck) + '<div class="p-two"><button type="button" class="p-btn" data-a="pprint">📄 PDF로 저장</button><button type="button" class="p-btn g" data-a="copy" data-k="outline" style="margin-top:10px">📋 개요 복사</button></div><div id="cfp-msg"></div><div class="p-mut" style="margin-top:8px">PDF로 저장을 누르면 인쇄 화면이 떠요 → 프린터를 <b>"PDF로 저장"</b>으로 바꾸면 한 장에 한 장표씩 파일이 만들어져요.</div>' + paid; return; }
    o.innerHTML = '<div class="p-res">' + esc(j.text) + '</div>' + tools('text') + paid;
  }
  /* 📽️ 장표 */
  function deckOutline(d) { return d.title + (d.subtitle ? '\n' + d.subtitle : '') + '\n\n' + d.slides.map(function (s, i) { return (i + 1) + '. ' + s.title + '\n' + s.bullets.map(function (x) { return '  - ' + x; }).join('\n') + (s.note ? '\n  (메모) ' + s.note : ''); }).join('\n\n'); }
  function slideHtml(inner, big) { return '<div style="aspect-ratio:16/9;background:#fff;border:1px solid #e6e1f2;border-radius:10px;padding:5% 6%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:' + (big ? 'center' : 'flex-start') + ';margin-bottom:10px;overflow:hidden">' + inner + '</div>'; }
  function deckSlides(d) {
    return slideHtml('<div style="font-size:clamp(18px,5vw,34px);font-weight:900;color:#2e1065;line-height:1.3">' + esc(d.title) + '</div>' + (d.subtitle ? '<div style="margin-top:8px;font-size:clamp(12px,3vw,18px);color:#6b6385">' + esc(d.subtitle) + '</div>' : '') + '<div style="width:56px;height:5px;background:#6d28d9;border-radius:3px;margin-top:14px"></div>', true) +
      d.slides.map(function (s, i) { return slideHtml('<div style="font-size:clamp(11px,2.4vw,14px);color:#9a93ad;font-weight:800">' + (i + 1) + ' / ' + d.slides.length + '</div><div style="font-size:clamp(15px,4vw,26px);font-weight:900;color:#2e1065;margin:4px 0 10px;line-height:1.3">' + esc(s.title) + '</div><ul style="margin:0;padding-left:1.2em;font-size:clamp(12px,3.1vw,19px);line-height:1.55;color:#1c1830">' + s.bullets.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'); }).join('');
  }
  function deckHtml(d) { return deckSlides(d) + '<details style="margin-top:4px"><summary>🗒️ 발표 메모 보기</summary><div class="p-mut" style="white-space:pre-wrap;margin-top:6px">' + d.slides.map(function (s, i) { return (i + 1) + '. ' + esc(s.title) + '\n' + esc(s.note || ''); }).join('\n\n') + '</div></details>'; }
  function deckPrint(d) {
    var html = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(d.title) + '</title><style>@page{size:A4 landscape;margin:0}body{margin:0;font-family:-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}.pg{width:297mm;height:210mm;box-sizing:border-box;padding:18mm 22mm;page-break-after:always;display:flex;flex-direction:column}.pg h1{font-size:40px;color:#2e1065;margin:auto 0 0}.pg h2{font-size:30px;color:#2e1065;margin:6px 0 18px}.pg li{font-size:22px;line-height:1.6}.pg .n{color:#9a93ad;font-weight:800;font-size:16px}</style></head><body>' +
      '<div class="pg"><h1>' + esc(d.title) + '</h1><p style="font-size:22px;color:#6b6385;margin:12px 0 auto">' + esc(d.subtitle || '') + '</p></div>' +
      d.slides.map(function (s, i) { return '<div class="pg"><div class="n">' + (i + 1) + ' / ' + d.slides.length + '</div><h2>' + esc(s.title) + '</h2><ul>' + s.bullets.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>'; }).join('') + '</body></html>';
    var fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(fr);
    var w = fr.contentWindow; w.document.open(); w.document.write(html); w.document.close();
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} setTimeout(function () { fr.remove(); }, 60000); }, 300);
  }
  /* 📇 명함 (이 폰에만) */
  var CARD_F = [['name', '이름'], ['company', '회사'], ['title', '직책'], ['phone', '전화'], ['email', '이메일'], ['address', '주소'], ['website', '웹사이트'], ['memo', '메모']];
  function cards() { try { var a = JSON.parse(ls.get('cfp_cards', '[]')); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function cardForm(c) {
    return '<div class="p-res" style="white-space:normal">' + CARD_F.map(function (f) { return '<div class="p-lb">' + f[1] + '</div><input class="p-in" data-cf="' + f[0] + '" value="' + esc(c[f[0]] || '') + '">'; }).join('') +
      '<button type="button" class="p-btn" data-a="csave">💾 명함 저장 (이 폰)</button><button type="button" class="p-btn g" data-a="cvcf">📱 폰 연락처로 저장 (.vcf)</button></div><div id="cfp-msg"></div>';
  }
  function cardFromForm() { var c = {}; Array.prototype.forEach.call(ov.querySelectorAll('[data-cf]'), function (x) { c[x.getAttribute('data-cf')] = x.value.trim(); }); return c; }
  function vcf(c) {
    var e = function (v) { return String(v || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n'); };
    var t = 'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:' + e(c.name) + '\r\nN:' + e(c.name) + ';;;;\r\n' + (c.company ? 'ORG:' + e(c.company) + '\r\n' : '') + (c.title ? 'TITLE:' + e(c.title) + '\r\n' : '') + (c.phone ? 'TEL;TYPE=CELL:' + e(c.phone) + '\r\n' : '') + (c.email ? 'EMAIL:' + e(c.email) + '\r\n' : '') + (c.address ? 'ADR:;;' + e(c.address) + ';;;;\r\n' : '') + (c.website ? 'URL:' + e(c.website) + '\r\n' : '') + (c.memo ? 'NOTE:' + e(c.memo) + '\r\n' : '') + 'END:VCARD\r\n';
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/vcard' })); a.download = (c.name || 'contact') + '.vcf'; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 1000);
  }
  function cardList() {
    var box = $('cfp-cards'); if (!box) return; var l = cards();
    box.innerHTML = l.length ? '<div class="p-list">' + l.map(function (c, i) {
      var tel = String(c.phone || '').replace(/[^0-9+]/g, '');
      return '<div class="p-row" style="cursor:default;flex-wrap:wrap"><span class="ic">📇</span><span class="mid"><span class="nm">' + esc(c.name || '(이름 없음)') + '</span><span class="sub">' + esc([c.company, c.title].filter(Boolean).join(' · ')) + (c.phone ? '<br>' + esc(c.phone) : '') + (c.email ? '<br>' + esc(c.email) : '') + '</span></span>' +
        '<span style="display:flex;gap:5px;flex-wrap:wrap">' + (tel ? '<a class="p-btn g" href="tel:' + esc(tel) + '" style="width:auto;margin:0;padding:7px 9px;font-size:12px;text-decoration:none">📞</a><a class="p-btn g" href="sms:' + esc(tel) + '" style="width:auto;margin:0;padding:7px 9px;font-size:12px;text-decoration:none">💬</a>' : '') +
        (c.email ? '<a class="p-btn g" href="mailto:' + esc(c.email) + '" style="width:auto;margin:0;padding:7px 9px;font-size:12px;text-decoration:none">✉️</a>' : '') + '<button type="button" class="p-btn g" data-a="cvcfi" data-i="' + i + '" style="width:auto;margin:0;padding:7px 9px;font-size:12px">📱</button><button type="button" class="p-btn g" data-a="cdel" data-i="' + i + '" style="width:auto;margin:0;padding:7px 9px;font-size:12px">🗑</button></span></div>';
    }).join('') + '</div>' : '<div class="p-mut" style="margin:0 4px">아직 저장한 명함이 없어요.</div>';
  }

  /* 💰 AI가계부 — 적기·보기는 무료(이 폰에만) · 영수증 읽기 1 · 이번 달 분석 1 */
  var LED_H = ['식비', '카페', '교통', '쇼핑', '생활', '의료', '기타'], LED_B = ['접대비', '차량유지', '통신비', '소모품', '광고선전', '지급수수료', '복리후생', '여비교통', '임차료', '기타'];
  function led() { try { var a = JSON.parse(ls.get('cfp_ledger', '[]')); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function ledSave(a) { ls.set('cfp_ledger', JSON.stringify(a.slice(0, 3000))); }
  function ledBiz() { return ls.get('cfp_ledger_mode', 'home') === 'biz'; }
  function ymNow() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }
  function dayNow() { var d = new Date(); return ymNow() + '-' + ('0' + d.getDate()).slice(-2); }
  function ledgerView(b) {
    var biz = ledBiz(), cats = biz ? LED_B : LED_H; S.lcat = cats.indexOf(S.lcat) >= 0 ? S.lcat : cats[0];
    var ym = ymNow(), mon = led().filter(function (e) { return (e.date || '').indexOf(ym) === 0 && !!e.biz === biz; }), tot = 0, by = {};
    mon.forEach(function (e) { tot += e.amount; by[e.cat] = (by[e.cat] || 0) + e.amount; });
    b.innerHTML = '<div class="p-lead">돈 쓴 걸 적어 두면 이번 달 합계와 항목별로 보여 줘요. <b>적기·보기는 무료</b>이고 기록은 <b>이 폰에만</b> 남아요.<br>💳 📷 영수증 읽기 1크레딧 · 🤖 이번 달 분석 1크레딧</div>' +
      '<div class="p-chips" style="margin-bottom:10px"><button type="button" data-a="lmode" data-v="home" class="' + (biz ? '' : 'on') + '">🏠 생활</button><button type="button" data-a="lmode" data-v="biz" class="' + (biz ? 'on' : '') + '">💼 사업 경비</button></div>' +
      '<div class="p-card"><div class="p-lb">금액 (원)</div><input class="p-in" id="cfp-lamt" inputmode="numeric" placeholder="예: 12000" value="' + esc(S.lpre && S.lpre.amount || '') + '">' +
      '<div class="p-lb">' + (biz ? '경비 항목' : '분류') + '</div><div class="p-chips">' + cats.map(function (c) { return '<button type="button" data-a="lcat" data-v="' + c + '" class="' + (S.lcat === c ? 'on' : '') + '">' + c + '</button>'; }).join('') + '</div>' +
      '<div class="p-lb">메모 · 상호</div><input class="p-in" id="cfp-lmemo" placeholder="예: 점심 김밥" value="' + esc(S.lpre && S.lpre.store || '') + '"><div class="p-lb">날짜</div><input class="p-in" id="cfp-ldate" type="date" value="' + dayNow() + '">' +
      (S.lpre && S.lpre.ded ? '<div class="p-mut" style="margin-top:6px">💼 경비 처리: <b>' + esc(S.lpre.ded) + '</b> ' + esc(S.lpre.why || '') + ' (참고용)</div>' : '') +
      '<div class="p-two"><button type="button" class="p-btn" data-a="ladd">＋ 적기 (무료)</button><label class="p-btn g" style="margin-top:10px;text-align:center;cursor:pointer">📷 영수증 읽기 · 1<input type="file" id="cfp-receipt" accept="image/*" style="display:none"></label></div><div id="cfp-out"></div></div>' +
      '<div class="p-card"><div style="display:flex;justify-content:space-between;align-items:baseline"><b>' + ym.replace('-', '년 ') + '월 ' + (biz ? '경비' : '지출') + '</b><b style="font-size:20px">' + won(tot) + '원</b></div>' +
      (Object.keys(by).length ? '<div style="margin-top:8px">' + Object.keys(by).sort(function (a, c) { return by[c] - by[a]; }).map(function (c) { var pc = tot ? Math.round(by[c] * 100 / tot) : 0; return '<div style="font-size:13px;margin:5px 0">' + esc(c) + ' <b>' + won(by[c]) + '원</b> <span class="p-mut">' + pc + '%</span><div style="height:6px;background:#f1eef7;border-radius:3px"><div style="height:6px;width:' + pc + '%;background:#6d28d9;border-radius:3px"></div></div></div>'; }).join('') + '</div>' : '<div class="p-mut" style="margin-top:6px">이번 달 기록이 없어요.</div>') +
      (mon.length ? '<button type="button" class="p-btn g" data-a="lai">🤖 이번 달 ' + (biz ? '경비' : '지출') + ' 분석 · 1크레딧</button><div id="cfp-lai"></div>' : '') + '</div>' +
      '<div class="p-sec">기록 (' + mon.length + '건)</div><div class="p-list">' + (mon.length ? mon.slice().sort(function (a, c) { return (c.date + c.ts) > (a.date + a.ts) ? 1 : -1; }).map(function (e) {
        return '<div class="p-row" style="cursor:default"><span class="mid"><span class="nm">' + won(e.amount) + '원 <span class="tag">' + esc(e.cat) + '</span>' + (e.ded ? ' <span class="tag o">' + esc(e.ded) + '</span>' : '') + '</span><span class="sub">' + esc(e.date) + (e.memo ? ' · ' + esc(e.memo) : '') + '</span></span><button type="button" class="p-btn g" data-a="ldel" data-ts="' + e.ts + '" style="width:auto;margin:0;padding:7px 10px;font-size:12px">🗑</button></div>';
      }).join('') : '<div class="p-row" style="cursor:default"><span class="p-mut">아직 없어요</span></div>') + '</div>' +
      (biz ? '<div class="p-mut" style="margin:10px 4px">⚠️ 경비·공제 판단은 참고용이에요. 실제 처리는 세무사나 홈택스에서 꼭 확인하세요.</div>' : '');
  }

  /* ══════════ v299 🧩 포도야 기능 (격자) ══════════
     go: coverfo 안 화면(view) · url: coverfo 주소 · ext: 새 창 · pt: 아직 옮기지 않은 것 → 포도톡 화면(아래 탭 없이) · soon: 아직 없음 */
  var FEATS = [
    ['🏠', '집안 기기', { pt: 'home' }], ['📊', '매일 리포트', { pt: 'report' }], ['📄', '문서 만들기', { go: 'doc' }], ['📽️', '발표자료', { tool: 'ppt' }],
    ['🌍', '해외 응대', { go: 'intl' }], ['🎨', '상품 시작하기', { go: 'launch' }], ['📰', '예약브리핑', { url: '/brief' }], ['✈️', '텔레그램', { pt: 'f_tgfeat' }],
    ['🤗', 'AI 컴패니언', { talk: 'companion' }], ['👵', '시니어', { talk: 'senior' }], ['🗣️', '말로 열기', { live: 1 }], ['🔎', 'AI 리서치', { go: 'research' }],
    ['⚙️', 'AI 자동화', { go: 'work' }], ['📚', 'AI 학습', { tool: 'study' }], ['📇', 'AI 명함', { tool: 'card' }], ['💼', '사장님비서', { talk: 'biz' }],
    ['💰', 'AI가계부', { tool: 'ledger' }], ['🇺🇸', '영어회화', { talk: 'english' }], ['🧳', '여행플래너', { tool: 'travel' }], ['🍳', '냉장고요리', { tool: 'fridge' }],
    ['✍️', '작명', { tool: 'naming' }], ['🔮', '운세', { tool: 'fortune' }], ['❓', '퀴즈생성', { tool: 'quiz' }], ['📷', '사물인식', { ext: '/lens-snap/' }],
    ['🔤', '글자인식', { ext: '/lens-snap/' }], ['🧪', '성분스캐너', { ext: '/lens-snap/' }], ['🖼️', '이미지 생성', { url: '/studio' }], ['📝', 'AI 글쓰기', { home: 1 }],
    ['🎬', 'AI 릴', { url: '/studio' }], ['🍇', '포도다', { ext: 'https://pododa.kr/' }]
  ];
  function featView(b) {
    b.innerHTML = '<div class="p-lead">누르면 바로 열려요. <span class="tag o">포도톡</span> 표시는 아직 포도톡 화면으로 열려요 (아래 탭 없이) — 차례로 coverfo 로 옮겨요.</div>' +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">' + FEATS.map(function (f, i) {
        var t = f[2].pt ? '<span class="tag o" style="font-size:9.5px;padding:1px 5px">포도톡</span>' : f[2].soon ? '<span class="tag o" style="font-size:9.5px;padding:1px 5px">준비 중</span>' : '';
        return '<button type="button" data-a="feat" data-i="' + i + '" style="background:#fff;border:1px solid #ebe6f5;border-radius:14px;padding:10px 2px 8px;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;font-family:inherit;color:inherit"><span style="font-size:24px">' + f[0] + '</span><span style="font-size:11.5px;font-weight:800;line-height:1.25;text-align:center">' + f[1] + '</span>' + t + '</button>';
      }).join('') + '</div>';
  }
  function featGo(i) {
    var f = FEATS[i]; if (!f) return; var o = f[2];
    if (o.go) { S.view = o.go; S.last = null; W.file = null; return render(); }
    if (o.url) { close(); location.href = o.url; return; }
    if (o.ext) { window.open(o.ext, '_blank', 'noopener'); return; }
    if (o.home) return toHome('입력칸에 쓸 글을 적고 「무엇이든 물어보기」를 누르세요 (예: 신상품 소개 글 써줘)');
    if (o.talk) { S.persona = o.talk; S.view = 'talk'; return render(); }
    if (o.tool) { S.tool = o.tool; S.tf = null; S.view = 'tool'; S.last = null; return render(); }
    if (o.live) { close(); setTimeout(function () { var lb = document.getElementById('cf-live-btn'); if (lb) lb.click(); }, 250); return; }
    if (o.pt) return toPodotalk(o.pt);
    alert('발표자료는 다음 단계에서 coverfo 로 새로 만들어요.');
  }

  /* ══════════ v299 📁 저장루틴 = 커넥션 허브 2.0 레시피 (/api/hub) ══════════
     실행 5크레딧 · 확인 뒤 이어서 2크레딧 (hub.js 설정). 예약·앱 연결은 허브 2.0(/hub) 화면에서 */
  var RECO = [
    ['📥', '어제 온 문의 정리', '지메일에서 어제 받은 문의 메일을 모아 보낸 사람·내용·요구사항을 읽기 좋게 요약해 줘', '지메일'],
    ['✉️', '문의 답장 + 장부 기록', '지메일에서 안 읽은 문의 메일을 찾아 정중한 한국어 답장을 써서 보내고, 구글 시트 문의장부에 누가·언제·무엇을 문의했는지 한 줄 추가해 줘', '지메일 · 구글 시트'],
    ['📅', '아침 브리핑', '오늘 구글 캘린더 일정과 오늘 받은 중요한 메일을 한 장으로 요약해 줘', '구글 캘린더 · 지메일'],
    ['🧾', '오늘 매출 기록', '구글 시트 매출장부에 오늘 날짜와 매출 내용을 한 줄 추가해 줘', '구글 시트']
  ];
  var HUB = '/api/hub';
  function routineView(b) {
    b.innerHTML = '<div class="p-lead">📁 자주 시키는 일을 <b>레시피</b>로 저장해 두고 한 번에 돌려요. 지메일·캘린더·시트 같은 앱은 <a href="/hub" style="color:#6d28d9;font-weight:800">🔗 커넥션 허브</a>에서 연결해요.<br>💳 실행 1번 5크레딧 · 보내기 전 확인 뒤 이어서 2크레딧 · 🗣️ 소리에게 "○○ 루틴 실행해"라고 말해도 돼요.</div>' +
      '<div id="cfp-rres"></div><div class="p-sec">내 레시피</div><div id="cfp-rlist"><div class="p-wait">불러오는 중…</div></div>' +
      '<div class="p-sec">＋ 새 레시피</div><div class="p-card"><div class="p-lb">이름</div><input class="p-in" id="cfp-rname" maxlength="30" placeholder="예: 월요일 정리">' +
      '<div class="p-lb">시킬 말</div><textarea class="p-in" id="cfp-rgoal" style="min-height:70px" placeholder="예: 지난주 받은 견적 메일을 모아 구글 시트에 정리해 줘"></textarea><button type="button" class="p-btn" data-a="rsave">💾 저장</button></div>' +
      '<div class="p-sec">✨ 추천 루틴 · 1인 사업자</div><div class="p-list">' + RECO.map(function (r, i) {
        return '<div class="p-row" style="cursor:default"><span class="ic">' + r[0] + '</span><span class="mid"><span class="nm">' + r[1] + '</span><span class="sub">' + esc(r[2]) + '<br>🔗 필요한 연결: ' + r[3] + '</span></span><button type="button" class="p-btn g" data-a="rreco" data-i="' + i + '" style="width:auto;margin:0;padding:8px 12px;font-size:12.5px">담기</button></div>';
      }).join('') + '</div><div class="p-mut" style="margin:10px 4px">포도톡에 저장했던 루틴은 그 폰 안에만 있어서 옮겨 오지 못해요. 필요한 것은 위 ＋ 새 레시피로 다시 담아 주세요.</div>';
    loadRecipes();
  }
  function loadRecipes(cb) {
    return api({ op: 'recipes' }, HUB).then(function (j) {
      S.recipes = j.recipes || []; var box = $('cfp-rlist'); if (cb) cb(S.recipes); if (!box) return;
      box.innerHTML = S.recipes.length ? '<div class="p-list">' + S.recipes.map(function (r) {
        return '<div class="p-row" style="cursor:default;flex-wrap:wrap"><span class="mid"><span class="nm">' + esc(r.name) + '</span><span class="sub">' + esc(r.goal).slice(0, 120) + (r.sched && r.sched.on ? '<br>⏰ ' + esc(r.sched.text || '예약됨') : '') + (r.runs ? ' · ' + r.runs + '번 실행' : '') + '</span></span>' +
          '<span style="display:flex;gap:6px"><button type="button" class="p-btn" data-a="rrun" data-id="' + r.id + '" style="width:auto;margin:0;padding:8px 12px;font-size:12.5px">▶ 실행</button><a href="/hub" class="p-btn g" style="width:auto;margin:0;padding:8px 10px;font-size:12.5px;text-decoration:none">⏰</a><button type="button" class="p-btn g" data-a="rdel" data-id="' + r.id + '" style="width:auto;margin:0;padding:8px 10px;font-size:12.5px">🗑</button></span></div>';
      }).join('') + '</div>' : '<div class="p-mut" style="margin:0 4px">아직 레시피가 없어요. 아래 ✨ 추천 루틴을 담거나 ＋ 새 레시피로 만들어 보세요.</div>';
    }, function (e) { var box = $('cfp-rlist'); if (box) box.innerHTML = errBox(e); if (cb) cb(null, e); });
  }
  function hubHandle(j) {
    var box = $('cfp-rres'); if (!box) return;
    var steps = (j.steps || []).map(function (s) { return '<div style="font-size:12.5px">' + (s.ok ? '✅' : '⚠️') + ' ' + esc(s.label) + (s.note ? ' <span class="p-mut">' + esc(s.note) + '</span>' : '') + '</div>'; }).join('');
    if (j.status === 'confirm') {
      S.hubState = j.state;
      box.innerHTML = '<div class="p-card" style="border-color:#e5dcfb"><b>🙋 이렇게 할까요?</b>' + (j.items || []).map(function (it) { return '<div style="margin-top:8px"><b style="font-size:13px">' + (it.kind === 'kakao' ? '💬 ' : '') + esc(it.title) + '</b><pre style="white-space:pre-wrap;font-size:12.5px;background:#faf9fc;border-radius:10px;padding:8px;margin:4px 0 0">' + esc(it.detail || '') + '</pre></div>'; }).join('') +
        (steps ? '<div style="margin-top:8px">' + steps + '</div>' : '') + '<div class="p-two"><button type="button" class="p-btn" data-a="rok">네, 진행해요 · 2크레딧</button><button type="button" class="p-btn g" data-a="rno" style="margin-top:10px">취소</button></div></div>';
      return;
    }
    S.hubKakao = j.client || [];
    box.innerHTML = '<div class="p-res" style="white-space:normal">' + (j.say ? '<h4>' + esc(j.say) + '</h4>' : '') + '<div style="white-space:pre-wrap">' + esc(j.text || '') + '</div>' + (steps ? '<div style="margin-top:8px;border-top:1px solid #f1eef7;padding-top:8px">' + steps + '</div>' : '') +
      (j.need_connect ? '<a href="/hub" class="p-btn" style="display:block;text-align:center;text-decoration:none">🔗 커넥션 허브에서 앱 연결하기</a>' : '') +
      S.hubKakao.map(function (k, i) { return '<button type="button" class="p-btn g" data-a="rkakao" data-i="' + i + '">💬 카톡 보내기' + (k.to && k.to.length ? ' → ' + esc(k.to.join(', ')) : '') + '</button>'; }).join('') + '</div>';
  }
  function hubRun(body, label) {
    var box = $('cfp-rres'); if (!box) return Promise.resolve();
    box.innerHTML = '<div class="p-wait">⏳ ' + esc(label || '진행 중') + '… 1분쯤 걸릴 수 있어요</div>';
    try { box.scrollIntoView({ block: 'start' }); } catch (e) {}
    return api(body, HUB).then(function (j) { hubHandle(j); loadRecipes(); }, function (e) { box.innerHTML = errBox(e); });
  }
  /* 🗣️ 소리 "○○ 루틴 실행해" — 레시피 이름(또는 when: today·yesterday·latest)으로 찾아 이 화면에서 실행. 결과 {ok,name} | {ok:false,names} */
  function rNorm(t) { return String(t || '').toLowerCase().replace(/[^0-9a-z가-힣]/g, '').replace(/(루틴|레시피|routine)$/g, ''); }
  function rDay(ts, back) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - back); var e = new Date(d.getTime()); e.setDate(e.getDate() + 1); return ts >= d.getTime() && ts < e.getTime(); }
  window.cfRoutineRun = function (name, when) {
    return new Promise(function (res) {
      open('routine');
      loadRecipes(function (list, err) {
        if (!list) { res({ ok: false, note: (err && err.message) || 'Could not read recipes.' }); return; }
        var arr = list.slice().map(function (r) { return { r: r, ts: Date.parse(r.created_at || '') || 0 }; }).sort(function (a, b) { return b.ts - a.ts; });
        if (when === 'today') arr = arr.filter(function (x) { return rDay(x.ts, 0); });
        if (when === 'yesterday') arr = arr.filter(function (x) { return rDay(x.ts, 1); });
        var q = rNorm(name), best = null, bs = 0;
        if (!q) best = arr[0] ? arr[0].r : null;
        else arr.forEach(function (x) { var n = rNorm(x.r.name), sc = 0; if (n === q) sc = 100; else if (n.indexOf(q) >= 0) sc = 80; else if (q.indexOf(n) >= 0 && n.length >= 2) sc = 70; else if (rNorm(x.r.goal).indexOf(q) >= 0) sc = 50; if (sc > bs) { bs = sc; best = x.r; } });
        if (!best) { res({ ok: false, names: list.map(function (r) { return r.name; }) }); return; }
        hubRun({ op: 'recipe_run', id: best.id }, '"' + best.name + '" 실행 중');
        res({ ok: true, name: best.name });
      });
    });
  };

  /* ══════════ v299 사이드바 설정 화면들 ══════════ */
  /* 🔔 알림 — 아침 브리핑과 같은 웹 알림(커넥션 허브 2.0 · /brief-sw.js)에 채팅 새 메시지도 함께 온다 */
  function b64ToBytes(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var r = atob(s), o = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) o[i] = r.charCodeAt(i); return o; }
  function pushOk() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function notifyView(b) {
    b.innerHTML = '<div class="p-lead">🔔 이 브라우저(폰)로 알림을 받아요.<br>· 💬 채팅 · 👥 일반채팅 · 🌏 오픈채팅의 <b>새 메시지</b><br>· ☀️ <b>아침 브리핑</b> (브리핑에서 받기를 켠 경우)<br>알림을 누르면 그 채팅방이 바로 열려요.</div><div class="p-card" id="cfp-nbox"><div class="p-wait">확인하는 중…</div></div>';
    var box = $('cfp-nbox');
    if (!pushOk()) { box.innerHTML = '<div class="p-err">이 브라우저는 웹 알림을 지원하지 않아요. 크롬·엣지에서 열거나, 아이폰은 "홈 화면에 추가"한 앱에서 켜 주세요.</div>'; return; }
    navigator.serviceWorker.getRegistration('/brief').then(function (reg) { return reg && reg.pushManager ? reg.pushManager.getSubscription() : null; })
      .then(function (sub) { drawNotify(!!sub && Notification.permission === 'granted'); }, function () { drawNotify(false); });
  }
  function drawNotify(on, msg) {
    var box = $('cfp-nbox'); if (!box) return;
    box.innerHTML = '<div style="font-size:15px;font-weight:800">' + (on ? '🔔 알림 켜짐' : '🔕 알림 꺼짐') + '</div>' +
      (on ? '<button type="button" class="p-btn g" data-a="ntest">시험 알림 보내기</button><button type="button" class="p-btn g" data-a="noff" style="color:#b42318">이 폰 알림 끄기</button>'
        : '<button type="button" class="p-btn" data-a="non">🔔 알림 켜기</button><div class="p-mut" style="margin-top:8px">누르면 브라우저가 "알림 허용"을 물어봐요 → <b>허용</b>을 눌러 주세요.</div>') + (msg || '');
  }
  function waitActive(reg) { return new Promise(function (ok) { if (reg.active) { ok(reg); return; } var w = reg.installing || reg.waiting; if (!w) { ok(reg); return; } w.addEventListener('statechange', function () { if (w.state === 'activated') ok(reg); }); setTimeout(function () { ok(reg); }, 8000); }); }
  function notifyOn(btn) {
    btn.disabled = true;
    Notification.requestPermission().then(function (p) {
      if (p !== 'granted') throw new Error('알림이 막혀 있어요. 주소창 왼쪽 자물쇠(또는 ⓘ) → 알림 → 허용으로 바꾼 뒤 다시 눌러 주세요.');
      return navigator.serviceWorker.register('/brief-sw.js', { scope: '/brief' });
    }).then(waitActive).then(function (reg) {
      return api({ op: 'push_key' }, HUB).then(function (k) {
        if (!k.key) throw new Error('웹 알림 설정이 아직 없어요 (서버 VAPID 키)');
        return reg.pushManager.getSubscription().then(function (old) { return old || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(k.key) }); });
      });
    }).then(function (sub) { return api({ op: 'push_sub', sub: sub.toJSON() }, HUB); })
      .then(function () { drawNotify(true, '<div class="p-ok">이 폰으로 알림을 받아요</div>'); }, function (e) { btn.disabled = false; drawNotify(false, errBox(e)); });
  }
  function notifyOff() {
    navigator.serviceWorker.getRegistration('/brief').then(function (reg) { return reg && reg.pushManager.getSubscription(); })
      .then(function (sub) { if (!sub) return; var ep = sub.endpoint; return sub.unsubscribe().then(function () { return api({ op: 'push_unsub', endpoint: ep }, HUB); }); })
      .then(function () { drawNotify(false, '<div class="p-ok">이 폰 알림을 껐어요</div>'); }, function (e) { drawNotify(true, errBox(e)); });
  }
  /* 🚫 차단한 사람 (coverfo 채팅) */
  function blocksView(b) {
    b.innerHTML = '<div class="p-lead">🚫 채팅에서 차단한 사람이에요. 차단한 사람의 말은 모든 방에서 나에게 보이지 않아요. 상대는 차단된 걸 알 수 없어요.</div><div id="cfp-blist"><div class="p-wait">불러오는 중…</div></div>';
    api({ op: 'blocks' }, '/api/chat').then(function (j) {
      var l = j.blocks || [], box = $('cfp-blist'); if (!box) return;
      box.innerHTML = l.length ? '<div class="p-list">' + l.map(function (x) { return '<div class="p-row" style="cursor:default"><span class="ic">🚫</span><span class="mid"><span class="nm">' + esc(x.nick || '(이름 없음)') + '</span><span class="sub">' + esc(String(x.at || '').slice(0, 10)) + ' 차단</span></span><button type="button" class="p-btn g" data-a="unblock" data-id="' + esc(x.id) + '" style="width:auto;margin:0;padding:8px 12px;font-size:12.5px">차단 풀기</button></div>'; }).join('') + '</div>'
        : '<div class="p-mut" style="margin:0 4px">차단한 사람이 없어요. 채팅방에서 상대 말풍선을 누르면 🚫 차단할 수 있어요.</div>';
    }, function (e) { var box = $('cfp-blist'); if (box) box.innerHTML = errBox(e); });
  }
  /* 🛡️ 오픈채팅 안전 수칙 */
  function safetyView(b) {
    var R = [['🔒', '개인정보는 올리지 마세요', '전화번호·주소·계좌번호·주민등록번호·사진 속 개인정보는 오픈채팅에 올리지 마세요. 오픈채팅의 말은 그 방에 들어온 누구나 볼 수 있어요.'],
      ['💸', '돈 이야기는 의심부터', '"선입금", "투자 수익 보장", "링크로 결제" 같은 말은 사기일 수 있어요. 모르는 사람에게 돈을 보내지 마세요.'],
      ['🔗', '모르는 링크는 누르지 마세요', '앱 설치·로그인을 요구하는 링크는 계정을 빼앗는 데 쓰일 수 있어요.'],
      ['🙅', '이런 말은 금지예요', '욕설·혐오·성적인 말, 협박·괴롭힘, 불법 상품·광고, 미성년자에게 해로운 내용. 어기면 방이나 이용이 제한될 수 있어요.'],
      ['🚨', '불쾌하면 바로 차단·신고', '상대 말풍선을 누르면 🚫 차단 · 🚨 신고가 나와요. 신고는 운영자가 확인해요. 급한 위험이 있으면 112(경찰)에 먼저 알려 주세요.'],
      ['🗑️', '대화는 30일 뒤 지워져요', '모든 채팅 메시지는 30일이 지나면 자동으로 지워져요. 방을 만든 사람은 언제든 방을 지울 수 있어요.']];
    b.innerHTML = '<div class="p-lead">🛡️ coverfo 채팅을 모두가 안전하게 쓰기 위한 약속이에요.</div><div class="p-list">' + R.map(function (r) { return '<div class="p-row" style="cursor:default;align-items:flex-start"><span class="ic">' + r[0] + '</span><span class="mid"><span class="nm">' + r[1] + '</span><span class="sub" style="font-size:13px;color:#5d566f">' + r[2] + '</span></span></div>'; }).join('') + '</div>' +
      '<button type="button" class="p-btn g" data-a="go-blocks">🚫 차단한 사람 보기</button>';
  }
  /* 📞 전화통역 기록 — 통화 기록은 포도랑 화면이 이 폰에 저장한다 (coverfo 📞 전화 탭에서 건 통화) */
  function callsView(b) {
    var k = S.callTab || 'log';
    b.innerHTML = '<div class="p-chips" style="margin-bottom:10px">' + [['log', '📜 통화기록'], ['set', '⚙️ 통역 설정'], ['my', '💾 저장현황']].map(function (x) { return '<button type="button" data-a="ctab" data-v="' + x[0] + '" class="' + (k === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="p-mut" style="margin:0 4px 8px">통화기록은 <b>이 폰 안에만</b> 저장돼요 (coverfo 🌐 통역톡 → 📞 전화에서 건 통화). 포도톡 앱에서 건 통화는 따로 저장돼서 여기 안 보일 수 있어요.</div><div id="cfp-cbox"><div class="p-wait">여는 중…</div></div>';
    api({ op: 'call_ticket' }, '/api/trans').then(function (j) {
      var box = $('cfp-cbox'); if (!box) return;
      box.innerHTML = '<iframe class="cfp-call" allow="microphone; autoplay; clipboard-write" style="width:100%;min-height:600px;border:0;border-radius:14px;background:#fff" src="https://podolang.kr/?' + k + '&uid=' + encodeURIComponent(j.ticket) + '"></iframe>';
    }, function (e) { var box = $('cfp-cbox'); if (box) box.innerHTML = errBox(e); });
  }
  window.addEventListener('message', function (ev) {
    try { if (!ev.data || ev.data.podolang !== 'h' || String(ev.origin || '').indexOf('podolang.kr') < 0) return; var f = ov.querySelector('iframe.cfp-call'); if (f) f.style.height = Math.max(600, ev.data.h | 0) + 'px'; } catch (e) {}
  });

  /* ── 다른 곳으로 연결 ── */
  function toHome(hint) {
    close();
    setTimeout(function () {
      var q = document.querySelector('textarea[placeholder*="시켜만"]');
      if (q) { try { q.scrollIntoView({ block: 'center' }); } catch (e) {} try { q.focus(); } catch (e) {} }
      var t = document.createElement('div'); t.textContent = hint;
      t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:rgba(28,24,48,.92);color:#fff;padding:11px 16px;border-radius:12px;font-size:13.5px;z-index:10060;max-width:88vw;text-align:center;line-height:1.5';
      document.body.appendChild(t); setTimeout(function () { t.remove(); }, 4200);
    }, 250);
  }
  function toPodotalk(key) {
    /* 포도톡 창은 자기 뒤로가기 칸을 쓴다 — 이 화면의 칸을 그 칸으로 바꿔 넘겨 준다 (기록이 쌓이지 않게) */
    if (typeof window.cfTalkOpen !== 'function') { alert('잠시 후 다시 눌러 주세요'); return; }
    hide(); try { history.replaceState({ cfTalk: 1 }, ''); } catch (e) {}
    window.cfTalkOpen(key);
  }

  /* ── 누르기 ── */
  ov.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'cfp-file') pickFile(e.target);
    if (e.target && e.target.id === 'cfp-photo' && e.target.files && e.target.files[0]) { tfCollect(); $('cfp-photo-l').textContent = '⏳ 사진 준비 중…'; shrink(e.target.files[0], function (d) { tf()._img = d; toolUI($('cfp-body')); }); }
    if (e.target && e.target.id === 'cfp-receipt' && e.target.files && e.target.files[0]) {
      var o = $('cfp-out'); o.innerHTML = '<div class="p-wait">⏳ 영수증 읽는 중…</div>';
      shrink(e.target.files[0], function (d) {
        if (!d) { o.innerHTML = '<div class="p-err">사진을 읽지 못했어요</div>'; return; }
        api({ op: 'tool', kind: 'receipt', img: d, biz: ledBiz() }).then(function (j) { S.lpre = j; S.lcat = j.cat; ledgerView($('cfp-body')); $('cfp-out').innerHTML = '<div class="p-ok">📷 읽었어요 · 확인하고 <b>＋ 적기</b>를 누르세요 (💳 ' + j.cost + '크레딧)</div>'; }, function (er) { o.innerHTML = errBox(er); });
      });
    }
  });
  ov.addEventListener('keydown', function (e) { if (e.target && e.target.id === 'cfp-tin' && e.key === 'Enter' && !e.shiftKey && !e.isComposing && S.persona !== 'biz') { e.preventDefault(); tSend(); } });
  ov.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-a]') : null; if (!el) return;
    var a = el.getAttribute('data-a');
    if (a === 'close') return close();
    if (a === 'login') return openLogin();
    if (a === 'back') { S.view = S.home; return render(); }
    if (a.indexOf('t-') === 0) { S.view = a.slice(2); S.last = null; W.file = null; return render(); }
    if (a.indexOf('pt-') === 0) return toPodotalk(a.slice(3));
    if (a === 'go-chat') return toHome('입력칸에 시킬 일을 적고 「무엇이든 물어보기」를 누르세요');
    if (a === 'go-agent') return toHome('입력칸 「무엇이든 시켜만 주세요」에 여러 단계 일을 한 번에 적어 보세요');
    if (a === 'go-hub') { close(); location.href = '/hub'; return; }
    if (a === 'go-share') return share('🍇 coverfo — 말만 하면 일하는 AI 비서. 통역·채팅·문서까지 한 곳에서\nhttps://coverfo.com', 'coverfo', null);
    if (a === 'tone') { S.tone = el.getAttribute('data-v'); Array.prototype.forEach.call(el.parentNode.children, function (x) { x.classList.toggle('on', x === el); }); return; }
    if (a === 'kind') { S.kind = el.getAttribute('data-v'); Array.prototype.forEach.call(el.parentNode.children, function (x) { x.classList.toggle('on', x === el); }); return; }
    if (a === 'run') return run(el.getAttribute('data-op'), el);
    if (a === 'saveme') { var m = docMe(); Array.prototype.forEach.call(ov.querySelectorAll('[data-me]'), function (x) { m[x.getAttribute('data-me')] = x.value.trim(); }); ls.set('cfp_docme', JSON.stringify(m)); $('cfp-me-msg').innerHTML = '<div class="p-ok">🏢 저장했어요 · 문서에 자동으로 들어가요</div>'; if (S.last && S.last.items && $('cfp-out').querySelector('.paper')) show('doc', S.last); return; }
    if (a === 'print') { if (S.last && S.last.items) printDoc(S.last); return; }
    if (a === 'intl2doc') { S.kind = 'inv'; S.view = 'doc'; return render(); }
    if (a === 'imgs') return makeImgs(el);
    if (a === 'preset') { var ta = $('cfp-a'); if (ta) ta.value = el.getAttribute('data-p'); Array.prototype.forEach.call(el.parentNode.children, function (x) { x.classList.toggle('on', x === el); }); return; }
    if (a === 'pododa') { var pj = S.last || {}; copy(prodText(pj), $('cfp-msg')); setTimeout(function () { window.open('https://pododa.kr/', '_blank', 'noopener'); }, 300); $('cfp-msg').innerHTML = '<div class="p-ok">📋 상품 정보를 복사했어요 · 포도다 상품 등록 칸에 붙여 넣으세요</div>'; return; }
    if (a === 'mesave') { var mm = meCollect(); return meSave(mm, '🧠 기억했어요 · 이제 답에 반영돼요'); }
    if (a === 'meadd') { var fi = $('cfp-fact'), fv = fi ? fi.value.trim() : ''; if (!fv) return; var m1 = meCollect(); m1.facts = (Array.isArray(m1.facts) ? m1.facts : []); if (m1.facts.indexOf(fv) >= 0) return; if (m1.facts.length >= 40) { alert('40개까지 기억할 수 있어요'); return; } m1.facts.push(fv); return meSave(m1, '＋ 기억했어요'); }
    if (a === 'medel') { var m2 = meCollect(); m2.facts = (m2.facts || []).filter(function (x, i) { return String(i) !== el.getAttribute('data-i'); }); return meSave(m2, '지웠어요'); }
    if (a === 'meclear') { if (!confirm('기억을 전부 지울까요? 되돌릴 수 없어요.')) return; return meSave({}, '모두 지웠어요'); }
    if (a === 'feat') return featGo(+el.getAttribute('data-i'));
    if (a === 'tchip') { var f0 = tfCollect(), ck = el.getAttribute('data-k'), cv = el.getAttribute('data-v'), cdef = (TU[S.tool].chips || []).filter(function (c) { return c.k === ck; })[0]; if (cdef && cdef.multi) { var ix = f0[ck].indexOf(cv); if (ix >= 0) f0[ck].splice(ix, 1); else f0[ck].push(cv); } else f0[ck] = cv; return toolUI($('cfp-body')); }
    if (a === 'trun') return toolRun(el);
    if (a === 'pprint') { if (S.last && S.last.deck) deckPrint(S.last.deck); return; }
    if (a === 'csave') { var cc = cardFromForm(); if (!cc.name && !cc.phone) { $('cfp-msg').innerHTML = '<div class="p-err">이름이나 전화번호를 넣어 주세요</div>'; return; } var cl = cards(); cc.t = Date.now(); cl.unshift(cc); ls.set('cfp_cards', JSON.stringify(cl.slice(0, 300))); $('cfp-msg').innerHTML = '<div class="p-ok">📇 저장했어요 (이 폰)</div>'; return cardList(); }
    if (a === 'cvcf') return vcf(cardFromForm());
    if (a === 'cvcfi') { var c1 = cards()[+el.getAttribute('data-i')]; if (c1) vcf(c1); return; }
    if (a === 'cdel') { if (!confirm('이 명함을 지울까요?')) return; var c2 = cards(); c2.splice(+el.getAttribute('data-i'), 1); ls.set('cfp_cards', JSON.stringify(c2)); return cardList(); }
    if (a === 'lmode') { ls.set('cfp_ledger_mode', el.getAttribute('data-v')); S.lpre = null; return ledgerView($('cfp-body')); }
    if (a === 'lcat') { S.lcat = el.getAttribute('data-v'); Array.prototype.forEach.call(el.parentNode.children, function (x) { x.classList.toggle('on', x === el); }); return; }
    if (a === 'ladd') {
      var amt = parseInt(String($('cfp-lamt').value || '').replace(/[^0-9]/g, ''), 10) || 0; if (!amt) { $('cfp-out').innerHTML = '<div class="p-err">금액을 넣어 주세요</div>'; return; }
      var la = led(); la.push({ ts: Date.now(), date: $('cfp-ldate').value || dayNow(), amount: amt, cat: S.lcat, memo: $('cfp-lmemo').value.trim().slice(0, 60), biz: ledBiz(), ded: S.lpre && S.lpre.ded || '', why: S.lpre && S.lpre.why || '' }); ledSave(la); S.lpre = null; return ledgerView($('cfp-body'));
    }
    if (a === 'ldel') { if (!confirm('이 기록을 지울까요?')) return; ledSave(led().filter(function (x) { return String(x.ts) !== el.getAttribute('data-ts'); })); return ledgerView($('cfp-body')); }
    if (a === 'lai') {
      var biz2 = ledBiz(), ym2 = ymNow(), mm = led().filter(function (e) { return (e.date || '').indexOf(ym2) === 0 && !!e.biz === biz2; }), by2 = {}, tt = 0, dd = {};
      mm.forEach(function (e) { by2[e.cat] = (by2[e.cat] || 0) + e.amount; tt += e.amount; if (e.ded) dd[e.ded] = (dd[e.ded] || 0) + 1; });
      var sum = '이번 달 총 ' + (biz2 ? '경비' : '지출') + ': ' + tt + '원\n' + (biz2 ? '경비 항목별: ' : '카테고리별: ') + Object.keys(by2).map(function (c) { return c + ' ' + by2[c] + '원'; }).join(', ') + '\n건수: ' + mm.length + '건' + (Object.keys(dd).length ? '\n공제 판정: ' + Object.keys(dd).map(function (k) { return k + ' ' + dd[k] + '건'; }).join(', ') : '');
      el.disabled = true; $('cfp-lai').innerHTML = '<div class="p-wait">⏳ 분석 중…</div>';
      return api({ op: 'tool', kind: 'ledger', summary: sum, biz: biz2 }).then(function (j) { el.disabled = false; S.last = j; $('cfp-lai').innerHTML = '<div class="p-res" style="margin-top:8px">' + esc(j.text) + '</div><div class="p-mut" style="margin-top:6px">💳 ' + j.cost + '크레딧 사용</div>'; }, function (e2) { el.disabled = false; $('cfp-lai').innerHTML = errBox(e2); });
    }
    if (a === 'tsend') return tSend();
    if (a === 'tmic') return tMic(el);
    if (a === 'tread') { var on = !tRead(); ls.set('cfp_read_' + S.persona, on ? '1' : '0'); el.textContent = on ? '🔊 읽어주기 켬' : '🔇 읽어주기 끔'; if (!on) { try { speechSynthesis.cancel(); } catch (x) {} } return; }
    if (a === 'tclear') { if (!confirm('이 대화를 지울까요?')) return; tSave([]); return tDraw(); }
    if (a === 'tcopy' || a === 'tshare' || a === 'tsay') { var hm = tHist()[+el.getAttribute('data-i')]; if (!hm) return; if (a === 'tsay') return tSpeak(hm.content); return a === 'tcopy' ? copy(hm.content, null) : share(hm.content, '사장님비서', null); }
    if (a === 'btask' || a === 'btone') { if (a === 'btask') S.bizTask = el.getAttribute('data-v'); else S.bizTone = el.getAttribute('data-v'); Array.prototype.forEach.call(el.parentNode.children, function (x) { x.classList.toggle('on', x === el); }); var ph = BIZ_T.filter(function (x) { return x[0] === S.bizTask; })[0]; if (ph && $('cfp-tin')) $('cfp-tin').placeholder = ph[1]; return; }
    if (a === 'rrun') { var rr = (S.recipes || []).filter(function (x) { return String(x.id) === el.getAttribute('data-id'); })[0]; return hubRun({ op: 'recipe_run', id: +el.getAttribute('data-id') }, rr ? '"' + rr.name + '" 실행 중' : '실행 중'); }
    if (a === 'rok' || a === 'rno') { if (!S.hubState) return; var st = S.hubState; S.hubState = null; return hubRun({ op: 'confirm', state: st, approve: a === 'rok' }, a === 'rok' ? '이어서 진행 중' : '취소하는 중'); }
    if (a === 'rkakao') { var kk = (S.hubKakao || [])[+el.getAttribute('data-i')]; if (kk) share(kk.text || '', '카톡', null); return; }
    if (a === 'rdel') { if (!confirm('이 레시피를 지울까요?')) return; return api({ op: 'recipe_delete', id: +el.getAttribute('data-id') }, HUB).then(function () { loadRecipes(); }, function (er) { $('cfp-rres').innerHTML = errBox(er); }); }
    if (a === 'rsave' || a === 'rreco') {
      var nm = a === 'rreco' ? RECO[+el.getAttribute('data-i')][1] : val('cfp-rname'), gl = a === 'rreco' ? RECO[+el.getAttribute('data-i')][2] : val('cfp-rgoal');
      if (!nm || !gl) { $('cfp-rres').innerHTML = '<div class="p-err">이름과 시킬 말을 적어 주세요</div>'; return; }
      el.disabled = true;
      return api({ op: 'recipe_save', name: nm, goal: gl }, HUB).then(function (j) { el.disabled = false; $('cfp-rres').innerHTML = '<div class="p-ok">📁 "' + esc(nm) + '" ' + (j.updated ? '레시피를 바꿨어요' : '레시피로 담았어요') + '</div>'; if (a === 'rsave') { $('cfp-rname').value = ''; $('cfp-rgoal').value = ''; } loadRecipes(); }, function (er) { el.disabled = false; $('cfp-rres').innerHTML = errBox(er); });
    }
    if (a === 'non') return notifyOn(el);
    if (a === 'noff') return notifyOff();
    if (a === 'ntest') return api({ op: 'push_test' }, HUB).then(function (j) { drawNotify(true, '<div class="p-ok">' + (j.sent ? '시험 알림을 보냈어요' : '보낼 곳이 없어요. 알림을 다시 켜 주세요') + '</div>'); }, function (er) { drawNotify(true, errBox(er)); });
    if (a === 'unblock') return api({ op: 'unblock', id: el.getAttribute('data-id') }, '/api/chat').then(function () { blocksView($('cfp-body')); }, function (er) { $('cfp-blist').insertAdjacentHTML('afterbegin', errBox(er)); });
    if (a === 'go-blocks') { S.home = 'blocks'; S.view = 'blocks'; return render(); }
    if (a === 'ctab') { S.callTab = el.getAttribute('data-v'); return callsView($('cfp-body')); }
    if (a === 'copy' || a === 'share') {
      var j = S.last || {}, k = el.getAttribute('data-k'), t = k === 'outline' ? deckOutline(j.deck) : k === 'doc' ? docText(j) : k === 'prod' ? prodText(j) : k === 'insta' ? String(j.insta || '') + '\n\n' + (j.hash || []).map(function (x) { return '#' + x; }).join(' ') : String(j[k] || '');
      if (j.sources && j.sources.length && (k === 'answer' || k === 'report')) t += '\n\n' + j.sources.map(function (s, i) { return '[' + (i + 1) + '] ' + s.url; }).join('\n');
      return a === 'copy' ? copy(t, $('cfp-msg')) : share(t, TITLE[S.view], $('cfp-msg'));
    }
  });

  function open(home) {
    S.home = HOMES.indexOf(home) >= 0 ? home : 'assist'; S.view = S.home; S.last = null; W.file = null;
    ov.classList.add('on'); document.body.classList.add('cfp-lock');
    try { if (!(history.state && history.state.cfp)) history.pushState({ cfp: 1 }, ''); } catch (e) {}
    render();
  }
  function hide() { ov.classList.remove('on'); ov.classList.remove('big'); document.body.classList.remove('cfp-lock'); try { speechSynthesis.cancel(); } catch (e) {} if (S.rec) { try { S.rec.stop(); } catch (e) {} } }
  function close(fromPop) {
    hide();
    if (fromPop !== true) { try { if (history.state && history.state.cfp) history.back(); } catch (e) {} }
  }
  window.addEventListener('popstate', function () {
    if (!ov.classList.contains('on')) return;
    if (S.view !== S.home) { S.view = S.home; render(); try { history.pushState({ cfp: 1 }, ''); } catch (e) {} return; }
    close(true);
  });
  window.cfPodoyaOpen = open; window.cfPodoyaClose = close;

  /* 홈의 '포도야 비서' · '🔌 고급기능': 포도톡 창 대신 이 화면 (캡처 단계에서 먼저 받는다) */
  window.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('#cf-talk [data-tk="secretary"], #cf-talk [data-tk="adv"], #cf-talk [data-tk="pfn"], #cf-talk [data-tk="routine"], [data-cfp-view]') : null;
    if (!b) return;
    e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
    var k = b.getAttribute('data-cfp-view') || ({ secretary: 'assist', adv: 'adv', pfn: 'feat', routine: 'routine' })[b.getAttribute('data-tk')];
    open(k);
  }, true);
})();
