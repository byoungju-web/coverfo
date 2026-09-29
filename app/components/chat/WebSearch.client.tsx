import { useState, useRef, useEffect } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { supabase } from '~/lib/supabaseClient'; // coverfo Brave: 로그인 토큰

interface WebSearchProps {
  onSearchResult: (result: string) => void;
  disabled?: boolean;
}

interface WebSearchData {
  title: string;
  description: string;
  content: string;
  sourceUrl: string;
}

interface WebSearchResponse {
  success: boolean;
  data?: WebSearchData;
  error?: string;
}

function formatSearchResult(data: WebSearchData): string {
  const parts: string[] = [`[Web content from ${data.sourceUrl}]`];

  if (data.title) {
    parts.push(`Title: ${data.title}`);
  }

  if (data.description) {
    parts.push(`Description: ${data.description}`);
  }

  parts.push('', data.content);

  return parts.join('\n');
}

export function WebSearch({ onSearchResult, disabled = false }: WebSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  /* coverfo Brave (A 방식): 주소(http…)가 아니면 검색어로 보고 /api/brave-search 로 검색합니다 */
  const isUrlLike = (s: string) => /^https?:\/\//i.test(s) || /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s);

  const handleBraveSearch = async (q: string) => {
    let token = '';

    try {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token || '';
    } catch {
      token = '';
    }

    if (!token) {
      throw new Error('로그인이 필요합니다');
    }

    const response = await fetch('/api/brave-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ q, count: 8 }),
    });
    const result = (await response.json()) as { success?: boolean; text?: string; results?: any[]; error?: string };

    if (!response.ok || !result.success || !result.text) {
      throw new Error(result.error || '검색에 실패했습니다');
    }

    if (!result.results || result.results.length === 0) {
      throw new Error('검색 결과가 없습니다');
    }

    onSearchResult(result.text);
    toast.success(`웹 검색 결과 ${result.results.length}건을 붙였습니다`);
  };

  const handleFetch = async () => {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      return;
    }

    setIsSearching(true);

    try {
      if (!isUrlLike(trimmedUrl)) {
        await handleBraveSearch(trimmedUrl);
        setUrl('');
        setIsOpen(false);

        return;
      }

      const response = await fetch('/api/web-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : 'https://' + trimmedUrl }),
      });

      const result = (await response.json()) as WebSearchResponse;

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch URL content');
      }

      onSearchResult(formatSearchResult(result.data));
      toast.success('URL content fetched');
      setUrl('');
      setIsOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch URL');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <IconButton
        title="웹 검색 (검색어) 또는 주소 내용 가져오기"
        disabled={disabled || isSearching}
        onClick={() => setIsOpen(!isOpen)}
        className="transition-all"
      >
        {isSearching ? (
          <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-xl animate-spin" />
        ) : (
          <div className="i-ph:globe text-xl" />
        )}
      </IconButton>
      {isOpen && (
        <div
          className={classNames(
            'absolute bottom-full left-0 mb-2 flex items-center gap-2',
            'rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-2 shadow-lg',
          )}
        >
          <input
            ref={inputRef}
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isSearching) {
                handleFetch();
              }

              if (e.key === 'Escape') {
                setIsOpen(false);
              }
            }}
            placeholder="검색어 또는 https://…"
            disabled={isSearching}
            className={classNames(
              'w-[300px] px-3 py-1.5 text-sm rounded-md',
              'border border-bolt-elements-borderColor',
              'bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary',
              'placeholder-bolt-elements-textTertiary',
              'focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus',
            )}
          />
          <button
            onClick={handleFetch}
            disabled={isSearching || !url.trim()}
            className={classNames(
              'px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap',
              'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text',
              'hover:bg-bolt-elements-button-primary-backgroundHover',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isSearching ? '검색 중…' : isUrlLike(url.trim()) ? '가져오기' : '검색'}
          </button>
        </div>
      )}
    </div>
  );
}
