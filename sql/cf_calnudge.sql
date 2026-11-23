-- coverfo 📅 일정 먼저 알림 (v459) — Supabase → SQL Editor → New query 에 통째로 붙여 넣고 Run (1번만)
-- cf_memory.sql(v366 먼저 챙기기)을 먼저 실행했어야 합니다. 기존 표·칸·함수는 건드리지 않고 칸 2개만 더합니다.
--   cal_at   : 이 사람의 구글 캘린더를 다음에 확인할 시각 (10분마다 · 캘린더를 연결하지 않았으면 6시간 뒤)
--   cal_sent : 이미 알린 일정 (같은 일정은 두 번 알리지 않음 · 최근 40개)

alter table public.cf_memory_set add column if not exists cal_at timestamptz;
alter table public.cf_memory_set add column if not exists cal_sent jsonb not null default '[]'::jsonb;
create index if not exists cf_memory_set_cal on public.cf_memory_set (cal_at) where nudge;

-- 확인: 오류 없이 숫자가 나오면 성공
select count(*) from public.cf_memory_set where nudge;
