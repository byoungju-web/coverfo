// functions/api/haggle.js — coverfo 💬 AI 흥정·문의 비서 (v491)
// © 2026 coverfo All Rights Reserved
//
// POST /api/haggle   (Authorization: Bearer coverfo 로그인키)
//   { op:'draft', kind, ask, target?, price?, want?, me? }
//      → { ok, drafts:{ polite, casual, firm }, cost }        보낼 첫 문장 (말투 3가지를 한 번에)
//   { op:'reply', kind, ask, sent, reply, price?, want?, countered? }
//      → { ok, r:{ type, summary, before, after, saved, accept_msg, counter_msg, stop_msg }, cost }
//        type: offer(제안) | accept(그대로 수락) | reject(거절) | question(되물음) | info(정보만)
//        counter_msg 는 countered=false 이고 type=offer 일 때만 (흥정은 1번만)
//
// · 보내기는 coverfo 가 하지 않는다 — 문장만 만들고, 이용자가 자기 문자·채팅 앱에서 직접 보낸다
//   (다른 사이트 채팅·DM 자동 전송은 그 사이트 약관에 걸릴 수 있어 하지 않음)
// · 안전 규칙: AI 비서임을 밝힘 · 이름/연락처 외 개인정보(카드·계좌·주민번호 등) 금지 · 결제는 이용자 확인 ·
//   거절이면 중단 · 흥정 1번만
// · 크레딧: 한 번 부를 때 0.1 (통역톡과 같은 0.1 묶음 cf_tr_take/cf_tr_add · cf_spend 만 씀 · 실패하면 돌려줌)
// · 문장·답장은 저장하지 않는다

const STEP = 1;   // 0.1 크레딧 (묶음 1칸)
const KINDS = { stay: '숙소 할인 문의', used: '중고 거래 흥정', clothes: '옷 사이즈·재고 문의', other: '일반 문의' };

export async function onRequestPost(context) {
  const env = context.env || {};
  const c = sb(env);
  if (!c) return json({ error: 'Supabase 설정이 없습니다' }, 500);
  let b = {};
  try { b = await context.request.json(); } catch { return json({ error: '잘못된 요청입니다' }, 400); }
  const user = await getUser(c, context.request);
  if (!user) return json({ error: '로그인이 필요합니다', login: true }, 401);
  const uid = user.id;
  const op = String(b.op || '');
  if (op !== 'draft' && op !== 'reply') return json({ error: '잘못된 요청입니다' }, 400);

  const kind = KINDS[b.kind] ? b.kind : 'other';
  const ask = clean(b.ask, 300);
  if (!ask) return json({ error: '무엇을 물어볼지 적어 주세요' }, 400);
  if (sensitive(ask) || sensitive(b.me) || sensitive(b.reply)) return json({ error: '카드·계좌·주민번호 같은 정보는 넣을 수 없어요 (이름·연락처만 가능)' }, 400);

  const paid = await charge(env, uid, STEP, '[AI 흥정] ' + ask.slice(0, 40)).catch(() => ({ ok: false }));
  if (!paid.ok) return json({ error: '크레딧이 부족합니다 (한 번 0.1크레딧)', needCredit: true }, 402);
  try {
    if (op === 'draft') {
      const o = await ai(env, draftSys(), JSON.stringify({
        종류: KINDS[kind], 요청: ask, 받는사람: clean(b.target, 40), 원래가격: num(b.price), 희망가격: num(b.want), 보내는사람이름: clean(b.me, 12)
      }));
      const d = {};
      for (const k of ['polite', 'casual', 'firm']) d[k] = scrub(clean(o[k], 400));
      if (!d.polite) throw new Error('문장을 만들지 못했어요');
      for (const k of ['casual', 'firm']) if (!d[k]) d[k] = d.polite;
      return json({ ok: true, drafts: d, cost: 0.1 });
    }
    const reply = clean(b.reply, 600);
    if (!reply) throw Object.assign(new Error('받은 답장을 붙여 넣어 주세요'), { status: 400 });
    const countered = !!b.countered;
    const o = await ai(env, replySys(countered), JSON.stringify({
      종류: KINDS[kind], 처음요청: ask, 내가보낸말: clean(b.sent, 400), 받은답장: reply, 원래가격: num(b.price), 희망가격: num(b.want), 이미한번더흥정함: countered
    }));
    const type = ['offer', 'accept', 'reject', 'question', 'info'].includes(o.type) ? o.type : 'info';
    const r = {
      type,
      summary: clean(o.summary, 200),
      before: num(o.before) || num(b.price),
      after: num(o.after),
      accept_msg: type === 'reject' ? '' : scrub(clean(o.accept_msg, 300)),
      counter_msg: (!countered && type === 'offer') ? scrub(clean(o.counter_msg, 300)) : '',
      stop_msg: scrub(clean(o.stop_msg, 200)),
    };
    r.saved = r.before && r.after && r.before > r.after ? r.before - r.after : 0;
    return json({ ok: true, r, cost: 0.1 });
  } catch (e) {
    await rpc(c, 'cf_tr_add', { p_user: uid, p_add: STEP }).catch(() => {});
    return json({ error: (e && e.status === 400 ? e.message : '정리하지 못했어요') + ' · 크레딧은 돌려드렸어요' }, e && e.status === 400 ? 400 : 500);
  }
}

