// functions/api/stt.js — Coverfo Relay v2: Speech-to-Text (OpenAI Whisper API)
// © 2026 coverfo All Rights Reserved — Coverfo Creator Engine™ v2

/**
 * POST /api/stt
 * Body: FormData  — file (audio/webm, audio/mp4, audio/mpeg 등), language? (ko, en, ja …)
 * Response: { text, language }
 *
 * 크레딧: 2 (실패 시 환불)
 */
export async function onRequestPost(context) {
  const env = context.env || {};
  const OPENAI_KEY = env.OPENAI_API_KEY;

  if (!OPENAI_KEY) return _json({ error: 'OPENAI_API_KEY 가 설정되지 않았습니다' }, 500);

  const authErr = await _requireAuth(context.request, env);
  if (authErr) return authErr;

  let form;
  try { form = await context.request.formData(); }
  catch { return _json({ error: '음성 파일을 올려 주세요 (FormData)' }, 400); }

  const file = form.get('file');
  if (!file || !(file instanceof File || file instanceof Blob)) {
    return _json({ error: '음성 파일(file)이 없습니다' }, 400);
  }

  // 50MB 제한
  if (file.size > 50 * 1024 * 1024) {
    return _json({ error: '파일이 너무 큽니다 (최대 50 MB)' }, 400);
  }

  const language = form.get('language') || ''; // 비어 있으면 자동 감지

  // 크레딧 차감
  const uid = await _getUserId(context.request, env);
  const spent = await _spend(env, uid, 2, 'stt');
  if (spent === false) return _json({ error: '크레딧이 부족합니다' }, 402);

  try {
    // Whisper API 로 보낼 FormData 조립
    const fd = new FormData();
    // Whisper 는 파일 확장자로 포맷을 인식하므로 이름을 넣어줍니다
    const ext = guessExt(file.type);
    fd.append('file', file, `audio.${ext}`);
    fd.append('model', 'whisper-1');
    fd.append('response_format', 'verbose_json');
    if (language) fd.append('language', language);

    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}` },
      body: fd,
    });

    if (!r.ok) {
      await _refund(env, uid, 2, 'stt');
      const e = await r.text().catch(() => '');
      return _json({ error: `STT 실패 (${r.status}): ${e.slice(0, 200)}` }, 502);
    }

    const data = await r.json();
    return _json({ text: data.text || '', language: data.language || language || 'auto' });
  } catch (e) {
    await _refund(env, uid, 2, 'stt');
    return _json({ error: `STT 오류: ${e.message}` }, 500);
  }
}

function guessExt(mime) {
  if (!mime) return 'webm';
  if (mime.includes('mp3') || mime.includes('mpeg')) return 'mp3';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('flac')) return 'flac';
  return 'webm';
}

/* ── 공용 도우미 ──────────────────────────────────────────── */

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
  } catch { return _json({ error: '로그인 확인 실패' }, 500); }
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

async function _spend(env, uid, amount, label) {
  const sbUrl = env.SUPABASE_URL;
  const svc = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !svc || !uid) return null;
  try {
    const r = await fetch(`${sbUrl}/rest/v1/rpc/cf_spend`, {
      method: 'POST',
      headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_user: uid, p_amount: amount, p_label: `relay-${label}` }),
    });
    const res = await r.json();
    if (res === false) return false;
  } catch {}
  return null;
}

async function _refund(env, uid, amount, label) {
  const sbUrl = env.SUPABASE_URL;
  const svc = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !svc || !uid) return;
  try {
    await fetch(`${sbUrl}/rest/v1/rpc/cf_refund`, {
      method: 'POST',
      headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_user: uid, p_amount: amount, p_label: `relay-${label}-refund` }),
    });
  } catch {}
}
