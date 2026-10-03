const cache = new Map<number, Intl.NumberFormat>();

/** Vietnamese number format: 1.457,18 */
export function formatNumber(value: number, digits = 2): string {
  let fmt = cache.get(digits);
  if (!fmt) {
    fmt = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    cache.set(digits, fmt);
  }
  return fmt.format(value).replace('-', '−');
}

export function formatSigned(value: number, digits = 0): string {
  return (value >= 0 ? '+' : '') + formatNumber(value, digits);
}

export function formatPercent(rate: number, digits = 1): string {
  return `${formatNumber(rate * 100, digits)}%`;
}

export function cagr(from: number, to: number, years: number): number {
  return (to / from) ** (1 / years) - 1;
}
