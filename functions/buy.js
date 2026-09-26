// functions/buy.js — coverfo.com/buy : 크레딧 충전 페이지 (토스페이먼츠 결제창)
// © 2026 coverfo All Rights Reserved
const HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>크레딧 충전 · coverfo</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>
*{box-sizing:border-box}
body{margin:0;background:#FCFCFD;color:#111;font-family:Inter,Pretendard,"Malgun Gothic","Apple SD Gothic Neo",-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}
.wrap{max-width:720px;margin:0 auto;padding:14px 14px 48px}
header{display:flex;align-items:center;justify-content:space-between;gap:10px;height:56px}
.logo{display:flex;align-items:center;gap:8px;text-decoration:none;color:#111;font-weight:800;font-size:19px;letter-spacing:-.02em}
.logo b{background:linear-gradient(90deg,#5B6CFF,#8B5CF6);-webkit-background-clip:text;background-clip:text;color:transparent}
.credit{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;background:#fff;border:1px solid rgba(0,0,0,.08);font-size:12.5px;font-weight:600;white-space:nowrap}
.credit i{width:7px;height:7px;border-radius:50%;background:#10B981;display:block}
.card{background:#fff;border:1px solid rgba(0,0,0,.06);border-radius:22px;padding:18px;box-shadow:0 16px 48px -28px rgba(0,0,0,.18);margin-top:10px}
h1{font-size:20px;margin:0 0 4px}
.sub{font-size:13px;color:#555;margin:0 0 14px}
.pk{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
.pk button{border:2px solid rgba(0,0,0,.08);border-radius:16px;background:#fff;padding:16px 14px;text-align:left;cursor:pointer;font-family:inherit;transition:.15s}
.pk button:hover{border-color:#8B5CF6}
.pk button.on{border-color:#6D28D9;background:#F5F3FF}
.pk .n{font-size:22px;font-weight:800}
.pk .n small{font-size:13px;font-weight:600;color:#555;margin-left:4px}
.pk .p{font-size:15px;font-weight:700;margin-top:6px}
.pk .u{font-size:12px;color:#666;margin-top:2px}
.pk .tag{display:inline-block;font-size:10.5px;font-weight:700;color:#fff;background:linear-gradient(135deg,#8B5CF6,#5B6CFF);border-radius:999px;padding:2px 8px;margin-bottom:6px}
.methods{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.chip{height:34px;padding:0 14px;border-radius:999px;border:1px solid rgba(0,0,0,.1);background:#fff;font-size:13px;font-weight:600;color:#333;cursor:pointer;font-family:inherit}
.chip.on{background:#111;color:#fff;border-color:#111}
.go{width:100%;height:48px;margin-top:14px;border-radius:999px;border:0;background:#6D28D9;color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit}
.go:disabled{opacity:.5;cursor:default}
.msg{margin-top:12px;font-size:13.5px;line-height:1.55;padding:12px 14px;border-radius:14px;display:none}
.msg.on{display:block}.msg.info{background:#f4f1fe;color:#5b3fd6}.msg.err{background:#fff1f1;color:#c0392b}.msg.ok{background:#ecfdf5;color:#0a7a52}
.msg a{color:inherit;font-weight:700}
h3{font-size:14px;margin:18px 4px 8px;color:#333}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th,td{padding:8px 6px;border-bottom:1px solid rgba(0,0,0,.06);text-align:left;white-space:nowrap}
th{color:#666;font-weight:600}
.st{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700}
.st.paid,.st.manual{background:#ecfdf5;color:#047857}.st.pending{background:#fffbeb;color:#92400e}.st.failed,.st.canceled{background:#fef2f2;color:#b91c1c}
.foot{margin-top:18px;font-size:12px;color:#777;line-height:1.6;text-align:center}
.foot a{color:#5B6CFF;font-weight:600;text-decoration:none}
.testbar{background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:12px;padding:8px 12px;font-size:12.5px;margin-top:10px;display:none}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <a class="logo" href="/">cover<b>fo</b> <span style="font-weight:600;font-size:12px;color:#888;margin-left:2px">크레딧 충전</span></a>
    <span class="credit" id="credit"><i style="background:#ccc"></i>확인 중…</span>
  </header>
  <div class="testbar" id="testbar">🧪 테스트 결제 모드 — 실제 돈은 빠져나가지 않습니다. 카드번호 등은 아무 값이나 넣어도 됩니다.</div>

  <div class="card">
    <h1>크레딧 충전</h1>
    <p class="sub">1크레딧 ≈ 99원 · 기간 제한 없음 · 결제 즉시 충전 · 실패한 생성은 자동 환불</p>
    <div class="pk" id="pk"></div>
    <div class="methods" id="methods">
      <button type="button" class="chip on" data-m="CARD">💳 카드 · 간편결제</button>
      <button type="button" class="chip" data-m="TRANSFER">🏦 계좌이체</button>
      <button type="button" class="chip" data-m="MOBILE_PHONE">📱 휴대폰</button>
    </div>
    <button class="go" id="go" type="button">결제하기</button>
    <div class="msg" id="msg"></div>
  </div>

  <div class="card" id="loginbox" style="display:none;text-align:center;padding:26px 14px">
    <div style="font-size:15px;font-weight:700">로그인이 필요합니다</div>
    <div class="sub" style="margin-top:6px">홈 화면에서 이메일로 로그인한 뒤 다시 열어 주세요.</div>
    <a class="chip" href="/" style="display:inline-block;line-height:34px;background:#111;color:#fff;border-color:#111;text-decoration:none">홈으로 가서 로그인</a>
  </div>

  <h3>충전 내역</h3>
  <div class="card" style="margin-top:0;padding:8px 12px">
    <table><thead><tr><th>날짜</th><th>크레딧</th><th>금액</th><th>상태</th></tr></thead><tbody id="orders"><tr><td colspan="4" style="color:#888">아직 없습니다.</td></tr></tbody></table>
  </div>

  <div class="foot">문의: hasin7jk@gmail.com · 표시된 금액은 부가세 포함 · <a href="/pricing">요금제 안내</a></div>
</div>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" crossorigin="anonymous"></script>
<script src="https://js.tosspayments.com/v2/standard"></script>
<script>
(function(){
  var $ = function(id){ return document.getElementById(id); };
  var q = new URLSearchParams(location.search);
  var CFG = null, client = null, token = null, me = null, pkg = null, method = 'CARD', busy = false;
  function show(t, h){ var m=$('msg'); m.className='msg on '+t; m.innerHTML=h; }
  function won(n){ return Number(n).toLocaleString('ko-KR') + '원'; }
  function api(method, qs, body){
    return fetch('/api/pay' + (qs||''), { method: method, headers: Object.assign({ 'Content-Type':'application/json' }, token ? { Authorization:'Bearer '+token } : {}), body: body ? JSON.stringify(body) : undefined })
      .then(function(r){ return r.json().then(function(j){ j.__status = r.status; return j; }); });
  }
  function renderPk(){
    var box = $('pk'); box.innerHTML = '';
    (CFG.packages || []).forEach(function(p, i){
      var b = document.createElement('button'); b.type='button'; b.className = (pkg && pkg.id===p.id) ? 'on' : '';
      var unit = Math.round(p.amount / p.credits);
      b.innerHTML = (i===1 ? '<span class="tag">가장 많이 선택</span><br>' : '') + '<span class="n">' + p.credits + '<small>크레딧</small></span><div class="p">' + won(p.amount) + '</div><div class="u">1크레딧당 ' + unit + '원</div>';
      b.addEventListener('click', function(){ pkg = p; renderPk(); });
      box.appendChild(b);
    });
    $('go').textContent = pkg ? won(pkg.amount) + ' 결제하기 (' + pkg.credits + '크레딧)' : '패키지를 골라 주세요';
    $('go').disabled = !pkg || !token || !CFG.enabled;
  }
  function renderMe(){
    if (!me) return;
    $('credit').innerHTML = '<i></i>' + (me.email||'') + ' · 무료 ' + me.free + ' · 충전 ' + me.paid;
    var tb = $('orders'); tb.innerHTML = '';
    if (!me.orders || !me.orders.length) { tb.innerHTML = '<tr><td colspan="4" style="color:#888">아직 없습니다.</td></tr>'; return; }
    me.orders.forEach(function(o){
      var tr = document.createElement('tr');
      var d = new Date(o.paid_at || o.created_at);
      var label = { paid:'완료', manual:'수동 충전', pending:'미완료', failed:'실패', canceled:'취소' }[o.status] || o.status;
      tr.innerHTML = '<td>' + d.toLocaleString('ko-KR', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' }) + '</td><td>' + (o.credits>0?'+':'') + o.credits + '</td><td>' + (o.amount ? won(o.amount) : '-') + '</td><td><span class="st ' + o.status + '">' + label + '</span></td>';
      tb.appendChild(tr);
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('#methods .chip'), function(b){
    b.addEventListener('click', function(){ method = b.getAttribute('data-m'); Array.prototype.forEach.call(document.querySelectorAll('#methods .chip'), function(x){ x.className = 'chip' + (x===b?' on':''); }); });
  });
  $('go').addEventListener('click', function(){
    if (busy || !pkg || !token) return;
    busy = true; $('go').disabled = true; show('info', '결제창을 여는 중입니다…');
    api('POST', '', { op:'create', package: pkg.id }).then(function(j){
      if (j.__status !== 200) { busy=false; $('go').disabled=false; show('err', j.error || '주문 생성 실패'); return; }
      var tp = window.TossPayments(CFG.clientKey);
      var payment = tp.payment({ customerKey: j.customerKey });
      return payment.requestPayment({
        method: method,
        amount: { currency: 'KRW', value: j.amount },
        orderId: j.orderId,
        orderName: j.orderName,
        successUrl: location.origin + '/api/pay?op=confirm',
        failUrl: location.origin + '/buy?fail=' + encodeURIComponent('결제가 취소되었거나 실패했습니다'),
        customerEmail: j.email || undefined,
      }).catch(function(e){ busy=false; $('go').disabled=false; show('err', (e && e.message) || '결제창을 열지 못했습니다'); });
    }).catch(function(e){ busy=false; $('go').disabled=false; show('err', '네트워크 오류: ' + e); });
  });

  api('GET', '?config=1').then(function(c){
    CFG = c;
    if (c.testMode) $('testbar').style.display = 'block';
    if (!c.enabled) show('info', '결제 준비 중입니다. 지금은 <a href="mailto:hasin7jk@gmail.com?subject=coverfo 크레딧 충전 문의">이메일 문의</a>로 충전해 드립니다.');
    pkg = (c.packages||[])[1] || (c.packages||[])[0] || null;
    renderPk();
    if (!c.url || !c.anonKey || !window.supabase) return;
    client = window.supabase.createClient(c.url, c.anonKey);
    return client.auth.getSession().then(function(r){
      var s = r && r.data && r.data.session;
      if (!s) { $('loginbox').style.display='block'; $('credit').innerHTML='<i style="background:#ccc"></i>로그인 필요'; renderPk(); return; }
      token = s.access_token; renderPk();
      return api('GET', '?me=1').then(function(j){ if (j.__status===200) { me = j; renderMe(); } });
    });
  }).then(function(){
    if (q.get('done')) { show('ok', '충전됐습니다! +' + (q.get('credits')||'') + ' 크레딧. <a href="/engine">엔진으로 가기</a> · <a href="/studio">스튜디오로 가기</a>'); history.replaceState({}, '', '/buy'); }
    else if (q.get('fail')) { show('err', q.get('fail')); history.replaceState({}, '', '/buy'); }
  }).catch(function(e){ show('err', '설정을 불러오지 못했습니다: ' + e); });
})();
</script>
</body>
</html>`;

export async function onRequestGet() {
  return new Response(HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
