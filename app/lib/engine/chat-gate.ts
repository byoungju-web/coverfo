/*
 * coverfo 채팅 요금 문지기 (서버 전용) — 2026-10-10
 *
 * 왜 서버에서?
 *   예전에는 화면(Chat.client.tsx)이 보내기 전에 /api/chat-quota 로 횟수를 세었고, /api/chat 자체는 아무 확인도 하지 않았습니다.
 *   그래서 화면을 거치지 않고 /api/chat 을 직접 부르면 로그인 없이, 한도 없이 coverfo 의 AI 키로 쓸 수 있었습니다.
 *   이제 /api/chat 이 요청마다 여기서 로그인·무료 횟수·크레딧을 직접 확인합니다. (화면은 더 이상 횟수를 세지 않음 → 두 번 세지 않음)
 *
 * 규칙
 *   · 로그인 필수 (Authorization: Bearer <Supabase 로그인 토큰>)
 *   · 글 답변(discuss): 한 달 15회 무료 (Supabase 함수 cf_chat_quota — sql/cf_chat_usage.sql, 하루 제한 없음)
 *                       16번째부터(또는 그 달 선착순 무료 인원이 다 찼으면) 1회마다 크레딧 COST_CHAT(기본 1) 차감
 *   · 앱 생성(build)  : 매번 크레딧 COST_CHAT_BUILD(기본 8) 차감 (예전 화면 규칙과 같은 값·같은 변수)
 *   · 크레딧이 부족하면 402 로 막습니다. 답을 만들다 실패하면 크레딧(cf_refund)과 무료 횟수(cf_chat_quota_undo)를 돌려줍니다.
 *   · Supabase 설정이 아예 없는 개발 환경에서만 검사 없이 통과합니다.
 */
import { getUserId, supabaseAuthConfig } from '~/lib/engine/server';

type Env = Record<string, any>;
type SB = { url: string; service: string };

export type ChatCharge = {
  userId: string;
  mode: 'discuss' | 'build';
  free: boolean; // 무료 횟수로 처리됨
  freeLeft: number | null; // 이번 달 남은 무료 횟수 (알 때만)
  cost: number; // 이번에 차감한 크레딧 (무료면 0)
  jobId: string | null;
  balance: { free: number; paid: number } | null;
};

function sb(env: Env): SB | null {
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const service = String(env.SUPABASE_SERVICE_ROLE_KEY || '');

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
    throw new Error(`supabase rpc ${name} ${r.status}: ${t.slice(0, 200)}`);
  }

  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

function num(env: Env, k: string, d: number) {
  const v = parseInt(String(env[k] ?? ''), 10);
  return Number.isFinite(v) && v >= 0 ? v : d;
}

/* 화면(Chat.client handleError)이 읽는 모양: { error, code, message, statusCode, isRetryable } */
function deny(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ error: true, code, message, statusCode: status, isRetryable: false, ...(extra || {}) }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/* 크레딧 차감 — 엔진·렌즈와 같은 방식: kind 허용 목록에 걸리면 'chat' 으로 한 번 더 */
async function spend(c: SB, userId: string, cost: number, kind: string, prompt: string) {
  try {
    return await rpc(c, 'cf_spend', { p_user: userId, p_cost: cost, p_kind: kind, p_prompt: prompt });
  } catch {
    return await rpc(c, 'cf_spend', { p_user: userId, p_cost: cost, p_kind: 'chat', p_prompt: prompt });
  }
}

