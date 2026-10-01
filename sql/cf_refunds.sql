-- coverfo 크레딧 환불 기록 (Supabase SQL Editor 에 붙여넣고 Run 1회)
-- 탈퇴·환불 요청 시 토스 결제 취소가 성공/실패할 때마다 한 줄씩 남습니다. 운영자는 이 표만 보면 됩니다.
create table if not exists public.cf_refunds (
  id              bigserial primary key,
  order_id        text not null,              -- cf_orders.order_id
  user_id         uuid not null,
  email           text,
  credits         integer not null,           -- 환불한 크레딧
  gross           integer not null,           -- 공제 전 금액(원)
  fee             integer not null default 0, -- 수수료(원)
  amount          integer not null,           -- 실제 환불액(원)
  method          text,                       -- 카드 · 간편결제 · 가상계좌 …
  transaction_key text,                       -- 토스 취소 거래키
  status          text not null default 'done',  -- done | failed
  reason          text,                       -- user(본인 요청) | withdraw
  error           text,                       -- 실패 사유
  created_at      timestamptz not null default now()
);
create index if not exists cf_refunds_order_idx on public.cf_refunds(order_id);
create index if not exists cf_refunds_user_idx  on public.cf_refunds(user_id, created_at desc);
alter table public.cf_refunds enable row level security;   -- 서버(service_role)만 읽고 씁니다
