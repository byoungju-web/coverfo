// functions/studio.js — /studio 는 이제 사이드 메뉴가 있는 화면(app/routes/studio.tsx)이 맡습니다.
// 이 파일은 요청을 그대로 다음 처리기(Remix 앱)로 넘기기만 합니다. 화면 본체는 functions/studio-app.js 입니다.
export async function onRequest(context) {
  return context.next();
}
