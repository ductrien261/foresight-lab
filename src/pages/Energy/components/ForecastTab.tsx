import { useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import { BarChart } from '@/components/charts/BarChart';
import chart from '@/components/charts/charts.module.css';
import { LineChart, type LineSeries } from '@/components/charts/LineChart';
import { ErrorFallback } from '@/components/ErrorFallback';
import { ENERGY } from '@/content/vi';
import { formatNumber } from '@/utils/format';
import type { Insight } from '@/utils/insights';

import type { Rates, ScenarioResult } from '../hooks/useScenario';
import { DATA } from '../hooks/useScenario';
import {
  forecastTicks,
  formatMonthX,
  formatQuarterX,
  toMonthlyPoints,
  toQuarterlyPoints,
  yearTicks,
} from './forecastPoints';
import s from './ForecastTab.module.css';
import { ForecastTable } from './ForecastTable';
import { InsightCards } from './InsightCards';
import { LevelChart } from './LevelChart';

type ChartView = 'level' | 'inc' | 'monthly' | 'quarterly';

const CHART_TABS: { value: ChartView; label: string }[] = [
  { value: 'level', label: ENERGY.tabs.level },
  { value: 'inc', label: ENERGY.tabs.inc },
  { value: 'monthly', label: ENERGY.tabs.monthly },
  { value: 'quarterly', label: ENERGY.tabs.quarterly },
];

interface ForecastTabProps {
  /** Forecast years shown (the selected horizon). */
  years: number[];
  /** Selected scenario over `years`: main (GM(1,1) trend) and regression comparison series. */
  result: ScenarioResult;
  /** Preset annual series over `years`, for the band and the table. */
  low: number[];
  base: number[];
  high: number[];
  rates: Rates;
  lastValue: number;
  lastYear: number;
  insights: Insight[];
}

export function ForecastTab({
  years: fYears,
  result,
  low,
  base,
  high,
  rates,
  lastValue,
  lastYear,
  insights,
}: ForecastTabProps) {
  const [chartView, setChartView] = useState<ChartView>('level');
  const [isBandShown, setIsBandShown] = useState(true);
  const [isTrendCompared, setIsTrendCompared] = useState(true);

  const { years, values } = DATA.annual;
  const { annual: forecast, monthly, altAnnual: altForecast, altMonthly } = result;
  const firstYear = fYears[0]!;
  const endYear = fYears[fYears.length - 1]!;
  const avgAdded = (forecast[forecast.length - 1]! - lastValue) / fYears.length;
  const hasMonthly = monthly !== null && monthly.length > 0;

  const all = [...values, ...forecast];
  const allYears = [...years, ...fYears];
  const bars = allYears.slice(1).map((y, i) => ({
    x: y,
    value: all[i + 1]! - all[i]!,
    isHighlighted: y > lastYear,
  }));

  const monthlySeries: LineSeries[] = hasMonthly
    ? [{ id: 'monthly', label: ENERGY.legend.forecast, points: toMonthlyPoints(monthly, firstYear), tone: 'accent' }]
    : [];
  if (hasMonthly && isTrendCompared && altMonthly) {
    monthlySeries.push({
      id: 'alt',
      label: ENERGY.legend.alt,
      points: toMonthlyPoints(altMonthly, firstYear),
      tone: 'neutral',
      isDotted: true,
    });
  }

  return (
    <div className={s.layout}>
      {/* ── Chart ── */}
      <div className={s.chartCard}>
        <div className={s.chartTabs}>
          {CHART_TABS.map((t) => {
            if ((t.value === 'monthly' || t.value === 'quarterly') && !hasMonthly) return null;
            return (
              <button
                key={t.value}
                type="button"
                className={`${s.chartTab} ${chartView === t.value ? s.chartTabActive : ''}`}
                onClick={() => setChartView(t.value)}
              >
                {t.label}
              </button>
            );
          })}

          <div className={s.checks}>
            {(chartView === 'level' || chartView === 'monthly') && (
              <label className={s.bandCheck}>
                <input
                  type="checkbox"
                  checked={isTrendCompared}
                  onChange={(e) => setIsTrendCompared(e.target.checked)}
                />
                {ENERGY.trend.compare}
              </label>
            )}
            {chartView === 'level' && (
              <label className={s.bandCheck}>
                <input type="checkbox" checked={isBandShown} onChange={(e) => setIsBandShown(e.target.checked)} />
                {ENERGY.scenario.band}
              </label>
            )}
          </div>
        </div>

        <ErrorBoundary FallbackComponent={ErrorFallback}>
          {chartView === 'level' && (
            <LevelChart
              forecast={forecast}
              altForecast={altForecast}
              years={fYears}
              low={low}
              high={high}
              lastYear={lastYear}
              lastValue={lastValue}
              isBandShown={isBandShown}
              isTrendCompared={isTrendCompared}
            />
          )}

          {chartView === 'inc' && (
            <>
              <BarChart
                label="Mức tăng nhu cầu mỗi năm, tỷ kWh"
                bars={bars}
                xTicks={yearTicks(years[0]!, endYear)}
                note={{ x: 2021, text: 'COVID-19' }}
              />
              <p className={s.caption}>
                Theo kịch bản đang chọn, {firstYear}–{endYear} cần thêm bình quân{' '}
                <strong>{formatNumber(avgAdded, 0)} tỷ kWh/năm</strong>.
              </p>
            </>
          )}

          {chartView === 'monthly' && hasMonthly && (
            <>
              <LineChart
                label={`Dự báo nhu cầu theo tháng ${firstYear}–${endYear}, tỷ kWh`}
                series={monthlySeries}
                xTicks={forecastTicks(fYears)}
                formatX={formatMonthX}
              />
              {monthlySeries.length > 1 && (
                <div className={chart.legend}>
                  <span className={chart.legendItem}><span className={chart.keyAccentLine} />{ENERGY.legend.forecast}</span>
                  <span className={chart.legendItem}><span className={chart.keyDot} />{ENERGY.legend.alt}</span>
                </div>
              )}
              <p className={s.caption}>{ENERGY.captions.monthly}</p>
            </>
          )}

          {chartView === 'quarterly' && hasMonthly && (
            <>
              <BarChart
                label={`Dự báo nhu cầu theo quý ${firstYear}–${endYear}, tỷ kWh`}
                bars={toQuarterlyPoints(monthly, firstYear).map(([x, value]) => ({ x, value, isHighlighted: false }))}
                xTicks={forecastTicks(fYears)}
                formatX={formatQuarterX}
              />
              <p className={s.caption}>{ENERGY.captions.quarterly}</p>
            </>
          )}
        </ErrorBoundary>
      </div>

      <InsightCards insights={insights} />

      <ForecastTable years={fYears} forecast={forecast} low={low} base={base} high={high} rates={{ iip: Number(rates.iip), fdi: Number(rates.fdi) }} />
    </div>
  );
}
