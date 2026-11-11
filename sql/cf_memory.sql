-- coverfo 🧠 내 비서 기억 (v366) — Supabase SQL Editor 에 전체를 붙여넣고 Run 1회 (다시 Run 해도 됩니다)
-- coverfo 의 모든 기능(소리 비서 · 홈 입력칸 · 같이 정하기 · 알림 · 택배 · 발자취)이 함께 쓰는 "기억" 한 곳.
-- 이용자가 "기억해 줘" 하거나 화면에서 [기억하기]를 누른 것만 저장한다 (몰래 쌓지 않음).
-- 저장하지 않는 것: 건강·병명·약, 전화·카드·계좌처럼 긴 숫자, 비밀번호, 주민번호 (서버가 막음).
-- 📒 내 연락처는 이용자가 [올리기]를 누를 때 이름·생일/기념일·늘 먹던 것만 올라온다 (전화번호·계좌·주소는 계속 기기에만).
-- 🔔 먼저 챙기기(기념일 3일 전·당일, 친구 2명 이상 고른 같이 정하기)는 이용자가 켰을 때만 · 알림 1번 MEMORY_NUDGE_COST 크레딧(기본 1) · 보낼 것이 없으면 차감 없음.
-- 서버(service_role)만 읽고 쓴다. 탈퇴하면 함께 지워진다(on delete cascade). 기존 표·함수는 건드리지 않습니다.
create table if not exists public.cf_memory (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  cat         text not null default 'me',          -- me 나 · person 사람 · place 장소 · like 취향 · habit 습관
  text        text not null,                       -- 기억 한 줄 (최대 120자)
  src         text not null default 'home',        -- 어디서 생겼나: talk 소리 · home 홈 입력칸 · center 기억 센터 · book 📒 · habit 발자취 제안
  key         text not null default '',            -- 📒 올리기 등 같은 것을 다시 올릴 때 덮어쓰는 열쇠
  meta        jsonb not null default '{}'::jsonb,  -- 📒 기념일: {name, day:"MM-DD", kind}
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists cf_memory_user on public.cf_memory (user_id, updated_at desc);
alter table public.cf_memory enable row level security;   -- 정책 없음 → 서버만

create table if not exists public.cf_memory_set (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  is_on       boolean not null default true,      -- 끄면 새로 기억하지 않음 (이미 있는 기억은 그대로 — 지우기는 따로)
  nudge       boolean not null default false,     -- 🔔 먼저 챙기기 (크레딧)
  nudge_day   text not null default '',           -- 마지막으로 먼저 챙기기를 확인한 한국 날짜 (하루 1번)
  sent        jsonb not null default '[]'::jsonb, -- 이미 알린 것 (같은 것을 두 번 알리지 않게 · 최근 60개)
  dismissed   jsonb not null default '[]'::jsonb, -- "아니요" 누른 습관 제안 (다시 묻지 않게 · 최근 100개)
  updated_at  timestamptz not null default now()
);
create index if not exists cf_memory_set_nudge on public.cf_memory_set (nudge_day) where nudge;
alter table public.cf_memory_set enable row level security;
