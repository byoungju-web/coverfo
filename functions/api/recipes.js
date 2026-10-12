// functions/api/recipes.js — Coverfo Studio Pro (v3): 커스텀 레시피 · 마켓플레이스 · 팀 협업
// © 2026 coverfo All Rights Reserved
//
// POST /api/recipes   (Authorization: Bearer 로그인토큰)   body { op, ... }
//   레시피
//     mine                              → { ok, own:[], owned:[], team:[] }       내가 만든 것 · 산 것 · 팀 것 (전부 실행 가능한 전체 내용)
//     market   {q?, sort?}              → { ok, items:[미리보기] }                공개 레시피 (값이 있는 레시피는 단계 내용을 감춤)
//     get      {id}                     → { ok, recipe, full }                    볼 수 있으면 전체, 아니면 미리보기
//     save     {id?, title, icon, descr, input, steps, price, visibility, team_id}
//     delete   {id}                     만든 사람만
//     buy      {id}                     → { ok, paid }  값 0 이면 무료로 가져가기
//     report   {id, reason}
//   팀
//     teams                             → { ok, teams:[{id,name,owner,me,members:[]}], invites:[] }
//     team_create {name} · team_invite {team_id, email} · team_join {team_id}
//     team_leave {team_id} · team_remove {team_id, email} · team_delete {team_id}
//
// 필요한 것: sql/cf_studio_pro.sql 1회 실행 · Secret SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY (이미 있음)

const STEP_TYPES = ['stt', 'ai', 'tts', 'research'];
const AI_TASKS = ['summarize', 'translate', 'rewrite', 'custom'];
const STEP_COST = { stt: 2, ai: 3, tts: 2, research: 5 };   // relay-app 기본 레시피와 같은 단가
const MAX_STEPS = 6;
const MAX_PRICE = 100;
const MAX_TEAMS = 5;
const MAX_MEMBERS = 20;

export async function onRequestPost(context) {
  const env = context.env || {};
  const db = sbCfg(env);
  if (!db) return json({ error: 'Supabase 설정이 없습니다' }, 500);

  const me = await getUser(context.request, env);
  if (!me) return json({ error: '로그인이 필요합니다' }, 401);

  let body = {};
  try { body = await context.request.json(); } catch { return json({ error: '잘못된 요청입니다' }, 400); }
  const op = String(body.op || '');

  try {
    switch (op) {
      case 'mine': return json(await opMine(db, me));
      case 'market': return json(await opMarket(db, me, body));
      case 'get': return json(await opGet(db, me, body));
      case 'save': return json(await opSave(db, me, body));
      case 'delete': return json(await opDelete(db, me, body));
      case 'buy': return json(await opBuy(db, me, body));
      case 'report': return json(await opReport(db, me, body));
      case 'teams': return json(await opTeams(db, me));
      case 'team_create': return json(await opTeamCreate(db, me, body));
      case 'team_invite': return json(await opTeamInvite(db, me, body));
      case 'team_join': return json(await opTeamJoin(db, me, body));
      case 'team_leave': return json(await opTeamLeave(db, me, body));
      case 'team_remove': return json(await opTeamRemove(db, me, body));
      case 'team_delete': return json(await opTeamDelete(db, me, body));
      default: return json({ error: 'op 가 잘못되었습니다' }, 400);
    }
  } catch (e) {
    const status = e && e.status ? e.status : 500;
    return json({ error: String((e && e.message) || e).slice(0, 300) }, status);
  }
}

/* ══ 레시피 ══════════════════════════════════════════════ */

async function opMine(db, me) {
  const own = await rows(db, `cf_recipes?owner=eq.${me.id}&order=updated_at.desc&limit=100`);

  const ownedRows = await rows(db, `cf_recipe_owned?user_id=eq.${me.id}&select=recipe_id&limit=200`);
  const ownedIds = ownedRows.map((r) => r.recipe_id);
  const owned = ownedIds.length
    ? await rows(db, `cf_recipes?id=in.(${ownedIds.join(',')})&hidden=eq.false&order=updated_at.desc`)
    : [];

  const teamIds = await myTeamIds(db, me);
  const team = teamIds.length
    ? (await rows(db, `cf_recipes?team_id=in.(${teamIds.join(',')})&visibility=eq.team&order=updated_at.desc&limit=100`))
        .filter((r) => r.owner !== me.id)
    : [];

  return { ok: true, own: own.map(full), owned: owned.map(full), team: team.map(full) };
}

