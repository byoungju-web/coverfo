/*
 * coverfo Lens (FogLens 문서 · WorkLens 일 · ShopLens 상품) — 서버 라우트 (Remix + Cloudflare Pages)
 *
 *   POST /api/lens  {op:'analyze', mode, imageBase64, mimeType, hash, lang}
 *        → 사진 1장 분석. 같은 사진(hash)+모드+언어가 cf_lens 표에 있으면 캐시로 돌려주고 크레딧 0.
 *          없으면 크레딧 1 차감 → Gemini(사진 읽기) → Claude Fable 5.1(쉬운 말 정리) → cf_lens 저장.
 *   POST /api/lens  {op:'video', mode, hash, lang}
 *        → 설명 영상(Veo 3.1 fast, 9:16, 8초) 시작. 이미 영상이 있으면 재사용(크레딧 0). 없으면 25 차감.
 *   POST /api/lens  {op:'photo', mode, hash, lang}
 *        → (일·상품 모드) gpt image 2 로 스튜디오 사진 1장. 이미 있으면 재사용(0), 없으면 2 차감.
 *   GET  /api/lens?op=status&hash=...&mode=...&lang=...
 *        → 영상 진행 상태. 완성되면 구글에서 받아 R2(MEDIA 바인딩)에 저장하고 /media/lens/... 주소를 돌려줌.
 *
 * 공용 도우미(app/lib/engine/server.ts)의 googleFetch·anthropicFetch 를 쓰므로
 * 구글·Anthropic 호출은 엔진·스튜디오와 똑같이 Supabase Edge Function 중계(서울 ap-northeast-2)를 탑니다.
 * 크레딧은 스튜디오·엔진과 같은 Supabase 함수 cf_spend / cf_refund 를 씁니다.
 *
 * 단가(크레딧)는 Cloudflare 변수로 바꿀 수 있습니다: COST_LENS(1) COST_LENS_VIDEO(25) COST_LENS_PHOTO(2)
 * 모델은 아래 LENS_MODELS 한 곳에서 관리합니다 (Cloudflare 변수 LENS_VISION_MODEL 로 사진 읽기 모델만 바꿀 수 있음).
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';
import { anthropicFetch, envOf, extractJson, fail, getUserId, googleFetch, ok, readJson } from '~/lib/engine/server';
import { ENGINE_MODELS } from '~/lib/engine/models';

/* ── 모델 (현재 coverfo 가 쓰는 것과 같은 ID) ─────────────────────────── */
const LENS_MODELS = {
  vision: ENGINE_MODELS.stage3, // gemini-3.1-flash-image — 사진 읽기(글자·물건·동작). 응답은 글(TEXT)만 받음
  writer: ENGINE_MODELS.stage1, // claude-fable-5-1 — 쉬운 말로 정리 + 사용자 언어로
  photo: ENGINE_MODELS.stage4, // gpt-image-2 — 일·상품 스튜디오 사진 (quality medium)
  video: 'veo-3.1-fast-generate-preview', // 스튜디오(functions/api/gen.js)와 같은 영상 모델
} as const;

type Mode = 'document' | 'work' | 'shop';
const MODES: Mode[] = ['document', 'work', 'shop'];

type Env = Record<string, any>;

function costs(env: Env) {
  const n = (k: string, d: number) => {
    const v = parseInt(env[k] || '', 10);
    return isNaN(v) ? d : v;
  };

  return { analyze: n('COST_LENS', 1), video: n('COST_LENS_VIDEO', 25), photo: n('COST_LENS_PHOTO', 2) };
}

/* ── Supabase (서비스 키) ──────────────────────────────────────────── */
function sb(env: Env) {
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const service = env.SUPABASE_SERVICE_ROLE_KEY || '';

  return url && service ? { url, service } : null;
}
type SB = { url: string; service: string };

function sbHeaders(c: SB, extra?: Record<string, string>) {
  return { apikey: c.service, Authorization: `Bearer ${c.service}`, 'Content-Type': 'application/json', ...(extra || {}) };
}

