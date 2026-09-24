// functions/media/[[path]].js — coverfo.com/media/<사용자id>/<작업번호>.png|mp4
// R2 버킷(MEDIA 바인딩)에 저장된 결과 파일을 같은 도메인에서 내보냅니다. 버킷을 공개로 열지 않아도 됩니다.
export async function onRequestGet(context) {
  const { env, params, request } = context;
  if (!env.MEDIA) return new Response('R2 not bound', { status: 500 });
  const key = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '');
  if (!key || key.indexOf('..') >= 0) return new Response('bad path', { status: 400 });

  // 영상 재생용 Range 요청 지원 (구간 탐색·미리보기)
  const range = request.headers.get('Range');
  let obj;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m) {
      const head = await env.MEDIA.head(key);
      if (!head) return new Response('not found', { status: 404 });
      const size = head.size;
      let start = m[1] === '' ? Math.max(0, size - parseInt(m[2], 10)) : parseInt(m[1], 10);
      let end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(parseInt(m[2], 10), size - 1);
      if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
      obj = await env.MEDIA.get(key, { range: { offset: start, length: end - start + 1 } });
      if (!obj) return new Response('not found', { status: 404 });
      return new Response(obj.body, {
        status: 206,
        headers: baseHeaders(obj, { 'Content-Range': 'bytes ' + start + '-' + end + '/' + size, 'Content-Length': String(end - start + 1) }),
      });
    }
  }
  obj = await env.MEDIA.get(key);
  if (!obj) return new Response('not found', { status: 404 });
  return new Response(obj.body, { status: 200, headers: baseHeaders(obj, { 'Content-Length': String(obj.size) }) });
}

function baseHeaders(obj, extra) {
  const h = {
    'Content-Type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Access-Control-Allow-Origin': '*',
    ETag: obj.httpEtag || '',
  };
  return Object.assign(h, extra || {});
}