async function opMarket(db, me, body) {
  const sort = body.sort === 'new' ? 'created_at.desc' : 'sales.desc,created_at.desc';
  let path = `cf_recipes?visibility=eq.public&hidden=eq.false&order=${sort}&limit=60`;
  const q = clean(body.q, 30).replace(/[%*,()]/g, '');
  if (q) path += `&or=(title.ilike.*${encodeURIComponent(q)}*,descr.ilike.*${encodeURIComponent(q)}*)`;
  const list = await rows(db, path);

  const ownedRows = list.length
    ? await rows(db, `cf_recipe_owned?user_id=eq.${me.id}&recipe_id=in.(${list.map((r) => r.id).join(',')})&select=recipe_id`)
    : [];
  const owned = new Set(ownedRows.map((r) => r.recipe_id));

  return {
    ok: true,
    items: list.map((r) => ({ ...preview(r), mine: r.owner === me.id, owned: owned.has(r.id) })),
  };
}

async function opGet(db, me, body) {
  const r = await one(db, `cf_recipes?id=eq.${int(body.id)}`);
  if (!r || (r.hidden && r.owner !== me.id)) throw err('레시피를 찾을 수 없습니다', 404);
  if (await canRun(db, me, r)) return { ok: true, full: true, recipe: full(r) };
  if (r.visibility === 'public') return { ok: true, full: false, recipe: preview(r) };
  throw err('볼 수 없는 레시피입니다', 403);
}

async function opSave(db, me, body) {
  const id = body.id ? int(body.id) : 0;
  const cur = id ? await one(db, `cf_recipes?id=eq.${id}`) : null;
  if (id && !cur) throw err('레시피를 찾을 수 없습니다', 404);

  const isOwner = !cur || cur.owner === me.id;
  const teamEditor = cur && !isOwner && cur.visibility === 'team' && cur.team_id
    && (await myTeamIds(db, me)).includes(cur.team_id);
  if (!isOwner && !teamEditor) throw err('이 레시피를 고칠 수 없습니다', 403);

  const v = validate(body);

  const patch = {
    title: v.title, icon: v.icon, descr: v.descr, input: v.input, steps: v.steps,
    updated_at: new Date().toISOString(),
  };

  if (isOwner) {
    /* 값 · 공개범위 · 팀은 만든 사람만 */
    let visibility = v.visibility;
    let team_id = null;
    if (visibility === 'team') {
      team_id = int(body.team_id);
      if (!team_id || !(await myTeamIds(db, me)).includes(team_id)) throw err('팀을 골라 주세요 (내가 들어가 있는 팀만)', 400);
    }
    patch.visibility = visibility;
    patch.team_id = team_id;
    patch.price = visibility === 'public' ? v.price : 0;
  }

  if (cur) {
    const out = await write(db, `cf_recipes?id=eq.${id}`, 'PATCH', patch);
    return { ok: true, recipe: full(out[0] || { ...cur, ...patch }) };
  }

  patch.owner = me.id;
  patch.owner_name = maskName(me.email);
  const out = await write(db, 'cf_recipes', 'POST', patch);
  return { ok: true, recipe: full(out[0]) };
}

async function opDelete(db, me, body) {
  const id = int(body.id);
  const cur = await one(db, `cf_recipes?id=eq.${id}`);
  if (!cur) throw err('레시피를 찾을 수 없습니다', 404);
  if (cur.owner !== me.id) throw err('만든 사람만 지울 수 있습니다', 403);
  if (cur.sales > 0 && cur.price > 0) {
    /* 산 사람이 있는 유료 레시피는 지우지 않고 마켓에서만 내림 — 산 사람은 계속 씀 */
    await write(db, `cf_recipes?id=eq.${id}`, 'PATCH', { visibility: 'private', updated_at: new Date().toISOString() });
    return { ok: true, unlisted: true };
  }
  await write(db, `cf_recipes?id=eq.${id}`, 'DELETE');
  return { ok: true };
}