async function rpc(c: SB, name: string, args: any) {
  const r = await fetch(`${c.url}/rest/v1/rpc/${name}`, { method: 'POST', headers: sbHeaders(c), body: JSON.stringify(args || {}) });
  const t = await r.text();

  if (!r.ok) {
    throw new Error(`supabase rpc ${name} ${r.status}: ${t.slice(0, 300)}`);
  }

  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

/** 크레딧 차감 (엔진과 같은 방식: kind 허용 목록에 걸리면 'chat' 으로 한 번 더) */
async function spend(c: SB, userId: string, cost: number, kind: string, prompt: string) {
  let s: any;

  try {
    s = await rpc(c, 'cf_spend', { p_user: userId, p_cost: cost, p_kind: kind, p_prompt: prompt });
  } catch {
    s = await rpc(c, 'cf_spend', { p_user: userId, p_cost: cost, p_kind: 'chat', p_prompt: prompt });
  }

  return s;
}

async function refund(c: SB, jobId: string | null | undefined) {
  if (!jobId) {
    return;
  }

  await rpc(c, 'cf_refund', { p_job: jobId }).catch(() => undefined);
}

async function jobDone(c: SB, jobId: string | null | undefined) {
  if (!jobId) {
    return;
  }

  await fetch(`${c.url}/rest/v1/cf_jobs?id=eq.${encodeURIComponent(jobId)}`, {
    method: 'PATCH',
    headers: sbHeaders(c),
    body: JSON.stringify({ status: 'done', updated_at: new Date().toISOString() }),
  }).catch(() => undefined);
}

/* ── cf_lens 표 ────────────────────────────────────────────────────── */
function lensKey(hash: string, mode: Mode, lang: string) {
  return `image_hash=eq.${encodeURIComponent(hash)}&mode=eq.${mode}&language=eq.${encodeURIComponent(lang)}`;
}

async function getLens(c: SB, hash: string, mode: Mode, lang: string) {
  const r = await fetch(`${c.url}/rest/v1/cf_lens?${lensKey(hash, mode, lang)}&select=*&limit=1`, { headers: sbHeaders(c) });
  const rows: any[] = r.ok ? await r.json() : [];

  return rows && rows[0] ? rows[0] : null;
}

async function patchLens(c: SB, hash: string, mode: Mode, lang: string, patch: any, filter?: string) {
  const r = await fetch(`${c.url}/rest/v1/cf_lens?${lensKey(hash, mode, lang)}${filter ? '&' + filter : ''}`, {
    method: 'PATCH',
    headers: sbHeaders(c, { Prefer: 'return=representation' }),
    body: JSON.stringify({ updated_at: new Date().toISOString(), ...patch }),
  });
  const rows: any[] = r.ok ? await r.json() : [];

  return rows && rows[0] ? rows[0] : null;
}

/* ── 프롬프트 ─────────────────────────────────────────────────────── */
const LANG_NAME: Record<string, string> = { ko: 'Korean', en: 'English', ja: 'Japanese', zh: 'Chinese', th: 'Thai' };

function visionPrompt(mode: Mode) {
  if (mode === 'work') {
    return `You are WorkLens. Look at this photo of someone working (farming, cooking, repair, beauty, sewing, construction, any trade).
Return ONLY a JSON object:
{"type":"<short category>","workDescription":"<what exactly is being done, tools, materials, visible skill level>",
 "skills":["<skill>","..."],"portfolioTitle":"<3-6 word portfolio title>","globalJobTitle":"<internationally understood job title in English>",
 "steps":[{"icon":"<one emoji>","title":"<short>","desc":"<one sentence>"}] (3-4 steps of the work shown),
 "canvasAnimation":{"bgColor":"<hex color that suits the trade>"}}`;
  }

  if (mode === 'shop') {
    return `You are ShopLens. Look at this photo of a product (package, label, tag, receipt, price sign).
Read every visible text. Return ONLY a JSON object:
{"type":"<product category>","productName":"<name as printed>","brand":"<brand or empty>","priceSeen":"<price printed if any>",
 "expiry":"<expiry/manufacture date if printed>","origin":"<country of origin if printed>","ingredientsOrSpecs":"<key ingredients or specs, short>",
 "authenticitySignals":["<what looks genuine or suspicious: print quality, logo, spelling, seals, serial>"],
 "safety":"<allergen/usage/safety warnings printed, or empty>","steps":[{"icon":"<one emoji>","title":"<short>","desc":"<one sentence>"}] (3-4 checks a buyer should do),
 "searchKeywords":"<2-4 words to search this product online>","canvasAnimation":{"bgColor":"<hex>"}}`;
  }

  return `You are FogLens. Look at this photo of a document (prescription, contract, bill, homework, notice, foreign menu, sign, form).
Read every visible text carefully. Return ONLY a JSON object:
{"type":"<document category>","rawSummary":"<what the document literally says, key names, numbers, dates, amounts>",
 "simpleExplanation":"<2-3 sentences: what this is and what it means for the person holding it>",
 "riskWarnings":["<deadline, fee, penalty, side effect, clause to be careful of>"],"urgency":"<none|low|medium|high>",
 "steps":[{"icon":"<one emoji>","title":"<short>","desc":"<one sentence>"}] (3-4 actions to take, in order),
 "canvasAnimation":{"bgColor":"<hex>"}}`;
}

function writerPrompt(mode: Mode, lang: string, parsed: any) {
  const langName = LANG_NAME[lang] || lang;
  const common = `Write everything in ${langName}, for a person who has no expert knowledge — short, warm, concrete, no jargon.
Keep facts exactly as given (names, numbers, dates); do not invent details that are not in the data. Return ONLY a JSON object.`;

  if (mode === 'work') {
    return `${common}
Data: ${JSON.stringify(parsed).slice(0, 2500)}
JSON: {"simpleExplanation":"<2 sentences describing this person's work and strength>","portfolioTitle":"<title in ${langName}>",
 "globalJobTitle":"<job title in English>","skills":["..."],"steps":[{"icon":"<emoji>","title":"...","desc":"..."}],
 "hireNote":"<one sentence an employer would like to read about this worker>"}`;
  }

  if (mode === 'shop') {
    return `${common}
Data: ${JSON.stringify(parsed).slice(0, 2500)}
JSON: {"productName":"...","brand":"...","simpleExplanation":"<2 sentences: what this product is and who it is for>",
 "authenticity":"<cautious, evidence-based note on genuine/suspicious signs — say clearly that a photo alone cannot prove authenticity>",
 "priceAnalysis":"<if a price was read: is it reasonable, what to compare; else say no price was visible>",
 "safety":"<allergen/expiry/usage cautions, or 'none seen'>","steps":[{"icon":"<emoji>","title":"...","desc":"..."}],
 "cheapestHint":"<how to find it cheaper: search words, where to compare>","searchKeywords":"..."}`;
  }

  return `${common}
Data: ${JSON.stringify(parsed).slice(0, 2500)}
JSON: {"simpleExplanation":"<2-3 sentences>","riskWarnings":["..."],"urgency":"<none|low|medium|high>",
 "steps":[{"icon":"<emoji>","title":"...","desc":"..."}],"todayAdvice":"<the single most important thing to do today>",
 "reassurance":"<one calm, honest sentence>"}`;
}

/* ── 모델 호출 ─────────────────────────────────────────────────────── */
async function geminiVision(env: Env, model: string, prompt: string, imageBase64: string, mimeType: string) {
  const r = await googleFetch(env, `/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: imageBase64 } }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1500, responseModalities: ['TEXT'] },
    }),
  });
  const data: any = await r.json().catch(() => ({}));

  if (!r.ok || data.error) {
    throw new Error(`${model}: ${data?.error?.message || 'HTTP ' + r.status}`);
  }

  const text = (data.candidates?.[0]?.content?.parts || [])
    .filter((p: any) => typeof p.text === 'string')
    .map((p: any) => p.text)
    .join('\n');
  const parsed = extractJson(text);

  if (!parsed) {
    throw new Error(`${model}: JSON 을 읽지 못했습니다`);
  }

  return parsed;
}

async function claudeText(env: Env, model: string, content: any[], maxTokens: number) {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY 가 없습니다 (Cloudflare 환경변수)');
  }

  const r = await anthropicFetch(env, '/v1/messages', {
    method: 'POST',
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content }] }),
  });
  const data: any = await r.json().catch(() => ({}));

  if (!r.ok || data.error) {
    throw new Error(`${model}: ${data?.error?.message || 'HTTP ' + r.status}`);
  }

  return (data.content || [])
    .filter((c: any) => c.type === 'text')
    .map((c: any) => c.text)
    .join('\n');
}

/** Gemini 로 사진을 읽고, Gemini 가 실패하면 Claude(같은 프롬프트, 사진 첨부)로 대신 읽습니다 */
async function readImage(env: Env, mode: Mode, imageBase64: string, mimeType: string) {
  const visionModel = env.LENS_VISION_MODEL || LENS_MODELS.vision;
  const prompt = visionPrompt(mode);

  try {
    if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY 없음');
    }

    return { parsed: await geminiVision(env, visionModel, prompt, imageBase64, mimeType), reader: visionModel };
  } catch (e: any) {
    const text = await claudeText(
      env,
      LENS_MODELS.writer,
      [{ type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } }, { type: 'text', text: prompt }],
      1500,
    );
    const parsed = extractJson(text);

    if (!parsed) {
      throw new Error(`사진 읽기 실패 — Gemini: ${e.message}; Claude: JSON 없음`);
    }

    return { parsed, reader: `${LENS_MODELS.writer} (Gemini 실패: ${String(e.message).slice(0, 120)})` };
  }
}

function buildFinal(mode: Mode, parsed: any, easy: any) {
  const steps = (Array.isArray(easy?.steps) && easy.steps.length ? easy.steps : parsed?.steps || []).slice(0, 5);
  const final: any = {
    mode,
    type: parsed?.type || 'other',
    simpleExplanation: easy?.simpleExplanation || parsed?.simpleExplanation || '',
    steps,
    canvasAnimation: parsed?.canvasAnimation || {},
  };

  if (mode === 'document') {
    final.riskWarnings = Array.isArray(easy?.riskWarnings) ? easy.riskWarnings : Array.isArray(parsed?.riskWarnings) ? parsed.riskWarnings : [];
    final.urgency = easy?.urgency || parsed?.urgency || 'none';
    final.todayAdvice = easy?.todayAdvice || '';
    final.reassurance = easy?.reassurance || '';
    final.rawSummary = parsed?.rawSummary || '';
  } else if (mode === 'work') {
    final.portfolioTitle = easy?.portfolioTitle || parsed?.portfolioTitle || '';
    final.globalJobTitle = easy?.globalJobTitle || parsed?.globalJobTitle || '';
    final.skills = Array.isArray(easy?.skills) ? easy.skills : Array.isArray(parsed?.skills) ? parsed.skills : [];
    final.hireNote = easy?.hireNote || '';
    final.workDescription = parsed?.workDescription || '';
  } else {
    final.productName = easy?.productName || parsed?.productName || '';
    final.brand = easy?.brand || parsed?.brand || '';
    final.authenticity = easy?.authenticity || '';
    final.priceAnalysis = easy?.priceAnalysis || '';
    final.safety = easy?.safety || parsed?.safety || '';
    final.cheapestHint = easy?.cheapestHint || '';
    final.searchKeywords = easy?.searchKeywords || parsed?.searchKeywords || '';
    final.priceSeen = parsed?.priceSeen || '';
    final.expiry = parsed?.expiry || '';
    final.origin = parsed?.origin || '';
  }

  return final;
}

/* ── 영상·사진 저장 (R2 MEDIA 바인딩 → /media/lens/...) ───────────────── */
async function saveMedia(env: Env, key: string, bytes: Uint8Array, contentType: string) {
  if (!env.MEDIA || typeof env.MEDIA.put !== 'function') {
    throw new Error('R2 저장소 연결(MEDIA 바인딩)이 없습니다');
  }

  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType } });

  return '/media/' + key;
}

function videoPrompt(mode: Mode, x: any) {
  const base = 'Vertical 9:16, warm bright studio lighting, clean white background, smooth slow camera move, no text overlays, no real celebrities.';

  if (mode === 'work') {
    return `${base} A skilled ${x.globalJobTitle || 'worker'} at work: ${String(x.workDescription || x.simpleExplanation || '').slice(0, 300)}. Confident, professional portfolio mood.`;
  }

  if (mode === 'shop') {
    return `${base} Product showcase of ${x.brand ? x.brand + ' ' : ''}${x.productName || 'the product'} rotating slowly on a pedestal, close-up on label details, trustworthy retail mood.`;
  }

  return `${base} A friendly teacher standing beside a large simple illustrated board, explaining calmly: ${String(x.simpleExplanation || '').slice(0, 300)}.`;
}

/* ══════════════ POST ══════════════ */
export async function action({ request, context }: ActionFunctionArgs) {
  const env = envOf(context) as Env;
  const c = sb(env);
  const body = await readJson<any>(request);
  const op = String(body.op || 'analyze');
  const mode: Mode = MODES.includes(body.mode) ? body.mode : 'document';
  const lang = /^[a-z]{2}$/.test(String(body.lang || '')) ? String(body.lang) : 'ko';
  const hash = String(body.hash || '').replace(/[^a-f0-9]/gi, '').slice(0, 64);

  if (!c) {
    return fail('서버 설정(SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY)이 없습니다', 500);
  }

  const user = await getUserId(request, env);

  if (!user) {
    return fail('로그인이 필요합니다', 401);
  }

  if (!hash) {
    return fail('hash 가 없습니다', 400);
  }

  const cost = costs(env);

  /* ── 분석 ─────────────────────────────────────────── */
  if (op === 'analyze') {
    const imageBase64 = String(body.imageBase64 || '').replace(/^data:[^,]+,/, '');
    const mimeType = /^image\/(jpeg|png|webp)$/.test(body.mimeType || '') ? body.mimeType : 'image/jpeg';

    const cached = await getLens(c, hash, mode, lang);

    if (cached && cached.result) {
      await patchLens(c, hash, mode, lang, { view_count: Number(cached.view_count || 1) + 1 }).catch(() => undefined);

      return ok({
        cached: true,
        cost: 0,
        viewCount: Number(cached.view_count || 1) + 1,
        videoUrl: cached.video_url || null,
        photoUrl: cached.photo_url || null,
        ...cached.result,
      });
    }

    if (!imageBase64) {
      return fail('imageBase64 가 없습니다', 400);
    }

    if (imageBase64.length > 6_000_000) {
      return fail('사진이 너무 큽니다 (4MB 이하로 줄여 주세요)', 413);
    }

    const s = await spend(c, user.id, cost.analyze, 'lens', `[렌즈·${mode}] 사진 분석`).catch((e: any) => ({ ok: false, reason: String(e.message || e) }));

    if (!s || !s.ok) {
      return fail('insufficient', 402, { need: cost.analyze, free: s?.free ?? 0, paid: s?.paid ?? 0, reason: s?.reason || '' });
    }

    try {
      const { parsed, reader } = await readImage(env, mode, imageBase64, mimeType);
      const easyText = await claudeText(env, LENS_MODELS.writer, [{ type: 'text', text: writerPrompt(mode, lang, parsed) }], 1200);
      const easy = extractJson(easyText);
      const final = buildFinal(mode, parsed, easy);

      // 같은 사진을 다른 사람이 먼저 저장했을 수도 있어 upsert (image_hash+mode+language 가 유일키)
      await fetch(`${c.url}/rest/v1/cf_lens?on_conflict=image_hash,mode,language`, {
        method: 'POST',
        headers: sbHeaders(c, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify({
          image_hash: hash,
          mode,
          language: lang,
          type: final.type,
          result: final,
          user_id: user.id,
          reader,
          updated_at: new Date().toISOString(),
        }),
      });
      await jobDone(c, s.job_id);

      return ok({ cached: false, cost: cost.analyze, free: s.free, paid: s.paid, viewCount: 1, videoUrl: null, photoUrl: null, ...final });
    } catch (e: any) {
      await refund(c, s.job_id);

      return fail(String(e.message || e).slice(0, 400), 500, { refunded: true });
    }
  }

  /* ── 영상 시작 ────────────────────────────────────── */
  if (op === 'video') {
    const row = await getLens(c, hash, mode, lang);

    if (!row || !row.result) {
      return fail('먼저 사진을 분석해 주세요', 400);
    }

    if (row.video_url) {
      return ok({ reused: true, cost: 0, videoUrl: row.video_url });
    }

    if (row.video_status === 'running' || row.video_status === 'finalizing') {
      return ok({ started: true, running: true, cost: 0 });
    }

    if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return fail('GOOGLE_GENERATIVE_AI_API_KEY 가 없습니다');
    }

    const s = await spend(c, user.id, cost.video, 'lens_video', `[렌즈·${mode}] 설명 영상`).catch((e: any) => ({ ok: false, reason: String(e.message || e) }));

    if (!s || !s.ok) {
      return fail('insufficient', 402, { need: cost.video, free: s?.free ?? 0, paid: s?.paid ?? 0, reason: s?.reason || '' });
    }

    try {
      const r = await googleFetch(env, `/v1beta/models/${env.VIDEO_MODEL || LENS_MODELS.video}:predictLongRunning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: videoPrompt(mode, row.result) }],
          // 스튜디오와 같은 값: 720p · 8초 (Veo 3.1 은 4~8초만 허용)
          parameters: { aspectRatio: '9:16', resolution: '720p', durationSeconds: 8, sampleCount: 1 },
        }),
      });
      const d: any = await r.json().catch(() => ({}));

      if (!r.ok || !d.name) {
        throw new Error('Veo ' + r.status + ': ' + (d?.error?.message || JSON.stringify(d).slice(0, 300)));
      }

      await patchLens(c, hash, mode, lang, { video_status: 'running', video_op: d.name, video_job: s.job_id, video_user: user.id });

      return ok({ started: true, cost: cost.video, free: s.free, paid: s.paid });
    } catch (e: any) {
      await refund(c, s.job_id);

      return fail(String(e.message || e).slice(0, 400), 500, { refunded: true });
    }
  }

  /* ── 스튜디오 사진 (gpt image 2) ───────────────────── */
  if (op === 'photo') {
    if (mode === 'document') {
      return fail('문서 모드에는 사진 생성이 없습니다', 400);
    }

    const row = await getLens(c, hash, mode, lang);

    if (!row || !row.result) {
      return fail('먼저 사진을 분석해 주세요', 400);
    }

    if (row.photo_url) {
      return ok({ reused: true, cost: 0, photoUrl: row.photo_url });
    }

    if (!env.OPENAI_API_KEY) {
      return fail('OPENAI_API_KEY 가 없습니다');
    }

    const s = await spend(c, user.id, cost.photo, 'lens_photo', `[렌즈·${mode}] 스튜디오 사진`).catch((e: any) => ({ ok: false, reason: String(e.message || e) }));

    if (!s || !s.ok) {
      return fail('insufficient', 402, { need: cost.photo, free: s?.free ?? 0, paid: s?.paid ?? 0, reason: s?.reason || '' });
    }

    try {
      const x = row.result;
      const prompt =
        mode === 'work'
          ? `Professional portfolio photo of a ${x.globalJobTitle || 'skilled worker'} at work: ${String(x.workDescription || x.simpleExplanation || '').slice(0, 300)}. Natural light, respectful, no text.`
          : `Clean e-commerce studio photo of ${x.brand ? x.brand + ' ' : ''}${x.productName || 'the product'} on a white background, soft shadow, no text, no logos other than what the product has.`;
      const r = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: LENS_MODELS.photo, prompt, n: 1, size: '1024x1024', quality: 'medium' }),
      });
      const d: any = await r.json().catch(() => ({}));

      if (!r.ok || d.error) {
        throw new Error(`${LENS_MODELS.photo}: ${d?.error?.message || 'HTTP ' + r.status}`);
      }

      const b64: string = d.data?.[0]?.b64_json || '';

      if (!b64) {
        throw new Error('gpt image 2 결과가 없습니다');
      }

      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);

      for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
      }

      const url = await saveMedia(env, `lens/${hash}-${mode}.png`, bytes, 'image/png');
      await patchLens(c, hash, mode, lang, { photo_url: url });
      await jobDone(c, s.job_id);

      return ok({ reused: false, cost: cost.photo, free: s.free, paid: s.paid, photoUrl: url });
    } catch (e: any) {
      await refund(c, s.job_id);

      return fail(String(e.message || e).slice(0, 400), 500, { refunded: true });
    }
  }

  return fail('op 가 잘못되었습니다', 400);
}

