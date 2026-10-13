// functions/api/music.js — Coverfo Relay: 🎵 AI 음악 (Google Lyria, Gemini API)
// © 2026 coverfo All Rights Reserved
//
// POST /api/music   (Authorization: Bearer 로그인토큰)
//   Body: { prompt, mode?: 'clip'|'song', vocal?: 'inst'|'auto'|'lyrics', lyrics? }
//     clip : 30초 (lyria-3-clip-preview) — 2 크레딧
//     song : 한 곡, 약 2분 (lyria-3.5)    — 4 크레딧
//     vocal: inst=연주곡 · auto=가사도 AI 가 · lyrics=내가 쓴 가사로
//   Response: { ok, url, data_url?, lyrics, mode, cost }
//
// 구글 호출은 스튜디오(gen.js)와 같이 Supabase Edge Function(google-proxy, 서울 리전)을 거칩니다.
//   Secret GOOGLE_PROXY=off 면 바로 부름.   모델 이름을 바꾸려면 Text 변수 MUSIC_CLIP_MODEL · MUSIC_SONG_MODEL
// 결과 파일은 R2(MEDIA) 에 저장 → /media/relay/music-....mp3 (없으면 data_url 로 돌려줌)
// 생성된 음악에는 구글 SynthID 워터마크가 들어갑니다.

const GHOST = 'https://generativelanguage.googleapis.com';

export async function onRequestPost(context) {
  const env = context.env || {};
  const gkey = env.GOOGLE_GENERATIVE_AI_API_KEY || '';
  if (!gkey) return json({ error: 'GOOGLE_GENERATIVE_AI_API_KEY 가 설정되지 않았습니다' }, 500);

  const uid = await userId(context.request, env);
  if (!uid) return json({ error: '로그인이 필요합니다' }, 401);

  let b = {};
  try { b = await context.request.json(); } catch { return json({ error: '잘못된 요청입니다' }, 400); }
  const prompt = clean(b.prompt, 600);
  if (!prompt) return json({ error: '어떤 음악인지 적어 주세요' }, 400);
  const mode = b.mode === 'song' ? 'song' : 'clip';
  const vocal = ['inst', 'auto', 'lyrics'].includes(b.vocal) ? b.vocal : 'inst';
  const lyrics = clean(b.lyrics, 1500);
  if (vocal === 'lyrics' && !lyrics) return json({ error: '가사를 넣어 주세요' }, 400);

  const cost = mode === 'song' ? 4 : 2;
  const model = mode === 'song' ? (env.MUSIC_SONG_MODEL || 'lyria-3.5') : (env.MUSIC_CLIP_MODEL || 'lyria-3-clip-preview');

  let input = prompt;
  if (vocal === 'inst') input += '\n\nInstrumental only, no vocals.';
  if (vocal === 'auto') input += '\n\nWith vocals. Write original lyrics in the same language as the description above.';
  if (vocal === 'lyrics') input += '\n\nWith vocals. Use exactly these original lyrics:\n' + lyrics;
  input += '\nDo not imitate any specific real artist.';

  let job;
  try { job = await spend(env, uid, cost, 'music:' + prompt.slice(0, 60)); }
  catch (e) { return json({ error: '크레딧 처리 실패: ' + String(e.message || e).slice(0, 200) }, 500); }
  if (job === false) return json({ error: '크레딧이 부족합니다', need: cost }, 402);

  try {
    const r = await gfetch(env, '/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input }),
    });
    const t = await r.text();
    let j = null;
    try { j = JSON.parse(t); } catch {}
    if (!r.ok || !j) {
      await refund(env, job);
      const msg = (j && j.error && (j.error.message || j.error.status)) || t.slice(0, 200);
      return json({ error: `음악 만들기 실패 (${r.status}): ${msg}`, refunded: true }, 502);
    }

    let audio = '', words = '';
    const steps = Array.isArray(j.steps) ? j.steps : [];
    for (const st of steps) {
      if (st && st.type && st.type !== 'model_output') continue;
      for (const c of (st && st.content) || []) {
        if (c && c.type === 'audio' && c.data && !audio) audio = c.data;
        if (c && c.type === 'text' && c.text) words += (words ? '\n' : '') + c.text;
      }
    }
    if (!audio && j.output_audio && j.output_audio.data) audio = j.output_audio.data;   /* 다른 모양 대비 */
    if (!audio) {
      await refund(env, job);
      return json({ error: '음악을 받지 못했습니다 (안전 필터에 걸렸을 수 있어요 — 실제 가수 이름·유명 노래 가사는 빼 주세요)', refunded: true }, 502);
    }
    await done(env, job);

    const bytes = b64ToBytes(audio);
    let url = '';
    if (env.MEDIA) {
      const name = `relay/music-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.mp3`;
      try { await env.MEDIA.put(name, bytes, { httpMetadata: { contentType: 'audio/mpeg' } }); url = '/media/' + name; } catch {}
    }
    return json({ ok: true, url, data_url: url ? '' : 'data:audio/mpeg;base64,' + audio, lyrics: words.slice(0, 4000), mode, cost });
  } catch (e) {
    await refund(env, job);
    return json({ error: `음악 오류: ${e.message}`, refunded: true }, 500);
  }
}

