import type { ExportedModel, Gm11Trend, RegressionTrend, ScalerParams, TrendKind } from '@/typings/model';

import { type GrowthPath, rateFor } from './denton';

function scale(x: number[], s: ScalerParams): number[] {
  return x.map((v, j) => v * s.scale[j]! + s.min[j]!);
}

/** One-sample first-order Takagi-Sugeno ANFIS, same layout as python/foresight/anfis.py. */
export function anfisPredict(x: number[], params: number[], nRules: number, nInputs: number): number {
  const nPremise = nRules * nInputs * 2;
  const mu = new Array<number>(nRules).fill(1);
  for (let r = 0; r < nRules; r++) {
    for (let j = 0; j < nInputs; j++) {
      const base = (r * nInputs + j) * 2;
      const c = params[base]!;
      const sigma = Math.abs(params[base + 1]!) + 1e-8;
      const z = (x[j]! - c) / sigma;
      mu[r] = mu[r]! * Math.exp(-0.5 * z * z);
    }
  }
  const total = mu.reduce((a, b) => a + b, 0) + 1e-8;
  let out = 0;
  for (let r = 0; r < nRules; r++) {
    const base = nPremise + r * (nInputs + 1);
    let rule = params[base + nInputs]!;
    for (let j = 0; j < nInputs; j++) rule += x[j]! * params[base + j]!;
    out += (mu[r]! / total) * rule;
  }
  return out;
}

/**
 * One-step-ahead GM(1,1) forecast.
 * Mirrors python/foresight/gm11.py:gm11_next — see that file for derivation.
 *
 * Paper Step 3: the rolling-window GM(1,1) module projects the trend by
 * repeatedly calling this function on a sliding window of length `w`.
 */
function gm11Next(w: number[]): number {
  const n = w.length;
  // AGO: accumulated generating operation x1[i] = sum(w[0..i])
  const x1: number[] = [];
  for (let i = 0; i < n; i++) x1.push((x1[i - 1] ?? 0) + w[i]!);
  // Build normal equations for B'B [a,b]' = B'y where B = [-z1 | 1], y = w[1:]
  let bTb00 = 0;
  let bTb01 = 0;
  const bTb11 = n - 1;
  let bTy0 = 0;
  let bTy1 = 0;
  for (let i = 0; i < n - 1; i++) {
    const z = (x1[i]! + x1[i + 1]!) / 2; // mean generation z1[i]
    const y = w[i + 1]!;
    bTb00 += z * z;
    bTb01 -= z; // column is -z1
    bTy0 -= z * y;
    bTy1 += y;
  }
  // Solve 2x2: [[bTb00, bTb01], [bTb01, bTb11]] [a, b]' = [bTy0, bTy1]
  const det = bTb00 * bTb11 - bTb01 * bTb01;
  const a = (bTy0 * bTb11 - bTy1 * bTb01) / det;
  const b = (bTb00 * bTy1 - bTb01 * bTy0) / det;
  // x1_hat(k) = (w[0] - b/a)*exp(-a*k) + b/a; IAGO: x0_hat(n) = x1_hat(n) - x1_hat(n-1)
  const base = w[0]! - b / a;
  return base * Math.exp(-a * n) - base * Math.exp(-a * (n - 1));
}

/** Trend level at forecast step `step`, mirrors pipeline.py:TrendModel.predict. */
function regressionLevel(trend: RegressionTrend, step: number, drivers: number[]): number {
  const t = trend.nHist + step;
  let level = trend.intercept + trend.coef[0]! * t;
  if (trend.useDrivers) drivers.forEach((v, j) => (level += v * trend.coef[j + 1]!));
  return level;
}

/** Scenario inputs for the GM(1,1) trend: growth of the main driver, and optionally another reference. */
export interface TrendOptions {
  growth?: GrowthPath;
  refGrowth?: number;
}

/** Multiplier of the GM(1,1) path at each step, mirrors longterm.py:growth_factor. */
function growthFactor(steps: number, trend: Gm11Trend, opts: TrendOptions): number[] {
  const beta = trend.beta;
  const ref = opts.refGrowth ?? trend.refGrowth;
  let f = 1;
  return Array.from({ length: steps }, (_, s) => {
    if (opts.growth !== undefined && beta !== 0) f *= (1 + beta * (rateFor(opts.growth, Math.floor(s / 12)) - ref)) ** (1 / 12);
    return f;
  });
}

/**
 * Recursive monthly forecast for one scenario of future drivers (h x k).
 * Mirrors python/foresight/pipeline.py:forecast_degna — paper Steps 3-5.
 *
 * Step 3: trend, one month at a time. `kind` picks the extrapolation:
 *   'gm11'       – recursive GM(1,1) with the backtest-selected window, shifted by the
 *                  elasticity to the main driver's growth (`opts.growth`);
 *   'regression' – trend regressed on t and the drivers. Throws if the model has none.
 * Step 4: GWO-ANFIS projects the nonlinear component (seasonal + residual).
 * Step 5: Final forecast = trend + nonlinear (additive).
 */
export function forecastMonthly(
  model: ExportedModel,
  future: number[][],
  kind: TrendKind,
  opts: TrendOptions = {},
): number[] {
  const regression = model.trends.regression;
  if (kind === 'regression' && !regression) throw new Error('Model has no regression trend.');
  const hist = [...model.nonlinearTail]; // nonlinear (seasonal+residual) history
  const trendBuf = [...model.trends.gm11.tail]; // GM(1,1) rolling window seed
  const w = model.trends.gm11.window;
  const factor = growthFactor(future.length, model.trends.gm11, opts);
  return future.map((drivers, step) => {
    // Step 3: trend forecast
    let trendNext: number;
    if (kind === 'regression') {
      trendNext = regressionLevel(regression!, step, drivers);
    } else {
      const gm = gm11Next(trendBuf.slice(-w));
      trendBuf.push(gm);
      trendNext = gm * factor[step]!;
    }
    // Step 4: ANFIS nonlinear (seasonal+residual) forecast
    const x = [hist[hist.length - 1]!, hist[hist.length - 12]!, ...drivers];
    const scaled = anfisPredict(scale(x, model.scalerX), model.params, model.nRules, model.nInputs);
    const nl = (scaled - model.scalerY.min[0]!) / model.scalerY.scale[0]!;
    hist.push(nl);
    // Step 5: Additive combination
    return trendNext + nl;
  });
}

export function annualTotals(monthly: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i + 12 <= monthly.length; i += 12) {
    out.push(monthly.slice(i, i + 12).reduce((a, b) => a + b, 0));
  }
  return out;
}
