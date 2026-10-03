/// <reference lib="webworker" />
import type { CheckResult, FromWorker, ToWorker, TrainResult } from './protocol';

interface PyModule {
  check: (payload: string) => string;
  train: (prepared: string, preset: string, onProgress: (stage: string, frac: number) => void) => string;
}

interface Pyodide {
  loadPackage: (names: string[]) => Promise<void>;
  pyimport: (name: string) => PyModule;
  FS: { mkdirTree: (path: string) => void; writeFile: (path: string, data: string) => void };
}

const PYODIDE_URL = String(
  import.meta.env.VITE_PYODIDE_URL || 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/',
);
const ctx = self as unknown as DedicatedWorkerGlobalScope;
let api: Promise<PyModule> | null = null;

const send = (msg: FromWorker) => ctx.postMessage(msg);

async function boot(pythonBase: string): Promise<PyModule> {
  send({ type: 'status', text: 'Đang tải Python cho trình duyệt…' });
  const mod = (await import(/* @vite-ignore */ `${PYODIDE_URL}pyodide.mjs`)) as {
    loadPyodide: (opts: { indexURL: string }) => Promise<Pyodide>;
  };
  const py = await mod.loadPyodide({ indexURL: PYODIDE_URL });
  send({ type: 'status', text: 'Đang tải thư viện tính toán (numpy, scipy, statsmodels)…' });
  await py.loadPackage(['numpy', 'scipy', 'statsmodels']);
  const manifest = (await (await fetch(`${pythonBase}manifest.json`)).json()) as string[];
  py.FS.mkdirTree('/home/pyodide/foresight');
  await Promise.all(
    manifest.map(async (file) => {
      const code = await (await fetch(`${pythonBase}${file}`)).text();
      py.FS.writeFile(`/home/pyodide/foresight/${file}`, code);
    }),
  );
  const module = py.pyimport('foresight.api');
  send({ type: 'ready' });
  return module;
}

function errorText(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  const last = text.trim().split('\n').pop() ?? text;
  return last.replace(/^\w+Error:\s*/, '');
}

ctx.onmessage = async (event: MessageEvent<ToWorker>) => {
  const msg = event.data;
  if (msg.type === 'init') {
    api ??= boot(msg.pythonBase);
    try {
      await api;
    } catch (error) {
      api = null;
      send({ type: 'error', message: `Không tải được Python trong trình duyệt: ${errorText(error)}` });
    }
    return;
  }
  if (!api) {
    send({ type: 'error', id: msg.id, message: 'Python chưa sẵn sàng.' });
    return;
  }
  try {
    const py = await api;
    if (msg.type === 'check') {
      const result = JSON.parse(py.check(JSON.stringify(msg.payload))) as CheckResult;
      send({ type: 'checked', id: msg.id, result });
      return;
    }
    let last = 0;
    const onProgress = (stage: string, frac: number) => {
      const now = Date.now();
      if (now - last < 120 && frac < 1) return;
      last = now;
      send({ type: 'progress', stage, frac });
    };
    const result = JSON.parse(py.train(JSON.stringify(msg.prepared), msg.preset, onProgress)) as TrainResult;
    send({ type: 'trained', id: msg.id, result });
  } catch (error) {
    send({ type: 'error', id: msg.id, message: errorText(error) });
  }
};
