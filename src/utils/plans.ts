import plans from '@/data/plans.json';

/** Primary energy supply target for 2030 in QĐ 893/QĐ-TTg, converted to billion kWh. */
export const SUPPLY_2030_BKWH = (() => {
  const doc = plans.documents.find((d) => d.id === 'qd893');
  const target = doc?.targets.find((t) => t.comparable);
  const mtoe = target && 'value' in target ? Number(target.value) : 155;
  return (mtoe * 1e6 * plans.toeToKwh) / 1e9;
})();

export const PLANS = plans;
