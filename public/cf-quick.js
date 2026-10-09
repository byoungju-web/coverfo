/* coverfo 빠른 실행 — "앱·지도·쇼핑·송금·숙소로 갈 요청이면 채팅 대신 그 화면을 바로 연다" (나라별)
   · 무엇을 하려는지: 포도톡 ai.html 의 규칙(placeMapIntent·vansIsNavi·vansIsMusic·shoppingDetect·callIntent·smsIntent·
     taxiIntent·trainIntent·deliveryIntent·tossIntent·bookingInfo)을 그대로 + 같은 뜻의 영어 규칙
   · 어느 나라인지: cf-ui-lang.js 의 시간대 → 나라 (관리자 시험용 덮어쓰기: ?cf_country=US 또는 localStorage cf_country)
   · 여는 곳: 각 회사가 공개한 주소 형식만 (Google Maps URLs, Google 쇼핑 검색, YouTube 검색, Uber 딥링크(개발자 문서), Booking.com·Airbnb 검색,
     PayPal.me / UPI(NPCI 규격) / supertoss 송금 링크, tel:/sms:). 확인 안 된 형식(Venmo·Cash App·Zelle)은 쓰지 않는다.
   · 배달(v13): 한국·미국·캐나다·호주는 홈 화면의 배달 화면(cf-dlv)에서 배달 앱을 고른다. 제휴 링크는 Secret 에 넣었을 때만.
   · 길안내(v12): 한국은 홈 화면의 길안내 화면(cf-navi)이 카카오맵·네이버지도를 보여 준다(카카오 키가 있으면 현재 위치에서 바로 안내). 해외는 Google Maps 를 바로 연다.
   · 맛집(v10): 음식점·맛집이면 홈 화면의 맛집 화면(cf-food)이 네이버지도·카카오맵·Google Maps(·Yelp) 공개 검색 주소를 보여 준다.
   · 숙소(v9): 판별되면 홈 화면의 숙소 화면(cf-stay)이 여기어때·야놀자·Booking.com·Airbnb 공개 검색 주소를 보여 준다.
   · 쇼핑(v7·v8): 판별되면 홈 화면의 쇼핑 화면(cf-shop)이 쇼핑몰별 공개 검색 주소를 보여 준다. 제재국·개인정보는 shop() 에서 먼저 막는다.
     비공식 스킴·자동 결제 없음 — 송금·예약은 앱이 채워진 채 열리고 비밀번호/결제는 본인이 누른다.
   · 규칙에 안 걸리면 /api/quick-intent (Claude Fable 5.1, 크레딧 소액 차감) 에게 한 번 물어보고, 그래도 아니면 채팅으로.
   홈(landing-html.ts)과 시험 페이지(quick-test.html)가 같이 쓴다. */
