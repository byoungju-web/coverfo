// functions/api/listen.js — coverfo 🎙 말하기 5단계 (v331) 의 서버 쪽: [2] 정확한 받아쓰기 · [4] 의도 추론
// © 2026 coverfo All Rights Reserved
//
// POST /api/listen  (Authorization: Bearer coverfo 로그인키)
//   multipart { op:"stt", audio(WAV 16kHz 모노 — 화면이 만들어 보냄), lang?("ko"…), hint?(단어 목록) }
//        → { text, conf(0~1 또는 null), lang, ticket, cost }
//          Cloudflare Workers AI  @cf/openai/whisper-large-v3-turbo (안 되면 @cf/openai/whisper 로 한 번 더)
//          hint(포도야·coverfo·내 루틴·연락처 이름 등)는 initial_prompt 로 넘겨 "보도야" 같은 오인식을 줄인다.
//          ticket: 같은 말 한 번에 쓰는 [4] 의도 추론을 2분 안에 한 번 더 차감 없이 부를 수 있는 표 (서버 서명)
//   JSON { op:"intent", text, country?, routines?:[이름], places?:[이름], ticket? }
//        → { tool, args, command, confidence(0~1), cost }
//          Llama 3.1 8B (@cf/meta/llama-3.1-8b-instruct) 가 정해 둔 도구 중 하나를 고른다 (JSON 으로 답하게 함).
//          📒 내 연락처의 내용(주소·생일·번호)은 서버로 오지 않는다 — 이름 목록도 화면이 고른 것만(루틴·장소 이름).
//
// · 크레딧: 말 한 번 = 0.1 (빠른 실행 AI 판단과 같은 0.1 묶음 · sql/cf_quick_pack.sql 의 cf_quick_pack_take/fill/undo).
//   묶음 표가 없으면 예전 방식처럼 1크레딧. 모델 호출이 실패하면 되돌린다.
// · 소리·사진·글은 저장하지 않는다 (크레딧 기록에 기능 이름과 앞부분 40자만).
// · 필요한 Secret: CF_AI_TOKEN (Workers AI 권한 토큰 — 사진으로 물어보기와 같은 것), CF_ACCOUNT_ID(없으면 기본값)

const STT_MODEL = '@cf/openai/whisper-large-v3-turbo';
const STT_FALLBACK = '@cf/openai/whisper';
const LLM_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const ACCOUNT_DEFAULT = '8e3361d320715cc98e7b66cb3127ca76';
const MAX_AUDIO = 3 * 1024 * 1024;   // 16kHz 모노 WAV 15초 ≈ 0.5MB
const TICKET_MS = 120e3;
const TOOLS = ['quick', 'remind', 'routine', 'my_note', 'search_memory', 'open_screen', 'calendar', 'chat', 'unclear'];

export async function onRequestPost(context) {
  const env = context.env || {};
  const request = context.request;
  if (!originOk(request)) return json({ error: 'forbidden' }, 403);
  const ai = aiOf(env);
  const c = sb(env);
  if (!ai || !c) return json({ error: '음성 기능이 아직 설정되지 않았어요 (CF_AI_TOKEN)', setup: true }, 503);
  const uid = await userId(c, request);
  if (!uid) return json({ error: '로그인이 필요합니다', login: true }, 401);

  const ctype = request.headers.get('Content-Type') || '';
  try {
    if (/multipart\/form-data/i.test(ctype)) {
      const fd = await request.formData();
      if (String(fd.get('op') || '') !== 'stt') return json({ error: '잘못된 요청입니다' }, 400);
      return json(await stt(env, ai, c, uid, fd));
    }
    let b = {};
    try { b = await request.json(); } catch { return json({ error: '잘못된 요청입니다' }, 400); }
    if (b.op === 'intent') return json(await intent(env, ai, c, uid, b));
    if (b.op === 'price') return json({ ok: true, cost: unitOf(env) });
    return json({ error: '잘못된 요청입니다' }, 400);
  } catch (e) {
    return json({ error: String((e && e.message) || e).slice(0, 300) }, e && e.status ? e.status : 500);
  }
}

