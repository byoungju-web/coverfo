// functions/subscribe.js — coverfo.com/subscribe : 📅 크레딧 월 구독 (토스페이먼츠 빌링 카드 등록창) v286
// © 2026 coverfo All Rights Reserved
// 서버: functions/api/billing.js · 표: sql/cf_subs.sql · 결제 기록은 /buy 충전 내역에 함께 보임
const HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>크레딧 월 구독 · coverfo</title>
<meta name="description" content="coverfo 크레딧 월 구독 — 매달 자동 결제로 크레딧을 충전합니다. 1개월 단위 자동 갱신, 언제든 해지.">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>
*{box-sizing:border-box}
body{margin:0;background:#FCFCFD;color:#111;font-family:Inter,Pretendard,"Malgun Gothic","Apple SD Gothic Neo",-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}
.wrap{max-width:720px;margin:0 auto;padding:14px 14px 48px}
header{display:flex;align-items:center;justify-content:space-between;gap:10px;height:56px}
.logo{display:flex;align-items:center;gap:8px;text-decoration:none;color:#111;font-weight:800;font-size:19px;letter-spacing:-.02em}
.logo b{background:linear-gradient(90deg,#5B6CFF,#8B5CF6);-webkit-background-clip:text;background-clip:text;color:transparent}
.who{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;background:#fff;border:1px solid rgba(0,0,0,.08);font-size:12.5px;font-weight:600;white-space:nowrap;max-width:60%;overflow:hidden;text-overflow:ellipsis}
.card{background:#fff;border:1px solid rgba(0,0,0,.06);border-radius:22px;padding:18px;box-shadow:0 16px 48px -28px rgba(0,0,0,.18);margin-top:10px}
h1{font-size:20px;margin:0 0 4px}
.sub{font-size:13px;color:#555;margin:0 0 14px;line-height:1.6}
.pl{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}
.pl button{border:2px solid rgba(0,0,0,.08);border-radius:16px;background:#fff;padding:16px 14px;text-align:left;cursor:pointer;font-family:inherit;transition:.15s;color:#111}
.pl button:hover{border-color:#8B5CF6}
.pl button.on{border-color:#6D28D9;background:#F5F3FF}
.pl .nm{font-size:13px;font-weight:700;color:#6D28D9}
.pl .p{font-size:22px;font-weight:800;margin-top:4px}
.pl .p small{font-size:13px;font-weight:600;color:#555;margin-left:2px}
.pl .n{font-size:14px;font-weight:700;margin-top:4px}
.pl .u{font-size:12px;color:#666;margin-top:2px}
.info{margin-top:14px;background:#f7f6fb;border-radius:14px;padding:12px 14px;font-size:13px;line-height:1.75;color:#333}
.info b{color:#111}
.agree{display:flex;gap:9px;align-items:flex-start;margin-top:12px;font-size:13px;line-height:1.55;color:#333;cursor:pointer}
.agree input{width:18px;height:18px;margin-top:1px;accent-color:#6D28D9;flex:none}
.go{width:100%;height:48px;margin-top:14px;border-radius:999px;border:0;background:#6D28D9;color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit}
.go:disabled{opacity:.5;cursor:default}
.go.sec{background:#fff;color:#b91c1c;border:1.5px solid #f3c4c4}
.go.ok{background:#111}
.msg{margin-top:12px;font-size:13.5px;line-height:1.55;padding:12px 14px;border-radius:14px;display:none}
.msg.on{display:block}.msg.info{background:#f4f1fe;color:#5b3fd6}.msg.err{background:#fff1f1;color:#c0392b}.msg.ok{background:#ecfdf5;color:#0a7a52}
.msg a{color:inherit;font-weight:700}
.mine{display:none}
.mine table{width:100%;border-collapse:collapse;font-size:13.5px;margin-top:6px}
.mine th,.mine td{padding:9px 4px;border-bottom:1px solid rgba(0,0,0,.06);text-align:left}
.mine th{color:#666;font-weight:600;width:38%}
.st{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:700}
.st.active{background:#ecfdf5;color:#047857}.st.canceled{background:#fffbeb;color:#92400e}.st.stopped{background:#fef2f2;color:#b91c1c}
.testbar{background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:12px;padding:8px 12px;font-size:12.5px;margin-top:10px;display:none}
.foot{margin-top:18px;font-size:12px;color:#777;line-height:1.7;text-align:center}
.foot a{color:#5B6CFF;font-weight:600;text-decoration:none}
.biz{margin-top:14px;font-size:11.5px;color:#888;line-height:1.7;text-align:center}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <a class="logo" href="/">cover<b>fo</b> <span style="font-weight:600;font-size:12px;color:#888;margin-left:2px">크레딧 월 구독</span></a>
    <span class="who" id="who">확인 중…</span>
  </header>
  <div class="testbar" id="testbar">🧪 테스트 결제 모드 — 실제 돈은 빠져나가지 않습니다.</div>

  <div class="card mine" id="mine">
    <h1>📅 내 구독</h1>
    <table><tbody id="minebody"></tbody></table>
    <button class="go sec" id="cancel" type="button" style="display:none">구독 해지 (다음 결제일부터 결제 안 함)</button>
    <button class="go ok" id="resume" type="button" style="display:none">해지 취소하고 계속 구독</button>
    <div class="msg" id="msg2"></div>
  </div>

  <div class="card" id="buybox">
    <h1>📅 크레딧 월 구독</h1>
    <p class="sub">매달 자동 결제로 크레딧을 충전해 coverfo의 AI 기능(엔진 · 스튜디오 · 렌즈 · 커넥션 허브 · 아침 브리핑 등)에 씁니다. 결제할 때마다 그 달 크레딧이 바로 충전됩니다.</p>
    <div class="pl" id="pl"></div>
    <div class="info" id="info">
      <b>서비스 제공 기간</b> · 결제일부터 1개월. 매월 같은 날 자동 결제(1개월 단위 자동 갱신)<br>
      <b>해지</b> · 언제든 이 화면에서 직접. 해지하면 다음 결제일부터 결제하지 않으며, 이미 충전된 크레딧은 그대로 쓸 수 있어요<br>
      <b>크레딧</b> · 충전 크레딧과 같은 지갑 · 결제일로부터 1년 동안 사용<br>
      <b>환불</b> · 결제 7일 이내이고 그 결제로 받은 크레딧을 쓰지 않았으면 전액, 그 외에는 남은 충전 크레딧 금액에서 10%를 공제하고 환불 (결제 1년 이내 · <a href="/refund">환불정책</a>). 환불하면 구독도 함께 해지돼요<br>
      <b>결제 수단</b> · 신용·체크카드 (토스페이먼츠 카드 등록)
    </div>
    <label class="agree"><input type="checkbox" id="agree"><span>위 내용과 <b>매월 자동 결제</b>에 동의합니다. (해지 전까지 매월 같은 날 선택한 금액이 결제됩니다)</span></label>
    <button class="go" id="go" type="button">요금제를 골라 주세요</button>
    <div class="msg" id="msg"></div>
  </div>

  <div class="card" id="loginbox" style="display:none;text-align:center;padding:26px 14px">
    <div style="font-size:15px;font-weight:700">로그인이 필요합니다</div>
    <div class="sub" style="margin-top:6px">홈 화면에서 로그인한 뒤 다시 열어 주세요.</div>
    <a href="/" style="display:inline-block;height:36px;line-height:36px;padding:0 16px;border-radius:999px;background:#111;color:#fff;text-decoration:none;font-size:13px;font-weight:700">홈으로 가서 로그인</a>
  </div>

  <div class="foot">한 번만 충전하려면 <a href="/buy">크레딧 충전</a> · <a href="/pricing">요금 안내</a> · <a href="/refund">환불정책</a><br>문의: hasin7jk@gmail.com · 표시된 금액은 부가세 포함</div>
  <div class="biz">상호 커버포 · 대표자 이병주 · 사업자등록번호 701-14-02976<br>서울특별시 송파구 오금로 527, 3층 C-6호 (거여동, 성암빌딩) · 전화 010-6540-7338</div>
</div>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" crossorigin="anonymous"></script>
<script src="https://js.tosspayments.com/v2/standard"></script>
<script>
(function(){
  var $ = function(id){ return document.getElementById(id); };
  var q = new URLSearchParams(location.search);
  var CFG = null, client = null, token = null, me = null, plan = null, busy = false;
  var NAME = { sub100:'베이직', sub300:'스탠다드', sub550:'플러스' };
  function won(n){ return Number(n).toLocaleString('ko-KR') + '원'; }
  function day(s){ if(!s) return '-'; var d=new Date(s); return d.getFullYear()+'. '+(d.getMonth()+1)+'. '+d.getDate()+'.'; }
  function show(id, t, h){ var m=$(id); m.className='msg on '+t; m.innerHTML=h; }
  function api(method, qs, body){
    return fetch('/api/billing' + (qs||''), { method: method, headers: Object.assign({ 'Content-Type':'application/json' }, token ? { Authorization:'Bearer '+token } : {}), body: body ? JSON.stringify(body) : undefined })
      .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ j.__status = r.status; return j; }); });
  }
  function canBuy(){ return !!(plan && token && CFG && CFG.enabled && $('agree').checked && !(me && me.sub && (me.sub.status==='active' || (me.sub.status==='canceled' && me.sub.paid_until && new Date(me.sub.paid_until) > new Date())))); }
  function renderPl(){
    var box = $('pl'); box.innerHTML = '';
    (CFG.plans || []).forEach(function(p, i){
      var b = document.createElement('button'); b.type='button'; b.className = (plan && plan.id===p.id) ? 'on' : '';
      b.innerHTML = '<div class="nm">' + (NAME[p.id] || p.id) + (i===1 ? ' · 추천' : '') + '</div><div class="p">' + won(p.amount) + '<small>/월</small></div><div class="n">매달 ' + p.credits + ' 크레딧</div><div class="u">1크레딧당 ' + Math.round(p.amount / p.credits) + '원 · 1개월마다 자동 갱신</div>';
      b.addEventListener('click', function(){ plan = p; renderPl(); });
      box.appendChild(b);
    });
    $('go').textContent = plan ? '카드 등록하고 ' + won(plan.amount) + '/월 구독 시작' : '요금제를 골라 주세요';
    $('go').disabled = !canBuy();
  }
  function renderMe(){
    if (!me) return;
    $('who').textContent = me.email || '로그인됨';
    var s = me.sub;
    if (!s) { $('mine').style.display = 'none'; renderPl(); return; }
    $('mine').style.display = 'block';
    var label = { active:'구독 중', canceled:'해지됨 (이용 기간까지 사용)', stopped:'결제 실패로 멈춤' }[s.status] || s.status;
    var rows = [
      ['상태', '<span class="st ' + s.status + '">' + label + '</span>'],
      ['요금제', (NAME[s.plan] || s.plan) + ' · ' + won(s.amount) + '/월 · 매달 ' + s.credits + ' 크레딧'],
      ['결제 카드', s.card || '-'],
      ['이용 기간', s.paid_until ? '~ ' + day(s.paid_until) : '-'],
      ['다음 결제일', s.status === 'active' && s.next_at ? day(s.next_at) : '없음'],
      ['결제 횟수', (s.period || 0) + '회']
    ];
    if (s.status === 'stopped' && s.last_error) rows.push(['멈춘 이유', String(s.last_error).replace(/[<>&]/g,'')]);
    $('minebody').innerHTML = rows.map(function(r){ return '<tr><th>' + r[0] + '</th><td>' + r[1] + '</td></tr>'; }).join('');
    $('cancel').style.display = s.status === 'active' ? 'block' : 'none';
    $('resume').style.display = (s.status === 'canceled' && s.paid_until && new Date(s.paid_until) > new Date()) ? 'block' : 'none';
    renderPl();
  }
  function loadMe(){ return api('POST', '', { op:'me' }).then(function(j){ if (j.__status===200) { me = j; renderMe(); } }); }
  $('agree').addEventListener('change', function(){ $('go').disabled = !canBuy(); });
  $('go').addEventListener('click', function(){
    if (busy || !canBuy()) return;
    busy = true; $('go').disabled = true; show('msg', 'info', '카드 등록창을 여는 중입니다…');
    api('POST', '', { op:'start', plan: plan.id }).then(function(j){
      if (j.__status !== 200) { busy=false; $('go').disabled=false; show('msg', 'err', j.error || '구독 신청 실패'); return; }
      var tp = window.TossPayments(CFG.clientKey);
      var payment = tp.payment({ customerKey: j.customerKey });
      return payment.requestBillingAuth({
        method: 'CARD',
        successUrl: location.origin + '/api/billing?op=auth',
        failUrl: location.origin + '/subscribe?fail=' + encodeURIComponent('카드 등록이 취소되었거나 실패했습니다'),
        customerEmail: j.email || undefined
      }).catch(function(e){ busy=false; $('go').disabled=false; show('msg', 'err', (e && e.message) || '카드 등록창을 열지 못했습니다'); });
    }).catch(function(e){ busy=false; $('go').disabled=false; show('msg', 'err', '네트워크 오류: ' + e); });
  });
  $('cancel').addEventListener('click', function(){
    if (!me || !me.sub) return;
    if (!confirm('구독을 해지할까요?\\n\\n· ' + day(me.sub.paid_until) + '까지 이용할 수 있고, 그 뒤로는 결제되지 않아요.\\n· 이미 충전된 크레딧은 그대로 쓸 수 있어요.')) return;
    api('POST', '', { op:'cancel' }).then(function(j){ if (j.__status!==200) { show('msg2','err', j.error || '해지 실패'); return; } show('msg2','ok','해지했어요. ' + day(me.sub.paid_until) + '까지 이용할 수 있고, 그 뒤로는 결제되지 않아요.'); return loadMe(); });
  });
  $('resume').addEventListener('click', function(){
    api('POST', '', { op:'resume' }).then(function(j){ if (j.__status!==200) { show('msg2','err', j.error || '실패'); return; } show('msg2','ok','구독을 계속합니다. 다음 결제일에 자동 결제돼요.'); return loadMe(); });
  });

  api('GET', '?config=1').then(function(c){
    CFG = c;
    if (c.testMode) $('testbar').style.display = 'block';
    if (!c.enabled) show('msg', 'info', '구독 결제 준비 중입니다. 지금은 <a href="/buy">크레딧 충전</a>을 이용해 주세요.');
    plan = (c.plans||[])[1] || (c.plans||[])[0] || null;
    var want = q.get('plan'); if (want) { var f = (c.plans||[]).filter(function(p){ return p.id===want; })[0]; if (f) plan = f; }
    renderPl();
    if (!c.url || !c.anonKey || !window.supabase) return;
    client = window.supabase.createClient(c.url, c.anonKey);
    return client.auth.getSession().then(function(r){
      var s = r && r.data && r.data.session;
      if (!s) { $('loginbox').style.display='block'; $('who').textContent='로그인 필요'; renderPl(); return; }
      token = s.access_token;
      return loadMe();
    });
  }).then(function(){
    if (q.get('done')) { show('msg2', 'ok', '구독을 시작했어요! 첫 달 +' + (q.get('credits')||'') + ' 크레딧이 충전됐습니다. <a href="/buy">충전 내역 보기</a>'); history.replaceState({}, '', '/subscribe'); }
    else if (q.get('fail')) { show('msg', 'err', String(q.get('fail')).replace(/[<>&]/g,'')); history.replaceState({}, '', '/subscribe'); }
  }).catch(function(e){ show('msg', 'err', '설정을 불러오지 못했습니다: ' + e); });
})();
</script>
</body>
</html>`;

export async function onRequestGet() {
  return new Response(HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
