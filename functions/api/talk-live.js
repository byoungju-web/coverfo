// functions/api/talk-live.js — coverfo 🗣️ 소리 (말로 주고받는 음성 비서)
// © 2026 coverfo All Rights Reserved
//
// POST /api/talk-live   (Authorization: Bearer 로그인토큰)
//   { op:"start", sdp }  → 첫 1분 크레딧 차감 후 OpenAI Realtime 에 연결(WebRTC). 응답 { sdp, call, cost }
//   { op:"tick",  call } → 1분마다 화면이 부른다. 다음 1분 크레딧 차감. 부족하면 통화를 끊고 402
//   { op:"end",   call } → 통화 끊기
//   { op:"token", name } → (v267 안드로이드 앱 'coverfo 소리') 첫 1분 차감 후 1회용 임시 키(ek_…) 발급. 응답 { key, url, model, cost }
//                          v276: name = 앱에서 정한 부르는 이름(기본 "소리야"). 앱 전용 도구(open_app·run_routine·end_conversation)도 이때만 준다.
//   { op:"device" }      → v276 앱의 '이름 부르기 대기'용 기기 키(30일). 로그인 키(1시간)로만 받을 수 있다.
//                          앱은 대기 중 이름이 들리면 이 키로 token·tick 을 부른다 (화면이 꺼져 있어도 대화 시작 가능).
//                          앱이 그 키로 OpenAI Realtime WebSocket 에 직접 연결(마이크 24kHz PCM). 진짜 OpenAI 키는 서버에만.
//                          앱의 1분 tick 은 call 없이 { op:"tick" } 로 보낸다(차감만, 부족하면 402 → 앱이 끊음).
//
// · OpenAI 키(OPENAI_API_KEY)는 서버에만 있다. 브라우저는 SDP(연결 정보)만 주고받고 키를 보지 못한다.
// · 말하는 도중 끊기: OpenAI 서버 VAD(interrupt_response) — 이용자가 말을 시작하면 비서 목소리가 멈춘다.
// · 명령("부산 맛집 알려줘", "뉴욕 힐튼 길안내 해줘" …)은 run_command 도구로 화면에 넘겨 홈 입력칸과 같은 길로 실행한다.
// · 대화 내용은 저장하지 않는다(크레딧 기록에는 'live' 와 분 수만).
// · 비용: 1분 COST 크레딧 (Secret/변수 LIVE_COST_PER_MIN 로 바꿀 수 있음). 모델은 REALTIME_MODEL 로 바꿀 수 있음.
// · 알려진 한계: 1분 차감은 화면이 tick 을 보내야 이어진다. 화면 코드를 고쳐 tick 을 보내지 않는 경우까지 막으려면
//   서버 타이머(Durable Object)가 필요하다 — 지금은 OpenAI 세션 최대 시간이 상한.

const COST_DEFAULT = 1;
const MODEL_DEFAULT = 'gpt-realtime-2.1-mini';   // 2026-07 공개 · 오디오 입력 $10 / 출력 $20 (100만 토큰당)
const VOICE = 'marin';
const MAX_OUT = 300;            // v276: 한 번 대답의 최대 길이 (말이 길어지지 않게)
const DEVICE_DAYS = 30;         // v276: 앱 대기용 기기 키 유효 기간

