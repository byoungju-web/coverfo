/*
 * app/lib/agents/quoteProject.ts
 * "견적서 만들기" 버튼·입력칸용 - 실행 가능한 견적서 프로젝트 파일 한 벌과 채팅 메시지를 만듦
 * AI를 호출하지 않음 (Import Folder 와 같은 방식으로 파일을 바로 넣음)
 * © bj Lee - coverfo.com - Uncovering the fog
 */
import type { Message } from 'ai';
import {
  quoteConfigTs,
  quoteCoreTs,
  quoteIndexHtml,
  quoteMainTsx,
  quoteReadme,
  quoteSampleCsv,
  quoteStyleCss,
  quoteUiTsx,
} from './universalQuoteBuilder';
import { generateId } from '~/utils/fileUtils';
import { createCommandsMessage, escapeBoltTags } from '~/utils/projectCommands';

export interface QuoteProjectFile {
  path: string;
  content: string;
}

export const MAX_QUOTE_TITLE_LENGTH = 40;
export const DEFAULT_QUOTE_TITLE = '견적서';

/** 이 템플릿으로 만들 요청인지 */
export const QUOTE_WORD_PATTERN = /(견적서|견적)/;

// 제목을 뽑을 때 버리는 단어
const TITLE_FILLER_WORDS = new Set([
  '우리',
  '내',
  '제',
  '좀',
  '간단한',
  '간단히',
  '새',
  '새로운',
  '자동',
  '자동화',
  '만들어줘',
  '만들어',
  '만들기',
  '해줘',
  '양식',
  '서식',
  '페이지',
  '프로그램',
  '앱',
]);

export function getQuoteTitleError(title: string): string | null {
  const name = title.trim();

  if (!name) {
    return '견적서 제목을 입력해 주세요.';
  }

  if (name.length > MAX_QUOTE_TITLE_LENGTH) {
    return `견적서 제목은 ${MAX_QUOTE_TITLE_LENGTH}자 이내로 입력해 주세요.`;
  }

  if (/[<>]/.test(name)) {
    return '견적서 제목에는 < > 기호를 쓸 수 없어요.';
  }

  return null;
}

/**
 * "견적서" 앞의 말(최대 3단어)을 제목에 붙입니다.
 * 예: "인테리어 공사 견적서 만들어줘" → "인테리어 공사 견적서"
 */
export function extractQuoteTitle(prompt: string): string | undefined {
  const match = QUOTE_WORD_PATTERN.exec(prompt);

  if (!match) {
    return undefined;
  }

  const tokens = prompt
    .slice(0, match.index)
    .split(/[\s,.!?~·:;()"'“”‘’[\]{}]+/)
    .map((token) => token.replace(/(을|를|의)$/, ''))
    .filter((token) => token && !TITLE_FILLER_WORDS.has(token));

  const prefix = tokens.slice(-3).join(' ');
  const name = prefix ? `${prefix} 견적서` : DEFAULT_QUOTE_TITLE;

  return getQuoteTitleError(name) ? undefined : name;
}

const PACKAGE_JSON = {
  name: 'coverfo-quote',
  private: true,
  version: '0.0.0',
  type: 'module',
  scripts: {
    dev: 'vite',
    build: 'vite build',
    preview: 'vite preview',
  },
  dependencies: {
    react: '^18.3.1',
    'react-dom': '^18.3.1',
  },
  devDependencies: {
    '@vitejs/plugin-react': '^4.7.0',
    vite: '^5.4.21',
  },
};

const VITE_CONFIG = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`;

export const QUOTE_SETUP_COMMAND = 'npm install';
export const QUOTE_START_COMMAND = 'npm run dev';

export function createQuoteProjectFiles(title: string): QuoteProjectFile[] {
  const error = getQuoteTitleError(title);

  if (error) {
    throw new Error(error);
  }

  const name = title.trim();

  return [
    { path: 'package.json', content: JSON.stringify(PACKAGE_JSON, null, 2) + '\n' },
    { path: 'index.html', content: quoteIndexHtml(name) },
    { path: 'vite.config.js', content: VITE_CONFIG },
    { path: 'src/main.tsx', content: quoteMainTsx },
    { path: 'src/quoteConfig.ts', content: quoteConfigTs(name) },
    { path: 'src/style.css', content: quoteStyleCss },
    { path: 'src/quote/quoteCore.ts', content: quoteCoreTs },
    { path: 'src/quote/QuoteUI.tsx', content: quoteUiTsx },
    { path: 'sample-items.csv', content: quoteSampleCsv },
    { path: 'README.md', content: quoteReadme(name) },
  ];
}

export async function createQuoteChatMessages(
  title: string,
  chatText: { userMessage?: string; note?: string } = {},
): Promise<Message[]> {
  const files = createQuoteProjectFiles(title);
  const name = title.trim();
  const artifactTitle = name.replace(/"/g, '');

  const fileActions = files
    .map((file) => `<boltAction type="file" filePath="${file.path}">\n${escapeBoltTags(file.content)}\n</boltAction>`)
    .join('\n\n');

  const messages: Message[] = [
    {
      role: 'user',
      id: generateId(),
      content: chatText.userMessage?.trim() || `${name} 만들기`,
      createdAt: new Date(),
    },
    {
      role: 'assistant',
      id: generateId(),
      content: `${name}를 만들었어요. 가게 정보와 품목을 입력하거나 엑셀(CSV)을 불러온 뒤, "인쇄 · PDF 저장"을 누르면 견적서 PDF가 됩니다. sample-items.csv 로 먼저 시험해 볼 수 있어요.${chatText.note ? `\n\n${chatText.note}` : ''}

<boltArtifact id="quote-sheet" title="${artifactTitle}" type="bundled">
${fileActions}
</boltArtifact>`,
      createdAt: new Date(),
    },
  ];

  const commandsMessage = createCommandsMessage({
    type: 'Node.js',
    setupCommand: QUOTE_SETUP_COMMAND,
    startCommand: QUOTE_START_COMMAND,
    followupMessage: '패키지를 설치(npm install)한 뒤 미리보기를 실행(npm run dev)합니다.',
  });

  if (commandsMessage) {
    messages.push({ role: 'user', id: generateId(), content: 'Setup the codebase and Start the application' });
    messages.push(commandsMessage);
  }

  return messages;
}
