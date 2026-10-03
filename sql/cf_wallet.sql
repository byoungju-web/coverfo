-- coverfo 지갑 공유 (포도톡·포도야가 coverfo 크레딧을 빌려 쓰기)  — Supabase SQL Editor 에 붙여넣고 Run 1회
--   · 1크레딧 = 99원. 포도톡 단가가 0.1 단위라 충전 크레딧(balance)을 소수점 1자리로 바꿉니다.
--   · 포도톡·포도야는 충전 크레딧(balance)만 씁니다. 무료 크레딧(free_balance)은 coverfo 안에서만 (월 선착순 규칙이 거기 있음).
--   · 연결 코드 CF-XXXX-XXXX 한 사람당 하나. 다시 만들면 옛 코드는 꺼짐.
--   · 차감 기록은 cf_wallet_log 에 남고, 같은 ref 로 두 번 보내도 한 번만 차감(재시도 안전).

-- 1) 충전 크레딧을 소수점 1자리로 (기존 cf_topup / cf_spend 는 정수를 넣으므로 그대로 동작)
alter table public.cf_credits alter column balance type numeric(12,1) using coalesce(balance, 0)::numeric(12,1);

-- 2) 연결 코드
create table if not exists public.cf_wallet_codes (
  code        text primary key,                 -- CF-XXXX-XXXX
  user_id     uuid not null unique,
  created_at  timestamptz not null default now()
);
alter table public.cf_wallet_codes enable row level security;   -- 서버(service_role)만

-- 3) 차감 기록
create table if not exists public.cf_wallet_log (
  id          bigserial primary key,
  user_id     uuid not null,
  source      text not null,                    -- podotalk | podoya | coverfo
  item        text not null,                    -- stt | fast | quality | search | phone ...
  qty         numeric(12,2) not null default 1,
  cost        numeric(12,1) not null,           -- 차감한 크레딧
  ref         text,                             -- 호출 쪽이 붙인 고유값 (재시도 중복 방지)
  status      text not null default 'spent',    -- spent | refunded
  note        text,
  created_at  timestamptz not null default now()
);
create unique index if not exists cf_wallet_log_ref_idx on public.cf_wallet_log(user_id, source, ref) where ref is not null;
create index if not exists cf_wallet_log_user_idx on public.cf_wallet_log(user_id, created_at desc);
alter table public.cf_wallet_log enable row level security;

-- 4) 차감: 충전 크레딧에서 p_cost 를 뺍니다. 반환 {ok, id, paid} 또는 {ok:false, reason:'insufficient', paid}
create or replace function public.cf_wallet_spend(p_user uuid, p_cost numeric, p_item text, p_source text, p_qty numeric default 1, p_ref text default null, p_note text default null)
returns json
language plpgsql
security definer
as $$
declare v_paid numeric; v_id bigint;
begin
  if p_cost is null or p_cost < 0 then
    return json_build_object('ok', false, 'reason', 'bad_cost');
  end if;

  -- 같은 ref 로 이미 차감했으면 그 결과를 그대로 (두 번 눌러도 한 번만)
  if p_ref is not null then
    select id into v_id from public.cf_wallet_log
     where user_id = p_user and source = p_source and ref = p_ref limit 1;
    if v_id is not null then
      select balance into v_paid from public.cf_credits where user_id = p_user;
      return json_build_object('ok', true, 'id', v_id, 'paid', coalesce(v_paid, 0), 'dup', true);
    end if;
  end if;

  insert into public.cf_credits (user_id, balance, free_balance)
  values (p_user, 0, 0)
  on conflict (user_id) do nothing;

  select balance into v_paid from public.cf_credits where user_id = p_user for update;
  v_paid := coalesce(v_paid, 0);

  if v_paid < p_cost then
    return json_build_object('ok', false, 'reason', 'insufficient', 'paid', v_paid, 'need', p_cost);
  end if;

  update public.cf_credits set balance = balance - p_cost where user_id = p_user returning balance into v_paid;

  insert into public.cf_wallet_log (user_id, source, item, qty, cost, ref, note)
  values (p_user, p_source, p_item, coalesce(p_qty, 1), p_cost, p_ref, p_note)
  returning id into v_id;

  return json_build_object('ok', true, 'id', v_id, 'paid', v_paid);
end
$$;

-- 5) 환불(차감 취소): 그 기록이 spent 상태면 돌려주고 refunded 로 표시. 반환 {ok, paid}
create or replace function public.cf_wallet_refund(p_user uuid, p_id bigint)
returns json
language plpgsql
security definer
as $$
declare v_cost numeric; v_paid numeric;
begin
  update public.cf_wallet_log set status = 'refunded'
   where id = p_id and user_id = p_user and status = 'spent'
  returning cost into v_cost;

  if v_cost is null then
    select balance into v_paid from public.cf_credits where user_id = p_user;
    return json_build_object('ok', false, 'reason', 'not_found', 'paid', coalesce(v_paid, 0));
  end if;

  update public.cf_credits set balance = balance + v_cost where user_id = p_user returning balance into v_paid;
  return json_build_object('ok', true, 'paid', v_paid);
end
$$;

-- 확인용:
-- select balance, free_balance from public.cf_credits limit 3;
-- select * from public.cf_wallet_log order by id desc limit 10;
