// functions/view.js — coverfo.com/view?at=<타임스탬프>
// 저장된 결과(HTML)를 대화·사이드바 없이 "전체화면"으로 그대로 보여줍니다.
// cf_engine_history 표의 data.html 을 내보냅니다. (엔진 대화주소 engine-<at> 의 <at> 숫자를 씁니다)
// © 2026 coverfo All Rights Reserved
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const at = (url.searchParams.get('at') || '').replace(/[^0-9]/g, '');

  const shell = (title, body) =>
    new Response(
      '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1">' +
        '<title>' + title + '</title>' +
        '<style>html,body{margin:0;height:100%;background:#0b0b0f;color:#fff;' +
        'font-family:system-ui,-apple-system,"Malgun Gothic",sans-serif}' +
        '.c{height:100%;display:grid;place-items:center;text-align:center;padding:24px;line-height:1.6}' +
        'a{color:#8B5CF6;text-decoration:none}</style></head><body>' + body + '</body></html>',
      { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } },
    );

  if (!at) {
    return shell('coverfo', '<div class="c">주소가 올바르지 않습니다.<br><a href="/">홈으로</a></div>');
  }

  const sbUrl = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  const service = env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!sbUrl || !service) {
    return shell('coverfo', '<div class="c">서버 설정이 없습니다.</div>');
  }

  try {
    const r = await fetch(
      sbUrl + '/rest/v1/cf_engine_history?at=eq.' + encodeURIComponent(at) + '&select=data&limit=1',
      { headers: { apikey: service, Authorization: 'Bearer ' + service } },
    );
    const rows = r.ok ? await r.json() : [];
    const html = rows && rows[0] && rows[0].data ? rows[0].data.html : '';

    if (!html) {
      return shell('coverfo', '<div class="c">결과를 찾지 못했습니다.<br>(만료되었거나 삭제된 항목일 수 있습니다)<br><a href="/">홈으로</a></div>');
    }

    // 저장된 HTML 을 그대로 전체화면으로 내보냅니다 (대화·사이드바 없음)
    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
    });
  } catch (e) {
    return shell('coverfo', '<div class="c">불러오기 실패. 잠시 후 다시 시도해 주세요.<br><a href="/">홈으로</a></div>');
  }
}
