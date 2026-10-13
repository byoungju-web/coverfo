// functions/api/tts.js — Coverfo Relay v2: Text-to-Speech (OpenAI TTS API)
// © 2026 coverfo All Rights Reserved — Coverfo Creator Engine™ v2

/**
 * POST /api/tts
 * Body: { text, voice?, speed? }
 * Response: audio/mpeg binary
 *
 * 음성 종류: alloy · echo · fable · onyx · nova · shimmer
 * 크레딧: 2 (실패 시 환불)
 */
export async function onRequestPost(context) {
  const env = context.env || {};
  const OPENAI_KEY = env.OPENAI_API_KEY;

  if (!OPENAI_KEY) return _json({ error: 'OPENAI_API_KEY 가 설정되지 않았습니다' }, 500);

  const authErr = await _requireAuth(context.request, env);
  if (authErr) return authErr;

  let body;
  try { body = await context.request.json(); }
  catch { return _json({ error: '잘못된 요청입니다' }, 400); }

  const { text, voice = 'nova', speed = 1 } = body;
  if (!text) return _json({ error: '텍스트를 입력해 주세요' }, 400);
  if (text.length > 4096) return _json({ error: '텍스트가 너무 깁니다 (최대 4096자)' }, 400);

  const VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
  const safeVoice = VOICES.includes(voice) ? voice : 'nova';

  // 크레딧 차감
  const uid = await _getUserId(context.request, env);
  const spent = await _spend(env, uid, 2, 'tts');
  if (spent === false) return _json({ error: '크레딧이 부족합니다' }, 402);

  try {
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'tts-1-hd', input: text, voice: safeVoice, speed, response_format: 'mp3' }),
    });

    if (!r.ok) {
      await _refund(env, spent);
      const e = await r.text().catch(() => '');
      return _json({ error: `TTS 실패 (${r.status}): ${e.slice(0, 200)}` }, 502);
    }

    const audio = await r.arrayBuffer();
    await _done(env, spent);

    // R2 저장 (MEDIA 바인딩이 있을 때)
    const fname = `tts-${Date.now()}.mp3`;
    let mediaUrl = '';
    if (env.MEDIA) {
      try {
        await env.MEDIA.put(`relay/${fname}`, audio, { httpMetadata: { contentType: 'audio/mpeg' } });
        mediaUrl = `/media/relay/${fname}`;
      } catch { /* R2 실패해도 음성은 반환 */ }
    }

    return new Response(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `inline; filename="${fname}"`,
        'X-Relay-Url': mediaUrl,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    await _refund(env, spent);
    return _json({ error: `TTS 오류: ${e.message}` }, 500);
  }
}

/* ── 공용 도우미 (gen.js 와 동일 패턴) ──────────────────────── */

function _json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function _requireAuth(request, env) {
  const sbUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const sbKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!sbUrl || !sbKey) return null;

  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return _json({ error: '로그인이 필요합니다' }, 401);

  try {
    const r = await fetch(`${sbUrl}/auth/v1/user`, {
      headers: { apikey: sbKey, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return _json({ error: '로그인이 만료되었습니다. 다시 로그인해 주세요.' }, 401);
  } catch {
    return _json({ error: '로그인 확인 실패' }, 500);
  }
  return null;
}

async function _getUserId(request, env) {
  const sbUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const sbKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!sbUrl || !sbKey || !token) return null;
  try {
    const r = await fetch(`${sbUrl}/auth/v1/user`, {
      headers: { apikey: sbKey, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u?.id || null;
  } catch { return null; }
}

/* 크레딧 — studio(gen.js)·yt-top.js 와 같은 방식: cf_spend(p_user, p_cost, p_kind, p_prompt) → { ok, job_id }
   kind 허용 목록에 'relay' 가 없으면 'chat' 으로 한 번 더. 반환: job_id(성공) · false(크레딧 부족) · null(설정 없음) */
async function _spend(env, uid, amount, label) {
  const sbUrl = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  const svc = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !svc || !uid) return null;
  for (const kind of ['relay', 'chat']) {
    try {
      const r = await fetch(`${sbUrl}/rest/v1/rpc/cf_spend`, {
        method: 'POST',
        headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_user: uid, p_cost: amount, p_kind: kind, p_prompt: `relay-${label}` }),
      });
      if (!r.ok) continue;
      const res = await r.json();
      if (res && res.ok) return res.job_id != null ? res.job_id : true;
      return false;
    } catch {}
  }
  return null;
}

async function _refund(env, job) {
  const sbUrl = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  const svc = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !svc || job == null || job === true || job === false) return;
  try {
    await fetch(`${sbUrl}/rest/v1/rpc/cf_refund`, {
      method: 'POST',
      headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_job: job }),
    });
  } catch {}
}

async function _done(env, job) {
  const sbUrl = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  const svc = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !svc || job == null || job === true || job === false) return;
  try {
    await fetch(`${sbUrl}/rest/v1/cf_jobs?id=eq.${encodeURIComponent(job)}`, {
      method: 'PATCH',
      headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done', updated_at: new Date().toISOString() }),
    });
  } catch {}
}
