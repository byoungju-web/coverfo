// 6단계 Meshy — 작업 상태 확인 (?id=) 및 GLB 파일 전달 (?file=<meshy url>)
import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
import { envOf, fail, ok, requireLogin } from '~/lib/engine/server';

function isMeshyUrl(u: string) {
  try {
    const h = new URL(u).hostname;
    return h === 'meshy.ai' || h.endsWith('.meshy.ai');
  } catch {
    return false;
  }
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = envOf(context);
  const url = new URL(request.url);
  const file = url.searchParams.get('file');

  // GLB 전달: 결과 화면의 GLTFLoader 가 여기를 읽습니다 (로그인 검사 없음, Meshy 주소만 허용)
  // 채팅 미리보기(WebContainer)는 COEP 가 켜져 있어 CORS + CORP 헤더가 둘 다 있어야 읽힙니다
  if (file) {
    if (!isMeshyUrl(file)) {
      return fail('허용되지 않은 주소입니다', 400);
    }

    const r = await fetch(file, { method: 'GET', redirect: 'follow' });

    return new Response(r.body, {
      status: r.status,
      headers: {
        'Content-Type': r.headers.get('content-type') || 'model/gltf-binary',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    });
  }

  const denied = await requireLogin(request, env);

  if (denied) {
    return denied;
  }

  const key = env.MESHY_API_KEY;

  if (!key) {
    return fail('MESHY_API_KEY 가 없습니다');
  }

  const id = url.searchParams.get('id');

  if (!id) {
    return fail('id 가 없습니다', 400);
  }

  try {
    const r = await fetch(`https://api.meshy.ai/openapi/v1/image-to-3d/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const data: any = await r.json().catch(() => ({}));

    if (!r.ok) {
      return fail(`Meshy: ${data.message || ('HTTP ' + r.status)}`, 500, { raw: data });
    }

    return ok({
      status: data.status,
      progress: data.progress ?? 0,
      glbUrl: data.model_urls?.glb || null,
      thumbnailUrl: data.thumbnail_url || null,
      error: data.task_error?.message || null,
    });
  } catch (e: any) {
    return fail(e.message || String(e));
  }
}
