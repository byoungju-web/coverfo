import { useStore } from '@nanostores/react';
import type { LinksFunction } from '@remix-run/cloudflare';
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from '@remix-run/react';
import tailwindReset from '@unocss/reset/tailwind-compat.css?url';
import { themeStore } from './lib/stores/theme';
import { stripIndents } from './utils/stripIndent';
import { createHead } from 'remix-island';
import { useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ClientOnly } from 'remix-utils/client-only';
import { cssTransition, ToastContainer } from 'react-toastify';

import reactToastifyStyles from 'react-toastify/dist/ReactToastify.css?url';
import globalStyles from './styles/index.scss?url';
import xtermStyles from '@xterm/xterm/css/xterm.css?url';

import 'virtual:uno.css';

const toastAnimation = cssTransition({
  enter: 'animated fadeInRight',
  exit: 'animated fadeOutRight',
});

export const links: LinksFunction = () => [
  {
    rel: 'icon',
    href: '/favicon.svg',
    type: 'image/svg+xml',
  },
  { rel: 'stylesheet', href: reactToastifyStyles },
  { rel: 'stylesheet', href: tailwindReset },
  { rel: 'stylesheet', href: globalStyles },
  { rel: 'stylesheet', href: xtermStyles },
  {
    rel: 'preconnect',
    href: 'https://fonts.googleapis.com',
  },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
];

const inlineThemeCode = stripIndents`
  setTutorialKitTheme();

  function setTutorialKitTheme() {
    let theme = localStorage.getItem('bolt_theme');

    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.querySelector('html')?.setAttribute('data-theme', theme);
  }
`;

/*
 * v324: 화면 깨짐 막기 (모든 Remix 화면: /chat · /pricing · /studio 틀 …)
 * 브라우저 번역(크롬 번역 등)·확장 프로그램이 화면 글자를 <font> 같은 태그로 감싸면, React 가 화면을 바꿀 때
 * "insertBefore / removeChild … not a child of this node" 오류로 화면 전체가 Application Error 가 된다 (실험으로 재현함).
 * React 가 그리기 전에 한 번: 감싼 태그가 있으면 그 바깥 기준으로 넣고 빼게 한다. 결제·로그인 코드와 무관.
 * (pricing.tsx 에도 같은 보호가 있는데, 먼저 켜진 쪽만 동작한다 — window.__cfDomGuard)
 */
const domGuardCode = stripIndents`
  (function () {
    if (window.__cfDomGuard || typeof Node !== 'function') return;
    window.__cfDomGuard = true;
    var rm = Node.prototype.removeChild, ins = Node.prototype.insertBefore;
    function outer(n, parent) { var w = n && n.parentNode; while (w && w.parentNode && w.parentNode !== parent) w = w.parentNode; return w && w.parentNode === parent ? w : null; }
    Node.prototype.removeChild = function (child) {
      if (child && child.parentNode !== this) {
        var w = outer(child, this);
        if (w) { rm.call(this, w); return child; }
        if (child.parentNode) return rm.call(child.parentNode, child);
        return child;
      }
      return rm.call(this, child);
    };
    Node.prototype.insertBefore = function (node, ref) {
      if (ref && ref.parentNode !== this) return ins.call(this, node, outer(ref, this));
      return ins.call(this, node, ref);
    };
  })();
`;

export const Head = createHead(() => (
  <>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <Meta />
    <Links />
    <script dangerouslySetInnerHTML={{ __html: inlineThemeCode }} />
    <script dangerouslySetInnerHTML={{ __html: domGuardCode }} />
    {/* coverfo 화면 언어 — 홈과 같은 파일. 한국어가 아니면 화면 글자를 번역해 바꿔 넣습니다 */}
    <script src="/cf-ui-lang.js?v=4" defer />
  </>
));

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useStore(themeStore);

  useEffect(() => {
    document.querySelector('html')?.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      <ClientOnly>{() => <DndProvider backend={HTML5Backend}>{children}</DndProvider>}</ClientOnly>
      <ToastContainer
        closeButton={({ closeToast }) => {
          return (
            <button className="Toastify__close-button" onClick={closeToast}>
              <div className="i-ph:x text-lg" />
            </button>
          );
        }}
        icon={({ type }) => {
          switch (type) {
            case 'success': {
              return <div className="i-ph:check-bold text-bolt-elements-icon-success text-2xl" />;
            }
            case 'error': {
              return <div className="i-ph:warning-circle-bold text-bolt-elements-icon-error text-2xl" />;
            }
          }

          return undefined;
        }}
        position="bottom-right"
        pauseOnFocusLoss
        transition={toastAnimation}
        autoClose={3000}
      />
      <ScrollRestoration />
      <Scripts />
    </>
  );
}

import { logStore } from './lib/stores/logs';

export default function App() {
  const theme = useStore(themeStore);

  useEffect(() => {
    logStore.logSystem('Application initialized', {
      theme,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });

    // Initialize debug logging with improved error handling
    import('./utils/debugLogger')
      .then(({ debugLogger }) => {
        /*
         * The debug logger initializes itself and starts disabled by default
         * It will only start capturing when enableDebugMode() is called
         */
        const status = debugLogger.getStatus();
        logStore.logSystem('Debug logging ready', {
          initialized: status.initialized,
          capturing: status.capturing,
          enabled: status.enabled,
        });
      })
      .catch((error) => {
        logStore.logError('Failed to initialize debug logging', error);
      });
  }, []);

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
