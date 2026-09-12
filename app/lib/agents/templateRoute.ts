/*
 * app/lib/agents/templateRoute.ts
 * 첫 메시지를 AI에게 보내기 전에 agiRouter 로 분류해서, 템플릿이 있는 요청은 템플릿으로 바로 만듦
 * - 지금 템플릿이 있는 분류: booking(예약 페이지), quote(견적서), game(3D 게임 - 문장에 "게임"이 있고 규칙이 전혀 다른 장르가 아닐 때)
 * - 확인창(confirm/prompt)을 쓰지 않고 바로 만듦
 * - 문장에서 시설 이름을 못 뽑으면 평소처럼 AI에게 보냄
 * - 문장에 "AI로"가 있으면 평소처럼 AI에게 보냄
 * - 템플릿으로 만들면 AI를 호출하지 않으므로 API 비용이 없고 무료 횟수도 줄지 않음
 * © bj Lee - coverfo.com - Uncovering the fog
 */
import type { Message } from 'ai';
import { toast } from 'react-toastify';
import { routePrompt } from '~/lib/agiRouter';
import { createBookingChatMessages } from '~/lib/agents/bookingProject';
import { DEFAULT_QUOTE_TITLE, createQuoteChatMessages, extractQuoteTitle } from '~/lib/agents/quoteProject';
import {
  DEFAULT_GAME_TITLE,
  GAME_UNSUPPORTED_PATTERN,
  GAME_WORD_PATTERN,
  createGameChatMessages,
  extractGameTitle,
} from '~/lib/agents/gameProject';

export type ImportChatFn = (description: string, messages: Message[]) => Promise<void>;

export interface TemplateRouteDeps {
  notifyError: (message: string) => void;
}

const browserDeps: TemplateRouteDeps = {
  notifyError: (message) => toast.error(message),
};

/** 문장에 "AI로"(띄어쓰기 허용)가 있으면 템플릿을 쓰지 않음 */
export const SKIP_TEMPLATE_PATTERN = /ai\s*로/i;

/** 템플릿으로 만든 채팅에 함께 보여줄 안내 */
export const ROUTED_BOOKING_NOTE = [
  '입력하신 문장이 예약 요청으로 분류되어, AI 대신 템플릿으로 바로 만들었어요. (AI 사용 안 함 · 무료 횟수 차감 없음)',
  '이 채팅에서 수정할 내용을 입력하면 평소처럼 AI에게 전달됩니다.',
  '처음부터 AI로 만들고 싶으면 새 채팅에서 문장에 "AI로"를 넣어 주세요. 예: AI로 미용실 예약 페이지 만들어줘',
].join('\n');

/** 게임 템플릿으로 만든 채팅에 함께 보여줄 안내 */
export const ROUTED_GAME_NOTE = [
  '입력하신 문장이 게임 요청으로 분류되어, AI 대신 3D 게임 기본 틀로 바로 만들었어요. (AI 사용 안 함 · 무료 횟수 차감 없음)',
  '이 채팅에서 바꾸고 싶은 규칙을 입력하면 평소처럼 AI에게 전달됩니다.',
  '처음부터 AI로 만들고 싶으면 새 채팅에서 문장에 "AI로"를 넣어 주세요. 예: AI로 말 달리기 게임 만들어줘',
].join('\n');

/** 견적서 템플릿으로 만든 채팅에 함께 보여줄 안내 */
export const ROUTED_QUOTE_NOTE = [
  '입력하신 문장이 견적서 요청으로 분류되어, AI 대신 견적서 기본 틀로 바로 만들었어요. (AI 사용 안 함 · 무료 횟수 차감 없음)',
  '이 채팅에서 바꾸고 싶은 내용을 입력하면 평소처럼 AI에게 전달됩니다.',
  '처음부터 AI로 만들고 싶으면 새 채팅에서 문장에 "AI로"를 넣어 주세요. 예: AI로 견적서 만들어줘',
].join('\n');

/**
 * 결과가 true 면 템플릿 쪽에서 처리했으므로 AI에게 보내지 않습니다.
 * 결과가 false 면 평소처럼 AI에게 보냅니다.
 */
export async function tryTemplateRoute(
  prompt: string,
  importChat: ImportChatFn,
  deps: TemplateRouteDeps = browserDeps,
): Promise<boolean> {
  if (SKIP_TEMPLATE_PATTERN.test(prompt)) {
    return false;
  }

  const route = routePrompt(prompt);

  if (route.domain === 'quote' && route.templateAvailable) {
    const title = extractQuoteTitle(prompt) ?? DEFAULT_QUOTE_TITLE;

    try {
      const messages = await createQuoteChatMessages(title, { userMessage: prompt, note: ROUTED_QUOTE_NOTE });
      await importChat(title, messages);
    } catch (error) {
      console.error('Failed to create quote sheet from prompt:', error);
      deps.notifyError('견적서를 만들지 못했어요. 다시 시도해 주세요.');
    }

    return true;
  }

  if (
    route.domain === 'game' &&
    route.templateAvailable &&
    GAME_WORD_PATTERN.test(prompt) &&
    !GAME_UNSUPPORTED_PATTERN.test(prompt)
  ) {
    const title = extractGameTitle(prompt) ?? DEFAULT_GAME_TITLE;

    try {
      const messages = await createGameChatMessages(title, { userMessage: prompt, note: ROUTED_GAME_NOTE });
      await importChat(`${title} 게임`, messages);
    } catch (error) {
      console.error('Failed to create 3D game from prompt:', error);
      deps.notifyError('게임을 만들지 못했어요. 다시 시도해 주세요.');
    }

    return true;
  }

  if (route.domain !== 'booking' || !route.templateAvailable || !route.facility) {
    return false;
  }

  const facility = route.facility;

  try {
    const messages = await createBookingChatMessages(facility, {}, { userMessage: prompt, note: ROUTED_BOOKING_NOTE });
    await importChat(`${facility} 예약 페이지`, messages);
  } catch (error) {
    console.error('Failed to create booking page from prompt:', error);
    deps.notifyError('예약 페이지를 만들지 못했어요. 다시 시도해 주세요.');
  }

  return true;
}
