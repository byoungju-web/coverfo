// functions/s/[id].js — coverfo.com/s/<번호> : 👥 같이 정하기 링크 화면 (v356) · 친구는 가입 없이 연다
// 📍 장소 목록 → 마음에 드는 곳에 👍 · 🧳 한 번에 준비 → 🙋 갈게요 / 🙅 어려워요 · 🏃 한 마디 루틴 → 🎁 내 coverfo 에 담기
// 누르기·새로 보기는 /api/share (op get · vote). 친구는 별명과 누른 것만 저장된다. 검색엔진에 나오지 않게 한다(noindex).
// © 2026 coverfo All Rights Reserved
export async function onRequestGet(context) {
  const { request, env, params } = context;
  const id = String((params && params.id) || '');
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const svc = env.SUPABASE_SERVICE_ROLE_KEY || '';
  let s = null;
  if (/^[A-Za-z0-9]{8}$/.test(id) && url && svc) {
    try {
      const r = await fetch(url + '/rest/v1/cf_share?select=id,kind,title,sender,data,created_at,expires_at&id=eq.' + id + '&limit=1', {
        headers: { apikey: svc, Authorization: 'Bearer ' + svc },
      });
      const rows = r.ok ? await r.json() : [];
      s = Array.isArray(rows) && rows[0] && new Date(rows[0].expires_at).getTime() > Date.now() ? rows[0] : null;
    } catch { s = null; }
  }
  const origin = new URL(request.url).origin;
  return new Response(page(s, origin), {
    status: s ? 200 : 404,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
      'referrer-policy': 'no-referrer',
    },
  });
}

function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
function lead(s) {
  if (!s) return '';
  if (s.kind === 'places') return '같이 골라 줘요 · 마음에 드는 곳에 👍 를 눌러 주세요';
  if (s.kind === 'trip') return '같이 갈까요? · 🙋 갈게요 / 🙅 어려워요 를 눌러 주세요';
  if (s.kind === 'pick') return '같이 정해요 · 닉네임만 적고 10초면 투표 끝 (가입 없이)';
  return '이 루틴을 내 coverfo 에 담아 쓸 수 있어요';
}

