import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  CheckPayload,
  CheckResult,
  FromWorker,
  Prepared,
  ToWorker,
  TrainResult,
} from '@/workers/protocol';

export type EngineStatus =
  { phase: 'booting'; text: string } | { phase: 'ready' } | { phase: 'failed'; message: string };

export interface Progress {
  stage: string;
  frac: number;
}

type Pending = { resolve: (v: never) => void; reject: (e: Error) => void };

/** Owns the Pyodide worker: boots it once, then runs check/train jobs. */
export function useForecastWorker() {
  const worker = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, Pending>());
  const nextId = useRef(1);
  const [status, setStatus] = useState<EngineStatus>({ phase: 'booting', text: 'Đang khởi động…' });
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    const w = new Worker(new URL('../../../workers/pyodide.worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    const jobs = pending.current;
    w.onmessage = (event: MessageEvent<FromWorker>) => {
      const msg = event.data;
      switch (msg.type) {
        case 'status':
          setStatus({ phase: 'booting', text: msg.text });
          return;
        case 'ready':
          setStatus({ phase: 'ready' });
          return;
        case 'progress':
          setProgress({ stage: msg.stage, frac: msg.frac });
          return;
        case 'checked':
        case 'trained': {
          const job = jobs.get(msg.id);
          jobs.delete(msg.id);
          job?.resolve(msg.result as never);
          return;
        }
        case 'error': {
          if (msg.id === undefined) {
            setStatus({ phase: 'failed', message: msg.message });
            return;
          }
          const job = jobs.get(msg.id);
          jobs.delete(msg.id);
          job?.reject(new Error(msg.message));
          return;
        }
        default:
          exhaustive(msg);
      }
    };
    const pythonBase = new URL('py/foresight/', document.baseURI).href;
    w.postMessage({ type: 'init', pythonBase } satisfies ToWorker);
    return () => {
      w.terminate();
      jobs.forEach((job) => job.reject(new Error('cancelled')));
      jobs.clear();
      worker.current = null;
    };
  }, []);

  const run = useCallback(<T>(message: (id: number) => ToWorker): Promise<T> => {
    const id = nextId.current++;
    return new Promise<T>((resolve, reject) => {
      pending.current.set(id, { resolve, reject });
      worker.current?.postMessage(message(id));
    });
  }, []);

  const check = useCallback(
    (payload: CheckPayload) => run<CheckResult>((id) => ({ type: 'check', id, payload })),
    [run],
  );

  const train = useCallback(
    (prepared: Prepared) => {
      setProgress({ stage: 'start', frac: 0 });
      return run<TrainResult>((id) => ({ type: 'train', id, prepared, preset: 'paper' }));
    },
    [run],
  );

  return { status, progress, check, train };
}

function exhaustive(value: never): never {
  throw new Error(`Unhandled message: ${JSON.stringify(value)}`);
}
