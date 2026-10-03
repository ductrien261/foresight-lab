import ui from '@/components/ui.module.css';
import { ENERGY } from '@/content/vi';
import { formatNumber, formatPercent, formatSigned } from '@/utils/format';
import { SUPPLY_2030_BKWH } from '@/utils/plans';

import s from './StatCards.module.css';

interface StatCardsProps {
  end: number;
  endYear: number;
  /** Demand in the plan year (2030), for the comparison with Quy hoạch 893. */
  planDemand: number;
  lastValue: number;
  lastYear: number;
  firstYear: number;
  growth: number;
  pastGrowth: number;
  degnaMape: number | undefined;
}

export function StatCards({
  end,
  endYear,
  planDemand,
  lastValue,
  lastYear,
  firstYear,
  growth,
  pastGrowth,
  degnaMape,
}: StatCardsProps) {
  const gap2030 = planDemand - SUPPLY_2030_BKWH;
  const isOver = gap2030 > 0;

  return (
    <div className={s.row}>
      <div className={ui.card}>
        <p className={s.label}>Nhu cầu dự báo {endYear}</p>
        <p className={s.value}>
          {formatNumber(end, 2)}
          <span className={s.unit}>tỷ kWh</span>
        </p>
        <p className={s.sub}>
          Tăng <strong>{formatPercent(growth)}/năm</strong> so với {lastYear}
        </p>
      </div>

      <div className={ui.card}>
        <p className={s.label}>Tăng so với {lastYear}</p>
        <p className={s.value}>
          +{formatNumber(end - lastValue, 0)}
          <span className={s.unit}>tỷ kWh</span>
        </p>
        <p className={s.sub}>
          Giai đoạn {firstYear}–{lastYear}: {formatPercent(pastGrowth)}/năm
        </p>
      </div>

      <div className={ui.card}>
        <p className={s.label}>So với Quy hoạch 893 · 2030</p>
        <p className={`${s.value} ${isOver ? s.bad : s.good}`}>
          {formatSigned(gap2030, 0)}
          <span className={s.unit}>tỷ kWh</span>
        </p>
        <p className={s.sub}>Mốc cung: {formatNumber(SUPPLY_2030_BKWH, 0)} tỷ kWh</p>
      </div>

      <div className={ui.card}>
        <p className={s.label}>Độ chính xác DeGNA</p>
        <p className={`${s.value} ${s.good}`}>
          {degnaMape !== undefined ? formatNumber(degnaMape, 2) : '—'}
          <span className={s.unit}>% MAPE</span>
        </p>
        <p className={s.sub}>{ENERGY.accuracySub}</p>
      </div>
    </div>
  );
}
