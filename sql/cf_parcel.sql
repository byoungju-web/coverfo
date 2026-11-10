-- coverfo 📦 배송완료 알림 (v363) — Supabase SQL Editor 에 전체를 붙여넣고 Run 1회
-- 이용자가 [🔔 배송완료 알림 받기] 를 누른 송장만 계정에 저장한다 (택배사 코드 · 송장번호 · 이용자가 붙인 이름 · 마지막 배송 단계).
-- 받는 사람 이름·주소·전화번호, 쿠팡 계정 정보는 받지도 저장하지도 않는다. (내 택배 목록 자체는 이용자 기기에만)
-- coverfo-cron 이 깨울 때(hub.js cron_due) 배송 단계를 확인하고, 배송완료가 되면 🔔 웹 알림(+ 카톡 나에게 보내기를 켰으면 카톡)으로 한 번 알린다.
-- 알림 1건 = PARCEL_ALERT_COST 크레딧(기본 1). 14일 안에 배송완료가 확인되지 않으면 크레딧을 돌려준다.
-- 배송완료 후 30일, 또는 알림을 끄면 지운다. 탈퇴하면 함께 지워진다(on delete cascade). 기존 표·함수는 건드리지 않습니다.
create table if not exists public.cf_parcel (
  id            bigserial primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  code          text not null,                  -- 택배사 코드 (스마트택배 기준, 예: 04 CJ대한통운)
  carrier       text not null default '',
  invoice       text not null,                  -- 송장번호
  label         text not null default '',       -- 이용자가 붙인 이름 (예: 운동화, 최대 30자)
  level         int  not null default 0,        -- 1 준비 · 2 집화 · 3 이동 · 4 지점도착 · 5 배송출발 · 6 배송완료
  status        text not null default '',
  last_where    text not null default '',
  last_time     text not null default '',
  done          boolean not null default false,
  notify        boolean not null default true,
  notified      boolean not null default false,
  job_id        bigint,                         -- 크레딧 차감 기록 (돌려줄 때 씀)
  notify_until  timestamptz not null default (now() + interval '14 days'),
  next_check    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, code, invoice)
);
create index if not exists cf_parcel_due on public.cf_parcel (next_check) where notify and not done;
create index if not exists cf_parcel_user on public.cf_parcel (user_id, created_at desc);
alter table public.cf_parcel enable row level security;   -- 정책 없음 → 서버(service_role)만 읽고 씀
