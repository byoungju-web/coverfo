/* coverfo 🎬 mp4 묶기 — public/shorts/mux.js (v470)
   · 휴대폰 브라우저가 만든 영상 조각(WebCodecs: H.264 화면 + AAC 소리)을 "보통 mp4 한 개"로 묶는다.
   · 영상 길이(duration)를 파일 머리(moov)에 제대로 적고, 머리를 파일 맨 앞에 둔다(faststart).
     → 카톡·인스타 같은 앱이 길이를 바로 읽는다. (예전 녹화 방식 mp4 는 조각(moof) 파일이라 머리의 길이가 0 이었음)
   · 외부 라이브러리 없이 ISO BMFF(mp4) 상자 규칙대로 직접 만든다.
   window.cfMp4.build({ video:{ width, height, desc(avcC), samples:[{ts(µs), dur(µs), key, data}] },
                        audio:{ codec:'aac'|'opus', sr, ch, desc, samples:[…] } | null }) → Blob(video/mp4) */
(function () {
  if (window.cfMp4) return;
  function u8(n) { return [n & 255]; }
  function u16(n) { return [(n >> 8) & 255, n & 255]; }
  function u32(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }
  function str(s) { var a = []; for (var i = 0; i < s.length; i++) a.push(s.charCodeAt(i) & 255); return a; }
  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }
  function cat(parts) {
    var n = 0, i; for (i = 0; i < parts.length; i++) n += parts[i].length;
    var out = new Uint8Array(n), o = 0;
    for (i = 0; i < parts.length; i++) { out.set(parts[i], o); o += parts[i].length; }
    return out;
  }
  function box(type) {
    var parts = [], i; for (i = 1; i < arguments.length; i++) { var p = arguments[i]; parts.push(p instanceof Uint8Array ? p : new Uint8Array(p)); }
    var body = cat(parts);
    return cat([new Uint8Array(u32(body.length + 8).concat(str(type))), body]);
  }
  function full(type, ver, flags) { var a = [ver].concat(u32(flags).slice(1)); var rest = [].slice.call(arguments, 3); return box.apply(null, [type, a].concat(rest)); }
  var MATRIX = [].concat(u32(0x10000), u32(0), u32(0), u32(0), u32(0x10000), u32(0), u32(0), u32(0), u32(0x40000000));

  /* 같은 값이 이어지면 묶는다 (stts) */
  function runs(arr) { var out = []; arr.forEach(function (v) { var l = out[out.length - 1]; if (l && l[1] === v) l[0]++; else out.push([1, v]); }); return out; }

  function trak(t, id, movieTs, offsets) {
    var isV = t.kind === 'v', n = t.samples.length;
    var deltas = t.samples.map(function (s) { return s.d; });
    var st = runs(deltas), stts = [].concat(u32(st.length)); st.forEach(function (r) { stts = stts.concat(u32(r[0]), u32(r[1])); });
    var stsz = [].concat(u32(0), u32(n)); t.samples.forEach(function (s) { stsz = stsz.concat(u32(s.data.length)); });
    var stco = [].concat(u32(n)); offsets.forEach(function (o) { stco = stco.concat(u32(o)); });
    var entry;
    if (isV) {
      entry = box('avc1', [].concat(zeros(6), u16(1), zeros(16), u16(t.w), u16(t.h), u32(0x480000), u32(0x480000), u32(0), u16(1), zeros(32), u16(0x18), u16(0xffff)), box('avcC', t.desc));
    } else if (t.codec === 'opus') {
      var pre = 312; if (t.desc && t.desc.length >= 12 && t.desc[0] === 0x4f) pre = t.desc[10] | (t.desc[11] << 8); // OpusHead(LE) 의 pre-skip
      entry = box('Opus', [].concat(zeros(6), u16(1), zeros(8), u16(t.ch), u16(16), zeros(4), u32(t.sr * 65536)),
        box('dOps', [].concat(u8(0), u8(t.ch), u16(pre), u32(t.sr), u16(0), u8(0))));
    } else {
      var asc = Array.prototype.slice.call(t.desc || []);
      var dsi = [5, asc.length].concat(asc);
      var dcd = [0x40, 0x15].concat(zeros(3), u32(t.br || 128000), u32(t.br || 128000), dsi);
      var esd = u16(1).concat([0], [4, dcd.length], dcd, [6, 1, 2]);
      entry = box('mp4a', [].concat(zeros(6), u16(1), zeros(8), u16(t.ch), u16(16), zeros(4), u32(t.sr * 65536)),
        full('esds', 0, 0, [3, esd.length].concat(esd)));
    }
    var stbl = [full('stsd', 0, 0, u32(1), entry), full('stts', 0, 0, stts)];
    if (isV) { var ks = []; t.samples.forEach(function (s, i) { if (s.key) ks.push(i + 1); }); var ss = u32(ks.length); ks.forEach(function (k) { ss = ss.concat(u32(k)); }); stbl.push(full('stss', 0, 0, ss)); }
    stbl.push(full('stsc', 0, 0, [].concat(u32(1), u32(1), u32(1), u32(1))), full('stsz', 0, 0, stsz), full('stco', 0, 0, stco));
    var dur = deltas.reduce(function (a, b) { return a + b; }, 0), mdur = Math.round(dur / t.ts * movieTs);
    var tkhd = full('tkhd', 0, 3, [].concat(u32(0), u32(0), u32(id), u32(0), u32(mdur), zeros(8), u16(0), u16(0), u16(isV ? 0 : 0x100), u16(0), MATRIX, u32(isV ? t.w * 65536 : 0), u32(isV ? t.h * 65536 : 0)));
    var mdhd = full('mdhd', 0, 0, [].concat(u32(0), u32(0), u32(t.ts), u32(dur), u16(0x55c4), u16(0)));
    var hdlr = full('hdlr', 0, 0, [].concat(u32(0), str(isV ? 'vide' : 'soun'), zeros(12), str(isV ? 'VideoHandler' : 'SoundHandler'), [0]));
    var xmhd = isV ? full('vmhd', 0, 1, zeros(8)) : full('smhd', 0, 0, zeros(4));
    var dinf = box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1)));
    return { box: box('trak', tkhd, box('mdia', mdhd, hdlr, box('minf', xmhd, dinf, box.apply(null, ['stbl'].concat(stbl))))), mdur: mdur };
  }

  function prep(src, kind, ts, defDur) {
    var s = src.samples.slice().sort(function (a, b) { return a.ts - b.ts; });
    return s.map(function (x, i) {
      var nx = s[i + 1], d = x.dur || (nx ? nx.ts - x.ts : defDur);
      return { ts: x.ts, key: !!x.key, data: x.data, d: Math.max(1, Math.round(d * ts / 1e6)) };
    });
  }

  function build(o) {
    var MTS = 1000, tracks = [];
    var v = o.video; tracks.push({ kind: 'v', ts: 30000, w: v.width, h: v.height, desc: v.desc, samples: prep(v, 'v', 30000, 1e6 / 30) });
    if (o.audio && o.audio.samples.length) { var a = o.audio; tracks.push({ kind: 'a', codec: a.codec, ts: a.sr, sr: a.sr, ch: a.ch, br: a.br, desc: a.desc, samples: prep(a, 'a', a.sr, (a.codec === 'opus' ? 960 : 1024) / a.sr * 1e6) }); }
    /* 시간 순서로 섞어서 mdat 에 넣는다 */
    var order = [];
    tracks.forEach(function (t, ti) { t.samples.forEach(function (s, si) { order.push([s.ts, ti, si]); }); });
    order.sort(function (x, y) { return x[0] - y[0] || x[1] - y[1]; });
    var rel = tracks.map(function (t) { return new Array(t.samples.length); }), pos = 0;
    order.forEach(function (x) { rel[x[1]][x[2]] = pos; pos += tracks[x[1]].samples[x[2]].data.length; });
    var ftyp = box('ftyp', str('isom'), u32(512), str('isomiso2avc1mp41'));
    function moov(base) {
      var tr = tracks.map(function (t, i) { return trak(t, i + 1, MTS, rel[i].map(function (r) { return r + base; })); });
      var md = Math.max.apply(null, tr.map(function (x) { return x.mdur; }));
      var mvhd = full('mvhd', 0, 0, [].concat(u32(0), u32(0), u32(MTS), u32(md), u32(0x10000), u16(0x100), zeros(10), MATRIX, zeros(24), u32(tracks.length + 1)));
      return box.apply(null, ['moov', mvhd].concat(tr.map(function (x) { return x.box; })));
    }
    var m0 = moov(0), base = ftyp.length + m0.length + 8, mv = moov(base);
    var parts = [ftyp, mv, new Uint8Array(u32(pos + 8).concat(str('mdat')))];
    order.forEach(function (x) { parts.push(tracks[x[1]].samples[x[2]].data); });
    return new Blob(parts, { type: 'video/mp4' });
  }
  window.cfMp4 = { build: build };
})();
