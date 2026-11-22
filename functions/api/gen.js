// functions/api/gen.js — coverfo 이미지·영상 생성 (Cloudflare Pages Function)
// © 2026 coverfo All Rights Reserved
//
// 필요한 Secret (Cloudflare Pages → Settings → Variables and Secrets):
//   GOOGLE_GENERATIVE_AI_API_KEY   구글 AI Studio 키
//   SUPABASE_URL                   https://xxxx.supabase.co
//   SUPABASE_ANON_KEY              Supabase anon(public) 키
//   SUPABASE_SERVICE_ROLE_KEY      Supabase service_role 키 (절대 브라우저에 노출 금지)
// 저장소: wrangler.toml 에 [[r2_buckets]] binding="MEDIA" 가 있으면 결과 파일을 R2 에 저장하고 /media/... 로 서비스.
//        없으면 Supabase Storage(cf-media 버킷)에 저장.
// 선택 (Text 변수로 넣으면 코드 수정 없이 바꿀 수 있음):
//   IMAGE_MODEL  (기본 gemini-3.1-flash-image-preview)
//   VIDEO_MODEL  (기본 gemini-omni-1.1-flash — 구글이 2026-10-22 Veo 3.1 Preview 를 종료하고 안내한 대체 모델, Interactions API)
//   COST_IMAGE   (기본 2)   COST_VIDEO (기본 25)
//
// 요청:
//   GET  /api/gen?config=1          → { url, anonKey }  (studio 화면이 로그인 세션을 읽으려고 씀)
//   GET  /api/gen?credits=1         → { free, paid, pool(운영자만) }   운영자 이메일: Secret ADMIN_EMAILS (쉼표 구분, 기본 hasin7jk@gmail.com)
//   GET  /api/gen?list=1            → 최근 작업 20개
//   POST /api/gen  {kind:'image'|'video', prompt, aspect, source_job?, extend_job?, seconds?}  → 작업 시작 (이미지는 바로 완료)
//        source_job: 목록의 이미지 작업 번호. 이미지면 그 이미지를 고쳐서 새로 만들고, 영상이면 첫 장면으로 씀
//        extend_job: 목록의 영상 작업 번호. 그 영상 뒤에 이어 붙인 새 영상을 만듦 (v445 Omni 로 만든 영상만 가능, 영상 1건 크레딧)
//        seconds: 영상 길이 10·20·30·40. 20 이상이면 첫 영상을 만든 뒤 서버가 자동으로 약 10초씩 이어 붙여 영상 1개로 줌 (조각마다 영상 1건 크레딧, 실패한 조각은 환불)
//   GET  /api/gen?job=ID            → 진행 확인 (영상은 완료되면 파일을 받아 저장)
//   DELETE /api/gen?job=ID         → 최근 만든 것에서 삭제 (파일 삭제)

const GBASE = 'https://generativelanguage.googleapis.com/v1beta';
const BUCKET = 'cf-media';

function json(data, status, extra) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, extra || {}),
  });
}

function cfg(env) {
  return {
    gkey: env.GOOGLE_GENERATIVE_AI_API_KEY || '',
    sbUrl: (env.SUPABASE_URL || '').replace(/\/+$/, ''),
    anon: env.SUPABASE_ANON_KEY || '',
    service: env.SUPABASE_SERVICE_ROLE_KEY || '',
    imageModel: env.IMAGE_MODEL || 'gemini-3.1-flash-image-preview',
    videoModel: env.VIDEO_MODEL || 'gemini-omni-1.1-flash',
    costImage: parseInt(env.COST_IMAGE || '2', 10),
    costVideo: parseInt(env.COST_VIDEO || '25', 10),
    // 구글 호출 중계: 기본 켜짐. Secret GOOGLE_PROXY=off 로 끌 수 있음
    proxy: (env.GOOGLE_PROXY || 'on') !== 'off',
    proxyRegion: env.GOOGLE_PROXY_REGION || 'ap-northeast-2',
    media: env.MEDIA || null, // R2 바인딩 (wrangler.toml [[r2_buckets]] binding = "MEDIA")
    admins: String(env.ADMIN_EMAILS || 'hasin7jk@gmail.com').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean),
  };
}

function missing(c) {
  const m = [];
  if (!c.gkey) m.push('GOOGLE_GENERATIVE_AI_API_KEY');
  if (!c.sbUrl) m.push('SUPABASE_URL');
  if (!c.anon) m.push('SUPABASE_ANON_KEY');
  if (!c.service) m.push('SUPABASE_SERVICE_ROLE_KEY');
  return m;
}

/* ── Supabase (service_role) ─────────────────────────── */
function sbHeaders(c, extra) {
  return Object.assign(
    { apikey: c.service, Authorization: 'Bearer ' + c.service, 'Content-Type': 'application/json' },
    extra || {},
  );
}

