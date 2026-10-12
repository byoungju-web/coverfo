// functions/relay-app.js — coverfo.com/relay-app : 릴레이 레시피 화면 본체
// relay.tsx 안에 iframe 으로 들어갑니다 (engine-app.js · studio-app.js 와 같은 방식)
// © 2026 coverfo All Rights Reserved — Coverfo Creator Engine™ v2

const HTML = `<!DOCTYPE html>
<!-- © 2026 coverfo All Rights Reserved — Coverfo Creator Engine™ v2 (Relay) -->
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Coverfo Relay v2</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0f1117;color:#e8eaed;font-family:'Pretendard Variable',Inter,system-ui,-apple-system,sans-serif;line-height:1.6;overflow-x:hidden}
a{color:#60a5fa;text-decoration:none}
button{cursor:pointer;font:inherit;border:none;background:none;color:inherit}

/* ── 레이아웃 ─────────────────────────── */
.wrap{max-width:860px;margin:0 auto;padding:20px 16px 80px}
.hdr{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.hdr h1{font-size:20px;font-weight:700;letter-spacing:-0.5px}
.hdr .ver{font-size:11px;color:#60a5fa;background:#60a5fa18;padding:2px 8px;border-radius:20px}
.sub{color:#9aa3b0;font-size:13px;margin-bottom:24px}

/* ── 레시피 카드 ──────────────────────── */
.recipes{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
.recipe{background:#171a22;border:1px solid #262a35;border-radius:14px;padding:18px;cursor:pointer;transition:border-color .2s,transform .15s}
.recipe:hover{border-color:#60a5fa;transform:translateY(-2px)}
.recipe .icon{font-size:28px;margin-bottom:8px}
.recipe .name{font-size:15px;font-weight:600;margin-bottom:4px}
.recipe .desc{font-size:12.5px;color:#9aa3b0;line-height:1.5}
.recipe .cost{margin-top:10px;font-size:11px;color:#60a5fa}

/* ── 입력 화면 ────────────────────────── */
.input-area{background:#171a22;border:1px solid #262a35;border-radius:14px;padding:20px;margin-bottom:16px}
.input-area h2{font-size:16px;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.input-area h2 .back{font-size:20px;cursor:pointer;opacity:.6;transition:opacity .2s}
.input-area h2 .back:hover{opacity:1}
textarea.inp{width:100%;min-height:120px;background:#0f1117;border:1px solid #333;border-radius:10px;padding:12px;color:#e8eaed;font-size:14px;resize:vertical}
textarea.inp:focus{outline:none;border-color:#60a5fa}

/* 옵션 행 */
.opt-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;align-items:center}
.opt-row label{font-size:12px;color:#9aa3b0}
.opt-row select,.opt-row input[type=text]{background:#0f1117;border:1px solid #333;border-radius:6px;padding:4px 8px;color:#e8eaed;font-size:13px}

/* 버튼 */
.btn{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border-radius:10px;font-size:14px;font-weight:600;transition:opacity .2s}
.btn-primary{background:#3b82f6;color:#fff}
.btn-primary:hover{opacity:.85}
.btn-primary:disabled{opacity:.4;cursor:not-allowed}
.btn-secondary{background:#262a35;color:#e8eaed}
.btn-danger{background:#ef4444;color:#fff}
.btn-sm{padding:6px 14px;font-size:12px;border-radius:8px}

/* ── 녹음 ─────────────────────────────── */
.rec-controls{display:flex;align-items:center;gap:12px;margin:14px 0}
.rec-dot{width:12px;height:12px;border-radius:50%;background:#ef4444;animation:pulse 1s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.rec-time{font-size:13px;color:#9aa3b0;font-variant-numeric:tabular-nums}
.file-label{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:#262a35;border-radius:8px;font-size:13px;cursor:pointer;transition:background .2s}
.file-label:hover{background:#333}
.file-label input{display:none}

/* ── 실행 진행 ────────────────────────── */
.steps{margin:16px 0}
.step{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #1e2130}
.step:last-child{border-bottom:none}
.step .dot{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;margin-top:2px}
.dot-pending{background:#262a35;color:#666}
.dot-running{background:#3b82f620;color:#3b82f6;animation:pulse 1s infinite}
.dot-done{background:#22c55e20;color:#22c55e}
.dot-error{background:#ef444420;color:#ef4444}
.step .info{flex:1;min-width:0}
.step .info .label{font-size:13px;font-weight:500}
.step .info .detail{font-size:12px;color:#9aa3b0;margin-top:2px;word-break:break-all}

/* ── 결과 ─────────────────────────────── */
.result-box{background:#171a22;border:1px solid #262a35;border-radius:14px;padding:20px;margin-top:16px}
.result-box h3{font-size:15px;margin-bottom:12px}
.result-text{white-space:pre-wrap;font-size:13.5px;line-height:1.7;max-height:500px;overflow-y:auto;padding:12px;background:#0f1117;border-radius:8px}
audio{width:100%;margin:10px 0;border-radius:8px}
.dl-row{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}

/* ── 리서치 리포트 마크다운 ───────────── */
.report{padding:16px;background:#0f1117;border-radius:8px;font-size:13.5px;line-height:1.8;max-height:600px;overflow-y:auto}
.report h1{font-size:20px;margin:16px 0 8px;color:#60a5fa}
.report h2{font-size:16px;margin:14px 0 6px;color:#93c5fd;border-bottom:1px solid #262a35;padding-bottom:4px}
.report h3{font-size:14px;margin:10px 0 4px}
.report ul,.report ol{margin:6px 0 6px 20px}
.report p{margin:6px 0}
.report blockquote{border-left:3px solid #3b82f6;padding-left:12px;color:#9aa3b0;margin:8px 0}
.report code{background:#262a35;padding:1px 5px;border-radius:4px;font-size:12px}

/* ── 로그 ─────────────────────────────── */
.log{margin-top:16px;padding:12px;background:#0d0f14;border-radius:8px;font-size:11px;color:#666;max-height:120px;overflow-y:auto;font-family:monospace}
.log .ok{color:#22c55e}.log .err{color:#ef4444}.log .info{color:#60a5fa}

/* 반응형 */
@media(max-width:600px){
  .recipes{grid-template-columns:1fr}
  .hdr h1{font-size:17px}
}
</style>
</head>
<body>
<div class="wrap" id="app"></div>

<script>
/* ═══════════════════════════════════════════════════════════
 *  Coverfo Relay v2 — 클라이언트 오케스트레이터
 * ═══════════════════════════════════════════════════════════ */

// ── 레시피 정의 ──────────────────────────────────────────
const RECIPES = [
  {
    id: 'tts',
    icon: '📢',
    name: '텍스트 → 음성',
    desc: '텍스트를 자연스러운 AI 음성으로 변환합니다. 6가지 음성 중 선택 가능.',
    cost: 2,
    input: 'text',
    steps: [{ type: 'tts', label: 'AI 음성 생성' }],
  },
  {
    id: 'stt',
    icon: '🎙️',
    name: '음성 → 텍스트',
    desc: '녹음하거나 파일을 올리면 AI가 텍스트로 변환합니다. 한국어·영어·일본어 등 자동 감지.',
    cost: 2,
    input: 'audio',
    steps: [{ type: 'stt', label: '음성 인식' }],
  },
  {
    id: 'research',
    icon: '🔬',
    name: '리서치 리포트',
    desc: '주제를 입력하면 AI가 정보를 수집·분석하여 체계적인 리포트를 작성합니다.',
    cost: 5,
    input: 'text',
    steps: [
      { type: 'info', label: '검색 질의 생성' },
      { type: 'info', label: '정보 수집' },
      { type: 'info', label: '리포트 작성' },
    ],
  },
  {
    id: 'memo',
    icon: '🎙️📝📢',
    name: '음성 메모 → 요약 → 음성',
    desc: '음성을 녹음하면 텍스트로 변환 → 핵심 요약 → 요약본을 음성으로 읽어줍니다.',
    cost: 7,
    input: 'audio',
    steps: [
      { type: 'stt', label: '음성 인식' },
      { type: 'ai', label: 'AI 요약' },
      { type: 'tts', label: '요약 음성 생성' },
    ],
  },
  {
    id: 'voice-translate',
    icon: '🌍',
    name: '텍스트 번역 + 음성',
    desc: '텍스트를 원하는 언어로 번역하고 AI 음성으로 읽어줍니다.',
    cost: 5,
    input: 'text',
    steps: [
      { type: 'ai', label: 'AI 번역' },
      { type: 'tts', label: '번역 음성 생성' },
    ],
  },
];

const VOICES = [
  { id: 'nova', label: 'Nova (여성, 따뜻한)' },
  { id: 'alloy', label: 'Alloy (중성)' },
  { id: 'echo', label: 'Echo (남성)' },
  { id: 'fable', label: 'Fable (영국식)' },
  { id: 'onyx', label: 'Onyx (남성, 낮은)' },
  { id: 'shimmer', label: 'Shimmer (여성, 밝은)' },
];

const LANGS = [
  { id: 'ko', label: '한국어' }, { id: 'en', label: '영어' },
  { id: 'ja', label: '일본어' }, { id: 'zh', label: '중국어' },
  { id: 'es', label: '스페인어' }, { id: 'fr', label: '프랑스어' },
  { id: 'de', label: '독일어' }, { id: 'vi', label: '베트남어' },
  { id: 'th', label: '태국어' }, { id: 'id', label: '인도네시아어' },
];

// ── 상태 ─────────────────────────────────────────────────
let S = {
  screen: 'home',      // home | input | running | result
  recipe: null,         // RECIPES 중 하나
  steps: [],            // [{ status, label, detail }]
  inputText: '',
  audioBlob: null,
  audioUrl: null,       // 결과 오디오 URL
  resultText: '',       // 결과 텍스트
  resultHtml: '',       // 리서치 리포트 HTML
  error: null,
  voice: 'nova',
  lang: 'en',
  depth: 'quick',
};

// ── 인증 ─────────────────────────────────────────────────
function getToken() {
  try {
    const raw = localStorage.getItem('sb-auth-token') || sessionStorage.getItem('sb-auth-token');
    if (raw) { const j = JSON.parse(raw); return j.access_token || j; }

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.includes('supabase') && k.includes('auth')) {
        const j = JSON.parse(localStorage.getItem(k));
        if (j?.access_token) return j.access_token;
      }
    }
  } catch {}
  return '';
}

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: 'Bearer ' + t } : {};
}

// ── 로그 ─────────────────────────────────────────────────
let logs = [];
function log(cls, msg) {
  logs.push({ cls, msg, t: new Date().toLocaleTimeString() });
  if (logs.length > 50) logs.shift();
  renderLog();
}

// ── 녹음 ─────────────────────────────────────────────────
let mediaRec = null;
let audioChunks = [];
let recStartTime = 0;
let recTimer = null;

async function startRec() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRec = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    audioChunks = [];

    mediaRec.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRec.onstop = () => {
      S.audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      stream.getTracks().forEach(t => t.stop());
      clearInterval(recTimer);
      render();
    };

    mediaRec.start(250);
    recStartTime = Date.now();
    recTimer = setInterval(() => {
      const el = document.getElementById('rec-time');
      if (el) {
        const s = Math.floor((Date.now() - recStartTime) / 1000);
        el.textContent = Math.floor(s / 60).toString().padStart(2, '0') + ':' + (s % 60).toString().padStart(2, '0');
      }
    }, 200);

    log('info', '녹음 시작');
    render();
  } catch (e) {
    log('err', '마이크 접근 실패: ' + e.message);
    alert('마이크 권한을 허용해 주세요.');
  }
}

function stopRec() {
  if (mediaRec && mediaRec.state !== 'inactive') {
    mediaRec.stop();
    log('info', '녹음 완료');
  }
}

// ── API 호출 ─────────────────────────────────────────────
async function apiTTS(text, voice) {
  const r = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ text, voice }),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'TTS 실패'); }
  const blob = await r.blob();
  return URL.createObjectURL(blob);
}

async function apiSTT(audioBlob, language) {
  const fd = new FormData();
  fd.append('file', audioBlob, 'audio.webm');
  if (language) fd.append('language', language);

  const r = await fetch('/api/stt', {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'STT 실패');
  return data;
}

async function apiAI(text, task, options) {
  const r = await fetch('/api/relay-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ text, task, options }),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'AI 처리 실패'); }
  return await r.text();
}

async function apiResearch(topic, depth, onChunk) {
  const r = await fetch('/api/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ topic, depth }),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || '리서치 실패'); }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    text += chunk;

    // 진행 상태 태그 처리
    const stepMatch = chunk.match(/<!--RELAY_STEP:(.*?)-->/g);
    if (stepMatch) {
      stepMatch.forEach(m => {
        const msg = m.replace('<!--RELAY_STEP:', '').replace('-->', '');
        onChunk({ type: 'step', message: msg });
      });
    }

    // 에러 태그 처리
    if (chunk.includes('<!--RELAY_ERROR:')) {
      const em = chunk.match(/<!--RELAY_ERROR:(.*?)-->/);
      throw new Error(em ? em[1] : '리서치 오류');
    }

    // 본문 텍스트 (태그 제거)
    const clean = chunk.replace(/<!--RELAY_STEP:.*?-->\n?/g, '').replace(/<!--RELAY_ERROR:.*?-->\n?/g, '');
    if (clean) onChunk({ type: 'text', text: clean });
  }

  // 태그 제거한 순수 텍스트 반환
  return text.replace(/<!--RELAY_STEP:.*?-->\n?/g, '').replace(/<!--RELAY_ERROR:.*?-->\n?/g, '').trim();
}

// ── 레시피 실행 ──────────────────────────────────────────
async function runRecipe() {
  const r = S.recipe;
  if (!r) return;

  S.screen = 'running';
  S.error = null;
  S.resultText = '';
  S.resultHtml = '';
  S.audioUrl = null;
  S.steps = r.steps.map(s => ({ ...s, status: 'pending', detail: '' }));
  logs = [];
  render();

  let data = S.inputText;      // 텍스트 입력
  let audio = S.audioBlob;      // 오디오 입력

  try {
    if (r.id === 'research') {
      // 리서치는 특별 처리 — 스트리밍 + 진행 상태
      S.steps[0].status = 'running'; render();

      let reportText = '';
      const report = await apiResearch(data, S.depth, (ev) => {
        if (ev.type === 'step') {
          log('info', ev.message);
          // 단계 자동 업데이트
          if (ev.message.includes('질의') && ev.message.includes('완료')) {
            S.steps[0].status = 'done'; S.steps[0].detail = ev.message;
            S.steps[1].status = 'running';
          } else if (ev.message.includes('수집 완료')) {
            S.steps[1].status = 'done'; S.steps[1].detail = ev.message;
            S.steps[2].status = 'running';
          } else if (ev.message.includes('완성')) {
            S.steps[2].status = 'done';
          }
          render();
        } else if (ev.type === 'text') {
          reportText += ev.text;
          S.resultText = reportText;
          // 실시간 미리보기 업데이트
          const el = document.getElementById('live-report');
          if (el) el.textContent = reportText;
        }
      });

      S.steps.forEach(s => s.status = 'done');
      S.resultText = report;
      S.resultHtml = markdownToHtml(report);
      S.screen = 'result';
      log('ok', '리서치 리포트 완성');
      render();
      return;
    }

    // 일반 레시피 — 단계별 순차 실행
    for (let i = 0; i < r.steps.length; i++) {
      const step = r.steps[i];
      S.steps[i].status = 'running';
      render();
      log('info', step.label + ' 시작…');

      if (step.type === 'stt') {
        if (!audio) throw new Error('음성 입력이 없습니다');
        const result = await apiSTT(audio, '');
        data = result.text;
        S.steps[i].detail = data.length > 80 ? data.slice(0, 80) + '…' : data;
        log('ok', '음성 인식 완료 (' + result.language + ')');

      } else if (step.type === 'ai') {
        if (!data) throw new Error('처리할 텍스트가 없습니다');
        const task = r.id === 'voice-translate' ? 'translate' : 'summarize';
        const options = r.id === 'voice-translate' ? { lang: langLabel(S.lang) } : {};
        data = await apiAI(data, task, options);
        S.steps[i].detail = data.length > 80 ? data.slice(0, 80) + '…' : data;
        log('ok', step.label + ' 완료');

      } else if (step.type === 'tts') {
        if (!data) throw new Error('변환할 텍스트가 없습니다');
        const url = await apiTTS(data, S.voice);
        S.audioUrl = url;
        S.steps[i].detail = '음성 생성 완료';
        log('ok', 'TTS 완료');
      }

      S.steps[i].status = 'done';
      render();
    }

    S.resultText = data;
    S.screen = 'result';
    log('ok', '레시피 완료');
    render();

  } catch (e) {
    const idx = S.steps.findIndex(s => s.status === 'running');
    if (idx >= 0) S.steps[idx].status = 'error';
    S.error = e.message;
    log('err', e.message);
    render();
  }
}

function langLabel(code) {
  return (LANGS.find(l => l.id === code) || {}).label || code;
}

// ── 간이 마크다운 → HTML ─────────────────────────────────
function markdownToHtml(md) {
  if (!md) return '';
  let h = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
    .replace(/\\*(.+?)\\*/g, '<em>$1</em>')
    .replace(/\`(.+?)\`/g, '<code>$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^\\d+\\. (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\\/li>)/s, '<ul>$1</ul>')
    .replace(/\\n\\n/g, '</p><p>')
    .replace(/\\n/g, '<br>');
  return '<p>' + h + '</p>';
}

// ── 이스케이프 ───────────────────────────────────────────
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ── 렌더링 ───────────────────────────────────────────────
function render() {
  const app = document.getElementById('app');
  if (!app) return;

  let html = '';

  // 헤더
  html += '<div class="hdr"><h1>Coverfo Relay</h1><span class="ver">v2</span></div>';
  html += '<p class="sub">AI 릴레이 레시피 — 여러 AI를 연결하여 음성·리서치·번역을 한 번에</p>';

  if (S.screen === 'home') {
    html += renderHome();
  } else if (S.screen === 'input') {
    html += renderInput();
  } else if (S.screen === 'running') {
    html += renderRunning();
  } else if (S.screen === 'result') {
    html += renderResult();
  }

  html += '<div class="log" id="logbox"></div>';
  app.innerHTML = html;

  renderLog();
  bindEvents();
}

function renderHome() {
  let h = '<div class="recipes">';
  RECIPES.forEach(r => {
    h += '<div class="recipe" data-recipe="' + r.id + '">';
    h += '<div class="icon">' + r.icon + '</div>';
    h += '<div class="name">' + esc(r.name) + '</div>';
    h += '<div class="desc">' + esc(r.desc) + '</div>';
    h += '<div class="cost">🪙 ' + r.cost + ' 크레딧</div>';
    h += '</div>';
  });
  h += '</div>';
  return h;
}

function renderInput() {
  const r = S.recipe;
  let h = '<div class="input-area">';
  h += '<h2><span class="back" id="btn-back">←</span> ' + r.icon + ' ' + esc(r.name) + '</h2>';

  if (r.input === 'text') {
    h += '<textarea class="inp" id="inp-text" placeholder="' + (r.id === 'research' ? '리서치 주제를 입력하세요' : '텍스트를 입력하세요') + '">' + esc(S.inputText) + '</textarea>';

    h += '<div class="opt-row">';

    // 음성 선택 (TTS 포함 레시피)
    if (r.steps.some(s => s.type === 'tts')) {
      h += '<label>음성: <select id="sel-voice">';
      VOICES.forEach(v => { h += '<option value="' + v.id + '"' + (S.voice === v.id ? ' selected' : '') + '>' + v.label + '</option>'; });
      h += '</select></label>';
    }

    // 언어 선택 (번역 레시피)
    if (r.id === 'voice-translate') {
      h += '<label>번역 언어: <select id="sel-lang">';
      LANGS.forEach(l => { h += '<option value="' + l.id + '"' + (S.lang === l.id ? ' selected' : '') + '>' + l.label + '</option>'; });
      h += '</select></label>';
    }

    // 리서치 깊이
    if (r.id === 'research') {
      h += '<label>깊이: <select id="sel-depth">';
      h += '<option value="quick"' + (S.depth === 'quick' ? ' selected' : '') + '>빠른 (3건 검색, 5 크레딧)</option>';
      h += '<option value="deep"' + (S.depth === 'deep' ? ' selected' : '') + '>심층 (5건 검색, 10 크레딧)</option>';
      h += '</select></label>';
    }

    h += '</div>';

  } else if (r.input === 'audio') {
    // 녹음 또는 파일 업로드
    if (mediaRec && mediaRec.state === 'recording') {
      h += '<div class="rec-controls">';
      h += '<div class="rec-dot"></div>';
      h += '<span class="rec-time" id="rec-time">00:00</span>';
      h += '<button class="btn btn-danger btn-sm" id="btn-stop-rec">⏹ 녹음 중지</button>';
      h += '</div>';
    } else if (S.audioBlob) {
      h += '<p style="margin:10px 0;font-size:13px;color:#22c55e">✅ 음성 준비됨 (' + (S.audioBlob.size / 1024).toFixed(0) + ' KB)</p>';
      h += '<audio controls src="' + URL.createObjectURL(S.audioBlob) + '"></audio>';
      h += '<button class="btn btn-secondary btn-sm" id="btn-re-rec" style="margin-top:8px">🎙️ 다시 녹음</button>';
    } else {
      h += '<div style="display:flex;gap:12px;margin:14px 0;flex-wrap:wrap">';
      h += '<button class="btn btn-primary" id="btn-rec">🎙️ 녹음 시작</button>';
      h += '<label class="file-label">📁 파일 선택<input type="file" id="inp-file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.webm,.flac"></label>';
      h += '</div>';
    }

    // 음성 선택 (TTS 출력이 있는 레시피)
    if (r.steps.some(s => s.type === 'tts')) {
      h += '<div class="opt-row"><label>출력 음성: <select id="sel-voice">';
      VOICES.forEach(v => { h += '<option value="' + v.id + '"' + (S.voice === v.id ? ' selected' : '') + '>' + v.label + '</option>'; });
      h += '</select></label></div>';
    }
  }

  h += '<div style="margin-top:16px;display:flex;gap:8px">';
  h += '<button class="btn btn-primary" id="btn-run">▶ 실행</button>';
  h += '<button class="btn btn-secondary" id="btn-back2">취소</button>';
  h += '</div>';
  h += '</div>';
  return h;
}

function renderRunning() {
  const r = S.recipe;
  let h = '<div class="input-area">';
  h += '<h2>' + r.icon + ' ' + esc(r.name) + ' — 실행 중</h2>';

  h += '<div class="steps">';
  S.steps.forEach((s, i) => {
    const cls = 'dot-' + s.status;
    const icon = s.status === 'done' ? '✓' : s.status === 'error' ? '✗' : s.status === 'running' ? '◉' : (i + 1);
    h += '<div class="step"><div class="dot ' + cls + '">' + icon + '</div>';
    h += '<div class="info"><div class="label">' + esc(s.label) + '</div>';
    if (s.detail) h += '<div class="detail">' + esc(s.detail) + '</div>';
    h += '</div></div>';
  });
  h += '</div>';

  // 리서치 실시간 미리보기
  if (r.id === 'research') {
    h += '<div class="result-text" id="live-report" style="margin-top:12px;min-height:60px">' + esc(S.resultText) + '</div>';
  }

  if (S.error) {
    h += '<p style="color:#ef4444;margin-top:12px;font-size:13px">❌ ' + esc(S.error) + '</p>';
    h += '<div style="margin-top:10px"><button class="btn btn-secondary" id="btn-home">돌아가기</button></div>';
  }

  h += '</div>';
  return h;
}

function renderResult() {
  const r = S.recipe;
  let h = '<div class="result-box">';
  h += '<h3>✅ ' + esc(r.name) + ' 완료</h3>';

  // 오디오 결과
  if (S.audioUrl) {
    h += '<audio controls autoplay src="' + S.audioUrl + '"></audio>';
  }

  // 텍스트 결과
  if (S.resultHtml) {
    // 리서치 리포트 — HTML 렌더링
    h += '<div class="report">' + S.resultHtml + '</div>';
  } else if (S.resultText) {
    h += '<div class="result-text">' + esc(S.resultText) + '</div>';
  }

  // 다운로드·복사 버튼
  h += '<div class="dl-row">';
  if (S.resultText) {
    h += '<button class="btn btn-secondary btn-sm" id="btn-copy">📋 텍스트 복사</button>';
  }
  if (S.audioUrl) {
    h += '<a class="btn btn-secondary btn-sm" id="btn-dl-audio" href="' + S.audioUrl + '" download="coverfo-relay.mp3">💾 음성 다운로드</a>';
  }
  h += '<button class="btn btn-primary btn-sm" id="btn-new">🔄 새 레시피</button>';
  h += '</div>';

  h += '</div>';
  return h;
}

function renderLog() {
  const box = document.getElementById('logbox');
  if (!box) return;
  box.innerHTML = logs.map(l => '<div class="' + l.cls + '">[' + l.t + '] ' + esc(l.msg) + '</div>').join('');
  box.scrollTop = box.scrollHeight;
}

// ── 이벤트 바인딩 ────────────────────────────────────────
function bindEvents() {
  // 레시피 선택
  document.querySelectorAll('.recipe[data-recipe]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.recipe;
      S.recipe = RECIPES.find(r => r.id === id);
      S.screen = 'input';
      S.inputText = '';
      S.audioBlob = null;
      S.error = null;
      render();
    });
  });

  // 뒤로가기
  const back = document.getElementById('btn-back') || document.getElementById('btn-back2');
  if (back) back.addEventListener('click', goHome);
  const home = document.getElementById('btn-home');
  if (home) home.addEventListener('click', goHome);

  // 새 레시피
  const btnNew = document.getElementById('btn-new');
  if (btnNew) btnNew.addEventListener('click', goHome);

  // 실행
  const btnRun = document.getElementById('btn-run');
  if (btnRun) btnRun.addEventListener('click', () => {
    // 입력 수집
    const ta = document.getElementById('inp-text');
    if (ta) S.inputText = ta.value.trim();

    const selV = document.getElementById('sel-voice');
    if (selV) S.voice = selV.value;

    const selL = document.getElementById('sel-lang');
    if (selL) S.lang = selL.value;

    const selD = document.getElementById('sel-depth');
    if (selD) S.depth = selD.value;

    // 유효성 검사
    if (S.recipe.input === 'text' && !S.inputText) {
      alert('텍스트를 입력해 주세요.');
      return;
    }
    if (S.recipe.input === 'audio' && !S.audioBlob) {
      alert('음성을 녹음하거나 파일을 선택해 주세요.');
      return;
    }

    runRecipe();
  });

  // 녹음
  const btnRec = document.getElementById('btn-rec');
  if (btnRec) btnRec.addEventListener('click', startRec);

  const btnStop = document.getElementById('btn-stop-rec');
  if (btnStop) btnStop.addEventListener('click', stopRec);

  const btnReRec = document.getElementById('btn-re-rec');
  if (btnReRec) btnReRec.addEventListener('click', () => { S.audioBlob = null; render(); });

  // 파일 선택
  const inpFile = document.getElementById('inp-file');
  if (inpFile) inpFile.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) { S.audioBlob = f; log('info', '파일 선택: ' + f.name); render(); }
  });

  // 복사
  const btnCopy = document.getElementById('btn-copy');
  if (btnCopy) btnCopy.addEventListener('click', () => {
    navigator.clipboard.writeText(S.resultText).then(() => {
      btnCopy.textContent = '✅ 복사됨';
      setTimeout(() => { btnCopy.textContent = '📋 텍스트 복사'; }, 1500);
    });
  });
}

function goHome() {
  S.screen = 'home';
  S.recipe = null;
  S.inputText = '';
  S.audioBlob = null;
  S.audioUrl = null;
  S.resultText = '';
  S.resultHtml = '';
  S.error = null;
  if (mediaRec && mediaRec.state === 'recording') stopRec();
  render();
}

// ── 시작 ─────────────────────────────────────────────────
render();
log('ok', 'Coverfo Relay v2 준비됨');
</script>
</body>
</html>`;

export async function onRequestGet() {
  return new Response(HTML, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
