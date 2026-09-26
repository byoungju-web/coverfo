import { motion, type Variants } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { ControlPanel } from '~/components/@settings/core/ControlPanel';
import { Button } from '~/components/ui/Button';
import { db, deleteById, getAll, chatId, type ChatHistoryItem, useChatHistory } from '~/lib/persistence';
import { syncChatsFromCloud } from '~/lib/persistence/cloudSync';
import { cubicEasingFn } from '~/utils/easings';
import { HistoryItem } from './HistoryItem';
import { binDates } from './date-binning';
import { useSearchFilter } from '~/lib/hooks/useSearchFilter';
import { classNames } from '~/utils/classNames';
import { supabase } from '~/lib/supabaseClient';

const menuVariants = {
  closed: {
    opacity: 0,
    visibility: 'hidden',
    left: '-340px',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    opacity: 1,
    visibility: 'initial',
    left: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

/* 사이드바 상단 '스튜디오' — 스튜디오(이미지·영상)에서 최근 만든 것을 썸네일로 보여 줍니다 */
interface StudioItem {
  id: number;
  kind: 'image' | 'video';
  prompt?: string;
  status: string;
  result_url?: string | null;
}

function useStudioRecent(limit = 6) {
  const [items, setItems] = useState<StudioItem[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          return;
        }

        const r = await fetch('/api/gen?list=1', { headers: { Authorization: 'Bearer ' + session.access_token } });

        if (!r.ok) {
          return;
        }

        const j = (await r.json()) as { jobs?: StudioItem[] };
        const done = (j.jobs || []).filter((it) => it.status === 'done' && it.result_url).slice(0, limit);

        if (alive) {
          setItems(done);
        }
      } catch {
        /* 스튜디오 목록은 부가 정보라 실패해도 조용히 넘어갑니다 */
      }
    })();

    return () => {
      alive = false;
    };
  }, [limit]);

  return items;
}

/* 사이드바 '답변 언어' 선택지 (값은 Chat.client 의 ANSWER_LANG_NAMES 와 같아야 합니다) */
const ANSWER_LANG_KEY = 'cf-answer-lang';
const ANSWER_LANGS = [
  { value: 'auto', label: '자동 (질문 언어)' },
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文' },
  { value: 'th', label: 'ไทย' },
];

type DialogContent =
  | { type: 'delete'; item: ChatHistoryItem }
  | { type: 'bulkDelete'; items: ChatHistoryItem[] }
  | null;

