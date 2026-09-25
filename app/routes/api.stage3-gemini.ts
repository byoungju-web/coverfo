// 3단계 Gemini 3 Flash Image — 사진급 이미지 생성 (base64 로 돌려줌)
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { envOf, fail, ok, readJson, requireLogin } from '~/lib/engine/server';
import { ENGINE_MODELS } from '~/lib/engine/models';

export async function action({ request, context }: ActionFunctionArgs) {
  const env = envOf(context);
  const denied = await requireLogin(request, env);

  if (denied) {
    return denied;
  }

  const { promptForImage } = await readJson<{ promptForImage?: string }>(request);
  const key = env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!key) {
    return fail('GOOGLE_GENERATIVE_AI_API_KEY 가 없습니다');
  }

  try {
    const started = Date.now();
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${ENGINE_MODELS.stage3}:generateContent`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `photorealistic, studio lighting, PBR material, ultra detailed, professional photography, no cartoon, no illustration -- ${promptForImage || ''}`,
                },
              ],
            },
          ],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
      },
    );
    const data: any = await r.json();

    if (data.error) {
      return fail(data.error.message || 'Gemini 오류', 500, { raw: data });
    }

    const part = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);

    if (!part?.inlineData?.data) {
      return fail('이미지가 돌아오지 않았습니다', 500, { raw: JSON.stringify(data).slice(0, 2000) });
    }

    return ok({
      stage: 'gemini-3-flash-image',
      model: ENGINE_MODELS.stage3,
      imageBase64: part.inlineData.data,
      mimeType: part.inlineData.mimeType || 'image/png',
      ms: Date.now() - started,
    });
  } catch (e: any) {
    return fail(e.message || String(e));
  }
}
