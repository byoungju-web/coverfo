/*
 * coverfo 7단계 엔진 — 사용하는 모델 ID (바꾸고 싶으면 이 파일만 수정)
 *
 * 1) Fable 5.1  : claude-fable-5-1
 * 2) Astra 6    : gpt-6-astra (OpenAI 공식 문서 확인 — Chat Completions 지원, reasoning_effort 는 'low' 이상만)
 * 3) Gemini 3 Flash Image : gemini-3.1-flash-image (Google 문서 기준 현행 이미지 모델)
 * 4) gpt image 2 : gpt-image-2 (quality 는 low/medium/high 만 허용, 결과는 항상 b64_json)
 * 5) Veo 3.1    : veo-3.1-fast-generate-preview — 스튜디오와 같은 fast 모델 (표준보다 원가 약 1/3), predictLongRunning + 상태 폴링
 * 6) Meshy 3D   : meshy-7.1 (Image to 3D → GLB). MESHY_API_KEY 가 없으면 자동 건너뜀. https://docs.meshy.ai/en/api/image-to-3d
 * 7) Opus 4.5   : claude-opus-4-5-20251101
 */
export const ENGINE_MODELS = {
  stage1: 'claude-fable-5-1',
  stage2: 'gpt-6-astra',
  stage3: 'gemini-3.1-flash-image',
  stage4: 'gpt-image-2',
  stage5: 'veo-3.1-fast-generate-preview',
  stage6: 'meshy-7.1',
  stage7: 'claude-opus-4-5-20251101',
} as const;

/*
 * v2 Relay 에서 쓰는 모델 — API 파일(tts.js, stt.js, relay-ai.js, research.js)에서 참조
 * 새 API 키 없이 기존 키(OpenAI · Anthropic · Google)만 씁니다
 */
export const RELAY_MODELS = {
  tts: 'tts-1-hd',              // OpenAI TTS — 음성: alloy / echo / fable / onyx / nova / shimmer
  stt: 'whisper-1',             // OpenAI Whisper — 자동 언어 감지
  ai: 'claude-haiku-5-5',       // 요약·번역·리라이트 — 빠르고 경제적
  research: 'claude-sonnet-5-5', // 리서치 리포트 작성 — 품질 우선
  search: 'gemini-2.5-flash',   // Google 검색 그라운딩 — 실시간 정보 수집
} as const;

export const ENGINE_VERSION = 'v2 Coverfo Relay';
