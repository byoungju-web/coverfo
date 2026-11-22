// 5단계 영상 — 생성 시작 (v449: Gemini Omni Flash. 긴 작업이라 번호를 돌려주고, 상태는 stage5-veo-status 로 확인)
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { envOf, fail, ok, readJson, requireLogin } from '~/lib/engine/server';
import { ENGINE_MODELS } from '~/lib/engine/models';
import { omniStart } from '~/lib/engine/omni';

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

  if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return fail('GOOGLE_GENERATIVE_AI_API_KEY 가 없습니다');
  }

  const prompt = `Realistic cinematic motion, smooth camera dolly, natural physics, photorealistic. ${promptForVideo || promptForImage || ''}`;

  // 3단계 이미지가 있으면 그 이미지를 움직이는 영상(image-to-video)으로 만듭니다
  const input = imageBase64
    ? [
        { type: 'image', data: imageBase64, mime_type: mimeType || 'image/png' },
        { type: 'text', text: prompt },
      ]
    : prompt;

  try {
    const started = Date.now();
    const operationName = await omniStart(env, {
      model: ENGINE_MODELS.stage5,
      input,
      response_format: { type: 'video', aspect_ratio: '16:9', resolution: '720p' },
    });

    return ok({ stage: 'omni-video', model: ENGINE_MODELS.stage5, operationName, ms: Date.now() - started });
  } catch (e: any) {
    return fail(e.message || String(e));
  }
}
