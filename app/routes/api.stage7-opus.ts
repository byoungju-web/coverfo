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

  const { prompt, spec, research, assets } = await readJson<{
    prompt?: string;
    spec?: unknown;
    research?: unknown;
    assets?: { image1?: boolean; image2?: boolean; video?: boolean; video3d?: boolean; model?: boolean };
  }>(request);
  const a = assets || {};

  const assetLines = [
    a.image1 ? '- {{IMAGE_1}} : hero photo (use as <img src="{{IMAGE_1}}"> or CSS background)' : '',
    a.image2 ? '- {{IMAGE_2}} : refined product/detail photo (use as <img src="{{IMAGE_2}}">)' : '',
    a.video ? '- {{VIDEO_URL}} : 5 second mp4 (use <video src="{{VIDEO_URL}}" autoplay muted loop playsinline>)' : '',
    a.video3d
      ? '- {{VIDEO_3D_URL}} : 4 second 360° turntable 3D video of the main subject (put it in a "3D 미리보기" section as <video src="{{VIDEO_3D_URL}}" autoplay muted loop playsinline> inside a rounded card; if the request is a 3D game or scene, ALSO build the interactive 3D part with Three.js primitives)'
      : '',
    a.model
      ? '- {{MODEL_URL}} : GLB 3D model (load with Three.js GLTFLoader from CDN and show it in an interactive viewer with OrbitControls)'
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
