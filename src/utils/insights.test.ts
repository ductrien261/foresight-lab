import data from '@/data/vietnam.json';

import { buildInsights } from './insights';

const input = {
  lastYear: 2024,
  lastValue: 1457.18,
  years: data.forecastYears,
  forecast: data.scenarios.base.annual,
  low: data.scenarios.low.annual,
  high: data.scenarios.high.annual,
  planYear: 2030,
  planDemand: data.scenarios.base.annual[5]!,
  supply2030: 1802.65,
  seasonalProfile: null,
};

describe('buildInsights', () => {
  it('gives planners the yearly supply to add and the gap to the plan', () => {
    const [supply, plan] = buildInsights('gov', input);
    // (2006.62 - 1457.18) / 6 years
    expect(supply?.big).toBe('92');
    // 2006.62 - 1802.65
    expect(plan?.big).toBe('+204');
  });

  it('gives investors the growth floor of the low scenario and the scenario spread', () => {
    const [floor, market, spread] = buildInsights('inv', input);
    // (1999.17 / 1457.18) ^ (1/6) - 1
    expect(floor?.big).toBe('5,4%');
    expect(market?.big).toBe('+549');
    // High - Low in 2030: 2033.09 - 1999.17
    expect(spread?.big).toBe('34');
    expect(spread?.text).not.toMatch(/SARIMAX/);
  });

  it('falls back to the report seasonality when the profile is missing', () => {
    const [low] = buildInsights('biz', input);
    expect(low?.big).toBe('Tháng 2');
  });
});
