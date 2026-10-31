// functions/api/plan.js — coverfo 🧳 한 번에 준비 (v285, 에이전트 실행 1단계)
// © 2026 coverfo All Rights Reserved
//
// GET  /api/plan                         → { cost }  (화면 표시용)
// POST /api/plan  (Authorization: Bearer 로그인키 — coverfo 로그인 또는 coverfo 소리 앱의 기기 키 sd1.…)
//   { text, country }                    → { ok, plan, cost }
//
// · 하는 일: "내일 제주 1박 출장 준비해줘" 같은 말을 AI 가 '계획'으로만 나눈다 (어디서 → 어디로, 날짜, 인원, 필요한 단계, 준비물).
//   항공권·숙소·렌터카·날씨 주소를 만드는 일은 화면(cf-quick.js 의 기존 규칙)이 한다 → 이 서버는 예약·결제·외부 사이트 접속을 하지 않는다.
// · 출발지를 말하지 않으면 (한국 이용자): 국내 목적지는 김포, 해외 목적지는 인천 (2026-10-29 결정).
// · AI: Anthropic (HUB_MODEL, 기본 claude-sonnet-5-5) — hub.js 와 같은 경유 방식(ENGINE_PROXY → Supabase anthropic-relay).
// · 크레딧: 1번 PLAN_COST(기본 1). AI 가 실패하면 돌려준다 (cf_spend · cf_refund — 결제·충전 코드는 건드리지 않음).
// · 문장·계획은 저장하지 않는다.

const MODEL_DEFAULT = 'claude-sonnet-5-5';
const PLAN_COST = 1;
const STEP_KINDS = ['flight', 'train', 'stay', 'rental', 'weather', 'food'];

export async function onRequestGet(context) {
  return json({ ok: true, cost: costOf(context.env || {}) });
}

export async function onRequestPost(context) {
  const env = context.env || {};
  const uid = await userId(context.request, env);
  if (!uid) return json({ error: '로그인이 필요합니다', login: true }, 401);
  let b = {};
  try { b = await context.request.json(); } catch { return json({ error: '잘못된 요청입니다' }, 400); }
  const text = String(b.text || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 500);
  if (!text) return json({ error: '무엇을 준비할지 말씀해 주세요' }, 400);
  const country = /^[A-Z]{2}$/.test(String(b.country || '')) ? String(b.country) : 'KR';
  if (!env.ANTHROPIC_API_KEY && !(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)) return json({ error: 'AI 설정이 없어요 (ANTHROPIC_API_KEY)' }, 500);

  const cost = costOf(env);
  let job = null;
  try { job = await spend(env, uid, cost, '[한 번에 준비] ' + text.slice(0, 80)); }
  catch (e) { return json({ error: String((e && e.message) || e).slice(0, 200) }, 500); }
  if (job === false) return json({ error: '크레딧이 부족합니다', need: cost }, 402);

  let plan;
  try {
    plan = clean(await askAI(env, text, country), country);
  } catch (e) {
    await refund(env, job);
    return json({ error: '계획을 세우지 못했어요 · 크레딧은 돌려드렸어요 (' + String((e && e.message) || e).slice(0, 160) + ')', refunded: true }, 500);
  }
  await doneJob(env, job);
  return json({ ok: true, plan, cost });
}

function costOf(env) {
  const n = Number(env.PLAN_COST);
  return Number.isFinite(n) && n >= 0 ? n : PLAN_COST;
}

/* ───────────── AI 에게 계획만 받기 (도구 하나로 모양을 고정) ───────────── */

function nowKst() {
  const d = new Date(Date.now() + 9 * 3600e3);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getUTCDay()];
  return d.toISOString().slice(0, 10) + ' (' + wd + '요일), ' + d.toISOString().slice(11, 16) + ' Asia/Seoul';
}

const PLAN_TOOL = {
  name: 'make_plan',
  description: 'Return the trip plan.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short title in the user\'s language, e.g. "제주 1박 출장"' },
      kind: { type: 'string', enum: ['business', 'leisure'] },
      from: { type: 'string', description: 'Departure city as the user said it. "" if not said.' },
      to: { type: 'string', description: 'Destination city (common short name, e.g. 제주, 부산, 도쿄, 오사카, 방콕)' },
      area: { type: 'string', description: 'Where to stay / rent a car. Usually same as "to"; a more specific area only if the user named one (e.g. 서귀포)' },
      abroad: { type: 'boolean', description: 'true if the destination is in a different country from the user\'s country' },
      dep: { type: 'string', description: 'Departure / check-in date YYYY-MM-DD' },
      ret: { type: 'string', description: 'Return / check-out date YYYY-MM-DD. "" for a day trip or one-way' },
      ppl: { type: 'integer', minimum: 1, maximum: 9 },
      guessed: { type: 'boolean', description: 'true if the user gave no usable date and you guessed dep/ret' },
      steps: { type: 'array', items: { type: 'string', enum: STEP_KINDS }, description: 'What to prepare, in order' },
      checklist: { type: 'array', items: { type: 'string' }, description: '6-12 short packing / to-do items in the user\'s language' },
      tip: { type: 'string', description: 'One short practical tip in the user\'s language (no prices, no made-up facts). "" if none.' },
    },
    required: ['title', 'kind', 'from', 'to', 'area', 'abroad', 'dep', 'ret', 'ppl', 'guessed', 'steps', 'checklist', 'tip'],
  },
};

