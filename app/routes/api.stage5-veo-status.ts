// 5단계 영상 — 작업 상태 확인 (?name=interactions/...) 및 완성 영상 파일 전달 (?file=<주소>)
// v449: Gemini Omni Flash. 영상은 구글에 저장된 작업(interaction) 안에 들어 있어서, file 주소로 요청하면 거기서 꺼내 보냅니다
import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
import { envOf, fail, googleFetch, ok, requireLogin } from '~/lib/engine/server';
import { b64ToBytes, omniIdFromUri, omniVideoUri, videoPart } from '~/lib/engine/omni';

const GOOGLE_HOST = 'https://generativelanguage.googleapis.com/';

function videoHeaders(type: string) {
  return {
    'Content-Type': type || 'video/mp4',
    'Cache-Control': 'public, max-age=86400',
    'Access-Control-Allow-Origin': '*',
    // 채팅 미리보기(WebContainer)는 COEP 가 켜져 있어 이 헤더가 없으면 다른 주소의 영상이 차단됩니다
    'Cross-Origin-Resource-Policy': 'cross-origin',
  };
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = envOf(context);

  if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return fail('GOOGLE_GENERATIVE_AI_API_KEY 가 없습니다');
  }

  const url = new URL(request.url);
  const file = url.searchParams.get('file');

  // 영상 파일 전달: 결과 화면(index.html)의 <video src> 가 여기를 가리킵니다 (로그인 검사 없음, Google 주소만 허용)
  if (file) {
    if (!file.startsWith(GOOGLE_HOST)) {
      return fail('허용되지 않은 주소입니다', 400);
    }

    const iid = omniIdFromUri(file);

    if (iid) {
      const r = await googleFetch(env, `/v1beta/interactions/${iid}`, { method: 'GET' });
      const d: any = await r.json().catch(() => ({}));
      const v = r.ok ? videoPart(d) : null;

      if (!v) {
        return fail('영상을 찾을 수 없습니다', r.ok ? 404 : r.status);
      }

      if (v.data) {
        return new Response(b64ToBytes(v.data), { status: 200, headers: videoHeaders(v.mime_type || 'video/mp4') });
      }

      let u = String(v.uri);

      if (!u.startsWith('http')) {
        u = GOOGLE_HOST + 'v1beta/' + u.replace(/^\/+/, '');
      }

      if (!u.includes(':download') && /\/files\/[^/:?]+$/.test(u)) {
        u += ':download';
      }

      if (!u.includes('alt=media')) {
        u += (u.includes('?') ? '&' : '?') + 'alt=media';
      }

      const f = await googleFetch(env, u, { method: 'GET' });

      return new Response(f.body, { status: f.status, headers: videoHeaders(f.headers.get('content-type') || 'video/mp4') });
    }

    // 예전 Veo 결과 주소 (구글 보관 기간이 지나면 열리지 않음)
    const r = await googleFetch(env, file, { method: 'GET' });

    return new Response(r.body, { status: r.status, headers: videoHeaders(r.headers.get('content-type') || 'video/mp4') });
  }

  const denied = await requireLogin(request, env);

  if (denied) {
    return denied;
  }

  const name = url.searchParams.get('name');

  if (!name || !name.startsWith('interactions/')) {
    return fail('name 이 없습니다', 400);
  }

  try {
    const id = name.slice('interactions/'.length);
    const r = await googleFetch(env, `/v1beta/interactions/${encodeURIComponent(id)}`, { method: 'GET' });
    const d: any = await r.json().catch(() => ({}));

    // 429·5xx 는 잠시 후 다시 확인
    if (!r.ok && (r.status === 429 || r.status >= 500)) {
      return ok({ done: false, videoUri: null, error: null });
    }

    if (!r.ok) {
      return ok({ done: true, videoUri: null, error: { code: r.status, message: JSON.stringify(d).slice(0, 300) } });
    }

    const st = String(d.status || '');

    if (st === 'in_progress' || st === 'requires_action' || st === 'queued') {
      return ok({ done: false, videoUri: null, error: null });
    }

    if (st === 'failed' || st === 'cancelled') {
      return ok({ done: true, videoUri: null, error: d.error || { message: '구글 영상 생성 실패 (' + st + ')' } });
    }

    const v = videoPart(d);

    if (!v) {
      return ok({ done: true, videoUri: null, error: { message: '영상이 만들어지지 않았습니다 (구글 안전 필터일 수 있어요)' } });
    }

    // 결과 화면은 이 주소를 ?file= 로 다시 요청해 영상을 받습니다 (영상 데이터는 여기서 보내지 않음)
    return ok({ done: true, videoUri: omniVideoUri(id), error: null });
  } catch (e: any) {
    return fail(e.message || String(e));
  }
}
