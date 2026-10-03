import fixture from '@/test/fixtures/engine.json';

import { denton, scenarioDrivers } from './denton';
import { annualTotals, forecastMonthly } from './forecast';

function expectClose(actual: number[], expected: number[], rel = 1e-8) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((v, i) => {
    const e = expected[i]!;
    expect(Math.abs(v - e)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(e)));
  });
}

describe('forecast engine matches the Python reference', () => {
  it('disaggregates annual totals with Denton', () => {
    const out = denton(fixture.denton.low, fixture.denton.indicator);
    expectClose(out, fixture.denton.result, 1e-7);
    expectClose(annualTotals(out), fixture.denton.low, 1e-9);
  });

  it('builds scenario drivers from last year and growth rates', () => {
    const out = scenarioDrivers(fixture.lastYear, fixture.rates, 3);
    expectClose(out.flat(), fixture.future.flat(), 1e-7);
  });

  it('reproduces the DeGNA forecast with the long-term GM(1,1) trend and the growth shift', () => {
    const out = forecastMonthly(fixture.model, fixture.future, 'gm11', { growth: fixture.rates[0]! });
    expectClose(out, fixture.forecast.gm11, 1e-6);
  });

  it('applies a year-by-year growth path to the GM(1,1) trend', () => {
    const out = forecastMonthly(fixture.model, fixture.future, 'gm11', { growth: [0.02, 0.08, 0.05] });
    expectClose(out, fixture.forecast.gm11Path, 1e-6);
  });

  it('leaves the GM(1,1) path unshifted without a growth rate or at the reference rate', () => {
    expectClose(forecastMonthly(fixture.model, fixture.future, 'gm11'), fixture.forecast.gm11Plain, 1e-6);
    const atRef = forecastMonthly(fixture.model, fixture.future, 'gm11', { growth: 0.07, refGrowth: 0.07 });
    expectClose(atRef, fixture.forecast.gm11Plain, 1e-9);
  });

  it('reproduces the DeGNA forecast with the regression trend', () => {
    const out = forecastMonthly(fixture.model, fixture.future, 'regression');
    expectClose(out, fixture.forecast.regression, 1e-6);
  });

  it('refuses the regression trend when the model has none', () => {
    const model = { ...fixture.model, trends: { ...fixture.model.trends, regression: null } };
    expect(() => forecastMonthly(model, fixture.future, 'regression')).toThrow();
  });
});
