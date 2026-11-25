-- coverfo 🍇 포도야 알림 친구 (v468) — Supabase SQL Editor 에 전체를 붙여넣고 Run 1회 (다시 Run 해도 됩니다)
-- 기념일·알림(생일·기념일·여행·매월 내는 날)을 이용자가 직접 적어 두면, 포도야가 D-7 · D-3 · 당일에 먼저 알려 준다.
-- 알림은 웹 알림(브라우저)·카톡 '나에게 보내기'(연결한 사람만)로 하루 1번, 이용자가 고른 시각에. 크레딧을 쓰지 않는다.
-- 저장하는 것: 이름(예: 엄마 생일) · 관계 · 날짜 · 메모(60자) · 정한 선물(60자). 전화·계좌처럼 긴 숫자는 서버가 막는다.
-- 서버(service_role)만 읽고 쓴다. 탈퇴하면 함께 지워진다(on delete cascade). 기존 표·함수는 건드리지 않습니다.
create table if not exists public.cf_pdy_day (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,                       -- 예: 엄마 생일 (최대 30자)
  rel         text not null default '',            -- 가족 · 친구 · 연인 · 동료 · 아이 · 나 · ''
  kind        text not null default 'yearly',      -- yearly 매년 · once 한 번 · monthly 매월
  md          text not null default '',            -- 매년: "MM-DD"
  day         date,                                -- 한 번: 날짜
  dom         int  not null default 0,             -- 매월: 1~31
  memo        text not null default '',
  gift        text not null default '',
  is_on       boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists cf_pdy_day_user on public.cf_pdy_day (user_id);
alter table public.cf_pdy_day enable row level security;   -- 정책 없음 → 서버만

create table if not exists public.cf_pdy_set (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  on_day      boolean not null default true,       -- 기념일 알림
  d7          boolean not null default true,
  d3          boolean not null default true,
  d0          boolean not null default true,
  hh          int not null default 9,              -- 알림 받을 시각 (한국 시각 7~21시)
  tone        text not null default 'kind',        -- kind 다정한 · fun 재밌는 · cool 쿨한
  last_day    text not null default '',            -- 마지막으로 확인한 한국 날짜 (하루 1번)
  updated_at  timestamptz not null default now()
);
create index if not exists cf_pdy_set_due on public.cf_pdy_set (last_day) where on_day;
alter table public.cf_pdy_set enable row level security;
