// functions/api/gen.js — coverfo 이미지·영상 생성 (Cloudflare Pages Function)
// © 2026 coverfo All Rights Reserved
//
// 필요한 Secret (Cloudflare Pages → Settings → Variables and Secrets):
//   GOOGLE_GENERATIVE_AI_API_KEY   구글 AI Studio 키
//   SUPABASE_URL                   https://xxxx.supabase.co
//   SUPABASE_ANON_KEY              Supabase anon(public) 키
//   SUPABASE_SERVICE_ROLE_KEY      Supabase service_role 키 (절대 브라우저에 노출 금지)
// 선택 (Text 변수로 넣으면 코드 수정 없이 바꿀 수 있음):
//   IMAGE_MODEL  (기본 gemini-3.1-flash-image-preview)
//   VIDEO_MODEL  (기본 veo-3.1-fast-generate-preview)
//   COST_IMAGE   (기본 2)   COST_VIDEO (기본 25)
//
// 요청:
//   GET  /api/gen?config=1          → { url, anonKey }  (studio 화면이 로그인 세션을 읽으려고 씀)
//   GET  /api/gen?credits=1         → { free, paid }
//   GET  /api/gen?list=1            → 최근 작업 20개
//   POST /api/gen  {kind:'image'|'video', prompt, aspect}  → 작업 시작 (이미지는 바로 완료)
//   GET  /api/gen?job=ID            → 진행 확인 (영상은 완료되면 파일을 받아 저장)

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
    videoModel: env.VIDEO_MODEL || 'veo-3.1-fast-generate-preview',
    costImage: parseInt(env.COST_IMAGE || '2', 10),
    costVideo: parseInt(env.COST_VIDEO || '25', 10),
    // 구글 호출 중계: 기본 켜짐. Secret GOOGLE_PROXY=off 로 끌 수 있음
    proxy: (env.GOOGLE_PROXY || 'on') !== 'off',
    proxyRegion: env.GOOGLE_PROXY_REGION || 'ap-northeast-2',
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

async function getCredits(c, userId) {
  const r = await fetch(
    c.sbUrl + '/rest/v1/cf_credits?select=balance,free_balance&user_id=eq.' + encodeURIComponent(userId),
    { headers: sbHeaders(c) },
  );
  const rows = r.ok ? await r.json() : [];
  const row = rows && rows[0];
  return { free: row ? Number(row.free_balance || 0) : 0, paid: row ? Number(row.balance || 0) : 0 };
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
    c.sbUrl + '/rest/v1/cf_jobs?select=id,kind,prompt,cost,status,result_url,error,created_at&user_id=eq.' +
      encodeURIComponent(userId) + '&kind=in.(image,video)&order=created_at.desc&limit=20',
    { headers: sbHeaders(c) },
  );
  return r.ok ? await r.json() : [];
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

async function uploadToStorage(c, path, bytes, contentType) {
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

async function googleImage(c, prompt, aspect) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
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

async function googleVideoStart(c, prompt, aspect) {
  const body = {
    instances: [{ prompt: prompt }],
    parameters: { aspectRatio: aspect === '9:16' ? '9:16' : '16:9', resolution: '1080p', durationSeconds: 8 },
  };
  const r = await gfetch(c, '/models/' + c.videoModel + ':predictLongRunning', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.name) throw new Error('google video ' + r.status + ': ' + JSON.stringify(d).slice(0, 400));
  return d.name;
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
      throw new Error(filtered ? '안전 필터로 생성되지 않았습니다: ' + JSON.stringify(filtered).slice(0, 200) : '영상 결과가 없습니다');
    }
    const bytes = await googleDownload(c, uri);
    const path = job.user_id + '/' + job.id + '.mp4';
    const url = await uploadToStorage(c, path, bytes, 'video/mp4');
    await patchJob(c, job.id, { status: 'done', result_url: url, error: null });
    return { status: 'done', result_url: url };
  } catch (e) {
    await rpc(c, 'cf_refund', { p_job: job.id }).catch(() => {});
    await patchJob(c, job.id, { status: 'failed', error: String(e.message || e).slice(0, 500) });
    return { status: 'failed', error: String(e.message || e).slice(0, 500) };
  }
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
    return json(await getCredits(c, user.id));
  }
  if (url.searchParams.get('list')) {
    return json({ jobs: await listJobs(c, user.id) });
  }

  const jobId = url.searchParams.get('job');
  if (!jobId) return json({ error: 'job 없음' }, 400);

  const job = await getJob(c, jobId, user.id);
  if (!job) return json({ error: '작업을 찾을 수 없습니다' }, 404);

  if (job.status === 'done') return json({ status: 'done', result_url: job.result_url, kind: job.kind });
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

  // 1) 크레딧 차감 (부족하면 여기서 끝)
  let spend;
  try {
    spend = await rpc(c, 'cf_spend', { p_user: user.id, p_cost: cost, p_kind: kind, p_prompt: prompt });
  } catch (e) {
    return json({ error: '크레딧 처리 실패: ' + String(e.message || e).slice(0, 200) }, 500);
  }
  if (!spend || !spend.ok) {
    return json({ error: 'insufficient', reason: spend && spend.reason, free: spend && spend.free, paid: spend && spend.paid, need: cost, paid_only: !!(spend && spend.paid_only) }, 402);
  }
  const jobId = spend.job_id;

  // 2) 구글 호출
  try {
    if (kind === 'image') {
      const img = await googleImage(c, prompt, aspect);
      const ext = img.mime.indexOf('jpeg') >= 0 ? 'jpg' : img.mime.indexOf('webp') >= 0 ? 'webp' : 'png';
      const path = user.id + '/' + jobId + '.' + ext;
      const resultUrl = await uploadToStorage(c, path, b64ToBytes(img.b64), img.mime);
      await patchJob(c, jobId, { status: 'done', result_url: resultUrl });
      return json({ job_id: jobId, status: 'done', kind: 'image', result_url: resultUrl, free: spend.free, paid: spend.paid });
    }
    const opName = await googleVideoStart(c, prompt, aspect);
    await patchJob(c, jobId, { op_name: opName, task_id: opName });
    return json({ job_id: jobId, status: 'running', kind: 'video', free: spend.free, paid: spend.paid });
  } catch (e) {
    // 실패 → 환불
    await rpc(c, 'cf_refund', { p_job: jobId }).catch(() => {});
    await patchJob(c, jobId, { status: 'failed', error: String(e.message || e).slice(0, 500) });
    return json({ error: String(e.message || e).slice(0, 500), refunded: true }, 500);
  }
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

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
