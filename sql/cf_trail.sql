-- coverfo 👣 내 발자취 (v325) — Supabase SQL Editor 에 전체를 붙여넣고 Run 1회
-- 켜 둔 사람만: 홈 입력칸 빠른 실행(쇼핑·맛집·길안내 …)·사진으로 물어보기·앱/이미지/영상 만들기 요청을 계정에 짧게 기록.
-- 아침 브리핑의 "어제 하던 일" · 홈 "이어서 하기" · 소리 "어제 찾던 거 다시 띄워 줘" 에 쓴다.
-- 전화·문자·송금, 숫자가 길게 이어진 글(전화·카드·계좌번호처럼 보이는 것)은 기록하지 않는다. 위치(GPS)는 받지 않는다.
-- 90일이 지나면 지운다. 계정을 탈퇴하면 함께 지워진다(on delete cascade). 기존 표·함수는 건드리지 않습니다.
create table if not exists public.cf_trail (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null,                 -- shop · stay · navi · place · lens · app · image · video …
  title      text not null,                 -- 이용자가 한 말 (최대 120자)
  label      text not null default '',      -- 연 곳 이름 · 사진 답 앞부분 (최대 120자)
  url        text not null default '',      -- 다시 열 주소 (http(s) 또는 coverfo 안 주소)
  created_at timestamptz not null default now()
);
create index if not exists cf_trail_user_time on public.cf_trail (user_id, created_at desc);
alter table public.cf_trail enable row level security;   -- 정책 없음 → 서버(service_role)만 읽고 씀

create table if not exists public.cf_trail_set (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  is_on      boolean not null default false,  -- 처음에는 꺼져 있음 (이용자가 켜야 기록)
  updated_at timestamptz not null default now()
);
alter table public.cf_trail_set enable row level security;
