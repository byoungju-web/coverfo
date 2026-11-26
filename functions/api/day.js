// functions/api/day.js — coverfo 🗓 하루 대행 비서 (v493) · 기억 기반 계획
// © 2026 coverfo All Rights Reserved
//
// POST /api/day   (Authorization: Bearer coverfo 로그인키)
//   { op:'plan', text, mem:[{ id, cat, text }] }
//     → { ok, plan:{ title, say, ask, steps:[{ time, kind, title, detail, place, item, query, cost, pay, mem:[id] }], used:[id], learn:[문장] }, cost }
//   · mem 은 화면에서 "이 기억 써도 돼?"를 켜 둔 기억만 보낸다 (기억은 /api/memory 가 저장 · 이 서버는 저장하지 않음)
//   · kind: taxi | coffee | meeting | gift | food | remind | other
//   · pay=true 인 단계(돈이 나가는 것)는 화면에서 반드시 유저 확인을 받는다. 이 서버는 결제·주문·호출을 하지 않는다.
// · AI: Anthropic (HUB_MODEL, 기본 claude-sonnet-5-5) — plan.js(한 번에 준비)와 같은 경유 방식
// · 크레딧: 1번 DAY_COST(기본 1) · AI 가 실패하면 돌려준다 (cf_spend · cf_refund — 결제·충전 코드는 건드리지 않음)
// · 문장·계획은 저장하지 않는다

const MODEL_DEFAULT = 'claude-sonnet-5-5';
const DAY_COST = 1;
const KINDS = ['taxi', 'coffee', 'meeting', 'gift', 'food', 'remind', 'other'];

export async function onRequestGet(context) {
  return json({ ok: true, cost: costOf(context.env || {}) });
}

export async function onRequestPost(context) {
  const env = context.env || {};
  const uid = await userId(context.request, env);
  if (!uid) return json({ error: '로그인이 필요합니다', login: true }, 401);
  let b = {};
  try { b = await context.request.json(); } catch { return json({ error: '잘못된 요청입니다' }, 400); }
  const text = s(b.text, 400);
  if (!text) return json({ error: '오늘 무엇을 맡길지 말씀해 주세요' }, 400);
  if (/(?:\d[ -]?){13,19}/.test(text)) return json({ error: '카드·계좌 번호 같은 긴 숫자는 넣을 수 없어요' }, 400);
  const mem = (Array.isArray(b.mem) ? b.mem : []).slice(0, 60).map((m) => ({ id: s(m && m.id, 40), cat: s(m && m.cat, 10), text: s(m && m.text, 120) })).filter((m) => m.id && m.text);
  if (!env.ANTHROPIC_API_KEY && !(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)) return json({ error: 'AI 설정이 없어요 (ANTHROPIC_API_KEY)' }, 500);

  const cost = costOf(env);
  let job = null;
  try { job = await spend(env, uid, cost, '[하루 대행] ' + text.slice(0, 80)); }
  catch (e) { return json({ error: String((e && e.message) || e).slice(0, 200) }, 500); }
  if (job === false) return json({ error: '크레딧이 부족합니다', need: cost, needCredit: true }, 402);
  try {
    const raw = await askAI(env, text, mem);
    const plan = tidy(raw, mem);
    if (!plan.steps.length && !plan.ask) throw new Error('계획이 비었어요');
    await doneJob(env, job);
    return json({ ok: true, plan, cost });
  } catch (e) {
    await refund(env, job);
    return json({ error: '계획을 세우지 못했어요 · 크레딧은 돌려드렸어요 (' + String((e && e.message) || e).slice(0, 120) + ')', refunded: true }, 500);
  }
}

function costOf(env) { const n = Number(env.DAY_COST); return env.DAY_COST !== undefined && env.DAY_COST !== '' && Number.isFinite(n) && n >= 0 ? n : DAY_COST; }
function s(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
function nowKst() {
  const d = new Date(Date.now() + 9 * 3600e3);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getUTCDay()];
  return d.toISOString().slice(0, 10) + ' (' + wd + '요일) ' + d.toISOString().slice(11, 16) + ' 한국시간';
}

