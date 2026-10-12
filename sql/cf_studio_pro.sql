-- coverfo Studio Pro (v3) — 커스텀 레시피 · 마켓플레이스 · 팀 협업
-- Supabase SQL Editor 에 통째로 붙여넣고 Run 1회. 다시 돌려도 안전합니다(if not exists / or replace).
--
--   · 레시피 = 릴레이 단계(음성인식·AI·음성·리서치)를 순서대로 이어 붙인 것
--   · 마켓: 값(price)이 0 이면 무료로 가져가기, 1 이상이면 크레딧으로 한 번 사면 계속 씀
--       - 판 사람에게 값의 70% 가 충전 크레딧(balance)으로 들어가고, 30% 는 coverfo 몫 (아래 v_share 로 조정)
--       - 받은 크레딧은 coverfo 안에서만 씀 (현금으로 바꾸지 않음)
--       - 레시피를 "실행"할 때는 산 사람이든 만든 사람이든 단계별 기본 크레딧이 따로 듭니다
--   · 팀: 이메일로 초대 → 초대받은 사람이 수락하면 팀 레시피를 같이 보고 · 고치고 · 실행. 크레딧은 각자.
--   · 모든 표는 서버(service_role)만 읽고 씁니다 (RLS 켜고 정책 없음).

-- 1) 팀
create table if not exists public.cf_teams (
  id          bigserial primary key,
  owner       uuid not null,
  name        text not null,
  created_at  timestamptz not null default now()
);
create table if not exists public.cf_team_members (
  team_id     bigint not null references public.cf_teams(id) on delete cascade,
  email       text not null,                        -- 소문자로 저장
  user_id     uuid,                                 -- 수락하면 채워짐
  role        text not null default 'member',       -- owner | member
  status      text not null default 'invited',      -- invited | joined
  created_at  timestamptz not null default now(),
  primary key (team_id, email)
);
create index if not exists cf_team_members_user_idx on public.cf_team_members(user_id);
create index if not exists cf_team_members_email_idx on public.cf_team_members(email);
alter table public.cf_teams enable row level security;
alter table public.cf_team_members enable row level security;

-- 2) 레시피
create table if not exists public.cf_recipes (
  id          bigserial primary key,
  owner       uuid not null,
  owner_name  text,                                 -- 마켓에 보일 이름 (이메일 앞부분)
  team_id     bigint references public.cf_teams(id) on delete set null,
  title       text not null,
  icon        text not null default '🧩',
  descr       text not null default '',
  input       text not null default 'text',         -- text | audio
  steps       jsonb not null default '[]'::jsonb,   -- [{type, task, lang, tone, length, prompt, label}]
  price       numeric(12,1) not null default 0,     -- 0 = 무료
  visibility  text not null default 'private',      -- private | team | public
  sales       integer not null default 0,
  hidden      boolean not null default false,       -- 운영자가 내린 레시피
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists cf_recipes_owner_idx on public.cf_recipes(owner);
create index if not exists cf_recipes_public_idx on public.cf_recipes(visibility, hidden, sales desc);
create index if not exists cf_recipes_team_idx on public.cf_recipes(team_id);
alter table public.cf_recipes enable row level security;

-- 3) 산 기록 (무료로 가져간 것도 여기 남음)
create table if not exists public.cf_recipe_owned (
  user_id     uuid not null,
  recipe_id   bigint not null references public.cf_recipes(id) on delete cascade,
  paid        numeric(12,1) not null default 0,     -- 산 사람이 낸 크레딧
  seller_got  numeric(12,1) not null default 0,     -- 판 사람이 받은 크레딧
  created_at  timestamptz not null default now(),
  primary key (user_id, recipe_id)
);
alter table public.cf_recipe_owned enable row level security;

-- 4) 신고
create table if not exists public.cf_recipe_reports (
  id          bigserial primary key,
  recipe_id   bigint not null references public.cf_recipes(id) on delete cascade,
  by_user     uuid not null,
  reason      text,
  created_at  timestamptz not null default now(),
  unique (recipe_id, by_user)
);
alter table public.cf_recipe_reports enable row level security;

-- 5) 사기: 산 사람 크레딧을 빼고, 판 사람에게 70% 를 넣고, 산 기록을 남깁니다 (한 번에 · 두 번 눌러도 한 번만)
--    반환 {ok, paid(남은 내 크레딧)} 또는 {ok:false, reason}
create or replace function public.cf_recipe_buy(p_buyer uuid, p_recipe bigint)
returns json
language plpgsql
security definer
as $$
declare
  v_share  numeric := 0.7;                         -- 판 사람 몫 (0.7 = 70%)
  v_r      record;
  v_paid   numeric;
  v_got    numeric;
begin
  select id, owner, price, visibility, hidden into v_r from public.cf_recipes where id = p_recipe;
  if v_r.id is null or v_r.hidden or v_r.visibility <> 'public' then
    return json_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_r.owner = p_buyer then
    return json_build_object('ok', false, 'reason', 'own');
  end if;
  if exists (select 1 from public.cf_recipe_owned where user_id = p_buyer and recipe_id = p_recipe) then
    select balance into v_paid from public.cf_credits where user_id = p_buyer;
    return json_build_object('ok', true, 'dup', true, 'paid', coalesce(v_paid, 0));
  end if;

  insert into public.cf_credits (user_id, balance, free_balance) values (p_buyer, 0, 0)
  on conflict (user_id) do nothing;
  select balance into v_paid from public.cf_credits where user_id = p_buyer for update;
  v_paid := coalesce(v_paid, 0);

  if v_r.price > 0 then
    if v_paid < v_r.price then
      return json_build_object('ok', false, 'reason', 'insufficient', 'paid', v_paid, 'need', v_r.price);
    end if;
    update public.cf_credits set balance = balance - v_r.price where user_id = p_buyer returning balance into v_paid;

    v_got := round(v_r.price * v_share, 1);
    insert into public.cf_credits (user_id, balance, free_balance) values (v_r.owner, 0, 0)
    on conflict (user_id) do nothing;
    update public.cf_credits set balance = balance + v_got where user_id = v_r.owner;
  else
    v_got := 0;
  end if;

  insert into public.cf_recipe_owned (user_id, recipe_id, paid, seller_got)
  values (p_buyer, p_recipe, v_r.price, v_got);
  update public.cf_recipes set sales = sales + 1 where id = p_recipe;

  return json_build_object('ok', true, 'paid', v_paid, 'price', v_r.price);
end
$$;

-- 확인용:
-- select id, title, price, visibility, sales from public.cf_recipes order by id desc limit 20;
-- select * from public.cf_recipe_owned order by created_at desc limit 20;
-- 레시피 내리기(운영자):   update public.cf_recipes set hidden = true where id = 번호;
-- 신고 보기:               select * from public.cf_recipe_reports order by id desc;
-- 판 사람 몫 바꾸기: 위 함수의 v_share 숫자를 고치고 이 함수 부분만 다시 Run
