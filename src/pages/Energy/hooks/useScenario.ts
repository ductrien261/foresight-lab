import { useMemo, useState } from 'react';

import vietnam from '@/data/vietnam.json';
import { type GrowthPath, scenarioDrivers } from '@/engine/denton';
import { annualTotals, forecastMonthly } from '@/engine/forecast';
import type { ScenarioKey, TrendKind, VietnamData } from '@/typings/model';

export const DATA = vietnam as unknown as VietnamData;
export const SCENARIO_KEYS: ScenarioKey[] = ['low', 'base', 'high'];
/** Years covered by the published scenarios: 2025–2030. Plan comparisons use its last year. */
export const REPORT_YEARS = DATA.forecastYears.length;
export const PLAN_YEAR = DATA.forecastYears[REPORT_YEARS - 1]!;
export const MAX_YEARS = 15;

export interface Rates {
  iip: GrowthPath;
  fdi: GrowthPath;
}

/**
 * `annual`/`monthly`: main DeGNA forecast, trend projected by recursive rolling-window
 * GM(1,1) (notebook v9). Every figure on the Energy page uses these.
 * `altAnnual`/`altMonthly`: comparison only, trend extrapolated by regression on t, IIP, FDI.
 */
export interface ScenarioResult {
  annual: number[];
  monthly: number[] | null;
  altAnnual: number[];
  altMonthly: number[] | null;
}

/** Forecast years for a horizon, starting at the first forecast year (2025). */
export function forecastYearsFor(years: number): number[] {
  return Array.from({ length: years }, (_, i) => DATA.forecastYears[0]! + i);
}

/** Cut a result to its first `years` years. */
export function sliceResult(r: ScenarioResult, years: number): ScenarioResult {
  return {
    annual: r.annual.slice(0, years),
    monthly: r.monthly?.slice(0, years * 12) ?? null,
    altAnnual: r.altAnnual.slice(0, years),
    altMonthly: r.altMonthly?.slice(0, years * 12) ?? null,
  };
}

const canExtend = DATA.model !== null && DATA.lastYearExog !== null;
const MAIN: TrendKind = 'gm11';
/** Comparison trend; falls back to the main one when the model has no regression. */
const ALT: TrendKind = DATA.model?.trends.regression ? 'regression' : 'gm11';

/** Live forecast; the GM(1,1) trend is shifted by the IIP growth path (rates[0]). */
function live(rates: GrowthPath[], years: number, kind: TrendKind): number[] {
  const drivers = scenarioDrivers(DATA.lastYearExog!, rates, years);
  return forecastMonthly(DATA.model!, drivers, kind, { growth: rates[0] });
}

/** Sort Low/Base/High month by month (comparison line; the main line is already ordered). */
function sortedByMonth(series: Record<ScenarioKey, number[]>): Record<ScenarioKey, number[]> {
  const out = { low: [] as number[], base: [] as number[], high: [] as number[] };
  series.low.forEach((_, t) => {
    const [lo, mid, hi] = SCENARIO_KEYS.map((k) => series[k][t]!).sort((a, b) => a - b);
    out.low.push(lo!);
    out.base.push(mid!);
    out.high.push(hi!);
  });
  return out;
}

const presetCache = new Map<number, Record<ScenarioKey, ScenarioResult>>();

/**
 * The three presets over `years` (>= REPORT_YEARS). 2025–2030 are the published numbers
 * exactly; later years continue with the browser engine from the same model and rates.
 */
export function presetSeries(years: number): Record<ScenarioKey, ScenarioResult> {
  const n = canExtend ? Math.max(years, REPORT_YEARS) : REPORT_YEARS;
  const cached = presetCache.get(n);
  if (cached) return cached;
  const published = (k: ScenarioKey): ScenarioResult => {
    const p = DATA.scenarios[k];
    return { annual: p.annual, monthly: p.monthly, altAnnual: p.altAnnual, altMonthly: p.altMonthly };
  };
  let out: Record<ScenarioKey, ScenarioResult>;
  if (n === REPORT_YEARS) {
    out = { low: published('low'), base: published('base'), high: published('high') };
  } else {
    const run = (kind: TrendKind) => ({
      low: live([DATA.scenarios.low.iip, DATA.scenarios.low.fdi], n, kind),
      base: live([DATA.scenarios.base.iip, DATA.scenarios.base.fdi], n, kind),
      high: live([DATA.scenarios.high.iip, DATA.scenarios.high.fdi], n, kind),
    });
    const main = run(MAIN);
    const alt = sortedByMonth(run(ALT));
    const cut = REPORT_YEARS * 12;
    const extend = (k: ScenarioKey): ScenarioResult => {
      const p = published(k);
      const monthly = [...(p.monthly ?? main[k].slice(0, cut)), ...main[k].slice(cut)];
      const altMonthly = [...(p.altMonthly ?? alt[k].slice(0, cut)), ...alt[k].slice(cut)];
      return {
        annual: [...p.annual, ...annualTotals(main[k].slice(cut))],
        monthly,
        altAnnual: [...p.altAnnual, ...annualTotals(alt[k].slice(cut))],
        altMonthly,
      };
    };
    out = { low: extend('low'), base: extend('base'), high: extend('high') };
  }
  presetCache.set(n, out);
  return out;
}

/**
 * Forecast for any growth path over max(years, REPORT_YEARS) years, so 2030 is always
 * available for the plan comparison; callers cut it to the horizon they show.
 * Presets use the published numbers exactly for 2025–2030.
 */
export function runScenario(rates: Rates, preset: ScenarioKey | null, years = REPORT_YEARS): ScenarioResult | null {
  if (preset) return presetSeries(years)[preset];
  if (!canExtend) return null;
  const n = Math.max(years, REPORT_YEARS);
  const monthly = live([rates.iip, rates.fdi], n, MAIN);
  const altMonthly = live([rates.iip, rates.fdi], n, ALT);
  return { annual: annualTotals(monthly), monthly, altAnnual: annualTotals(altMonthly), altMonthly };
}

export function useScenario() {
  const [preset, setPreset] = useState<ScenarioKey | null>('base');
  const [rates, setRates] = useState<{ iip: number; fdi: number }>({
    iip: DATA.scenarios.base.iip,
    fdi: DATA.scenarios.base.fdi,
  });
  const [horizon, setHorizon] = useState(REPORT_YEARS);
  const canCustomize = canExtend;

  const result = useMemo(() => runScenario(rates, preset, horizon), [rates, preset, horizon]);
  const presets = useMemo(() => presetSeries(horizon), [horizon]);

  function choosePreset(key: ScenarioKey) {
    setPreset(key);
    setRates({ iip: DATA.scenarios[key].iip, fdi: DATA.scenarios[key].fdi });
  }

  function changeRate(driver: 'iip' | 'fdi', value: number) {
    if (!canCustomize) return;
    setPreset(null);
    setRates((prev) => ({ ...prev, [driver]: value }));
  }

  function changeHorizon(years: number) {
    setHorizon(Math.min(Math.max(1, Math.round(years)), canExtend ? MAX_YEARS : REPORT_YEARS));
  }

  return { preset, rates, horizon, result, presets, canCustomize, choosePreset, changeRate, changeHorizon };
}
