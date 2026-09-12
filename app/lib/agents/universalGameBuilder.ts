/*
 * app/lib/agents/universalGameBuilder.ts
 * 범용 3D 게임 템플릿 - 60초 동안 보석을 모으는 3D 게임 (PC 키보드 + 휴대폰 조이스틱·점프)
 * 캐릭터 모양은 게임 제목에 따라 사람·말·자동차 중에서 고름
 * 원작 표시: 게임 화면 오른쪽 위 작은 "coverfo로 만듦" 링크 + 파일 맨 위 주석 + generator 메타 태그
 * © bj Lee - coverfo.com - Uncovering the fog
 */

export type PlayerKind = 'runner' | 'horse' | 'car';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** 주석·문서에 넣을 한 줄짜리 제목 (줄바꿈 제거) */
function oneLine(text: string): string {
  return text.replace(/[\r\n]+/g, ' ');
}

/** 게임 규칙 파일(src/gameLogic.js) - 화면과 분리해서 테스트할 수 있게 만든 순수 함수들 */
export const gameLogicJs = `// src/gameLogic.js - 게임 규칙 (coverfo.com 3D 게임 템플릿)
// 숫자를 바꾸면 게임 난이도가 바뀝니다.

export const ARENA_HALF = 18; // 이동할 수 있는 범위 (가운데에서 끝까지)
export const MOVE_SPEED = 8; // 1초에 움직이는 거리
export const JUMP_SPEED = 8; // 점프 힘
export const GRAVITY = 20; // 떨어지는 힘
export const ROUND_SECONDS = 60; // 한 판 시간
export const ITEM_COUNT = 10; // 한 번에 보이는 보석 수
export const HIGH_ITEM_RATIO = 0.3; // 공중 보석 비율
export const PICK_RADIUS = 1.2; // 보석을 먹는 거리
export const GROUND_ITEM_Y = 0.8; // 바닥 보석 높이
export const HIGH_ITEM_Y = 2.6; // 공중 보석 높이 (점프해야 닿음)
export const PLAYER_CENTER = 1; // 캐릭터 몸 중심 높이

const REACH = 1.2;
const JOYSTICK_DEAD_ZONE = 0.15;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createPlayer() {
  return { x: 0, z: 0, y: 0, vy: 0, grounded: true, facing: Math.PI };
}

/** input: { x: -1~1 (왼쪽/오른쪽), z: -1~1 (앞/뒤), jump: true/false } */
export function stepPlayer(player, input, dt) {
  let ix = input.x || 0;
  let iz = input.z || 0;
  const length = Math.hypot(ix, iz);

  if (length > 1) {
    ix /= length;
    iz /= length;
  }

  const next = { ...player };
  next.x = clamp(player.x + ix * MOVE_SPEED * dt, -ARENA_HALF, ARENA_HALF);
  next.z = clamp(player.z + iz * MOVE_SPEED * dt, -ARENA_HALF, ARENA_HALF);

  if (length > 0.01) {
    next.facing = Math.atan2(ix, iz);
  }

  if (input.jump && player.grounded) {
    next.vy = JUMP_SPEED;
    next.grounded = false;
  }

  next.vy -= GRAVITY * dt;
  next.y += next.vy * dt;

  if (next.y <= 0) {
    next.y = 0;
    next.vy = 0;
    next.grounded = true;
  }

  return next;
}

export function canPick(player, item) {
  const dx = player.x - item.x;
  const dz = player.z - item.z;
  return dx * dx + dz * dz < PICK_RADIUS * PICK_RADIUS && Math.abs(item.y - (player.y + PLAYER_CENTER)) < REACH;
}

export function itemPoints(item) {
  return item.high ? 3 : 1;
}

/** 보석 하나를 무작위 위치에 만듦 (캐릭터 바로 옆에는 만들지 않음) */
export function spawnItem(random, player) {
  for (let i = 0; i < 20; i++) {
    const x = (random() * 2 - 1) * (ARENA_HALF - 1);
    const z = (random() * 2 - 1) * (ARENA_HALF - 1);

    if (!player || Math.hypot(x - player.x, z - player.z) > 4) {
      const high = random() < HIGH_ITEM_RATIO;
      return { x, z, y: high ? HIGH_ITEM_Y : GROUND_ITEM_Y, high };
    }
  }

  return { x: ARENA_HALF - 1, z: ARENA_HALF - 1, y: GROUND_ITEM_Y, high: false };
}

export function createRound(random, player) {
  const items = [];

  for (let i = 0; i < ITEM_COUNT; i++) {
    items.push(spawnItem(random, player));
  }

  return { score: 0, timeLeft: ROUND_SECONDS, items, over: false };
}

/** 한 프레임 진행: 시간 줄이기 + 닿은 보석 점수 올리고 새 보석으로 바꾸기 */
export function stepRound(round, player, dt, random) {
  if (round.over) {
    return { round, picked: [] };
  }

  const timeLeft = Math.max(0, round.timeLeft - dt);
  const picked = [];
  let score = round.score;

  const items = round.items.map((item, index) => {
    if (canPick(player, item)) {
      score += itemPoints(item);
      picked.push(index);
      return spawnItem(random, player);
    }

    return item;
  });

  return { round: { score, timeLeft, items, over: timeLeft <= 0 }, picked };
}

/** 조이스틱: 가운데에서 누른 위치까지의 거리(dx, dy)를 -1~1 방향으로 바꿈 */
export function joystickVector(dx, dy, radius) {
  const length = Math.hypot(dx, dy);

  if (radius <= 0 || length < radius * JOYSTICK_DEAD_ZONE) {
    return { x: 0, z: 0 };
  }

  const scale = Math.min(length, radius) / length / radius;
  return { x: dx * scale, z: dy * scale };
}

export function readBest(storage, key) {
  try {
    const value = Number(storage.getItem(key));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch (error) {
    return 0;
  }
}

export function saveBest(storage, key, score) {
  const best = readBest(storage, key);

  if (score <= best) {
    return best;
  }

  try {
    storage.setItem(key, String(score));
  } catch (error) {
    // 저장이 막힌 브라우저에서는 이번 판 점수만 표시
  }

  return score;
}
`;

