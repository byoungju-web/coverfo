import React from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { classNames } from '~/utils/classNames';
import { PROVIDER_LIST } from '~/utils/constants';
import { ModelSelector } from '~/components/chat/ModelSelector';
import { APIKeyManager } from './APIKeyManager';
import { LOCAL_PROVIDERS } from '~/lib/stores/settings';
import FilePreview from './FilePreview';
import { ScreenshotStateManager } from './ScreenshotStateManager';
import { IconButton } from '~/components/ui/IconButton';
import { SpeechRecognitionButton } from '~/components/chat/SpeechRecognition';
import { ExpoQrModal } from '~/components/workbench/ExpoQrModal';
import styles from './BaseChat.module.scss';
import type { ProviderInfo } from '~/types/model';
import type { DesignScheme } from '~/types/design-scheme';
import type { ElementInfo } from '~/components/workbench/Inspector';
import { cfRouteByCommand } from '~/utils/cfRoute';

interface ChatBoxProps {
  isModelSettingsCollapsed: boolean;
  setIsModelSettingsCollapsed: (collapsed: boolean) => void;
  provider: any;
  providerList: any[];
  modelList: any[];
  apiKeys: Record<string, string>;
  isModelLoading: string | undefined;
  onApiKeysChange: (providerName: string, apiKey: string) => void;
  uploadedFiles: File[];
  imageDataList: string[];
  textareaRef: React.RefObject<HTMLTextAreaElement> | undefined;
  input: string;
  handlePaste: (e: React.ClipboardEvent) => void;
  TEXTAREA_MIN_HEIGHT: number;
  TEXTAREA_MAX_HEIGHT: number;
  isStreaming: boolean;
  handleSendMessage: (event: React.UIEvent, messageInput?: string) => void;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  chatStarted: boolean;
  exportChat?: () => void;
  qrModalOpen: boolean;
  setQrModalOpen: (open: boolean) => void;
  handleFileUpload: () => void;
  handleTextFileUpload?: () => void;
  setProvider?: ((provider: ProviderInfo) => void) | undefined;
  model?: string | undefined;
  setModel?: ((model: string) => void) | undefined;
  setUploadedFiles?: ((files: File[]) => void) | undefined;
  setImageDataList?: ((dataList: string[]) => void) | undefined;
  handleInputChange?: ((event: React.ChangeEvent<HTMLTextAreaElement>) => void) | undefined;
  handleStop?: (() => void) | undefined;
  enhancingPrompt?: boolean | undefined;
  enhancePrompt?: (() => void) | undefined;
  onWebSearchResult?: (result: string) => void;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  designScheme?: DesignScheme;
  setDesignScheme?: (scheme: DesignScheme) => void;
  selectedElement?: ElementInfo | null;
  setSelectedElement?: ((element: ElementInfo | null) => void) | undefined;
}

/* 요청 종류를 판별해 '시킨 것만' 만들도록 지시문을 붙입니다. 화면에는 보이지 않습니다. */
const CF_HIDE_MARKER = '<<coverfo-spec>>';

/* 설치 없이 바로 뜨는 정적 서버. Node 기본 기능만 사용합니다. */
const SERVER_JS = [
  '',
  '```js',
  '// server.js',
  "const http = require('http');",
  "const fs = require('fs');",
  "const path = require('path');",
  "const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',",
  "  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',",
  "  '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.ico': 'image/x-icon' };",
  'http',
  '  .createServer((req, res) => {',
  "    let p = decodeURIComponent((req.url || '/').split('?')[0]);",
  "    if (p === '/') p = '/index.html';",
  '    const file = path.join(process.cwd(), p);',
  '    fs.readFile(file, (err, data) => {',
  "      if (err) { res.writeHead(404); res.end('Not found'); return; }",
  "      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });",
  '      res.end(data);',
  '    });',
  '  })',
  "  .listen(3000, '0.0.0.0', () => console.log('server on 3000'));",
  '```',
].join('\n');

