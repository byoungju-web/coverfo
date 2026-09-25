// 2단계 Astra 6 (OpenAI gpt-6-astra) — 에셋·디자인 참고 조사
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { envOf, extractJson, fail, ok, openaiText, readJson, requireLogin } from '~/lib/engine/server';
import { ENGINE_MODELS } from '~/lib/engine/models';

export async function action({ request, context }: ActionFunctionArgs) {
  const env = envOf(context);
  const denied = await requireLogin(request, env);

  if (denied) {
    return denied;
  }

  const { spec } = await readJson<{ spec?: unknown }>(request);

  try {
    const started = Date.now();
    const { text, usage } = await openaiText(
      env,
      ENGINE_MODELS.stage2,
      `You are the Browser Research Agent of coverfo 3D Orchestrator. Spec: ${JSON.stringify(spec || {}).slice(0, 3000)}
Produce asset research. Return ONLY valid JSON:
{"searchQueries":["5 image search queries"],"references":["3 design reference sites"],"colorPalette":["#hex","#hex","#hex"],"layoutHints":"one paragraph"}`,
      2000,
    );
    const research = extractJson(text) || { raw: text };

    return ok({ stage: 'astra-6', model: ENGINE_MODELS.stage2, research, usage, ms: Date.now() - started });
  } catch (e: any) {
    return fail(e.message || String(e));
  }
}
