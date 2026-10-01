/*
 * coverfo — 계정 탈퇴
 *   POST /api/account-delete   (Authorization: Bearer <로그인 토큰>)  → {ok:true}
 *   · 로그인한 본인만 자기 계정을 지울 수 있다 (토큰으로 본인 확인 → 그 id 만 삭제)
 *   · Supabase Auth 관리자 API 로 사용자를 삭제한다 (SUPABASE_SERVICE_ROLE_KEY 는 서버에서만 쓰임)
 *   · 삭제되면 그 계정으로는 다시 로그인할 수 없고, 남은 크레딧은 복구되지 않는다
 */
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { envOf, fail, getUserId, ok, readJson } from '~/lib/engine/server';

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return fail('POST only', 405);
  }

  const env = envOf(context);
  const user = await getUserId(request, env);

  if (!user) {
    return fail('로그인이 필요합니다', 401);
  }

  const body = await readJson<{ confirm?: string }>(request);

  if (String(body.confirm || '') !== '탈퇴') {
    return fail('확인 문구가 다릅니다', 400);
  }

  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const service = env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!url || !service) {
    return fail('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없습니다', 500);
  }

  const r = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
    method: 'DELETE',
    headers: { apikey: service, Authorization: `Bearer ${service}` },
  });

  if (!r.ok && r.status !== 404) {
    const t = await r.text().catch(() => '');

    return fail(`삭제하지 못했습니다 (${r.status}) ${t.slice(0, 200)}`, 502);
  }

  return ok({ ok: true });
}
