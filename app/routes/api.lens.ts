/*
 * coverfo Lens v3 — 🎬 LifeMovie(문서·상품 → 설명 + 드라마 각색 + 언박싱 리뷰 + 최저가) · 💼 WorkTok(일 → 히어로 포트폴리오 + 채용 + 최저가)
 *   서버 라우트 (Remix + Cloudflare Pages). 이전 FogLens/WorkLens(document/work)의 기능은 전부 포함하고 드라마·리뷰·밈 템플릿이 추가됨.
 *
 *   POST /api/lens  {op:'analyze', mode, imageBase64, mimeType, hash, lang}
 *        → 사진 1장 분석. 같은 사진(hash)+모드+언어가 cf_lens 표에 있으면 캐시로 돌려주고 크레딧 0.
 *          없으면 크레딧 1 차감 → Gemini(사진 읽기) → Claude Fable 5.1(쉬운 말 정리) → cf_lens 저장.
 *   POST /api/lens  {op:'video', mode, hash, lang}
 *        → 설명 영상(Veo 3.1 fast, 9:16, 8초) 시작. 이미 영상이 있으면 재사용(크레딧 0). 없으면 25 차감.
 *   POST /api/lens  {op:'photo', mode, hash, lang}
 *        → (일 모드, 또는 문서 모드에서 제품이 읽힌 경우) gpt image 2 로 스튜디오 사진 1장. 이미 있으면 재사용(0), 없으면 2 차감.
 *   GET  /api/lens?op=status&hash=...&mode=...&lang=...
 *        → 영상 진행 상태. 완성되면 구글에서 받아 R2(MEDIA 바인딩)에 저장하고 /media/lens/... 주소를 돌려줌.
 *
 * 공용 도우미(app/lib/engine/server.ts)의 googleFetch·anthropicFetch 를 쓰므로
 * 구글·Anthropic 호출은 엔진·스튜디오와 똑같이 Supabase Edge Function 중계(서울 ap-northeast-2)를 탑니다.
 * 크레딧은 스튜디오·엔진과 같은 Supabase 함수 cf_spend / cf_refund 를 씁니다.
 * 분석 뒤 Brave(app/lib/.server/brave.ts, Secret BRAVE_API_KEY)로 "최저가 3개"(두 탭)와 "외주 3명"(일 탭)을 찾아
 * result 에 같이 저장합니다 — 캐시 적중 시에는 다시 검색하지 않음. 키가 없거나 실패하면 쇼핑·외주 없이 진행.
 *
 * 단가(크레딧)는 Cloudflare 변수로 바꿀 수 있습니다: COST_LENS(1) COST_LENS_VIDEO(25) COST_LENS_PHOTO(2)
 * 모델은 아래 LENS_MODELS 한 곳에서 관리합니다 (Cloudflare 변수 LENS_VISION_MODEL 로 사진 읽기 모델만 바꿀 수 있음).
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';
import { anthropicFetch, envOf, extractJson, fail, getUserId, googleFetch, ok, readJson } from '~/lib/engine/server';
import { ENGINE_MODELS } from '~/lib/engine/models';
import { braveSearch } from '~/lib/.server/brave';

/* ── 모델 (현재 coverfo 가 쓰는 것과 같은 ID) ─────────────────────────── */
const LENS_MODELS = {
  vision: ENGINE_MODELS.stage3, // gemini-3.1-flash-image — 사진 읽기(글자·물건·동작). 응답은 글(TEXT)만 받음
  writer: ENGINE_MODELS.stage1, // claude-fable-5-1 — 쉬운 말로 정리 + 사용자 언어로
  photo: ENGINE_MODELS.stage4, // gpt-image-2 — 일·상품 스튜디오 사진 (quality medium)
  video: 'veo-3.1-fast-generate-preview', // 스튜디오(functions/api/gen.js)와 같은 영상 모델
} as const;

