// functions/api/claim.js — coverfo 🧾 AI 환불·민원 문구 비서 (v492)
// © 2026 coverfo All Rights Reserved
//
// POST /api/claim   (Authorization: Bearer coverfo 로그인키)
//   { op:'draft', kind, facts, want?, target?, amount?, me? }
//      → { ok, drafts:{ polite, firm, fact }, title, check:{ clean, factual, clear }, cost }
//        kind: delivery(배송 지연 환불) | flight(항공권 수수료 항의) | shop(가게 컴플레인) | other
//        drafts 는 말투 3가지 (정중하게 · 단호하게 · 감정 빼고 사실만)
//   { op:'polish', text, kind? } → { ok, text, check, cost }   이용자가 고친 편지를 욕설·협박 없이 다듬기
//
// · 보내기는 coverfo 가 하지 않는다 — 이용자가 메일·문자·고객센터 창에 직접 붙여 넣어 보낸다
// · 안전 규칙: AI 비서임을 밝힘 · 욕설·협박·허위 주장 금지 · 환불 확정·결제는 이용자 확인 · 거절이면 중단 · 개인정보 최소
// · 크레딧: 한 번 부를 때 0.1 (통역톡·흥정 비서와 같은 0.1 묶음 · cf_spend 만 씀 · 실패하면 돌려줌)
// · 문구는 저장하지 않는다

const STEP = 1;   // 0.1 크레딧
const KINDS = { delivery: '배송 지연 환불 요청', flight: '항공권 취소·변경 수수료 항의', shop: '가게 서비스 컴플레인', other: '일반 민원·환불 요청' };
const BAD = /(씨발|시발|ㅅㅂ|병신|ㅂㅅ|개새|좆|존나|미친놈|미친년|꺼져|죽여|죽어|고소할|가만 안|박살)/;

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
  if (op !== 'draft' && op !== 'polish') return json({ error: '잘못된 요청입니다' }, 400);
  const kind = KINDS[b.kind] ? b.kind : 'other';
  const facts = clean(op === 'draft' ? b.facts : b.text, op === 'draft' ? 500 : 1500);
  if (!facts) return json({ error: op === 'draft' ? '무슨 일이 있었는지 적어 주세요' : '다듬을 글이 없어요' }, 400);
  if (sensitive(facts) || sensitive(b.me)) return json({ error: '카드·계좌·주민번호 같은 정보는 넣을 수 없어요 (주문번호·이름 정도만)' }, 400);

  const paid = await charge(env, uid, STEP, '[AI 민원] ' + facts.slice(0, 40)).catch(() => ({ ok: false }));
  if (!paid.ok) return json({ error: '크레딧이 부족합니다 (한 번 0.1크레딧)', needCredit: true }, 402);
  try {
    if (op === 'draft') {
      const o = await ai(env, draftSys(), JSON.stringify({
        종류: KINDS[kind], 있었던일: facts, 원하는것: clean(b.want, 100), 받는곳: clean(b.target, 40), 금액: num(b.amount), 보내는사람이름: clean(b.me, 12)
      }));
      const d = {};
      for (const k of ['polite', 'firm', 'fact']) d[k] = tidy(scrub(clean2(o[k], 1200)));
      if (!d.polite) throw new Error('문구를 만들지 못했어요');
      for (const k of ['firm', 'fact']) if (!d[k]) d[k] = d.polite;
      return json({ ok: true, drafts: d, title: clean(o.title, 60), check: checkOf(o), cost: 0.1 });
    }
    const o = await ai(env, polishSys(), JSON.stringify({ 종류: KINDS[kind], 편지: facts }));
    return json({ ok: true, text: tidy(scrub(clean2(o.text, 1500))), check: checkOf(o), cost: 0.1 });
  } catch (e) {
    await rpc(c, 'cf_tr_add', { p_user: uid, p_add: STEP }).catch(() => {});
    return json({ error: '문구를 만들지 못했어요 · 크레딧은 돌려드렸어요' }, 500);
  }
}

function checkOf(o) {
  const k = o && o.check || {};
  return { clean: k.clean !== false, factual: k.factual !== false, clear: k.clear !== false };
}
/* 혹시 남은 거친 말은 지운다 */
function tidy(s) { return BAD.test(s) ? s.replace(new RegExp(BAD.source, 'g'), '') : s; }
function clean2(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max); }

const RULES = [
  '- 첫 줄에 "coverfo AI 비서가 고객을 대신해 작성한 글"임을 밝힌다. (예: "안녕하세요, coverfo AI 비서입니다. 고객님을 대신해 문의드립니다.")',
  '- 이용자가 준 사실만 쓴다. 날짜·금액·주문번호를 지어내지 않는다. 모르는 건 [주문번호] 처럼 빈칸으로 둔다.',
  '- 욕설·비하·협박(고소·신고·악성 리뷰 위협 포함)·과장·허위 주장은 쓰지 않는다. 화난 말은 사실과 요청으로 바꾼다.',
  '- 원하는 것(환불·교환·수수료 조정 등)을 한 문장으로 분명히 요청하고, 답변 기한은 정중히 부탁하는 정도로만 쓴다.',
  '- 개인정보는 보내는사람이름 정도만. 전화번호·주소·카드·계좌는 쓰지 않는다.',
  '- 증거 사진이 있다면 첨부한다는 문장을 넣을 수 있다(첨부는 이용자가 직접).',
];
function draftSys() {
  return [
    '너는 coverfo 의 AI 환불·민원 문구 비서 "포도야"다. 이용자 대신 고객센터·가게·항공사에 보낼 환불·민원 글을 한국어로 쓴다. 글은 이용자가 직접 보낸다.',
    '규칙:', ...RULES,
    '세 가지 말투: polite(정중하게), firm(단호하지만 예의 있게, 요청을 분명히), fact(감정 빼고 사실만 — 날짜/있었던 일/요청을 짧은 줄로).',
    '각 글은 4~8문장(또는 줄). title 은 메일 제목 한 줄.',
    'check: 네 글이 clean(욕설·협박 없음), factual(사실만), clear(요청 명확)한지 스스로 점검해 true/false.',
    'JSON 하나로만 답한다: {"title":"…","polite":"…","firm":"…","fact":"…","check":{"clean":true,"factual":true,"clear":true}}'
  ].join('\n');
}
function polishSys() {
  return [
    '너는 coverfo 의 AI 환불·민원 문구 비서 "포도야"다. 이용자가 직접 고친 민원 글을 다듬는다.',
    '이용자가 쓴 사실과 요청은 그대로 두고, 욕설·비하·협박·과장만 사실과 정중한 요청으로 바꾼다. 문장을 새로 지어내지 않는다.',
    '규칙:', ...RULES,
    'check: 다듬은 글이 clean(욕설·협박 없음), factual(사실만), clear(요청 명확)한지 점검.',
    'JSON 하나로만 답한다: {"text":"…","check":{"clean":true,"factual":true,"clear":true}}'
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
    const r = await anthropicFetch(env, '/v1/messages', { method: 'POST', body: JSON.stringify({ model: env.HUB_MODEL || 'claude-sonnet-5-5', max_tokens: 1800, system: sys, messages: [{ role: 'user', content: user }] }) });
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
