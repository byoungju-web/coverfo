-- coverfo 채팅 무료 한도 (Supabase SQL Editor 에 붙여넣고 Run 1회)
-- 무료는 '일반 대화(discuss)' 에만 적용됩니다. 앱 생성(build)·엔진·3D·스튜디오는 무료 없이 크레딧입니다.
-- 규칙(일반 대화):
--   · 하루 4회
--   · 한 달 15회 (사용자 1인당)
--   · 한 달 선착순 10,000명만 무료 (그 달에 무료를 처음 쓴 사람 순서로 10,000명). 넘으면 그 달은 잠기고, 다음 달 1일에 다시 열림.
-- 날짜·달은 한국 시간(Asia/Seoul) 기준입니다.

-- 1) 하루 사용량 표 (계정 + 날짜별 대화 횟수). 서비스 키(서버)만 읽고 씀 → RLS 켬(정책 없음)
create table if not exists public.cf_chat_usage (
  user_id uuid  not null,
  day     date  not null,
  discuss int   not null default 0,
  primary key (user_id, day)
);
alter table public.cf_chat_usage enable row level security;
create index if not exists cf_chat_usage_user_day on public.cf_chat_usage (user_id, day);

-- 2) 월별 무료 이용자 명단 (선착순 10,000명 계산용). ym 예: '2026-09'
create table if not exists public.cf_free_month (
  ym      text not null,
  user_id uuid not null,
  primary key (ym, user_id)
);
alter table public.cf_free_month enable row level security;
create index if not exists cf_free_month_ym on public.cf_free_month (ym);

-- 3) 한도 확인 + 1 증가 (한 번에). 반환 예:
--    {"ok":true,"mode":"discuss","remaining_day":3}
--    {"ok":false,"reason":"daily_discuss"}       ← 오늘 4회 다 씀
--    {"ok":false,"reason":"monthly_15"}          ← 이번 달 15회 다 씀
--    {"ok":false,"reason":"monthly_cap_full"}    ← 이번 달 선착순 10,000명 마감
--    {"ok":false,"reason":"need_credit"}         ← discuss 아님(앱 생성 등)
create or replace function public.cf_chat_quota(p_user uuid, p_mode text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_today       date := (now() at time zone 'Asia/Seoul')::date;
  v_month_start date := date_trunc('month', (now() at time zone 'Asia/Seoul'))::date;
  v_ym          text := to_char((now() at time zone 'Asia/Seoul'), 'YYYY-MM');
  v_day_cnt     int;
  v_month_cnt   int;
  v_free_users  int;
  v_day_cap     int := 4;      -- 하루 무료 횟수
  v_month_cap   int := 15;     -- 한 달 무료 횟수(1인)
  v_user_cap    int := 10000;  -- 한 달 선착순 무료 이용자 수
begin
  if p_mode <> 'discuss' then
    return jsonb_build_object('ok', false, 'reason', 'need_credit');
  end if;

  insert into public.cf_chat_usage (user_id, day, discuss)
  values (p_user, v_today, 0)
  on conflict (user_id, day) do nothing;

  select discuss into v_day_cnt from public.cf_chat_usage where user_id = p_user and day = v_today;

  if coalesce(v_day_cnt, 0) >= v_day_cap then
    return jsonb_build_object('ok', false, 'reason', 'daily_discuss');
  end if;

  select coalesce(sum(discuss), 0) into v_month_cnt
    from public.cf_chat_usage where user_id = p_user and day >= v_month_start;

  if coalesce(v_month_cnt, 0) >= v_month_cap then
    return jsonb_build_object('ok', false, 'reason', 'monthly_15');
  end if;

  -- 이번 달 무료 명단에 없으면: 선착순 10,000명 안이면 등록, 넘었으면 마감
  if not exists (select 1 from public.cf_free_month where ym = v_ym and user_id = p_user) then
    select count(*) into v_free_users from public.cf_free_month where ym = v_ym;

    if coalesce(v_free_users, 0) >= v_user_cap then
      return jsonb_build_object('ok', false, 'reason', 'monthly_cap_full');
    end if;

    insert into public.cf_free_month (ym, user_id) values (v_ym, p_user)
    on conflict (ym, user_id) do nothing;
  end if;

  update public.cf_chat_usage set discuss = discuss + 1 where user_id = p_user and day = v_today;

  return jsonb_build_object('ok', true, 'mode', 'discuss', 'remaining_day', v_day_cap - coalesce(v_day_cnt, 0) - 1);
end
$$;
