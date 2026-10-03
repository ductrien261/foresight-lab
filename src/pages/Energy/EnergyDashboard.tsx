import * as Tabs from '@radix-ui/react-tabs';
import * as ToggleGroup from '@radix-ui/react-toggle-group';

import ui from '@/components/ui.module.css';
import { ENERGY, type Role, ROLES } from '@/content/vi';
import { useAppPrefs } from '@/contexts/AppPrefsContext';
import { cagr } from '@/utils/format';
import { buildInsights } from '@/utils/insights';
import { SUPPLY_2030_BKWH } from '@/utils/plans';

import { BalanceTab } from './components/BalanceTab';
import { ForecastTab } from './components/ForecastTab';
import { HorizonPicker } from './components/HorizonPicker';
import { ImpactTab } from './components/ImpactTab';
import { ScenarioBar } from './components/ScenarioBar';
import { StatCards } from './components/StatCards';
import s from './EnergyDashboard.module.css';
import { DATA, forecastYearsFor, PLAN_YEAR, REPORT_YEARS, sliceResult, useScenario } from './hooks/useScenario';

const ROLE_KEYS = Object.keys(ROLES) as Role[];

export default function EnergyDashboard() {
  const { role, setRole } = useAppPrefs();
  const { preset, rates, horizon, result, presets, canCustomize, choosePreset, changeRate, changeHorizon } =
    useScenario();

  const { years, values } = DATA.annual;
  const lastYear = years[years.length - 1]!;
  const lastValue = values[values.length - 1]!;
  // Every figure on this page uses the DeGNA forecast with the recursive GM(1,1) trend (notebook v9);
  // the regression-trend forecast is only drawn as a comparison line.
  // Results cover at least 2025–2030 (plan comparisons stay at 2030); views show `horizon` years.
  const full = result ?? presets.base;
  const fYears = forecastYearsFor(horizon);
  const shown = sliceResult(full, horizon);
  const forecast = shown.annual;
  const low = presets.low.annual.slice(0, horizon);
  const high = presets.high.annual.slice(0, horizon);
  const planDemand = full.annual[REPORT_YEARS - 1]!;
  const end = forecast[horizon - 1]!;
  const growth = cagr(lastValue, end, horizon);
  const pastGrowth = cagr(values[0]!, lastValue, years.length - 1);
  const degna = DATA.models.find((m) => m.name === 'DeGNA');

  // Custom forecast for BalanceTab: only when slider is active (not a named preset)
  const customForecast = preset === null ? (result?.annual ?? null) : null;

  const insights = buildInsights(role, {
    lastYear,
    lastValue,
    years: fYears,
    forecast,
    low,
    high,
    planYear: PLAN_YEAR,
    planDemand,
    supply2030: SUPPLY_2030_BKWH,
    seasonalProfile: DATA.seasonalProfile,
  });

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.title}>{ENERGY.title}</h1>
          <p className={s.lead}>{ENERGY.lead}</p>
        </div>
        <div className={s.perspective}>
          <span className={s.perspectiveLabel}>{ENERGY.perspective}</span>
          <ToggleGroup.Root
            type="single"
            value={role}
            onValueChange={(v) => v && setRole(v as Role)}
            className={ui.segGroup}
            aria-label="Góc nhìn vai trò"
          >
            {ROLE_KEYS.map((key) => (
              <ToggleGroup.Item key={key} value={key} className={ui.segItem}>
                {ROLES[key]}
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
        </div>
      </div>

      <div className={s.body}>
        {/* ── Left: tabs ── */}
        <div className={s.contentCol}>
          <Tabs.Root defaultValue="forecast" className={s.tabs}>
            <Tabs.List className={s.tabList} aria-label="Chế độ xem">
              <Tabs.Trigger value="forecast" className={s.tab}>Dự báo &amp; Kịch bản</Tabs.Trigger>
              <Tabs.Trigger value="balance" className={s.tab}>Cân đối Quy hoạch</Tabs.Trigger>
              <Tabs.Trigger value="impact" className={s.tab}>Phân tích tác động</Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="forecast" className={s.tabContent}>
              <ForecastTab
                years={fYears}
                result={shown}
                low={low}
                base={presets.base.annual.slice(0, horizon)}
                high={high}
                rates={rates}
                lastValue={lastValue}
                lastYear={lastYear}
                insights={insights}
              />
            </Tabs.Content>

            <Tabs.Content value="balance" className={s.tabContent}>
              <BalanceTab preset={preset} customForecast={customForecast} />
            </Tabs.Content>

            <Tabs.Content value="impact" className={s.tabContent}>
              <ImpactTab rates={rates} horizon={horizon} />
            </Tabs.Content>
          </Tabs.Root>

          <p className={s.scope}>{ENERGY.scope}</p>
        </div>

        {/* ── Right sidebar: scenario + stats ── */}
        <aside className={s.sidebar} aria-label={ENERGY.scenario.title}>
          <ScenarioBar
            preset={preset}
            rates={rates}
            canCustomize={canCustomize}
            onPreset={choosePreset}
            onRate={changeRate}
          />
          <HorizonPicker years={horizon} canExtend={canCustomize} onChange={changeHorizon} />
          <StatCards
            end={end}
            endYear={fYears[horizon - 1]!}
            planDemand={planDemand}
            lastValue={lastValue}
            lastYear={lastYear}
            firstYear={years[0]!}
            growth={growth}
            pastGrowth={pastGrowth}
            degnaMape={degna?.mape}
          />
        </aside>
      </div>
    </>
  );
}
