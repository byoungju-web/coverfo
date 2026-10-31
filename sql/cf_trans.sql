-- coverfo 🌐 통역톡 (v295) — Supabase SQL Editor 에 전체를 붙여넣고 Run 1회
-- 포도톡을 거치지 않고 coverfo 안에서 도는 통역방. 대화는 30일 뒤 자동으로 지운다(서버가 지움).
-- 기존 표·함수(cf_credits, cf_spend …)는 건드리지 않습니다.

-- 1) 통역방 (1:1 · 다중)
create table if not exists public.cf_tr_rooms (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,              -- 초대 코드 6자리 (coverfo.com/#t=코드)
  kind       text not null default 'one',       -- one(1:1, 2명) | multi(다중, 10명)
  name       text,
  owner      uuid not null,
  last_body  text,
  last_nick  text,
  last_at    timestamptz not null default now(),
  created_at timestamptz not null default now()
);
-- 2) 참여자 (방마다 사람마다 한 줄 · 각자 고른 언어)
create table if not exists public.cf_tr_members (
  room_id    uuid not null references public.cf_tr_rooms(id) on delete cascade,
  user_id    uuid not null,
  nick       text,
  lang       text not null default 'KO',
  joined_at  timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index if not exists cf_tr_members_user_idx on public.cf_tr_members(user_id);
-- 3) 메시지 (원문 + 언어별 번역)
create table if not exists public.cf_tr_msgs (
  id         bigserial primary key,
  room_id    uuid not null references public.cf_tr_rooms(id) on delete cascade,
  user_id    uuid not null,
  nick       text,
  lang       text not null,
  body       text not null,
  tr         jsonb not null default '{}'::jsonb,  -- {"VI":"...","EN":"..."}
  created_at timestamptz not null default now()
);
create index if not exists cf_tr_msgs_room_idx on public.cf_tr_msgs(room_id, id);
create index if not exists cf_tr_msgs_time_idx on public.cf_tr_msgs(created_at);
-- 4) 0.1 크레딧 묶음 (크레딧은 정수로만 빠지므로 1크레딧을 빼면 0.1 × 10번을 담아 두고 한 번씩 씀 — chat 답변 묶음과 같은 방식)
create table if not exists public.cf_tr_pack (
  user_id    uuid primary key,
  tenths     integer not null default 0,         -- 남은 0.1 크레딧 개수
  updated_at timestamptz not null default now()
);
-- 남은 묶음에서 p_need 개(0.1 단위)를 한 번에 꺼낸다. 모자라면 꺼내지 않고 {ok:false, left}
create or replace function public.cf_tr_take(p_user uuid, p_need integer)
returns json language plpgsql security definer set search_path = public as $$
declare v_left integer;
begin
  update public.cf_tr_pack set tenths = tenths - p_need, updated_at = now()
   where user_id = p_user and tenths >= p_need
  returning tenths into v_left;
  if found then return json_build_object('ok', true, 'left', v_left); end if;
  select tenths into v_left from public.cf_tr_pack where user_id = p_user;
  return json_build_object('ok', false, 'left', coalesce(v_left, 0));
end $$;
-- 묶음에 0.1 크레딧 p_add 개를 더한다 (충전 1크레딧 = 10개, 실패한 번역은 되돌림)
create or replace function public.cf_tr_add(p_user uuid, p_add integer)
returns json language plpgsql security definer set search_path = public as $$
declare v_left integer;
begin
  insert into public.cf_tr_pack (user_id, tenths) values (p_user, greatest(0, p_add))
  on conflict (user_id) do update set tenths = greatest(0, public.cf_tr_pack.tenths + p_add), updated_at = now()
  returning tenths into v_left;
  return json_build_object('ok', true, 'left', v_left);
end $$;

alter table public.cf_tr_rooms   enable row level security;   -- 정책 없음 → 서버(service_role)만 읽고 씀
alter table public.cf_tr_members enable row level security;
alter table public.cf_tr_msgs    enable row level security;
alter table public.cf_tr_pack    enable row level security;
