import { useStore } from '@nanostores/react';
import { AnimatePresence, motion } from 'framer-motion';
import { computed } from 'nanostores';
import { memo, useEffect, useRef, useState } from 'react';
import type { ActionState } from '~/lib/runtime/action-runner';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { WORK_DIR } from '~/utils/constants';

interface ArtifactProps {
  messageId: string;
  artifactId: string;
}

export const Artifact = memo(({ artifactId }: ArtifactProps) => {
  const userToggledActions = useRef(false);
  const [showActions, setShowActions] = useState(false);
  const [allActionFinished, setAllActionFinished] = useState(false);

  const artifacts = useStore(workbenchStore.artifacts);
  const artifact = artifacts[artifactId];

  const actions = useStore(
    computed(artifact.runner.actions, (actions) => {
      // Filter out Supabase actions except for migrations
      return Object.values(actions).filter((action) => {
        // Exclude actions with type 'supabase' or actions that contain 'supabase' in their content
        return action.type !== 'supabase' && !(action.type === 'shell' && action.content?.includes('supabase'));
      });
    }),
  );

  /* 모바일에서는 코드 화면이 자동으로 덮지 않게 하고, 쉬운 진행 화면을 먼저 보여줍니다 */
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const isMobile = window.innerWidth < 1024;

    if (isMobile && actions.length > 0) {
      workbenchStore.showWorkbench.set(false);
    }

    workbenchStore.currentView.set('preview');
  }, [actions.length]);

  useEffect(() => {
    if (actions.length && !showActions && !userToggledActions.current) {
      setShowActions(true);
    }

    if (actions.length !== 0 && artifact.type === 'bundled') {
      const finished = !actions.find(
        (action) => action.status !== 'complete' && !(action.type === 'start' && action.status === 'running'),
      );

      if (allActionFinished !== finished) {
        setAllActionFinished(finished);
      }
    }
  }, [actions, artifact.type, allActionFinished]);

  // Determine the dynamic title based on state for bundled artifacts
  const dynamicTitle =
    artifact?.type === 'bundled'
      ? allActionFinished
        ? artifact.id === 'restored-project-setup'
          ? '복구 완료' // Title when restore is complete
          : '앱을 다 만들었어요 🎉' // Title when initial creation is complete
        : artifact.id === 'restored-project-setup'
          ? '복구하는 중...' // Title during restore
          : '앱을 만들고 있어요...' // Title during initial creation
      : artifact?.title; // Fallback to original title for non-bundled or if artifact is missing

  return (
    <>
      <div className="artifact border border-bolt-elements-borderColor flex flex-col overflow-hidden rounded-lg w-full transition-border duration-150">
        <div className="flex">
          <button
            className="flex items-stretch bg-bolt-elements-artifacts-background hover:bg-bolt-elements-artifacts-backgroundHover w-full overflow-hidden"
            onClick={() => {
              const showWorkbench = workbenchStore.showWorkbench.get();
              workbenchStore.showWorkbench.set(!showWorkbench);
            }}
          >
            <div className="px-5 p-3.5 w-full text-left">
              <div className="w-full text-bolt-elements-textPrimary font-medium leading-5 text-sm">
                {/* Use the dynamic title here */}
                {dynamicTitle}
              </div>
              <div className="w-full text-bolt-elements-textSecondary text-xs mt-0.5">눌러서 만드는 과정 보기</div>
            </div>
          </button>
        </div>
        {artifact.type === 'bundled' && (
          <div className="flex items-center gap-1.5 p-5 bg-bolt-elements-actions-background border-t border-bolt-elements-artifacts-borderColor">
            <div className={classNames('text-lg', getIconColor(allActionFinished ? 'complete' : 'running'))}>
              {allActionFinished ? (
                <div className="i-ph:check"></div>
              ) : (
                <div className="i-svg-spinners:90-ring-with-bg"></div>
              )}
            </div>
            <div className="text-bolt-elements-textPrimary font-medium leading-5 text-sm">
              {/* This status text remains the same */}
              {allActionFinished
                ? artifact.id === 'restored-project-setup'
                  ? '저장된 파일을 되돌렸어요'
                  : '기본 파일을 다 만들었어요'
                : '기본 파일을 만드는 중이에요'}
            </div>
          </div>
        )}
        <AnimatePresence>
          {artifact.type !== 'bundled' && showActions && actions.length > 0 && (
            <motion.div
              className="actions"
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: '0px' }}
              transition={{ duration: 0.15 }}
            >
              <div className="bg-bolt-elements-artifacts-borderColor h-[1px]" />

              <div className="p-5 text-left bg-bolt-elements-actions-background">
                <ActionList actions={actions} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
});

