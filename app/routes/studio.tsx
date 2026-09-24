import { json, type MetaFunction } from '@remix-run/cloudflare';
import { useSearchParams } from '@remix-run/react';
import { ClientOnly } from 'remix-utils/client-only';
import { Header } from '~/components/header/Header';
import { Menu } from '~/components/sidebar/Menu.client';

export const meta: MetaFunction = () => {
  return [{ title: 'coverfo 스튜디오 — 이미지 · 영상' }, { name: 'description', content: 'Gemini 이미지 · Veo 영상 생성' }];
};

// Menu(사이드 메뉴)가 useLoaderData 를 읽기 때문에 빈 값이라도 loader 가 있어야 합니다
export const loader = () => json({});

/*
 * /studio — 채팅 화면과 같은 틀(상단바 + 왼쪽 사이드 메뉴) 안에 스튜디오 본체(/studio-app)를 끼워 넣습니다.
 * 주소 뒤에 붙는 값(kind, prompt, auto, show)은 그대로 본체에 전달합니다.
 */
export default function Studio() {
  const [searchParams] = useSearchParams();
  const qs = searchParams.toString();
  const src = '/studio-app' + (qs ? '?' + qs : '');

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-bolt-elements-background-depth-1">
      <ClientOnly>{() => <Header />}</ClientOnly>
      <div className="relative flex-1 w-full overflow-hidden">
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <div className="h-full w-full lg:pl-[340px]">
          <iframe src={src} title="coverfo 스튜디오" className="block h-full w-full border-0 bg-transparent" allow="clipboard-write" />
        </div>
      </div>
    </div>
  );
}