/** 게임 화면·조작 파일(src/main.js) */
export const gameMainJs = `// src/main.js - 3D 게임 화면과 조작
// 이 게임은 coverfo.com 의 3D 게임 템플릿으로 만들어졌습니다. (템플릿 원작: coverfo.com)
import * as THREE from 'three';
import './style.css';
import { GAME_TITLE, PLAYER_KIND } from './gameConfig.js';
import {
  ARENA_HALF,
  ROUND_SECONDS,
  createPlayer,
  createRound,
  joystickVector,
  readBest,
  saveBest,
  stepPlayer,
  stepRound,
} from './gameLogic.js';

const BEST_KEY = 'coverfo-game-best:' + GAME_TITLE;

function byId(id) {
  return document.getElementById(id);
}

function box(width, height, depth, color) {
  return new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial({ color }));
}

function buildPlayer(kind) {
  const group = new THREE.Group();

  if (kind === 'horse') {
    const body = box(0.9, 0.9, 1.8, 0x8b5a2b);
    body.position.y = 1.2;
    const neck = box(0.45, 0.9, 0.45, 0x8b5a2b);
    neck.position.set(0, 1.8, 0.8);
    neck.rotation.x = 0.4;
    const head = box(0.4, 0.4, 0.8, 0x6b4423);
    head.position.set(0, 2.25, 1.15);
    group.add(body, neck, head);
    [[-0.3, -0.7], [0.3, -0.7], [-0.3, 0.7], [0.3, 0.7]].forEach(([x, z]) => {
      const leg = box(0.2, 0.8, 0.2, 0x5a3a1a);
      leg.position.set(x, 0.4, z);
      group.add(leg);
    });
  } else if (kind === 'car') {
    const body = box(1.4, 0.6, 2.4, 0xd7263d);
    body.position.y = 0.6;
    const cabin = box(1.1, 0.5, 1.2, 0xf2f2f2);
    cabin.position.set(0, 1.15, -0.2);
    group.add(body, cabin);
    [[-0.75, -0.8], [0.75, -0.8], [-0.75, 0.8], [0.75, 0.8]].forEach(([x, z]) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.3, 16), new THREE.MeshStandardMaterial({ color: 0x222222 }));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.35, z);
      group.add(wheel);
    });
  } else {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.1, 16), new THREE.MeshStandardMaterial({ color: 0x3366cc }));
    body.position.y = 0.9;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffd7b5 }));
    head.position.y = 1.75;
    group.add(body, head);
  }

  return group;
}

function setupGame() {
  document.title = GAME_TITLE;
  byId('title').textContent = GAME_TITLE;
  byId('startTitle').textContent = GAME_TITLE;

  let renderer;

  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch (error) {
    byId('startButton').disabled = true;
    byId('startHint').textContent = '이 기기에서는 3D 화면을 표시할 수 없어요.';
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  byId('stage').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd3f0);
  scene.fog = new THREE.Fog(0x9fd3f0, 30, 75);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x4a6b3a, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(10, 20, 8);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_HALF * 2 + 6, ARENA_HALF * 2 + 6),
    new THREE.MeshStandardMaterial({ color: 0x6aa84f }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const border = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(ARENA_HALF * 2 + 2, 0.01, ARENA_HALF * 2 + 2)),
    new THREE.LineBasicMaterial({ color: 0xffffff }),
  );
  border.position.y = 0.02;
  scene.add(border);

  const playerMesh = buildPlayer(PLAYER_KIND);
  scene.add(playerMesh);

  const itemGeometry = new THREE.OctahedronGeometry(0.45);
  const groundItemMaterial = new THREE.MeshStandardMaterial({ color: 0xffc300, emissive: 0x553300 });
  const highItemMaterial = new THREE.MeshStandardMaterial({ color: 0x7ee8fa, emissive: 0x0b3d4a });
  let itemMeshes = [];

  function syncItems(items) {
    itemMeshes.forEach((mesh) => scene.remove(mesh));
    itemMeshes = items.map((item) => {
      const mesh = new THREE.Mesh(itemGeometry, item.high ? highItemMaterial : groundItemMaterial);
      mesh.position.set(item.x, item.y, item.z);
      scene.add(mesh);
      return mesh;
    });
  }

  // ===== 조작: 키보드 =====
  const keys = {};
  const touch = { x: 0, z: 0, jump: false };

  window.addEventListener('keydown', (event) => {
    keys[event.code] = true;

    if (event.code === 'Space' || event.code.indexOf('Arrow') === 0) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    keys[event.code] = false;
  });
  window.addEventListener('blur', () => {
    Object.keys(keys).forEach((code) => {
      keys[code] = false;
    });
  });

  function readInput() {
    let x = touch.x;
    let z = touch.z;

    if (keys.KeyA || keys.ArrowLeft) x -= 1;
    if (keys.KeyD || keys.ArrowRight) x += 1;
    if (keys.KeyW || keys.ArrowUp) z -= 1;
    if (keys.KeyS || keys.ArrowDown) z += 1;

    return { x, z, jump: Boolean(keys.Space) || touch.jump };
  }

  // ===== 조작: 휴대폰 조이스틱 =====
  const pad = byId('joystick');
  const knob = byId('knob');
  let padPointer = null;

  function updatePad(event) {
    const rect = pad.getBoundingClientRect();
    const radius = rect.width / 2;
    const vector = joystickVector(event.clientX - (rect.left + radius), event.clientY - (rect.top + radius), radius);
    touch.x = vector.x;
    touch.z = vector.z;
    knob.style.transform = 'translate(' + vector.x * radius * 0.6 + 'px, ' + vector.z * radius * 0.6 + 'px)';
  }

  function releasePad(event) {
    if (event.pointerId !== padPointer) return;
    padPointer = null;
    touch.x = 0;
    touch.z = 0;
    knob.style.transform = '';
  }

  pad.addEventListener('pointerdown', (event) => {
    padPointer = event.pointerId;
    if (pad.setPointerCapture) pad.setPointerCapture(event.pointerId);
    updatePad(event);
    event.preventDefault();
  });
  pad.addEventListener('pointermove', (event) => {
    if (event.pointerId === padPointer) updatePad(event);
  });
  pad.addEventListener('pointerup', releasePad);
  pad.addEventListener('pointercancel', releasePad);

  // ===== 조작: 점프 버튼 =====
  const jumpButton = byId('jumpButton');
  jumpButton.addEventListener('pointerdown', (event) => {
    touch.jump = true;
    event.preventDefault();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => {
    jumpButton.addEventListener(type, () => {
      touch.jump = false;
    });
  });

  // ===== 화면 크기·회전 =====
  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  resize();

  // ===== 게임 진행 =====
  let player = createPlayer();
  let round = null;
  let playing = false;
  let best = readBest(window.localStorage, BEST_KEY);
  let last = null;

  function updateHud() {
    byId('score').textContent = String(round ? round.score : 0);
    byId('time').textContent = String(Math.ceil(round ? round.timeLeft : ROUND_SECONDS));
    byId('best').textContent = String(best);
  }

  function startRound() {
    player = createPlayer();
    round = createRound(Math.random, player);
    syncItems(round.items);
    playing = true;
    last = null;
    byId('startOverlay').hidden = true;
    byId('endOverlay').hidden = true;
    updateHud();
  }

  function endRound() {
    playing = false;
    touch.jump = false;
    best = saveBest(window.localStorage, BEST_KEY, round.score);
    byId('finalScore').textContent = String(round.score);
    byId('finalBest').textContent = String(best);
    byId('endOverlay').hidden = false;
    updateHud();
  }

  function frame(now) {
    window.requestAnimationFrame(frame);
    const dt = last === null ? 0 : Math.min((now - last) / 1000, 0.05);
    last = now;

    if (playing) {
      player = stepPlayer(player, readInput(), dt);
      const result = stepRound(round, player, dt, Math.random);
      round = result.round;

      if (result.picked.length > 0) {
        syncItems(round.items);
      }

      updateHud();

      if (round.over) {
        endRound();
      }
    }

    playerMesh.position.set(player.x, player.y, player.z);
    playerMesh.rotation.y = player.facing;

    itemMeshes.forEach((mesh, index) => {
      mesh.rotation.y += dt * 2;
      mesh.position.y = round.items[index].y + Math.sin(now / 300 + index) * 0.1;
    });

    const back = camera.aspect < 1 ? 17 : 12;
    camera.position.set(player.x, 9 + player.y * 0.3, player.z + back);
    camera.lookAt(player.x, player.y + 1, player.z);
    renderer.render(scene, camera);
  }

  document.addEventListener('visibilitychange', () => {
    last = null;
  });

  byId('startButton').addEventListener('click', startRound);
  byId('restartButton').addEventListener('click', startRound);
  updateHud();
  window.requestAnimationFrame(frame);

  return { startRound, getState: () => ({ player, round, playing, best }) };
}

export const game = setupGame();
`;

