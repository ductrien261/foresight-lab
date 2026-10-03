import { useState } from 'react';

import { formatNumber } from '@/utils/format';

import s from './charts.module.css';
import { FRAME, linear, niceTicks } from './scale';

export interface Bar {
  x: number;
  value: number;
  isHighlighted?: boolean;
}

interface BarChartProps {
  label: string;
  bars: Bar[];
  xTicks: number[];
  note?: { x: number; text: string };
  formatX?: (x: number) => string;
}

/** Vertical bars around zero, one per x (e.g. a year). */
export function BarChart({ label, bars, xTicks, note, formatX = String }: BarChartProps) {
  const [hover, setHover] = useState<Bar | null>(null);
  const { width, height, left, right, top, bottom } = FRAME;
  const values = bars.map((b) => b.value);
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const pad = (hi - lo) * 0.08;
  const Y = linear([lo - pad, hi + pad], [height - bottom, top]);
  const xs = bars.map((b) => b.x);
  const [x0, x1] = [Math.min(...xs) - 0.5, Math.max(...xs) + 0.5];
  const X = linear([x0, x1], [left, width - right]);
  const bw = ((width - left - right) / (x1 - x0)) * 0.62;

  return (
    <div className={s.wrap}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
        className={s.svg}
        onMouseLeave={() => setHover(null)}
      >
        {niceTicks(lo, hi, 4).map((t) => (
          <g key={t}>
            <line x1={left} x2={width - right} y1={Y(t)} y2={Y(t)} className={t === 0 ? s.zero : s.grid} />
            <text x={left - 8} y={Y(t) + 4} textAnchor="end" className={s.tick}>
              {formatNumber(t, 0)}
            </text>
          </g>
        ))}
        {bars.map((b) => (
          <rect
            key={b.x}
            x={X(b.x) - bw / 2}
            y={Math.min(Y(b.value), Y(0))}
            width={bw}
            height={Math.max(1, Math.abs(Y(b.value) - Y(0)))}
            rx={2}
            className={b.isHighlighted ? s.accentFill : s.mutedFill}
            onMouseEnter={() => setHover(b)}
          />
        ))}
        {xTicks.map((t) => (
          <text key={t} x={X(t)} y={height - 14} textAnchor="middle" className={s.tick}>
            {t}
          </text>
        ))}
        {note && (
          <text x={X(note.x)} y={Y(0) + 18} textAnchor="middle" className={s.barLabel}>
            {note.text}
          </text>
        )}
      </svg>
      {hover && (
        <div className={s.tooltip} style={{ left: `${(X(hover.x) / width) * 100}%` }} role="status">
          <strong>{formatX(hover.x)}</strong>
          <span>
            {hover.value >= 0 ? '+' : ''}
            {formatNumber(hover.value, 1)} tỷ kWh
          </span>
        </div>
      )}
    </div>
  );
}
