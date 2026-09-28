-- coverfo: 가입 무료 크레딧을 0으로 (신규 가입자에게 무료 크레딧을 주지 않음)
-- Supabase SQL Editor 에 붙여넣고 Run (1번). cf_grant_free_credits 함수가 이 값을 읽습니다.

-- cf_settings 의 free.signup 을 0 으로. 행이 없으면 만들어서 0 으로.
insert into public.cf_settings (key, value)
values ('free', jsonb_build_object('signup', 0))
on conflict (key) do update
  set value = jsonb_set(coalesce(public.cf_settings.value, '{}'::jsonb), '{signup}', '0'::jsonb);

-- 확인용: 지금 값 보기 (0 이 나와야 함)
-- select (value->>'signup')::int as signup from public.cf_settings where key = 'free';

-- (선택) 이미 무료 크레딧을 받은 기존 사용자의 무료 잔액까지 0 으로 지우려면 아래 주석을 풀고 함께 Run:
-- update public.cf_credits set free_balance = 0 where free_balance > 0;