function page(s, origin) {
  const title = s ? (s.kind === 'pick' ? (s.sender ? s.sender + '님이 초대했어요 · ' : '') + s.title : (s.sender ? s.sender + ' 님이 보낸 ' : '') + s.title) : 'coverfo';
  const desc = s ? lead(s) : '없는 링크이거나 30일이 지나 지워졌어요';
  const data = s ? JSON.stringify({ id: s.id, kind: s.kind, title: s.title, sender: s.sender, data: s.data, expires_at: s.expires_at }).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '') : 'null';
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} · coverfo</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(origin)}${s && s.kind === 'pick' ? '/og/decide.jpg' : '/coverfo-icon-512.png'}">
<meta name="twitter:card" content="summary">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta name="theme-color" content="#6D3DF0">
<style>
:root{--bg:#F7F6FB;--card:#fff;--ink:#15121f;--sub:#5e5874;--line:rgba(20,10,60,.09);--pri:#6D3DF0;--soft:#F1ECFF;--ok:#047857;--okbg:#ECFDF5;--no:#9f1239;--nobg:#FFF1F2}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif;-webkit-text-size-adjust:100%}
a{color:inherit}
.wrap{max-width:560px;margin:0 auto;padding:18px 16px 40px}
.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.logo{font-weight:900;font-size:18px;letter-spacing:-.02em;text-decoration:none;color:var(--pri)}
.exp{font-size:12px;color:var(--sub)}
.hd{background:linear-gradient(135deg,#6D3DF0,#8B5CF6);color:#fff;border-radius:22px;padding:20px 18px;box-shadow:0 18px 40px -26px rgba(60,30,160,.6)}
.hd small{display:block;font-size:13px;opacity:.9;margin-bottom:6px}
.hd h1{margin:0;font-size:22px;line-height:1.35;word-break:keep-all}
.hd p{margin:8px 0 0;font-size:14px;opacity:.95;line-height:1.5}
.me{display:flex;gap:8px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:10px 12px;margin:14px 0}
.me label{font-size:13px;color:var(--sub);white-space:nowrap}
.me input{flex:1;min-width:0;border:0;outline:0;font-size:16px;padding:6px 0;background:transparent;color:var(--ink)}
.cnt{font-size:13px;color:var(--sub);margin:4px 2px 10px}
.it{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:14px;margin:0 0 12px}
.it .r{display:flex;gap:12px;align-items:flex-start}
.no{flex:0 0 32px;height:32px;border-radius:50%;background:var(--soft);color:var(--pri);font-weight:900;display:flex;align-items:center;justify-content:center}
.it b{display:block;font-size:17px;line-height:1.35}
.it span.s{display:block;font-size:13.5px;color:var(--sub);margin-top:3px;line-height:1.45}
.bt{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.b{flex:1 1 0;min-height:44px;border-radius:12px;border:1px solid var(--line);background:#fff;font:inherit;font-size:15px;font-weight:800;color:var(--ink);display:inline-flex;align-items:center;justify-content:center;gap:6px;text-decoration:none;cursor:pointer;padding:0 10px}
.b.like{border-color:#ddd2ff;color:var(--pri);background:#faf8ff}
.b.like.on{background:var(--pri);color:#fff;border-color:var(--pri)}
.b.go.on{background:var(--ok);color:#fff;border-color:var(--ok)}
.b.nn.on{background:var(--no);color:#fff;border-color:var(--no)}
.b.pri{background:var(--pri);color:#fff;border-color:var(--pri)}
.b:focus-visible{outline:3px solid #a78bfa;outline-offset:2px}
.who{font-size:13px;color:var(--sub);margin-top:8px;line-height:1.5}
.who em{font-style:normal;font-weight:800;color:var(--pri)}
.top1{display:inline-block;font-size:12px;font-weight:800;color:#fff;background:#f59e0b;border-radius:999px;padding:2px 8px;margin-left:6px;vertical-align:2px}
.ck{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:12px 14px;margin:0 0 12px}
.ck h3{margin:0 0 6px;font-size:15px}
.ck li{font-size:14px;line-height:1.7;color:var(--ink)}
.rsvp{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 12px}
.rsvp .b{min-height:56px;font-size:16px}
.cta{margin:22px 0 0;background:var(--soft);border-radius:18px;padding:16px;text-align:center}
.cta p{margin:0 0 10px;font-size:14px;color:#3b2a86;line-height:1.5}
.note{font-size:12px;color:var(--sub);line-height:1.6;margin-top:16px}
.gone{text-align:center;padding:60px 10px;line-height:1.7}
.msg{min-height:20px;font-size:13px;color:var(--no);margin:6px 2px}
.fin{background:#ecfdf5;border:1.5px solid #6ee7b7;color:#065f46;border-radius:16px;padding:14px;margin:14px 0 0;font-size:16px;font-weight:800;line-height:1.45;word-break:keep-all}
.fin small{display:block;font-size:12.5px;font-weight:600;color:#047857;margin-top:3px}
@media (prefers-reduced-motion:no-preference){.b{transition:background .15s,color .15s}}
/* v467 🗳 같이 정하기 투표 (kind pick) — 홈 '친구랑 같이 정하기' 화면과 같은 색 */
body.pk{--bg:#F7F4FF;--ink:#17132B;--sub:#6B658A;--line:#E5DEF9;--pri:#7B61FF;--soft:#F3F0FF}
.pk .logo{color:#7B61FF}
.pk .phd{background:#17132B;color:#fff;border-radius:24px;padding:20px 18px 18px}
.pk .phd small{display:block;font-size:13px;color:#c3bbe9;margin-bottom:4px}
.pk .phd h1{margin:0;font-size:23px;line-height:1.3;letter-spacing:-.02em;word-break:keep-all}
.pk .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.pk .chips span{font-size:12.5px;font-weight:700;background:#322a5a;color:#fff;border-radius:999px;padding:5px 10px}
.pk .cnt2{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:18px 2px 10px}
.pk .cnt2 b{display:block;font-size:16px}
.pk .cnt2 small{font-size:12.5px;color:var(--sub)}
.pk .faces{font-size:20px;letter-spacing:-4px;white-space:nowrap}
.pk .op{display:block;width:100%;text-align:left;background:#fff;border:1.5px solid var(--line);border-radius:20px;padding:16px;margin:0 0 12px;font:inherit;color:var(--ink);cursor:pointer}
.pk .op.on{border:2px solid #7B61FF;box-shadow:0 10px 24px -18px rgba(123,97,255,.9)}
.pk .op:disabled{cursor:default}
.pk .op .r1{display:flex;align-items:center;gap:12px}
.pk .op .em{flex:0 0 44px;height:44px;border-radius:14px;background:#F3F0FF;display:flex;align-items:center;justify-content:center;font-size:24px}
.pk .op .nm{flex:1;min-width:0}
.pk .op .nm b{display:block;font-size:17px;line-height:1.3}
.pk .op .nm small{display:block;font-size:12.5px;color:var(--sub);margin-top:2px}
.pk .op .vt{text-align:right}
.pk .op .vt b{display:block;font-size:18px}
.pk .op .vt small{font-size:12px;color:var(--sub)}
.pk .bar{height:8px;border-radius:99px;background:#EEE9FF;margin:12px 0 8px;overflow:hidden}
.pk .bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#7B61FF,#00A9E8)}
.pk .op .st{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;color:var(--sub)}
.pk .op .st em{font-style:normal;font-weight:800;color:#7B61FF}
.pk .nk{margin:6px 2px 8px;font-size:14px;font-weight:800}
.pk .nkin{width:100%;border:1.5px solid var(--line);border-radius:16px;background:#fff;font:inherit;font-size:16px;padding:14px 16px;color:var(--ink);outline:0}
.pk .nkin:focus{border-color:#7B61FF}
.pk .vote{display:flex;width:100%;min-height:56px;margin-top:12px;border:0;border-radius:18px;background:linear-gradient(135deg,#7B61FF 0%,#5E8BFF 48%,#00C2FF 100%);color:#fff;font:inherit;font-size:17px;font-weight:800;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 14px 30px -18px rgba(94,139,255,.9)}
.pk .vote:disabled{opacity:.6}
.pk .hint{text-align:center;font-size:12.5px;color:var(--sub);margin-top:8px}
.pk .res{background:#FFF4D6;border-radius:24px;padding:22px 16px;text-align:center;margin:14px 0 4px}
.pk .res small{display:block;font-size:13px;color:#b26a00;font-weight:700}
.pk .res h2{margin:6px 0 4px;font-size:26px;letter-spacing:-.02em;color:#17132B;word-break:keep-all}
.pk .res p{margin:0 0 12px;font-size:14px;color:#6B658A}
.pk .res .win{display:inline-flex;align-items:center;gap:8px;background:#fff;border-radius:999px;padding:10px 18px;font-weight:800;font-size:16px;box-shadow:0 8px 20px -14px rgba(178,106,0,.6)}
.pk .cta{background:#F3F0FF}
.pk .cta p{color:#3d3565}
.pk .b.pri{background:linear-gradient(135deg,#7B61FF,#5E8BFF);border:0}
</style>
<style>
/* v485 🖼 결과 카드 버튼 — 투표 결과 아래 · 기존 '나도 만들기' 버튼 위 (기존 버튼은 그대로) */
.cardb{display:flex;align-items:center;gap:12px;width:100%;margin:16px 0 4px;padding:16px;border:0;border-radius:20px;background:linear-gradient(135deg,#7C4DFF 0%,#B04FE0 55%,#F0509A 100%);color:#fff;text-align:left;font:inherit;cursor:pointer;box-shadow:0 14px 28px -18px rgba(124,77,255,.9)}
.cardb .ci{flex:0 0 46px;height:46px;border-radius:14px;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;font-size:24px}
.cardb .ct{flex:1;min-width:0}
.cardb b{display:block;font-size:17px;font-weight:900;letter-spacing:-.02em}
.cardb small{display:block;font-size:12.5px;opacity:.92;margin-top:2px}
.cardb .ar{flex:none;font-size:20px;font-weight:900}
</style>
<script src="/card/card.js?v=485" defer></script>
</head>
<body>
<div class="wrap">
  <div class="top"><a class="logo" href="/">coverfo</a><span class="exp" id="exp"></span></div>
  <div id="app"></div>
  <div class="cta">
    <p><b>coverfo</b> · 말 한마디로 길안내·예약 문의·여행 준비까지,<br>친구와 링크로 같이 정해요.</p>
    <a class="b pri" href="/" style="display:inline-flex;max-width:280px;width:100%">나도 coverfo 로 만들기 ›</a>
  </div>
  <div class="note">🔒 이 링크에는 보낸 사람이 고른 내용만 있어요. 여기서 누르면 적은 <b>별명</b>과 누른 것만 저장되고, 이름·전화번호·위치는 저장하지 않아요. 링크는 만든 날부터 30일 뒤 자동으로 지워져요.<br>📍 장소 정보: 카카오 · 예약·결제는 각 가게·사이트에서 직접 해요.</div>
</div>
<script>
(function(){
  var S=${data};
  var app=document.getElementById("app");
  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(m){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m];}); }
  if(!S){ app.innerHTML='<div class="gone"><b style="font-size:18px">링크를 찾을 수 없어요</b><br>없는 링크이거나 30일이 지나 지워졌어요.</div>'; return; }
  try{ var d=new Date(S.expires_at); document.getElementById("exp").textContent=(d.getMonth()+1)+"월 "+d.getDate()+"일까지 열려요"; }catch(e){}
  /* 친구 구분: 이 브라우저에만 둔 무작위 표시 (사람 정보 아님) */
  function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k)||""; localStorage.setItem(k,v); }catch(e){ return ""; } }
  var voter=store("cf_s_voter");
  if(!/^[a-z0-9]{12,32}$/.test(voter)){ voter=""; var A="abcdefghijkmnopqrstuvwxyz23456789"; try{ var r=new Uint8Array(20); crypto.getRandomValues(r); for(var i=0;i<20;i++) voter+=A[r[i]%A.length]; }catch(e){ for(var j=0;j<20;j++) voter+=A[Math.floor(Math.random()*A.length)]; } store("cf_s_voter",voter); }
  var T={tally:{},people:0,mine:[]}, busy=false;
  function api(b){ return fetch("/api/share",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}).then(function(r){ return r.json().catch(function(){ return {}; }); }); }
  function nick(){ var i=document.getElementById("nick"); return i?i.value.trim().slice(0,12):""; }
  function whoIn(k){ var x=T.tally[k]; if(!x||!x.n) return ""; return '<em>'+x.n+'명</em> · '+x.nicks.map(esc).join(", ")+(x.n>x.nicks.length?" 외":""); }
  function who(k){ var w=whoIn(k); return w?'<div class="who">'+w+'</div>':""; }
  function has(k){ return T.mine.indexOf(k)>=0; }
  function msg(t){ var m=document.getElementById("msg"); if(m) m.textContent=t||""; }
  var D=S.data||{};
  if(S.kind==="pick") document.body.classList.add("pk");
  var SEL=null;   /* v467 투표: 아직 보내지 않은 내 선택 */
  function closed(){ return !!(D.deadline&&new Date(D.deadline).getTime()<Date.now()); }
  function dl(){ if(!D.deadline) return "마감 없음"; var d=new Date(D.deadline), n=new Date(), t=new Date(n.getFullYear(),n.getMonth(),n.getDate()).getTime(), dd=new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime(); var hm=("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2); return (dd===t?"오늘":dd===t+864e5?"내일":(d.getMonth()+1)+"/"+d.getDate())+" "+hm+(closed()?" 마감됨":" 마감"); }
  function pickHtml(){
    var items=D.items||[], tot=0; items.forEach(function(x,i){ var t=T.tally[String(i+1)]; tot+=t?t.n:0; });
    var best=-1,bn=0,tie=false; items.forEach(function(x,i){ var t=T.tally[String(i+1)], n=t?t.n:0; if(n>bn){ bn=n; best=i; tie=false; } else if(n===bn&&n>0) tie=true; });
    var cl=closed(), F=D.final;
    if(SEL===null) SEL=T.mine.slice();
    var h='<div class="phd"><small>'+(S.sender?esc(S.sender)+'님이 초대했어요':'친구가 초대했어요')+'</small><h1>'+esc(S.title)+'</h1><div class="chips">'+(D.q?'<span>📍 '+esc(D.q)+'</span>':'')+'<span>⏰ '+esc(dl())+'</span>'+(D.anon?'<span>🙈 익명 투표</span>':'')+(D.multi?'<span>✅ 여러 개 선택</span>':'<span>☝️ 하나만 선택</span>')+'</div></div>';
    if((cl||(F&&F.text))&&best>=0&&!tie){ var w=items[best]; h+='<div class="res" role="status"><small>'+(F&&F.text?esc(F.text):'투표가 끝났어요')+'</small><h2>'+esc(w.name)+'로 결정!</h2><p>친구 '+T.people+'명이 함께 정했어요</p><span class="win">'+esc(w.emoji||"🏆")+' '+esc(w.name)+' · '+bn+'표</span></div>'; }
    else if(F&&F.text){ var fd=new Date(F.at); h+='<div class="fin" role="status">🎉 '+esc(F.text)+'<small>'+(S.sender?esc(S.sender)+' 님이 ':'')+'확정했어요'+(isNaN(fd)?'':' · '+(fd.getMonth()+1)+'/'+fd.getDate())+'</small></div>'; }
    else if(cl) h+='<div class="res"><small>투표가 끝났어요</small><h2>'+(tie?'동점이에요':'아직 표가 없어요')+'</h2><p>만든 사람이 정하면 여기에 보여요</p></div>';
    var faces=["🙂","😄","😎","🥰","🤔","😋","🤩"];
    h+='<div class="cnt2"><div><b>지금까지 '+T.people+'명이 참여했어요</b><small>'+(cl?'마감된 투표예요':'실시간으로 투표가 모이고 있어요')+'</small></div><span class="faces" aria-hidden="true">'+faces.slice(0,Math.min(5,Math.max(1,T.people))).join("")+'</span></div><div class="msg" id="msg" role="status"></div>';
    items.forEach(function(x,i){
      var k=String(i+1), t=T.tally[k], n=t?t.n:0, pc=tot?Math.round(n*100/tot):0, on=SEL.indexOf(k)>=0;
      h+='<button type="button" class="op'+(on?' on':'')+'" data-pk="'+k+'" aria-pressed="'+on+'"'+(cl?' disabled':'')+'><div class="r1"><span class="em" aria-hidden="true">'+esc(x.emoji||"•")+'</span><span class="nm"><b>'+esc(x.name)+'</b>'+(x.desc?'<small>'+esc(x.desc)+'</small>':'')+'</span><span class="vt"><b>'+n+'표</b><small>'+pc+'%</small></span></div><div class="bar"><i style="width:'+pc+'%"></i></div><div class="st"><span>'+(!D.anon&&t&&t.nicks.length?esc(t.nicks.join(", "))+(n>t.nicks.length?" 외":""):'')+'</span><em>'+(cl?'':on?'선택했어요':'눌러서 선택하기')+'</em></div></button>';
    });
    if(!cl){
      h+='<div class="nk"><label for="nick">닉네임만 입력하면 돼요</label></div><input class="nkin" id="nick" maxlength="12" placeholder="예) 홍대 맛집러" value="'+esc(store("cf_s_nick"))+'" autocomplete="off">'
        +'<button type="button" class="vote" id="pkgo">'+(T.mine.length?'투표 바꾸기':'투표하기')+'</button><div class="hint">'+(D.anon?'익명 투표라 누가 골랐는지는 보이지 않아요 · ':'')+'로그인 없이, 10초면 충분해요</div>';
    }
    /* v485 🖼 결과 카드 (표가 하나라도 있거나 확정됐을 때) — 기존 버튼 위 */
    if(tot>0||(F&&F.text)) h+='<button type="button" class="cardb" data-card="1"><span class="ci" aria-hidden="true">🖼</span><span class="ct"><b>이 결과 카드로 공유하기</b><small>이미지로 만들어서 카톡 / 인스타에 올려요</small></span><span class="ar" aria-hidden="true">›</span></button>';
    /* v475 딥링크: 나도 같이 정하기 만들기 → coverfo 홈 위에 결정 만들기 화면 */
    h+='<a href="/?go=decide" style="display:block;text-align:center;margin:18px 0 4px;font-size:14px;font-weight:800;color:#7C4DFF;text-decoration:none">🤝 나도 친구랑 같이 정하기 만들기 ›</a>';
    return h;
  }
  function pickSend(){
    if(!SEL.length){ msg("먼저 마음에 드는 후보를 눌러 주세요"); return; }
    var nk=nick(); if(!nk){ msg("닉네임을 적어 주세요"); var ni=document.getElementById("nick"); if(ni) ni.focus(); return; }
    store("cf_s_nick",nk);
    var ops=[]; SEL.forEach(function(k){ if(!has(k)||!D.multi) ops.push({k:k,on:true}); });
    if(D.multi) T.mine.forEach(function(k){ if(SEL.indexOf(k)<0) ops.push({k:k,on:false}); });
    if(!ops.length) ops.push({k:SEL[0],on:true});
    busy=true; var g=document.getElementById("pkgo"); if(g) g.disabled=true;
    var run=function(i,last){
      if(i>=ops.length){ busy=false; if(last&&last.ok){ T={tally:last.tally||{},people:last.people||0,mine:last.mine||[]}; SEL=T.mine.slice(); render(); msg(""); var m=document.getElementById("msg"); if(m){ m.style.color="#008a60"; m.textContent="투표가 완료됐어요 🎉 결과는 마감 뒤에도 이 링크에서 볼 수 있어요"; } } return; }
      api({op:"vote",id:S.id,voter:voter,nick:nk,pick:ops[i].k,on:ops[i].on}).then(function(j){
        if(!(j&&j.ok)){ busy=false; render(); msg((j&&j.error)||"저장하지 못했어요. 다시 눌러 주세요."); return; }
        run(i+1,j);
      }).catch(function(){ busy=false; render(); msg("연결이 끊겼어요. 다시 눌러 주세요."); });
    };
    run(0,null);
  }
  function head(lines){
    var F=D.final, fin='';
    if(F&&F.text){ var fd=new Date(F.at); fin='<div class="fin" role="status">🎉 '+esc(F.text)+'<small>'+(S.sender?esc(S.sender)+' 님이 ':'')+'확정했어요'+(isNaN(fd)?'':' · '+(fd.getMonth()+1)+'/'+fd.getDate())+'</small></div>'; }
    return '<div class="hd"><small>'+(S.sender?esc(S.sender)+' 님이 보냈어요':'친구가 보냈어요')+'</small><h1>'+esc(S.title)+'</h1><p>'+lines+'</p></div>'+fin;
  }
  function meBox(){ return '<div class="me"><label for="nick">내 별명</label><input id="nick" maxlength="12" placeholder="예: ** (누가 눌렀는지 보여요)" value="'+esc(store("cf_s_nick"))+'" autocomplete="off"></div>'; }
  function render(){
    var h="";
    if(S.kind==="pick"){ h=pickHtml(); }
    else if(S.kind==="places"){
      var best="", bn=0; Object.keys(T.tally).forEach(function(k){ if(T.tally[k].n>bn){ bn=T.tally[k].n; best=k; } });
      h+=head('마음에 드는 곳에 <b>👍</b> 를 눌러 주세요. 여러 곳 눌러도 돼요.')+meBox()+'<div class="cnt">지금까지 '+T.people+'명이 골랐어요</div><div class="msg" id="msg" role="status"></div>';
      (D.items||[]).forEach(function(x,i){
        var k=String(i+1), on=has(k);
        var tel=String(x.phone||"").replace(/[^0-9+]/g,"");
        h+='<div class="it"><div class="r"><div class="no">'+k+'</div><div style="min-width:0;flex:1"><b>'+esc(x.name)+(best===k&&bn>0?'<span class="top1">가장 많이 👍</span>':'')+'</b><span class="s">'+esc((x.cat?x.cat+" · ":"")+(x.addr||""))+'</span></div></div>'
          +'<div class="bt"><button type="button" class="b like'+(on?' on':'')+'" data-v="'+k+'" aria-pressed="'+on+'">👍 '+(on?'골랐어요':'좋아요')+'</button>'
          +(x.url?'<a class="b" href="'+esc(x.url)+'" target="_blank" rel="noopener">🗺 지도</a>':'')
          +(tel.length>=7?'<a class="b" href="tel:'+esc(tel)+'">📞 전화</a>':'')+'</div>'+who(k)+'</div>';
      });
    } else if(S.kind==="trip"){
      var g=has("go"), n=has("no");
      h+=head(esc(D.sub||""))+meBox()+'<div class="msg" id="msg" role="status"></div>'
        +'<div class="rsvp"><button type="button" class="b go'+(g?' on':'')+'" data-v="go" aria-pressed="'+g+'">🙋 갈게요</button><button type="button" class="b nn'+(n?' on':'')+'" data-v="no" aria-pressed="'+n+'">🙅 이번엔 어려워요</button></div>'
        +(whoIn("go")?'<div class="who" style="margin:-4px 2px 4px">🙋 '+whoIn("go")+'</div>':'')
        +(whoIn("no")?'<div class="who" style="margin:0 2px 12px">🙅 '+whoIn("no")+'</div>':'<div style="height:8px"></div>');
      (D.steps||[]).forEach(function(x){
        h+='<div class="it"><div class="r"><div class="no" style="font-size:18px">'+esc(x.icon||"•")+'</div><div style="min-width:0;flex:1"><b>'+esc(x.name)+'</b><span class="s">'+esc(x.desc)+'</span></div></div>'
          +(x.u?'<div class="bt"><a class="b" href="'+esc(x.u)+'" target="_blank" rel="noopener">열어 보기 ›</a></div>':'')+'</div>';
      });
      if((D.checklist||[]).length) h+='<div class="ck"><h3>✅ 준비물</h3><ul style="margin:0;padding-left:20px">'+D.checklist.map(function(t){ return '<li>'+esc(t)+'</li>'; }).join("")+'</ul></div>';
    } else {
      h+=head('🏃 <b>'+esc(D.name)+'</b> 한 마디로 아래 일을 차례로 열어요.')
        +'<div class="it">'+(D.cmds||[]).map(function(t,i){ return '<div class="r" style="margin:6px 0"><div class="no">'+(i+1)+'</div><div style="flex:1;padding-top:5px">'+esc(t)+'</div></div>'; }).join("")+'</div>'
        +'<a class="b pri" style="display:flex;min-height:52px;font-size:16px" href="/?cf_take='+encodeURIComponent(S.id)+'" data-take="1">🎁 내 coverfo 에 담기</a>'
        +'<div class="who" style="text-align:center">로그인한 뒤 담을 수 있어요 (무료)'+(T.tally.take&&T.tally.take.n?' · 지금까지 <em>'+T.tally.take.n+'명</em>이 담았어요':'')+'</div>';
    }
    var keep=document.activeElement&&document.activeElement.id==="nick";
    var nv=nick();
    app.innerHTML=h;
    var ni=document.getElementById("nick");
    if(ni){ if(nv) ni.value=nv; ni.addEventListener("change",function(){ store("cf_s_nick",nick()); }); if(keep){ ni.focus(); } }
  }
  function load(){ return api({op:"get",id:S.id,voter:voter}).then(function(j){ if(j&&j.ok){ T={tally:j.tally||{},people:j.people||0,mine:j.mine||[]}; if(j.share&&j.share.data){ D.final=j.share.data.final||null; } if(!busy) render(); } else if(j&&j.gone){ S=null; app.innerHTML='<div class="gone"><b style="font-size:18px">링크를 찾을 수 없어요</b><br>30일이 지나 지워졌거나 보낸 사람이 지웠어요.</div>'; } }).catch(function(){}); }
  /* v485 🖼 결과 카드: 문장 1줄 + 같은 링크(coverfo.com/s/번호)를 크게 — /card/card.js */
  function openCard(){
    if(!window.cfCard){ msg("잠시 뒤 다시 눌러 주세요"); return; }
    var items=D.items||[], tot=0, best=-1, bn=0, tie=false;
    items.forEach(function(x,i){ var t=T.tally[String(i+1)], n=t?t.n:0; tot+=n; if(n>bn){ bn=n; best=i; tie=false; } else if(n===bn&&n>0) tie=true; });
    var F=D.final, done=closed()||(F&&F.text), w=best>=0&&!tie?items[best]:null;
    var line=w?(done?'우리 오늘 '+cfCard.ro(w.name)+' 결정했어!':'지금은 '+w.name+' 1위! 같이 골라 줘'):(F&&F.text?F.text:S.title+' 같이 정해요!');
    cfCard.open({tag:'오늘의 결정',line:line,sub:'포도야가 정해줬어',foot:w?'🏆 '+w.name+' '+bn+'표 · '+(tot?Math.round(bn*100/tot):0)+'%':'',hint:done?'링크에서 결과를 볼 수 있어요':'링크를 누르면 바로 투표할 수 있어요',url:location.origin+'/s/'+S.id,photoPick:true,title:S.title,shareText:'🗳 '+S.title});
  }
  app.addEventListener("click",function(e){
    if(e.target.closest&&e.target.closest("[data-card]")){ e.preventDefault(); openCard(); return; }
    var pb=e.target.closest&&e.target.closest("[data-pk]");
    if(pb&&S.kind==="pick"){ e.preventDefault(); if(busy||closed()) return; var pk=pb.getAttribute("data-pk"), at=SEL.indexOf(pk); if(D.multi){ if(at>=0) SEL.splice(at,1); else SEL.push(pk); } else SEL=[pk]; render(); return; }
    if(e.target.closest&&e.target.closest("#pkgo")){ e.preventDefault(); if(!busy) pickSend(); return; }
    var b=e.target.closest&&e.target.closest("[data-v]");
    if(b){
      e.preventDefault(); if(busy) return;
      var k=b.getAttribute("data-v"), on=!has(k);
      busy=true; b.disabled=true; msg("");
      store("cf_s_nick",nick());
      api({op:"vote",id:S.id,voter:voter,nick:nick(),pick:k,on:on}).then(function(j){
        busy=false;
        if(j&&j.ok){ T={tally:j.tally||{},people:j.people||0,mine:j.mine||[]}; render(); }
        else { render(); msg((j&&j.error)||"저장하지 못했어요. 다시 눌러 주세요."); }
      }).catch(function(){ busy=false; render(); msg("연결이 끊겼어요. 다시 눌러 주세요."); });
      return;
    }
  });
  render(); load();
  /* 다른 친구가 누른 것도 보이게: 화면을 보고 있을 때만 8초마다 */
  setInterval(function(){ if(!document.hidden&&!busy&&S) load(); },8000);
})();
</script>
</body>
</html>`;
}
