/*
 * app/lib/agents/templateRoute.ts
 * 첫 메시지를 AI에게 보내기 전에 agiRouter 로 분류해서, 템플릿이 있는 요청은 템플릿으로 바로 만듦
 * - 지금 템플릿이 있는 분류: booking(예약 페이지)
 * - 사용자에게 먼저 물어보고(확인/취소), 취소하면 평소처럼 AI에게 보냄 → 잘못 분류돼도 원래대로 쓸 수 있음
 * - 템플릿으로 만들면 AI를 호출하지 않으므로 API 비용이 없고 무료 횟수도 줄지 않음
 * © bj Lee - coverfo.com - Uncovering the fog
 */
import type { Message } from 'ai';
import { toast } from 'react-toastify';
import { routePrompt } from '~/lib/agiRouter';
import { createBookingChatMessages, getFacilityError } from '~/lib/agents/bookingProject';

export type ImportChatFn = (description: string, messages: Message[]) => Promise<void>;

export interface TemplateRouteDeps {
  confirm: (message: string) => boolean;
  prompt: (message: string, defaultValue?: string) => string | null;
  notifyError: (message: string) => void;
}

const browserDeps: TemplateRouteDeps = {
  confirm: (message) => window.confirm(message),
  prompt: (message, defaultValue) => window.prompt(message, defaultValue),
  notifyError: (message) => toast.error(message),
};

export const BOOKING_CONFIRM_TAIL =
  '\n\n확인: 바로 만들기 (AI 사용 안 함 · 무료 횟수 차감 없음)\n취소: 평소처럼 AI에게 요청';

/**
 * 결과가 true 면 템플릿 쪽에서 처리했으므로 AI에게 보내지 않습니다.
 * 결과가 false 면 평소처럼 AI에게 보냅니다.
 */
export async function tryTemplateRoute(
  prompt: string,
  importChat: ImportChatFn,
  deps: TemplateRouteDeps = browserDeps,
): Promise<boolean> {
  const route = routePrompt(prompt);

  if (route.domain !== 'booking' || !route.templateAvailable) {
    return false;
  }

  const target = route.facility ? `"${route.facility}" 예약 페이지를` : '예약 페이지를';

  if (!deps.confirm(`${target} 템플릿으로 바로 만들까요?${BOOKING_CONFIRM_TAIL}`)) {
    return false;
  }

  let facility = route.facility;

  if (!facility) {
    const input = deps.prompt('어떤 시설의 예약 페이지인가요? (예: 테니스장, 미용실, 스터디룸)', '');

    // 이름 입력에서 취소 → 아무것도 하지 않음 (입력한 글은 입력칸에 그대로 남음)
    if (input === null) {
      return true;
    }

    const facilityError = getFacilityError(input);

    if (facilityError) {
      deps.notifyError(facilityError);
      return true;
    }

    facility = input.trim();
  }

  try {
    const messages = await createBookingChatMessages(facility);
    await importChat(`${facility} 예약 페이지`, messages);
  } catch (error) {
    console.error('Failed to create booking page from prompt:', error);
    deps.notifyError('예약 페이지를 만들지 못했어요. 다시 시도해 주세요.');
  }

  return true;
}