function CurrentDateTime() {
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800/50">
      <div className="h-4 w-4 i-ph:clock opacity-80" />
      <div className="flex gap-2">
        <span>{dateTime.toLocaleDateString()}</span>
        <span>{dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
}

export const Menu = () => {
  const { duplicateCurrentChat, exportChat } = useChatHistory();
  const menuRef = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<ChatHistoryItem[]>([]);
  const [open, setOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState<DialogContent>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [footOpen, setFootOpen] = useState(false); // 하단 '설정' 펼침 여부
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // 데스크탑(1024px 이상)에서는 사이드바를 항상 펼쳐 둡니다
  const [isDesktop, setIsDesktop] = useState(false);

  // 사이드바 하단 '답변 언어' — AI 가 어떤 언어로 답할지 (채팅 전송 시 Chat.client 가 읽습니다)
  const [answerLang, setAnswerLang] = useState<string>(() => {
    try {
      return (typeof window !== 'undefined' && window.localStorage.getItem(ANSWER_LANG_KEY)) || 'auto';
    } catch {
      return 'auto';
    }
  });

  // 홈화면 사이드바의 '설정' 은 /chat?settings=1 로 들어옵니다 → 설정 창을 바로 엽니다
  useEffect(() => {
    try {
      const url = new URL(window.location.href);

      if (url.searchParams.get('settings') === '1') {
        setIsSettingsOpen(true);
        url.searchParams.delete('settings');
        window.history.replaceState(window.history.state, '', url.toString());
      }
    } catch {
      // 주소를 읽지 못하면 아무것도 하지 않습니다
    }
  }, []);

  const handleAnswerLangChange = (value: string) => {
    setAnswerLang(value);

    try {
      window.localStorage.setItem(ANSWER_LANG_KEY, value);
    } catch {
      // 저장이 안 되는 브라우저(사생활 보호 모드 등)에서는 이번 화면에서만 적용됩니다
    }

    const label = ANSWER_LANGS.find((l) => l.value === value)?.label || value;
    toast.success(`답변 언어: ${label}`);
  };

  const { filteredItems: filteredList, handleSearchChange } = useSearchFilter({
    items: list,
    searchFields: ['description'],
  });
  const studioItems = useStudioRecent(6);

  const loadEntries = useCallback(() => {
    if (db) {
      getAll(db)
        .then((list) => list.filter((item) => item.urlId && item.description))
        .then(setList)
        .catch((error) => toast.error(error.message));
    }
  }, []);

  const deleteChat = useCallback(
    async (id: string): Promise<void> => {
      if (!db) {
        throw new Error('Database not available');
      }

      // Delete chat snapshot from localStorage
      try {
        const snapshotKey = `snapshot:${id}`;
        localStorage.removeItem(snapshotKey);
        console.log('Removed snapshot for chat:', id);
      } catch (snapshotError) {
        console.error(`Error deleting snapshot for chat ${id}:`, snapshotError);
      }

      // Delete the chat from the database
      await deleteById(db, id);
      console.log('Successfully deleted chat:', id);
    },
    [db],
  );

  const deleteItem = useCallback(
    (event: React.UIEvent, item: ChatHistoryItem) => {
      event.preventDefault();
      event.stopPropagation();

      // Log the delete operation to help debugging
      console.log('Attempting to delete chat:', { id: item.id, description: item.description });

      deleteChat(item.id)
        .then(() => {
          toast.success('대화를 삭제했습니다', {
            position: 'bottom-right',
            autoClose: 3000,
          });

          // Always refresh the list
          loadEntries();

          if (chatId.get() === item.id) {
            // hard page navigation to clear the stores
            console.log('Navigating away from deleted chat');
            window.location.pathname = '/';
          }
        })
        .catch((error) => {
          console.error('Failed to delete chat:', error);
          toast.error('대화 삭제에 실패했습니다', {
            position: 'bottom-right',
            autoClose: 3000,
          });

          // Still try to reload entries in case data has changed
          loadEntries();
        });
    },
    [loadEntries, deleteChat],
  );

  const deleteSelectedItems = useCallback(
    async (itemsToDeleteIds: string[]) => {
      if (!db || itemsToDeleteIds.length === 0) {
        console.log('Bulk delete skipped: No DB or no items to delete.');
        return;
      }

      console.log(`Starting bulk delete for ${itemsToDeleteIds.length} chats`, itemsToDeleteIds);

      let deletedCount = 0;
      const errors: string[] = [];
      const currentChatId = chatId.get();
      let shouldNavigate = false;

      // Process deletions sequentially using the shared deleteChat logic
      for (const id of itemsToDeleteIds) {
        try {
          await deleteChat(id);
          deletedCount++;

          if (id === currentChatId) {
            shouldNavigate = true;
          }
        } catch (error) {
          console.error(`Error deleting chat ${id}:`, error);
          errors.push(id);
        }
      }

      // Show appropriate toast message
      if (errors.length === 0) {
        toast.success(`대화 ${deletedCount}개를 삭제했습니다`);
      } else {
        toast.warning(`${itemsToDeleteIds.length}개 중 ${deletedCount}개 삭제, ${errors.length}개 실패`, {
          autoClose: 5000,
        });
      }

      // Reload the list after all deletions
      await loadEntries();

      // Clear selection state
      setSelectedItems([]);
      setSelectionMode(false);

      // Navigate if needed
      if (shouldNavigate) {
        console.log('Navigating away from deleted chat');
        window.location.pathname = '/';
      }
    },
    [deleteChat, loadEntries, db],
  );

  const closeDialog = () => {
    setDialogContent(null);
  };

  const toggleItemSelection = useCallback((id: string) => {
    setSelectedItems((prev) => {
      const newSelectedItems = prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id];
      console.log('Selected items updated:', newSelectedItems);

      return newSelectedItems; // Return the new array
    });
  }, []); // No dependencies needed

  const handleBulkDeleteClick = useCallback(() => {
    if (selectedItems.length === 0) {
      toast.info('삭제할 대화를 하나 이상 선택해 주세요');
      return;
    }

    const selectedChats = list.filter((item) => selectedItems.includes(item.id));

    if (selectedChats.length === 0) {
      toast.error('선택한 대화를 찾지 못했습니다');
      return;
    }

    setDialogContent({ type: 'bulkDelete', items: selectedChats });
  }, [selectedItems, list]); // Keep list dependency

  const selectAll = useCallback(() => {
    const allFilteredIds = filteredList.map((item) => item.id);
    setSelectedItems((prev) => {
      const allFilteredAreSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => prev.includes(id));

      if (allFilteredAreSelected) {
        // Deselect only the filtered items
        const newSelectedItems = prev.filter((id) => !allFilteredIds.includes(id));
        console.log('Deselecting all filtered items. New selection:', newSelectedItems);

        return newSelectedItems;
      } else {
        // Select all filtered items, adding them to any existing selections
        const newSelectedItems = [...new Set([...prev, ...allFilteredIds])];
        console.log('Selecting all filtered items. New selection:', newSelectedItems);

        return newSelectedItems;
      }
    });
  }, [filteredList]); // Depends only on filteredList

  useEffect(() => {
    if (open) {
      loadEntries();
    }
  }, [open, loadEntries]);

  /*
   * 기기 간 대화 목록 연동: 사이드바가 열릴 때, 그리고 이 화면으로 다시 돌아왔을 때(15초에 한 번까지)
   * Supabase 에서 다른 기기의 대화를 받아와 목록을 새로 그립니다. 로그인하지 않았으면 아무 일도 하지 않습니다.
   */
  useEffect(() => {
    const database = db;

    if (!database || typeof window === 'undefined') {
      return undefined;
    }

    let lastRun = 0;
    let cancelled = false;

    const runSync = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      const now = Date.now();

      if (now - lastRun < 15000) {
        return;
      }

      lastRun = now;
      syncChatsFromCloud(database)
        .then((changed) => {
          if (changed && !cancelled) {
            loadEntries();
          }
        })
        .catch(() => undefined);
    };

    if (open) {
      runSync();
    }

    window.addEventListener('focus', runSync);
    document.addEventListener('visibilitychange', runSync);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', runSync);
      document.removeEventListener('visibilitychange', runSync);
    };
  }, [open, loadEntries]);

  // Exit selection mode when sidebar is closed
  useEffect(() => {
    if (!open && selectionMode) {
      /*
       * Don't clear selection state anymore when sidebar closes
       * This allows the selection to persist when reopening the sidebar
       */
      console.log('Sidebar closed, preserving selection state');
    }
  }, [open, selectionMode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const updateIsDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    updateIsDesktop();
    window.addEventListener('resize', updateIsDesktop);

    return () => window.removeEventListener('resize', updateIsDesktop);
  }, []);

  useEffect(() => {
    if (isDesktop) {
      setOpen(true);
    }
  }, [isDesktop]);

  useEffect(() => {
    const enterThreshold = 20;
    const exitThreshold = 20;

    function onMouseMove(event: MouseEvent) {
      if (isSettingsOpen || isDesktop) {
        return;
      }

      if (event.pageX < enterThreshold) {
        setOpen(true);
      }

      if (menuRef.current && event.clientX > menuRef.current.getBoundingClientRect().right + exitThreshold) {
        setOpen(false);
      }
    }

    window.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [isSettingsOpen, isDesktop]);

  /*
   * 마우스를 왼쪽 끝에 대는 방법 외에 버튼으로도 열 수 있게 합니다.
   * 홈화면 메뉴 버튼은 /chat?menu=1 로 들어오고, 화면 안에서는 coverfo:toggle-sidebar 이벤트로 엽니다.
   */
  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const params = new URLSearchParams(window.location.search);

    if (params.get('menu') === '1') {
      setOpen(true);
      params.delete('menu');

      const rest = params.toString();
      const next = window.location.pathname + (rest ? `?${rest}` : '');
      window.history.replaceState({}, '', next);
    }

    function onToggle() {
      setOpen((v) => !v);
    }

    function onOpen() {
      setOpen(true);
    }

    function onClose() {
      setOpen(false);
    }

    window.addEventListener('coverfo:toggle-sidebar', onToggle);
    window.addEventListener('coverfo:open-sidebar', onOpen);
    window.addEventListener('coverfo:close-sidebar', onClose);

    return () => {
      window.removeEventListener('coverfo:toggle-sidebar', onToggle);
      window.removeEventListener('coverfo:open-sidebar', onOpen);
      window.removeEventListener('coverfo:close-sidebar', onClose);
    };
  }, []);

  const handleDuplicate = async (id: string) => {
    await duplicateCurrentChat(id);
    loadEntries(); // Reload the list after duplication
  };

  const handleSettingsClick = () => {
    setIsSettingsOpen(true);
    setOpen(false);
  };

  const handleSettingsClose = () => {
    setIsSettingsOpen(false);

    if (isDesktop) {
      setOpen(true);
    }
  };

  const setDialogContentWithLogging = useCallback((content: DialogContent) => {
    console.log('Setting dialog content:', content);
    setDialogContent(content);
  }, []);

  /* 휴대폰: 대화 목록을 꾹 누르면(0.6초) 삭제 확인 창을 띄웁니다 */
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const touchingRef = useRef(false);

  const cancelLongPress = () => {
    touchingRef.current = false;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const startLongPress = (item: ChatHistoryItem) => {
    if (selectionMode) {
      return;
    }

    cancelLongPress();
    touchingRef.current = true;
    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      longPressTimerRef.current = null;

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(30);
      }

      setDialogContentWithLogging({ type: 'delete', item });
    }, 600);
  };

  return (
    <>
      <motion.div
        ref={menuRef}
        initial="closed"
        animate={open ? 'open' : 'closed'}
        variants={menuVariants}
        style={{ width: '340px', height: '100dvh' }}
        className={classNames(
          'flex selection-accent flex-col side-menu fixed top-0 h-full rounded-r-2xl',
          'bg-white dark:bg-gray-950 border-r border-bolt-elements-borderColor',
          'shadow-sm text-sm',
          isSettingsOpen ? 'z-40' : 'z-sidebar',
        )}
      >
        <div className="h-12 flex items-center justify-between px-4 border-b border-gray-100 dark:border-gray-800/50 bg-gray-50/50 dark:bg-gray-900/50 rounded-tr-2xl">
          <div className="text-gray-900 dark:text-white font-medium"></div>
        </div>
        <div className="flex-1 min-h-0 flex flex-col w-full overflow-y-auto overflow-x-hidden modern-scrollbar">
          <div className="p-4 space-y-3">
            <div className="flex gap-2">
              <a
                href="/"
                className="flex-1 flex gap-2 items-center bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/20 rounded-lg px-4 py-2 transition-colors"
              >
                <span className="inline-block i-ph:plus-circle h-4 w-4" />
                <span className="text-sm font-medium">새 대화 시작</span>
              </a>
              <a
                href="/studio"
                title="이미지·영상 만들기"
                className="flex gap-1.5 items-center bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 transition-colors"
              >
                <span className="i-ph:palette h-4 w-4" />
                <span className="text-sm font-medium">스튜디오</span>
              </a>
              {/* coverfo: '여러 개 선택' 버튼 자리에 엔진(앱·3D·영상) 바로가기 — 엔진 화면의 "최근 만든 것"이 작업 목록입니다 */}
              <a
                href="/engine"
                title="coverfo 엔진 — 앱 · 3D (작업 목록)"
                className="flex gap-1.5 items-center bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 transition-colors whitespace-nowrap"
              >
                <span aria-hidden="true">🧊</span>
                <span className="text-sm font-medium">coverfo 엔진</span>
              </a>
            </div>
            <div className="relative w-full">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <span className="i-ph:magnifying-glass h-4 w-4 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                className="w-full bg-gray-50 dark:bg-gray-900 relative pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-800"
                type="search"
                placeholder="대화 검색..."
                onChange={handleSearchChange}
                aria-label="대화 검색"
              />
            </div>
          </div>
          {studioItems.length > 0 && (
            <div className="px-4 pb-2">
              <div className="flex items-center justify-between text-sm py-1">
                <div className="font-medium text-gray-600 dark:text-gray-400">최근 이미지 · 영상</div>
                <a href="/studio" className="text-xs text-purple-600 dark:text-purple-300 hover:underline">
                  스튜디오 열기
                </a>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {studioItems.map((it) => (
                  <a
                    key={it.id}
                    href={`/studio?show=${it.id}`}
                    title={it.prompt || ''}
                    className="relative block aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                  >
                    {it.kind === 'video' ? (
                      <video src={it.result_url || ''} crossOrigin="anonymous" muted playsInline preload="metadata" className="w-full h-full object-cover" />
                    ) : (
                      <img src={it.result_url || ''} crossOrigin="anonymous" alt="" loading="lazy" className="w-full h-full object-cover" />
                    )}
                    <span className="absolute bottom-0.5 right-0.5 text-[10px] leading-none px-1 py-0.5 rounded bg-black/60 text-white">
                      {it.kind === 'video' ? '영상' : '이미지'}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between text-sm px-4 py-2">
            <div className="font-medium text-gray-600 dark:text-gray-400">내 대화</div>
            {selectionMode && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  {selectedItems.length === filteredList.length ? '전체 해제' : '전체 선택'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDeleteClick}
                  disabled={selectedItems.length === 0}
                >
                  선택 삭제
                </Button>
              </div>
            )}
          </div>
          <div className="px-3 pb-3">
            {filteredList.length === 0 && (
              <div className="px-4 text-gray-500 dark:text-gray-400 text-sm">
                {list.length === 0 ? '아직 대화가 없습니다' : '찾는 대화가 없습니다'}
              </div>
            )}
            <DialogRoot open={dialogContent !== null}>
              {binDates(filteredList).map(({ category, items }) => (
                <div key={category} className="mt-2 first:mt-0 space-y-1">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 sticky top-0 z-1 bg-white dark:bg-gray-950 px-4 py-1">
                    {category}
                  </div>
                  <div className="space-y-0.5 pr-1">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="select-none [-webkit-touch-callout:none]"
                        onTouchStart={() => startLongPress(item)}
                        onTouchEnd={cancelLongPress}
                        onTouchMove={cancelLongPress}
                        onTouchCancel={cancelLongPress}
                        onContextMenu={(event) => {
                          // 휴대폰에서 꾹 누를 때 뜨는 브라우저 메뉴는 막습니다 (마우스 오른쪽 클릭은 그대로)
                          if (touchingRef.current) {
                            event.preventDefault();
                          }
                        }}
                        onClickCapture={(event) => {
                          // 꾹 눌러서 삭제 창을 띄웠을 때는 그 대화로 이동하지 않게 합니다
                          if (longPressFiredRef.current) {
                            event.preventDefault();
                            event.stopPropagation();
                            longPressFiredRef.current = false;
                          }
                        }}
                      >
                        <HistoryItem
                          item={item}
                          exportChat={exportChat}
                          onDelete={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            console.log('Delete triggered for item:', item);
                            setDialogContentWithLogging({ type: 'delete', item });
                          }}
                          onDuplicate={() => handleDuplicate(item.id)}
                          selectionMode={selectionMode}
                          isSelected={selectedItems.includes(item.id)}
                          onToggleSelection={toggleItemSelection}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <Dialog onBackdrop={closeDialog} onClose={closeDialog}>
                {dialogContent?.type === 'delete' && (
                  <>
                    <div className="p-6 bg-white dark:bg-gray-950">
                      <DialogTitle className="text-gray-900 dark:text-white">대화를 삭제할까요?</DialogTitle>
                      <DialogDescription className="mt-2 text-gray-600 dark:text-gray-400">
                        <p>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {dialogContent.item.description}
                          </span>{' '}
                          대화를 삭제합니다.
                        </p>
                        <p className="mt-2">삭제하면 되돌릴 수 없습니다. 정말 삭제할까요?</p>
                      </DialogDescription>
                    </div>
                    <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
                      <DialogButton type="secondary" onClick={closeDialog}>
                        취소
                      </DialogButton>
                      <DialogButton
                        type="danger"
                        onClick={(event) => {
                          console.log('Dialog delete button clicked for item:', dialogContent.item);
                          deleteItem(event, dialogContent.item);
                          closeDialog();
                        }}
                      >
                        삭제
                      </DialogButton>
                    </div>
                  </>
                )}
                {dialogContent?.type === 'bulkDelete' && (
                  <>
                    <div className="p-6 bg-white dark:bg-gray-950">
                      <DialogTitle className="text-gray-900 dark:text-white">선택한 대화를 삭제할까요?</DialogTitle>
                      <DialogDescription className="mt-2 text-gray-600 dark:text-gray-400">
                        <p>대화 {dialogContent.items.length}개를 삭제합니다:</p>
                        <div className="mt-2 max-h-32 overflow-auto border border-gray-100 dark:border-gray-800 rounded-md bg-gray-50 dark:bg-gray-900 p-2">
                          <ul className="list-disc pl-5 space-y-1">
                            {dialogContent.items.map((item) => (
                              <li key={item.id} className="text-sm">
                                <span className="font-medium text-gray-900 dark:text-white">{item.description}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <p className="mt-3">삭제하면 되돌릴 수 없습니다. 정말 삭제할까요?</p>
                      </DialogDescription>
                    </div>
                    <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
                      <DialogButton type="secondary" onClick={closeDialog}>
                        취소
                      </DialogButton>
                      <DialogButton
                        type="danger"
                        onClick={() => {
                          /*
                           * Pass the current selectedItems to the delete function.
                           * This captures the state at the moment the user confirms.
                           */
                          const itemsToDeleteNow = [...selectedItems];
                          console.log('Bulk delete confirmed for', itemsToDeleteNow.length, 'items', itemsToDeleteNow);
                          deleteSelectedItems(itemsToDeleteNow);
                          closeDialog();
                        }}
                      >
                        삭제
                      </DialogButton>
                    </div>
                  </>
                )}
              </Dialog>
            </DialogRoot>
          </div>
        </div>
        {/* 사이드바 하단 메뉴 — 목록 스크롤 밖에 두어 항상 보입니다 (홈 화면 사이드바와 동일) */}
        <div className="border-t border-gray-200 dark:border-gray-800 px-3 py-2 space-y-0.5 text-sm text-gray-700 dark:text-gray-300 shrink-0 bg-white dark:bg-gray-950 rounded-br-2xl">
            <button
              type="button"
              onClick={() => setFootOpen((v) => !v)}
              className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-expanded={footOpen}
            >
              <span className="i-ph:gear-six h-4 w-4 shrink-0" />
              <span>설정</span>
            </button>
            {footOpen && (
              <div className="pl-3 space-y-0.5">
                <button
                  type="button"
                  onClick={handleSettingsClick}
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="i-ph:key h-4 w-4 shrink-0" />
                  <span>API 키 · 모델</span>
                  <span className="ml-auto i-ph:caret-right h-3.5 w-3.5 text-gray-400" />
                </button>
                <label className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer">
                  <span className="i-ph:globe h-4 w-4 shrink-0" />
                  <span>답변 언어</span>
                  <select
                    value={answerLang}
                    onChange={(event) => handleAnswerLangChange(event.target.value)}
                    className="ml-auto bg-transparent text-xs text-gray-600 dark:text-gray-300 focus:outline-none cursor-pointer"
                    aria-label="답변 언어"
                  >
                    {ANSWER_LANGS.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
                <a
                  href="/pricing"
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="i-ph:credit-card h-4 w-4 shrink-0" />
                  <span>이용료 · 요금제</span>
                  <span className="ml-auto i-ph:caret-right h-3.5 w-3.5 text-gray-400" />
                </a>
                <div className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2">
                  <span className="i-ph:moon h-4 w-4 shrink-0" />
                  <span>화면 모드</span>
                  <div className="ml-auto">
                    <ThemeSwitch />
                  </div>
                </div>
              </div>
            )}
        </div>
      </motion.div>

      <ControlPanel open={isSettingsOpen} onClose={handleSettingsClose} />
    </>
  );
};
