-- coverfo ☀️ 아침 브리핑 (v283)
-- Supabase → SQL Editor → New query 에 통째로 붙여 넣고 Run (1번만).
-- 서버(functions/api/hub.js)만 service_role 키로 읽고 씁니다 (RLS 켬 · 정책 없음).

-- ① 설정 (한 사람에 한 줄)
create table if not exists public.hub_briefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  on1 boolean not null default false,          -- 매일 자동으로 만들기
  hh integer not null default 7,               -- 알림 시각 (한국시간)
  mm integer not null default 0,
  days text not null default '0,1,2,3,4,5,6',  -- 요일 (0=일 … 6=토)
  city text not null default '서울',
  lat double precision,
  lng double precision,
  topics text not null default '',             -- 관심 주제 (쉼표로, 3개까지)
  style text not null default 'solo',          -- solo(1인 · 3크레딧) · duo(2인 대담 · 5크레딧)
  voice_a text not null default 'coral',
  voice_b text not null default 'ash',
  next_run timestamptz,                        -- 다음에 만들 시각 (알림 15분 전, 서버가 계산)
  updated_at timestamptz not null default now()
);
create index if not exists hub_briefs_due_idx on public.hub_briefs (next_run) where on1;
alter table public.hub_briefs enable row level security;

-- ② 날짜별 브리핑 (한 사람·하루에 한 줄)
create table if not exists public.hub_brief_items (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,                           -- 한국 날짜
  status text not null,                        -- ready · error
  title text,
  body text,                                   -- 화면에 보여 줄 글 요약
  script jsonb,                                -- 읽은 대본 [{s:'A'|'B', t:'…'}]
  sources jsonb,                               -- 뉴스 출처 [{title,url}]
  audio_url text,                              -- /media/relay/brief-….mp3
  style text,
  error text,
  created_at timestamptz not null default now(),
  unique (user_id, day)
);
create index if not exists hub_brief_items_user_idx on public.hub_brief_items (user_id, day desc);
alter table public.hub_brief_items enable row level security;

-- 확인: 오류 없이 0, 0 이 나오면 성공
select (select count(*) from public.hub_briefs) as briefs, (select count(*) from public.hub_brief_items) as items;
