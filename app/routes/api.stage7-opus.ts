// 7단계 Opus 4.5 — 앞 단계 결과를 모아 최종 index.html 생성
// 이미지·영상·3D 는 자리표시자({{IMAGE_1}} 등)로 넣고, 엔진 화면이 실제 데이터로 바꿔 끼웁니다.
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { anthropicStreamResponse, envOf, fail, readJson, requireLogin } from '~/lib/engine/server';
import { ENGINE_MODELS } from '~/lib/engine/models';

export async function action({ request, context }: ActionFunctionArgs) {
  const env = envOf(context);
  const denied = await requireLogin(request, env);

  if (denied) {
    return denied;
  }

  const { prompt, spec, research, assets, previousHtml, changeRequest } = await readJson<{
    prompt?: string;
    spec?: unknown;
    research?: unknown;
    assets?: { image1?: boolean; image2?: boolean; video?: boolean; video3d?: boolean; model?: boolean };
    previousHtml?: string;
    changeRequest?: string;
  }>(request);
  const a = assets || {};

  /*
   * 수정 모드: 이전에 만든 index.html(에셋은 자리표시자로 바꾼 상태)과 고칠 점을 받아,
   * 이미지·영상·3D 모델은 그대로 두고 요청한 부분만 바꾼 완성본을 돌려줍니다 (1~6단계 다시 안 돌림)
   */
  if (previousHtml && changeRequest) {
    try {
      return await anthropicStreamResponse(
        env,
        ENGINE_MODELS.stage7,
        `You are the Final Coding Engine of coverfo 3D Orchestrator, in EDIT mode.
Below is the CURRENT index.html of a project that was already built. Asset files were replaced by placeholder strings
({{IMAGE_1}}, {{IMAGE_2}}, {{VIDEO_URL}}, {{MODEL_URL}}) — keep every placeholder EXACTLY as written; they are real files (photos, a 4-second mp4, a GLB 3D model) and must stay in use.

CHANGE REQUEST (Korean): ${changeRequest}

Rules:
- Apply the change request on top of the current page. Keep everything the user did not ask to change (layout, texts, colors, the 3D model viewer, video, images).
- If the request is about the 3D scene (background, stars, galaxy, lighting, ground, particles, camera, animation, controls, game rules…), modify the Three.js code accordingly while still loading {{MODEL_URL}} with GLTFLoader as the main object.
- Only CDN <script> tags (Three.js 0.160 from cdn.jsdelivr.net via importmap). No npm, no package.json, no build step.
- NO loading screen, NO preloader overlay; content visible immediately even if assets fail. Wrap 3D/CDN code in try/catch.
- Keep the whole file under 35,000 characters, compact CSS. Korean UI text.
- Include <!-- © 2026 coverfo All Rights Reserved — coverfo 3D Orchestrator Engine™ --> after <body>.
- Return ONLY the complete new HTML (from <!DOCTYPE html> to </html>), no markdown fences, no explanation.

CURRENT index.html:
${previousHtml.slice(0, 60000)}`,
        32000,
      );
    } catch (e: any) {
      return fail(e.message || String(e));
    }
  }

  const assetLines = [
    a.image1 ? '- {{IMAGE_1}} : hero photo (use as <img src="{{IMAGE_1}}"> or CSS background)' : '',
    a.image2 ? '- {{IMAGE_2}} : refined product/detail photo (use as <img src="{{IMAGE_2}}">)' : '',
    a.video ? '- {{VIDEO_URL}} : 5 second mp4 (use <video src="{{VIDEO_URL}}" autoplay muted loop playsinline>)' : '',
    a.video3d
      ? '- {{VIDEO_3D_URL}} : 4 second 360° turntable 3D video of the main subject (put it in a "3D 미리보기" section as <video src="{{VIDEO_3D_URL}}" autoplay muted loop playsinline> inside a rounded card; if the request is a 3D game or scene, ALSO build the interactive 3D part with Three.js primitives)'
      : '',
    a.model
      ? '- {{MODEL_URL}} : real GLB 3D model of the main subject (same-origin URL). Show it in a "3D 모델" section as an interactive viewer: <script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script> then a <script type="module"> using GLTFLoader + OrbitControls, auto-rotate, fit camera to the model bounding box, lights. If the request is a game, use this model as the player/main object in the game scene.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  // 글자를 받는 대로 흘려보냅니다(text/plain 스트림). 엔진 화면이 모아서 index.html 로 씁니다.
  try {
    return await anthropicStreamResponse(
      env,
      ENGINE_MODELS.stage7,
      `You are the Final Coding Engine of coverfo 3D Orchestrator.
User request: ${prompt || ''}
Spec: ${JSON.stringify(spec || {}).slice(0, 4000)}
Research: ${JSON.stringify(research || {}).slice(0, 1500)}

Available assets (use the placeholder strings EXACTLY as written, they will be replaced with real files later):
${assetLines || '(none — draw everything with CSS/Canvas/Three.js)'}

Task: write ONE complete single-file index.html with inline CSS and JavaScript. Korean UI text. Premium, responsive, interactive.
Rules:
- Only CDN <script> tags are allowed (Three.js from cdn.jsdelivr.net if 3D is needed). No npm, no package.json, no build step.
- If the request is a game, make it playable with controls, score and restart.
- If a {{MODEL_URL}} is given, load it with GLTFLoader; otherwise, if 3D is requested, build the scene from Three.js primitives.
- Keep the whole file under 35,000 characters: compact CSS (no long comment blocks, no repeated rules), at most 4–6 items per section. The output must finish with </body></html>.
- All content must be visible WITHOUT JavaScript: never set opacity:0 / visibility:hidden / transform on sections or cards waiting for a scroll or IntersectionObserver reveal. Use CSS-only hover/keyframe animations if you want motion.
- NO loading screen, NO preloader overlay, NO "loading..." splash that waits for assets. The page content (header, text, UI) must be visible immediately on first paint even if the video, images, or 3D fail to load.
- Any <video> must use preload="metadata" and must never block rendering; wrap CDN/3D code in try/catch so an error never hides the page.
- Every external <script>, <link>, <img>, <video> that points to another domain must include crossorigin="anonymous".
- Include <!-- © 2026 coverfo All Rights Reserved — coverfo 3D Orchestrator Engine™ --> after <body>.
- No syntax errors. Return ONLY the HTML, no markdown fences, no explanation.`,
      32000,
    );
  } catch (e: any) {
    return fail(e.message || String(e));
  }
}