interface ActionListProps {
  actions: ActionState[];
}

const actionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function openArtifactInWorkbench(filePath: any) {
  if (workbenchStore.currentView.get() !== 'code') {
    workbenchStore.currentView.set('code');
  }

  workbenchStore.setSelectedFile(`${WORK_DIR}/${filePath}`);
}

/* 초보자용: 기술 용어를 한국어 설명으로 바꿔주는 표 */
function friendlyLabel(action: ActionState): { icon: string; title: string; desc: string } {
  const type = action.type;
  const content = (action as any).content || '';
  const filePath = (action as any).filePath || '';

  if (type === 'file') {
    const f = String(filePath).toLowerCase();

    if (f.endsWith('package.json')) {
      return { icon: '📦', title: '프로젝트 설정 만드는 중', desc: '앱에 필요한 준비물 목록을 적고 있어요' };
    }

    if (f.endsWith('index.html')) {
      return { icon: '📄', title: '화면 뼈대 만드는 중', desc: '사람들이 보게 될 페이지를 만들고 있어요' };
    }

    if (f.endsWith('.css')) {
      return { icon: '🎨', title: '디자인 입히는 중', desc: '색상과 모양을 예쁘게 꾸미고 있어요' };
    }

    if (f.endsWith('.js') || f.endsWith('.jsx') || f.endsWith('.ts') || f.endsWith('.tsx')) {
      if (f.includes('scene') || f.includes('three') || f.includes('sculpture') || f.includes('model')) {
        return { icon: '🧊', title: '3D 화면 만드는 중', desc: '모양과 빛을 화면에 배치하고 있어요' };
      }

      if (f.includes('main') || f.includes('index') || f.includes('app')) {
        return { icon: '🔗', title: '전체 연결하는 중', desc: '만든 조각들을 하나로 이어 붙이고 있어요' };
      }

      return { icon: '⚙️', title: '동작 코드 만드는 중', desc: '화면이 제대로 작동하도록 코드를 쓰고 있어요' };
    }

    return { icon: '📝', title: '파일 만드는 중', desc: String(filePath) };
  }

  if (type === 'shell') {
    if (content.includes('install')) {
      return { icon: '📥', title: '필요한 부품 받는 중', desc: '조금 오래 걸릴 수 있어요. 잠시만 기다려 주세요' };
    }

    if (content.includes('node ') || content.includes('serve')) {
      return { icon: '🚀', title: '화면 띄우는 중', desc: '곧 오른쪽에 결과가 나타납니다' };
    }

    return { icon: '🔧', title: '준비 작업 중', desc: '앱이 돌아갈 수 있게 설정하고 있어요' };
  }

  if (type === 'start') {
    if (action.status === 'running') {
      return { icon: '🚀', title: '앱이 켜졌어요', desc: '옆에 보이는 화면이 완성된 결과입니다' };
    }

    return { icon: '🚀', title: '앱 켜는 중', desc: '거의 다 됐어요. 곧 화면이 나타납니다' };
  }

  return { icon: '•', title: '작업 중', desc: '' };
}

