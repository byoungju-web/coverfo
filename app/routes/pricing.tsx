import { json, type MetaFunction } from '@remix-run/cloudflare';
import { useEffect, useState } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { Header } from '~/components/header/Header';
import { Menu } from '~/components/sidebar/Menu.client';

export const meta: MetaFunction = () => {
  return [{ title: '요금제 · coverfo' }, { name: 'description', content: 'coverfo 요금제 안내' }];
};

export const loader = () => json({});

interface Plan {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlight: boolean;
  note?: string;
}

const PLANS: Plan[] = [
  {
    name: '무료',
    price: '0원',
    period: '',
    description: '가입하면 무료 크레딧 4가 한 번 지급됩니다. 무료 크레딧을 다 쓰면 그다음부터는 충전 크레딧이 차감됩니다.',
    features: [
      '무료 크레딧 4 (가입 시 1회) — chat 답변 20번',
      '무료 크레딧은 매달 전체 4,000크레딧 한도(약 1,000명분) 안에서 선착순 · 매달 1일 다시 열림',
      '무료 크레딧 제공은 2027년 1월 31일까지',
      '영상은 충전 크레딧으로만 가능',
    ],
    highlight: false,
  },
  {
    name: '스타터',
    price: '9,900원',
    period: '/ 100크레딧',
    description: '충전한 크레딧으로 쓴 만큼만 차감됩니다. 충전한 크레딧은 결제일로부터 1년 동안 사용할 수 있습니다.',
    features: [
      'chat 답변 1회 0.2크레딧 (1크레딧으로 5번 · 웹검색 포함)',
      '앱 생성(chat) 1회 8크레딧',
      '사진으로 물어보기 1장 1크레딧 (이어서 질문 3개 포함, 그 뒤 1크레딧에 5개)',
      '이미지 2K 생성 2크레딧',
      '영상 8초 25크레딧',
      'coverfo 엔진 · 앱 만들기 30크레딧',
      'coverfo 엔진 · 3D 에셋(이미지·영상·3D 모델) 25크레딧',
      '엔진 결과 수정 5크레딧부터 (이미지 8 · 3D 모델 15 · 영상 15)',
      '100크레딧 9,900원 · 300크레딧 29,000원 · 550크레딧 49,000원 (10% 더) · 1,200크레딧 99,000원 (20% 더)',
      '포도톡 · 포도야에 연결하면 같은 크레딧으로 씁니다 (1크레딧 = 99원)',
      '서비스 제공기간: 결제일로부터 1년 (충전 크레딧 사용 기간)',
    ],
    highlight: true,
  },
  {
    name: '작동 방식',
    price: '1크레딧 ≈ 99원',
    period: '',
    description: '가입하고 바로 씁니다. 쓴 만큼만 크레딧이 차감되고, 따로 준비할 것은 없습니다.',
    features: ['API 키 발급 · 관리 불필요', '실패한 생성은 자동 환불', '만든 결과물은 그대로 사용'],
    highlight: false,
    note: '결제 즉시 자동으로 충전됩니다. 계좌이체 문의도 가능합니다.',
  },
];

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div
      className={
        plan.highlight
          ? 'flex flex-col rounded-xl border-2 border-accent-500 bg-bolt-elements-background-depth-2 p-6'
          : 'flex flex-col rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-6'
      }
    >
      {plan.highlight && (
        <span className="mb-3 self-start rounded-full bg-accent-500 px-3 py-1 text-xs font-medium text-white">
          가장 많이 쓰는 요금제
        </span>
      )}

      <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">{plan.name}</h2>

      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-bolt-elements-textPrimary">{plan.price}</span>
        <span className="text-sm text-bolt-elements-textSecondary">{plan.period}</span>
      </div>

      <p className="mt-3 text-sm text-bolt-elements-textSecondary">{plan.description}</p>

      <ul className="mt-5 flex flex-col gap-2">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2 text-sm text-bolt-elements-textPrimary">
            <span className="text-accent-500">✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {plan.note && <p className="mt-4 text-xs text-bolt-elements-textSecondary">{plan.note}</p>}

      <div className="mt-6">
        {plan.highlight ? (
          <a
            href="#charge"
            className="block rounded-lg bg-accent-500 px-4 py-2.5 text-center text-sm font-medium text-white"
          >
            충전하기 (카드 · 계좌이체 · 간편결제)
          </a>
        ) : (
          <a
            href="/"
            className="block rounded-lg border border-bolt-elements-borderColor px-4 py-2.5 text-center text-sm font-medium text-bolt-elements-textPrimary"
          >
            바로 써보기
          </a>
        )}
      </div>
    </div>
  );
}

