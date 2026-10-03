import data from '@/data/vietnam.json';
import type { ScenarioKey, VietnamData } from '@/typings/model';

import { scenarioDrivers } from './denton';
import { annualTotals, forecastMonthly } from './forecast';

const vn = data as unknown as VietnamData;
const KEYS: ScenarioKey[] = ['low', 'base', 'high'];

/** Annual totals recomputed in the browser engine from the exported parameters. */
function recompute(key: ScenarioKey, kind: 'gm11' | 'regression'): number[] {
  const s = vn.scenarios[key];
  const drivers = scenarioDrivers(vn.lastYearExog!, [s.iip, s.fdi], vn.forecastYears.length);
  return annualTotals(forecastMonthly(vn.model!, drivers, kind, { growth: s.iip }));
}

function expectWithin(actual: number[], expected: number[], rel: number) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((v, i) => expect(Math.abs(v - expected[i]!) / expected[i]!).toBeLessThan(rel));
}

describe('Vietnam model exported from notebook v9', () => {
  it('has both trend extrapolations exported', () => {
    expect(vn.model?.trends.gm11.tail).toHaveLength(60);
    expect(vn.model?.trends.regression?.useDrivers).toBe(true);
  });

  it('keeps Table 4-9 of the report (notebook v9) as the main forecast', () => {
    expect(vn.scenarios.low.annual.slice(1)).toEqual([1592.68, 1692.0, 1783.48, 1884.05, 1999.17]);
    expect(vn.scenarios.base.annual.slice(1)).toEqual([1594.09, 1694.56, 1787.41, 1889.59, 2006.62]);
    expect(vn.scenarios.high.annual.slice(1)).toEqual([1598.56, 1702.91, 1800.59, 1908.72, 2033.09]);
  });

  it('uses the backtest-selected window and elasticity of the report', () => {
    expect(vn.model?.trends.gm11.window).toBe(60);
    expect(vn.model?.trends.gm11.beta).toBeCloseTo(0.0227, 4);
    expect(vn.model?.trends.gm11.refGrowth).toBe(0.065);
    expect(vn.longTrend?.mape.find((m) => m.window === 60)?.mape).toBeCloseTo(9.64, 2);
  });

  it('reproduces the main scenarios (long-term GM(1,1) trend) from the exported parameters within 0.01%', () => {
    for (const key of KEYS) expectWithin(recompute(key, 'gm11'), vn.scenarios[key].annual, 0.0001);
  });

  it('reproduces the regression comparison line (altAnnual) from the exported parameters within 0.2%', () => {
    for (const key of KEYS) expectWithin(recompute(key, 'regression'), vn.scenarios[key].altAnnual, 0.002);
  });
});
