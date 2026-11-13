// functions/api/tour.js — coverfo 🎪 축제·행사 + 🏞 가볼 만한 곳 + ⛺ 캠핑장(v380) + 🌤 날씨·📷 캠핑장 사진(v381) (v371 · v372: 축제 한 쪽 100건씩 · 지역코드로 0건이면 전국에서 주소로 거르기) · 한국관광공사 TourAPI 4.0 (국문 관광정보 서비스 KorService2) · 무료
// © 2026 coverfo All Rights Reserved
//
// POST /api/tour   (Authorization: Bearer coverfo 로그인키 — 하루 호출 한도(개발계정 1,000건)를 지키려고 로그인한 사람만)
//   { op:"festival", region?, when?, page? } → 그 지역(없으면 전국)에서 그 기간(기본: 오늘부터 30일)에 열리는 축제·공연·행사
//   { op:"spot", region, page? }             → 그 지역 가볼 만한 곳 (관광지) · 도시면 반경 20km 가까운 순, 시·도면 그 시·도 전체
//   { op:"pet", region, type?, page? }       → v373 🐶 반려동물 동반 가능한 곳 (한국관광공사_반려동물_동반여행_서비스 KorPetTourService2) · type: all | spot | stay | food
//   { op:"free", region, type?, page? }      → v373 ♿ 무장애 여행 (휠체어·유모차 · 한국관광공사_무장애 여행 정보 KorWithService2)
//   { op:"petinfo", id } / { op:"freeinfo", id } → 그곳의 동반 조건 · 무장애 편의시설 (detailPetTour2 · detailWithTour2) — 카드에서 누를 때만
//   → { ok, kind, region, from, to, page, more, total, items:[{ id, title, addr, tel, img, x, y, start, end, dist, type }], source }
//   { op:"camp", region, type?, page? }      → v380 ⛺ 캠핑장 (한국관광공사_고캠핑 정보 조회서비스 GoCamping · locationBasedList 반경 20km 가까운 순)
//        type: all | auto 자동차야영장 | glamp 글램핑 | carav 카라반 | pet 반려견 가능 · 항목에 intro·pet·fac·season·days·resv·home 추가
//   { op:"campimg", id }                       → v381 📷 캠핑장 사진 더 보기 (고캠핑 imageList) → { ok, imgs:[url] }
//   v381 🌤 첫 쪽 결과에 wx(그 지역 날씨: 기상청 단기예보 VilageFcstInfoService_2.0 getVilageFcst) — { days:[{ d, lo, hi, sky, pty, pop }] } 또는 { err }
//        키: KMA_API_KEY (없으면 TOUR_API_KEY 같은 공공데이터포털 인증키) · '기상청_단기예보 조회서비스' [활용신청] 필요 · 1시간 캐시
//   v384 🌫 wx.dust = 미세먼지 { st 측정소, p10, p25, g10, g25 (1 좋음~4 매우나쁨), t } · 에어코리아 '한국환경공단_에어코리아_대기오염정보' [활용신청]
//   ※ 반려동물·무장애·고캠핑·기상청·에어코리아는 공공데이터포털에서 각각 [활용신청]이 따로 필요 (같은 인증키)
//   v374 🌐 lang: ko(기본) | en 영문 EngService2 | ja 일문 JpnService2 | zh 중문 간체 ChsService2 | tw 중문 번체 ChtService2 — 축제·가볼 만한 곳만 (반려동물·무장애는 한국어만)
//        외국어 서비스도 각각 [활용신청] 필요 · 외국어 서비스는 관광지 종류 번호가 76 (한국어 12)
//   v374 지역: 법정동 시·도 코드(lDongRegnCd)로 먼저 찾고(외국어 서비스는 예전 지역코드를 '미사용·삭제 예정'으로 안내), 0건이면 예전 지역코드 → 전국에서 거리로 거르기
//
// · 키: Cloudflare 비밀값 TOUR_API_KEY (공공데이터포털 '일반 인증키(Decoding)') · 지역 좌표 찾기는 카카오 키워드 검색(KAKAO_REST_KEY, 장소 목록과 같은 키)
// · 같은 검색은 6시간 동안 Cloudflare 캐시에 저장해 다시 부르지 않는다 (개발계정 하루 1,000건 아끼기)
// · 이용자 정보는 관광공사·카카오에 보내지 않는다 (지역 이름·날짜만). 결과는 저장하지 않는다(캐시 6시간 제외)
// · 출처: 한국관광공사 — 화면에 늘 표시. 내용·사진은 바꾸지 않고 그대로 보여 준다

