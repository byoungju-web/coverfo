/*
 * coverfo 7단계 엔진 — 서버 라우트 공용 도우미 (Remix + Cloudflare Pages)
 * - 환경변수는 Cloudflare 의 context.cloudflare.env 에서 읽습니다 (로컬은 process.env)
 * - 로그인 확인: SUPABASE_URL + SUPABASE_ANON_KEY 가 있으면 Bearer 토큰을 검사하고,
 *   없으면(설정 전) 그냥 통과시킵니다. env-check 에서 auth 상태를 볼 수 있습니다.
 */
import { json } from '@remix-run/cloudflare';

export type Env = Record<string, string | undefined>;

export function envOf(context: any): Env {
  const cf = (context && context.cloudflare && context.cloudflare.env) || {};
  const node = ((globalThis as any).process && (globalThis as any).process.env) || {};

  return { ...(node as Env), ...(cf as Env) };
}

export async function readJson<T = any>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

export function ok(data: unknown, status = 200) {
  return json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function fail(message: string, status = 500, extra?: Record<string, unknown>) {
  return json({ error: message, ...(extra || {}) }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function supabaseAuthConfig(env: Env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

  return url && key ? { url, key } : null;
}

/*
 * ── 지역 차단 우회 중계 ──────────────────────────────────────────
 * Cloudflare 함수가 홍콩(HKG) 노드에서 돌면 Anthropic("Request not allowed")·Google("User location is not
 * supported") 이 막습니다(실측). 그래서 gen.js 와 같은 방식으로 Supabase Edge Function 을 거칩니다.
 *   Google    → {SUPABASE_URL}/functions/v1/google-proxy/v1beta/...
 *   Anthropic → {SUPABASE_URL}/functions/v1/anthropic-relay/v1/messages
 * Secret ENGINE_PROXY=off 로 끌 수 있고, 리전은 GOOGLE_PROXY_REGION(기본 ap-northeast-2 서울)을 같이 씁니다.
 * SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY 가 없으면 자동으로 직접 호출합니다.
 */
const GOOGLE_HOST = 'https://generativelanguage.googleapis.com';
const ANTHROPIC_HOST = 'https://api.anthropic.com';

function proxyConfig(env: Env) {
  const sbUrl = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  const service = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const on = (env.ENGINE_PROXY || env.GOOGLE_PROXY || 'on') !== 'off';

  return sbUrl && service && on ? { sbUrl, service, region: env.GOOGLE_PROXY_REGION || 'ap-northeast-2' } : null;
}

/** Google 호출 (중계 경유). url 은 전체 주소 또는 /v1beta/... 경로 */
export function googleFetch(env: Env, url: string, init: RequestInit = {}) {
  const key = env.GOOGLE_GENERATIVE_AI_API_KEY || '';
  const headers = new Headers(init.headers || {});
  headers.set('x-goog-api-key', key);

  let target = url.startsWith('http') ? url : GOOGLE_HOST + url;
  const px = proxyConfig(env);

  if (px && target.startsWith(GOOGLE_HOST)) {
    target = px.sbUrl + '/functions/v1/google-proxy' + target.slice(GOOGLE_HOST.length);
    headers.set('Authorization', 'Bearer ' + px.service);
    headers.set('apikey', px.service);
    headers.set('x-region', px.region);
  }

  return fetch(target, { ...init, headers, redirect: 'follow' });
}

/** Anthropic 호출 (중계 경유). path 는 /v1/messages 같은 경로 */
export function anthropicFetch(env: Env, path: string, init: RequestInit = {}) {
  const key = env.ANTHROPIC_API_KEY || '';
  const headers = new Headers(init.headers || {});
  headers.set('x-api-key', key);
  headers.set('anthropic-version', '2023-06-01');
  headers.set('content-type', 'application/json');

  let target = ANTHROPIC_HOST + path;
  const px = proxyConfig(env);

  if (px) {
    target = px.sbUrl + '/functions/v1/anthropic-relay' + path;
    // 중계 함수는 x-api-key 등 정해진 헤더만 Anthropic 으로 넘기므로 아래 둘은 Supabase 문 통과용입니다
    headers.set('Authorization', 'Bearer ' + px.service);
    headers.set('apikey', px.service);
    headers.set('x-region', px.region);
  }

  return fetch(target, { ...init, headers });
}

export function proxyStatus(env: Env) {
  return proxyConfig(env) ? 'on (' + proxyConfig(env)!.region + ')' : 'off';
}

/** 로그인 확인. 통과하면 null, 막으면 Response 를 돌려줍니다. */
export async function requireLogin(request: Request, env: Env): Promise<Response | null> {
  const cfg = supabaseAuthConfig(env);

  if (!cfg) {
    return null; // Supabase 설정이 없으면 검사하지 않음
  }

  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!token) {
    return fail('로그인이 필요합니다', 401);
  }

  try {
    const r = await fetch(`${cfg.url}/auth/v1/user`, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${token}` },
    });

    if (!r.ok) {
      return fail('로그인이 만료되었습니다. 다시 로그인해 주세요.', 401);
    }
  } catch {
    return fail('로그인 확인에 실패했습니다', 500);
  }

  return null;
}

/** Anthropic Messages API 로 글 한 번 받기 */
export async function anthropicText(env: Env, model: string, prompt: string, maxTokens: number) {
  const key = env.ANTHROPIC_API_KEY;

  if (!key) {
    throw new Error('ANTHROPIC_API_KEY 가 없습니다 (Cloudflare 환경변수)');
  }

  const r = await anthropicFetch(env, '/v1/messages', {
    method: 'POST',
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  const data: any = await r.json();

  if (data.error) {
    throw new Error(`${model}: ${data.error.message || JSON.stringify(data.error)}`);
  }

  const text = (data.content || [])
    .filter((c: any) => c.type === 'text')
    .map((c: any) => c.text)
    .join('\n');

  return { text, usage: data.usage };
}

/** 글 안에서 첫 JSON 덩어리만 꺼내 파싱 (실패하면 null) */
export function extractJson(text: string): any | null {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : text);
  } catch {
    return null;
  }
}

/**
 * Anthropic Messages API 를 스트리밍으로 받아 글자를 나오는 대로 브라우저에 흘려보냅니다.
 * 7단계(긴 코드 생성)를 한 번에 받으면 60초 넘게 아무 응답이 없어 Cloudflare 가 연결을 끊고
 * 브라우저에는 "Failed to fetch" 만 남습니다(실측). 스트리밍이면 연결이 계속 살아 있습니다.
 * 오류는 본문 끝에 <!--CF_ERROR:...--> 표시로 넣어 보냅니다.
 */
export async function anthropicStreamResponse(env: Env, model: string, prompt: string, maxTokens: number) {
  const key = env.ANTHROPIC_API_KEY;

  if (!key) {
    return fail('ANTHROPIC_API_KEY 가 없습니다 (Cloudflare 환경변수)');
  }

  const upstream = await anthropicFetch(env, '/v1/messages', {
    method: 'POST',
    body: JSON.stringify({ model, max_tokens: maxTokens, stream: true, messages: [{ role: 'user', content: prompt }] }),
  });

  if (!upstream.ok || !upstream.body) {
    let msg = `HTTP ${upstream.status}`;

    try {
      const j: any = await upstream.json();
      msg = j?.error?.message || msg;
    } catch {
      // 본문이 JSON 이 아니면 상태 코드만 씁니다
    }

    return fail(`${model}: ${msg}`);
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  const out = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data:')) {
          continue;
        }

        try {
          const ev = JSON.parse(line.slice(5).trim());

          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
            controller.enqueue(encoder.encode(ev.delta.text));
          } else if (ev.type === 'message_delta' && ev.delta?.stop_reason === 'max_tokens') {
            // 출력 길이 한도에 걸려 잘렸음 — 엔진 화면이 이 표시를 보고 "잘림"으로 알립니다
            controller.enqueue(encoder.encode(`\n<!--CF_TRUNCATED:max_tokens-->`));
          } else if (ev.type === 'error') {
            controller.enqueue(encoder.encode(`\n<!--CF_ERROR:${ev.error?.message || 'stream error'}-->`));
          }
        } catch {
          // 줄이 잘렸으면 다음 조각과 합쳐집니다
        }
      }
    },
  });

  upstream.body.pipeTo(out.writable).catch(() => undefined);

  return new Response(out.readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
  });
}
