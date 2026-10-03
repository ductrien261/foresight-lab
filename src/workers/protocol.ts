export type Level = 'ok' | 'warn' | 'block';

export interface CheckItem {
  level: Level;
  code: string;
  title: string;
  detail: string;
}

export interface Prepared {
  months: string[];
  target: number[];
  exog: number[][];
  exogNames: string[];
  trainEnd: number;
  nRules: number;
  seasonStrength: number;
  selected?: number[];
}

export interface DriverSuggestion {
  name: string;
  index: number;
  r: number;
  selected: boolean;
  reason: string;
}

export interface CheckResult {
  items: CheckItem[];
  blocked: boolean;
  prepared: Prepared | null;
  drivers: DriverSuggestion[];
}

export interface FittedModel {
  name: string;
  spec: string;
  pred: number[];
  metrics: { rmse: number; mae: number; mape: number; r2: number; maxae: number };
}

export interface TrainResult {
  months: string[];
  actual: number[];
  fitted: number[];
  testStart: number;
  trend: number[];
  nonlinear: number[];
  models: FittedModel[];
  exogNames: string[];
  lastYearExog: number[][];
  baseRates: number[];
  lastMonth: string;
  model: import('@/typings/model').ExportedModel;
  longTrend: import('@/typings/model').LongTrendInfo;
  convergence: number[];
}

export interface CheckPayload {
  frequency: 'annual' | 'quarterly' | 'monthly';
  how: 'sum' | 'mean' | 'last';
  target: { name: string; periods: string[]; values: (number | null)[] };
  indicator: { name: string; periods: string[]; values: (number | null)[] } | null;
  exog: { name: string; periods: string[]; values: (number | null)[] }[];
}

export type ToWorker =
  | { type: 'init'; pythonBase: string }
  | { type: 'check'; id: number; payload: CheckPayload }
  | { type: 'train'; id: number; prepared: Prepared; preset: 'fast' | 'standard' | 'paper' };

export type FromWorker =
  | { type: 'status'; text: string }
  | { type: 'ready' }
  | { type: 'progress'; stage: string; frac: number }
  | { type: 'checked'; id: number; result: CheckResult }
  | { type: 'trained'; id: number; result: TrainResult }
  | { type: 'error'; id?: number; message: string };