const BASE = 'https://apis.data.go.kr/B551011/KorService2/';
const SVC = { kor: BASE, en: 'https://apis.data.go.kr/B551011/EngService2/', ja: 'https://apis.data.go.kr/B551011/JpnService2/', zh: 'https://apis.data.go.kr/B551011/ChsService2/', tw: 'https://apis.data.go.kr/B551011/ChtService2/', pet: 'https://apis.data.go.kr/B551011/KorPetTourService2/', free: 'https://apis.data.go.kr/B551011/KorWithService2/', camp: 'https://apis.data.go.kr/B551011/GoCamping/' };
/* 종류 → 관광공사 contentTypeId (12 관광지 · 32 숙박 · 39 음식점(카페 포함)) */
const TYPE = { spot: '12', stay: '32', food: '39' };
const LANGS = ['ko', 'en', 'ja', 'zh', 'tw'];
/* 법정동 시·도 코드 (지역코드 → lDongRegnCd) */
const LDONG = { 1: '11', 2: '28', 3: '30', 4: '27', 5: '29', 6: '26', 7: '31', 8: '36', 31: '41', 32: '51', 33: '43', 34: '44', 35: '47', 36: '48', 37: '52', 38: '46', 39: '50' };
/* 외국어로 친 지역 이름 → 한국어 (카카오 검색용) */
const ALIAS = { seoul: '서울', busan: '부산', pusan: '부산', jeju: '제주', 'jeju island': '제주', gyeongju: '경주', gangneung: '강릉', sokcho: '속초', jeonju: '전주', incheon: '인천', daegu: '대구', daejeon: '대전', gwangju: '광주', ulsan: '울산', yeosu: '여수', suwon: '수원', pohang: '포항', tongyeong: '통영', andong: '안동', chuncheon: '춘천', pyeongchang: '평창', gapyeong: '가평', jeonju2: '전주', '首尔': '서울', '首爾': '서울', 'ソウル': '서울', '釜山': '부산', 'プサン': '부산', '济州': '제주', '濟州': '제주', '済州': '제주', 'チェジュ': '제주', '济州岛': '제주', '濟州島': '제주', '済州島': '제주', '庆州': '경주', '慶州': '경주', 'キョンジュ': '경주', '江陵': '강릉', 'カンヌン': '강릉', '束草': '속초', 'ソクチョ': '속초', '全州': '전주', 'チョンジュ': '전주', '仁川': '인천', 'インチョン': '인천', '大邱': '대구', 'テグ': '대구', '大田': '대전', '光州': '광주', '蔚山': '울산', '丽水': '여수', '麗水': '여수', 'ヨス': '여수', '水原': '수원', 'スウォン': '수원', '春川': '춘천', '平昌': '평창' };
/* 상세 칸 이름 (한국관광공사 응답 필드 → 한국어) · 모르는 칸은 보여 주지 않음 */
const PET_LABEL = { acmpyTypeCd: '동반 구분', acmpyPsblCpam: '동반 가능 동물', acmpyNeedMtr: '동반 시 필요 사항', etcAcmpyInfo: '기타 동반 정보', relaPosesFclty: '관련 구비 시설', relaFrnshPrdlst: '비치 물품', relaRntlPrdlst: '대여 물품', relaPurcPrdlst: '구매 가능 물품', relaAcdntRiskMtr: '사고 대비 사항' };
const FREE_LABEL = { wheelchair: '♿ 휠체어', exit: '출입 통로', elevator: '엘리베이터', restroom: '화장실', parking: '주차', route: '접근로', publictransport: '대중교통', ticketoffice: '매표소', promotion: '안내', auditorium: '관람석', room: '객실', handicapetc: '지체장애 기타', stroller: '👶 유모차', lactationroom: '수유실', babysparechair: '유아용 의자', infantsfamilyetc: '영유아 가족 기타', braileblock: '점자 블록', helpdog: '보조견 동반', guidehuman: '안내 요원', audioguide: '오디오 가이드', bigprint: '큰 활자', brailepromotion: '점자 홍보물', guidesystem: '유도 안내', blindhandicapetc: '시각장애 기타', signguide: '수어 안내', videoguide: '자막 영상', hearingroom: '청각 보조', hearinghandicapetc: '청각장애 기타' };
const PER = 10;
const TTL = 6 * 3600;
/* 한국관광공사 지역코드 (areaCode) */
const AREA = [
  ['서울', 1], ['인천', 2], ['대전', 3], ['대구', 4], ['광주', 5], ['부산', 6], ['울산', 7], ['세종', 8],
  ['경기', 31], ['강원', 32], ['충북', 33], ['충청북', 33], ['충남', 34], ['충청남', 34], ['경북', 35], ['경상북', 35],
  ['경남', 36], ['경상남', 36], ['전북', 37], ['전라북', 37], ['전북특별', 37], ['전남', 38], ['전라남', 38], ['제주', 39],
];
const SIDO_ONLY = /^(서울|인천|대전|대구|광주|부산|울산|세종|경기|강원|충북|충남|경북|경남|전북|전남|제주|충청북|충청남|경상북|경상남|전라북|전라남)(특별시|광역시|특별자치시|특별자치도|도)?$/;

