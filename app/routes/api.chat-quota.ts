// coverfo 채팅 무료 한도 — 서버(Supabase)에서 계정 기준으로 셉니다 (브라우저·시크릿창·다른 기기로 우회 불가)
//   POST /api/chat-quota {mode:'discuss'|'build'} →
//     discuss: { ok:true, remaining } | { ok:false, reason:'daily_discuss' }
//     build  : { ok:true, free:true } | { ok:false, reason:'need_credit' }   ← need_credit 이면 화면이 크레딧을 차감합니다
// 규칙(표: cf_chat_usage, 함수: cf_chat_quota — sql/cf_chat_usage.sql):
//   · discuss(글 답변)  : 하루 4회 무료
//   · build(앱 생성)    : 하루 1회 무료 · 한 달 최대 10회 · 가입 후 90일 동안만 무료 → 그 외에는 need_credit
// 로그인 안 했으면 401. Supabase 설정이 없으면 {enabled:false, ok:true} 로 통과시킵니다.
// RPC 호출 자체가 실패하면 사용자를 막지 않도록 {ok:true, softfail:true} 로 통과시킵니다(사이트 잠김 방지).
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { envOf, fail, getUserId, ok, readJson } from '~/lib/engine/server';

function sb(env: any) {
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const service = env.SUPABASE_SERVICE_ROLE_KEY || '';

  return url && service ? { url, service } : null;
}

export async function action({ request, context }: ActionFunctionArgs) {
  const env = envOf(context);
  const c = sb(env);
  const body = await readJson<{ mode?: string }>(request);
  const mode = body.mode === 'build' ? 'build' : 'discuss';

  // Supabase 설정이 없으면(개발 환경) 한도 없이 통과
  if (!c) {
    return ok({ enabled: false, ok: true });
  }

  const user = await getUserId(request, env);

  if (!user) {
    return fail('로그인이 필요합니다', 401);
  }

  const r = await fetch(`${c.url}/rest/v1/rpc/cf_chat_quota`, {
    method: 'POST',
    headers: { apikey: c.service, Authorization: `Bearer ${c.service}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_user: user.id, p_mode: mode }),
  });
  const t = await r.text();
  let d: any = null;

  try {
    d = JSON.parse(t);
  } catch {
    d = null;
  }

  // 서버 함수 오류 시엔 막지 않습니다 (사용자가 갑자기 못 쓰게 되는 사고 방지)
  if (!r.ok || !d) {
    return ok({ enabled: true, ok: true, softfail: true, error: `rpc ${r.status}: ${t.slice(0, 200)}` });
  }

  return ok({ enabled: true, ...d });
}
