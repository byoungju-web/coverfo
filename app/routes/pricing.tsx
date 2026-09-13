import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { Header } from '~/components/header/Header';

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
    description: '먼저 써보고 결정하세요.',
    features: ['무료 2회 생성', '예약 페이지 · 견적서 · 3D 게임 템플릿', '만든 결과물 그대로 사용'],
    highlight: false,
  },
  {
    name: '스타터',
    price: '9,900원',
    period: '/ 월',
    description: '가게 하나 운영하시는 분께 맞춘 요금제입니다.',
    features: ['월 100회 생성', '예약 페이지 · 견적서 · 문서 만들기', '만든 페이지 바로 배포', '이메일 문의 지원'],
    highlight: true,
  },
  {
    name: '본인 API 키',
    price: '0원',
    period: '',
    description: '직접 발급받은 키를 넣으면 횟수 제한이 없습니다.',
    features: ['생성 횟수 무제한', 'API 사용료는 직접 부담', '설정 화면에서 키 입력'],
    highlight: false,
    note: 'Anthropic 계정이 있으신 분께 적합합니다.',
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
            href="mailto:hasin7jk@gmail.com?subject=coverfo 스타터 요금제 문의"
            className="block rounded-lg bg-accent-500 px-4 py-2.5 text-center text-sm font-medium text-white"
          >
            문의하고 시작하기
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

export default function Pricing() {
  return (
    <div className="flex min-h-full w-full flex-col bg-bolt-elements-background-depth-1">
      <ClientOnly>{() => <Header />}</ClientOnly>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-bolt-elements-textPrimary sm:text-3xl">요금제</h1>
          <p className="mt-3 text-sm text-bolt-elements-textSecondary">
            무료로 먼저 써보시고, 계속 쓰실 때 결정하시면 됩니다.
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
              <dt className="text-sm font-medium text-bolt-elements-textPrimary">무료 2회는 어떻게 세나요?</dt>
              <dd className="mt-1 text-sm text-bolt-elements-textSecondary">
                계정을 만들고 무엇인가를 만들어달라고 요청한 횟수로 셉니다. 만든 결과물을 보거나 수정하는 것은 횟수에
                포함되지 않습니다.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-bolt-elements-textPrimary">만든 페이지는 제 것인가요?</dt>
              <dd className="mt-1 text-sm text-bolt-elements-textSecondary">
                네. 만들어진 코드와 페이지는 그대로 쓰시면 됩니다.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-bolt-elements-textPrimary">본인 API 키는 어디에 넣나요?</dt>
              <dd className="mt-1 text-sm text-bolt-elements-textSecondary">
                홈 화면의 모델 선택 옆 연필 아이콘을 눌러 입력하시면 됩니다. 입력한 키는 사용하시는 브라우저에만
                저장됩니다.
              </dd>
            </div>
          </dl>
        </div>

        <p className="mt-8 text-center text-xs text-bolt-elements-textSecondary">
          문의: hasin7jk@gmail.com · 표시된 금액은 부가세 별도입니다.
        </p>
      </main>
    </div>
  );
}
