// 4단계 gpt image 2 — 질감·조명 보정 이미지 (gpt-image-2 는 항상 b64_json 으로 돌려줌)
//
// gpt-image-2 (quality high) 는 2분 넘게 걸리기도 합니다(실측 125초). 그동안 아무 바이트도 안 보내면
// Cloudflare 가 연결을 끊고 HTML 오류 페이지를 돌려줘 브라우저에 "Unexpected token '<' … is not valid JSON" 이 뜹니다.
// 그래서 결과가 올 때까지 15초마다 공백 한 글자를 먼저 흘려보내 연결을 살려 두고, 마지막에 JSON 을 붙입니다
// (JSON.parse 는 앞의 공백을 무시하므로 브라우저 쪽 코드는 그대로입니다).
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { envOf, fail, readJson, requireLogin } from '~/lib/engine/server';
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

  const started = Date.now();
  const encoder = new TextEncoder();

  const work = (async () => {
    try {
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
        return { error: data.error.message || 'OpenAI 오류' };
      }

      const item = data.data?.[0] || {};

      return {
        stage: 'gpt-image-2',
        model: ENGINE_MODELS.stage4,
        imageBase64: item.b64_json || null,
        revisedPrompt: item.revised_prompt || null,
        ms: Date.now() - started,
      };
    } catch (e: any) {
      return { error: e.message || String(e) };
    }
  })();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let done = false;
      work.then(() => (done = true));

      while (!done) {
        await Promise.race([work, new Promise((res) => setTimeout(res, 15000))]);

        if (!done) {
          controller.enqueue(encoder.encode(' '));
        }
      }

      controller.enqueue(encoder.encode(JSON.stringify(await work)));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
  });
}