const INSTRUCTIONS = [
  "You are '소리', the voice assistant of coverfo (a Korean all-in-one assistant web app).",
  'Speak in the same language as the user (default Korean, polite 해요체).',
  /* v276: 말 줄이기 — 묻는 것에만 짧게. 먼저 말을 꺼내거나 덧붙이지 않는다 */
  'BE BRIEF: answer in ONE short sentence whenever possible (two at most). Give only what was asked. No explanations, background, lists, greetings, or closing offers such as "더 궁금한 점 있으세요?" / "도와드릴까요?" unless the user asks for details.',
  'Never start talking on your own and never continue talking after you have answered. Respond only to what the user just said. If the request is unclear, ask ONE very short question.',
  'If the user interrupts, stop and listen.',
  'When the user wants an ACTION that the coverfo home screen can do — map/places/restaurants (맛집), attractions (가볼만한곳), navigation (길안내/내비), hotel booking (숙소 예약), shopping or checkout screen (쇼핑/결제 화면), taxi, food delivery, music playback, weather, flights, trains, phone call or SMS —',
  'call the tool run_command with ONE concise command sentence in the user\'s language that includes all details they said (place, date, nights, people, model number, color). Before calling, say only a very short line like "네, 열게요."',
  'The command must be a short, natural request like "카페 아라비카 길안내 해줘", "부산역 맛집 알려줘", "서울 내일 날씨 알려줘" — one action, the place/item name plus the action word. Never add alternatives or extra words such as "또는", "위치 찾아서", "탐색 화면 열어".',
  'After a command runs the conversation CONTINUES (v265): the user may now be looking at another app such as a navigation map. Stay quiet and wait; speak only when the user talks to you.',
  'When the user says things like "홈으로", "홈 화면", "이전 화면", "돌아가", "대화 보여줘", "대화 목록" (go home / go back / show the conversation), call the tool show_chat and say a very short line like "대화 화면을 열게요."',
  'After run_command, coverfo often shows a result screen with buttons (weather: 네이버 날씨 / 기상청 날씨누리 / Google 날씨; shopping: 쿠팡 / 네이버 가격비교 / 다나와; navigation: 카카오내비 / 카카오맵 / 네이버지도; hotel: Trip.com, and so on).',
  'When the user then picks one of those ("네이버 날씨 열어 줘", "쿠팡으로", "카카오맵으로 해 줘"), call press_button with that button name instead of run_command. If press_button returns ok:false it lists the visible buttons — tell the user briefly or pick the right one.',
  'For questions, chit-chat or explanations, just answer by voice without the tool — still briefly.',
  'Never ask for or repeat card numbers, ID numbers, passwords or bank account numbers. coverfo does not take payments; payment happens on each shop\'s site by the user.',
].join(' ');

/* v276 앱(coverfo 소리) 전용: 부르는 이름 + 앱 열기 · 저장루틴 실행 · 대화 끝내기 */
function appInstructions(name) {
  const n = name || '소리야';
  return INSTRUCTIONS + ' ' + [
    `The user calls you by the name "${n}". Their speech may begin with that name (it may be mis-transcribed) — ignore the name itself and handle the rest. If they only said your name, reply with just "네?" and wait.`,
    'When the user wants to open an app on the phone ("카톡 켜 줘", "유튜브 열어 줘", "카메라 켜 줘", "배민 열어"), call open_app with the app name. Say at most "네." before calling. If it returns ok:false, tell the user in one short sentence.',
    'When the user wants to run a saved routine (저장루틴, 루틴) — e.g. "아침 루틴 실행해", "어제 저장한 루틴 실행해", "마지막 루틴 돌려 줘" — call run_routine with the routine name and/or when ("latest" for the last/most recent, "today", "yesterday"). If it returns ok:false with names, read at most three of the names briefly.',
    'When the user ends the conversation ("그만", "됐어", "끝", "고마워 끝", "잘 자", "대기해"), call end_conversation. Say nothing, or only "네."',
  ].join(' ');
}

const TOOLS = [{
  type: 'function',
  name: 'run_command',
  description: 'Run an action command on the coverfo home screen (opens maps, navigation, hotel booking, shopping/checkout, taxi, delivery, music, weather, flights, trains, call/SMS). The voice conversation continues after the command runs.',
  parameters: {
    type: 'object',
    properties: { text: { type: 'string', description: 'One command sentence, e.g. "뉴욕 힐튼호텔 길안내 해줘" or "필립스 TAT1109 화이트 결제 화면 보여줘"' } },
    required: ['text'],
  },
}, {
  type: 'function',
  name: 'press_button',
  description: 'Press a button on the result screen that coverfo is currently showing (e.g. "네이버 날씨", "쿠팡", "카카오맵"). Returns ok:false with the list of visible buttons if nothing matches.',
  parameters: {
    type: 'object',
    properties: { label: { type: 'string', description: 'Button name as the user said it, e.g. "네이버 날씨"' } },
    required: ['label'],
  },
}, {
  type: 'function',
  name: 'show_chat',
  description: 'Go back to the coverfo home screen and show the voice conversation panel (when the user says go home, go back, previous screen, show the conversation/list).',
  parameters: { type: 'object', properties: {} },
}];

