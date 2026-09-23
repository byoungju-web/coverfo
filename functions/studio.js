// functions/studio.js — coverfo.com/studio : 이미지·영상 생성 화면 (Pages Function 이 HTML 을 돌려줌)
// © 2026 coverfo All Rights Reserved

const HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>coverfo 스튜디오 — 이미지·영상 생성</title>
<style>
:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
*{box-sizing:border-box}
body{margin:0;background:#FCFCFD;color:#111;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:760px;margin:0 auto;padding:14px 14px 40px}
header{display:flex;align-items:center;justify-content:space-between;gap:10px;height:56px}
.logo{display:flex;align-items:center;gap:8px;text-decoration:none;color:#111;font-weight:800;font-size:19px;letter-spacing:-.02em}
.logo b{background:linear-gradient(90deg,#5B6CFF,#8B5CF6);-webkit-background-clip:text;background-clip:text;color:transparent}
.credit{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;background:#fff;border:1px solid rgba(0,0,0,.08);font-size:12.5px;font-weight:600;white-space:nowrap}
.credit i{width:7px;height:7px;border-radius:50%;background:#10B981;display:block}
.card{background:#fff;border:1px solid rgba(0,0,0,.06);border-radius:22px;padding:16px;box-shadow:0 16px 48px -28px rgba(0,0,0,.18);margin-top:10px}
.tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;background:#f4f4f6;padding:4px;border-radius:14px}
.tabs button{height:38px;border:0;border-radius:11px;background:transparent;font-size:14px;font-weight:700;color:#666;cursor:pointer}
.tabs button.on{background:#fff;color:#111;box-shadow:0 2px 8px -2px rgba(0,0,0,.12)}
textarea{width:100%;min-height:96px;margin-top:12px;padding:12px 14px;border-radius:14px;border:1px solid rgba(0,0,0,.1);font-size:16px;line-height:1.5;resize:vertical;outline:none;color:#111;font-family:inherit}
textarea:focus{border-color:#5B6CFF}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}
.chip{height:32px;padding:0 12px;border-radius:999px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12.5px;font-weight:600;color:#333;cursor:pointer}
.chip.on{background:#111;color:#fff;border-color:#111}
.go{margin-left:auto;height:44px;padding:0 18px;border-radius:999px;border:0;background:#111;color:#fff;font-size:14px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:8px}
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
.result{margin-top:14px;display:none}
.result.on{display:block}
.result img,.result video{width:100%;max-width:100%;border-radius:16px;background:#000;display:block}
.dl{display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 14px;border-radius:999px;background:#fff;border:1px solid rgba(0,0,0,.1);font-size:13px;font-weight:600;color:#111;text-decoration:none;margin-top:10px}
h3{font-size:14px;margin:18px 4px 8px;color:#333}
.hist{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.hist a{display:block;border-radius:12px;overflow:hidden;background:#f2f2f4;border:1px solid rgba(0,0,0,.05);text-decoration:none;color:#333;font-size:11px}
.hist .th{aspect-ratio:1/1;background:#e9e9ee;display:grid;place-items:center;font-size:22px;overflow:hidden}
.hist .th img,.hist .th video{width:100%;height:100%;object-fit:cover;display:block}
.hist .t{padding:6px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hist .t small{color:#999;display:block}
.login{margin-top:14px;text-align:center;padding:26px 14px}
.login .btn{display:inline-block;margin-top:12px;height:42px;line-height:42px;padding:0 20px;border-radius:999px;background:#111;color:#fff;font-weight:700;text-decoration:none;font-size:14px}
@media(min-width:640px){.hist{grid-template-columns:repeat(5,1fr)}}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <a class="logo" href="/">cover<b>fo</b> <span style="font-weight:600;font-size:12px;color:#888;margin-left:2px">스튜디오</span></a>
    <span class="credit" id="credit"><i></i>크레딧 확인 중…</span>
  </header>

  <div class="card">
    <div class="tabs">
      <button type="button" id="tab-image" class="on">🎨 이미지 (2K)</button>
      <button type="button" id="tab-video">🎬 영상 8초 (1080p)</button>
    </div>
    <textarea id="prompt" placeholder="무엇을 만들까요? 예) 노을 지는 해변에서 뛰어노는 강아지, 실사 사진"></textarea>
    <div class="row" id="aspects"></div>
    <div class="row">
      <span class="hint" id="costhint"></span>
      <button class="go" id="go" type="button"><span id="golabel">이미지 만들기</span><span class="tag" id="gocost">2 크레딧</span></button>
    </div>
    <div class="msg" id="msg"></div>
    <div class="prog" id="prog"><i></i></div>
    <div class="result" id="result"></div>
  </div>

  <div class="login card" id="loginbox" style="display:none">
    <div style="font-size:15px;font-weight:700">로그인이 필요합니다</div>
    <div class="hint">홈 화면에서 이메일로 로그인한 뒤 다시 열어 주세요.</div>
    <a class="btn" href="/">홈으로 가서 로그인</a>
  </div>

  <h3>최근 만든 것</h3>
  <div class="hist" id="hist"><div class="hint" style="grid-column:1/-1">아직 없습니다.</div></div>
</div>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
(function(){
  var kind = 'image', aspect = '1:1', costs = {image:2, video:25}, client = null, token = null, busy = false;
  var ASPECTS = { image:['1:1','16:9','9:16','4:3','3:4'], video:['16:9','9:16'] };
  var $ = function(id){ return document.getElementById(id); };

  var q = new URLSearchParams(location.search);
  if (q.get('kind') === 'video') kind = 'video';
  if (q.get('prompt')) $('prompt').value = q.get('prompt');

  function show(type, html){ var m=$('msg'); m.className='msg on '+type; m.innerHTML=html; }
  function hideMsg(){ $('msg').className='msg'; }
  function setBusy(b){ busy=b; $('go').disabled=b; $('prog').className = b ? 'prog on' : 'prog'; }

  function renderKind(){
    $('tab-image').className = kind==='image' ? 'on' : '';
    $('tab-video').className = kind==='video' ? 'on' : '';
    if (ASPECTS[kind].indexOf(aspect) < 0) aspect = ASPECTS[kind][0];
    var box = $('aspects'); box.innerHTML = '';
    ASPECTS[kind].forEach(function(a){
      var b=document.createElement('button'); b.type='button'; b.className='chip'+(a===aspect?' on':''); b.textContent=a;
      b.addEventListener('click', function(){ aspect=a; renderKind(); });
      box.appendChild(b);
    });
    $('golabel').textContent = kind==='image' ? '이미지 만들기' : '영상 만들기';
    $('gocost').textContent = costs[kind] + ' 크레딧';
    $('costhint').textContent = kind==='image'
      ? 'Gemini 3 Flash Image · 2K · 보통 10~20초'
      : 'Veo 3.1 · 8초 · 소리 포함 · 보통 1~3분 · 충전 크레딧으로만 가능';
  }
  $('tab-image').addEventListener('click', function(){ kind='image'; renderKind(); });
  $('tab-video').addEventListener('click', function(){ kind='video'; renderKind(); });

  function api(method, qs, body){
    return fetch('/api/gen' + (qs||''), {
      method: method,
      headers: Object.assign({ 'Content-Type':'application/json' }, token ? { Authorization:'Bearer '+token } : {}),
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r){
      return r.text().then(function(t){
        var j; try { j = JSON.parse(t); } catch(e) { j = { error: 'JSON 아님 (HTTP '+r.status+'): '+t.replace(/<[^>]+>/g,' ').replace(/\\s+/g,' ').slice(0,300) }; }
        j.__status = r.status; return j;
      });
    });
  }

  function renderCredits(cr){
    if (!cr) return;
    $('credit').innerHTML = '<i></i>무료 ' + (cr.free||0) + ' · 충전 ' + (cr.paid||0);
  }
  function loadCredits(){ return api('GET','?credits=1').then(function(j){ if(j.__status===200) renderCredits(j); return j; }); }

  function loadHistory(){
    return api('GET','?list=1').then(function(j){
      var h=$('hist'); h.innerHTML='';
      var jobs=(j && j.jobs)||[];
      if(!jobs.length){ h.innerHTML='<div class="hint" style="grid-column:1/-1">아직 없습니다.</div>'; return; }
      jobs.forEach(function(it){
        var a=document.createElement('a'); a.href=it.result_url||'#'; a.target=it.result_url?'_blank':'';
        var th=document.createElement('div'); th.className='th';
        if(it.status==='done'&&it.result_url){
          if(it.kind==='video'){ var v=document.createElement('video'); v.src=it.result_url; v.muted=true; v.playsInline=true; v.preload='metadata'; th.appendChild(v); }
          else { var im=document.createElement('img'); im.src=it.result_url; im.loading='lazy'; th.appendChild(im); }
        } else { th.textContent = it.status==='running'||it.status==='finalizing' ? '⏳' : '✕'; }
        var t=document.createElement('div'); t.className='t';
        t.innerHTML='<span></span><small></small>';
        t.querySelector('span').textContent=(it.prompt||'').slice(0,40);
        t.querySelector('small').textContent=(it.kind==='video'?'영상':'이미지')+' · '+it.cost+'크레딧'+(it.status==='failed'||it.status==='refunded'?' · 실패(환불)':'');
        a.appendChild(th); a.appendChild(t); h.appendChild(a);
        if(it.status==='running'&&it.kind==='video'){ a.addEventListener('click',function(e){ e.preventDefault(); pollVideo(it.id); }); }
        if(it.status==='failed'||it.status==='refunded'){ a.title=it.error||''; a.addEventListener('click',function(e){ e.preventDefault(); show('err','실패 이유: '+(it.error||'(기록 없음)')); }); }
      });
    });
  }

  function showResult(kind, url){
    var r=$('result'); r.innerHTML='';
    if(kind==='video'){ var v=document.createElement('video'); v.src=url; v.controls=true; v.playsInline=true; v.autoplay=true; r.appendChild(v); }
    else { var im=document.createElement('img'); im.src=url; r.appendChild(im); }
    var d=document.createElement('a'); d.className='dl'; d.href=url; d.target='_blank'; d.download=''; d.textContent='⬇ 파일 열기 / 저장';
    r.appendChild(d); r.className='result on';
  }

  var pollTimer=null;
  function pollVideo(jobId){
    if(pollTimer) clearTimeout(pollTimer);
    setBusy(true); show('info','영상을 만드는 중입니다. 보통 1~3분 걸려요. 이 화면을 닫아도 "최근 만든 것"에서 다시 확인할 수 있습니다.');
    var started=Date.now();
    (function tick(){
      api('GET','?job='+jobId).then(function(j){
        if(j.status==='done'){ setBusy(false); show('ok','완성됐습니다.'); showResult('video', j.result_url); loadCredits(); loadHistory(); return; }
        if(j.status==='failed'){ setBusy(false); show('err','실패했습니다. 크레딧은 환불됐습니다.<br>'+(j.error||'')); loadCredits(); loadHistory(); return; }
        if(Date.now()-started > 12*60*1000){ setBusy(false); show('err','시간이 너무 오래 걸립니다. 잠시 후 "최근 만든 것"에서 확인해 주세요.'); return; }
        pollTimer=setTimeout(tick, 10000);
      }).catch(function(){ pollTimer=setTimeout(tick, 15000); });
    })();
  }

  function insufficientMsg(j){
    var need=j.need||costs[kind];
    var have=(j.free||0)+(j.paid||0);
    if(j.paid_only){
      return '영상은 충전 크레딧으로만 만들 수 있습니다. (필요 '+need+' · 충전 잔액 '+(j.paid||0)+')<br><a href="/pricing">크레딧 충전 안내 →</a>';
    }
    return '크레딧이 부족합니다. (필요 '+need+' · 보유 '+have+')<br><a href="/pricing">크레딧 충전 안내 →</a>';
  }

  $('go').addEventListener('click', function(){
    if(busy) return;
    var p=$('prompt').value.trim();
    if(!p){ show('err','무엇을 만들지 적어 주세요.'); return; }
    if(!token){ show('err','로그인이 필요합니다. <a href="/">홈으로</a>'); return; }
    hideMsg(); $('result').className='result'; setBusy(true);
    show('info', kind==='image' ? '이미지를 만드는 중입니다… (10~20초)' : '영상 생성을 시작합니다…');
    api('POST','',{kind:kind, prompt:p, aspect:aspect}).then(function(j){
      if(j.__status===402){ setBusy(false); show('err', insufficientMsg(j)); return; }
      if(j.__status===401){ setBusy(false); show('err','로그인이 풀렸습니다. <a href="/">홈에서 다시 로그인</a>'); return; }
      if(j.__status!==200){ setBusy(false); show('err','실패했습니다'+(j.refunded?' (크레딧 환불됨)':'')+'.<br>'+(j.error||'')); loadCredits(); return; }
      renderCredits({free:j.free, paid:j.paid});
      if(j.status==='done'){ setBusy(false); show('ok','완성됐습니다.'); showResult('image', j.result_url); loadHistory(); return; }
      loadHistory(); pollVideo(j.job_id);
    }).catch(function(e){ setBusy(false); show('err','네트워크 오류: '+e); });
  });

  /* 로그인 세션 읽기: 홈/채팅과 같은 Supabase 프로젝트라 브라우저에 저장된 세션을 그대로 씁니다 */
  fetch('/api/gen?config=1').then(function(r){ return r.json(); }).then(function(cfgv){
    if(cfgv.costImage) costs.image=cfgv.costImage;
    if(cfgv.costVideo) costs.video=cfgv.costVideo;
    renderKind();
    if(!cfgv.url||!cfgv.anonKey||!window.supabase){ show('err','설정이 아직 등록되지 않았습니다. (' + (cfgv.error||'supabase') + ')'); return; }
    client = window.supabase.createClient(cfgv.url, cfgv.anonKey);
    return client.auth.getSession().then(function(r){
      var s = r && r.data && r.data.session;
      if(!s){ $('loginbox').style.display='block'; $('credit').innerHTML='<i style="background:#ccc"></i>로그인 필요'; return; }
      token = s.access_token;
      client.auth.onAuthStateChange(function(_e, sess){ token = sess ? sess.access_token : null; });
      loadCredits(); loadHistory();
    });
  }).catch(function(e){ renderKind(); show('err','설정을 불러오지 못했습니다: '+e); });
})();
</script>
</body>
</html>`;

export async function onRequestGet() {
  return new Response(HTML, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
