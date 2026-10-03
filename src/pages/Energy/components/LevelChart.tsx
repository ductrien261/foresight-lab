import chart from '@/components/charts/charts.module.css';
import { LineChart, type LineSeries, type Point } from '@/components/charts/LineChart';
import { ENERGY } from '@/content/vi';
import { formatNumber } from '@/utils/format';
import { describeLongTrend } from '@/utils/longTrend';
import { SUPPLY_2030_BKWH } from '@/utils/plans';

import { DATA, PLAN_YEAR } from '../hooks/useScenario';
import { yearTicks } from './forecastPoints';
import s from './ForecastTab.module.css';

interface LevelChartProps {
  /** Main forecast (recursive GM(1,1) trend). */
  forecast: number[];
  /** Comparison forecast (regression trend). */
  altForecast: number[];
  /** Forecast years shown, and the Low / High presets over them for the band. */
  years: number[];
  low: number[];
  high: number[];
  lastYear: number;
  lastValue: number;
  isBandShown: boolean;
  isTrendCompared: boolean;
}

/** Annual demand: history, main forecast, Low – High band and the regression comparison line. */
export function LevelChart({
  forecast,
  altForecast,
  years: fYears,
  low,
  high,
  lastYear,
  lastValue,
  isBandShown,
  isTrendCompared,
}: LevelChartProps) {
  const { years, values } = DATA.annual;
  const endYear = fYears[fYears.length - 1]!;
  const history: Point[] = years.map((y, i) => [y, values[i]!]);
  const bridge = (series: number[]): Point[] => [
    [lastYear, lastValue],
    ...fYears.map((y, i): Point => [y, series[i]!]),
  ];

  const series: LineSeries[] = [
    { id: 'actual', label: ENERGY.legend.actual, points: history, tone: 'ink', hasDots: true },
    { id: 'forecast', label: ENERGY.legend.forecast, points: bridge(forecast), tone: 'accent', isDashed: true },
  ];
  if (isTrendCompared) {
    series.push({ id: 'alt', label: ENERGY.legend.alt, points: bridge(altForecast), tone: 'neutral', isDotted: true });
  }

  return (
    <>
      <LineChart
        label={`Nhu cầu năng lượng ${years[0]}–${endYear}`}
        series={series}
        band={
          isBandShown
            ? { lower: bridge(low), upper: bridge(high) }
            : undefined
        }
        divider={{ x: lastYear, label: 'Dự báo →' }}
        target={
          endYear >= PLAN_YEAR
            ? { x: PLAN_YEAR, y: SUPPLY_2030_BKWH, label: `Cung QH ${PLAN_YEAR} ≈ ${formatNumber(SUPPLY_2030_BKWH, 0)}` }
            : undefined
        }
        xTicks={yearTicks(years[0]!, endYear)}
      />
      <div className={chart.legend}>
        <span className={chart.legendItem}><span className={chart.keyLine} />{ENERGY.legend.actual}</span>
        <span className={chart.legendItem}><span className={chart.keyDash} />{ENERGY.legend.forecast}</span>
        {isTrendCompared && (
          <span className={chart.legendItem}><span className={chart.keyDot} />{ENERGY.legend.alt}</span>
        )}
        {isBandShown && <span className={chart.legendItem}><span className={chart.keyBand} />{ENERGY.legend.band}</span>}
        {endYear >= PLAN_YEAR && (
          <span className={chart.legendItem}><span className={chart.keyTarget} />{ENERGY.legend.target}</span>
        )}
      </div>
    
    </>
  );
}
