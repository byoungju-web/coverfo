/*
 * coverfo 지갑 공유 — 포도톡·포도야가 coverfo 크레딧(1크레딧 = 99원)을 빌려 씁니다
 *   누가 부르나: coverfo 사이드바(로그인 토큰) / 포도톡·포도야(연결 코드 CF-XXXX-XXXX 또는 overlay로 넘겨받은 로그인 토큰)
 *   단가표는 여기 PRICES 한 곳에만. 포도톡은 "일의 이름"만 보냅니다 (stt, fast, quality, search, phone …).
 *
 *   GET  /api/wallet?prices=1                       → { won:99, prices:{item: 크레딧}, half:[내 AI 키면 절반인 item] }
 *   GET  /api/wallet?code=CF-XXXX-XXXX              → { ok, paid }   잔액(충전 크레딧, 소수점 1자리)
 *   POST /api/wallet  (Authorization: Bearer 로그인토큰  또는  body.code)
 *     {op:'balance'}                                → { ok, paid, code? }        (로그인이면 내 연결 코드도 같이)
 *     {op:'code'}            로그인만               → { ok, code }               없으면 새로 만듦
 *     {op:'newcode'}         로그인만               → { ok, code }               다시 만듦 (옛 코드는 꺼짐)
 *     {op:'unlink'}          로그인만               → { ok }                     코드 삭제 (연결 끊기)
 *     {op:'spend', item, qty?, ownKey?, ref?, note?} → { ok, id, cost, paid } | 402 { error:'insufficient', need, paid }
 *     {op:'refund', id}                             → { ok, paid }
 *     {op:'give', item, qty?, ref?, note?}          → { ok, paid }   돌려주기(포도톡 서버가 번역 실패 등으로 되돌릴 때 — sql/cf_wallet_give.sql 필요)
 *   무료 크레딧(free_balance)은 여기서 쓰지 않습니다 — coverfo 안 채팅에만 (월 선착순 규칙이 거기 있음).
 *   필요한 것: sql/cf_wallet.sql 1회 실행
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';
import { envOf, getUserId, readJson } from '~/lib/engine/server';

const WON = 99;

/* 일 → 크레딧 (1 = 99원). 바꾸면 세 서비스가 같이 바뀝니다 */
const PRICES: Record<string, number> = {
  stt: 0.1, /* 말하기(받아쓰기) 1줄 */
  room_ai: 0.1, /* 채팅방 AI 답 */
  fast: 0.2, /* 빠른 답 (가벼운 모델) */
  multi: 0.3, /* 다중 동시통역 · 한 마디·언어당 */
  face: 0.3, /* 마주보기 통역 1분 */
  search: 0.4, /* 웹검색 1회 */
  quality: 1, /* 고품질 답 (Fable급) = coverfo 대화와 같은 값 */
  phone: 6, /* 전화통역 1분 */
  chat: 1, /* coverfo 앱 생성 · 대화 */
  image: 2,
  video: 25,
  engine_app: 30,
  engine_asset: 25,
  pt: 0.1, /* 포도톡 자체 단위 1크레딧 (표에 없는 종류를 포도톡 서버가 보낼 때) */
};
const HALF_WITH_OWN_KEY = ['fast', 'quality', 'search']; /* 내 AI 키를 넣으면 절반 */

const ORIGINS: Record<string, string> = {
  'https://podotalk.kr': 'podotalk',
  'https://www.podotalk.kr': 'podotalk',
  'https://podoya.ai.kr': 'podoya',
  'https://www.podoya.ai.kr': 'podoya',
  'https://coverfo.com': 'coverfo',
  'https://www.coverfo.com': 'coverfo',
};

type Env = Record<string, any>;
type SB = { url: string; service: string };

function sb(env: Env): SB | null {
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const service = env.SUPABASE_SERVICE_ROLE_KEY || '';

  return url && service ? { url, service } : null;
}

function hdr(c: SB, extra?: Record<string, string>) {
  return { apikey: c.service, Authorization: `Bearer ${c.service}`, 'Content-Type': 'application/json', ...(extra || {}) };
}

function cors(request: Request) {
  const origin = request.headers.get('origin') || '';
  const h: Record<string, string> = { 'Cache-Control': 'no-store', Vary: 'Origin' };

  if (ORIGINS[origin]) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
    h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    h['Access-Control-Max-Age'] = '86400';
  }

  return h;
}

