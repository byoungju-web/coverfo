// 1단계 Fable 5.1 — 요청을 상세 JSON 설계(spec)로 확장
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { anthropicText, envOf, extractJson, fail, ok, readJson, requireLogin } from '~/lib/engine/server';
import { ENGINE_MODELS } from '~/lib/engine/models';

export async function action({ request, context }: ActionFunctionArgs) {
  const env = envOf(context);
  const denied = await requireLogin(request, env);

  if (denied) {
    return denied;
  }

  const { prompt } = await readJson<{ prompt?: string }>(request);

  if (!prompt || !prompt.trim()) {
    return fail('prompt 가 비어 있습니다', 400);
  }

  try {
    const started = Date.now();
    const { text, usage } = await anthropicText(
      env,
      ENGINE_MODELS.stage1,
      `You are the Spec Expansion Engine of coverfo 3D Orchestrator. Expand the user's request into a detailed JSON spec.
Request: "${prompt}"
Return ONLY valid JSON, no markdown, with this shape:
{"projectType":"...","title":"short Korean title","pages":[{"name":"","route":"","purpose":""}],"components":[{"name":"","type":""}],"styleGuide":{"colors":[],"fonts":[],"vibe":""},"promptForImage":"photorealistic English description for image generation","promptForVideo":"cinematic English description for a 5 second video","assetList":[]}`,
      4000,
    );
    const spec = extractJson(text) || { raw: text, projectType: 'web-app', title: prompt.slice(0, 40), promptForImage: prompt };

    return ok({ stage: 'fable-5.1', model: ENGINE_MODELS.stage1, spec, usage, ms: Date.now() - started });
  } catch (e: any) {
    return fail(e.message || String(e));
  }
}
