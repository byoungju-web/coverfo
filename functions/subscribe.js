// functions/subscribe.js — coverfo.com/subscribe  (v287)
// © 2026 coverfo All Rights Reserved
// 📅 크레딧 월 구독은 충전 화면(/pricing)의 '📅 매달 자동 충전' 탭으로 합쳤다. 옛 주소·토스 카드 등록 뒤 돌아오는 주소(/subscribe?done=1 · ?fail=…)는 그 탭으로 보낸다.
export async function onRequestGet(context) {
  const u = new URL(context.request.url);
  const q = new URLSearchParams();
  q.set('tab', 'sub');
  for (const k of ['done', 'credits', 'fail', 'plan']) {
    const v = u.searchParams.get(k);
    if (v) q.set(k, v.slice(0, 300));
  }
  return new Response(null, { status: 302, headers: { Location: '/pricing?' + q.toString() + '#charge', 'Cache-Control': 'no-store' } });
}
