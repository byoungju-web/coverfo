-- coverfo 🔗 커넥션 허브 2.0 · v280 레시피 예약 실행
-- Supabase → SQL Editor → New query 에 통째로 붙여 넣고 Run (1번만). hub_recipes.sql(v279)을 먼저 실행했어야 합니다.

-- ① 레시피에 예약 칸 더하기
alter table public.hub_recipes add column if not exists sched_on boolean not null default false;
alter table public.hub_recipes add column if not exists sched_kind text;        -- daily · weekdays · days · once
alter table public.hub_recipes add column if not exists sched_days text;        -- days 일 때 요일 (0=일 … 6=토), 예: '1,3,5'
alter table public.hub_recipes add column if not exists sched_hh integer;
alter table public.hub_recipes add column if not exists sched_mm integer;
alter table public.hub_recipes add column if not exists sched_date date;        -- once 일 때 날짜 (한국 날짜)
alter table public.hub_recipes add column if not exists mail_me boolean not null default true;   -- 결과를 지메일로 나에게
alter table public.hub_recipes add column if not exists next_run timestamptz;   -- 다음 실행 시각 (서버가 계산)
create index if not exists hub_recipes_due_idx on public.hub_recipes (next_run) where sched_on;

-- ② 예약 실행 기록 (완료 · 확인 대기 · 오류)
create table if not exists public.hub_runs (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id bigint,
  recipe_name text,
  status text not null,            -- done · wait · error · declined · expired
  say text,
  body text,
  items jsonb,
  state text,                      -- 확인 대기일 때 이어서 실행할 상태 (서버만 읽음)
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists hub_runs_user_idx on public.hub_runs (user_id, created_at desc);
alter table public.hub_runs enable row level security;   -- 정책 없음 → 서버(service_role)만 읽고 씀

-- 확인: 아래 두 줄이 오류 없이 0 이 나오면 성공
select count(*) from public.hub_recipes where sched_on;
select count(*) from public.hub_runs;
