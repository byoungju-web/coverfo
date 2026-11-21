-- coverfo 📸 누리트립 2단계 — v429 (팔로우 · 테마 지도)
-- Supabase → SQL Editor 에 통째로 붙여넣고 Run 1회. 다시 돌려도 안전합니다.
--   · 1단계(cf_trip.sql)를 먼저 돌린 뒤에 돌립니다. 1단계 표는 바꾸지 않고, 새 표 2개만 만듭니다.
--   · 서버(service_role)만 읽고 씁니다 (RLS 켜고 정책 없음 = 브라우저에서 직접 못 건드림).
--   · 결제 · 크레딧 표는 건드리지 않습니다.

-- 팔로우 (user_id 가 target 을 팔로우)
create table if not exists public.cf_trip_follows (
  user_id    uuid not null,
  target     uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target)
);
create index if not exists cf_trip_follows_target_idx on public.cf_trip_follows (target);

-- 테마 지도 (예: '비 오는 날 제주') — 내 글·저장한 글을 골라 묶고 링크로 공유
create table if not exists public.cf_trip_maps (
  id         bigserial primary key,
  user_id    uuid not null,
  nick       text not null,
  title      text not null,
  post_ids   bigint[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cf_trip_maps_user_idx on public.cf_trip_maps (user_id, updated_at desc);

alter table public.cf_trip_follows enable row level security;
alter table public.cf_trip_maps    enable row level security;

-- 확인용:  select id, nick, title, cardinality(post_ids) as n, updated_at from public.cf_trip_maps order by id desc limit 20;