type Mode = 'lifemovie' | 'worktok';
const MODES: Mode[] = ['lifemovie', 'worktok'];
// 예전 탭 이름으로 와도 받아 줍니다 (document → lifemovie, work → worktok)
const MODE_ALIAS: Record<string, Mode> = { document: 'lifemovie', shop: 'lifemovie', work: 'worktok' };
function toMode(v: any): Mode {
  const m = String(v || '');
  return (MODES as string[]).includes(m) ? (m as Mode) : MODE_ALIAS[m] || 'lifemovie';
}
// 캔버스 밈 템플릿 20개 (화면 쪽 MEMES 와 이름이 같아야 함)
const MEMES = ['pop_check', 'trash_drop', 'warning_shake', 'celebrate', 'search', 'rotate_3d', 'money', 'medical', 'legal', 'education', 'hero', 'drama', 'shopping', 'work', 'fire', 'heart', 'star', 'rocket', 'crown', 'diamond'];

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

const PRIVACY_RULE = `Privacy rule: never output a real person's name read from the photo or guessed from a face; refer to people only by a playful nickname (e.g. "the night-shift hero"). Do not describe facial features.`;
const MEME_RULE = `"canvasMeme" must be one of: ${MEMES.join('|')}.`;

function visionPrompt(mode: Mode) {
  if (mode === 'worktok') {
    return `You are WorkTok. Look at this photo of someone working (farming, cooking, repair, beauty, sewing, construction, office/computer work, any trade).
${PRIVACY_RULE}
Return ONLY a JSON object:
{"type":"<short category>","workDescription":"<what exactly is being done, tools, materials, visible skill level>",
 "skills":["<skill>","..."],"portfolioTitle":"<3-6 word portfolio title>","globalJobTitle":"<internationally understood job title in English>",
 "steps":[{"icon":"<one emoji>","title":"<short>","desc":"<one sentence>"}] (3-4 steps of the work shown),
 "workNeeded":{"title":"<the task in 3-6 words>","skill":"<main skill>","estimatedTime":"<e.g. 2 hours>","difficulty":"<easy|medium|hard>","impact":"<one phrase: what this work makes possible>"},
 "dramaStory":{"title":"<catchy 2-5 word hero-movie title>","logline":"<one sentence movie logline about this worker>","heroName":"<nickname, never a real name>","conflict":"<the challenge in this scene>","caption":"<short social caption with 2-3 hashtags>"},
 "outsourceSkill":"<2-4 words: the skill someone would hire for this work>",
 "shoppingKeywords":["<2-4 word product name of a tool/material visible or needed for this work>"] (max 2, or empty),
 "canvasMeme":"<see rule>","canvasAnimation":{"bgColor":"<hex color that suits the trade>"}}
${MEME_RULE}`;
  }

  return `You are LifeMovie. Look at this photo. It may be a document (prescription, contract, bill, homework, notice, foreign menu, sign, form),
a product (package, label, price tag, receipt), or any everyday scene. Read every visible text carefully. ${PRIVACY_RULE}
Return ONLY a JSON object:
{"type":"<category: prescription|contract|bill|notice|homework|menu|form|product|scene|other>",
 "rawSummary":"<what it literally says or shows: key names(no real person names), numbers, dates, amounts>",
 "extractedText":"<ALL readable text in the photo, verbatim, in its original language, line breaks as \\n (max ~1500 chars); empty if no text>",
 "sourceLang":"<ISO 639-1 code of the text's language, e.g. en, ko, ja, zh, th, vi; empty if no text>",
 "simpleExplanation":"<2-3 sentences: what this is and what it means for the person holding it>",
 "riskWarnings":["<deadline, fee, penalty, side effect, allergen, expiry, clause to be careful of>"],"urgency":"<none|low|medium|high>",
 "steps":[{"icon":"<one emoji>","title":"<short>","desc":"<one sentence>"}] (3-4 actions to take, in order),
 "productName":"<if a product: name as printed, else empty>","brand":"<brand or empty>","priceSeen":"<price printed if any>","expiry":"<expiry date if printed>",
 "productFacts":"<if a product: ingredients/specs/claims printed on it, short; else empty>",
 "dramaStory":{"title":"<catchy 2-5 word K-drama style title for this photo>","logline":"<one sentence dramatic logline>","heroName":"<nickname of the main character or object, never a real name>","conflict":"<the tension in this scene>","caption":"<short social caption with 2-3 hashtags>"},
 "shoppingKeywords":["<2-4 word product name to search for buying — only if this is a product or the document names a specific product to buy; else empty>"] (max 2),
 "canvasMeme":"<see rule>","canvasAnimation":{"bgColor":"<hex>"}}
${MEME_RULE}`;
}

