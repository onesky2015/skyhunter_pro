import Link from 'next/link';

const features = [
  {
    icon: '🔍',
    title: 'Smart Price Search',
    desc: 'Search 30-day price heatmaps for any route. Find the cheapest day to fly at a glance.',
  },
  {
    icon: '📊',
    title: 'Automated Monitoring',
    desc: 'Set target prices and let SkyHunter watch for you. Get notified the instant prices drop.',
  },
  {
    icon: '🔔',
    title: 'Instant Alerts',
    desc: 'Email and push notifications the moment your target price is reached. Never miss a deal.',
  },
  {
    icon: '✈️',
    title: 'Advanced Filters',
    desc: 'Filter by airline, alliance, stops, departure time, cabin class, and more.',
  },
  {
    icon: '📱',
    title: 'Cross-Platform',
    desc: 'Available on iOS, Android, and Web. Your monitors sync across all devices.',
  },
  {
    icon: '🔒',
    title: 'Secure & Private',
    desc: 'Bank-grade encryption, OAuth login, and full data deletion support.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="text-2xl font-bold text-green-400">SkyHunter</div>
        <div className="flex items-center gap-6">
          <Link href="/pricing" className="text-gray-400 hover:text-white transition">
            Pricing
          </Link>
          <Link
            href="https://app.skyhunter.app"
            className="bg-green-400 text-black px-5 py-2 rounded-lg font-semibold hover:bg-green-300 transition"
          >
            Launch App
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto text-center px-6 pt-24 pb-16">
        <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
          Never Overpay
          <br />
          <span className="text-green-400">for Flights</span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
          SkyHunter monitors flight prices 24/7 and alerts you when they drop below your target.
          Save hundreds on every trip.
        </p>
        <div className="flex justify-center gap-4 flex-wrap">
          <Link
            href="https://app.skyhunter.app"
            className="bg-green-400 text-black px-8 py-4 rounded-lg text-lg font-bold hover:bg-green-300 transition"
          >
            Get Started Free
          </Link>
          <Link
            href="/pricing"
            className="border border-gray-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:border-green-400 transition"
          >
            View Pricing
          </Link>
        </div>
        <p className="text-gray-600 text-sm mt-4">5 free credits on signup. No credit card required.</p>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-14">
          Everything you need to <span className="text-green-400">fly cheaper</span>
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-green-400/50 transition"
            >
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-14">
          How it <span className="text-green-400">works</span>
        </h2>
        <div className="space-y-12">
          {[
            { step: '1', title: 'Search', desc: 'Enter your route and dates. See a 30-day price heatmap instantly.' },
            { step: '2', title: 'Monitor', desc: 'Set your target price and monitoring frequency. We do the rest.' },
            { step: '3', title: 'Save', desc: 'Get alerted when prices drop. Book at the perfect moment.' },
          ].map((s) => (
            <div key={s.step} className="flex items-start gap-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-400 text-black flex items-center justify-center text-xl font-bold">
                {s.step}
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-1">{s.title}</h3>
                <p className="text-gray-400">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center px-6 py-20">
        <h2 className="text-3xl md:text-4xl font-bold mb-6">
          Start saving on flights <span className="text-green-400">today</span>
        </h2>
        <Link
          href="https://app.skyhunter.app"
          className="inline-block bg-green-400 text-black px-10 py-4 rounded-lg text-lg font-bold hover:bg-green-300 transition"
        >
          Sign Up Free
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} SkyHunter. All rights reserved.
          </div>
          <div className="flex gap-6 text-gray-500 text-sm">
            <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
            <a href="https://app.skyhunter.app/legal?tab=privacy" className="hover:text-white transition">
              Privacy
            </a>
            <a href="https://app.skyhunter.app/legal?tab=terms" className="hover:text-white transition">
              Terms
            </a>
            <a href="mailto:support@skyhunter.app" className="hover:text-white transition">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
