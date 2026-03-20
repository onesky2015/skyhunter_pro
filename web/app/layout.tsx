import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SkyHunter - Flight Price Monitor & Alerts',
  description:
    'Monitor flight prices and get instant alerts when prices drop. Track multiple routes, set target prices, and save money on every trip.',
  keywords: 'flight price tracker, flight deals, price alerts, cheap flights, fare monitor',
  openGraph: {
    title: 'SkyHunter - Never Overpay for Flights',
    description: 'Automated flight price monitoring with instant drop alerts.',
    type: 'website',
    url: 'https://skyhunter.app',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  );
}
