// functions/api/verify.js — coverfo.com/api/verify (Cloudflare Pages Function)
// © 2026 coverfo All Rights Reserved — coverfo 3D Orchestrator Engine™ v2.1 — 7 Stage Realistic — OBFUSCATED
export async function onRequestGet(context){
  var request=context.request;
  var _0xA=["\x63\x6F\x76\x65\x72\x66\x6F\x2E\x63\x6F\x6D","\x77\x77\x77\x2E\x63\x6F\x76\x65\x72\x66\x6F\x2E\x63\x6F\x6D","\x68\x61\x73\x69\x6E\x2D\x73\x68\x6F\x70\x2E\x63\x6F\x6D","\x63\x6F\x76\x65\x72\x66\x6F\x2E\x70\x61\x67\x65\x73\x2E\x64\x65\x76"];
  var _0xC=new URL(request.url);
  var _0xD=(_0xC.searchParams.get('d')||'').toLowerCase();
  var _0xE=_0xC.searchParams.get('mode')||'';
  var _0xF=_0xC.searchParams.get('v')||'7stage';
  // OBFUSCATED LICENSE CHECK — 지금은 모두 허용
  var _0x10=!0;var _0x11="obfuscated-demo-allow";
  // PRODUCTION: 아래 주석을 풀면 허용 목록(_0xA)에 있는 도메인만 통과
  // if(_0xD){
  //  _0x10=_0xA.some(function(x){return _0xD.indexOf(x)>-1})||_0xD.indexOf('localhost')>-1||_0xD.indexOf('netlify')>-1||_0xD.indexOf('vercel.app')>-1;
  //  _0x11=_0x10?"licensed":"not-licensed";
  // }
  var _0x12={
    valid:_0x10,
    domain:_0xD,
    mode:_0xE,
    pipeline:_0xF.indexOf('7')>-1?"Fable 5.1 \u2192 Astra 6 \u2192 Gemini 3 Flash Image \u2192 gpt image 2 \u2192 Veo 3.1 \u2192 Tripo3D \u2192 Opus 4.5 (7-stage realistic)":"Fable 5.1 \u2192 Astra 6 \u2192 Gemini 3 Flash \u2192 Veo 3.1 \u2192 Opus 4.5 (5-stage)",
    engine:"coverfo 3D Orchestrator Engine\u2122 v2.1 \u2014 OBFUSCATED \u2014 7 Stage",
    version:"2.1.7-obfuscated",
    features:{gemini3Flash:!0,veo3_1:!0,tripo3d:_0xE.indexOf('3d')>-1||_0xF.indexOf('7')>-1},
    reason:_0x11,
    ts:Date.now(),
    copyright:"\u00A9 2026 coverfo All Rights Reserved \u2014 coverfo 3D Orchestrator Engine\u2122"
  };
  return new Response(JSON.stringify(_0x12),{headers:{
    "Content-Type":"application/json",
    "Access-Control-Allow-Origin":"*",
    "Access-Control-Allow-Methods":"GET, OPTIONS",
    "Cache-Control":"no-cache, no-store",
    "X-Engine":"coverfo-3d-orchestrator-v2.1-7stage-obfuscated"
  }});
}
export async function onRequestOptions(){
  return new Response(null,{headers:{
    "Access-Control-Allow-Origin":"*",
    "Access-Control-Allow-Methods":"GET, OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type",
    "Access-Control-Max-Age":"86400"
  }});
}
