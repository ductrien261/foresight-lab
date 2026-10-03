import { useMemo, useState } from 'react';

import chart from '@/components/charts/charts.module.css';
import { LineChart, type LineSeries, type Point } from '@/components/charts/LineChart';
import ui from '@/components/ui.module.css';
import { TOOL } from '@/content/vi';
import { scenarioDrivers } from '@/engine/denton';
import { forecastMonthly } from '@/engine/forecast';
import { downloadExcel } from '@/utils/download';
import { describeLongTrend } from '@/utils/longTrend';
import type { TrainResult } from '@/workers/protocol';

import s from '../ToolPage.module.css';
import { DriverSliders } from './DriverSliders';

const T = TOOL.result;
const HORIZONS = [3, 6, 12, 24, 36, 72];
const LONG_HORIZON = 24;

function monthsAfter(last: string, count: number): string[] {
  const [y, m] = last.split('-').map(Number) as [number, number];
  return Array.from({ length: count }, (_, i) => {
    const k = y * 12 + (m - 1) + i + 1;
    return `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, '0')}`;
  });
}

export function ToolForecast({ result, fileName }: { result: TrainResult; fileName: string }) {
  const [rates, setRates] = useState(result.baseRates);
  const [horizon, setHorizon] = useState(12);
  const [refPct, setRefPct] = useState(String(Math.round(result.model.trends.gm11.refGrowth * 1000) / 10));
  const hasRegression = result.model.trends.regression !== null;
  const driver = result.longTrend.driver;
  const parsedRef = Number(refPct.replace(',', '.'));
  const refGrowth = Number.isFinite(parsedRef) ? parsedRef / 100 : result.model.trends.gm11.refGrowth;

  const { gm, regression } = useMemo(() => {
    // Drivers are built per whole year, then cut to the horizon in months.
    const drivers = scenarioDrivers(result.lastYearExog, rates, Math.ceil(horizon / 12)).slice(0, horizon);
    return {
      gm: forecastMonthly(result.model, drivers, 'gm11', { growth: rates[0], refGrowth }),
      regression: hasRegression ? forecastMonthly(result.model, drivers, 'regression') : null,
    };
  }, [result, rates, horizon, hasRegression, refGrowth]);

  const recent = result.actual.slice(-36);
  const futureMonths = monthsAfter(result.lastMonth, horizon);
  const labels = [...result.months.slice(-36), ...futureMonths];
  const bridge = (values: number[]): Point[] => [
    [recent.length - 1, recent[recent.length - 1]!],
    ...values.map((v, i): Point => [recent.length + i, v]),
  ];
  const series: LineSeries[] = [
    { id: 'h', label: 'Thực tế', points: recent.map((v, i) => [i, v]), tone: 'ink' },
    { id: 'gm', label: T.gm, points: bridge(gm), tone: 'accent', isDashed: true },
  ];
  if (regression) {
    series.push({ id: 'reg', label: T.regression, points: bridge(regression), tone: 'tool', isDotted: true });
  }
  const tickStep = labels.length > 48 ? 12 : 6;

  async function handleExcel() {
    try {
      await downloadExcel(
        [
          ['Tháng', T.gm, ...(regression ? [T.regression] : [])],
          ...futureMonths.map((m, i) => [m, gm[i]!, ...(regression ? [regression[i]!] : [])]),
          [],
          [T.caption],
        ],
        `foresight-lab-${fileName.replace(/\.\w+$/, '')}-du-bao.xlsx`,
      );
    } catch (error) {
      console.error('Excel export failed', error);
    }
  }

  return (
    <section className={ui.card} aria-label={T.forecast}>
      <h2 className={ui.cardTitle}>{T.forecast}</h2>
      <div className={s.forecastGrid}>
        <div>
          <LineChart
            label="Dự báo tương lai theo tốc độ tăng của các biến"
            series={series}
            divider={{ x: recent.length - 1, label: 'Dự báo →' }}
            formatX={(i) => labels[i] ?? ''}
            xTicks={labels.map((_, i) => i).filter((i) => i % tickStep === 0)}
          />
          <div className={chart.legend}>
            <span className={chart.legendItem}><span className={chart.keyLine} />Thực tế</span>
            <span className={chart.legendItem}><span className={chart.keyDash} />{T.gm}</span>
            {regression && <span className={chart.legendItem}><span className={chart.keyDotTool} />{T.regression}</span>}
          </div>
          <p className={ui.note}>{hasRegression ? T.caption : T.noRegression}</p>
          <p className={ui.note}>{describeLongTrend(result.longTrend)}</p>
        </div>
        <div className={s.controls}>
          <label className={s.field}>
            {T.horizon}
            <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} className={s.select}>
              {HORIZONS.map((n) => (
                <option key={n} value={n}>
                  {T.horizonOption(n)}
                </option>
              ))}
            </select>
          </label>
          {horizon >= LONG_HORIZON && (
            <div role="note" className={ui.warnBox}>
              {T.longHorizon}
            </div>
          )}
          <DriverSliders
            names={result.exogNames}
            driver={driver}
            rates={rates}
            onChange={(j, v) => setRates((prev) => prev.map((r, k) => (k === j ? v : r)))}
          />
          {driver && result.model.trends.gm11.beta !== 0 && (
            <label className={s.field}>
              {T.refLabel(driver)}
              <input
                inputMode="decimal"
                className={s.select}
                value={refPct}
                onChange={(e) => setRefPct(e.target.value.slice(0, 6))}
                aria-describedby="ref-note"
              />
              <span id="ref-note" className={ui.note}>
                {T.refNote}
              </span>
            </label>
          )}
          <button type="button" className={`${ui.btn} ${ui.ghost}`} onClick={() => void handleExcel()}>
            {T.exportForecast}
          </button>
        </div>
      </div>
    </section>
  );
}
