// 5단계 영상 연장 — 이미 만든 영상 뒤에 약 10초를 이어 붙입니다 (v449: Gemini Omni Flash, previous_interaction_id)
//   POST { videoUri, prompt } → { operationName }   상태 확인은 5단계와 같은 stage5-veo-status 로 합니다
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { envOf, fail, ok, readJson, requireLogin } from '~/lib/engine/server';
import { ENGINE_MODELS } from '~/lib/engine/models';
import { omniIdFromUri, omniStart } from '~/lib/engine/omni';

export async function action({ request, context }: ActionFunctionArgs) {
  const env = envOf(context);
  const denied = await requireLogin(request, env);

  if (denied) {
    return denied;
  }

  const { videoUri, prompt } = await readJson<{ videoUri?: string; prompt?: string }>(request);

  if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return fail('GOOGLE_GENERATIVE_AI_API_KEY 가 없습니다');
  }

  const prev = omniIdFromUri(videoUri || '');

  if (!prev) {
    return fail('연장할 영상 주소가 없거나, 예전 방식(Veo)으로 만든 영상이라 연장할 수 없습니다', 400);
  }

  try {
    const started = Date.now();

    // 구글: previous_interaction_id 를 쓸 때는 video task 를 함께 넣으면 안 됨 (스튜디오에서 확인된 오류)
    const operationName = await omniStart(env, {
      model: ENGINE_MODELS.stage5,
      previous_interaction_id: prev,
      input: `Extend this video: continue the same scene seamlessly from the last frame, same subject, same style, realistic cinematic motion. ${prompt || ''}`,
      response_format: { type: 'video', aspect_ratio: '16:9', resolution: '720p' },
    });

    return ok({ stage: 'omni-video-extend', model: ENGINE_MODELS.stage5, operationName, ms: Date.now() - started });
  } catch (e: any) {
    return fail(e.message || String(e));
  }
}