async function getUser(c, request) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const r = await fetch(c.sbUrl + '/auth/v1/user', {
    headers: { apikey: c.service, Authorization: 'Bearer ' + token },
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

async function rpc(c, name, args) {
  const r = await fetch(c.sbUrl + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: sbHeaders(c),
    body: JSON.stringify(args || {}),
  });
  const t = await r.text();
  let d = null;
  try { d = JSON.parse(t); } catch (e) { d = t; }
  if (!r.ok) throw new Error('supabase rpc ' + name + ' ' + r.status + ': ' + t.slice(0, 300));
  return d;
}

// 운영자 여부: 전체 무료 한도(이달 남음 n/500)는 운영자에게만 보여줍니다 (일반 가입자가 자기 한도로 착각하지 않도록)
function isAdmin(c, user) {
  const email = String((user && user.email) || '').toLowerCase();
  return !!email && c.admins.indexOf(email) >= 0;
}

async function getCredits(c, userId, showPool) {
  const r = await fetch(
    c.sbUrl + '/rest/v1/cf_credits?select=balance,free_balance&user_id=eq.' + encodeURIComponent(userId),
    { headers: sbHeaders(c) },
  );
  const rows = r.ok ? await r.json() : [];
  const row = rows && rows[0];
  let pool = null;
  if (showPool) {
    try { pool = await rpc(c, 'cf_free_pool_status', {}); } catch (e) { pool = null; } // 이달 무료 풀 (운영자만)
  }
  return { free: row ? Number(row.free_balance || 0) : 0, paid: row ? Number(row.balance || 0) : 0, pool: pool };
}

async function getJob(c, jobId, userId) {
  const r = await fetch(
    c.sbUrl + '/rest/v1/cf_jobs?select=*&id=eq.' + encodeURIComponent(jobId) + '&user_id=eq.' + encodeURIComponent(userId),
    { headers: sbHeaders(c) },
  );
  const rows = r.ok ? await r.json() : [];
  return rows && rows[0] ? rows[0] : null;
}

async function listJobs(c, userId) {
  const r = await fetch(
    c.sbUrl + '/rest/v1/cf_jobs?select=id,kind,prompt,cost,status,result_url,error,created_at,meta&user_id=eq.' +
      encodeURIComponent(userId) + '&kind=in.(image,video)&status=neq.deleted&meta->>chain_hidden=is.null&order=created_at.desc&limit=40',
    { headers: sbHeaders(c) },
  );
  return r.ok ? await r.json() : [];
}

async function deleteFromStorage(c, path) {
  const r = await fetch(c.sbUrl + '/storage/v1/object/' + BUCKET + '/' + path, {
    method: 'DELETE',
    headers: sbHeaders(c),
  });
  return r.ok;
}

// filter: 예) 'status=eq.running' — 조건이 맞는 행만 바꾸고, 바뀐 행을 돌려줌
async function patchJob(c, jobId, patch, filter) {
  const url = c.sbUrl + '/rest/v1/cf_jobs?id=eq.' + encodeURIComponent(jobId) + (filter ? '&' + filter : '');
  const r = await fetch(url, {
    method: 'PATCH',
    headers: sbHeaders(c, { Prefer: 'return=representation' }),
    body: JSON.stringify(Object.assign({ updated_at: new Date().toISOString() }, patch)),
  });
  const rows = r.ok ? await r.json() : [];
  return rows && rows[0] ? rows[0] : null;
}

// 결과 파일 저장. R2 바인딩(MEDIA)이 있으면 R2 에 넣고 /media/<경로> 주소를 돌려준다(같은 도메인).
// 바인딩이 없으면 예전처럼 Supabase Storage 에 넣는다 → wrangler.toml 에 바인딩을 넣기 전에도 동작.
async function uploadToStorage(c, path, bytes, contentType) {
  if (c.media) {
    await c.media.put(path, bytes, { httpMetadata: { contentType: contentType } });
    return '/media/' + path;
  }
  const r = await fetch(c.sbUrl + '/storage/v1/object/' + BUCKET + '/' + path, {
    method: 'POST',
    headers: {
      apikey: c.service,
      Authorization: 'Bearer ' + c.service,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: bytes,
  });
  if (!r.ok) throw new Error('storage upload ' + r.status + ': ' + (await r.text()).slice(0, 300));
  return c.sbUrl + '/storage/v1/object/public/' + BUCKET + '/' + path;
}

function bytesToB64(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}

// 목록에 있는 이미지 작업을 원본으로 불러온다 (본인 것 + 완료된 이미지만)
async function loadSourceImage(c, userId, srcJobId) {
  const job = await getJob(c, srcJobId, userId);
  if (!job || job.kind !== 'image' || job.status !== 'done' || !job.result_url) throw new Error('원본 이미지를 찾을 수 없습니다');
  let mime = job.result_url.indexOf('.jpg') >= 0 ? 'image/jpeg' : job.result_url.indexOf('.webp') >= 0 ? 'image/webp' : 'image/png';
  let bytes;
  if (job.result_url.indexOf('/media/') === 0) {
    if (!c.media) throw new Error('R2 저장소 연결(MEDIA 바인딩)이 없습니다');
    const obj = await c.media.get(job.result_url.slice('/media/'.length));
    if (!obj) throw new Error('원본 이미지 파일이 없습니다');
    if (obj.httpMetadata && obj.httpMetadata.contentType) mime = obj.httpMetadata.contentType;
    bytes = new Uint8Array(await obj.arrayBuffer());
  } else {
    const r = await fetch(job.result_url);
    if (!r.ok) throw new Error('원본 이미지를 읽지 못했습니다 (' + r.status + ')');
    mime = r.headers.get('content-type') || mime;
    bytes = new Uint8Array(await r.arrayBuffer());
  }
  return { mime: mime.split(';')[0], b64: bytesToB64(bytes), job_id: job.id };
}

// 목록에 있는 영상 작업을 연장 원본으로 불러온다 (본인 것 + 완료된 영상만).
// v445 Omni: 구글에 남아 있는 그 영상의 대화 번호(meta.iid)로 이어 붙인다 → 예전 Veo 영상은 연장 불가
async function loadSourceVideo(c, userId, jobId) {
  const job = await getJob(c, jobId, userId);
  if (!job || job.kind !== 'video' || job.status !== 'done' || !job.result_url) throw new Error('연장할 영상을 찾을 수 없습니다');
  const meta = job.meta || {};
  if (!meta.iid) throw new Error('이 영상은 예전 방식(Veo)으로 만들어져 연장할 수 없습니다. 새로 만든 영상부터 연장됩니다.');
  return { job_id: job.id, iid: meta.iid, seconds: parseInt(meta.seconds || '10', 10) || 10, aspect: meta.aspect || '16:9' };
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ── Google ──────────────────────────────────────────── */
// 구글 API 호출. proxy 가 켜져 있으면 Supabase Edge Function(google-proxy, 서울 리전)을 거친다.
// Cloudflare 함수가 홍콩 노드에서 돌면 구글이 "User location is not supported" 로 막기 때문.
function gfetch(c, urlOrPath, init) {
  init = init || {};
  const headers = Object.assign({ 'x-goog-api-key': c.gkey }, init.headers || {});
  let target = urlOrPath.indexOf('http') === 0 ? urlOrPath : GBASE + urlOrPath;
  if (c.proxy && target.indexOf('https://generativelanguage.googleapis.com') === 0) {
    target = c.sbUrl + '/functions/v1/google-proxy' + target.slice('https://generativelanguage.googleapis.com'.length);
    headers['Authorization'] = 'Bearer ' + c.service;
    headers['apikey'] = c.service;
    headers['x-region'] = c.proxyRegion;
  }
  return fetch(target, Object.assign({}, init, { headers: headers, redirect: 'follow' }));
}

async function googleImage(c, prompt, aspect, srcImage) {
  const inParts = [];
  if (srcImage) inParts.push({ inlineData: { mimeType: srcImage.mime, data: srcImage.b64 } });
  inParts.push({ text: prompt });
  const body = {
    contents: [{ parts: inParts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: aspect || '1:1', imageSize: '2K' },
    },
  };
  const r = await gfetch(c, '/models/' + c.imageModel + ':generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('google image ' + r.status + ': ' + JSON.stringify(d).slice(0, 400));
  const parts = (((d.candidates || [])[0] || {}).content || {}).parts || [];
  const img = parts.find((p) => p.inlineData && p.inlineData.data);
  if (!img) {
    const reason = ((d.candidates || [])[0] || {}).finishReason || (d.promptFeedback && d.promptFeedback.blockReason) || 'no_image';
    throw new Error('이미지가 만들어지지 않았습니다 (' + reason + ')');
  }
  return { mime: img.inlineData.mimeType || 'image/png', b64: img.inlineData.data };
}

/* ── 영상: Gemini Omni Flash (Interactions API) ──
   구글 공식 문서(ai.google.dev/gemini-api/docs/omni) 기준:
   POST /v1beta/interactions {model, input, response_format:{type:'video', aspect_ratio, resolution}}
   background:true 로 시작하면 번호(id)를 바로 받고, GET /v1beta/interactions/{id} 로 완료(completed)를 확인한다.
   연장: previous_interaction_id 로 이전 영상 뒤에 이어 붙임 (문서: 10초씩, 합계 최대 40초) */
async function omniStart(c, body) {
  const send = (b) => gfetch(c, '/interactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  let r = await send(Object.assign({ background: true }, body));
  let d = await r.json().catch(() => ({}));
  // 혹시 이 모델이 background 를 안 받으면 → 한 번 더, 기다렸다 받는 방식으로 (결과는 같은 번호로 다시 조회)
  if (r.status === 400 && /background/i.test(JSON.stringify(d))) {
    r = await send(body);
    d = await r.json().catch(() => ({}));
  }
  if (!r.ok || !d.id) throw new Error('google video ' + r.status + ': ' + JSON.stringify(d).slice(0, 400));
  return 'interactions/' + d.id;
}

async function googleVideoStart(c, prompt, aspect, srcImage) {
  const input = srcImage
    ? [{ type: 'image', data: srcImage.b64, mime_type: srcImage.mime }, { type: 'text', text: prompt }]
    : prompt;
  return omniStart(c, {
    model: c.videoModel,
    input: input,
    response_format: { type: 'video', aspect_ratio: aspect === '9:16' ? '9:16' : '16:9', resolution: '720p' },
  });
}

// 영상 뒤에 이어 붙이기: 구글에 저장된 이전 영상 대화(iid)를 이어서 요청
async function googleVideoExtend(c, prompt, srcVideo) {
  return omniStart(c, {
    model: c.videoModel,
    previous_interaction_id: srcVideo.iid,
    input: 'Extend this video: continue the same scene seamlessly from the last frame, same subject, same style. ' + prompt,
    response_format: { type: 'video', aspect_ratio: srcVideo.aspect === '9:16' ? '9:16' : '16:9', resolution: '720p' },
    // v446: task:'extend' 는 넣지 않음 — 구글: "previous_interaction_id is not allowed when video task is set."
  });
}

// 응답 어디에 있든 영상 조각({type:'video', data|uri})을 찾는다 (steps[].content[] / output_video 등)
function findVideo(o, depth) {
  if (!o || typeof o !== 'object' || (depth || 0) > 8) return null;
  const isVid = o.type === 'video' || /^video\//.test(String(o.mime_type || o.mimeType || ''));
  if (isVid && (o.data || o.uri)) return o;
  for (const k in o) {
    const f = findVideo(o[k], (depth || 0) + 1);
    if (f) return f;
  }
  return null;
}
function findText(o, out, depth) {
  out = out || [];
  if (!o || typeof o !== 'object' || (depth || 0) > 8) return out;
  if (o.type === 'text' && typeof o.text === 'string') out.push(o.text);
  for (const k in o) findText(o[k], out, (depth || 0) + 1);
  return out;
}

// mp4 의 실제 길이(초) — 'mvhd' 상자의 timescale/duration
function mp4Seconds(bytes) {
  for (let i = 4; i < Math.min(bytes.length - 32, 4 * 1024 * 1024); i++) {
    if (bytes[i] === 0x6d && bytes[i + 1] === 0x76 && bytes[i + 2] === 0x68 && bytes[i + 3] === 0x64) {
      const v = bytes[i + 4];
      const u32 = (p) => ((bytes[p] << 24) >>> 0) + (bytes[p + 1] << 16) + (bytes[p + 2] << 8) + bytes[p + 3];
      if (v === 1) {
        const ts = u32(i + 24);
        const dur = u32(i + 28) * 4294967296 + u32(i + 32);
        return ts ? dur / ts : 0;
      }
      const ts = u32(i + 16);
      return ts ? u32(i + 20) / ts : 0;
    }
  }
  return 0;
}

async function googleVideoStatus(c, opName) {
  const r = await gfetch(c, '/' + opName, { method: 'GET' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('google op ' + r.status + ': ' + JSON.stringify(d).slice(0, 400));
  return d;
}

async function googleDownload(c, uri) {
  const r = await gfetch(c, uri, { method: 'GET' });
  if (!r.ok) throw new Error('google download ' + r.status);
  return new Uint8Array(await r.arrayBuffer());
}

/* ── 영상 마무리: 구글에서 받아 저장소에 올리고 job 완료 처리 ── */
async function finalizeVideo(c, job) {
  if (String(job.op_name).indexOf('interactions/') === 0) return finalizeOmni(c, job);
  const op = await googleVideoStatus(c, job.op_name);
  if (!op.done) return { status: 'running' };

  // 다른 요청이 동시에 마무리하지 않도록 running → finalizing 을 먼저 잡는다
  const locked = await patchJob(c, job.id, { status: 'finalizing' }, 'status=eq.running');
  if (!locked) return { status: 'running' };

  try {
    if (op.error) throw new Error(op.error.message || JSON.stringify(op.error).slice(0, 300));
    const resp = op.response || {};
    const samples = (resp.generateVideoResponse && resp.generateVideoResponse.generatedSamples) || [];
    const uri = samples[0] && samples[0].video && samples[0].video.uri;
    if (!uri) {
      const filtered = resp.generateVideoResponse && resp.generateVideoResponse.raiMediaFilteredReasons;
      if (filtered) {
        const txt = JSON.stringify(filtered);
        const hint = /real people|likeness|celebrity/i.test(txt)
          ? '구글 안전 필터: 실제 인물(유명인 등)의 이름이나 얼굴로 보이는 영상은 만들 수 없습니다. 인물 이름을 빼고 묘사만 쓰거나, 얼굴이 화면을 꽉 채우지 않는 이미지로 다시 시도해 보세요.'
          : '구글 안전 필터로 생성되지 않았습니다. 문구를 조금 바꿔서 다시 시도해 보세요.';
        throw new Error(hint + ' (' + txt.slice(0, 160) + ')');
      }
      throw new Error('영상 결과가 없습니다');
    }
    const bytes = await googleDownload(c, uri);
    const path = job.user_id + '/' + job.id + '.mp4';
    const url = await uploadToStorage(c, path, bytes, 'video/mp4');
    await patchJob(c, job.id, { status: 'done', result_url: url, error: null });
    return { status: 'done', result_url: url, seconds: (job.meta && job.meta.seconds) || 8 };
  } catch (e) {
    await rpc(c, 'cf_refund', { p_job: job.id }).catch(() => {});
    await patchJob(c, job.id, { status: 'failed', error: String(e.message || e).slice(0, 500) });
    return { status: 'failed', error: String(e.message || e).slice(0, 500) };
  }
}

/* ── v445 Omni 영상 마무리: 구글 대화(interaction)가 끝났으면 영상을 받아 저장 ── */
async function finalizeOmni(c, job) {
  const iid = String(job.op_name).slice('interactions/'.length);
  const r = await gfetch(c, '/interactions/' + encodeURIComponent(iid), { method: 'GET' });
  const d = await r.json().catch(() => ({}));
  // 429·5xx 는 잠시 후 다시 확인, 그 밖의 오류는 실패 처리(환불)
  if (!r.ok && (r.status === 429 || r.status >= 500)) throw new Error('google interaction ' + r.status);
  const st = String(d.status || '');
  if (r.ok && (st === 'in_progress' || st === 'requires_action' || st === 'queued')) return { status: 'running' };

  const locked = await patchJob(c, job.id, { status: 'finalizing' }, 'status=eq.running');
  if (!locked) return { status: 'running' };

  const meta = job.meta || {};
  try {
    if (!r.ok) throw new Error('google interaction ' + r.status + ': ' + JSON.stringify(d).slice(0, 300));
    if (st === 'failed' || st === 'cancelled') throw new Error('구글 영상 생성 실패: ' + JSON.stringify(d.error || d.status).slice(0, 300));
    const outs = Array.isArray(d.steps) ? d.steps.filter((x) => x && x.type === 'model_output') : [];
    const v = findVideo(outs.length ? outs : d);
    if (!v) {
      const said = findText(outs.length ? outs : d).join(' ').slice(0, 200);
      throw new Error('영상이 만들어지지 않았습니다 (구글 안전 필터일 수 있어요 — 문구를 바꿔 다시 시도해 보세요)' + (said ? ' · ' + said : ''));
    }
    let bytes;
    if (v.data) bytes = b64ToBytes(v.data);
    else {
      let u = String(v.uri);
      if (u.indexOf(':download') < 0 && /\/files\/[^/:?]+$/.test(u)) u += ':download';
      if (u.indexOf('alt=media') < 0) u += (u.indexOf('?') >= 0 ? '&' : '?') + 'alt=media';
      bytes = await googleDownload(c, u);
    }
    const secs = Math.round(mp4Seconds(bytes) * 10) / 10;
    // 연장 결과가 '앞 영상 + 뒷부분' 한 파일이 아니면(뒷부분만 오면) 실패로 보고 환불 — 앞 영상을 결과로 줌
    if (meta.extend_of && meta.prev_seconds && secs && secs < meta.prev_seconds + 2) {
      throw new Error('구글이 앞 영상과 합친 파일이 아니라 뒷부분(' + secs + '초)만 돌려줬습니다. 이 조각 크레딧은 환불했습니다.');
    }
    const path = job.user_id + '/' + job.id + '.mp4';
    const url = await uploadToStorage(c, path, bytes, 'video/mp4');
    const newMeta = Object.assign({}, meta, { iid: iid, seconds: secs || meta.seconds || 10 });
    await patchJob(c, job.id, { status: 'done', result_url: url, error: null, meta: newMeta });
    if (meta.chain && meta.extend_of) await dropChainPiece(c, job.user_id, meta.extend_of);
    const done = Object.assign({}, job, { meta: newMeta, result_url: url });
    if (meta.chain && (meta.piece || 1) < (meta.chain.steps || 1)) {
      const next = await chainNext(c, done);
      if (next.next_job) return { status: 'running', next_job: next.next_job, seconds: newMeta.seconds, target: meta.chain.target };
      return { status: 'done', result_url: url, seconds: newMeta.seconds, target: meta.chain.target, stopped: next.reason, error: next.error };
    }
    return { status: 'done', result_url: url, seconds: newMeta.seconds };
  } catch (e) {
    const msg = String(e.message || e).slice(0, 500);
    await rpc(c, 'cf_refund', { p_job: job.id }).catch(() => {});
    await patchJob(c, job.id, { status: 'failed', error: msg });
    if (meta.chain && meta.extend_of) {
      const prev = await getJob(c, meta.extend_of, job.user_id).catch(() => null);
      if (prev && prev.status === 'done' && prev.result_url) {
        const pm = Object.assign({}, prev.meta || {});
        delete pm.chain_hidden; delete pm.chain_next;
        await patchJob(c, prev.id, { meta: pm });
        return { status: 'done', result_url: prev.result_url, seconds: pm.seconds || 10, target: meta.chain.target, stopped: 'failed', error: msg.slice(0, 300) };
      }
    }
    return { status: 'failed', error: msg };
  }
}

/* ── 자동 연장 (명령 한 번 → 15·22·29초 영상 1개) ──
   첫 영상을 만들고, 끝날 때마다 구글 공식 '연장'으로 이어 붙인다 (v445 Omni: 조각당 약 10초).
   크레딧은 조각을 시작할 때마다 영상 1건(costVideo)씩 차감 — 실패한 조각은 환불, 부족하면 거기까지 만든 영상으로 끝. */
async function chainNext(c, job) {
  const meta = job.meta || {};
  const chain = meta.chain || {};
  const prompt = String(chain.prompt || job.prompt || '').slice(0, 1500);
  let spend;
  try {
    spend = await rpc(c, 'cf_spend', { p_user: job.user_id, p_cost: c.costVideo, p_kind: 'video', p_prompt: '[연장 #' + job.id + '] ' + prompt });
  } catch (e) {
    return { reason: 'spend_error' };
  }
  if (!spend || !spend.ok) return { reason: 'insufficient' };
  const nextId = spend.job_id;
  try {
    const opName = await googleVideoExtend(c, prompt, { iid: meta.iid, aspect: meta.aspect || '16:9' });
    await patchJob(c, nextId, { op_name: opName, task_id: opName, meta: { extend_of: job.id, res: '720p', piece: (meta.piece || 1) + 1, prev_seconds: meta.seconds || 0, aspect: meta.aspect || '16:9', chain: chain } });
    // 앞 조각은 목록에서 숨김 (다음 조각이 끝나면 지움 · 실패하면 다시 보임)
    await patchJob(c, job.id, { meta: Object.assign({}, meta, { chain_hidden: true, chain_next: nextId }) });
    return { next_job: nextId };
  } catch (e) {
    await rpc(c, 'cf_refund', { p_job: nextId }).catch(() => {});
    await patchJob(c, nextId, { status: 'failed', error: String(e.message || e).slice(0, 500), meta: { chain_hidden: true } });
    return { reason: 'failed', error: String(e.message || e).slice(0, 300) };
  }
}

// 다음 조각에 이미 들어간 앞 조각: 파일을 지우고 deleted 로 (크레딧 기록은 그대로)
async function dropChainPiece(c, userId, jobId) {
  const prev = await getJob(c, jobId, userId).catch(() => null);
  if (!prev || !(prev.meta && prev.meta.chain_hidden)) return;
  if (prev.result_url) {
    if (prev.result_url.indexOf('/media/') === 0 && c.media) {
      await c.media.delete(prev.result_url.slice('/media/'.length)).catch(() => false);
    } else {
      const marker = '/storage/v1/object/public/' + BUCKET + '/';
      const i = prev.result_url.indexOf(marker);
      if (i >= 0) await deleteFromStorage(c, prev.result_url.slice(i + marker.length)).catch(() => false);
    }
  }
  await patchJob(c, prev.id, { status: 'deleted', result_url: null });
}

/* ── GET ─────────────────────────────────────────────── */
async function handleGet(context) {
  const { request, env } = context;
  const c = cfg(env);
  const url = new URL(request.url);

  if (url.searchParams.get('config')) {
    if (!c.sbUrl || !c.anon) return json({ error: 'SUPABASE_URL / SUPABASE_ANON_KEY 가 등록되지 않았습니다' }, 500);
    return json({ url: c.sbUrl, anonKey: c.anon, costImage: c.costImage, costVideo: c.costVideo });
  }

  const miss = missing(c);
  if (miss.length) return json({ error: 'Secret 미등록: ' + miss.join(', ') }, 500);

  const user = await getUser(c, request);
  if (!user) return json({ error: 'login' }, 401);

  if (url.searchParams.get('credits')) {
    return json(await getCredits(c, user.id, isAdmin(c, user)));
  }
  if (url.searchParams.get('list')) {
    return json({ jobs: await listJobs(c, user.id) });
  }

  const jobId = url.searchParams.get('job');
  if (!jobId) return json({ error: 'job 없음' }, 400);

  const job = await getJob(c, jobId, user.id);
  if (!job) return json({ error: '작업을 찾을 수 없습니다' }, 404);

  // 자동 연장 중 앞 조각을 다시 물어보면 → 지금 만드는 다음 조각을 알려 준다
  if (job.meta && job.meta.chain_next && (job.status === 'done' || job.status === 'deleted')) {
    return json({ status: 'running', kind: job.kind, next_job: job.meta.chain_next, seconds: job.meta.seconds || 8, target: job.meta.chain && job.meta.chain.target });
  }
  if (job.status === 'done') return json({ status: 'done', result_url: job.result_url, kind: job.kind, seconds: job.meta && job.meta.seconds });
  if (job.status === 'failed' || job.status === 'refunded') return json({ status: 'failed', error: job.error || '', kind: job.kind });
  if (job.status === 'finalizing') return json({ status: 'running', kind: job.kind });

  if (job.kind === 'video' && job.op_name) {
    try {
      const r = await finalizeVideo(c, job);
      return json(Object.assign({ kind: 'video' }, r));
    } catch (e) {
      return json({ status: 'running', kind: 'video', note: String(e.message || e).slice(0, 200) });
    }
  }
  return json({ status: job.status, kind: job.kind });
}

/* ── POST ────────────────────────────────────────────── */
async function handlePost(context) {
  const { request, env } = context;
  const c = cfg(env);
  const miss = missing(c);
  if (miss.length) return json({ error: 'Secret 미등록: ' + miss.join(', ') }, 500);

  const user = await getUser(c, request);
  if (!user) return json({ error: 'login' }, 401);

  let body = {};
  try { body = await request.json(); } catch (e) { body = {}; }
  const kind = body.kind === 'video' ? 'video' : body.kind === 'image' ? 'image' : null;
  const prompt = String(body.prompt || '').trim().slice(0, 1500);
  const aspect = ['1:1', '16:9', '9:16', '4:3', '3:4'].indexOf(body.aspect) >= 0 ? body.aspect : kind === 'video' ? '16:9' : '1:1';
  if (!kind) return json({ error: 'kind 는 image 또는 video' }, 400);
  if (!prompt) return json({ error: '무엇을 만들지 적어 주세요' }, 400);

  const cost = kind === 'video' ? c.costVideo : c.costImage;
  const srcJobId = body.source_job ? String(body.source_job) : '';
  const extJobId = kind === 'video' && body.extend_job ? String(body.extend_job) : '';
  // 영상 길이: 약 10 · 20 · 30 · 40초 (약 10초 + 자동 연장 약 10초씩). 수동 '이어서 연장'에는 쓰지 않음
  // v445 Omni: 한 조각 약 10초 → 10·20·30·40초 = 1~4조각 (구글 문서: 연장 합계 최대 40초)
  const target = kind === 'video' && !extJobId && [20, 30, 40].indexOf(parseInt(body.seconds, 10)) >= 0 ? parseInt(body.seconds, 10) : 10;
  const steps = Math.round(target / 10);

  // 0-1) 영상 연장이면 원본 영상을 먼저 불러온다 — 실패하면 크레딧을 건드리지 않음
  let srcVideo = null;
  if (extJobId) {
    try {
      srcVideo = await loadSourceVideo(c, user.id, extJobId);
    } catch (e) {
      return json({ error: String(e.message || e).slice(0, 300) }, 400);
    }
  }

  // 0) 원본 이미지(수정하기 / 이미지→영상)가 있으면 먼저 불러온다 — 실패하면 크레딧을 건드리지 않음
  let srcImage = null;
  if (srcJobId && !srcVideo) {
    try {
      srcImage = await loadSourceImage(c, user.id, srcJobId);
    } catch (e) {
      return json({ error: String(e.message || e).slice(0, 300) }, 400);
    }
  }

  // 0-2) 릴레이 "AI 아바타 영상": 폰에서 올린 사진(data:image/...;base64)을 영상 첫 장면으로 — 목록에 없는 사진이라 직접 받음
  if (!srcImage && !srcVideo && kind === 'video' && typeof body.image === 'string' && body.image) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(body.image);
    if (!m) return json({ error: '사진 형식이 맞지 않습니다 (JPG · PNG)' }, 400);
    if (m[2].length > 6 * 1024 * 1024) return json({ error: '사진이 너무 큽니다' }, 400);
    srcImage = { mime: m[1], b64: m[2], job_id: null };
  }

  // 1) 크레딧 차감 (부족하면 여기서 끝)
  let spend;
  try {
    spend = await rpc(c, 'cf_spend', { p_user: user.id, p_cost: cost, p_kind: kind, p_prompt: (srcVideo ? '[연장 #' + srcVideo.job_id + '] ' : srcImage && srcImage.job_id ? '[수정 #' + srcImage.job_id + '] ' : srcImage ? '[사진] ' : '') + prompt });
  } catch (e) {
    return json({ error: '크레딧 처리 실패: ' + String(e.message || e).slice(0, 200) }, 500);
  }
  if (!spend || !spend.ok) {
    return json({ error: 'insufficient', reason: spend && spend.reason, free: spend && spend.free, paid: spend && spend.paid, need: cost, paid_only: !!(spend && spend.paid_only), pool: isAdmin(c, user) ? spend && spend.pool : null }, 402);
  }
  const jobId = spend.job_id;

  // 2) 구글 호출
  try {
    if (kind === 'image') {
      if (srcImage) await patchJob(c, jobId, { meta: { source_job: srcImage.job_id } });
      const img = await googleImage(c, prompt, aspect, srcImage);
      const ext = img.mime.indexOf('jpeg') >= 0 ? 'jpg' : img.mime.indexOf('webp') >= 0 ? 'webp' : 'png';
      const path = user.id + '/' + jobId + '.' + ext;
      const resultUrl = await uploadToStorage(c, path, b64ToBytes(img.b64), img.mime);
      await patchJob(c, jobId, { status: 'done', result_url: resultUrl });
      return json({ job_id: jobId, status: 'done', kind: 'image', result_url: resultUrl, free: spend.free, paid: spend.paid });
    }
    if (srcVideo) {
      const opName2 = await googleVideoExtend(c, prompt, srcVideo);
      await patchJob(c, jobId, { op_name: opName2, task_id: opName2, meta: { extend_of: srcVideo.job_id, res: '720p', prev_seconds: srcVideo.seconds, aspect: srcVideo.aspect } });
      return json({ job_id: jobId, status: 'running', kind: 'video', free: spend.free, paid: spend.paid });
    }
    const opName = await googleVideoStart(c, prompt, aspect, srcImage);
    // meta.res/seconds/aspect: 나중에 "7초 연장" 이 가능한지(720p) 와 길이 표시에 씀
    await patchJob(c, jobId, Object.assign({ op_name: opName, task_id: opName, meta: Object.assign({ res: '720p', piece: 1, aspect: aspect === '9:16' ? '9:16' : '16:9' }, srcImage && srcImage.job_id ? { source_job: srcImage.job_id } : {}, steps > 1 ? { chain: { target: target, steps: steps, prompt: prompt } } : {}) }));
    return json({ job_id: jobId, status: 'running', kind: 'video', seconds: 0, target: target, free: spend.free, paid: spend.paid });
  } catch (e) {
    // 실패 → 환불
    await rpc(c, 'cf_refund', { p_job: jobId }).catch(() => {});
    await patchJob(c, jobId, { status: 'failed', error: String(e.message || e).slice(0, 500) });
    return json({ error: String(e.message || e).slice(0, 500), refunded: true }, 500);
  }
}

/* ── DELETE: 최근 만든 것에서 삭제 (파일 삭제 + 상태 deleted, 크레딧 기록은 유지) ── */
async function handleDelete(context) {
  const { request, env } = context;
  const c = cfg(env);
  const miss = missing(c);
  if (miss.length) return json({ error: 'Secret 미등록: ' + miss.join(', ') }, 500);
  const user = await getUser(c, request);
  if (!user) return json({ error: 'login' }, 401);
  const url = new URL(request.url);
  const jobId = url.searchParams.get('job');
  if (!jobId) return json({ error: 'job 없음' }, 400);
  const job = await getJob(c, jobId, user.id);
  if (!job) return json({ error: '작업을 찾을 수 없습니다' }, 404);
  if (job.status === 'running' || job.status === 'finalizing') return json({ error: '아직 만드는 중이라 삭제할 수 없습니다' }, 409);
  if (job.result_url) {
    if (job.result_url.indexOf('/media/') === 0 && c.media) {
      await c.media.delete(job.result_url.slice('/media/'.length)).catch(() => false);
    } else {
      const marker = '/storage/v1/object/public/' + BUCKET + '/';
      const i = job.result_url.indexOf(marker);
      if (i >= 0) await deleteFromStorage(c, job.result_url.slice(i + marker.length)).catch(() => false);
    }
  }
  await patchJob(c, job.id, { status: 'deleted', result_url: null });
  return json({ ok: true, job_id: job.id });
}

function safe(fn) {
  return async function (context) {
    try {
      return await fn(context);
    } catch (e) {
      return json({ error: 'server: ' + String((e && e.message) || e).slice(0, 400), where: 'uncaught' }, 500);
    }
  };
}
export const onRequestGet = safe(handleGet);
export const onRequestPost = safe(handlePost);
export const onRequestDelete = safe(handleDelete);

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
