/**
 * Currency table and conversion.
 *
 * KEVLAR is offline by design, so rates can't be live. They ship as editable
 * defaults and every conversion is labelled with the date the rates were last
 * set, an honest stale number beats a fake live one.
 */

export type Currency = {
  code: string;
  symbol: string;
  name: string;
  /** Units of this currency per 1 USD. */
  perUsd: number;
};

/** Majors, the Gulf, plus Tunisian Dinar. */
export const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', perUsd: 1 },
  { code: 'EUR', symbol: '€', name: 'Euro', perUsd: 0.92 },
  { code: 'GBP', symbol: '£', name: 'British Pound', perUsd: 0.79 },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', perUsd: 157 },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc', perUsd: 0.88 },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', perUsd: 1.37 },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', perUsd: 1.52 },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', perUsd: 7.25 },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', perUsd: 83.5 },
  { code: 'TND', symbol: 'DT', name: 'Tunisian Dinar', perUsd: 3.15 },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', perUsd: 3.67 },
  { code: 'SAR', symbol: 'SR', name: 'Saudi Riyal', perUsd: 3.75 },
  { code: 'MAD', symbol: 'DH', name: 'Moroccan Dirham', perUsd: 9.9 },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', perUsd: 48 },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', perUsd: 34 },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', perUsd: 10.6 },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', perUsd: 1.34 },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', perUsd: 18.2 },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', perUsd: 5.5 },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', perUsd: 18.5 },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', perUsd: 1550 },
];

export const byCode = (code: string): Currency =>
  CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];

/** Currencies that conventionally have no minor unit. */
const ZERO_DECIMAL = new Set(['JPY', 'KRW']);

/**
 * Converts an amount in minor units of `from` into minor units of `to`,
 * honouring any user-overridden rates.
 */
export function convert(
  cents: number,
  from: string,
  to: string,
  overrides: Record<string, number> = {}
): number {
  if (from === to) return cents;
  const rateFrom = overrides[from] ?? byCode(from).perUsd;
  const rateTo = overrides[to] ?? byCode(to).perUsd;
  if (!rateFrom) return cents;
  const usd = cents / rateFrom;
  return Math.round(usd * rateTo);
}

/** Formats in the target currency's own conventions. */
export function formatIn(
  cents: number,
  code: string,
  opts: { compact?: boolean } = {}
): string {
  const c = byCode(code);
  const decimals = ZERO_DECIMAL.has(code) ? 0 : 2;
  const negative = cents < 0;
  const abs = Math.abs(cents) / 100;

  let body: string;
  if (opts.compact && abs >= 1_000_000) body = `${(abs / 1_000_000).toFixed(1)}M`;
  else if (opts.compact && abs >= 10_000) body = `${(abs / 1000).toFixed(1)}k`;
  else
    body = abs.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  return `${negative ? '-' : ''}${c.symbol}${body}`;
}
