-- coverfo Lens (FogLens 문서 · WorkLens 일 · ShopLens 상품) 결과 캐시 표
-- Supabase → SQL Editor 에 붙여넣고 Run (한 번만)
--
-- 이전 설계의 fog_explanations / work_portfolios / shop_verifications 세 표를 이 표 하나로 합쳤습니다.
--   · mode 열이 'document' | 'work' | 'shop' 을 구분합니다 (표 세 개 대신 열 하나)
--   · image_hash 는 사진 파일 자체의 SHA-256 (브라우저에서 계산) — 같은 사진이면 누가 올려도 같은 값
--   · (image_hash, mode, language) 가 같으면 캐시 적중 → 크레딧 0, view_count 만 올라감
--   · 영상(video_*)·스튜디오 사진(photo_url)은 한 번 만들면 같은 사진을 올린 모든 사람이 재사용

create table if not exists public.cf_lens (
  id uuid primary key default gen_random_uuid(),
  image_hash text not null,
  mode text not null check (mode in ('document','work','shop')),
  language text not null default 'ko',
  type text,
  result jsonb not null,             -- 화면에 보여 주는 결과 전체 (simpleExplanation, steps, ... )
  reader text,                       -- 사진을 읽은 모델 (gemini-3.1-flash-image 또는 Claude 대체)
  user_id uuid,                      -- 처음 분석한 사람
  view_count int not null default 1,
  -- 설명 영상 (Veo)
  video_status text not null default 'none',   -- none | running | finalizing | done | failed
  video_op text,                     -- 구글 operation 이름
  video_job uuid,                    -- cf_jobs.id (실패 시 환불용)
  video_user uuid,                   -- 영상 크레딧을 낸 사람
  video_url text,                    -- /media/lens/<hash>-<mode>-<lang>.mp4
  video_error text,
  -- 스튜디오 사진 (gpt image 2, 일·상품 모드)
  photo_url text,                    -- /media/lens/<hash>-<mode>.png
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (image_hash, mode, language)
);

create index if not exists cf_lens_user_created on public.cf_lens (user_id, created_at desc);

-- 서비스 키(서버 /api/lens)만 읽고 씁니다. 브라우저에서는 직접 못 읽게 RLS 켬 (정책 없음 = 서비스 키만 통과)
alter table public.cf_lens enable row level security;