(function () {
  if (window.cfQuick) return;
  var E = encodeURIComponent;
  var KO = /[가-힣]/;

  /* ── 나라 ── */
  /* 관리자 시험용: ?cf_country=US 로 한 번 열면 이 기기에 저장 (AUTO 면 지움). 로드 즉시 처리 */
  try { var _u = new URL(location.href).searchParams.get("cf_country"); if (_u) { _u = _u.toUpperCase(); if (_u === "AUTO") localStorage.removeItem("cf_country"); else localStorage.setItem("cf_country", _u); } } catch (e) {}
  function country() {
    var o = null; try { o = localStorage.getItem("cf_country"); } catch (e) {}
    if (o === "AUTO" || o === "") { try { localStorage.removeItem("cf_country"); } catch (e) {} o = null; }
    if (o) return o;
    try { if (window.cfUiLang && window.cfUiLang.country) return window.cfUiLang.country() || "KR"; } catch (e) {}
    return "KR";
  }
  function isOverride() { try { return !!localStorage.getItem("cf_country"); } catch (e) { return false; } }
  function setCountry(c) { try { if (!c || c === "AUTO") localStorage.removeItem("cf_country"); else localStorage.setItem("cf_country", String(c).toUpperCase()); } catch (e) {} }
  function isIOS() { return /iPhone|iPad|iPod/i.test(navigator.userAgent); }
  function isAndroid() { return /Android/i.test(navigator.userAgent); }

  /* ── 검색어 정리 (포도톡 그대로 + 영어) ── */
  function clean(q) {
    return String(q || "")
      .replace(/알려\s*줘?|추천\s*해?\s*줘?|좀|해\s*줘|(^|\s)해(?=\s|$)|찾아\s*줘?|보여\s*줘?|어디(야|있어|에|있나|있을까)?|쫙|배고파|배고픈데|뭐\s*먹(지|을까|을지)|있나요?|있을까요?|있어요?|알려주세요|주세요|부탁(해|해요|합니다)?/g, "")
      .replace(/(^|\s)(please|find|show|me|recommend|tell|search|for|some|good|best|any|a|the|near\s*me|nearby|around\s*here|where\s*(is|are|can\s*i)|can\s*you|i\s*want|i'd\s*like|looking\s*for)(?=\s|$)/gi, "$1")
      .replace(/\s+/g, " ").trim() || q;
  }
  /* ── 판별 규칙: 포도톡(한국어) + 영어 ── */
  var R = {
    place: [/(맛집|맛짐|맛집추천|먹을\s*(곳|데|만한)|먹거리|음식점|식당|밥집|맛있는\s*(곳|집|데)|뭐\s*먹(지|을까)|배고파|카페\s*추천|술집|호프|포차|디저트\s*(집|카페)|브런치|점심\s*(추천|뭐)|저녁\s*(추천|뭐))/,
      /(가\s*볼\s*만\s*한|가볼만한|볼\s*만\s*한\s*(곳|데)|관광지|관광|명소|여행지|놀\s*(거리|데|곳)|갈\s*(만\s*한|데|곳)|볼\s*거리|구경\s*(거리|할|갈)|핫플|유명한\s*(곳|데)|데이트\s*(코스|장소)|나들이|놀러\s*(갈|가)|산책\s*(길|코스)|야경|전망대|포토\s*(존|스팟)|액티비티|체험)/,
      /(restaurants?|food|eat|dinner|lunch|brunch|cafe|coffee|bar|pizza|sushi|things\s*to\s*do|attractions|sightseeing|places\s*to\s*(visit|see|go)|tourist|landmarks?|must[- ]see)/i],
    placeNear: [/(근처|주변|가까운|가까이|여기|이\s*근방|근방|옆에|앞에|부근)/, /(near|nearby|around|closest|nearest)/i],
    placeKinds: [/(카페|식당|병원|의원|응급실|약국|편의점|주유소|충전소|주차장|은행|atm|현금\s*인출기|마트|슈퍼|시장|숙소|호텔|모텔|펜션|미용실|이발소|세탁소|헬스장|공원|화장실|우체국|주민센터|경찰서|소방서|도서관|학교|유치원|어린이집|키즈카페|동물병원|정비소|세차장|노래방|피시방|pc방|영화관|극장|목욕탕|찜질방|사우나|빨래방|문구점|서점|꽃집|빵집|베이커리|치킨집|피자집|분식|국밥|고기집|횟집|초밥|중국집|일식|한식|양식|지하철역|버스\s*정류장|터미널|기차역|공항|백화점|아울렛|쇼핑몰)/i, /(pharmacy|drugstore|hospital|clinic|gas\s*station|parking|bank|atm|grocery|supermarket|mall|gym|park|restroom|laundry|barber|salon|hotel|coffee)/i],
    navi: [/길\s*안내|길\s*좀|내비게이션|내비|네비게이션|네비|나비게이션|길\s*찾기|길찾기|길\s*찾아|가는\s*길|가는\s*법|가는\s*방법|어떻게\s*가|찾아\s*가|까지\s*가|로\s*가\s*(줘|자)|에\s*가\s*(줘|자)|데려다|목적지|경로|안내\s*해|출발|도착\s*(까지|하는)/, /(directions?\s*to|navigate\s*to|how\s*(do\s*i|to)\s*get\s*to|route\s*to|take\s*me\s*to|drive\s*to|way\s*to)/i],
    music: [/(틀어|틀러|들려|재생|플레이|듣고\s*싶|듣자|노래\s*(해|찾아|불러)|음악\s*(틀|켜|찾)|뮤비|뮤직비디오|노래\s*좀|음악\s*좀|한\s*곡)/, /(유튜브|유툽|유투브|유튜부|유투부|youtube|you\s*tube)/i, /\b(play|listen\s*to)\b.*\b(song|music|video|mv|playlist|album)\b|\b(youtube|yt)\b/i, /^\s*play\s+(?!.*\b(games?|store|station)\b)\S/i],
    shopWord: [/(쇼핑몰|쇼핑|최저가|가성비|판매처|구매|사고\s*싶|사\s*줘|살래|살\s*건데|어디서\s*(사|팔)|파는\s*(곳|데)|가격\s*(비교|좀|알려|얼마)|얼마|싸게|제일\s*싼|가장\s*싼|저렴|판매량|리뷰\s*많|할인|세일|특가|주문\s*하고\s*싶)/, /\b(buy|purchase|cheapest|best\s*price|price\s*of|how\s*much\s*(is|does)|deal|shop\s*for|shopping|order\s*online|amazon)\b/i],
    shopAsk: [/(추천|알려|골라|비교|어떤|뭐가\s*좋|뭐\s*살|살까)/, /\b(recommend|which|compare|best)\b/i],
    shopBuy: [/(가성비|최저가|리뷰|구매|판매량|베스트|제품|상품|모델|브랜드|저렴|쇼핑|얼마|만원|원대)/, /\b(product|brand|model|review|cheap|budget|under\s*\$?\d+)\b/i],
    call: [/(전화|통화|콜)/, /\b(call|phone|dial|ring)\b/i],
    sms: [/(문자|메시지|메세지|sms)/i, /\b(text|sms|message)\b/i],
    taxi: [/택시|탁시|카카오\s*t|카카오티|카카오\s*택시|우버|그랩/i, /\b(taxi|cab|uber|lyft|grab|ride)\b/i],
    train: [/(srt|ktx|기차|열차|코레일|고속철|무궁화|새마을|itx)/i, /\b(train|amtrak|rail(way)?|eurostar|shinkansen)\b/i],
    delivery: [/배민|배달의민족|요기요|쿠팡이츠|배달|배달\s*시켜|시켜\s*먹|시켜먹/, /\b(doordash|uber\s*eats|grubhub|deliver(y|ed)?|order\s*(food|pizza|takeout))\b/i],
    pay: [/토스|송금|이체|카카오\s*페이|네이버\s*페이/, /\b(send|pay|transfer|venmo|paypal|cash\s*app|zelle|upi|wire)\b/i],
    stay: [/(예약|숙박|묵을|묵고|\d+\s*박|체크인|빈\s*방|객실|방\s*잡)/, /\b(hotel|hostel|airbnb|book(ing)?\s*(a\s*)?(room|hotel|stay)|stay|nights?|check[- ]?in|accommodation|lodging|resort|motel)\b/i],
    flight: [/(항공권|비행기\s*(표|티켓|편|예약|예매|값|요금|최저가)|항공편|비행편|항공\s*(예약|예매)|비행기.*(예약|예매|끊어|알아봐|찾아|최저가)|비행기\s*타고)/, /\b(flights?|airfare|plane\s*tickets?|air\s*tickets?|fly\s+(to|from))\b/i],
    weather: [/(날씨|기온|일기\s*예보|강수|미세\s*먼지|초미세\s*먼지|자외선|체감\s*온도|비\s*(와|올까|오나|올래|소식)|눈\s*(와|올까|오나|소식)|우산\s*(챙|필요|가져))/, /\b(weather|forecast|temperature|will\s+it\s+rain|is\s+it\s+raining)\b/i],
    used: [/(중고(?!\s*등|생|교)|당근\s*마켓|당근\s*(에서|에|으로)|번개\s*장터|번장|중고\s*나라|리퍼\s*(제품|폰|상품)?)/, /\b(used|second[- ]?hand|pre[- ]?owned|refurbished)\b/i],
    rental: [/(렌터카|렌트카|렌트\s*카|차\s*렌트|차량\s*(렌트|대여)|자동차\s*대여|쏘카|그린카|카\s*셰어링)/, /\b(car\s*rental|rental\s*car|rent\s*a\s*car|car\s*hire|hire\s*a\s*car)\b/i],
    stayWord: [/(콘도|리조트|펜션|호텔|모텔|민박|게스트하우스|글램핑|캠핑|숙소|풀빌라|롯지|료칸)/, /\b(hotel|hostel|airbnb|resort|motel|inn|lodge|guesthouse|villa|cabin|apartment)\b/i]
  };
  function any(list, q) { var qn = String(q || "").replace(/\s+/g, ""); for (var i = 0; i < list.length; i++) if (list[i].test(q) || list[i].test(qn)) return true; return false; }
  function notQuestion(q) { return !/(방법|사용법|어떻게\s*(해|하는)|고장|수리|원리|뜻|의미|증상|차이점|뭐야|what\s*is|how\s*does|meaning|why)/i.test(q); }

  /* ── 금액·숫자 (포도톡 tossAmount + 달러) ── */
  function koToNum(s) { var d = { 영: 0, 공: 0, 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9, 한: 1, 두: 2, 세: 3, 네: 4 }, u = { 십: 10, 백: 100, 천: 1000, 만: 10000 }; var n = 0, cur = 0, big = 0; for (var i = 0; i < s.length; i++) { var c = s[i]; if (d[c] != null) cur = d[c]; else if (u[c] === 10000) { big = (big + cur) * 10000; cur = 0; n = 0; } else if (u[c]) { n += (cur || 1) * u[c]; cur = 0; } } return big + n + cur; }
  function amountOf(s) {
    s = String(s || "").replace(/,/g, "");
    var m = s.match(/\$\s*(\d+(?:\.\d+)?)/) || s.match(/(\d+(?:\.\d+)?)\s*(dollars?|bucks|usd|eur|euros?|gbp|pounds?|inr|rupees?|yen|¥|€|£)/i);
    if (m) return parseFloat(m[1]);
    m = s.match(/(\d+)\s*만\s*(?:(\d+)\s*천)?/); if (m) { var v = parseInt(m[1], 10) * 10000; if (m[2]) v += parseInt(m[2], 10) * 1000; return v; }
    m = s.match(/(\d{3,})\s*원/); if (m) return parseInt(m[1], 10);
    m = s.match(/([영공일이삼사오육칠팔구십백천만한두세네]+)\s*원/); if (m) { var n = koToNum(m[1]); if (n) return n; }
    if (/만\s*원/.test(s)) return 10000;
    m = s.match(/\b(\d{2,6})\b/); if (m && /(보내|송금|이체|send|pay|transfer)/i.test(s)) return parseInt(m[1], 10);
    return 0;
  }
  function numIn(q) { var m = (q || "").match(/(\+?\d[\d\-\s]{6,}\d)/); return m ? m[1].replace(/[^0-9+]/g, "") : ""; }

  /* ── 여는 곳: 나라별 ── */
  /* ── 나라별 서비스 표 (30개 주요 경제국) — 각 회사가 공개한 주소 형식·공개 페이지만 ──
     지도: Google Maps URLs (KR 네이버지도, CN 高德 URI API — 구글이 막혀 있음)
     택시: Uber 운영국은 Uber 유니버설 링크, 그 외는 Google Maps 길찾기(택시 앱 공개 링크가 없는 나라: 동남아 Grab·중국 DiDi·브라질 99 등)
     기차: 각국 국영/대표 철도 예매 사이트 홈, 없으면 Google Maps 대중교통
     배달: Uber Eats 운영국은 Uber Eats 검색, 미국·캐나다·호주 DoorDash, 동남아 GrabFood 나라 페이지, 그 외 Google Maps "배달" 검색 */
  var UBER = { GR:1, HU:1, SK:1, HR:1, US:1, CA:1, GB:1, IE:1, FR:1, DE:1, ES:1, IT:1, NL:1, BE:1, CH:1, AT:1, PL:1, SE:1, TR:1, AU:1, NZ:1, JP:1, HK:1, TW:1, IN:1, SA:1, AE:1, MX:1, BR:1, AR:1, ZA:1 };
  var UBEREATS = { US:1, CA:1, GB:1, IE:1, FR:1, DE:1, ES:1, IT:1, NL:1, BE:1, CH:1, SE:1, PL:1, AU:1, NZ:1, JP:1, TW:1, HK:1, MX:1, BR:1, SA:1, AE:1, ZA:1 };
  var GRABFOOD = { SG:"sg", TH:"th", VN:"vn", ID:"id", MY:"my", PH:"ph" };
  var WOLT = { GR:"grc", HU:"hun", SK:"svk", HR:"hrv", RS:"srb", SI:"svn" };   /* wolt.com/en/<ISO3> 나라 페이지(확인됨) */
  var GLOVO = { BG:"bg", MD:"md" };                                            /* glovoapp.com/<cc>/ (확인됨) */
  var TRAIN = { US:["https://www.amtrak.com/","Amtrak"], CA:["https://www.viarail.ca/","VIA Rail"], JP:["https://smart-ex.jp/","신칸센 EX"], GB:["https://www.thetrainline.com/","Trainline"],
    DE:["https://www.bahn.de/","DB"], FR:["https://www.sncf-connect.com/","SNCF"], ES:["https://www.renfe.com/","Renfe"], IT:["https://www.trenitalia.com/","Trenitalia"], NL:["https://www.ns.nl/","NS"],
    BE:["https://www.belgiantrain.be/","SNCB"], CH:["https://www.sbb.ch/","SBB"], AT:["https://www.oebb.at/","ÖBB"], SE:["https://www.sj.se/","SJ"], PL:["https://www.intercity.pl/","PKP Intercity"],
    TR:["https://ebilet.tcddtasimacilik.gov.tr/","TCDD"], IN:["https://www.irctc.co.in/","IRCTC"], CN:["https://www.12306.cn/","12306"], TW:["https://www.thsrc.com.tw/","台灣高鐵"], HK:["https://www.mtr.com.hk/","MTR"],
    GR:["https://www.hellenictrain.gr/","Hellenic Train"], HU:["https://jegy.mav.hu/","MÁV"], SK:["https://www.zssk.sk/","ZSSK"], BG:["https://www.bdz.bg/","БДЖ"], HR:["https://www.hzpp.hr/","HŽPP"], RS:["https://srbvoz.rs/","Srbijavoz"], SI:["https://potniski.sz.si/","SŽ"], MD:["https://www.cfm.md/","CFM"], BY:["https://pass.rw.by/","БЧ"],
    ID:["https://www.kai.id/","KAI"], MY:["https://www.ktmb.com.my/","KTMB"], TH:["https://www.dticket.railway.co.th/","SRT 태국철도"], VN:["https://dsvn.vn/","베트남철도"], SA:["https://www.sar.com.sa/","SAR"] };
  function gmapsOk(c) { return c !== "CN"; }   /* 중국 본토는 구글 서비스가 막혀 있음 */
  function mapsSearch(q, c) {
    if (c === "KR") return { u: "https://map.naver.com/p/search/" + E(q), w: "📍 네이버지도" };
    if (c === "CN") return { u: "https://uri.amap.com/search?keyword=" + E(q) + "&view=map&src=coverfo", w: "📍 高德地图" };   /* 高德 URI API(공식) */
    /* 아이폰도 Google Maps 우선(공식 Maps URLs). 앱이 없으면 웹 지도가 열린다 */
    return { u: "https://www.google.com/maps/search/?api=1&query=" + E(q), w: "📍 Google Maps" };
  }
  function mapsDir(dest, c) {
    if (c === "KR") return { u: "https://map.naver.com/p/search/" + E(dest), w: "🧭 네이버지도 길찾기" };
    if (c === "CN") return { u: "https://uri.amap.com/search?keyword=" + E(dest) + "&view=map&src=coverfo", w: "🧭 高德地图", note: "중국은 구글 지도가 막혀 있어 高德 검색으로 엽니다. 길안내는 지도 안에서 눌러 주세요." };
    /* 기본은 자동차(2026-10-06 결정). dir_action=navigate = Google 공개 Maps URLs 의 '바로 길안내 시작' 값 */
    return { u: "https://www.google.com/maps/dir/?api=1&destination=" + E(dest) + "&travelmode=driving&dir_action=navigate", w: "🧭 Google Maps 내비" };
  }
  /* ── 쇼핑 법적 안전 (2026-10 v7) ──
     · 제재 대상국(RU IR KP SY CU VE BY): 검색어 낱말이 아니라 '나라 값'으로만 막는다 ("노트북이란" 같은 문장이 걸리지 않게)
     · 개인정보: 카드번호·주민번호·전화·이메일·여권·주소의 '실제 형식'이 보이면 검색하지 않는다 ("phone", "이름" 같은 낱말로는 안 막음)
     · 검색어는 서버로 보내지 않는다 — 링크는 브라우저(홈 화면 cf-shop)에서 만든다 */
  var SANCTIONED = { RU: 1, IR: 1, KP: 1, SY: 1, CU: 1, VE: 1, BY: 1 };
  function luhn(d) { var s = 0, alt = false; for (var i = d.length - 1; i >= 0; i--) { var n = d.charCodeAt(i) - 48; if (alt) { n *= 2; if (n > 9) n -= 9; } s += n; alt = !alt; } return s % 10 === 0; }
  function piiKind(t, forStay) {
    t = String(t || "");
    if (/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/.test(t)) return "이메일";
    var cm = t.match(/(?:\d[ \-]?){14,18}\d/g) || [];
    for (var i = 0; i < cm.length; i++) { var d = cm[i].replace(/\D/g, ""); if ((d.length === 15 || d.length === 16) && luhn(d)) return "카드번호"; }
    /* 주민번호: 앞 6자리(생년월일)-뒤 7자리. 붙여 쓴 13자리는 상품 바코드(880…)와 같아 '-' 나 띄어쓰기가 있을 때만 */
    if (/(^|[^\d])\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[ \-][1-8]\d{6}([^\d]|$)/.test(t)) return "주민등록번호";
    if (/(^|[^\d])01[016789][ \-.]?\d{3,4}[ \-.]?\d{4}([^\d]|$)/.test(t) || /(^|[^\d])0\d{1,2}-\d{3,4}-\d{4}([^\d]|$)/.test(t) || /\+\d{1,3}[ \-]?\d[\d \-]{6,}\d/.test(t)) return "전화번호";
    if (/(^|[^A-Za-z0-9])[MSRGD]\d{8}([^A-Za-z0-9]|$)/.test(t) || /(^|[^A-Za-z0-9])[MSRGD]\d{3}[A-Z]\d{4}([^A-Za-z0-9]|$)/.test(t) || /(여권|passport)\s*(번호|no\.?|number)?\s*[:：]?\s*[A-Za-z0-9]{7,9}/i.test(t)) return "여권번호";
    if (forStay && (/\d+\s*동\s*\d+\s*호/.test(t) || /주소\s*[:：]/.test(t))) return "주소";
    if (forStay) return "";   /* 숙소: 호텔·지역의 도로명 주소는 찾으려는 장소이지 개인정보가 아님 */
    if (/(구|군)\s+[가-힣0-9]+(로|길)\s*\d+/.test(t) || /\d+\s*동\s*\d+\s*호/.test(t) || /주소\s*[:：]/.test(t) || /\b\d{1,5}\s+[A-Za-z0-9.' ]{2,30}\s(street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|lane|ln\.?|drive|dr\.?)(\s|,|$)/i.test(t)) return "주소";
    return "";
  }
  function shop(q, c, raw) {
    if (SANCTIONED[c]) return { u: "", w: "쇼핑", none: "이 지역에서는 쇼핑 연결을 제공하지 않습니다 (국제 제재 대상 지역)." };
    var pk = piiKind(raw || q) || piiKind(q);
    if (pk) return { u: "", w: "쇼핑", none: pk + " 같은 개인정보가 들어 있어 검색하지 않았어요. 상품 이름만 적어 주세요. (coverfo는 개인정보를 저장하지 않습니다)" };
    /* 네이버쇼핑(search.shopping.naver.com)은 로그인하지 않으면 로그인·보안확인 화면으로 돌려보냄이 실측으로 확인돼(2026-10-05) 쓰지 않는다. 막힌 곳을 우회하지 않고, 누구나 여는 네이버 통합검색으로 연결한다 */
    if (c === "KR") return { u: "https://search.naver.com/search.naver?where=nexearch&query=" + E(q + " 최저가"), w: "🛒 네이버 검색", shop: { q: q, c: c } };
    if (c === "CN") return { u: "", w: "쇼핑", none: "중국 본토에서는 구글 쇼핑을 열 수 없어요. 타오바오·징둥 앱에서 직접 검색해 주세요." };
    /* 한국 밖: Google 쇼핑 탭 (구글 자체 검색 주소). 쇼핑 화면(cf-shop)이 있으면 그 화면에서 여러 곳을 고르게 한다 */
    return { u: "https://www.google.com/search?tbm=shop&q=" + E(q), w: "🛒 Google 쇼핑", shop: { q: q, c: c } };
  }
  /* ── 택시(v15): 한국·Uber 나라·동남아 Grab 나라는 택시 화면(cf-taxi)에서 앱을 고른다. 그 밖은 지금처럼 바로 연다 ──
     · 크롤링 없음: 각 회사가 공개한 앱 링크만 연다. 호출·결제는 각 앱에서 이용자가 직접(coverfo 는 요금을 받지 않음).
     · coverfo 는 이용자 위치를 받지 않는다. 출발지는 각 앱이 잡고, 도착지 이름만 링크에 넣는다(Uber 공식 유니버설 링크).
     · 제휴(나중에): Secret UBER_AFF_LINK·GRAB_AFF_LINK 를 넣으면 그 링크로 연다(배달과 같은 규칙, /api/shop-ids).
     · 제재국은 나라 값으로, 개인정보(전화·이메일·카드·"○동 ○호" 등)는 실제 형식으로 막는다. 도착지 도로명·장소 이름은 막지 않는다. */
  var GRAB_RIDE = { SG:1, MY:1, TH:1, VN:1, ID:1, PH:1, KH:1, MM:1 };
  function taxi(dest, c, raw) {
    if (SANCTIONED[c]) return { u: "", w: "택시", none: "이 지역에서는 택시 연결을 제공하지 않습니다 (국제 제재 대상 지역)." };
    var pk = piiKind(raw || dest, true);
    if (pk) return { u: "", w: "택시", none: pk + " 같은 개인정보가 들어 있어 열지 않았어요. 도착지(장소 이름)만 적어 주세요. 출발지·연락처는 택시 앱에서 직접 입력해 주세요. (coverfo는 개인정보를 저장하지 않습니다)" };
    dest = String(dest || "").replace(/^\s*(to|for)\s+/i, "").trim();   /* "taxi to Tokyo Tower" → "Tokyo Tower" */
    var res;
    if (c === "KR") { res = isIOS() ? { u: "https://apps.apple.com/kr/app/id981110422", w: "🚕 카카오T (앱스토어)", note: "아이폰은 카카오T 공개 링크가 없어 앱 설치/열기 화면으로 갑니다." } : { u: "intent://launch#Intent;scheme=kakaot;package=com.kakao.taxi;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.kakao.taxi;end", w: "🚕 카카오T" }; /* v23: 휴대폰이면 택시 화면 없이 카카오T 앱을 바로 연다(자동화 열기). 카카오T 는 도착지를 채우는 공개 링크가 없어 앱의 "어디로 갈까요?"에서 입력. PC 는 앱이 없으므로 화면을 보여 준다 */ if (isAndroid() || isIOS()) { if (dest) res.note = "앱의 '어디로 갈까요?'에 도착지(" + dest + ")를 입력해 주세요"; return res; } res.taxi = { dest: dest, c: c }; return res; }
    if (UBER[c]) {
      /* Uber 공식 유니버설 링크 (목적지만 채워짐 · 호출 확인은 본인이) */
      var u = "https://m.uber.com/ul/?action=setPickup&pickup=my_location" + (dest ? "&dropoff[formatted_address]=" + E(dest) : "");
      /* v24: 휴대폰이면 화면 없이 Uber 를 바로 연다(도착지 채움). 단 제휴 링크(UBER_AFF_LINK)가 켜져 있으면 제휴 표시가 필요하므로 화면을 보여 준다 */
      if ((isAndroid() || isIOS()) && !affOn("uber")) return { u: u, w: "🚕 Uber", note: dest ? "도착지(" + dest + ")가 채워져 열려요. 확인 후 호출해 주세요" : "앱에서 도착지를 입력해 주세요" };
      return { u: u, w: "🚕 Uber", alt: c === "US" ? { u: "https://ride.lyft.com/", w: "Lyft (홈)" } : undefined, taxi: { dest: dest, c: c } };
    }
    if (c === "CN") return { u: "", w: "택시", none: "중국은 디디(滴滴) 공개 링크가 없어 앱에서 직접 불러 주세요." };
    /* Grab(동남아): 공개 호출 링크가 없어 앱을 연다(안드로이드 com.grabtaxi.passenger · 아이폰 App Store id647268330). 도착지는 앱에서 */
    if (GRAB_RIDE[c]) return { u: isIOS() ? "https://apps.apple.com/app/id647268330" : isAndroid() ? "intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=com.grabtaxi.passenger;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.grabtaxi.passenger;end" : "https://www.grab.com/", w: "🚕 Grab", note: dest ? "앱에서 도착지(" + dest + ")를 입력해 주세요" : "앱에서 도착지를 입력해 주세요", taxi: (isAndroid() || isIOS()) && !affOn("grab") ? undefined : { dest: dest, c: c, grab: 1 } };   /* v24: 휴대폰이면 Grab 앱 바로 열기(제휴가 켜져 있으면 표시를 위해 화면) */
    /* 99(브라질) 등 그 밖은 공개 호출 링크가 없음 → 목적지까지 길찾기만 */
    return dest ? { u: "https://www.google.com/maps/dir/?api=1&destination=" + E(dest), w: "🧭 Google Maps 길찾기", note: "이 나라는 택시 앱 공개 링크가 없어 길찾기로 엽니다. 호출은 Grab 등 현지 앱에서." } : { u: "", w: "택시", none: "이 나라는 택시 앱 공개 링크가 없어요. Grab 등 현지 앱에서 불러 주세요." };
  }
  /* ── 기차(v17): 한국·유럽·동남아는 기차 화면(cf-train)에서 예매 사이트를 고른다. 그 밖은 지금처럼 그 나라 공식 사이트(또는 지도)를 바로 연다 ──
     · 한국: KTX·SRT 통합(2026-09-01) — 코레일+ 앱(com.korail.talk · iOS id1000558562) + korail.com 예매 화면. 구간을 채우는 공개 링크가 없어 앱·사이트에서 선택. 도착역 길안내.
     · 유럽·영국: 그 나라 공식 철도 사이트 + Trainline + Google Maps 대중교통. 동남아: 공식 철도 사이트 + 12Go + Google Maps 대중교통.
     · 제휴(나중에): Secret TRAINLINE_AFF_LINK·TWELVEGO_AFF_LINK 를 넣으면 그 링크로 연다(배달·택시와 같은 규칙, /api/shop-ids).
     · 예매·결제·승객 정보 입력은 각 사이트에서 이용자가 직접. 제재국·개인정보(전화·이메일·카드·여권 등)는 먼저 막는다. */
  var TRAIN_EU = { GB:1, IE:1, DE:1, FR:1, ES:1, IT:1, NL:1, BE:1, CH:1, AT:1, SE:1, PL:1, PT:1, CZ:1, DK:1, NO:1 };
  var TRAIN_SEA = { TH:1, VN:1, MY:1, ID:1, KH:1, LA:1, PH:1, SG:1, MM:1 };
  /* 날짜(오늘·내일·모레·글피·N월 N일·N일)와 인원(N명·N인·어른 N) — 예매 사이트 주소에 채울 수 있는 곳(SRT)만 쓴다 */
  function trainWhen(q) {
    var s = String(q || ""), d = new Date(), y, m, dd, people = 0, w;
    d.setHours(0, 0, 0, 0);
    if (/글피/.test(s)) d.setDate(d.getDate() + 3); else if (/모레/.test(s)) d.setDate(d.getDate() + 2); else if (/내일/.test(s)) d.setDate(d.getDate() + 1);
    if ((w = s.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/))) { m = +w[1] - 1; dd = +w[2]; y = d.getFullYear(); var t1 = new Date(y, m, dd); if (t1 < new Date(new Date().setHours(0, 0, 0, 0))) t1 = new Date(y + 1, m, dd); d = t1; }
    else if ((w = s.match(/(^|\s)(\d{1,2})\s*일(?=\s|$|에|날)/))) { var t2 = new Date(d.getFullYear(), new Date().getMonth(), +w[2]); if (t2 < new Date(new Date().setHours(0, 0, 0, 0))) t2.setMonth(t2.getMonth() + 1); d = t2; }
    if ((w = s.match(/(어른|성인|adults?)?\s*(\d{1,2})\s*(명|인|사람|adults?|people|persons?|pax)/i))) people = +w[2];
    var p2 = function (n) { return (n < 10 ? "0" : "") + n; };
    return { date: d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()), people: people > 0 && people <= 9 ? people : 1, dated: /(오늘|내일|모레|글피|\d\s*일)/.test(s) };
  }
  function trainRoute(q) {
    var t = String(q || "").replace(/(오늘|내일|모레|글피|\d{1,2}\s*월\s*\d{1,2}\s*일|(^|\s)\d{1,2}\s*일(?=\s|$)|(어른|성인)?\s*\d{1,2}\s*(명|인|사람)|\d{1,2}\s*(adults?|people|persons?|pax))/gi, " ").replace(/(srt|ktx|itx|기차|열차|코레일|고속철도?|무궁화호?|새마을호?|예매|예약|승차권|기차표|표|끊어\s*줘?|타고\s*가(자|고|줘)?|알려\s*줘?|해\s*줘?|줘|좀|시간표|편도|왕복)/gi, " ")
      .replace(/\b(train|trains|amtrak|rail(way)?|eurostar|shinkansen|tickets?|book(ing)?|buy|a|the|please|one[- ]way|return)\b/gi, " ").replace(/\s+/g, " ").trim();
    var m = t.match(/^(.*?\S)\s*에서\s+(.+?)(까지|행|가는|으로|로)?$/) || t.match(/\bfrom\s+(.+?)\s+to\s+(.+)$/i) || t.match(/^(.+?)\s+to\s+(.+)$/i) || t.match(/^(\S+)\s*(?:→|->|-|~)\s*(\S+)$/);
    if (m) return { from: m[1].trim(), to: String(m[2]).replace(/(까지|행|가는|으로|로)$/, "").trim() };
    var d = t.replace(/(까지|행|가는|으로|로)$/, "").replace(/^(to|for)\s+/i, "").trim();
    return { from: "", to: d.length >= 2 ? d : "" };
  }
  function train(q, c, raw) {
    if (SANCTIONED[c]) return { u: "", w: "기차", none: "이 지역에서는 기차 예매 연결을 제공하지 않습니다 (국제 제재 대상 지역)." };
    var pk = piiKind(raw || q, true);
    if (pk) return { u: "", w: "기차", none: pk + " 같은 개인정보가 들어 있어 열지 않았어요. 출발역·도착역만 적어 주세요. 이름·연락처·결제 정보는 예매 사이트에서 직접 입력해 주세요. (coverfo는 개인정보를 저장하지 않습니다)" };
    var rt = trainRoute(q), wh = trainWhen(q), res;
    if (c === "KR") { res = { u: "https://www.korail.com/ticket/search/general", w: "🚄 기차 예매" };   /* 2026-09-01 KTX·SRT 통합: SRT 홈페이지·앱 종료, 예매는 코레일+ 앱·korail.com */ res.train = { from: rt.from, to: rt.to, c: c, srt: /srt|수서/i.test(q), date: wh.date, people: wh.people }; return res; }
    if (TRAIN_EU[c] || TRAIN_SEA[c]) return { u: TRAIN[c] ? TRAIN[c][0] : (TRAIN_EU[c] ? "https://www.thetrainline.com/" : "https://12go.asia/en"), w: "🚄 " + (TRAIN[c] ? TRAIN[c][1] : TRAIN_EU[c] ? "Trainline" : "12Go"), train: { from: rt.from, to: rt.to, c: c, eu: !!TRAIN_EU[c], sea: !!TRAIN_SEA[c], off: TRAIN[c] || null, date: wh.date, people: wh.people } };
    /* v28: 해외는 앱을 열지 않고 공식 사이트만 연다(입력·예매·결제는 이용자가 그 사이트에서 직접) */
    if (TRAIN[c]) return { u: TRAIN[c][0], w: "🚄 " + TRAIN[c][1] };
    if (!gmapsOk(c)) return { u: "", w: "기차", none: "이 나라의 기차 예매 사이트가 등록돼 있지 않아요." };
    return { u: "https://www.google.com/maps/dir/?api=1&travelmode=transit&destination=" + E(q), w: "🚄 Google Maps 대중교통" };
  }
  /* ── 항공권(v18): 항공권 화면(cf-flight)에서 검색 사이트를 고른다 (전에는 규칙이 없어 채팅으로 넘어갔음) ──
     · 네이버 항공권(한국): flight.naver.com/flights/{international|domestic}/출발-도착-YYYYMMDD[/도착-출발-YYYYMMDD]?adult=N&fareType=Y|YC (네이버가 쓰는 공개 주소 형식)
     · Expedia: /go/flight/search/{oneway|roundtrip}/시작일/종료일?load=1&FromAirport&ToAirport&NumAdult (Expedia Group 공식 deeplink 문서)
     · Skyscanner: /transport/flights/출발/도착/YYMMDD[/YYMMDD]/?adultsv2=N · Google 항공편: travel/flights?q=문장 — 널리 쓰이는 공개 형식(폰 확인 필요)
     · 제휴(나중에): Secret SKYSCANNER_AFF_LINK·EXPEDIA_AFF_LINK ({url} 규칙). 예약·결제·여권·생년월일·카드 입력은 각 사이트에서 직접(coverfo 는 예약 정보 PNR 포함 아무것도 저장 안 함).
     · 제재국·개인정보(여권·전화·이메일·카드 등)는 번역기로 보내기 전에 막는다. */
  var IATA = { "서울": "SEL", "인천": "ICN", "김포": "GMP", "제주": "CJU", "제주도": "CJU", "부산": "PUS", "김해": "PUS", "대구": "TAE", "광주": "KWJ", "청주": "CJJ", "여수": "RSU", "울산": "USN", "포항": "KPO", "양양": "YNY", "무안": "MWX", "군산": "KUV", "원주": "WJU", "사천": "HIN", "진주": "HIN",
    "도쿄": "TYO", "동경": "TYO", "나리타": "NRT", "하네다": "HND", "오사카": "OSA", "간사이": "KIX", "후쿠오카": "FUK", "삿포로": "CTS", "오키나와": "OKA", "나고야": "NGO", "교토": "OSA", "마쓰야마": "MYJ", "구마모토": "KMJ",
    "베이징": "BJS", "북경": "BJS", "상하이": "SHA", "상해": "SHA", "칭다오": "TAO", "청도": "TAO", "홍콩": "HKG", "마카오": "MFM", "타이베이": "TPE", "대만": "TPE", "가오슝": "KHH",
    "방콕": "BKK", "치앙마이": "CNX", "푸켓": "HKT", "다낭": "DAD", "하노이": "HAN", "호치민": "SGN", "나트랑": "CXR", "냐짱": "CXR", "푸꾸옥": "PQC", "달랏": "DLI", "세부": "CEB", "마닐라": "MNL", "보라카이": "KLO", "보홀": "TAG", "클락": "CRK",
    "싱가포르": "SIN", "쿠알라룸푸르": "KUL", "코타키나발루": "BKI", "발리": "DPS", "자카르타": "JKT", "비엔티안": "VTE", "프놈펜": "PNH", "씨엠립": "SAI", "울란바토르": "UBN",
    "뉴욕": "NYC", "로스앤젤레스": "LAX", "엘에이": "LAX", "샌프란시스코": "SFO", "시애틀": "SEA", "하와이": "HNL", "호놀룰루": "HNL", "괌": "GUM", "사이판": "SPN", "라스베이거스": "LAS", "시카고": "CHI", "워싱턴": "WAS", "보스턴": "BOS", "애틀랜타": "ATL", "댈러스": "DFW", "밴쿠버": "YVR", "토론토": "YTO",
    "런던": "LON", "파리": "PAR", "로마": "ROM", "프랑크푸르트": "FRA", "바르셀로나": "BCN", "마드리드": "MAD", "이스탄불": "IST", "암스테르담": "AMS", "프라하": "PRG", "취리히": "ZRH", "뮌헨": "MUC", "베를린": "BER", "밀라노": "MIL", "비엔나": "VIE", "빈": "VIE",
    "시드니": "SYD", "멜버른": "MEL", "브리즈번": "BNE", "오클랜드": "AKL", "두바이": "DXB", "델리": "DEL", "뭄바이": "BOM",
    "seoul": "SEL", "incheon": "ICN", "gimpo": "GMP", "jeju": "CJU", "busan": "PUS", "tokyo": "TYO", "osaka": "OSA", "fukuoka": "FUK", "sapporo": "CTS", "okinawa": "OKA", "beijing": "BJS", "shanghai": "SHA", "hong kong": "HKG", "taipei": "TPE",
    "bangkok": "BKK", "chiang mai": "CNX", "phuket": "HKT", "da nang": "DAD", "danang": "DAD", "hanoi": "HAN", "ho chi minh": "SGN", "saigon": "SGN", "cebu": "CEB", "manila": "MNL", "singapore": "SIN", "kuala lumpur": "KUL", "bali": "DPS", "jakarta": "JKT",
    "new york": "NYC", "nyc": "NYC", "los angeles": "LAX", "la": "LAX", "san francisco": "SFO", "seattle": "SEA", "honolulu": "HNL", "hawaii": "HNL", "guam": "GUM", "las vegas": "LAS", "chicago": "CHI", "washington": "WAS", "boston": "BOS", "atlanta": "ATL", "dallas": "DFW", "miami": "MIA", "orlando": "MCO", "vancouver": "YVR", "toronto": "YTO",
    "london": "LON", "paris": "PAR", "rome": "ROM", "frankfurt": "FRA", "barcelona": "BCN", "madrid": "MAD", "istanbul": "IST", "amsterdam": "AMS", "prague": "PRG", "zurich": "ZRH", "munich": "MUC", "berlin": "BER", "milan": "MIL", "vienna": "VIE",
    "sydney": "SYD", "melbourne": "MEL", "brisbane": "BNE", "auckland": "AKL", "dubai": "DXB", "delhi": "DEL", "mumbai": "BOM" };
  var KR_AIR = { SEL: 1, ICN: 1, GMP: 1, CJU: 1, PUS: 1, TAE: 1, KWJ: 1, CJJ: 1, RSU: 1, USN: 1, KPO: 1, YNY: 1, MWX: 1, KUV: 1, WJU: 1, HIN: 1 };
  function iata(name) {
    var n = String(name || "").trim(), l = n.toLowerCase().replace(/\s+/g, " ");
    if (/^[A-Z]{3}$/.test(n)) return n;
    if (IATA[l]) return IATA[l];
    var k = l.replace(/(국제)?공항$|\s*airport$|도$|시$/, "").trim();
    return IATA[k] || "";
  }
  function flightDates(q) {
    var s = String(q || ""), out = [], now = new Date(); now.setHours(0, 0, 0, 0);
    var p2 = function (n) { return (n < 10 ? "0" : "") + n; }, fmt = function (d) { return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); };
    var add = function (n) { var d = new Date(now); d.setDate(d.getDate() + n); out.push(fmt(d)); };
    var MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    s = s.replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{1,2})\b/gi, function (x, mo, d) { return MON[mo.toLowerCase()] + "/" + d; });
    var re = /(오늘|내일|모레|글피|(\d{1,2})\s*월\s*(\d{1,2})\s*일|(\d{1,2})\s*\/\s*(\d{1,2}))/g, m;
    while ((m = re.exec(s)) && out.length < 2) {
      if (m[1] === "오늘") add(0); else if (m[1] === "내일") add(1); else if (m[1] === "모레") add(2); else if (m[1] === "글피") add(3);
      else { var mo = +(m[2] || m[4]) - 1, da = +(m[3] || m[5]), d = new Date(now.getFullYear(), mo, da); if (d < now) d.setFullYear(d.getFullYear() + 1); if (d.getMonth() === mo) out.push(fmt(d)); }
    }
    var nights = s.match(/(\d{1,2})\s*박/);
    if (out.length === 1 && nights) { var r = new Date(out[0] + "T00:00:00"); r.setDate(r.getDate() + +nights[1]); out.push(fmt(r)); }
    var guessed = false;
    if (!out.length) { add(7); guessed = true; }   /* "다음주" 등 날짜가 정확하지 않으면 일주일 뒤로 채우고 화면에 "날짜는 사이트에서 확인" 표시 */
    if (out.length === 2 && out[1] < out[0]) out.pop();
    var ppl = s.match(/(어른|성인|adults?)?\s*(\d{1,2})\s*(명|인|사람|adults?|people|persons?|pax)/i);
    return { dep: out[0], ret: out[1] || "", guessed: guessed, adults: ppl && +ppl[2] > 0 && +ppl[2] <= 9 ? +ppl[2] : 1, round: !!out[1] || /왕복|round\s*trip|return/i.test(s) };
  }
  function flightRoute(q) {
    var t = String(q || "").replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{1,2}\b/gi, " ").replace(/(다음\s*주(말)?|이번\s*주(말)?|다음\s*달|주말|오늘|내일|모레|글피|\d{1,2}\s*월\s*\d{1,2}\s*일|\d{1,2}\s*\/\s*\d{1,2}|\d{1,2}\s*박(\s*\d{1,2}\s*일)?|(어른|성인)?\s*\d{1,2}\s*(명|인|사람)|\d{1,2}\s*(adults?|people|persons?|pax))/gi, " ")
      .replace(/(항공권|비행기\s*(표|티켓|편)?|항공편|비행편|항공|예약|예매|최저가|가장\s*싼|싼|저렴한|편도|왕복|끊어\s*줘?|알아\s*봐\s*줘?|찾아\s*줘?|알려\s*줘?|해\s*줘?|줘|좀|타고|가는|가고\s*싶어|값|요금)/g, " ")
      .replace(/\b(cheap(est)?|flights?|airfare|plane|air|tickets?|book(ing)?|a|the|please|one[- ]way|round[- ]?trip|return|find|me|search|for|fly)\b/gi, " ").replace(/(^|\s)(부터|까지|에|에서부터)(?=\s|$)/g, " ").replace(/\s+/g, " ").trim();
    var m = t.match(/^(.*?\S)\s*에서\s+(.+?)(까지|행|으로|로)?$/) || t.match(/^from\s+(.+?)\s+to\s+(.+)$/i) || t.match(/^(.+?)\s+to\s+(.+)$/i) || t.match(/^(\S+)\s*(?:→|->|-|~)\s*(\S+)$/);
    if (m) return { from: m[1].trim(), to: String(m[2]).replace(/(까지|행|으로|로)$/, "").trim() };
    var d = t.replace(/(까지|행|으로|로)$/, "").replace(/^(to|from)\s+/i, "").trim();
    return { from: "", to: d };
  }
  function flight(q, c, raw) {
    if (SANCTIONED[c]) return { u: "", w: "항공권", none: "이 지역에서는 항공권 연결을 제공하지 않습니다 (국제 제재 대상 지역)." };
    var pk = piiKind(raw || q, true);
    if (pk) return { u: "", w: "항공권", none: pk + " 같은 개인정보가 들어 있어 열지 않았어요. 출발·도착 도시만 적어 주세요. 여권·연락처·결제 정보는 예약 사이트에서 직접 입력해 주세요. (coverfo는 개인정보를 저장하지 않습니다)" };
    var rt = flightRoute(q), dt = flightDates(q), to = iata(rt.to), fr = iata(rt.from);
    if (!fr && c === "KR") fr = KR_AIR[to] ? "GMP" : "ICN";   /* 출발지를 안 말하면 한국은 국내선=김포, 국제선=인천 */
    if (fr === "SEL" && to && !KR_AIR[to]) fr = "ICN"; if (to === "SEL" && fr && !KR_AIR[fr]) to = "ICN";
    if (fr === "SEL" && KR_AIR[to]) fr = "GMP"; if (to === "SEL" && KR_AIR[fr]) to = "GMP";
    var info = { from: rt.from, to: rt.to, fc: fr, tc: to, dep: dt.dep, ret: dt.round ? dt.ret : "", guessed: dt.guessed, adults: dt.adults, c: c, dom: !!(KR_AIR[fr] && KR_AIR[to]) };
    return { u: "https://www.google.com/travel/flights", w: "✈️ 항공권", flight: info };
  }
  /* ── 날씨(v19): 한국은 날씨 화면(cf-weather: 네이버 날씨·기상청 날씨누리·Google), 그 밖의 나라는 Google 날씨 검색을 바로 연다 ──
     · 공개 검색 주소만 연다(크롤링 없음). 지역 이름만 검색어로 쓰고 저장하지 않는다. 위치(GPS)는 받지 않는다 — 지역을 안 말하면 각 서비스가 직접 판단.
     · 제재국·개인정보는 다른 기능과 같이 먼저 막는다. */
  function weatherInfo(q) {
    var s = String(q || ""), when = /모레/.test(s) ? "모레" : /내일|tomorrow/i.test(s) ? "내일" : /주말|weekend/i.test(s) ? "주말" : /이번\s*주|this\s*week|주간/i.test(s) ? "이번 주" : "";
    var place = s.replace(/(날씨|기온|일기\s*예보|강수(량|확률)?|초?미세\s*먼지|자외선|체감\s*온도|비|눈|우산|와\?*|올까\?*|오나\?*|올래\?*|소식|챙겨야\s*(해|돼|할까)\?*|필요해\?*|가져가야\s*(해|돼|할까)?\?*|어때\?*|어떄|알려\s*줘?|좀|해\s*줘?|오늘|내일|모레|주말|이번\s*주|주간|지금|현재|\?)/g, " ")
      .replace(/\b(weather|forecast|temperature|will|it|rain|raining|is|in|for|the|today|tomorrow|weekend|this|week|what's|whats|how's|hows|what|how|now)\b/gi, " ")
      .replace(/(^|\s)(의|에|은|는|도)(?=\s|$)/g, " ").replace(/(\S{2,})(의|에서|에)(?=\s|$)/g, "$1").replace(/\s+/g, " ").trim();
    return { place: place, when: when, dust: /미세\s*먼지/.test(s) };
  }
  function weather(q, c, raw) {
    if (SANCTIONED[c]) return { u: "", w: "날씨", none: "이 지역에서는 날씨 연결을 제공하지 않습니다 (국제 제재 대상 지역)." };
    var pk = piiKind(raw || q, true);
    if (pk) return { u: "", w: "날씨", none: pk + " 같은 개인정보가 들어 있어 열지 않았어요. 지역 이름만 적어 주세요. (coverfo는 개인정보를 저장하지 않습니다)" };
    var wi = weatherInfo(q);
    if (c === "KR") return { u: "https://search.naver.com/search.naver?query=" + E((wi.place ? wi.place + " " : "") + (wi.when ? wi.when + " " : "") + (wi.dust ? "미세먼지" : "날씨")), w: "🌤 네이버 날씨", weather: { place: wi.place, when: wi.when, dust: wi.dust, c: c } };
    if (c === "CN") return { u: "", w: "날씨", none: "중국은 구글이 막혀 있어 휴대폰 날씨 앱을 써 주세요." };
    return { u: "https://www.google.com/search?q=" + E("weather " + (wi.place || "") + (wi.when === "내일" ? " tomorrow" : wi.when === "주말" ? " weekend" : "")), w: "🌤 Google 날씨" };
  }
  /* ── 중고거래(v20): 중고 화면(cf-used)에서 여러 중고 앱을 같은 검색어로 비교 ──
     · 한국: 당근(daangn.com/kr/buy-sell/?search=) · 번개장터(m.bunjang.co.kr/search/products?q=) · 중고나라(web.joongna.com/search/검색어) — 각 사이트가 쓰는 공개 검색 주소.
     · 해외: eBay 검색(_nkw). 제휴는 Secret EBAY_AFF_LINK({url} 규칙, eBay Partner Network)을 넣었을 때만.
     · 거래·채팅·결제는 각 앱에서 직접(coverfo 는 중개하지 않음). 전화·계좌·주소 등 개인정보와 제재국은 먼저 막는다. */
  var EBAY = { US: "www.ebay.com", GB: "www.ebay.co.uk", DE: "www.ebay.de", FR: "www.ebay.fr", IT: "www.ebay.it", ES: "www.ebay.es", CA: "www.ebay.ca", AU: "www.ebay.com.au", AT: "www.ebay.at", CH: "www.ebay.ch", BE: "www.befr.ebay.be", NL: "www.ebay.nl", IE: "www.ebay.ie", PL: "www.ebay.pl", SG: "www.ebay.com.sg", MY: "www.ebay.com.my", PH: "www.ebay.ph", HK: "www.ebay.com.hk" };
  function usedItem(q) {
    return String(q || "").replace(/(중고\s*나라|중고\s*거래|중고\s*(로|를|를로)?|당근\s*마켓|당근\s*(에서|에|으로)|번개\s*장터(에서)?|번장(에서)?|리퍼\s*(제품|폰|상품)?|매물|싸게|저렴하게|사고\s*싶어|살래|찾아\s*줘?|알아\s*봐\s*줘?|있어\??|있나\??|구해\s*줘?|검색\s*해?\s*줘?|보여\s*줘?|알려\s*줘?|좀|해\s*줘?|줘)/g, " ")
      .replace(/\b(used|second[- ]?hand|pre[- ]?owned|refurbished|buy|find|search|for|a|an|the|cheap|me|please|on|ebay)\b/gi, " ").replace(/\s+/g, " ").trim();
  }
  function used(q, c, raw) {
    if (SANCTIONED[c]) return { u: "", w: "중고", none: "이 지역에서는 중고거래 연결을 제공하지 않습니다 (국제 제재 대상 지역)." };
    var pk = piiKind(raw || q);
    if (pk) return { u: "", w: "중고", none: pk + " 같은 개인정보가 들어 있어 열지 않았어요. 물건 이름만 적어 주세요. 연락처·계좌·주소는 거래 앱에서 직접 주고받으세요. (coverfo는 개인정보를 저장하지 않습니다)" };
    var it = usedItem(q);
    if (c === "KR") return { u: "https://www.daangn.com/kr/buy-sell/?search=" + E(it), w: "🥕 중고거래", used: { item: it, c: c } };
    if (EBAY[c]) return { u: "https://" + EBAY[c] + "/sch/i.html?_nkw=" + E(it), w: "🛒 eBay", used: { item: it, c: c, ebay: EBAY[c] } };
    if (c === "CN") return { u: "", w: "중고", none: "중국은 이 기능의 공개 연결 주소가 없어요. 현지 중고 앱에서 직접 찾아 주세요." };
    return { u: "https://www.google.com/search?q=" + E("used " + it), w: "🔎 Google 중고 검색" };
  }
  /* ── 렌터카(v21): 렌터카 화면(cf-rental) ──
     · 한국: 쏘카 앱(안드로이드 socar.Socar · 아이폰 App Store id515173864) · 네이버 '지역 렌터카' 검색 · Expedia 렌터카.
     · 해외: Expedia 렌터카(/go/car/search/Airport/시작일/종료일?PickUpLoc=공항코드 — Expedia Group 공식 deeplink 문서) · Google 검색.
     · 제휴: Expedia 는 항공권과 같은 Secret EXPEDIA_AFF_LINK({url} 규칙). 예약·결제·면허·여권 입력은 각 사이트에서 직접. 제재국·개인정보는 먼저 막는다. */
  function rental(q, c, raw) {
    if (SANCTIONED[c]) return { u: "", w: "렌터카", none: "이 지역에서는 렌터카 연결을 제공하지 않습니다 (국제 제재 대상 지역)." };
    var pk = piiKind(raw || q, true);
    if (pk) return { u: "", w: "렌터카", none: pk + " 같은 개인정보가 들어 있어 열지 않았어요. 지역·날짜만 적어 주세요. 면허·연락처·결제 정보는 예약 사이트에서 직접 입력해 주세요. (coverfo는 개인정보를 저장하지 않습니다)" };
    var s = String(q || ""), dt = flightDates(s), guessRet = false;
    var days = s.match(/부터\s*(\d{1,2})\s*일(간|동안)?/) || s.match(/(\d{1,2})\s*일\s*(간|동안)/) || s.match(/\bfor\s+(\d{1,2})\s+days?\b/i);
    var dep = dt.dep, ret = dt.ret;
    if (!ret) { var r0 = new Date(dep + "T00:00:00"); r0.setDate(r0.getDate() + (days ? +days[1] : 3)); var p2 = function (n) { return (n < 10 ? "0" : "") + n; }; ret = r0.getFullYear() + "-" + p2(r0.getMonth() + 1) + "-" + p2(r0.getDate()); guessRet = !days; }
    var place = s.replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{1,2}\b/gi, " ")
      .replace(/(렌터카|렌트카|렌트\s*카|차\s*렌트|차량\s*(렌트|대여)|자동차\s*대여|쏘카|그린카|카\s*셰어링|다음\s*주(말)?|이번\s*주(말)?|주말|오늘|내일|모레|글피|\d{1,2}\s*월\s*\d{1,2}\s*일|\d{1,2}\s*\/\s*\d{1,2}|부터|까지|\d{1,2}\s*일\s*(간|동안)?|\d{1,2}\s*박|예약|빌려\s*줘?|빌리고\s*싶어|찾아\s*줘?|알아\s*봐\s*줘?|알려\s*줘?|싼|저렴한|최저가|해\s*줘?|줘|좀)/g, " ")
      .replace(/\b(car|rental|rent|hire|a|in|at|for|from|to|the|cheap|please|find|me|days?|\d+)\b/gi, " ").replace(/(\S{2,})(에서|에)(?=\s|$)/g, "$1").replace(/\s+/g, " ").trim();
    var code = iata(place);
    var info = { place: place, code: code, dep: dep, ret: ret, guessed: dt.guessed, guessRet: guessRet, c: c };
    return { u: code ? "https://www.expedia.com/go/car/search/Airport/" + dep + "/" + ret + "?PickUpLoc=" + code.toLowerCase() + "&DiffDropLoc=0&PickUpTime=10AM&DropTime=10AM&Class=NoPreference" : "https://www.expedia.com/Cars", w: "🚗 렌터카", rental: info };
  }
  /* ── 배달(v13) ──
     · 한국: 배민·쿠팡이츠·요기요·네이버지도 '근처 ○○ 배달' 화면(cf-dlv). 한국 배달 앱은 검색어를 받는 공개 주소가 없어 앱을 열고 메뉴 이름을 복사해 둔다.
       (2026-10-06 폰 실측: 요기요 웹=메뉴 목록 / 배민·쿠팡이츠 웹=앱 설치 안내 / 네이버지도=근처 가게 목록)
     · 미국·캐나다·호주: DoorDash 검색(목록 실측)·Uber Eats 검색 화면(cf-dlv). 그 밖의 나라는 지금처럼 그 나라 앱 하나를 바로 연다.
     · 제휴(나중에): Secret DOORDASH_AFF_LINK·UBEREATS_AFF_LINK·GRAB_AFF_LINK 에 받은 제휴 링크를 넣으면 그 링크로 연다. 링크 안 {url} 자리에 실제 주소가 들어간다.
     · 제재국은 나라 값으로, 개인정보(집 주소·전화 등)는 실제 형식으로 막는다. 주문·결제는 각 앱에서 이용자가 직접. */
  function deliveryFood(q) {
    var t = String(q || "").replace(/(배달의\s*민족|배민|쿠팡\s*이츠|요기요)\s*(에서|으로|로)?/g, " ").replace(/(doordash|door\s*dash|uber\s*eats|grubhub|grab\s*food|order|deliver(y|ed)?|from|배달|시켜\s*먹(자|을까|어|고\s*싶어)?|시켜|시키|주문\s*해?|에서|으로|줘)/gi, " ");
    return clean(t).replace(/\s+/g, " ").trim();
  }
  function affOn(kind) { try { return !!(window.cfShopIds && window.cfShopIds.dl && window.cfShopIds.dl[kind]); } catch (e) { return false; } }
  function affWrap(kind, url) {
    var t = ""; try { t = (window.cfShopIds && window.cfShopIds.dl && window.cfShopIds.dl[kind]) || ""; } catch (e) {}
    if (!t) return url;
    return t.indexOf("{url}") >= 0 ? t.split("{url}").join(E(url)) : t;
  }
  function delivery(q, c, raw) {
    if (SANCTIONED[c]) return { u: "", w: "배달", none: "이 지역에서는 배달 연결을 제공하지 않습니다 (국제 제재 대상 지역)." };
    var pk = piiKind(raw || q);
    if (pk) return { u: "", w: "배달", none: pk + " 같은 개인정보가 들어 있어 열지 않았어요. 메뉴 이름만 적어 주세요. 배달 주소는 배달 앱에서 직접 입력해 주세요. (coverfo는 개인정보를 저장하지 않습니다)" };
    var app = /배민|배달의\s*민족/.test(q) ? "baemin" : /쿠팡\s*이츠|이츠/.test(q) ? "coupangeats" : /요기요/.test(q) ? "yogiyo" : /uber\s*eats/i.test(q) ? "ubereats" : /doordash|door\s*dash/i.test(q) ? "doordash" : "";
    if (c === "KR") return { u: app === "baemin" ? "https://www.baemin.com/" : app === "coupangeats" ? "https://www.coupangeats.com/" : "https://www.yogiyo.co.kr/", w: "🛵 배달", dlv: { food: deliveryFood(q), app: app, c: c } };
    var food = clean(q.replace(/(doordash|uber\s*eats|grubhub|order|deliver(y|ed)?|from|배달|시켜|주문|줘)/gi, ""));
    if (/uber\s*eats/i.test(q) && UBEREATS[c]) return { u: affWrap("ubereats", "https://www.ubereats.com/search?q=" + E(food)), w: "🛵 Uber Eats", dlv: (c === "US" || c === "CA" || c === "AU") ? { food: food, app: app, c: c } : undefined };
    if (c === "US" || c === "CA" || c === "AU") return { u: affWrap("doordash", "https://www.doordash.com/search/store/" + E(food) + "/"), w: "🛵 DoorDash", dlv: { food: food, app: app, c: c } };
    if (GRABFOOD[c]) return { u: affWrap("grab", "https://food.grab.com/" + GRABFOOD[c] + "/en/"), w: "🛵 GrabFood", note: "GrabFood 는 검색어를 받는 공개 주소가 없어 나라 첫 화면으로 엽니다." };
    if (WOLT[c]) return { u: "https://wolt.com/en/" + WOLT[c], w: "🛵 Wolt", note: "Wolt 는 나라 첫 화면으로 엽니다. 도시를 고르면 가게가 나와요." };
    if (GLOVO[c]) return { u: "https://glovoapp.com/" + GLOVO[c] + "/", w: "🛵 Glovo", note: "Glovo 나라 첫 화면으로 엽니다." };
    if (UBEREATS[c]) return { u: affWrap("ubereats", "https://www.ubereats.com/search?q=" + E(food)), w: "🛵 Uber Eats" };
    if (c === "IN") return { u: "https://www.zomato.com/", w: "🛵 Zomato" };
    if (c === "TR") return { u: "https://www.yemeksepeti.com/", w: "🛵 Yemeksepeti" };
    if (c === "AR") return { u: "https://www.pedidosya.com.ar/", w: "🛵 PedidosYa" };
    if (c === "CN") return { u: "", w: "배달", none: "중국은 메이퇀(美团) 공개 링크가 없어 앱에서 직접 주문해 주세요." };
    return { u: "https://www.google.com/maps/search/?api=1&query=" + E(food + " delivery"), w: "📍 Google Maps (배달 가능한 곳)" };
  }
  /* ── 음악(v16): 음악 화면(cf-music)에서 고른다. 중국은 지금처럼 bilibili 검색을 바로 연다 ──
     · ▶ 바로 재생: YouTube 공식 Data API(서버 /api/yt-top, Secret YOUTUBE_API_KEY)로 첫 영상을 찾아 YouTube 에서 연다 — 로그인 + 크레딧 차감(무료 없음, 실패 시 환불).
     · 무료 버튼: YouTube·YouTube Music·Spotify 공개 검색 주소. 크롤링 없음. 영상은 각 서비스에서 재생(coverfo 는 내려받거나 저장하지 않음).
     · 제재국·개인정보 확인은 쇼핑·숙소·맛집과 같다. */
  function music(q, c, raw) {
    if (SANCTIONED[c]) return { u: "", w: "음악", none: "이 지역에서는 음악 연결을 제공하지 않습니다 (국제 제재 대상 지역)." };
    var pk = piiKind(raw || q, true);
    if (pk) return { u: "", w: "음악", none: pk + " 같은 개인정보가 들어 있어 열지 않았어요. 노래 제목·가수 이름만 적어 주세요. (coverfo는 개인정보를 저장하지 않습니다)" };
    var t = String(q || "").replace(/(on\s+)?(유튜브|유툽|유투브|youtube)\s*(에서|으로|로)?/gi, " ").replace(/틀어\s*줘?|들려\s*줘?|재생\s*해?\s*줘?|재생|플레이\s*해?\s*줘?|\bplay\b|listen\s*to|좀|해\s*줘?|켜\s*줘?|찾아\s*줘?|\b(the|a|some)\s*(song|music|video)\b/gi, "").replace(/\s+/g, " ").trim();
    /* 곡·가수 이름이 없으면("유튜브 켜줘"·"노래 틀어줘") 바로 재생(크레딧)은 숨기고 검색 버튼만 */
    var generic = !t || /^(노래|음악|뮤직|곡|가요|songs?|music|videos?)$/i.test(t);
    t = t || q;
    if (c === "CN") return { u: "https://search.bilibili.com/all?keyword=" + E(t), w: "▶ bilibili", note: "중국은 유튜브가 막혀 있어 bilibili 검색으로 엽니다." };
    return { u: "https://www.youtube.com/results?search_query=" + E(t), w: "▶ YouTube", music: { q: t, c: c, generic: generic } };
  }
  /* 카톡(v32): 카카오톡은 외부에서 받는 사람·내용을 채워 보내는 공개 링크가 없다.
     그래서 ① 보낼 말을 복사해 두고 ② 카카오톡 앱만 연다. 받는 사람 고르기·붙여넣기·보내기는 본인이.
     안드로이드 = 앱 실행(없으면 구글 플레이), 아이폰·PC = 앱스토어의 카카오톡 화면(설치돼 있으면 '열기'). */
  function kakao(q) {
    var s = String(q || ""), m = s.match(/(?:에게|한테|께)\s*(.+?)\s*(?:이?라고|라구)?\s*(?:카톡|카카오톡)/) || s.match(/^(.+?(?:다고|이?라고|라구))\s*(?:카톡|카카오톡)/);
    var body = m ? m[1].replace(/^["'“‘\s]+|["'”’\s]+$/g, "").trim() : "";
    body = body.replace(/(이?라고|라구)$/, "").replace(/다고$/, "다").trim();   /* "늦는다고" → "늦는다", "안녕이라고" → "안녕" */
    /* v33: 크롬은 웹에서 앱 '첫 화면 실행(LAUNCHER)' 요청을 막아 구글 플레이로 넘어갔다.
       카카오톡이 웹에서 열도록 허락한 kakaotalk 주소(포도야 ai.html 과 같은 형식)로 연다.
       아이폰은 kakaotalk:// → 1.8초 안에 안 열리면 앱스토어. PC 는 앱스토어 화면. */
    var store = "https://apps.apple.com/kr/app/id362057947";
    var u = isAndroid() ? "intent://#Intent;scheme=kakaotalk;package=com.kakao.talk;S.browser_fallback_url=" + E("https://play.google.com/store/apps/details?id=com.kakao.talk") + ";end"
                        : isIOS() ? "kakaotalk://" : store;
    return { u: u, fallback: isIOS() ? store : "", w: "💛 카톡", copy: body, note: body ? "보낼 말(" + body.slice(0, 20) + ")을 복사했어요. 카톡에서 받는 사람을 고른 뒤 붙여넣기 하세요." : "받는 사람·내용은 카톡에서 직접 입력해 주세요." };
  }
  /* 송금·페이: 앱이 받는 사람·금액을 채운 채 열린다. 비밀번호·확인은 본인이 (각 회사 공개 링크 형식) */
  function pay(q, c) {
    var amt = amountOf(q), s = String(q);
    var handle = (s.match(/@([A-Za-z0-9_.\-]{2,})/) || [])[1] || "";
    var upi = (s.match(/([A-Za-z0-9.\-_]{2,}@[A-Za-z]{2,})/) || [])[1] || "";
    var note = "coverfo";
    /* 문장에 서비스 이름이 있으면 나라 기본값보다 그 서비스 (예: 한국에서 "venmo 로 보내줘") */
    if (/토스|toss/i.test(s)) c = "KR"; else if (/\bupi\b/i.test(s) || upi) c = "IN"; else if (/paypal/i.test(s)) c = "US";
    /* Venmo·Cash App·Zelle: 공개(공식) 송금 링크 형식이 확인되지 않아 열지 않는다 — 안내만 */
    if (/venmo|cash\s*app|zelle/i.test(s)) return { u: "", w: "송금", none: "Venmo·Cash App·Zelle 은 확인된 공개 송금 링크가 없어 앱에서 직접 보내 주세요. (PayPal 은 '@아이디' 로 가능)" };
    if (c === "KR") {
      var acc = numIn(s.replace(/\d+\s*(만|천|원)/g, " ")), bank = (s.match(/(국민|KB|신한|우리|하나|농협|NH|기업|IBK|카카오뱅크|카뱅|토스뱅크|토뱅|케이뱅크|케뱅|새마을금고|새마을|우체국|부산|대구|아이엠뱅크|경남|광주|전북|수협|신협|산업|SC제일|SC|씨티)/) || [])[1] || "";
      if (acc && acc.length < 9) acc = "";
      var qs = "send?bank=" + E(bank) + "&accountNo=" + E(acc) + (amt ? "&amount=" + amt : "");
      var web = "https://toss.im/";
      var u = isAndroid() ? "intent://" + qs + "#Intent;scheme=supertoss;package=viva.republica.toss;S.browser_fallback_url=" + E("https://play.google.com/store/apps/details?id=viva.republica.toss") + ";end" : "supertoss://" + qs;
      return { u: u, w: "💸 토스 송금" + (acc ? "" : " (계좌 직접 입력)"), fallback: web, note: acc ? "은행·계좌·금액이 채워진 채 열려요. 비밀번호는 본인이." : "문장에 은행·계좌번호를 넣으면 채워진 채 열려요." };
    }
    if (c === "IN") { if (upi) return { u: "upi://pay?pa=" + E(upi) + (amt ? "&am=" + amt : "") + "&cu=INR&tn=" + E(note), w: "💸 UPI" }; return { u: "upi://pay" + (amt ? "?am=" + amt + "&cu=INR" : ""), w: "💸 UPI", note: "문장에 받는 UPI 주소(name@bank)를 넣으면 채워진 채 열려요." }; }
    /* 한국·인도 밖 기본: PayPal.me (공식: paypal.me/아이디/금액 → 받는 사람·금액이 채워진 채 열리고 확인은 본인이) */
    if (handle) return { u: "https://paypal.me/" + E(handle) + (amt ? "/" + amt : ""), w: "💸 PayPal.me" };
    return { u: "https://www.paypal.com/myaccount/transfer/homepage/pay", w: "💸 PayPal 보내기", note: "문장에 @아이디를 넣으면 받는 사람·금액이 채워진 채 열려요." };
  }
  /* 숙소 예약: 날짜·인원이 채워진 검색 결과까지 (결제는 사이트에서 본인이) — 포도톡 bookingInfo 규칙 */
  function fmt(d) { function p(x) { return (x < 10 ? "0" : "") + x; } return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); }
  function stayInfo(q) {
    var ppl = 2, mp = q.match(/(\d+)\s*(명|인원|인|사람|people|persons?|adults?|guests?)/i); if (mp) { var pn = parseInt(mp[1], 10); if (pn >= 1 && pn <= 30) ppl = pn; }
    var nights = 1, mn = q.match(/(\d+)\s*(박|nights?)/i); if (mn) { var nn = parseInt(mn[1], 10); if (nn >= 1 && nn <= 30) nights = nn; }
    var ci = "", co = "", now = new Date(), t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var md = q.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일?/); var d0 = null;
    if (md) { d0 = new Date(now.getFullYear(), parseInt(md[1], 10) - 1, parseInt(md[2], 10)); }
    else { var me = q.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{1,2})\b/i) || q.match(/\b(\d{1,2})\/(\d{1,2})\b/); if (me) { var mo = isNaN(me[1]) ? "janfebmaraprmayjunjulaugsepoctnovdec".indexOf(me[1].slice(0, 3).toLowerCase()) / 3 : parseInt(me[1], 10) - 1; d0 = new Date(now.getFullYear(), mo, parseInt(me[2], 10)); } }
    if (d0) { if (d0 < t0) d0 = new Date(d0.getFullYear() + 1, d0.getMonth(), d0.getDate()); ci = fmt(d0); co = fmt(new Date(d0.getTime() + nights * 86400000)); }
    var name = q.replace(/\d+\s*박\s*\d+\s*일/g, " ").replace(/\d{1,2}\s*월\s*\d{1,2}\s*일?/g, " ").replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{1,2}\b/gi, " ").replace(/\b\d{1,2}\/\d{1,2}\b/g, " ")
      .replace(/\d+\s*(박|nights?|명|인원|인|사람|people|persons?|adults?|guests?)/gi, " ").replace(/(예약|숙박|묵을|묵고|체크인|빈\s*방|객실|방\s*잡아?|해\s*줘|줘|좀|알려|찾아)/g, " ")
      .replace(/(^|\s)(book(ing|ed)?|reserve|find|get|me|a|an|the|room|rooms|for|in|at|on|to|near|stay|nights?|please|from|until|till|people|persons?|adults?|guests?|and)(?=\s|$)/gi, "$1").replace(/\s+/g, " ").trim();
    return { stay: name || clean(q), ci: ci, co: co, ppl: ppl, nights: nights };
  }
  function stay(q, c) {
    var i = stayInfo(q); i.c = c;
    /* 숙소(v9): 쇼핑과 같은 법적 안전 — 제재국은 나라 값으로, 개인정보는 실제 형식으로. info 는 남겨 둔다(번역 경로가 info.stay 를 씀) */
    if (SANCTIONED[c]) return { u: "", w: "숙소", none: "이 지역에서는 숙소 연결을 제공하지 않습니다 (국제 제재 대상 지역).", info: i };
    var pk = piiKind(q, true);
    if (pk) return { u: "", w: "숙소", none: pk + " 같은 개인정보가 들어 있어 검색하지 않았어요. 지역·숙소 이름과 날짜·인원만 적어 주세요. (coverfo는 개인정보를 저장하지 않습니다)", info: i };
    var baid = ""; try { baid = (window.cfShopIds && window.cfShopIds.booking) || ""; } catch (e) {}
    return { u: "https://www.booking.com/searchresults.html?ss=" + E(i.stay) + (i.ci ? "&checkin=" + i.ci + "&checkout=" + i.co : "") + "&group_adults=" + i.ppl + "&no_rooms=1" + (baid ? "&aid=" + E(baid) : ""), w: "🏨 Booking.com", alt: c === "KR" ? { u: "https://www.yeogi.com/domestic-accommodations?keyword=" + E(i.stay) + (i.ci ? "&checkIn=" + i.ci + "&checkOut=" + i.co : "") + "&personal=" + i.ppl + "&freeForm=true", w: "여기어때" } : { u: "https://www.airbnb.com/s/" + E(i.stay) + "/homes" + (i.ci ? "?checkin=" + i.ci + "&checkout=" + i.co + "&adults=" + i.ppl : ""), w: "Airbnb" }, info: i, stay: i };   /* v31: 한국도 처음부터 Booking.com */
  }

  /* ── 규칙으로 판별 → {kind, q} ── */
  /* ══════════════ 현지어 규칙 (30개국 언어) — 낱말 표는 cf-quick-lang.js 에 따로 둔다 (먼저 불러올 것) ══════════════
     한국어·영어 규칙에 안 걸린 문장을 그 나라 말로 다시 본다. 낱말 목록(소문자 포함 검사)이라 띄어쓰기·어미 변화에 강하다.
     글자 모양으로 언어를 먼저 고르고(일본어 가나·중국어 한자·태국어·아랍어·힌디어·베트남어 성조 부호), 라틴 문자 언어는 가장 많이 맞는 목록을 쓴다.
     여는 곳은 나라별(위 표)과 같고, 현지어 검색어는 그 나라 지도·쇼핑이 그대로 알아들으므로 번역하지 않는다.
     표 파일이 아직 안 불렸으면 빈 표로 두어 한국어·영어 규칙만 돈다(오류 없음). */
  var LB = window.cfQuickLang || { L: {}, LATIN: [], CYRIL: [] };
  var L = LB.L, LATIN = LB.LATIN, CYRIL = LB.CYRIL;
  function allWords(d) { var out = []; for (var k in d) if (d.hasOwnProperty(k) && k !== "stop") out = out.concat(d[k]); return out; }
  var LETTER = null; try { LETTER = new RegExp("[\\p{L}\\p{M}]", "u"); } catch (e) { LETTER = /[A-Za-z\u00C0-\u024F\u0300-\u036F\u0370-\u03FF\u0400-\u04FF\u0590-\u06FF\u0900-\u097F\u1E00-\u1EFF]/; }
  function isLetter(ch) { return !!ch && LETTER.test(ch); }
  /* 글자 접기: 소문자 + 악센트 떼기(é→e, ά→α, ș→s). 글자 수가 안 변하게 한 글자씩 — 자른 위치를 원문에 그대로 쓸 수 있다 */
  function fold(str) {
    var out = "", t = String(str || "");
    for (var i = 0; i < t.length; i++) { var ch = t.charAt(i), d = ch; try { d = ch.normalize("NFD").charAt(0); } catch (e) {} out += d.toLowerCase(); }
    return out;
  }
  /* 낱말 찾기: 낱말 경계에서만. 낱말 끝이 "~" 면 앞부분만 맞으면 됨(어미 변화: jeftin~ → jeftine·jeftino) */
  function hasWord(q, w, cjk) {
    if (!w) return false;
    var pre = false; if (w.charAt(w.length - 1) === "~") { w = w.slice(0, -1); pre = true; }
    if (cjk) return q.indexOf(w) >= 0;
    var at = -1;
    while ((at = q.indexOf(w, at + 1)) >= 0) {
      if (!isLetter(q.charAt(at - 1)) && (pre || !isLetter(q.charAt(at + w.length)))) return true;
    }
    return false;
  }
  function hits(q, words, cjk) { var n = 0; for (var i = 0; i < words.length; i++) if (hasWord(q, fold(words[i]), cjk)) n++; return n; }
  function isCjk(lang) { return /^(ja|zh|th)$/.test(lang); }
  function detectLang(q) {
    if (/[぀-ヿ]/.test(q)) return "ja";
    if (/[一-鿿]/.test(q)) return "zh";
    if (/[฀-๿]/.test(q)) return "th";
    if (/[؀-ۿ]/.test(q)) return "ar";
    if (/[ऀ-ॿ]/.test(q)) return "hi";
    if (/[Ͱ-Ͽ]/.test(q)) return "el";
    if (/[Ѐ-ӿ]/.test(q)) { var cb = "ru", cn = 0, cq = fold(q); for (var ci = 0; ci < CYRIL.length; ci++) { var cm = hits(cq, allWords(L[CYRIL[ci]]), false); if (cm > cn) { cn = cm; cb = CYRIL[ci]; } } return cb; }
    if (/[ăâđêôơưĂÂĐÊÔƠƯ]|[àáảãạèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/.test(q) && /[ạảẹẻịỉọỏụủđư]/.test(q)) return "vi";
    var best = "", bn = 0, lq = fold(q);
    for (var i = 0; i < LATIN.length; i++) { var n = hits(lq, allWords(L[LATIN[i]]), false); if (n > bn) { bn = n; best = LATIN[i]; } }
    return bn ? best : "";
  }
  /* 현지어로 판별 → {kind, q, lang} */
  function classifyL(q) {
    var lang = detectLang(q); if (!lang || !L[lang]) return null;   /* 표 파일이 안 불렸으면 현지어 판별은 건너뛴다 */
    var d = L[lang], lq = fold(q), cjk = isCjk(lang);
    var has = function (k) { return !!(d[k] && hits(lq, d[k], cjk)); };
    var n = hits(lq, allWords(d), cjk);   /* 몇 낱말이나 맞았나 — 영어 규칙과 겹칠 때 우선순위 판단에 씀 */
    var question = has("question");
    var out = function (kind) { return { kind: kind, q: q, lang: lang, n: n }; };
    if (has("pay") && !question && !has("sms")) return out("pay");
    if (has("call") && numIn(q)) return out("call");
    if (has("sms") && numIn(q)) return out("sms");
    if (has("taxi") && !question) return out("taxi");
    if (has("train") && !question) return out("train");
    if (has("delivery") && !question) return out("delivery");
    if (has("stay") && has("book") && !question) return out("stay");
    if (has("navi")) return out("navi");
    if (has("music")) return out("music");
    if (!question && (has("place") || (has("near") && has("kinds")))) return out("place");
    if (!question && has("shop") && !has("place") && !has("kinds")) return out("shop");
    return null;
  }
  /* 현지어 검색어 다듬기: 그 언어의 의도 낱말·군더더기만 빼고 장소·물건 이름은 남긴다 */
  function stripL(q, lang, kinds) {
    var d = L[lang]; if (!d) return q;
    var words = [].concat(d.stop || []);
    for (var i = 0; i < kinds.length; i++) words = words.concat(d[kinds[i]] || []);
    words.sort(function (a, b) { return b.length - a.length; });
    var cjk = /^(ja|zh|th)$/.test(lang), out = q;
    for (var k = 0; k < words.length; k++) {
      var w = String(words[k] || "").trim(); if (!w) continue;
      /* 일본어·중국어·태국어는 띄어쓰기가 없어 글자 그대로, 그 외는 낱말 경계(앞뒤 공백·문장부호)에서만 지운다 */
      if (cjk) { out = out.split(w).join(" "); continue; }
      var pre = false; if (w.charAt(w.length - 1) === "~") { w = w.slice(0, -1); pre = true; }
      var fw = fold(w), lo = fold(out), at = -1, parts = [], last = 0;
      while ((at = lo.indexOf(fw, at + 1)) >= 0) {
        if (!isLetter(lo.charAt(at - 1)) && (pre || !isLetter(lo.charAt(at + fw.length)))) {
          var end = at + fw.length; if (pre) { while (isLetter(lo.charAt(end))) end++; }   /* 어미까지 통째로 */
          parts.push(out.slice(last, at)); last = end; at = end - 1;
        }
      }
      parts.push(out.slice(last)); out = parts.join(" ");
    }
    return out.replace(/[?？¿؟!¡。、，,]/g, " ").replace(/\s+/g, " ").trim() || q;
  }
  function classify(t) {
    t = String(t || "").trim(); if (!t) return null;
    var en = classifyKE(t), lr = classifyL(t);
    /* 배달 앱 이름(uber eats·doordash·grubhub)이 있으면 현지어 규칙(예: 'uber' → 택시)보다 배달 판정을 먼저 쓴다 (v13) */
    if (en && en.kind === "delivery" && /uber\s*eats|doordash|door\s*dash|grubhub/i.test(t)) return en;
    /* 항공권(v18): 영어·한국어 항공권 문장은 현지어 규칙보다 먼저 */
    if (en && en.kind === "flight") return en;
    if (en && en.kind === "weather") return en;   /* 날씨(v19) */
    if (en && en.kind === "used") return en;   /* 중고거래(v20) */
    if (en && en.kind === "rental") return en;   /* 렌터카(v21) */
    /* 영어 명소 표현(things to do·attractions·sightseeing 등)이면 현지어 규칙(예: 'do' → 슬로베니아어 길안내)보다 명소 판정을 먼저 쓴다 (v14) */
    if (en && en.kind === "place" && ATTR_EN.test(t)) return en;
    if (lr && (!en || lr.n >= 2 || isCjk(lr.lang) || /^(ar|hi|vi)$/.test(lr.lang) || (en.kind === "place" && lr.kind !== "place"))) return lr;
    return en;
  }
  /* 한국어·영어 규칙 */
  function classifyKE(t) {
    var q = t;
    /* 카톡(v32): "OO한테 안녕이라고 카톡" → 메시지 복사 + 카카오톡 열기. 받는 사람은 카톡에서 본인이 고른다(연락처를 받거나 저장하지 않음) */
    if (/(카톡|카카오톡)/.test(q) && notQuestion(q) && (/(보내|전송|해\s*줘|줘|열어)/.test(q) || /(이?라고|다고|라구)\s*(카톡|카카오톡)\s*$/.test(q.trim())) && !/(오픈\s*(채팅|카톡|톡)|선물|이모티콘|송금|친구\s*추가|방법|어떻게)/.test(q)) return { kind: "kakao", q: q };
    if (any(R.pay, q) && notQuestion(q) && !/문자|메시지|카톡/.test(q) && (amountOf(q) || /토스|송금|이체|venmo|paypal|cash\s*app|zelle|upi|transfer/i.test(q))) return { kind: "pay", q: q };
    if (any(R.call, q) && notQuestion(q) && /(걸|연결|통화|해\s*줘|해줘|줘|콜|call|dial|ring)/i.test(q) && !/번호\s*(뭐|알려|찾|등록|저장)/.test(q) && !any(R.taxi, q)) return { kind: "call", q: q };
    if (any(R.sms, q) && notQuestion(q) && /(보내|전송|발신|써\s*줘|작성|해\s*줘|줘|에게|한테|께|send|text\s+\w+|message\s+\w+)/i.test(q)) return { kind: "sms", q: q };
    if (any(R.flight, q) && notQuestion(q) && !/(모드|종이\s*비행기|장난감|드론|환불|수하물|마일리지|몇\s*시간|얼마나\s*걸|flight\s*(mode|status|time))/i.test(q)) return { kind: "flight", q: q };
    if (any(R.rental, q) && notQuestion(q) && !/(보험\s*(료|비교)|면허|사고\s*(처리|났)|환불|취소\s*(방법|규정))/.test(q)) return { kind: "rental", q: q };
    if (any(R.used, q) && notQuestion(q) && !/(중고\s*등|중고생|중고교|중고차\s*(시세|보험|등록|이전)|중고\s*거래\s*(사기|방법))/.test(q) && !/\bused\s+(to|for|by|in|as)\b/i.test(q)) return { kind: "used", q: q };
    if (any(R.weather, q) && !/(틀어|재생|들려|노래|play|맛집|가볼만|갈\s*만한|추천|여행지|관광)/i.test(q)) return { kind: "weather", q: q };
    if (any(R.taxi, q) && !/uber\s*eats/i.test(q) && !/(요금|얼마|시세|몇\s*분|후기|리뷰|뭐야|차이|언제\s*오|how\s*much|price)/i.test(q)) return { kind: "taxi", q: q };
    if (any(R.train, q) && /(예매|예약|표|승차권|끊어|타고\s*가|편도|왕복|자리|좌석|에서.*(까지|행|가는|도착)|book|ticket|from\s+.+\s+to\s+|schedule|to\s+\w+)/i.test(q) && notQuestion(q)) return { kind: "train", q: q };
    if (any(R.delivery, q) && /(시켜|시키|주문|배달|order|deliver|get|doordash|uber\s*eats|grubhub|grab\s*food|배민|쿠팡\s*이츠|요기요)/i.test(q) && !/(배달비|배달료|얼마|몇\s*분|언제\s*오|환불|취소|후기|리뷰|how\s*much|how\s*long)/i.test(q)) return { kind: "delivery", q: q };
    if (any(R.stay, q) && any(R.stayWord, q) && notQuestion(q)) return { kind: "stay", q: q };
    if (any(R.navi, q)) return { kind: "navi", q: q };
    if (any(R.music, q)) return { kind: "music", q: q };
    if (any([R.place[0], R.place[1], R.place[2]], q) || (any(R.placeNear, q) && any(R.placeKinds, q))) return { kind: "place", q: q };
    if (!any([/(맛집|카페|식당|술집|숙소|펜션|호텔|관광|여행|가볼만|놀거리|근처|주변|길\s*안내|예약|항공권|비행기표|전화|문자|메일)/], q) && notQuestion(q)) {
      var shopWord = any(R.shopWord, q), buy = any(R.shopBuy, q), ask = any(R.shopAsk, q);
      if (shopWord || (buy && ask)) return { kind: "shop", q: q };
    }
    return null;
  }
  /* ── 맛집(v10): 음식점·맛집 요청만 맛집 화면(cf-food)으로. 약국·관광지 등 다른 장소는 지금처럼 지도를 바로 연다 ──
     · 여는 곳: 네이버지도·카카오맵·Google Maps(한국) / Google Maps·Yelp(미국·캐나다) — 2026-10-06 직접 열어 식당 목록 확인.
       캐치테이블·망고플레이트는 검색 주소로 목록이 나오지 않아(실측) 쓰지 않는다. 제휴 프로그램 없음.
     · 그 밖의 나라는 버튼이 하나(Google Maps)뿐이라 화면 없이 지금처럼 바로 연다.
     · 제재국·개인정보 확인은 쇼핑·숙소와 같다. 가게 위치로 쓰는 도로명 주소는 막지 않는다(찾는 장소이므로). */
  var FOOD_KO = /(맛집|맛짐|먹을\s*(곳|데|만한)|먹거리|음식점|식당|밥집|맛있는\s*(곳|집|데)|뭐\s*먹|배고파|배고픈|카페|술집|호프|포차|디저트|브런치|치킨|피자|분식|국밥|고기집|횟집|초밥|중국집|일식|한식|양식|빵집|베이커리|파스타|라멘|냉면|삼겹살|족발|보쌈|떡볶이|돈까스|돈가스|커피)/;
  var FOOD_EN = /\b(restaurants?|food|eat|eats|dinner|lunch|brunch|breakfast|cafe|cafes|coffee|pizza|sushi|burgers?|ramen|bbq|steak(house)?|bakery|diner)\b/i;
  var YELP = { US: 1, CA: 1 };
  function isFood(q) { return FOOD_KO.test(String(q || "")) || FOOD_EN.test(String(q || "")); }
  function foodQuery(pq) {
    /* "오늘 저녁 뭐 먹지" 처럼 때를 나타내는 말만 남으면 '맛집' 을 붙인다 */
    var t = String(pq || "").replace(/(^|\s)(오늘|내일|지금|이따|저녁|점심|아침|야식)(?=\s|$)/g, " ").replace(/\s+/g, " ").trim();
    if (!t) return "근처 맛집";
    if (!isFood(t) && !/(근처|주변)/.test(t)) return t + " 맛집";
    return t;
  }
  function food(pq, c, raw) {
    if (SANCTIONED[c]) return { u: "", w: "맛집", none: "이 지역에서는 맛집 연결을 제공하지 않습니다 (국제 제재 대상 지역)." };
    var pk = piiKind(raw, true);
    if (pk) return { u: "", w: "맛집", none: pk + " 같은 개인정보가 들어 있어 검색하지 않았어요. 지역·음식 이름만 적어 주세요. (coverfo는 개인정보를 저장하지 않습니다)" };
    var fq = foodQuery(pq), res = mapsSearch(fq, c);
    if (c === "KR" || YELP[c]) res.food = { q: fq, c: c };
    return res;
  }
  /* ── 가볼만한곳·명소(v14): 관광지·명소 요청은 명소 화면(cf-attr)으로. 지도 + 투어·입장권(Klook·KKday) 검색 링크 ──
     · 크롤링 없음: 각 서비스가 공개한 검색 주소만 연다. 결제는 그 사이트에서 이용자가 직접(coverfo 는 결제를 받지 않음).
     · 제휴 ID 는 Cloudflare Secret(KLOOK_AID·KKDAY_CID)을 넣었을 때만 링크에 붙는다(/api/shop-ids). 없으면 일반 링크.
     · 제재국·개인정보 확인은 쇼핑·숙소·맛집과 같다(번역기로 보내기 전에 막음). 중국은 지금처럼 高德 지도를 바로 연다. */
  var ATTR_EN = /(things\s*to\s*do|attractions?|sightseeing|places\s*to\s*(visit|see|go)|tourist|landmarks?|must[- ]see|tours?\b)/i;
  function isAttr(q) { q = String(q || ""); return R.place[1].test(q) || ATTR_EN.test(q); }
  function attrArea(pq) {
    /* "부산 가볼만한곳" → "부산" (투어·입장권 사이트 검색어). 지역 이름이 없으면 "" */
    return String(pq || "")
      .replace(/(가\s*볼\s*만\s*한\s*(곳|데)?|가볼만한\s*(곳|데)?|볼\s*만\s*한\s*(곳|데)|관광\s*지|관광|명소|여행\s*지|여행|놀\s*(거리|데|곳)|갈\s*(만\s*한|데|곳)\s*(곳|데)?|볼\s*거리|구경\s*(거리|할\s*(곳|데)?|갈\s*(곳|데)?)|핫플(레이스)?|유명한\s*(곳|데)|데이트\s*(코스|장소)|나들이|놀러\s*(갈|가)\s*(곳|데)?|산책\s*(길|코스)|코스|추천|근처|주변|여기|가까운)/g, " ")
      .replace(/\b(things\s*to\s*do|attractions?|sightseeing|places\s*to\s*(visit|see|go)|tourist(\s*(spots?|places?|attractions?))?|landmarks?|must[- ]see|tours?|top|in|near\s*me|nearby|best|visit|the|to|do|of)\b/gi, " ")
      .replace(/(^|\s)(곳|데)(?=\s|$)/g, " ").replace(/(\S{2,})(에서|에|의)(?=\s|$)/g, "$1")
      .replace(/\s+/g, " ").trim();
  }
  function attr(pq, c, raw) {
    if (SANCTIONED[c]) return { u: "", w: "명소", none: "이 지역에서는 명소·관광 연결을 제공하지 않습니다 (국제 제재 대상 지역)." };
    var pk = piiKind(raw, true);
    if (pk) return { u: "", w: "명소", none: pk + " 같은 개인정보가 들어 있어 검색하지 않았어요. 지역·장소 이름만 적어 주세요. (coverfo는 개인정보를 저장하지 않습니다)" };
    var res = mapsSearch(pq, c);
    if (c !== "CN") res.attr = { q: pq, area: attrArea(pq), c: c };
    return res;
  }
  function naviDest(q) {
    return String(q || "").replace(/(으?로\s*)?(길\s*안내|내비게이션|내비|네비게이션|네비|길\s*찾기|길찾기|가는\s*길|가는\s*법|어떻게\s*가(는|요|줘)?|찾아\s*가(줘|기)?|까지\s*가(줘|는|기)?|가는\s*방법|가려면|경로|루트|데려다\s*(줘)?|목적지|운전|틀어\s*줘?|켜\s*줘?|실행(해|해줘)?|알려\s*줘?|해\s*줘|(^|\s)해(?=\s|$)|줘|좀)/g, " ").replace(/(^|\s)길(?=\s|$)/g, " ")
      .replace(/\b(directions?\s*to|navigate\s*to|how\s*(do\s*i|to)\s*get\s*to|route\s*to|take\s*me\s*to|drive\s*to|way\s*to|please|the)\b/gi, " ")
      .replace(/(까지|으로|로|에)\s*$/, "").replace(/\s+/g, " ").trim() || q;
  }
  /* ── 길안내(v11): "A에서 B까지" 면 출발지 A·도착지 B, 아니면 도착지만(출발은 현재 위치) ──
     · 여는 곳(2026-10-06 실측): Google Maps·Apple 지도 = 출발·도착이 채워진 경로가 나옴.
       네이버지도·카카오맵 = 경로 주소로는 칸이 비어 나와, 도착지 '장소 검색'으로 열고 화면에서 길찾기를 누르게 한다.
       Waze 는 PC 에서 앱 설치 안내만 나와 쓰지 않는다. 티맵·카카오내비는 웹 공개 주소가 없어 쓰지 않는다.
     · 제재국·개인정보 확인은 쇼핑·숙소·맛집과 같다. 목적지로 쓰는 도로명 주소는 막지 않는다. */
  function naviFromTo(q) {
    var s = String(q || "").trim(), m = s.match(/^(.*?\S)\s*에서\s+(.+)$/) || s.match(/\bfrom\s+(.+?)\s+to\s+(.+)$/i);
    if (m) { var f = naviDest(m[1]), t = naviDest(m[2]); if (f && t && f !== m[1] + m[2]) return { from: f, to: t }; }
    return { from: "", to: naviDest(s) };
  }
  function navi(dest, from, c, raw) {
    if (SANCTIONED[c]) return { u: "", w: "길안내", none: "이 지역에서는 길안내 연결을 제공하지 않습니다 (국제 제재 대상 지역)." };
    var pk = piiKind(raw, true);
    if (pk) return { u: "", w: "길안내", none: pk + " 같은 개인정보가 들어 있어 길안내를 열지 않았어요. 출발지·도착지 이름만 적어 주세요. (coverfo는 개인정보를 저장하지 않습니다)" };
    var res = mapsDir(dest, c);
    /* 한국만 길안내 화면(카카오맵·네이버지도). 해외는 Google Maps 하나라 화면 없이 바로, 중국은 高德 하나 (2026-10-06 결정: 애플 삭제, 한국 구글 삭제) */
    if (c === "KR") res.navi = { to: dest, from: from || "", c: c };
    return res;
  }
  /* 택시 목적지: "택시 불러줘 타임스퀘어로" → 타임스퀘어, "call a cab to Central Park" → Central Park. 없으면 "" (앱만 연다) */
  function taxiDest(q) {
    var t = String(q || "").replace(/(택시|카카오\s*t|카카오티|우버|그랩|리프트|불러\s*줘?|호출\s*해?\s*줘?|잡아\s*줘?|콜\s*해?\s*줘?|태워\s*줘?|보내\s*줘?|와\s*줘?|타고\s*가(자|고|줘)?|해\s*줘?|줘|좀|지금|빨리)/gi, " ")
      .replace(/\b(call|get|hail|book|order|me|a|an|the|taxi|cab|uber|lyft|grab|ride|to|please|now|from\s+here)\b/gi, " ")
      .replace(/(^|\s)(으로|로|에서)(?=\s)/g, " ").replace(/(^|\s)가(는|\s*(자|줘|요))?(?=\s|$)/g, " ")
      .replace(/(까지|으로|로|에)\s*$/, "").replace(/\s+/g, " ").trim();
    return t.length >= 2 ? t : "";
  }
  /* 쇼핑 검색어 다듬기 (v8): 낱말 단위로 군더더기("리뷰 좋은 순으로 알려줘" 등)를 빼고 상품 이름만 남긴다.
     · 앞부분이 같으면 빼는 말(PRE) — "추천해줘·리뷰순·인기많은" 처럼 어미가 붙어도 빠진다
     · 통째로 같아야 빼는 말(EXACT) — "순·싼·모델" 은 "순두부·싼타페·모델Y" 를 지키려고 낱말 전체가 같을 때만
     · 다 빠져서 두 글자도 안 남으면 예전 방식(shopTopicOld) 결과를 쓴다 */
  var SHOP_PRE = ["추천", "알려", "골라", "비교", "최저가", "가성비", "리뷰", "후기", "평점", "별점", "구매", "판매", "팔린", "인기", "베스트", "랭킹", "쇼핑", "판매처", "어디서", "검색", "가격", "얼마", "저렴", "싸게", "싸고", "싼거", "싼걸", "살까", "사고", "사는", "사줘", "살래", "파는", "팔아", "구입", "주문해", "주문하", "어딨", "어디", "나오게", "해줘", "찾아", "보여", "순으로", "순서", "정렬", "좋은", "좋고", "좋다", "좋게", "제일", "가장", "많은", "많이", "높은", "낮은", "할인", "세일", "특가",
    "cheapest", "cheap", "buy", "best", "price", "review", "recommend", "deal", "compare", "shopping", "purchase", "lowest", "rated"];
  var SHOP_EXACT = ["뭐", "뭐가", "어떤", "좀", "정도", "바로", "순", "싼", "제품", "상품", "모델", "브랜드", "살", "것", "거", "잘", "줘", "해", "요", "곳", "데", "데가", "곳이", "곳을", "사", "주문", "파나요", "파냐",
    "find", "show", "please", "me", "i", "want", "the", "a", "an", "some", "order", "sort", "sorted", "by", "in", "of"];
  function shopTopic(q) {
    var toks = String(q || "").replace(/[?？!！.,]/g, " ").split(/\s+/), out = [];
    for (var i = 0; i < toks.length; i++) {
      var w = toks[i], lw = w.toLowerCase(), drop = false; if (!w) continue;
      if (SHOP_EXACT.indexOf(lw) >= 0) drop = true;
      for (var k = 0; !drop && k < SHOP_PRE.length; k++) if (lw.indexOf(SHOP_PRE[k]) === 0) drop = true;
      if (/^\d+\s*개$/.test(w)) drop = true;
      if (!drop) out.push(w);
    }
    var core = out.join(" ").trim();
    return core.length >= 2 ? core : shopTopicOld(q);
  }
  function shopTopicOld(q) {
    var cut = ["추천", "알려", "골라", "비교", "어떤", "뭐가", "뭐 ", "살까", "사고", "최저가", "가성비", "쇼핑", "구매", "얼마", " recommend", " cheapest", " best price", " under", " buy"], idx = q.length;
    for (var k = 0; k < cut.length; k++) { var p = q.toLowerCase().indexOf(cut[k]); if (p > 0 && p < idx) idx = p; }
    var core = q.slice(0, idx).replace(/\d+\s*개/g, "").replace(/\b(i\s*want\s*to|where\s*can\s*i|find|me|a|the|some)\b/gi, "").replace(/\s+/g, " ").trim();
    return core.length >= 2 ? core : q;
  }
  /* ── 판별 결과 → 열 주소 ── */
  function build(r, c) {
    var q = r.q, k = r.kind;
    if (r.lang && !r.query) {
      if (k === "place") r.query = stripL(q, r.lang, ["near"]);
      else if (k === "navi") r.query = stripL(q, r.lang, ["navi"]);
      else if (k === "shop") r.query = stripL(q, r.lang, ["shop"]);
      else if (k === "music") r.query = stripL(q, r.lang, ["music"]);
      else if (k === "taxi") r.query = stripL(q, r.lang, ["taxi", "navi"]);
      else if (k === "delivery") r.query = stripL(q, r.lang, ["delivery"]);
      if (k === "place" && r.lang && !r.query) r.query = q;
    }
    if (k === "place") { var pq = r.query || clean(q); if (/^(근처|주변|여기|가까운|이\s*근방|근방)?$/.test(pq.trim())) pq = (pq.trim() || "근처") + " 맛집"; if (isFood(q)) return food(pq, c, q); if (isAttr(q)) return attr(pq, c, q); return mapsSearch(pq, c); }   /* "배고파 근처 뭐 먹지" → 근처 맛집 */
    if (k === "navi") { if (r.query) return navi(r.query, "", c, q); var ft = naviFromTo(q); return navi(ft.to, ft.from, c, q); }
    if (k === "music") return music(r.query || q, c, q);
    if (k === "shop") return shop(r.query || shopTopic(q), c, q);
    if (k === "call") { var n = numIn(q); return n ? { u: "tel:" + n, w: "📞 전화" } : { u: "", w: "전화", none: "전화번호를 같이 말해 주세요 (예: 010-1234-5678로 전화)" }; }
    if (k === "sms") { var n2 = numIn(q), body = (r.body || String(q).replace(/(\+?\d[\d\-\s]{6,}\d)/g, " ").replace(/^\s*.+?(에게|한테|께서|께)/, "").replace(/(문자|메시지|메세지|sms|전송|발신|보내\s*줘?|보내|써\s*줘?|작성|줘|해\s*줘?|해|좀|부탁(해|해줘)?|\btext\b|\bsend\b|\bmessage\b|\bto\b)/gi, " ").replace(/\s+/g, " ").trim().replace(/고\s*$/, "")); return { u: "sms:" + n2 + (body ? "?body=" + E(body) : ""), w: "💬 문자" }; }
    if (k === "taxi") return taxi(r.query || taxiDest(q), c, q);
    if (k === "train") return train(q, c, q);
    if (k === "flight") return flight(q, c, q);
    if (k === "weather") return weather(q, c, q);
    if (k === "used") return used(q, c, q);
    if (k === "rental") return rental(q, c, q);
    if (k === "delivery") return delivery(r.query || q, c, q);
    if (k === "pay") return pay(q, c);
    if (k === "kakao") return kakao(q);
    if (k === "stay") { if (r.lang) { var sres = stay(q, c), nm = stripL(stayInfo(q).stay, r.lang, ["stay", "book"]); if (nm && nm !== sres.info.stay) { sres.u = sres.u.split(E(sres.info.stay)).join(E(nm)); if (sres.alt) sres.alt.u = sres.alt.u.split(E(sres.info.stay)).join(E(nm)); sres.info.stay = nm; } return sres; } return stay(q, c); }
    return null;
  }
  /* 한국 밖에서 한국어로 치면 지도·쇼핑 검색어만 영어로 (cf-ui-lang.js 의 무료 번역기, 실패하면 원문) */
  function maybeTranslate(text, c, cb) {
    if (c === "KR" || !KO.test(text) || !(window.cfUiLang && window.cfUiLang.translate)) { cb(text); return; }
    var done = false, t = setTimeout(function () { if (!done) { done = true; cb(text); } }, 2500);
    window.cfUiLang.translate(text, "en", function (out) { if (done) return; done = true; clearTimeout(t); cb(out || text); });
  }
  /* ── 규칙 실패 시 AI(Claude Fable 5.1)에게 한 번: /api/quick-intent ── */
  var AI_FALLBACK = false;   /* 규칙에 안 걸린 문장을 AI(크레딧 차감)에게 물을지. false 면 바로 채팅으로 — 오타·발음 오류로 크레딧이 나가지 않게 */
  var AI_COST = 1;   /* 표시용 기본값. 서버 GET /api/quick-intent 의 cost 로 갱신 */
  function aiClassify(text, c, cb) {
    var tok = null;
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf("sb-") === 0 && k.indexOf("-auth-token") > 0) { var v = JSON.parse(localStorage.getItem(k) || "null"); if (v && v.access_token) tok = v.access_token; } } } catch (e) {}
    if (!tok) { cb(null); return; }
    try { if (window.cfQuick && window.cfQuick.onAI) window.cfQuick.onAI(AI_COST); } catch (e) {}
    var done = false, t = setTimeout(function () { if (!done) { done = true; cb(null); } }, 4000);
    fetch("/api/quick-intent", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify({ text: text, country: c }) })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (done) return; done = true; clearTimeout(t); cb(j && j.kind && j.kind !== "none" ? j : null); })
      ["catch"](function () { if (done) return; done = true; clearTimeout(t); cb(null); });
  }
  /* ── 공개 API ──
     decide(text, cb): cb({u, w, note?, alt?}) 또는 cb(null → 채팅으로). 비동기(번역·AI). */
  function decide(text, cb, opts) {
    opts = opts || {}; var c = opts.country || country();
    var r = classify(text);
    var finish = function (res) { if (!res) { cb(null); return; } if (res.none) { cb({ none: res.none, w: res.w }); return; } cb(res); };
    var go = function (rr) {
      if (!rr) { cb(null); return; }
      /* 쇼핑·숙소: 제재국이거나 개인정보 형식이 보이면 번역기로 보내기 전에 바로 막는다 (문장이 밖으로 나가지 않게) */
      if ((rr.kind === "shop" || rr.kind === "stay") && (SANCTIONED[c] || piiKind(rr.q, rr.kind === "stay"))) { finish(build(rr, c)); return; }
      if (rr.kind === "place" && isFood(rr.q) && (SANCTIONED[c] || piiKind(rr.q, true))) { finish(build(rr, c)); return; }
      if (rr.kind === "navi" && (SANCTIONED[c] || piiKind(rr.q, true))) { finish(build(rr, c)); return; }
      if (rr.kind === "place" && !isFood(rr.q) && isAttr(rr.q) && (SANCTIONED[c] || piiKind(rr.q, true))) { finish(build(rr, c)); return; }
      if (rr.kind === "delivery" && (SANCTIONED[c] || piiKind(rr.q))) { finish(build(rr, c)); return; }
      if (rr.kind === "taxi" && (SANCTIONED[c] || piiKind(rr.q, true))) { finish(build(rr, c)); return; }
      if (rr.kind === "train" && (SANCTIONED[c] || piiKind(rr.q, true))) { finish(build(rr, c)); return; }
      if (rr.kind === "flight") { finish(build(rr, c)); return; }
      if (rr.kind === "weather") { finish(build(rr, c)); return; }   /* 날씨: 번역기를 쓰지 않음 */
      if (rr.kind === "used" && (SANCTIONED[c] || piiKind(rr.q))) { finish(build(rr, c)); return; }
      if (rr.kind === "rental") { finish(build(rr, c)); return; }   /* 렌터카: 번역기를 쓰지 않음(도시 이름 → 공항 코드 표) */   /* 항공권: 번역기를 쓰지 않음(도시 이름 → 공항 코드 표) */
      /* 한국 밖 + 한국어 검색어 → 지도·쇼핑·숙소 검색어만 영어로 바꿔 넣는다 (그 나라 서비스가 한국어를 못 알아듣는 경우가 많다) */
      if ((rr.kind === "place" || rr.kind === "navi" || rr.kind === "shop" || rr.kind === "stay" || rr.kind === "taxi") && c !== "KR" && KO.test(rr.query || rr.q)) {
        var base = rr.query || (rr.kind === "place" ? clean(rr.q) : rr.kind === "navi" ? naviDest(rr.q) : rr.kind === "shop" ? shopTopic(rr.q) : rr.kind === "taxi" ? taxiDest(rr.q) : stayInfo(rr.q).stay);
        if (!base) { finish(build(rr, c)); return; }
        maybeTranslate(base, c, function (en) {
          if (rr.kind === "stay") { var res = stay(rr.q, c); if (en && en !== base) { res.u = res.u.split(E(res.info.stay)).join(E(en)); if (res.alt) res.alt.u = res.alt.u.split(E(res.info.stay)).join(E(en)); res.info.stay = en; } finish(res); return; }
          finish(build({ kind: rr.kind, q: rr.q, query: en || base }, c));
        });
        return;
      }
      finish(build(rr, c));
    };
    if (r) { go(r); return; }
    if (opts.noAI || !AI_FALLBACK) { cb(null); return; }
    aiClassify(text, c, function (j) { if (!j) { cb(null); return; } go({ kind: j.kind, q: text, query: j.query || "", body: j.body || "" }); });
  }
  if (AI_FALLBACK) try { fetch("/api/quick-intent").then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.cost != null) AI_COST = Number(j.cost) || 0; })["catch"](function () {}); } catch (e) {}
  window.cfQuick = { country: country, setCountry: setCountry, isOverride: isOverride, classify: classify, build: build, decide: decide, stayInfo: stayInfo, amountOf: amountOf, aiCost: function () { return AI_COST; }, onAI: null,
    /* 세계 주요 경제국 30 (관리자 시험 칩·확인표에 쓰임) */
    COUNTRIES: [["AUTO", "🌐 자동(시간대)"], ["KR", "🇰🇷 대한민국"], ["US", "🇺🇸 미국"], ["JP", "🇯🇵 일본"], ["CN", "🇨🇳 중국"], ["IN", "🇮🇳 인도"], ["GB", "🇬🇧 영국"], ["DE", "🇩🇪 독일"], ["FR", "🇫🇷 프랑스"], ["ES", "🇪🇸 스페인"], ["IT", "🇮🇹 이탈리아"],
      ["CA", "🇨🇦 캐나다"], ["AU", "🇦🇺 호주"], ["BR", "🇧🇷 브라질"], ["MX", "🇲🇽 멕시코"], ["NL", "🇳🇱 네덜란드"], ["CH", "🇨🇭 스위스"], ["SE", "🇸🇪 스웨덴"], ["BE", "🇧🇪 벨기에"], ["AT", "🇦🇹 오스트리아"], ["PL", "🇵🇱 폴란드"], ["TR", "🇹🇷 튀르키예"],
      ["SA", "🇸🇦 사우디"], ["AE", "🇦🇪 UAE"], ["SG", "🇸🇬 싱가포르"], ["HK", "🇭🇰 홍콩"], ["TW", "🇹🇼 대만"], ["TH", "🇹🇭 태국"], ["VN", "🇻🇳 베트남"], ["ID", "🇮🇩 인도네시아"], ["MY", "🇲🇾 말레이시아"], ["AR", "🇦🇷 아르헨티나"],
      ["GR", "🇬🇷 그리스"], ["HU", "🇭🇺 헝가리"], ["SK", "🇸🇰 슬로바키아"], ["BG", "🇧🇬 불가리아"], ["HR", "🇭🇷 크로아티아"], ["RS", "🇷🇸 세르비아"], ["SI", "🇸🇮 슬로베니아"], ["BA", "🇧🇦 보스니아"], ["AL", "🇦🇱 알바니아"], ["MK", "🇲🇰 북마케도니아"], ["MD", "🇲🇩 몰도바"], ["BY", "🇧🇾 벨라루스"]] };
})();