function draftSys() {
  return [
    '너는 coverfo 의 AI 문의·흥정 비서 "포도야"다. 이용자가 가게·판매자에게 보낼 첫 메시지를 한국어로 대신 써 준다. 메시지는 이용자가 자기 문자·채팅 앱에서 직접 보낸다.',
    '규칙:',
    '- 첫마디에 반드시 "coverfo AI 비서" 가 대신 쓴 문의임을 밝힌다. (예: "안녕하세요, coverfo AI 비서가 대신 문의드려요.")',
    '- 이용자가 준 사실(인원·날짜·가격·상품)만 쓴다. 없는 조건·약속·핑계를 지어내지 않는다.',
    '- 개인정보는 보내는사람이름이 있으면 그 이름만. 전화번호·주소·카드·계좌는 쓰지 않는다.',
    '- 무례하거나 압박하는 표현, 거짓 경쟁 제안("다른 곳은 더 싸요" 등)은 쓰지 않는다.',
    '- 2~3문장, 문자로 보내기 좋은 길이.',
    '세 가지 말투로 쓴다: polite(정중하게), casual(친근하게, 이모지 1개까지), firm(간결·단호하지만 예의 있게).',
    'JSON 하나로만 답한다: {"polite":"…","casual":"…","firm":"…"}'
  ].join('\n');
}
function replySys(countered) {
  return [
    '너는 coverfo 의 AI 문의·흥정 비서 "포도야"다. 이용자가 보낸 문의에 상대가 답장을 보냈다. 답장을 정리해서 이용자가 결정하기 쉽게 만든다.',
    'type 을 고른다: offer(가격·조건을 새로 제안) | accept(이용자 요청을 그대로 받아 줌) | reject(거절·불가·답하기 싫음) | question(상대가 되물음) | info(정보만 알려 줌, 예: 재고 있음).',
    'summary: 핵심만 한 줄 반말 친근체 (예: "10% 할인 된대! 원래 20만원 → 18만원, 받을까?"). 가격은 답장·처음요청에 나온 숫자만 쓴다. 모르면 숫자를 지어내지 않는다.',
    'before: 원래 가격(원, 숫자만, 모르면 0). after: 제안된 가격(원, 숫자만, 모르면 0).',
    'accept_msg: 이용자가 수락할 때 보낼 짧은 존댓말 (결제는 이용자가 직접 한다는 전제, 카드·계좌 정보는 쓰지 않음). reject 면 빈 문자열.',
    countered
      ? 'counter_msg: 이미 한 번 더 흥정했으므로 빈 문자열 (흥정은 1번만).'
      : 'counter_msg: type 이 offer 일 때만, 정중하게 조금 더 조정 가능한지 한 번 묻는 짧은 존댓말 (무리한 요구·압박 금지). 아니면 빈 문자열.',
    'stop_msg: 정중히 마무리하는 짧은 존댓말 (예: "답변 감사합니다. 이번에는 어려울 것 같아요.").',
    '모든 문장은 coverfo AI 비서가 대신 쓴 메시지임이 이미 밝혀진 대화라는 전제로 쓴다.',
    'JSON 하나로만 답한다: {"type":"…","summary":"…","before":0,"after":0,"accept_msg":"…","counter_msg":"…","stop_msg":"…"}'
  ].join('\n');
}

