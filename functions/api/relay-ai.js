// functions/api/relay-ai.js — Coverfo Relay v2: AI 텍스트 처리 (요약 · 번역 · 리라이트)
// © 2026 coverfo All Rights Reserved — Coverfo Creator Engine™ v2

/**
 * POST /api/relay-ai
 * Body: { text, task: 'summarize'|'translate'|'rewrite', options?: { lang?, tone?, length? } }
 * Response: 스트리밍 text/plain (Anthropic SSE → 텍스트만 추출)
 *
 * 크레딧: 3 (실패 시 환불)
 */
export async function onRequestPost(context) {
  const env = context.env || {};
  const ANTHROPIC_KEY = env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_KEY) return _json({ error: 'ANTHROPIC_API_KEY 가 설정되지 않았습니다' }, 500);

  const authErr = await _requireAuth(context.request, env);
  if (authErr) return authErr;

  let body;
  try { body = await context.request.json(); }
  catch { return _json({ error: '잘못된 요청입니다' }, 400); }

  const { text, task, options = {} } = body;
  if (!text) return _json({ error: '텍스트를 입력해 주세요' }, 400);
  if (!['summarize', 'translate', 'rewrite'].includes(task)) {
    return _json({ error: 'task 는 summarize / translate / rewrite 중 하나여야 합니다' }, 400);
  }

  const prompt = buildPrompt(text, task, options);

  // 크레딧
  const uid = await _getUserId(context.request, env);
  const spent = await _spend(env, uid, 3, `ai-${task}`);
  if (spent === false) return _json({ error: '크레딧이 부족합니다' }, 402);

  try {
    const model = 'claude-haiku-5-5'; // 빠르고 경제적 — models.ts RELAY_MODELS.ai 와 맞춤

    const upstream = await _anthropicFetch(env, '/v1/messages', {
      method: 'POST',
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        stream: true,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      await _refund(env, uid, 3, `ai-${task}`);
      let msg = `HTTP ${upstream.status}`;
      try { const j = await upstream.json(); msg = j?.error?.message || msg; } catch {}
      return _json({ error: `AI 처리 실패: ${msg}` }, 502);
    }

    // SSE 에서 텍스트만 추출해 스트리밍
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = '';

    const out = new TransformStream({
      transform(chunk, ctrl) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          try {
            const ev = JSON.parse(line.slice(5).trim());
            if (ev.type === 'content_block_delta' && ev.delta?.text) {
              ctrl.enqueue(encoder.encode(ev.delta.text));
            }
          } catch {}
        }
      },
    });

    upstream.body.pipeTo(out.writable).catch(() => {});

    return new Response(out.readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
    });
  } catch (e) {
    await _refund(env, uid, 3, `ai-${task}`);
    return _json({ error: `AI 오류: ${e.message}` }, 500);
  }
}

/* ── 프롬프트 ─────────────────────────────────────────────── */

function buildPrompt(text, task, opts) {
  const lang = opts.lang || '한국어';
  const tone = opts.tone || '자연스러운';
  const length = opts.length || '적절한';

  switch (task) {
    case 'summarize':
      return `다음 텍스트를 ${length} 길이로 핵심만 간결하게 요약해 주세요. 불릿 포인트 없이 자연스러운 문장으로 써 주세요.\n\n---\n${text}\n---`;
    case 'translate':
      return `다음 텍스트를 ${lang}(으)로 자연스럽게 번역해 주세요. 번역문만 출력하세요.\n\n---\n${text}\n---`;
    case 'rewrite':
      return `다음 텍스트를 ${tone} 톤으로 다시 써 주세요. 원래 의미를 유지하면서 표현만 바꿔 주세요. 결과만 출력하세요.\n\n---\n${text}\n---`;
    default:
      return text;
  }
}

/* ── Anthropic 프록시 (server.ts 와 동일 패턴) ──────────────── */

function _anthropicFetch(env, path, init = {}) {
  const key = env.ANTHROPIC_API_KEY || '';
  const headers = new Headers(init.headers || {});
  headers.set('x-api-key', key);
  headers.set('anthropic-version', '2023-06-01');
  headers.set('content-type', 'application/json');

  let target = 'https://api.anthropic.com' + path;

  // HKG 지역 차단 우회 — Supabase Edge Function 경유
  const sbUrl = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  const svc = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const proxyOn = (env.ENGINE_PROXY || 'on') !== 'off';

  if (sbUrl && svc && proxyOn) {
    target = sbUrl + '/functions/v1/anthropic-relay' + path;
    headers.set('Authorization', 'Bearer ' + svc);
    headers.set('apikey', svc);
    headers.set('x-region', env.GOOGLE_PROXY_REGION || 'ap-northeast-2');
  }

  return fetch(target, { ...init, headers });
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
