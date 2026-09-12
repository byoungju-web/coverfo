/*
 * app/components/chat/GameTemplateButton.tsx
 * 홈 화면 "3D 게임 만들기" 버튼 - 게임 이름을 받아 3D 게임 프로젝트를 새 채팅으로 바로 만듦
 * AI를 호출하지 않으므로 API 비용이 들지 않고 무료 횟수도 줄지 않음
 * © bj Lee - coverfo.com - Uncovering the fog
 */
import React, { useState } from 'react';
import type { Message } from 'ai';
import { toast } from 'react-toastify';
import { Button } from '~/components/ui/Button';
import { classNames } from '~/utils/classNames';
import {
  DEFAULT_GAME_TITLE,
  GAME_WORD_PATTERN,
  createGameChatMessages,
  extractGameTitle,
  getGameTitleError,
} from '~/lib/agents/gameProject';

interface GameTemplateButtonProps {
  className?: string;
  importChat?: (description: string, messages: Message[]) => Promise<void>;
}

export const GameTemplateButton: React.FC<GameTemplateButtonProps> = ({ className, importChat }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (!importChat || isLoading) {
      return;
    }

    const input = window.prompt('어떤 게임을 만들까요? (예: 말 달리기, 자동차 경주)', '말 달리기');

    // 취소를 누른 경우
    if (input === null) {
      return;
    }

    const raw = input.trim();

    // 문장으로 입력한 경우(예: "말 달리기 게임 만들어줘") 제목만 뽑아서 사용
    const title = GAME_WORD_PATTERN.test(raw) ? (extractGameTitle(raw) ?? DEFAULT_GAME_TITLE) : raw;
    const titleError = getGameTitleError(title);

    if (titleError) {
      toast.error(titleError);
      return;
    }

    setIsLoading(true);

    try {
      const messages = await createGameChatMessages(title);
      await importChat(`${title} 게임`, messages);
    } catch (error) {
      console.error('Failed to create 3D game:', error);
      toast.error('게임을 만들지 못했어요. 다시 시도해 주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      title="3D 게임 만들기"
      variant="default"
      size="lg"
      className={classNames(
        'gap-2 bg-bolt-elements-background-depth-1',
        'text-bolt-elements-textPrimary',
        'hover:bg-bolt-elements-background-depth-2',
        'border border-bolt-elements-borderColor',
        'h-10 px-4 py-2 min-w-[120px] justify-center',
        'transition-all duration-200 ease-in-out',
        className,
      )}
      disabled={isLoading || !importChat}
    >
      <span className="i-ph:game-controller w-4 h-4" />
      {isLoading ? '만드는 중...' : '3D 게임 만들기'}
    </Button>
  );
};
