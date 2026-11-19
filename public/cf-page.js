/* coverfo 한 화면 덮개 — public/cf-page.js (v410)
   · 홈의 📝 장소·후기 처럼 따로 된 화면(/place/)을 홈을 떠나지 않고 홈 위에 전체 화면으로 띄운다.
   · 예전에는 같은 탭에서 /place/ 로 이동했다가 [닫기]로 홈에 돌아오면 홈을 처음부터 다시 그려서
     소리 아이콘 그림이 잠깐 보였다 사라졌다. 이제 닫으면 덮개만 걷혀 홈은 그대로 있다.
   · 축제·가볼 곳 창(2147482994) 위 · 소리 단추(2147482999) 아래.
   · 띄운 화면(같은 coverfo 주소)의 [닫기]는 parent.cfPageClose() 를 부른다. 폰 뒤로가기도 닫기. */
(function () {
  if (window.cfPageOpen) return;
  var css = document.createElement('style'); css.id = 'cf-page-css';
  css.textContent =
    '#cfpg{position:fixed;inset:0;z-index:2147482996;background:#fff;display:none}#cfpg.on{display:block}' +
    '#cfpg iframe{width:100%;height:100%;border:0;display:block;background:#fff}' +
    'body.cfpg-lock{overflow:hidden}';
  document.head.appendChild(css);
  var ov = document.createElement('div'); ov.id = 'cfpg'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
  function mount() { if (!ov.parentNode && document.body) document.body.appendChild(ov); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  function close(fromPop) {
    if (!ov.classList.contains('on')) return;
    ov.classList.remove('on'); document.body.classList.remove('cfpg-lock');
    ov.innerHTML = '';
    if (fromPop !== true) { try { if (history.state && history.state.cfpg) history.back(); } catch (e) {} }
  }
  window.addEventListener('popstate', function () { if (ov.classList.contains('on')) close(true); });

  window.cfPageOpen = function (url) {
    var u = String(url || '');
    if (!/^\/[A-Za-z0-9_\-\/?=&%.]*$/.test(u)) return false;   // coverfo 안 주소만
    mount();
    ov.innerHTML = '<iframe title="coverfo" allow="geolocation; clipboard-write" src="' + u.replace(/"/g, '') + '"></iframe>';
    ov.classList.add('on'); document.body.classList.add('cfpg-lock');
    try { if (!(history.state && history.state.cfpg)) history.pushState({ cfpg: 1 }, ''); } catch (e) {}
    return true;
  };
  window.cfPageClose = function () { close(); };
})();