async function ai(env, sys, user) {
  let out = '';
  if (env.OPENAI_API_KEY) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: env.TRANS_MODEL || 'gpt-4o-mini', temperature: 0.4, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }),
      signal: AbortSignal.timeout(25000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('AI 오류 ' + r.status);
    out = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
  } else {
    const r = await anthropicFetch(env, '/v1/messages', { method: 'POST', body: JSON.stringify({ model: env.HUB_MODEL || 'claude-sonnet-5-5', max_tokens: 900, system: sys, messages: [{ role: 'user', content: user }] }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('AI 오류 ' + r.status);
    out = (j.content || []).filter((x) => x.type === 'text').map((x) => x.text).join('');
  }
  const m = String(out).match(/\{[\s\S]*\}/);
  let o = null; try { o = m ? JSON.parse(m[0]) : null; } catch {}
  if (!o) throw new Error('AI 결과를 읽지 못했어요');
  return o;
}

/* 카드번호(13~19자리)·주민번호·계좌번호처럼 보이는 숫자 덩어리 */
function sensitive(v) {
  const s = String(v || '');
  if (/\d{6}\s*-\s*[1-4]\d{6}/.test(s)) return true;                 // 주민번호
  const runs = s.replace(/[\s-]/g, ' ').match(/(?:\d[ ]?){13,19}/g) || [];   // 카드·계좌
  return runs.some((x) => x.replace(/\D/g, '').length >= 13);
}
/* AI 결과에서도 혹시 모를 긴 숫자 덩어리는 가린다 */
function scrub(s) { return String(s || '').replace(/(?:\d[ -]?){13,19}/g, '[가림]'); }
function clean(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function num(v) { const n = Math.round(Number(String(v == null ? '' : v).replace(/[^\d.]/g, ''))); return n > 0 && n < 1e10 ? n : 0; }

/* ───────────── 크레딧 (trans.js 와 같은 방식 · cf_spend 만 씀 · 0.1 단위는 묶음) ───────────── */
async function charge(env, uid, tenths, label) {
  const c = sb(env);
  let t = await rpc(c, 'cf_tr_take', { p_user: uid, p_need: tenths });
  if (t && t.ok) return { ok: true };
  const lack = tenths - ((t && t.left) || 0);
  const whole = Math.max(1, Math.ceil(lack / 10));
  const s = await spendWhole(env, uid, whole, label);
  if (!s.ok) return { ok: false };
  await rpc(c, 'cf_tr_add', { p_user: uid, p_add: whole * 10 });
  t = await rpc(c, 'cf_tr_take', { p_user: uid, p_need: tenths });
  return { ok: !!(t && t.ok) };
}
async function spendWhole(env, uid, cost, label) {
  const c = sb(env);
  for (const kind of ['relay', 'chat']) {
    try {
      const res = await rpc(c, 'cf_spend', { p_user: uid, p_cost: cost, p_kind: kind, p_prompt: String(label || '').slice(0, 100) });
      if (res && res.ok) {
        if (res.job_id != null) await patch(c, 'cf_jobs?id=eq.' + encodeURIComponent(res.job_id), { status: 'done', updated_at: new Date().toISOString() }).catch(() => {});
        return { ok: true };
      }
      return { ok: false };
    } catch {}
  }
  throw new Error('크레딧 처리 실패');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function sb(env) {
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const svc = env.SUPABASE_SERVICE_ROLE_KEY || '';
  return url && svc ? { url, svc } : null;
}
function hdr(c, extra) { return Object.assign({ apikey: c.svc, Authorization: 'Bearer ' + c.svc, 'Content-Type': 'application/json' }, extra || {}); }
async function patch(c, path, body) {
  const r = await fetch(c.url + '/rest/v1/' + path, { method: 'PATCH', headers: hdr(c, { Prefer: 'return=minimal' }), body: JSON.stringify(body) });
  if (!r.ok) throw new Error('DB 저장 실패 ' + r.status);
}
async function rpc(c, name, args) {
  const r = await fetch(c.url + '/rest/v1/rpc/' + name, { method: 'POST', headers: hdr(c), body: JSON.stringify(args) });
  const t = await r.text();
  if (!r.ok) throw new Error('rpc ' + name + ' ' + r.status);
  try { return JSON.parse(t); } catch { return t; }
}
async function getUser(c, request) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  try {
    const r = await fetch(c.url + '/auth/v1/user', { headers: { apikey: c.svc, Authorization: 'Bearer ' + token } });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u : null;
  } catch { return null; }
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
