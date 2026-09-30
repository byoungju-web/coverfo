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
      .replace(/알려\s*줘?|추천\s*해?\s*줘?|좀|해\s*줘?|찾아\s*줘?|보여\s*줘?|어디(야|있어|에)?|쫙/g, "")
      .replace(/\b(please|find|show|me|recommend|tell|search|for|some|good|best|any|a|the|near\s*me|nearby|around\s*here|where\s*(is|are|can\s*i)|can\s*you|i\s*want|i'd\s*like|looking\s*for)\b/gi, "")
      .replace(/\s+/g, " ").trim() || q;
  }
  /* ── 판별 규칙: 포도톡(한국어) + 영어 ── */
  var R = {
    place: [/(맛집|먹을\s*곳|먹거리|음식점|맛있는\s*곳)/, /(가볼\s*만한|가볼만한곳|관광지|관광|명소|여행지|놀\s*거리|갈\s*만한\s*곳|볼거리)/,
      /(restaurants?|food|eat|dinner|lunch|brunch|cafe|coffee|bar|pizza|sushi|things\s*to\s*do|attractions|sightseeing|places\s*to\s*(visit|see|go)|tourist|landmarks?|must[- ]see)/i],
    placeNear: [/(근처|주변|가까운)/, /(near|nearby|around|closest|nearest)/i],
    placeKinds: [/(카페|식당|병원|약국|편의점|주유소|주차장|은행|atm|마트|숙소|호텔|모텔|펜션|미용실|세탁소|헬스장|공원|화장실)/i, /(pharmacy|drugstore|hospital|clinic|gas\s*station|parking|bank|atm|grocery|supermarket|mall|gym|park|restroom|laundry|barber|salon|hotel|coffee)/i],
    navi: [/길\s*안내|내비게이션|내비|네비게이션|네비|길\s*찾기|길찾기|가는\s*길|가는\s*법|어떻게\s*가|찾아\s*가|까지\s*가|데려다|목적지/, /(directions?\s*to|navigate\s*to|how\s*(do\s*i|to)\s*get\s*to|route\s*to|take\s*me\s*to|drive\s*to|way\s*to)/i],
    music: [/(틀어|들려|재생|플레이|듣고\s*싶|노래\s*해)/, /(유튜브|유툽|유투브|youtube)/i, /\b(play|listen\s*to)\b.*\b(song|music|video|mv|playlist|album)\b|\b(youtube|yt)\b/i, /^\s*play\s+(?!.*\b(games?|store|station)\b)\S/i],
    shopWord: [/(쇼핑몰|쇼핑|최저가|가성비|판매처|구매|사고\s*싶|어디서\s*사|가격\s*비교|얼마|싸게\s*사|저렴|판매량|리뷰\s*많)/, /\b(buy|purchase|cheapest|best\s*price|price\s*of|how\s*much\s*(is|does)|deal|shop\s*for|shopping|order\s*online|amazon)\b/i],
    shopAsk: [/(추천|알려|골라|비교|어떤|뭐가\s*좋|뭐\s*살|살까)/, /\b(recommend|which|compare|best)\b/i],
    shopBuy: [/(가성비|최저가|리뷰|구매|판매량|베스트|제품|상품|모델|브랜드|저렴|쇼핑|얼마|만원|원대)/, /\b(product|brand|model|review|cheap|budget|under\s*\$?\d+)\b/i],
    call: [/(전화|통화|콜)/, /\b(call|phone|dial|ring)\b/i],
    sms: [/(문자|메시지|메세지|sms)/i, /\b(text|sms|message)\b/i],
    taxi: [/택시|카카오\s*t|카카오티/i, /\b(taxi|cab|uber|lyft|ride)\b/i],
    train: [/(srt|ktx|기차|열차|코레일|고속철|무궁화|새마을|itx)/i, /\b(train|amtrak|rail(way)?|eurostar|shinkansen)\b/i],
    delivery: [/배민|배달의민족|요기요|쿠팡이츠|배달/, /\b(doordash|uber\s*eats|grubhub|deliver(y|ed)?|order\s*(food|pizza|takeout))\b/i],
    pay: [/토스|송금|이체|카카오\s*페이|네이버\s*페이/, /\b(send|pay|transfer|venmo|paypal|cash\s*app|zelle|upi|wire)\b/i],
    stay: [/(예약|숙박|묵을|묵고|\d+\s*박|체크인|빈\s*방|객실|방\s*잡)/, /\b(hotel|hostel|airbnb|book(ing)?\s*(a\s*)?(room|hotel|stay)|stay|nights?|check[- ]?in|accommodation|lodging|resort|motel)\b/i],
    stayWord: [/(콘도|리조트|펜션|호텔|모텔|민박|게스트하우스|글램핑|캠핑|숙소|풀빌라|롯지|료칸)/, /\b(hotel|hostel|airbnb|resort|motel|inn|lodge|guesthouse|villa|cabin|apartment)\b/i]
  };
  function any(list, q) { for (var i = 0; i < list.length; i++) if (list[i].test(q)) return true; return false; }
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
  function mapsSearch(q, c) {
    if (c === "KR") return { u: "https://map.naver.com/p/search/" + E(q), w: "📍 네이버지도" };
    /* 아이폰도 Google Maps 우선(공식 Maps URLs). 앱이 없으면 웹 지도가 열린다 */
    return { u: "https://www.google.com/maps/search/?api=1&query=" + E(q), w: "📍 Google Maps" };
  }
  function mapsDir(dest, c) {
    if (c === "KR") return { u: "https://map.naver.com/p/search/" + E(dest), w: "🧭 네이버지도 길찾기" };
    return { u: "https://www.google.com/maps/dir/?api=1&destination=" + E(dest) + "&travelmode=driving", w: "🧭 Google Maps 내비" };
  }
  function shop(q, c) {
    if (c === "KR") return { u: "https://search.shopping.naver.com/search/all?query=" + E(q) + "&sort=rel", w: "🛒 네이버쇼핑" };
    /* 한국 밖: Google 쇼핑 탭 (구글 자체 검색 주소). 나라별 쇼핑몰 검색 링크는 약관 확인이 안 돼 쓰지 않는다 */
    return { u: "https://www.google.com/search?tbm=shop&q=" + E(q), w: "🛒 Google 쇼핑" };
  }
  function taxi(dest, c) {
    if (c === "KR") return isIOS() ? { u: "https://apps.apple.com/kr/app/id981110422", w: "🚕 카카오T (앱스토어)", note: "아이폰은 카카오T 공개 링크가 없어 앱 설치/열기 화면으로 갑니다." } : { u: "intent://launch#Intent;scheme=kakaot;package=com.kakao.taxi;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.kakao.taxi;end", w: "🚕 카카오T" };
    /* Uber 공식 유니버설 링크 (목적지만 채워짐 · 호출 확인은 본인이) */
    var u = "https://m.uber.com/ul/?action=setPickup&pickup=my_location" + (dest ? "&dropoff[formatted_address]=" + E(dest) : "");
    return { u: u, w: "🚕 Uber", alt: { u: "https://ride.lyft.com/?destination" + (dest ? "[address]=" + E(dest) : "") , w: "Lyft" } };
  }
  function train(q, c) {
    if (c === "KR") return { u: /srt|수서/i.test(q) ? "https://etk.srail.kr/main.do" : "https://www.letskorail.com/", w: "🚄 기차 예매" };
    if (c === "US" || c === "CA") return { u: "https://www.amtrak.com/", w: "🚄 Amtrak" };
    if (c === "JP") return { u: "https://smart-ex.jp/", w: "🚄 신칸센 EX" };
    if (c === "GB") return { u: "https://www.thetrainline.com/", w: "🚄 Trainline" };
    if (c === "DE") return { u: "https://www.bahn.de/", w: "🚄 DB" }; if (c === "FR") return { u: "https://www.sncf-connect.com/", w: "🚄 SNCF" }; if (c === "ES") return { u: "https://www.renfe.com/", w: "🚄 Renfe" };
    return { u: "https://www.google.com/maps/dir/?api=1&travelmode=transit&destination=" + E(q), w: "🚄 Google Maps 대중교통" };
  }
  function delivery(q, c) {
    if (c === "KR") return { u: /배민|배달의민족/.test(q) ? "https://www.baemin.com/" : /쿠팡이츠|이츠/.test(q) ? "https://www.coupangeats.com/" : "https://www.yogiyo.co.kr/", w: "🛵 배달" };
    var food = clean(q.replace(/(doordash|uber\s*eats|grubhub|order|deliver(y|ed)?|from|배달|시켜|주문|줘)/gi, ""));
    if (/uber\s*eats/i.test(q)) return { u: "https://www.ubereats.com/search?q=" + E(food), w: "🛵 Uber Eats" };
    if (c === "US" || c === "CA" || c === "AU") return { u: "https://www.doordash.com/search/store/" + E(food) + "/", w: "🛵 DoorDash" };
    return { u: "https://www.ubereats.com/search?q=" + E(food), w: "🛵 Uber Eats" };
  }
  function music(q) {
    var t = String(q || "").replace(/유튜브에서|유튜브|유툽|유투브|youtube|on youtube/gi, "").replace(/틀어\s*줘?|들려\s*줘?|재생\s*해?\s*줘?|재생|플레이\s*해?\s*줘?|\bplay\b|listen\s*to|좀|해\s*줘?|켜\s*줘?|찾아\s*줘?|\b(the|a|some)\s*(song|music|video)\b/gi, "").replace(/\s+/g, " ").trim() || q;
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
  function classify(t) {
    t = String(t || "").trim(); if (!t) return null;
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
    if (R.place[0].test(q) || R.place[1].test(q) || R.place[2].test(q) || (any(R.placeNear, q) && any(R.placeKinds, q))) return { kind: "place", q: q };
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
    if (k === "place") return mapsSearch(r.query || clean(q), c);
    if (k === "navi") return mapsDir(r.query || naviDest(q), c);
    if (k === "music") return music(r.query || q);
    if (k === "shop") return shop(r.query || shopTopic(q), c);
    if (k === "call") { var n = numIn(q); return n ? { u: "tel:" + n, w: "📞 전화" } : { u: "", w: "전화", none: "전화번호를 같이 말해 주세요 (예: 010-1234-5678로 전화)" }; }
    if (k === "sms") { var n2 = numIn(q), body = (r.body || String(q).replace(/(\+?\d[\d\-\s]{6,}\d)/g, " ").replace(/^\s*.+?(에게|한테|께서|께)/, "").replace(/(문자|메시지|메세지|sms|전송|발신|보내\s*줘?|보내|써\s*줘?|작성|줘|해\s*줘?|해|좀|부탁(해|해줘)?|\btext\b|\bsend\b|\bmessage\b|\bto\b)/gi, " ").replace(/\s+/g, " ").trim().replace(/고\s*$/, "")); return { u: "sms:" + n2 + (body ? "?body=" + E(body) : ""), w: "💬 문자" }; }
    if (k === "taxi") return taxi(r.query || taxiDest(q), c);
    if (k === "train") return train(q, c);
    if (k === "delivery") return delivery(q, c);
    if (k === "pay") return pay(q, c);
    if (k === "stay") return stay(q, c);
    return null;
  }
  /* 한국 밖에서 한국어로 치면 지도·쇼핑 검색어만 영어로 (cf-ui-lang.js 의 무료 번역기, 실패하면 원문) */
  function maybeTranslate(text, c, cb) {
    if (c === "KR" || !KO.test(text) || !(window.cfUiLang && window.cfUiLang.translate)) { cb(text); return; }
    var done = false, t = setTimeout(function () { if (!done) { done = true; cb(text); } }, 2500);
    window.cfUiLang.translate(text, "en", function (out) { if (done) return; done = true; clearTimeout(t); cb(out || text); });
  }
  /* ── 규칙 실패 시 AI(Claude Fable 5.1)에게 한 번: /api/quick-intent ── */
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
    if (opts.noAI) { cb(null); return; }
    aiClassify(text, c, function (j) { if (!j) { cb(null); return; } go({ kind: j.kind, q: text, query: j.query || "", body: j.body || "" }); });
  }
  try { fetch("/api/quick-intent").then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.cost != null) AI_COST = Number(j.cost) || 0; })["catch"](function () {}); } catch (e) {}
  window.cfQuick = { country: country, setCountry: setCountry, isOverride: isOverride, classify: classify, build: build, decide: decide, stayInfo: stayInfo, amountOf: amountOf, aiCost: function () { return AI_COST; }, onAI: null,
    COUNTRIES: [["AUTO", "🌐 자동(시간대)"], ["KR", "🇰🇷 대한민국"], ["US", "🇺🇸 미국"], ["JP", "🇯🇵 일본"], ["CN", "🇨🇳 중국"], ["IN", "🇮🇳 인도"], ["GB", "🇬🇧 영국"], ["DE", "🇩🇪 독일"], ["FR", "🇫🇷 프랑스"], ["ES", "🇪🇸 스페인"], ["TH", "🇹🇭 태국"], ["VN", "🇻🇳 베트남"], ["CA", "🇨🇦 캐나다"], ["AU", "🇦🇺 호주"]] };
})();
