// coverfo 7단계 엔진 — 환경변수·로그인 설정 확인 (값은 안 보여 주고 있는지/없는지만)
import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
import { envOf, ok, supabaseAuthConfig } from '~/lib/engine/server';
import { ENGINE_MODELS, ENGINE_VERSION } from '~/lib/engine/models';

export async function loader({ context }: LoaderFunctionArgs) {
  const env = envOf(context);

  return ok({
    ANTHROPIC_API_KEY: !!env.ANTHROPIC_API_KEY,
    GOOGLE_GENERATIVE_AI_API_KEY: !!env.GOOGLE_GENERATIVE_AI_API_KEY,
    OPENAI_API_KEY: !!env.OPENAI_API_KEY,
    TRIPO_API_KEY: !!(env.TRIPO_API_KEY || env.TRIPO3D_API_KEY),
    auth: supabaseAuthConfig(env) ? 'login-required' : 'off',
    models: ENGINE_MODELS,
    version: ENGINE_VERSION,
  });
}