export async function onRequestPost(context) {
  const env = context.env || {};
  let b = {};
  try { b = await context.request.json(); } catch { return json({ error: '잘못된 요청입니다' }, 400); }
  const uid = await userId(context.request, env);
  if (!uid) return json({ error: '로그인이 필요합니다', login: true }, 401);
  const key = String(env.TOUR_API_KEY || '').trim();
  if (!key) return json({ error: '관광정보 설정이 아직 없어요 (TOUR_API_KEY)', setup: true }, 500);
  const op = String(b.op || '');
  if (!['festival', 'spot', 'pet', 'free', 'camp', 'petinfo', 'freeinfo', 'campimg'].includes(op)) return json({ error: '잘못된 요청입니다' }, 400);
  if (op === 'campimg') {
    const id = String(b.id || '');
    if (!/^\d{1,12}$/.test(id)) return json({ error: '잘못된 요청입니다' }, 400);
    try {
      const rows = await call(env, key, 'imageList', { contentId: id, numOfRows: '20', pageNo: '1' }, 'camp');
      const imgs = [];
      for (const r of rows) { for (const k of Object.keys(r || {})) { const v = String(r[k] || '').trim(); if (/(image|img)/i.test(k) && /^https?:\/\/[\w.-]+\//.test(v)) { const u = v.replace(/^http:\/\//, 'https://').slice(0, 300); if (!imgs.includes(u)) imgs.push(u); break; } } }
      return json({ ok: true, id, imgs: imgs.slice(0, 20), source: '한국관광공사 고캠핑' });
    } catch (e) {
      if (e && e.status) return json({ error: e.message }, e.status);
      return json({ error: String((e && e.message) || e).slice(0, 200) }, 502);
    }
  }
  if (op === 'petinfo' || op === 'freeinfo') {
    const id = String(b.id || '');
    if (!/^\d{1,12}$/.test(id)) return json({ error: '잘못된 요청입니다' }, 400);
    try {
      const pet = op === 'petinfo';
      const rows = await call(env, key, pet ? 'detailPetTour2' : 'detailWithTour2', { contentId: id }, pet ? 'pet' : 'free');
      const it = rows[0] || {}, L = pet ? PET_LABEL : FREE_LABEL, info = [];
      for (const k of Object.keys(L)) { const v = clean(String(it[k] || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' '), 200); if (v && v !== '0') info.push({ k: L[k], v }); }
      return json({ ok: true, id, info, source: '한국관광공사 TourAPI' });
    } catch (e) {
      if (e && e.status) return json({ error: e.message }, e.status);
      return json({ error: String((e && e.message) || e).slice(0, 200) }, 502);
    }
  }
  const lang = LANGS.includes(String(b.lang || '')) ? String(b.lang) : 'ko';
  const svcL = lang === 'ko' ? 'kor' : lang;
  if (lang !== 'ko' && (op === 'pet' || op === 'free' || op === 'camp')) return json({ ok: false, koOnly: true, note: 'Korean only' });
  let region = clean(b.region, 30);
  { const a = ALIAS[region.toLowerCase()] || ALIAS[region]; if (a) region = a; }
  const page = Math.max(1, Math.min(10, parseInt(b.page, 10) || 1));
  try {
    if (op !== 'festival' && !region) return json({ ok: false, need: 'region', note: '어느 지역인지 알려 주세요 (예: 속초, 경주, 제주)' });
    const geo = region ? await where(env, region) : null;
    if (region && !geo) return json({ ok: false, notFound: true, note: '"' + region + '" 지역을 찾지 못했어요' });
    let all, from = '', to = '';
    /* v381 🌤 첫 쪽만: 그 지역(도시 좌표 · 시·도면 시청·도청) 날씨를 함께 (실패해도 목록은 그대로) */
    const wxP = page === 1 && geo ? Promise.all([
      center(env, geo).then((c) => (c ? weather(env, c) : null)).catch(() => null),
      dust(env, geo).catch(() => null),   /* v384 🌫 미세먼지 (에어코리아) */
    ]).then(([w, d]) => (d ? Object.assign({}, w || {}, { dust: d }) : w)) : Promise.resolve(null);
    if (op === 'festival') {
      const r = range(String(b.when || ''));
      from = r.from; to = r.to;
      all = await festivals(env, key, geo, from, to, svcL);
    } else if (op === 'spot') {
      all = await spots(env, key, geo, svcL);
    } else if (op === 'camp') {
      all = await camps(env, key, geo, String(b.type || 'all'));
    } else {
      all = await places(env, key, geo, op, String(b.type || 'all'));
    }
    const items = all.slice((page - 1) * PER, page * PER);
    const wx = await wxP;
    return json({ ok: true, kind: op, lang, wx: wx || undefined, region: geo ? geo.label : (lang === 'ko' ? '전국' : ''), from, to, page, total: all.length, more: all.length > page * PER, items, source: '한국관광공사 TourAPI' });
  } catch (e) {
    if (e && e.status) return json({ error: e.message }, e.status);
    return json({ error: String((e && e.message) || e).slice(0, 200) }, 502);
  }
}

/* ── 지역: 시·도 이름이면 지역코드만 · 도시·동네면 카카오로 좌표 + 시·도 ── */
async function where(env, region) {
  const r = region.replace(/\s+/g, ' ').trim();
  const head = r.split(' ')[0];
  if (SIDO_ONLY.test(head) && r.split(' ').length === 1) {
    const code = areaOf(head);
    if (code) return { label: head, area: code, city: '', x: 0, y: 0 };
  }
  const kk = String(env.KAKAO_REST_KEY || '').trim();
  if (!kk) throw httpErr(500, '지역 찾기 설정이 아직 없어요 (KAKAO_REST_KEY)');
  const res = await fetch('https://dapi.kakao.com/v2/local/search/keyword.json?size=1&query=' + encodeURIComponent(r), { headers: { Authorization: 'KakaoAK ' + kk } });
  if (!res.ok) throw httpErr(502, '지역을 찾지 못했어요 (카카오 ' + res.status + ')');
  const d = await res.json().catch(() => ({}));
  const doc = d && Array.isArray(d.documents) ? d.documents[0] : null;
  if (!doc) return null;
  const addr = String(doc.address_name || doc.road_address_name || '');
  const area = areaOf(addr.split(' ')[0] || '');
  /* 도시 낱말: "속초" → 주소의 "속초시" (축제 주소 거르기) */
  const parts = addr.split(' ');
  const cityTok = parts.find((p, i) => i > 0 && /[시군]$/.test(p)) || parts.find((p, i) => i > 0 && /구$/.test(p)) || '';
  return { label: r, area, city: cityTok, x: +doc.x || 0, y: +doc.y || 0 };
}
function areaOf(s) {
  const t = String(s || '').replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '');
  for (const [k, v] of AREA) if (t === k || t.startsWith(k)) return v;
  return 0;
}

/* ── 기간: "이번 주말", "내일", "다음 달", "12월" … 기본은 오늘부터 30일 (한국 날짜) ── */
function range(w) {
  const now = new Date(Date.now() + 9 * 3600e3);
  const day = (d) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + d));
  const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const dow = now.getUTCDay();
  let a = day(0), b = day(30), m;
  if (/오늘/.test(w)) { b = a; }
  else if (/내일/.test(w)) { a = day(1); b = a; }
  else if (/모레/.test(w)) { a = day(2); b = a; }
  else if (/다음\s*주\s*말|담주\s*말/.test(w)) { const s = (6 - dow + 7) % 7 + 7; a = day(s); b = day(s + 1); }
  else if (/주말/.test(w)) { if (dow === 0) { a = day(0); b = a; } else { const s = (6 - dow + 7) % 7; a = day(s); b = day(s + 1); } }
  else if (/다음\s*주|담주/.test(w)) { const s = ((8 - dow) % 7) || 7; a = day(s); b = day(s + 6); }
  else if (/이번\s*주/.test(w)) { b = day((7 - dow) % 7); }
  else if (/다음\s*달/.test(w)) { a = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)); b = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0)); }
  else if (/이번\s*달/.test(w)) { b = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)); }
  else if ((m = w.match(/(\d{1,2})\s*월/))) { let y = now.getUTCFullYear(); const mo = +m[1] - 1; if (mo < now.getUTCMonth()) y++; a = new Date(Date.UTC(y, mo, 1)); b = new Date(Date.UTC(y, mo + 1, 0)); if (a < day(0)) a = day(0); }
  return { from: ymd(a), to: ymd(b) };
}

