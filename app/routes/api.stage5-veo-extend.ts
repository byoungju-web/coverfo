// 5단계 영상 7초 연장 — 이미 만든 영상(Google 주소) 뒤에 7초를 이어 붙입니다 (Veo 3.1 영상 연장, 720p 만 가능)
//   POST { videoUri, prompt } → { operationName }   상태 확인은 5단계와 같은 stage5-veo-status 로 합니다
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { envOf, fail, googleFetch, ok, readJson, requireLogin } from '~/lib/engine/server';
import { ENGINE_MODELS } from '~/lib/engine/models';

const GOOGLE_HOST = 'https://generativelanguage.googleapis.com/';

function toBase64(bytes: Uint8Array) {
  let bin = '';
  const chunk = 0x8000;

  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }

  return btoa(bin);
}

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

  if (!videoUri || !videoUri.startsWith(GOOGLE_HOST)) {
    return fail('연장할 영상 주소가 없거나 허용되지 않은 주소입니다', 400);
  }

  try {
    const started = Date.now();

    // 1) 원본 영상을 받아 base64 로 (연장 요청은 영상 파일을 본문에 넣어 보냅니다)
    const v = await googleFetch(env, videoUri, { method: 'GET' });

    if (!v.ok) {
      return fail(`원본 영상을 읽지 못했습니다 (${v.status})`);
    }

    const bytes = new Uint8Array(await v.arrayBuffer());

    // 2) 연장 시작
    const r = await googleFetch(env, `/v1beta/models/${ENGINE_MODELS.stage5}:predictLongRunning`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [
          {
            prompt: `Continue the same scene seamlessly, same subject, same style, realistic cinematic motion. ${prompt || ''}`,
            video: { inlineData: { mimeType: 'video/mp4', data: toBase64(bytes) } },
          },
        ],
        // 연장은 720p 만 됩니다 (구글 문서). 길이는 항상 +7초.
        parameters: { resolution: '720p', sampleCount: 1 },
      }),
    });
    const data: any = await r.json();

    if (data.error || !data.name) {
      return fail(data.error?.message || 'Veo 연장 오류', 500, { raw: data });
    }

    return ok({ stage: 'veo-3.1-extend', model: ENGINE_MODELS.stage5, operationName: data.name, ms: Date.now() - started });
  } catch (e: any) {
    return fail(e.message || String(e));
  }
}
