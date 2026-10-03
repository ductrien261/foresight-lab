import * as Slider from '@radix-ui/react-slider';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { useId, useState } from 'react';

import ui from '@/components/ui.module.css';
import { ENERGY } from '@/content/vi';

import { DATA, MAX_YEARS, PLAN_YEAR, REPORT_YEARS } from '../hooks/useScenario';
import s from './ScenarioBar.module.css';

const H = ENERGY.horizon;
const QUICK = [1, 3, REPORT_YEARS, 10];

interface HorizonPickerProps {
  years: number;
  canExtend: boolean;
  onChange: (years: number) => void;
}

/** How many years ahead to show: quick choices or any number via the slider. */
export function HorizonPicker({ years, canExtend, onChange }: HorizonPickerProps) {
  const id = useId();
  const [isCustom, setIsCustom] = useState(!QUICK.includes(years));
  const max = canExtend ? MAX_YEARS : REPORT_YEARS;
  const endYear = DATA.forecastYears[0]! + years - 1;

  function handleQuick(value: string) {
    if (!value) return;
    if (value === 'custom') {
      setIsCustom(true);
      return;
    }
    setIsCustom(false);
    onChange(Number(value));
  }

  return (
    <div className={s.bar}>
      <span className={s.label}>{H.title}</span>
      <ToggleGroup.Root
        type="single"
        value={isCustom ? 'custom' : String(years)}
        onValueChange={handleQuick}
        className={`${s.presets} ${s.wrap}`}
        aria-label={H.title}
      >
        {QUICK.map((n) => (
          <ToggleGroup.Item key={n} value={String(n)} className={s.preset} disabled={n > max}>
            {n === REPORT_YEARS ? H.toPlan(PLAN_YEAR) : H.years(n)}
          </ToggleGroup.Item>
        ))}
        <ToggleGroup.Item value="custom" className={s.preset}>
          {H.custom}
        </ToggleGroup.Item>
      </ToggleGroup.Root>

      {isCustom && (
        <div className={s.sliderItem}>
          <div className={s.sliderHead}>
            <span id={id} className={s.sliderLabel}>{H.customLabel}</span>
            <span className={s.sliderValue}>{H.until(years, endYear)}</span>
          </div>
          <Slider.Root
            className={s.slider}
            min={1}
            max={max}
            step={1}
            value={[years]}
            onValueChange={([v]) => v !== undefined && onChange(v)}
            aria-labelledby={id}
          >
            <Slider.Track className={s.track}>
              <Slider.Range className={s.range} />
            </Slider.Track>
            <Slider.Thumb className={s.thumb} aria-labelledby={id} />
          </Slider.Root>
        </div>
      )}

      {years > REPORT_YEARS && (
        <div role="note" className={`${ui.warnBox} ${s.small}`}>
          {H.beyondReport(PLAN_YEAR)}
        </div>
      )}
      {years < REPORT_YEARS && <p className={`${ui.note} ${s.small}`}>{H.planNote(PLAN_YEAR)}</p>}
      {!canExtend && <p className={`${ui.note} ${s.small}`}>{H.noModel}</p>}
    </div>
  );
}