/* ── 축제·공연·행사: 시작일이 기간 끝 이전이고 끝난 날이 기간 시작 이후인 것 (진행 중인 축제 포함) ── */
async function festivals(env, key, geo, from, to, svc) {
  /* 시작일 기준 검색이라 이미 시작해 진행 중인 축제도 잡으려고 90일 앞부터 찾는다 */
  const s = new Date(Date.UTC(+from.slice(0, 4), +from.slice(4, 6) - 1, +from.slice(6, 8) - 90)).toISOString().slice(0, 10).replace(/-/g, '');
  /* v372: 한 쪽 100건씩 · 최대 8쪽 (한 번에 많이 달라고 하면 빈 결과가 올 수 있어서) */
  const pages = async (p) => {
    let rows = [];
    for (let pg = 1; pg <= 8; pg++) {
      p.pageNo = String(pg);
      const got = await call(env, key, 'searchFestival2', p, svc);
      rows = rows.concat(got);
      if (got.length < 100) break;
    }
    return rows;
  };
  const base = { eventStartDate: s, arrange: 'A', numOfRows: '100', pageNo: '1' };
  const kor = svc === 'kor';
  /* v374: ① 법정동 시·도 코드 → ② (한국어만) 예전 지역코드 → ③ 전국에서 거리·주소로 거르기 */
  let rows = [];
  if (geo && geo.area && LDONG[geo.area]) rows = await pages(Object.assign({}, base, { lDongRegnCd: LDONG[geo.area] })).catch(() => []);
  if (!rows.length && geo && geo.area && kor) rows = await pages(Object.assign({}, base, { areaCode: String(geo.area) })).catch(() => []);
  let wide = false;
  if (!rows.length && geo && geo.area) { rows = await pages(Object.assign({}, base)); wide = true; }
  else if (!geo) rows = await pages(Object.assign({}, base));
  let list = rows.map(norm).filter((x) => x.start && x.start <= to && (x.end || x.start) >= from);
  if (geo && wide) {
    /* 전국 결과에서 그 시·도만: 한국어는 주소 앞 이름, 외국어는 시·도 중심에서 거리 */
    if (kor) { const names = AREA.filter((a) => a[1] === geo.area).map((a) => a[0]); list = list.filter((x) => names.some((n) => x.addr.startsWith(n))); }
    else { const c = await center(env, geo); if (c) list = list.filter((x) => x.x && x.y && km(c, x) <= (geo.city ? 40 : 90)); }
  }
  if (geo && geo.city) {
    /* 그 도시만 (한국어는 주소의 도시 이름, 외국어는 30km 안) · 없으면 같은 시·도 전체 */
    const c = geo.city.replace(/[시군구]$/, '');
    const near = kor ? list.filter((x) => x.addr.includes(c)) : list.filter((x) => x.x && x.y && geo.x && km(geo, x) <= 30);
    list = near.length ? near : list;
  }
  list.sort((a, b) => (a.start === b.start ? a.title.localeCompare(b.title) : a.start < b.start ? -1 : 1));
  return list;
}
/* ── 가볼 만한 곳 (관광지: 한국어 contentTypeId 12 · 외국어 76) ── */
async function spots(env, key, geo, svc) {
  const ct = !svc || svc === 'kor' ? '12' : '76';
  let rows = [];
  if (geo.x && geo.y) rows = await call(env, key, 'locationBasedList2', { mapX: String(geo.x), mapY: String(geo.y), radius: '20000', contentTypeId: ct, arrange: 'E', numOfRows: '100', pageNo: '1' }, svc);
  else if (LDONG[geo.area]) rows = await call(env, key, 'areaBasedList2', { lDongRegnCd: LDONG[geo.area], contentTypeId: ct, arrange: 'Q', numOfRows: '100', pageNo: '1' }, svc).catch(() => []);
  if (!rows.length && !(geo.x && geo.y) && (!svc || svc === 'kor')) rows = await call(env, key, 'areaBasedList2', { areaCode: String(geo.area), contentTypeId: ct, arrange: 'Q', numOfRows: '100', pageNo: '1' }, svc).catch(() => []);
  /* v372: 시·도 이름으로 0건이면 카카오로 그 시·도 좌표를 찾아 반경 20km 로 다시 */
  if (!rows.length && !(geo.x && geo.y)) {
    const g2 = await center(env, geo);
    if (g2) rows = await call(env, key, 'locationBasedList2', { mapX: String(g2.x), mapY: String(g2.y), radius: '20000', contentTypeId: ct, arrange: 'E', numOfRows: '100', pageNo: '1' }, svc);
  }
  /* 사진 있는 곳을 조금 앞으로 (거리 순서는 유지) */
  const list = rows.map(norm);
  return list.filter((x) => x.img).concat(list.filter((x) => !x.img));
}

