-- coverfo Lens v3 (🎬 LifeMovie · 💼 WorkTok) — cf_lens 표의 mode 허용값 확장
-- Supabase → SQL Editor 에 붙여넣고 Run (한 번만). 이전 cf_lens.sql 을 이미 실행한 상태여야 합니다.
--
-- 이전 탭(document/work/shop)으로 저장된 행은 그대로 두고 새 탭(lifemovie/worktok)이 새 행을 씁니다.
-- (설명만 있던 이전 결과에는 드라마·리뷰가 없어 재사용하지 않습니다)
alter table public.cf_lens drop constraint if exists cf_lens_mode_check;
alter table public.cf_lens add constraint cf_lens_mode_check
  check (mode in ('document','work','shop','lifemovie','worktok'));
