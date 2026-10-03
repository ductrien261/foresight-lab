import { useState } from 'react';

import ui from '@/components/ui.module.css';
import { BALANCE, ENERGY } from '@/content/vi';
import type { ScenarioKey } from '@/typings/model';
import { formatNumber, formatSigned } from '@/utils/format';
import { PLANS, SUPPLY_2030_BKWH } from '@/utils/plans';

import { DATA, SCENARIO_KEYS } from '../hooks/useScenario';
import s from './BalanceTab.module.css';

interface BalanceTabProps {
  /** null when user is using custom slider values. */
  preset: ScenarioKey | null;
  /** Annual forecast for the custom scenario — only populated when preset is null. */
  customForecast: number[] | null;
}

export function BalanceTab({ preset, customForecast }: BalanceTabProps) {
  const [custom, setCustom] = useState('');
  const customValue = Number(custom.replace(/\./g, '').replace(',', '.'));
  const supply = custom && Number.isFinite(customValue) && customValue > 0 ? customValue : SUPPLY_2030_BKWH;

  const lastIdx = DATA.forecastYears.length - 1;

  const presetRows = SCENARIO_KEYS.map((key) => ({
    key,
    name: ENERGY.scenario.presets[key],
    demand: DATA.scenarios[key].annual[lastIdx]!,
    isActive: key === preset,
  }));

  // Extra row for custom slider scenario
  const customRow = customForecast !== null ? {
    key: 'custom' as const,
    name: ENERGY.scenario.custom ?? 'Kịch bản tùy chỉnh',
    demand: customForecast[lastIdx]!,
    isActive: true,
  } : null;

  const allRows = customRow ? [...presetRows, customRow] : presetRows;
  const rows = allRows.map((r) => ({ ...r, gap: r.demand - supply }));

  const maxVal = Math.max(supply, ...rows.map((r) => r.demand)) * 1.04;
  const minVal = Math.min(supply, ...rows.map((r) => r.demand)) * 0.8;
  const pct = (v: number) => `${((v - minVal) / (maxVal - minVal)) * 100}%`;

  return (
    <div className={s.layout}>
      <div>
        <div role="note" className={`${ui.warnBox} ${s.warn}`}>
          {BALANCE.warn}
        </div>

        <ul className={s.bars} aria-label="Nhu cầu 2030 so với mốc cung">
          {rows.map((r) => (
            <li key={r.key} className={`${s.barRow} ${r.isActive ? s.barRowActive : ''}`}>
              <span className={s.barName}>{r.name}</span>
              <span className={s.track}>
                <span className={s.fill} style={{ width: pct(Math.min(r.demand, supply)) }} />
                {r.gap > 0 && (
                  <span
                    className={s.over}
                    style={{ left: pct(supply), width: `calc(${pct(r.demand)} - ${pct(supply)})` }}
                  />
                )}
                <span className={s.supplyLine} style={{ left: pct(supply) }} />
              </span>
              <span className={r.gap > 0 ? s.gapOver : s.gap}>{formatSigned(r.gap, 1)}</span>
            </li>
          ))}
        </ul>

        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th scope="col">Kịch bản</th>
                <th scope="col">Nhu cầu 2030</th>
                <th scope="col">Mốc cung</th>
                <th scope="col">Chênh lệch</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className={r.isActive ? s.rowActive : undefined}>
                  <th scope="row">{r.name}</th>
                  <td>{formatNumber(r.demand, 2)}</td>
                  <td>{formatNumber(supply, 2)}</td>
                  <td className={ui.hl}>{formatSigned(r.gap, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={s.fine}>{BALANCE.conversion}</p>
      </div>

      <aside className={s.side}>
        <section className={ui.card}>
          <div className={s.docsHead}>
            <h3 className={ui.cardTitle}>{BALANCE.docs}</h3>
            <span className={s.checked}>Kiểm tra {PLANS.checked.split('-').reverse().join('/')}</span>
          </div>
          {PLANS.documents.map((doc) => (
            <article key={doc.id} className={s.doc}>
              <div className={s.docTop}>
                <a href={doc.url} target="_blank" rel="noreferrer" className={s.docCode}>
                  {doc.code}
                </a>
                <span className={doc.basis === 'primary' ? s.pillOn : s.pill}>
                  {doc.basis === 'primary' ? BALANCE.inUse : BALANCE.waiting}
                </span>
              </div>
              <p className={s.docTitle}>{doc.title}</p>
              <dl className={s.targets}>
                {doc.targets.map((t) => (
                  <div key={t.label} className={s.target}>
                    <dt>{t.label}</dt>
                    <dd>
                      {'value' in t
                        ? formatNumber(Number(t.value), 0)
                        : `${formatNumber(Number(t.low), 1)}–${formatNumber(Number(t.high), 1)}`}{' '}
                      {t.unit}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </section>

        <section className={ui.card}>
          <h3 className={ui.cardTitle}>{BALANCE.customTitle}</h3>
          <p className={ui.cardLead}>{BALANCE.customLead}</p>
          <label className={s.inputLabel}>{BALANCE.customLabel}</label>
          <input
            inputMode="decimal"
            className={s.input}
            placeholder={formatNumber(SUPPLY_2030_BKWH, 2)}
            value={custom}
            onChange={(e) => setCustom(e.target.value.slice(0, 12))}
            aria-label={BALANCE.customLabel}
          />
        </section>
      </aside>
    </div>
  );
}
