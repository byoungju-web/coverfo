// coverfo 엔진 "최근 만든 것" 서버 저장 — 데스크탑에서 만든 것이 스마트폰에서도 보이게 (표: cf_engine_history, sql/cf_engine_history.sql)
//   GET    /api/engine-history                → { items: [entry, ...] } (최근 20건, 로그인한 사용자 것만)
//   POST   /api/engine-history {entry}        → { ok }  (entry.at 이 같으면 덮어씀)
//   DELETE /api/engine-history {at} | {all:1} → { ok }
// 로그인 안 했거나 Supabase 설정이 없으면 GET 은 빈 목록, POST/DELETE 는 {ok:false} 로 조용히 넘어갑니다 (화면은 브라우저 저장분으로 동작).
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';
import { envOf, getUserId, ok, readJson } from '~/lib/engine/server';

const LIMIT = 20;
const TABLE = 'cf_engine_history';

function sb(env: any) {
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const service = env.SUPABASE_SERVICE_ROLE_KEY || '';

  return url && service ? { url, service } : null;
}

function heads(c: { service: string }, extra?: Record<string, string>) {
  return { apikey: c.service, Authorization: `Bearer ${c.service}`, 'Content-Type': 'application/json', ...(extra || {}) };
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = envOf(context);
  const c = sb(env);
  const user = await getUserId(request, env);

  if (!c || !user) {
    return ok({ items: [], cloud: false });
  }

  const r = await fetch(
    `${c.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(user.id)}&select=at,data&order=at.desc&limit=${LIMIT}`,
    { headers: heads(c) },
  );

  if (!r.ok) {
    return ok({ items: [], cloud: false, error: `supabase ${r.status}: ${(await r.text()).slice(0, 200)}` });
  }

  const rows: any[] = await r.json();
  const items = rows.map((row) => ({ ...(row.data || {}), at: Number(row.at) }));

  return ok({ items, cloud: true });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const env = envOf(context);
  const c = sb(env);
  const user = await getUserId(request, env);
  const body = await readJson<any>(request);

  if (!c || !user) {
    return ok({ ok: false, cloud: false });
  }

  if (request.method === 'DELETE') {
    const q = body.all
      ? `user_id=eq.${encodeURIComponent(user.id)}`
      : `user_id=eq.${encodeURIComponent(user.id)}&at=eq.${encodeURIComponent(String(Number(body.at) || 0))}`;
    const r = await fetch(`${c.url}/rest/v1/${TABLE}?${q}`, { method: 'DELETE', headers: heads(c) });

    return ok({ ok: r.ok });
  }

  const entry = body.entry;

  if (!entry || !entry.at) {
    return ok({ ok: false, error: 'entry.at 이 없습니다' });
  }

  const r = await fetch(`${c.url}/rest/v1/${TABLE}?on_conflict=user_id,at`, {
    method: 'POST',
    headers: heads(c, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({ user_id: user.id, at: Number(entry.at), data: entry }),
  });

  if (!r.ok) {
    return ok({ ok: false, error: `supabase ${r.status}: ${(await r.text()).slice(0, 200)}` });
  }

  // 20건 넘는 오래된 것은 지웁니다 (화면과 같은 한도)
  try {
    const old = await fetch(
      `${c.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(user.id)}&select=at&order=at.desc&offset=${LIMIT}`,
      { headers: heads(c) },
    );
    const rows: any[] = old.ok ? await old.json() : [];

    if (rows.length) {
      const list = rows.map((x) => String(x.at)).join(',');
      await fetch(`${c.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(user.id)}&at=in.(${list})`, {
        method: 'DELETE',
        headers: heads(c),
      });
    }
  } catch {
    // 정리 실패는 무시 (다음 저장 때 다시 시도됨)
  }

  return ok({ ok: true });
}
