// functions/studio-app.js — coverfo.com/studio-app : 이미지·영상 생성 화면 본체 (사이드 메뉴가 있는 /studio 안에 iframe 으로 들어감)
// © 2026 coverfo All Rights Reserved

const HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>coverfo 스튜디오 — 이미지·영상 생성</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22cf-grad%22%20x1%3D%223%22%20y1%3D%225%22%20x2%3D%2227%22%20y2%3D%2227%22%3E%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%235B6CFF%22%2F%3E%3Cstop%20offset%3D%2255%25%22%20stop-color%3D%22%238B5CF6%22%2F%3E%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%237C5CFF%22%2F%3E%3C%2FlinearGradient%3E%3ClinearGradient%20id%3D%22cf-grad2%22%20x1%3D%2228%22%20y1%3D%227%22%20x2%3D%224%22%20y2%3D%2225%22%3E%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%238B5CF6%22%2F%3E%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%2310B981%22%2F%3E%3C%2FlinearGradient%3E%3ClinearGradient%20id%3D%22cf-lens%22%20x1%3D%2212%22%20y1%3D%2212%22%20x2%3D%2220%22%20y2%3D%2220%22%3E%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%235B6CFF%22%20stop-opacity%3D%220.28%22%2F%3E%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%2310B981%22%20stop-opacity%3D%220.32%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Cpath%20d%3D%22M%2012%2012%20C%2014.2%2013.2%2017.8%2013.2%2020%2012%20C%2021.2%2014.5%2021.2%2017.5%2020%2020%20C%2017.8%2018.8%2014.2%2018.8%2012%2020%20C%2010.8%2017.5%2010.8%2014.5%2012%2012%20Z%22%20fill%3D%22url%28%23cf-lens%29%22%2F%3E%3Cpath%20d%3D%22M%2020%207.5%20A%208.5%208.5%200%201%200%2020%2024.5%20A%208.5%208.5%200%201%200%2020%207.5%22%20stroke%3D%22url%28%23cf-grad2%29%22%20stroke-width%3D%223.1%22%20stroke-linecap%3D%22round%22%2F%3E%3Cpath%20d%3D%22M%2017.85%2022.95%20A%208.5%208.5%200%201%201%2017.13%209.45%22%20stroke%3D%22url%28%23cf-grad%29%22%20stroke-width%3D%223.1%22%20stroke-linecap%3D%22round%22%2F%3E%3Cpath%20d%3D%22M%2017.13%209.45%20L%2019.8%2011.2%22%20stroke%3D%22%238B5CF6%22%20stroke-width%3D%221.1%22%20stroke-linecap%3D%22round%22%20opacity%3D%220.9%22%2F%3E%3Ccircle%20cx%3D%2216%22%20cy%3D%2216%22%20r%3D%221.15%22%20fill%3D%22%235B6CFF%22%20opacity%3D%220.9%22%2F%3E%3C%2Fsvg%3E">
<style>
:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
*{box-sizing:border-box}
body{margin:0;background:#FCFCFD;color:#111;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:960px;margin:0 auto;padding:14px 14px 40px}
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
.hist .th{aspect-ratio:1/1;background:#e9e9ee;display:grid;place-items:center;font-size:22px;overflow:hidden}
.hist .th img,.hist .th video{width:100%;height:100%;object-fit:cover;display:block}
.hist .t{padding:6px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hist .t small{color:#999;display:block}
.src{display:none;align-items:center;gap:10px;margin-top:12px;padding:8px 10px;border-radius:14px;background:#f4f1fe;border:1px solid rgba(91,108,255,.18)}
.src.on{display:flex}
.src img{width:52px;height:52px;object-fit:cover;border-radius:10px;flex:none;background:#ddd}
.src .txt{font-size:12.5px;color:#4b3fb0;line-height:1.45;min-width:0}
.src .txt b{display:block;color:#111}
.src button{margin-left:auto;flex:none;height:30px;padding:0 10px;border-radius:999px;border:1px solid rgba(0,0,0,.1);background:#fff;font-size:12px;cursor:pointer}
.hist .acts{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:0 6px 7px}
.hist .acts button{height:26px;border-radius:8px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:11px;font-weight:600;color:#333;cursor:pointer}
.hist .acts button.del{color:#c0392b}
.hist .acts button.pri{background:#111;color:#fff;border-color:#111}
.hist .acts button:disabled{opacity:.5}
.hist .it{display:block;border-radius:12px;overflow:hidden;background:#f2f2f4;border:1px solid rgba(0,0,0,.05);color:#333;font-size:11px}
.hist .it .th{cursor:pointer}
.login{margin-top:14px;text-align:center;padding:26px 14px}
.login .btn{display:inline-block;margin-top:12px;height:42px;line-height:42px;padding:0 20px;border-radius:999px;background:#111;color:#fff;font-weight:700;text-decoration:none;font-size:14px}
@media(min-width:640px){.hist{grid-template-columns:repeat(5,1fr)}}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <a class="logo" href="/" target="_top">cover<b>fo</b> <span style="font-weight:600;font-size:12px;color:#888;margin-left:2px">스튜디오</span></a>
    <span class="credit" id="credit"><i></i>크레딧 확인 중…</span>
  </header>

  <div class="card">
    <div class="tabs">
      <button type="button" id="tab-image" class="on">🎨 이미지 (2K)</button>
      <button type="button" id="tab-video">🎬 영상 8초 (1080p)</button>
    </div>
    <div class="src" id="srcbox"><img id="srcimg" alt="" crossorigin="anonymous"><div class="txt"><b id="srctitle">원본 이미지</b><span id="srcdesc"></span></div><button type="button" id="srcclear">원본 해제</button></div>
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
    <a class="btn" href="/" target="_top">홈으로 가서 로그인</a>
  </div>

  <h3 id="histtitle">최근 만든 것</h3>
  <div class="hist" id="hist"><div class="hint" style="grid-column:1/-1">아직 없습니다.</div></div>
</div>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" crossorigin="anonymous"></script>
<script>
(function(){
  var kind = 'image', aspect = '1:1', costs = {image:2, video:25}, client = null, token = null, busy = false;
  var SRC = null; // 원본 이미지 {id, url, prompt}
  var ASPECTS = { image:['1:1','16:9','9:16','4:3','3:4'], video:['16:9','9:16'] };
  var $ = function(id){ return document.getElementById(id); };
  var DONE_PROMPT = false; // 생성이 끝난 직후면 true → 입력칸을 클릭할 때 이전 문구를 지움
  function markDone(){ DONE_PROMPT = true; }
  $('prompt').addEventListener('focus', function(){
    if (DONE_PROMPT) { DONE_PROMPT = false; $('prompt').value = ''; }
  });
  $('prompt').addEventListener('input', function(){ DONE_PROMPT = false; });

  var q = new URLSearchParams(location.search);
  if (q.get('kind') === 'video') kind = 'video';
  if (q.get('prompt')) $('prompt').value = q.get('prompt');

  function show(type, html){ var m=$('msg'); m.className='msg on '+type; m.innerHTML=html; }
  function hideMsg(){ $('msg').className='msg'; }
  /* 틀(iframe) 안에서 열렸으면 바깥 창 주소도 /studio 로 정리 (같은 도메인이라 가능) */
  function cleanTopUrl(){
    try { if (window.top && window.top !== window && window.top.location.pathname === '/studio') window.top.history.replaceState({}, '', '/studio'); } catch (e) {}
  }
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
    if (SRC) {
      $('golabel').textContent = kind==='image' ? '이미지 수정하기' : '이 이미지로 영상 만들기';
      $('srctitle').textContent = kind==='image' ? '원본 이미지 — 바꿀 내용을 적어 주세요' : '첫 장면 이미지 — 어떻게 움직일지 적어 주세요';
      $('srcdesc').textContent = '#'+SRC.id+' · '+(SRC.prompt||'').slice(0,60);
      $('srcimg').src = SRC.url; $('srcbox').className='src on';
    } else {
      $('golabel').textContent = kind==='image' ? '이미지 만들기' : '영상 만들기';
      $('srcbox').className='src';
    }
    $('histtitle').textContent = kind==='image' ? '최근 만든 이미지' : '최근 만든 영상';
    $('gocost').textContent = costs[kind] + ' 크레딧';
    if (typeof renderHistory === 'function' && JOBS.length) renderHistory();
    $('costhint').textContent = kind==='image'
      ? (SRC ? '원본을 기준으로 고쳐서 새 이미지를 만듭니다 · 2K' : 'Gemini 3 Flash Image · 2K · 보통 10~20초')
      : (SRC ? '이미지를 첫 장면으로 8초 영상을 만듭니다 · 보통 1~3분' : 'Veo 3.1 · 8초 · 소리 포함 · 보통 1~3분 · 충전 크레딧으로만 가능');
  }
  function setSource(it, toKind){
    SRC = it ? { id: it.id, url: it.result_url, prompt: it.prompt||'' } : null;
    if (toKind) kind = toKind;
    if (it && toKind==='image' && !$('prompt').value.trim()) $('prompt').placeholder = '예) 모자를 씌워줘 / 배경을 밤으로 / 옷을 빨간색으로';
    if (it && toKind==='video') $('prompt').value = (it.prompt||'');
    renderKind();
    $('result').className='result'; hideMsg();
    window.scrollTo({top:0,behavior:'smooth'});
    $('prompt').focus();
  }
  $('srcclear').addEventListener('click', function(){ setSource(null); });
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

  var POOL = null;
  function renderCredits(cr){
    if (!cr) return;
    if (cr.pool) POOL = cr.pool;
    var extra = '';
    if (POOL) {
      extra = POOL.open ? ' · 이달 무료 남음 ' + POOL.remaining + '/' + POOL.cap : ' · 무료 기간 종료';
    }
    $('credit').innerHTML = '<i' + (POOL && (!POOL.open || POOL.remaining <= 0) ? ' style="background:#f59e0b"' : '') + '></i>무료 ' + (cr.free||0) + ' · 충전 ' + (cr.paid||0) + extra;
  }
  function loadCredits(){ return api('GET','?credits=1').then(function(j){ if(j.__status===200) renderCredits(j); return j; }); }

  var JOBS = [];
  var SHOW_ID = q.get('show') ? String(q.get('show')) : '';
  function loadHistory(){
    return api('GET','?list=1').then(function(j){
      JOBS=(j && j.jobs)||[];
      /* 사이드바 썸네일에서 넘어온 경우(show=번호): 그 항목의 탭으로 바꾸고 위에 크게 보여줌 */
      if (SHOW_ID) {
        var hit = JOBS.filter(function(x){ return String(x.id)===SHOW_ID; })[0];
        SHOW_ID = '';
        try { history.replaceState({}, '', '/studio-app'); } catch (e) {}
        cleanTopUrl();
        if (hit && hit.status==='done' && hit.result_url) {
          kind = hit.kind; renderKind(); showResult(hit.kind, hit.result_url);
          $('prompt').value = (hit.prompt||'').replace(/^\[수정 #\d+\] /,''); markDone();
        }
      }
      renderHistory();
    });
  }
  function saveFile(url, name){
    // 저장소가 다른 주소라 download 속성이 안 먹어서, 파일을 받아서 저장시킵니다
    return fetch(url).then(function(r){ return r.blob(); }).then(function(b){
      var o=URL.createObjectURL(b); var a=document.createElement('a'); a.href=o; a.download=name; document.body.appendChild(a); a.click();
      setTimeout(function(){ URL.revokeObjectURL(o); a.remove(); }, 2000);
    }).catch(function(){ window.open(url,'_blank'); });
  }
  function renderHistory(){
    var h=$('hist'); h.innerHTML='';
    var jobs=JOBS.filter(function(it){ return it.kind===kind; });
    if(!jobs.length){ h.innerHTML='<div class="hint" style="grid-column:1/-1">아직 없습니다.</div>'; return; }
    jobs.forEach(function(it){
      var card=document.createElement('div'); card.className='it';
      var th=document.createElement('div'); th.className='th';
      var done = it.status==='done'&&it.result_url;
      if(done){
        if(it.kind==='video'){ var v=document.createElement('video'); v.crossOrigin='anonymous'; v.src=it.result_url; v.muted=true; v.playsInline=true; v.preload='metadata'; th.appendChild(v); }
        else { var im=document.createElement('img'); im.crossOrigin='anonymous'; im.src=it.result_url; im.loading='lazy'; th.appendChild(im); }
        th.addEventListener('click', function(){ hideMsg(); showResult(it.kind, it.result_url); window.scrollTo({top:0,behavior:'smooth'}); });
      } else if(it.status==='running'||it.status==='finalizing'){
        th.textContent='⏳'; if(it.kind==='video'){ th.addEventListener('click',function(){ pollVideo(it.id); }); }
      } else {
        th.textContent='✕'; th.title=it.error||''; th.addEventListener('click',function(){ show('err','실패 이유: '+(it.error||'(기록 없음)')); });
      }
      var t=document.createElement('div'); t.className='t';
      t.innerHTML='<span></span><small></small>';
      t.querySelector('span').textContent=(it.prompt||'').slice(0,40);
      t.querySelector('small').textContent=(it.kind==='video'?'영상':'이미지')+' · '+it.cost+'크레딧'+(it.status==='failed'||it.status==='refunded'?' · 실패(환불)':'');
      var acts=document.createElement('div'); acts.className='acts';
      var bs=document.createElement('button'); bs.type='button'; bs.textContent='저장'; bs.disabled=!done;
      bs.addEventListener('click', function(){ saveFile(it.result_url, 'coverfo-'+it.id+(it.kind==='video'?'.mp4':'.png')); });
      var bd=document.createElement('button'); bd.type='button'; bd.className='del'; bd.textContent='삭제';
      bd.disabled=(it.status==='running'||it.status==='finalizing');
      bd.addEventListener('click', function(){
        if(!confirm('이 항목을 삭제할까요? 파일도 함께 지워집니다.')) return;
        bd.disabled=true; bd.textContent='삭제 중';
        api('DELETE','?job='+it.id).then(function(j){
          if(j.__status!==200){ bd.disabled=false; bd.textContent='삭제'; show('err','삭제 실패: '+(j.error||'')); return; }
          JOBS=JOBS.filter(function(x){ return x.id!==it.id; }); renderHistory();
        });
      });
      if(done && it.kind==='image'){
        var be=document.createElement('button'); be.type='button'; be.className='pri'; be.textContent='수정';
        be.addEventListener('click', function(){ $('prompt').value=''; setSource(it,'image'); });
        var bv=document.createElement('button'); bv.type='button'; bv.textContent='영상으로';
        bv.addEventListener('click', function(){ setSource(it,'video'); });
        acts.appendChild(be); acts.appendChild(bv);
      } else if(it.kind==='video'){
        var br=document.createElement('button'); br.type='button'; br.className='pri'; br.textContent='다시';
        br.addEventListener('click', function(){ SRC=null; kind='video'; $('prompt').value=(it.prompt||'').replace(/^\[수정 #\d+\] /,''); renderKind(); window.scrollTo({top:0,behavior:'smooth'}); $('prompt').focus(); });
        acts.appendChild(br);
      }
      acts.appendChild(bs); acts.appendChild(bd);
      card.appendChild(th); card.appendChild(t); card.appendChild(acts); h.appendChild(card);
    });
  }

  function showResult(kind, url){
    var r=$('result'); r.innerHTML='';
    if(kind==='video'){ var v=document.createElement('video'); v.crossOrigin='anonymous'; v.src=url; v.controls=true; v.playsInline=true; v.autoplay=true; r.appendChild(v); }
    else { var im=document.createElement('img'); im.crossOrigin='anonymous'; im.src=url; r.appendChild(im); }
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
        if(j.status==='done'){ setBusy(false); show('ok','완성됐습니다.'); showResult('video', j.result_url); loadCredits(); loadHistory(); markDone(); return; }
        if(j.status==='failed'){ setBusy(false); show('err','실패했습니다. 크레딧은 환불됐습니다.<br>'+(j.error||'')); loadCredits(); loadHistory(); return; }
        if(Date.now()-started > 12*60*1000){ setBusy(false); show('err','시간이 너무 오래 걸립니다. 잠시 후 "최근 만든 것"에서 확인해 주세요.'); return; }
        pollTimer=setTimeout(tick, 10000);
      }).catch(function(){ pollTimer=setTimeout(tick, 15000); });
    })();
  }

  function insufficientMsg(j){
    var need=j.need||costs[kind];
    var have=(j.free||0)+(j.paid||0);
    if(j.pool) POOL=j.pool;
    if(j.reason==='pool_exhausted'){
      return '이번 달 무료 이용 한도가 모두 소진되었습니다. 다음 달 1일에 다시 열립니다. 충전 크레딧은 계속 쓸 수 있습니다. (필요 '+need+' · 충전 잔액 '+(j.paid||0)+')<br><a href="/pricing" target="_top">크레딧 충전 안내 →</a>';
    }
    if(j.reason==='free_closed'){
      return '무료 크레딧 제공 기간이 끝났습니다. 충전 크레딧으로 이용해 주세요. (필요 '+need+' · 충전 잔액 '+(j.paid||0)+')<br><a href="/pricing" target="_top">크레딧 충전 안내 →</a>';
    }
    if(j.paid_only){
      return '영상은 충전 크레딧으로만 만들 수 있습니다. (필요 '+need+' · 충전 잔액 '+(j.paid||0)+')<br><a href="/pricing" target="_top">크레딧 충전 안내 →</a>';
    }
    return '크레딧이 부족합니다. (필요 '+need+' · 보유 '+have+')<br><a href="/pricing" target="_top">크레딧 충전 안내 →</a>';
  }

  $('go').addEventListener('click', function(){
    if(busy) return;
    var p=$('prompt').value.trim();
    if(!p){ show('err','무엇을 만들지 적어 주세요.'); return; }
    if(!token){ show('err','로그인이 필요합니다. <a href="/" target="_top">홈으로</a>'); return; }
    hideMsg(); $('result').className='result'; setBusy(true);
    show('info', kind==='image' ? '이미지를 만드는 중입니다… (10~20초)' : '영상 생성을 시작합니다…');
    api('POST','',{kind:kind, prompt:p, aspect:aspect, source_job: SRC ? SRC.id : undefined}).then(function(j){
      if(j.__status===402){ setBusy(false); show('err', insufficientMsg(j)); return; }
      if(j.__status===401){ setBusy(false); show('err','로그인이 풀렸습니다. <a href="/" target="_top">홈에서 다시 로그인</a>'); return; }
      if(j.__status!==200){ setBusy(false); show('err','실패했습니다'+(j.refunded?' (크레딧 환불됨)':'')+'.<br>'+(j.error||'')); loadCredits(); return; }
      renderCredits({free:j.free, paid:j.paid}); loadCredits();
      if(j.status==='done'){ setBusy(false); show('ok','완성됐습니다.'); showResult('image', j.result_url); loadHistory(); markDone(); return; }
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
      /* 홈 화면에서 넘어온 경우(auto=1): 클릭 없이 바로 만들기. 새로고침 때 또 만들지 않도록 주소에서 지움 */
      if (q.get('auto') === '1' && $('prompt').value.trim()) {
        try { history.replaceState({}, '', '/studio-app'); } catch (e) {}
        cleanTopUrl();
        setTimeout(function(){ $('go').click(); }, 300);
      }
    });
  }).catch(function(e){ renderKind(); show('err','설정을 불러오지 못했습니다: '+e); });
})();
</script>
</body>
</html>`;

export async function onRequestGet() {
  return new Response(HTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      // 채팅 앱(/studio 부모 창)이 Cross-Origin-Embedder-Policy 를 쓰기 때문에, 그 안에 들어가는 이 문서도 같은 정책을 내야 표시됩니다
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
  });
}
