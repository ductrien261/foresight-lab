import ui from '@/components/ui.module.css';
import { TOOL } from '@/content/vi';
import { formatNumber } from '@/utils/format';
import type { CheckResult, Level } from '@/workers/protocol';

import s from '../ToolPage.module.css';

const T = TOOL.check;
const LEVEL: Record<Level, { text: string; cls: string }> = {
  ok: { text: 'Ổn', cls: s.ok ?? '' },
  warn: { text: 'Lưu ý', cls: s.warn ?? '' },
  block: { text: 'Cần sửa', cls: s.block ?? '' },
};

interface CheckStepProps {
  result: CheckResult;
  selected: number[];
  isBusy: boolean;
  onToggle: (index: number, isOn: boolean) => void;
  onTrain: () => void;
  onBack: () => void;
}

export function CheckStep({ result, selected, isBusy, onToggle, onTrain, onBack }: CheckStepProps) {
  return (
    <div className={s.stack}>
      <section className={ui.card} aria-label={T.title}>
        <h2 className={ui.cardTitle}>{T.title}</h2>
        <ul className={s.report}>
          {result.items.map((item, i) => (
            <li key={`${item.code}-${i}`} className={s.reportItem}>
              <span className={`${s.level} ${LEVEL[item.level].cls}`}>{LEVEL[item.level].text}</span>
              <span>
                {item.title}
                {item.detail && <span className={s.detail}> · {item.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {result.drivers.length > 0 && (
        <section className={ui.card} aria-label={T.drivers}>
          <h2 className={ui.cardTitle}>{T.drivers}</h2>
          <p className={ui.cardLead}>{T.driversLead}</p>
          <ul className={s.report}>
            {result.drivers.map((d) => (
              <li key={d.name} className={s.reportItem}>
                <label className={s.checkRow}>
                  <input
                    type="checkbox"
                    checked={selected.includes(d.index)}
                    onChange={(e) => onToggle(d.index, e.target.checked)}
                  />
                  <strong>{d.name}</strong>
                </label>
                <span className={s.detail}>
                  R = {formatNumber(d.r, 2)} · {d.reason}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.blocked && <p className={s.error}>{T.blocked}</p>}
      <div className={ui.actions}>
        <button type="button" className={`${ui.btn} ${ui.secondary}`} onClick={onBack}>
          Quay lại
        </button>
        <button
          type="button"
          className={`${ui.btn} ${ui.toolBtn}`}
          disabled={result.blocked || isBusy}
          onClick={onTrain}
        >
          {T.train}
        </button>
      </div>
    </div>
  );
}
