/*
 * v449 엔진 5단계 영상 — Gemini Omni Flash (Interactions API)
 * 구글이 2026-10-22 Veo 3.1 Preview(Gemini API)를 종료하고 안내한 대체 모델. 스튜디오(functions/api/gen.js)와 같은 방식.
 *   시작: POST /v1beta/interactions {model, input, response_format:{type:'video', aspect_ratio, resolution}, background:true}
 *   확인: GET  /v1beta/interactions/{id}  → status: in_progress | completed | failed | cancelled
 *   연장: previous_interaction_id 로 이전 영상 뒤에 이어 붙임 (스튜디오에서 20초 한 파일로 나오는 것 확인)
 */
import { googleFetch, type Env } from '~/lib/engine/server';

export const OMNI_HOST = 'https://generativelanguage.googleapis.com/';

/** 영상 번호(interactions/<id>)를 결과 화면에서 쓰는 주소로 — stage5-veo-status?file= 이 이 주소를 받아 영상을 내보냅니다 */
export function omniVideoUri(id: string) {
  return OMNI_HOST + 'v1beta/interactions/' + id;
}

/** omniVideoUri 주소에서 번호만 꺼냄 (아니면 null) */
export function omniIdFromUri(uri: string): string | null {
  const m = /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/interactions\/([A-Za-z0-9_\-.]+)$/.exec(uri || '');
  return m ? m[1] : null;
}

export async function omniStart(env: Env, body: Record<string, unknown>): Promise<string> {
  const send = (b: Record<string, unknown>) =>
    googleFetch(env, '/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(b),
    });
  let r = await send({ background: true, ...body });
  let d: any = await r.json().catch(() => ({}));

  // 혹시 background 를 안 받으면 한 번 더 (결과는 같은 번호로 다시 조회)
  if (r.status === 400 && /background/i.test(JSON.stringify(d))) {
    r = await send(body);
    d = await r.json().catch(() => ({}));
  }

  if (!r.ok || !d.id) {
    throw new Error('google video ' + r.status + ': ' + JSON.stringify(d).slice(0, 400));
  }

  return 'interactions/' + d.id;
}

/** 응답 어디에 있든 영상 조각({type:'video', data|uri})을 찾는다 — model_output 단계 우선 */
export function findVideo(o: any, depth = 0): any {
  if (!o || typeof o !== 'object' || depth > 8) {
    return null;
  }

  const isVid = o.type === 'video' || /^video\//.test(String(o.mime_type || o.mimeType || ''));

  if (isVid && (o.data || o.uri)) {
    return o;
  }

  for (const k in o) {
    const f = findVideo(o[k], depth + 1);

    if (f) {
      return f;
    }
  }

  return null;
}

export function videoPart(d: any) {
  const outs = Array.isArray(d?.steps) ? d.steps.filter((x: any) => x && x.type === 'model_output') : [];
  return findVideo(outs.length ? outs : d);
}

export function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);

  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }

  return out;
}
