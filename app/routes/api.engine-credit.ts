// coverfo 엔진 크레딧 — 스튜디오(functions/api/gen.js)와 같은 Supabase 함수(cf_spend / cf_refund)를 씁니다
//   GET  /api/engine-credit                → { free, paid, costs }
//   POST /api/engine-credit {op:'spend', kind, prompt} → { ok, job_id, free, paid, cost } | 402 { error:'insufficient', need, free, paid }
//   POST /api/engine-credit {op:'refund', job_id}      → { ok }
//   POST /api/engine-credit {op:'done', job_id}        → { ok }
// 단가(크레딧)는 Cloudflare 변수로 바꿀 수 있습니다: COST_ENGINE_APP(30) COST_ENGINE_3D(25) COST_ENGINE_EDIT(5)
//   COST_ENGINE_EDIT_IMG(8) COST_ENGINE_EDIT_3D(15) COST_ENGINE_EDIT_VIDEO(15) COST_ENGINE_TOAPP(8)
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';
import { envOf, fail, getUserId, ok, readJson } from '~/lib/engine/server';

const KINDS = ['engine_app', 'engine_3d', 'engine_edit', 'engine_edit_img', 'engine_edit_3d', 'engine_edit_video', 'engine_toapp'] as const;
type Kind = (typeof KINDS)[number];

function costs(env: any): Record<Kind, number> {
  const n = (k: string, d: number) => {
    const v = parseInt(env[k] || '', 10);
    return isNaN(v) ? d : v;
  };

  return {
    engine_app: n('COST_ENGINE_APP', 30),
    engine_3d: n('COST_ENGINE_3D', 25),
    engine_edit: n('COST_ENGINE_EDIT', 5),
    engine_edit_img: n('COST_ENGINE_EDIT_IMG', 8),
    engine_edit_3d: n('COST_ENGINE_EDIT_3D', 15),
    engine_edit_video: n('COST_ENGINE_EDIT_VIDEO', 15),
    engine_toapp: n('COST_ENGINE_TOAPP', 8),
  };
}

function sb(env: any) {
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const service = env.SUPABASE_SERVICE_ROLE_KEY || '';

  return url && service ? { url, service } : null;
}

async function rpc(c: { url: string; service: string }, name: string, args: any) {
  const r = await fetch(`${c.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: c.service, Authorization: `Bearer ${c.service}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args || {}),
  });
  const t = await r.text();
  let d: any = null;

  try {
    d = JSON.parse(t);
  } catch {
    d = t;
  }

  if (!r.ok) {
    throw new Error(`supabase rpc ${name} ${r.status}: ${t.slice(0, 300)}`);
  }

  return d;
}

async function credits(c: { url: string; service: string }, userId: string) {
  const r = await fetch(`${c.url}/rest/v1/cf_credits?select=balance,free_balance&user_id=eq.${encodeURIComponent(userId)}`, {
    headers: { apikey: c.service, Authorization: `Bearer ${c.service}` },
  });
  const rows: any[] = r.ok ? await r.json() : [];
  const row = rows && rows[0];

  return { free: row ? Number(row.free_balance || 0) : 0, paid: row ? Number(row.balance || 0) : 0 };
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = envOf(context);
  const c = sb(env);

  if (!c) {
    return ok({ enabled: false, free: 0, paid: 0, costs: costs(env) });
  }

  const user = await getUserId(request, env);

  if (!user) {
    return fail('로그인이 필요합니다', 401);
  }

  return ok({ enabled: true, ...(await credits(c, user.id)), costs: costs(env) });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const env = envOf(context);
  const c = sb(env);
  const body = await readJson<{ op?: string; kind?: string; prompt?: string; job_id?: string }>(request);

  // Supabase 설정이 없으면(개발 환경) 차감 없이 통과
  if (!c) {
    return ok({ ok: true, enabled: false, job_id: null, free: 0, paid: 0, cost: 0 });
  }

  const user = await getUserId(request, env);

  if (!user) {
    return fail('로그인이 필요합니다', 401);
  }

  if (body.op === 'spend') {
    const kind = (KINDS as readonly string[]).includes(body.kind || '') ? (body.kind as Kind) : null;

    if (!kind) {
      return fail('kind 가 잘못되었습니다', 400);
    }

    const cost = costs(env)[kind];
    const prompt = `[엔진·${kind.replace('engine_', '')}] ${String(body.prompt || '').slice(0, 300)}`;
    let spend: any;

    try {
      spend = await rpc(c, 'cf_spend', { p_user: user.id, p_cost: cost, p_kind: kind, p_prompt: prompt });
    } catch (e: any) {
      // cf_jobs.kind 에 허용 목록이 걸려 있는 경우를 대비해 'chat' 종류로 한 번 더 시도합니다
      try {
        spend = await rpc(c, 'cf_spend', { p_user: user.id, p_cost: cost, p_kind: 'chat', p_prompt: prompt });
      } catch (e2: any) {
        return fail('크레딧 처리 실패: ' + String(e2.message || e2).slice(0, 200), 500);
      }
    }

    if (!spend || !spend.ok) {
      return fail('insufficient', 402, { need: cost, free: spend?.free ?? 0, paid: spend?.paid ?? 0, reason: spend?.reason || '' });
    }

    return ok({ ok: true, enabled: true, job_id: spend.job_id, free: spend.free, paid: spend.paid, cost });
  }

  if (body.op === 'refund' && body.job_id) {
    try {
      await rpc(c, 'cf_refund', { p_job: body.job_id });
    } catch (e: any) {
      return fail('환불 실패: ' + String(e.message || e).slice(0, 200), 500);
    }

    return ok({ ok: true });
  }

  if (body.op === 'done' && body.job_id) {
    await fetch(`${c.url}/rest/v1/cf_jobs?id=eq.${encodeURIComponent(body.job_id)}&user_id=eq.${encodeURIComponent(user.id)}`, {
      method: 'PATCH',
      headers: { apikey: c.service, Authorization: `Bearer ${c.service}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done', updated_at: new Date().toISOString() }),
    }).catch(() => undefined);

    return ok({ ok: true });
  }

  return fail('op 가 잘못되었습니다', 400);
}
