import Link from 'next/link';
import {
  fetchCreditProducts,
  formatUsd,
  type CreditProduct,
} from '@/lib/credit-products';

export const revalidate = 120;

const APP_ORIGIN = 'https://app.skyhunter.app';

const freePlan = {
  name: 'Free',
  price: '$0',
  period: 'forever',
  creditsLabel: '5 credits',
  features: [
    '5 credits on signup',
    '1 credit per search',
    'Email alerts',
    'Basic filters',
  ],
  cta: 'Get Started',
  ctaLink: APP_ORIGIN,
  highlight: false,
};

function paidPlanFeatures(credits: number): string[] {
  return [
    `${credits.toLocaleString()} credits`,
    'Unlimited monitors',
    'Push notifications',
    'Advanced filters',
    'Price heatmaps',
  ];
}

/** 与旧版「Starter 高亮」类似：按积分排序后，第二档为 POPULAR（至少两档时） */
function isPopularHighlight(index: number, total: number): boolean {
  return total >= 2 && index === 1;
}

export default async function PricingPage() {
  const products = await fetchCreditProducts();

  return (
    <div className="min-h-screen bg-black">
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <Link href="/" className="text-2xl font-bold text-green-400">
          SkyHunter
        </Link>
        <Link
          href={APP_ORIGIN}
          className="bg-green-400 text-black px-5 py-2 rounded-lg font-semibold hover:bg-green-300 transition"
        >
          Launch App
        </Link>
      </nav>

      <section className="text-center px-6 pt-20 pb-10">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Simple, <span className="text-green-400">Pay-as-you-go</span> Pricing
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Buy credits once. Use them to search and monitor flights. No subscriptions, no hidden fees.
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-10">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 text-center">How Credits Work</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-400">1</div>
              <div className="text-gray-400 text-sm">credit per search</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">5-50</div>
              <div className="text-gray-400 text-sm">credits per monitor</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">24/7</div>
              <div className="text-gray-400 text-sm">automated checks</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">Free</div>
              <div className="text-gray-400 text-sm">alerts & notifications</div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <PlanCardStatic plan={freePlan} />

          {products.map((plan: CreditProduct, index: number) => (
            <PlanCardPaid
              key={plan.product_id}
              plan={plan}
              highlight={isPopularHighlight(index, products.length)}
            />
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold text-center mb-10">
          Frequently Asked <span className="text-green-400">Questions</span>
        </h2>
        {[
          {
            q: 'Do credits expire?',
            a: 'No. Credits never expire and are always available in your account.',
          },
          {
            q: 'Can I get a refund?',
            a: 'Credits are non-refundable, but unused credits stay in your account forever.',
          },
          {
            q: 'What payment methods do you accept?',
            a: 'Apple Pay (iOS), Google Play (Android), and credit/debit cards via Stripe (Web).',
          },
          {
            q: 'Is there a subscription?',
            a: 'No subscriptions. Buy credits when you need them, at your own pace.',
          },
        ].map((faq) => (
          <div key={faq.q} className="border-b border-gray-800 py-5">
            <h3 className="font-semibold mb-2">{faq.q}</h3>
            <p className="text-gray-400 text-sm">{faq.a}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-gray-800 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} SkyHunter. All rights reserved.
          </div>
          <div className="flex gap-6 text-gray-500 text-sm">
            <Link href="/" className="hover:text-white transition">
              Home
            </Link>
            <a href={`${APP_ORIGIN}/legal?tab=privacy`} className="hover:text-white transition">
              Privacy
            </a>
            <a href={`${APP_ORIGIN}/legal?tab=terms`} className="hover:text-white transition">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PlanCardStatic({
  plan,
}: {
  plan: typeof freePlan;
}) {
  return (
    <div
      className={`rounded-xl p-6 border ${
        plan.highlight ? 'border-green-400 bg-gray-900 relative' : 'border-gray-800 bg-gray-900/50'
      }`}
    >
      {plan.highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-400 text-black text-xs font-bold px-3 py-1 rounded-full">
          POPULAR
        </div>
      )}
      <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
      <div className="mb-1">
        <span className="text-3xl font-bold text-green-400">{plan.price}</span>
        <span className="text-gray-500 text-sm ml-1">/ {plan.period}</span>
      </div>
      <div className="text-gray-400 text-sm mb-6">{plan.creditsLabel}</div>
      <ul className="space-y-3 mb-8">
        {plan.features.map((f) => (
          <li key={f} className="text-gray-300 text-sm flex items-start gap-2">
            <span className="text-green-400 mt-0.5">&#10003;</span>
            {f}
          </li>
        ))}
      </ul>
      <a
        href={plan.ctaLink}
        className={`block text-center py-3 rounded-lg font-semibold transition ${
          plan.highlight
            ? 'bg-green-400 text-black hover:bg-green-300'
            : 'border border-gray-600 text-white hover:border-green-400'
        }`}
      >
        {plan.cta}
      </a>
    </div>
  );
}

function PlanCardPaid({ plan, highlight }: { plan: CreditProduct; highlight: boolean }) {
  const price = formatUsd(plan.price_usd);
  const title = `${plan.credits.toLocaleString()} credits`;
  const features = paidPlanFeatures(plan.credits);

  return (
    <div
      className={`rounded-xl p-6 border ${
        highlight ? 'border-green-400 bg-gray-900 relative' : 'border-gray-800 bg-gray-900/50'
      }`}
    >
      {highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-400 text-black text-xs font-bold px-3 py-1 rounded-full">
          POPULAR
        </div>
      )}
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <div className="mb-1">
        <span className="text-3xl font-bold text-green-400">{price}</span>
        <span className="text-gray-500 text-sm ml-1">/ one-time</span>
      </div>
      <div className="text-gray-500 text-xs mb-6 font-mono truncate" title={plan.product_id}>
        {plan.product_id}
      </div>
      <ul className="space-y-3 mb-8">
        {features.map((f) => (
          <li key={f} className="text-gray-300 text-sm flex items-start gap-2">
            <span className="text-green-400 mt-0.5">&#10003;</span>
            {f}
          </li>
        ))}
      </ul>
      <a
        href={`${APP_ORIGIN}/purchase`}
        className={`block text-center py-3 rounded-lg font-semibold transition ${
          highlight
            ? 'bg-green-400 text-black hover:bg-green-300'
            : 'border border-gray-600 text-white hover:border-green-400'
        }`}
      >
        Buy Credits
      </a>
    </div>
  );
}
