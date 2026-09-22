import { useStore } from '@nanostores/react';
import { motion, type HTMLMotionProps, type Variants } from 'framer-motion';
import { computed } from 'nanostores';
import { memo, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import type { FileHistory } from '~/types/actions';
import { DiffView } from './DiffView';
import {
  type OnChangeCallback as OnEditorChange,
  type OnScrollCallback as OnEditorScroll,
} from '~/components/editor/codemirror/CodeMirrorEditor';
import { IconButton } from '~/components/ui/IconButton';
import { Slider, type SliderOptions } from '~/components/ui/Slider';
import { workbenchStore, type WorkbenchViewType } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { renderLogger } from '~/utils/logger';
import { EditorPanel } from './EditorPanel';
import { Preview } from './Preview';
import useViewport from '~/lib/hooks';

import { usePreviewStore } from '~/lib/stores/previews';
import { chatStore } from '~/lib/stores/chat';
import type { ElementInfo } from './Inspector';

interface WorkspaceProps {
  chatStarted?: boolean;
  isStreaming?: boolean;
  metadata?: {
    gitUrl?: string;
  };
  updateChatMestaData?: (metadata: any) => void;
  setSelectedElement?: (element: ElementInfo | null) => void;
}

const viewTransition = { ease: cubicEasingFn };

const sliderOptions: SliderOptions<WorkbenchViewType> = {
  left: {
    value: 'code',
    text: 'Code',
  },
  right: {
    value: 'preview',
    text: 'Preview',
  },
};

const workbenchVariants = {
  closed: {
    width: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },

  /*
   * 데스크탑에서 왼쪽 대화 목록(340px)이 항상 열려 있을 때는
   * 채팅칸이 가려지지 않도록 작업 화면 폭을 채팅칸 오른쪽 나머지로 맞춥니다.
   */
  open: (withFixedSidebar: boolean) => ({
    width: withFixedSidebar ? 'calc(100% - var(--chat-min-width))' : 'var(--workbench-width)',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  }),
} satisfies Variants;

export const Workbench = memo(
  ({
    chatStarted,
    isStreaming,
    metadata: _metadata,
    updateChatMestaData: _updateChatMestaData,
    setSelectedElement,
  }: WorkspaceProps) => {
    renderLogger.trace('Workbench');

    const [fileHistory, setFileHistory] = useState<Record<string, FileHistory>>({});

    // const modifiedFiles = Array.from(useStore(workbenchStore.unsavedFiles).keys());

    const hasPreview = useStore(computed(workbenchStore.previews, (previews) => previews.length > 0));
    const showWorkbench = useStore(workbenchStore.showWorkbench);
    const selectedFile = useStore(workbenchStore.selectedFile);
    const currentDocument = useStore(workbenchStore.currentDocument);
    const unsavedFiles = useStore(workbenchStore.unsavedFiles);
    const files = useStore(workbenchStore.files);
    const selectedView = useStore(workbenchStore.currentView);
    const { showChat } = useStore(chatStore);

    const isSmallViewport = useViewport(1024);

    // 데스크탑에서 대화 목록(사이드바)이 고정으로 열려 있고 채팅칸이 보이는 상태
    const withFixedSidebar = !isSmallViewport && showChat;

    const setSelectedView = (view: WorkbenchViewType) => {
      workbenchStore.currentView.set(view);
    };

    useEffect(() => {
      if (hasPreview) {
        setSelectedView('preview');
      }
    }, [hasPreview]);

    useEffect(() => {
      workbenchStore.setDocuments(files);
    }, [files]);

    const onEditorChange = useCallback<OnEditorChange>((update) => {
      workbenchStore.setCurrentDocumentContent(update.content);
    }, []);

    const onEditorScroll = useCallback<OnEditorScroll>((position) => {
      workbenchStore.setCurrentDocumentScrollPosition(position);
    }, []);

    const onFileSelect = useCallback((filePath: string | undefined) => {
      workbenchStore.setSelectedFile(filePath);
    }, []);

    const onFileSave = useCallback(() => {
      workbenchStore
        .saveCurrentDocument()
        .then(() => {
          // Explicitly refresh all previews after a file save
          const previewStore = usePreviewStore();
          previewStore.refreshAllPreviews();
        })
        .catch(() => {
          toast.error('Failed to update file content');
        });
    }, []);

    const onFileReset = useCallback(() => {
      workbenchStore.resetCurrentDocument();
    }, []);

    /* 만든 파일을 내 컴퓨터로 저장합니다 (설치 없이 바로 쓸 수 있는 형태) */
    const handleDownloadFiles = useCallback(() => {
      const all = workbenchStore.files.get();
      const targets = Object.keys(all).filter((p) => {
        const f = all[p];
        return f?.type === 'file' && !p.endsWith('server.js');
      });

      if (targets.length === 0) {
        toast.error('내려받을 파일이 없습니다');
        return;
      }

      targets.forEach((p, index) => {
        setTimeout(() => {
          const f = all[p];

          if (f?.type !== 'file') {
            return;
          }

          const name = p.split('/').pop() || 'file.txt';
          const blob = new Blob([f.content], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, index * 400);
      });

      toast.success(`${targets.length}개 파일을 내려받았습니다`);
    }, []);

    /* 초보자에게는 터미널이 혼란스러우므로 기본으로 닫아 둡니다 */
    useEffect(() => {
      workbenchStore.toggleTerminal(false);
    }, []);

    return (
      chatStarted && (
        <motion.div
          initial="closed"
          animate={showWorkbench ? 'open' : 'closed'}
          variants={workbenchVariants}
          custom={withFixedSidebar}
          className="z-workbench"
        >
          <div
            className={classNames(
              'fixed w-[var(--workbench-inner-width)] z-0 transition-[left,width] duration-200 bolt-ease-cubic-bezier',
              {
                /* 휴대폰: 헤더 바로 아래부터 화면 끝까지 덮어서 뒤의 채팅 내용이 안 보이게 합니다 */
                'top-[var(--header-height)] bottom-0 bg-bolt-elements-background-depth-1': isSmallViewport,
                'top-[calc(var(--header-height)+1.2rem)] bottom-6': !isSmallViewport,
                'w-full': isSmallViewport,
                'left-0': showWorkbench && isSmallViewport,
                'left-[var(--workbench-left)]': showWorkbench && !withFixedSidebar,
                'left-[100%]': !showWorkbench,
              },
            )}
            style={
              showWorkbench && withFixedSidebar
                ? {
                    left: 'calc(340px + var(--chat-min-width))',
                    width: 'calc(100% - 340px - var(--chat-min-width))',
                  }
                : undefined
            }
          >
            <div className="absolute inset-0 px-2 lg:px-4">
              <div className="h-full flex flex-col bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor shadow-sm rounded-lg overflow-hidden">
                <div className="flex items-center px-3 py-2 border-b border-bolt-elements-borderColor gap-1.5">
                  {/*
                   * 예전에는 이 버튼이 채팅칸을 숨겨서 코드 화면이 채팅을 가렸습니다.
                   * 이제는 채팅은 그대로 두고, "코드 보기" 와 똑같이 코드 화면(index.html 먼저)을 엽니다.
                   */}
                  <button
                    type="button"
                    title="코드 보기"
                    className="i-ph:code-bold text-lg text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary mr-1"
                    onClick={() => {
                      chatStore.setKey('showChat', true);
                      workbenchStore.currentView.set('code');

                      const allFiles = workbenchStore.files.get();
                      const indexPath = Object.keys(allFiles)
                        .filter((p) => allFiles[p]?.type === 'file' && p.endsWith('/index.html'))
                        .sort((x, y) => x.length - y.length)[0];

                      if (indexPath) {
                        workbenchStore.setSelectedFile(indexPath);
                      }
                    }}
                  />
                  <Slider selected={selectedView} options={sliderOptions} setSelected={setSelectedView} />
                  <div className="ml-auto" />
                  {selectedView === 'code' && (
                    <div className="flex overflow-y-auto">
                      {/* 초보자용: 만든 파일을 내 컴퓨터로 내려받기 */}
                      <button
                        onClick={handleDownloadFiles}
                        title="만든 파일을 내 컴퓨터에 저장합니다"
                        className="rounded-md items-center justify-center px-3 py-1.5 text-xs bg-accent-500 text-white hover:text-bolt-elements-item-contentAccent [&:not(:disabled,.disabled)]:hover:bg-bolt-elements-button-primary-backgroundHover outline-accent-500 flex gap-1.5"
                      >
                        <div className="i-ph:download-simple" />
                        다운로드
                      </button>
                    </div>
                  )}

                  <IconButton
                    icon="i-ph:x-circle"
                    className="-mr-1"
                    size="xl"
                    onClick={() => {
                      workbenchStore.showWorkbench.set(false);
                    }}
                  />
                </div>
                <div className="relative flex-1 overflow-hidden">
                  <View initial={{ x: '0%' }} animate={{ x: selectedView === 'code' ? '0%' : '-100%' }}>
                    <EditorPanel
                      editorDocument={currentDocument}
                      isStreaming={isStreaming}
                      selectedFile={selectedFile}
                      files={files}
                      unsavedFiles={unsavedFiles}
                      fileHistory={fileHistory}
                      onFileSelect={onFileSelect}
                      onEditorScroll={onEditorScroll}
                      onEditorChange={onEditorChange}
                      onFileSave={onFileSave}
                      onFileReset={onFileReset}
                    />
                  </View>
                  <View
                    initial={{ x: '100%' }}
                    animate={{ x: selectedView === 'diff' ? '0%' : selectedView === 'code' ? '100%' : '-100%' }}
                  >
                    <DiffView fileHistory={fileHistory} setFileHistory={setFileHistory} />
                  </View>
                  <View initial={{ x: '100%' }} animate={{ x: selectedView === 'preview' ? '0%' : '100%' }}>
                    <Preview setSelectedElement={setSelectedElement} />
                  </View>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )
    );
  },
);

// View component for rendering content with motion transitions
interface ViewProps extends HTMLMotionProps<'div'> {
  children: JSX.Element;
}

const View = memo(({ children, ...props }: ViewProps) => {
  return (
    <motion.div className="absolute inset-0" transition={viewTransition} {...props}>
      {children}
    </motion.div>
  );
});
