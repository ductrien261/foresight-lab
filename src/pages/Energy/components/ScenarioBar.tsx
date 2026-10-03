import * as Slider from '@radix-ui/react-slider';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { useId } from 'react';

import ui from '@/components/ui.module.css';
import { ENERGY } from '@/content/vi';
import type { ScenarioKey } from '@/typings/model';
import { formatPercent } from '@/utils/format';

import type { Rates } from '../hooks/useScenario';
import { SCENARIO_KEYS } from '../hooks/useScenario';
import s from './ScenarioBar.module.css';

interface ScenarioBarProps {
  preset: ScenarioKey | null;
  rates: Rates;
  canCustomize: boolean;
  onPreset: (key: ScenarioKey) => void;
  onRate: (driver: 'iip' | 'fdi', value: number) => void;
}

export function ScenarioBar({ preset, rates, canCustomize, onPreset, onRate }: ScenarioBarProps) {
  return (
    <div className={s.bar}>
      <span className={s.label}>Kịch bản</span>

      <ToggleGroup.Root
        type="single"
        value={preset ?? ''}
        onValueChange={(v) => v && onPreset(v as ScenarioKey)}
        className={s.presets}
        aria-label="Kịch bản có sẵn"
      >
        {SCENARIO_KEYS.map((key) => (
          <ToggleGroup.Item key={key} value={key} className={s.preset}>
            {ENERGY.scenario.presets[key]}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>

      <span className={s.sep} aria-hidden="true" />

      <div className={s.sliders}>
        {(['iip', 'fdi'] as const).map((driver) => (
          <RateSlider
            key={driver}
            label={ENERGY.scenario[driver]}
            value={Number(rates[driver])}
            isDisabled={!canCustomize}
            onChange={(v) => onRate(driver, v)}
          />
        ))}
      </div>

      {!canCustomize && <p className={`${ui.note} ${s.noModel}`}>{ENERGY.scenario.noModel}</p>}
    </div>
  );
}

interface RateSliderProps {
  label: string;
  value: number;
  isDisabled: boolean;
  onChange: (v: number) => void;
}

function RateSlider({ label, value, isDisabled, onChange }: RateSliderProps) {
  const id = useId();
  return (
    <div className={s.sliderItem}>
      <div className={s.sliderHead}>
        <span id={id} className={s.sliderLabel}>{label}</span>
        <span className={s.sliderValue}>{formatPercent(value)}</span>
      </div>
      <Slider.Root
        className={s.slider}
        min={0} max={15} step={0.5}
        value={[value * 100]}
        disabled={isDisabled}
        onValueChange={([v]) => v !== undefined && onChange(v / 100)}
        aria-labelledby={id}
      >
        <Slider.Track className={s.track}>
          <Slider.Range className={s.range} />
        </Slider.Track>
        <Slider.Thumb className={s.thumb} aria-labelledby={id} />
      </Slider.Root>
    </div>
  );
}