/* 충전 · 포도톡 연결 — /buy 와 같은 서버(/api/pay · /api/wallet)를 쓰는 화면. 결제창(토스)은 이 페이지에서 바로 열린다 */
type Pkg = { id: string; credits: number; amount: number };
type Cfg = { enabled?: boolean; clientKey?: string; packages?: Pkg[]; testMode?: boolean };
type Me = { email?: string; free?: number; paid?: number; orders?: any[] };

const METHODS: [string, string][] = [
  ['CARD', '💳 카드 · 간편결제'],
  ['TRANSFER', '🏦 계좌이체'],
  ['MOBILE_PHONE', '📱 휴대폰'],
];

function won(n: number) {
  return (Number(n) || 0).toLocaleString('ko-KR') + '원';
}

function loadToss(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any;

    if (w.TossPayments) {
      resolve(w.TossPayments);
      return;
    }

    const sc = document.createElement('script');
    sc.src = 'https://js.tosspayments.com/v2/standard';
    sc.onload = () => resolve(w.TossPayments);
    sc.onerror = () => reject(new Error('결제 모듈을 불러오지 못했습니다'));
    document.head.appendChild(sc);
  });
}

/* v287 📅 매달 자동 충전(크레딧 월 구독) — 서버는 /api/billing (functions/api/billing.js · 토스 빌링 상점). 한 번 충전(/api/pay)과 따로 */
type SubPlan = { id: string; credits: number; amount: number };
type SubCfg = { enabled?: boolean; clientKey?: string; plans?: SubPlan[]; testMode?: boolean };
type Sub = { plan: string; credits: number; amount: number; status: string; card?: string; period?: number; paid_until?: string; next_at?: string; last_error?: string };
const SUB_NAME: Record<string, string> = { sub100: '베이직', sub300: '스탠다드', sub550: '플러스' };

function day(s?: string) {
  if (!s) {
    return '-';
  }

  const d = new Date(s);

  return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.';
}

function subLeft(sub: Sub | null) {
  return !!(sub && sub.status === 'canceled' && sub.paid_until && new Date(sub.paid_until) > new Date());
}