function system(mem) {
  const memTxt = mem.length ? mem.map((m) => `[${m.id}] (${m.cat}) ${m.text}`).join('\n') : '(사용해도 되는 기억 없음)';
  return [
    '너는 coverfo 의 하루 대행 비서 "포도야"다. 이용자의 한 문장을 오늘(또는 말한 날) 할 일 순서표로 만든다.',
    '지금: ' + nowKst(),
    '이용자가 "써도 된다"고 허락한 기억 (id 와 함께):',
    memTxt,
    '규칙:',
    '- 기억을 먼저 쓴다. 이용자가 말하지 않은 것(출발지·자주 가는 곳·좋아하는 커피·예산·지난 선물 등)은 기억에서 채우고, 그 단계의 mem 에 쓴 기억 id 를 넣는다. 기억에 없는 것은 지어내지 않는다.',
    '- 기억으로도 채울 수 없는 꼭 필요한 정보가 있으면 ask 에 한 문장으로 묻는다 (예: "회의 장소가 어디야?"). 그래도 알 수 있는 단계는 만든다.',
    '- 시간 순서(HH:MM 24시간)로 단계를 만든다. 이동은 회의 시작 전에 여유 있게, 커피는 이동 경로 중에. 회의·약속이면 10분 전 알림(remind) 단계를 넣는다.',
    '- kind: taxi(택시) | coffee(커피·음료) | meeting(회의·약속) | gift(선물) | food(식사·배달) | remind(알림) | other.',
    '- place: 그 단계의 장소 이름(택시는 "출발→도착"). item: 주문할 것(예: 아메리카노 HOT 1잔). query: 쇼핑·지도 검색어(선물은 "예산 안의 구체 상품 종류", 기억에 있는 싫어하는 것·작년 선물과 겹치지 않게).',
    '- cost: 예상 금액(원, 정수, 모르면 0 — 택시는 거리 모르면 0). pay: 돈이 나가는 단계면 true.',
    '- say: 반말 친근체 한두 문장. 기억을 썼으면 "평소대로"처럼 자연스럽게 (예: "알겠어! 평소대로 9시 30분 택시 + 아메리카노 HOT으로 할게?"). 선물이면 "작년 홍삼이랑 안 겹치게 디퓨저 어때?"처럼.',
    '- learn: 이번 문장에서 새로 알게 된, 다음에도 쓸 만한 사실 0~2개 (예: "평일 10시 강남 사무실 회의가 잦음"). 건강·병명·전화·주소 번호·계좌는 넣지 않는다.',
    '- 너는 실제로 호출·주문·결제하지 않는다. 계획만 만든다.',
    'JSON 하나로만 답한다: {"title":"…","say":"…","ask":"","steps":[{"time":"09:30","kind":"taxi","title":"…","detail":"…","place":"…","item":"","query":"","cost":0,"pay":true,"mem":["id"]}],"used":["id"],"learn":["…"]}'
  ].join('\n');
}

async function askAI(env, text, mem) {
  const r = await anthropicFetch(env, '/v1/messages', {
    method: 'POST',
    body: JSON.stringify({ model: env.HUB_MODEL || MODEL_DEFAULT, max_tokens: 1500, system: system(mem), messages: [{ role: 'user', content: text }] }),
  });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  if (!r.ok || !j || !Array.isArray(j.content)) throw new Error('AI 오류 ' + r.status);
  const txt = j.content.filter((c) => c && c.type === 'text').map((c) => c.text || '').join('\n');
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI 가 계획을 돌려주지 않았어요');
  return JSON.parse(m[0]);
}

function tidy(p, mem) {
  const ids = new Set(mem.map((m) => m.id));
  const steps = (Array.isArray(p.steps) ? p.steps : []).slice(0, 10).map((x) => {
    const tm = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s(x.time, 5));
    const cost = Math.round(Number(x.cost) || 0);
    return {
      time: tm ? tm[1].padStart(2, '0') + ':' + tm[2] : '',
      kind: KINDS.includes(x.kind) ? x.kind : 'other',
      title: s(x.title, 40), detail: s(x.detail, 120), place: s(x.place, 60), item: s(x.item, 60), query: s(x.query, 40),
      cost: cost > 0 && cost < 1e8 ? cost : 0,
      pay: !!x.pay || ['taxi', 'coffee', 'gift', 'food'].includes(x.kind),
      mem: (Array.isArray(x.mem) ? x.mem : []).map((v) => s(v, 40)).filter((v) => ids.has(v)).slice(0, 5),
    };
  }).filter((x) => x.title);
  steps.sort((a, b) => (a.time || '99') < (b.time || '99') ? -1 : 1);
  return {
    title: s(p.title, 40) || '오늘의 대행', say: s(p.say, 200), ask: s(p.ask, 120), steps,
    used: (Array.isArray(p.used) ? p.used : []).map((v) => s(v, 40)).filter((v) => ids.has(v)),
    learn: (Array.isArray(p.learn) ? p.learn : []).map((v) => s(v, 80)).filter((v) => v && !/(?:\d[ -]?){9,}/.test(v)).slice(0, 2),
  };
}

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
