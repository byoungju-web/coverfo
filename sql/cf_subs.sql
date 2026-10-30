-- coverfo 📅 크레딧 월 구독 (토스페이먼츠 빌링 · v286) — Supabase SQL Editor 에 붙여넣고 Run 1회
-- 구독 1건 = 1줄. 매달 결제한 기록은 지금처럼 cf_orders 에 한 줄씩 들어갑니다 (주문번호 cfsub_… · 충전 내역·환불에 그대로 보임).
create table if not exists public.cf_subs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  email         text,
  plan          text not null,                 -- sub100 | sub300 | sub550
  credits       integer not null,              -- 매달 넣어 줄 크레딧
  amount        integer not null,              -- 매달 결제 금액(원)
  customer_key  text unique not null,          -- 토스 구매자 ID (추측할 수 없는 무작위 값)
  billing_key   text,                          -- 토스 빌링키 (서버만 읽음 · 해지하면 지움)
  card          text,                          -- 카드사 · 끝자리 (화면 표시용)
  status        text not null default 'pending',  -- pending(카드 등록 전) | active | canceled(해지 · 다음 결제 없음) | stopped(결제 실패로 멈춤)
  period        integer not null default 0,    -- 지금까지 결제한 달 수
  started_at    timestamptz,
  paid_until    timestamptz,                   -- 이번 달 이용 기간 끝 (= 다음 결제일)
  next_at       timestamptz,                   -- 다음 결제 시도 시각 (active 일 때만)
  fails         integer not null default 0,    -- 연달아 실패한 횟수 (3번이면 stopped)
  last_error    text,
  canceled_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists cf_subs_user_idx on public.cf_subs(user_id, created_at desc);
create index if not exists cf_subs_due_idx  on public.cf_subs(status, next_at);
alter table public.cf_subs enable row level security;   -- 정책 없음 → 서버(service_role)만 읽고 씁니다
