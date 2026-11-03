-- coverfo ⏰ 알림 · 🏃 한 마디 루틴 (v327) — Supabase SQL Editor 에 전체를 붙여넣고 Run 1회
-- 둘 다 무료. 서버(service_role)만 읽고 쓴다. 계정을 탈퇴하면 함께 지워진다(on delete cascade). 기존 표·함수는 건드리지 않습니다.

-- ⏰ 알림: "3시에 회의 알려줘", "매달 25일 월세 내라고 알려줘" — 켜 둔 알림은 30개까지 (functions/api/hub.js)
create table if not exists public.cf_remind (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  text       text not null,                         -- 알림 문구 (최대 60자)
  kind       text not null default 'once',          -- once · daily · weekly · monthly
  next_at    timestamptz not null,                  -- 다음에 울릴 때
  off_min    int  not null default 540,             -- 만든 기기의 UTC 차이(분) — 한국 540. 매달 반복 계산에 씀
  hh         int  not null default 9,
  mm         int  not null default 0,
  dow        int  not null default 0,               -- 매주: 0 일요일 ~ 6 토요일
  dom        int  not null default 1,               -- 매달: 날짜
  is_on      boolean not null default true,         -- 한 번짜리는 울리면 꺼짐(30일 뒤 지움)
  created_at timestamptz not null default now()
);
create index if not exists cf_remind_due on public.cf_remind (is_on, next_at);
create index if not exists cf_remind_user on public.cf_remind (user_id, next_at);
alter table public.cf_remind enable row level security;   -- 정책 없음 → 서버만

-- 🏃 한 마디 루틴: "퇴근" = 명령 문장 여러 개 (최대 5개 · 루틴 20개까지). 전화·계좌번호는 넣지 않는다.
create table if not exists public.cf_mroutine (
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  cmds       jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, name)
);
alter table public.cf_mroutine enable row level security;
