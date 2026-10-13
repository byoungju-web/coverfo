/* public/relay-set.js — Coverfo Relay: 🎁 콘텐츠 3종 세트 (🎙️ AI 목소리 · 🎵 AI 음악 · 😂 밈·짤)
 * © 2026 coverfo All Rights Reserved
 *
 * relay-pro.js 다음에 불립니다. 화면: 기본 레시피 탭 맨 위 홍보 카드 + 4개 화면(set · voice · music · meme)
 * 서버: /api/voice (목소리 2) · /api/music (30초 2 · 한 곡 4) · /api/gen (짤 그림 2, 스튜디오와 같은 길)
 *       /api/relay-ai (대본 · 문구 · 세트 기획 3)
 */
(function () {
  if (typeof S === 'undefined' || typeof render !== 'function') return;

  var COST = { plan: 3, voice: 2, clip: 2, song: 4, image: 2, veo: 25 };
  var STYLES = [
    ['dj', '📻 라디오 DJ'], ['ad', '📢 광고 멘트'], ['news', '📰 뉴스 앵커'], ['story', '🧸 동화 구연'],
    ['docu', '🎬 다큐'], ['shorts', '😆 쇼츠'], ['calm', '🧘 차분한 안내']
  ];
  var VOICES2 = [
    ['coral', 'Coral · 밝은 여성'], ['nova', 'Nova · 따뜻한 여성'], ['shimmer', 'Shimmer · 맑은 여성'], ['sage', 'Sage · 차분한 여성'],
    ['ash', 'Ash · 또렷한 남성'], ['echo', 'Echo · 부드러운 남성'], ['onyx', 'Onyx · 낮은 남성'], ['verse', 'Verse · 생기있는 남성'],
    ['ballad', 'Ballad · 감성 남성'], ['alloy', 'Alloy · 중성'], ['fable', 'Fable · 영국식']
  ];
  var TOPICS = ['우리 카페 가을 신메뉴', '친구 생일 축하', '월요병 공감', '우리 가게 오픈 1주년', '다이어트 3일차'];
  var GENRES = ['잔잔한 어쿠스틱 기타, 카페 분위기', '신나는 K-pop 댄스, 빠른 템포', '감성 로파이 힙합, 공부할 때', '웅장한 영화 OST, 오케스트라', '귀여운 우쿨렐레, 밝고 경쾌하게'];
  var SCENES = ['월요일 아침 이불 속에서 안 나오는 고양이', '커피를 들고 해맑게 웃는 강아지', '서류 더미에 파묻힌 직장인 펭귄', '다이어트 중 치킨을 바라보는 햄스터', '퇴근 시간 시계를 보는 강아지'];

  var X = S.set = {
    v: { text: '', style: 'dj', voice: 'coral', custom: '', busy: false, url: '', dl: '', err: '' },
    m: { prompt: '', mode: 'clip', vocal: 'inst', lyrics: '', busy: false, url: '', words: '', err: '' },
    j: { scene: '', top: '', bottom: '', busy: false, img: null, src: '', png: '', err: '' },
    s: { topic: '', style: 'dj', busy: false, steps: [], plan: null, voice: '', music: '', img: null, png: '', err: '' }
  };

  /* ── 스타일 ─────────────────────────────── */
  var css = document.createElement('style');
  css.textContent = [
    '.set-hero{position:relative;overflow:hidden;border-radius:22px;padding:18px 16px 16px;margin-bottom:18px;color:#1c1a2e;background:linear-gradient(140deg,#fcfbff 0%,#f2f3ff 55%,#fbf5ff 100%);border:1px solid #e7e4f7;box-shadow:0 10px 30px rgba(67,56,160,.08)}',
    '.set-hero::after{content:"";position:absolute;right:-50px;top:-60px;width:190px;height:190px;border-radius:50%;background:radial-gradient(circle,rgba(129,140,248,.18) 0%,rgba(129,140,248,0) 70%)}',
    '.set-hero .k{position:relative;z-index:1;display:inline-block;font-size:11px;font-weight:800;letter-spacing:.3px;background:#1c1a2e;color:#f3d38a;padding:4px 11px;border-radius:999px}',
    '.set-hero h2{position:relative;z-index:1;font-size:21px;font-weight:900;line-height:1.32;margin:9px 0 4px;letter-spacing:-.4px;color:#1c1a2e}',
    '.set-hero h2 em{font-style:normal;color:#4338ca}',
    '.set-hero p{position:relative;z-index:1;font-size:13px;color:#5f5d73;margin-bottom:12px}',
    '.set-tri{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px;position:relative;z-index:1}',
    '.set-tri button{background:#fff;color:#1c1a2e;border:1px solid #ebe9f6;border-radius:14px;padding:10px 6px;text-align:center;font-size:12px;font-weight:800;line-height:1.35;box-shadow:0 2px 8px rgba(67,56,160,.06)}',
    '.set-tri button i{display:block;font-style:normal;font-size:24px;margin-bottom:2px}',
    '.set-tri button span{display:block;font-size:10.5px;font-weight:600;color:#7a7890;margin-top:2px}',
    '.set-ex{position:relative;z-index:1;font-size:12px;color:#3f3d56;background:rgba(255,255,255,.8);border:1px solid #ebe9f6;border-radius:12px;padding:9px 11px;margin-bottom:12px;line-height:1.6}',
    '.set-ex b{color:#4338ca}',
    '.set-go{position:relative;z-index:1;width:100%;background:#1c1a2e;color:#fff;border-radius:14px;padding:12px;font-size:15px;font-weight:900;box-shadow:0 8px 20px rgba(28,26,46,.22)}',
    '.set-go small{font-weight:700;color:#f3d38a;margin-left:6px}',
    '.set-mine{position:relative;z-index:1;display:block;width:100%;margin-top:8px;padding:9px;border-radius:12px;background:transparent;border:1px dashed #cfcbe8;color:#4338ca;font-size:13px;font-weight:800}',
    '.set-hero h2 .plus{white-space:nowrap;background:linear-gradient(90deg,#7c3aed,#db2777);-webkit-background-clip:text;background-clip:text;color:transparent}',
    '.se-pick{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px;border:2px dashed #c7c2ef;border-radius:14px;background:#faf9ff;color:#4338ca;font-size:14px;font-weight:900;cursor:pointer}',
    '.se-pick input{display:none}',
    '.se-prev{display:block;max-width:220px;max-height:320px;margin:10px auto 0;border-radius:12px;background:#000}',
    '.se-chk{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#374151;margin-top:10px}',
    '.se-chk input{width:18px;height:18px;accent-color:#4338ca}',
    '.set-top{display:flex;align-items:center;justify-content:space-between;gap:8px}',
    '.set-top .set-link{flex:none;font-size:12px;font-weight:800;color:#4338ca;background:#f4f3ff;border:1px solid #e3e0fb;border-radius:999px;padding:5px 10px}',
    '.reel{margin-top:12px;border:1px solid #e7e4f7;border-radius:16px;padding:14px;background:linear-gradient(140deg,#fcfbff 0%,#f4f4ff 100%)}',
    '.reel h4{font-size:14px;font-weight:900;color:#1c1a2e;margin-bottom:2px}',
    '.reel .rs{font-size:12px;color:#6b6a80;margin-bottom:10px}',
    '.reel .rbar{height:8px;border-radius:999px;background:#ecebf8;overflow:hidden;margin-top:10px}',
    '.reel .rbar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#4338ca,#8b5cf6);transition:width .3s}',
    '.reel video{display:block;width:100%;max-width:300px;margin:10px auto 0;border-radius:14px;background:#000;aspect-ratio:9/16}',
    '.reel .go{background:#1c1a2e;color:#fff;border-radius:12px;padding:10px 16px;font-size:14px;font-weight:900}',
    '.reel .go:disabled{opacity:.5}',
    '.made{border:1px solid #e8eaf1;border-radius:14px;padding:12px;margin-top:10px;background:#fff}',
    '.made .mh{display:flex;align-items:center;gap:10px}',
    '.made .mi{width:40px;height:40px;border-radius:12px;background:#f4f3ff;display:inline-flex;align-items:center;justify-content:center;font-size:20px;flex:none}',
    '.made .mt{flex:1;min-width:0}',
    '.made .mt b{display:block;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.made .mt span{font-size:11.5px;color:#7a7890}',
    '.made .mb{margin-top:10px}',
    '.made .mb audio{width:100%;margin:4px 0}',
    '.set-sec{margin:4px 0 10px;font-size:13px;font-weight:800;color:#4b5563}',
    '.set-box{background:#fff;border:1px solid #e8eaf1;border-radius:18px;padding:18px;margin-bottom:14px;box-shadow:0 1px 2px rgba(20,22,31,.04)}',
    '.set-box h2{font-size:17px;font-weight:800;display:flex;align-items:center;gap:8px;margin-bottom:4px}',
    '.set-box h2 .back{cursor:pointer;opacity:.5;font-size:20px}',
    '.set-box .lead{font-size:12.5px;color:#6b7280;margin-bottom:12px}',
    '.set-lb{display:block;font-size:12.5px;font-weight:800;color:#374151;margin:12px 0 6px}',
    '.set-in{width:100%;background:#f6f7fb;border:1px solid #e8eaf1;border-radius:12px;padding:11px 12px;color:#14161f;font-size:14px;font-family:inherit}',
    '.set-in:focus{outline:none;border-color:#8b5cf6;background:#fff;box-shadow:0 0 0 3px #8b5cf61f}',
    'textarea.set-in{min-height:84px;resize:vertical}',
    '.set-chips{display:flex;flex-wrap:wrap;gap:6px}',
    '.set-chip{padding:6px 11px;border-radius:999px;background:#fff;border:1px solid #e1e4ec;font-size:12px;font-weight:700;color:#4b5563}',
    '.set-chip.on{background:#f1edff;border-color:#8b5cf6;color:#5b21b6}',
    '.set-chip.ex{background:#f6f7fb;border-style:dashed;font-weight:600}',
    '.set-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:14px}',
    '.set-cost{font-size:12px;color:#6b7280}',
    '.set-cost b{color:#5b21b6}',
    '.set-err{margin-top:10px;font-size:13px;color:#dc2626;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:8px 11px}',
    '.set-out{margin-top:14px;border-top:1px dashed #e1e4ec;padding-top:14px}',
    '.set-out audio{width:100%}',
    '.set-lyr{white-space:pre-wrap;font-size:12.5px;color:#374151;background:#f6f7fb;border-radius:10px;padding:10px 12px;margin-top:8px;max-height:220px;overflow:auto}',
    '.set-meme{width:100%;max-width:420px;display:block;margin:0 auto;border-radius:14px;box-shadow:0 6px 20px rgba(20,22,31,.12)}',
    '.set-steps{margin-top:12px}',
    '.set-step{display:flex;align-items:center;gap:8px;font-size:13px;padding:6px 0}',
    '.set-step i{font-style:normal;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;background:#f0f1f5;color:#9ca3af}',
    '.set-step.run i{background:#efeaff;color:#8b5cf6;animation:pulse 1s infinite}',
    '.set-step.ok i{background:#e7f8f1;color:#10b981}',
    '.set-step.bad i{background:#fdecec;color:#ef4444}',
    '.set-card{border:1px solid #e8eaf1;border-radius:14px;padding:12px;margin-top:10px}',
    '.set-card h4{font-size:13.5px;margin-bottom:6px}',
    '.set-card .q{font-size:12.5px;color:#4b5563;background:#f6f7fb;border-radius:10px;padding:8px 10px;margin-bottom:8px;white-space:pre-wrap}'
  ].join('\n');
  document.head.appendChild(css);

  /* ── 서버 ─────────────────────────────── */
  function post(url, body) {
    return fetch(url, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()), body: JSON.stringify(body) });
  }
  function errOf(r) {
    return r.json().catch(function () { return {}; }).then(function (j) {
      if (r.status === 401) return '로그인이 필요합니다. coverfo 홈에서 로그인한 뒤 다시 열어 주세요.';
      if (r.status === 402) return '크레딧이 부족합니다. coverfo 에서 충전해 주세요.';
      return (j && j.error) || ('오류 ' + r.status);
    });
  }
  function aiText(text, prompt) {
    return post('/api/relay-ai', { text: text, task: 'custom', options: { prompt: prompt } }).then(function (r) {
      if (!r.ok) return errOf(r).then(function (m) { throw new Error(m); });
      return r.text();
    });
  }
  function makeVoice(text, style, voice, custom) {
    return post('/api/voice', { text: text, style: style, voice: voice, custom: custom || '' }).then(function (r) {
      if (!r.ok) return errOf(r).then(function (m) { throw new Error(m); });
      var saved = r.headers.get('X-Relay-Url') || '';
      return r.blob().then(function (b) { return { obj: URL.createObjectURL(b), url: saved }; });
    });
  }
  function makeMusic(body) {
    return post('/api/music', body).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401) throw new Error('로그인이 필요합니다. coverfo 홈에서 로그인한 뒤 다시 열어 주세요.');
        if (r.status === 402) throw new Error('크레딧이 부족합니다. coverfo 에서 충전해 주세요.');
        if (!r.ok || !j.ok) throw new Error(j.error || ('오류 ' + r.status));
        return j;
      });
    });
  }
  function makeImage(scene, full) {
    var prompt = full ? scene : scene + '. Funny meme-style photo, expressive and cute, high quality, square composition, keep clean empty space at the top and bottom for captions. Absolutely no text, no letters, no watermark.';
    return post('/api/gen', { kind: 'image', prompt: prompt, aspect: '1:1' }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401) throw new Error('로그인이 필요합니다. coverfo 홈에서 로그인한 뒤 다시 열어 주세요.');
        if (r.status === 402) throw new Error('크레딧이 부족합니다. coverfo 에서 충전해 주세요.');
        if (!r.ok || !j.result_url) throw new Error(j.error || ('그림 만들기 실패 ' + r.status));
        return j.result_url;
      });
    }).then(function (url) {
      return loadImg(url).then(function (img) { return { img: img, url: url }; });
    });
  }
  function loadImg(url) {
    return fetch(url).then(function (r) { return r.blob(); }).then(function (b) {
        return new Promise(function (ok, no) {
          var img = new Image();
          img.onload = function () { ok(img); };
          img.onerror = function () { no(new Error('그림을 불러오지 못했습니다')); };
          img.src = URL.createObjectURL(b);
        });
    });
  }

  /* ── 내가 만든 것 — 로그인 계정(서버 /api/made)에 저장 → 폰 · PC 같은 목록. 이 기기에도 사본을 둠(빨리 보이게).
        파일은 서버(R2)에 있고 여기엔 주소만 ── */
  var MADE_KEY = 'cf_relay_made_v1', MADE_MAX = 50;
  function madeList() { try { return JSON.parse(localStorage.getItem(MADE_KEY) || '[]') || []; } catch (e) { return []; } }
  function madeSave(list) { try { localStorage.setItem(MADE_KEY, JSON.stringify(list.slice(0, MADE_MAX))); } catch (e) {} }
  function madeServer(body) {
    var h = authHeaders(); if (!h || !h.Authorization) return Promise.resolve(null);
    var p = body ? post('/api/made', body) : fetch('/api/made', { headers: h, cache: 'no-store' });
    return p.then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function shareable(x) { return [x.voice, x.music, x.img, x.video].some(function (u) { return u && (String(u).indexOf('/media/') === 0 || String(u).indexOf('https://') === 0); }); }
  function madePush(items) { items = items.filter(shareable); if (items.length) madeServer({ op: 'put', items: items.slice(0, 30) }); }
  function madeAdd(item) {
    item.id = 'm' + Date.now() + Math.random().toString(36).slice(2, 5); item.at = Date.now();
    var l = madeList(); l.unshift(item); madeSave(l); madePush([item]); return item.id;
  }
  function madeUpdate(id, patch) { var l = madeList(), ch = []; l.forEach(function (x) { if (x.id === id) { Object.assign(x, patch); ch.push(x); } }); madeSave(l); madePush(ch); }
  function madeDel(id) { madeSave(madeList().filter(function (x) { return x.id !== id; })); madeServer({ op: 'del', id: id }); }
  /* 처음 열 때: 서버 목록 + 이 기기에만 있던 것(예전에 폰에 저장된 것)을 합치고, 이 기기에만 있던 것은 서버로 올림 */
  function madeSync() {
    return madeServer(null).then(function (j) {
      if (!j || !j.ok || !Array.isArray(j.items)) return;
      var seen = {}, merged = j.items.slice();
      j.items.forEach(function (x) { seen[x.id] = 1; });
      var localOnly = madeList().filter(function (x) { return x && x.id && !seen[x.id]; });
      merged = merged.concat(localOnly).sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
      var before = JSON.stringify(madeList());
      madeSave(merged);
      madePush(localOnly);
      if (JSON.stringify(madeList()) !== before && (S.screen === 'home' || !S.screen)) render();
    });
  }
  var memePng = {};   /* 다시 그린 짤 그림 (화면에서만) */

  /* ── 🎬 릴스 · 쇼츠 영상 (세로 9:16, 폰 안에서 만듦 → 서버 · 크레딧 0) ──
     짤 그림 + 목소리 + 배경음악(작게)을 합쳐 15초 / 30초 영상 하나로. 화면에 그리면서 그대로 녹화합니다. */
  X.r = { secs: 15, busy: false, prog: 0, url: '', ext: '', err: '', key: '' };
  function pickType() {
    /* MP4 는 H.264(avc1)+AAC 일 때만 씀 — 인스타가 받는 형식. 안 되면 WebM (그냥 'video/mp4' 는 VP9 가 들어갈 수 있어 뺌) */
    var c = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1.4D401F,mp4a.40.2', 'video/mp4;codecs=avc1.64001F,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    for (var i = 0; i < c.length; i++) { try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(c[i])) return c[i]; } catch (e) {} }
    return '';
  }
  function audioBuf(ac, url) {
    if (!url) return Promise.resolve(null);
    return fetch(url).then(function (r) { return r.arrayBuffer(); })
      .then(function (ab) { return new Promise(function (ok) { ac.decodeAudioData(ab, ok, function () { ok(null); }); }); })
      .catch(function () { return null; });
  }
  function subLines(text) {
    var parts = String(text || '').replace(/\s+/g, ' ').split(/(?<=[.!?。！？])\s+/).filter(Boolean), out = [];
    parts.forEach(function (p) { while (p.length > 22) { var cut = p.lastIndexOf(' ', 22); if (cut < 8) cut = 22; out.push(p.slice(0, cut).trim()); p = p.slice(cut).trim(); } if (p) out.push(p); });
    return out;
  }
  /* o = { mode: 'card'(짤 카드, 기본) | 'image'(사진 꽉 차게) | 'video'(폰 영상 꽉 차게),
           png(card) · src(image/video 주소), orig(영상 원래 소리), voice, music, narration(자막), title, top, bottom, secs } */
  function loadVideo(src) {
    return new Promise(function (ok, no) {
      var v = document.createElement('video');
      v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.src = src;
      v.onloadeddata = function () { ok(v); };
      v.onerror = function () { no(new Error('이 영상은 열 수 없어요. 다른 영상(MP4)으로 해 보세요.')); };
    });
  }
  function cover(g, el, ew, eh, W, H, z) {
    var s = Math.max(W / ew, H / eh) * (z || 1);
    g.drawImage(el, (W - ew * s) / 2, (H - eh * s) / 2, ew * s, eh * s);
  }
  function capText(g, text, atTop, W, H) {
    text = String(text || '').trim(); if (!text) return;
    var size = 64, lines;
    g.textAlign = 'center'; g.lineJoin = 'round';
    for (;;) {
      g.font = '900 ' + size + 'px "Pretendard Variable","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
      lines = wrap(g, text, W - 70);
      if ((lines.length <= 2 && lines.every(function (l) { return g.measureText(l).width <= W - 70; })) || size <= 34) break;
      size -= 4;
    }
    var lh = size * 1.18, y0 = atTop ? 150 : H - 250 - (lines.length - 1) * lh;
    lines.forEach(function (l, i) {
      g.lineWidth = size * 0.16; g.strokeStyle = '#000'; g.strokeText(l, W / 2, y0 + i * lh);
      g.fillStyle = '#fff'; g.fillText(l, W / 2, y0 + i * lh);
    });
  }
  function makeReel(o, onProg) {
    var W = 720, H = 1280, secs = o.secs || 15, type = pickType(), mode = o.mode || 'card';
    if (!type) return Promise.reject(new Error('이 브라우저는 영상 녹화를 지원하지 않아요. 크롬으로 열어 주세요.'));
    var AC = window.AudioContext || window.webkitAudioContext;
    var ac = new AC();
    var bg = mode === 'video' ? loadVideo(o.src) : loadImg(mode === 'card' ? o.png : o.src);
    return Promise.all([bg, audioBuf(ac, o.voice), audioBuf(ac, o.music)]).then(function (a) {
      var img = a[0], vbuf = a[1], mbuf = a[2], vid = mode === 'video' ? a[0] : null;
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var g = cv.getContext('2d');
      var dest = ac.createMediaStreamDestination();
      var t0 = 0, VOICE_AT = 0.8;
      var vDur = vbuf ? Math.min(vbuf.duration, secs - VOICE_AT - 0.3) : 0;
      var subs = subLines(o.narration), title = String(o.title || '').slice(0, 40);
      var origOn = !!(vid && o.orig);

      function subtitle(t, y) {
        if (subs.length && vDur > 0 && t >= VOICE_AT && t <= VOICE_AT + vDur + 0.4) {
          var idx = Math.min(subs.length - 1, Math.floor((t - VOICE_AT) / (vDur / subs.length)));
          g.font = '800 38px "Pretendard Variable","Apple SD Gothic Neo","Noto Sans KR",sans-serif'; g.textAlign = 'center';
          var line = subs[idx], tw = Math.min(W - 60, g.measureText(line).width + 48);
          g.fillStyle = 'rgba(0,0,0,.55)'; roundRect(g, (W - tw) / 2, y, tw, 70, 18); g.fill();
          g.fillStyle = '#fff'; g.fillText(line, W / 2, y + 48);
        }
      }
      function mark() {
        g.font = '700 22px sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.7)';
        g.fillText('made with coverfo', W / 2, H - 42);
      }
      function draw(t) {
        if (mode !== 'card') {
          g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
          if (vid) { if (vid.videoWidth) cover(g, vid, vid.videoWidth, vid.videoHeight, W, H, 1); }
          else cover(g, img, img.width, img.height, W, H, 1 + 0.06 * Math.min(1, t / secs));
          capText(g, o.top, true, W, H); capText(g, o.bottom, false, W, H);
          subtitle(t, H - 200 - (o.bottom ? 150 : 0));
          mark(); return;
        }
        /* 바탕: 같은 그림을 크게 흐리게 */
        g.save(); g.filter = 'blur(26px) brightness(0.62)';
        cover(g, img, img.width, img.height, W, H, 1.15);
        g.restore(); g.filter = 'none';
        /* 위: 제목 */
        if (title) {
          g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = '900 46px "Pretendard Variable","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
          g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 14;
          var tl = wrap(g, title, W - 90).slice(0, 2);
          tl.forEach(function (l, i) { g.fillText(l, W / 2, 170 + i * 58); });
          g.shadowBlur = 0;
        }
        /* 가운데: 짤 (천천히 다가감) */
        var S2 = 640, x = (W - S2) / 2, y = 300, z = 1 + 0.06 * Math.min(1, t / secs);
        g.save(); roundRect(g, x, y, S2, S2, 30); g.clip();
        var zs = S2 * z; g.drawImage(img, x - (zs - S2) / 2, y - (zs - S2) / 2, zs, zs);
        g.restore();
        g.save(); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 4; roundRect(g, x, y, S2, S2, 30); g.stroke(); g.restore();
        /* 아래: 자막 (목소리 나오는 동안 차례로) */
        subtitle(t, 1010);
        mark();
      }

      /* 영상 원래 소리 → 녹음으로 (스피커로는 안 나감) */
      var og = null;
      if (vid) {
        vid.loop = true;
        if (origOn) {
          try { var es = ac.createMediaElementSource(vid); og = ac.createGain(); og.gain.value = vbuf ? 0.35 : 1; es.connect(og); og.connect(dest); }
          catch (e) { origOn = false; }
        }
        vid.muted = !origOn;
      }

      draw(0);
      var stream = cv.captureStream(30);
      dest.stream.getAudioTracks().forEach(function (tr) { stream.addTrack(tr); });
      var rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 4000000, audioBitsPerSecond: 128000 });
      var chunks = [];
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };

      return new Promise(function (ok, no) {
        rec.onstop = function () {
          try { ac.close(); } catch (e) {}
          if (vid) { try { vid.pause(); vid.removeAttribute('src'); vid.load(); } catch (e) {} }
          var blob = new Blob(chunks, { type: type.split(';')[0] });
          if (!blob.size) { no(new Error('영상을 만들지 못했어요. 다시 눌러 주세요.')); return; }
          ok({ url: URL.createObjectURL(blob), ext: type.indexOf('mp4') >= 0 ? 'mp4' : 'webm' });
        };
        rec.onerror = function () { no(new Error('녹화 중 오류가 났어요.')); };
        var schedule = function () {
          t0 = ac.currentTime + 0.15;
          var loud = vbuf || origOn;
          if (mbuf) {
            var ms = ac.createBufferSource(); ms.buffer = mbuf; ms.loop = true;
            var mg = ac.createGain(); mg.gain.setValueAtTime(loud ? 0.22 : 0.8, t0);
            if (vbuf && !origOn) { mg.gain.setValueAtTime(0.22, t0 + VOICE_AT + vDur); mg.gain.linearRampToValueAtTime(0.6, t0 + VOICE_AT + vDur + 0.8); }
            mg.gain.setValueAtTime(loud ? (origOn ? 0.22 : 0.6) : 0.8, t0 + secs - 1.6); mg.gain.linearRampToValueAtTime(0.0001, t0 + secs - 0.1);
            ms.connect(mg); mg.connect(dest); ms.start(t0); ms.stop(t0 + secs);
          }
          if (vbuf) {
            var vs = ac.createBufferSource(); vs.buffer = vbuf;
            var vg = ac.createGain(); vg.gain.value = 1;
            vs.connect(vg); vg.connect(dest); vs.start(t0 + VOICE_AT, 0, vDur);
            if (og) { og.gain.setValueAtTime(0.35, t0); og.gain.setValueAtTime(0.35, t0 + VOICE_AT + vDur); og.gain.linearRampToValueAtTime(1, t0 + VOICE_AT + vDur + 0.6); }
          }
          rec.start(250);
          var tick = function () {
            var t = Math.max(0, ac.currentTime - t0);
            draw(t); if (onProg) onProg(Math.min(1, t / secs));
            if (t >= secs) { try { rec.stop(); } catch (e) {} return; }
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        };
        /* 영상이면 먼저 재생을 시작하고 나서 소리 · 녹화를 맞춰 시작 (자동재생이 막히면 소리 없이) */
        var start = function () {
          if (!vid) { schedule(); return; }
          try { vid.currentTime = 0; } catch (e) {}
          var pp = vid.play();
          if (pp && pp.then) pp.then(schedule, function () { vid.muted = true; vid.play().then(schedule, schedule); });
          else schedule();
        };
        (ac.state === 'suspended' ? ac.resume() : Promise.resolve()).then(start, start);
      });
    });
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function reelBox(key, hasVoice, hasMusic) {
    var r = X.r, mine = r.key === key;
    var h = '<div class="reel"><h4>🎬 릴스 · 쇼츠 영상으로 합치기</h4>'
      + '<div class="rs">짤 + ' + (hasVoice ? '목소리' : '') + (hasVoice && hasMusic ? ' + ' : '') + (hasMusic ? '배경음악' : '') + ' → 세로 영상 1개 (인스타 릴스 · 유튜브 쇼츠 · 틱톡 공용) · <b>크레딧 0</b></div>'
      + '<div class="set-chips">' + [15, 30, 60].map(function (n) { return '<button class="set-chip' + (r.secs === n ? ' on' : '') + '" data-reel-secs="' + n + '">' + n + '초</button>'; }).join('') + '</div>'
      + '<div class="set-row" style="margin-top:10px"><button class="go" data-reel-go="' + key + '"' + (r.busy ? ' disabled' : '') + '>' + (r.busy && mine ? '영상 만드는 중…' : '🎬 영상 만들기') + '</button>'
      + '<span class="set-cost">' + r.secs + '초 동안 만들어져요 · 화면을 켜 두세요</span></div>';
    return h + reelOut(key) + '</div>';
  }
  function reelOut(key) {
    var r = X.r, mine = r.key === key, h = '';
    if (r.busy && mine) h += '<div class="rbar"><i id="reel-prog" style="width:' + Math.round(r.prog * 100) + '%"></i></div>';
    if (mine && r.err) h += errBox(r.err);
    if (mine && r.url) {
      h += '<video controls playsinline src="' + r.url + '"></video><div class="set-row" style="justify-content:center"><a class="btn btn-primary btn-sm" href="' + r.url + '" download="coverfo-reels.' + r.ext + '">💾 영상 저장 (' + r.ext.toUpperCase() + ')</a></div>';
      h += r.ext === 'mp4'
        ? '<div class="set-cost" style="text-align:center;margin-top:6px">저장한 영상을 인스타 릴스 · 유튜브 쇼츠 · 틱톡에 그대로 올리세요.</div>'
        : '<div class="set-cost" style="margin-top:6px">이 폰 브라우저는 <b>WebM</b> 으로 만들어요. 유튜브 쇼츠는 그대로 올라가요. 인스타는 MP4가 필요할 수 있어요 — 그럴 땐 갤러리에서 한 번 편집·저장하거나 CapCut 으로 열어 내보내면 MP4가 돼요.</div>';
    }
    return h;
  }

  /* ── 짤 그리기 (글자는 그림 위에 직접 → 한글이 깨지지 않음, 문구는 몇 번이든 공짜로 다시) ── */
  function drawMeme(img, top, bottom) {
    var W = 1080, c = document.createElement('canvas');
    c.width = W; c.height = W;
    var g = c.getContext('2d');
    var s = Math.max(W / img.width, W / img.height);
    g.drawImage(img, (W - img.width * s) / 2, (W - img.height * s) / 2, img.width * s, img.height * s);
    function caption(text, atTop) {
      text = String(text || '').trim(); if (!text) return;
      var size = 96, lines;
      g.textAlign = 'center'; g.lineJoin = 'round';
      for (;;) {
        g.font = '900 ' + size + 'px "Pretendard Variable","Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif';
        lines = wrap(g, text, W - 80);
        if ((lines.length <= 2 && lines.every(function (l) { return g.measureText(l).width <= W - 80; })) || size <= 44) break;
        size -= 6;
      }
      var lh = size * 1.15;
      var y0 = atTop ? 40 + size : W - 40 - (lines.length - 1) * lh;
      lines.forEach(function (l, i) {
        var y = y0 + i * lh;
        g.lineWidth = size * 0.16; g.strokeStyle = '#000'; g.strokeText(l, W / 2, y);
        g.fillStyle = '#fff'; g.fillText(l, W / 2, y);
      });
    }
    caption(top, true); caption(bottom, false);
    g.font = '700 22px sans-serif'; g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,.75)';
    g.fillText('coverfo', W - 18, W - 14);
    return c.toDataURL('image/png');
  }
  function wrap(g, text, max) {
    var words = text.split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) {
      var t = cur ? cur + ' ' + w : w;
      if (g.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function parseJSON(t) {
    var a = String(t || '').indexOf('{'), b = String(t || '').lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('기획 결과를 읽지 못했습니다. 다시 눌러 주세요.');
    var body = t.slice(a, b + 1);
    try { return JSON.parse(body); } catch (e) { return JSON.parse(fixJSON(body)); }
  }
  /* AI 가 글 안에 줄바꿈을 그대로 넣은 경우 → \n 으로 바꿔서 읽음 */
  function fixJSON(t) {
    var out = '', inStr = false, esc2 = false;
    for (var i = 0; i < t.length; i++) {
      var ch = t[i];
      if (inStr) {
        if (esc2) { esc2 = false; out += ch; continue; }
        if (ch === '\\') { esc2 = true; out += ch; continue; }
        if (ch === '"') inStr = false;
        if (ch === '\n') { out += '\\n'; continue; }
        if (ch === '\r') continue;
        if (ch === '\t') { out += ' '; continue; }
      } else if (ch === '"') inStr = true;
      out += ch;
    }
    return out;
  }

  /* ── 홍보 카드 (기본 레시피 탭 맨 위) ─────────────── */
  function hero() {
    return '<div class="set-hero">'
      + '<span class="k">🎁 NEW · 콘텐츠 3종 세트</span>'
      + '<h2>주제 한 줄이면<br><em>목소리 + 음악 + 짤</em>이 한 번에 <span class="plus">+영상까지</span></h2>'
      + '<p>SNS · 가게 홍보 · 생일 축하까지, 올릴 거리 3가지를 1분 만에.</p>'
      + '<div class="set-tri">'
      + '<button data-set-go="voice"><i>🎙️</i>AI 목소리<span>성우처럼 말투까지</span></button>'
      + '<button data-set-go="music"><i>🎵</i>AI 음악<span>30초 BGM · 한 곡</span></button>'
      + '<button data-set-go="meme"><i>😂</i>밈 · 짤<span>한글 문구 짤</span></button>'
      + '</div>'
      + '<div class="set-ex">예시) <b>"우리 카페 가을 신메뉴"</b><br>🎙️ 라디오 DJ 목소리 홍보 멘트 · 🎵 잔잔한 어쿠스틱 30초 · 😂 "이 맛에 가을 기다렸다" 짤</div>'
      + '<button class="set-go" data-set-go="set">✨ 3종 세트 한 번에 만들기<small>' + (COST.plan + COST.voice + COST.clip + COST.image) + ' 크레딧</small></button>'
      + '<button class="set-mine" data-set-go="made">📂 내가 만든 것 다시 보기 (' + madeList().length + ')</button>'
      + '</div><div class="set-sec">기본 레시피</div>';
  }

  function chips(list, attr, cur) {
    return '<div class="set-chips">' + list.map(function (x) {
      var v = Array.isArray(x) ? x[0] : x, t = Array.isArray(x) ? x[1] : x;
      return '<button class="set-chip' + (cur === v ? ' on' : '') + (cur === undefined ? ' ex' : '') + '" ' + attr + '="' + esc(v) + '">' + esc(t) + '</button>';
    }).join('') + '</div>';
  }
  function head(t, lead) {
    return '<div class="set-top"><h2><span class="back" data-set-back="1">←</span>' + t + '</h2><button class="set-link" data-set-go="made">📂 내가 만든 것</button></div><div class="lead">' + lead + '</div>';
  }
  function errBox(e) { return e ? '<div class="set-err">⚠️ ' + esc(e) + '</div>' : ''; }

  function viewVoice() {
    var v = X.v, h = '<div class="set-box">' + head('🎙️ AI 목소리', '글을 넣고 말투를 고르면 성우처럼 읽어 줘요. 가게 홍보 멘트 · 영상 내레이션 · 안내 방송에 좋아요.');
    h += '<label class="set-lb">읽을 글</label><textarea class="set-in" id="sv-text" maxlength="2000" placeholder="예) 가을 한정 밤라떼가 나왔어요. 오늘 오시면 쿠키 하나 더!">' + esc(v.text) + '</textarea>';
    h += '<div class="set-row" style="margin-top:8px"><button class="btn btn-secondary btn-sm" id="sv-ai">✍️ AI가 대본 써주기 · ' + COST.plan + '크레딧</button><span class="set-cost">위 칸에 주제만 쓰고 누르세요</span></div>';
    h += '<label class="set-lb">말투</label>' + chips(STYLES, 'data-sv-style', v.custom ? '' : v.style);
    h += '<input class="set-in" style="margin-top:8px" id="sv-custom" maxlength="200" placeholder="직접 적기 (예: 할머니가 손주에게 말하듯 다정하게)" value="' + esc(v.custom) + '">';
    h += '<label class="set-lb">목소리</label><select class="set-in" id="sv-voice">' + VOICES2.map(function (x) { return '<option value="' + x[0] + '"' + (v.voice === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>';
    h += '<div class="set-row"><button class="btn btn-primary" id="sv-go"' + (v.busy ? ' disabled' : '') + '>' + (v.busy ? '만드는 중…' : '🎙️ 목소리 만들기') + '</button><span class="set-cost">한 번에 <b>' + COST.voice + '</b> 크레딧</span></div>';
    h += errBox(v.err);
    if (v.url) h += '<div class="set-out"><audio controls autoplay src="' + v.url + '"></audio><div class="set-row" style="margin-top:6px"><a class="btn btn-secondary btn-sm" href="' + v.url + '" download="coverfo-voice.mp3">💾 MP3 다운로드</a></div></div>';
    return h + '</div>';
  }

  function viewMusic() {
    var m = X.m, h = '<div class="set-box">' + head('🎵 AI 음악', '어떤 느낌의 음악인지 적으면 AI가 새로 작곡해요. 영상 배경음악 · 가게 BGM · 축하 노래에.');
    h += '<label class="set-lb">어떤 음악?</label><textarea class="set-in" id="sm-prompt" maxlength="600" placeholder="예) 비 오는 날 카페, 잔잔한 피아노와 빗소리, 느린 템포">' + esc(m.prompt) + '</textarea>';
    h += '<div style="margin-top:8px">' + chips(GENRES, 'data-sm-ex') + '</div>';
    h += '<label class="set-lb">길이</label>' + chips([['clip', '30초 · ' + COST.clip + '크레딧'], ['song', '한 곡 (약 2분) · ' + COST.song + '크레딧']], 'data-sm-mode', m.mode);
    h += '<label class="set-lb">노래</label>' + chips([['inst', '🎹 연주곡'], ['auto', '🎤 노래 (가사 AI)'], ['lyrics', '📝 내 가사로']], 'data-sm-vocal', m.vocal);
    if (m.vocal === 'lyrics') h += '<textarea class="set-in" style="margin-top:8px" id="sm-lyrics" maxlength="1500" placeholder="[Verse] ...&#10;[Chorus] ...">' + esc(m.lyrics) + '</textarea>';
    h += '<div class="set-row"><button class="btn btn-primary" id="sm-go"' + (m.busy ? ' disabled' : '') + '>' + (m.busy ? '작곡 중… (최대 1~2분)' : '🎵 음악 만들기') + '</button><span class="set-cost"><b>' + (m.mode === 'song' ? COST.song : COST.clip) + '</b> 크레딧</span></div>';
    h += '<div class="set-cost" style="margin-top:8px">실제 가수 이름이나 유명한 노래 가사는 넣지 마세요 (만들어지지 않아요).</div>';
    h += errBox(m.err);
    if (m.url) {
      h += '<div class="set-out"><audio controls autoplay src="' + m.url + '"></audio><div class="set-row" style="margin-top:6px"><a class="btn btn-secondary btn-sm" href="' + m.url + '" download="coverfo-music.mp3">💾 MP3 다운로드</a></div>';
      if (m.words) h += '<div class="set-lyr">' + esc(m.words) + '</div>';
      h += '</div>';
    }
    return h + '</div>';
  }

  function viewMeme() {
    var j = X.j, h = '<div class="set-box">' + head('😂 밈 · 짤', '장면을 적으면 AI가 그림을 그리고, 그 위에 한글 문구를 올려요. 문구는 그림을 다시 만들지 않고 몇 번이든 바꿀 수 있어요.');
    h += '<label class="set-lb">어떤 장면?</label><textarea class="set-in" id="sj-scene" maxlength="300" placeholder="예) 월요일 아침 이불 속에서 안 나오는 고양이">' + esc(j.scene) + '</textarea>';
    h += '<div style="margin-top:8px">' + chips(SCENES, 'data-sj-ex') + '</div>';
    h += '<label class="set-lb">윗 문구</label><input class="set-in" id="sj-top" maxlength="40" placeholder="예) 월요일이라고?" value="' + esc(j.top) + '">';
    h += '<label class="set-lb">아랫 문구</label><input class="set-in" id="sj-bottom" maxlength="60" placeholder="예) 난 아직 일요일이다옹" value="' + esc(j.bottom) + '">';
    h += '<div class="set-row" style="margin-top:8px"><button class="btn btn-secondary btn-sm" id="sj-ai">🤖 AI 문구 추천 · ' + COST.plan + '크레딧</button></div>';
    h += '<div class="set-row"><button class="btn btn-primary" id="sj-go"' + (j.busy ? ' disabled' : '') + '>' + (j.busy ? '그리는 중… (10~20초)' : (j.img ? '🔄 그림 새로 만들기' : '😂 짤 만들기')) + '</button><span class="set-cost">그림 <b>' + COST.image + '</b> 크레딧' + (j.img ? ' · 문구만 바꾸기는 무료' : '') + '</span></div>';
    if (j.img) h += '<div class="set-row" style="margin-top:8px"><button class="btn btn-secondary btn-sm" id="sj-redraw">✏️ 문구만 바꿔서 다시 그리기 (무료)</button></div>';
    h += errBox(j.err);
    if (j.png) h += '<div class="set-out"><img class="set-meme" src="' + j.png + '" alt="짤"><div class="set-row" style="justify-content:center"><a class="btn btn-secondary btn-sm" href="' + j.png + '" download="coverfo-meme.png">💾 PNG 다운로드</a></div></div>';
    return h + '</div>';
  }

  function viewSet() {
    var s = X.s, h = '<div class="set-box">' + head('🎁 콘텐츠 3종 세트', '주제 한 줄만 쓰면 AI가 기획해서 🎙️ 목소리 멘트 + 🎵 30초 음악 + 😂 짤 을 한 번에 만들어요.');
    h += '<label class="set-lb">주제</label><input class="set-in" id="ss-topic" maxlength="100" placeholder="예) 우리 카페 가을 신메뉴" value="' + esc(s.topic) + '">';
    h += '<div style="margin-top:8px">' + chips(TOPICS, 'data-ss-ex') + '</div>';
    h += '<label class="set-lb">목소리 말투</label>' + chips(STYLES, 'data-ss-style', s.style);
    h += '<div class="set-row"><button class="btn btn-primary" id="ss-go"' + (s.busy ? ' disabled' : '') + '>' + (s.busy ? '만드는 중… (1분쯤)' : '✨ 3종 세트 만들기') + '</button>'
      + '<span class="set-cost">기획 ' + COST.plan + ' + 목소리 ' + COST.voice + ' + 음악 ' + COST.clip + ' + 짤 ' + COST.image + ' = <b>' + (COST.plan + COST.voice + COST.clip + COST.image) + '</b> 크레딧</span></div>';
    if (s.steps.length) {
      h += '<div class="set-steps">' + s.steps.map(function (st) {
        var cls = st.st === 'run' ? ' run' : st.st === 'ok' ? ' ok' : st.st === 'bad' ? ' bad' : '';
        var ic = st.st === 'ok' ? '✓' : st.st === 'bad' ? '✗' : st.st === 'run' ? '◉' : '·';
        return '<div class="set-step' + cls + '"><i>' + ic + '</i>' + esc(st.t) + (st.d ? ' <span class="set-cost">— ' + esc(st.d) + '</span>' : '') + '</div>';
      }).join('') + '</div>';
    }
    h += errBox(s.err);
    if (s.plan) {
      h += '<div class="set-out">';
      if (s.voice) h += '<div class="set-card"><h4>🎙️ 목소리 멘트</h4><div class="q">' + esc(s.plan.narration || '') + '</div><audio controls src="' + s.voice + '"></audio><div class="set-row" style="margin-top:4px"><a class="btn btn-secondary btn-sm" href="' + s.voice + '" download="coverfo-set-voice.mp3">💾 MP3</a></div></div>';
      if (s.music) h += '<div class="set-card"><h4>🎵 30초 음악</h4><audio controls src="' + s.music + '"></audio><div class="set-row" style="margin-top:4px"><a class="btn btn-secondary btn-sm" href="' + s.music + '" download="coverfo-set-music.mp3">💾 MP3</a></div></div>';
      if (s.png) h += '<div class="set-card"><h4>😂 짤</h4><img class="set-meme" src="' + s.png + '" alt="짤"><div class="set-row" style="justify-content:center"><a class="btn btn-secondary btn-sm" href="' + s.png + '" download="coverfo-set-meme.png">💾 PNG</a><button class="btn btn-secondary btn-sm" id="ss-tomeme">✏️ 문구 바꾸기</button></div></div>';
      if (s.png && (s.voice || s.music) && !s.busy) h += reelBox('set', !!s.voice, !!s.music);
      h += '</div>';
    }
    return h + '</div>';
  }

  var KIND = { set: ['🎁', '3종 세트'], voice: ['🎙️', 'AI 목소리'], music: ['🎵', 'AI 음악'], meme: ['😂', '짤'], sns: ['📣', 'SNS 세트'], avatar: ['🗣️', 'AI 아바타'] };
  function when(t) {
    var d = new Date(t), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function viewMade() {
    var list = madeList();
    var h = '<div class="set-box"><div class="set-top"><h2><span class="back" data-set-back="1">←</span>📂 내가 만든 것</h2></div>'
      + '<div class="lead">목소리 · 음악 · 짤 · 3종 세트를 다시 듣고 · 보고 · 받을 수 있어요. 로그인한 계정에 최근 50개까지 남아서 폰 · PC 어디서나 같은 목록이 보여요.</div>';
    if (!list.length) h += '<div class="pro-empty">아직 만든 것이 없어요. 🎁 3종 세트나 🎙️ · 🎵 · 😂 를 만들어 보세요.</div>';
    list.forEach(function (x) {
      var k = KIND[x.t] || ['📄', ''], open = X.openMade === x.id;
      h += '<div class="made"><div class="mh"><span class="mi">' + k[0] + '</span><div class="mt"><b>' + esc(x.title || k[1]) + '</b><span>' + k[1] + ' · ' + when(x.at) + '</span></div>'
        + '<button class="btn btn-secondary btn-sm" data-made-open="' + x.id + '">' + (open ? '접기' : '▶ 보기') + '</button></div>';
      if (open) {
        h += '<div class="mb">';
        if (x.narration && x.t !== 'voice' && x.t !== 'avatar') h += '<div class="set-card"><h4>🎙️ 멘트</h4><div class="q">' + esc(x.narration) + '</div></div>';
        if (x.voice) h += '<audio controls src="' + esc(x.voice) + '"></audio><a class="btn btn-secondary btn-sm" href="' + esc(x.voice) + '" download="coverfo-voice.mp3">💾 목소리 MP3</a> ';
        if (x.music) h += '<audio controls src="' + esc(x.music) + '"></audio><a class="btn btn-secondary btn-sm" href="' + esc(x.music) + '" download="coverfo-music.mp3">💾 음악 MP3</a> ';
        if (x.lyrics) h += '<div class="set-lyr">' + esc(x.lyrics) + '</div>';
        if (x.video) h += '<video controls playsinline src="' + esc(x.video) + '" style="display:block;width:100%;max-width:280px;margin:8px auto;border-radius:14px;background:#000"></video><div class="set-row" style="justify-content:center"><a class="btn btn-secondary btn-sm" href="' + esc(x.video) + '" download="coverfo-video.mp4">💾 영상 MP4</a></div>';
        if (x.post) h += '<div class="set-card"><h4>📸 인스타 글</h4>' + copyBox('mp-' + x.id, x.post + (x.tags ? '\n\n' + x.tags : ''), 6) + '</div>';
        if (x.blog) h += '<div class="set-card"><h4>📝 블로그 글</h4>' + copyBox('mb-' + x.id, x.blog, 8) + '</div>';
        if (x.trans) h += '<div class="set-card"><h4>🌐 번역</h4>' + copyBox('mt-' + x.id, x.trans, 6) + '</div>';
        if (x.img) {
          var png = memePng[x.id];
          h += png ? '<img class="set-meme" style="margin-top:8px" src="' + png + '" alt="짤"><div class="set-row" style="justify-content:center"><a class="btn btn-secondary btn-sm" href="' + png + '" download="coverfo-meme.png">💾 짤 PNG</a><button class="btn btn-secondary btn-sm" data-made-edit="' + x.id + '">✏️ 문구 바꾸기</button></div>'
                   : '<div class="pro-empty" style="margin-top:8px">짤 불러오는 중…</div>';
        }
        if (x.img && memePng[x.id] && (x.voice || x.music)) h += reelBox(x.id, !!x.voice, !!x.music);
        else if (!x.img && (x.music || useAudio(x))) h += '<div class="set-row"><button class="btn btn-primary btn-sm" data-made-toreel="' + x.id + '">🎬 이 소리로 영상 만들기</button><span class="set-cost">폰 영상 · 사진에 이 소리를 얹어요</span></div>';
        else if (x.img && !x.voice && !x.music) h += '<div class="set-row"><button class="btn btn-primary btn-sm" data-made-toreel="' + x.id + '">🎬 이 짤로 영상 만들기</button></div>';
        if (x.voice && x.voice.indexOf('blob:') === 0) h += '<div class="set-cost">이 목소리는 저장되지 않았어요.</div>';
        h += '<div class="set-row"><button class="btn btn-secondary btn-sm" data-made-del="' + x.id + '">🗑 목록에서 지우기</button></div></div>';
      }
      h += '</div>';
    });
    return h + '</div>';
  }

  /* ── 🎬 영상 만들기: 폰으로 찍은 영상 · 사진 (또는 내 짤) + 음악 · 목소리 · 글자 → 세로 영상 ── */
  X.e = { file: null, furl: '', fkind: '', dur: 0, meme: '', orig: true, music: '', voice: '', subs: true, top: '', bottom: '', secs: 15 };
  function reelSecs() { var e = X.e; return e.secs || Math.max(3, Math.min(60, Math.round(e.dur || 15))); }
  function useAudio(x) { return x && x.voice && String(x.voice).indexOf('blob:') !== 0; }
  function ensureMeme(id) {
    var x = madeList().filter(function (m) { return m.id === id; })[0];
    if (!x || !x.img || memePng[id]) return Promise.resolve();
    return loadImg(x.img).then(function (img) { memePng[id] = drawMeme(img, x.top, x.bottom); });
  }
  function viewReel() {
    var e = X.e, list = madeList();
    var memes = list.filter(function (x) { return x.img; });
    var musics = list.filter(function (x) { return x.music; });
    var voices = list.filter(useAudio);
    var short = function (t, n) { t = String(t || ''); return t.length > n ? t.slice(0, n) + '…' : t; };
    var h = '<div class="set-box">' + head('🎬 영상 만들기', '폰으로 찍은 영상 · 사진이나 내 짤에 음악 · 목소리 · 글자를 얹어 세로 영상 1개로 만들어요. 인스타 릴스 · 유튜브 쇼츠 · 틱톡에 올릴 수 있어요. 폰 안에서 만들어서 <b>크레딧 0</b>.');

    h += '<label class="set-lb">① 배경 — 영상 · 사진</label>'
      + '<label class="se-pick">📱 폰 영상 · 사진 고르기<input type="file" id="se-file" accept="video/*,image/*"></label>';
    if (memes.length) {
      h += '<div class="set-cost" style="margin:8px 0 6px">또는 내가 만든 짤로</div><div class="set-chips">'
        + memes.slice(0, 12).map(function (x) { return '<button class="set-chip' + (e.meme === x.id ? ' on' : '') + '" data-se-meme="' + x.id + '">😂 ' + esc(short(x.title || '짤', 12)) + '</button>'; }).join('') + '</div>';
    }
    if (e.meme) h += memePng[e.meme] ? '<img class="se-prev" src="' + memePng[e.meme] + '" alt="짤">' : '<div class="pro-empty" style="margin-top:8px">짤 불러오는 중…</div>';
    else if (e.furl && e.fkind === 'video') h += '<video class="se-prev" id="se-prev" src="' + e.furl + '" muted playsinline controls></video>';
    else if (e.furl) h += '<img class="se-prev" src="' + e.furl + '" alt="사진">';

    h += '<label class="set-lb">② 소리</label>';
    if (e.furl && e.fkind === 'video' && !e.meme) h += '<label class="se-chk"><input type="checkbox" id="se-orig"' + (e.orig ? ' checked' : '') + '>🔊 영상 원래 소리 넣기</label>';
    h += '<select class="set-in" style="margin-top:8px" id="se-music"><option value="">🎵 배경음악 없음</option>'
      + musics.map(function (x) { return '<option value="' + x.id + '"' + (e.music === x.id ? ' selected' : '') + '>🎵 ' + esc(short(x.title || '음악', 26)) + '</option>'; }).join('') + '</select>';
    h += '<select class="set-in" style="margin-top:8px" id="se-voice"><option value="">🎙️ 목소리 없음</option>'
      + voices.map(function (x) { return '<option value="' + x.id + '"' + (e.voice === x.id ? ' selected' : '') + '>🎙️ ' + esc(short(x.title || '목소리', 26)) + '</option>'; }).join('') + '</select>';
    if (e.voice) h += '<label class="se-chk"><input type="checkbox" id="se-subs"' + (e.subs ? ' checked' : '') + '>💬 목소리 멘트를 자막으로도 보여주기</label>';
    if (!musics.length || !voices.length) h += '<div class="set-cost" style="margin-top:6px">음악 · 목소리는 <a href="#" data-set-go="music">🎵 AI 음악</a> · <a href="#" data-set-go="voice">🎙️ AI 목소리</a> 에서 먼저 만들면 여기 나와요.</div>';

    if (!e.meme) {
      h += '<label class="set-lb">③ 글자 (선택)</label>'
        + '<input class="set-in" id="se-top" maxlength="40" placeholder="위 글자 (예: 가을 신메뉴 출시!)" value="' + esc(e.top).replace(/"/g, '&quot;') + '">'
        + '<input class="set-in" style="margin-top:8px" id="se-bottom" maxlength="60" placeholder="아래 글자 (예: 오늘만 쿠키 서비스)" value="' + esc(e.bottom).replace(/"/g, '&quot;') + '">';
    }

    h += '<label class="set-lb">' + (e.meme ? '③' : '④') + ' 길이</label>';
    var opts = [[15, '15초'], [30, '30초'], [60, '60초']];
    if (e.furl && e.fkind === 'video' && !e.meme) opts.push([0, '영상 길이대로' + (e.dur ? ' (' + Math.min(60, Math.round(e.dur)) + '초)' : '') + ' · 최대 60초']);
    h += '<div class="set-chips">' + opts.map(function (o) { return '<button class="set-chip' + (e.secs === o[0] ? ' on' : '') + '" data-se-secs="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>';

    var r = X.r, mine = r.key === 'tool';
    h += '<div class="set-row"><button class="btn btn-primary" id="se-go"' + (r.busy ? ' disabled' : '') + '>' + (r.busy && mine ? '영상 만드는 중…' : '🎬 영상 만들기') + '</button>'
      + '<span class="set-cost">' + reelSecs() + '초 동안 만들어져요 · 화면을 켜 두세요</span></div>';
    h += '<div class="reel" style="border:0;padding:0;background:none">' + reelOut('tool') + '</div>';
    return h + '</div>';
  }

  /* ── 공용: 복사 · AI 영상(구글 Veo, 스튜디오와 같은 /api/gen) ── */
  function copyText(t) {
    var done = function () { log('ok', '복사했어요'); alert('복사했어요. 붙여넣기 하세요.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(done, function () { copyOld(t); done(); });
    copyOld(t); done();
  }
  function copyOld(t) {
    var ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove();
  }
  function copyBox(id, text, rows) {
    return '<textarea class="set-in" readonly id="' + id + '" rows="' + (rows || 5) + '" style="min-height:0">' + esc(text) + '</textarea>'
      + '<div class="set-row" style="margin-top:6px"><button class="btn btn-secondary btn-sm" data-copy="' + id + '">📋 복사</button></div>';
  }
  /* 영상 만들기 시작 → 다 될 때까지 6초마다 확인 (보통 1~3분). onTick(지난 초) */
  function genVideo(prompt, aspect, image, onTick) {
    var body = { kind: 'video', prompt: prompt, aspect: aspect };
    if (image) body.image = image;
    return post('/api/gen', body).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401) throw new Error('로그인이 필요합니다. coverfo 홈에서 로그인한 뒤 다시 열어 주세요.');
        if (r.status === 402) throw new Error('크레딧이 부족합니다 (AI 영상 ' + (j.need || COST.veo) + ' 크레딧). coverfo 에서 충전해 주세요.');
        if (!r.ok || !j.job_id) throw new Error(j.error || ('영상 만들기 실패 ' + r.status));
        return j.job_id;
      });
    }).then(function (job) {
      var t0 = Date.now();
      return new Promise(function (ok, no) {
        var check = function () {
          var sec = Math.round((Date.now() - t0) / 1000);
          if (onTick) onTick(sec);
          if (sec > 600) { no(new Error('너무 오래 걸려요. 잠시 뒤 coverfo 스튜디오의 "최근 만든 것"에서 확인해 주세요.')); return; }
          fetch('/api/gen?job=' + encodeURIComponent(job), { headers: authHeaders(), cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(function (j) {
              if (j.status === 'done' && j.result_url) ok(j.result_url);
              else if (j.status === 'failed') no(new Error('영상이 만들어지지 않았어요 (크레딧은 돌려드려요). ' + (j.error || '').slice(0, 120)));
              else setTimeout(check, 6000);
            })
            .catch(function () { setTimeout(check, 8000); });
        };
        setTimeout(check, 8000);
      });
    });
  }
  function stepsHtml(steps) {
    return '<div class="set-steps">' + steps.map(function (st) {
      var cls = st.st === 'run' ? ' run' : st.st === 'ok' ? ' ok' : st.st === 'bad' ? ' bad' : '';
      var ic = st.st === 'ok' ? '✓' : st.st === 'bad' ? '✗' : st.st === 'run' ? '◉' : '·';
      return '<div class="set-step' + cls + '"><i>' + ic + '</i>' + esc(st.t) + (st.d ? ' <span class="set-cost">— ' + esc(st.d) + '</span>' : '') + '</div>';
    }).join('') + '</div>';
  }

  /* ── 📣 SNS 콘텐츠 한 번에 만들기 ──
     주제 → ① AI 기획 · 글(인스타 포스트 · 해시태그 · 블로그 · 릴스 대본) → ② 이미지 ③ 목소리 ④ 음악 [⑤ AI 실사 영상] [번역]
     → 릴스 · 쇼츠 세로 영상(15 · 30 · 60초)은 폰 안에서 합침(크레딧 0) */
  var LANGS = ['영어', '일본어', '중국어', '베트남어', '태국어'];
  X.n = { topic: '', style: 'ad', secs: 30, veo: false, langs: [], busy: false, steps: [], plan: null, img: '', voice: '', music: '', clip: '', trans: {}, err: '' };
  function snsCost() { var n = X.n; return COST.plan + COST.image + COST.voice + COST.clip + (n.veo ? COST.veo : 0) + n.langs.length * COST.plan; }
  function viewSns() {
    var n = X.n, p = n.plan;
    var h = '<div class="set-box">' + head('📣 SNS 콘텐츠 한 번에', '주제 한 줄이면 <b>인스타 포스트(글+이미지) · 릴스 · 유튜브 쇼츠 영상 · 블로그 글 · 해시태그 · 번역</b>까지 한 세트로 나와요.');
    h += '<label class="set-lb">주제</label><input class="set-in" id="sn-topic" maxlength="100" placeholder="예) 카페 신메뉴 홍보 — 가을 한정 밤라떼" value="' + esc(n.topic).replace(/"/g, '&quot;') + '">';
    h += '<div style="margin-top:8px">' + chips(TOPICS, 'data-sn-ex') + '</div>';
    h += '<label class="set-lb">영상 목소리 말투</label>' + chips(STYLES, 'data-sn-style', n.style);
    h += '<label class="set-lb">릴스 · 쇼츠 길이</label>' + chips([['15', '15초'], ['30', '30초'], ['60', '60초']], 'data-sn-secs', String(n.secs));
    h += '<label class="set-lb">번역 (선택 · 한 나라 ' + COST.plan + '크레딧)</label><div class="set-chips">'
      + LANGS.map(function (l) { return '<button class="set-chip' + (n.langs.indexOf(l) >= 0 ? ' on' : '') + '" data-sn-lang="' + l + '">🌐 ' + l + '</button>'; }).join('') + '</div>';
    h += '<label class="se-chk"><input type="checkbox" id="sn-veo"' + (n.veo ? ' checked' : '') + '>🎥 AI 실사 영상(8초)을 영상 배경으로 · +' + COST.veo + ' 크레딧 (1~3분 더 걸려요)</label>';
    h += '<div class="set-row"><button class="btn btn-primary" id="sn-go"' + (n.busy ? ' disabled' : '') + '>' + (n.busy ? '만드는 중… (1~3분)' : '📣 한 번에 만들기') + '</button>'
      + '<span class="set-cost">기획·글 ' + COST.plan + ' + 이미지 ' + COST.image + ' + 목소리 ' + COST.voice + ' + 음악 ' + COST.clip + (n.veo ? ' + AI 영상 ' + COST.veo : '') + (n.langs.length ? ' + 번역 ' + n.langs.length * COST.plan : '') + ' = <b>' + snsCost() + '</b> 크레딧</span></div>';
    if (n.steps.length) h += stepsHtml(n.steps);
    h += errBox(n.err);
    if (p) {
      h += '<div class="set-out">';
      h += '<div class="set-card"><h4>📸 인스타그램 포스트</h4>';
      if (n.img) h += '<img class="set-meme" src="' + n.img + '" alt="포스트 이미지"><div class="set-row" style="justify-content:center"><a class="btn btn-secondary btn-sm" href="' + n.img + '" download="coverfo-post.png">💾 이미지 저장</a></div>';
      h += '<label class="set-lb">글 + 해시태그</label>' + copyBox('sn-post', (p.post || '') + '\n\n' + (p.tags || ''), 8) + '</div>';

      h += '<div class="set-card"><h4>🎬 릴스 · 유튜브 쇼츠 · 틱톡</h4>';
      if (p.title) h += '<div class="q"><b>제목</b> ' + esc(p.title) + '</div>';
      if (p.narration) h += '<div class="q">🎙️ ' + esc(p.narration) + '</div>';
      if (n.voice) h += '<audio controls src="' + n.voice + '"></audio>';
      if (n.music) h += '<audio controls src="' + n.music + '"></audio>';
      if (n.clip) h += '<video controls playsinline muted src="' + n.clip + '" style="display:block;max-width:200px;margin:8px auto;border-radius:12px;background:#000"></video>';
      if (!n.busy && (n.img || n.clip) && (n.voice || n.music)) {
        var r = X.r, mine = r.key === 'sns';
        h += '<div class="reel" style="margin-top:8px"><h4>🎬 세로 영상으로 합치기 · ' + n.secs + '초</h4><div class="rs">' + (n.clip ? 'AI 영상' : '이미지') + ' + 제목 + 목소리(자막) + 배경음악 → 릴스 · 쇼츠 · 틱톡 공용 · <b>크레딧 0</b></div>'
          + '<div class="set-row" style="margin-top:4px"><button class="go" data-sn-reel="1"' + (r.busy ? ' disabled' : '') + '>' + (r.busy && mine ? '영상 만드는 중…' : '🎬 영상 만들기') + '</button><span class="set-cost">' + n.secs + '초 동안 만들어져요 · 화면을 켜 두세요</span></div>'
          + reelOut('sns') + '</div>';
      }
      h += '</div>';

      if (p.blog) h += '<div class="set-card"><h4>📝 블로그 글</h4>' + copyBox('sn-blog', (p.blog_title ? p.blog_title + '\n\n' : '') + p.blog, 10) + '</div>';
      if (p.tags) h += '<div class="set-card"><h4># 해시태그</h4>' + copyBox('sn-tags', p.tags, 3) + '</div>';
      Object.keys(n.trans).forEach(function (l, i) { h += '<div class="set-card"><h4>🌐 ' + esc(l) + '</h4>' + copyBox('sn-tr' + i, n.trans[l], 7) + '</div>'; });
      h += '</div>';
    }
    h += '<div class="set-row"><button class="btn btn-secondary btn-sm" data-set-go="reel">📱 내 폰 영상 · 사진으로 영상 만들기</button></div>';
    return h + '</div>';
  }
  function runSns() {
    var n = X.n, topic = n.topic.trim();
    if (!topic) { alert('주제를 적어 주세요.'); return; }
    n.busy = true; n.err = ''; n.plan = null; n.img = ''; n.voice = ''; n.music = ''; n.clip = ''; n.trans = {};
    if (X.r.key === 'sns') { X.r.url = ''; X.r.err = ''; }
    n.steps = [{ k: 'plan', t: '① AI 기획 · 글 (포스트 · 블로그 · 해시태그 · 대본)', st: 'run' }, { k: 'img', t: '② 📸 이미지', st: '' }, { k: 'voice', t: '③ 🎙️ 내레이션 목소리', st: '' }, { k: 'music', t: '④ 🎵 배경음악', st: '' }];
    if (n.veo) n.steps.push({ k: 'veo', t: '⑤ 🎥 AI 실사 영상 8초', st: '' });
    if (n.langs.length) n.steps.push({ k: 'tr', t: '🌐 번역 (' + n.langs.join(' · ') + ')', st: '' });
    var setSt = function (k, st, d) { n.steps.forEach(function (x) { if (x.k === k) { x.st = st; if (d !== undefined) x.d = d; } }); render(); };
    render();
    var chars = { 15: 60, 30: 120, 60: 240 }[n.secs] || 120;
    var prompt = '아래 주제로 SNS 홍보 콘텐츠 한 세트를 기획하고 직접 써. 반드시 JSON 하나만 출력해:'
      + ' {"title":"릴스·쇼츠 제목 한국어 20자 이내",'
      + ' "post":"인스타그램 포스트 글 한국어 (이모지 조금, 4~7줄, 마지막 줄은 행동 유도)",'
      + ' "hashtags":["해시태그 12~15개, #는 빼고, 한국어 위주에 영어 조금"],'
      + ' "blog_title":"블로그 글 제목 한국어",'
      + ' "blog":"블로그 글 한국어 700~1000자 (소제목 2~3개, 줄바꿈은 \\n)",'
      + ' "narration":"릴스·쇼츠 내레이션 한국어 ' + chars + '자 안팎 (' + n.secs + '초 분량, 말하듯 자연스럽게)",'
      + ' "image_scene":"인스타 포스트 이미지 장면 영어 설명 (고급스러운 사진 느낌, 글자 없이)",'
      + ' "music":"배경음악 영어 설명 (장르·분위기·악기·템포, 보컬 없음)",'
      + ' "video_scene":"8초 세로 영상 장면 영어 설명 (카메라 움직임 포함, 사람이 말하지 않음, 글자 없이)"}.'
      + ' 실존 인물·상표·가수 이름은 쓰지 마.';
    aiText(topic, prompt).then(function (t) {
      var o = parseJSON(t);
      var tags = Array.isArray(o.hashtags) ? o.hashtags : String(o.hashtags || '').split(/[\s,]+/);
      o.tags = tags.map(function (x) { x = String(x).replace(/^#+/, '').trim(); return x ? '#' + x.replace(/\s+/g, '') : ''; }).filter(Boolean).join(' ');
      n.plan = o;
      n.steps.forEach(function (x) { x.st = x.k === 'plan' ? 'ok' : 'run'; });
      render();
      var saved = { t: 'sns', title: topic.slice(0, 40), narration: o.narration || '', post: o.post || '', tags: o.tags, blog: (o.blog_title ? o.blog_title + '\n\n' : '') + (o.blog || '') };
      var jobs = [];
      jobs.push(makeImage((o.image_scene || topic) + '. Premium Instagram post photo, appetizing and stylish, natural light, high quality, square composition. Absolutely no text, no letters, no logo, no watermark.', true)
        .then(function (x) { n.img = x.url; saved.img = x.url; setSt('img', 'ok'); }).catch(function (e) { setSt('img', 'bad', e.message); }));
      jobs.push(makeVoice(o.narration || topic, n.style, 'coral').then(function (u) { n.voice = u.obj; saved.voice = u.url; setSt('voice', 'ok'); })
        .catch(function (e) { setSt('voice', 'bad', e.message); }));
      jobs.push(makeMusic({ prompt: o.music || topic, mode: 'clip', vocal: 'inst' }).then(function (j) { n.music = j.url || j.data_url; saved.music = j.url || ''; setSt('music', 'ok'); })
        .catch(function (e) { setSt('music', 'bad', e.message); }));
      if (n.veo) {
        jobs.push(genVideo((o.video_scene || topic) + '. Vertical 9:16 short-form video, cinematic, smooth camera movement, bright and inviting. No text, no subtitles, no logos, no one speaking.', '9:16', null,
          function (s) { setSt('veo', 'run', s + '초 지남'); })
          .then(function (u) { n.clip = u; saved.video = u; setSt('veo', 'ok', ''); }).catch(function (e) { setSt('veo', 'bad', e.message); }));
      }
      if (n.langs.length) {
        var src = (o.post || '') + '\n\n' + o.tags, chain = Promise.resolve(), bad = 0;
        n.langs.forEach(function (l) {
          chain = chain.then(function () {
            return aiText(src, '이 인스타그램 글을 ' + l + '로 자연스럽게 번역해. 해시태그도 그 나라 사람들이 실제로 쓰는 말로 바꿔. 번역문만 출력해.')
              .then(function (tx) { n.trans[l] = tx.trim(); render(); }).catch(function () { bad++; });
          });
        });
        jobs.push(chain.then(function () {
          saved.trans = Object.keys(n.trans).map(function (l) { return '[' + l + ']\n' + n.trans[l]; }).join('\n\n');
          setSt('tr', bad ? 'bad' : 'ok', bad ? bad + '개 실패' : '');
        }));
      }
      return Promise.all(jobs).then(function () { if (saved.img || saved.voice || saved.music || saved.video) madeAdd(saved); });
    }).catch(function (e) { setSt('plan', 'bad'); n.err = e.message; })
      .then(function () { n.busy = false; render(); });
  }

  /* ── 🗣️ AI 아바타 영상 (말하는 나): 얼굴 사진 1장 + 대본 → 사진 속 사람이 말하는 8초 영상 (구글 Veo) ── */
  var TONES = [['bright', '😊 밝고 친근하게', 'in a bright, friendly and warm tone'], ['calm', '🙂 차분하고 믿음직하게', 'in a calm, trustworthy tone'],
    ['fun', '🤩 신나고 활기차게', 'in an excited, energetic tone'], ['pro', '👔 전문가처럼 또박또박', 'clearly and confidently like a professional presenter']];
  X.a = { photo: '', script: '', topic: '', tone: 'bright', aspect: '9:16', ok: false, busy: false, sec: 0, url: '', err: '' };
  function fitPhoto(file, aspect) {
    return new Promise(function (ok, no) {
      var img = new Image();
      img.onload = function () {
        var W = aspect === '16:9' ? 1280 : 720, H = aspect === '16:9' ? 720 : 1280;
        var c = document.createElement('canvas'); c.width = W; c.height = H;
        var g = c.getContext('2d'), s = Math.max(W / img.width, H / img.height);
        var dw = img.width * s, dh = img.height * s;
        g.drawImage(img, (W - dw) / 2, Math.min(0, (H - dh) * 0.35), dw, dh);   /* 얼굴이 잘리지 않게 위쪽을 조금 더 남김 */
        ok(c.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = function () { no(new Error('이 사진은 열 수 없어요. JPG · PNG 사진으로 해 주세요.')); };
      img.src = URL.createObjectURL(file);
    });
  }
  function viewAvatar() {
    var a = X.a;
    var h = '<div class="set-box">' + head('🗣️ AI 아바타 영상 · 말하는 나', '얼굴 사진 1장 + 대본만 넣으면, 사진 속 사람이 입 모양 · 표정을 맞춰 말하는 영상을 AI가 만들어요. 쇼핑몰 제품 소개 · 학원 강의 맛보기 · 릴스에 내 얼굴로.');
    h += '<label class="set-lb">① 얼굴 사진</label><label class="se-pick">🙂 얼굴 사진 고르기 (정면 · 밝은 사진)<input type="file" id="av-file" accept="image/*"></label>';
    if (a.photo) h += '<img class="se-prev" src="' + a.photo + '" alt="사진">';
    h += '<label class="set-lb">② 대본 — 8초 분량 (50자 안팎)</label><textarea class="set-in" id="av-script" maxlength="80" placeholder="예) 안녕하세요! 오늘 새로 나온 밤라떼, 지금 오시면 쿠키 하나 더 드려요.">' + esc(a.script) + '</textarea>'
      + '<div class="set-cost" id="av-count" style="margin-top:4px">' + a.script.length + '자' + (a.script.length > 55 ? ' · 길면 말이 빨라지거나 잘릴 수 있어요' : '') + '</div>';
    h += '<div class="set-row" style="margin-top:6px"><input class="set-in" style="flex:1;min-width:150px" id="av-topic" maxlength="80" placeholder="주제만 쓰면 AI가 대본을 써요" value="' + esc(a.topic).replace(/"/g, '&quot;') + '"><button class="btn btn-secondary btn-sm" id="av-ai">✍️ AI 대본 · ' + COST.plan + '크레딧</button></div>';
    h += '<label class="set-lb">③ 말투</label>' + chips(TONES.map(function (t) { return [t[0], t[1]]; }), 'data-av-tone', a.tone);
    h += '<label class="set-lb">④ 화면</label>' + chips([['9:16', '📱 세로 (릴스 · 쇼츠)'], ['16:9', '🖥 가로 (유튜브)']], 'data-av-aspect', a.aspect);
    h += '<label class="se-chk"><input type="checkbox" id="av-ok"' + (a.ok ? ' checked' : '') + '>내 사진이거나, 사진 속 사람에게 허락을 받았어요</label>'
      + '<div class="set-cost" style="margin:4px 0 0 26px">연예인 · 다른 사람 · 어린이 사진은 쓰지 마세요.</div>';
    h += '<div class="set-row"><button class="btn btn-primary" id="av-go"' + (a.busy ? ' disabled' : '') + '>' + (a.busy ? '만드는 중… ' + a.sec + '초 (보통 1~3분)' : '🗣️ 말하는 영상 만들기') + '</button><span class="set-cost"><b>' + COST.veo + '</b> 크레딧 · 8초</span></div>';
    h += '<div class="set-cost" style="margin-top:8px">목소리는 AI가 새로 만든 목소리예요 (내 목소리가 아니에요). 사진에 따라 구글 AI가 만들지 않을 수 있는데, 그때는 크레딧이 돌아와요.</div>';
    h += errBox(a.err);
    if (a.url) {
      h += '<div class="set-out"><video controls playsinline src="' + a.url + '" style="display:block;width:100%;max-width:300px;margin:0 auto;border-radius:14px;background:#000"></video>'
        + '<div class="set-row" style="justify-content:center"><a class="btn btn-primary btn-sm" href="' + a.url + '" download="coverfo-avatar.mp4">💾 영상 저장 (MP4)</a></div>'
        + '<div class="set-cost" style="text-align:center;margin-top:6px">저장한 영상을 인스타 릴스 · 유튜브 쇼츠 · 틱톡에 그대로 올리세요. 📂 내가 만든 것에도 남아요.</div></div>';
    }
    return h + '</div>';
  }

  window.RelaySet = { hero: hero, views: { set: viewSet, voice: viewVoice, music: viewMusic, meme: viewMeme, made: viewMade, reel: viewReel, sns: viewSns, avatar: viewAvatar } };

  /* ── 3종 세트 실행 ─────────────────────── */
  function runSet() {
    var s = X.s;
    if (!s.topic.trim()) { alert('주제를 적어 주세요.'); return; }
    s.busy = true; s.err = ''; s.plan = null; s.voice = ''; s.music = ''; s.png = ''; s.img = null;
    s.steps = [{ t: '① AI 기획 (멘트 · 음악 · 짤 문구)', st: 'run' }, { t: '② 🎙️ 목소리', st: '' }, { t: '③ 🎵 음악', st: '' }, { t: '④ 😂 짤', st: '' }];
    render();
    var prompt = '아래 주제로 SNS 콘텐츠 3종을 기획해. 반드시 JSON 하나만 출력해:'
      + ' {"narration":"15~25초 분량 한국어 멘트(2~4문장, 친근하게)",'
      + ' "music":"30초 배경음악 설명을 영어로(장르·분위기·악기·템포, 보컬 없음)",'
      + ' "meme_scene":"짤 그림 장면을 영어로(귀엽고 웃기게, 글자 없이)",'
      + ' "meme_top":"짤 윗문구 한국어 12자 이내","meme_bottom":"짤 아랫문구 한국어 16자 이내"}.'
      + ' 실존 인물·상표·가수 이름은 쓰지 마.';
    aiText(s.topic.trim(), prompt).then(function (t) {
      s.plan = parseJSON(t);
      s.steps[0].st = 'ok'; s.steps[1].st = 'run'; s.steps[2].st = 'run'; s.steps[3].st = 'run'; render();
      var saved = { t: 'set', title: s.topic.trim().slice(0, 40), narration: s.plan.narration || '', top: s.plan.meme_top || '', bottom: s.plan.meme_bottom || '' };
      var p1 = makeVoice(s.plan.narration || s.topic, s.style, 'coral').then(function (u) { s.voice = u.obj; saved.voice = u.url; s.steps[1].st = 'ok'; render(); })
        .catch(function (e) { s.steps[1].st = 'bad'; s.steps[1].d = e.message; render(); });
      var p2 = makeMusic({ prompt: s.plan.music || s.topic, mode: 'clip', vocal: 'inst' }).then(function (j) { s.music = j.url || j.data_url; saved.music = j.url || ''; s.steps[2].st = 'ok'; render(); })
        .catch(function (e) { s.steps[2].st = 'bad'; s.steps[2].d = e.message; render(); });
      var p3 = makeImage(s.plan.meme_scene || s.topic).then(function (o) {
        s.img = o.img; saved.img = o.url; s.png = drawMeme(o.img, s.plan.meme_top, s.plan.meme_bottom); s.steps[3].st = 'ok'; render();
      }).catch(function (e) { s.steps[3].st = 'bad'; s.steps[3].d = e.message; render(); });
      return Promise.all([p1, p2, p3]).then(function () { if (saved.voice || saved.music || saved.img) madeAdd(saved); });
    }).catch(function (e) { s.steps[0].st = 'bad'; s.err = e.message; })
      .then(function () { s.busy = false; render(); log('ok', '3종 세트 끝'); });
  }

  function runReel(key, src) {
    if (X.r.url) { try { URL.revokeObjectURL(X.r.url); } catch (e) {} }
    X.r.key = key; X.r.busy = true; X.r.prog = 0; X.r.url = ''; X.r.err = ''; render();
    makeReel(src, function (p) { X.r.prog = p; var b = document.getElementById('reel-prog'); if (b) b.style.width = Math.round(p * 100) + '%'; })
      .then(function (o) { X.r.url = o.url; X.r.ext = o.ext; log('ok', '영상 완성 (' + o.ext + ')'); })
      .catch(function (e) { X.r.err = e.message; })
      .then(function () { X.r.busy = false; render(); });
  }

  /* ── 이벤트 ─────────────────────────────── */
  var prevBind = bindEvents;
  bindEvents = function () {
    prevBind();
    /* 기본 레시피 목록 맨 앞에 📣 SNS 콘텐츠 한 번에 · 🎵 AI 음악 · 🎙️ AI 목소리 · 🗣️ AI 아바타 카드 (앞에 끼워 넣으니 거꾸로 적음) */
    if (S.screen === 'home' && (S.tab || 'basic') === 'basic') {
      var grid = document.querySelector('.recipes');
      if (grid && !grid.querySelector('[data-set-go="sns"]')) {
        [['avatar', '🗣️', 'AI 아바타 영상 · 말하는 나', '얼굴 사진 1장 + 대본 → 사진 속 내가 입 모양 · 표정을 맞춰 말하는 영상. 제품 소개 · 강의 맛보기 · 릴스에.', COST.veo + ' 크레딧'],
         ['voice', '🎙️', 'AI 목소리', '글을 넣고 말투를 고르면 성우처럼 읽어 줘요. 가게 홍보 멘트 · 영상 내레이션 · 안내 방송에.', COST.voice + ' 크레딧'],
         ['music', '🎵', 'AI 음악 만들기', '어떤 느낌인지 적으면 AI가 새로 작곡해요. 30초 BGM · 한 곡(약 2분) · 노래(가사)까지.', COST.clip + ' 크레딧부터'],
         ['sns', '📣', 'SNS 콘텐츠 한 번에 만들기', '주제 한 줄 → 인스타 포스트(글+이미지) · 릴스 · 쇼츠 영상(15 · 30 · 60초) · 블로그 글 · 해시태그 · 번역까지.', (COST.plan + COST.image + COST.voice + COST.clip) + ' 크레딧부터']
        ].forEach(function (c) {
          var card = document.createElement('div');
          card.className = 'recipe'; card.setAttribute('data-set-go', c[0]);
          card.innerHTML = '<div class="icon">' + c[1] + '</div><div class="name">' + c[2] + '</div><div class="desc">' + c[3] + '</div><div class="cost">🪙 ' + c[4] + '</div>';
          grid.insertBefore(card, grid.firstChild);
        });
      }
    }
    var on = function (sel, fn) { document.querySelectorAll(sel).forEach(function (el) { el.addEventListener('click', function (ev) { ev.preventDefault(); fn(el); }); }); };
    var val = function (id) { var el = document.getElementById(id); return el ? el.value : null; };

    on('[data-set-go]', function (el) { S.tab = el.getAttribute('data-set-go'); S.pro.msg = ''; render(); window.scrollTo(0, 0); });
    on('[data-set-back]', function () { S.tab = 'basic'; render(); });

    /* 목소리 */
    var keepV = function () { var v = X.v; if (val('sv-text') != null) v.text = val('sv-text'); if (val('sv-custom') != null) v.custom = val('sv-custom'); if (val('sv-voice') != null) v.voice = val('sv-voice'); };
    on('[data-sv-style]', function (el) { keepV(); X.v.style = el.getAttribute('data-sv-style'); X.v.custom = ''; render(); });
    on('#sv-ai', function () {
      keepV(); var v = X.v; if (!v.text.trim()) { alert('위 칸에 주제를 먼저 적어 주세요. (예: 가을 신메뉴 밤라떼 홍보)'); return; }
      v.err = ''; v.busy = true; render();
      aiText(v.text.trim(), '위 주제로 15~30초 분량의 한국어 낭독 대본을 써 줘. 소리 내어 읽기 좋게 2~5문장, 따옴표·설명 없이 대본만.')
        .then(function (t) { v.text = t.trim(); }).catch(function (e) { v.err = e.message; }).then(function () { v.busy = false; render(); });
    });
    on('#sv-go', function () {
      keepV(); var v = X.v; if (!v.text.trim()) { alert('읽을 글을 넣어 주세요.'); return; }
      v.err = ''; v.busy = true; render();
      makeVoice(v.text.trim(), v.style, v.voice, v.custom).then(function (u) {
        v.url = u.obj; log('ok', '목소리 완성');
        if (u.url) madeAdd({ t: 'voice', title: v.text.trim().slice(0, 40), voice: u.url, narration: v.text.trim() });
      })
        .catch(function (e) { v.err = e.message; }).then(function () { v.busy = false; render(); });
    });

    /* 음악 */
    var keepM = function () { var m = X.m; if (val('sm-prompt') != null) m.prompt = val('sm-prompt'); if (val('sm-lyrics') != null) m.lyrics = val('sm-lyrics'); };
    on('[data-sm-ex]', function (el) { keepM(); X.m.prompt = el.getAttribute('data-sm-ex'); render(); });
    on('[data-sm-mode]', function (el) { keepM(); X.m.mode = el.getAttribute('data-sm-mode'); render(); });
    on('[data-sm-vocal]', function (el) { keepM(); X.m.vocal = el.getAttribute('data-sm-vocal'); render(); });
    on('#sm-go', function () {
      keepM(); var m = X.m; if (!m.prompt.trim()) { alert('어떤 음악인지 적어 주세요.'); return; }
      m.err = ''; m.busy = true; m.words = ''; render();
      makeMusic({ prompt: m.prompt.trim(), mode: m.mode, vocal: m.vocal, lyrics: m.lyrics }).then(function (j) {
        m.url = j.url || j.data_url; m.words = j.lyrics || ''; log('ok', '음악 완성');
        if (j.url) madeAdd({ t: 'music', title: m.prompt.trim().slice(0, 40), music: j.url, lyrics: (j.lyrics || '').slice(0, 2000) });
      })
        .catch(function (e) { m.err = e.message; }).then(function () { m.busy = false; render(); });
    });

    /* 짤 */
    var keepJ = function () { var j = X.j; if (val('sj-scene') != null) j.scene = val('sj-scene'); if (val('sj-top') != null) j.top = val('sj-top'); if (val('sj-bottom') != null) j.bottom = val('sj-bottom'); };
    on('[data-sj-ex]', function (el) { keepJ(); X.j.scene = el.getAttribute('data-sj-ex'); render(); });
    on('#sj-ai', function () {
      keepJ(); var j = X.j; if (!j.scene.trim()) { alert('장면을 먼저 적어 주세요.'); return; }
      j.err = ''; j.busy = true; render();
      aiText(j.scene.trim(), '이 장면에 어울리는 웃긴 한국어 짤 문구를 만들어. JSON 하나만: {"top":"윗문구 12자 이내","bottom":"아랫문구 16자 이내"}')
        .then(function (t) { var o = parseJSON(t); j.top = o.top || j.top; j.bottom = o.bottom || j.bottom; if (j.img) { j.png = drawMeme(j.img, j.top, j.bottom); if (j.mid) madeUpdate(j.mid, { top: j.top, bottom: j.bottom }); } })
        .catch(function (e) { j.err = e.message; }).then(function () { j.busy = false; render(); });
    });
    on('#sj-go', function () {
      keepJ(); var j = X.j; if (!j.scene.trim()) { alert('장면을 적어 주세요.'); return; }
      j.err = ''; j.busy = true; render();
      makeImage(j.scene.trim()).then(function (o) {
        j.img = o.img; j.png = drawMeme(o.img, j.top, j.bottom); log('ok', '짤 완성');
        j.mid = madeAdd({ t: 'meme', title: (j.top || j.bottom || j.scene).slice(0, 40), img: o.url, top: j.top, bottom: j.bottom });
      })
        .catch(function (e) { j.err = e.message; }).then(function () { j.busy = false; render(); });
    });
    on('#sj-redraw', function () { keepJ(); var j = X.j; if (j.img) { j.png = drawMeme(j.img, j.top, j.bottom); if (j.mid) madeUpdate(j.mid, { top: j.top, bottom: j.bottom, title: (j.top || j.bottom || j.scene).slice(0, 40) }); render(); } });

    /* 🎬 영상 */
    on('[data-reel-secs]', function (el) { if (X.r.busy) return; X.r.secs = Number(el.getAttribute('data-reel-secs')); render(); });
    on('[data-reel-go]', function (el) {
      if (X.r.busy) return;
      var key = el.getAttribute('data-reel-go'), src;
      if (key === 'set') { var s = X.s; src = { png: s.png, voice: s.voice, music: s.music, narration: s.plan && s.plan.narration, title: s.topic }; }
      else { var x = madeList().filter(function (m) { return m.id === key; })[0]; if (!x) return; src = { png: memePng[key], voice: x.voice, music: x.music, narration: x.narration, title: x.title }; }
      src.secs = X.r.secs;
      runReel(key, src);
    });

    /* 🎬 영상 만들기 화면 */
    var keepE = function () {
      var e = X.e, ck = function (id) { var el = document.getElementById(id); return el ? el.checked : null; };
      if (val('se-music') != null) e.music = val('se-music');
      if (val('se-voice') != null) e.voice = val('se-voice');
      if (val('se-top') != null) e.top = val('se-top');
      if (val('se-bottom') != null) e.bottom = val('se-bottom');
      if (ck('se-orig') != null) e.orig = ck('se-orig');
      if (ck('se-subs') != null) e.subs = ck('se-subs');
    };
    var fileIn = document.getElementById('se-file');
    if (fileIn) fileIn.addEventListener('change', function () {
      var f = fileIn.files && fileIn.files[0]; if (!f) return;
      keepE(); var e = X.e;
      if (e.furl) { try { URL.revokeObjectURL(e.furl); } catch (er) {} }
      var isV = /^video\//.test(f.type) || /\.(mp4|mov|m4v|webm|3gp)$/i.test(f.name);
      e.file = f; e.furl = URL.createObjectURL(f); e.fkind = isV ? 'video' : 'image'; e.meme = ''; e.dur = 0;
      if (!isV && !e.secs) e.secs = 15;
      render();
    });
    var prev = document.getElementById('se-prev');
    if (prev) prev.addEventListener('loadedmetadata', function () {
      var d = isFinite(prev.duration) ? prev.duration : 0;
      if (d && Math.round(d) !== Math.round(X.e.dur)) { keepE(); X.e.dur = d; render(); }
    });
    ['se-music', 'se-voice', 'se-subs', 'se-orig'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.addEventListener('change', function () { keepE(); render(); });
    });
    on('[data-se-meme]', function (el) {
      keepE(); var e = X.e, id = el.getAttribute('data-se-meme');
      e.meme = e.meme === id ? '' : id;
      if (e.meme && e.secs === 0) e.secs = 15;
      render();
      if (e.meme) ensureMeme(e.meme).then(render, function () { X.r.err = '짤을 불러오지 못했어요.'; render(); });
    });
    on('[data-se-secs]', function (el) { if (X.r.busy) return; keepE(); X.e.secs = Number(el.getAttribute('data-se-secs')); render(); });
    on('#se-go', function () {
      if (X.r.busy) return;
      keepE(); var e = X.e, list = madeList();
      var find = function (id) { return id ? list.filter(function (m) { return m.id === id; })[0] : null; };
      var mu = find(e.music), vo = find(e.voice), me = find(e.meme);
      if (!e.meme && !e.furl) { alert('① 배경 영상 · 사진을 먼저 골라 주세요.'); return; }
      var src = { secs: reelSecs(), music: mu ? mu.music : '', voice: vo ? vo.voice : '', narration: vo && e.subs ? (vo.narration || '') : '' };
      var go = function () {
        if (me) { src.mode = 'card'; src.png = memePng[me.id]; src.title = me.title || ''; }
        else { src.mode = e.fkind; src.src = e.furl; src.orig = e.fkind === 'video' && e.orig; src.top = e.top; src.bottom = e.bottom; }
        runReel('tool', src);
      };
      if (me && !memePng[me.id]) ensureMeme(me.id).then(go, function () { X.r.key = 'tool'; X.r.err = '짤을 불러오지 못했어요.'; render(); });
      else go();
    });
    on('[data-made-toreel]', function (el) {
      var x = madeList().filter(function (m) { return m.id === el.getAttribute('data-made-toreel'); })[0]; if (!x) return;
      var e = X.e;
      e.music = x.music ? x.id : ''; e.voice = useAudio(x) ? x.id : ''; e.subs = true;
      e.meme = x.img ? x.id : '';
      if (e.meme && e.secs === 0) e.secs = 15;
      S.tab = 'reel'; render(); window.scrollTo(0, 0);
      if (e.meme) ensureMeme(e.meme).then(render, function () {});
    });

    /* 복사 */
    on('[data-copy]', function (el) { var t = document.getElementById(el.getAttribute('data-copy')); if (t) copyText(t.value); });

    /* 📣 SNS 한 번에 */
    var keepN = function () { if (val('sn-topic') != null) X.n.topic = val('sn-topic'); var c = document.getElementById('sn-veo'); if (c) X.n.veo = c.checked; };
    on('[data-sn-ex]', function (el) { keepN(); X.n.topic = el.getAttribute('data-sn-ex'); render(); });
    on('[data-sn-style]', function (el) { keepN(); X.n.style = el.getAttribute('data-sn-style'); render(); });
    on('[data-sn-secs]', function (el) { keepN(); X.n.secs = Number(el.getAttribute('data-sn-secs')); render(); });
    on('[data-sn-lang]', function (el) {
      keepN(); var l = el.getAttribute('data-sn-lang'), i = X.n.langs.indexOf(l);
      if (i >= 0) X.n.langs.splice(i, 1); else X.n.langs.push(l); render();
    });
    var snVeo = document.getElementById('sn-veo');
    if (snVeo) snVeo.addEventListener('change', function () { keepN(); render(); });
    on('#sn-go', function () { keepN(); runSns(); });
    on('[data-sn-reel]', function () {
      if (X.r.busy) return;
      var n = X.n, p = n.plan || {};
      var src = n.clip ? { mode: 'video', src: n.clip, orig: false, top: p.title || '' } : { mode: 'card', png: n.img, title: p.title || n.topic };
      src.voice = n.voice; src.music = n.music; src.narration = p.narration || ''; src.secs = n.secs;
      runReel('sns', src);
    });

    /* 🗣️ AI 아바타 */
    var keepA = function () {
      var a = X.a; if (val('av-script') != null) a.script = val('av-script'); if (val('av-topic') != null) a.topic = val('av-topic');
      var c = document.getElementById('av-ok'); if (c) a.ok = c.checked;
    };
    var avFile = document.getElementById('av-file');
    if (avFile) avFile.addEventListener('change', function () {
      var f = avFile.files && avFile.files[0]; if (!f) return;
      keepA(); X.a.file = f; X.a.err = '';
      fitPhoto(f, X.a.aspect).then(function (d) { X.a.photo = d; render(); }, function (e) { X.a.err = e.message; render(); });
    });
    var avScript = document.getElementById('av-script');
    if (avScript) avScript.addEventListener('input', function () {
      var c = document.getElementById('av-count'), L = avScript.value.length;
      if (c) c.textContent = L + '자' + (L > 55 ? ' · 길면 말이 빨라지거나 잘릴 수 있어요' : '');
    });
    on('[data-av-tone]', function (el) { keepA(); X.a.tone = el.getAttribute('data-av-tone'); render(); });
    on('[data-av-aspect]', function (el) {
      keepA(); var a = X.a; a.aspect = el.getAttribute('data-av-aspect');
      if (a.file) fitPhoto(a.file, a.aspect).then(function (d) { a.photo = d; render(); }); else render();
    });
    on('#av-ai', function () {
      keepA(); var a = X.a, topic = (a.topic || a.script).trim();
      if (!topic) { alert('대본 칸이나 주제 칸에 무엇을 말할지 먼저 적어 주세요.'); return; }
      a.err = ''; a.busy = true; render();
      aiText(topic, '위 주제로 사람이 카메라를 보고 8초 동안 말할 한국어 대본을 써. 40~50자, 1~2문장, 친근한 말투. 따옴표·설명 없이 대본만.')
        .then(function (t) { a.script = t.trim().replace(/^["'“”]+|["'“”]+$/g, '').slice(0, 80); })
        .catch(function (e) { a.err = e.message; }).then(function () { a.busy = false; render(); });
    });
    on('#av-go', function () {
      keepA(); var a = X.a;
      if (a.busy) return;
      if (!a.photo) { alert('① 얼굴 사진을 먼저 골라 주세요.'); return; }
      if (!a.script.trim()) { alert('② 대본을 적어 주세요.'); return; }
      if (!a.ok) { alert('내 사진이거나 허락받은 사진인지 확인 칸에 체크해 주세요.'); return; }
      var tone = (TONES.filter(function (t) { return t[0] === a.tone; })[0] || TONES[0])[2];
      var script = a.script.trim().replace(/"/g, "'");
      var prompt = 'A realistic talking-head video made from this photo. The person looks into the camera and speaks Korean ' + tone
        + ', with accurate lip sync, natural facial expressions, natural blinking and subtle head movement. Keep the face, hair, clothes and background exactly as in the photo. Static camera.'
        + ' The person says in Korean: "' + script + '". Clear voice, no background music, no subtitles, no on-screen text.';
      a.busy = true; a.err = ''; a.url = ''; a.sec = 0; render();
      genVideo(prompt, a.aspect, a.photo, function (s) { a.sec = s; var b = document.getElementById('av-go'); if (b) b.textContent = '만드는 중… ' + s + '초 (보통 1~3분)'; })
        .then(function (u) { a.url = u; log('ok', '아바타 영상 완성'); madeAdd({ t: 'avatar', title: script.slice(0, 40), video: u, narration: script }); })
        .catch(function (e) { a.err = e.message; })
        .then(function () { a.busy = false; render(); });
    });

    /* 내가 만든 것 */
    on('[data-made-open]', function (el) {
      var id = el.getAttribute('data-made-open');
      X.openMade = X.openMade === id ? null : id; render();
      var x = madeList().filter(function (m) { return m.id === id; })[0];
      if (X.openMade && x && x.img && !memePng[id]) {
        loadImg(x.img).then(function (img) { memePng[id] = drawMeme(img, x.top, x.bottom); render(); })
          .catch(function () { memePng[id] = ''; delete memePng[id]; });
      }
    });
    on('[data-made-del]', function (el) { if (!confirm('목록에서 지울까요? (만든 파일은 그대로 있어요)')) return; madeDel(el.getAttribute('data-made-del')); X.openMade = null; render(); });
    on('[data-made-edit]', function (el) {
      var x = madeList().filter(function (m) { return m.id === el.getAttribute('data-made-edit'); })[0]; if (!x) return;
      loadImg(x.img).then(function (img) {
        X.j.img = img; X.j.top = x.top || ''; X.j.bottom = x.bottom || ''; X.j.scene = X.j.scene || '';
        X.j.mid = x.t === 'meme' ? x.id : null; X.j.png = drawMeme(img, X.j.top, X.j.bottom); X.j.err = '';
        S.tab = 'meme'; render(); window.scrollTo(0, 0);
      });
    });

    /* 세트 */
    var keepS = function () { if (val('ss-topic') != null) X.s.topic = val('ss-topic'); };
    on('[data-ss-ex]', function (el) { keepS(); X.s.topic = el.getAttribute('data-ss-ex'); render(); });
    on('[data-ss-style]', function (el) { keepS(); X.s.style = el.getAttribute('data-ss-style'); render(); });
    on('#ss-go', function () { keepS(); runSet(); });
    on('#ss-tomeme', function () {
      var s = X.s; X.j.scene = (s.plan && s.plan.meme_scene) || ''; X.j.top = (s.plan && s.plan.meme_top) || ''; X.j.bottom = (s.plan && s.plan.meme_bottom) || '';
      X.j.img = s.img; X.j.png = s.png; S.tab = 'meme'; render(); window.scrollTo(0, 0);
    });
  };

  /* ── 뒤로가기: 탭·화면을 옮길 때마다 기록을 남겨서, 휴대폰 뒤로가기를 누르면 바로 전 화면으로 ──
     (이 화면은 /relay 안의 창(iframe)이라, 기록을 남기지 않으면 뒤로가기가 곧장 홈으로 나감) */
  var navLast = '', navRestoring = false;
  function navState() { return { relayTab: S.tab || 'basic', relayScr: S.screen === 'home' ? 'h' : 'r' }; }
  function navKey(st) { return st.relayTab + '|' + st.relayScr; }
  var renderBeforeNav = render;
  render = function () {
    renderBeforeNav();
    if (navRestoring) return;
    try {
      var st = navState(), k = navKey(st);
      if (!navLast) { history.replaceState(st, ''); navLast = k; return; }
      if (k !== navLast) { history.pushState(st, ''); navLast = k; }
    } catch (e) {}
  };
  window.addEventListener('popstate', function (ev) {
    var st = ev.state;
    if (!st || !st.relayTab) return;
    navRestoring = true;
    try {
      var g = document.getElementById('pro-guide'); if (g) g.classList.remove('on');
      S.tab = st.relayTab;
      if (st.relayScr === 'r' && S.recipe && S.screen !== 'running') S.screen = 'input';
      else if (st.relayScr === 'h') {
        if (typeof mediaRec !== 'undefined' && mediaRec && mediaRec.state === 'recording') stopRec();
        S.screen = 'home'; S.recipe = null; S.error = null;
      }
      renderBeforeNav();
      navLast = navKey(navState());
    } finally { navRestoring = false; }
    window.scrollTo(0, 0);
  });

  render();
  madeSync();
})();