/** 화면 꾸밈 파일(src/style.css) */
export const gameStyleCss = `/* src/style.css - 게임 화면 꾸밈 */
html,
body {
  margin: 0;
  height: 100%;
  overflow: hidden;
  background: #9fd3f0;
  font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif;
  -webkit-user-select: none;
  user-select: none;
}

#stage canvas {
  display: block;
  touch-action: none;
}

.hud {
  position: fixed;
  top: calc(10px + env(safe-area-inset-top));
  left: calc(10px + env(safe-area-inset-left));
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(20, 30, 40, 0.55);
  color: #fff;
  font-size: 14px;
  line-height: 1.5;
}

.hud-title {
  font-weight: 700;
  font-size: 15px;
}

.hud-stats span {
  margin-right: 10px;
  white-space: nowrap;
}

.credit {
  position: fixed;
  top: calc(10px + env(safe-area-inset-top));
  right: calc(10px + env(safe-area-inset-right));
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.7);
  color: #1c2430;
  font-size: 11px;
  text-decoration: none;
}

.joystick {
  position: fixed;
  left: calc(24px + env(safe-area-inset-left));
  bottom: calc(24px + env(safe-area-inset-bottom));
  width: 130px;
  height: 130px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  border: 2px solid rgba(255, 255, 255, 0.7);
  touch-action: none;
}

.knob {
  position: absolute;
  left: 40px;
  top: 40px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  pointer-events: none;
}

.jump {
  position: fixed;
  right: calc(24px + env(safe-area-inset-right));
  bottom: calc(40px + env(safe-area-inset-bottom));
  width: 96px;
  height: 96px;
  border-radius: 50%;
  border: 0;
  background: rgba(255, 195, 0, 0.9);
  color: #1c2430;
  font-size: 18px;
  font-weight: 800;
  touch-action: none;
}

@media (hover: hover) and (pointer: fine) {
  .joystick,
  .jump {
    display: none;
  }
}

.overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(20, 30, 40, 0.55);
}

.overlay[hidden] {
  display: none;
}

.panel {
  max-width: 360px;
  padding: 22px;
  border-radius: 14px;
  background: #fff;
  color: #1c2430;
  text-align: center;
}

.panel h1,
.panel h2 {
  margin: 0 0 8px;
  font-size: 22px;
}

.panel p {
  margin: 8px 0;
  line-height: 1.5;
}

.panel .keys,
.panel .hint {
  color: #56616f;
  font-size: 13px;
}

.panel button {
  margin-top: 10px;
  padding: 12px 28px;
  border: 0;
  border-radius: 999px;
  background: #2b5c8a;
  color: #fff;
  font-size: 17px;
  font-weight: 700;
}

.panel button:disabled {
  opacity: 0.5;
}

button:focus-visible,
a:focus-visible {
  outline: 3px solid #ffc300;
  outline-offset: 2px;
}
`;

