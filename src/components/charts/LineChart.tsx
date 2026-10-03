import { useId, useState } from 'react';

import { formatNumber } from '@/utils/format';

import s from './charts.module.css';
import { extent, FRAME, linear, niceTicks } from './scale';

export type Tone = 'ink' | 'accent' | 'muted' | 'neutral' | 'tool';
export type Point = [number, number];

export interface LineSeries {
  id: string;
  label: string;
  points: Point[];
  tone: Tone;
  isDashed?: boolean;
  /** Thin dotted stroke, for reference lines. */
  isDotted?: boolean;
  hasDots?: boolean;
}

export interface Marker {
  x: number;
  y?: number;
  label: string;
}

interface LineChartProps {
  label: string;
  series: LineSeries[];
  band?: { lower: Point[]; upper: Point[] };
  divider?: Marker;
  target?: Marker;
  formatX?: (x: number) => string;
  xTicks?: number[];
}

export function LineChart({
  label,
  series,
  band,
  divider,
  target,
  formatX = String,
  xTicks,
}: LineChartProps) {
  const clipId = useId();
  const [hoverX, setHoverX] = useState<number | null>(null);
  const xs = series.flatMap((ser) => ser.points.map((p) => p[0]));
  const ys = [
    ...series.flatMap((ser) => ser.points.map((p) => p[1])),
    ...(band ? [...band.lower, ...band.upper].map((p) => p[1]) : []),
    ...(target?.y !== undefined ? [target.y] : []),
  ];
  const { width, height, left, right, top, bottom } = FRAME;
  const [fullX0, fullX1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = extent(ys);

  // ── Zoom / pan state ──────────────────────────────────────────────────────
  const [viewX, setViewX] = useState<[number, number] | null>(null);
  const [dragStart, setDragStart] = useState<{
    svgX: number;
    domainX0: number;
    domainX1: number;
  } | null>(null);

  const x0 = viewX?.[0] ?? fullX0;
  const x1 = viewX?.[1] ?? fullX1;
  const isZoomed = viewX !== null;

  const X = linear([x0, x1], [left, width - right]);
  const Y = linear([y0, y1], [height - bottom, top]);
  const path = (pts: Point[]) =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join(' ');
  const uniqueX = [...new Set(xs)].sort((a, b) => a - b);
  const ticks = xTicks ?? niceTicks(x0, x1, 5).filter((t) => Number.isInteger(t));

  /** Convert a clientX pixel inside the SVG element to SVG-coordinate space. */
  function svgXFromEvent(e: React.MouseEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    return ((e.clientX - box.left) / box.width) * width;
  }

  /** Zoom in (factor < 1) or out (factor > 1) around the centre of current view. */
  function zoomBy(factor: number) {
    const mid = (x0 + x1) / 2;
    const span = (x1 - x0) * factor;
    let newX0 = mid - span / 2;
    let newX1 = mid + span / 2;
    if (newX0 < fullX0) { newX1 += fullX0 - newX0; newX0 = fullX0; }
    if (newX1 > fullX1) { newX0 -= newX1 - fullX1; newX1 = fullX1; }
    newX0 = Math.max(fullX0, newX0);
    newX1 = Math.min(fullX1, newX1);
    if (newX1 - newX0 < 0.5) return; // max zoom guard
    setViewX([newX0, newX1]);
  }

  function handleMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    setDragStart({ svgX: svgXFromEvent(e), domainX0: x0, domainX1: x1 });
    setHoverX(null);
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (dragStart) {
      const dx = svgXFromEvent(e) - dragStart.svgX;
      const dataDx = (dx / (width - left - right)) * (dragStart.domainX1 - dragStart.domainX0);
      let newX0 = dragStart.domainX0 - dataDx;
      let newX1 = dragStart.domainX1 - dataDx;
      if (newX0 < fullX0) { newX1 += fullX0 - newX0; newX0 = fullX0; }
      if (newX1 > fullX1) { newX0 -= newX1 - fullX1; newX1 = fullX1; }
      setViewX([Math.max(fullX0, newX0), Math.min(fullX1, newX1)]);
      return;
    }
    const px = svgXFromEvent(e);
    const nearest = uniqueX.reduce(
      (best, x) => (Math.abs(X(x) - px) < Math.abs(X(best) - px) ? x : best),
      uniqueX[0]!,
    );
    setHoverX(nearest);
  }

  function handleMouseUp() {
    setDragStart(null);
  }

  function handleDoubleClick() {
    setViewX(null);
  }

  const rows =
    hoverX === null
      ? []
      : series.flatMap((ser) => {
          const p = ser.points.find((pt) => pt[0] === hoverX);
          return p ? [{ id: ser.id, label: ser.label, tone: ser.tone, value: p[1] }] : [];
        });

  return (
    <div className={s.wrap}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
        className={`${s.svg} ${dragStart ? s.svgGrabbing : isZoomed ? s.svgGrab : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setHoverX(null); setDragStart(null); }}
        onDoubleClick={handleDoubleClick}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={left} y={top} width={width - left - right} height={height - top - bottom} />
          </clipPath>
        </defs>
        {niceTicks(y0, y1).map((t) => (
          <g key={t}>
            <line x1={left} x2={width - right} y1={Y(t)} y2={Y(t)} className={s.grid} />
            <text x={left - 8} y={Y(t) + 4} textAnchor="end" className={s.tick}>
              {formatNumber(t, 0)}
            </text>
          </g>
        ))}
        {ticks.map((t) => (
          <text key={t} x={X(t)} y={height - 14} textAnchor="middle" className={s.tick}>
            {formatX(t)}
          </text>
        ))}
        {band && <path d={`${path([...band.lower, ...[...band.upper].reverse()])} Z`} className={s.band} />}
        {divider && (
          <g>
            <line x1={X(divider.x)} x2={X(divider.x)} y1={top} y2={height - bottom} className={s.divider} />
            <text x={X(divider.x) + 6} y={top + 12} className={s.tick}>
              {divider.label}
            </text>
          </g>
        )}
        {target?.y !== undefined && (
          <g>
            <line
              x1={X(target.x) - 46}
              x2={X(target.x) + 6}
              y1={Y(target.y)}
              y2={Y(target.y)}
              className={s.target}
            />
            <text x={X(target.x) - 52} y={Y(target.y) + 4} textAnchor="end" className={s.targetLabel}>
              {target.label}
            </text>
          </g>
        )}
        <g clipPath={`url(#${clipId})`}>
          {series.map((ser) => (
            <path
              key={ser.id}
              d={path(ser.points)}
              className={`${s.line} ${s[ser.tone]} ${ser.isDashed ? s.dashed : ''} ${ser.isDotted ? s.dotted : ''}`}
            />
          ))}
        </g>
        {series
          .filter((ser) => ser.hasDots)
          .flatMap((ser) =>
            ser.points.map((p) => (
              <circle
                key={`${ser.id}-${p[0]}`}
                cx={X(p[0])}
                cy={Y(p[1])}
                r={2.6}
                className={s[`${ser.tone}Fill`]}
              />
            )),
          )}
        {hoverX !== null && !dragStart && (
          <line x1={X(hoverX)} x2={X(hoverX)} y1={top} y2={height - bottom} className={s.hover} />
        )}
      </svg>
      <div className={s.zoomBar}>
        <button className={s.zoomBtn} onClick={() => zoomBy(0.7)} aria-label="Phóng to">＋</button>
        <button className={s.zoomBtn} onClick={() => zoomBy(1.4)} aria-label="Thu nhỏ" disabled={!isZoomed}>−</button>
        {isZoomed && (
          <button className={`${s.zoomBtn} ${s.zoomReset}`} onClick={() => setViewX(null)} aria-label="Đặt lại zoom">
            ↺
          </button>
        )}
      </div>
      {hoverX !== null && !dragStart && rows.length > 0 && (
        <div className={s.tooltip} style={{ left: `${(X(hoverX) / width) * 100}%` }} role="status">
          <strong>{formatX(hoverX)}</strong>
          {rows.map((r) => (
            <span key={r.id} className={s.tipRow}>
              <span className={`${s.swatch} ${s[`${r.tone}Fill`]}`} />
              {r.label}: <b>{formatNumber(r.value, 2)}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
