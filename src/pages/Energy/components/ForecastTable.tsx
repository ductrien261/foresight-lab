import ui from '@/components/ui.module.css';
import { ENERGY } from '@/content/vi';
import { downloadExcel } from '@/utils/download';
import { formatNumber, formatPercent } from '@/utils/format';

import { DATA } from '../hooks/useScenario';
import s from './ForecastTable.module.css';

interface ForecastTableProps {
  years: number[];
  forecast: number[];
  low: number[];
  base: number[];
  high: number[];
  rates: { iip: number; fdi: number };
}

const T = ENERGY.table;

export function ForecastTable({ years, forecast, low, base, high, rates }: ForecastTableProps) {
  const lastValue = DATA.annual.values[DATA.annual.values.length - 1]!;
  const yours = `${T.yours} (IIP ${formatPercent(rates.iip)}, FDI ${formatPercent(rates.fdi)})`;
  const rows = years.map((year, i) => ({
    year,
    yours: forecast[i]!,
    low: low[i]!,
    base: base[i]!,
    high: high[i]!,
    added: forecast[i]! - (i ? forecast[i - 1]! : lastValue),
  }));

  async function handleDownload() {
    try {
      await downloadExcel(
        [
          ['Năm', yours, 'Thấp', 'Cơ sở', 'Cao', 'Tăng thêm'],
          ...rows.map((r) => [r.year, r.yours, r.low, r.base, r.high, r.added]),
          [],
          ['Đơn vị: tỷ kWh. Nguồn: Foresight Lab, mô hình DeGNA (CMES, 2026).'],
        ],
        'foresight-lab-du-bao.xlsx',
      );
    } catch (error) {
      console.error('Excel export failed', error);
    }
  }

  return (
    <section className={ui.card} aria-label={T.title}>
      <div className={s.head}>
        <h2 className={ui.cardTitle}>{T.title}</h2>
        <button type="button" className={`${ui.btn} ${ui.ghost}`} onClick={() => void handleDownload()}>
          {T.download}
        </button>
      </div>
      <div className={ui.tableWrap}>
        <table className={ui.table}>
          <thead>
            <tr>
              <th scope="col">Năm</th>
              <th scope="col" className={s.yours}>
                {yours}
              </th>
              <th scope="col">Thấp</th>
              <th scope="col">Cơ sở</th>
              <th scope="col">Cao</th>
              <th scope="col">{T.inc}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.year}>
                <th scope="row">{r.year}</th>
                <td className={ui.hl}>{formatNumber(r.yours, 2)}</td>
                <td>{formatNumber(r.low, 2)}</td>
                <td>{formatNumber(r.base, 2)}</td>
                <td>{formatNumber(r.high, 2)}</td>
                <td>+{formatNumber(r.added, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
