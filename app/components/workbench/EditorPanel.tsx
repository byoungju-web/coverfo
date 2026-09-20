import { useStore } from '@nanostores/react';
import { memo, useMemo } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import {
  CodeMirrorEditor,
  type EditorDocument,
  type EditorSettings,
  type OnChangeCallback as OnEditorChange,
  type OnSaveCallback as OnEditorSave,
  type OnScrollCallback as OnEditorScroll,
} from '~/components/editor/codemirror/CodeMirrorEditor';
import { PanelHeader } from '~/components/ui/PanelHeader';
import { PanelHeaderButton } from '~/components/ui/PanelHeaderButton';
import type { FileMap } from '~/lib/stores/files';
import type { FileHistory } from '~/types/actions';
import { themeStore } from '~/lib/stores/theme';
import { WORK_DIR } from '~/utils/constants';
import { renderLogger } from '~/utils/logger';
import { isMobile } from '~/utils/mobile';
import { FileBreadcrumb } from './FileBreadcrumb';
import { FileTree } from './FileTree';
import { DEFAULT_TERMINAL_SIZE, TerminalTabs } from './terminal/TerminalTabs';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames'; // <-- Import classNames if not already present

interface EditorPanelProps {
  files?: FileMap;
  unsavedFiles?: Set<string>;
  editorDocument?: EditorDocument;
  selectedFile?: string | undefined;
  isStreaming?: boolean;
  fileHistory?: Record<string, FileHistory>;
  onEditorChange?: OnEditorChange;
  onEditorScroll?: OnEditorScroll;
  onFileSelect?: (value?: string) => void;
  onFileSave?: OnEditorSave;
  onFileReset?: () => void;
}

const DEFAULT_EDITOR_SIZE = 100 - DEFAULT_TERMINAL_SIZE;

const editorSettings: EditorSettings = { tabSize: 2 };

export const EditorPanel = memo(
  ({
    files,
    unsavedFiles,
    editorDocument,
    selectedFile,
    isStreaming,
    fileHistory,
    onFileSelect,
    onEditorChange,
    onEditorScroll,
    onFileSave,
    onFileReset,
  }: EditorPanelProps) => {
    renderLogger.trace('EditorPanel');

    const theme = useStore(themeStore);
    const showTerminal = useStore(workbenchStore.showTerminal);

    const activeFileSegments = useMemo(() => {
      if (!editorDocument) {
        return undefined;
      }

      return editorDocument.filePath.split('/');
    }, [editorDocument]);

    const activeFileUnsaved = useMemo(() => {
      if (!editorDocument || !unsavedFiles) {
        return false;
      }

      // Make sure unsavedFiles is a Set before calling has()
      return unsavedFiles instanceof Set && unsavedFiles.has(editorDocument.filePath);
    }, [editorDocument, unsavedFiles]);

    return (
      <PanelGroup direction="vertical">
        <Panel defaultSize={showTerminal ? DEFAULT_EDITOR_SIZE : 100} minSize={20}>
          <PanelGroup direction="horizontal">
            <Panel defaultSize={26} minSize={18} collapsible className="border-r border-bolt-elements-borderColor">
              <div className="h-full flex flex-col">
                <PanelHeader className="w-full text-sm font-medium text-bolt-elements-textSecondary px-3">
                  <span className="text-bolt-elements-textPrimary">만든 파일</span>
                </PanelHeader>
                <div className="flex-grow overflow-auto">
                  {(!files || Object.keys(files).length === 0) && (
                    <div className="px-3 py-6 text-xs text-bolt-elements-textTertiary leading-relaxed">
                      아직 만든 파일이 없습니다.
                    </div>
                  )}
                  <FileTree
                    className="h-full"
                    files={files}
                    hideRoot
                    unsavedFiles={unsavedFiles}
                    fileHistory={fileHistory}
                    rootFolder={WORK_DIR}
                    selectedFile={selectedFile}
                    onFileSelect={onFileSelect}
                  />
                </div>
              </div>
            </Panel>

            <PanelResizeHandle />
            <Panel className="flex flex-col" defaultSize={80} minSize={20}>
              <PanelHeader className="overflow-x-auto shrink-0">
                {activeFileSegments?.length ? (
                  <div className="flex items-center flex-1 text-sm">
                    <FileBreadcrumb pathSegments={activeFileSegments} files={files} onFileSelect={onFileSelect} />
                    {activeFileUnsaved && (
                      <div className="flex gap-1 ml-auto -mr-1.5">
                        <PanelHeaderButton onClick={onFileSave}>
                          <div className="i-ph:floppy-disk-duotone" />
                          저장
                        </PanelHeaderButton>
                        <PanelHeaderButton onClick={onFileReset}>
                          <div className="i-ph:clock-counter-clockwise-duotone" />
                          되돌리기
                        </PanelHeaderButton>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-bolt-elements-textTertiary px-1">파일을 선택하세요</span>
                )}
              </PanelHeader>
              {!editorDocument && (
                <div className="flex-1 flex items-center justify-center px-6 text-center">
                  <div className="text-sm text-bolt-elements-textTertiary leading-relaxed">
                    왼쪽에서 파일을 누르면 내용이 보입니다.
                    <br />
                    결과 화면은 위쪽 <b>Preview</b> 를 눌러 확인하세요.
                  </div>
                </div>
              )}
              <div
                className={classNames('h-full flex-1 overflow-hidden modern-scrollbar', { hidden: !editorDocument })}
              >
                <CodeMirrorEditor
                  theme={theme}
                  editable={!isStreaming && editorDocument !== undefined}
                  settings={editorSettings}
                  doc={editorDocument}
                  autoFocusOnDocumentChange={!isMobile()}
                  onScroll={onEditorScroll}
                  onChange={onEditorChange}
                  onSave={onFileSave}
                />
              </div>
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle />
        <TerminalTabs />
      </PanelGroup>
    );
  },
);