function system(country) {
  return [
    'You turn one sentence like "내일 제주 1박 출장 준비해줘" into a travel preparation plan for coverfo. You do NOT book or pay anything; the app only opens search pages.',
    'Current date/time: ' + nowKst() + '. User country: ' + country + '. Resolve 오늘/내일/모레/이번 주말/다음 주 금요일 etc. from this date.',
    'Rules:',
    '- dep = departure (check-in) date. ret = dep + nights for stays ("1박" → ret = dep + 1 day; "2박3일" → ret = dep + 2). Day trip → ret "". If the user said a return date, use it.',
    '- If no usable date at all, use tomorrow as dep, set ret from nights (default 1 night for a trip), and set guessed=true.',
    '- ppl: number of people if said; otherwise 1 for business trips and 2 when the sentence implies a couple/family (둘이, 가족, 아내와 …); otherwise 1.',
    '- from: only what the user said (city name). Leave "" if not said. Do not invent a departure city.',
    '- to / area: city names in the user\'s language. For Korea use short names: 제주, 부산, 서울, 강릉, 여수, 경주, 속초, 대구, 광주.',
    '- steps (choose only what fits, in this order):',
    '  flight — destination is abroad, or an island such as 제주, or the user mentioned 비행기/항공. Not for short domestic mainland trips unless asked.',
    '  train — domestic mainland trip in Korea (e.g. 서울→부산, 서울→강릉) or the user mentioned KTX/SRT/기차. Not together with flight.',
    '  stay — only if there is at least one night (ret after dep) or the user asked for a hotel.',
    '  rental — the user asked for a car, or the destination is 제주 or a place people usually drive around (e.g. 하와이, 괌, 오키나와).',
    '  weather — always.',
    '  food — only if the user asked about restaurants/맛집.',
    '- checklist: 6-12 short items fitting the trip (business: 신분증, 노트북·충전기, 명함, 회의 자료 …; abroad: 여권, 환전·카드, 유심/로밍, 여행자보험, 전원 어댑터 …; Jeju with rental: 운전면허증). User\'s language.',
    '- tip: one short practical tip, or "". Never state prices, flight times or availability.',
    'Always answer by calling the make_plan tool exactly once (no other text). If you cannot call it, reply with only the same JSON object.',
  ].join('\n');
}

async function askAI(env, text, country) {
  const r = await anthropicFetch(env, '/v1/messages', {
    method: 'POST',
    body: JSON.stringify({
      model: env.HUB_MODEL || MODEL_DEFAULT,
      max_tokens: 1200,
      system: system(country),
      tools: [PLAN_TOOL],
      /* v293: 이 모델은 tool_choice 로 도구를 강제하는 것(type tool·any)을 받지 않는다 (AI 오류 400 실측) → 기본(auto) + 지시문으로 부르게 하고, 글로 답하면 그 안의 JSON 을 읽는다 */
      messages: [{ role: 'user', content: text }],
    }),
  });
  const t = await r.text();
  let j = null;
  try { j = JSON.parse(t); } catch {}
  if (!r.ok || !j || !Array.isArray(j.content)) throw new Error('AI 오류 ' + r.status + ': ' + ((j && j.error && j.error.message) || t).slice(0, 120));
  const tu = j.content.find((c) => c && c.type === 'tool_use' && c.name === 'make_plan');
  if (tu && tu.input && typeof tu.input === 'object') return tu.input;
  const txt = j.content.filter((c) => c && c.type === 'text').map((c) => c.text || '').join('\n');
  const m = txt.match(/\{[\s\S]*\}/);
  if (m) { try { const o = JSON.parse(m[0]); if (o && typeof o === 'object') return o; } catch {} }
  throw new Error('AI 가 계획을 돌려주지 않았어요');
}

/* ───────────── 받은 계획 다듬기 (모양·길이·날짜 확인 + 출발지 기본값) ───────────── */

