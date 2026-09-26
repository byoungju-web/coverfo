/*
 * coverfo: 입력 문장으로 갈 곳 정하기 (홈 화면의 엔진 버튼과 같은 규칙)
 *  - 이미지·사진·그림 → 스튜디오(이미지)   - 영상·동영상·비디오 → 스튜디오(영상)
 *  - 3d·삼디·입체·glb → 엔진(3D 에셋)        - 앱·웹·사이트·페이지·게임… → 엔진(앱, 7단계)
 *  - 아무 낱말도 없으면 null (채팅 화면에서는 평소처럼 AI 에게 보냄)
 */
const APP = /앱|웹|사이트|페이지|게임|랜딩|홈페이지|쇼핑몰|app|web|site|game/i;
const D3 = /3d|삼디|입체|glb|3D모델/i;
const IMG = /이미지|사진|그림|일러스트|포스터|로고|image|photo/i;
const VID = /영상|동영상|비디오|video/i;

export function cfRouteByCommand(text: string): string | null {
  const t = (text || '').trim();

  if (!t) {
    return null;
  }

  const q = 'prompt=' + encodeURIComponent(t) + '&auto=1';

  if (APP.test(t)) {
    return '/engine?mode=app&' + q;
  }

  if (D3.test(t)) {
    return '/engine?mode=3d&' + q;
  }

  if (VID.test(t)) {
    return '/studio?kind=video&' + q;
  }

  if (IMG.test(t)) {
    return '/studio?kind=image&' + q;
  }

  return null;
}
