import { Link } from 'react-router';

import { ENERGY } from '@/content/vi';
import type { Insight } from '@/utils/insights';

import s from './InsightCards.module.css';

export function InsightCards({ insights }: { insights: Insight[] }) {
  return (
    <section className={s.grid} aria-label={ENERGY.insightsLabel}>
      {insights.map((c) => (
        <article key={c.id} className={s.card}>
          <p className={s.tag}>{c.tag}</p>
          <p className={s.big}>
            {c.big}
            <span className={s.unit}>{c.unit}</span>
          </p>
          <p className={s.text}>{c.text}</p>
          {c.link && (
            <Link to={c.link.to} className={s.link}>
              {c.link.label} →
            </Link>
          )}
        </article>
      ))}
    </section>
  );
}
