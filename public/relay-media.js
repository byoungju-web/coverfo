/* public/relay-media.js — Coverfo Relay: 🌍 내 영상 다국어 더빙 · 📷 사진 한 장 번역 · 설명 · 🧳 여행 사진 → 영상 일기
 * © 2026 coverfo All Rights Reserved
 *
 * relay-set.js 다음에 불립니다 (relay-set.js 가 내보낸 RelaySet.lib 도우미를 그대로 씀).
 * 서버: /api/stt (받아쓰기 2) · /api/relay-ai (번역 · 일기 글 3) · /api/voice (목소리 2) · /api/music (30초 음악 2)
 *       /api/lens-ask (사진 읽기 1장당 1 — 사진은 서버에 저장하지 않음)
 * 영상 합치기는 폰 안에서 (relay-set.js 의 makeReel · 크레딧 0).
 */
(function () {
  if (!window.RelaySet || !RelaySet.lib || typeof render !== 'function' || typeof S === 'undefined') return;
  var L = RelaySet.lib, X = L.X;
  var C = { stt: 2, ai: 3, voice: 2, clip: 2, lens: 1 };
  var DUB_COST = C.stt + C.ai + C.voice;                 /* 7 */
  var TRIP_BASE = C.ai + C.voice + C.clip;               /* 7 + 사진 수 */
  /* [코드, 화면 이름, AI 에게 줄 이름] */
  var DUB_LANGS = [['en', '🇺🇸 영어', 'English'], ['ja', '🇯🇵 일본어', 'Japanese (日本語)'], ['zh', '🇨🇳 중국어', 'Simplified Chinese (简体中文)'],
    ['es', '🇪🇸 스페인어', 'Spanish (Español)'], ['vi', '🇻🇳 베트남어', 'Vietnamese (Tiếng Việt)'], ['th', '🇹🇭 태국어', 'Thai (ภาษาไทย)'],
    ['id', '🇮🇩 인도네시아어', 'Indonesian (Bahasa Indonesia)'], ['fr', '🇫🇷 프랑스어', 'French (Français)'], ['ko', '🇰🇷 한국어', 'Korean (한국어)']];
  var EXP_LANGS = [['ko', '🇰🇷 한국어', '한국어'], ['en', '🇺🇸 영어', 'English (영어)'], ['ja', '🇯🇵 일본어', '日本語 (일본어)'], ['zh', '🇨🇳 중국어', '简体中文 (중국어 간체)'],
    ['vi', '🇻🇳 베트남어', 'Tiếng Việt (베트남어)'], ['th', '🇹🇭 태국어', 'ภาษาไทย (태국어)'], ['es', '🇪🇸 스페인어', 'Español (스페인어)']];
  var VOICES = [['nova', '👩 따뜻한 여성'], ['coral', '👩 밝은 여성'], ['ash', '👨 또렷한 남성'], ['onyx', '👨 낮은 남성']];
  var NOSPACE = { ja: 1, zh: 1, th: 1 };
  function lg(list, k) { return list.filter(function (l) { return l[0] === k; })[0] || list[0]; }
  function q(s) { return esc(String(s || '')).replace(/"/g, '&quot;'); }

  var css = document.createElement('style');
  css.textContent = [
    '.md-thumbs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px}',
    '.md-thumbs div{position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;background:#f0f1f5}',
    '.md-thumbs img{width:100%;height:100%;object-fit:cover;display:block}',
    '.md-thumbs b{position:absolute;left:4px;top:4px;background:rgba(0,0,0,.6);color:#fff;font-size:11px;border-radius:999px;padding:1px 7px}',
    '.md-thumbs button{position:absolute;right:4px;top:4px;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;font-size:13px;line-height:24px;padding:0}',
    '.md-two{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '.md-two .se-pick{padding:12px 6px;font-size:13px}',
    '.md-ans{white-space:pre-wrap;font-size:13.5px;line-height:1.65;color:#1f2937;background:#f6f7fb;border-radius:12px;padding:12px 13px}',
    '.md-qa{margin-top:8px;font-size:13px}',
    '.md-qa .mq{font-weight:800;color:#4338ca;margin-top:8px}',
    '.md-note{font-size:11.5px;color:#7a7890;margin-top:8px;line-height:1.55}'
  ].join('\n');
  document.head.appendChild(css);

  /* ── 서버 ─────────────────────────────── */
  function jsonOrErr(r, label) {
    return r.json().catch(function () { return {}; }).then(function (j) {
      if (r.status === 401) throw new Error('로그인이 필요합니다. coverfo 홈에서 로그인한 뒤 다시 열어 주세요.');
      if (r.status === 402) throw new Error('크레딧이 부족합니다. coverfo 에서 충전해 주세요.');
      if (!r.ok) throw new Error(j.error || (label + ' 실패 ' + r.status));
      return j;
    });
  }
  function stt(blob, name) {
    var fd = new FormData(); fd.append('file', blob, name);
    return fetch('/api/stt', { method: 'POST', headers: authHeaders(), body: fd }).then(function (r) { return jsonOrErr(r, '받아쓰기'); });
  }
  var LENS_ERR = {
    login: '로그인이 필요합니다. coverfo 홈에서 로그인한 뒤 다시 열어 주세요.',
    insufficient: '크레딧이 부족합니다. coverfo 에서 충전해 주세요.',
    off: '사진 읽기 기능이 지금 꺼져 있어요. 잠시 뒤 다시 해 주세요.',
    too_big: '사진이 너무 커요. 다른 사진으로 해 주세요.',
    not_image: '사진 파일만 넣을 수 있어요.',
    empty: '질문이 비어 있어요.',
    ai: 'AI 가 사진을 읽지 못했어요 (크레딧은 돌려드렸어요). 다시 해 주세요.',
    sanctioned: '이 지역에서는 쓸 수 없어요.'
  };
  function lens(blob, question, context) {
    var fd = new FormData();
    if (blob) fd.append('image', blob, 'photo.jpg');
    fd.append('question', String(question).slice(0, 500));
    if (context) fd.append('context', String(context).slice(0, 4000));
    return fetch('/api/lens-ask', { method: 'POST', headers: authHeaders(), body: fd }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.ok && j.ok) return j;
        var e = new Error(LENS_ERR[j.reason] || (r.status === 401 ? LENS_ERR.login : r.status === 402 ? LENS_ERR.insufficient : '사진 읽기 실패 ' + r.status));
        e.stop = r.status === 401 || r.status === 402 || j.reason === 'off';
        throw e;
      });
    });
  }

  /* ── 폰 안에서: 사진 줄이기 · 영상 소리 꺼내기 ─────────── */
  function shrink(file, max) {
    return new Promise(function (ok, no) {
      var u = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        c.toBlob(function (b) { if (b) ok({ blob: b, url: URL.createObjectURL(b) }); else no(new Error('사진을 줄이지 못했어요.')); }, 'image/jpeg', 0.88);
      };
      img.onerror = function () { URL.revokeObjectURL(u); no(new Error('이 사진은 열 수 없어요. JPG · PNG 사진으로 해 주세요.')); };
      img.src = u;
    });
  }
  function wav(f, rate) {
    var b = new ArrayBuffer(44 + f.length * 2), v = new DataView(b);
    var s = function (o, t) { for (var i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
    s(0, 'RIFF'); v.setUint32(4, 36 + f.length * 2, true); s(8, 'WAVE'); s(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, f.length * 2, true);
    for (var i = 0; i < f.length; i++) { var x = Math.max(-1, Math.min(1, f[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
    return new Blob([b], { type: 'audio/wav' });
  }
  /* 영상 속 소리 → 16kHz 한 채널 WAV (앞 maxSec 초). 60초면 약 1.9MB 라 서버로 빨리 감 */
  function videoAudio(file, maxSec) {
    var AC = window.AudioContext || window.webkitAudioContext, OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!AC || !OAC || !file.arrayBuffer) return Promise.reject(new Error('no-decode'));
    return file.arrayBuffer().then(function (ab) {
      var ac = new AC();
      return new Promise(function (ok, no) { ac.decodeAudioData(ab, ok, no); })
        .then(function (buf) { try { ac.close(); } catch (e) {} return buf; }, function (e) { try { ac.close(); } catch (x) {} throw e || new Error('no-decode'); });
    }).then(function (buf) {
      var rate = 16000, n = Math.max(1, Math.ceil(Math.min(buf.duration, maxSec) * rate));
      var oc = new OAC(1, n, rate), src = oc.createBufferSource();
      src.buffer = buf; src.connect(oc.destination); src.start(0);
      return oc.startRendering().then(function (r) { return wav(r.getChannelData(0), rate); });
    });
  }
  function audioDur(url) {
    return new Promise(function (ok) {
      var a = new Audio(); a.preload = 'metadata';
      a.onloadedmetadata = function () { ok(isFinite(a.duration) ? a.duration : 0); };
      a.onerror = function () { ok(0); };
      a.src = url;
    });
  }
  /* 띄어쓰기가 없는 글(일본어 · 중국어 · 태국어)은 자막이 화면 밖으로 넘치지 않게 13자씩 끊어 둠 */
  function subText(t, code) {
    t = String(t || '').trim();
    if (!NOSPACE[code]) return t;
    return t.split(/(?<=[。！？.!?])/).map(function (s) {
      s = s.replace(/\s+/g, ''); var out = [];
      for (var i = 0; i < s.length; i += 13) out.push(s.slice(i, i + 13));
      return out.join(' ');
    }).filter(Boolean).join(' ');
  }
  function clean(t) { return String(t || '').replace(/^\s*["'“”]+|["'“”]+\s*$/g, '').trim(); }
  function reelBox(key, secs, what) {
    var r = X.r, mine = r.key === key;
    return '<div class="reel"><h4>🎬 ' + what + '</h4><div class="rs">폰 안에서 합쳐요 · <b>크레딧 0</b> · ' + secs + '초 동안 만들어져요 (화면을 켜 두세요)</div>'
      + '<div class="set-row" style="margin-top:0"><button class="go" data-md-reel="' + key + '"' + (r.busy ? ' disabled' : '') + '>' + (r.busy && mine ? '영상 만드는 중…' : '🎬 영상 만들기') + '</button></div>'
      + L.reelOut(key) + '</div>';
  }
  function setSt(steps, i, st, d) { if (steps[i]) { steps[i].st = st; if (d != null) steps[i].d = d; } }

  /* ══ 1) 🌍 내 영상 다국어 더빙 ══════════════════════
     영상 고르기 → 소리 받아쓰기(2) → 번역(3) → 그 나라 말 AI 목소리(2) → 폰 안에서 영상에 입히기(0) */
  X.dub = { file: null, furl: '', dur: 0, lang: 'en', voice: 'nova', orig: false, subs: true, busy: false, steps: [], src: '', srcLang: '', tr: '', vobj: '', vurl: '', vdur: 0, err: '' };
  function dubSecs() { var d = X.dub; return Math.min(60, Math.max(3, Math.ceil(Math.max(Math.min(d.dur || 15, 60), d.vdur ? d.vdur + 1.3 : 0)))); }
  function viewDub() {
    var d = X.dub, ln = lg(DUB_LANGS, d.lang);
    var h = '<div class="set-box">' + L.head('🌍 내 영상 다국어 더빙', '폰 영상 속 말소리를 받아쓰고 → 고른 나라 말로 번역해서 → AI 목소리로 다시 입혀 세로 영상으로 만들어요. 해외 손님용 가게 소개 · 유튜브 · 릴스에. 최대 60초.');
    h += '<label class="set-lb">① 영상 고르기</label><label class="se-pick">🎞️ 폰 영상 고르기 (사람 말소리가 또렷한 영상)<input type="file" id="md-dub-file" accept="video/*"></label>';
    if (d.furl) {
      h += '<video class="se-prev" src="' + d.furl + '" playsinline controls></video>';
      h += '<div class="set-cost" style="text-align:center;margin-top:6px">' + (d.dur ? Math.round(d.dur) + '초 영상' : '') + (d.dur > 60 ? ' · <b>앞 60초만</b> 더빙해요' : '') + '</div>';
    }
    h += '<label class="set-lb">② 어느 나라 말로 더빙할까요?</label>' + L.chips(DUB_LANGS.map(function (l) { return [l[0], l[1]]; }), 'data-dub-lang', d.lang);
    h += '<label class="set-lb">③ 더빙 목소리</label>' + L.chips(VOICES, 'data-dub-voice', d.voice);
    h += '<label class="se-chk"><input type="checkbox" id="md-dub-orig"' + (d.orig ? ' checked' : '') + '>🔊 원래 소리도 작게 깔기 (현장 소리 · 배경음 살리기)</label>';
    h += '<label class="se-chk"><input type="checkbox" id="md-dub-subs"' + (d.subs ? ' checked' : '') + '>💬 ' + esc(ln[1].replace(/^\S+\s/, '')) + ' 자막도 넣기</label>';
    h += '<div class="set-row"><button class="btn btn-primary" id="md-dub-go"' + (d.busy ? ' disabled' : '') + '>' + (d.busy ? '더빙 준비 중…' : '🌍 더빙 시작') + '</button>'
      + '<span class="set-cost">받아쓰기 ' + C.stt + ' + 번역 ' + C.ai + ' + 목소리 ' + C.voice + ' = <b>' + DUB_COST + '</b> 크레딧 · 영상 합치기 0</span></div>';
    if (d.steps.length) h += L.stepsHtml(d.steps);
    h += L.errBox(d.err);
    if (d.src) h += '<div class="set-card"><h4>🎧 원래 말 (받아쓰기' + (d.srcLang ? ' · ' + esc(d.srcLang) : '') + ')</h4>' + L.copyBox('md-dub-src', d.src, 4) + '</div>';
    if (d.tr) {
      h += '<div class="set-card"><h4>🌐 ' + esc(ln[1]) + ' 번역 — 고칠 수 있어요</h4><textarea class="set-in" id="md-dub-tr" rows="5" style="min-height:0">' + esc(d.tr) + '</textarea>'
        + '<div class="set-row" style="margin-top:6px"><button class="btn btn-secondary btn-sm" id="md-dub-revoice"' + (d.busy ? ' disabled' : '') + '>🎙️ 고친 글로 목소리 다시 · ' + C.voice + '크레딧</button></div>';
      if (d.vobj) h += '<audio controls src="' + d.vobj + '" style="width:100%;margin-top:8px"></audio>';
      h += '</div>';
    }
    if (d.vobj && !d.busy) h += reelBox('dub', dubSecs(), '더빙 영상으로 합치기');
    h += '<div class="md-note">목소리는 AI 가 새로 만든 목소리예요 (영상 속 사람 목소리를 흉내 내지 않아요). 입 모양은 바뀌지 않아요. 번역이 원래 말보다 길면 영상이 처음부터 다시 돌면서 끝까지 읽어요. 내가 찍은 영상이거나 허락받은 영상만 쓰세요.</div>';
    return h + '</div>';
  }
  function dubAudio(d) {
    return videoAudio(d.file, 60).then(function (b) { return [b, 'audio.wav']; }, function () {
      /* 이 브라우저가 영상 소리를 못 꺼내면: 60초 이하 · 24MB 이하 MP4 · WebM 은 영상 파일을 그대로 보냄 */
      var t = String(d.file.type || '');
      if (d.dur <= 60.5 && d.file.size <= 24 * 1024 * 1024 && /mp4|webm/.test(t)) return [d.file, /webm/.test(t) ? 'video.webm' : 'video.mp4'];
      throw new Error('이 영상의 소리를 꺼내지 못했어요. 크롬에서 열거나, 60초 이하 MP4 영상으로 해 주세요.');
    });
  }
  function dubVoice(d) {
    return L.makeVoice(d.tr, 'calm', d.voice, 'Natural, clear dubbing narration. Speak at a comfortable pace that fits a short video.').then(function (u) {
      if (d.vobj) { try { URL.revokeObjectURL(d.vobj); } catch (e) {} }
      d.vobj = u.obj; d.vurl = u.url;
      return audioDur(u.obj).then(function (s) { d.vdur = s; });
    });
  }
  function runDub() {
    var d = X.dub, ln = lg(DUB_LANGS, d.lang), i = 0;
    if (!d.file) { alert('더빙할 영상을 먼저 골라 주세요.'); return; }
    d.busy = true; d.err = ''; d.src = ''; d.srcLang = ''; d.tr = ''; d.vobj = ''; d.vurl = ''; d.vdur = 0;
    d.steps = [{ t: '① 🎧 영상 말소리 받아쓰기', st: 'run' }, { t: '② 🌐 ' + ln[1].replace(/^\S+\s/, '') + ' 번역', st: '' }, { t: '③ 🎙️ 더빙 목소리', st: '' }];
    render();
    var secs = Math.round(Math.min(d.dur || 30, 60));
    dubAudio(d).then(function (a) { return stt(a[0], a[1]); }).then(function (j) {
      var text = String(j.text || '').trim();
      if (!text) throw new Error('영상에서 말소리를 찾지 못했어요. 사람 말소리가 또렷한 영상으로 해 주세요.');
      d.src = text; d.srcLang = j.language && j.language !== 'auto' ? j.language : '';
      setSt(d.steps, 0, 'ok'); i = 1; setSt(d.steps, 1, 'run'); render();
      return L.aiText(text, 'Translate the transcript below into natural spoken ' + ln[2] + '. It will be read aloud as a voice-over dub for a ' + secs + '-second video, so keep it the same length as the original or a little shorter so it fits in time. Keep names and numbers. Output only the translation in ' + ln[2] + ' — no quotes, no notes, no romanization, no original text.');
    }).then(function (t) {
      d.tr = clean(t); if (!d.tr) throw new Error('번역 결과가 비어 있어요. 다시 눌러 주세요.');
      setSt(d.steps, 1, 'ok'); i = 2; setSt(d.steps, 2, 'run'); render();
      return dubVoice(d);
    }).then(function () {
      setSt(d.steps, 2, 'ok', d.vdur ? Math.round(d.vdur) + '초' : '');
      log('ok', '더빙 목소리 완성');
      if (d.vurl) L.madeAdd({ t: 'dub', title: '🌍 ' + ln[1].replace(/^\S+\s/, '') + ' 더빙 · ' + d.tr.slice(0, 24), voice: d.vurl, narration: d.tr, trans: '[원래 말]\n' + d.src + '\n\n[' + ln[1].replace(/^\S+\s/, '') + ']\n' + d.tr });
    }).catch(function (e) { setSt(d.steps, i, 'bad'); d.err = e.message; })
      .then(function () { d.busy = false; render(); });
  }

  /* ══ 2) 📷 사진 한 장 → 어느 나라 글이든 번역 · 설명 ══════
     사진(1280px 로 줄여 보냄) → /api/lens-ask (1) → 원문 · 번역 · 설명. 더 묻기(1) · 읽어 주기(2) */
  X.lens = { blob: null, purl: '', lang: 'ko', extra: '', busy: false, ans: '', desc: '', ask: '', qa: [], qbusy: false, vobj: '', vbusy: false, mid: '', err: '' };
  function viewLens() {
    var o = X.lens;
    var h = '<div class="set-box">' + L.head('📷 사진 한 장 번역 · 설명', '메뉴판 · 표지판 · 안내문 · 약 설명서 · 상품 라벨… 어느 나라 글이든 사진을 찍으면 글자를 옮겨 적고, 번역하고, 무엇인지 쉽게 설명해 줘요.');
    h += '<label class="set-lb">① 사진</label><div class="md-two">'
      + '<label class="se-pick">📸 지금 찍기<input type="file" id="md-lens-cam" accept="image/*" capture="environment"></label>'
      + '<label class="se-pick">🖼️ 사진 고르기<input type="file" id="md-lens-file" accept="image/*"></label></div>';
    if (o.purl) h += '<img class="se-prev" src="' + o.purl + '" alt="사진">';
    h += '<label class="set-lb">② 무슨 말로 설명할까요?</label>' + L.chips(EXP_LANGS.map(function (l) { return [l[0], l[1]]; }), 'data-lens-lang', o.lang);
    h += '<label class="set-lb">③ 더 궁금한 것 (선택)</label><input class="set-in" id="md-lens-extra" maxlength="120" placeholder="예) 안 매운 메뉴는? · 하루에 몇 번 먹어요? · 몇 시까지 열어요?" value="' + q(o.extra) + '">';
    h += '<div class="set-row"><button class="btn btn-primary" id="md-lens-go"' + (o.busy ? ' disabled' : '') + '>' + (o.busy ? '사진 읽는 중…' : '📷 번역 · 설명 받기') + '</button><span class="set-cost"><b>' + C.lens + '</b> 크레딧</span></div>';
    h += L.errBox(o.err);
    if (o.ans) {
      h += '<div class="set-out"><div class="md-ans" id="md-lens-ans">' + esc(o.ans) + '</div>'
        + '<div class="set-row" style="margin-top:8px"><button class="btn btn-secondary btn-sm" id="md-lens-copy">📋 복사</button>'
        + '<button class="btn btn-secondary btn-sm" id="md-lens-say"' + (o.vbusy ? ' disabled' : '') + '>' + (o.vbusy ? '목소리 만드는 중…' : '🎙️ 읽어 주기 · ' + C.voice + '크레딧') + '</button></div>';
      if (o.vobj) h += '<audio controls src="' + o.vobj + '" style="width:100%;margin-top:8px"></audio>';
      if (o.qa.length) h += '<div class="md-qa">' + o.qa.map(function (x) { return '<div class="mq">Q. ' + esc(x.q) + '</div><div class="md-ans" style="margin-top:4px">' + esc(x.a) + '</div>'; }).join('') + '</div>';
      h += '<div class="set-row"><input class="set-in" style="flex:1;min-width:150px" id="md-lens-ask" maxlength="200" placeholder="이 사진에 대해 더 물어보기" value="' + q(o.ask) + '">'
        + '<button class="btn btn-secondary btn-sm" id="md-lens-more"' + (o.qbusy ? ' disabled' : '') + '>' + (o.qbusy ? '답 찾는 중…' : '💬 묻기 · ' + C.lens + '크레딧') + '</button></div></div>';
    }
    h += '<div class="md-note">사진은 저장하지 않아요. AI 가 글자를 잘못 읽거나 못 읽을 수 있어요 (손글씨 · 작은 글씨 · 흐린 사진). 약 · 알레르기 · 돈 · 법에 관한 것은 꼭 약사 · 직원 · 전문가에게 다시 확인하세요.</div>';
    return h + '</div>';
  }
  function lensQuestion(o) {
    var ln = lg(EXP_LANGS, o.lang)[2];
    return '이 사진 속 글자를 번역하고 설명해 줘. 답은 반드시 ' + ln + ' 로만 써. 아래 3부분으로:\n'
      + '📝 원문 — 사진 설명에 나온 글자를 그대로 옮겨 적기 (읽지 못한 부분은 [?])\n'
      + '🌐 번역 — ' + ln + ' 번역\n'
      + '💡 설명 — 이것이 무엇인지(메뉴 · 표지판 · 안내문 · 약 설명서 · 라벨 등)와 알아 두면 좋은 점. 메뉴면 어떤 음식인지, 약이면 쓰는 법과 주의할 점.\n'
      + '글자가 없으면 사진 속 물건 · 장소를 설명해.' + (o.extra.trim() ? '\n추가 질문: ' + o.extra.trim().slice(0, 120) : '');
  }
  function lensFile(f) {
    var o = X.lens; if (!f) return;
    o.err = ''; o.ans = ''; o.desc = ''; o.qa = []; o.vobj = ''; o.mid = '';
    shrink(f, 1280).then(function (p) {
      if (o.purl) { try { URL.revokeObjectURL(o.purl); } catch (e) {} }
      o.blob = p.blob; o.purl = p.url; render();
    }).catch(function (e) { o.err = e.message; render(); });
  }
  function runLens() {
    var o = X.lens;
    if (!o.blob) { alert('사진을 먼저 찍거나 골라 주세요.'); return; }
    o.busy = true; o.err = ''; o.ans = ''; o.desc = ''; o.qa = []; o.vobj = ''; o.mid = ''; render();
    lens(o.blob, lensQuestion(o)).then(function (j) {
      o.ans = String(j.answer || '').trim(); o.desc = String(j.description || '');
      log('ok', '사진 번역 · 설명 완성');
      o.mid = L.madeAdd({ t: 'lens', title: '📷 ' + o.ans.replace(/[📝🌐💡—\-\s]+/g, ' ').trim().slice(0, 30), trans: o.ans });
    }).catch(function (e) { o.err = e.message; })
      .then(function () { o.busy = false; render(); });
  }
  function lensMore() {
    var o = X.lens, ask = o.ask.trim();
    if (!ask) { alert('물어볼 것을 적어 주세요.'); return; }
    o.qbusy = true; o.err = ''; render();
    var ln = lg(EXP_LANGS, o.lang)[2];
    lens(null, ask.slice(0, 200) + '\n(답은 ' + ln + ' 로)', o.desc + '\n\n[앞에서 한 답]\n' + o.ans.slice(0, 1500)).then(function (j) {
      o.qa.push({ q: ask, a: String(j.answer || '').trim() }); o.ask = '';
    }).catch(function (e) { o.err = e.message; })
      .then(function () { o.qbusy = false; render(); });
  }
  function lensSay() {
    var o = X.lens; if (!o.ans) return;
    /* 읽어 줄 글: 번역 · 설명 부분 (원문은 다른 나라 글이라 뺌). 표시를 못 찾으면 전체 */
    var t = o.ans, k = t.indexOf('🌐');
    if (k >= 0) t = t.slice(k);
    t = t.replace(/[📝🌐💡]/g, '').trim().slice(0, 1900);
    o.vbusy = true; o.err = ''; render();
    L.makeVoice(t, 'calm', 'nova').then(function (u) {
      o.vobj = u.obj; if (u.url && o.mid) L.madeUpdate(o.mid, { voice: u.url });
    }).catch(function (e) { o.err = e.message; })
      .then(function () { o.vbusy = false; render(); });
  }

  /* ══ 3) 🧳 여행 사진 여러 장 → 영상 일기 ══════════════
     사진 2~8장 → 사진마다 AI 가 보고 설명(1장당 1) → 일기 내레이션 · 제목 · 음악 설명(3) → 목소리(2) + 배경음악(2) → 사진이 넘어가는 영상(0) */
  X.trip = { photos: [], place: '', memo: '', lang: 'ko', voice: 'nova', secs: 30, subs: true, busy: false, steps: [], plan: null, vobj: '', vurl: '', vdur: 0, mus: '', murl: '', err: '' };
  var TRIP_MAX = 8;
  function tripCost() { return X.trip.photos.length * C.lens + TRIP_BASE; }
  function tripSecs() { var t = X.trip; return Math.min(60, Math.max(t.secs, t.vdur ? Math.ceil(t.vdur + 1.3) : 0)); }
  function viewTrip() {
    var t = X.trip, n = t.photos.length;
    var h = '<div class="set-box">' + L.head('🧳 여행 사진 → 영상 일기', '여행 사진 여러 장을 고르면 AI 가 사진을 하나씩 보고 → 그날의 이야기를 일기처럼 써서 → 내레이션 목소리 · 배경음악과 함께 사진이 넘어가는 세로 영상으로 만들어요.');
    h += '<label class="set-lb">① 사진 ' + n + ' / ' + TRIP_MAX + '장 (2장 이상 · 보여 줄 순서대로)</label>';
    if (n < TRIP_MAX) h += '<label class="se-pick">🖼️ 여행 사진 고르기 (여러 장 한 번에)<input type="file" id="md-trip-file" accept="image/*" multiple></label>';
    if (n) h += '<div class="md-thumbs">' + t.photos.map(function (p, i) { return '<div><img src="' + p.url + '" alt=""><b>' + (i + 1) + '</b>' + (t.busy ? '' : '<button data-trip-del="' + i + '">✕</button>') + '</div>'; }).join('') + '</div>';
    h += '<label class="set-lb">② 어디 · 언제 (선택)</label><input class="set-in" id="md-trip-place" maxlength="60" placeholder="예) 2026년 10월 오사카 3박 4일" value="' + q(t.place) + '">';
    h += '<input class="set-in" style="margin-top:8px" id="md-trip-memo" maxlength="200" placeholder="한 줄 기억 (선택) 예) 엄마랑 처음 간 해외여행, 비 왔지만 즐거웠다" value="' + q(t.memo) + '">';
    h += '<label class="set-lb">③ 일기 언어 · 목소리</label>' + L.chips(EXP_LANGS.map(function (l) { return [l[0], l[1]]; }), 'data-trip-lang', t.lang);
    h += '<div style="margin-top:8px">' + L.chips(VOICES, 'data-trip-voice', t.voice) + '</div>';
    h += '<label class="set-lb">④ 영상 길이</label>' + L.chips([[15, '15초'], [30, '30초'], [60, '60초']], 'data-trip-secs', t.secs);
    h += '<label class="se-chk"><input type="checkbox" id="md-trip-subs"' + (t.subs ? ' checked' : '') + '>💬 내레이션을 자막으로도 보여주기</label>';
    h += '<div class="set-row"><button class="btn btn-primary" id="md-trip-go"' + (t.busy ? ' disabled' : '') + '>' + (t.busy ? '영상 일기 준비 중…' : '🧳 영상 일기 만들기') + '</button>'
      + '<span class="set-cost">사진 읽기 ' + n + '장×' + C.lens + ' + 일기 ' + C.ai + ' + 목소리 ' + C.voice + ' + 음악 ' + C.clip + ' = <b>' + tripCost() + '</b> 크레딧 · 영상 합치기 0</span></div>';
    if (t.steps.length) h += L.stepsHtml(t.steps);
    h += L.errBox(t.err);
    if (t.plan) {
      h += '<div class="set-out"><div class="set-card"><h4>✍️ ' + esc(t.plan.title || '여행 일기') + '</h4>' + L.copyBox('md-trip-story', t.plan.story || '', 5) + '</div>';
      if (t.vobj) h += '<div class="set-card"><h4>🎙️ 내레이션</h4><audio controls src="' + t.vobj + '" style="width:100%"></audio></div>';
      if (t.mus) h += '<div class="set-card"><h4>🎵 배경음악</h4><audio controls src="' + t.mus + '" style="width:100%"></audio></div>';
      if (!t.busy && (t.vobj || t.mus)) h += reelBox('trip', tripSecs(), '사진 ' + n + '장이 넘어가는 영상 일기');
      h += '</div>';
    }
    h += '<div class="md-note">사진은 AI 가 보고 설명을 쓰는 데만 쓰고 서버에 저장하지 않아요. 일기 글은 사진 · 메모를 바탕으로 AI 가 지은 글이라 실제와 다를 수 있어요 — 위 글을 확인하고 쓰세요.</div>';
    return h + '</div>';
  }
  function tripFiles(files) {
    var t = X.trip, list = Array.prototype.slice.call(files || [], 0, TRIP_MAX - t.photos.length);
    if (!list.length) return;
    t.err = '';
    list.reduce(function (p, f) {
      return p.then(function () { return shrink(f, 1280).then(function (x) { t.photos.push(x); }, function () {}); });
    }, Promise.resolve()).then(function () {
      if ((files.length || 0) > list.length) t.err = '사진은 ' + TRIP_MAX + '장까지 넣을 수 있어요. 앞의 ' + TRIP_MAX + '장만 넣었어요.';
      render();
    });
  }
  function runTrip() {
    var t = X.trip, n = t.photos.length, ln = lg(EXP_LANGS, t.lang);
    if (n < 2) { alert('여행 사진을 2장 이상 골라 주세요.'); return; }
    t.busy = true; t.err = ''; t.plan = null; t.vobj = ''; t.vurl = ''; t.vdur = 0; t.mus = ''; t.murl = '';
    t.steps = [{ t: '① 📷 사진 읽기 (' + n + '장)', st: 'run', d: '0 / ' + n }, { t: '② ✍️ 영상 일기 쓰기', st: '' }, { t: '③ 🎙️ 내레이션 목소리', st: '' }, { t: '④ 🎵 배경음악', st: '' }];
    render();
    var descs = [], done = 0, bad = 0;
    var chain = t.photos.reduce(function (p, ph, i) {
      return p.then(function () {
        return lens(ph.blob, '여행 영상 일기를 쓰려고 해. 이 사진에 보이는 장소 · 풍경 · 음식 · 사람들의 분위기 · 날씨 · 글자(간판 등)를 한국어 2~3문장으로 사실대로 설명해 줘. 보이지 않는 것은 추측하지 마.')
          .then(function (j) { descs[i] = String(j.answer || j.description || '').trim(); }, function (e) { if (e.stop) throw e; descs[i] = ''; bad++; })
          .then(function () { done++; setSt(t.steps, 0, 'run', done + ' / ' + n); var el = document.querySelector('.set-step.run .set-cost'); if (el) el.textContent = '— ' + done + ' / ' + n; });
      });
    }, Promise.resolve());
    var step = 0, secs = t.secs;
    chain.then(function () {
      if (bad === n) throw new Error('사진을 하나도 읽지 못했어요 (크레딧은 돌려드렸어요). 잠시 뒤 다시 해 주세요.');
      setSt(t.steps, 0, 'ok', bad ? bad + '장은 못 읽었어요' : ''); step = 1; setSt(t.steps, 1, 'run'); render();
      var info = (t.place.trim() ? '여행: ' + t.place.trim() + '\n' : '') + (t.memo.trim() ? '기억: ' + t.memo.trim() + '\n' : '')
        + descs.map(function (s, i) { return '사진 ' + (i + 1) + ': ' + (s || '(설명 없음)'); }).join('\n');
      var speak = Math.max(8, secs - 3);
      return L.aiText(info, '위 여행 정보와 사진 설명(보여 줄 순서대로)으로 세로 여행 영상의 일기 내레이션을 써. 반드시 JSON 하나만 출력해: '
        + '{"title":"영상 위에 띄울 짧은 제목 (' + ln[2] + ', 14자 안팎)",'
        + ' "story":"1인칭 여행 일기 내레이션 (' + ln[2] + ', 사진 순서대로 자연스럽게 이어지게, 소리 내어 읽으면 약 ' + speak + '초 — 한국어면 약 ' + Math.round(speak * 5.5) + '자, 다른 언어면 약 ' + Math.round(speak * 2.3) + '단어. 따뜻하고 설레는 말투)",'
        + ' "music":"이 여행 분위기에 맞는 배경음악 설명을 영어로 (장르 · 분위기 · 악기 · 템포, 보컬 없음)"}. '
        + '사진 설명과 메모에 없는 장소 이름 · 사실은 지어내지 마. 실존 인물 · 상표 · 가수 이름은 쓰지 마.');
    }).then(function (txt) {
      var p = L.parseJSON(txt);
      p.title = clean(p.title || t.place || '여행 일기').slice(0, 40); p.story = clean(p.story || '');
      if (!p.story) throw new Error('일기 글이 비어 있어요. 다시 눌러 주세요.');
      t.plan = p; setSt(t.steps, 1, 'ok'); step = 2; setSt(t.steps, 2, 'run'); setSt(t.steps, 3, 'run'); render();
      var a = L.makeVoice(p.story.slice(0, 1900), 'calm', t.voice, 'Warm, gentle travel vlog narration, a little excited, like reading a personal travel diary.').then(function (u) {
        t.vobj = u.obj; t.vurl = u.url;
        return audioDur(u.obj).then(function (s) { t.vdur = s; setSt(t.steps, 2, 'ok', Math.round(s) + '초'); });
      }, function (e) { setSt(t.steps, 2, 'bad', e.message); });
      var b = L.makeMusic({ prompt: String(p.music || 'warm acoustic travel vlog music') + ', travel vlog background music, no vocals', mode: 'clip', vocal: 'inst' }).then(function (j) {
        t.mus = j.url || j.data_url; t.murl = j.url || ''; setSt(t.steps, 3, 'ok');
      }, function (e) { setSt(t.steps, 3, 'bad', e.message); });
      return Promise.all([a, b]).then(function () {
        if (t.vurl || t.murl) L.madeAdd({ t: 'trip', title: '🧳 ' + p.title, voice: t.vurl, music: t.murl, narration: p.story });
        log('ok', '여행 영상 일기 준비 끝');
      });
    }).catch(function (e) { setSt(t.steps, step, 'bad'); t.err = e.message; })
      .then(function () { t.busy = false; render(); });
  }

  /* ── 화면 등록 ─────────────────────────────── */
  RelaySet.views.dub = viewDub;
  RelaySet.views.lens = viewLens;
  RelaySet.views.trip = viewTrip;

  /* ── 이벤트 ─────────────────────────────── */
  var HOME = [
    ['trip', '🧳', '여행 사진 → 영상 일기', '여행 사진 여러 장 → AI 가 사진을 보고 일기를 써서 내레이션 · 음악과 함께 사진이 넘어가는 영상으로.', '사진 수 + ' + TRIP_BASE + ' 크레딧'],
    ['lens', '📷', '사진 한 장 번역 · 설명', '메뉴판 · 표지판 · 약 설명서… 어느 나라 글이든 찍으면 옮겨 적고 · 번역하고 · 쉽게 설명해 줘요.', C.lens + ' 크레딧'],
    ['dub', '🌍', '내 영상 다국어 더빙', '폰 영상 말소리 → 영어 · 일본어 · 중국어 등으로 번역 → AI 목소리로 다시 입힌 영상.', DUB_COST + ' 크레딧']
  ];
  var prevBind = bindEvents;
  bindEvents = function () {
    prevBind();
    if (S.screen === 'home' && (S.tab || 'basic') === 'basic') {
      var grid = document.querySelector('.recipes');
      if (grid && !grid.querySelector('[data-md-go]')) {
        HOME.forEach(function (c) {
          var card = document.createElement('div');
          card.className = 'recipe'; card.setAttribute('data-md-go', c[0]);
          card.innerHTML = '<div class="icon">' + c[1] + '</div><div class="name">' + c[2] + '</div><div class="desc">' + c[3] + '</div><div class="cost">🪙 ' + c[4] + '</div>';
          grid.insertBefore(card, grid.firstChild);
        });
      }
    }
    var on = function (sel, fn) { document.querySelectorAll(sel).forEach(function (el) { el.addEventListener('click', function (ev) { ev.preventDefault(); fn(el); }); }); };
    var chg = function (id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('change', function () { fn(el); }); };
    var val = function (id) { var el = document.getElementById(id); return el ? el.value : null; };

    on('[data-md-go]', function (el) { S.tab = el.getAttribute('data-md-go'); render(); window.scrollTo(0, 0); });
    on('[data-md-reel]', function (el) {
      var k = el.getAttribute('data-md-reel');
      if (k === 'dub') {
        var d = X.dub; keepDub();
        L.runReel('dub', { mode: 'video', src: d.furl, orig: d.orig, voice: d.vobj, narration: d.subs ? subText(d.tr, d.lang) : '', secs: dubSecs() });
      } else if (k === 'trip') {
        var t = X.trip;
        L.runReel('trip', { mode: 'image', pngs: t.photos.map(function (p) { return p.url; }), voice: t.vobj, music: t.mus, narration: t.subs ? subText(t.plan && t.plan.story, t.lang) : '', top: t.plan ? t.plan.title : '', secs: tripSecs() });
      }
    });

    /* 1) 더빙 */
    var keepDub = function () { if (val('md-dub-tr') != null) X.dub.tr = val('md-dub-tr'); };
    chg('md-dub-file', function (el) {
      var f = el.files && el.files[0], d = X.dub; if (!f) return;
      if (f.size > 400 * 1024 * 1024) { alert('영상이 너무 커요 (400MB 까지). 짧게 자른 영상으로 해 주세요.'); return; }
      if (d.furl) { try { URL.revokeObjectURL(d.furl); } catch (e) {} }
      d.file = f; d.furl = URL.createObjectURL(f); d.dur = 0; d.err = ''; d.steps = []; d.src = ''; d.tr = ''; d.vobj = ''; d.vurl = ''; d.vdur = 0;
      var v = document.createElement('video'); v.preload = 'metadata'; v.muted = true;
      v.onloadedmetadata = function () { d.dur = isFinite(v.duration) ? v.duration : 0; render(); };
      v.onerror = function () { d.err = '이 영상은 열 수 없어요. 다른 영상(MP4)으로 해 보세요.'; render(); };
      v.src = d.furl; render();
    });
    on('[data-dub-lang]', function (el) { keepDub(); X.dub.lang = el.getAttribute('data-dub-lang'); render(); });
    on('[data-dub-voice]', function (el) { keepDub(); X.dub.voice = el.getAttribute('data-dub-voice'); render(); });
    chg('md-dub-orig', function (el) { X.dub.orig = el.checked; });
    chg('md-dub-subs', function (el) { X.dub.subs = el.checked; });
    on('#md-dub-go', function () { runDub(); });
    on('#md-dub-revoice', function () {
      keepDub(); var d = X.dub; d.tr = d.tr.trim();
      if (!d.tr) { alert('읽을 번역 글을 넣어 주세요.'); return; }
      d.busy = true; d.err = ''; render();
      dubVoice(d).then(function () {
        if (d.vurl) L.madeAdd({ t: 'dub', title: '🌍 더빙 (고친 글) · ' + d.tr.slice(0, 24), voice: d.vurl, narration: d.tr });
      }).catch(function (e) { d.err = e.message; }).then(function () { d.busy = false; render(); });
    });

    /* 2) 사진 번역 · 설명 */
    var keepLens = function () { var o = X.lens; if (val('md-lens-extra') != null) o.extra = val('md-lens-extra'); if (val('md-lens-ask') != null) o.ask = val('md-lens-ask'); };
    chg('md-lens-cam', function (el) { keepLens(); lensFile(el.files && el.files[0]); });
    chg('md-lens-file', function (el) { keepLens(); lensFile(el.files && el.files[0]); });
    on('[data-lens-lang]', function (el) { keepLens(); X.lens.lang = el.getAttribute('data-lens-lang'); render(); });
    on('#md-lens-go', function () { keepLens(); runLens(); });
    on('#md-lens-more', function () { keepLens(); lensMore(); });
    on('#md-lens-say', function () { keepLens(); lensSay(); });
    on('#md-lens-copy', function () { L.copyText(X.lens.ans + X.lens.qa.map(function (x) { return '\n\nQ. ' + x.q + '\n' + x.a; }).join('')); });

    /* 3) 여행 영상 일기 */
    var keepTrip = function () { var t = X.trip; if (val('md-trip-place') != null) t.place = val('md-trip-place'); if (val('md-trip-memo') != null) t.memo = val('md-trip-memo'); };
    chg('md-trip-file', function (el) { keepTrip(); tripFiles(el.files); });
    on('[data-trip-del]', function (el) {
      keepTrip(); var t = X.trip, i = +el.getAttribute('data-trip-del'), p = t.photos[i];
      if (p) { try { URL.revokeObjectURL(p.url); } catch (e) {} t.photos.splice(i, 1); }
      render();
    });
    on('[data-trip-lang]', function (el) { keepTrip(); X.trip.lang = el.getAttribute('data-trip-lang'); render(); });
    on('[data-trip-voice]', function (el) { keepTrip(); X.trip.voice = el.getAttribute('data-trip-voice'); render(); });
    on('[data-trip-secs]', function (el) { keepTrip(); X.trip.secs = +el.getAttribute('data-trip-secs'); render(); });
    chg('md-trip-subs', function (el) { X.trip.subs = el.checked; });
    on('#md-trip-go', function () { keepTrip(); runTrip(); });
  };

  render();
})();
