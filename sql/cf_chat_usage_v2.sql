-- coverfo 채팅 무료 한도 v2 (2026-10-10) — Supabase SQL Editor 에 전체를 붙여넣고 Run 1회
-- 바뀐 규칙(일반 대화 discuss):
--   · 하루 4회 제한 → 없앰
--   · 한 달 15회 무료 (사용자 1인당) — 그대로
--   · 16번째부터는 막지 않고 "크레딧 차감"으로 계속 사용 (차감은 서버 /api/chat 이 cf_spend 로 함, 기본 1회 1크레딧)
--   · 한 달 선착순 10,000명 무료 — 그대로. 마감되면 막지 않고 처음부터 크레딧 차감으로 사용
-- 표(cf_chat_usage, cf_free_month)는 v1(sql/cf_chat_usage.sql) 것을 그대로 씁니다. 표를 지우거나 바꾸지 않습니다.
-- 날짜·달은 한국 시간(Asia/Seoul) 기준입니다.

-- 1) 한도 확인 + 무료면 1 증가 (한 번에). 반환 예:
--    {"ok":true,"mode":"discuss","remaining_month":14}          ← 무료로 처리됨 (이번 달 남은 무료 횟수)
--    {"ok":false,"reason":"need_credit","why":"monthly_15"}     ← 이번 달 무료 15회 다 씀 → 크레딧 차감
--    {"ok":false,"reason":"need_credit","why":"monthly_cap_full"} ← 이번 달 선착순 무료 인원 마감 → 크레딧 차감
--    {"ok":false,"reason":"need_credit","why":"not_discuss"}    ← 앱 생성 등 → 크레딧 차감
create or replace function public.cf_chat_quota(p_user uuid, p_mode text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today       date := (now() at time zone 'Asia/Seoul')::date;
  v_month_start date := date_trunc('month', (now() at time zone 'Asia/Seoul'))::date;
  v_ym          text := to_char((now() at time zone 'Asia/Seoul'), 'YYYY-MM');
  v_month_cnt   int;
  v_free_users  int;
  v_month_cap   int := 15;     -- 한 달 무료 횟수(1인)
  v_user_cap    int := 10000;  -- 한 달 선착순 무료 이용자 수
begin
  if p_mode <> 'discuss' then
    return jsonb_build_object('ok', false, 'reason', 'need_credit', 'why', 'not_discuss');
  end if;

  select coalesce(sum(discuss), 0) into v_month_cnt
    from public.cf_chat_usage where user_id = p_user and day >= v_month_start;

  if coalesce(v_month_cnt, 0) >= v_month_cap then
    return jsonb_build_object('ok', false, 'reason', 'need_credit', 'why', 'monthly_15');
  end if;

  -- 이번 달 무료 명단에 없으면: 선착순 안이면 등록, 넘었으면 크레딧으로
  if not exists (select 1 from public.cf_free_month where ym = v_ym and user_id = p_user) then
    select count(*) into v_free_users from public.cf_free_month where ym = v_ym;

    if coalesce(v_free_users, 0) >= v_user_cap then
      return jsonb_build_object('ok', false, 'reason', 'need_credit', 'why', 'monthly_cap_full');
    end if;

    insert into public.cf_free_month (ym, user_id) values (v_ym, p_user)
    on conflict (ym, user_id) do nothing;
  end if;

  insert into public.cf_chat_usage (user_id, day, discuss)
  values (p_user, v_today, 1)
  on conflict (user_id, day) do update set discuss = public.cf_chat_usage.discuss + 1;

  return jsonb_build_object('ok', true, 'mode', 'discuss', 'remaining_month', v_month_cap - coalesce(v_month_cnt, 0) - 1);
end
$$;

-- 2) 무료로 처리했는데 답을 못 만들었을 때 1 되돌리기 (서버 /api/chat 이 부름)
create or replace function public.cf_chat_quota_undo(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  update public.cf_chat_usage set discuss = discuss - 1
   where user_id = p_user and day = v_today and discuss > 0;

  return jsonb_build_object('ok', true);
end
$$;

-- 3) 서버(서비스 키)만 부를 수 있게: 브라우저(anon·로그인 사용자)는 이 두 함수를 직접 못 부름
revoke all on function public.cf_chat_quota(uuid, text) from public, anon, authenticated;
revoke all on function public.cf_chat_quota_undo(uuid) from public, anon, authenticated;
grant execute on function public.cf_chat_quota(uuid, text) to service_role;
grant execute on function public.cf_chat_quota_undo(uuid) to service_role;

-- 확인용 (선택): 내 이번 달 사용 횟수 보기 — '내-사용자-id' 를 바꿔서
-- select coalesce(sum(discuss),0) from public.cf_chat_usage
--  where user_id = '내-사용자-id' and day >= date_trunc('month', (now() at time zone 'Asia/Seoul'))::date;
