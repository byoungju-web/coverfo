-- coverfo 👑 멤버십 (월 구독) — 구독 크레딧 이월 불가 · 다음 결제일 소멸 (v305)
-- Supabase SQL Editor 에 붙여넣고 Run 1회. 여러 번 실행해도 안전합니다.
--
-- 방식: 지갑(cf_credits.balance)은 그대로 하나. "이번 달 구독 크레딧이 얼마 남았는지"(sub_left)만 따로 셉니다.
--   · 크레딧을 쓰면(잔액이 줄면) 구독 크레딧부터 줄어든 것으로 셉니다 → 무료 → 구독 → 충전 순서.
--     기존 차감·충전·환불 함수(cf_spend · cf_wallet_spend · cf_topup · 통역 묶음 …)는 하나도 바꾸지 않습니다.
--   · 잔액이 늘 때(충전 · 생성 실패로 돌려받음)는 sub_left 를 늘리지 않습니다 → 돌려받은 크레딧은 충전 크레딧이 되어
--     소멸되는 양이 실제보다 많아지는 일이 없습니다(이용자에게 불리하지 않게).
--   · 월 구독 결제 주문(cfsub_…)이 paid 가 되는 순간: 지난달 남은 구독 크레딧을 소멸(기록) → 이번 달 크레딧 수를 sub_left 로.
--     그 직후 기존 billing.js 가 지금처럼 cf_topup 으로 크레딧을 넣습니다 (결제 코드 무변경).
--   · 해지 · 결제 실패로 이용 기간(paid_until)이 끝났는데 남은 구독 크레딧이 있으면 cf_sub_expire_due() 가 소멸합니다
--     (billing.js 의 5분마다 도는 예약 실행 끝에서 부름).
--   · 한 번 충전(일반결제) 크레딧은 지금처럼 결제일부터 1년 — 이 파일과 상관없습니다.

-- 1) 지갑에 칸 2개
alter table public.cf_credits add column if not exists sub_left numeric(12,1) not null default 0;   -- 이번 달 남은 구독 크레딧
alter table public.cf_credits add column if not exists sub_at   timestamptz;                         -- 구독 크레딧을 받은 시각

-- 2) 소멸 기록
create table if not exists public.cf_sub_expire (
  id          bigserial primary key,
  user_id     uuid not null,
  amount      numeric(12,1) not null,      -- 소멸한 크레딧
  reason      text not null,               -- renew(다음 달 결제) | end(이용 기간 끝)
  order_id    text,                        -- renew 일 때 새 결제 주문번호
  created_at  timestamptz not null default now()
);
create index if not exists cf_sub_expire_user_idx on public.cf_sub_expire(user_id, created_at desc);
alter table public.cf_sub_expire enable row level security;   -- 정책 없음 → 서버(service_role)만

-- 3) 잔액이 줄면 구독 크레딧부터 줄어든 것으로 셈 (이 파일의 함수가 직접 고칠 때는 건너뜀)
create or replace function public.cf_sub_track()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('cf.sub_skip', true), '') = '1' then
    return new;
  end if;
  if coalesce(new.balance, 0) < coalesce(old.balance, 0) and coalesce(old.sub_left, 0) > 0 then
    new.sub_left := greatest(0, least(coalesce(new.balance, 0), coalesce(old.sub_left, 0) - (coalesce(old.balance, 0) - coalesce(new.balance, 0))));
  elsif coalesce(new.sub_left, 0) > coalesce(new.balance, 0) then
    new.sub_left := greatest(0, coalesce(new.balance, 0));
  end if;
  return new;
end
$$;
drop trigger if exists cf_sub_track_trg on public.cf_credits;
create trigger cf_sub_track_trg before update of balance on public.cf_credits
  for each row execute function public.cf_sub_track();

-- 4) 소멸 1건 (내부용): 남은 구독 크레딧을 잔액에서 빼고 기록
create or replace function public.cf_sub_expire_one(p_user uuid, p_reason text, p_order text default null, p_new numeric default 0)
returns numeric
language plpgsql
security definer
as $$
declare v_left numeric; v_bal numeric; v_take numeric;
begin
  insert into public.cf_credits (user_id, balance, free_balance)
  values (p_user, 0, 0)
  on conflict (user_id) do nothing;

  select coalesce(sub_left, 0), coalesce(balance, 0) into v_left, v_bal
    from public.cf_credits where user_id = p_user for update;
  v_take := greatest(0, least(v_left, v_bal));

  perform set_config('cf.sub_skip', '1', true);
  update public.cf_credits
     set balance  = coalesce(balance, 0) - v_take,
         sub_left = greatest(0, coalesce(p_new, 0)),
         sub_at   = case when coalesce(p_new, 0) > 0 then now() else sub_at end
   where user_id = p_user;
  perform set_config('cf.sub_skip', '', true);

  if v_take > 0 then
    insert into public.cf_sub_expire (user_id, amount, reason, order_id) values (p_user, v_take, p_reason, p_order);
  end if;
  return v_take;
end
$$;

-- 5) 월 구독 결제(cfsub_…)가 paid 가 되면: 지난달 남은 것 소멸 → 이번 달 크레딧 수를 sub_left 로
create or replace function public.cf_sub_on_paid()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'paid' and coalesce(old.status, '') <> 'paid' and new.order_id like 'cfsub\_%' then
    perform public.cf_sub_expire_one(new.user_id, 'renew', new.order_id, new.credits);
  end if;
  return new;
end
$$;
drop trigger if exists cf_sub_on_paid_trg on public.cf_orders;
create trigger cf_sub_on_paid_trg after update of status on public.cf_orders
  for each row execute function public.cf_sub_on_paid();

-- 6) 이용 기간이 끝난 구독의 남은 크레딧 소멸 (billing.js 예약 실행이 부름). 반환 {ok, users, amount}
--    · 지금 이용 기간 안(paid_until > 지금)인 구독이 있으면 소멸하지 않음
--    · 받은 지 1시간 안 된 크레딧은 건너뜀 (첫 결제 직후 구독 표가 아직 갱신되기 전의 짧은 틈)
create or replace function public.cf_sub_expire_due()
returns json
language plpgsql
security definer
as $$
declare r record; v_n integer := 0; v_sum numeric := 0; v_t numeric;
begin
  for r in
    select c.user_id from public.cf_credits c
     where coalesce(c.sub_left, 0) > 0
       and (c.sub_at is null or c.sub_at < now() - interval '1 hour')
       and not exists (select 1 from public.cf_subs s
                        where s.user_id = c.user_id
                          and s.status in ('active', 'canceled', 'charging')
                          and s.paid_until is not null and s.paid_until > now())
     limit 200
  loop
    v_t := public.cf_sub_expire_one(r.user_id, 'end', null, 0);
    v_n := v_n + 1; v_sum := v_sum + v_t;
  end loop;
  return json_build_object('ok', true, 'users', v_n, 'amount', v_sum);
end
$$;

-- 확인용:
-- select user_id, balance, sub_left, sub_at from public.cf_credits where sub_left > 0;
-- select * from public.cf_sub_expire order by id desc limit 20;
