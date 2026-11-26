/* coverfo 🖼 결과 카드 — public/card/card.js (v485 · v486 링크 먼저 → ② 카드)
   · 같이 정하기 결과 · 여행쇼츠 · 포도야알림을 "문장 1줄 + 링크"가 크게 보이는 이미지(1080×1350)로 만들어 공유한다.
     (투표 화면을 캡처하면 글자가 작아 인스타에서 안 보이므로 새로 그린다.)
   · 링크는 원래 링크 그대로 (예: coverfo.com/s/q7MMReHs) — 카드를 보고 온 친구도 같은 화면으로 들어온다.
   · 이 휴대폰 안에서 그린다 (서버·비용 없음). 크레딧·포인트 없음.
   window.cfCard.open({ tag, line, sub, foot, url, hint, photo, photoPick })
     tag: 오른쪽 위 작은 글 · line: 큰 문장 (짧게) · sub: 작은 한 줄 · foot: 왼쪽 아래 (선택) · url: 카드에 박을 링크(https://…)
     hint: 링크 위 작은 안내 · photo: '사진' 모양 배경(주소·dataURL, 선택) · photoPick: true 면 '사진' 모양에서 폰 사진 고르기 */
(function () {
  if (window.cfCard) return;
  var W = 1080, H = 1350;
  var GRAPE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="240" height="240"><path d="M60 14 C 62 10, 68 8, 72 12 C 76 16, 74 24, 60 26 C 46 24, 44 16, 48 12 C 52 8, 58 10, 60 14 Z" fill="#2ECC71"/><circle cx="46" cy="70" r="26" fill="#8B5CF6" stroke="#6D28D9" stroke-width="3"/><circle cx="76" cy="70" r="26" fill="#A78BFA" stroke="#6D28D9" stroke-width="3"/></svg>';
  var GIMG = new Image(); GIMG.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(GRAPE);
  var FONT = '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
  var O = null, ST = 'color', PH = null, BLOB = null, el = null;

  function css() {
    if (document.getElementById('cfcard-css')) return;
    var s = document.createElement('style'); s.id = 'cfcard-css';
    s.textContent = [
      '#cfcard{position:fixed;inset:0;z-index:2147483600;display:none;font-family:' + FONT + '}',
      '#cfcard.on{display:block}',
      '#cfcard .cfc-bg{position:absolute;inset:0;background:rgba(15,10,35,.5)}',
      '#cfcard .cfc-pn{position:absolute;left:0;right:0;bottom:0;max-width:520px;margin:0 auto;max-height:94vh;overflow:auto;background:#fff;border-radius:26px 26px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom));color:#17132B;box-sizing:border-box}',
      '#cfcard .cfc-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px}',
      '#cfcard .cfc-hd small{display:block;font-size:12px;font-weight:800;color:#6C4DFF}',
      '#cfcard .cfc-hd b{display:block;font-size:19px;font-weight:900;letter-spacing:-.02em;margin-top:2px}',
      '#cfcard .cfc-x{flex:none;width:38px;height:38px;border-radius:50%;border:0;background:#F2F0F8;font-size:17px;color:#17132B;cursor:pointer}',
      /* v486: 공유 단추가 먼저 · 카드 미리보기는 아래에 작게 (한 화면에 다 보이게) */
      '#cfcard .cfc-row{display:flex;gap:12px;align-items:flex-start;margin-top:14px;padding-top:12px;border-top:1px solid #F0EDF8}',
      '#cfcard .cfc-pv{display:block;flex:0 0 38%;width:38%;aspect-ratio:4/5;border-radius:14px;background:#eee;box-shadow:0 10px 22px -14px rgba(60,30,160,.6);object-fit:cover}',
      '#cfcard .cfc-side{flex:1;min-width:0}',
      '#cfcard .cfc-lb{font-size:13.5px;font-weight:900;margin:0 2px 8px}',
      '#cfcard .cfc-sty{display:grid;grid-template-columns:1fr;gap:6px}',
      '#cfcard .cfc-sty button{display:flex;align-items:center;gap:8px;border:1.5px solid #E4DFFF;border-radius:12px;background:#fff;padding:6px 8px;text-align:left;font:inherit;font-size:13px;font-weight:800;color:#17132B;cursor:pointer}',
      '#cfcard .cfc-sty button i{flex:none;width:26px;height:26px;border-radius:8px}',
      '#cfcard .cfc-sty button[aria-pressed="true"]{border:2px solid #6C4DFF;box-shadow:0 8px 18px -14px rgba(108,77,255,.9)}',
      '#cfcard .cfc-ap{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:4px}',
      '#cfcard .cfc-ap button{border:1.5px solid #EEEAFB;border-radius:16px;background:#FBFAFF;padding:10px 2px;font:inherit;font-size:12px;font-weight:800;color:#17132B;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer}',
      '#cfcard .cfc-ap button span{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:17px}',
      '#cfcard .cfc-lk{display:flex;align-items:center;gap:8px;width:100%;margin-top:10px;height:48px;border:1.5px solid #E4DFFF;border-radius:14px;background:#fff;font:inherit;font-size:13.5px;color:#6E6889;padding:0 14px;cursor:pointer;box-sizing:border-box}',
      '#cfcard .cfc-lk b{color:#17132B;flex:none}',
      '#cfcard .cfc-lk span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}',
      '#cfcard .cfc-go{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:10px;height:54px;border:0;border-radius:16px;background:#17132B;color:#fff;font:inherit;font-size:16px;font-weight:900;cursor:pointer}',
      '#cfcard .cfc-go2{background:linear-gradient(135deg,#FEE500,#FFC93C);color:#3C1E1E}',
      '#cfcard .cfc-ms{min-height:18px;font-size:12.5px;text-align:center;color:#0F7A4A;margin-top:8px;line-height:1.45}',
      '#cfcard .cfc-nt{font-size:11.5px;color:#8A85A6;text-align:center;margin-top:6px}',
      '#cfcard .cfc-pk{display:none;margin-top:8px}',
      '#cfcard .cfc-pk.on{display:block}',
      '#cfcard .cfc-pk label{display:flex;align-items:center;justify-content:center;height:42px;border:1.5px dashed #CBB9FF;border-radius:12px;font-size:13.5px;font-weight:800;color:#5B34E0;position:relative;cursor:pointer}',
      '#cfcard .cfc-pk input{position:absolute;inset:0;opacity:0}',
      '#cfcard button:focus-visible,#cfcard label:focus-within{outline:3px solid rgba(108,77,255,.45);outline-offset:2px}'
    ].join('\n');
    document.head.appendChild(s);
  }
  function build() {
    if (el) return;
    css();
    el = document.createElement('div'); el.id = 'cfcard'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '결과 카드');
    el.innerHTML = '<div class="cfc-bg" data-c="x"></div><div class="cfc-pn">'
      + '<div class="cfc-hd"><div><small>링크 + 결과 카드</small><b>이 순간, 바로 공유해요</b></div><button type="button" class="cfc-x" data-c="x" aria-label="닫기">✕</button></div>'
      + '<div class="cfc-ap">'
      + '<button type="button" data-a="kakao"><span style="background:#FFF6C7">💬</span>카카오톡</button>'
      + '<button type="button" data-a="insta"><span style="background:#FFE4EF">📷</span>인스타 스토리</button>'
      + '<button type="button" data-a="sms"><span style="background:#EAF4FF">✉️</span>문자</button>'
      + '<button type="button" data-a="other"><span style="background:#F0EBFF">📤</span>다른 앱</button></div>'
      + '<button type="button" class="cfc-lk" data-a="copy"><b>🔗 링크 복사</b><span class="cfc-u"></span></button>'
      + '<button type="button" class="cfc-go" data-a="share">💬 ① 링크 보내기</button>'
      + '<div class="cfc-ms" role="status"></div>'
      + '<div class="cfc-row"><img class="cfc-pv" alt="공유할 카드"><div class="cfc-side"><div class="cfc-lb">카드 모양</div><div class="cfc-sty">'
      + '<button type="button" data-s="simple"><i style="background:#F3F0FF;border:1px solid #E4DFFF"></i>심플</button>'
      + '<button type="button" data-s="color"><i style="background:linear-gradient(135deg,#8B5CF6,#F0509A)"></i>컬러</button>'
      + '<button type="button" data-s="photo"><i style="background:linear-gradient(135deg,#FF9A5A,#FFC93C)"></i>사진</button></div>'
      + '<div class="cfc-pk"><label>📷 배경 사진<input type="file" accept="image/*" aria-label="배경 사진 고르기"></label></div></div></div>'
      + '<div class="cfc-nt">바깥을 누르면 닫혀요 · 카드는 이 휴대폰에서 만들어요</div></div>';
    document.body.appendChild(el);
    el.addEventListener('click', onClick);
    el.querySelector('.cfc-pk input').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      var u = URL.createObjectURL(f); loadImg(u).then(function (im) { PH = im; draw(); });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && el.classList.contains('on')) close(); });
  }
  function loadImg(src) {
    return new Promise(function (res) {
      if (!src) { res(null); return; }
      var im = new Image(); if (!/^(data|blob):/.test(src)) im.crossOrigin = 'anonymous';
      im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = src;
    });
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  /* 띄어쓰기 단위로 줄을 나눈다 (한 낱말이 한 줄보다 길 때만 글자 단위) */
  function wrap(c, t, max) {
    var out = [], line = '';
    String(t || '').split(/\s+/).filter(Boolean).forEach(function (w) {
      var s = line ? line + ' ' + w : w;
      if (c.measureText(s).width <= max) { line = s; return; }
      if (line) out.push(line);
      if (c.measureText(w).width <= max) { line = w; return; }
      line = '';
      w.split('').forEach(function (ch) { var x = line + ch; if (c.measureText(x).width > max && line) { out.push(line); line = ch; } else line = x; });
    });
    if (line) out.push(line);
    return out;
  }
  function fit(c, t, max, size, minSize, maxLines) {
    for (var s = size; s >= minSize; s -= 4) { c.font = '900 ' + s + 'px ' + FONT; var l = wrap(c, t, max); if (l.length <= maxLines) return { s: s, l: l }; }
    c.font = '900 ' + minSize + 'px ' + FONT; return { s: minSize, l: wrap(c, t, max).slice(0, maxLines) };
  }
  function shortUrl(u) { return String(u || '').replace(/^https?:\/\//, '').replace(/\/$/, ''); }
  function render() {
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var c = cv.getContext('2d'), st = ST, dark = st !== 'simple';
    /* 배경 */
    if (st === 'color') { var g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#8B5CF6'); g.addColorStop(.55, '#B04FE0'); g.addColorStop(1, '#F0509A'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    else if (st === 'simple') { c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H); c.strokeStyle = '#E4DFFF'; c.lineWidth = 6; rr(c, 30, 30, W - 60, H - 60, 48); c.stroke(); }
    else {
      var im = PH;
      if (im) { var k = Math.max(W / im.width, H / im.height), w = im.width * k, h = im.height * k; c.drawImage(im, (W - w) / 2, (H - h) / 2, w, h); }
      else { var g2 = c.createLinearGradient(0, 0, W, H); g2.addColorStop(0, '#FF9A5A'); g2.addColorStop(1, '#FFC93C'); c.fillStyle = g2; c.fillRect(0, 0, W, H); }
      var sh = c.createLinearGradient(0, 0, 0, H); sh.addColorStop(0, 'rgba(0,0,0,.35)'); sh.addColorStop(.35, 'rgba(0,0,0,.08)'); sh.addColorStop(.6, 'rgba(0,0,0,.35)'); sh.addColorStop(1, 'rgba(0,0,0,.72)'); c.fillStyle = sh; c.fillRect(0, 0, W, H);
    }
    var ink = dark ? '#FFFFFF' : '#17132B', pri = dark ? '#FFFFFF' : '#6C4DFF', M = 84;
    /* 위: coverfo · 태그 */
    c.textBaseline = 'alphabetic'; c.textAlign = 'left'; c.fillStyle = pri; c.font = '900 52px ' + FONT; c.fillText('coverfo', M, 150);
    if (O.tag) { c.font = '800 34px ' + FONT; var tw = c.measureText(O.tag).width; c.fillStyle = dark ? 'rgba(255,255,255,.22)' : '#F0EBFF'; rr(c, W - M - tw - 48, 100, tw + 48, 66, 33); c.fill(); c.fillStyle = dark ? '#fff' : '#5B34E0'; c.textAlign = 'right'; c.fillText(O.tag, W - M - 24, 145); c.textAlign = 'left'; }
    /* 가운데: 큰 문장 */
    var f = fit(c, O.line, W - M * 2, 118, 72, 3), lh = f.s * 1.22, top = 520 - (f.l.length - 1) * lh / 2;
    c.fillStyle = ink; c.font = '900 ' + f.s + 'px ' + FONT;
    if (st === 'photo') { c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 24; }
    f.l.forEach(function (l, i) { c.fillText(l, M, top + i * lh); });
    c.shadowBlur = 0;
    var y = top + (f.l.length - 1) * lh + 96;
    if (O.sub) { c.font = '800 44px ' + FONT; c.fillStyle = dark ? 'rgba(255,255,255,.92)' : '#6E6889'; c.fillText(O.sub, M, y); if (GIMG.complete && GIMG.naturalWidth) c.drawImage(GIMG, M + c.measureText(O.sub).width + 14, y - 46, 60, 60); }
    /* 아래: 결과 한 줄 · 링크 (크게) */
    var py = H - 250;
    if (O.foot) { c.font = '800 38px ' + FONT; c.fillStyle = dark ? 'rgba(255,255,255,.92)' : '#17132B'; c.fillText(O.foot, M, py - 120); }
    if (O.hint) { c.font = '700 32px ' + FONT; c.fillStyle = dark ? 'rgba(255,255,255,.85)' : '#6E6889'; c.fillText(O.hint, M, py - 40); }
    var u = shortUrl(O.url);
    var us = 64; c.font = '900 ' + us + 'px ' + FONT; while (c.measureText(u).width > W - M * 2 - 80 && us > 36) { us -= 2; c.font = '900 ' + us + 'px ' + FONT; }
    c.fillStyle = dark ? '#FFFFFF' : '#6C4DFF'; rr(c, M, py, W - M * 2, 150, 40); c.fill();
    c.fillStyle = dark ? '#5B34E0' : '#FFFFFF'; c.textAlign = 'center'; c.fillText(u, W / 2, py + 75 + us * .36); c.textAlign = 'left';
    return cv;
  }
  function draw() {
    var cv = render();
    cv.toBlob(function (b) {
      BLOB = b;
      var img = el.querySelector('.cfc-pv'); if (img._u) URL.revokeObjectURL(img._u);
      img._u = URL.createObjectURL(b); img.src = img._u;
    }, 'image/png');
    [].forEach.call(el.querySelectorAll('[data-s]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-s') === ST)); });
    el.querySelector('.cfc-pk').classList.toggle('on', ST === 'photo' && !!O.photoPick);
  }
  function msg(t) { el.querySelector('.cfc-ms').textContent = t || ''; }
  function file() { return new File([BLOB], 'coverfo-card.png', { type: 'image/png' }); }
  function text() { return (O.shareText || '') + (O.shareText ? '\n' : '') + O.url; }
  function copy(t, ok) {
    try { navigator.clipboard.writeText(t).then(function () { msg(ok || '✓ 링크를 복사했어요'); }, function () { window.prompt('아래 링크를 복사하세요', t); }); }
    catch (e) { window.prompt('아래 링크를 복사하세요', t); }
  }
  function save() {
    if (!BLOB) return;
    var a = document.createElement('a'); a.href = URL.createObjectURL(BLOB); a.download = 'coverfo-card.png'; document.body.appendChild(a); a.click(); a.remove();
    msg(window.CoverfoApp ? '저장이 안 되면 크롬에서 coverfo.com 을 열어 주세요' : '✓ 카드 이미지를 저장했어요 (다운로드 폴더)');
  }
  /* 이미지 공유: withText=true 면 글(링크)도 함께 싣는다. 카톡은 이미지와 글을 함께 받지 못해 글이 빠지므로 카톡은 이미지만 보내고 ② 링크를 따로 */
  function shareImg(withText, after) {
    if (!BLOB) return;
    var f = file(), d = { files: [f] };
    if (withText) { d.text = text(); if (!(navigator.canShare && navigator.canShare(d))) d = { files: [f] }; }
    if (navigator.canShare && navigator.canShare({ files: [f] }) && !window.CoverfoApp) {
      navigator.share(d).then(function () { if (after) after(); else msg('✓ 공유했어요'); }, function (e) { if (e && e.name !== 'AbortError') msg('공유하지 못했어요 · 이미지 저장 뒤 앱에서 올려 주세요'); });
    } else { save(); copy(O.url, '✓ 카드를 저장하고 링크를 복사했어요 · 앱에서 카드를 올리고 링크를 붙여넣기 하세요'); }
  }
  function onClick(e) {
    var t = e.target.closest ? e.target.closest('[data-c],[data-s],[data-a]') : null; if (!t) return;
    if (t.getAttribute('data-c') === 'x') { close(); return; }
    var s = t.getAttribute('data-s'); if (s) { ST = s; draw(); return; }
    var a = t.getAttribute('data-a');
    if (a === 'copy') { copy(O.url); return; }
    if (a === 'save') { save(); return; }
    /* v487 📤 다른 앱: 휴대폰 공유창에 카드 + 링크를 함께 (밴드·텔레그램·메일 등에서 고르기) */
    if (a === 'other') { msg('공유창에서 보낼 앱을 고르세요'); shareImg(true); return; }
    /* v486: 링크를 먼저 보내고(글만 공유 → 카톡도 잘 감), 그다음 ② 카드 이미지 */
    if (a === 'share' || a === 'kakao') { sendLink(a === 'kakao' ? '공유창에서 카카오톡을 고르세요' : ''); return; }
    if (a === 'card2') { shareImg(false, function () { msg('✓ 링크와 카드를 모두 보냈어요'); }); return; }
    if (a === 'insta') { msg('공유창에서 Instagram → 스토리를 고르세요 · 링크는 카드에 크게 들어 있어요'); shareImg(false, function () { msg('✓ 보냈어요 · 스토리에 링크 스티커로 ' + shortUrl(O.url) + ' 를 붙이면 바로 눌러 들어와요'); }); return; }
    if (a === 'sms') { msg('공유창에서 메시지를 고르세요'); shareImg(true); return; }
  }
  function step2() { var g = el.querySelector('.cfc-go'); g.className = 'cfc-go cfc-go2'; g.setAttribute('data-a', 'card2'); g.textContent = '🖼 ② 카드 이어서 보내기'; }
  function sendLink(hint) {
    if (hint) msg(hint);
    if (navigator.share && !window.CoverfoApp) {
      navigator.share({ title: O.title || 'coverfo', text: text() }).then(function () { msg('✓ 링크를 보냈어요 · 아래 노란 버튼으로 같은 대화방에 카드도 보내 주세요'); step2(); }, function () {});
    } else { copy(text(), '✓ 링크를 복사했어요 · 대화방에 붙여넣은 뒤 아래 버튼으로 카드도 보내 주세요'); step2(); }
  }
  function open(o) {
    build(); O = o || {}; PH = null; BLOB = null; msg('');
    ST = O.style || (O.photo ? 'photo' : 'color');
    var g = el.querySelector('.cfc-go'); g.className = 'cfc-go'; g.setAttribute('data-a', 'share'); g.textContent = '💬 ① 링크 보내기';
    el.querySelector('.cfc-lk .cfc-u').textContent = shortUrl(O.url);
    el.querySelector('.cfc-pk input').value = '';
    el.classList.add('on'); el.querySelector('.cfc-pn').scrollTop = 0;
    draw();
    var ready = [];
    if (O.photo) ready.push(loadImg(O.photo).then(function (im) { PH = im; }));
    if (!(GIMG.complete && GIMG.naturalWidth)) ready.push(new Promise(function (r) { GIMG.onload = r; GIMG.onerror = r; }));
    if (document.fonts && document.fonts.ready) ready.push(document.fonts.ready);
    if (ready.length) Promise.all(ready).then(draw);
  }
  function close() { if (el) el.classList.remove('on'); }
  /* 은/는·이/가처럼 '로/으로': 받침 없거나 ㄹ 받침이면 '로' */
  function ro(w) { var s = String(w || ''), ch = s.charCodeAt(s.length - 1); if (ch < 0xAC00 || ch > 0xD7A3) return s + '(으)로'; var j = (ch - 0xAC00) % 28; return s + (j === 0 || j === 8 ? '로' : '으로'); }
  window.cfCard = { open: open, close: close, ro: ro };
})();