/* 스튜디오 gen.js 의 gfetch 와 같은 길 */
function gfetch(env, path, init) {
  const headers = Object.assign({ 'x-goog-api-key': env.GOOGLE_GENERATIVE_AI_API_KEY }, init.headers || {});
  let target = GHOST + path;
  const sbUrl = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const svc = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if ((env.GOOGLE_PROXY || 'on') !== 'off' && sbUrl && svc) {
    target = sbUrl + '/functions/v1/google-proxy' + path;
    headers.Authorization = 'Bearer ' + svc;
    headers.apikey = svc;
    headers['x-region'] = env.GOOGLE_PROXY_REGION || 'ap-northeast-2';
  }
  return fetch(target, Object.assign({}, init, { headers, redirect: 'follow' }));
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function clean(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, max); }

/* ── 공용 (gen.js · yt-top.js 와 같은 방식) ── */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function sb(env) {
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const svc = env.SUPABASE_SERVICE_ROLE_KEY || '';
  return url && svc ? { url, svc } : null;
}
async function userId(request, env) {
  const c = sb(env);
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!c || !token) return '';
  try {
    const r = await fetch(c.url + '/auth/v1/user', { headers: { apikey: c.svc, Authorization: 'Bearer ' + token } });
    if (!r.ok) return '';
    const u = await r.json();
    return u && u.id ? String(u.id) : '';
  } catch { return ''; }
}
async function rpc(c, name, args) {
  const r = await fetch(c.url + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: { apikey: c.svc, Authorization: 'Bearer ' + c.svc, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const t = await r.text();
  if (!r.ok) throw new Error('rpc ' + name + ' ' + r.status + ': ' + t.slice(0, 200));
  try { return JSON.parse(t); } catch { return t; }
}
async function spend(env, uid, cost, prompt) {
  const c = sb(env);
  if (!c) return null;
  let res;
  try { res = await rpc(c, 'cf_spend', { p_user: uid, p_cost: cost, p_kind: 'music', p_prompt: prompt }); }
  catch (e) { res = await rpc(c, 'cf_spend', { p_user: uid, p_cost: cost, p_kind: 'chat', p_prompt: prompt }); }
  if (!res || !res.ok) return false;
  return res.job_id != null ? res.job_id : null;
}
async function refund(env, job) {
  const c = sb(env);
  if (c && job != null) await rpc(c, 'cf_refund', { p_job: job }).catch(() => {});
}
async function done(env, job) {
  const c = sb(env);
  if (!c || job == null) return;
  await fetch(c.url + '/rest/v1/cf_jobs?id=eq.' + encodeURIComponent(job), {
    method: 'PATCH',
    headers: { apikey: c.svc, Authorization: 'Bearer ' + c.svc, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'done', updated_at: new Date().toISOString() }),
  }).catch(() => {});
}
