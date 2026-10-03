import { LONG_TREND } from '@/content/vi';
import type { LongTrendInfo } from '@/typings/model';

import { formatNumber } from './format';

/** One or two sentences describing how the long-term GM(1,1) trend was set up. */
export function describeLongTrend(info: LongTrendInfo | null): string {
  if (!info) return '';
  const chosen = info.mape.find((m) => m.window === info.window);
  const parts = [
    chosen && info.origins.length
      ? LONG_TREND.window(
          String(info.window),
          info.origins.length,
          info.origins[0]!,
          info.origins[info.origins.length - 1]!,
          formatNumber(chosen.mape, 2),
        )
      : LONG_TREND.noBacktest,
  ];
  if (info.driver && info.elasticity) {
    const { beta, r } = info.elasticity;
    parts.push(LONG_TREND.elasticity(info.driver, formatNumber(beta, 3), formatNumber(r, 2)));
    if (Math.abs(beta) < 0.1) parts.push(LONG_TREND.weak);
  }
  return parts.join(' ');
}
