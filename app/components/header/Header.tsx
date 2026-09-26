import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';

export function Header() {
  const chat = useStore(chatStore);

  return (
    <header
      className={classNames('flex items-center gap-1 overflow-hidden px-2 sm:px-4 border-b h-[var(--header-height)]', {
        'border-transparent': !chat.started,
        'border-bolt-elements-borderColor': chat.started,
      })}
    >
      <div className="flex shrink-0 items-center gap-2 z-logo text-bolt-elements-textPrimary">
        {/* 눌러서 내 대화 목록 열기 */}
        <button
          type="button"
          title="내 대화 목록"
          aria-label="내 대화 목록"
          className="i-ph:list-bold text-2xl cursor-pointer hover:opacity-70 transition"
          onClick={() => {
            window.dispatchEvent(new Event('coverfo:toggle-sidebar'));
          }}
        />
        {/* 눌러서 홈화면으로 */}
        <a href="/" title="홈으로" className="text-2xl font-semibold text-accent flex items-center cursor-pointer">
          <img src="/coverfo-logo.svg" alt="coverfo" className="w-[150px] sm:w-[200px] inline-block dark:hidden" />
          <img
            src="/coverfo-logo-dark.svg"
            alt="coverfo"
            className="w-[150px] sm:w-[200px] inline-block hidden dark:block"
          />
        </a>
      </div>
      {chat.started && ( // Display ChatDescription and HeaderActionButtons only when the chat has started.
        <>
          <span className="hidden sm:block flex-1 min-w-0 px-4 truncate text-center text-bolt-elements-textPrimary">
            <ClientOnly>{() => <ChatDescription />}</ClientOnly>
          </span>
          <ClientOnly>
            {() => (
              <div className="">
                <HeaderActionButtons chatStarted={chat.started} />
              </div>
            )}
          </ClientOnly>
        </>
      )}
      {/* coverfo: 상단의 이메일·로그아웃 표시는 뺐습니다 — 왼쪽 사이드바 하단(이메일 줄)에서 로그아웃합니다 */}
    </header>
  );
}