/* ══════════════ GET (영상 상태) ══════════════ */
export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = envOf(context) as Env;
  const c = sb(env);
  const url = new URL(request.url);
  const op = url.searchParams.get('op') || '';

  if (op === 'costs') {
    return ok({ costs: costs(env), models: LENS_MODELS });
  }

  if (op !== 'status') {
    return fail('op 가 잘못되었습니다', 400);
  }

  if (!c) {
    return fail('서버 설정이 없습니다', 500);
  }

  const user = await getUserId(request, env);

  if (!user) {
    return fail('로그인이 필요합니다', 401);
  }

  const hash = String(url.searchParams.get('hash') || '').replace(/[^a-f0-9]/gi, '').slice(0, 64);
  const modeQ = url.searchParams.get('mode') || 'document';
  const mode: Mode = MODES.includes(modeQ as Mode) ? (modeQ as Mode) : 'document';
  const langQ = url.searchParams.get('lang') || 'ko';
  const lang = /^[a-z]{2}$/.test(langQ) ? langQ : 'ko';
  const row = await getLens(c, hash, mode, lang);

  if (!row) {
    return fail('없는 항목입니다', 404);
  }

  if (row.video_url) {
    return ok({ status: 'done', videoUrl: row.video_url });
  }

  if (row.video_status === 'failed') {
    return ok({ status: 'failed', error: row.video_error || '' });
  }

  if (row.video_status !== 'running' || !row.video_op) {
    return ok({ status: row.video_status || 'none' });
  }

  // 구글 작업 상태
  let opData: any;

  try {
    const r = await googleFetch(env, `/v1beta/${row.video_op}`, { method: 'GET' });
    opData = await r.json();
  } catch (e: any) {
    return ok({ status: 'running', note: String(e.message || e).slice(0, 200) });
  }

  if (!opData || !opData.done) {
    return ok({ status: 'running' });
  }

  // 여러 사람이 동시에 확인해도 한 번만 마무리하도록 running → finalizing 을 먼저 잡습니다 (gen.js 와 같은 방식)
  const locked = await patchLens(c, hash, mode, lang, { video_status: 'finalizing' }, 'video_status=eq.running');

  if (!locked) {
    return ok({ status: 'running' });
  }

  try {
    if (opData.error) {
      throw new Error(opData.error.message || JSON.stringify(opData.error).slice(0, 300));
    }

    const resp = opData.response || {};
    const samples = (resp.generateVideoResponse && resp.generateVideoResponse.generatedSamples) || [];
    const uri: string | undefined = samples[0]?.video?.uri;

    if (!uri) {
      const filtered = resp.generateVideoResponse?.raiMediaFilteredReasons;
      throw new Error(filtered ? '구글 안전 필터로 생성되지 않았습니다 (' + JSON.stringify(filtered).slice(0, 160) + ')' : '영상 결과가 없습니다');
    }

    const dl = await googleFetch(env, uri, { method: 'GET' });

    if (!dl.ok) {
      throw new Error('google download ' + dl.status);
    }

    const bytes = new Uint8Array(await dl.arrayBuffer());
    const videoUrl = await saveMedia(env, `lens/${hash}-${mode}-${lang}.mp4`, bytes, 'video/mp4');
    await patchLens(c, hash, mode, lang, { video_status: 'done', video_url: videoUrl, video_error: null });
    await jobDone(c, row.video_job);

    return ok({ status: 'done', videoUrl });
  } catch (e: any) {
    const msg = String(e.message || e).slice(0, 500);
    await refund(c, row.video_job);
    await patchLens(c, hash, mode, lang, { video_status: 'failed', video_error: msg });

    return ok({ status: 'failed', error: msg, refunded: true });
  }
}
