// 6단계 Meshy — 이미지 → 실제 3D 모델(GLB). 작업을 시작하고 task id 를 돌려줍니다 (상태는 stage6-meshy-status)
// 문서: https://docs.meshy.ai/en/api/image-to-3d
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { envOf, fail, ok, readJson, requireLogin } from '~/lib/engine/server';
import { ENGINE_MODELS } from '~/lib/engine/models';

export async function action({ request, context }: ActionFunctionArgs) {
  const env = envOf(context);
  const denied = await requireLogin(request, env);

  if (denied) {
    return denied;
  }

  const key = env.MESHY_API_KEY;

  if (!key) {
    return ok({ skipped: true, reason: 'MESHY_API_KEY 가 없어 3D 모델 단계를 건너뜁니다 (Cloudflare 환경변수에 추가하면 켜집니다)' });
  }

  const { imageBase64, mimeType, subject } = await readJson<{ imageBase64?: string; mimeType?: string; subject?: string }>(request);

  if (!imageBase64) {
    return ok({ skipped: true, reason: '3D 로 만들 이미지가 없습니다 (3·4단계 실패)' });
  }

  try {
    const started = Date.now();
    const r = await fetch('https://api.meshy.ai/openapi/v1/image-to-3d', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: `data:${mimeType || 'image/png'};base64,${imageBase64}`,
        ai_model: ENGINE_MODELS.stage6,
        should_texture: true,
        enable_pbr: false,
        texture_prompt: subject ? String(subject).slice(0, 300) : undefined,
        target_formats: ['glb'],
        auto_size: true,
        origin_at: 'bottom',
      }),
    });
    const data: any = await r.json().catch(() => ({}));

    if (!r.ok || !data.result) {
      return fail(`Meshy: ${data.message || data.error || ('HTTP ' + r.status)}`, 500, { raw: data });
    }

    return ok({ stage: 'meshy-3d', model: ENGINE_MODELS.stage6, taskId: data.result, ms: Date.now() - started });
  } catch (e: any) {
    return fail(e.message || String(e));
  }
}
