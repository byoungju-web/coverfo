-- coverfo 📸 누리트립 (여행 사진·쇼츠 커뮤니티) 1단계 — v427
-- Supabase → SQL Editor 에 통째로 붙여넣고 Run 1회. 다시 돌려도 안전합니다.
--   · 사진·영상 파일은 R2(coverfo-media, /media/trip/…)에 있고, 여기에는 글 · 댓글 · 저장 · 좋아요 · 신고 · 차단만 둡니다.
--   · 서버(service_role)만 읽고 씁니다 (RLS 켜고 정책 없음 = 브라우저에서 직접 못 건드림).
--   · 결제 · 크레딧 표는 건드리지 않습니다.

-- 글쓴이 정보: 닉네임 + 만 14세 이상 확인 (생년월일은 저장하지 않음)
create table if not exists public.cf_trip_profile (
  user_id    uuid primary key,
  nick       text not null,
  age_ok     boolean not null default false,   -- false = 만 14세 미만 → 글쓰기·댓글 막힘
  created_at timestamptz not null default now()
);
create unique index if not exists cf_trip_profile_nick_idx on public.cf_trip_profile (lower(nick));

-- 글
create table if not exists public.cf_trip_posts (
  id         bigserial primary key,
  user_id    uuid not null,
  nick       text not null,
  kind       text not null check (kind in ('photo', 'shorts')),
  media      jsonb not null default '[]'::jsonb,   -- [{u:'/media/trip/…', w, h}] · 쇼츠는 [{u, thumb, dur}]
  body       text not null default '',
  place_name text not null,
  place_addr text not null default '',
  lat        double precision,
  lng        double precision,
  visited    date,
  tags       text[] not null default '{}',
  status     text not null default 'live' check (status in ('live', 'hidden', 'removed')),
  likes      int not null default 0,
  saves      int not null default 0,
  comments   int not null default 0,
  reports    int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists cf_trip_posts_live_idx on public.cf_trip_posts (status, created_at desc);
create index if not exists cf_trip_posts_user_idx on public.cf_trip_posts (user_id, created_at desc);

-- 댓글 (답글 1단: parent_id)
create table if not exists public.cf_trip_comments (
  id         bigserial primary key,
  post_id    bigint not null references public.cf_trip_posts(id) on delete cascade,
  user_id    uuid not null,
  nick       text not null,
  body       text not null,
  parent_id  bigint,
  status     text not null default 'live' check (status in ('live', 'hidden', 'removed')),
  reports    int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists cf_trip_comments_post_idx on public.cf_trip_comments (post_id, created_at);

-- 좋아요 · 저장
create table if not exists public.cf_trip_likes (
  post_id    bigint not null references public.cf_trip_posts(id) on delete cascade,
  user_id    uuid not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table if not exists public.cf_trip_saves (
  post_id    bigint not null references public.cf_trip_posts(id) on delete cascade,
  user_id    uuid not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists cf_trip_saves_user_idx on public.cf_trip_saves (user_id, created_at desc);

-- 신고 (한 사람이 같은 글·댓글은 한 번만)
create table if not exists public.cf_trip_reports (
  id          bigserial primary key,
  target_type text not null check (target_type in ('post', 'comment')),
  target_id   bigint not null,
  post_id     bigint not null,
  user_id     uuid not null,
  reason      text not null default '',
  done        boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (target_type, target_id, user_id)
);

-- 차단 (차단한 사람의 글·댓글이 안 보임)
create table if not exists public.cf_trip_blocks (
  user_id    uuid not null,
  blocked    uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked)
);

alter table public.cf_trip_profile  enable row level security;
alter table public.cf_trip_posts    enable row level security;
alter table public.cf_trip_comments enable row level security;
alter table public.cf_trip_likes    enable row level security;
alter table public.cf_trip_saves    enable row level security;
alter table public.cf_trip_reports  enable row level security;
alter table public.cf_trip_blocks   enable row level security;

-- 확인용:  select id, nick, kind, place_name, status, likes, saves, comments, reports, created_at from public.cf_trip_posts order by id desc limit 20;
