/*
 * coverfo.com/terms → 홈의 문서 창(coverfo.com/#terms)으로 연결 (v206, 2026-10-10)
 * 예전에는 이 주소에 따로 쓴 페이지가 있어서 홈 문서와 내용이 어긋났습니다(LifeMovie 문구, 사업자 정보 없음 등).
 * 이제 내용은 홈 한 곳(app/landing-html.ts 의 DOCS.terms)에서만 관리합니다.
 */
import { redirect } from '@remix-run/cloudflare';

export const loader = () => redirect('/#terms');
