import ui from '@/components/ui.module.css';
import { TOOL } from '@/content/vi';

import type { Progress } from '../hooks/useForecastWorker';
import s from '../ToolPage.module.css';

const ORDER = ['stl', 'gm', 'anfis', 'gwo', 'long'];

export function TrainingStep({ progress }: { progress: Progress | null }) {
  const stage = progress?.stage ?? 'start';
  const at = ORDER.indexOf(stage);
  const pct = stage === 'gwo' ? Math.round((progress?.frac ?? 0) * 100) : null;
  return (
    <section className={ui.card} aria-live="polite" aria-label="Tiến độ huấn luyện">
      <h2 className={ui.cardTitle}>Đang huấn luyện DeGNA trên máy bạn</h2>
      <p className={ui.cardLead}>Thường mất dưới 1 phút. Đừng đóng tab trong lúc chạy.</p>
      <ol className={s.stages}>
        {ORDER.map((key, i) => (
          <li key={key} className={i < at ? s.stageDone : i === at ? s.stageNow : s.stage}>
            {TOOL.stages[key]}
            {key === 'gwo' && i === at && pct !== null && ` · ${pct}%`}
          </li>
        ))}
      </ol>
      {pct !== null && (
        <div
          className={s.bar}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="Tối ưu ANFIS"
        >
          <span style={{ width: `${pct}%` }} />
        </div>
      )}
    </section>
  );
}
