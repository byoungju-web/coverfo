-- coverfo 👥 같이 정하기 링크 (v356) — Supabase SQL Editor 에 전체를 붙여넣고 Run 1회
-- 내가 고른 결과(📍 장소 목록 · 🧳 한 번에 준비 · 🏃 한 마디 루틴)를 링크(coverfo.com/s/번호)로 친구에게 보내면
-- 친구는 가입 없이 열어서 👍(장소) · 🙋 갈게요(여행) · 🎁 담기(루틴)를 누른다. 무료(크레딧 없음).
-- 저장하는 것: 보낸 사람이 고른 결과 내용 + 보낸 사람이 적은 별명, 친구가 적은 별명과 누른 것.
-- 저장하지 않는 것: 친구의 이름·전화번호·이메일·IP·위치. 친구는 브라우저에 만든 무작위 표시로만 구분한다.
-- 30일이 지나면 열리지 않고 지워진다. 보낸 사람이 언제든 지울 수 있고, 탈퇴하면 함께 지워진다(on delete cascade).
-- 기존 표·함수는 건드리지 않습니다.
create table if not exists public.cf_share (
  id          text primary key,                 -- 링크 번호 (영문·숫자 8자리)
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,                    -- places · trip · routine
  title       text not null,
  sender      text not null default '',         -- 보낸 사람이 적은 별명 (최대 12자)
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists cf_share_user_time on public.cf_share (user_id, created_at desc);
create index if not exists cf_share_expires on public.cf_share (expires_at);
alter table public.cf_share enable row level security;        -- 정책 없음 → 서버(service_role)만 읽고 씀

create table if not exists public.cf_share_vote (
  share_id    text not null references public.cf_share(id) on delete cascade,
  voter       text not null,                    -- 친구 브라우저의 무작위 표시 (사람 정보 아님)
  pick        text not null,                    -- places: 장소 번호 '1'~'10' · trip: 'go' | 'no' · routine: 'take'
  nick        text not null default '',         -- 친구가 적은 별명 (최대 12자)
  created_at  timestamptz not null default now(),
  primary key (share_id, voter, pick)
);
alter table public.cf_share_vote enable row level security;   -- 정책 없음 → 서버(service_role)만 읽고 씀
