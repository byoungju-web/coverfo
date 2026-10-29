-- coverfo 🔔 웹 알림 (v284) — 아침 브리핑을 coverfo 웹(크롬 등)에서도 알림으로 받기
-- Supabase → SQL Editor → New query 에 통째로 붙여 넣고 Run (1번만). hub_brief.sql(v283)을 먼저 실행했어야 합니다.

-- ① 브라우저 알림 구독 (기기·브라우저마다 한 줄)
create table if not exists public.hub_push (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists hub_push_user_idx on public.hub_push (user_id);
alter table public.hub_push enable row level security;   -- 정책 없음 → 서버(service_role)만

-- ② 브리핑마다 '알림 보낼 시각' 과 '보냈는지'
alter table public.hub_brief_items add column if not exists push_at timestamptz;
alter table public.hub_brief_items add column if not exists pushed boolean not null default false;
create index if not exists hub_brief_items_push_idx on public.hub_brief_items (push_at) where not pushed;

-- 확인: 오류 없이 0 이 나오면 성공
select count(*) from public.hub_push;
