-- coverfo 토스 보안 체크리스트 v2 (2026-10-22)
-- Supabase → SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 괜찮습니다.
-- 이 SQL 을 실행하기 전에도 결제·환불은 예전처럼 작동합니다 (코드가 없으면 건너뛰도록 만들어 둠).

-- 1) 환불 회차 잠금: 같은 주문·같은 회차(주문번호:rf:회차)는 한 줄만
alter table public.cf_refunds add column if not exists idem_key text;
create unique index if not exists cf_refunds_idem_key_uq on public.cf_refunds (idem_key) where idem_key is not null;

-- 환불 상태에 'pending'(처리 중)을 쓸 수 있게 — 기존에 status 값 제한이 있었다면 바꿔 줌 (기존 줄은 검사하지 않음)
alter table public.cf_refunds drop constraint if exists cf_refunds_status_check;
alter table public.cf_refunds add constraint cf_refunds_status_check check (status in ('pending', 'done', 'failed')) not valid;

-- 2) 같은 웹훅 두 번 처리 방지: 토스 웹훅 전송 ID 기록
create table if not exists public.cf_webhook_seen (
  transmission_id text primary key,
  created_at timestamptz not null default now()
);
alter table public.cf_webhook_seen enable row level security;   -- 서버(service_role)만 읽고 씀. 브라우저용 정책 없음

-- 확인용
select 'cf_refunds.idem_key' as item, count(*) from information_schema.columns where table_name = 'cf_refunds' and column_name = 'idem_key'
union all
select 'cf_webhook_seen', count(*) from information_schema.tables where table_name = 'cf_webhook_seen';