/*
 * coverfo: "앱 생성하기 · 3D · 영상 AUTO" 는 홈 화면 버튼과 같은 규칙(~/utils/cfRoute)으로 갈 곳을 정합니다.
 *  - 이미지·영상 → 스튜디오 (진행 중인 대화에서도: 채팅은 이미지·영상을 못 만들기 때문)
 *  - 3D → 엔진(3D 에셋), 앱·게임·사이트·페이지 → 엔진(7단계) : 새 대화에서만 (진행 중인 앱 작업은 그대로 AI 에게)
 *  - 아무 낱말도 없으면 null → 평소처럼 이 채팅에서 만듭니다
 */
function cfTarget(text: string, chatStarted: boolean): string | null {
  const target = cfRouteByCommand(text);

  if (!target) {
    return null;
  }

  if (target.startsWith('/studio')) {
    return target;
  }

  return chatStarted ? null : target;
}

function buildSpec(text: string) {
  const low = text.toLowerCase();
  const has = (...keys: string[]) => keys.some((k) => text.includes(k) || low.includes(k));

  let scope = '요청한 내용만 정확히 만들어 주세요.';

  if (has('게임', 'game', '플레이', '점수', '레벨')) {
    scope = '요청한 것은 게임입니다. 조작 방법, 점수, 시작/재시작 기능을 포함한 플레이 가능한 게임으로 만들어 주세요.';
  } else if (has('영상', '동영상', '비디오', '애니메이션', 'video')) {
    scope = '요청한 것은 움직이는 영상(애니메이션)입니다. 자동 재생 화면만 만들고 게임 기능이나 점수는 넣지 마세요.';
  } else if (has('이미지', '그림', '포스터', '일러스트', 'image')) {
    scope =
      '요청한 것은 한 장의 이미지(그림) 화면입니다. 보기만 하는 화면으로 만들고 게임이나 조작 기능은 넣지 마세요.';
  } else if (has('3d', '입체')) {
    scope =
      '요청한 것은 3D 화면입니다. 요청한 사물과 주변 배경만 3D로 보여 주고 마우스로 돌려보는 정도만 가능하게 하세요. 게임 기능(점수, 레벨, 미션)은 넣지 마세요.';
  } else if (has('페이지', '사이트', '홈페이지', '랜딩', 'page')) {
    scope = '요청한 것은 웹페이지입니다. 요청한 내용의 페이지만 만들고 요청에 없는 기능은 넣지 마세요.';
  }

  return (
    text +
    '\n\n' +
    CF_HIDE_MARKER +
    '\n[제작 지시]\n' +
    scope +
    '\n\n반드시 지킬 규칙:\n' +
    '1) 사용자가 말하지 않은 기능은 절대 추가하지 마세요. 버튼, 조작, 점수, 메뉴, 설정 패널을 요청하지 않았다면 넣지 마세요.\n' +
    '2) 화면은 index.html 한 파일에 HTML·CSS·자바스크립트를 모두 넣어 만들어 주세요. 파일을 여러 개로 나누지 마세요.\n' +
    '3) npm install, npm run dev, vite, package.json 을 절대 사용하지 마세요. 설치가 실패해서 화면이 안 나옵니다.\n' +
    '4) 외부 라이브러리가 필요하면 index.html 안에서 CDN script 태그로만 불러오세요.\n' +
    '5) 미리보기가 뜨도록 아래 server.js 파일을 내용 그대로 만들고, 마지막 단계에서 `node server.js` 를 실행해 주세요. 설치가 필요 없는 방식입니다.\n' +
    SERVER_JS +
    '\n6) 자바스크립트 문법 오류가 없는지 확인하고, 설명은 두 문장 이내로 짧게 해주세요.' +
    '\n7) index.html 은 500줄을 넘기지 마세요. 요청이 커도 핵심만 담아 간결하게 만들고, 장식·효과·부가 기능은 빼세요. 코드가 너무 길면 화면이 멈춥니다.'
  );
}