/* ───────── [2] 받아쓰기 (Whisper) ───────── */
async function stt(env, ai, c, uid, fd) {
  const file = fd.get('audio');
  if (!file || typeof file.arrayBuffer !== 'function') throw err(400, '소리가 없어요');
  if (file.size > MAX_AUDIO) throw err(400, '말이 너무 길어요 (15초까지)');
  if (file.size < 3200) return { text: '', conf: 0, ticket: '', cost: 0 };   // 0.1초도 안 되는 소리
  const lang = String(fd.get('lang') || '').toLowerCase().replace(/[^a-z-]/g, '').slice(0, 5);
  const hint = String(fd.get('hint') || '').replace(/[\u0000-\u001f]/g, ' ').slice(0, 400);
  const bytes = new Uint8Array(await file.arrayBuffer());

  const ch = await charge(env, c, uid, '[음성] 받아쓰기');
  if (!ch.ok) throw err(402, '크레딧이 부족해요');
  try {
    let out = null;
    try {
      const input = { audio: b64(bytes) };
      if (lang && lang !== 'auto') input.language = lang.split('-')[0];
      if (hint) input.initial_prompt = hint;
      const r = await ai.run(STT_MODEL, input);
      out = { text: String((r && r.text) || '').trim(), conf: confOf(r), lang: (r && r.transcription_info && r.transcription_info.language) || lang || '' };
    } catch (e1) {
      /* 예비: 예전 Whisper (바이트 배열로 받음) */
      const r = await ai.run(STT_FALLBACK, { audio: [...bytes] });
      out = { text: String((r && r.text) || '').trim(), conf: null, lang: lang || '' };
    }
    return { text: out.text.slice(0, 500), conf: out.conf, lang: out.lang, ticket: await ticket(env, uid), cost: ch.unit };
  } catch (e) {
    await uncharge(c, uid, ch);
    throw err(502, '받아쓰기를 하지 못했어요');
  }
}
/* Whisper 의 구간별 avg_logprob · no_speech_prob 로 0~1 확신값 (없으면 null) */
function confOf(r) {
  const segs = r && Array.isArray(r.segments) ? r.segments : [];
  if (!segs.length) return null;
  let s = 0, n = 0, ns = 0;
  for (const g of segs) {
    if (typeof g.avg_logprob === 'number') { s += Math.exp(g.avg_logprob); n++; }
    if (typeof g.no_speech_prob === 'number') ns = Math.max(ns, g.no_speech_prob);
  }
  if (!n) return null;
  return Math.max(0, Math.min(1, (s / n) * (1 - ns * 0.5)));
}

