import { solve } from './linalg';

/**
 * First-difference Denton (sum constraint), solved exactly through its KKT system.
 * Mirrors python/foresight/denton.py:denton.
 */
export function denton(low: number[], indicator: number[], ratio = 12): number[] {
  const n = low.length;
  const m = n * ratio;
  if (indicator.length !== m) throw new Error(`indicator has ${indicator.length} points, expected ${m}`);
  const proportional = indicator.every((v) => v > 0);
  const size = m + n;
  const kkt = Array.from({ length: size }, () => new Array<number>(size).fill(0));

  for (let t = 0; t < m; t++) {
    const row = kkt[t]!;
    const left = t > 0 ? 1 : 0;
    const right = t < m - 1 ? 1 : 0;
    row[t] = 2 * (left + right);
    if (left) row[t - 1] = -2;
    if (right) row[t + 1] = -2;
  }
  const rhs = new Array<number>(size).fill(0);
  for (let i = 0; i < n; i++) {
    let indSum = 0;
    for (let k = 0; k < ratio; k++) {
      const t = i * ratio + k;
      const c = proportional ? indicator[t]! : 1;
      kkt[m + i]![t] = c;
      kkt[t]![m + i] = c;
      indSum += indicator[t]!;
    }
    rhs[m + i] = proportional ? low[i]! : low[i]! - indSum;
  }

  const z = solve(kkt, rhs).slice(0, m);
  return z.map((v, t) => (proportional ? v * indicator[t]! : indicator[t]! + v));
}

/** A driver's growth: one rate for every year, or one rate per year. */
export type GrowthPath = number | number[];

export function rateFor(path: GrowthPath, year: number): number {
  return typeof path === 'number' ? path : (path[year] ?? path[path.length - 1] ?? 0);
}

/**
 * Grow each driver's last-year total year by year and spread it over the months,
 * keeping last year's monthly pattern. lastYear is 12 x k; returns (years*12) x k.
 */
export function scenarioDrivers(lastYear: number[][], growth: GrowthPath[], years: number): number[][] {
  const k = growth.length;
  const out = Array.from({ length: years * 12 }, () => new Array<number>(k).fill(0));
  for (let j = 0; j < k; j++) {
    const month = lastYear.map((row) => row[j]!);
    let total = month.reduce((a, b) => a + b, 0);
    const annual = Array.from({ length: years }, (_, y) => (total *= 1 + rateFor(growth[j]!, y)));
    const pattern = Array.from({ length: years * 12 }, (_, t) => month[t % 12]!);
    denton(annual, pattern).forEach((v, t) => {
      out[t]![j] = v;
    });
  }
  return out;
}
