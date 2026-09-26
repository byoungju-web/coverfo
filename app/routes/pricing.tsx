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
    description: '가입하면 무료 크레딧 10이 한 번 지급됩니다. 무료 사용은 전체 합산 매달 500까지, 선착순입니다.',
    features: ['무료 크레딧 10 (가입 시 1회)', '앱 생성 · 대화 1크레딧, 이미지 2크레딧', '매달 1일 무료 한도(전체 500) 초기화', '영상은 충전 크레딧으로만 가능'],
    highlight: false,
  },
  {
    name: '스타터',
    price: '9,900원',
    period: '/ 100크레딧',
    description: '충전한 크레딧으로 쓴 만큼만 차감됩니다. 기간 제한 없이 남은 크레딧은 그대로 남습니다.',
    features: [
      '앱 생성 · 대화 1크레딧',
      '이미지 2K 생성 2크레딧',
      '영상 8초 25크레딧',
      'coverfo 엔진 · 앱 만들기 30크레딧',
      'coverfo 엔진 · 3D 에셋(이미지·영상·3D 모델) 25크레딧',
      '엔진 결과 수정 5크레딧부터 (이미지 8 · 3D 모델 15 · 영상 15)',
      '예약 페이지 · 견적서 · 문서 · 3D 게임 템플릿',
      '이메일 문의 지원',
    ],
    highlight: true,
  },
  {
    name: '작동 방식',
    price: '1크레딧 ≈ 99원',
    period: '',
    description: 'coverfo가 보유한 AI로 실행하고 크레딧만 차감합니다. 본인 API 키는 필요 없습니다.',
    features: ['API 키 발급 · 관리 불필요', '실패한 생성은 자동 환불', '만든 결과물은 그대로 사용'],
    highlight: false,
    note: '충전은 문의 후 계정에 바로 넣어 드립니다.',
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
            href="mailto:hasin7jk@gmail.com?subject=coverfo 크레딧 충전 문의"
            className="block rounded-lg bg-accent-500 px-4 py-2.5 text-center text-sm font-medium text-white"
          >
            문의하고 충전하기
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
                계정을 만들면 무료 크레딧 10이 한 번 지급됩니다. 무엇인가를 만들어달라고 요청할 때마다 차감되고(앱 생성 1,
                이미지 2, 엔진 앱 30 · 3D 에셋 25), 만든 결과물을 보는 것은 차감되지 않습니다. 무료 사용은 전체 사용자 합산으로 매달 500까지
                선착순이며, 소진되면 다음 달 1일에 다시 열립니다. 영상은 충전한 크레딧으로만 만들 수 있습니다.
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
                아니요. coverfo가 보유한 API로 실행하고 크레딧만 차감됩니다. 생성이 실패하면 그 크레딧은 자동으로
                환불됩니다.
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
