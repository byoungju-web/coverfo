-- coverfo 📸 누리트립 3단계 — v430 (🙋 질문방 · 예약 버튼 눌림 기록)
-- Supabase → SQL Editor 에 통째로 붙여넣고 Run 1회. 다시 돌려도 안전합니다.
--   · 1단계(cf_trip.sql) · 2단계(cf_trip_v2.sql)를 먼저 돌린 뒤에 돌립니다.
--   · 서버(service_role)만 읽고 씁니다 (RLS 켜고 정책 없음 = 브라우저에서 직접 못 건드림).
--   · 결제 · 크레딧 표는 건드리지 않습니다.

-- 1) 질문방: 질문도 글 표(cf_trip_posts)에 kind = 'ask' 로 넣는다 (답변 = 댓글, 신고·차단·지우기를 그대로 씀)
alter table public.cf_trip_posts drop constraint if exists cf_trip_posts_kind_check;
alter table public.cf_trip_posts add constraint cf_trip_posts_kind_check check (kind in ('photo', 'shorts', 'ask'));
create index if not exists cf_trip_posts_ask_idx on public.cf_trip_posts (kind, place_name, created_at desc);

-- 2) 작성자 보상용 기록: 글 아래 길안내·숙소·항공·렌터카 버튼이 눌린 수
--    누가 눌렀는지는 저장하지 않음: who = 로그인 사용자 id 또는 접속 주소를 날짜와 섞어 만든 해시(원래 값으로 못 되돌림)
--    같은 사람이 같은 글의 같은 버튼을 하루에 여러 번 눌러도 1번만 셈 · 글쓴이 본인이 누른 건 안 셈
create table if not exists public.cf_trip_clicks (
  post_id    bigint not null references public.cf_trip_posts(id) on delete cascade,
  kind       text not null check (kind in ('nav', 'stay', 'air', 'car')),
  who        text not null,
  day        date not null default (now() at time zone 'Asia/Seoul')::date,
  created_at timestamptz not null default now(),
  primary key (post_id, kind, who, day)
);
create index if not exists cf_trip_clicks_day_idx on public.cf_trip_clicks (day desc);

alter table public.cf_trip_clicks enable row level security;

-- 확인용:  select post_id, kind, count(*) from public.cf_trip_clicks where day >= current_date - 30 group by 1, 2 order by 3 desc limit 30;
