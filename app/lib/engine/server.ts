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

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
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

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
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
