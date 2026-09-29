/*
 * coverfo — Brave Search API 도우미 (서버 전용)
 *   키: Cloudflare Secret BRAVE_API_KEY (브라우저에 절대 내려보내지 않음)
 *   문서: https://api.search.brave.com/app/documentation/web-search/get-started
 *
 * 쓰는 곳
 *   · app/routes/api.brave-search.ts  — 채팅 🌐 상자에서 검색어 입력 (A 방식)
 *   · app/routes/api.chat.ts          — 글 답변(discuss)에서 최신 정보가 필요해 보이면 자동 검색 (B 방식)
 */

export interface BraveResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';

/** 검색어의 문자로 언어·나라를 고릅니다 (한글 → ko/KR, 일본어 → ja/JP, 태국어 → th/TH, 중국어 → zh-hans/CN, 그 외 en/US) */
function pickLocale(q: string) {
  if (/[가-힣]/.test(q)) {
    return { lang: 'ko', country: 'KR' };
  }

  if (/[぀-ヿ]/.test(q)) {
    return { lang: 'ja', country: 'JP' };
  }

  if (/[฀-๿]/.test(q)) {
    return { lang: 'th', country: 'TH' };
  }

  if (/[一-鿿]/.test(q)) {
    return { lang: 'zh-hans', country: 'CN' };
  }

  return { lang: 'en', country: 'US' };
}

/** Brave 웹 검색. 키가 없거나 실패하면 예외를 던집니다 */
export async function braveSearch(env: Record<string, any> | undefined, q: string, count = 8): Promise<BraveResult[]> {
  const key = env?.BRAVE_API_KEY;

  if (!key) {
    throw new Error('BRAVE_API_KEY 가 없습니다 (Cloudflare → Settings → Variables and Secrets 에 등록)');
  }

  const query = q.trim().slice(0, 400);

  if (!query) {
    throw new Error('검색어가 비어 있습니다');
  }

  const { lang, country } = pickLocale(query);
  const params = new URLSearchParams({
    q: query,
    count: String(Math.min(Math.max(count, 1), 20)),
    search_lang: lang,
    country,
    safesearch: 'moderate',
    text_decorations: 'false',
  });

  const r = await fetch(`${BRAVE_ENDPOINT}?${params}`, {
    headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': key },
    signal: AbortSignal.timeout(12_000),
  });

  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Brave ${r.status}: ${body.slice(0, 200)}`);
  }

  const data: any = await r.json();
  const web: any[] = data?.web?.results || [];
  const news: any[] = data?.news?.results || [];
  const out: BraveResult[] = [];
  const seen = new Set<string>();

  for (const it of [...web, ...news]) {
    if (!it?.url || seen.has(it.url)) {
      continue;
    }

    seen.add(it.url);
    out.push({
      title: String(it.title || '').trim(),
      url: String(it.url),
      description: String(it.description || '').replace(/<[^>]+>/g, '').trim(),
      age: it.age || it.page_age || undefined,
    });

    if (out.length >= count) {
      break;
    }
  }

  return out;
}

/** 검색 결과를 모델 프롬프트에 붙일 글로 만듭니다 */
export function formatBraveResults(q: string, results: BraveResult[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const lines = results.map((r, i) => `${i + 1}. ${r.title}${r.age ? ` (${r.age})` : ''}\n   ${r.description}\n   ${r.url}`);

  return [
    `[Web search results — Brave, ${today}, query: "${q}"]`,
    ...lines,
    '',
    'Use these results when answering. Cite the source URLs you relied on. If the results do not answer the question, say so.',
  ].join('\n');
}

/*
 * 자동 검색 판단 (B 방식) — 글 답변(discuss)에서만 씁니다.
 *   · "검색:" / "/search" 로 시작하면 무조건 검색
 *   · 최신 정보가 필요해 보이는 낱말(오늘·최신·뉴스·환율·시세·날씨·언제·누가… / today·latest·news·price…)이 있으면 검색
 *   · 코드·앱 만들기 요청처럼 보이면 검색하지 않음
 */
const FORCE = /^\s*(검색\s*[:：]|\/search\s+)/i;
const HINT =
  /(오늘|어제|이번\s*주|이번\s*달|올해|최신|최근|요즘|현재|지금|뉴스|속보|환율|시세|주가|가격|얼마|날씨|일정|언제|누구|누가|몇\s*(시|명|살|위)|순위|결과|발표|출시|업데이트|버전|20\d\d년?)/;
const HINT_EN =
  /\b(today|yesterday|this (week|month|year)|latest|recent(ly)?|current(ly)?|now|news|price|cost|how much|weather|schedule|when (is|was|does|did)|who (is|was|won)|release(d)?|update(d)?|version|20\d\d)\b/i;
const NOT_SEARCH = /(만들어|생성해|코드|함수|컴포넌트|앱\s*(을|를)?\s*만|페이지\s*(를|을)?\s*만|html|css|javascript|typescript|python|react|remix|sql|버그|에러\s*고|수정해|리팩)/i;

export function autoSearchQuery(userText: string): string | null {
  // bolt 가 붙이는 [Model: ...] [Provider: ...] 머리말 제거
  const text = String(userText || '')
    .replace(/\[Model:[^\]]*\]\s*/g, '')
    .replace(/\[Provider:[^\]]*\]\s*/g, '')
    .trim();

  if (!text) {
    return null;
  }

  if (FORCE.test(text)) {
    return text.replace(FORCE, '').trim().slice(0, 300) || null;
  }

  if (NOT_SEARCH.test(text)) {
    return null;
  }

  if (text.length > 400) {
    return null; // 긴 글(붙여넣은 문서 등)은 검색어로 부적합
  }

  if (HINT.test(text) || HINT_EN.test(text)) {
    return text.replace(/\s+/g, ' ').slice(0, 300);
  }

  return null;
}
