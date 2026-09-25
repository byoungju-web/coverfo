/*
 * coverfo 7단계 엔진 — 사용하는 모델 ID (바꾸고 싶으면 이 파일만 수정)
 *
 * 1) Fable 5.1  : claude-fable-5-1
 * 2) Astra 6    : "Astra 6" 라는 이름의 실제 모델 ID는 없어서(검증 불가) Fable 5.1 로 대신 돌립니다
 * 3) Gemini 3 Flash Image : gemini-3.1-flash-image (Google 문서 기준 현행 이미지 모델)
 * 4) gpt image 2 : gpt-image-2 (quality 는 low/medium/high 만 허용, 결과는 항상 b64_json)
 * 5) Veo 3.1    : veo-3.1-generate-preview (predictLongRunning + 상태 폴링)
 * 6) Tripo3D    : image_to_model (키가 없으면 자동 건너뜀)
 * 7) Opus 4.5   : claude-opus-4-5-20251101
 */
export const ENGINE_MODELS = {
  stage1: 'claude-fable-5-1',
  stage2: 'claude-fable-5-1',
  stage3: 'gemini-3.1-flash-image',
  stage4: 'gpt-image-2',
  stage5: 'veo-3.1-generate-preview',
  stage6: 'v2.0-20240919',
  stage7: 'claude-opus-4-5-20251101',
} as const;

export const ENGINE_VERSION = 'v4.3 coverfo.com (Cloudflare)';