function writerPrompt(mode: Mode, lang: string, parsed: any) {
  const langName = LANG_NAME[lang] || lang;
  const common = `Write everything in ${langName}, for a person who has no expert knowledge — short, warm, concrete, no jargon.
Keep facts exactly as given (names, numbers, dates); do not invent details that are not in the data. Return ONLY a JSON object.`;

  if (mode === 'worktok') {
    return `${common} ${PRIVACY_RULE}
Data: ${JSON.stringify(parsed).slice(0, 3000)}
JSON: {"simpleExplanation":"<2 sentences describing this person's work and strength>","portfolioTitle":"<title in ${langName}>",
 "globalJobTitle":"<job title in English>","skills":["..."],"steps":[{"icon":"<emoji>","title":"...","desc":"..."}],
 "hireNote":"<one sentence an employer would like to read about this worker>",
 "workNeeded":{"title":"...","skill":"...","estimatedTime":"...","difficulty":"<easy|medium|hard>","impact":"..."},
 "dramaStory":{"title":"<in ${langName}>","logline":"<in ${langName}>","heroName":"<nickname in ${langName}>","conflict":"<in ${langName}>","caption":"<in ${langName}, 2-3 hashtags>"},
 "shareText":"<2 lines someone would post with this photo, in ${langName}>",
 "outsourceSkill":"<2-4 words in ${langName}: the skill to hire for this work>","shoppingKeywords":["<product name in ${langName}>"] (max 2, keep from data or empty)}`;
  }

  const src = String(parsed?.sourceLang || '').toLowerCase();
  const needTr = !!(parsed?.extractedText && src && src !== lang);

  return `${common} ${PRIVACY_RULE}
Data: ${JSON.stringify(parsed).slice(0, 4500)}
JSON: {"simpleExplanation":"<2-3 sentences>","riskWarnings":["..."],"urgency":"<none|low|medium|high>",
 "translation":${needTr ? `"<faithful full translation of extractedText into ${langName}, keep line breaks as \\n, keep numbers/names/dates exactly>"` : 'null'},
 "steps":[{"icon":"<emoji>","title":"...","desc":"..."}],"todayAdvice":"<the single most important thing to do today>",
 "reassurance":"<one calm, honest sentence>","productName":"<keep from data or empty>","brand":"<keep or empty>",
 "dramaStory":{"title":"<in ${langName}>","logline":"<in ${langName}>","heroName":"<nickname in ${langName}>","conflict":"<in ${langName}>","caption":"<in ${langName}, 2-3 hashtags>"},
 "shareText":"<2 lines someone would post with this photo, in ${langName}>",
 "unboxReview":<only if productName is not empty, else null> {"hook":"<one-line opening like a creator's unboxing video>","firstImpression":"<packaging/label impression from what is visible>","pros":["<3 likely strengths based ONLY on printed facts>"],"cons":["<2 honest cautions based on printed facts or missing info>"],"verdict":"<one sentence>","score":<1-5>},
 "shoppingKeywords":["<product name in ${langName}>"] (max 2, keep from data or empty)}`;
}

