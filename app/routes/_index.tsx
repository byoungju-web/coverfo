/*
 * coverfo 홈화면 (/)
 * 기본 export 가 없으므로 Remix 는 이 파일을 "리소스 라우트"로 처리하고
 * loader 가 돌려주는 응답을 그대로 브라우저에 보낸다.
 * 채팅 화면은 /chat 으로 옮겨졌다 (app/routes/chat._index.tsx).
 *
 * 홈화면 HTML 안의 자리표시자에 Supabase 설정값을 넣어준다.
 * 값이 없으면 빈 문자열이 들어가고, 그때는 홈의 로그인 버튼이
 * /chat 으로 보내도록 되어 있어 화면이 깨지지는 않는다.
 */
import landingHtml from '~/landing-html';

const SB_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const loader = () => {
  const html = landingHtml.replace('__CF_SB_URL__', SB_URL).replace('__CF_SB_KEY__', SB_KEY);

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
};