/* v276 앱 전용 도구 (앱이 직접 처리: open_app · end_conversation / 화면이 처리: run_routine) */
const APP_TOOLS = TOOLS.concat([{
  type: 'function',
  name: 'open_app',
  description: 'Open an app installed on the phone, e.g. 카카오톡, 유튜브, 카카오맵, 쿠팡, 배달의민족, 카메라, 전화, 문자, 설정, 갤러리.',
  parameters: {
    type: 'object',
    properties: { name: { type: 'string', description: 'App name as the user said it, e.g. "카톡" or "유튜브"' } },
    required: ['name'],
  },
}, {
  type: 'function',
  name: 'run_routine',
  description: 'Run one of the user\'s saved routines (저장루틴) on coverfo by name and/or date. Returns ok:false with the saved routine names if nothing matches.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Routine name as the user said it, e.g. "아침 루틴". Empty if they only gave a date.' },
      when: { type: 'string', enum: ['', 'latest', 'today', 'yesterday'], description: '"latest" = most recently saved, "today"/"yesterday" = saved on that day' },
    },
  },
}, {
  type: 'function',
  name: 'end_conversation',
  description: 'End the voice conversation (the app goes back to waiting for its name, or closes).',
  parameters: { type: 'object', properties: {} },
}]);

export async function onRequestPost(context) {
  const env = context.env || {};
  if (!env.OPENAI_API_KEY) return json({ error: 'OPENAI_API_KEY 가 설정되지 않았습니다' }, 500);
  const uid = await userId(context.request, env);
  if (!uid) return json({ error: '로그인이 필요합니다' }, 401);

  let b = {};
  try { b = await context.request.json(); } catch { return json({ error: '잘못된 요청입니다' }, 400); }
  const op = String(b.op || '');
  const cost = Math.max(0, Number(env.LIVE_COST_PER_MIN) || COST_DEFAULT);
  const call = /^[A-Za-z0-9_-]{4,120}$/.test(String(b.call || '')) ? String(b.call) : '';

  if (op === 'end') { if (call) await hangup(env, call); return json({ ok: true }); }

  if (op === 'tick') {
    /* 웹(WebRTC)은 call 로 서버가 끊을 수 있고, 앱(WebSocket)은 call 이 없어 앱이 직접 끊는다 */
    let job;
    try { job = await spend(env, uid, cost, 'live:minute'); }
    catch (e) { if (call) await hangup(env, call); return json({ error: '크레딧 처리 실패' }, 500); }
    if (job === false) { if (call) await hangup(env, call); return json({ error: '크레딧이 부족해 대화를 마쳤어요', need: cost }, 402); }
    await done(env, job);
    return json({ ok: true, cost });
  }

  /* 새 앱(v4)만 name 을 보낸다 → 그때만 앱 전용 도구. 업데이트 전 앱은 예전 도구 그대로 (처리 못 하는 도구를 받지 않게) */
  if (op === 'token') return appToken(env, uid, cost, b.name ? cleanName(b.name) : '');
  if (op === 'device') {
    /* 기기 키는 진짜 로그인 키로만 받는다 (기기 키로 기기 키를 다시 받아 끝없이 늘리지 못하게) */
    if (isDevice(context.request)) return json({ error: '로그인 키가 필요합니다' }, 401);
    const device = await makeDevice(env, uid);
    if (!device) return json({ error: '기기 키를 만들 수 없습니다' }, 500);
    return json({ ok: true, device, days: DEVICE_DAYS });
  }
  if (op !== 'start') return json({ error: '잘못된 요청입니다' }, 400);
  const sdp = String(b.sdp || '');
  if (!/^v=0/.test(sdp) || sdp.length > 20000) return json({ error: '연결 정보(SDP)가 올바르지 않습니다' }, 400);

  let job;
  try { job = await spend(env, uid, cost, 'live:start'); }
  catch (e) { return json({ error: '크레딧 처리 실패: ' + String(e.message || e).slice(0, 200) }, 500); }
  if (job === false) return json({ error: '크레딧이 부족합니다', need: cost }, 402);

  try {
    const session = {
      type: 'realtime',
      model: env.REALTIME_MODEL || MODEL_DEFAULT,
      instructions: INSTRUCTIONS,
      audio: {
        input: {
          transcription: { model: 'gpt-4o-mini-transcribe' },
          turn_detection: { type: 'server_vad', create_response: true, interrupt_response: true },
        },
        output: { voice: VOICE },
      },
      tools: TOOLS,
      tool_choice: 'auto',
      max_output_tokens: MAX_OUT,
    };
    const create = (cfg) => {
      const fd = new FormData();
      fd.set('sdp', sdp);
      fd.set('session', JSON.stringify(cfg));
      return fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'OpenAI-Safety-Identifier': userHash(uid) },
        body: fd,
      });
    };
    let r = await create(session);
    let answer = await r.text();
    if (r.status === 400) {
      /* v276: 답 길이 제한(max_output_tokens)을 거절하면 빼고 한 번 더 */
      delete session.max_output_tokens;
      r = await create(session);
      answer = await r.text();
    }
    if (r.status === 400) {
      /* 받아쓰기 모델 이름이 바뀌어 거절되면 받아쓰기 없이 한 번 더 (화면에 내 말 글자만 안 보임) */
      delete session.audio.input.transcription;
      r = await create(session);
      answer = await r.text();
    }
    if (!r.ok || !/^v=0/.test(answer)) {
      await refund(env, job);
      return json({ error: `음성 연결 실패 (${r.status}): ${answer.slice(0, 200)}`, refunded: true }, 502);
    }
    await done(env, job);
    const loc = r.headers.get('Location') || '';
    const id = (loc.match(/calls\/([A-Za-z0-9_-]+)/) || [])[1] || '';
    return json({ sdp: answer, call: id, cost });
  } catch (e) {
    await refund(env, job);
    return json({ error: `음성 연결 오류: ${e.message}`, refunded: true }, 500);
  }
}

