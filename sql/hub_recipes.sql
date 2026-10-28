-- coverfo 🔗 커넥션 허브 2.0 · v279 레시피 표
-- Supabase → SQL Editor → New query 에 통째로 붙여 넣고 Run (1번만).
-- 서버(functions/api/hub.js)만 service_role 키로 읽고 씁니다. 화면(브라우저)은 직접 못 읽게 RLS 를 켜 둡니다.

create table if not exists public.hub_recipes (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  goal text not null,
  runs integer not null default 0,
  last_run timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists hub_recipes_user_idx on public.hub_recipes (user_id);

alter table public.hub_recipes enable row level security;
-- 정책(policy)을 만들지 않으므로 로그인 사용자도 직접은 못 읽고, 서버(service_role)만 씁니다.

-- 확인: 아래가 0 이 나오면 표가 만들어진 것
select count(*) from public.hub_recipes;
