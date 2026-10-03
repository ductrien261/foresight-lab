import ui from '@/components/ui.module.css';
import { ENERGY } from '@/content/vi';
import { formatNumber, formatSigned } from '@/utils/format';

import type { Rates } from '../hooks/useScenario';
import { DATA, forecastYearsFor, runScenario } from '../hooks/useScenario';
import s from './ImpactTab.module.css';

const flat = (first: number, rest: number, years = 6) =>
  [first, ...new Array<number>(years - 1).fill(rest)];

interface ImpactTabProps {
  /** Current scenario rates — cases are computed relative to these. */
  rates: Rates;
  /** Years shown; impacts are measured at its last year and summed over it. */
  horizon: number;
}

export function ImpactTab({ rates, horizon }: ImpactTabProps) {
  // Always run the live model so cases are relative to the current scenario,
  // not hardwired to the pre-baked Cơ sở values.
  const ref = runScenario(rates, null, horizon);

  if (!ref) {
    return (
      <div className={ui.card}>
        <h2 className={ui.cardTitle}>Cần tham số mô hình để chạy phân tích này</h2>
        <p className={ui.cardLead}>
          Chạy <code>python/scripts/train_vietnam.py</code> với{' '}
          <code>Data_Energy_Vietnam.xlsx</code> rồi build lại web.
        </p>
      </div>
    );
  }

  const iip = Number(rates.iip);
  const fdi = Number(rates.fdi);

  const cases: { id: string; title: string; story: string; rates: Rates }[] = [
    {
      id: 'iip+1',
      title: 'IIP tăng thêm 1 điểm %',
      story: `Công nghiệp tăng nhanh hơn kịch bản hiện tại 1 điểm % mỗi năm.`,
      rates: { iip: iip + 0.01, fdi },
    },
    {
      id: 'fdi+1',
      title: 'FDI tăng thêm 1 điểm %',
      story: `Vốn FDI tăng nhanh hơn kịch bản hiện tại 1 điểm % mỗi năm.`,
      rates: { iip, fdi: fdi + 0.01 },
    },
    {
      id: 'fdi-shock',
      title: 'Cú sốc FDI',
      story: 'FDI giảm 20% năm 2025, sau đó phục hồi về mức kịch bản hiện tại.',
      rates: { iip, fdi: flat(-0.2, fdi) },
    },
    {
      id: 'iip-stall',
      title: 'Công nghiệp chững lại',
      story: 'IIP không tăng trong 2025–2026, sau đó trở lại kịch bản hiện tại.',
      rates: { iip: [0, 0, ...new Array<number>(4).fill(iip)], fdi },
    },
  ];

  const years = forecastYearsFor(horizon);
  const endIdx = horizon - 1;
  const endYear = years[endIdx]!;

  return (
    <>
      <div className={s.grid}>
        {cases.map((c) => {
          const out = runScenario(c.rates, null, horizon)!;
          const delta = out.annual[endIdx]! - ref.annual[endIdx]!;
          const total = out.annual.slice(0, horizon).reduce((sum, v, i) => sum + v - ref.annual[i]!, 0);
          return (
            <article key={c.id} className={ui.card}>
              <h2 className={ui.cardTitle}>{c.title}</h2>
              <p className={ui.cardLead}>{c.story}</p>
              <dl className={s.nums}>
                <dt>Nhu cầu {endYear}</dt>
                <dd>{formatSigned(delta, 1)}</dd>
                <dt>{horizon > 1 ? `Cộng dồn ${years[0]}–${endYear}` : `Cả năm ${endYear}`}</dt>
                <dd>{formatSigned(total, 0)}</dd>
                <dt>So với kịch bản hiện tại</dt>
                <dd>{formatSigned((delta / ref.annual[endIdx]!) * 100, 2)}%</dd>
              </dl>
            </article>
          );
        })}
      </div>
      <p className={s.fine}>
        Kịch bản tham chiếu: IIP {formatNumber(iip * 100, 1)}%, FDI {formatNumber(fdi * 100, 1)}%/năm.
        Mô hình phản ánh tác động qua IIP và FDI.
      </p>
      <p className={s.fine}>{ENERGY.impactFdiNote(formatNumber(DATA.model?.trends.gm11.beta ?? 0, 3))}</p>
    </>
  );
}
