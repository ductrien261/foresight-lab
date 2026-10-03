import * as Slider from '@radix-ui/react-slider';

import ui from '@/components/ui.module.css';
import { TOOL } from '@/content/vi';
import panel from '@/pages/Energy/components/ScenarioPanel.module.css';
import { formatPercent } from '@/utils/format';

interface DriverSlidersProps {
  names: string[];
  /** Driver whose growth shifts the GM(1,1) trend. */
  driver: string | null;
  rates: number[];
  onChange: (index: number, rate: number) => void;
}

/** Annual growth rate of each exogenous driver over the forecast horizon. */
export function DriverSliders({ names, driver, rates, onChange }: DriverSlidersProps) {
  if (names.length === 0) {
    return <p className={ui.note}>Không dùng biến ngoại sinh: dự báo chỉ dựa trên chính chuỗi.</p>;
  }
  return (
    <>
      {names.map((name, j) => (
        <div key={name} className={panel.rate}>
          <div className={panel.rateHead}>
            <span className={panel.rateLabel} id={`rate-${j}`}>
              {name}
            </span>
            <span className={panel.rateValue}>{formatPercent(rates[j] ?? 0)}</span>
          </div>
          <Slider.Root
            className={panel.slider}
            min={-10}
            max={20}
            step={0.5}
            value={[(rates[j] ?? 0) * 100]}
            onValueChange={([v]) => v !== undefined && onChange(j, v / 100)}
            aria-labelledby={`rate-${j}`}
          >
            <Slider.Track className={panel.track}>
              <Slider.Range className={panel.range} />
            </Slider.Track>
            <Slider.Thumb className={panel.thumb} aria-labelledby={`rate-${j}`} />
          </Slider.Root>
        </div>
      ))}
      <p className={ui.note}>{TOOL.result.driversNote(driver)}</p>
      <p className={ui.note}>Mặc định: tốc độ tăng bình quân 3 năm gần nhất của từng biến.</p>
    </>
  );
}
