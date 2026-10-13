// functions/api/voice.js — Coverfo Relay: 🎙️ AI 목소리 (말투를 입힌 성우 목소리)
// © 2026 coverfo All Rights Reserved
//
// POST /api/voice   (Authorization: Bearer 로그인토큰)
//   Body: { text, voice?, style?, custom? }
//     voice : alloy · ash · ballad · coral · echo · fable · nova · onyx · sage · shimmer · verse
//     style : dj · ad · news · story · docu · shorts · calm   (아래 STYLES)
//     custom: 직접 적은 말투 (style 대신, 200자까지)
//   Response: audio/mpeg   (헤더 X-Relay-Url: R2 에 저장된 주소 /media/relay/...)
//   크레딧: 2 (실패 시 환불)
//
// OpenAI gpt-4o-mini-tts 의 instructions 로 말투를 입힙니다. 그 모델이 안 되면 tts-1-hd 로 (말투 없이) 한 번 더.

const COST = 2;
const VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'];
const OLD_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];   // tts-1-hd 가 아는 목소리
const STYLES = {
  dj: 'Warm, friendly late-night radio DJ. Relaxed pace, smiling tone, intimate and cozy.',
  ad: 'Energetic TV commercial announcer. Upbeat, punchy, confident, clear emphasis on key words.',
  news: 'Professional news anchor. Calm, authoritative, neutral, even pace, crisp pronunciation.',
  story: 'Gentle storyteller reading a picture book to children. Soft, expressive, slow, playful character voices.',
  docu: 'Deep cinematic documentary narrator. Measured, dramatic pauses, rich and serious.',
  shorts: 'Very lively short-form video creator. Fast, excited, playful, big reactions.',
  calm: 'Calm, soothing guide. Slow, warm, reassuring, like a meditation app.',
};

export async function onRequestPost(context) {
  const env = context.env || {};
  if (!env.OPENAI_API_KEY) return json({ error: 'OPENAI_API_KEY 가 설정되지 않았습니다' }, 500);

  const uid = await userId(context.request, env);
  if (!uid) return json({ error: '로그인이 필요합니다' }, 401);

  let b = {};
  try { b = await context.request.json(); } catch { return json({ error: '잘못된 요청입니다' }, 400); }
  const text = String(b.text || '').trim();
  if (!text) return json({ error: '읽을 글을 넣어 주세요' }, 400);
  if (text.length > 2000) return json({ error: '글이 너무 깁니다 (최대 2000자)' }, 400);

  const voice = VOICES.includes(b.voice) ? b.voice : 'coral';
  const custom = String(b.custom || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200);
  const style = custom || STYLES[b.style] || STYLES.dj;
  const instructions = style + ' Speak naturally in the language of the text (Korean text in natural Korean).';

  let job;
  try { job = await spend(env, uid, COST, 'voice:' + text.slice(0, 60)); }
  catch (e) { return json({ error: '크레딧 처리 실패: ' + String(e.message || e).slice(0, 200) }, 500); }
  if (job === false) return json({ error: '크레딧이 부족합니다', need: COST }, 402);

  try {
    let r = await speech(env, { model: 'gpt-4o-mini-tts', input: text, voice, instructions, response_format: 'mp3' });
    if (!r.ok) {
      /* 새 모델이 막히면 예전 모델로 (말투는 빠짐) */
      r = await speech(env, { model: 'tts-1-hd', input: text, voice: OLD_VOICES.includes(voice) ? voice : 'nova', response_format: 'mp3' });
    }
    if (!r.ok) {
      await refund(env, job);
      const e = await r.text().catch(() => '');
      return json({ error: `목소리 만들기 실패 (${r.status}): ${e.slice(0, 200)}`, refunded: true }, 502);
    }
    const audio = await r.arrayBuffer();
    await done(env, job);

    let url = '';
    if (env.MEDIA) {
      const name = `relay/voice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.mp3`;
      try { await env.MEDIA.put(name, audio, { httpMetadata: { contentType: 'audio/mpeg' } }); url = '/media/' + name; } catch {}
    }
    return new Response(audio, {
      headers: { 'Content-Type': 'audio/mpeg', 'X-Relay-Url': url, 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    await refund(env, job);
    return json({ error: `목소리 오류: ${e.message}`, refunded: true }, 500);
  }
}

function speech(env, body) {
  return fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

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
/* 반환: job_id · false(크레딧 부족) */
async function spend(env, uid, cost, prompt) {
  const c = sb(env);
  if (!c) return null;
  let res;
  try { res = await rpc(c, 'cf_spend', { p_user: uid, p_cost: cost, p_kind: 'voice', p_prompt: prompt }); }
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
