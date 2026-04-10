/**
 * 与后端 `GET /api/v1/payments/products`（payments.get_credit_products）对齐。
 * 管理员在后台修改 credit_pricing_packages 后，官网定价页通过此函数展示同一数据。
 */

export type CreditProduct = {
  product_id: string;
  credits: number;
  price_usd: number;
};

/** 仅当 API 不可用时使用，需与 backend/routers/payments.py 中 CREDIT_PRODUCTS 保持一致 */
export const FALLBACK_CREDIT_PRODUCTS: CreditProduct[] = [
  { product_id: 'credits_50', credits: 50, price_usd: 0.99 },
  { product_id: 'credits_200', credits: 200, price_usd: 2.99 },
  { product_id: 'credits_500', credits: 500, price_usd: 4.99 },
  { product_id: 'credits_1500', credits: 1500, price_usd: 9.99 },
];

function apiBaseUrl(): string {
  const u =
    process.env.SKYHUNTER_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_SKYHUNTER_API_URL?.trim();
  if (u) return u.replace(/\/$/, '');
  return 'http://127.0.0.1:8000';
}

export async function fetchCreditProducts(): Promise<CreditProduct[]> {
  const url = `${apiBaseUrl()}/api/v1/payments/products`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 120 },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      console.warn(`[pricing] GET ${url} failed: ${res.status}`);
      return FALLBACK_CREDIT_PRODUCTS;
    }
    const data: unknown = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      return FALLBACK_CREDIT_PRODUCTS;
    }
    const parsed: CreditProduct[] = [];
    for (const row of data) {
      if (
        row &&
        typeof row === 'object' &&
        'product_id' in row &&
        'credits' in row &&
        'price_usd' in row
      ) {
        const credits = Number((row as CreditProduct).credits);
        const price_usd = Number((row as CreditProduct).price_usd);
        if (Number.isFinite(credits) && Number.isFinite(price_usd)) {
          parsed.push({
            product_id: String((row as CreditProduct).product_id),
            credits,
            price_usd,
          });
        }
      }
    }
    if (parsed.length === 0) return FALLBACK_CREDIT_PRODUCTS;
    return parsed.sort((a, b) => a.credits - b.credits);
  } catch (e) {
    console.warn('[pricing] fetch credit products:', e);
    return FALLBACK_CREDIT_PRODUCTS;
  }
}

export function formatUsd(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}
