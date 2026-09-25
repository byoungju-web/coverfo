import { json, type MetaFunction } from '@remix-run/cloudflare';
import { useSearchParams } from '@remix-run/react';
import { ClientOnly } from 'remix-utils/client-only';
import { Header } from '~/components/header/Header';
import { Menu } from '~/components/sidebar/Menu.client';

export const meta: MetaFunction = () => {
  return [{ title: 'coverfo 엔진 — 앱 · 3D 에셋' }, { name: 'description', content: 'coverfo 3D Orchestrator Engine — 7단계 앱 생성 · 3D 에셋' }];
};

// Menu(사이드 메뉴)가 useLoaderData 를 읽기 때문에 빈 값이라도 loader 가 있어야 합니다
export const loader = () => json({});

/*
 * /engine — 스튜디오(/studio)와 같은 틀(상단바 + 왼쪽 사이드 메뉴) 안에 엔진 본체(/engine-app, functions/engine-app.js)를 끼워 넣습니다.
 * 주소 뒤에 붙는 값(mode, prompt, auto)은 그대로 본체에 전달합니다.
 */
export default function Engine() {
  const [searchParams] = useSearchParams();
  const qs = searchParams.toString();
  const src = '/engine-app' + (qs ? '?' + qs : '');

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-bolt-elements-background-depth-1">
      <ClientOnly>{() => <Header />}</ClientOnly>
      <div className="relative flex-1 w-full overflow-hidden">
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <div className="h-full w-full lg:pl-[340px]">
          <iframe src={src} title="coverfo 엔진" className="block h-full w-full border-0 bg-transparent" allow="clipboard-write" />
        </div>
      </div>
    </div>
  );
}
