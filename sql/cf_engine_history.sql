-- coverfo 엔진 "최근 만든 것" 을 기기 간 같이 보이게 서버(Supabase)에 저장하는 표
-- Supabase → SQL Editor 에 붙여넣고 Run (한 번만)
create table if not exists public.cf_engine_history (
  user_id uuid not null,
  at bigint not null,                 -- 만든 시각 (밀리초, 엔진 화면의 entry.at 과 같음)
  data jsonb not null,                -- 엔진 화면이 저장하는 항목 그대로 (mode, prompt, title, ok, size, html, stages, chat)
  created_at timestamptz not null default now(),
  primary key (user_id, at)
);
create index if not exists cf_engine_history_user_at on public.cf_engine_history (user_id, at desc);

-- 서비스 키(서버)만 읽고 씁니다. 브라우저에서는 직접 못 읽게 RLS 켬 (정책 없음 = 서비스 키만 통과)
alter table public.cf_engine_history enable row level security;