/** 통과하면 { charge }, 막으면 { deny: Response } */
export async function chatGate(
  request: Request,
  env: Env,
  mode: 'discuss' | 'build',
): Promise<{ charge: ChatCharge | null; deny?: Response }> {
  const c = sb(env);

  // Supabase 가 아예 설정되지 않은 개발 환경만 통과 (운영 coverfo 에는 둘 다 있음)
  if (!c && !supabaseAuthConfig(env)) {
    return { charge: null };
  }

  if (!c) {
    return { charge: null, deny: deny(503, 'off', '지금은 채팅을 쓸 수 없어요. 잠시 뒤 다시 해 주세요.') };
  }

  const user = await getUserId(request, env).catch(() => null);

  if (!user) {
    return { charge: null, deny: deny(401, 'login', '로그인이 필요합니다. 홈에서 로그인한 뒤 다시 보내 주세요.') };
  }

  // ── 글 답변: 무료 횟수 먼저 ──
  if (mode === 'discuss') {
    let q: any = null;

    try {
      q = await rpc(c, 'cf_chat_quota', { p_user: user.id, p_mode: 'discuss' });
    } catch {
      // 무료 횟수 함수가 일시 오류면(사이트 잠김 방지) 크레딧 대신 무료로 통과 — 예전 /api/chat-quota 와 같은 원칙
      return { charge: { userId: user.id, mode, free: true, freeLeft: null, cost: 0, jobId: null, balance: null } };
    }

    if (q && q.ok) {
      const left = Number.isFinite(Number(q.remaining_month)) ? Number(q.remaining_month) : null;
      return { charge: { userId: user.id, mode, free: true, freeLeft: left, cost: 0, jobId: null, balance: null } };
    }
  }

  // ── 크레딧 차감 (무료 소진한 글 답변 / 앱 생성) ──
  const cost = mode === 'build' ? num(env, 'COST_CHAT_BUILD', 8) : num(env, 'COST_CHAT', 1);
  const kind = mode === 'build' ? 'chat_build' : 'chat';
  const s: any = await spend(c, user.id, cost, kind, mode === 'build' ? '[chat] 앱 생성' : '[chat] 글 답변').catch(() => null);

  if (!s) {
    return { charge: null, deny: deny(500, 'credit_error', '크레딧 확인에 실패했어요. 잠시 뒤 다시 해 주세요.') };
  }

  if (!s.ok) {
    const msg =
      mode === 'build'
        ? `크레딧이 부족해요. 앱 생성은 1회 ${cost}크레딧이에요. 충전 후 이용해 주세요. (coverfo.com/pricing)`
        : `이번 달 무료 대화(한 달 15회)를 다 써서 지금부터는 1회 ${cost}크레딧인데, 크레딧이 부족해요. 충전 후 이용해 주세요. (coverfo.com/pricing)`;

    return { charge: null, deny: deny(402, 'insufficient', msg, { need: cost, free: s.free ?? 0, paid: s.paid ?? 0 }) };
  }

  return {
    charge: {
      userId: user.id,
      mode,
      free: false,
      freeLeft: mode === 'discuss' ? 0 : null,
      cost,
      jobId: s.job_id ?? null,
      balance: { free: Number(s.free || 0), paid: Number(s.paid || 0) },
    },
  };
}

/** 답을 만들지 못했을 때 되돌리기 (크레딧 환불 / 무료 횟수 1 되돌림). 여러 번 불려도 한 번만 실행 */
export function chatGateUndoer(env: Env, charge: ChatCharge | null) {
  let done = false;

  return async () => {
    if (done || !charge) {
      return;
    }

    done = true;

    const c = sb(env);

    if (!c) {
      return;
    }

    try {
      if (charge.jobId) {
        await rpc(c, 'cf_refund', { p_job: charge.jobId });
      } else if (charge.free && charge.mode === 'discuss') {
        await rpc(c, 'cf_chat_quota_undo', { p_user: charge.userId });
      }
    } catch {
      // 되돌리기 실패는 답 흐름을 막지 않음
    }
  };
}

/** 답이 끝까지 만들어졌을 때 (작업 기록을 '완료'로) */
export async function chatGateDone(env: Env, charge: ChatCharge | null) {
  const c = sb(env);

  if (!c || !charge || !charge.jobId) {
    return;
  }

  await fetch(`${c.url}/rest/v1/cf_jobs?id=eq.${encodeURIComponent(String(charge.jobId))}`, {
    method: 'PATCH',
    headers: { apikey: c.service, Authorization: `Bearer ${c.service}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'done', updated_at: new Date().toISOString() }),
  }).catch(() => undefined);
}

/** 글 답변(discuss)은 서버가 정한 저가 모델로만 (화면 규칙과 같음 — 직접 호출로 비싼 모델을 쓰지 못하게)
 *  Cloudflare 변수 CHAT_DISCUSS_MODEL / CHAT_DISCUSS_PROVIDER 로 바꿀 수 있음 (기본 gpt-6-luna / OpenAI) */
export function forceDiscussModel(messages: any[], env: Env) {
  const model = String(env.CHAT_DISCUSS_MODEL || 'gpt-6-luna');
  const provider = String(env.CHAT_DISCUSS_PROVIDER || 'OpenAI');
  const prefix = `[Model: ${model}]\n\n[Provider: ${provider}]\n\n`;
  const strip = (s: string) =>
    String(s || '')
      .replace(/^\s*\[Model: .*?\]\n\n/, '')
      .replace(/^\s*\[Provider: .*?\]\n\n/, '');

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];

    if (!m || m.role !== 'user') {
      continue;
    }

    if (typeof m.content === 'string') {
      m.content = prefix + strip(m.content);
    } else if (Array.isArray(m.content)) {
      const t = m.content.find((x: any) => x && x.type === 'text');

      if (t) {
        t.text = prefix + strip(t.text);
      }
    }

    if (Array.isArray(m.parts)) {
      const p = m.parts.find((x: any) => x && x.type === 'text');

      if (p) {
        p.text = prefix + strip(p.text);
      }
    }

    break;
  }
}
