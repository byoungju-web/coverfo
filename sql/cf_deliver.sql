-- coverfo 📮 발송 채널 (v302) — Supabase SQL Editor 에 전체를 붙여넣고 Run 1회
-- 예약 실행(📁 저장루틴 · 📊 매일 리포트) 결과를 어디로 받을지 계정마다 한 줄. 탈퇴하면 함께 지워진다.
-- 기존 표·함수는 건드리지 않습니다.
create table if not exists public.cf_deliver (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  tg_token   text,                                  -- 텔레그램 봇 토큰 (서버만 읽음 · 화면에는 끝 4자리만)
  tg_chat    text,                                  -- 텔레그램 대화 ID
  push       boolean not null default true,         -- 🔔 coverfo 알림으로도 받기 (사이드바 🔔 알림을 켠 폰으로)
  updated_at timestamptz not null default now()
);
alter table public.cf_deliver enable row level security;   -- 정책 없음 → 서버(service_role)만 읽고 씀
