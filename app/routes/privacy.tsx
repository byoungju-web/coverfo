export default function Privacy() {
  const CONTACT = "hasin7jk@gmail.com";
  const DATE = "2026년 10월 1일";
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
        table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
        th,td{border:1px solid var(--line);padding:9px 12px;text-align:left;vertical-align:top}
        th{background:rgba(76,29,149,.06);font-weight:600}
        .cf-foot{margin-top:48px;padding-top:20px;border-top:1px solid var(--line);font-size:13px;color:var(--sub)}
        .cf-foot a{color:var(--head)}
      `}</style>
      <header className="cf-hd">
        <a href="/">coverfo</a>
        <span>/ 개인정보 처리방침</span>
      </header>
      <div className="cf-wrap">
        <h1>개인정보 처리방침</h1>
        <p className="cf-date">시행일: {DATE}</p>
        <p>coverfo(이하 "회사")는 coverfo.com 이용자의 개인정보를 개인정보 보호법에 따라 다음과 같이 처리합니다.</p>

        <h2>1. 수집하는 정보와 목적</h2>
        <table>
          <thead>
            <tr><th>정보</th><th>목적</th><th>수집 시점</th></tr>
          </thead>
          <tbody>
            <tr><td>이메일, 이름, 프로필 사진<br />(구글 로그인에서 받음)</td><td>계정 식별, 로그인, 크레딧 관리</td><td>로그인 시</td></tr>
            <tr><td>입력한 글·음성 인식 결과·올린 사진</td><td>요청한 결과물 생성</td><td>기능 사용 시</td></tr>
            <tr><td>크레딧 사용 기록<br />(어떤 기능을 언제 썼는지)</td><td>차감·환불, 부정 사용 방지</td><td>기능 사용 시</td></tr>
            <tr><td>결제 정보<br />(주문번호·결제수단 종류·금액)</td><td>충전, 환불, 세무 처리</td><td>충전 시<br />(카드번호는 결제대행사만 보관)</td></tr>
            <tr><td>접속 기록<br />(IP, 브라우저 종류, 시간대)</td><td>보안, 장애 대응,<br />화면 언어·나라 자동 선택</td><td>접속 시</td></tr>
          </tbody>
        </table>
        <p>음성 인식은 폰(브라우저)에 내장된 기능으로 처리되며, 회사는 음성 파일을 받지 않습니다.</p>

        <h2>2. 보관 기간</h2>
        <ul>
          <li>계정 정보: 탈퇴 시 즉시 삭제</li>
          <li>입력한 글·결과물: 이용자가 지우거나 탈퇴할 때까지</li>
          <li>올린 사진: 분석에만 쓰고 원본은 서버에 저장하지 않습니다. 사진의 요약값(해시)과 분석 결과를 보관하며, 만든 포스터·영상 파일은 이용자가 삭제 요청 시까지 보관합니다.</li>
          <li>결제 기록: 전자상거래법에 따라 5년</li>
          <li>접속 기록: 통신비밀보호법에 따라 3개월</li>
        </ul>

        <h2>3. 처리 위탁과 국외 이전</h2>
        <p>서비스를 운영하기 위해 아래 사업자에게 처리를 맡기며, 이들 중 일부는 해외에 있습니다.</p>
        <table>
          <thead>
            <tr><th>사업자</th><th>맡기는 일</th><th>위치</th></tr>
          </thead>
          <tbody>
            <tr><td>Supabase</td><td>로그인·계정·크레딧 데이터베이스</td><td>해외(클라우드)</td></tr>
            <tr><td>Cloudflare</td><td>웹 호스팅, 결과물 파일 저장</td><td>해외(전 세계 분산)</td></tr>
            <tr><td>Anthropic, OpenAI, Google</td><td>인공지능 모델로 글·이미지·영상 생성 및 사진 분석<br />(학습에 쓰이지 않도록 API로 호출)</td><td>미국 등</td></tr>
            <tr><td>Brave Software</td><td>상품·외주·최신 정보 검색 (검색어만 전달)</td><td>미국</td></tr>
            <tr><td>결제대행사(토스페이먼츠)</td><td>카드·계좌이체·간편결제 처리</td><td>대한민국</td></tr>
          </tbody>
        </table>
        <p>번역 기능(화면 언어)은 번역할 화면 문구만 구글 번역 서비스에 전달하며, 이용자 정보는 보내지 않습니다.</p>

        <h2>4. 제3자 제공</h2>
        <p>회사는 법령에 따른 요청이 있는 경우를 제외하고 개인정보를 제3자에게 제공하지 않습니다. 포도톡(podotalk.kr)은 홈 화면 안에서 열리지만 별도 서비스이며, 포도톡 로그인 정보는 포도톡이 자체 처리방침에 따라 관리합니다.</p>

        <h2>5. 이용자의 권리</h2>
        <ul>
          <li>이용자는 언제든 자신의 정보를 열람·정정·삭제하거나 처리 정지를 요구할 수 있습니다. 사이드바 → 설정 → 계정 탈퇴에서 직접 계정을 삭제할 수 있고, 그 밖의 요청은 {CONTACT} 으로 보내 주세요.</li>
          <li>LifeMovie·WorkTok에 올린 사진의 분석 결과 삭제를 원하면 같은 주소로 요청해 주세요.</li>
        </ul>

        <h2>6. 쿠키와 브라우저 저장소</h2>
        <p>로그인 상태, 화면 언어, 빠른 실행 나라 설정, 번역 결과 등은 이용자 기기의 브라우저 저장소에만 저장되며, 브라우저 설정에서 지울 수 있습니다. 광고 추적 쿠키는 쓰지 않습니다.</p>

        <h2>7. 안전조치</h2>
        <p>모든 통신은 HTTPS로 암호화됩니다. 인공지능·검색 서비스의 접속 키는 서버에만 보관하고 브라우저로 내려보내지 않습니다. 접근 권한은 운영자에게만 있습니다.</p>

        <h2>8. 아동</h2>
        <p>만 14세 미만 아동의 개인정보는 수집하지 않습니다. 아동이 가입한 사실을 알게 되면 즉시 삭제합니다.</p>

        <h2>9. 개인정보 보호책임자</h2>
        <p>coverfo 운영자 · <a href={`mailto:${CONTACT}`}>{CONTACT}</a></p>

        <h2>10. 변경</h2>
        <p>이 방침이 바뀌면 시행 7일 전부터 서비스 안에 알립니다.</p>

        <div className="cf-foot">
          문의: <a href={`mailto:${CONTACT}`}>{CONTACT}</a><br />
          © 2026 coverfo All Rights Reserved
        </div>
      </div>
    </>
  );
}
