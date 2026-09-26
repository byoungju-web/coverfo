// functions/admin.js — coverfo.com/admin : 결제·크레딧 관리자 페이지 (운영자 이메일로 로그인했을 때만)
// © 2026 coverfo All Rights Reserved
const HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>관리자 · coverfo</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#FCFCFD;color:#111;font-family:Inter,Pretendard,"Malgun Gothic","Apple SD Gothic Neo",-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:14px 14px 48px}
header{display:flex;align-items:center;justify-content:space-between;gap:10px;height:56px}
.logo{display:flex;align-items:center;gap:8px;text-decoration:none;color:#111;font-weight:800;font-size:19px;letter-spacing:-.02em}
.logo b{background:linear-gradient(90deg,#5B6CFF,#8B5CF6);-webkit-background-clip:text;background-clip:text;color:transparent}
.who{font-size:12.5px;color:#555}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-top:10px}
.stat{background:#fff;border:1px solid rgba(0,0,0,.06);border-radius:16px;padding:14px 16px}
.stat .k{font-size:12px;color:#666}.stat .v{font-size:22px;font-weight:800;margin-top:4px}.stat .s{font-size:12px;color:#888;margin-top:2px}
.card{background:#fff;border:1px solid rgba(0,0,0,.06);border-radius:22px;padding:16px;box-shadow:0 16px 48px -28px rgba(0,0,0,.18);margin-top:12px}
h2{font-size:15px;margin:0 0 10px;display:flex;align-items:center;gap:8px}
h2 .r{margin-left:auto;font-size:12px;font-weight:500;color:#888}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th,td{padding:8px 6px;border-bottom:1px solid rgba(0,0,0,.06);text-align:left;white-space:nowrap}
th{color:#666;font-weight:600}
.tw{overflow-x:auto}
.st{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700}
.st.paid,.st.manual{background:#ecfdf5;color:#047857}.st.pending{background:#fffbeb;color:#92400e}.st.failed,.st.canceled{background:#fef2f2;color:#b91c1c}
input,select{height:36px;padding:0 12px;border-radius:10px;border:1px solid rgba(0,0,0,.12);font-size:13.5px;font-family:inherit;outline:none}
input:focus{border-color:#5B6CFF}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.btn{height:36px;padding:0 14px;border-radius:999px;border:1px solid rgba(0,0,0,.1);background:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
.btn.pri{background:#6D28D9;color:#fff;border-color:#6D28D9}
.btn.sm{height:28px;padding:0 10px;font-size:12px}
.msg{margin-top:10px;font-size:13px;padding:10px 12px;border-radius:12px;display:none}
.msg.on{display:block}.msg.err{background:#fff1f1;color:#c0392b}.msg.ok{background:#ecfdf5;color:#0a7a52}.msg.info{background:#f4f1fe;color:#5b3fd6}
.deny{text-align:center;padding:40px 14px;color:#555}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <a class="logo" href="/">cover<b>fo</b> <span style="font-weight:600;font-size:12px;color:#888;margin-left:2px">관리자</span></a>
    <span class="who" id="who">확인 중…</span>
  </header>
  <div id="deny" class="deny" style="display:none"></div>
  <div id="main" style="display:none">
    <div class="grid">
      <div class="stat"><div class="k">오늘 매출</div><div class="v" id="s-today">-</div><div class="s" id="s-tcount"></div></div>
      <div class="stat"><div class="k">이달 매출</div><div class="v" id="s-month">-</div><div class="s" id="s-mcount"></div></div>
      <div class="stat"><div class="k">이달 충전 크레딧 (수동 포함)</div><div class="v" id="s-credits">-</div></div>
      <div class="stat"><div class="k">가입 회원</div><div class="v" id="s-users">-</div></div>
    </div>

    <div class="card">
      <h2>수동 충전 / 차감 <span class="r">계좌이체 손님용 · 차감은 음수로</span></h2>
      <div class="row">
        <input id="t-email" type="email" placeholder="회원 이메일" style="flex:1;min-width:220px">
        <input id="t-amount" type="number" placeholder="크레딧 (예: 100, -10)" style="width:170px">
        <input id="t-note" type="text" placeholder="메모 (예: 계좌이체 9,900원)" style="flex:1;min-width:180px">
        <button class="btn pri" id="t-go">반영</button>
      </div>
      <div class="msg" id="t-msg"></div>
    </div>

    <div class="card">
      <h2>회원 · 크레딧 <span class="r" id="u-total"></span></h2>
      <div class="row"><input id="u-q" type="search" placeholder="이메일 검색" style="flex:1;min-width:200px"><button class="btn" id="u-go">검색</button></div>
      <div class="tw" style="margin-top:8px"><table><thead><tr><th>이메일</th><th>무료</th><th>충전</th><th>가입</th><th>최근 접속</th><th></th></tr></thead><tbody id="users"></tbody></table></div>
    </div>

    <div class="card">
      <h2>결제 · 충전 내역 <span class="r">최근 100건</span> <button class="btn sm" id="o-reload" style="margin-left:6px">새로고침</button></h2>
      <div class="tw"><table><thead><tr><th>날짜</th><th>이메일</th><th>패키지</th><th>크레딧</th><th>금액</th><th>결제수단</th><th>상태</th><th>주문번호 / 메모</th></tr></thead><tbody id="orders"></tbody></table></div>
    </div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" crossorigin="anonymous"></script>
<script>
(function(){
  var $ = function(id){ return document.getElementById(id); };
  var token = null;
  function won(n){ return Number(n||0).toLocaleString('ko-KR') + '원'; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function dt(s){ if(!s) return '-'; var d=new Date(s); return d.toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}); }
  function api(method, qs, body){
    return fetch('/api/admin' + (qs||''), { method: method, headers: Object.assign({ 'Content-Type':'application/json' }, token ? { Authorization:'Bearer '+token } : {}), body: body ? JSON.stringify(body) : undefined })
      .then(function(r){ return r.json().then(function(j){ j.__status=r.status; return j; }); });
  }
  function msg(id, t, h){ var m=$(id); m.className='msg on '+t; m.innerHTML=h; }
  function loadSummary(){
    api('GET','?summary=1').then(function(j){
      if (j.__status!==200) return;
      $('s-today').textContent = won(j.today); $('s-tcount').textContent = j.tcount + '건';
      $('s-month').textContent = won(j.month); $('s-mcount').textContent = j.mcount + '건';
      $('s-credits').textContent = Number(j.mcredits||0).toLocaleString('ko-KR');
    });
  }
  function loadOrders(){
    api('GET','?orders=1&limit=100').then(function(j){
      var tb=$('orders'); tb.innerHTML='';
      if (j.__status!==200) { tb.innerHTML='<tr><td colspan="8">'+esc(j.error||'불러오기 실패')+'</td></tr>'; return; }
      if (!j.orders.length) { tb.innerHTML='<tr><td colspan="8" style="color:#888">아직 없습니다.</td></tr>'; return; }
      j.orders.forEach(function(o){
        var label = { paid:'완료', manual:'수동', pending:'미완료', failed:'실패', canceled:'취소' }[o.status] || o.status;
        var tr=document.createElement('tr');
        tr.innerHTML='<td>'+dt(o.paid_at||o.created_at)+'</td><td>'+esc(o.email)+'</td><td>'+esc(o.package)+'</td><td>'+(o.credits>0?'+':'')+o.credits+'</td><td>'+(o.amount?won(o.amount):'-')+'</td><td>'+esc(o.method||'-')+'</td><td><span class="st '+esc(o.status)+'">'+label+'</span></td><td style="white-space:normal;color:#666">'+esc(o.order_id)+(o.note?' · '+esc(o.note):'')+'</td>';
        tb.appendChild(tr);
      });
    });
  }
  function loadUsers(){
    var q = $('u-q').value.trim();
    api('GET','?users=1&q='+encodeURIComponent(q)).then(function(j){
      var tb=$('users'); tb.innerHTML='';
      if (j.__status!==200) { tb.innerHTML='<tr><td colspan="6">'+esc(j.error||'불러오기 실패')+'</td></tr>'; return; }
      $('u-total').textContent = '전체 ' + j.total + '명' + (q ? ' · 검색 ' + j.users.length + '명' : ' · 최근 접속순 200명');
      $('s-users').textContent = j.total + '명';
      j.users.forEach(function(u){
        var tr=document.createElement('tr');
        tr.innerHTML='<td>'+esc(u.email)+'</td><td>'+u.free+'</td><td><b>'+u.paid+'</b></td><td>'+dt(u.created_at)+'</td><td>'+dt(u.last_sign_in_at)+'</td><td></td>';
        var b=document.createElement('button'); b.className='btn sm'; b.textContent='충전';
        b.addEventListener('click', function(){ $('t-email').value=u.email; $('t-amount').focus(); window.scrollTo({top:0,behavior:'smooth'}); });
        tr.lastChild.appendChild(b); tb.appendChild(tr);
      });
    });
  }
  $('u-go').addEventListener('click', loadUsers);
  $('u-q').addEventListener('keydown', function(e){ if(e.key==='Enter') loadUsers(); });
  $('o-reload').addEventListener('click', function(){ loadOrders(); loadSummary(); });
  $('t-go').addEventListener('click', function(){
    var email=$('t-email').value.trim(), amount=parseInt($('t-amount').value,10), note=$('t-note').value.trim();
    if(!email||!amount){ msg('t-msg','err','이메일과 크레딧 수를 적어 주세요'); return; }
    if(!confirm(email+' 에게 '+amount+' 크레딧을 '+(amount>0?'충전':'차감')+'할까요?')) return;
    $('t-go').disabled=true; msg('t-msg','info','반영 중…');
    api('POST','',{op:'topup',email:email,amount:amount,note:note}).then(function(j){
      $('t-go').disabled=false;
      if(j.__status!==200){ msg('t-msg','err',esc(j.error||'실패')); return; }
      msg('t-msg','ok',esc(j.email)+' 반영 완료 · 충전 잔액 '+j.paid);
      $('t-amount').value=''; $('t-note').value='';
      loadUsers(); loadOrders(); loadSummary();
    }).catch(function(e){ $('t-go').disabled=false; msg('t-msg','err','네트워크 오류: '+e); });
  });

  fetch('/api/pay?config=1').then(function(r){ return r.json(); }).then(function(c){
    if(!c.url||!c.anonKey||!window.supabase){ $('deny').style.display='block'; $('deny').textContent='설정이 없습니다'; return; }
    var client = window.supabase.createClient(c.url, c.anonKey);
    return client.auth.getSession().then(function(r){
      var s = r && r.data && r.data.session;
      if(!s){ $('who').textContent='로그인 필요'; $('deny').style.display='block'; $('deny').innerHTML='홈 화면에서 운영자 이메일로 로그인한 뒤 다시 열어 주세요. <a href="/">홈으로</a>'; return; }
      token = s.access_token; $('who').textContent = s.user && s.user.email || '';
      return api('GET','?summary=1').then(function(j){
        if(j.__status===403){ $('deny').style.display='block'; $('deny').textContent='관리자만 볼 수 있는 페이지입니다.'; return; }
        if(j.__status!==200){ $('deny').style.display='block'; $('deny').textContent=j.error||'불러오기 실패'; return; }
        $('main').style.display='block';
        $('s-today').textContent = won(j.today); $('s-tcount').textContent = j.tcount + '건';
        $('s-month').textContent = won(j.month); $('s-mcount').textContent = j.mcount + '건';
        $('s-credits').textContent = Number(j.mcredits||0).toLocaleString('ko-KR');
        loadUsers(); loadOrders();
      });
    });
  }).catch(function(e){ $('deny').style.display='block'; $('deny').textContent='오류: '+e; });
})();
</script>
</body>
</html>`;

export async function onRequestGet() {
  return new Response(HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
