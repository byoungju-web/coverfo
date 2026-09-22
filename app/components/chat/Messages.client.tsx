import type { ChatRequestOptions, Message } from 'ai';
import { Fragment } from 'react';
import { classNames } from '~/utils/classNames';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { forwardRef } from 'react';
import type { ForwardedRef } from 'react';
import type { ProviderInfo } from '~/types/model';

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
  messages?: Message[];
  append?: (message: Message, options?: ChatRequestOptions) => void;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  model?: string;
  provider?: ProviderInfo;
  addToolResult: ({ toolCallId, result }: { toolCallId: string; result: any }) => void;
}

/* 홈화면 버튼이 자동으로 덧붙인 지시문은 화면에 보이지 않게 잘라냅니다 */
const CF_HIDE_MARKER = '<<coverfo-spec>>';

/* 새 마커 + 예전 버전에서 붙던 지시문도 함께 잘라냅니다 */
const CF_LEGACY_MARKERS = ['[앱 생성 요청]', '[제작 지시]', '[실행 지시]', '[답변 지시]'];

function stripHiddenSpec(content: any) {
  if (typeof content !== 'string') {
    return content;
  }

  let out = content;

  const i = out.indexOf(CF_HIDE_MARKER);

  if (i !== -1) {
    out = out.slice(0, i);
  }

  for (const marker of CF_LEGACY_MARKERS) {
    const j = out.indexOf(marker);

    if (j !== -1) {
      out = out.slice(0, j);
    }
  }

  /* 앞머리에 붙던 [질문] / [앱 생성] 표시도 지웁니다 */
  out = out.replace(/^\s*\[(질문|앱 생성)\]\s*/, '');

  return out.trimEnd();
}

/*
 * 추천 문구 버튼이 문자열이 아닌 값을 보내면 서버에서
 * 'text.replace is not a function' 오류가 납니다. 보내기 전에 문자열로 맞춥니다.
 */
function toPlainText(value: any): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value == null) {
    return '';
  }

  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'string' ? v : typeof v?.text === 'string' ? v.text : ''))
      .filter(Boolean)
      .join('');
  }

  if (typeof value === 'object' && typeof value.text === 'string') {
    return value.text;
  }

  return String(value);
}

export const Messages = forwardRef<HTMLDivElement, MessagesProps>(
  (props: MessagesProps, ref: ForwardedRef<HTMLDivElement> | undefined) => {
    const { id, isStreaming = false, messages = [] } = props;

    const safeAppend = props.append
      ? (message: Message, options?: ChatRequestOptions) => {
          const text = toPlainText((message as any)?.content);

          if (!text.trim()) {
            return;
          }

          /* 일반 전송과 같은 형태(parts 포함)로 보냅니다 */
          props.append?.(
            {
              ...message,
              id: message?.id || `msg-${Date.now()}`,
              role: message?.role || 'user',
              content: text,
              parts: [{ type: 'text', text }],
            },
            options,
          );
        }
      : undefined;

    return (
      <div id={id} className={props.className} ref={ref}>
        {messages.length > 0
          ? messages.map((message, index) => {
              const { role, content, id: messageId, annotations, parts } = message;
              const isUserMessage = role === 'user';
              const isFirst = index === 0;
              const isHidden = annotations?.includes('hidden');

              if (isHidden) {
                return <Fragment key={index} />;
              }

              return (
                <div
                  key={index}
                  className={classNames('flex gap-4 py-3 w-full rounded-lg', {
                    'mt-4': !isFirst,
                  })}
                >
                  <div className="grid grid-col-1 w-full">
                    {isUserMessage ? (
                      <UserMessage content={stripHiddenSpec(content)} parts={parts} />
                    ) : (
                      <AssistantMessage
                        content={content}
                        annotations={message.annotations}
                        messageId={messageId}
                        append={safeAppend}
                        chatMode={props.chatMode}
                        setChatMode={props.setChatMode}
                        model={props.model}
                        provider={props.provider}
                        parts={parts}
                        addToolResult={props.addToolResult}
                      />
                    )}
                  </div>
                </div>
              );
            })
          : null}
        {isStreaming && (
          <div className="text-center w-full  text-bolt-elements-item-contentAccent i-svg-spinners:3-dots-fade text-4xl mt-4"></div>
        )}
      </div>
    );
  },
);