/** 게임 설정 파일(src/gameConfig.js) - 제목은 JSON.stringify 로 넣어 따옴표 등이 들어가도 코드가 깨지지 않음 */
export const gameConfigJs = (title: string, kind: PlayerKind) => `// src/gameConfig.js - 게임 설정
export const GAME_TITLE = ${JSON.stringify(title)};
export const PLAYER_KIND = ${JSON.stringify(kind)}; // 'runner'(사람) | 'horse'(말) | 'car'(자동차)
`;

/** index.html */
export const gameIndexHtml = (title: string) => `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="generator" content="coverfo.com 3D 게임 템플릿" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <div id="stage"></div>

    <div class="hud">
      <div id="title" class="hud-title"></div>
      <div class="hud-stats">
        <span>점수 <b id="score">0</b></span>
        <span>남은 시간 <b id="time">60</b>초</span>
        <span>최고 <b id="best">0</b></span>
      </div>
    </div>

    <a class="credit" href="https://coverfo.com" target="_blank" rel="noopener">coverfo로 만듦</a>

    <div id="joystick" class="joystick" role="application" aria-label="이동 조이스틱"><div id="knob" class="knob"></div></div>
    <button id="jumpButton" class="jump" type="button">점프</button>

    <div id="startOverlay" class="overlay">
      <div class="panel">
        <h1 id="startTitle"></h1>
        <p>60초 동안 보석을 모으세요. 노란 보석은 1점, 공중에 뜬 파란 보석은 점프해야 닿고 3점이에요.</p>
        <p class="keys">PC: WASD 또는 방향키로 이동, 스페이스로 점프<br />휴대폰: 왼쪽 조이스틱으로 이동, 오른쪽 버튼으로 점프</p>
        <button id="startButton" type="button">시작</button>
        <p id="startHint" class="hint"></p>
      </div>
    </div>

    <div id="endOverlay" class="overlay" hidden>
      <div class="panel">
        <h2>끝!</h2>
        <p>이번 점수 <b id="finalScore">0</b>점, 최고 <b id="finalBest">0</b>점</p>
        <button id="restartButton" type="button">다시 하기</button>
      </div>
    </div>

    <script type="module" src="/src/main.js"></script>
  </body>
</html>
`;

/** README.md */
export const gameReadme = (title: string) => `# ${oneLine(title)}

60초 동안 보석을 모으는 3D 게임입니다.

- 노란 보석: 1점 (바닥)
- 파란 보석: 3점 (공중, 점프해야 닿음)
- PC: WASD 또는 방향키로 이동, 스페이스로 점프
- 휴대폰: 왼쪽 조이스틱으로 이동, 오른쪽 버튼으로 점프
- 최고 점수는 이 브라우저에 저장됩니다.

## 바꾸는 방법

- 제목·캐릭터 모양: src/gameConfig.js (PLAYER_KIND 는 runner, horse, car 중 하나)
- 한 판 시간·속도·점프 힘·보석 수: src/gameLogic.js 맨 위 숫자
- 화면 색·버튼 모양: src/style.css
- 이 채팅에서 바꾸고 싶은 규칙을 말하면 AI가 코드를 고쳐 줍니다.

## 원작 표시

이 게임은 coverfo.com 의 3D 게임 템플릿으로 만들어졌습니다.
게임 화면 오른쪽 위의 작은 "coverfo로 만듦" 링크가 원작 표시입니다. 게임을 공개할 때 원작 표시를 남겨 두는 것을 권장합니다.
`;
