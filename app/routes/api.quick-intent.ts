/*
 * coverfo — 홈 빠른 실행의 "AI 보조 판단" (규칙에 안 걸린 문장만 한 번 물어봄)
 *   POST /api/quick-intent  {text, country}  → {kind, query, body, cost, free, paid}
 *     kind : place | navi | music | shop | call | sms | taxi | train | delivery | pay | stay | none
 *     query: 지도·쇼핑·유튜브에 넣을 검색어 (해외면 영어로), body: 문자 본문
 *   · 모델: Claude Fable 5.1 (ENGINE_MODELS.stage1) — 서울 중계(anthropic-relay) 경유
 *   · 크레딧: 호출 1건당 COST_QUICK (기본 1) — 렌즈·엔진과 같은 Supabase 함수 cf_spend / cf_refund.
 *     모델 호출이 실패하면 환불. 크레딧이 모자라면 402 → 브라우저가 채팅으로 보낸다(막지 않음)
 *   · 로그인한 사용자만. 판단만 하고, 실제로 여는 주소는 브라우저(public/cf-quick.js)가 나라별 공식 링크 형식으로 만든다
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';
import { anthropicText, envOf, extractJson, fail, getUserId, ok, readJson } from '~/lib/engine/server';
import { ENGINE_MODELS } from '~/lib/engine/models';

type Env = Record<string, any>;
type SB = { url: string; service: string };

const KINDS = new Set(['place', 'navi', 'music', 'shop', 'call', 'sms', 'taxi', 'train', 'delivery', 'pay', 'stay', 'none']);

function costOf(env: Env) {
  const n = Number(env.COST_QUICK);

  return Number.isFinite(n) && n >= 0 ? n : 1;
}

function sb(env: Env): SB | null {
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const service = env.SUPABASE_SERVICE_ROLE_KEY || '';

  return url && service ? { url, service } : null;
}

async function rpc(c: SB, name: string, args: any) {
  const r = await fetch(`${c.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: c.service, Authorization: `Bearer ${c.service}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args || {}),
  });
  const t = await r.text();

  if (!r.ok) {
    throw new Error(`supabase rpc ${name} ${r.status}: ${t.slice(0, 300)}`);
  }

  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

/** 크레딧 차감 (렌즈와 같은 방식: kind 허용 목록에 걸리면 'chat' 으로 한 번 더) */
async function spend(c: SB, userId: string, cost: number, prompt: string) {
  try {
    return await rpc(c, 'cf_spend', { p_user: userId, p_cost: cost, p_kind: 'quick', p_prompt: prompt });
  } catch {
    return await rpc(c, 'cf_spend', { p_user: userId, p_cost: cost, p_kind: 'chat', p_prompt: prompt });
  }
}

async function refund(c: SB, jobId: string | null | undefined) {
  if (jobId) {
    await rpc(c, 'cf_refund', { p_job: jobId }).catch(() => undefined);
  }
}

function prompt(text: string, country: string) {
  const abroad = country && country !== 'KR';

  return [
    'You classify ONE user request typed into a chat box. Decide whether it should open an app/site directly instead of being answered by chat.',
    'Return ONLY a JSON object: {"kind": K, "query": Q, "body": B}',
    'K is one of:',
    '  place    - find restaurants / cafes / attractions / shops / any kind of place to go (opens a map search)',
    '  navi     - directions / navigation to a destination',
    '  music    - play a song / video / YouTube',
    '  shop     - buy a product, compare prices, find the cheapest (opens a shopping search)',
    '  call     - make a phone call (only if a phone number is in the text)',
    '  sms      - send a text message (only if a phone number is in the text)',
    '  taxi     - hail a taxi / ride',
    '  train    - book a train ticket',
    '  delivery - order food delivery',
    '  pay      - send money / pay someone',
    '  stay     - book a hotel / accommodation',
    '  none     - anything else: questions, explanations, how-to, opinions, coding, writing, images, video, 3D, app building, chit-chat',
    'Rules: when in doubt answer "none". A question ABOUT a place (history, opening hours, "what is") is "none". Requests to make/create/write/explain anything are "none".',
    `Q = the short search term for place/navi/music/shop/stay (destination name, product name, song name). ${abroad ? 'Write Q in English (the user is outside Korea; the local map/shopping service needs English).' : 'Keep Q in the language of the request.'} Q is "" for other kinds.`,
    'B = message text for sms, else "".',
    `User country: ${country || 'KR'}`,
    'Request: ' + JSON.stringify(text),
  ].join('\n');
}

/** GET: 단가 안내 (브라우저가 "AI 판단 · 크레딧 N" 표시에 씀) */
export async function loader({ context }: LoaderFunctionArgs) {
  return ok({ cost: costOf(envOf(context)) });
}

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return fail('POST only', 405);
  }

  const env = envOf(context);
  const user = await getUserId(request, env);

  if (!user) {
    return fail('로그인이 필요합니다', 401);
  }

  const body = await readJson<{ text?: string; country?: string }>(request);
  const text = String(body.text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
  const country = String(body.country || 'KR')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 2);
  const cost = costOf(env);

  if (!text) {
    return ok({ kind: 'none', query: '', body: '', cost: 0 });
  }

  const c = sb(env);

  if (!c) {
    return fail('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없습니다', 500);
  }

  // 크레딧 차감 (모델 호출 전). 모자라면 402 — 브라우저는 채팅으로 보낸다
  const s: any = await spend(c, user.id, cost, `[빠른 실행] AI 판단: ${text.slice(0, 80)}`).catch((e: any) => ({ ok: false, reason: String(e.message || e) }));

  if (!s || !s.ok) {
    return fail('insufficient', 402, { need: cost, free: s?.free ?? 0, paid: s?.paid ?? 0, reason: s?.reason || '' });
  }

  try {
    const r = await anthropicText(env, ENGINE_MODELS.stage1, prompt(text, country), 200);
    const j = extractJson(r.text) || {};
    const kind = KINDS.has(String(j.kind)) ? String(j.kind) : 'none';

    return ok({
      kind,
      query: String(j.query || '').slice(0, 200),
      body: String(j.body || '').slice(0, 300),
      cost,
      free: s.free,
      paid: s.paid,
    });
  } catch (e: any) {
    // 모델 호출 실패 → 환불하고 조용히 "none" (브라우저가 채팅으로 보낸다)
    await refund(c, s.job_id);

    return ok({ kind: 'none', query: '', body: '', cost: 0, refunded: true, error: String(e?.message || e).slice(0, 200) });
  }
}
