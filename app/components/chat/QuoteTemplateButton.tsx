/*
 * app/components/chat/QuoteTemplateButton.tsx
 * 홈 화면 "견적서 만들기" 버튼 - 제목을 받아 견적서 프로젝트를 새 채팅으로 바로 만듦
 * AI를 호출하지 않으므로 API 비용이 들지 않고 무료 횟수도 줄지 않음
 * © bj Lee - coverfo.com - Uncovering the fog
 */
import React, { useState } from 'react';
import type { Message } from 'ai';
import { toast } from 'react-toastify';
import { Button } from '~/components/ui/Button';
import { classNames } from '~/utils/classNames';
import {
  DEFAULT_QUOTE_TITLE,
  QUOTE_WORD_PATTERN,
  createQuoteChatMessages,
  extractQuoteTitle,
  getQuoteTitleError,
} from '~/lib/agents/quoteProject';

interface QuoteTemplateButtonProps {
  className?: string;
  importChat?: (description: string, messages: Message[]) => Promise<void>;
}

export const QuoteTemplateButton: React.FC<QuoteTemplateButtonProps> = ({ className, importChat }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (!importChat || isLoading) {
      return;
    }

    const input = window.prompt('어떤 견적서인가요? (예: 인테리어 공사, 디자인 작업)', '');

    // 취소를 누른 경우
    if (input === null) {
      return;
    }

    const raw = input.trim();
    let title = DEFAULT_QUOTE_TITLE;

    if (QUOTE_WORD_PATTERN.test(raw)) {
      title = extractQuoteTitle(raw) ?? DEFAULT_QUOTE_TITLE;
    } else if (raw) {
      title = `${raw} 견적서`;
    }

    const titleError = getQuoteTitleError(title);

    if (titleError) {
      toast.error(titleError);
      return;
    }

    setIsLoading(true);

    try {
      const messages = await createQuoteChatMessages(title);
      await importChat(title, messages);
    } catch (error) {
      console.error('Failed to create quote sheet:', error);
      toast.error('견적서를 만들지 못했어요. 다시 시도해 주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      title="견적서 만들기"
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
      <span className="i-ph:receipt w-4 h-4" />
      {isLoading ? '만드는 중...' : '견적서 만들기'}
    </Button>
  );
};
