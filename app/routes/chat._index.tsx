import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';

export const meta: MetaFunction = () => {
  return [{ title: 'coverfo' }, { name: 'description', content: '누르면 바로 만들어집니다 · coverfo' }];
};

export const loader = () => json({});

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
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
      <Header />
      <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
    </div>
  );
}