/* dev 서버는 계속 켜져 있으므로 'start' 가 running 이면 실제로는 '실행됨' 입니다 */
function effectiveStatus(action: ActionState): ActionState['status'] {
  if (action.type === 'start' && action.status === 'running') {
    return 'complete';
  }

  return action.status;
}

function statusText(status: ActionState['status']) {
  switch (status) {
    case 'pending':
      return '대기 중';
    case 'running':
      return '진행 중';
    case 'complete':
      return '완료';
    case 'failed':
      return '실패';
    case 'aborted':
      return '멈춤';
    default:
      return '';
  }
}

const ActionList = memo(({ actions }: ActionListProps) => {
  const [stuckSeconds, setStuckSeconds] = useState(0);

  const total = actions.length;
  const doneCount = actions.filter((a) => effectiveStatus(a) === 'complete').length;
  const failed = actions.some((a) => a.status === 'failed' || a.status === 'aborted');
  const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  const stillWorking = doneCount < total && !failed;

  /* 대기 중인 단계는 맨 앞 하나만 보여 줍니다 */
  const firstPending = actions.findIndex((a) => effectiveStatus(a) === 'pending');
  const visibleActions = firstPending === -1 ? actions : actions.slice(0, firstPending);

  /* 같은 단계에서 오래 멈춰 있으면 안내 문구를 띄웁니다 */
  useEffect(() => {
    if (!stillWorking) {
      setStuckSeconds(0);
      return undefined;
    }

    const t = setInterval(() => {
      setStuckSeconds((v) => v + 5);
    }, 5000);

    return () => clearInterval(t);
  }, [stillWorking, doneCount]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      {/* 진행률 막대 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-semibold text-bolt-elements-textPrimary">
            {failed ? '문제가 생겼어요' : doneCount === total ? '다 만들었어요! 🎉' : '만드는 중이에요...'}
          </span>
          <span className="text-xs text-bolt-elements-textSecondary tabular-nums">
            {doneCount} / {total} 단계
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-bolt-elements-background-depth-3 overflow-hidden">
          <motion.div
            className={classNames('h-full rounded-full', failed ? 'bg-red-400' : 'bg-green-400')}
            initial={{ width: 0 }}
            animate={{ width: percent + '%' }}
            transition={{ duration: 0.4, ease: cubicEasingFn }}
          />
        </div>
      </div>

      {/* 단계별 설명 — 아직 시작 안 한 단계는 숨겨서 하나씩 차례로 나타나게 합니다 */}
      <ul className="list-none space-y-2">
        {visibleActions.map((action, index) => {
          const { type } = action;
          const rawStatus = effectiveStatus(action);
          const timedOut = rawStatus === 'running' && stuckSeconds >= 180;
          const status = timedOut ? 'aborted' : rawStatus;
          const info = friendlyLabel(action);
          const isRunning = status === 'running';
          const isDone = status === 'complete';
          const isBad = status === 'failed' || status === 'aborted';

          return (
            <motion.li
              key={index}
              variants={actionVariants}
              initial="hidden"
              animate="visible"
              transition={{ duration: 0.2, ease: cubicEasingFn }}
            >
              <div
                className={classNames(
                  'flex items-start gap-3 rounded-lg px-3 py-2.5 transition',
                  isRunning ? 'bg-bolt-elements-background-depth-3' : 'bg-transparent',
                )}
              >
                {/* 왼쪽 상태 아이콘 */}
                <div className="mt-0.5 shrink-0 w-6 h-6 grid place-items-center">
                  {isRunning ? (
                    <div className="i-svg-spinners:90-ring-with-bg text-lg text-bolt-elements-loader-progress" />
                  ) : isDone ? (
                    <div className="w-5 h-5 rounded-full bg-green-400/20 grid place-items-center">
                      <div className="i-ph:check-bold text-xs text-green-500" />
                    </div>
                  ) : isBad ? (
                    <div className="w-5 h-5 rounded-full bg-red-400/20 grid place-items-center">
                      <div className="i-ph:x-bold text-xs text-red-500" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-bolt-elements-borderColor" />
                  )}
                </div>

                {/* 본문 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base leading-none">{info.icon}</span>
                    <span
                      className={classNames(
                        'text-sm font-medium',
                        isDone ? 'text-bolt-elements-textSecondary' : 'text-bolt-elements-textPrimary',
                      )}
                    >
                      {info.title}
                    </span>
                    <span
                      className={classNames(
                        'text-[10px] px-1.5 py-0.5 rounded-full shrink-0',
                        isRunning
                          ? 'bg-blue-400/15 text-blue-500'
                          : isDone
                            ? 'bg-green-400/15 text-green-600'
                            : isBad
                              ? 'bg-red-400/15 text-red-500'
                              : 'bg-bolt-elements-background-depth-3 text-bolt-elements-textTertiary',
                      )}
                    >
                      {statusText(status)}
                    </span>
                  </div>
                  {info.desc && (
                    <div className="text-xs text-bolt-elements-textSecondary mt-0.5 break-words">{info.desc}</div>
                  )}
                  {type === 'file' && (action as any).filePath && (
                    <code
                      className="inline-block mt-1 text-[11px] text-bolt-elements-textTertiary hover:underline cursor-pointer break-all"
                      onClick={() => openArtifactInWorkbench((action as any).filePath)}
                    >
                      {(action as any).filePath}
                    </code>
                  )}
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>

      {/* 오래 걸릴 때 안내 */}
      {stuckSeconds >= 60 && stillWorking && (
        <div className="mt-3 rounded-lg border border-amber-300/50 bg-amber-50/60 dark:bg-amber-500/10 px-3.5 py-3">
          <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            {stuckSeconds >= 150 ? '⚠️ 생각보다 오래 걸리고 있어요' : '⏳ 조금 더 걸리고 있어요'}
          </div>
          <div className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-1 leading-relaxed">
            {stuckSeconds >= 150 ? (
              <>
                이 단계에서 멈춘 것 같습니다. 아래 입력칸에{' '}
                <b>&ldquo;설치 없이 index.html 한 파일로만 다시 만들어줘&rdquo;</b> 라고 적어 보내 주세요.
              </>
            ) : (
              <>부품을 받아오는 중입니다. 보통 1~2분 정도 걸려요. 화면을 닫지 말고 기다려 주세요.</>
            )}
          </div>
        </div>
      )}

      {/* 완료 안내 */}
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        {doneCount === total && total > 0 && !failed ? (
          <button
            className="text-sm font-medium px-3.5 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition"
            onClick={() => {
              workbenchStore.currentView.set('preview');
              workbenchStore.showWorkbench.set(true);
            }}
          >
            👀 결과 화면 보기
          </button>
        ) : failed ? (
          <span className="text-xs text-red-500">
            문제가 생겼어요. 아래 입력칸에 &ldquo;다시 해줘&rdquo; 라고 보내 주세요.
          </span>
        ) : (
          <span className="text-xs text-bolt-elements-textTertiary">완료되면 결과 화면이 나타납니다</span>
        )}

        {/* 코드·화면 패널 열기 (언제든지) */}
        <button
          className="text-sm font-medium px-3 py-2 rounded-lg border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 transition"
          onClick={() => {
            workbenchStore.showWorkbench.set(true);
            workbenchStore.currentView.set('code');
          }}
        >
          🖥️ 코드 보기
        </button>
      </div>
    </motion.div>
  );
});

function getIconColor(status: ActionState['status']) {
  switch (status) {
    case 'pending': {
      return 'text-bolt-elements-textTertiary';
    }
    case 'running': {
      return 'text-bolt-elements-loader-progress';
    }
    case 'complete': {
      return 'text-bolt-elements-icon-success';
    }
    case 'aborted': {
      return 'text-bolt-elements-textSecondary';
    }
    case 'failed': {
      return 'text-bolt-elements-icon-error';
    }
    default: {
      return undefined;
    }
  }
}
