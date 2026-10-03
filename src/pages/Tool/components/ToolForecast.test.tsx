import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TOOL } from '@/content/vi';
import fixture from '@/test/fixtures/engine.json';
import type { TrainResult } from '@/workers/protocol';

import { ToolForecast } from './ToolForecast';

const T = TOOL.result;

function makeResult(withRegression: boolean): TrainResult {
  const months = Array.from({ length: 48 }, (_, i) => `${2021 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`);
  return {
    months,
    actual: months.map((_, i) => 100 + i),
    fitted: [],
    testStart: 36,
    trend: [],
    nonlinear: [],
    models: [],
    exogNames: ['IIP', 'Elec'],
    lastYearExog: fixture.lastYear,
    baseRates: fixture.rates,
    lastMonth: months[months.length - 1]!,
    model: withRegression ? fixture.model : { ...fixture.model, trends: { ...fixture.model.trends, regression: null } },
    convergence: [],
    longTrend: {
      window: fixture.model.trends.gm11.window,
      horizonYears: 6,
      origins: ['2014', '2015', '2016', '2017', '2018'],
      mape: [{ window: fixture.model.trends.gm11.window, mape: 9.5 }],
      driver: 'IIP',
      elasticity: { beta: fixture.model.trends.gm11.beta, alpha: 0.05, r: 0.4, n: 13 },
    },
  };
}

describe('Tool forecast', () => {
  it('defaults to 12 months with GM(1,1) as the main line and regression for comparison', () => {
    render(<ToolForecast result={makeResult(true)} fileName="data.xlsx" />);
    expect(screen.getByRole('combobox', { name: T.horizon })).toHaveValue('12');
    expect(screen.getByText(T.gm)).toBeInTheDocument();
    expect(screen.getByText(T.regression)).toBeInTheDocument();
    expect(screen.getByText(T.caption)).toBeInTheDocument();
    expect(screen.queryByText(T.longHorizon)).not.toBeInTheDocument();
  });

  it('warns about reliability from 24 months on', async () => {
    const user = userEvent.setup();
    render(<ToolForecast result={makeResult(true)} fileName="data.xlsx" />);
    await user.selectOptions(screen.getByRole('combobox', { name: T.horizon }), '24');
    expect(screen.getByText(T.longHorizon)).toBeInTheDocument();
  });

  it('draws only GM(1,1) and explains why when there is no regression trend', () => {
    render(<ToolForecast result={makeResult(false)} fileName="data.xlsx" />);
    expect(screen.queryByText(T.regression)).not.toBeInTheDocument();
    expect(screen.getByText(T.noRegression)).toBeInTheDocument();
  });
});
