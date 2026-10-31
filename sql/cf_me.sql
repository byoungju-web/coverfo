-- coverfo 🧠 내 기억 (v298) — Supabase SQL Editor 에 전체를 붙여넣고 Run 1회
-- 포도야 비서의 '내 기억': 이름·상호·업종·말투·영업시간·메모·기억해둔 사실을 계정마다 한 줄로 저장.
-- 해외 응대·문서 만들기·상품 시작하기 답에 반영된다. 계정을 탈퇴하면 함께 지워진다(on delete cascade).
-- 기존 표·함수는 건드리지 않습니다.
create table if not exists public.cf_me (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,   -- {"name","biz","job","tone","hours","note","facts":[…최대 40]}
  updated_at timestamptz not null default now()
);
alter table public.cf_me enable row level security;   -- 정책 없음 → 서버(service_role)만 읽고 씀
