// 5단계 Veo — 작업 상태 확인 (?name=operations/...) 및 완성 영상 파일 전달 (?file=<uri>)
import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
import { envOf, fail, googleFetch, ok, requireLogin } from '~/lib/engine/server';

const GOOGLE_HOST = 'https://generativelanguage.googleapis.com/';

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = envOf(context);
  const key = env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!key) {
    return fail('GOOGLE_GENERATIVE_AI_API_KEY 가 없습니다');
  }

  const url = new URL(request.url);
  const file = url.searchParams.get('file');

  // 영상 파일 전달: 결과 화면(index.html)의 <video src> 가 여기를 가리킵니다 (로그인 검사 없음, Google 주소만 허용)
  if (file) {
    if (!file.startsWith(GOOGLE_HOST)) {
      return fail('허용되지 않은 주소입니다', 400);
    }

    const r = await googleFetch(env, file, { method: 'GET' });

    return new Response(r.body, {
      status: r.status,
      headers: {
        'Content-Type': r.headers.get('content-type') || 'video/mp4',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const denied = await requireLogin(request, env);

  if (denied) {
    return denied;
  }

  const name = url.searchParams.get('name');

  if (!name) {
    return fail('name 이 없습니다', 400);
  }

  try {
    const r = await googleFetch(env, `/v1beta/${name}`, { method: 'GET' });
    const data: any = await r.json();
    const sample = data.response?.generateVideoResponse?.generatedSamples?.[0];
    const videoUri: string | null = sample?.video?.uri || null;

    return ok({ done: !!data.done, videoUri, error: data.error || null, raw: data });
  } catch (e: any) {
    return fail(e.message || String(e));
  }
}
