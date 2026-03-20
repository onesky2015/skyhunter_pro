# SkyHunter Store Submission Guide

## Pre-submission Checklist

### Apple App Store (iOS)

- [ ] Apple Developer Account enrolled ($99/year)
- [ ] Bundle ID registered: `app.skyhunter.flight`
- [ ] App Icons: 1024x1024 (store icon via Asset Catalog)
- [ ] Screenshots: 6.7" (iPhone 15 Pro Max), 6.1" (iPhone 15), 5.5" (iPhone 8 Plus), 12.9" iPad
- [ ] Privacy Policy URL: `https://app.skyhunter.app/legal?tab=privacy`
- [ ] Apple Sign-In implemented (required if any social login exists)
- [ ] In-App Purchase products created in App Store Connect
- [ ] App Review information: demo account credentials
- [ ] Age Rating: 4+ (no objectionable content)
- [ ] Export Compliance: `usesNonExemptEncryption: false`
- [ ] Data Collection declarations in App Store Connect
- [ ] Account Deletion support implemented (Apple requirement since 2022)

#### EAS Build Commands
```bash
cd frontend
eas build --platform ios --profile production
eas submit --platform ios
```

### Google Play Store (Android)

- [ ] Google Play Developer Account enrolled ($25 one-time)
- [ ] Package name registered: `app.skyhunter.flight`
- [ ] App Icons: 512x512 high-res icon
- [ ] Feature Graphic: 1024x500
- [ ] Screenshots: phone (16:9), 7" tablet, 10" tablet
- [ ] Privacy Policy URL
- [ ] Content Rating questionnaire completed
- [ ] Target API level: 34+ (Android 14)
- [ ] Data Safety section filled
- [ ] Google Play Billing products created
- [ ] Service Account JSON for automated uploads

#### EAS Build Commands
```bash
cd frontend
eas build --platform android --profile production
eas submit --platform android
```

### Web SaaS Deployment

- [ ] Domain: `skyhunter.app` (landing) + `app.skyhunter.app` (Expo web)
- [ ] API: `api.skyhunter.app`
- [ ] SSL certificates (via Vercel / Cloudflare)
- [ ] Backend deployed to Railway/AWS with PostgreSQL
- [ ] Web landing page deployed to Vercel
- [ ] Stripe products and prices created
- [ ] Webhook endpoint configured in Stripe dashboard
- [ ] DNS records configured

## Store Metadata

### App Name
**SkyHunter - Flight Price Monitor**

### Subtitle / Short Description
Monitor flight prices and get instant alerts when they drop.

### Description

```
SkyHunter monitors flight prices 24/7 and alerts you when prices drop below your target. Save hundreds on every trip.

KEY FEATURES:
• 30-Day Price Heatmap - See price trends at a glance
• Smart Monitoring - Set target prices, we watch for you
• Instant Alerts - Email & push notifications on price drops
• Advanced Filters - Airlines, stops, times, cabin class
• Cross-Platform - iOS, Android, and Web sync

HOW IT WORKS:
1. Search any route and see 30 days of prices
2. Set your target price and monitoring frequency
3. Get alerted when prices drop - book at the perfect moment

CREDITS SYSTEM:
• 5 free credits on signup
• 1 credit per search, 5-50 per monitor
• Buy more credits when you need them

SkyHunter does NOT sell tickets. We help you find the best time to buy on Google Flights or airline websites.
```

### Keywords
flight tracker, flight deals, price alerts, cheap flights, fare monitor, travel deals, airfare

### Categories
- Primary: Travel
- Secondary: Utilities

### App Rating
4+ / Everyone
