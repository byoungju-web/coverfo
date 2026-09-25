// 6단계 Tripo3D — 이미지 → 3D 모델 (3D 요청일 때만, 키가 없으면 건너뜀)
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { envOf, fail, ok, readJson, requireLogin } from '~/lib/engine/server';
import { ENGINE_MODELS } from '~/lib/engine/models';

export async function action({ request, context }: ActionFunctionArgs) {
  const env = envOf(context);
  const denied = await requireLogin(request, env);

  if (denied) {
    return denied;
  }

  const { imageBase64, is3D } = await readJson<{ imageBase64?: string; is3D?: boolean }>(request);

  if (!is3D) {
    return ok({ stage: 'tripo3d', skipped: true, reason: '3D 요청이 아니라서 건너뜀' });
  }

  const key = env.TRIPO_API_KEY || env.TRIPO3D_API_KEY;

  if (!key) {
    return ok({ stage: 'tripo3d', skipped: true, reason: 'TRIPO_API_KEY 가 없어서 건너뜀' });
  }

  if (!imageBase64) {
    return ok({ stage: 'tripo3d', skipped: true, reason: '앞 단계 이미지가 없어서 건너뜀' });
  }

  try {
    const started = Date.now();
    const r = await fetch('https://api.tripo3d.ai/v2/openapi/task', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'image_to_model',
        file: { type: 'base64', data: imageBase64, name: 'input.png' },
        file_type: 'png',
        pbr: true,
        model_version: ENGINE_MODELS.stage6,
      }),
    });
    const data: any = await r.json();

    if (!data.data?.task_id) {
      return fail('Tripo 작업이 만들어지지 않았습니다', 500, { raw: data });
    }

    return ok({ stage: 'tripo3d', taskId: data.data.task_id, status: data.data.status || 'queued', ms: Date.now() - started });
  } catch (e: any) {
    return fail(e.message || String(e));
  }
}
