import { DATA, MAX_YEARS, presetSeries, REPORT_YEARS, runScenario, SCENARIO_KEYS } from './useScenario';

describe('forecast horizon', () => {
  it('keeps the published 2025–2030 numbers exactly when extending the presets', () => {
    const long = presetSeries(10);
    for (const key of SCENARIO_KEYS) {
      expect(long[key].annual).toHaveLength(10);
      expect(long[key].annual.slice(0, REPORT_YEARS)).toEqual(DATA.scenarios[key].annual);
      expect(long[key].altAnnual.slice(0, REPORT_YEARS)).toEqual(DATA.scenarios[key].altAnnual);
      expect(long[key].monthly).toHaveLength(120);
    }
  });

  it('continues smoothly after 2030 and keeps Low ≤ Base ≤ High', () => {
    const { low, base, high } = presetSeries(MAX_YEARS);
    const a = base.annual;
    // growth 2030→2031 stays close to growth 2029→2030 (no jump at the splice)
    const before = a[REPORT_YEARS - 1]! / a[REPORT_YEARS - 2]!;
    const after = a[REPORT_YEARS]! / a[REPORT_YEARS - 1]!;
    expect(Math.abs(after - before)).toBeLessThan(0.01);
    a.forEach((v, i) => {
      expect(low.annual[i]!).toBeLessThanOrEqual(v);
      expect(v).toBeLessThanOrEqual(high.annual[i]!);
    });
  });

  it('always covers 2030 so plan comparisons work for short horizons', () => {
    const custom = runScenario({ iip: 0.07, fdi: 0.05 }, null, 1)!;
    expect(custom.annual).toHaveLength(REPORT_YEARS);
    expect(runScenario({ iip: 0, fdi: 0 }, 'base', 3)!.annual).toHaveLength(REPORT_YEARS);
  });
});