/* ───────── [4] 의도 추론 (Llama 3.1 8B · JSON) ───────── */
async function intent(env, ai, c, uid, b) {
  const text = String(b.text || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!text) return { tool: 'unclear', args: {}, command: '', confidence: 0, cost: 0 };
  const country = String(b.country || 'KR').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) || 'KR';
  const names = (v) => (Array.isArray(v) ? v : []).map((x) => String(x || '').replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 12)).filter(Boolean).slice(0, 20);
  const routines = names(b.routines), places = names(b.places);

  /* 같은 말에서 받아쓰기를 이미 차감했으면(표) 이번엔 차감 없음 */
  let ch = { ok: true, unit: 0, free: true };
  if (!(await ticketOk(env, uid, String(b.ticket || '')))) {
    ch = await charge(env, c, uid, '[음성] 의도 추론: ' + text.slice(0, 40));
    if (!ch.ok) throw err(402, '크레딧이 부족해요');
  }
  const sys = [
    'You are the command router of coverfo, a Korean all-in-one assistant app. The user SPOKE one sentence (already transcribed and normalized).',
    'Pick exactly ONE tool and return ONLY JSON: {"tool": T, "args": {...}, "command": C, "confidence": N}',
    'Tools:',
    '  quick        - open a map/app/site: places/restaurants, directions, taxi, shopping, hotel, flight, train, rental car, food delivery, music/YouTube, weather, phone call or SMS to a saved name. args {"kind": one of place|navi|taxi|shop|stay|flight|train|rental|delivery|music|weather|call|sms, "target": the place/item/song/person}',
    '  remind       - set a reminder at a time ("3시에 회의 알려줘", "매달 25일 월세"). args {"when": time words as said, "what": short text}',
    '  routine      - run one of the user\'s one-word routines. args {"name": exact routine name}. Routine names: ' + (routines.length ? routines.join(', ') : '(none)'),
    '  my_note      - ask about the user\'s own saved info: birthday/anniversary, home/work address, usual food. args {"query": words}',
    '  search_memory- find something the user looked at or did before ("어제 그 패딩", "아까 본 맛집 다시"). args {"query": what it was, "open": true|false}',
    '  open_screen  - make an app/website, an image, a video, a 3D model, or open the interpreter (통역톡). args {"screen": app_maker|image_maker|video_maker|3d_maker|interpreter, "text": what to make}',
    '  calendar     - add an event to the calendar ("다음 주 화요일 치과 일정 넣어줘"). args {"text": the request}',
    '  chat         - a question, explanation, writing, advice or chit-chat to be answered in chat. args {}',
    '  unclear      - the sentence is garbled, cut off or ambiguous. args {}',
    'C = one short natural Korean command sentence (in the user\'s language) that performs the action, keeping all names, dates and numbers exactly as said, e.g. "부산역 맛집 알려줘", "오후 3시에 회의 알려줘", "퇴근". For chat/unclear C = the original sentence.',
    'N = your confidence 0.0-1.0 that this tool and these args are exactly what the user meant. Use below 0.7 when words look misheard, a needed value (place, time, name) is missing, or two tools fit.',
    'Saved place names (may appear as destinations): ' + (places.length ? places.join(', ') : '(none)'),
    'User country: ' + country,
    'Never invent names, places, times or numbers that are not in the sentence.',
  ].join('\n');
  try {
    const r = await runLlm(ai, { messages: [{ role: 'system', content: sys }, { role: 'user', content: text }], max_tokens: 220, temperature: 0.1 });
    const j = extractJson(String((r && r.response) || '')) || {};
    const tool = TOOLS.includes(j.tool) ? j.tool : 'unclear';
    const args = j.args && typeof j.args === 'object' && !Array.isArray(j.args) ? clip(j.args) : {};
    let conf = Number(j.confidence);
    if (!Number.isFinite(conf)) conf = 0.5;
    conf = Math.max(0, Math.min(1, conf));
    const command = String(j.command || text).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200) || text;
    return { tool, args, command, confidence: conf, cost: ch.unit };
  } catch (e) {
    if (!ch.free) await uncharge(c, uid, ch);
    return { tool: 'unclear', args: {}, command: text, confidence: 0, cost: 0, error: String((e && e.message) || e).slice(0, 160) };
  }
}
let agreed = false;
async function runLlm(ai, input) {
  try { return await ai.run(LLM_MODEL, input); }
  catch (e) {
    /* Meta 라이선스 동의가 필요하다는 답이면 한 번 "agree" 를 보내고 다시 (사진으로 물어보기와 같은 방식) */
    if (!agreed && /agree|licen[cs]e|accept/i.test(String((e && e.message) || ''))) {
      await ai.run(LLM_MODEL, { prompt: 'agree' }).catch(() => undefined);
      agreed = true;
      return await ai.run(LLM_MODEL, input);
    }
    throw e;
  }
}
function clip(o) {
  const out = {};
  for (const k of Object.keys(o).slice(0, 8)) {
    const v = o[k];
    if (typeof v === 'boolean' || typeof v === 'number') out[k] = v;
    else out[k] = String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').slice(0, 120);
  }
  return out;
}
function extractJson(t) {
  const m = String(t || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

/* ───────── 크레딧 (빠른 실행 AI 판단과 같은 0.1 묶음) ───────── */
function costOf(env) { const n = Number(env.COST_QUICK); return Number.isFinite(n) && n >= 0 ? n : 1; }
function packOf(env) { const n = Math.floor(Number(env.QUICK_PACK)); return Number.isFinite(n) && n >= 1 && n <= 1000 ? n : 10; }
function unitOf(env) { return Math.round((costOf(env) / packOf(env)) * 100) / 100; }
async function charge(env, c, uid, label) {
  let packOn = false, left = null;
  const t = await rpc(c, 'cf_quick_pack_take', { p_user: uid }).catch(() => null);
  if (t && typeof t === 'object' && 'ok' in t) { packOn = true; if (t.ok) left = Number(t.left || 0); }
  if (left !== null) return { ok: true, packOn, unit: unitOf(env) };
  const cost = costOf(env), size = packOf(env);
  const s = await spend(c, uid, cost, label + (packOn ? ' (' + size + '회 묶음)' : '')).catch(() => null);
  if (!s || !s.ok) return { ok: false };
  if (packOn) await rpc(c, 'cf_quick_pack_fill', { p_user: uid, p_n: size - 1, p_src: 'credit' }).catch(() => null);
  return { ok: true, packOn, job: s.job_id, unit: packOn ? unitOf(env) : cost };
}
async function uncharge(c, uid, ch) {
  if (!ch || !ch.ok) return;
  if (ch.packOn) await rpc(c, 'cf_quick_pack_undo', { p_user: uid }).catch(() => undefined);
  else if (ch.job != null) await rpc(c, 'cf_refund', { p_job: ch.job }).catch(() => undefined);
}
async function spend(c, uid, cost, q) {
  try { return await rpc(c, 'cf_spend', { p_user: uid, p_cost: cost, p_kind: 'quick', p_prompt: q }); }
  catch (e) { return await rpc(c, 'cf_spend', { p_user: uid, p_cost: cost, p_kind: 'chat', p_prompt: q }); }
}

/* ───────── 표 (같은 말 한 번에 받아쓰기 + 의도 추론을 0.1 한 번으로) ───────── */
async function hkey(env) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode('coverfo-voice:' + (env.SUPABASE_SERVICE_ROLE_KEY || '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
function hex(buf) { return Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, '0')).join(''); }
async function ticket(env, uid) {
  const exp = Date.now() + TICKET_MS;
  const sig = hex(await crypto.subtle.sign('HMAC', await hkey(env), new TextEncoder().encode(uid + '|' + exp)));
  return exp + '.' + sig;
}
async function ticketOk(env, uid, t) {
  const m = /^(\d{10,16})\.([0-9a-f]{64})$/.exec(t || '');
  if (!m || Number(m[1]) < Date.now()) return false;
  const want = hex(await crypto.subtle.sign('HMAC', await hkey(env), new TextEncoder().encode(uid + '|' + m[1])));
  if (want.length !== m[2].length) return false;
  let d = 0;
  for (let i = 0; i < want.length; i++) d |= want.charCodeAt(i) ^ m[2].charCodeAt(i);
  return d === 0;
}

/* ───────── 공용 (사진으로 물어보기 lens-ask.js 와 같은 방식) ───────── */
function aiOf(env) {
  if (env.AI && typeof env.AI.run === 'function') return env.AI;
  const token = String(env.CF_AI_TOKEN || '').trim();
  const acct = String(env.CF_ACCOUNT_ID || ACCOUNT_DEFAULT).trim();
  if (!token || !acct) return null;
  return {
    run: async (model, input) => {
      const r = await fetch('https://api.cloudflare.com/client/v4/accounts/' + acct + '/ai/run/' + model, {
        method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || j.success === false) {
        const m = j && j.errors && j.errors[0] ? (j.errors[0].message || JSON.stringify(j.errors[0])) : ('HTTP ' + r.status);
        throw new Error(String(m));
      }
      return j.result || {};
    },
  };
}
function b64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function err(status, message) { const e = new Error(message); e.status = status; return e; }
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function sb(env) {
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '');
  return url && key ? { url, key } : null;
}
async function rpc(c, name, args) {
  const r = await fetch(c.url + '/rest/v1/rpc/' + name, { method: 'POST', headers: { apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) });
  const t = await r.text();
  if (!r.ok) throw new Error('rpc ' + name + ' ' + r.status);
  try { return JSON.parse(t); } catch { return t; }
}
async function userId(c, request) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || token.startsWith('sd1.')) return '';
  const r = await fetch(c.url + '/auth/v1/user', { headers: { apikey: c.key, Authorization: 'Bearer ' + token } }).catch(() => null);
  if (!r || !r.ok) return '';
  const u = await r.json().catch(() => null);
  return u && u.id ? String(u.id) : '';
}
function originOk(request) {
  const origin = request.headers.get('Origin') || '';
  if (!origin) return true;
  let h = '';
  try { h = new URL(origin).hostname; } catch (e) {}
  return h === 'coverfo.com' || h.endsWith('.coverfo.com') || h === 'coverfo.world' || h.endsWith('.coverfo.world') || h.endsWith('.pages.dev');
}
