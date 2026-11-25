/* coverfo 🎬 내가 만든 쇼츠 — public/shorts/store.js (v470)
   · 여행 자동 쇼츠(/shorts/)에서 만든 영상을 "이 휴대폰 안"(브라우저 IndexedDB)에 보관한다. 서버로 보내지 않음 · 무료.
   · /shorts/ 와 누리트립(/trip/) 🎬 쇼츠 탭이 같이 쓴다 (같은 coverfo.com 주소라 같은 보관함).
   · 최근 MAX 개까지만 남기고 오래된 것부터 지운다. 브라우저 기록을 지우면 함께 지워진다. */
(function () {
  if (window.cfShorts) return;
  var DB = 'coverfo-shorts', ST = 'v', MAX = 12, dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      try {
        var r = indexedDB.open(DB, 1);
        r.onupgradeneeded = function () { r.result.createObjectStore(ST, { keyPath: 'id' }); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      } catch (e) { rej(e); }
    });
    dbp.catch(function () { dbp = null; });
    return dbp;
  }
  function tx(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(ST, mode), s = t.objectStore(ST), out;
        var r = fn(s); if (r) r.onsuccess = function () { out = r.result; };
        t.oncomplete = function () { res(out); };
        t.onerror = t.onabort = function () { rej(t.error); };
      });
    });
  }
  function all() { return tx('readonly', function (s) { return s.getAll(); }).then(function (l) { return (l || []).sort(function (a, b) { return b.at - a.at; }); }); }
  window.cfShorts = {
    /* [{id, at, title, len, style, ext, mime, size, thumb, blob}] — 최근 것이 먼저 */
    list: function () { return all().catch(function () { return []; }); },
    get: function (id) { return tx('readonly', function (s) { return s.get(String(id)); }).catch(function () { return null; }); },
    add: function (rec) {
      rec.id = rec.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      rec.at = rec.at || Date.now();
      return tx('readwrite', function (s) { s.put(rec); }).then(function () {
        return all().then(function (l) {
          var old = l.slice(MAX);
          return old.length ? tx('readwrite', function (s) { old.forEach(function (x) { s.delete(x.id); }); }) : null;
        });
      }).then(function () { return rec.id; });
    },
    del: function (id) { return tx('readwrite', function (s) { s.delete(String(id)); }); },
    MAX: MAX
  };
})();