function reply(request: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(request) } });
}

function sourceOf(request: Request, wanted?: string) {
  const byOrigin = ORIGINS[request.headers.get('origin') || ''] || '';
  const w = String(wanted || '');

  return byOrigin || (/^(podotalk|podoya|coverfo)$/.test(w) ? w : 'coverfo');
}

async function rpc(c: SB, name: string, args: any) {
  const r = await fetch(`${c.url}/rest/v1/rpc/${name}`, { method: 'POST', headers: hdr(c), body: JSON.stringify(args || {}) });
  const t = await r.text();

  if (!r.ok) {
    throw new Error(`supabase rpc ${name} ${r.status}: ${t.slice(0, 200)}`);
  }

  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

async function rows<T = any>(c: SB, path: string): Promise<T[]> {
  const r = await fetch(`${c.url}/rest/v1/${path}`, { headers: hdr(c) });

  if (!r.ok) {
    return [];
  }

  const j: any = await r.json().catch(() => []);

  return Array.isArray(j) ? j : [];
}

async function balanceOf(c: SB, userId: string) {
  const r = await rows(c, `cf_credits?select=balance&user_id=eq.${encodeURIComponent(userId)}`);

  return r[0] ? Math.round(Number(r[0].balance || 0) * 10) / 10 : 0;
}

function isCode(s: string) {
  return /^CF-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(s);
}

function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; /* 0·O·1·I 는 헷갈려서 뺌 */
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);

  let s = '';

  for (let i = 0; i < 8; i++) {
    s += A[b[i] % A.length];
  }

  return `CF-${s.slice(0, 4)}-${s.slice(4)}`;
}

async function codeOf(c: SB, userId: string): Promise<string | null> {
  const r = await rows(c, `cf_wallet_codes?select=code&user_id=eq.${encodeURIComponent(userId)}`);

  return r[0] ? String(r[0].code) : null;
}

async function userOfCode(c: SB, code: string): Promise<string | null> {
  if (!isCode(code)) {
    return null;
  }

  const r = await rows(c, `cf_wallet_codes?select=user_id&code=eq.${encodeURIComponent(code)}`);

  return r[0] ? String(r[0].user_id) : null;
}

async function newCode(c: SB, userId: string) {
  await fetch(`${c.url}/rest/v1/cf_wallet_codes?user_id=eq.${encodeURIComponent(userId)}`, { method: 'DELETE', headers: hdr(c) });

  for (let tries = 0; tries < 5; tries++) {
    const code = makeCode();
    const r = await fetch(`${c.url}/rest/v1/cf_wallet_codes`, {
      method: 'POST',
      headers: hdr(c, { Prefer: 'return=representation' }),
      body: JSON.stringify({ code, user_id: userId }),
    });

    if (r.ok) {
      return code;
    }
  }

  throw new Error('연결 코드를 만들지 못했습니다');
}

function costOf(item: string, qty: number, ownKey: boolean) {
  const unit = PRICES[item];

  if (unit === undefined) {
    return null;
  }

  const half = ownKey && HALF_WITH_OWN_KEY.includes(item) ? 0.5 : 1;

  return Math.round(unit * qty * half * 10) / 10;
}