function SubBox({ token, scfg, sub, reload }: { token: string; scfg: SubCfg | null; sub: Sub | null; reload: () => void }) {
  const plans = scfg?.plans || [];
  const [plan, setPlan] = useState<string>('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; h: string } | null>(null);

  useEffect(() => {
    if (!plan && plans.length) {
      setPlan((plans[1] || plans[0]).id);
    }
  }, [plans.length]);

  useEffect(() => {
    const q = new URLSearchParams(location.search);

    if (q.get('done')) {
      setMsg({ t: 'ok', h: '구독을 시작했어요! 첫 달 +' + (q.get('credits') || '') + ' 크레딧이 충전됐습니다.' });
    } else if (q.get('fail')) {
      setMsg({ t: 'err', h: String(q.get('fail')).replace(/[<>&]/g, '') });
    }

    if (q.get('done') || q.get('fail')) {
      history.replaceState({}, '', '/pricing?tab=sub#charge');
    }
  }, []);

  const bapi = (body: any) =>
    fetch('/api/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
    }).then((r) => r.json().catch(() => ({})).then((j: any) => ({ ...j, __status: r.status })));

  const chosen = plans.find((x) => x.id === plan);
  const active = !!(sub && sub.status === 'active');
  const left = subLeft(sub);
  const can = !!(chosen && token && scfg?.enabled && agree && !active && !left && !busy);

  const start = async () => {
    if (!can || !chosen) {
      return;
    }

    setBusy(true);
    setMsg({ t: 'info', h: '카드 등록창을 여는 중입니다…' });

    try {
      const j: any = await bapi({ op: 'start', plan: chosen.id });

      if (j.__status !== 200) {
        throw new Error(j.error || '구독 신청 실패');
      }

      const TossPayments = await loadToss();
      const payment = TossPayments(scfg?.clientKey).payment({ customerKey: j.customerKey });
      await payment.requestBillingAuth({
        method: 'CARD',
        successUrl: location.origin + '/api/billing?op=auth',
        failUrl: location.origin + '/pricing?tab=sub&fail=' + encodeURIComponent('카드 등록이 취소되었거나 실패했습니다') + '#charge',
        customerEmail: j.email || undefined,
      });
    } catch (e: any) {
      setMsg({ t: 'err', h: String(e?.message || e) });
    } finally {
      setBusy(false);
    }
  };
  const cancel = async () => {
    if (!sub || !confirm('구독을 해지할까요?\n\n· ' + day(sub.paid_until) + '까지 이용할 수 있고, 그 뒤로는 결제되지 않아요.\n· 이미 충전된 크레딧은 그대로 쓸 수 있어요.')) {
      return;
    }

    const j: any = await bapi({ op: 'cancel' });
    setMsg(j.__status === 200 ? { t: 'ok', h: '해지했어요. ' + day(sub.paid_until) + '까지 이용할 수 있고, 그 뒤로는 결제되지 않아요.' } : { t: 'err', h: j.error || '해지 실패' });
    reload();
  };
  const resume = async () => {
    const j: any = await bapi({ op: 'resume' });
    setMsg(j.__status === 200 ? { t: 'ok', h: '구독을 계속합니다. 다음 결제일에 자동 결제돼요.' } : { t: 'err', h: j.error || '실패' });
    reload();
  };

  const msgCls =
    msg?.t === 'err' ? 'bg-red-50 text-red-700' : msg?.t === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700';
  const stLabel = (st: string) => (({ active: '구독 중', canceled: '해지됨 (이용 기간까지 사용)', stopped: '결제 실패로 멈춤' } as any)[st] || st);

  return (
    <div className="flex flex-col gap-4">
      {sub ? (
        <div className="rounded-xl border border-bolt-elements-borderColor p-4">
          <div className="text-sm font-semibold text-bolt-elements-textPrimary">📅 내 구독</div>
          <table className="mt-2 w-full text-sm">
            <tbody className="text-bolt-elements-textPrimary">
              <tr><td className="w-28 py-1 text-bolt-elements-textSecondary">상태</td><td className="py-1 font-semibold">{stLabel(sub.status)}</td></tr>
              <tr><td className="py-1 text-bolt-elements-textSecondary">요금제</td><td className="py-1">{(SUB_NAME[sub.plan] || sub.plan) + ' · ' + won(sub.amount) + '/월 · 매달 ' + sub.credits + ' 크레딧'}</td></tr>
              <tr><td className="py-1 text-bolt-elements-textSecondary">결제 카드</td><td className="py-1">{sub.card || '-'}</td></tr>
              <tr><td className="py-1 text-bolt-elements-textSecondary">이용 기간</td><td className="py-1">{sub.paid_until ? '~ ' + day(sub.paid_until) : '-'}</td></tr>
              <tr><td className="py-1 text-bolt-elements-textSecondary">다음 결제일</td><td className="py-1">{active && sub.next_at ? day(sub.next_at) : '없음'}</td></tr>
              {sub.status === 'stopped' && sub.last_error ? <tr><td className="py-1 text-bolt-elements-textSecondary">멈춘 이유</td><td className="py-1">{sub.last_error}</td></tr> : null}
            </tbody>
          </table>
          {active ? (
            <button type="button" onClick={cancel} className="mt-3 w-full rounded-full border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700">
              구독 해지 (다음 결제일부터 결제 안 함)
            </button>
          ) : null}
          {left ? (
            <button type="button" onClick={resume} className="mt-3 w-full rounded-full bg-black px-4 py-2.5 text-sm font-semibold text-white">
              해지 취소하고 계속 구독
            </button>
          ) : null}
        </div>
      ) : null}

      {!active && !left ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {plans.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlan(p.id)}
                className={'rounded-xl border p-4 text-left transition ' + (plan === p.id ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-bolt-elements-borderColor')}
              >
                <div className="text-xs font-semibold text-indigo-700">{(SUB_NAME[p.id] || p.id) + (i === 1 ? ' · 추천' : '')}</div>
                <div className="mt-1 text-2xl font-bold text-bolt-elements-textPrimary">
                  {won(p.amount)} <span className="text-xs font-medium text-bolt-elements-textSecondary">/월</span>
                </div>
                <div className="text-sm font-semibold text-bolt-elements-textPrimary">매달 {p.credits.toLocaleString()} 크레딧</div>
                <div className="text-xs text-bolt-elements-textSecondary">1크레딧당 {Math.round(p.amount / p.credits)}원 · 1개월마다 자동 갱신</div>
              </button>
            ))}
          </div>

          <div className="rounded-xl bg-bolt-elements-background-depth-2 p-4 text-sm leading-relaxed text-bolt-elements-textPrimary">
            <div><b>서비스 제공 기간</b> · 결제일부터 1개월. 매월 같은 날 자동 결제(1개월 단위 자동 갱신)</div>
            <div><b>해지</b> · 언제든 이 화면에서 직접. 해지하면 다음 결제일부터 결제하지 않으며, 이미 충전된 크레딧은 그대로 쓸 수 있어요</div>
            <div><b>크레딧</b> · 한 번 충전과 같은 지갑 · 결제일로부터 1년 동안 사용</div>
            <div>
              <b>환불</b> · 결제 7일 이내이고 그 결제로 받은 크레딧을 쓰지 않았으면 전액, 그 외에는 남은 충전 크레딧 금액에서 10%를 공제하고 환불 (결제 1년 이내 ·{' '}
              <a href="/refund" className="underline">환불정책</a>). 환불하면 구독도 함께 해지돼요
            </div>
            <div><b>결제 수단</b> · 신용·체크카드 (토스페이먼츠 카드 등록)</div>
          </div>

          <label className="flex cursor-pointer items-start gap-2 text-sm text-bolt-elements-textPrimary">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>위 내용과 <b>매월 자동 결제</b>에 동의합니다. (해지 전까지 매월 같은 날 선택한 금액이 결제됩니다)</span>
          </label>

          <button
            type="button"
            onClick={start}
            disabled={!can}
            className="rounded-full bg-indigo-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {!token ? '로그인하면 구독할 수 있어요' : chosen ? '카드 등록하고 ' + won(chosen.amount) + '/월 구독 시작' : '요금제를 골라 주세요'}
          </button>
          {scfg && !scfg.enabled ? <div className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-700">구독 결제 준비 중입니다. 지금은 한 번 충전을 이용해 주세요.</div> : null}
        </>
      ) : null}

      {msg ? <div className={'rounded-lg px-3 py-2 text-sm ' + msgCls}>{msg.h}</div> : null}
    </div>
  );
}

