// functions/api/research.js — Coverfo Relay v2: 리서치 리포트 생성
// © 2026 coverfo All Rights Reserved — Coverfo Creator Engine™ v2

/**
 * POST /api/research
 * Body: { topic, depth?: 'quick'|'deep' }
 * Response: 스트리밍 text/plain  —  진행 상태는 <!--RELAY_STEP:…--> 태그로 표시
 *
 * 흐름: 주제 → (Gemini 검색 기반 정보 수집 × 3건) → Claude 리포트 작성(스트리밍)
 * 크레딧: quick 5 / deep 10 (실패 시 환불)
 */
export async function onRequestPost(context) {
  const env = context.env || {};

  if (!env.ANTHROPIC_API_KEY) return _json({ error: 'ANTHROPIC_API_KEY 없음' }, 500);
  if (!env.GOOGLE_GENERATIVE_AI_API_KEY) return _json({ error: 'GOOGLE_GENERATIVE_AI_API_KEY 없음' }, 500);

  const authErr = await _requireAuth(context.request, env);
  if (authErr) return authErr;

  let body;
  try { body = await context.request.json(); }
  catch { return _json({ error: '잘못된 요청' }, 400); }

  const { topic, depth = 'quick' } = body;
  if (!topic) return _json({ error: '주제를 입력해 주세요' }, 400);

  const creditCost = depth === 'deep' ? 10 : 5;
  const uid = await _getUserId(context.request, env);
  const spent = await _spend(env, uid, creditCost, 'research');
  if (spent === false) return _json({ error: '크레딧이 부족합니다' }, 402);

  // 스트리밍으로 진행 상태 + 최종 리포트를 보냅니다
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const send = (t) => writer.write(encoder.encode(t));
  const step = (msg) => send(`<!--RELAY_STEP:${msg}-->\n`);

  // 비동기로 리서치 실행
  (async () => {
    try {
      // ── 1단계: 검색 질의 생성 (Claude) ──
      await step('검색 질의 생성 중…');
      const queryCount = depth === 'deep' ? 5 : 3;
      const queries = await generateQueries(env, topic, queryCount);
      await step(`검색 질의 ${queries.length}건 생성 완료`);

      // ── 2단계: 정보 수집 (Gemini + 검색 그라운딩) ──
      const findings = [];
      for (let i = 0; i < queries.length; i++) {
        await step(`검색 중 (${i + 1}/${queries.length}): ${queries[i]}`);
        const result = await searchWithGemini(env, queries[i]);
        findings.push({ query: queries[i], result });
      }
      await step('정보 수집 완료 — 리포트 작성 시작');

      // ── 3단계: 리포트 작성 (Claude 스트리밍) ──
      await send('\n');
      await streamReport(env, topic, findings, writer, encoder);

      await step('리포트 완성');
      await _done(env, spent);
    } catch (e) {
      await send(`\n<!--RELAY_ERROR:${e.message}-->\n`);
      await _refund(env, spent);
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}

/* ── 1단계: 검색 질의 생성 ─────────────────────────────────── */

async function generateQueries(env, topic, count) {
  const r = await _anthropicFetch(env, '/v1/messages', {
    method: 'POST',
    body: JSON.stringify({
      model: 'claude-haiku-5-5',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `주제: "${topic}"\n\n이 주제를 조사하기 위한 검색 질의 ${count}개를 JSON 배열로만 출력해 주세요.\n예: ["질의1","질의2","질의3"]\n다른 설명 없이 JSON 배열만 출력하세요.`,
      }],
    }),
  });

  if (!r.ok) throw new Error('검색 질의 생성 실패');

  const data = await r.json();
  const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');

  try {
    const m = text.match(/\[[\s\S]*\]/);
    return m ? JSON.parse(m[0]).slice(0, count) : [topic];
  } catch {
    return [topic];
  }
}

/* ── 2단계: Gemini 검색 그라운딩 ───────────────────────────── */

async function searchWithGemini(env, query) {
  try {
    const r = await _googleFetch(env, '/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `다음 질문에 대해 최신 정보를 포함하여 자세히 답해 주세요:\n${query}` }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
      }),
    });

    if (!r.ok) {
      // 검색 그라운딩 실패 시 일반 Gemini 응답으로 폴백
      return await fallbackGemini(env, query);
    }

    const data = await r.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    return parts.map(p => p.text || '').join('\n') || '(결과 없음)';
  } catch {
    return await fallbackGemini(env, query);
  }
}

