// functions/api/talk-live.js — coverfo 🗣️ 소리 (말로 주고받는 음성 비서)
// © 2026 coverfo All Rights Reserved
//
// POST /api/talk-live   (Authorization: Bearer 로그인토큰)
//   { op:"start", sdp }  → 첫 1분 크레딧 차감 후 OpenAI Realtime 에 연결(WebRTC). 응답 { sdp, call, cost }
//   { op:"tick",  call } → 1분마다 화면이 부른다. 다음 1분 크레딧 차감. 부족하면 통화를 끊고 402
//   { op:"end",   call } → 통화 끊기
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

const INSTRUCTIONS = [
  "You are '소리', the voice assistant of coverfo (a Korean all-in-one assistant web app).",
  'Speak in the same language as the user (default Korean, polite 해요체). Keep answers short and natural for speech: 1-3 sentences.',
  'If the user interrupts, stop and listen.',
  'When the user wants an ACTION that the coverfo home screen can do — map/places/restaurants (맛집), attractions (가볼만한곳), navigation (길안내/내비), hotel booking (숙소 예약), shopping or checkout screen (쇼핑/결제 화면), taxi, food delivery, music playback, weather, flights, trains, phone call or SMS —',
  'call the tool run_command with ONE concise command sentence in the user\'s language that includes all details they said (place, date, nights, people, model number, color). Before calling, say only a very short line like "네, 열어 드릴게요."',
  'After a command runs the conversation CONTINUES (v265): the user may now be looking at another app such as a navigation map, so keep talking briefly by voice and keep helping.',
  'When the user says things like "홈으로", "홈 화면", "이전 화면", "돌아가", "대화 보여줘", "대화 목록" (go home / go back / show the conversation), call the tool show_chat and say a very short line like "대화 화면을 열게요."',
  'For questions, chit-chat or explanations, just answer by voice without the tool.',
  'Never ask for or repeat card numbers, ID numbers, passwords or bank account numbers. coverfo does not take payments; payment happens on each shop\'s site by the user.',
].join(' ');

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
  name: 'show_chat',
  description: 'Go back to the coverfo home screen and show the voice conversation panel (when the user says go home, go back, previous screen, show the conversation/list).',
  parameters: { type: 'object', properties: {} },
}];

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
    if (!call) return json({ error: '통화 정보가 없습니다' }, 400);
    let job;
    try { job = await spend(env, uid, cost, 'live:minute'); }
    catch (e) { await hangup(env, call); return json({ error: '크레딧 처리 실패' }, 500); }
    if (job === false) { await hangup(env, call); return json({ error: '크레딧이 부족해 대화를 마쳤어요', need: cost }, 402); }
    await done(env, job);
    return json({ ok: true, cost });
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