function s(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
function isDate(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))) return false;
  const d = new Date(v + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === v;
}
function kstToday() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }
function addDays(ymd, n) { const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

function clean(p, country) {
  const to = s(p.to, 40);
  if (!to) throw new Error('목적지를 찾지 못했어요');
  const today = kstToday();
  let dep = isDate(p.dep) && p.dep >= today ? p.dep : addDays(today, 1);
  let ret = isDate(p.ret) && p.ret > dep ? p.ret : '';
  if (ret && ret > addDays(dep, 60)) ret = '';
  const abroad = !!p.abroad;
  let from = s(p.from, 40);
  let fromDefault = false;
  /* 출발지를 말하지 않으면 (한국 이용자): 국내 목적지는 김포, 해외 목적지는 인천 */
  if (!from && country === 'KR') { from = abroad ? '인천' : '김포'; fromDefault = true; }
  let steps = Array.isArray(p.steps) ? p.steps.filter((k, i, a) => STEP_KINDS.includes(k) && a.indexOf(k) === i) : [];
  if (steps.includes('flight') && steps.includes('train')) steps = steps.filter((k) => k !== 'train');
  if (!ret) steps = steps.filter((k) => k !== 'stay');   /* 당일치기면 숙소 없음 */
  if (!steps.includes('weather')) steps.push('weather');
  const ppl = Math.min(9, Math.max(1, parseInt(p.ppl, 10) || 1));
  const checklist = (Array.isArray(p.checklist) ? p.checklist : []).map((x) => s(x, 40)).filter(Boolean).slice(0, 15);
  return {
    title: s(p.title, 40) || to,
    kind: p.kind === 'leisure' ? 'leisure' : 'business',
    from, fromDefault,
    to,
    area: s(p.area, 40) || to,
    abroad,
    dep, ret,
    nights: ret ? Math.round((new Date(ret + 'T00:00:00Z') - new Date(dep + 'T00:00:00Z')) / 86400e3) : 0,
    ppl,
    guessed: !!p.guessed,
    steps,
    checklist,
    tip: s(p.tip, 120),
  };
}

/* ───────────── 공통 (hub.js 와 같은 방식) ───────────── */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function anthropicFetch(env, path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('x-api-key', env.ANTHROPIC_API_KEY || '');
  headers.set('anthropic-version', '2023-06-01');
  headers.set('content-type', 'application/json');
  let target = 'https://api.anthropic.com' + path;
  const sbUrl = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  const svc = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (sbUrl && svc && (env.ENGINE_PROXY || 'on') !== 'off') {
    target = sbUrl + '/functions/v1/anthropic-relay' + path;
    headers.set('Authorization', 'Bearer ' + svc);
    headers.set('apikey', svc);
    headers.set('x-region', env.GOOGLE_PROXY_REGION || 'ap-northeast-2');
  }
  return fetch(target, { ...init, headers });
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
  if (token.startsWith('sd1.')) return checkDevice(env, token);
  try {
    const r = await fetch(c.url + '/auth/v1/user', { headers: { apikey: c.svc, Authorization: 'Bearer ' + token } });
    if (!r.ok) return '';
    const u = await r.json();
    return u && u.id ? String(u.id) : '';
  } catch { return ''; }
}
async function checkDevice(env, token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return '';
    const base = env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!base) return '';
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode('coverfo-sori-device:' + base), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('HMAC', k, fromB64u(parts[2]), new TextEncoder().encode('sd1.' + parts[1]));
    if (!ok) return '';
    const p = JSON.parse(new TextDecoder().decode(fromB64u(parts[1])));
    if (!p || !p.u || !(p.e > Date.now())) return '';
    return String(p.u);
  } catch { return ''; }
}
function fromB64u(v) {
  v = String(v).replace(/-/g, '+').replace(/_/g, '/'); while (v.length % 4) v += '=';
  return Uint8Array.from(atob(v), (c) => c.charCodeAt(0));
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
/* 크레딧 (hub.js 와 같은 방식): kind 'relay' 가 안 되면 'chat'. 반환 job_id · false(부족) · null(설정 없음) */
async function spend(env, uid, cost, label) {
  const c = sb(env);
  if (!c || !cost) return null;
  for (const kind of ['relay', 'chat']) {
    try {
      const res = await rpc(c, 'cf_spend', { p_user: uid, p_cost: cost, p_kind: kind, p_prompt: label });
      if (res && res.ok) return res.job_id != null ? res.job_id : null;
      return false;
    } catch {}
  }
  throw new Error('크레딧 처리 실패');
}
async function refund(env, job) {
  const c = sb(env);
  if (c && job != null && job !== false) await rpc(c, 'cf_refund', { p_job: job }).catch(() => {});
}
async function doneJob(env, job) {
  const c = sb(env);
  if (!c || job == null || job === false) return;
  await fetch(c.url + '/rest/v1/cf_jobs?id=eq.' + encodeURIComponent(job), {
    method: 'PATCH',
    headers: { apikey: c.svc, Authorization: 'Bearer ' + c.svc, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'done', updated_at: new Date().toISOString() }),
  }).catch(() => {});
}
