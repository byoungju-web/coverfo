import type { ChatHistoryItem } from '~/lib/persistence';

type Bin = { category: string; items: ChatHistoryItem[] };

/*
 * coverfo: 대화 목록 날짜 묶기 — 홈 화면 사이드바(landing-html.ts)와 같은 규칙.
 * '지난 24시간'이 아니라 기기 시간의 달력 날짜로 비교합니다 (오늘 / 어제 / 지난 7일 / 지난 30일 / 이전).
 */
export function binDates(_list: ChatHistoryItem[]) {
  const list = _list.toSorted((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  const binLookup: Record<string, Bin> = {};
  const bins: Array<Bin> = [];

  list.forEach((item) => {
    const category = dateCategory(new Date(item.timestamp));

    if (!(category in binLookup)) {
      const bin = {
        category,
        items: [item],
      };

      binLookup[category] = bin;

      bins.push(bin);
    } else {
      binLookup[category].items.push(item);
    }
  });

  return bins;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dateCategory(date: Date) {
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);

  if (days <= 0) {
    return '오늘';
  }

  if (days === 1) {
    return '어제';
  }

  if (days < 7) {
    return '지난 7일';
  }

  if (days < 30) {
    return '지난 30일';
  }

  return '이전';
}