async function opBuy(db, me, body) {
  const r = await rpc(db, 'cf_recipe_buy', { p_buyer: me.id, p_recipe: int(body.id) });
  if (!r || !r.ok) {
    const reason = (r && r.reason) || 'error';
    const msg = reason === 'insufficient' ? '크레딧이 모자랍니다'
      : reason === 'own' ? '내가 만든 레시피입니다'
      : reason === 'not_found' ? '판매 중인 레시피가 아닙니다' : '구매하지 못했습니다';
    return { ok: false, reason, error: msg, paid: Number((r && r.paid) || 0), need: Number((r && r.need) || 0) };
  }
  return { ok: true, paid: Number(r.paid || 0), dup: !!r.dup };
}

async function opReport(db, me, body) {
  const id = int(body.id);
  await write(db, 'cf_recipe_reports', 'POST', { recipe_id: id, by_user: me.id, reason: clean(body.reason, 200) || '기타' }, 'resolution=ignore-duplicates');
  return { ok: true };
}

/* ══ 팀 ═══════════════════════════════════════════════════ */

async function opTeams(db, me) {
  const mineRows = await rows(db, `cf_team_members?user_id=eq.${me.id}&status=eq.joined&select=team_id,role`);
  const ids = mineRows.map((m) => m.team_id);
  const teams = ids.length ? await rows(db, `cf_teams?id=in.(${ids.join(',')})&order=created_at.asc`) : [];
  const members = ids.length ? await rows(db, `cf_team_members?team_id=in.(${ids.join(',')})&order=created_at.asc`) : [];

  const inv = me.email ? await rows(db, `cf_team_members?email=eq.${encodeURIComponent(me.email)}&status=eq.invited&select=team_id`) : [];
  const invIds = inv.map((m) => m.team_id);
  const invTeams = invIds.length ? await rows(db, `cf_teams?id=in.(${invIds.join(',')})`) : [];

  return {
    ok: true,
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      owner: t.owner === me.id,
      members: members.filter((m) => m.team_id === t.id)
        .map((m) => ({ email: m.email, role: m.role, status: m.status, me: m.user_id === me.id })),
    })),
    invites: invTeams.map((t) => ({ id: t.id, name: t.name })),
  };
}

async function opTeamCreate(db, me, body) {
  const name = clean(body.name, 30);
  if (!name) throw err('팀 이름을 넣어 주세요', 400);
  const owned = await rows(db, `cf_teams?owner=eq.${me.id}&select=id`);
  if (owned.length >= MAX_TEAMS) throw err(`팀은 ${MAX_TEAMS}개까지 만들 수 있습니다`, 400);
  const t = (await write(db, 'cf_teams', 'POST', { owner: me.id, name }))[0];
  await write(db, 'cf_team_members', 'POST', {
    team_id: t.id, email: (me.email || me.id).toLowerCase(), user_id: me.id, role: 'owner', status: 'joined',
  });
  return { ok: true, id: t.id };
}

