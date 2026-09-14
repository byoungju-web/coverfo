/*
 * coverfo 홈화면 (/)
 * 기본 export 가 없으므로 Remix 는 이 파일을 "리소스 라우트"로 처리하고
 * loader 가 돌려주는 응답을 그대로 브라우저에 보낸다.
 * 채팅 화면은 /chat 으로 옮겨졌다 (app/routes/chat._index.tsx).
 */
import landingHtml from '~/landing-html';

export const loader = () =>
  new Response(landingHtml, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
