import { json, type MetaFunction } from '@remix-run/cloudflare';
import { useSearchParams } from '@remix-run/react';
import { ClientOnly } from 'remix-utils/client-only';
import { Header } from '~/components/header/Header';
import { Menu } from '~/components/sidebar/Menu.client';

export const meta: MetaFunction = () => {
  return [
    { title: 'coverfo 릴레이 — AI 음성 · 리서치' },
    { name: 'description', content: 'AI 릴레이 레시피: TTS · STT · 리서치 리포트' },
  ];
};

export const loader = () => json({});

/*
 * /relay — 채팅 화면과 같은 틀(상단바 + 왼쪽 사이드 메뉴) 안에 릴레이 본체(/relay-app)를 끼워 넣습니다.
 * studio.tsx 와 동일한 구조입니다.
 */
export default function Relay() {
  const [searchParams] = useSearchParams();
  const qs = searchParams.toString();
  const src = '/relay-app' + (qs ? '?' + qs : '');

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-bolt-elements-background-depth-1">
      <ClientOnly>{() => <Header />}</ClientOnly>
      <div className="relative flex-1 w-full overflow-hidden">
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <div className="h-full w-full lg:pl-[340px]">
          <iframe
            src={src}
            title="coverfo 릴레이"
            className="block h-full w-full border-0 bg-transparent"
            allow="clipboard-write; microphone"
          />
        </div>
      </div>
    </div>
  );
}
