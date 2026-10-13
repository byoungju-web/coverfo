-- coverfo 💰 수익 크레딧 (판매로 번 크레딧을 따로 보관) — Supabase SQL Editor 에 통째로 붙여넣고 Run 1회. 다시 돌려도 안전합니다.
-- 먼저 실행돼 있어야 하는 것: cf_studio_pro.sql (릴레이 마켓), cf_wallet.sql
--
--   · 마켓에서 팔리면 판매자 몫(70%)이 그 순간 "수익 크레딧(earned)" 에 들어갑니다. (예전에는 충전 크레딧에 섞여 들어감)
--   · 수익 크레딧은 ① 나중에 현금 출금(다음 단계) ② "사용 크레딧으로 옮기기" 로 coverfo 에서 바로 쓰기
--   · 옮긴 크레딧은 결제 취소 환불 대상이 아닙니다 (내가 결제한 돈이 아니므로) → 환불 계산에서 빼도록 서버도 함께 바꿈
--   · 모든 움직임은 cf_earnings 장부에 한 줄씩 남습니다.

-- 1) 수익 크레딧 칸
alter table public.cf_credits add column if not exists earned numeric(12,1) not null default 0;

-- 2) 수익 장부
create table if not exists public.cf_earnings (
  id          bigserial primary key,
  user_id     uuid not null,                       -- 판매자
  amount      numeric(12,1) not null,              -- + 들어옴 / - 나감
  kind        text not null,                       -- sale(판매) | move(사용 크레딧으로 옮김) | payout(출금, 다음 단계) | adjust(운영자 조정)
  item_type   text,                                -- recipe | app | … (무엇이 팔렸나)
  item_id     bigint,
  buyer       uuid,
  price       numeric(12,1),                       -- 판매 가격 (산 사람이 낸 것)
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists cf_earnings_user_idx on public.cf_earnings(user_id, created_at desc);
alter table public.cf_earnings enable row level security;   -- 서버(service_role)만

-- 3) 레시피 사기 (cf_studio_pro.sql 의 같은 함수를 바꿈): 판매자 몫을 earned 로 + 장부 기록. 나머지는 예전과 같음.
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
    update public.cf_credits set earned = earned + v_got where user_id = v_r.owner;          -- ← 수익 크레딧으로 바로
    insert into public.cf_earnings (user_id, amount, kind, item_type, item_id, buyer, price)
    values (v_r.owner, v_got, 'sale', 'recipe', p_recipe, p_buyer, v_r.price);
  else
    v_got := 0;
  end if;

  insert into public.cf_recipe_owned (user_id, recipe_id, paid, seller_got)
  values (p_buyer, p_recipe, v_r.price, v_got);
  update public.cf_recipes set sales = sales + 1 where id = p_recipe;

  return json_build_object('ok', true, 'paid', v_paid, 'price', v_r.price);
end
$$;

-- 4) 수익 크레딧 → 사용 크레딧(충전 크레딧 칸)으로 옮기기. 반환 {ok, earned, paid} 또는 {ok:false, reason}
create or replace function public.cf_earned_move(p_user uuid, p_amount numeric)
returns json
language plpgsql
security definer
as $$
declare v_e numeric; v_p numeric;
begin
  if p_amount is null or p_amount <= 0 then
    return json_build_object('ok', false, 'reason', 'bad_amount');
  end if;
  p_amount := round(p_amount, 1);
  select earned into v_e from public.cf_credits where user_id = p_user for update;
  if v_e is null or v_e < p_amount then
    return json_build_object('ok', false, 'reason', 'insufficient', 'earned', coalesce(v_e, 0));
  end if;
  update public.cf_credits set earned = earned - p_amount, balance = balance + p_amount
   where user_id = p_user returning earned, balance into v_e, v_p;
  insert into public.cf_earnings (user_id, amount, kind, note) values (p_user, -p_amount, 'move', '사용 크레딧으로 옮김');
  return json_build_object('ok', true, 'earned', v_e, 'paid', v_p);
end
$$;

-- 확인용:
-- select user_id, balance, earned from public.cf_credits where earned > 0 order by earned desc;
-- select * from public.cf_earnings order by id desc limit 30;

-- (선택) 예전 판매 수익을 수익 크레딧으로 옮기기 — 이번 변경 전에 팔린 몫은 충전 크레딧에 섞여 있습니다.
--   판매자별 "예전" 판매 몫(cf_recipe_owned.seller_got 중 장부 cf_earnings 에 sale 로 안 적힌 것)만큼,
--   충전 크레딧에 남아 있는 범위 안에서 수익 크레딧으로 옮깁니다. (이미 써 버린 만큼은 안 옮김 → 마이너스 없음)
--   한 사람에 한 번만 됩니다(두 번 Run 해도 안전). 필요하면 아래 주석(-- )을 지우고 이 부분만 Run.
-- with s as (
--   select r.owner as uid, sum(o.seller_got) as got
--     from public.cf_recipe_owned o join public.cf_recipes r on r.id = o.recipe_id
--    where o.seller_got > 0
--      and not exists (select 1 from public.cf_earnings e where e.kind = 'sale' and e.item_type = 'recipe' and e.item_id = o.recipe_id and e.buyer = o.user_id)
--    group by r.owner
-- ), m as (
--   select c.user_id, least(c.balance, s.got) as amt from public.cf_credits c join s on s.uid = c.user_id
--    where least(c.balance, s.got) > 0
--      and not exists (select 1 from public.cf_earnings e where e.user_id = c.user_id and e.kind = 'adjust' and e.note = '이전 판매 수익 옮김')
-- ), u as (
--   update public.cf_credits c set balance = c.balance - m.amt, earned = c.earned + m.amt from m where c.user_id = m.user_id returning c.user_id, m.amt
-- )
-- insert into public.cf_earnings (user_id, amount, kind, note) select user_id, amt, 'adjust', '이전 판매 수익 옮김' from u;
