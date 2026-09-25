// 4단계 gpt image 2 — 질감·조명 보정 이미지 (gpt-image-2 는 항상 b64_json 으로 돌려줌)
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { envOf, fail, ok, readJson, requireLogin } from '~/lib/engine/server';
import { ENGINE_MODELS } from '~/lib/engine/models';

export async function action({ request, context }: ActionFunctionArgs) {
  const env = envOf(context);
  const denied = await requireLogin(request, env);

  if (denied) {
    return denied;
  }

  const { styleGuide, promptForImage } = await readJson<{ styleGuide?: unknown; promptForImage?: string }>(request);
  const key = env.OPENAI_API_KEY;

  if (!key) {
    return fail('OPENAI_API_KEY 가 없습니다');
  }

  try {
    const started = Date.now();
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ENGINE_MODELS.stage4,
        prompt: `Ultra realistic, photorealistic, detailed PBR material, studio lighting, style: ${JSON.stringify(styleGuide || {}).slice(0, 500)}, subject: ${promptForImage || ''}, no cartoon, no illustration`,
        n: 1,
        size: '1024x1024',
        quality: 'high',
      }),
    });
    const data: any = await r.json();

    if (data.error) {
      return fail(data.error.message || 'OpenAI 오류');
    }

    const item = data.data?.[0] || {};

    return ok({
      stage: 'gpt-image-2',
      model: ENGINE_MODELS.stage4,
      imageBase64: item.b64_json || null,
      revisedPrompt: item.revised_prompt || null,
      ms: Date.now() - started,
    });
  } catch (e: any) {
    return fail(e.message || String(e));
  }
}