export const ChatBox: React.FC<ChatBoxProps> = (props) => {
  return (
    <div
      className={classNames(
        'relative bg-bolt-elements-background-depth-2 backdrop-blur p-2 rounded-lg border border-bolt-elements-borderColor relative w-full max-w-chat lg:max-w-none mx-auto z-prompt',

        /*
         * {
         *   'sticky bottom-2': chatStarted,
         * },
         */
      )}
    >
      <svg className={classNames(styles.PromptEffectContainer)}>
        <defs>
          <linearGradient
            id="line-gradient"
            x1="20%"
            y1="0%"
            x2="-14%"
            y2="10%"
            gradientUnits="userSpaceOnUse"
            gradientTransform="rotate(-45)"
          >
            <stop offset="0%" stopColor="#b44aff" stopOpacity="0%"></stop>
            <stop offset="40%" stopColor="#b44aff" stopOpacity="80%"></stop>
            <stop offset="50%" stopColor="#b44aff" stopOpacity="80%"></stop>
            <stop offset="100%" stopColor="#b44aff" stopOpacity="0%"></stop>
          </linearGradient>
          <linearGradient id="shine-gradient">
            <stop offset="0%" stopColor="white" stopOpacity="0%"></stop>
            <stop offset="40%" stopColor="#ffffff" stopOpacity="80%"></stop>
            <stop offset="50%" stopColor="#ffffff" stopOpacity="80%"></stop>
            <stop offset="100%" stopColor="white" stopOpacity="0%"></stop>
          </linearGradient>
        </defs>
        <rect className={classNames(styles.PromptEffectLine)} pathLength="100" strokeLinecap="round"></rect>
        <rect className={classNames(styles.PromptShine)} x="48" y="24" width="70" height="1"></rect>
      </svg>
      <div>
        <ClientOnly>
          {() => (
            <div className={props.isModelSettingsCollapsed ? 'hidden' : ''}>
              <ModelSelector
                key={props.provider?.name + ':' + props.modelList.length}
                model={props.model}
                setModel={props.setModel}
                modelList={props.modelList}
                provider={props.provider}
                setProvider={props.setProvider}
                providerList={props.providerList || (PROVIDER_LIST as ProviderInfo[])}
                apiKeys={props.apiKeys}
                modelLoading={props.isModelLoading}
              />
              {(props.providerList || []).length > 0 &&
                props.provider &&
                !LOCAL_PROVIDERS.includes(props.provider.name) && (
                  <div className="hidden sm:block">
                    <APIKeyManager
                      provider={props.provider}
                      apiKey={props.apiKeys[props.provider.name] || ''}
                      setApiKey={(key) => {
                        props.onApiKeysChange(props.provider.name, key);
                      }}
                    />
                  </div>
                )}
            </div>
          )}
        </ClientOnly>
      </div>
      <FilePreview
        files={props.uploadedFiles}
        imageDataList={props.imageDataList}
        onRemove={(index) => {
          props.setUploadedFiles?.(props.uploadedFiles.filter((_, i) => i !== index));
          props.setImageDataList?.(props.imageDataList.filter((_, i) => i !== index));
        }}
      />
      <ClientOnly>
        {() => (
          <ScreenshotStateManager
            setUploadedFiles={props.setUploadedFiles}
            setImageDataList={props.setImageDataList}
            uploadedFiles={props.uploadedFiles}
            imageDataList={props.imageDataList}
          />
        )}
      </ClientOnly>
      {props.selectedElement && (
        <div className="flex mx-1.5 gap-2 items-center justify-between rounded-lg rounded-b-none border border-b-none border-bolt-elements-borderColor text-bolt-elements-textPrimary flex py-1 px-2.5 font-medium text-xs">
          <div className="flex gap-2 items-center lowercase">
            <code className="bg-accent-500 rounded-4px px-1.5 py-1 mr-0.5 text-white">
              {props?.selectedElement?.tagName}
            </code>
            selected for inspection
          </div>
          <button
            className="bg-transparent text-accent-500 pointer-auto"
            onClick={() => props.setSelectedElement?.(null)}
          >
            Clear
          </button>
        </div>
      )}
      <div className={classNames('relative backdrop-blur rounded-lg')}>
        <textarea
          ref={props.textareaRef}
          className={classNames(
            'w-full pl-3 pt-3 pr-14 outline-none resize-none text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent text-sm',
            'transition-all duration-200',
            'hover:border-bolt-elements-focus',
          )}
          onDragEnter={(e) => {
            e.preventDefault();
            e.currentTarget.style.border = '2px solid #1488fc';
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.style.border = '2px solid #1488fc';
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.currentTarget.style.border = 'none';
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.border = 'none';

            const files = Array.from(e.dataTransfer.files);
            files.forEach((file) => {
              if (file.type.startsWith('image/')) {
                const reader = new FileReader();

                reader.onload = (e) => {
                  const base64Image = e.target?.result as string;
                  props.setUploadedFiles?.([...props.uploadedFiles, file]);
                  props.setImageDataList?.([...props.imageDataList, base64Image]);
                };
                reader.readAsDataURL(file);
              }
            });
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              if (event.shiftKey) {
                return;
              }

              event.preventDefault();

              if (props.isStreaming) {
                props.handleStop?.();
                return;
              }

              // ignore if using input method engine
              if (event.nativeEvent.isComposing) {
                return;
              }

              if (props.chatMode === 'build') {
                const target = cfTarget(props.input.trim(), props.chatStarted);

                if (target) {
                  window.location.href = target;
                  return;
                }
              }

              props.handleSendMessage?.(
                event,
                props.chatMode === 'build' ? buildSpec(props.input.trim()) : props.input.trim(),
              );
            }
          }}
          value={props.input}
          onChange={(event) => {
            props.handleInputChange?.(event);
          }}
          onPaste={props.handlePaste}
          style={{
            minHeight: props.TEXTAREA_MIN_HEIGHT,
            maxHeight: props.TEXTAREA_MAX_HEIGHT,
          }}
          placeholder={props.chatMode === 'build' ? '무엇이든 시켜만 주세요!!' : '무엇이든 물어보세요'}
          translate="no"
        />
        {/* 만드는 중에만 보이는 '중지' 버튼 — 누르면 AI 작업을 멈춥니다 */}
        {props.isStreaming && (
          <button
            type="button"
            title="만드는 중인 작업을 멈춥니다"
            className="absolute top-[18px] right-[22px] h-[34px] px-3 flex items-center gap-1 rounded-md bg-accent-500 text-white text-sm font-semibold hover:brightness-95 active:brightness-90 transition"
            onClick={() => props.handleStop?.()}
          >
            <span className="i-ph:stop-circle-bold text-lg" />
            중지
          </button>
        )}
        <div className="flex flex-nowrap justify-between items-center gap-2 text-sm px-3 pb-1.5 pt-1">
          <div className="flex gap-0.5 sm:gap-1 items-center min-w-0 flex-1 overflow-hidden">
            <IconButton title="사진 첨부" className="transition-all" onClick={() => props.handleFileUpload()}>
              <div className="i-ph:image-square text-xl"></div>
            </IconButton>
            <IconButton
              title="파일 첨부 (글·코드 파일)"
              className="transition-all"
              onClick={() => props.handleTextFileUpload?.()}
            >
              <div className="i-ph:paperclip text-xl"></div>
            </IconButton>

            <SpeechRecognitionButton
              isListening={props.isListening}
              onStart={props.startListening}
              onStop={props.stopListening}
              disabled={props.isStreaming}
            />
            <IconButton
              title="Model Settings"
              className={classNames('transition-all flex items-center gap-1', {
                'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent':
                  props.isModelSettingsCollapsed,
                'bg-bolt-elements-item-backgroundDefault text-bolt-elements-item-contentDefault':
                  !props.isModelSettingsCollapsed,
              })}
              onClick={() => props.setIsModelSettingsCollapsed(!props.isModelSettingsCollapsed)}
              disabled={!props.providerList || props.providerList.length === 0}
            >
              <div className={`i-ph:caret-${props.isModelSettingsCollapsed ? 'right' : 'down'} text-lg`} />
              {props.isModelSettingsCollapsed ? (
                <span className="text-xs max-w-[3.5rem] sm:max-w-none truncate">{props.model}</span>
              ) : (
                <span />
              )}
            </IconButton>
          </div>
          <div className="flex gap-1.5 items-center shrink-0">
            {/* 대화 — 파일 없이 글로만 답변 */}
            <button
              type="button"
              title="파일을 만들지 않고 글로만 답합니다"
              disabled={props.input.trim().length === 0 || props.isStreaming}
              className={classNames(
                'inline-flex items-center justify-center h-7 px-5 min-w-[5.5rem] rounded-full text-xs font-semibold tracking-[0.35em] transition active:scale-95',

                /* 지금 선택된 모드(chat)는 진한 색으로 보여서 무엇을 눌렀는지 알 수 있게 합니다 */
                props.chatMode === 'discuss'
                  ? 'bg-[#6D28D9] text-white border border-[#6D28D9] shadow-sm'
                  : 'bg-[#EDE9FE] text-[#4C1D95] border border-[#A78BFA] hover:bg-[#DDD6FE]',
                props.input.trim().length === 0 || props.isStreaming ? 'cursor-not-allowed' : 'active:brightness-90',
              )}
              style={props.chatMode === 'discuss' ? { background: '#6D28D9', borderColor: '#6D28D9' } : { background: '#EDE9FE', color: '#4C1D95', borderColor: '#A78BFA' }}
              onClick={(event) => {
                const raw = props.input.trim();

                if (!raw || props.isStreaming) {
                  return;
                }

                props.setChatMode?.('discuss');
                props.handleSendMessage?.(event, raw);
              }}
            >
              chat
            </button>

            {/* 앱 생성하기 — 채팅 화면에서 바로 실행 */}
            <button
              type="button"
              title="앱·게임·사이트 → 엔진 / 3D → 3D 에셋 / 이미지·영상 → 스튜디오 (홈 화면 버튼과 동일)"
              disabled={props.input.trim().length === 0 || props.isStreaming}
              className={classNames(
                'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition active:scale-95',

                /* 지금 선택된 모드(앱생성)는 진한 색으로 보여서 무엇을 눌렀는지 알 수 있게 합니다 */
                props.chatMode === 'build'
                  ? 'bg-[#6D28D9] text-white border border-[#6D28D9] shadow-sm'
                  : 'bg-[#EDE9FE] text-[#4C1D95] border border-[#A78BFA] hover:bg-[#DDD6FE]',
                props.input.trim().length === 0 || props.isStreaming ? 'cursor-not-allowed' : 'active:brightness-90',
              )}
              style={props.chatMode === 'build' ? { background: '#6D28D9', borderColor: '#6D28D9' } : { background: '#EDE9FE', color: '#4C1D95', borderColor: '#A78BFA' }}
              onClick={(event) => {
                const raw = props.input.trim();

                if (!raw || props.isStreaming) {
                  return;
                }

                const target = cfTarget(raw, props.chatStarted);

                if (target) {
                  window.location.href = target;
                  return;
                }

                props.setChatMode?.('build');
                props.handleSendMessage?.(event, buildSpec(raw));
              }}
            >
              🧊 앱 생성하기 · 3D · 영상<span className="hidden sm:inline"> AUTO</span>
            </button>
          </div>
          <ExpoQrModal open={props.qrModalOpen} onClose={() => props.setQrModalOpen(false)} />
        </div>
      </div>
    </div>
  );
};
