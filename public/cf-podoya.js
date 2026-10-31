/* coverfo 🍇 포도야 비서 · 🔌 고급기능 — public/cf-podoya.js (v298 · 1차 + 2차: 업무 자동화 · 내 기억 · 상품 시작하기)
   · 홈의 '포도야 비서' · '🔌 고급기능' 을 누르면 포도톡 창 대신 이 화면이 coverfo 안에서 바로 열린다 (하단 탭 없음)
   · 서버 /api/podoya (coverfo 로그인 · coverfo 지갑): 해외 응대 1 · 문서 만들기 1 · 웹 스크래핑 1 · 시맨틱 검색 1 · 유튜브→블로그 2 · 리서치 3 크레딧
   · coverfo 에 이미 있는 것은 그리로 연결: 대화로 시키기·에이전트팀 → 홈 입력칸 / 커넥션 허브 → 허브 2.0(/hub) / 친구에게 알리기 → 공유
   · 아직 옮기지 않은 것(루틴·매일 리포트·아침 알림·집안 기기·발송 채널)은 포도톡 화면을 탭 없이 띄운다 (landing 의 window.cfTalkOpen) */
(function () {
  if (window.cfPodoyaOpen) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); };
  var ls = { get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var COST = { intl: 1, doc: 1, scrape: 1, search: 1, yt: 2, research: 3, work: 2, launch: 1, img: 2 };
  var TITLE = { assist: '🍇 포도야 비서', adv: '🔌 고급기능', intl: '🌍 해외 응대', doc: '📄 문서 만들기', scrape: '🔍 웹 스크래핑', search: '🧠 시맨틱 검색', yt: '🎬 유튜브 → 블로그', research: '📊 리서치 파이프라인', work: '📊 업무 자동화', launch: '🎨 상품 시작하기', me: '🧠 내 기억' };
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
    'body.cfp-lock{overflow:hidden}';
  document.head.appendChild(css);
  var ov = document.createElement('div'); ov.id = 'cfp'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
  ov.innerHTML = '<div class="p-bar"><button type="button" class="p-back" data-a="back" hidden>←</button><b id="cfp-title">🍇 포도야 비서</b><button type="button" class="p-x" data-a="close">✕ 닫기</button></div><div class="p-body" id="cfp-body"></div>';
  document.body.appendChild(ov);
  var $ = function (id) { return document.getElementById(id); };
  var S = { home: 'assist', view: 'assist', tone: '정중', kind: 'quote', busy: false, last: null };

  /* ── 로그인 토큰 · 서버 (통역톡과 같은 방식) ── */
  function token() {
    try { var c = window.__cfSbClient; if (c && c.auth && c.auth.getSession) return c.auth.getSession().then(function (r) { var s = r && r.data && r.data.session; return s ? s.access_token : null; }); } catch (e) {}
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('sb-') === 0 && k.indexOf('-auth-token') > 0) { var v = JSON.parse(localStorage.getItem(k) || 'null'); if (v && v.access_token) return Promise.resolve(v.access_token); } } } catch (e) {}
    return Promise.resolve(null);
  }
  function api(body) {
    return token().then(function (t) {
      if (!t) { var e = new Error('login'); e.login = true; throw e; }
      return fetch('/api/podoya', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) })
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
    $('cfp-title').textContent = TITLE[S.view] || '🍇 포도야 비서';
    ov.querySelector('[data-a="back"]').hidden = (S.view === S.home);
    var b = $('cfp-body'); b.scrollTop = 0;
    if (S.view === 'assist') return assistView(b);
    if (S.view === 'adv') return advView(b);
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
  ov.addEventListener('change', function (e) { if (e.target && e.target.id === 'cfp-file') pickFile(e.target); });
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
    if (a === 'copy' || a === 'share') {
      var j = S.last || {}, k = el.getAttribute('data-k'), t = k === 'doc' ? docText(j) : k === 'prod' ? prodText(j) : k === 'insta' ? String(j.insta || '') + '\n\n' + (j.hash || []).map(function (x) { return '#' + x; }).join(' ') : String(j[k] || '');
      if (j.sources && j.sources.length && (k === 'answer' || k === 'report')) t += '\n\n' + j.sources.map(function (s, i) { return '[' + (i + 1) + '] ' + s.url; }).join('\n');
      return a === 'copy' ? copy(t, $('cfp-msg')) : share(t, TITLE[S.view], $('cfp-msg'));
    }
  });

  function open(home) {
    S.home = home === 'adv' ? 'adv' : 'assist'; S.view = S.home; S.last = null; W.file = null;
    ov.classList.add('on'); document.body.classList.add('cfp-lock');
    try { if (!(history.state && history.state.cfp)) history.pushState({ cfp: 1 }, ''); } catch (e) {}
    render();
  }
  function hide() { ov.classList.remove('on'); document.body.classList.remove('cfp-lock'); }
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
    var b = e.target && e.target.closest ? e.target.closest('#cf-talk [data-tk="secretary"], #cf-talk [data-tk="adv"]') : null;
    if (!b) return;
    e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
    open(b.getAttribute('data-tk') === 'adv' ? 'adv' : 'assist');
  }, true);
})();
