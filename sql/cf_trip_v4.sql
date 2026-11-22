-- coverfo 📸 누리트립 — v433 (🤖 AI 일정 저장 · "내가 만든 일정" 목록)
-- Supabase → SQL Editor 에 통째로 붙여넣고 Run 1회. 다시 돌려도 안전합니다.
--   · 새 표 1개만 만듭니다. 서버(service_role)만 읽고 씁니다 (RLS 켜고 정책 없음).
--   · 해외(구글) 장소는 구글 정책에 따라 place id 만 저장하고, 이름·주소·좌표는 저장하지 않습니다.
--   · 결제 · 크레딧 표는 건드리지 않습니다.

create table if not exists public.cf_trip_plans (
  id         bigserial primary key,
  user_id    uuid not null,
  title      text not null,
  plan       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists cf_trip_plans_user_idx on public.cf_trip_plans (user_id, created_at desc);

alter table public.cf_trip_plans enable row level security;

-- 확인용:  select id, title, created_at from public.cf_trip_plans order by id desc limit 20;