async function fallbackGemini(env, query) {
  try {
    const r = await _googleFetch(env, '/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `다음에 대해 알고 있는 정보를 자세히 알려 주세요:\n${query}` }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }),
    });
    if (!r.ok) return '(정보 수집 실패)';
    const data = await r.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    return parts.map(p => p.text || '').join('\n') || '(결과 없음)';
  } catch {
    return '(정보 수집 실패)';
  }
}

/* ── 3단계: 리포트 작성 (Claude 스트리밍) ──────────────────── */

async function streamReport(env, topic, findings, writer, encoder) {
  const material = findings.map((f, i) => `[자료 ${i + 1}: ${f.query}]\n${f.result}`).join('\n\n---\n\n');

  const r = await _anthropicFetch(env, '/v1/messages', {
    method: 'POST',
    body: JSON.stringify({
      model: 'claude-sonnet-5-5',
      max_tokens: 8192,
      stream: true,
      messages: [{
        role: 'user',
        content: `주제: "${topic}"\n\n아래는 여러 출처에서 수집한 자료입니다:\n\n${material}\n\n` +
          '위 자료를 종합하여 한국어 리서치 리포트를 작성해 주세요.\n' +
          '형식: 마크다운. 제목(# ), 요약, 본문(## 소제목), 결론, 참고 순.\n' +
          '객관적이고 정확하게, 사실과 분석을 구분해서 써 주세요.',
      }],
    }),
  });

  if (!r.ok || !r.body) {
    const msg = await r.text().catch(() => '');
    throw new Error(`리포트 작성 실패: ${r.status} ${msg.slice(0, 100)}`);
  }

  const decoder = new TextDecoder();
  let buffer = '';

  const reader = r.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      try {
        const ev = JSON.parse(line.slice(5).trim());
        if (ev.type === 'content_block_delta' && ev.delta?.text) {
          await writer.write(encoder.encode(ev.delta.text));
        }
      } catch {}
    }
  }
}

/* ── Google 프록시 (server.ts 와 동일) ────────────────────── */

function _googleFetch(env, path, init = {}) {
  const key = env.GOOGLE_GENERATIVE_AI_API_KEY || '';
  const headers = new Headers(init.headers || {});
  headers.set('x-goog-api-key', key);

  const GOOGLE_HOST = 'https://generativelanguage.googleapis.com';
  let target = path.startsWith('http') ? path : GOOGLE_HOST + path;

  const sbUrl = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  const svc = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const proxyOn = (env.ENGINE_PROXY || env.GOOGLE_PROXY || 'on') !== 'off';

  if (sbUrl && svc && proxyOn && target.startsWith(GOOGLE_HOST)) {
    target = sbUrl + '/functions/v1/google-proxy' + target.slice(GOOGLE_HOST.length);
    headers.set('Authorization', 'Bearer ' + svc);
    headers.set('apikey', svc);
    headers.set('x-region', env.GOOGLE_PROXY_REGION || 'ap-northeast-2');
  }

  return fetch(target, { ...init, headers, redirect: 'follow' });
}

/* ── Anthropic 프록시 ─────────────────────────────────────── */

function _anthropicFetch(env, path, init = {}) {
  const key = env.ANTHROPIC_API_KEY || '';
  const headers = new Headers(init.headers || {});
  headers.set('x-api-key', key);
  headers.set('anthropic-version', '2023-06-01');
  headers.set('content-type', 'application/json');

  let target = 'https://api.anthropic.com' + path;

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
    if (!r.ok) return _json({ error: '로그인이 만료되었습니다.' }, 401);
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
