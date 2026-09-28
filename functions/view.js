// functions/view.js — coverfo.com/view?chat=engine-<번호>  (또는 ?at=<번호>)
// 저장된 결과(HTML)를 대화·사이드바 없이 "전체화면"으로 보여줍니다.
// cf_engine_history 에서 그 결과를 찾아 data.html 을 그대로 내보냅니다.
//  - 서버에 아직 없으면(동기화 전) 검은 화면 대신 채팅 화면(/chat/…)으로 자동 이동합니다.
// © 2026 coverfo All Rights Reserved
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const chat = (url.searchParams.get('chat') || '').replace(/[^a-zA-Z0-9_-]/g, '');
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
      { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
    );

  // 못 찾을 때 돌아갈 곳: chat 주소가 있으면 그 채팅 화면으로 (검은 화면 방지)
  const fallback = () => {
    if (chat) {
      return Response.redirect(new URL('/chat/' + chat, request.url).toString(), 302);
    }

    return shell('coverfo', '<div class="c">결과를 찾지 못했습니다.<br><a href="/">홈으로</a></div>');
  };

  if (!chat && !at) {
    return shell('coverfo', '<div class="c">주소가 올바르지 않습니다.<br><a href="/">홈으로</a></div>');
  }

  const sbUrl = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  const service = env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!sbUrl || !service) {
    return fallback();
  }

  try {
    const q = chat
      ? 'data->>chat=eq.' + encodeURIComponent(chat)
      : 'at=eq.' + encodeURIComponent(at);
    const r = await fetch(sbUrl + '/rest/v1/cf_engine_history?' + q + '&select=data&order=at.desc&limit=1', {
      headers: { apikey: service, Authorization: 'Bearer ' + service },
    });
    const rows = r.ok ? await r.json() : [];
    const html = rows && rows[0] && rows[0].data ? rows[0].data.html : '';

    if (!html) {
      return fallback();
    }

    // 저장된 HTML 을 그대로 전체화면으로 (대화·사이드바 없음)
    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
    });
  } catch (e) {
    return fallback();
  }
}
