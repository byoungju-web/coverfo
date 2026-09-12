/*
 * app/lib/agiRouter.ts
 * coverfo.com Universal AGI Router - 모든 요청을 적절한 에이전트로 라우팅
 * © 2026 bj Lee. All Rights Reserved.
 *
 * 분류 순서 (먼저 걸리는 것이 결과):
 * 1. document  - 계약서·제안서 같은 "만들 문서 종류"가 명확한 단어
 * 2. game      - "게임"·레이싱·슈팅·메타버스
 * 3. booking   - 예약·예매·부킹 같은 단어가 있을 때만 (시설 이름만으로는 예약으로 보지 않음)
 * 4. research  - 신약·논문·분석·경쟁사·주식 등
 * 5. game      - 3D·시뮬 (게임 단어 없이 3D만 있을 때, 리서치 단어가 없을 때)
 * 6. automation - 구직·이메일 분류·견적서·쇼츠·자동화
 * 7. custom    - 그 외 전부
 */
import { getFacilityError } from '~/lib/agents/bookingProject';

export type AgiDomain = 'booking' | 'document' | 'game' | 'research' | 'automation' | 'custom';

export interface RouteResult {
  domain: AgiDomain;

  /** 예약일 때 문장에서 뽑은 시설 이름. 못 뽑으면 없음(undefined) → 사용자에게 물어봐야 함 */
  facility?: string;

  template: string;

  /** 템플릿이 저장소에 실제로 있는지. false 면 아직 만들어지지 않은 템플릿 */
  templateAvailable: boolean;
}

/*
 * 도메인별 템플릿과 존재 여부
 * 새 템플릿 파일을 만들면 여기 available 을 true 로 바꿉니다.
 */
export const DOMAIN_TEMPLATES: Record<AgiDomain, { template: string; available: boolean }> = {
  booking: { template: 'universalBookingAgent', available: true }, // app/lib/agents/universalBookingAgent.ts
  document: { template: 'contractDraft', available: false },
  game: { template: 'universalGameBuilder', available: true }, // app/lib/agents/universalGameBuilder.ts
  research: { template: 'discovery', available: false },
  automation: { template: 'jobHunt', available: false },
  custom: { template: 'universal', available: false },
};

const DOCUMENT_PATTERN = /(계약서|근로계약|임대차|\bnda\b|제안서|사업계획서|이력서|내용증명|소송장)/i;
const GAME_PATTERN = /(게임|레이싱|슈팅|메타버스)/i;
const BOOKING_PATTERN = /(예약|예매|부킹|booking|reservation)/i;
const RESEARCH_PATTERN = /(신약|신소재|논문|리서치|분석|경쟁사|주식|pubchem)/i;
const GAME_3D_PATTERN = /(3d|시뮬)/i;
const AUTOMATION_PATTERN = /(구직|이메일.*분류|견적서|쇼츠|자동화|3분컷)/i;

// 시설 이름을 뽑을 때 버리는 단어
const FILLER_WORDS = new Set([
  '우리',
  '저희',
  '내',
  '제',
  '동네',
  '근처',
  '온라인',
  '모바일',
  '간단한',
  '간단히',
  '작은',
  '새',
  '새로운',
  '좀',
  '만들어줘',
  '만들어',
  '만들기',
  '해줘',
]);

/**
 * 예약 단어 바로 앞에 있는 말을 시설 이름으로 뽑습니다. (최대 2단어)
 * 예: "골프 연습장 예약" → "골프 연습장", "필라테스 예약 페이지" → "필라테스"
 * 예약 단어 앞에 쓸 만한 말이 없거나, 예약 페이지에 쓸 수 없는 이름이면 undefined
 */
export function extractFacility(prompt: string): string | undefined {
  const match = BOOKING_PATTERN.exec(prompt);

  if (!match) {
    return undefined;
  }

  const tokens = prompt
    .slice(0, match.index)
    .split(/[\s,.!?~·:;()"'“”‘’[\]{}]+/)
    .map((token) => token.replace(/(을|를|의|에서|에)$/, ''))
    .filter((token) => token && !FILLER_WORDS.has(token));

  const name = tokens.slice(-2).join(' ');

  if (!name || getFacilityError(name)) {
    return undefined;
  }

  return name;
}

function result(domain: AgiDomain, facility?: string): RouteResult {
  const { template, available } = DOMAIN_TEMPLATES[domain];

  return facility === undefined
    ? { domain, template, templateAvailable: available }
    : { domain, facility, template, templateAvailable: available };
}

export function routePrompt(prompt: string): RouteResult {
  if (DOCUMENT_PATTERN.test(prompt)) {
    return result('document');
  }

  if (GAME_PATTERN.test(prompt)) {
    return result('game');
  }

  if (BOOKING_PATTERN.test(prompt)) {
    return result('booking', extractFacility(prompt));
  }

  if (RESEARCH_PATTERN.test(prompt)) {
    return result('research');
  }

  if (GAME_3D_PATTERN.test(prompt)) {
    return result('game');
  }

  if (AUTOMATION_PATTERN.test(prompt)) {
    return result('automation');
  }

  // 그 외 - 전부 custom으로 처리 (무한 확장)
  return result('custom');
}

/*
 * 이 라우터가 coverfo.com을 Claude와 다르게 만드는 핵심
 * Claude는 모든 걸 채팅으로 답하지만, coverfo는 도메인별로 파일을 생성하고 배포한다
 */
