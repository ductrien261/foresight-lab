"""DeGNA pipeline: STL -> GM(1,1) on the trend, GWO-ANFIS on seasonal + residual.

Follows the five-step procedure described in the published paper (CMES, 2026):
  Step 1: Denton temporal disaggregation (annual -> monthly).
  Step 2: STL decomposition into trend / seasonality / residual.
  Step 3: Rolling-window GM(1,1) projects the trend forward (window n=12).
  Step 4: GWO-optimized ANFIS forecasts nonlinear component (seasonal+residual).
  Step 5: Final forecast = GM(1,1) trend + ANFIS nonlinear (additive).

Rolling GM(1,1) is designed for one-step forecasts that receive a new observation
every month. For multi-year scenarios there are no new observations, so the trend is
projected by recursive GM(1,1) with a window re-selected by backtest and shifted by an
elasticity to the main driver (longterm.py). A regression of the trend on time and the
drivers (TrendModel) is kept as a comparison line. Both share the same GWO-ANFIS
nonlinear branch.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Literal, Optional

import numpy as np
from statsmodels.tsa.seasonal import STL

from .anfis import ANFIS
from .denton import denton, denton_slsqp
from .gm11 import gm11_rolling
from .longterm import LongTrend
from .gwo import gwo_multirun, per_vector
from .numeric import MinMaxScaler, linear_regression, metrics

Progress = Optional[Callable[[str, float], None]]


@dataclass
class DegnaConfig:
    n_rules: int = 4
    gm_window: int = 12
    period: int = 12
    warmup: int = 13
    gwo_runs: int = 30
    gwo_wolves: int = 80
    gwo_iter: int = 200
    seed: int = 42
    exact: bool = False


@dataclass
class DegnaFit:
    config: DegnaConfig
    target: np.ndarray
    exog: np.ndarray
    start: int
    n_train: int
    trend: np.ndarray
    nonlinear: np.ndarray
    trend_pred: np.ndarray
    nl_pred: np.ndarray
    params: np.ndarray
    scaler_x: MinMaxScaler
    scaler_y: MinMaxScaler
    anfis: ANFIS
    history: list[float] = field(default_factory=list)

    @property
    def fitted(self) -> np.ndarray:
        return self.trend_pred + self.nl_pred

    @property
    def model_target(self) -> np.ndarray:
        return self.target[self.start :]

    def test_metrics(self) -> dict:
        return metrics(self.model_target[self.n_train :], self.fitted[self.n_train :])

    def train_metrics(self) -> dict:
        w = self.config.gm_window
        return metrics(self.model_target[w : self.n_train], self.fitted[w : self.n_train])


def _lags(series: np.ndarray, lags: tuple[int, ...]) -> list[np.ndarray]:
    out = []
    for lag in lags:
        col = np.roll(series, lag)
        col[:lag] = 0.0
        out.append(col)
    return out


def fit_degna(
    target: np.ndarray,
    exog: np.ndarray,
    train_end: int,
    config: DegnaConfig = DegnaConfig(),
    on_progress: Progress = None,
) -> DegnaFit:
    """target: monthly series (length n); exog: (n, k) monthly drivers, k may be 0;
    train_end: index in `target` of the last training month."""
    target = np.asarray(target, dtype=float)
    exog = np.asarray(exog, dtype=float).reshape(len(target), -1)
    start = config.warmup
    y = target[start:]
    x_exog = exog[start:]
    n_train = train_end - start + 1

    def report(stage: str, frac: float) -> None:
        if on_progress is not None:
            on_progress(stage, frac)

    # Step 2: STL decomposition
    report("stl", 0.0)
    stl = STL(y, period=config.period, robust=True).fit()
    trend = np.asarray(stl.trend)
    # nonlinear = seasonal + residual (paper Step 4 input)
    nonlinear = np.asarray(stl.seasonal) + np.asarray(stl.resid)

    # Step 3 (history): GM(1,1) rolling-window one-step-ahead fit
    report("gm", 0.0)
    trend_pred = gm11_rolling(trend, config.gm_window)

    # Step 4: GWO-ANFIS on nonlinear component
    report("anfis", 0.0)
    x_raw = np.column_stack(_lags(nonlinear, (1, 12)) + [x_exog[:, j] for j in range(x_exog.shape[1])])
    scaler_x = MinMaxScaler().fit(x_raw[:n_train])
    scaler_y = MinMaxScaler().fit(nonlinear[:n_train].reshape(-1, 1))
    x_train = scaler_x.transform(x_raw[:n_train])
    y_train = scaler_y.transform(nonlinear[:n_train].reshape(-1, 1)).ravel()
    anfis = ANFIS(n_inputs=x_raw.shape[1], n_rules=config.n_rules)

    if config.exact:
        cost = per_vector(lambda p: anfis.mse(p, x_train, y_train))
    else:
        cost = lambda pop: anfis.mse_many(pop, x_train, y_train)  # noqa: E731

    params, _, history = gwo_multirun(
        cost,
        anfis.n_params,
        n_runs=config.gwo_runs,
        n_wolves=config.gwo_wolves,
        max_iter=config.gwo_iter,
        seed=config.seed,
        on_progress=lambda f: report("gwo", f),
    )

    nl_scaled = anfis.predict(scaler_x.transform(x_raw), params)
    nl_pred = scaler_y.inverse_transform(nl_scaled.reshape(-1, 1)).ravel()
    report("done", 1.0)
    return DegnaFit(
        config=config,
        target=target,
        exog=exog,
        start=start,
        n_train=n_train,
        trend=trend,
        nonlinear=nonlinear,
        trend_pred=trend_pred,
        nl_pred=nl_pred,
        params=params,
        scaler_x=scaler_x,
        scaler_y=scaler_y,
        anfis=anfis,
        history=history,
    )


def scenario_exog(
    last_year: np.ndarray, rates: np.ndarray, years: int, ratio: int = 12, paper: bool = False
) -> np.ndarray:
    """Grow each driver's last-year total by its annual rate and spread it over the
    months with Denton, keeping last year's monthly pattern. Returns (years*ratio, k).
    `paper=True` compounds and solves exactly as the notebook did (SLSQP)."""
    last_year = np.asarray(last_year, dtype=float).reshape(ratio, -1)
    rates = np.asarray(rates, dtype=float).reshape(-1)
    out = np.zeros((years * ratio, last_year.shape[1]))
    for j in range(last_year.shape[1]):
        pattern = np.tile(last_year[:, j], years)
        if paper:
            cur, annual = last_year[:, j].mean(), []
            for _ in range(years):
                cur *= 1 + rates[j]
                annual.append(cur * 12)
            out[:, j] = denton_slsqp(np.array(annual), pattern, ratio=ratio)
            continue
        annual = last_year[:, j].sum() * (1 + rates[j]) ** np.arange(1, years + 1)
        method = "proportional" if np.all(pattern > 0) else "additive"
        out[:, j] = denton(annual, pattern, ratio=ratio, how="sum", method=method)
    return out


@dataclass
class TrendModel:
    """Linear trend: level = intercept + coef[0] * t (+ drivers @ coef[1:]), t = month index."""

    use_drivers: bool
    coef: np.ndarray
    intercept: float
    r2: float
    n_hist: int

    def predict(self, step: int, drivers: np.ndarray) -> float:
        t = self.n_hist + step
        if self.use_drivers:
            return float(self.intercept + self.coef[0] * t + drivers @ self.coef[1:])
        return float(self.intercept + self.coef[0] * t)

    def to_dict(self) -> dict:
        return {
            "useDrivers": self.use_drivers,
            "coef": self.coef.tolist(),
            "intercept": self.intercept,
            "r2": self.r2,
            "nHist": self.n_hist,
        }


def trend_model(fit: DegnaFit, mode: Literal["paper", "aligned"]) -> TrendModel:
    """Regress the STL trend on t and the drivers; falls back to a time-only line
    when there are no drivers or the fit is weak (R2 <= 0.5).

    mode="paper" deliberately reproduces notebook v8 so the scenario numbers match
    the report (Table 4-9): the trend (which starts after the 13-month warm-up) is
    paired with exog[:n], i.e. drivers shifted by 13 months. mode="aligned" pairs
    each trend month with its own drivers (exog[start:])."""
    n = len(fit.trend)
    t = np.arange(n)
    drivers = fit.exog[:n] if mode == "paper" else fit.exog[fit.start :]
    if drivers.shape[1] > 0:
        coef, intercept, r2 = linear_regression(np.column_stack([t, drivers]), fit.trend)
        if r2 > 0.5:
            return TrendModel(True, coef, intercept, r2, n)
    slope, intercept = np.polyfit(t, fit.trend, 1)
    return TrendModel(False, np.array([slope]), float(intercept), 0.0, n)


def forecast_scaler(fit: DegnaFit, futures: list[np.ndarray], mode: Literal["paper", "aligned"]) -> MinMaxScaler:
    """Input scaler used for scenario forecasts.

    mode="paper" reproduces notebook v8: the scaler is refit on the history plus
    every scenario's future drivers (lags padded with their last values). This is
    the second notebook quirk kept for Table 4-9. mode="aligned" keeps the scaler
    fitted on the training months."""
    if mode == "aligned" or fit.exog.shape[1] == 0:
        return fit.scaler_x
    lag1, lag12 = _lags(fit.nonlinear, (1, 12))
    all_future = np.vstack(futures)
    m = len(all_future)
    x_comb = np.column_stack(
        [
            np.concatenate([lag1, np.full(m, lag1[-1])]),
            np.concatenate([lag12, np.full(m, lag12[-12])]),
            np.vstack([fit.exog[fit.start :], all_future]),
        ]
    )
    return MinMaxScaler().fit(x_comb)


def forecast_degna(
    fit: DegnaFit,
    future: np.ndarray,
    scaler_x: MinMaxScaler,
    trend: TrendModel | LongTrend | None = None,
    growth: float | list[float] | None = None,
) -> np.ndarray:
    """Recursive monthly forecast for one scenario of future drivers (h, k).

    Step 3 (trend), one month at a time:
    - trend=LongTrend: recursive GM(1,1) with the backtest-selected window, shifted by
      the elasticity to the main driver's annual `growth` (report 4.4, notebook v9);
    - trend=None: recursive GM(1,1) with the one-step window (config.gm_window);
    - trend=TrendModel: regression of the trend on t and the drivers (comparison line).
    Step 4: GWO-ANFIS projects the nonlinear component (seasonal + residual) with the
    scaler fitted on the training months.
    Step 5: Final forecast = trend + nonlinear (additive).
    """
    future = np.asarray(future, dtype=float).reshape(-1, fit.exog.shape[1])
    h = len(future)
    if isinstance(trend, TrendModel):
        trend_path = np.array([trend.predict(step, future[step]) for step in range(h)])
    else:
        long = trend if isinstance(trend, LongTrend) else LongTrend(fit.config.gm_window)
        trend_path = long.path(fit.trend, h, growth)
    hist_nl = list(fit.nonlinear)  # nonlinear (seasonal+residual) history
    out = np.zeros(h)
    for step in range(h):
        # Step 4: ANFIS nonlinear (seasonal+residual) forecast
        x = np.concatenate([[hist_nl[-1], hist_nl[-12]], future[step]]).reshape(1, -1)
        nl = fit.anfis.predict(scaler_x.transform(x), fit.params)
        nl = float(fit.scaler_y.inverse_transform(nl.reshape(-1, 1)).ravel()[0])
        hist_nl.append(nl)
        # Step 5: Additive combination
        out[step] = trend_path[step] + nl
    return out


def export_model(
    fit: DegnaFit, scaler_x: MinMaxScaler, regression: TrendModel | None, long: LongTrend | None = None
) -> dict:
    """Everything the browser needs to reproduce forecast_degna() in TypeScript.

    trends.gm11       – GM(1,1) seed window (last `window` trend values), the window, and
                        the elasticity shift (beta, refGrowth) applied to the main driver.
    trends.regression – TrendModel parameters, or None when not available.
    """
    long = long or LongTrend(fit.config.gm_window)
    return {
        "nRules": fit.config.n_rules,
        "nInputs": fit.anfis.n_inputs,
        "params": fit.params.tolist(),
        "scalerX": scaler_x.to_dict(),
        "scalerY": fit.scaler_y.to_dict(),
        "nonlinearTail": fit.nonlinear[-12:].tolist(),
        "trends": {
            "gm11": {
                "tail": fit.trend[-long.window :].tolist(),
                "window": long.window,
                "beta": long.beta,
                "refGrowth": long.ref_growth,
            },
            "regression": None if regression is None else regression.to_dict(),
        },
    }