/* ── 모델 호출 ─────────────────────────────────────────────────────── */
async function geminiVision(env: Env, model: string, prompt: string, imageBase64: string, mimeType: string) {
  const r = await googleFetch(env, `/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: imageBase64 } }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2500, responseModalities: ['TEXT'] },
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
      2500,
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

  const kw = Array.isArray(easy?.shoppingKeywords) && easy.shoppingKeywords.length ? easy.shoppingKeywords : Array.isArray(parsed?.shoppingKeywords) ? parsed.shoppingKeywords : [];
  final.shoppingKeywords = kw.map((k: any) => String(k || '').trim()).filter(Boolean).slice(0, 2);
  final.productName = easy?.productName || parsed?.productName || '';
  final.brand = easy?.brand || parsed?.brand || '';
  final.canvasMeme = MEMES.includes(parsed?.canvasMeme) ? parsed.canvasMeme : mode === 'worktok' ? 'hero' : 'drama';

  const ds = (easy?.dramaStory && typeof easy.dramaStory === 'object' ? easy.dramaStory : parsed?.dramaStory) || {};
  final.dramaStory = {
    title: String(ds.title || ''),
    logline: String(ds.logline || ''),
    heroName: String(ds.heroName || ''),
    conflict: String(ds.conflict || ''),
    caption: String(ds.caption || ''),
  };
  final.shareText = String(easy?.shareText || ds.caption || '');

  if (mode === 'lifemovie') {
    const ur = easy?.unboxReview;
    final.unboxReview =
      final.productName && ur && typeof ur === 'object'
        ? {
            hook: String(ur.hook || ''),
            firstImpression: String(ur.firstImpression || ''),
            pros: Array.isArray(ur.pros) ? ur.pros.map(String).slice(0, 3) : [],
            cons: Array.isArray(ur.cons) ? ur.cons.map(String).slice(0, 2) : [],
            verdict: String(ur.verdict || ''),
            score: Math.min(5, Math.max(1, Number(ur.score) || 3)),
          }
        : null;
    final.productFacts = parsed?.productFacts || '';
    final.riskWarnings = Array.isArray(easy?.riskWarnings) ? easy.riskWarnings : Array.isArray(parsed?.riskWarnings) ? parsed.riskWarnings : [];
    final.urgency = easy?.urgency || parsed?.urgency || 'none';
    final.todayAdvice = easy?.todayAdvice || '';
    final.reassurance = easy?.reassurance || '';
    final.rawSummary = parsed?.rawSummary || '';
    final.priceSeen = parsed?.priceSeen || '';
    final.expiry = parsed?.expiry || '';
    final.extractedText = String(parsed?.extractedText || '').slice(0, 3000);
    final.sourceLang = String(parsed?.sourceLang || '').toLowerCase().slice(0, 5);
    final.translation = typeof easy?.translation === 'string' ? easy.translation.slice(0, 4000) : '';
  } else {
    final.portfolioTitle = easy?.portfolioTitle || parsed?.portfolioTitle || '';
    final.globalJobTitle = easy?.globalJobTitle || parsed?.globalJobTitle || '';
    final.skills = Array.isArray(easy?.skills) ? easy.skills : Array.isArray(parsed?.skills) ? parsed.skills : [];
    final.hireNote = easy?.hireNote || '';
    final.workDescription = parsed?.workDescription || '';
    final.outsourceSkill = easy?.outsourceSkill || parsed?.outsourceSkill || '';

    const wn = (easy?.workNeeded && typeof easy.workNeeded === 'object' ? easy.workNeeded : parsed?.workNeeded) || {};
    final.workNeeded = {
      title: String(wn.title || ''),
      skill: String(wn.skill || ''),
      estimatedTime: String(wn.estimatedTime || ''),
      difficulty: String(wn.difficulty || ''),
      impact: String(wn.impact || ''),
    };
  }

  return final;
}

/* ── Brave: 최저가 3개(두 탭) · 외주 3명(일 탭) ──────────────────────── */
type Link = { title: string; url: string; price: string; snippet: string };

function priceIn(text: string) {
  const m = String(text || '').match(/(?:₩|\$|€|£|฿)\s?\d[\d,.]*|\d[\d,.]*\s?(?:원|円|元|บาท|USD|KRW)/);

  return m ? m[0] : '';
}

async function braveLinks(env: Env, q: string, n: number): Promise<Link[]> {
  const rs = await braveSearch(env, q, 8);

  return rs.slice(0, n).map((r) => ({ title: r.title, url: r.url, price: priceIn(r.description), snippet: r.description.slice(0, 80) }));
}

/** 분석 결과에 shopping(최저가 3개)·workers(외주 3명)를 붙입니다. 키가 없거나 실패하면 빈 배열(화면에 칸이 안 보임) */
async function addBrave(env: Env, mode: Mode, final: any, lang: string) {
  final.shopping = [];
  final.workers = [];

  const product = String(final.productName || (final.shoppingKeywords || [])[0] || '').trim();
  const cheapest = { ko: '최저가', ja: '最安値', zh: '最低价', th: 'ราคาถูกที่สุด' }[lang] || 'best price';
  const outsource = { ko: '외주 크몽 숨고', ja: '外注 依頼', zh: '外包 接单', th: 'จ้างฟรีแลนซ์' }[lang] || 'freelancer hire';

  if (!env.BRAVE_API_KEY) {
    return final;
  }

  if (product) {
    try {
      final.shopping = await braveLinks(env, `${product} ${cheapest}`, 3);
    } catch {
      final.shopping = [];
    }

    if (!final.shopping.length && lang === 'ko') {
      // 검색 결과가 없으면 쿠팡·네이버 검색 링크로 대체 (한국어일 때만)
      final.shopping = [
        { title: `쿠팡에서 "${product}" 검색`, url: `https://www.coupang.com/np/search?q=${encodeURIComponent(product)}`, price: '', snippet: '쿠팡' },
        { title: `네이버 쇼핑에서 "${product}" 비교`, url: `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(product)}`, price: '', snippet: '네이버 쇼핑' },
      ];
    }
  }

  if (mode === 'worktok') {
    const skill = String(final.outsourceSkill || final.globalJobTitle || '').trim();

    if (skill) {
      try {
        final.workers = await braveLinks(env, `${skill} ${outsource}`, 3);
      } catch {
        final.workers = [];
      }

      if (!final.workers.length && lang === 'ko') {
        final.workers = [
          { title: `크몽에서 "${skill}" 전문가 찾기`, url: `https://kmong.com/search?keyword=${encodeURIComponent(skill)}`, price: '', snippet: '크몽' },
          { title: `숨고에서 "${skill}" 고수 찾기`, url: `https://soomgo.com/search?query=${encodeURIComponent(skill)}`, price: '', snippet: '숨고' },
        ];
      }
    }
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

  if (mode === 'worktok') {
    return `${base} A skilled ${x.globalJobTitle || 'worker'} at work: ${String(x.workDescription || x.simpleExplanation || '').slice(0, 300)}. Confident, professional portfolio mood.`;
  }

  if (x.type === 'product' && x.productName) {
    return `${base} Product showcase of ${x.brand ? x.brand + ' ' : ''}${x.productName || 'the product'} rotating slowly on a pedestal, close-up on label details, trustworthy retail mood.`;
  }

  const ds = x.dramaStory || {};

  return `${base} Cinematic K-drama style trailer shot titled "${String(ds.title || '').slice(0, 60)}": ${String(ds.logline || x.simpleExplanation || '').slice(0, 300)}. No real people's likeness, no text.`;
}

/* ══════════════ POST ══════════════ */
export async function action({ request, context }: ActionFunctionArgs) {
  const env = envOf(context) as Env;
  const c = sb(env);
  const body = await readJson<any>(request);
  const op = String(body.op || 'analyze');
  const mode: Mode = toMode(body.mode);
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
      const easyText = await claudeText(env, LENS_MODELS.writer, [{ type: 'text', text: writerPrompt(mode, lang, parsed) }], 2500);
      const easy = extractJson(easyText);
      const final = await addBrave(env, mode, buildFinal(mode, parsed, easy), lang);

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
    const row = await getLens(c, hash, mode, lang);

    if (!row || !row.result) {
      return fail('먼저 사진을 분석해 주세요', 400);
    }

    if (mode === 'lifemovie' && !row.result.productName) {
      return fail('제품이 읽힌 경우에만 스튜디오 사진을 만들 수 있습니다', 400);
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
        mode === 'worktok'
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
  const mode: Mode = toMode(url.searchParams.get('mode'));
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
