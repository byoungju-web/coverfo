import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';

export const meta: MetaFunction = () => {
  return [{ title: 'coverfo' }, { name: 'description', content: '누르면 바로 만들어집니다 · coverfo' }];
};

export const loader = () => json({});

/*
 * 채팅 화면 전용 스타일
 * - 화면이 좌우로 흔들리지 않게 페이지와 채팅 스크롤 영역의 가로 이동을 막습니다
 *   (채팅 스크롤 영역 = 첫 번째 칸만. 입력칸 묶음에는 적용하지 않아야 입력칸이 잘리지 않습니다)
 * - 채팅 스크롤 영역의 오르내리는 스크롤 막대를 숨깁니다 (스크롤 자체는 그대로 됩니다)
 * - 데스크탑에서 결과/코드 화면을 열면 채팅칸은 화면 가운데까지(최소 380px), 나머지는 결과 화면이 씁니다
 * - 스크롤 막대는 배경색과 비슷한 옅은 색으로 보여 눈에 잘 띄지 않게 합니다
 */
const CHAT_PAGE_CSS = `
html, body { overflow-x: hidden; overscroll-behavior-x: none; max-width: 100%; }
.cf-chat-scroll > div:first-child { overflow-x: hidden !important; scrollbar-width: none; }
.cf-chat-scroll > div:first-child::-webkit-scrollbar { display: none; width: 0; height: 0; }
@media (max-width: 1023px) {
  .cf-chat-scroll > div:first-child { touch-action: pan-y pinch-zoom; }
  * { scrollbar-width: none; }
  *::-webkit-scrollbar { display: none; width: 0; height: 0; }
}
@media (min-width: 1024px) {
  html:root:root { --chat-min-width: max(380px, calc(50vw - 340px)); }
  html:root * { scrollbar-width: thin; scrollbar-color: rgba(0, 0, 0, 0.07) transparent !important; }
  html:root *::-webkit-scrollbar { width: 8px; height: 8px; }
  html:root *::-webkit-scrollbar-track { background: transparent !important; }
  html:root *::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.07) !important; border-radius: 8px; }
  html:root[data-theme='dark'] * { scrollbar-color: rgba(255, 255, 255, 0.08) transparent !important; }
  html:root[data-theme='dark'] *::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08) !important; }
}
`;

/**
 * coverfo 채팅 화면 (/chat)
 * 원래 app/routes/_index.tsx 에 있던 내용을 그대로 옮긴 것이다.
 * /chat?prompt=... 형태로 열면 그 내용으로 채팅이 자동 시작된다.
 *
 * Note: Settings functionality should ONLY be accessed through the sidebar menu.
 * Do not add settings button/panel to this landing page as it was intentionally removed
 * to keep the UI clean and consistent with the design system.
 */
export default function Index() {
  return (
    <div
      className="flex flex-col h-full w-full overflow-x-hidden bg-bolt-elements-background-depth-1"
      style={{ height: '100dvh' }}
    >
      <style dangerouslySetInnerHTML={{ __html: CHAT_PAGE_CSS }} />
      <Header />
      <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
    </div>
  );
}