/* ── v373 🐶 반려동물 동반 · ♿ 무장애: 같은 방식(가까운 순 20km · 시·도면 지역 전체)으로 각 서비스에서 ── */
async function places(env, key, geo, svc, type) {
  const ct = TYPE[type] || '';
  const p = { numOfRows: '100', pageNo: '1' };
  if (ct) p.contentTypeId = ct;
  let rows;
  if (geo.x && geo.y) rows = await call(env, key, 'locationBasedList2', Object.assign({ mapX: String(geo.x), mapY: String(geo.y), radius: '20000', arrange: 'E' }, p), svc);
  else {
    rows = LDONG[geo.area] ? await call(env, key, 'areaBasedList2', Object.assign({ lDongRegnCd: LDONG[geo.area], arrange: 'Q' }, p), svc).catch(() => []) : [];
    if (!rows.length) rows = await call(env, key, 'areaBasedList2', Object.assign({ areaCode: String(geo.area), arrange: 'Q' }, p), svc);
  }
  const list = rows.map((x) => Object.assign(norm(x), { type: typeName(x.contenttypeid) }));
  return list.filter((x) => x.img).concat(list.filter((x) => !x.img));
}
/* ── v380 ⛺ 캠핑장 (고캠핑): 도시·동네 좌표(시·도면 시청·도청) 반경 20km · 가까운 순 · 종류/반려견 거르기 ── */
async function camps(env, key, geo, type) {
  const c = await center(env, geo);
  if (!c) return [];
  const rows = await call(env, key, 'locationBasedList', { mapX: String(c.x), mapY: String(c.y), radius: '20000', numOfRows: '100', pageNo: '1' }, 'camp');
  const T = { auto: (x) => /자동차/.test(x.type), glamp: (x) => /글램핑/.test(x.type), carav: (x) => /카라반/.test(x.type), pet: (x) => /^가능/.test(x.pet) };
  let list = rows.map(campNorm).filter((x) => x.title);
  if (T[type]) list = list.filter(T[type]);
  list.forEach((x) => { if (x.x && x.y) x.dist = Math.round(km(c, x) * 1000); });
  list.sort((a, b) => (a.dist || 9e9) - (b.dist || 9e9));
  return list;
}
function campNorm(x) {
  const t = (k, n) => clean(String(x[k] || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' '), n);
  const url = (k) => { const v = String(x[k] || '').trim(); return /^https?:\/\/[\w.-]+/.test(v) ? v.replace(/^http:\/\//, 'https://').slice(0, 300) : ''; };
  const img = url('firstImageUrl');
  return {
    id: String(x.contentId || ''),
    title: t('facltNm', 60),
    addr: clean(String(x.addr1 || '') + (x.addr2 ? ' ' + x.addr2 : ''), 80),
    tel: t('tel', 40),
    img, x: +x.mapX || 0, y: +x.mapY || 0, start: '', end: '', dist: 0,
    type: t('induty', 40),
    intro: t('lineIntro', 120) || t('intro', 160),
    pet: t('animalCmgCl', 30),
    fac: t('sbrsCl', 120),
    season: t('operPdCl', 40),
    days: t('operDeCl', 40),
    resv: t('resveCl', 40),
    resvUrl: url('resveUrl'),
    home: url('homepage'),
  };
}
/* ── v381 🌤 기상청 단기예보: 위경도 → 격자(nx, ny) · 가장 최근 발표(02·05·…·23시, 발표 15분 뒤부터) · 날짜별 최저·최고·하늘·비·강수확률 ── */
const KMA = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst';
function grid(lat, lon) {
  const RE = 6371.00877 / 5.0, DEG = Math.PI / 180, s1 = 30 * DEG, s2 = 60 * DEG, olon = 126 * DEG, olat = 38 * DEG;
  let sn = Math.log(Math.cos(s1) / Math.cos(s2)) / Math.log(Math.tan(Math.PI * 0.25 + s2 * 0.5) / Math.tan(Math.PI * 0.25 + s1 * 0.5));
  let sf = Math.pow(Math.tan(Math.PI * 0.25 + s1 * 0.5), sn) * Math.cos(s1) / sn;
  const ro = RE * sf / Math.pow(Math.tan(Math.PI * 0.25 + olat * 0.5), sn);
  const ra = RE * sf / Math.pow(Math.tan(Math.PI * 0.25 + lat * DEG * 0.5), sn);
  let th = lon * DEG - olon; if (th > Math.PI) th -= 2 * Math.PI; if (th < -Math.PI) th += 2 * Math.PI; th *= sn;
  return { nx: Math.floor(ra * Math.sin(th) + 43 + 0.5), ny: Math.floor(ro - ra * Math.cos(th) + 136 + 0.5) };
}
function kmaBase(now) {
  const k = new Date(now + 9 * 3600e3 - 15 * 60e3);   /* 발표 뒤 10분쯤 올라와 15분 여유 */
  const h = k.getUTCHours();
  const hs = [23, 20, 17, 14, 11, 8, 5, 2].find((x) => x <= h);
  if (hs === undefined) { const y = new Date(k.getTime() - 86400e3); return { date: y.toISOString().slice(0, 10).replace(/-/g, ''), time: '2300' }; }
  return { date: k.toISOString().slice(0, 10).replace(/-/g, ''), time: String(hs).padStart(2, '0') + '00' };
}
async function weather(env, c) {
  const key = String(env.KMA_API_KEY || env.TOUR_API_KEY || '').trim();
  if (!key || !c || !c.x || !c.y) return null;
  const g = grid(+c.y, +c.x), base = kmaBase(Date.now());
  const q = new URLSearchParams({ pageNo: '1', numOfRows: '1500', dataType: 'JSON', base_date: base.date, base_time: base.time, nx: String(g.nx), ny: String(g.ny) });
  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  const ck = new Request('https://cache.coverfo.com/kma/' + q.toString());
  if (cache) { const h = await cache.match(ck).catch(() => null); if (h) { const j = await h.json().catch(() => null); if (j) return j; } }
  let t;
  try { const r = await fetch(KMA + '?serviceKey=' + encodeURIComponent(key) + '&' + q.toString(), { headers: { Accept: 'application/json' } }); t = await r.text(); } catch { return null; }
  if (/SERVICE_KEY_IS_NOT_REGISTERED|SERVICE KEY IS NOT/i.test(t)) return { err: 'apply' };
  if (/LIMITED_NUMBER_OF_SERVICE_REQUESTS/i.test(t)) return { err: 'limit' };
  let d; try { d = JSON.parse(t); } catch { return null; }
  const code = String((d && d.response && d.response.header && d.response.header.resultCode) || '');
  if (code !== '00' && code !== '0000') return null;
  let it = d.response.body && d.response.body.items ? d.response.body.items.item : [];
  if (!Array.isArray(it)) it = it ? [it] : [];
  const days = {};
  for (const r of it) {
    const day = String(r.fcstDate || ''), v = String(r.fcstValue || ''), hh = +String(r.fcstTime || '0000').slice(0, 2);
    if (!/^\d{8}$/.test(day)) continue;
    const o = days[day] || (days[day] = { d: day, lo: null, hi: null, tmn: null, tmx: null, sky: 0, pty: 0, pop: 0 });
    const n = parseFloat(v);
    if (r.category === 'TMP' && isFinite(n)) { o.lo = o.lo == null ? n : Math.min(o.lo, n); o.hi = o.hi == null ? n : Math.max(o.hi, n); }
    else if (r.category === 'TMN' && isFinite(n)) o.tmn = n;
    else if (r.category === 'TMX' && isFinite(n)) o.tmx = n;
    else if (r.category === 'POP' && isFinite(n)) o.pop = Math.max(o.pop, n);
    else if (r.category === 'PTY' && +v > 0 && !o.pty) o.pty = +v;   /* 1 비 · 2 비/눈 · 3 눈 · 4 소나기 */
    else if (r.category === 'SKY' && hh >= 9 && hh <= 18) o.sky = Math.max(o.sky, +v || 0);   /* 낮 하늘 중 가장 흐린 것: 1 맑음 · 3 구름많음 · 4 흐림 */
  }
  const out = Object.keys(days).sort().slice(0, 4).map((k) => { const o = days[k]; return { d: o.d, lo: Math.round(o.tmn != null ? o.tmn : o.lo), hi: Math.round(o.tmx != null ? o.tmx : o.hi), sky: o.sky || 1, pty: o.pty, pop: o.pop }; }).filter((o) => isFinite(o.lo) && isFinite(o.hi));
  const res = out.length ? { days: out, src: '기상청 단기예보', base: base.date + base.time } : null;
  if (res && cache) { try { await cache.put(ck, new Response(JSON.stringify(res), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' } })); } catch {} }
  return res;
}
/* ── v384 🌫 미세먼지: 한국환경공단 에어코리아 대기오염정보 (시·도별 실시간 측정정보 getCtprvnRltmMesureDnsty)
   그 지역 이름과 같은 측정소가 있으면 그 값 · 없으면 시·도 측정소 값의 가운데 값 · 등급은 환경부 기준으로 다시 계산
   키: AIR_API_KEY (없으면 KMA_API_KEY → TOUR_API_KEY, 같은 공공데이터포털 인증키) · 30분 캐시 ── */
const AIR = 'https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty';
const SIDO_NM = { 1: '서울', 2: '인천', 3: '대전', 4: '대구', 5: '광주', 6: '부산', 7: '울산', 8: '세종', 31: '경기', 32: '강원', 33: '충북', 34: '충남', 35: '경북', 36: '경남', 37: '전북', 38: '전남', 39: '제주' };
function g10(v) { return v <= 30 ? 1 : v <= 80 ? 2 : v <= 150 ? 3 : 4; }   /* 1 좋음 · 2 보통 · 3 나쁨 · 4 매우나쁨 */
function g25(v) { return v <= 15 ? 1 : v <= 35 ? 2 : v <= 75 ? 3 : 4; }
async function dust(env, geo) {
  const key = String(env.AIR_API_KEY || env.KMA_API_KEY || env.TOUR_API_KEY || '').trim();
  const sido = SIDO_NM[geo && geo.area];
  if (!key || !sido) return null;
  const q = new URLSearchParams({ returnType: 'json', numOfRows: '200', pageNo: '1', sidoName: sido, ver: '1.0' });
  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  const ck = new Request('https://cache.coverfo.com/air/' + q.toString());
  let rows = null;
  if (cache) { const h = await cache.match(ck).catch(() => null); if (h) rows = await h.json().catch(() => null); }
  if (!rows) {
    let t;
    try { const r = await fetch(AIR + '?serviceKey=' + encodeURIComponent(key) + '&' + q.toString(), { headers: { Accept: 'application/json' } }); t = await r.text(); } catch { return null; }
    if (/SERVICE_KEY_IS_NOT_REGISTERED|SERVICE KEY IS NOT/i.test(t)) return { err: 'apply' };
    if (/LIMITED_NUMBER_OF_SERVICE_REQUESTS/i.test(t)) return null;
    let d; try { d = JSON.parse(t); } catch { return null; }
    const code = String((d && d.response && d.response.header && d.response.header.resultCode) || '');
    if (code !== '00' && code !== '0000') return null;
    let it = d.response.body && d.response.body.items;
    if (it && it.item) it = it.item;
    if (!Array.isArray(it)) it = it ? [it] : [];
    rows = it.map((r) => ({ n: String(r.stationName || ''), t: String(r.dataTime || ''), p10: parseFloat(r.pm10Value), p25: parseFloat(r.pm25Value) })).filter((r) => r.n);
    if (cache && rows.length) { try { await cache.put(ck, new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=1800' } })); } catch {} }
  }
  const ok = rows.filter((r) => isFinite(r.p10) || isFinite(r.p25));
  if (!ok.length) return null;
  const stem = (w) => String(w || '').replace(/(특별자치시|특별자치도|특별시|광역시|시|군|구|읍|면|동)$/, '');
  const toks = [geo.city, geo.label].concat(String(geo.label || '').split(' ')).map(stem).filter((w) => w && w.length >= 2);
  let pick = null;
  for (const w of toks) { pick = ok.find((r) => stem(r.n) === w) || ok.find((r) => r.n.startsWith(w)); if (pick) break; }
  const med = (k) => { const v = ok.map((r) => r[k]).filter(isFinite).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : NaN; };
  const p10 = pick && isFinite(pick.p10) ? pick.p10 : med('p10'), p25 = pick && isFinite(pick.p25) ? pick.p25 : med('p25');
  return { st: pick ? pick.n : sido, avg: !pick, t: (pick || ok[0]).t, p10: isFinite(p10) ? Math.round(p10) : null, p25: isFinite(p25) ? Math.round(p25) : null, g10: isFinite(p10) ? g10(p10) : 0, g25: isFinite(p25) ? g25(p25) : 0, src: '에어코리아' };
}
/* 시·도 중심 좌표 (시청·도청) · 두 점 거리(km) */
async function center(env, geo) {
  if (geo.x && geo.y) return { x: geo.x, y: geo.y };
  const nm = (AREA.find((x) => x[1] === geo.area) || [''])[0];
  const g2 = nm ? await where(env, nm + (geo.area <= 8 ? '시청' : '도청')).catch(() => null) : null;
  return g2 && g2.x && g2.y ? { x: g2.x, y: g2.y } : null;
}
function km(a, b) {
  const r = Math.PI / 180, dLat = (b.y - a.y) * r, dLon = (b.x - a.x) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.y * r) * Math.cos(b.y * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
function typeName(id) { return { 12: '관광지', 14: '문화시설', 15: '행사', 25: '여행코스', 28: '레포츠', 32: '숙박', 38: '쇼핑', 39: '음식점·카페' }[+id] || ''; }

async function call(env, key, op, params, svc) {
  const base = SVC[svc] || BASE;
  const q = new URLSearchParams(Object.assign({ MobileOS: 'ETC', MobileApp: 'coverfo', _type: 'json' }, params));
  const cacheKey = new Request('https://cache.coverfo.com/tour/' + (svc || 'kor') + '/' + op + '?' + q.toString());
  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  if (cache) { const hit = await cache.match(cacheKey).catch(() => null); if (hit) { const j = await hit.json().catch(() => null); if (Array.isArray(j)) return j; } }
  const url = base + op + '?serviceKey=' + encodeURIComponent(key) + '&' + q.toString();
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  const t = await r.text();
  if (!r.ok) throw httpErr(502, '관광정보를 불러오지 못했어요 (' + r.status + ')');
  let d;
  try { d = JSON.parse(t); } catch {
    if (/SERVICE_KEY_IS_NOT_REGISTERED|SERVICE KEY/i.test(t)) throw httpErr(502, ({ en: '영문', ja: '일문', zh: '중문 간체', tw: '중문 번체' })[svc] ? '한국관광공사 ' + ({ en: '영문', ja: '일문', zh: '중문 간체', tw: '중문 번체' })[svc] + ' 관광정보 서비스 활용신청이 아직 안 됐어요 (공공데이터포털 [활용신청] · 승인 직후면 잠시 뒤 다시) · Not available yet' : svc === 'pet' ? '반려동물 동반여행 서비스 활용신청이 아직 안 됐어요 (공공데이터포털에서 [활용신청] · 승인 직후면 잠시 뒤 다시)' : svc === 'free' ? '무장애 여행 정보 활용신청이 아직 안 됐어요 (공공데이터포털에서 [활용신청] · 승인 직후면 잠시 뒤 다시)' : svc === 'camp' ? '고캠핑 정보 조회서비스 활용신청이 아직 안 됐어요 (공공데이터포털에서 [활용신청] · 승인 직후면 잠시 뒤 다시)' : '관광정보 인증키가 아직 등록 전이에요. 승인 직후면 잠시 뒤 다시 해 보세요');
    if (/LIMITED_NUMBER_OF_SERVICE_REQUESTS/i.test(t)) throw httpErr(429, '오늘 관광정보 조회 한도를 다 썼어요. 내일 다시 해 주세요');
    throw httpErr(502, '관광정보 응답을 읽지 못했어요');
  }
  const code = String((d && d.response && d.response.header && d.response.header.resultCode) || (d && d.resultCode) || '');
  if (code && code !== '0000') {
    const msg = String((d.response && d.response.header && d.response.header.resultMsg) || d.resultMsg || '');
    if (code === '03' || /NODATA/i.test(msg)) return [];
    throw httpErr(502, '관광정보 오류 (' + code + ' ' + msg.slice(0, 60) + ')');
  }
  let it = d && d.response && d.response.body && d.response.body.items ? d.response.body.items.item : [];
  if (!it) it = [];
  if (!Array.isArray(it)) it = [it];
  if (cache) { try { await cache.put(cacheKey, new Response(JSON.stringify(it), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=' + TTL } })); } catch {} }
  return it;
}
function norm(x) {
  const img = String(x.firstimage || x.firstimage2 || '').replace(/^http:\/\//, 'https://');
  return {
    id: String(x.contentid || ''),
    title: clean(x.title, 60),
    addr: clean(String(x.addr1 || '') + (x.addr2 ? ' ' + x.addr2 : ''), 80),
    tel: clean(String(x.tel || '').replace(/<[^>]*>/g, ' '), 40),
    img: /^https:\/\/[\w.-]+\//.test(img) ? img : '',
    x: +x.mapx || 0, y: +x.mapy || 0,
    start: String(x.eventstartdate || ''), end: String(x.eventenddate || ''),
    dist: x.dist ? Math.round(+x.dist) : 0,
  };
}

/* ── 공용 ── */
function clean(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
function httpErr(status, message) { const e = new Error(message); e.status = status; return e; }
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
async function userId(request, env) {
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, ''), svc = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!url || !svc || !token || token.startsWith('sd1.')) return '';
  try {
    const r = await fetch(url + '/auth/v1/user', { headers: { apikey: svc, Authorization: 'Bearer ' + token } });
    if (!r.ok) return '';
    const u = await r.json();
    return u && u.id ? String(u.id) : '';
  } catch { return ''; }
}