/* ── v267 안드로이드 앱용 임시 키 (OpenAI POST /v1/realtime/client_secrets → value) ──
   · 키는 120초 안에 연결을 시작할 때만 쓰인다(연결 후 대화는 계속). 앱 화면·기기에 진짜 OpenAI 키가 남지 않는다.
   · 오디오는 PCM 16bit 24kHz 모노 (앱의 AudioRecord · AudioTrack 과 같은 형식). */
async function appToken(env, uid, cost, name) {
  let job;
  try { job = await spend(env, uid, cost, 'live:start'); }
  catch (e) { return json({ error: '크레딧 처리 실패: ' + String(e.message || e).slice(0, 200) }, 500); }
  if (job === false) return json({ error: '크레딧이 부족합니다', need: cost }, 402);
  const model = env.REALTIME_MODEL || MODEL_DEFAULT;
  const fmt = { type: 'audio/pcm', rate: 24000 };
  const session = {
    type: 'realtime',
    model,
    instructions: name ? appInstructions(name) : INSTRUCTIONS,
    audio: {
      input: {
        format: fmt,
        transcription: { model: 'gpt-4o-mini-transcribe' },
        turn_detection: { type: 'server_vad', create_response: true, interrupt_response: true },
      },
      output: { format: fmt, voice: VOICE },
    },
    tools: name ? APP_TOOLS : TOOLS,
    tool_choice: 'auto',
    max_output_tokens: MAX_OUT,
  };
  const ask = (cfg) => fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json', 'OpenAI-Safety-Identifier': userHash(uid) },
    body: JSON.stringify({ expires_after: { anchor: 'created_at', seconds: 120 }, session: cfg }),
  });
  try {
    let r = await ask(session);
    let j = await r.json().catch(() => null);
    if (r.status === 400) {
      delete session.max_output_tokens;   /* v276: 답 길이 제한을 거절하면 빼고 한 번 더 */
      r = await ask(session);
      j = await r.json().catch(() => null);
    }
    if (r.status === 400) {
      delete session.audio.input.transcription;   /* 받아쓰기 모델 이름이 거절되면 받아쓰기 없이 한 번 더 */
      r = await ask(session);
      j = await r.json().catch(() => null);
    }
    const key = j && (j.value || (j.client_secret && j.client_secret.value));
    if (!r.ok || !key) {
      await refund(env, job);
      return json({ error: `음성 키 발급 실패 (${r.status}): ${JSON.stringify(j || {}).slice(0, 200)}`, refunded: true }, 502);
    }
    await done(env, job);
    return json({ key, model, cost, url: 'wss://api.openai.com/v1/realtime?model=' + encodeURIComponent(model) });
  } catch (e) {
    await refund(env, job);
    return json({ error: `음성 키 오류: ${e.message}`, refunded: true }, 500);
  }
}

/* OpenAI 권장: 이용자 구분값은 원래 ID 대신 해시로 */
function userHash(uid) {
  let h = 2166136261;
  for (const ch of 'coverfo:' + uid) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return 'cf-' + h.toString(16);
}

