import { useId, useState } from 'react';

import ui from '@/components/ui.module.css';
import { TOOL } from '@/content/vi';
import type { ParsedSeries } from '@/utils/excel';
import type { CheckPayload } from '@/workers/protocol';

import s from '../ToolPage.module.css';

const T = TOOL.map;
const FREQ = { annual: 'năm', quarterly: 'quý', monthly: 'tháng' } as const;
type How = CheckPayload['how'];

const label = (x: ParsedSeries) =>
  `${x.column} (${x.sheet}, theo ${FREQ[x.freq]}, ${x.periods[0]}–${x.periods[x.periods.length - 1]})`;
const toCol = (x: ParsedSeries) => ({ name: x.column, periods: x.periods, values: x.values });

interface MappingStepProps {
  series: ParsedSeries[];
  isBusy: boolean;
  onSubmit: (payload: CheckPayload) => void;
}

export function MappingStep({ series, isBusy, onSubmit }: MappingStepProps) {
  const ids = { target: useId(), indicator: useId(), how: useId() };
  const monthly = series.filter((x) => x.freq === 'monthly');
  const [targetId, setTargetId] = useState(
    () => (series.find((x) => x.freq !== 'monthly') ?? series[0])?.id ?? '',
  );
  const target = series.find((x) => x.id === targetId);
  const needsIndicator = target !== undefined && target.freq !== 'monthly';
  const [indicatorId, setIndicatorId] = useState(() => monthly[0]?.id ?? '');
  const [how, setHow] = useState<How>('sum');
  const [exogIds, setExogIds] = useState<string[]>(() => monthly.slice(1).map((x) => x.id));
  const indicator = needsIndicator ? monthly.find((x) => x.id === indicatorId) : undefined;
  const exogChoices = monthly.filter((x) => x.id !== targetId && x.id !== indicator?.id);
  const canSubmit = target !== undefined && (!needsIndicator || indicator !== undefined) && !isBusy;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!target) return;
    onSubmit({
      frequency: target.freq,
      how,
      target: toCol(target),
      indicator: indicator ? toCol(indicator) : null,
      exog: exogChoices.filter((x) => exogIds.includes(x.id)).map(toCol),
    });
  }

  return (
    <form className={`${ui.card} ${s.form}`} onSubmit={handleSubmit}>
      <h2 className={ui.cardTitle}>{T.title}</h2>
      <div className={s.field}>
        <label htmlFor={ids.target}>{T.target}</label>
        <select
          id={ids.target}
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className={s.select}
        >
          {series.map((x) => (
            <option key={x.id} value={x.id}>
              {label(x)}
            </option>
          ))}
        </select>
      </div>

      {needsIndicator && (
        <>
          <div className={s.field}>
            <label htmlFor={ids.indicator}>{T.indicator}</label>
            <p className={s.hint}>{T.indicatorHint}</p>
            <select
              id={ids.indicator}
              value={indicatorId}
              onChange={(e) => setIndicatorId(e.target.value)}
              className={s.select}
            >
              {monthly.length === 0 && <option value="">Không có chuỗi tháng nào trong file</option>}
              {monthly.map((x) => (
                <option key={x.id} value={x.id}>
                  {label(x)}
                </option>
              ))}
            </select>
          </div>
          <div className={s.field}>
            <label htmlFor={ids.how}>{T.how}</label>
            <select
              id={ids.how}
              value={how}
              onChange={(e) => setHow(e.target.value as How)}
              className={s.select}
            >
              {(Object.keys(T.howOptions) as How[]).map((k) => (
                <option key={k} value={k}>
                  {T.howOptions[k]}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {exogChoices.length > 0 && (
        <fieldset className={s.fieldset}>
          <legend>{T.exog}</legend>
          <p className={s.hint}>{T.exogHint}</p>
          {exogChoices.map((x) => (
            <label key={x.id} className={s.checkRow}>
              <input
                type="checkbox"
                checked={exogIds.includes(x.id)}
                onChange={(e) =>
                  setExogIds((prev) =>
                    e.target.checked ? [...prev, x.id] : prev.filter((id) => id !== x.id),
                  )
                }
              />
              {label(x)}
            </label>
          ))}
        </fieldset>
      )}

      <div className={ui.actions}>
        <button type="submit" className={`${ui.btn} ${ui.toolBtn}`} disabled={!canSubmit}>
          {isBusy ? 'Đang kiểm tra…' : T.next}
        </button>
      </div>
    </form>
  );
}
