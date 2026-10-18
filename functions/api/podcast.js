// functions/api/podcast.js — Coverfo Relay: 🎙️ 2인 대담 팟캐스트 음성
// © 2026 coverfo All Rights Reserved
//
// POST /api/podcast   (Authorization: Bearer 로그인토큰)
//   Body: { lines: [{ s: 'A'|'B', t: '말' }, …], voices: { A: 'coral', B: 'ash' }, title? }
//     · 줄 2~24개, 한 줄 500자까지, 모두 합쳐 6000자까지
//   Response: audio/mpeg — 두 사람 목소리가 번갈아 나오는 MP3 한 개   (헤더 X-Relay-Url: R2 에 저장된 주소 /media/relay/...)
//   크레딧: 6 (Cloudflare 변수 COST_PODCAST 로 바꿀 수 있음) · 실패하면 환불
//
// 줄마다 OpenAI gpt-4o-mini-tts 로 읽고(그 모델이 안 되면 tts-1-hd 로 한 번 더), MP3 들을 이어 붙여 한 파일로 만든다.
// 이어 붙일 때 파일마다 앞에 붙은 머리표(ID3 · Xing/Info)를 떼어 내야 재생 시간이 바르게 나온다.

const MAX_LINES = 24, MAX_LINE = 500, MAX_TOTAL = 6000, PARALLEL = 5;
const VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'];
const OLD_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];   // tts-1-hd 가 아는 목소리
const OLD_MAP = { coral: 'shimmer', ash: 'echo', sage: 'nova', ballad: 'fable', verse: 'echo' };   // 예전 모델로 바꿀 때 비슷한 목소리 (두 진행자가 같은 목소리가 되지 않게)
const HOST = {
  A: 'You are the main host of a friendly two-person podcast. Lively, curious and warm, like talking with a close friend. Natural conversational pace, light laughter where it fits.',
  B: 'You are the co-host and expert guest of a friendly two-person podcast. Calm, clear and knowledgeable, explaining things simply with a warm smile in your voice.',
};

export async function onRequestPost(context) {
  const env = context.env || {};
  if (!env.OPENAI_API_KEY) return json({ error: 'OPENAI_API_KEY 가 설정되지 않았습니다' }, 500);

  const uid = await userId(context.request, env);
  if (!uid) return json({ error: '로그인이 필요합니다' }, 401);

  let b = {};
  try { b = await context.request.json(); } catch { return json({ error: '잘못된 요청입니다' }, 400); }
  const lines = (Array.isArray(b.lines) ? b.lines : [])
    .map((x) => ({ s: x && x.s === 'B' ? 'B' : 'A', t: String((x && x.t) || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, MAX_LINE) }))
    .filter((x) => x.t);
  if (lines.length < 2) return json({ error: '대본 줄이 너무 적습니다 (2줄 이상)' }, 400);
  if (lines.length > MAX_LINES) return json({ error: `대본이 너무 깁니다 (최대 ${MAX_LINES}줄)` }, 400);
  const total = lines.reduce((a, x) => a + x.t.length, 0);
  if (total > MAX_TOTAL) return json({ error: `대본이 너무 깁니다 (최대 ${MAX_TOTAL}자)` }, 400);

  const vs = b.voices || {};
  const voice = { A: VOICES.includes(vs.A) ? vs.A : 'coral', B: VOICES.includes(vs.B) ? vs.B : 'ash' };
  const n = Number(env.COST_PODCAST);
  const cost = Number.isFinite(n) && n >= 0 ? n : 6;

  let job;
  try { job = await spend(env, uid, cost, 'podcast:' + String(b.title || lines[0].t).slice(0, 60)); }
  catch (e) { return json({ error: '크레딧 처리 실패: ' + String(e.message || e).slice(0, 200) }, 500); }
  if (job === false) return json({ error: '크레딧이 부족합니다', need: cost }, 402);

  try {
    const st = { old: false };   /* 이번 요청 안에서만 기억 */
    const parts = new Array(lines.length);
    for (let i = 0; i < lines.length; i += PARALLEL) {
      await Promise.all(lines.slice(i, i + PARALLEL).map((ln, k) => say(env, ln.t, voice[ln.s], HOST[ln.s], st).then((buf) => { parts[i + k] = buf; })));
    }
    const audio = joinMp3(parts);
    await done(env, job);

    let url = '';
    if (env.MEDIA) {
      const name = `relay/podcast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.mp3`;
      try { await env.MEDIA.put(name, audio, { httpMetadata: { contentType: 'audio/mpeg' } }); url = '/media/' + name; } catch {}
    }
    return new Response(audio, { headers: { 'Content-Type': 'audio/mpeg', 'X-Relay-Url': url, 'Cache-Control': 'no-store' } });
  } catch (e) {
    await refund(env, job);
    return json({ error: `팟캐스트 음성 만들기 실패: ${String(e.message || e).slice(0, 200)}`, refunded: true }, 502);
  }
}

