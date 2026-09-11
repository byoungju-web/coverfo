/*
 * app/lib/agents/bookingProject.ts
 * "예약 페이지 만들기" 버튼용 - 실행 가능한 예약 페이지 프로젝트 파일 한 벌과 채팅 메시지를 만듦
 * AI를 호출하지 않음 (Import Folder 와 같은 방식으로 파일을 바로 넣음)
 * © bj Lee - coverfo.com - Uncovering the fog
 */
import type { Message } from 'ai';
import { bookingUI, universalBookingTemplate } from './universalBookingAgent';
import type { BookingTemplateOptions } from './universalBookingAgent';
import { generateId } from '~/utils/fileUtils';
import { createCommandsMessage, escapeBoltTags } from '~/utils/projectCommands';

export interface BookingProjectFile {
  path: string;
  content: string;
}

export const MAX_FACILITY_LENGTH = 30;

/*
 * 설치·실행 명령
 * coverfo 실제 화면에서 확인한 결과:
 * - bolt 기본 명령(export ... && npx update-browserslist-db@latest && npm install) → "command not found: vite"
 * - export ... && npm install --yes --no-audit --no-fund --silent → 설치 ✓ 표시였지만 "command not found: vite"
 * - 터미널에 직접 "npm install" → "npm run dev" 입력 → 미리보기 정상
 * 그래서 직접 입력해서 성공한 명령과 똑같이 맞춥니다.
 */
export const BOOKING_SETUP_COMMAND = 'npm install';
export const BOOKING_START_COMMAND = 'npm run dev';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * 시설 이름 검사. 문제가 있으면 안내 문구, 없으면 null.
 * < > 기호는 막습니다: bolt 파서가 파일 내용의 &lt; &gt; 를 < > 로 되돌리고,
 * 짝이 안 맞는 </boltAction> 은 이스케이프되지 않아 파일 생성이 깨질 수 있기 때문입니다.
 */
export function getFacilityError(facility: string): string | null {
  const name = facility.trim();

  if (!name) {
    return '시설 이름을 입력해 주세요.';
  }

  if (name.length > MAX_FACILITY_LENGTH) {
    return `시설 이름은 ${MAX_FACILITY_LENGTH}자 이내로 입력해 주세요.`;
  }

  if (/[<>]/.test(name)) {
    return '시설 이름에는 < > 기호를 쓸 수 없어요.';
  }

  return null;
}

function normalizeFacility(facility: string): string {
  const error = getFacilityError(facility);

  if (error) {
    throw new Error(error);
  }

  return facility.trim();
}

const PACKAGE_JSON = {
  name: 'coverfo-booking',
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

const MAIN_TSX = `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`;

const APP_TSX = `// 미리보기용: 손님 화면과 사장님 화면을 버튼으로 오가며 확인합니다.
// 실제 운영에서는 두 화면을 다른 주소로 나누고, 사장님 화면은 로그인으로 보호하세요.
import { useState } from 'react';
import { BookingAdmin, BookingPage } from './booking/BookingUI';

function tabStyle(active: boolean) {
  return {
    flex: 1,
    padding: 12,
    fontSize: 15,
    border: 'none',
    borderBottom: active ? '3px solid #222' : '3px solid transparent',
    background: '#fff',
    fontWeight: active ? 700 : 400,
  };
}

export default function App() {
  const [view, setView] = useState<'customer' | 'admin'>('customer');

  return (
    <div>
      <div style={{ display: 'flex', maxWidth: 480, margin: '0 auto', borderBottom: '1px solid #eee' }}>
        <button type="button" style={tabStyle(view === 'customer')} onClick={() => setView('customer')}>
          손님 화면
        </button>
        <button type="button" style={tabStyle(view === 'admin')} onClick={() => setView('admin')}>
          사장님 화면
        </button>
      </div>
      {view === 'customer' ? <BookingPage /> : <BookingAdmin />}
    </div>
  );
}
`;

/**
 * 예약 페이지 프로젝트 파일 목록을 만듭니다. (Vite + React)
 */
export function createBookingProjectFiles(
  facility: string,
  options: BookingTemplateOptions = {},
): BookingProjectFile[] {
  const name = normalizeFacility(facility);

  const indexHtml = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(name)} 예약</title>
  </head>
  <body style="margin: 0">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

  return [
    { path: 'package.json', content: JSON.stringify(PACKAGE_JSON, null, 2) + '\n' },
    { path: 'index.html', content: indexHtml },
    { path: 'vite.config.js', content: VITE_CONFIG },
    { path: 'src/main.tsx', content: MAIN_TSX },
    { path: 'src/App.tsx', content: APP_TSX },
    { path: 'src/booking/bookingCore.ts', content: universalBookingTemplate(name, options) },
    { path: 'src/booking/BookingUI.tsx', content: bookingUI },
  ];
}

/**
 * Import Folder 와 같은 형식의 채팅 메시지를 만듭니다.
 * importChat 에 넘기면 새 채팅이 열리고 파일 생성 → npm install → npm run dev 가 실행됩니다.
 */
export async function createBookingChatMessages(
  facility: string,
  options: BookingTemplateOptions = {},
): Promise<Message[]> {
  const name = normalizeFacility(facility);
  const files = createBookingProjectFiles(name, options);
  const artifactTitle = name.replace(/"/g, '') + ' 예약 페이지';

  const fileActions = files
    .map((file) => `<boltAction type="file" filePath="${file.path}">\n${escapeBoltTags(file.content)}\n</boltAction>`)
    .join('\n\n');

  const userMessage: Message = {
    role: 'user',
    id: generateId(),
    content: `${name} 예약 페이지 만들기`,
    createdAt: new Date(),
  };

  const filesMessage: Message = {
    role: 'assistant',
    id: generateId(),
    content: `${name} 예약 페이지를 만들었어요. 미리보기에서 "손님 화면"으로 예약을 신청하고 "사장님 화면"에서 확인해 보세요.
데모 모드라서 예약은 이 미리보기 브라우저에만 저장됩니다.

<boltArtifact id="booking-page" title="${artifactTitle}" type="bundled">
${fileActions}
</boltArtifact>`,
    createdAt: new Date(),
  };

  const messages: Message[] = [userMessage, filesMessage];

  const commandsMessage = createCommandsMessage({
    type: 'Node.js',
    setupCommand: BOOKING_SETUP_COMMAND,
    startCommand: BOOKING_START_COMMAND,
    followupMessage: '패키지를 설치(npm install)한 뒤 미리보기를 실행(npm run dev)합니다.',
  });

  if (commandsMessage) {
    messages.push({
      role: 'user',
      id: generateId(),
      content: 'Setup the codebase and Start the application',
    });
    messages.push(commandsMessage);
  }

  return messages;
}
