// 6단계 Veo 3.1 (3D) — 4단계 이미지를 360° 회전(턴테이블) 3D 영상으로. 상태 확인은 stage5-veo-status 와 같은 방식
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { envOf, fail, googleFetch, ok, readJson, requireLogin } from '~/lib/engine/server';
import { ENGINE_MODELS } from '~/lib/engine/models';

export async function action({ request, context }: ActionFunctionArgs) {
  const env = envOf(context);
  const denied = await requireLogin(request, env);

  if (denied) {
    return denied;
  }

  const { subject, imageBase64, mimeType } = await readJson<{ subject?: string; imageBase64?: string; mimeType?: string }>(request);
  const key = env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!key) {
    return fail('GOOGLE_GENERATIVE_AI_API_KEY 가 없습니다');
  }

  const instance: any = {
    prompt: `3D product turntable: the main subject stays perfectly centered while the camera orbits a full 360 degrees around it, smooth constant speed, seamless loop, studio lighting, clean background, photorealistic 3D render look, no text. Subject: ${subject || 'the object in the image'}`,
  };

  if (imageBase64) {
    instance.image = { bytesBase64Encoded: imageBase64, mimeType: mimeType || 'image/png' };
  }

  try {
    const started = Date.now();
    const r = await googleFetch(env, `/v1beta/models/${ENGINE_MODELS.stage6}:predictLongRunning`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [instance],
        parameters: { aspectRatio: '16:9', durationSeconds: 4, personGeneration: 'allow_adult', sampleCount: 1 },
      }),
    });
    const data: any = await r.json();

    if (data.error) {
      return fail(data.error.message || 'Veo 오류', 500, { raw: data });
    }

    return ok({ stage: 'veo-3.1-3d', model: ENGINE_MODELS.stage6, operationName: data.name, ms: Date.now() - started });
  } catch (e: any) {
    return fail(e.message || String(e));
  }
}
