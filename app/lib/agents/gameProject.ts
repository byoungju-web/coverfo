/*
 * app/lib/agents/gameProject.ts
 * "3D 게임 만들기" 버튼·입력칸용 - 실행 가능한 3D 게임 프로젝트 파일 한 벌과 채팅 메시지를 만듦
 * AI를 호출하지 않음 (Import Folder 와 같은 방식으로 파일을 바로 넣음)
 * © bj Lee - coverfo.com - Uncovering the fog
 */
import type { Message } from 'ai';
import {
  gameConfigJs,
  gameIndexHtml,
  gameLogicJs,
  gameMainJs,
  gameReadme,
  gameStyleCss,
  type PlayerKind,
} from './universalGameBuilder';
import { generateId } from '~/utils/fileUtils';
import { createCommandsMessage, escapeBoltTags } from '~/utils/projectCommands';

export interface GameProjectFile {
  path: string;
  content: string;
}

export const MAX_GAME_TITLE_LENGTH = 30;
export const DEFAULT_GAME_TITLE = '보석 모으기';

/** 이 템플릿으로 만들 게임 요청인지: "게임" 단어가 있어야 함 */
export const GAME_WORD_PATTERN = /게임/;

/** 규칙이 전혀 다른 게임은 템플릿 대신 AI에게 보냄 */
export const GAME_UNSUPPORTED_PATTERN = /(슈팅|퍼즐|카드|체스|바둑|오목|테트리스|전략|rpg|격투|리듬|퀴즈|보드)/i;

// 게임 제목을 뽑을 때 버리는 단어
const TITLE_FILLER_WORDS = new Set([
  '우리',
  '내',
  '제',
  '좀',
  '간단한',
  '간단히',
  '재밌는',
  '재미있는',
  '신나는',
  '멋진',
  '작은',
  '새',
  '새로운',
  '만들어줘',
  '만들어',
  '만들기',
  '해줘',
]);

/** 게임 제목 검사. 문제가 있으면 안내 문구, 없으면 null. (< > 는 bolt 파일 해석을 깨뜨릴 수 있어 막음) */
export function getGameTitleError(title: string): string | null {
  const name = title.trim();

  if (!name) {
    return '게임 이름을 입력해 주세요.';
  }

  if (name.length > MAX_GAME_TITLE_LENGTH) {
    return `게임 이름은 ${MAX_GAME_TITLE_LENGTH}자 이내로 입력해 주세요.`;
  }

  if (/[<>]/.test(name)) {
    return '게임 이름에는 < > 기호를 쓸 수 없어요.';
  }

  return null;
}

/**
 * "게임" 단어 바로 앞의 말(최대 3단어)을 게임 제목으로 뽑습니다.
 * 예: "말 달리기 게임 만들어줘" → "말 달리기", "3D 자동차 경주 게임" → "3D 자동차 경주"
 */
export function extractGameTitle(prompt: string): string | undefined {
  const match = GAME_WORD_PATTERN.exec(prompt);

  if (!match) {
    return undefined;
  }

  const tokens = prompt
    .slice(0, match.index)
    .split(/[\s,.!?~·:;()"'“”‘’[\]{}]+/)
    .map((token) => token.replace(/(을|를|의)$/, ''))
    .filter((token) => token && !TITLE_FILLER_WORDS.has(token));

  const name = tokens.slice(-3).join(' ');

  if (!name || getGameTitleError(name)) {
    return undefined;
  }

  return name;
}

/** 제목에 들어간 단어로 캐릭터 모양을 고름 */
export function pickPlayerKind(text: string): PlayerKind {
  if (/(말|승마|경마|horse)/i.test(text)) {
    return 'horse';
  }

  if (/(자동차|레이싱|경주|카트|드라이브|car|racing)/i.test(text)) {
    return 'car';
  }

  return 'runner';
}

function normalizeTitle(title: string): string {
  const error = getGameTitleError(title);

  if (error) {
    throw new Error(error);
  }

  return title.trim();
}

const PACKAGE_JSON = {
  name: 'coverfo-3d-game',
  private: true,
  version: '0.0.0',
  type: 'module',
  scripts: {
    dev: 'vite',
    build: 'vite build',
    preview: 'vite preview',
  },
  dependencies: {
    three: '^0.186.0',
  },
  devDependencies: {
    vite: '^5.4.21',
  },
};

export const GAME_SETUP_COMMAND = 'npm install';
export const GAME_START_COMMAND = 'npm run dev';

export function createGameProjectFiles(title: string): GameProjectFile[] {
  const name = normalizeTitle(title);
  const kind = pickPlayerKind(name);

  return [
    { path: 'package.json', content: JSON.stringify(PACKAGE_JSON, null, 2) + '\n' },
    { path: 'index.html', content: gameIndexHtml(name) },
    { path: 'src/gameConfig.js', content: gameConfigJs(name, kind) },
    { path: 'src/gameLogic.js', content: gameLogicJs },
    { path: 'src/main.js', content: gameMainJs },
    { path: 'src/style.css', content: gameStyleCss },
    { path: 'README.md', content: gameReadme(name) },
  ];
}

/**
 * Import Folder 와 같은 형식의 채팅 메시지를 만듭니다.
 * importChat 에 넘기면 새 채팅이 열리고 파일 생성 → npm install → npm run dev 가 실행됩니다.
 */
export async function createGameChatMessages(
  title: string,
  chatText: { userMessage?: string; note?: string } = {},
): Promise<Message[]> {
  const name = normalizeTitle(title);
  const files = createGameProjectFiles(name);
  const artifactTitle = name.replace(/"/g, '') + ' 게임';

  const fileActions = files
    .map((file) => `<boltAction type="file" filePath="${file.path}">\n${escapeBoltTags(file.content)}\n</boltAction>`)
    .join('\n\n');

  const messages: Message[] = [
    {
      role: 'user',
      id: generateId(),
      content: chatText.userMessage?.trim() || `${name} 게임 만들기`,
      createdAt: new Date(),
    },
    {
      role: 'assistant',
      id: generateId(),
      content: `${name} 게임을 만들었어요. 미리보기에서 시작을 누르고 3분 동안 보석을 모아 보세요. PC는 WASD·스페이스, 휴대폰은 조이스틱·점프 버튼으로 조작합니다.${chatText.note ? `\n\n${chatText.note}` : ''}

<boltArtifact id="3d-game" title="${artifactTitle}" type="bundled">
${fileActions}
</boltArtifact>`,
      createdAt: new Date(),
    },
  ];

  const commandsMessage = createCommandsMessage({
    type: 'Node.js',
    setupCommand: GAME_SETUP_COMMAND,
    startCommand: GAME_START_COMMAND,
    followupMessage: '패키지를 설치(npm install)한 뒤 미리보기를 실행(npm run dev)합니다.',
  });

  if (commandsMessage) {
    messages.push({ role: 'user', id: generateId(), content: 'Setup the codebase and Start the application' });
    messages.push(commandsMessage);
  }

  return messages;
}
