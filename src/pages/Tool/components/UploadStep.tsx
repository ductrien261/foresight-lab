import { useId, useState } from 'react';

import ui from '@/components/ui.module.css';
import { TOOL } from '@/content/vi';
import { downloadTemplate } from '@/utils/download';

import type { EngineStatus } from '../hooks/useForecastWorker';
import s from '../ToolPage.module.css';

const MAX_BYTES = 5 * 1024 * 1024;
const T = TOOL.upload;

interface UploadStepProps {
  engine: EngineStatus;
  isReading: boolean;
  error: string | null;
  onFile: (file: File) => void;
}

export function UploadStep({ engine, isReading, error, onFile }: UploadStepProps) {
  const inputId = useId();
  const [isOver, setOver] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);

  function accept(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setSizeError(T.tooBig);
      return;
    }
    setSizeError(null);
    onFile(file);
  }

  return (
    <>
      <div
        className={isOver ? `${s.drop} ${s.dropOver}` : s.drop}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          accept(e.dataTransfer.files[0]);
        }}
      >
        <p className={s.dropTitle}>{T.drop}</p>
        <p className={s.dropHint}>{T.hint}</p>
        <div className={`${ui.actions} ${s.center}`}>
          <label htmlFor={inputId} className={`${ui.btn} ${ui.toolBtn}`}>
            {isReading ? 'Đang đọc…' : T.choose}
          </label>
          <input
            id={inputId}
            type="file"
            accept=".xlsx,.csv"
            className="visually-hidden"
            onChange={(e) => accept(e.target.files?.[0])}
          />
          <button
            type="button"
            className={`${ui.btn} ${ui.secondary}`}
            onClick={() => void downloadTemplate()}
          >
            {T.template}
          </button>
        </div>
      </div>
      {(sizeError ?? error) && (
        <p role="alert" className={s.error}>
          {sizeError ?? error}
        </p>
      )}
      <p className={s.engine} aria-live="polite">
        {engine.phase === 'booting' && `${engine.text} (lần đầu có thể mất 10–30 giây)`}
        {engine.phase === 'ready' && 'Bộ máy tính toán đã sẵn sàng.'}
        {engine.phase === 'failed' && `Không tải được bộ máy tính toán: ${engine.message}`}
      </p>
    </>
  );
}
