/* coverfo 빠른 실행 — "앱·지도·쇼핑·송금·숙소로 갈 요청이면 채팅 대신 그 화면을 바로 연다" (나라별)
   · 무엇을 하려는지: 포도톡 ai.html 의 규칙(placeMapIntent·vansIsNavi·vansIsMusic·shoppingDetect·callIntent·smsIntent·
     taxiIntent·trainIntent·deliveryIntent·tossIntent·bookingInfo)을 그대로 + 같은 뜻의 영어 규칙
   · 어느 나라인지: cf-ui-lang.js 의 시간대 → 나라 (관리자 시험용 덮어쓰기: ?cf_country=US 또는 localStorage cf_country)
   · 여는 곳: 각 회사가 공개한 주소 형식만 (Google Maps URLs, Google 쇼핑 검색, YouTube 검색, Uber 딥링크(개발자 문서), Booking.com·Airbnb 검색,
     PayPal.me / UPI(NPCI 규격) / supertoss 송금 링크, tel:/sms:). 확인 안 된 형식(Venmo·Cash App·Zelle·Amazon 검색 링크)은 쓰지 않는다.
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
      .replace(/알려\s*줘?|추천\s*해?\s*줘?|좀|해\s*줘?|찾아\s*줘?|보여\s*줘?|어디(야|있어|에|있나|있을까)?|쫙|배고파|배고픈데|뭐\s*먹(지|을까|을지)|있나요?|있을까요?|있어요?|알려주세요|주세요|부탁(해|해요|합니다)?/g, "")
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
  var UBER = { US:1, CA:1, GB:1, IE:1, FR:1, DE:1, ES:1, IT:1, NL:1, BE:1, CH:1, AT:1, PL:1, SE:1, TR:1, AU:1, NZ:1, JP:1, HK:1, TW:1, IN:1, SA:1, AE:1, MX:1, BR:1, AR:1, ZA:1 };
  var UBEREATS = { US:1, CA:1, GB:1, IE:1, FR:1, DE:1, ES:1, IT:1, NL:1, BE:1, CH:1, SE:1, PL:1, AU:1, NZ:1, JP:1, TW:1, HK:1, MX:1, BR:1, SA:1, AE:1, ZA:1 };
  var GRABFOOD = { SG:"sg", TH:"th", VN:"vn", ID:"id", MY:"my", PH:"ph" };
  var TRAIN = { US:["https://www.amtrak.com/","Amtrak"], CA:["https://www.viarail.ca/","VIA Rail"], JP:["https://smart-ex.jp/","신칸센 EX"], GB:["https://www.thetrainline.com/","Trainline"],
    DE:["https://www.bahn.de/","DB"], FR:["https://www.sncf-connect.com/","SNCF"], ES:["https://www.renfe.com/","Renfe"], IT:["https://www.trenitalia.com/","Trenitalia"], NL:["https://www.ns.nl/","NS"],
    BE:["https://www.belgiantrain.be/","SNCB"], CH:["https://www.sbb.ch/","SBB"], AT:["https://www.oebb.at/","ÖBB"], SE:["https://www.sj.se/","SJ"], PL:["https://www.intercity.pl/","PKP Intercity"],
    TR:["https://ebilet.tcddtasimacilik.gov.tr/","TCDD"], IN:["https://www.irctc.co.in/","IRCTC"], CN:["https://www.12306.cn/","12306"], TW:["https://www.thsrc.com.tw/","台灣高鐵"], HK:["https://www.mtr.com.hk/","MTR"],
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
    return { u: "https://www.google.com/maps/dir/?api=1&destination=" + E(dest) + "&travelmode=driving", w: "🧭 Google Maps 내비" };
  }
  function shop(q, c) {
    if (c === "KR") return { u: "https://search.shopping.naver.com/search/all?query=" + E(q) + "&sort=rel", w: "🛒 네이버쇼핑" };
    if (c === "CN") return { u: "", w: "쇼핑", none: "중국 본토에서는 구글 쇼핑을 열 수 없어요. 타오바오·징둥 앱에서 직접 검색해 주세요." };
    /* 한국 밖: Google 쇼핑 탭 (구글 자체 검색 주소). 나라별 쇼핑몰 검색 링크는 약관 확인이 안 돼 쓰지 않는다 */
    return { u: "https://www.google.com/search?tbm=shop&q=" + E(q), w: "🛒 Google 쇼핑" };
  }
  function taxi(dest, c) {
    if (c === "KR") return isIOS() ? { u: "https://apps.apple.com/kr/app/id981110422", w: "🚕 카카오T (앱스토어)", note: "아이폰은 카카오T 공개 링크가 없어 앱 설치/열기 화면으로 갑니다." } : { u: "intent://launch#Intent;scheme=kakaot;package=com.kakao.taxi;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.kakao.taxi;end", w: "🚕 카카오T" };
    if (UBER[c]) {
      /* Uber 공식 유니버설 링크 (목적지만 채워짐 · 호출 확인은 본인이) */
      var u = "https://m.uber.com/ul/?action=setPickup&pickup=my_location" + (dest ? "&dropoff[formatted_address]=" + E(dest) : "");
      return { u: u, w: "🚕 Uber", alt: c === "US" ? { u: "https://ride.lyft.com/", w: "Lyft (홈)" } : undefined };
    }
    if (c === "CN") return { u: "", w: "택시", none: "중국은 디디(滴滴) 공개 링크가 없어 앱에서 직접 불러 주세요." };
    /* Grab(동남아)·99(브라질) 등은 공개 호출 링크가 없음 → 목적지까지 길찾기만 */
    return dest ? { u: "https://www.google.com/maps/dir/?api=1&destination=" + E(dest), w: "🧭 Google Maps 길찾기", note: "이 나라는 택시 앱 공개 링크가 없어 길찾기로 엽니다. 호출은 Grab 등 현지 앱에서." } : { u: "", w: "택시", none: "이 나라는 택시 앱 공개 링크가 없어요. Grab 등 현지 앱에서 불러 주세요." };
  }
  function train(q, c) {
    if (c === "KR") return { u: /srt|수서/i.test(q) ? "https://etk.srail.kr/main.do" : "https://www.letskorail.com/", w: "🚄 기차 예매" };
    if (TRAIN[c]) return { u: TRAIN[c][0], w: "🚄 " + TRAIN[c][1] };
    if (!gmapsOk(c)) return { u: "", w: "기차", none: "이 나라의 기차 예매 사이트가 등록돼 있지 않아요." };
    return { u: "https://www.google.com/maps/dir/?api=1&travelmode=transit&destination=" + E(q), w: "🚄 Google Maps 대중교통" };
  }
  function delivery(q, c) {
    if (c === "KR") return { u: /배민|배달의민족/.test(q) ? "https://www.baemin.com/" : /쿠팡이츠|이츠/.test(q) ? "https://www.coupangeats.com/" : "https://www.yogiyo.co.kr/", w: "🛵 배달" };
    var food = clean(q.replace(/(doordash|uber\s*eats|grubhub|order|deliver(y|ed)?|from|배달|시켜|주문|줘)/gi, ""));
    if (/uber\s*eats/i.test(q) && UBEREATS[c]) return { u: "https://www.ubereats.com/search?q=" + E(food), w: "🛵 Uber Eats" };
    if (c === "US" || c === "CA" || c === "AU") return { u: "https://www.doordash.com/search/store/" + E(food) + "/", w: "🛵 DoorDash" };
    if (GRABFOOD[c]) return { u: "https://food.grab.com/" + GRABFOOD[c] + "/en/", w: "🛵 GrabFood", note: "GrabFood 는 검색어를 받는 공개 주소가 없어 나라 첫 화면으로 엽니다." };
    if (UBEREATS[c]) return { u: "https://www.ubereats.com/search?q=" + E(food), w: "🛵 Uber Eats" };
    if (c === "IN") return { u: "https://www.zomato.com/", w: "🛵 Zomato" };
    if (c === "TR") return { u: "https://www.yemeksepeti.com/", w: "🛵 Yemeksepeti" };
    if (c === "AR") return { u: "https://www.pedidosya.com.ar/", w: "🛵 PedidosYa" };
    if (c === "CN") return { u: "", w: "배달", none: "중국은 메이퇀(美团) 공개 링크가 없어 앱에서 직접 주문해 주세요." };
    return { u: "https://www.google.com/maps/search/?api=1&query=" + E(food + " delivery"), w: "📍 Google Maps (배달 가능한 곳)" };
  }
  function music(q, c) {
    var t = String(q || "").replace(/유튜브에서|유튜브|유툽|유투브|youtube|on youtube/gi, "").replace(/틀어\s*줘?|들려\s*줘?|재생\s*해?\s*줘?|재생|플레이\s*해?\s*줘?|\bplay\b|listen\s*to|좀|해\s*줘?|켜\s*줘?|찾아\s*줘?|\b(the|a|some)\s*(song|music|video)\b/gi, "").replace(/\s+/g, " ").trim() || q;
    if (c === "CN") return { u: "https://search.bilibili.com/all?keyword=" + E(t), w: "▶ bilibili", note: "중국은 유튜브가 막혀 있어 bilibili 검색으로 엽니다." };
    return { u: "https://www.youtube.com/results?search_query=" + E(t), w: "▶ YouTube" };
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
    var name = q.replace(/\d{1,2}\s*월\s*\d{1,2}\s*일?/g, " ").replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{1,2}\b/gi, " ").replace(/\b\d{1,2}\/\d{1,2}\b/g, " ")
      .replace(/\d+\s*(박|nights?|명|인원|인|사람|people|persons?|adults?|guests?)/gi, " ").replace(/(예약|숙박|묵을|묵고|체크인|빈\s*방|객실|방\s*잡아?|해\s*줘?|줘|좀|알려|찾아)/g, " ")
      .replace(/\b(book(ing|ed)?|reserve|find|get|me|a|an|the|room|rooms|for|in|at|on|to|near|stay|nights?|please|from|until|till|people|persons?|adults?|guests?|and)\b/gi, " ").replace(/\s+/g, " ").trim();
    return { stay: name || clean(q), ci: ci, co: co, ppl: ppl, nights: nights };
  }
  function stay(q, c) {
    var i = stayInfo(q);
    if (c === "KR") return { u: "https://www.yeogi.com/domestic-accommodations?keyword=" + E(i.stay) + (i.ci ? "&checkIn=" + i.ci + "&checkOut=" + i.co : "") + "&personal=" + i.ppl + "&freeForm=true", w: "🏨 여기어때", alt: { u: "https://www.yanolja.com/search/" + E(i.stay), w: "야놀자" }, info: i };
    return { u: "https://www.booking.com/searchresults.html?ss=" + E(i.stay) + (i.ci ? "&checkin=" + i.ci + "&checkout=" + i.co : "") + "&group_adults=" + i.ppl + "&no_rooms=1", w: "🏨 Booking.com", alt: { u: "https://www.airbnb.com/s/" + E(i.stay) + "/homes" + (i.ci ? "?checkin=" + i.ci + "&checkout=" + i.co + "&adults=" + i.ppl : ""), w: "Airbnb" }, info: i };
  }

  /* ── 규칙으로 판별 → {kind, q} ── */
  /* ══════════════ 현지어 규칙 (30개국 언어) ══════════════
     한국어·영어 규칙에 안 걸린 문장을 그 나라 말로 다시 본다. 낱말 목록(소문자 포함 검사)이라 띄어쓰기·어미 변화에 강하다.
     글자 모양으로 언어를 먼저 고르고(일본어 가나·중국어 한자·태국어·아랍어·힌디어·베트남어 성조 부호), 라틴 문자 언어는 가장 많이 맞는 목록을 쓴다.
     여는 곳은 나라별(위 표)과 같고, 현지어 검색어는 그 나라 지도·쇼핑이 그대로 알아들으므로 번역하지 않는다. */
  var L = {
    ja: { place: ["レストラン","食事","ご飯","ごはん","美味しい","おいしい","グルメ","飲食店","居酒屋","ラーメン","寿司","カフェ","喫茶","観光","名所","観光地","見どころ","スポット","遊び","行くところ","おすすめの場所","デート"], near: ["近く","周辺","近い","この辺","付近","最寄り"],
      kinds: ["薬局","ドラッグストア","病院","コンビニ","駅","銀行","atm","ガソリンスタンド","駐車場","ホテル","スーパー","トイレ","公園","美容院","床屋","ジム","郵便局","交番","図書館","空港"],
      navi: ["道案内","ナビ","行き方","経路","ルート","まで行","へ行","に行き","案内して","連れて","行きたい"], music: ["流して","再生","聴きたい","聞きたい","かけて","曲","音楽","ユーチューブ","youtube"],
      shop: ["買いたい","購入","最安値","安い","値段","価格","いくら","ショッピング","通販","どこで買","セール","お得"], taxi: ["タクシー","ウーバー","uber","配車","go タクシー"], train: ["電車","新幹線","列車","乗車券","切符","指定席","jr"],
      delivery: ["出前","デリバリー","配達","宅配","ウーバーイーツ","出前館"], pay: ["送金","振込","振り込","支払","ペイペイ","paypay","お金を送"], stay: ["ホテル","宿","泊","宿泊","民宿","旅館","部屋"], book: ["予約","泊","取って","取りたい"],
      call: ["電話"], sms: ["メッセージ","sms","メール"], question: ["方法","とは","意味","なぜ","どうして","使い方","作り方","レシピ","教えて下さい"], stop: ["教えて","おしえて","おすすめ","ください","下さい","どこ","まで","への","から","近くで","近くの","周辺の","美味しい","おいしい","探して","見つけて","行きたい","呼んで","お願い","の","を","で","？","?"] },
    zh: { place: ["餐厅","餐廳","美食","好吃","吃饭","吃飯","饭店","飯店","小吃","火锅","咖啡","景点","景點","旅游","旅遊","好玩","景区","名胜","打卡","去哪","哪里玩","约会"], near: ["附近","周边","周邊","旁边","旁邊","最近的","这边","這邊"],
      kinds: ["药店","藥局","药房","医院","醫院","诊所","便利店","便利商店","地铁站","捷運","银行","銀行","atm","加油站","停车场","停車場","酒店","饭店","超市","厕所","洗手间","公园","公園","理发","美发","健身房","邮局","机场","機場"],
      navi: ["导航","導航","怎么走","怎麼走","怎么去","怎麼去","路线","路線","带我去","帶我去","去一下","到"], music: ["播放","放一首","放歌","听","聽","歌","音乐","音樂","油管","youtube","mv","b站"],
      shop: ["买","買","购买","購買","最便宜","便宜","价格","價格","多少钱","多少錢","购物","購物","哪里买","哪裡買","淘宝","优惠","折扣"], taxi: ["打车","打車","出租车","計程車","的士","叫车","叫車","滴滴","uber"], train: ["火车","火車","高铁","高鐵","动车","车票","車票","订票","訂票","12306","台铁","高铁票"],
      delivery: ["外卖","外賣","送餐","点餐","點餐","美团","饿了么","foodpanda","uber eats"], pay: ["转账","轉帳","付款","支付","汇款","匯款","支付宝","微信支付","转钱"], stay: ["酒店","飯店","住宿","民宿","旅馆","旅館","房间","房間"], book: ["订","訂","预订","預訂","预定","住","晚"],
      call: ["打电话","打電話","电话","電話"], sms: ["短信","簡訊","发消息","發訊息"], question: ["怎么做","怎麼做","是什么","是什麼","为什么","為什麼","什么意思","方法","教程","食谱","怎么办"], stop: ["推荐","推薦","告诉我","告訴我","有没有","有沒有","哪里有","哪裡有","请","請","吗","嗎","一下","帮我","幫我","我想","我要","想去","想吃","有什么","什么","哪里","哪儿","附近的","好吃的","的","？","?"] },
    th: { place: ["ร้านอาหาร","อาหาร","ของกิน","กิน","อร่อย","ร้านกาแฟ","คาเฟ่","ที่เที่ยว","เที่ยว","สถานที่ท่องเที่ยว","น่าไป","ไปไหนดี","แหล่งท่องเที่ยว"], near: ["ใกล้","แถวนี้","ใกล้ๆ","บริเวณ","รอบๆ"],
      kinds: ["ร้านขายยา","โรงพยาบาล","คลินิก","เซเว่น","ร้านสะดวกซื้อ","ปั๊มน้ำมัน","ที่จอดรถ","ธนาคาร","ตู้เอทีเอ็ม","atm","โรงแรม","ห้องน้ำ","ตลาด","สวนสาธารณะ","ร้านตัดผม","ฟิตเนส","สถานี","สนามบิน","ไปรษณีย์"],
      navi: ["นำทาง","ทางไป","ไปยังไง","ไปอย่างไร","เส้นทาง","พาไป","ไปที่","ไปส่ง"], music: ["เปิดเพลง","เล่นเพลง","ฟังเพลง","เพลง","ยูทูป","youtube","อยากฟัง"],
      shop: ["ซื้อ","ราคา","ถูกที่สุด","ถูกๆ","เท่าไหร่","เท่าไร","ช้อปปิ้ง","ซื้อที่ไหน","โปรโมชั่น","ลดราคา"], taxi: ["แท็กซี่","เรียกรถ","แกร็บ","grab","โบลท์","bolt"], train: ["รถไฟ","ตั๋วรถไฟ","จองตั๋ว","รถไฟฟ้า","บีทีเอส"],
      delivery: ["สั่งอาหาร","เดลิเวอรี่","ส่งอาหาร","สั่งข้าว","แกร็บฟู้ด","grabfood","ไลน์แมน","lineman"], pay: ["โอนเงิน","โอน","จ่ายเงิน","พร้อมเพย์","ชำระ"], stay: ["โรงแรม","ที่พัก","รีสอร์ท","โฮสเทล","ห้องพัก"], book: ["จอง","คืน","พัก"],
      call: ["โทร","โทรหา"], sms: ["ส่งข้อความ","ข้อความ","sms"], question: ["วิธี","คืออะไร","ทำไม","หมายความว่า","สูตร","ทำยังไง"], stop: ["แนะนำ","หน่อย","ที่ไหน","ครับ","ค่ะ","คะ","ให้หน่อย","แถวนี้","ใกล้ๆ","อยาก","เรียก","ขอ","?"] },
    vi: { place: ["nhà hàng","quán ăn","ăn gì","ăn ngon","ngon","quán cà phê","cà phê","cafe","quán nhậu","địa điểm","du lịch","tham quan","chỗ chơi","đi đâu","vui chơi","check in"], near: ["gần","gần đây","quanh đây","xung quanh","ở đây"],
      kinds: ["hiệu thuốc","nhà thuốc","bệnh viện","phòng khám","cửa hàng tiện lợi","circle k","cây xăng","bãi đỗ xe","bãi đậu xe","ngân hàng","atm","khách sạn","siêu thị","chợ","nhà vệ sinh","công viên","tiệm tóc","phòng gym","ga tàu","sân bay","bưu điện"],
      navi: ["chỉ đường","đường đi","đi đến","dẫn đường","lộ trình","đường tới","đưa tôi","đi tới"], music: ["mở nhạc","phát nhạc","phát bài","nghe nhạc","bài hát","nhạc","youtube","mở bài"],
      shop: ["mua","giá","rẻ nhất","giá rẻ","bao nhiêu tiền","mua sắm","mua ở đâu","khuyến mãi","giảm giá","shopee"], taxi: ["taxi","gọi xe","grab","xe ôm","be ","gojek"], train: ["tàu hỏa","tàu lửa","vé tàu","đặt vé tàu","đường sắt"],
      delivery: ["giao hàng","giao đồ ăn","đặt đồ ăn","ship đồ ăn","đặt món","grabfood","shopeefood","baemin"], pay: ["chuyển tiền","chuyển khoản","thanh toán","momo","zalopay","gửi tiền"], stay: ["khách sạn","chỗ ở","nhà nghỉ","homestay","phòng","resort"], book: ["đặt","đêm","ở lại","thuê"],
      call: ["gọi điện","gọi cho","điện thoại"], sms: ["nhắn tin","tin nhắn","sms"], question: ["cách","là gì","tại sao","nghĩa là","hướng dẫn","công thức","làm sao"], stop: ["gợi ý","cho tôi","ở đâu","có","nhé","giúp","tìm","với","nào","?","đến","tới","ở","gần đây","quanh đây","gần","tôi","mình","muốn","hãy","đi","gọi","ra","đặt"] },
    id: { place: ["restoran","rumah makan","makan","makanan","enak","kafe","warung","kuliner","tempat wisata","wisata","tempat nongkrong","jalan-jalan","tempat menarik","liburan","tempat makan","makan apa"], near: ["dekat","sekitar","terdekat","di sini","sekitar sini","berdekatan"],
      kinds: ["apotek","apotik","farmasi","rumah sakit","klinik","minimarket","indomaret","alfamart","spbu","pom bensin","parkir","bank","atm","hotel","supermarket","pasar","toilet","taman","salon","barber","gym","stasiun","bandara","kantor pos","terminal"],
      navi: ["arah ke","rute","petunjuk arah","navigasi","cara ke","antar ke","jalan ke","pergi ke","menuju","bawa saya","tunjukkan jalan"], music: ["putar","putarkan","mainkan","dengar","dengarkan","lagu","musik","youtube","setel"],
      shop: ["beli","harga","termurah","murah","berapa","belanja","beli di mana","promo","diskon","tokopedia","shopee","lazada"], taxi: ["taksi","taxi","grab","gojek","gocar","pesan mobil","pesan ojek","ojek"], train: ["kereta","krl","tiket kereta","pesan tiket","kai","mrt"],
      delivery: ["pesan makanan","antar makanan","delivery","gofood","grabfood","shopeefood","pesan antar"], pay: ["transfer","kirim uang","bayar","ovo","dana","gopay","qris","transfer uang"], stay: ["hotel","penginapan","villa","homestay","hostel","kamar"], book: ["pesan","booking","menginap","malam","sewa"],
      call: ["telepon","telpon","hubungi"], sms: ["kirim pesan","sms","wa ","whatsapp"], question: ["cara","apa itu","kenapa","mengapa","artinya","tutorial","resep","bagaimana"], stop: ["rekomendasi","rekomendasikan","tolong","di mana","dimana","ada","dong","ya","carikan","cari","yang","saya","aku","ingin","mau","?","sini","di sini","dekat sini","sekitar sini","dekat","terdekat","ke","di","yang enak","enak","tempat","pesan","panggil","antar"] },
    es: { place: ["restaurante","comer","comida","rico","cafetería","café","bar","tapas","lugares para visitar","qué ver","que ver","turístico","turistico","atracciones","sitios","dónde ir","donde ir","qué hacer","que hacer","paseo","salir"], near: ["cerca","cercano","por aquí","por aqui","alrededor","más cercano","mas cercano"],
      kinds: ["farmacia","hospital","clínica","clinica","gasolinera","parking","estacionamiento","banco","cajero","hotel","supermercado","mercado","baño","parque","peluquería","peluqueria","gimnasio","estación","estacion","metro","aeropuerto","correos"],
      navi: ["cómo llegar","como llegar","cómo llego","como llego","ruta","dirección a","direccion a","llévame","llevame","navegar","ir a","camino a","indicaciones"], music: ["pon ","reproduce","reproducir","escuchar","canción","cancion","música","musica","youtube","ponme"],
      shop: ["comprar","precio","más barato","mas barato","barato","cuánto cuesta","cuanto cuesta","cuánto vale","compras","dónde comprar","donde comprar","oferta","rebajas","descuento"], taxi: ["taxi","uber","cabify","didi","pedir un coche","pide un taxi"], train: ["tren","renfe","ave ","billete","boleto","reservar tren","pasaje"],
      delivery: ["pedir comida","delivery","a domicilio","rappi","glovo","uber eats","pedidos"], pay: ["enviar dinero","transferir","transferencia","pagar","bizum","mandar dinero","paypal"], stay: ["hotel","hostal","alojamiento","habitación","habitacion","airbnb","hospedaje","posada"], book: ["reservar","reserva","noches","noche","alojarme","quedarme"],
      call: ["llamar","llama a","llamada"], sms: ["mensaje","sms","enviar un mensaje","whatsapp"], question: ["cómo se hace","como se hace","qué es","que es","por qué","por que","significa","receta","cómo hacer","como hacer"], stop: ["recomienda","recomiéndame","recomiendame","dónde","donde","hay","por favor","quiero","busca","buscar","encuentra","un","una","unos","unas","el","la","los","las","de","en","para","me","algún","alguna","?","¿","aquí","aqui","al","a la","hasta","cerca","cercano","por aquí","por aqui","alrededor","pide","pedir","llama","llamar"] },
    fr: { place: ["restaurant","manger","bon resto","cuisine","café","brasserie","bar","à visiter","a visiter","que voir","touristique","attractions","endroits","où aller","ou aller","balade","que faire","sortir","bonne adresse"], near: ["près","pres","proche","à côté","a cote","autour","par ici","le plus proche"],
      kinds: ["pharmacie","hôpital","hopital","clinique","station-service","station service","parking","banque","distributeur","hôtel","hotel","supermarché","supermarche","marché","marche","toilettes","parc","coiffeur","salle de sport","gare","métro","metro","aéroport","aeroport","poste"],
      navi: ["itinéraire","itineraire","comment aller","comment me rendre","route vers","emmène-moi","emmene-moi","naviguer","aller à","aller a","direction","chemin pour"], music: ["mets ","joue ","écouter","ecouter","chanson","musique","youtube","lance"],
      shop: ["acheter","prix","moins cher","pas cher","combien coûte","combien coute","shopping","où acheter","ou acheter","promo","soldes","réduction"], taxi: ["taxi","uber","vtc","bolt","heetch","commande un taxi"], train: ["train","sncf","tgv","billet","réserver un train","reserver un train","ouigo"],
      delivery: ["commander","livraison","à emporter","deliveroo","uber eats","se faire livrer"], pay: ["envoyer de l'argent","virement","payer","lydia","paypal","transférer","transferer"], stay: ["hôtel","hotel","auberge","hébergement","hebergement","chambre","airbnb","gîte","gite"], book: ["réserver","reserver","réservation","nuits","nuit","dormir"],
      call: ["appeler","appelle","appel"], sms: ["message","sms","texto","envoyer un message","whatsapp"], question: ["comment faire","c'est quoi","qu'est-ce que","pourquoi","signifie","recette","comment on fait"], stop: ["recommande","conseille","où","ou","il y a","s'il te plaît","s'il vous plaît","stp","svp","je veux","je cherche","trouve","trouver","un","une","des","le","la","les","de","du","en","pour","moi","me","?","ici","d'ici","au","aux","à","a","vers","près","pres","proche","à côté","a cote","autour","commande","commander","appelle"] },
    de: { place: ["restaurant","essen gehen","essen","lecker","café","cafe","bar","kneipe","sehenswürdigkeiten","sehenswurdigkeiten","was kann man","ausflug","orte","wohin","sehenswert","unternehmen","gut essen"], near: ["in der nähe","in der nahe","nahe","hier","umgebung","nächste","nachste","nächstgelegene"],
      kinds: ["apotheke","krankenhaus","arzt","tankstelle","parkplatz","bank","geldautomat","hotel","supermarkt","markt","toilette","park","friseur","fitnessstudio","bahnhof","u-bahn","flughafen","post"],
      navi: ["route","wegbeschreibung","wie komme ich","navigation","bring mich","fahren nach","weg nach","navigiere","wie kommt man","richtung"], music: ["spiel ","spiele ","abspielen","hören","horen","lied","song","musik","youtube","anhören"],
      shop: ["kaufen","preis","billigste","günstig","gunstig","billig","wie viel kostet","was kostet","shopping","wo kaufen","angebot","rabatt","einkaufen"], taxi: ["taxi","uber","bolt","freenow","taxi rufen"], train: ["zug","bahn","ice","fahrkarte","ticket","zugticket","db "],
      delivery: ["bestellen","lieferung","lieferando","liefern lassen","wolt","uber eats"], pay: ["geld senden","überweisen","uberweisen","überweisung","bezahlen","paypal","geld schicken"], stay: ["hotel","unterkunft","pension","zimmer","airbnb","hostel","ferienwohnung"], book: ["buchen","buchung","übernachtung","ubernachtung","nächte","nachte","nacht","übernachten"],
      call: ["anrufen","ruf ","anruf"], sms: ["nachricht","sms","schreib ","whatsapp"], question: ["wie macht man","was ist","warum","bedeutet","rezept","anleitung","wie funktioniert"], stop: ["empfiehl","empfehlung","wo","gibt es","bitte","ich möchte","ich mochte","ich will","suche","finde","ein","eine","einen","der","die","das","in","nach","mir","mich","?","zum","zur","nach","zu","hier","in der nähe","in der nahe","nahe","umgebung","rufen","ruf","bestellen"] },
    it: { place: ["ristorante","mangiare","buono","trattoria","pizzeria","caffè","caffe","bar","da visitare","cosa vedere","turistico","attrazioni","posti","dove andare","cosa fare","gita","aperitivo"], near: ["vicino","qui vicino","nei dintorni","intorno","più vicino","piu vicino"],
      kinds: ["farmacia","ospedale","clinica","benzinaio","distributore","parcheggio","banca","bancomat","hotel","supermercato","mercato","bagno","parco","parrucchiere","palestra","stazione","metro","aeroporto","posta"],
      navi: ["come arrivare","come arrivo","percorso","indicazioni","portami","navigare","andare a","strada per","come raggiungere"], music: ["metti ","riproduci","ascoltare","canzone","musica","youtube","fammi sentire"],
      shop: ["comprare","prezzo","più economico","piu economico","economico","quanto costa","shopping","dove comprare","offerta","sconto","acquistare"], taxi: ["taxi","uber","chiama un taxi","freenow"], train: ["treno","trenitalia","italo","biglietto","prenotare treno","frecciarossa"],
      delivery: ["ordinare","consegna","a domicilio","glovo","deliveroo","just eat","ordina"], pay: ["inviare soldi","bonifico","pagare","paypal","satispay","mandare soldi"], stay: ["hotel","albergo","alloggio","camera","b&b","airbnb","ostello","agriturismo"], book: ["prenotare","prenotazione","notti","notte","dormire","soggiornare"],
      call: ["chiamare","chiama","telefonare"], sms: ["messaggio","sms","scrivi a","whatsapp"], question: ["come si fa","cos'è","che cos'è","perché","perche","significa","ricetta","come fare"], stop: ["consiglia","consigliami","dove","c'è","ce","per favore","voglio","cerco","trova","trovare","un","una","il","lo","la","i","gli","le","di","a","in","per","mi","?","al","alla","allo","ai","agli","alle","qui","vicino","qui vicino","nei dintorni","intorno","chiama","chiamare","ordina","ordinare"] },
    pt: { place: ["restaurante","comer","comida","gostoso","café","cafe","bar","boteco","lugares para visitar","o que fazer","turístico","turistico","atrações","atracoes","pontos turísticos","onde ir","passeio","o que ver","rolê","role"], near: ["perto","próximo","proximo","por aqui","ao redor","mais próximo","mais proximo"],
      kinds: ["farmácia","farmacia","hospital","clínica","clinica","posto de gasolina","posto","estacionamento","banco","caixa eletrônico","caixa eletronico","hotel","supermercado","mercado","banheiro","parque","cabeleireiro","barbearia","academia","estação","estacao","metrô","metro","aeroporto","correios"],
      navi: ["como chegar","como chego","rota","direção","direcao","me leve","me leva","navegar","ir para","caminho para","trajeto"], music: ["toca ","tocar","reproduzir","ouvir","música","musica","canção","cancao","youtube","coloca"],
      shop: ["comprar","preço","preco","mais barato","barato","quanto custa","compras","onde comprar","promoção","promocao","desconto","oferta"], taxi: ["táxi","taxi","uber","99","chamar um carro","indriver"], train: ["trem","passagem de trem","bilhete","comboio"],
      delivery: ["pedir comida","delivery","entrega","ifood","rappi","pedir"], pay: ["enviar dinheiro","transferir","pix","pagar","transferência","transferencia","mandar dinheiro"], stay: ["hotel","pousada","hospedagem","quarto","airbnb","hostel","resort"], book: ["reservar","reserva","noites","noite","hospedar","ficar"],
      call: ["ligar","ligue","liga para","telefonar"], sms: ["mensagem","sms","mandar mensagem","whatsapp"], question: ["como fazer","o que é","o que e","por que","porque","significa","receita","como faço"], stop: ["recomenda","recomende","indica","onde","tem","por favor","quero","procuro","busca","encontre","um","uma","uns","umas","o","a","os","as","de","em","para","me","?","no","na","nos","nas","ao","à","até","aqui","perto","próximo","proximo","por aqui","de mim","chamar","chama","pedir"] },
    nl: { place: ["restaurant","eten","lekker","café","cafe","bar","kroeg","bezienswaardigheden","wat te doen","uitje","plekken","waar naartoe","leuke plekken","uit eten"], near: ["in de buurt","dichtbij","hier","omgeving","dichtstbijzijnde","vlakbij"],
      kinds: ["apotheek","ziekenhuis","huisarts","tankstation","parkeren","parkeerplaats","bank","geldautomaat","pinautomaat","hotel","supermarkt","markt","toilet","wc","park","kapper","sportschool","station","metro","luchthaven","postkantoor"],
      navi: ["route","routebeschrijving","hoe kom ik","navigatie","breng me","rijden naar","weg naar","navigeer","richting"], music: ["speel ","afspelen","luisteren","liedje","nummer","muziek","youtube","zet "],
      shop: ["kopen","prijs","goedkoopste","goedkoop","hoeveel kost","winkelen","waar kopen","aanbieding","korting","bol.com"], taxi: ["taxi","uber","bolt"], train: ["trein","ns ","treinkaartje","kaartje","ov"],
      delivery: ["bestellen","bezorgen","bezorging","thuisbezorgd","uber eats","deliveroo"], pay: ["geld sturen","overmaken","betalen","tikkie","paypal","overschrijven"], stay: ["hotel","accommodatie","kamer","airbnb","hostel","vakantiehuis"], book: ["boeken","boeking","overnachting","nachten","nacht","overnachten","verblijven"],
      call: ["bellen","bel ","telefoneren"], sms: ["bericht","sms","appen","whatsapp","sturen"], question: ["hoe maak je","wat is","waarom","betekent","recept","hoe werkt","uitleg"], stop: ["aanbevelen","aanrader","tip","waar","is er","zijn er","alsjeblieft","alstublieft","ik wil","zoek","vind","een","de","het","in","naar","voor","mij","me","?","naar","hier","in de buurt","dichtbij","vlakbij","omgeving","bij"] },
    sv: { place: ["restaurang","äta","ata","mat","gott","kafé","kafe","café","bar","krog","sevärdheter","sevardheter","saker att göra","saker att gora","utflykt","platser","vart ska","ställen","stallen","äta ute"], near: ["nära","nara","i närheten","i narheten","här","har","närmaste","narmaste","runt"],
      kinds: ["apotek","sjukhus","vårdcentral","vardcentral","bensinstation","mack","parkering","bank","bankomat","hotell","mataffär","mataffar","livsmedel","ica","toalett","park","frisör","frisor","gym","station","tunnelbana","flygplats","posten"],
      navi: ["vägbeskrivning","vagbeskrivning","hur kommer jag","rutt","navigera","ta mig till","åka till","aka till","vägen till","vagen till","hitta till"], music: ["spela","lyssna","låt","lat","musik","youtube","sätt på","satt pa"],
      shop: ["köpa","kopa","pris","billigast","billig","vad kostar","shopping","var köper","var koper","erbjudande","rea","rabatt"], taxi: ["taxi","uber","bolt"], train: ["tåg","tag ","sj","tågbiljett","tagbiljett","biljett","pendeltåg"],
      delivery: ["beställa","bestalla","leverans","hemkörning","hemkorning","foodora","wolt","uber eats"], pay: ["skicka pengar","överföra","overfora","betala","swish","swisha"], stay: ["hotell","boende","rum","airbnb","vandrarhem","stuga"], book: ["boka","bokning","övernattning","overnattning","nätter","natter","natt","bo "],
      call: ["ringa","ring "], sms: ["meddelande","sms","skicka","messa"], question: ["hur gör man","hur gor man","vad är","vad ar","varför","varfor","betyder","recept","hur fungerar"], stop: ["rekommendera","tips på","tips pa","var","finns","tack","jag vill","leta","hitta","en","ett","i","till","för","for","mig","?","till","här","har","nära","nara","i närheten","i narheten","runt","mig"] },
    pl: { place: ["restauracja","zjeść","zjesc","jeść","jesc","jedzenie","pyszne","kawiarnia","bar","pub","knajpa","atrakcje","co zobaczyć","co zobaczyc","zwiedzanie","miejsca","gdzie iść","gdzie isc","warto zobaczyć","co robić","co robic"], near: ["blisko","w pobliżu","w poblizu","tutaj","najbliższa","najblizsza","najbliższy","okolica","niedaleko"],
      kinds: ["apteka","szpital","przychodnia","stacja benzynowa","stacja paliw","parking","bank","bankomat","hotel","sklep","market","biedronka","toaleta","park","fryzjer","siłownia","silownia","dworzec","metro","lotnisko","poczta"],
      navi: ["jak dojechać","jak dojechac","jak dojść","jak dojsc","trasa","nawigacja","zaprowadź","zaprowadz","jedź do","jedz do","droga do","nawiguj","dojazd"], music: ["puść","pusc","włącz","wlacz","odtwórz","odtworz","posłuchać","posluchac","piosenka","piosenkę","muzyka","muzykę","youtube"],
      shop: ["kupić","kupic","cena","najtaniej","tanio","ile kosztuje","zakupy","gdzie kupić","gdzie kupic","promocja","allegro","przecena"], taxi: ["taksówka","taksowka","taxi","uber","bolt","freenow"], train: ["pociąg","pociag","pkp","bilet","intercity","kolej"],
      delivery: ["zamówić","zamowic","dostawa","pyszne.pl","glovo","uber eats","wolt","zamów"], pay: ["wyślij pieniądze","wyslij pieniadze","przelew","zapłać","zaplac","blik","przelać","przelac","revolut"], stay: ["hotel","nocleg","pokój","pokoj","airbnb","hostel","pensjonat","apartament"], book: ["zarezerwować","zarezerwowac","rezerwacja","noce","noc","zatrzymać"],
      call: ["zadzwoń","zadzwon","dzwoń","telefon"], sms: ["wiadomość","wiadomosc","sms","napisz do","whatsapp"], question: ["jak zrobić","jak zrobic","co to jest","dlaczego","znaczy","przepis","jak działa","instrukcja"], stop: ["poleć","polec","polecasz","gdzie","jest","są","sa","proszę","prosze","chcę","chce","szukam","znajdź","znajdz","jakieś","jakies","w","do","na","mi","?","do","na","tutaj","blisko","w pobliżu","w poblizu","niedaleko","okolica","zamów","zamówić","zamowic"] },
    tr: { place: ["restoran","yemek","lezzetli","kafe","kahve","bar","meyhane","gezilecek yerler","görülecek","gorulecek","turistik","gezi","nereye gid","mekan","ne yenir","yemek yeri"], near: ["yakın","yakin","yakında","yakinda","buralarda","en yakın","en yakin","civar","çevre"],
      kinds: ["eczane","hastane","klinik","benzin istasyonu","benzinlik","otopark","banka","atm","otel","market","süpermarket","supermarket","tuvalet","park","kuaför","kuafor","berber","spor salonu","istasyon","metro","havalimanı","havalimani","postane"],
      navi: ["nasıl giderim","nasil giderim","nasıl gidilir","nasil gidilir","yol tarifi","rota","navigasyon","beni götür","beni gotur","gidelim","yolu"], music: ["çal","cal ","oynat","dinle","şarkı","sarki","müzik","muzik","youtube","aç"],
      shop: ["satın al","satin al","almak istiyorum","fiyat","en ucuz","ucuz","ne kadar","kaç para","kac para","alışveriş","alisveris","nereden alınır","nereden alinir","indirim","kampanya","trendyol"], taxi: ["taksi","uber","bitaksi","taksi çağır"], train: ["tren","yht","tcdd","bilet","marmaray"],
      delivery: ["sipariş","siparis","yemek sipariş","teslimat","yemeksepeti","getir","trendyol yemek"], pay: ["para gönder","para gonder","havale","eft","ödeme","odeme","papara","öde"], stay: ["otel","konaklama","pansiyon","oda","airbnb","hostel","apart"], book: ["rezervasyon","gece","kalmak","rezerve"],
      call: ["ara","arama","telefon et"], sms: ["mesaj","sms","yaz","whatsapp"], question: ["nasıl yapılır","nasil yapilir","nedir","neden","anlamı","anlami","tarif","nasıl çalışır"], stop: ["öner","oner","tavsiye","nerede","var mı","var mi","lütfen","lutfen","istiyorum","bul","bana","bir","de","da","?","ye","ya","e","a","buralarda","yakın","yakin","yakında","yakinda","civar","bana","beni","çağır","cagir","sipariş","siparis"] },
    ar: { place: ["مطعم","مطاعم","أكل","اكل","طعام","لذيذ","كافيه","كوفي","مقهى","أماكن سياحية","اماكن سياحية","سياحة","معالم","أماكن","اماكن","وين أروح","وين اروح","فين أروح","نتفسح","مكان حلو"], near: ["قريب","قريبة","بالقرب","حولي","هنا","أقرب","اقرب"],
      kinds: ["صيدلية","مستشفى","عيادة","محطة بنزين","بنزين","موقف","مواقف","بنك","صراف","فندق","سوبرماركت","بقالة","حمام","دورة مياه","حديقة","صالون","حلاق","نادي","جيم","محطة","مترو","مطار","بريد"],
      navi: ["الطريق إلى","الطريق الى","كيف أروح","كيف اروح","كيف أصل","كيف اوصل","اتجاهات","ملاحة","وديني","خذني","دلني"], music: ["شغل","تشغيل","اسمع","أغنية","اغنية","موسيقى","يوتيوب","youtube","سمعني"],
      shop: ["اشتري","أشتري","شراء","سعر","أرخص","ارخص","رخيص","بكم","كم سعر","تسوق","وين أشتري","وين اشتري","عرض","خصم","تخفيض","نون","امازون"], taxi: ["تاكسي","أوبر","اوبر","كريم","سيارة أجرة","اطلب سيارة"], train: ["قطار","تذكرة","الحرمين","سار","مترو"],
      delivery: ["اطلب","توصيل","طلبات","هنقرستيشن","جاهز","طلب أكل","مرسول"], pay: ["حول","تحويل","ادفع","دفع","stc pay","أرسل فلوس","ارسل فلوس","فلوس"], stay: ["فندق","سكن","غرفة","شقة","منتجع","نزل"], book: ["حجز","احجز","ليلة","ليالي","أقيم"],
      call: ["اتصل","كلم","مكالمة"], sms: ["رسالة","مسج","ارسل رسالة","واتساب"], question: ["كيف أسوي","كيف اسوي","كيف اعمل","ما هو","ما هي","ليش","لماذا","معنى","وصفة","طريقة"], stop: ["اقترح","وين","فين","فيه","لو سمحت","أبغى","ابغى","أبي","ابي","أريد","اريد","دور","ابحث","في","على","لي","؟","?","إلى","الى","ل","هنا","قريب","قريبة","بالقرب","حولي","أقرب","اقرب","اطلب","أطلب"] },
    hi: { place: ["रेस्टोरेंट","रेस्तरां","खाना","खाने की जगह","स्वादिष्ट","ढाबा","कैफे","घूमने की जगह","घूमने","पर्यटन","दर्शनीय","कहाँ जाएं","कहां जाएं","मशहूर जगह"], near: ["पास","नज़दीक","नजदीक","आसपास","यहाँ","यहां","सबसे पास"],
      kinds: ["दवाई","दवा","फार्मेसी","मेडिकल","अस्पताल","हॉस्पिटल","पेट्रोल पंप","पार्किंग","बैंक","एटीएम","होटल","सुपरमार्केट","बाज़ार","बाजार","शौचालय","टॉयलेट","पार्क","सैलून","जिम","स्टेशन","मेट्रो","एयरपोर्ट","डाकघर"],
      navi: ["रास्ता","कैसे जाएं","कैसे पहुंचे","कैसे पहुँचे","नेविगेशन","ले चलो","जाना है","रूट","दिशा"], music: ["चलाओ","बजाओ","सुनना","सुनाओ","गाना","गीत","संगीत","यूट्यूब","youtube"],
      shop: ["खरीदना","खरीदो","कीमत","सबसे सस्ता","सस्ता","कितने का","कितने में","शॉपिंग","कहाँ मिलेगा","कहां मिलेगा","ऑफर","डिस्काउंट","फ्लिपकार्ट","अमेज़न"], taxi: ["टैक्सी","ओला","उबर","कैब","रिक्शा","ऑटो"], train: ["ट्रेन","रेल","रेलगाड़ी","टिकट","irctc"],
      delivery: ["ऑर्डर","डिलीवरी","खाना मंगवाना","मंगवाओ","swiggy","zomato","स्विगी","जोमैटो"], pay: ["पैसे भेजो","पैसे भेजना","ट्रांसफर","भुगतान","यूपीआई","upi","paytm","phonepe","गूगल पे"], stay: ["होटल","रहने की जगह","कमरा","धर्मशाला","गेस्ट हाउस","रिसॉर्ट"], book: ["बुक","बुकिंग","रात","रुकना","ठहरना"],
      call: ["कॉल","फोन करो","फ़ोन","कॉल करो"], sms: ["मैसेज","संदेश","sms","भेजो","व्हाट्सएप"], question: ["कैसे बनाएं","कैसे बनाते","क्या है","क्यों","मतलब","रेसिपी","तरीका"], stop: ["बताओ","बताइए","सुझाव","कहाँ","कहां","है","हैं","कृपया","मुझे","चाहिए","ढूंढो","खोजो","का","की","के","में","?","पास","पास में","नज़दीक","नजदीक","आसपास","यहाँ","यहां","को","तक","करो","कर दो","दो","बुलाओ","ऑर्डर"] }
  };
  /* 글자 모양으로 언어 고르기. 라틴 문자면 낱말이 가장 많이 맞는 언어 */
  var LATIN = ["es","fr","de","it","pt","nl","sv","pl","tr","id"];
  function allWords(d) { var out = []; for (var k in d) if (d.hasOwnProperty(k) && k !== "stop") out = out.concat(d[k]); return out; }
  var LETTER = null; try { LETTER = new RegExp("\\p{L}", "u"); } catch (e) { LETTER = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0590-\u06FF\u0900-\u097F\u1E00-\u1EFF]/; }
  function isLetter(ch) { return !!ch && LETTER.test(ch); }
  function hasWord(q, w, cjk) {
    if (!w) return false;
    if (cjk) return q.indexOf(w) >= 0;
    var at = -1;
    while ((at = q.indexOf(w, at + 1)) >= 0) {
      if (!isLetter(q.charAt(at - 1)) && !isLetter(q.charAt(at + w.length))) return true;
    }
    return false;
  }
  function hits(q, words, cjk) { var n = 0; for (var i = 0; i < words.length; i++) if (hasWord(q, words[i], cjk)) n++; return n; }
  function isCjk(lang) { return /^(ja|zh|th)$/.test(lang); }
  function detectLang(q) {
    if (/[぀-ヿ]/.test(q)) return "ja";
    if (/[一-鿿]/.test(q)) return "zh";
    if (/[฀-๿]/.test(q)) return "th";
    if (/[؀-ۿ]/.test(q)) return "ar";
    if (/[ऀ-ॿ]/.test(q)) return "hi";
    if (/[ăâđêôơưĂÂĐÊÔƠƯ]|[àáảãạèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/.test(q) && /[ạảẹẻịỉọỏụủđư]/.test(q)) return "vi";
    var best = "", bn = 0, lq = q.toLowerCase();
    for (var i = 0; i < LATIN.length; i++) { var n = hits(lq, allWords(L[LATIN[i]]), false); if (n > bn) { bn = n; best = LATIN[i]; } }
    return bn ? best : "";
  }
  /* 현지어로 판별 → {kind, q, lang} */
  function classifyL(q) {
    var lang = detectLang(q); if (!lang) return null;
    var d = L[lang], lq = q.toLowerCase(), cjk = isCjk(lang);
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
      var lo = out.toLowerCase(), at = -1, parts = [], last = 0;
      while ((at = lo.indexOf(w.toLowerCase(), at + 1)) >= 0) {
        if (!isLetter(lo.charAt(at - 1)) && !isLetter(lo.charAt(at + w.length))) { parts.push(out.slice(last, at)); last = at + w.length; at = last - 1; }
      }
      parts.push(out.slice(last)); out = parts.join(" ");
    }
    return out.replace(/[?？¿؟!¡。、，,]/g, " ").replace(/\s+/g, " ").trim() || q;
  }
  function classify(t) {
    t = String(t || "").trim(); if (!t) return null;
    var en = classifyKE(t), lr = classifyL(t);
    if (lr && (!en || lr.n >= 2 || isCjk(lr.lang) || /^(ar|hi|vi)$/.test(lr.lang) || (en.kind === "place" && lr.kind !== "place"))) return lr;
    return en;
  }
  /* 한국어·영어 규칙 */
  function classifyKE(t) {
    var q = t;
    if (any(R.pay, q) && notQuestion(q) && !/문자|메시지|카톡/.test(q) && (amountOf(q) || /토스|송금|이체|venmo|paypal|cash\s*app|zelle|upi|transfer/i.test(q))) return { kind: "pay", q: q };
    if (any(R.call, q) && notQuestion(q) && /(걸|연결|통화|해\s*줘|해줘|줘|콜|call|dial|ring)/i.test(q) && !/번호\s*(뭐|알려|찾|등록|저장)/.test(q) && !any(R.taxi, q)) return { kind: "call", q: q };
    if (any(R.sms, q) && notQuestion(q) && /(보내|전송|발신|써\s*줘|작성|해\s*줘|줘|에게|한테|께|send|text\s+\w+|message\s+\w+)/i.test(q)) return { kind: "sms", q: q };
    if (any(R.taxi, q) && !/(요금|얼마|시세|몇\s*분|후기|리뷰|뭐야|차이|언제\s*오|how\s*much|price)/i.test(q)) return { kind: "taxi", q: q };
    if (any(R.train, q) && /(예매|예약|표|승차권|끊어|타고\s*가|편도|왕복|자리|좌석|에서.*(까지|행|가는|도착)|book|ticket|from\s+.+\s+to\s+|schedule|to\s+\w+)/i.test(q) && notQuestion(q)) return { kind: "train", q: q };
    if (any(R.delivery, q) && /(시켜|시키|주문|배달|order|deliver|get)/i.test(q) && !/(배달비|배달료|얼마|몇\s*분|언제\s*오|환불|취소|후기|리뷰|how\s*much|how\s*long)/i.test(q)) return { kind: "delivery", q: q };
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
  function naviDest(q) {
    return String(q || "").replace(/(으?로\s*)?(길\s*안내|내비게이션|내비|네비게이션|네비|길\s*찾기|길찾기|가는\s*길|가는\s*법|어떻게\s*가(는|요|줘)?|찾아\s*가(줘|기)?|까지\s*가(줘|는|기)?|데려다\s*(줘)?|목적지|운전|틀어\s*줘?|켜\s*줘?|실행(해|해줘)?|알려\s*줘?|해\s*줘?|줘|좀)/g, " ")
      .replace(/\b(directions?\s*to|navigate\s*to|how\s*(do\s*i|to)\s*get\s*to|route\s*to|take\s*me\s*to|drive\s*to|way\s*to|please|the)\b/gi, " ")
      .replace(/(까지|으로|로|에)\s*$/, "").replace(/\s+/g, " ").trim() || q;
  }
  /* 택시 목적지: "택시 불러줘 타임스퀘어로" → 타임스퀘어, "call a cab to Central Park" → Central Park. 없으면 "" (앱만 연다) */
  function taxiDest(q) {
    var t = String(q || "").replace(/(택시|카카오\s*t|카카오티|불러\s*줘?|호출\s*해?\s*줘?|잡아\s*줘?|콜\s*해?\s*줘?|태워\s*줘?|보내\s*줘?|와\s*줘?|타고\s*가(자|고|줘)?|해\s*줘?|줘|좀|지금|빨리)/gi, " ")
      .replace(/\b(call|get|hail|book|order|me|a|an|the|taxi|cab|uber|lyft|ride|to|please|now|from\s+here)\b/gi, " ")
      .replace(/(까지|으로|로|에)\s*$/, "").replace(/\s+/g, " ").trim();
    return t.length >= 2 ? t : "";
  }
  function shopTopic(q) {
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
    if (k === "place") { var pq = r.query || clean(q); if (/^(근처|주변|여기|가까운|이\s*근방|근방)?$/.test(pq.trim())) pq = (pq.trim() || "근처") + " 맛집"; return mapsSearch(pq, c); }   /* "배고파 근처 뭐 먹지" → 근처 맛집 */
    if (k === "navi") return mapsDir(r.query || naviDest(q), c);
    if (k === "music") return music(r.query || q, c);
    if (k === "shop") return shop(r.query || shopTopic(q), c);
    if (k === "call") { var n = numIn(q); return n ? { u: "tel:" + n, w: "📞 전화" } : { u: "", w: "전화", none: "전화번호를 같이 말해 주세요 (예: 010-1234-5678로 전화)" }; }
    if (k === "sms") { var n2 = numIn(q), body = (r.body || String(q).replace(/(\+?\d[\d\-\s]{6,}\d)/g, " ").replace(/^\s*.+?(에게|한테|께서|께)/, "").replace(/(문자|메시지|메세지|sms|전송|발신|보내\s*줘?|보내|써\s*줘?|작성|줘|해\s*줘?|해|좀|부탁(해|해줘)?|\btext\b|\bsend\b|\bmessage\b|\bto\b)/gi, " ").replace(/\s+/g, " ").trim().replace(/고\s*$/, "")); return { u: "sms:" + n2 + (body ? "?body=" + E(body) : ""), w: "💬 문자" }; }
    if (k === "taxi") return taxi(r.query || taxiDest(q), c);
    if (k === "train") return train(q, c);
    if (k === "delivery") return delivery(r.query || q, c);
    if (k === "pay") return pay(q, c);
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
      ["SA", "🇸🇦 사우디"], ["AE", "🇦🇪 UAE"], ["SG", "🇸🇬 싱가포르"], ["HK", "🇭🇰 홍콩"], ["TW", "🇹🇼 대만"], ["TH", "🇹🇭 태국"], ["VN", "🇻🇳 베트남"], ["ID", "🇮🇩 인도네시아"], ["MY", "🇲🇾 말레이시아"], ["AR", "🇦🇷 아르헨티나"]] };
})();
