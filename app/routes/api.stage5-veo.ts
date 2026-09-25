// 5단계 Veo 3.1 — 4초 영상 생성 시작 (긴 작업이라 operation 이름을 돌려주고, 상태는 stage5-veo-status 로 확인)
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { envOf, fail, googleFetch, ok, readJson, requireLogin } from '~/lib/engine/server';
import { ENGINE_MODELS } from '~/lib/engine/models';

export async function action({ request, context }: ActionFunctionArgs) {
  const env = envOf(context);
  const denied = await requireLogin(request, env);

  if (denied) {
    return denied;
  }

  const { promptForVideo, promptForImage, imageBase64, mimeType } = await readJson<{
    promptForVideo?: string;
    promptForImage?: string;
    imageBase64?: string;
    mimeType?: string;
  }>(request);
  const key = env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!key) {
    return fail('GOOGLE_GENERATIVE_AI_API_KEY 가 없습니다');
  }

  const instance: any = {
    prompt: `Realistic cinematic motion, smooth camera dolly, natural physics, photorealistic. ${promptForVideo || promptForImage || ''}`,
  };

  // 3단계 이미지가 있으면 그 이미지를 움직이는 영상(image-to-video)으로 만듭니다
  if (imageBase64) {
    instance.image = { bytesBase64Encoded: imageBase64, mimeType: mimeType || 'image/png' };
  }

  try {
    const started = Date.now();
    const r = await googleFetch(
      env,
      `/v1beta/models/${ENGINE_MODELS.stage5}:predictLongRunning`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [instance],
          // Veo 3.1 은 4~8초만 받습니다 (5 를 보내면 "out of bound" 오류 — 실측 확인). 가장 싼 4초로 고정.
          parameters: { aspectRatio: '16:9', durationSeconds: 4, personGeneration: 'allow_adult', sampleCount: 1 },
        }),
      },
    );
    const data: any = await r.json();

    if (data.error) {
      return fail(data.error.message || 'Veo 오류', 500, { raw: data });
    }

    return ok({ stage: 'veo-3.1', model: ENGINE_MODELS.stage5, operationName: data.name, ms: Date.now() - started });
  } catch (e: any) {
    return fail(e.message || String(e));
  }
}
