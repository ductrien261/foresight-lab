export interface ScalerParams {
  min: number[];
  scale: number[];
}

/**
 * Recursive GM(1,1) trend for multi-year forecasts (python/foresight/longterm.py).
 * The window is re-selected by backtest; scenarios shift the path by
 * (1 + beta * (g - refGrowth)) ** (k / 12), g = annual growth of the main driver.
 */
export interface Gm11Trend {
  /** Last `window` values of the historical trend series (initial GM(1,1) seed buffer). */
  tail: number[];
  /** Rolling window size (months) chosen by the multi-origin backtest. */
  window: number;
  /** Elasticity of annual target growth to annual growth of the main driver. */
  beta: number;
  /** Main-driver growth rate that the unshifted GM(1,1) path stands for. */
  refGrowth: number;
}

/** Regression of the trend on t (and the drivers), python/foresight/pipeline.py:TrendModel. */
export interface RegressionTrend {
  useDrivers: boolean;
  /** [slope of t, ...one coefficient per driver when useDrivers]. */
  coef: number[];
  intercept: number;
  r2: number;
  /** Months of trend history; forecast step s uses t = nHist + s. */
  nHist: number;
}

/** Two ways to extrapolate the trend over several years. */
export type TrendKind = 'gm11' | 'regression';

/** Trained DeGNA model as exported by python/foresight/pipeline.py:export_model. */
export interface ExportedModel {
  nRules: number;
  nInputs: number;
  params: number[];
  scalerX: ScalerParams;
  scalerY: ScalerParams;
  nonlinearTail: number[];
  trends: { gm11: Gm11Trend; regression: RegressionTrend | null };
}

export interface ModelMetrics {
  name: string;
  rmse: number;
  mae: number;
  mape: number;
  r2: number;
  maxae?: number;
}

export type ScenarioKey = 'low' | 'base' | 'high';

export interface ScenarioPreset {
  iip: number;
  fdi: number;
  source: string;
  /** Main DeGNA forecast: trend projected by recursive rolling-window GM(1,1) (notebook v9). */
  monthly: number[] | null;
  annual: number[];
  /** Comparison: trend extrapolated by regression on t, IIP and FDI. */
  altMonthly: number[] | null;
  altAnnual: number[];
}

/** How the long-term GM(1,1) trend was set up (python/foresight/longterm.py). */
export interface LongTrendInfo {
  /** Chosen GM(1,1) window, months. */
  window: number;
  horizonYears: number;
  /** Last year of each backtest origin. */
  origins: string[];
  /** Mean annual MAPE (%) of each candidate window. */
  mape: { window: number; mape: number }[];
  /** Driver whose growth shifts the trend, or null without drivers. */
  driver: string | null;
  elasticity: { beta: number; alpha: number; r: number; n: number } | null;
}

export interface VietnamData {
  meta: { title: string; unit: string; source: string; generated: string };
  annual: { years: number[]; values: number[] };
  monthly: { months: string[]; energy: number[]; iip: number[]; fdi: number[] } | null;
  test: { months: string[]; actual: number[]; degna: number[] } | null;
  models: ModelMetrics[];
  walkForwardStd: number;
  seasonalProfile: number[] | null;
  scenarios: Record<ScenarioKey, ScenarioPreset>;
  forecastYears: number[];
  lastYearExog: number[][] | null;
  longTrend: LongTrendInfo | null;
  model: ExportedModel | null;
}
