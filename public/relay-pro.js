/* public/relay-pro.js — Coverfo Studio Pro (v3)
 * © 2026 coverfo All Rights Reserved
 *
 * /relay-app(릴레이 v2) 위에 얹는 화면: 내 레시피 · 마켓 · 팀 · 레시피 만들기
 * relay-app 의 전역(S, render, renderHome, runRecipe, bindEvents, apiSTT, apiAI, apiTTS, apiResearch,
 * markdownToHtml, esc, log, authHeaders, VOICES, LANGS)을 그대로 쓰고, 화면 몇 개만 덧씌웁니다.
 * 서버: /api/recipes (functions/api/recipes.js) · 잔액: /api/wallet
 */
(function () {
  if (typeof S === 'undefined' || typeof render !== 'function') return;

  var STEP_COST = { stt: 2, ai: 3, tts: 2, research: 5 };
  var TYPE_NAME = { stt: '🎙️ 음성 인식', ai: '🧠 AI 처리', tts: '📢 AI 음성', research: '🔬 리서치' };
  var TASK_NAME = { summarize: '요약', translate: '번역', rewrite: '다시 쓰기', custom: '직접 시키기' };
  var VIS_NAME = { private: '🔒 나만', team: '👥 팀', public: '🌐 마켓 공개' };

  S.tab = 'basic';
  S.pro = { mine: null, market: null, teams: null, balance: null, q: '', sort: 'popular', edit: null, busy: false, msg: '' };

  /* ── 스타일 ─────────────────────────────── */
  var css = document.createElement('style');
  css.textContent = [
    '.pro-tabs{display:flex;gap:6px;margin:0 0 16px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px}',
    '.pro-tab{flex:none;padding:8px 14px;border-radius:999px;background:#fff;border:1px solid #e8eaf1;font-size:13px;font-weight:700;color:#6b7280;white-space:nowrap}',
    '.pro-tab.on{background:linear-gradient(135deg,#5b6cff 0%,#8b5cf6 100%);border-color:transparent;color:#fff;box-shadow:0 4px 14px #6d4aff40}',
    '.pro-sec{margin:18px 0 8px;font-size:13px;font-weight:800;color:#4b5563;display:flex;align-items:center;gap:8px}',
    '.pro-sec .r{margin-left:auto}',
    '.pro-empty{font-size:13px;color:#9ca3af;padding:16px;border:1.5px dashed #dcdfe8;border-radius:14px;text-align:center;background:#fafbfd}',
    '.pro-card{position:relative;overflow:hidden;background:#fff;border:1px solid #e8eaf1;border-radius:18px;padding:16px;box-shadow:0 1px 2px rgba(20,22,31,.04)}',
    '.pro-card::before{content:"";position:absolute;left:0;top:0;right:0;height:4px;background:linear-gradient(90deg,#5b6cff,#8b5cf6)}',
    '.pro-card .t{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:700;color:#14161f}',
    '.pro-card .t .i{font-size:22px;min-width:40px;height:40px;border-radius:12px;background:#f1edff;display:inline-flex;align-items:center;justify-content:center}',
    '.pro-card .d{font-size:12.5px;color:#6b7280;margin:8px 0;line-height:1.5}',
    '.pro-card .meta{display:flex;flex-wrap:wrap;gap:6px;font-size:11px;color:#6b7280;margin-bottom:12px}',
    '.pro-chip{padding:2px 9px;border-radius:999px;background:#f6f7fb;border:1px solid #e8eaf1;font-weight:600}',
    '.pro-chip.price{color:#b45309;background:#fff4de;border-color:#fde3a7}',
    '.pro-chip.free{color:#047857;background:#e7f8f1;border-color:#b7ead5}',
    '.pro-steps{font-size:11.5px;color:#4f46e5;background:#f4f2ff;border-radius:8px;padding:6px 9px;margin-bottom:10px}',
    '.pro-btns{display:flex;flex-wrap:wrap;gap:6px}',
    '.pro-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}',
    '.pro-in{background:#fff;border:1px solid #e1e4ec;border-radius:10px;padding:8px 10px;color:#14161f;font-size:13px;min-width:0}',
    '.pro-in:focus{outline:none;border-color:#6d4aff;box-shadow:0 0 0 3px #6d4aff1f}',
    '.pro-grow{flex:1 1 160px}',
    '.pro-step{background:#fafbfd;border:1px solid #e8eaf1;border-left:4px solid #8b5cf6;border-radius:12px;padding:12px;margin:8px 0}',
    '.pro-step .h{display:flex;align-items:center;gap:6px;font-size:12px;color:#6b7280;margin-bottom:8px}',
    '.pro-step .h b{color:#fff;background:#8b5cf6;border-radius:999px;min-width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:12px}',
    '.pro-step .h .x{margin-left:auto;display:flex;gap:4px}',
    '.pro-mini{padding:4px 8px;border-radius:7px;background:#fff;border:1px solid #e1e4ec;font-size:12px}',
    '.pro-note{font-size:12px;color:#6b7280;line-height:1.6;margin-top:6px}',
    '.pro-note b{color:#4f46e5}',
    '.pro-msg{font-size:12.5px;margin:8px 0;color:#92400e;background:#fff7e6;border:1px solid #fde3a7;border-radius:10px;padding:8px 12px}',
    '.pro-team{background:#fff;border:1px solid #e8eaf1;border-radius:16px;padding:14px;margin:8px 0;box-shadow:0 1px 2px rgba(20,22,31,.04)}',
    '.pro-mem{display:flex;align-items:center;gap:8px;font-size:12.5px;padding:7px 0;border-bottom:1px solid #f0f1f5}',
    '.pro-mem:last-child{border-bottom:none}',
    '.pro-mem .r{margin-left:auto}',
    'textarea.pro-in{width:100%;min-height:70px;resize:vertical}'
  ].join('\n');
  document.head.appendChild(css);

  /* ── 서버 ─────────────────────────────── */
  function api(op, data) {
    var body = Object.assign({ op: op }, data || {});
    return fetch('/api/recipes', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401) throw new Error('로그인이 필요합니다. coverfo 에 로그인한 뒤 다시 열어 주세요.');
        if (!r.ok && !('ok' in j)) throw new Error(j.error || ('오류 ' + r.status));
        if (j.error && j.ok !== false) throw new Error(j.error);
        return j;
      });
    });
  }
  function loadBalance() {
    return fetch('/api/wallet', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: JSON.stringify({ op: 'balance' })
    }).then(function (r) { return r.json(); }).then(function (j) {
      S.pro.balance = j && j.ok ? Number(j.paid || 0) : null;
    }).catch(function () { S.pro.balance = null; });
  }
  function fail(e) { S.pro.busy = false; S.pro.msg = '⚠️ ' + (e && e.message ? e.message : e); log('err', S.pro.msg); render(); }

  function loadTab(tab) {
    if (tab === 'mine') {
      S.pro.busy = true; render();
      return Promise.all([api('mine'), api('teams')]).then(function (a) {
        S.pro.mine = a[0]; S.pro.teams = a[1]; S.pro.busy = false; render();
      }).catch(fail);
    }
    if (tab === 'market') {
      S.pro.busy = true; render();
      return Promise.all([api('market', { q: S.pro.q, sort: S.pro.sort }), loadBalance()]).then(function (a) {
        S.pro.market = a[0].items || []; S.pro.busy = false; render();
      }).catch(fail);
    }
    if (tab === 'team') {
      S.pro.busy = true; render();
      return api('teams').then(function (j) { S.pro.teams = j; S.pro.busy = false; render(); }).catch(fail);
    }
    return Promise.resolve();
  }

  /* ── 레시피 → 실행 ─────────────────────── */
  function toRun(r) {
    return {
      id: 'pro-' + r.id, custom: true, icon: r.icon || '🧩', name: r.title, desc: r.descr || '',
      cost: r.run_cost || 0, input: r.input || 'text',
      steps: (r.steps || []).map(function (s) { return Object.assign({}, s, { label: s.label || TYPE_NAME[s.type] }); })
    };
  }
  function startRun(r) {
    S.recipe = toRun(r);
    S.screen = 'input'; S.inputText = ''; S.audioBlob = null; S.error = null;
    render();
  }

  var origRun = runRecipe;
  runRecipe = async function () {
    var r = S.recipe;
    if (!r || !r.custom) return origRun();
    S.screen = 'running'; S.error = null; S.resultText = ''; S.resultHtml = ''; S.audioUrl = null;
    S.steps = r.steps.map(function (s) { return Object.assign({}, s, { status: 'pending', detail: '' }); });
    logs = [];
    render();
    var data = S.inputText, audio = S.audioBlob, lastHtml = '';
    try {
      for (var i = 0; i < r.steps.length; i++) {
        var st = r.steps[i];
        S.steps[i].status = 'running'; render();
        log('info', st.label + ' 시작…');
        lastHtml = '';
        if (st.type === 'stt') {
          if (!audio) throw new Error('음성 입력이 없습니다');
          var res = await apiSTT(audio, '');
          data = res.text;
        } else if (st.type === 'ai') {
          if (!data) throw new Error('처리할 텍스트가 없습니다');
          data = await apiAI(data, st.task || 'summarize', { lang: st.lang, tone: st.tone, length: st.length, prompt: st.prompt });
        } else if (st.type === 'tts') {
          if (!data) throw new Error('변환할 텍스트가 없습니다');
          S.audioUrl = await apiTTS(data, S.voice);
        } else if (st.type === 'research') {
          if (!data) throw new Error('리서치 주제가 없습니다');
          data = await apiResearch(data, S.depth, function (ev) { if (ev.type === 'step') log('info', ev.message); });
          lastHtml = markdownToHtml(data);
        }
        S.steps[i].detail = st.type === 'tts' ? '음성 생성 완료' : (String(data || '').length > 80 ? String(data).slice(0, 80) + '…' : String(data || ''));
        S.steps[i].status = 'done';
        log('ok', st.label + ' 완료');
        render();
      }
      S.resultText = data || '';
      S.resultHtml = lastHtml;
      S.screen = 'result';
      log('ok', '레시피 완료');
      render();
    } catch (e) {
      var idx = S.steps.findIndex(function (s) { return s.status === 'running'; });
      if (idx >= 0) S.steps[idx].status = 'error';
      S.error = e.message; log('err', e.message); render();
    }
  };

  /* ── 화면 ─────────────────────────────── */
  var origHome = renderHome;
  renderHome = function () {
    var tabs = [['basic', '⭐ 기본 레시피'], ['mine', '📁 내 레시피'], ['market', '🛒 마켓'], ['team', '👥 팀'], ['build', '➕ 만들기']];
    var h = '<div class="pro-tabs">';
    tabs.forEach(function (t) {
      var on = S.tab === t[0] || (t[0] === 'build' && S.tab === 'build');
      h += '<button class="pro-tab' + (on ? ' on' : '') + '" data-pro-tab="' + t[0] + '">' + t[1] + '</button>';
    });
    h += '</div>';
    if (S.pro.msg) h += '<div class="pro-msg">' + esc(S.pro.msg) + '</div>';
    if (S.pro.busy) h += '<div class="pro-empty">불러오는 중…</div>';
    else if (S.tab === 'mine') h += viewMine();
    else if (S.tab === 'market') h += viewMarket();
    else if (S.tab === 'team') h += viewTeam();
    else if (S.tab === 'build') h += viewBuild();
    else h += origHome();
    return h;
  };

  function stepsLine(r) {
    return (r.steps || []).map(function (s) {
      var n = TYPE_NAME[s.type] || s.type;
      if (s.type === 'ai' && s.task) n += '(' + (TASK_NAME[s.task] || s.task) + ')';
      return n;
    }).join(' → ');
  }

  function card(r, kind) {
    var h = '<div class="pro-card">';
    h += '<div class="t"><span class="i">' + esc(r.icon || '🧩') + '</span>' + esc(r.title) + '</div>';
    if (r.descr) h += '<div class="d">' + esc(r.descr) + '</div>';
    h += '<div class="pro-steps">' + esc(stepsLine(r)) + '</div>';
    h += '<div class="meta">';
    h += '<span class="pro-chip">▶ 실행 ' + (r.run_cost || 0) + ' 크레딧</span>';
    if (kind === 'market' || r.visibility === 'public') {
      h += r.price > 0 ? '<span class="pro-chip price">💰 ' + r.price + ' 크레딧</span>' : '<span class="pro-chip free">무료</span>';
      h += '<span class="pro-chip">🛒 ' + (r.sales || 0) + '</span>';
    }
    if (kind === 'own') h += '<span class="pro-chip">' + (VIS_NAME[r.visibility] || '') + '</span>';
    if (r.owner_name && kind !== 'own') h += '<span class="pro-chip">by ' + esc(r.owner_name) + '</span>';
    h += '</div><div class="pro-btns">';
    if (kind === 'market') {
      if (r.mine || r.owned) h += '<button class="btn btn-primary btn-sm" data-pro-open="' + r.id + '">▶ 실행</button>';
      else if (r.price > 0) h += '<button class="btn btn-primary btn-sm" data-pro-buy="' + r.id + '" data-price="' + r.price + '">💰 ' + r.price + ' 크레딧에 사기</button>';
      else h += '<button class="btn btn-primary btn-sm" data-pro-buy="' + r.id + '" data-price="0">📥 무료로 가져가기</button>';
      if (!r.mine) h += '<button class="btn btn-secondary btn-sm" data-pro-report="' + r.id + '">🚩 신고</button>';
    } else {
      h += '<button class="btn btn-primary btn-sm" data-pro-run="' + kind + ':' + r.id + '">▶ 실행</button>';
      if (kind === 'own' || kind === 'team') h += '<button class="btn btn-secondary btn-sm" data-pro-edit="' + kind + ':' + r.id + '">✏️ 고치기</button>';
      if (kind === 'own') h += '<button class="btn btn-secondary btn-sm" data-pro-del="' + r.id + '">🗑</button>';
    }
    h += '</div></div>';
    return h;
  }

  function grid(list, kind, empty) {
    if (!list || !list.length) return '<div class="pro-empty">' + empty + '</div>';
    return '<div class="recipes">' + list.map(function (r) { return card(r, kind); }).join('') + '</div>';
  }

  function viewMine() {
    var m = S.pro.mine;
    if (!m) return '<div class="pro-empty">불러오지 못했습니다</div>';
    var h = '<div class="pro-sec">내가 만든 레시피 <button class="btn btn-primary btn-sm r" data-pro-tab="build">➕ 새 레시피</button></div>';
    h += grid(m.own, 'own', '아직 만든 레시피가 없습니다. ➕ 만들기에서 단계를 이어 붙여 보세요.');
    h += '<div class="pro-sec">마켓에서 가져온 레시피</div>';
    h += grid(m.owned, 'owned', '🛒 마켓에서 가져온 레시피가 여기 모입니다.');
    h += '<div class="pro-sec">팀 레시피</div>';
    h += grid(m.team, 'team', '팀원이 "👥 팀" 으로 저장한 레시피가 여기 보입니다.');
    return h;
  }

  function viewMarket() {
    var h = '<div class="pro-row">';
    h += '<input class="pro-in pro-grow" id="pro-q" placeholder="레시피 찾기" value="' + esc(S.pro.q) + '">';
    h += '<select class="pro-in" id="pro-sort"><option value="popular"' + (S.pro.sort === 'popular' ? ' selected' : '') + '>많이 팔린 순</option><option value="new"' + (S.pro.sort === 'new' ? ' selected' : '') + '>새로 올라온 순</option></select>';
    h += '<button class="btn btn-secondary btn-sm" id="pro-search">찾기</button>';
    h += '</div>';
    if (S.pro.balance != null) h += '<div class="pro-note">내 충전 크레딧 <b>' + S.pro.balance + '</b></div>';
    h += '<div class="pro-note">💡 값이 있는 레시피는 한 번 사면 계속 씁니다. 실행할 때는 단계별 기본 크레딧이 따로 듭니다. 판 사람에게 값의 70%가 크레딧으로 들어갑니다.</div>';
    h += '<div style="height:10px"></div>';
    h += grid(S.pro.market, 'market', '아직 마켓에 올라온 레시피가 없습니다. 첫 레시피를 올려 보세요!');
    return h;
  }

  function viewTeam() {
    var t = S.pro.teams;
    if (!t) return '<div class="pro-empty">불러오지 못했습니다</div>';
    var h = '';
    if (t.invites && t.invites.length) {
      h += '<div class="pro-sec">받은 초대</div>';
      t.invites.forEach(function (v) {
        h += '<div class="pro-team"><div class="pro-mem"><b>👥 ' + esc(v.name) + '</b><span class="r">' +
          '<button class="btn btn-primary btn-sm" data-pro-join="' + v.id + '">수락</button> ' +
          '<button class="btn btn-secondary btn-sm" data-pro-leave="' + v.id + '">거절</button></span></div></div>';
      });
    }
    h += '<div class="pro-sec">내 팀</div>';
    if (!t.teams || !t.teams.length) h += '<div class="pro-empty">아직 팀이 없습니다. 아래에서 만들어 보세요.</div>';
    (t.teams || []).forEach(function (tm) {
      h += '<div class="pro-team"><div class="pro-mem"><b>👥 ' + esc(tm.name) + '</b><span class="r">';
      h += tm.owner ? '<button class="btn btn-secondary btn-sm" data-pro-tdel="' + tm.id + '">팀 지우기</button>'
                    : '<button class="btn btn-secondary btn-sm" data-pro-leave="' + tm.id + '">나가기</button>';
      h += '</span></div>';
      tm.members.forEach(function (mb) {
        h += '<div class="pro-mem">' + (mb.role === 'owner' ? '👑 ' : '') + esc(mb.email) +
          (mb.status === 'invited' ? ' <span class="pro-chip">초대 중</span>' : '') +
          (tm.owner && mb.role !== 'owner' ? '<span class="r"><button class="pro-mini" data-pro-rm="' + tm.id + '|' + esc(mb.email) + '">빼기</button></span>' : '') + '</div>';
      });
      if (tm.owner) {
        h += '<div class="pro-row"><input class="pro-in pro-grow" id="pro-inv-' + tm.id + '" placeholder="초대할 사람 이메일 (coverfo 로그인 이메일)"><button class="btn btn-primary btn-sm" data-pro-inv="' + tm.id + '">초대</button></div>';
      }
      h += '</div>';
    });
    h += '<div class="pro-sec">새 팀 만들기</div>';
    h += '<div class="pro-row"><input class="pro-in pro-grow" id="pro-tname" placeholder="팀 이름"><button class="btn btn-primary btn-sm" id="pro-tmake">만들기</button></div>';
    h += '<div class="pro-note">팀원은 coverfo 에 그 이메일로 로그인한 뒤 👥 팀 → 받은 초대에서 수락하면 됩니다. 팀 레시피는 같이 보고 · 고치고 · 실행할 수 있고, 크레딧은 실행한 사람이 냅니다.</div>';
    return h;
  }

  /* ── 만들기 ─────────────────────────────── */
  function blank() {
    return { id: 0, title: '', icon: '🧩', descr: '', input: 'text', price: 0, visibility: 'private', team_id: null, isOwner: true,
      steps: [{ type: 'ai', task: 'summarize', label: '' }] };
  }
  function runCost(steps) { return steps.reduce(function (a, s) { return a + (STEP_COST[s.type] || 0); }, 0); }

  function viewBuild() {
    var e = S.pro.edit || (S.pro.edit = blank());
    var teams = (S.pro.teams && S.pro.teams.teams) || [];
    var h = '<div class="input-area">';
    h += '<h2>' + (e.id ? '✏️ 레시피 고치기' : '➕ 새 레시피') + '</h2>';
    h += '<div class="pro-row"><input class="pro-in" style="width:64px;text-align:center" id="pb-icon" maxlength="8" value="' + esc(e.icon) + '">';
    h += '<input class="pro-in pro-grow" id="pb-title" maxlength="40" placeholder="레시피 이름 (예: 회의 녹음 → 할 일 정리)" value="' + esc(e.title) + '"></div>';
    h += '<textarea class="pro-in" id="pb-descr" maxlength="200" placeholder="어떤 일을 하는 레시피인지 한두 줄로">' + esc(e.descr) + '</textarea>';
    h += '<div class="pro-row"><label class="pro-note">시작은 <select class="pro-in" id="pb-input">' +
      '<option value="text"' + (e.input === 'text' ? ' selected' : '') + '>✍️ 글로 시작</option>' +
      '<option value="audio"' + (e.input === 'audio' ? ' selected' : '') + '>🎙️ 음성으로 시작</option></select></label></div>';

    h += '<div class="pro-sec">단계 (위에서 아래로 차례대로)</div>';
    e.steps.forEach(function (s, i) {
      var lockStt = e.input === 'audio' && i === 0;
      h += '<div class="pro-step"><div class="h"><b>' + (i + 1) + '</b>';
      if (lockStt) h += ' 🎙️ 음성 인식 (음성으로 시작하면 첫 단계는 고정)';
      else {
        h += '<select class="pro-in" data-pb-type="' + i + '">';
        ['ai', 'tts', 'research'].forEach(function (t) { h += '<option value="' + t + '"' + (s.type === t ? ' selected' : '') + '>' + TYPE_NAME[t] + '</option>'; });
        h += '</select>';
      }
      h += '<span class="x">';
      if (!lockStt && i > (e.input === 'audio' ? 1 : 0)) h += '<button class="pro-mini" data-pb-up="' + i + '">▲</button>';
      if (!lockStt && i < e.steps.length - 1) h += '<button class="pro-mini" data-pb-down="' + i + '">▼</button>';
      if (!lockStt && e.steps.length > 1) h += '<button class="pro-mini" data-pb-rm="' + i + '">✕</button>';
      h += '</span></div>';
      if (s.type === 'ai') {
        h += '<div class="pro-row"><select class="pro-in" data-pb-task="' + i + '">';
        ['summarize', 'translate', 'rewrite', 'custom'].forEach(function (t) { h += '<option value="' + t + '"' + (s.task === t ? ' selected' : '') + '>' + TASK_NAME[t] + '</option>'; });
        h += '</select>';
        if (s.task === 'translate') {
          h += '<select class="pro-in" data-pb-f="lang" data-i="' + i + '">';
          LANGS.forEach(function (l) { h += '<option value="' + esc(l.label) + '"' + ((s.lang || '영어') === l.label ? ' selected' : '') + '>' + esc(l.label) + '로</option>'; });
          h += '</select>';
        }
        if (s.task === 'rewrite') h += '<input class="pro-in pro-grow" data-pb-f="tone" data-i="' + i + '" maxlength="20" placeholder="말투 (예: 정중한, 친근한)" value="' + esc(s.tone || '') + '">';
        if (s.task === 'summarize') h += '<input class="pro-in pro-grow" data-pb-f="length" data-i="' + i + '" maxlength="20" placeholder="길이 (예: 세 줄, 짧게)" value="' + esc(s.length || '') + '">';
        h += '</div>';
        if (s.task === 'custom') h += '<textarea class="pro-in" data-pb-f="prompt" data-i="' + i + '" maxlength="1000" placeholder="AI 에게 시킬 말 (예: 아래 회의 내용에서 할 일만 뽑아 번호 목록으로)">' + esc(s.prompt || '') + '</textarea>';
      }
      if (s.type === 'research') h += '<div class="pro-note">앞 단계 결과(또는 입력한 글)를 주제로 리서치 리포트를 씁니다.</div>';
      if (s.type === 'tts') h += '<div class="pro-note">앞 단계 결과를 AI 음성으로 읽어 줍니다. 음성은 실행할 때 고릅니다.</div>';
      h += '<input class="pro-in" style="width:100%;margin-top:6px" data-pb-f="label" data-i="' + i + '" maxlength="30" placeholder="단계 이름 (안 쓰면 자동)" value="' + esc(s.label || '') + '">';
      h += '</div>';
    });
    if (e.steps.length < 6) h += '<button class="btn btn-secondary btn-sm" id="pb-add">＋ 단계 추가</button>';
    h += '<div class="pro-note">▶ 한 번 실행할 때 약 <b>' + runCost(e.steps) + '</b> 크레딧 (음성 인식 2 · AI 3 · AI 음성 2 · 리서치 5~10)</div>';

    if (e.isOwner) {
      h += '<div class="pro-sec">누가 쓰나</div><div class="pro-row">';
      h += '<select class="pro-in" id="pb-vis">';
      ['private', 'team', 'public'].forEach(function (v) { h += '<option value="' + v + '"' + (e.visibility === v ? ' selected' : '') + '>' + VIS_NAME[v] + '</option>'; });
      h += '</select>';
      if (e.visibility === 'team') {
        if (!teams.length) h += '<span class="pro-note">먼저 👥 팀 탭에서 팀을 만들어 주세요</span>';
        else {
          h += '<select class="pro-in" id="pb-team">';
          teams.forEach(function (t) { h += '<option value="' + t.id + '"' + (Number(e.team_id) === t.id ? ' selected' : '') + '>' + esc(t.name) + '</option>'; });
          h += '</select>';
        }
      }
      if (e.visibility === 'public') {
        h += '<label class="pro-note">값 <input class="pro-in" id="pb-price" type="number" min="0" max="100" step="0.1" style="width:90px" value="' + (e.price || 0) + '"> 크레딧</label>';
      }
      h += '</div>';
      if (e.visibility === 'public') {
        h += '<div class="pro-note">💡 <b>0</b> 이면 누구나 무료로 가져가 씁니다(단계 내용도 공개).<br>' +
             '<b>1 이상</b>이면 산 사람만 단계 내용(시킬 말 등)을 보고 씁니다. 판 사람에게 값의 <b>70%</b>가 크레딧으로 들어갑니다(현금 인출 없음).<br>' +
             '어느 쪽이든 실행할 때 드는 크레딧은 실행한 사람이 냅니다. 남의 글·상표·개인정보를 넣은 레시피는 올리지 마세요.</div>';
      }
    } else {
      h += '<div class="pro-note">팀 레시피는 이름·설명·단계만 고칠 수 있습니다 (공개 범위는 만든 사람만).</div>';
    }

    h += '<div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">';
    h += '<button class="btn btn-primary" id="pb-save">💾 저장</button>';
    h += '<button class="btn btn-secondary" id="pb-try">▶ 저장 없이 실행해 보기</button>';
    h += '<button class="btn btn-secondary" id="pb-cancel">취소</button>';
    h += '</div></div>';
    return h;
  }

  function collect() {
    var e = S.pro.edit; if (!e) return;
    var v = function (id) { var el = document.getElementById(id); return el ? el.value : null; };
    if (v('pb-title') != null) e.title = v('pb-title');
    if (v('pb-icon') != null) e.icon = v('pb-icon');
    if (v('pb-descr') != null) e.descr = v('pb-descr');
    if (v('pb-vis') != null) e.visibility = v('pb-vis');
    if (v('pb-team') != null) e.team_id = Number(v('pb-team'));
    if (v('pb-price') != null) e.price = Number(v('pb-price')) || 0;
    document.querySelectorAll('[data-pb-f]').forEach(function (el) {
      var s = e.steps[Number(el.getAttribute('data-i'))]; if (s) s[el.getAttribute('data-pb-f')] = el.value;
    });
  }

  function fixInput(e) {
    if (e.input === 'audio') {
      if (!e.steps.length || e.steps[0].type !== 'stt') e.steps.unshift({ type: 'stt', label: '' });
    } else {
      e.steps = e.steps.filter(function (s) { return s.type !== 'stt'; });
      if (!e.steps.length) e.steps.push({ type: 'ai', task: 'summarize', label: '' });
    }
    if (e.steps.length > 6) e.steps = e.steps.slice(0, 6);
  }

  function editFrom(r, kind) {
    S.pro.edit = {
      id: r.id, title: r.title, icon: r.icon, descr: r.descr, input: r.input, price: r.price,
      visibility: r.visibility, team_id: r.team_id, isOwner: kind === 'own',
      steps: JSON.parse(JSON.stringify(r.steps || []))
    };
    S.tab = 'build'; render();
  }

  function findMine(kind, id) {
    var m = S.pro.mine || {};
    var list = kind === 'own' ? m.own : kind === 'team' ? m.team : m.owned;
    return (list || []).filter(function (r) { return String(r.id) === String(id); })[0];
  }

  /* ── 이벤트 ─────────────────────────────── */
  var origBind = bindEvents;
  bindEvents = function () {
    origBind();
    var on = function (sel, fn) { document.querySelectorAll(sel).forEach(function (el) { el.addEventListener('click', function (ev) { ev.preventDefault(); fn(el); }); }); };

    on('[data-pro-tab]', function (el) {
      var t = el.getAttribute('data-pro-tab');
      if (S.tab === 'build' && t !== 'build') S.pro.edit = null;
      if (t === 'build' && S.tab !== 'build') { S.pro.edit = null; if (!S.pro.teams) api('teams').then(function (j) { S.pro.teams = j; render(); }).catch(function () {}); }
      S.tab = t; S.pro.msg = ''; render(); loadTab(t);
    });

    on('[data-pro-run]', function (el) {
      var p = el.getAttribute('data-pro-run').split(':'); var r = findMine(p[0], p[1]); if (r) startRun(r);
    });
    on('[data-pro-edit]', function (el) {
      var p = el.getAttribute('data-pro-edit').split(':'); var r = findMine(p[0], p[1]); if (r) editFrom(r, p[0]);
    });
    on('[data-pro-del]', function (el) {
      if (!confirm('이 레시피를 지울까요?')) return;
      api('delete', { id: el.getAttribute('data-pro-del') }).then(function (j) {
        S.pro.msg = j.unlisted ? '산 사람이 있어 지우지 않고 마켓에서만 내렸습니다 (나만 보기로 바뀜)' : '지웠습니다';
        loadTab('mine');
      }).catch(fail);
    });
    on('[data-pro-open]', function (el) {
      api('get', { id: el.getAttribute('data-pro-open') }).then(function (j) {
        if (j.full) startRun(j.recipe); else { S.pro.msg = '먼저 사야 실행할 수 있습니다'; render(); }
      }).catch(fail);
    });
    on('[data-pro-buy]', function (el) {
      var id = el.getAttribute('data-pro-buy'); var price = Number(el.getAttribute('data-price'));
      if (price > 0 && !confirm(price + ' 크레딧으로 이 레시피를 살까요?\n(한 번 사면 계속 씁니다. 실행할 때 크레딧은 따로 듭니다)')) return;
      api('buy', { id: id }).then(function (j) {
        if (!j.ok) { S.pro.msg = j.error + (j.reason === 'insufficient' ? ' (필요 ' + j.need + ' · 내 크레딧 ' + j.paid + ')' : ''); render(); return; }
        S.pro.msg = price > 0 ? '샀습니다! 📁 내 레시피에서도 볼 수 있어요' : '가져왔습니다! 📁 내 레시피에서도 볼 수 있어요';
        loadTab('market');
      }).catch(fail);
    });
    on('[data-pro-report]', function (el) {
      var why = prompt('신고 이유를 적어 주세요 (예: 남의 상표 · 부적절한 내용)'); if (why == null) return;
      api('report', { id: el.getAttribute('data-pro-report'), reason: why }).then(function () { S.pro.msg = '신고했습니다. 운영자가 확인합니다.'; render(); }).catch(fail);
    });

    var search = document.getElementById('pro-search');
    if (search) search.addEventListener('click', function () {
      S.pro.q = (document.getElementById('pro-q') || {}).value || '';
      S.pro.sort = (document.getElementById('pro-sort') || {}).value || 'popular';
      loadTab('market');
    });
    var qIn = document.getElementById('pro-q');
    if (qIn) qIn.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && search) search.click(); });

    /* 팀 */
    var tmake = document.getElementById('pro-tmake');
    if (tmake) tmake.addEventListener('click', function () {
      var n = (document.getElementById('pro-tname') || {}).value || '';
      if (!n.trim()) return;
      api('team_create', { name: n }).then(function () { S.pro.msg = '팀을 만들었습니다'; loadTab('team'); }).catch(fail);
    });
    on('[data-pro-inv]', function (el) {
      var id = el.getAttribute('data-pro-inv'); var em = (document.getElementById('pro-inv-' + id) || {}).value || '';
      api('team_invite', { team_id: id, email: em }).then(function () { S.pro.msg = em + ' 님을 초대했습니다. 그분이 coverfo 에 로그인해 👥 팀에서 수락하면 됩니다.'; loadTab('team'); }).catch(fail);
    });
    on('[data-pro-join]', function (el) { api('team_join', { team_id: el.getAttribute('data-pro-join') }).then(function () { S.pro.msg = '팀에 들어갔습니다'; loadTab('team'); }).catch(fail); });
    on('[data-pro-leave]', function (el) {
      if (!confirm('이 팀에서 나갈까요? (받은 초대라면 거절)')) return;
      api('team_leave', { team_id: el.getAttribute('data-pro-leave') }).then(function () { loadTab('team'); }).catch(fail);
    });
    on('[data-pro-rm]', function (el) {
      var p = el.getAttribute('data-pro-rm').split('|');
      if (!confirm(p[1] + ' 님을 팀에서 뺄까요?')) return;
      api('team_remove', { team_id: p[0], email: p[1] }).then(function () { loadTab('team'); }).catch(fail);
    });
    on('[data-pro-tdel]', function (el) {
      if (!confirm('팀을 지울까요? 팀 레시피는 각자 "나만" 으로 바뀝니다.')) return;
      api('team_delete', { team_id: el.getAttribute('data-pro-tdel') }).then(function () { loadTab('team'); }).catch(fail);
    });

    /* 만들기 */
    var e = S.pro.edit;
    if (S.tab !== 'build' || !e) return;
    var inp = document.getElementById('pb-input');
    if (inp) inp.addEventListener('change', function () { collect(); e.input = inp.value; fixInput(e); render(); });
    var vis = document.getElementById('pb-vis');
    if (vis) vis.addEventListener('change', function () { collect(); render(); });
    document.querySelectorAll('[data-pb-type]').forEach(function (el) {
      el.addEventListener('change', function () {
        collect(); var s = e.steps[Number(el.getAttribute('data-pb-type'))];
        s.type = el.value; if (s.type === 'ai' && !s.task) s.task = 'summarize'; render();
      });
    });
    document.querySelectorAll('[data-pb-task]').forEach(function (el) {
      el.addEventListener('change', function () { collect(); e.steps[Number(el.getAttribute('data-pb-task'))].task = el.value; render(); });
    });
    on('[data-pb-up]', function (el) { collect(); var i = Number(el.getAttribute('data-pb-up')); var t = e.steps[i - 1]; e.steps[i - 1] = e.steps[i]; e.steps[i] = t; render(); });
    on('[data-pb-down]', function (el) { collect(); var i = Number(el.getAttribute('data-pb-down')); var t = e.steps[i + 1]; e.steps[i + 1] = e.steps[i]; e.steps[i] = t; render(); });
    on('[data-pb-rm]', function (el) { collect(); e.steps.splice(Number(el.getAttribute('data-pb-rm')), 1); render(); });
    var add = document.getElementById('pb-add');
    if (add) add.addEventListener('click', function () { collect(); e.steps.push({ type: 'tts', label: '' }); render(); });
    var cancel = document.getElementById('pb-cancel');
    if (cancel) cancel.addEventListener('click', function () { S.pro.edit = null; S.tab = 'mine'; render(); loadTab('mine'); });
    var tryBtn = document.getElementById('pb-try');
    if (tryBtn) tryBtn.addEventListener('click', function () {
      collect();
      if (e.steps.some(function (s) { return s.type === 'ai' && s.task === 'custom' && !String(s.prompt || '').trim(); })) { alert('AI 에게 시킬 말을 넣어 주세요.'); return; }
      startRun({ id: 'try', title: e.title || '시험 실행', icon: e.icon, descr: e.descr, input: e.input, steps: e.steps, run_cost: runCost(e.steps) });
    });
    var save = document.getElementById('pb-save');
    if (save) save.addEventListener('click', function () {
      collect();
      save.disabled = true;
      api('save', {
        id: e.id || undefined, title: e.title, icon: e.icon, descr: e.descr, input: e.input, steps: e.steps,
        price: e.price, visibility: e.visibility, team_id: e.team_id
      }).then(function () {
        S.pro.edit = null; S.tab = 'mine'; S.pro.msg = '저장했습니다'; loadTab('mine');
      }).catch(function (er) { save.disabled = false; fail(er); });
    });
  };

  /* 결과 화면의 '새 레시피' · 취소 → 보던 탭으로 */
  render();
  log('ok', 'Coverfo Studio Pro v3 준비됨');
})();
