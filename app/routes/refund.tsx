/*
 * coverfo 환불 정책 페이지 — coverfo.com/refund (로그인 없이 누구나 볼 수 있음, 2026-10-10)
 * 내용은 실제 환불 서버(app/routes/api.account-delete.ts)의 규칙과 같습니다.
 *   FEE_PCT 10 · FULL_DAYS 7 · MAX_DAYS 365 · MIN_WON 1000 — 그 값을 바꾸면 이 페이지도 같이 고쳐야 합니다.
 */
export const meta = () => [
  { title: '환불 정책 — coverfo' },
  { name: 'description', content: 'coverfo 크레딧 환불 정책: 대상, 금액 계산, 수수료, 신청 방법' },
];

export default function Refund() {
  const CONTACT = 'hasin7jk@gmail.com';
  const DATE = '2026년 10월 10일';
  return (
    <>
      <style>{`
        :root{--bg:#fff;--fg:#111;--sub:#555;--line:#e0e0e0;--head:#4C1D95}
        @media(prefers-color-scheme:dark){:root{--bg:#0f0f0f;--fg:#eee;--sub:#888;--line:#2a2a2a;--head:#a78bfa}}
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Malgun Gothic','맑은 고딕',sans-serif;font-size:15px;line-height:1.85;padding:0 0 80px}
        .cf-hd{display:flex;align-items:center;gap:12px;padding:18px 24px;border-bottom:1px solid var(--line)}
        .cf-hd a{color:var(--head);text-decoration:none;font-weight:600;font-size:17px}
        .cf-hd span{color:var(--sub);font-size:13px}
        .cf-wrap{max-width:720px;margin:0 auto;padding:40px 24px}
        h1{font-size:26px;font-weight:700;margin-bottom:6px}
        .cf-date{color:var(--sub);font-size:13px;margin-bottom:36px}
        h2{font-size:15px;font-weight:700;color:var(--head);margin:36px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--line)}
        p{margin:8px 0}
        ul{padding-left:18px;margin:8px 0}
        li{margin:5px 0}
        .cf-foot{margin-top:48px;padding-top:20px;border-top:1px solid var(--line);font-size:13px;color:var(--sub)}
        .cf-foot a{color:var(--head)}
      `}</style>
      <header className="cf-hd">
        <a href="/">coverfo</a>
        <span>/ 환불 정책</span>
      </header>
      <div className="cf-wrap">
        <h1>환불 정책</h1>
        <p className="cf-date">시행일: {DATE} (5. 크레딧 월 구독 항목 추가: 2026년 10월 30일)</p>

        <h2>1. 환불 대상</h2>
        <ul>
          <li>결제로 충전한 크레딧(충전 크레딧)의 남은 잔액만 환불합니다. 1크레딧은 99원입니다.</li>
          <li>무료 크레딧과, 결제 기록이 없는 크레딧(이벤트·관리자 지급분 등)은 환불 대상이 아닙니다.</li>
          <li>이미 사용한 크레딧은 환불하지 않습니다. 단, 생성이 실패한 경우 그 크레딧은 자동으로 복구됩니다.</li>
        </ul>

        <h2>2. 환불 금액</h2>
        <ul>
          <li>남은 충전 크레딧을 가장 최근 결제부터 차례로 맞추어, 각 결제의 크레딧당 결제 단가로 금액을 계산합니다.</li>
          <li><b>전액 환불:</b> 결제일로부터 7일 이내이고, 그 결제로 충전한 크레딧을 전혀 사용하지 않은 경우</li>
          <li><b>수수료 10% 공제:</b> 그 외의 경우에는 환불 금액의 10%를 수수료로 공제하고 환불합니다.</li>
          <li>결제일로부터 1년이 지난 결제 건은 환불할 수 없습니다(결제 취소 가능 기간).</li>
          <li>환불 금액 합계가 1,000원 미만이면 환불하지 않습니다.</li>
        </ul>

        <h2>3. 신청 방법</h2>
        <ul>
          <li>coverfo.com 에 로그인한 뒤 <b>사이드바 → 설정 → 크레딧 환불</b>에서 본인이 직접 신청합니다. 신청 화면에서 환불 가능 금액을 미리 확인할 수 있습니다.</li>
          <li>계정 탈퇴 시 <b>환불받고 탈퇴</b>를 고르면 남은 충전 크레딧을 먼저 환불한 뒤 계정을 삭제합니다.</li>
          <li>직접 신청이 어려우면 아래 문의 메일로 요청해 주세요.</li>
        </ul>

        <h2>4. 환불 방법과 기간</h2>
        <ul>
          <li>결제했던 수단으로 돌려드립니다(카드는 승인 취소·부분 취소). 결제수단에 따라 영업일 기준 3~7일이 걸릴 수 있습니다.</li>
          <li>가상계좌·계좌이체로 결제한 경우에는 환불받을 계좌(은행·계좌번호·예금주)를 입력받아 그 계좌로 돌려드립니다.</li>
          <li>환불된 만큼의 크레딧은 즉시 차감됩니다.</li>
        </ul>

        <h2>5. 크레딧 월 구독(정기결제)</h2>
        <ul>
          <li><b>상품:</b> 매달 정해진 크레딧을 충전하는 월 구독입니다 — 베이직 월 9,900원(100크레딧) · 스탠다드 월 29,000원(300크레딧) · 플러스 월 49,000원(550크레딧). 신청: <a href="/subscribe">coverfo.com/subscribe</a></li>
          <li><b>제공 기간:</b> 결제일부터 1개월이며, 해지하기 전까지 매월 같은 날 자동으로 결제됩니다(1개월 단위 자동 갱신). 결제할 때마다 그 달 크레딧이 충전 크레딧으로 바로 충전됩니다.</li>
          <li><b>해지:</b> 언제든 구독 화면에서 직접 해지할 수 있습니다. 해지하면 다음 결제일부터 결제하지 않으며, 이미 충전된 크레딧은 그대로 사용할 수 있습니다.</li>
          <li><b>환불:</b> 구독 결제로 충전된 크레딧도 위 1~4의 환불 규칙(7일 이내 미사용 전액, 그 외 10% 공제)과 같은 방법으로 환불합니다. 구독 결제를 환불하면 구독도 함께 해지됩니다.</li>
          <li><b>결제 실패:</b> 자동 결제가 실패하면 다음 날 다시 시도하며, 3번 연달아 실패하면 구독이 멈추고 더 이상 결제하지 않습니다.</li>
        </ul>

        <h2>6. 기타</h2>
        <ul>
          <li>결제는 결제대행사를 통해 처리되며, 환불도 같은 결제대행사를 통해 처리됩니다.</li>
          <li>이 정책은 coverfo 이용약관(<a href="/terms">/terms</a>)의 일부입니다. 정책을 바꿀 때는 시행 7일 전부터 서비스 안에 알립니다.</li>
        </ul>

        <div className="cf-foot">
          문의: <a href={`mailto:${CONTACT}`}>{CONTACT}</a><br />
          © 2026 coverfo All Rights Reserved
        </div>
      </div>
    </>
  );
}
