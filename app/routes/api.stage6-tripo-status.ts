// 6단계 Tripo3D — 작업 상태 확인 (?taskId=...)
import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
import { envOf, fail, ok, requireLogin } from '~/lib/engine/server';

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = envOf(context);
  const denied = await requireLogin(request, env);

  if (denied) {
    return denied;
  }

  const key = env.TRIPO_API_KEY || env.TRIPO3D_API_KEY;

  if (!key) {
    return fail('TRIPO_API_KEY 가 없습니다');
  }

  const taskId = new URL(request.url).searchParams.get('taskId');

  if (!taskId) {
    return fail('taskId 가 없습니다', 400);
  }

  try {
    const r = await fetch(`https://api.tripo3d.ai/v2/openapi/task/${taskId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const data: any = await r.json();
    const d = data.data || {};
    const modelUrl: string | null = d.output?.pbr_model || d.output?.model || null;

    return ok({ status: d.status || 'unknown', progress: d.progress ?? null, modelUrl, raw: data });
  } catch (e: any) {
    return fail(e.message || String(e));
  }
}
