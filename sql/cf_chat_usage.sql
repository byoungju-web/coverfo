-- coverfo 채팅 무료 한도 (Supabase SQL Editor 에 붙여넣고 Run 1회)
-- 규칙:  글 답변(discuss)만 하루 4회 무료. 앱 생성(build)은 무료 없이 크레딧 차감 → 여기서 안 셉니다.
-- 날짜는 한국 시간(Asia/Seoul) 자정에 초기화됩니다.

-- 1) 사용량 표 (계정 + 날짜별 글 답변 횟수). 서비스 키(서버)만 읽고 씁니다 → RLS 켬(정책 없음)
create table if not exists public.cf_chat_usage (
  user_id uuid  not null,
  day     date  not null,               -- 한국 날짜
  discuss int   not null default 0,      -- 그날 글 답변 횟수
  primary key (user_id, day)
);
alter table public.cf_chat_usage enable row level security;

-- 2) 한도 확인 + 1 증가 (한 번에). 반환 예:
--    {"ok":true,"mode":"discuss","remaining":3}
--    {"ok":false,"mode":"discuss","reason":"daily_discuss"}
--    {"ok":false,"reason":"need_credit"}      ← discuss 외(앱 생성 등)는 크레딧
create or replace function public.cf_chat_quota(p_user uuid, p_mode text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_today   date := (now() at time zone 'Asia/Seoul')::date;
  v_discuss int;
  v_cap     int := 4;     -- 글 답변 하루 무료 횟수
begin
  -- 글 답변이 아니면 무료 없음 → 크레딧
  if p_mode <> 'discuss' then
    return jsonb_build_object('ok', false, 'reason', 'need_credit');
  end if;

  insert into public.cf_chat_usage (user_id, day, discuss)
  values (p_user, v_today, 0)
  on conflict (user_id, day) do nothing;

  select discuss into v_discuss from public.cf_chat_usage where user_id = p_user and day = v_today;

  if coalesce(v_discuss, 0) < v_cap then
    update public.cf_chat_usage set discuss = discuss + 1 where user_id = p_user and day = v_today;
    return jsonb_build_object('ok', true, 'mode', 'discuss', 'remaining', v_cap - coalesce(v_discuss, 0) - 1);
  else
    return jsonb_build_object('ok', false, 'mode', 'discuss', 'reason', 'daily_discuss');
  end if;
end
$$;
