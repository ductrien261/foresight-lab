import type { Point } from '@/components/charts/LineChart';

/** Year ticks every `step` years, plus the last year when it is far from them. */
export function yearTicks(first: number, last: number, step = 5): number[] {
  const ticks: number[] = [];
  for (let y = Math.ceil(first / step) * step; y <= last; y += step) ticks.push(y);
  if (ticks.length === 0 || last - ticks[ticks.length - 1]! >= 2) ticks.push(last);
  return ticks;
}

/** One tick per year for short horizons, every 2 or more years beyond. */
export function forecastTicks(years: number[]): number[] {
  const step = Math.ceil(years.length / 8);
  return years.filter((_, i) => i % step === 0);
}

const MONTH_SHORT = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];

/**
 * Convert flat monthly array (Jan of `firstYear` onwards) to points.
 * Offset each month by +0.5 so points sit at mid-month and never
 * collide with integer year x-tick positions.
 */
export function toMonthlyPoints(m: number[], firstYear: number): Point[] {
  return m.map((v, i) => [firstYear + (i + 0.5) / 12, v]);
}

/** Format fractional year as month label (e.g. "T3 2026"); integer years stay as-is. */
export function formatMonthX(x: number): string {
  if (Number.isInteger(x)) return String(x);
  const year = Math.floor(x);
  const month = Math.floor((x - year) * 12) + 1; // 1-indexed
  return `${MONTH_SHORT[month - 1] ?? ''} ${year}`;
}

/**
 * Aggregate monthly to quarterly totals, centering each bar at the
 * mid-month of the quarter (avoids integer-year collision).
 */
export function toQuarterlyPoints(m: number[], firstYear: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < m.length; i += 3) {
    const q = (m[i] ?? 0) + (m[i + 1] ?? 0) + (m[i + 2] ?? 0);
    // Center of quarter = mid-month of middle month (i+1.5)
    pts.push([firstYear + (i + 1.5) / 12, q]);
  }
  return pts;
}

/** Format fractional year as quarter label (e.g. "Q2 2026"); integer years stay as-is. */
export function formatQuarterX(x: number): string {
  if (Number.isInteger(x)) return String(x);
  const year = Math.floor(x);
  const q = Math.floor((x - year) * 4) + 1; // 1-indexed
  return `Q${q} ${year}`;
}