function ChargeBox() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [token, setToken] = useState<string>('');
  const [me, setMe] = useState<Me | null>(null);
  const [pkg, setPkg] = useState<string>('');
  const [method, setMethod] = useState<string>('CARD');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; h: string } | null>(null);
  /* v287 탭: ⚡ 한 번 충전(기본) · 📅 매달 자동 충전 (?tab=sub 로 열면 구독 탭) */
  const [tab, setTab] = useState<'once' | 'sub'>(() => (new URLSearchParams(location.search).get('tab') === 'sub' ? 'sub' : 'once'));
  const [scfg, setScfg] = useState<SubCfg | null>(null);
  const [sub, setSub] = useState<Sub | null>(null);

  const api = (m: string, qs: string, body?: any) =>
    fetch('/api/pay' + qs, {
      method: m,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }).then((r) => r.json().then((j: any) => ({ ...j, __status: r.status })));
  const loadSub = () => {
    if (!token) {
      return;
    }

    fetch('/api/billing', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ op: 'me' }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: any) => {
        if (j) {
          setSub(j.sub || null);
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const c: Cfg = await fetch('/api/pay?config=1').then((r) => r.json());

        if (!alive) {
          return;
        }

        setCfg(c);
        fetch('/api/billing?config=1')
          .then((r) => (r.ok ? r.json() : null))
          .then((j: any) => alive && j && setScfg(j))
          .catch(() => undefined);
        setPkg((c.packages || []).find((x) => x.id === 'plus')?.id || (c.packages || [])[1]?.id || (c.packages || [])[0]?.id || ''); // 기본 선택: 550(plus)

        if (!c.enabled) {
          setMsg({ t: 'info', h: '결제 준비 중입니다. 지금은 이메일(hasin7jk@gmail.com) 문의로 충전해 드립니다.' });
        }

        const { supabase } = await import('~/lib/supabaseClient');
        const { data } = await supabase.auth.getSession();
        const t = data?.session?.access_token || '';

        if (alive) {
          setToken(t);
        }
      } catch (e: any) {
        setMsg({ t: 'err', h: '설정을 불러오지 못했습니다: ' + String(e?.message || e) });
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    api('GET', '?me=1').then((j: any) => {
      if (j.__status === 200) {
        setMe(j);
      }
    });
    loadSub();
  }, [token]);

  const pay = async () => {
    const p = (cfg?.packages || []).find((x) => x.id === pkg);

    if (busy || !p || !token || !cfg?.clientKey) {
      return;
    }

    setBusy(true);
    setMsg({ t: 'info', h: '결제창을 여는 중입니다…' });

    try {
      const j: any = await api('POST', '', { op: 'create', package: p.id });

      if (j.__status !== 200) {
        throw new Error(j.error || '주문 생성 실패');
      }

      const TossPayments = await loadToss();
      const payment = TossPayments(cfg.clientKey).payment({ customerKey: j.customerKey });
      await payment.requestPayment({
        method,
        amount: { currency: 'KRW', value: j.amount },
        orderId: j.orderId,
        orderName: j.orderName,
        successUrl: location.origin + '/api/pay?op=confirm',
        failUrl: location.origin + '/buy?fail=' + encodeURIComponent('결제가 취소되었거나 실패했습니다'),
        customerEmail: j.email || undefined,
      });
    } catch (e: any) {
      setMsg({ t: 'err', h: String(e?.message || e) });
    } finally {
      setBusy(false);
    }
  };

  const chosen = (cfg?.packages || []).find((x) => x.id === pkg);
  const msgCls =
    msg?.t === 'err' ? 'bg-red-50 text-red-700' : msg?.t === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700';

  const fmt1 = (n: number) => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return (
    <div className="flex flex-col gap-5">
      {/* v209 내 크레딧 잔액 — 이 화면을 열면 가장 먼저 보이게 맨 위에 둔다 */}
      <div className="rounded-xl border-2 border-indigo-600 bg-bolt-elements-background-depth-2 p-5">
        <div className="text-sm font-semibold text-bolt-elements-textPrimary">💜 내 크레딧</div>
        {token ? (
          <>
            <div className="mt-2 text-center text-xs text-bolt-elements-textSecondary">남은 크레딧</div>
            <div className="text-center text-4xl font-extrabold text-indigo-700">{me ? fmt1((me.free || 0) + (me.paid || 0)) : '…'}</div>
            <div className="mt-1 text-center text-xs text-bolt-elements-textSecondary">
              {me ? '무료 ' + fmt1(me.free || 0) + ' · 충전 ' + fmt1(me.paid || 0) + ' (≈ ' + won(Math.round((me.paid || 0) * 99)) + ') · 1크레딧 = 99원' : '불러오는 중…'}
            </div>
            <div className="mt-3 text-xs leading-relaxed text-bolt-elements-textSecondary">
              {me?.email ? me.email + ' · ' : ''}coverfo · 포도톡 · 포도야 어디서 써도 같은 지갑입니다. 충전·환불은 coverfo 에서 합니다. (포도톡·포도야는 충전 크레딧만 씁니다)
            </div>
            {sub && (sub.status === 'active' || subLeft(sub)) ? (
              <button type="button" onClick={() => setTab('sub')} className="mt-3 w-full rounded-lg bg-indigo-50 px-3 py-2 text-left text-xs font-semibold text-indigo-700">
                📅 {sub.status === 'active' ? '구독 중' : '해지됨'} · {(SUB_NAME[sub.plan] || sub.plan) + ' ' + won(sub.amount) + '/월'} ·{' '}
                {sub.status === 'active' ? '다음 결제일 ' + day(sub.next_at) : day(sub.paid_until) + '까지 이용'} ›
              </button>
            ) : null}
          </>
        ) : (
          <div className="mt-2 text-sm text-bolt-elements-textSecondary">
            로그인하면 내 크레딧 잔액이 여기에 보입니다.{' '}
            <a href="/" className="font-medium underline">
              홈으로 가서 로그인
            </a>
          </div>
        )}
      </div>

      {/* v287 탭 2개 — 안내문(충전 · 포도톡 연결) 대신 */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-bolt-elements-background-depth-2 p-1">
        {(
          [
            ['once', '⚡ 한 번 충전'],
            ['sub', '📅 매달 자동 충전'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={
              'rounded-lg px-3 py-2.5 text-sm font-semibold transition ' +
              (tab === k ? 'bg-white text-indigo-700 shadow-sm' : 'text-bolt-elements-textSecondary')
            }
          >
            {label}
          </button>
        ))}
      </div>

      {(tab === 'once' ? cfg?.testMode : scfg?.testMode) ? (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">🧪 테스트 결제 모드 — 실제 돈은 빠져나가지 않습니다.</div>
      ) : null}

      {tab === 'sub' ? (
        <SubBox token={token} scfg={scfg} sub={sub} reload={loadSub} />
      ) : (
      <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(cfg?.packages || []).map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPkg(p.id)}
            className={
              'rounded-xl border p-4 text-left transition ' +
              (pkg === p.id ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-bolt-elements-borderColor')
            }
          >
            {p.id === 'plus' || (!(cfg?.packages || []).some((x) => x.id === 'plus') && i === 1) ? (
              <span className="mb-1 inline-block rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-semibold text-white">가장 많이 선택</span>
            ) : null}
            <div className="text-2xl font-bold text-bolt-elements-textPrimary">
              {p.credits.toLocaleString()} <span className="text-xs font-medium text-bolt-elements-textSecondary">크레딧</span>
            </div>
            <div className="text-sm font-semibold text-bolt-elements-textPrimary">{won(p.amount)}</div>
            <div className="text-xs text-bolt-elements-textSecondary">1크레딧당 {Math.round(p.amount / p.credits)}원</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {METHODS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setMethod(k)}
            className={
              'rounded-full border px-3 py-1.5 text-sm font-medium ' +
              (method === k ? 'border-black bg-black text-white' : 'border-bolt-elements-borderColor text-bolt-elements-textPrimary')
            }
          >
            {label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={pay}
        disabled={busy || !token || !chosen || !cfg?.enabled}
        className="rounded-full bg-indigo-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {chosen ? won(chosen.amount) + ' 결제하기 (' + chosen.credits.toLocaleString() + '크레딧)' : '패키지를 골라 주세요'}
      </button>
      {msg ? <div className={'rounded-lg px-3 py-2 text-sm ' + msgCls} dangerouslySetInnerHTML={{ __html: msg.h }} /> : null}
      </>
      )}

      {me?.orders?.length ? (
        <div>
          <div className="mb-2 text-sm font-semibold text-bolt-elements-textPrimary">충전 내역</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-bolt-elements-textSecondary">
                <th className="py-1">날짜</th>
                <th className="py-1">크레딧</th>
                <th className="py-1">금액</th>
                <th className="py-1">상태</th>
              </tr>
            </thead>
            <tbody>
              {me.orders.map((o: any, i: number) => {
                const d = new Date(o.paid_at || o.created_at);
                const label =
                  (({ paid: '완료', manual: '수동 충전', pending: '미완료', failed: '실패', canceled: '취소', refunded: '환불 완료' } as any)[o.status] || o.status) +
                  (o.status === 'refunded' && o.fee > 0 ? ` (수수료 ${won(o.fee)})` : '') +
                  (/^sub/.test(String(o.package || '')) ? ' · 월 구독' : '');

                return (
                  <tr key={i} className="border-t border-bolt-elements-borderColor text-bolt-elements-textPrimary">
                    <td className="py-1.5">{d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="py-1.5">{(o.credits > 0 ? '+' : '') + o.credits}</td>
                    <td className="py-1.5">{o.amount ? won(o.amount) : '-'}</td>
                    <td className="py-1.5">{label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export default function Pricing() {
  return (
    <div className="flex min-h-full w-full flex-col bg-bolt-elements-background-depth-1">
      <ClientOnly>{() => <Header />}</ClientOnly>
      {/* 왼쪽 위 ☰ → 사이드 설정 메뉴 (로고는 그대로 홈으로) */}
      <ClientOnly>{() => <Menu overlay />}</ClientOnly>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {/* v209 순서: 내 크레딧 잔액 → 충전(v287: ⚡ 한 번 충전 · 📅 매달 자동 충전 탭) → 충전 내역 → 요금제. v287 포도톡 연결 칸 삭제(연결 코드는 /buy 에 그대로) */}
        <div id="charge" className="scroll-mt-16 rounded-xl border border-bolt-elements-borderColor p-4 sm:p-6">
          <ClientOnly fallback={<div className="py-6 text-center text-sm text-bolt-elements-textSecondary">내 크레딧 불러오는 중…</div>}>
            {() => <ChargeBox />}
          </ClientOnly>
        </div>

        <div className="mt-12 text-center">
          <h1 className="text-2xl font-bold text-bolt-elements-textPrimary sm:text-3xl">요금제</h1>
          <p className="mt-3 text-sm text-bolt-elements-textSecondary">
            무료 크레딧으로 먼저 써보시고, 계속 쓰실 때 충전하시면 됩니다.
          </p>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard key={plan.name} plan={plan} />
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-bolt-elements-borderColor p-6">
          <h2 className="text-base font-semibold text-bolt-elements-textPrimary">자주 묻는 질문</h2>

          <dl className="mt-4 flex flex-col gap-5">
            <div>
              <dt className="text-sm font-medium text-bolt-elements-textPrimary">무료 크레딧은 어떻게 쓰이나요?</dt>
              <dd className="mt-1 text-sm text-bolt-elements-textSecondary">
                계정을 만들면 무료 크레딧 4가 한 번 지급됩니다. 기능을 쓸 때마다 무료 크레딧부터 차감되고(chat 답변 0.2 — 1크레딧으로 5번, 사진으로
                물어보기 1, 이미지 2, 앱 생성 8, 엔진 앱 30 · 3D 에셋 25), 다 쓰면 충전 크레딧에서 차감됩니다. 만든 결과물을 보는 것은
                차감되지 않습니다. 무료 크레딧은 매달 전체 4,000크레딧 한도(약 1,000명분) 안에서 선착순으로 쓰이며 매달 1일 다시 열리고,
                2027년 1월 31일까지 제공됩니다. 영상은 충전한 크레딧으로만 만들 수 있습니다.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-bolt-elements-textPrimary">만든 페이지는 제 것인가요?</dt>
              <dd className="mt-1 text-sm text-bolt-elements-textSecondary">
                네. 만들어진 코드와 페이지, 이미지, 영상은 그대로 쓰시면 됩니다.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-bolt-elements-textPrimary">API 키를 따로 넣어야 하나요?</dt>
              <dd className="mt-1 text-sm text-bolt-elements-textSecondary">
                아니요. 가입 후 바로 쓸 수 있고 크레딧만 차감됩니다. 생성이 실패하면 그 크레딧은 자동으로 환불됩니다.
              </dd>
            </div>
          </dl>
        </div>

        <p className="mt-8 text-center text-xs text-bolt-elements-textSecondary">
          문의: hasin7jk@gmail.com · 표시된 금액은 부가세 포함입니다.
        </p>
      </main>
    </div>
  );
}