/* 한 줄 읽기 → MP3 (Uint8Array). 새 모델이 한 번 막히면 그다음 줄부터는 바로 예전 모델로 (요청 수를 아끼려고) */
async function say(env, text, voice, instructions, st) {
  let r = null;
  if (!st.old) {
    r = await speech(env, { model: 'gpt-4o-mini-tts', input: text, voice, instructions: instructions + ' Speak naturally in the language of the text (Korean text in natural Korean).', response_format: 'mp3' });
    if (!r.ok) st.old = true;
  }
  if (!r || !r.ok) r = await speech(env, { model: 'tts-1-hd', input: text, voice: OLD_VOICES.includes(voice) ? voice : (OLD_MAP[voice] || 'nova'), response_format: 'mp3' });
  if (!r.ok) { const e = await r.text().catch(() => ''); throw new Error(`목소리 ${r.status} ${e.slice(0, 120)}`); }
  return new Uint8Array(await r.arrayBuffer());
}
function speech(env, body) {
  return fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/* ── MP3 이어 붙이기: 파일마다 ID3v2 머리표 · 맨 끝 ID3v1(TAG) · 첫 프레임의 Xing/Info(재생 시간 표) 를 떼고 소리 프레임만 잇는다.
      맨 앞에는 첫 파일의 Xing/Info 프레임을 하나만 두고, 그 안의 "프레임 수 · 바이트 수" 를 합친 파일에 맞게 고쳐 쓴다
      (그래야 브라우저 재생기가 전체 길이를 바르게 보여 준다). ── */
function joinMp3(parts) {
  let head = null;
  const bodies = parts.map((u) => { const x = stripMp3(u); if (!head && x.xing) head = x.xing; return x.body; });
  let len = bodies.reduce((a, x) => a + x.length, 0), frames = 0;
  for (const b of bodies) { let i = 0; while (i < b.length) { const fl = frameLen(b, i); if (!fl) break; frames++; i += fl; } }
  if (head) len += head.length;
  const out = new Uint8Array(len);
  let o = 0;
  if (head) { out.set(head, 0); o = head.length; fixXing(out, head.length, frames, len); }
  for (const x of bodies) { out.set(x, o); o += x.length; }
  return out;
}
function fixXing(u, fl, frames, bytes) {
  for (let i = 4; i + 8 <= fl; i++) {
    const t = String.fromCharCode(u[i], u[i + 1], u[i + 2], u[i + 3]);
    if (t !== 'Xing' && t !== 'Info') continue;
    const flags = (u[i + 4] << 24) | (u[i + 5] << 16) | (u[i + 6] << 8) | u[i + 7];
    let p = i + 8;
    const put = (v) => { u[p] = (v >>> 24) & 255; u[p + 1] = (v >>> 16) & 255; u[p + 2] = (v >>> 8) & 255; u[p + 3] = v & 255; p += 4; };
    if (flags & 1) put(frames);
    if (flags & 2) put(bytes);
    if (flags & 4) { for (let k = 0; k < 100; k++) u[p + k] = Math.min(255, Math.floor(k * 256 / 100)); }   /* 위치표: 고르게 */
    return;
  }
}
function stripMp3(u) {
  let s = 0, e = u.length, xing = null;
  if (u.length > 10 && u[0] === 0x49 && u[1] === 0x44 && u[2] === 0x33) {   // "ID3"
    const size = ((u[6] & 0x7f) << 21) | ((u[7] & 0x7f) << 14) | ((u[8] & 0x7f) << 7) | (u[9] & 0x7f);
    s = 10 + size + ((u[5] & 0x10) ? 10 : 0);
  }
  if (e - s > 128 && u[e - 128] === 0x54 && u[e - 127] === 0x41 && u[e - 126] === 0x47) e -= 128;   // "TAG"
  while (s + 4 < e && !(u[s] === 0xff && (u[s + 1] & 0xe0) === 0xe0)) s++;   // 첫 프레임 찾기
  const fl = frameLen(u, s);
  if (fl > 0 && s + fl <= e) {
    const scanEnd = Math.min(s + fl, s + 64);
    for (let i = s + 4; i + 4 <= scanEnd; i++) {
      const t = String.fromCharCode(u[i], u[i + 1], u[i + 2], u[i + 3]);
      if (t === 'Xing' || t === 'Info') { xing = u.slice(s, s + fl); s += fl; break; }
      if (t === 'VBRI') { s += fl; break; }
    }
  }
  return { xing, body: u.subarray(s, e) };
}
function frameLen(u, i) {
  if (i + 4 > u.length || u[i] !== 0xff || (u[i + 1] & 0xe0) !== 0xe0) return 0;
  const ver = (u[i + 1] >> 3) & 3, layer = (u[i + 1] >> 1) & 3, bri = (u[i + 2] >> 4) & 15, sri = (u[i + 2] >> 2) & 3, pad = (u[i + 2] >> 1) & 1;
  if (layer !== 1 || bri === 0 || bri === 15 || sri === 3) return 0;   // Layer III 만
  const v1 = ver === 3;
  const BR1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  const BR2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  const SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] }[ver];
  if (!SR) return 0;
  const br = (v1 ? BR1 : BR2)[bri] * 1000, sr = SR[sri];
  return Math.floor((v1 ? 144 : 72) * br / sr) + pad;
}

/* ── 공용 (voice.js 와 같은 방식) ── */
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