async function hangup(env, call) {
  try {
    await fetch('https://api.openai.com/v1/realtime/calls/' + encodeURIComponent(call) + '/hangup', {
      method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    });
  } catch {}
}

/* ── 공용 (voice.js 와 같은 방식) ── */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function sb(env) {
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const svc = env.SUPABASE_SERVICE_ROLE_KEY || '';
  return url && svc ? { url, svc } : null;
}
async function userId(request, env) {
  const c = sb(env);
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!c || !token) return '';
  if (token.startsWith('sd1.')) return checkDevice(env, token);   /* v276 앱 대기용 기기 키 */
  try {
    const r = await fetch(c.url + '/auth/v1/user', { headers: { apikey: c.svc, Authorization: 'Bearer ' + token } });
    if (!r.ok) return '';
    const u = await r.json();
    return u && u.id ? String(u.id) : '';
  } catch { return ''; }
}
async function rpc(c, name, args) {
  const r = await fetch(c.url + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: { apikey: c.svc, Authorization: 'Bearer ' + c.svc, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const t = await r.text();
  if (!r.ok) throw new Error('rpc ' + name + ' ' + r.status + ': ' + t.slice(0, 200));
  try { return JSON.parse(t); } catch { return t; }
}
/* 반환: job_id · false(크레딧 부족) */
async function spend(env, uid, cost, prompt) {
  const c = sb(env);
  if (!c) return null;
  let res;
  try { res = await rpc(c, 'cf_spend', { p_user: uid, p_cost: cost, p_kind: 'live', p_prompt: prompt }); }
  catch (e) { res = await rpc(c, 'cf_spend', { p_user: uid, p_cost: cost, p_kind: 'chat', p_prompt: prompt }); }
  if (!res || !res.ok) return false;
  return res.job_id != null ? res.job_id : null;
}
async function refund(env, job) {
  const c = sb(env);
  if (c && job != null) await rpc(c, 'cf_refund', { p_job: job }).catch(() => {});
}
async function done(env, job) {
  const c = sb(env);
  if (!c || job == null) return;
  await fetch(c.url + '/rest/v1/cf_jobs?id=eq.' + encodeURIComponent(job), {
    method: 'PATCH',
    headers: { apikey: c.svc, Authorization: 'Bearer ' + c.svc, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'done', updated_at: new Date().toISOString() }),
  }).catch(() => {});
}

/* ── v276 앱 '이름 부르기 대기'용 기기 키: sd1.<내용>.<서명> (HMAC-SHA256, 30일) ──
   서명 열쇠는 서버에만 있는 SUPABASE_SERVICE_ROLE_KEY 에서 만든다 (새 설정 불필요). 이 키는 talk-live(음성 대화)에서만 쓰인다. */
function cleanName(v) {
  const n = String(v || '').replace(/[^0-9A-Za-z가-힣]/g, '').slice(0, 10);
  return n || '소리야';
}
function isDevice(request) {
  return /^Bearer\s+sd1\./i.test(request.headers.get('Authorization') || '');
}
function b64u(bytes) {
  let s = ''; const a = new Uint8Array(bytes);
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64uText(t) { return b64u(new TextEncoder().encode(t)); }
function fromB64u(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  return new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
}
async function deviceKey(env) {
  const base = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!base) return null;
  return crypto.subtle.importKey('raw', new TextEncoder().encode('coverfo-sori-device:' + base), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function makeDevice(env, uid) {
  const k = await deviceKey(env);
  if (!k || !uid) return '';
  const body = b64uText(JSON.stringify({ u: uid, e: Date.now() + DEVICE_DAYS * 86400e3 }));
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('sd1.' + body));
  return 'sd1.' + body + '.' + b64u(sig);
}
async function checkDevice(env, token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return '';
    const k = await deviceKey(env);
    if (!k) return '';
    const sig = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((parts[2].length + 3) % 4)), (c) => c.charCodeAt(0));
    const ok = await crypto.subtle.verify('HMAC', k, sig, new TextEncoder().encode('sd1.' + parts[1]));
    if (!ok) return '';
    const p = JSON.parse(fromB64u(parts[1]));
    if (!p || !p.u || !(p.e > Date.now())) return '';
    return String(p.u);
  } catch { return ''; }
}