/* 로그인 토큰이 먼저, 없으면 연결 코드 */
async function whoIs(request: Request, env: Env, c: SB, code: string) {
  const u = await getUserId(request, env);

  if (u) {
    return { id: u.id, viaCode: false };
  }

  const id = code ? await userOfCode(c, code) : null;

  return id ? { id, viaCode: true } : null;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors(request) });
  }

  const env = envOf(context);
  const url = new URL(request.url);

  if (url.searchParams.get('prices')) {
    return reply(request, { ok: true, won: WON, prices: PRICES, half: HALF_WITH_OWN_KEY });
  }

  const c = sb(env);

  if (!c) {
    return reply(request, { error: 'Supabase 설정이 없습니다' }, 500);
  }

  const code = String(url.searchParams.get('code') || '').trim().toUpperCase();
  const who = await whoIs(request, env, c, code);

  if (!who) {
    return reply(request, { error: '연결 코드가 없거나 틀렸습니다', reason: 'unknown_code' }, 401);
  }

  return reply(request, { ok: true, paid: await balanceOf(c, who.id), won: WON });
}

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors(request) });
  }

  if (request.method !== 'POST') {
    return reply(request, { error: 'POST only' }, 405);
  }

  const env = envOf(context);
  const c = sb(env);

  if (!c) {
    return reply(request, { error: 'Supabase 설정이 없습니다' }, 500);
  }

  const body = await readJson<{ op?: string; code?: string; item?: string; qty?: number; ownKey?: boolean; ref?: string; note?: string; id?: number; source?: string }>(request);
  const op = String(body.op || '');
  const code = String(body.code || '').trim().toUpperCase();
  const who = await whoIs(request, env, c, code);

  if (!who) {
    return reply(request, { error: '로그인하거나 연결 코드를 넣어 주세요', reason: 'unknown_code' }, 401);
  }

  try {
    if (op === 'balance') {
      const out: any = { ok: true, paid: await balanceOf(c, who.id), won: WON };

      if (!who.viaCode) {
        out.code = await codeOf(c, who.id);
      }

      return reply(request, out);
    }

    if (op === 'code' || op === 'newcode' || op === 'unlink') {
      if (who.viaCode) {
        return reply(request, { error: '코드 관리는 coverfo 로그인에서만 됩니다' }, 403);
      }

      if (op === 'unlink') {
        await fetch(`${c.url}/rest/v1/cf_wallet_codes?user_id=eq.${encodeURIComponent(who.id)}`, { method: 'DELETE', headers: hdr(c) });
        return reply(request, { ok: true });
      }

      const cur = op === 'code' ? await codeOf(c, who.id) : null;

      return reply(request, { ok: true, code: cur || (await newCode(c, who.id)) });
    }

    if (op === 'spend') {
      const item = String(body.item || '');
      const qty = Math.max(0, Number(body.qty || 1)) || 1;
      const cost = costOf(item, qty, !!body.ownKey);

      if (cost === null) {
        return reply(request, { error: '모르는 item 입니다', items: Object.keys(PRICES) }, 400);
      }

      const source = sourceOf(request, body.source);
      const r = await rpc(c, 'cf_wallet_spend', {
        p_user: who.id,
        p_cost: cost,
        p_item: item,
        p_source: source,
        p_qty: qty,
        p_ref: body.ref ? String(body.ref).slice(0, 120) : null,
        p_note: body.note ? String(body.note).slice(0, 200) : null,
      });

      if (!r || !r.ok) {
        return reply(request, { error: 'insufficient', reason: r?.reason || 'insufficient', need: cost, paid: Number(r?.paid || 0), won: WON }, 402);
      }

      return reply(request, { ok: true, id: r.id, cost, paid: Number(r.paid || 0), won: WON, dup: !!r.dup });
    }

    if (op === 'give') {
      const item = String(body.item || '');
      const qty = Math.max(0, Number(body.qty || 1)) || 1;
      const amount = costOf(item, qty, false);

      if (amount === null) {
        return reply(request, { error: '모르는 item 입니다', items: Object.keys(PRICES) }, 400);
      }

      const r = await rpc(c, 'cf_wallet_give', {
        p_user: who.id,
        p_amount: amount,
        p_item: item,
        p_source: sourceOf(request, body.source),
        p_ref: body.ref ? String(body.ref).slice(0, 120) : null,
        p_note: body.note ? String(body.note).slice(0, 200) : null,
      });

      return reply(request, { ok: !!r?.ok, paid: Number(r?.paid || 0), won: WON, dup: !!r?.dup });
    }

    if (op === 'refund') {
      const id = Number(body.id || 0);

      if (!id) {
        return reply(request, { error: 'id 가 없습니다' }, 400);
      }

      const r = await rpc(c, 'cf_wallet_refund', { p_user: who.id, p_id: id });

      return reply(request, { ok: !!r?.ok, reason: r?.reason || '', paid: Number(r?.paid || 0), won: WON });
    }

    return reply(request, { error: 'op 가 잘못되었습니다 (balance | code | newcode | unlink | spend | refund)' }, 400);
  } catch (e: any) {
    return reply(request, { error: String(e?.message || e).slice(0, 300) }, 500);
  }
}
