-- coverfo 릴레이 "📂 내가 만든 것" — 폰 · PC 어디서 열어도 같은 목록이 보이게 (계정별 저장)
-- Supabase SQL Editor 에 붙여넣고 Run 1회. 다시 돌려도 안전합니다.
--   · 파일(목소리 · 음악 · 짤 그림)은 R2 / 스튜디오 저장소에 그대로 있고, 여기에는 주소와 제목 · 문구만 남깁니다.
--   · 서버(service_role)만 읽고 씁니다 (RLS 켜고 정책 없음).
create table if not exists public.cf_relay_made (
  user_id     uuid   not null,
  id          text   not null,          -- 화면에서 만든 고유값 (m + 시각 + 난수)
  at          bigint not null,          -- 만든 시각 (밀리초)
  data        jsonb  not null default '{}'::jsonb,
  primary key (user_id, id)
);
create index if not exists cf_relay_made_user_idx on public.cf_relay_made(user_id, at desc);
alter table public.cf_relay_made enable row level security;

-- 확인용:  select user_id, id, at, data->>'t' as kind, data->>'title' as title from public.cf_relay_made order by at desc limit 20;
