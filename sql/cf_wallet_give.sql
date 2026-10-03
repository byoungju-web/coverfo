-- coverfo 지갑: 돌려주기 함수 (포도톡 서버가 번역·답 실패로 크레딧을 되돌릴 때) — Supabase SQL Editor 에서 Run 1회
-- cf_wallet.sql 을 먼저 실행한 뒤에 실행합니다.
create or replace function public.cf_wallet_give(p_user uuid, p_amount numeric, p_item text, p_source text, p_ref text default null, p_note text default null)
returns json
language plpgsql
security definer
as $$
declare v_paid numeric; v_id bigint;
begin
  if p_amount is null or p_amount <= 0 then
    return json_build_object('ok', false, 'reason', 'bad_amount');
  end if;

  -- 같은 ref 로 이미 돌려줬으면 그대로 (두 번 눌러도 한 번만)
  if p_ref is not null then
    select id into v_id from public.cf_wallet_log where user_id = p_user and source = p_source and ref = p_ref limit 1;
    if v_id is not null then
      select balance into v_paid from public.cf_credits where user_id = p_user;
      return json_build_object('ok', true, 'id', v_id, 'paid', coalesce(v_paid, 0), 'dup', true);
    end if;
  end if;

  insert into public.cf_credits (user_id, balance, free_balance) values (p_user, 0, 0) on conflict (user_id) do nothing;
  update public.cf_credits set balance = balance + p_amount where user_id = p_user returning balance into v_paid;

  insert into public.cf_wallet_log (user_id, source, item, qty, cost, ref, status, note)
  values (p_user, p_source, p_item, 1, -p_amount, p_ref, 'refunded', p_note)
  returning id into v_id;

  return json_build_object('ok', true, 'id', v_id, 'paid', v_paid);
end
$$;
