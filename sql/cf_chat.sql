-- coverfo 💬 채팅 · 👥 일반채팅 (v296) — Supabase SQL Editor 에 전체를 붙여넣고 Run 1회
-- 포도톡을 거치지 않고 coverfo 안에서 도는 채팅방. 무료(크레딧 안 씀). 대화는 30일 뒤 자동으로 지운다(서버가 지움).
-- 기존 표·함수(cf_credits, cf_spend, cf_tr_* …)는 건드리지 않습니다.

-- 1) 채팅방
create table if not exists public.cf_chat_rooms (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,              -- 초대 코드 6자리 (coverfo.com/#c=코드)
  kind       text not null default 'group',     -- direct(💬 1:1, 2명) | group(👥 일반채팅, 100명)
  is_public  boolean not null default false,    -- true = 🌏 오픈채팅 (목록에 보여 누구나 들어옴)
  name       text,
  owner      uuid not null,
  last_body  text,
  last_nick  text,
  last_at    timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists cf_chat_rooms_pub_idx on public.cf_chat_rooms(is_public, last_at desc);
-- 2) 참여자
create table if not exists public.cf_chat_members (
  room_id    uuid not null references public.cf_chat_rooms(id) on delete cascade,
  user_id    uuid not null,
  nick       text,
  joined_at  timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index if not exists cf_chat_members_user_idx on public.cf_chat_members(user_id);
-- 3) 메시지
create table if not exists public.cf_chat_msgs (
  id         bigserial primary key,
  room_id    uuid not null references public.cf_chat_rooms(id) on delete cascade,
  user_id    uuid not null,
  nick       text,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists cf_chat_msgs_room_idx on public.cf_chat_msgs(room_id, id);
create index if not exists cf_chat_msgs_time_idx on public.cf_chat_msgs(created_at);
-- 4) 차단 (내가 차단한 사람의 말은 나에게 안 보임)
create table if not exists public.cf_chat_blocks (
  user_id    uuid not null,
  blocked    uuid not null,
  nick       text,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked)
);
-- 5) 신고 (운영자가 Supabase 에서 확인)
create table if not exists public.cf_chat_reports (
  id         bigserial primary key,
  room_id    uuid,
  msg_id     bigint,
  reporter   uuid not null,
  target     uuid,
  body       text,
  reason     text,
  created_at timestamptz not null default now()
);

alter table public.cf_chat_rooms   enable row level security;   -- 정책 없음 → 서버(service_role)만 읽고 씀
alter table public.cf_chat_members enable row level security;
alter table public.cf_chat_msgs    enable row level security;
alter table public.cf_chat_blocks  enable row level security;
alter table public.cf_chat_reports enable row level security;
