/*
 * coverfo — 채팅 🌐 상자의 "검색어" 검색 (A 방식)
 *   POST /api/brave-search  {q, count?}  → {success, query, results:[{title,url,description,age}], text}
 *   로그인한 사용자만 (내 Brave 할당량을 남이 못 쓰게) — 엔진·렌즈와 같은 getUserId 로 확인
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';
import { envOf, fail, getUserId, ok, readJson } from '~/lib/engine/server';
import { braveSearch, formatBraveResults } from '~/lib/.server/brave';

export async function loader({ context }: LoaderFunctionArgs) {
  const env = envOf(context);

  return ok({ enabled: !!env.BRAVE_API_KEY });
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

  const body = await readJson<{ q?: string; count?: number }>(request);
  const q = String(body.q || '').trim();

  if (!q) {
    return fail('검색어가 없습니다', 400);
  }

  try {
    const results = await braveSearch(env, q, Math.min(Math.max(Number(body.count) || 8, 1), 20));

    return ok({ success: true, query: q, results, text: formatBraveResults(q, results) });
  } catch (e: any) {
    return fail(String(e.message || e).slice(0, 300), 502);
  }
}
