/* coverfo 지금 있는 나라 (GET /api/where) — v317
   · Cloudflare 가 접속마다 알려주는 나라 코드(request.cf.country, 예: "TH")만 돌려준다.
   · 위치(GPS)·IP 주소는 돌려주지도, 저장·기록하지도 않는다.
   · 화면(cf-ui-lang.js)은 폰 시간대로 나라를 못 맞출 때만 이 값을 쓴다 (해외 로밍은 한국으로 잡힐 수 있어 시간대가 먼저). */
export async function onRequestGet({ request }) {
  const c = String((request.cf && request.cf.country) || '').toUpperCase();
  return new Response(JSON.stringify({ country: /^[A-Z]{2}$/.test(c) && c !== 'XX' && c !== 'T1' ? c : '' }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
