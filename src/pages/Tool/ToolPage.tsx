import { useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import { ErrorFallback } from '@/components/ErrorFallback';
import { TOOL } from '@/content/vi';
import { type ParsedSeries, readWorkbook } from '@/utils/excel';
import type { CheckPayload, CheckResult, TrainResult } from '@/workers/protocol';

import { CheckStep } from './components/CheckStep';
import { MappingStep } from './components/MappingStep';
import { ResultStep } from './components/ResultStep';
import { TrainingStep } from './components/TrainingStep';
import { UploadStep } from './components/UploadStep';
import { useForecastWorker } from './hooks/useForecastWorker';
import s from './ToolPage.module.css';

type Step =
  | { name: 'upload' }
  | { name: 'map'; series: ParsedSeries[] }
  | { name: 'check'; series: ParsedSeries[]; result: CheckResult; selected: number[] }
  | { name: 'train'; series: ParsedSeries[] }
  | { name: 'result'; result: TrainResult };

const INDEX: Record<Step['name'], number> = { upload: 0, map: 1, check: 2, train: 3, result: 4 };

export default function ToolPage() {
  const { status, progress, check, train } = useForecastWorker();
  const [step, setStep] = useState<Step>({ name: 'upload' });
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const series = await readWorkbook(file);
      if (series.length === 0) throw new Error(TOOL.upload.empty);
      setFileName(file.name);
      setStep({ name: 'map', series });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đọc được file.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCheck(series: ParsedSeries[], payload: CheckPayload) {
    if (status.phase !== 'ready') {
      setError('Bộ máy tính toán chưa sẵn sàng, đợi vài giây rồi thử lại.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await check(payload);
      const selected = result.drivers.filter((d) => d.selected).map((d) => d.index);
      setStep({ name: 'check', series, result, selected });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kiểm tra dữ liệu thất bại.');
    } finally {
      setBusy(false);
    }
  }

  async function handleTrain(current: Extract<Step, { name: 'check' }>) {
    if (!current.result.prepared) return;
    setError(null);
    setStep({ name: 'train', series: current.series });
    try {
      const result = await train({ ...current.result.prepared, selected: current.selected });
      setStep({ name: 'result', result });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Huấn luyện thất bại.');
      setStep(current);
    }
  }

  return (
    <>
      <h1 className={s.title}>{TOOL.title}</h1>
      <ol className={s.steps} aria-label="Các bước">
        {TOOL.steps.map((label, i) => (
          <li
            key={label}
            className={i === INDEX[step.name] ? s.stepOn : s.stepItem}
            aria-current={i === INDEX[step.name] ? 'step' : undefined}
          >
            {i + 1} · {label}
          </li>
        ))}
      </ol>
      {error && step.name !== 'upload' && (
        <p role="alert" className={s.error}>
          {error}
        </p>
      )}

      <ErrorBoundary FallbackComponent={ErrorFallback} resetKeys={[step.name]}>
        {step.name === 'upload' && (
          <UploadStep engine={status} isReading={isBusy} error={error} onFile={(f) => void handleFile(f)} />
        )}
        {step.name === 'map' && (
          <MappingStep
            series={step.series}
            isBusy={isBusy}
            onSubmit={(p) => void handleCheck(step.series, p)}
          />
        )}
        {step.name === 'check' && (
          <CheckStep
            result={step.result}
            selected={step.selected}
            isBusy={isBusy}
            onToggle={(index, isOn) =>
              setStep({
                ...step,
                selected: isOn ? [...step.selected, index] : step.selected.filter((i) => i !== index),
              })
            }
            onTrain={() => void handleTrain(step)}
            onBack={() => setStep({ name: 'map', series: step.series })}
          />
        )}
        {step.name === 'train' && <TrainingStep progress={progress} />}
        {step.name === 'result' && (
          <ResultStep
            result={step.result}
            fileName={fileName}
            onRestart={() => setStep({ name: 'upload' })}
          />
        )}
      </ErrorBoundary>
    </>
  );
}
