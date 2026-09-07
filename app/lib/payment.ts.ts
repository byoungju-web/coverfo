// src/lib/payment.ts
// Toss Payments + Stripe 결제 로직 - coverfo.com

// 1. Toss Payments (한국용 - 추천)
export async function requestTossPayment(plan: 'starter' | 'pro') {
  const amount = plan === 'starter' ? 9900 : 49000
  // @ts-ignore - Toss SDK는 index.html에 추가 필요
  const tossPayments = window.TossPayments(import.meta.env.VITE_TOSS_CLIENT_KEY)
  
  await tossPayments.requestPayment('카드', {
    amount,
    orderId: `coverfo_${Date.now()}`,
    orderName: `coverfo ${plan} 플랜`,
    customerName: 'coverfo user',
    successUrl: `https://coverfo.com/payment/success?plan=${plan}`,
    failUrl: `https://coverfo.com/payment/fail`,
  })
}

// 2. Stripe (해외용)
export async function createStripeCheckout(plan: 'starter' | 'pro') {
  const res = await fetch('/api/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan })
  })
  const { url } = await res.json()
  window.location.href = url // Stripe Checkout으로 이동
}

// 3. 서버 API - /app/routes/api.create-checkout.ts 로 만들어야 함 (Remix)
export const stripeServerCode = `
// app/routes/api.create-checkout.ts
import Stripe from 'stripe'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function action({ request }: { request: Request }) {
  const { plan } = await request.json()
  const price = plan === 'starter' ? 9900 : 49000
  
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price_data: { currency: 'krw', product_data: { name: \`coverfo \${plan}\` }, unit_amount: price }, quantity: 1 }],
    success_url: 'https://coverfo.com/payment/success?plan=' + plan,
    cancel_url: 'https://coverfo.com/pricing',
  })
  return Response.json({ url: session.url })
}
`

// 4. 결제 성공 후 플랜 업데이트 - Supabase Function이나 웹훅에서 호출
export async function updatePlanAfterPayment(userId: string, plan: 'starter' | 'pro') {
  // Supabase JS로 예시
  // const { supabase } = await import('./supabaseClient')
  // await supabase.from('profiles').update({ 
  //   plan, 
  //   prompt_limit: plan === 'starter' ? 100 : 500 
  // }).eq('id', userId)
  console.log('Update plan for', userId, plan)
}