async function opTeamInvite(db, me, body) {
  const t = await ownTeam(db, me, body.team_id);
  const email = clean(body.email, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw err('이메일 모양이 아닙니다', 400);
  const cnt = await rows(db, `cf_team_members?team_id=eq.${t.id}&select=email`);
  if (cnt.length >= MAX_MEMBERS) throw err(`팀원은 ${MAX_MEMBERS}명까지입니다`, 400);
  await write(db, 'cf_team_members', 'POST', { team_id: t.id, email, role: 'member', status: 'invited' }, 'resolution=ignore-duplicates');
  return { ok: true };
}

async function opTeamJoin(db, me, body) {
  const id = int(body.team_id);
  if (!me.email) throw err('이메일 로그인 계정만 수락할 수 있습니다', 400);
  const out = await write(db, `cf_team_members?team_id=eq.${id}&email=eq.${encodeURIComponent(me.email)}&status=eq.invited`, 'PATCH',
    { user_id: me.id, status: 'joined' });
  if (!out.length) throw err('받은 초대가 없습니다', 404);
  return { ok: true };
}

async function opTeamLeave(db, me, body) {
  const id = int(body.team_id);
  const t = await one(db, `cf_teams?id=eq.${id}`);
  if (!t) throw err('팀을 찾을 수 없습니다', 404);
  if (t.owner === me.id) throw err('팀장은 나갈 수 없습니다. 팀을 지워 주세요', 400);
  /* 초대 거절도 같은 길 (내 이메일 줄을 지움) */
  await write(db, `cf_team_members?team_id=eq.${id}&or=(user_id.eq.${me.id},email.eq.%22${encodeURIComponent(me.email || '-')}%22)`, 'DELETE');
  return { ok: true };
}

async function opTeamRemove(db, me, body) {
  const t = await ownTeam(db, me, body.team_id);
  const email = clean(body.email, 120).toLowerCase();
  if (email === (me.email || '').toLowerCase()) throw err('팀장은 뺄 수 없습니다', 400);
  await write(db, `cf_team_members?team_id=eq.${t.id}&email=eq.${encodeURIComponent(email)}`, 'DELETE');
  return { ok: true };
}

async function opTeamDelete(db, me, body) {
  const t = await ownTeam(db, me, body.team_id);
  /* 팀 레시피는 지우지 않고 각자 '나만 보기'로 돌림 */
  await write(db, `cf_recipes?team_id=eq.${t.id}`, 'PATCH', { team_id: null, visibility: 'private' });
  await write(db, `cf_teams?id=eq.${t.id}`, 'DELETE');
  return { ok: true };
}

/* ══ 규칙 ═════════════════════════════════════════════════ */

function validate(b) {
  const title = clean(b.title, 40);
  if (!title) throw err('레시피 이름을 넣어 주세요', 400);
  const input = b.input === 'audio' ? 'audio' : 'text';
  const raw = Array.isArray(b.steps) ? b.steps : [];
  if (!raw.length) throw err('단계를 하나 이상 넣어 주세요', 400);
  if (raw.length > MAX_STEPS) throw err(`단계는 ${MAX_STEPS}개까지입니다`, 400);

  const steps = raw.map((s, i) => {
    const type = STEP_TYPES.includes(s && s.type) ? s.type : null;
    if (!type) throw err(`${i + 1}번째 단계 종류가 잘못되었습니다`, 400);
    if (type === 'stt' && (i !== 0 || input !== 'audio')) throw err('음성 인식은 "음성으로 시작" 레시피의 첫 단계에만 둘 수 있습니다', 400);
    const out = { type, label: clean(s.label, 30) || defaultLabel(type, s.task) };
    if (type === 'ai') {
      out.task = AI_TASKS.includes(s.task) ? s.task : 'summarize';
      if (out.task === 'translate') out.lang = clean(s.lang, 20) || '영어';
      if (out.task === 'rewrite') out.tone = clean(s.tone, 20) || '자연스러운';
      if (out.task === 'summarize') out.length = clean(s.length, 20) || '적절한';
      if (out.task === 'custom') {
        out.prompt = clean(s.prompt, 1000);
        if (!out.prompt) throw err(`${i + 1}번째 단계: AI 에게 시킬 말을 넣어 주세요`, 400);
      }
    }
    return out;
  });
  if (input === 'audio' && steps[0].type !== 'stt') throw err('"음성으로 시작" 레시피는 첫 단계가 음성 인식이어야 합니다', 400);

  let price = Math.round((Number(b.price) || 0) * 10) / 10;
  if (price < 0) price = 0;
  if (price > MAX_PRICE) throw err(`값은 ${MAX_PRICE} 크레딧까지입니다`, 400);

  return {
    title,
    icon: clean(b.icon, 8) || '🧩',
    descr: clean(b.descr, 200),
    input,
    steps,
    price,
    visibility: ['private', 'team', 'public'].includes(b.visibility) ? b.visibility : 'private',
  };
}

function defaultLabel(type, task) {
  if (type === 'stt') return '음성 인식';
  if (type === 'tts') return 'AI 음성 생성';
  if (type === 'research') return '리서치 리포트';
  return { summarize: 'AI 요약', translate: 'AI 번역', rewrite: 'AI 다시 쓰기', custom: 'AI 처리' }[task] || 'AI 처리';
}

function runCost(steps) {
  return (steps || []).reduce((a, s) => a + (STEP_COST[s.type] || 0), 0);
}

function full(r) {
  return {
    id: r.id, title: r.title, icon: r.icon, descr: r.descr, input: r.input, steps: r.steps || [],
    price: Number(r.price || 0), visibility: r.visibility, team_id: r.team_id, sales: r.sales || 0,
    owner_name: r.owner_name || '', run_cost: runCost(r.steps), updated_at: r.updated_at,
  };
}

/* 유료 레시피의 단계 내용(시킬 말 등)은 산 사람에게만 — 미리보기는 단계 종류만 */
function preview(r) {
  const f = full(r);
  const showAll = f.price <= 0;
  return {
    ...f,
    steps: (f.steps || []).map((s) => (showAll ? s : { type: s.type, label: s.label })),
    locked: !showAll,
  };
}

async function canRun(db, me, r) {
  if (r.owner === me.id) return true;
  if (r.hidden) return false;
  if (r.visibility === 'team' && r.team_id && (await myTeamIds(db, me)).includes(r.team_id)) return true;
  if (r.visibility === 'public' && Number(r.price) <= 0) return true;
  const o = await one(db, `cf_recipe_owned?user_id=eq.${me.id}&recipe_id=eq.${r.id}&select=recipe_id`);
  return !!o;
}

async function myTeamIds(db, me) {
  const m = await rows(db, `cf_team_members?user_id=eq.${me.id}&status=eq.joined&select=team_id`);
  return m.map((x) => x.team_id);
}

async function ownTeam(db, me, teamId) {
  const t = await one(db, `cf_teams?id=eq.${int(teamId)}`);
  if (!t) throw err('팀을 찾을 수 없습니다', 404);
  if (t.owner !== me.id) throw err('팀장만 할 수 있습니다', 403);
  return t;
}

function maskName(email) {
  const n = String(email || '').split('@')[0] || 'user';
  return n.length <= 3 ? n[0] + '**' : n.slice(0, 3) + '***';
}

/* ══ Supabase 도우미 ═════════════════════════════════════ */

function sbCfg(env) {
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const service = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anon = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';
  return url && service ? { url, service, anon } : null;
}

function hdr(db, extra) {
  return { apikey: db.service, Authorization: `Bearer ${db.service}`, 'Content-Type': 'application/json', ...(extra || {}) };
}

async function rows(db, path) {
  const r = await fetch(`${db.url}/rest/v1/${path}`, { headers: hdr(db) });
  if (!r.ok) throw new Error(`DB ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const j = await r.json();
  return Array.isArray(j) ? j : [];
}

async function one(db, path) {
  const list = await rows(db, path + (path.includes('limit=') ? '' : '&limit=1'));
  return list[0] || null;
}

async function write(db, path, method, body, prefer) {
  const r = await fetch(`${db.url}/rest/v1/${path}`, {
    method,
    headers: hdr(db, { Prefer: ['return=representation', prefer].filter(Boolean).join(',') }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`DB ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const t = await r.text();
  try { const j = JSON.parse(t); return Array.isArray(j) ? j : [j]; } catch { return []; }
}

async function rpc(db, name, args) {
  const r = await fetch(`${db.url}/rest/v1/rpc/${name}`, { method: 'POST', headers: hdr(db), body: JSON.stringify(args || {}) });
  const t = await r.text();
  if (!r.ok) throw new Error(`DB ${r.status}: ${t.slice(0, 160)}`);
  try { return JSON.parse(t); } catch { return null; }
}

async function getUser(request, env) {
  const url = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const anon = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!url || !anon || !token) return null;
  try {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? { id: u.id, email: String(u.email || '').toLowerCase() } : null;
  } catch { return null; }
}

/* ══ 작은 도우미 ═════════════════════════════════════════ */

function clean(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, max); }
function int(v) { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : 0; }
function err(message, status) { const e = new Error(message); e.status = status; return e; }
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
