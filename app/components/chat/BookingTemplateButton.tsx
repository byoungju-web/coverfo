/*
 * app/components/chat/BookingTemplateButton.tsx
 * 홈 화면 "예약 페이지 만들기" 버튼 - 시설 이름을 받아 예약 페이지 프로젝트를 새 채팅으로 바로 만듦
 * AI를 호출하지 않으므로 API 비용이 들지 않고 무료 횟수도 줄지 않음
 * © bj Lee - coverfo.com - Uncovering the fog
 */
import React, { useState } from 'react';
import type { Message } from 'ai';
import { toast } from 'react-toastify';
import { Button } from '~/components/ui/Button';
import { classNames } from '~/utils/classNames';
import { createBookingChatMessages, getFacilityError } from '~/lib/agents/bookingProject';

interface BookingTemplateButtonProps {
  className?: string;
  importChat?: (description: string, messages: Message[]) => Promise<void>;
}

export const BookingTemplateButton: React.FC<BookingTemplateButtonProps> = ({ className, importChat }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (!importChat || isLoading) {
      return;
    }

    const input = window.prompt('어떤 예약 페이지를 만들까요? (예: 테니스장, 미용실, 스터디룸)', '테니스장');

    // 취소를 누른 경우
    if (input === null) {
      return;
    }

    const facility = input.trim();
    const facilityError = getFacilityError(facility);

    if (facilityError) {
      toast.error(facilityError);
      return;
    }

    setIsLoading(true);

    try {
      const messages = await createBookingChatMessages(facility);
      await importChat(`${facility} 예약 페이지`, messages);
    } catch (error) {
      console.error('Failed to create booking page:', error);
      toast.error('예약 페이지를 만들지 못했어요. 다시 시도해 주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      title="예약 페이지 만들기"
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
      <span className="i-ph:calendar-check w-4 h-4" />
      {isLoading ? '만드는 중...' : '예약 페이지 만들기'}
    </Button>
  );
};
