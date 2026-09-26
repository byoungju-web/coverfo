-- coverfo 결제·충전용 (Supabase SQL Editor 에 붙여넣고 Run 1회)
-- 1) 주문 표
create table if not exists public.cf_orders (
  id          bigserial primary key,
  order_id    text unique not null,
  user_id     uuid not null,
  email       text,
  package     text,
  credits     integer not null,
  amount      integer not null,             -- 원
  status      text not null default 'pending',  -- pending | paid | failed | canceled | manual
  payment_key text,
  method      text,
  note        text,
  created_at  timestamptz not null default now(),
  paid_at     timestamptz
);
create index if not exists cf_orders_user_idx on public.cf_orders(user_id, created_at desc);
alter table public.cf_orders enable row level security;   -- 서버(service_role)만 읽고 씁니다

-- 2) 충전 함수: 충전 크레딧(balance)에 p_amount 를 더합니다 (음수면 차감). 반환: {ok, paid}
create or replace function public.cf_topup(p_user uuid, p_amount integer, p_note text default null)
returns json
language plpgsql
security definer
as $$
declare v_paid integer;
begin
  insert into public.cf_credits (user_id, balance, free_balance)
  values (p_user, 0, 0)
  on conflict (user_id) do nothing;

  update public.cf_credits
     set balance = greatest(0, coalesce(balance, 0) + p_amount)
   where user_id = p_user
  returning balance into v_paid;

  return json_build_object('ok', true, 'paid', v_paid);
end
$$;
