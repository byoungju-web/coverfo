import type { LoaderFunction } from '@remix-run/cloudflare';
import { getApiKeysFromCookie } from '~/lib/api/cookies';

/*
 * coverfo 보안 수정 (2026-10-10)
 * 예전 코드(bolt.diy 원본)는 사용자가 넣은 키(쿠키)에 더해 서버 환경변수의 실제 AI 키
 * (ANTHROPIC_API_KEY · OPENAI_API_KEY · GOOGLE_GENERATIVE_AI_API_KEY 등)까지 이 주소로 돌려주었습니다.
 * 원본은 내 컴퓨터에서만 쓰는 용도라 그랬지만, coverfo 처럼 인터넷에 공개된 사이트에서는 누구나 서버 키를 볼 수 있게 됩니다.
 * 이제 이 주소는 이 브라우저 사용자가 직접 넣은 키(쿠키)만 돌려주고, 서버 키는 절대 내보내지 않습니다.
 * (설정 화면의 'API 키 내보내기' 는 사용자가 직접 넣은 키만 내보내게 됩니다)
 */
export const loader: LoaderFunction = async ({ request }) => {
  const apiKeys = getApiKeysFromCookie(request.headers.get('Cookie'));

  return Response.json(apiKeys || {}, { headers: { 'Cache-Control': 'no-store' } });
};
