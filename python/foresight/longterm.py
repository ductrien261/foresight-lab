"""Multi-year trend projection for scenario forecasts (report section 4.4, notebook v9).

Rolling GM(1,1) with a 12-month window is the one-step design of DeGNA. For multi-year
forecasts there are no new observations, so:

1. the GM(1,1) window is re-selected by a multi-origin backtest on annual totals
   (`select_long_window`): at each origin, STL + recursive GM(1,1) see only data up
   to that origin and project `horizon` years ahead;
2. scenarios shift the GM(1,1) trend through the elasticity of annual energy growth to
   annual growth of the main driver (`growth_elasticity`), relative to a reference
   growth rate that the plain GM(1,1) path is taken to represent (`LongTrend`).

Annual values are 12-month blocks counted back from the last month, so for series that
end in December they are calendar years, exactly as in the notebook."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence

import numpy as np
from statsmodels.tsa.seasonal import STL

from .gm11 import gm11_next

WINDOWS = (12, 24, 36, 48, 60)
HORIZON_YEARS = 6
N_ORIGINS = 5
EXCLUDED_YEARS = (2020, 2021)  # COVID-19 shock years, left out of the elasticity fit


def gm_path(trend_tail: np.ndarray, window: int, steps: int) -> np.ndarray:
    """Recursive GM(1,1): each forecast is fed back into the rolling window."""
    buf = list(np.asarray(trend_tail, dtype=float)[-window:])
    for _ in range(steps):
        buf.append(gm11_next(np.array(buf[-window:])))
    return np.array(buf[window:])


def annual_blocks(series: np.ndarray) -> np.ndarray:
    """Sums of the 12-month blocks counted back from the last month (leading remainder dropped)."""
    x = np.asarray(series, dtype=float)
    n = len(x) // 12
    return x[len(x) - n * 12 :].reshape(n, 12).sum(axis=1)


@dataclass
class WindowChoice:
    window: int
    horizon_years: int
    origins: list[str]
    mape: dict[int, float] = field(default_factory=dict)  # window -> mean annual MAPE (%)

    def to_dict(self) -> dict:
        return {
            "window": self.window,
            "horizonYears": self.horizon_years,
            "origins": self.origins,
            "mape": [{"window": w, "mape": m} for w, m in self.mape.items()],
        }


def select_long_window(
    target: np.ndarray,
    months: Sequence[str],
    windows: Sequence[int] = WINDOWS,
    horizon_years: int = HORIZON_YEARS,
    n_origins: int = N_ORIGINS,
    period: int = 12,
) -> WindowChoice:
    """Pick the GM(1,1) window with the lowest mean annual MAPE over the last origins
    that still leave `horizon_years` full years to compare against."""
    y = np.asarray(target, dtype=float)
    lead = len(y) % 12
    n_blocks = len(y) // 12
    h = min(horizon_years, n_blocks - 3)
    if h < 1:
        return WindowChoice(windows[0], 0, [])
    last_origin = n_blocks - 1 - h
    first_origin = max(1, last_origin - n_origins + 1)
    origins = list(range(first_origin, last_origin + 1))
    blocks = annual_blocks(y)
    scores: dict[int, list[float]] = {}
    for w in windows:
        errs = []
        for o in origins:
            end = lead + (o + 1) * 12  # months up to the end of origin block o
            if end < max(w, 2 * period):
                break
            trend = np.asarray(STL(y[:end], period=period, robust=True).fit().trend)
            fc = gm_path(trend, w, h * 12).reshape(h, 12).sum(axis=1)
            act = blocks[o + 1 : o + 1 + h]
            errs.append(float(np.mean(np.abs(fc - act) / act) * 100))
        if len(errs) == len(origins):
            scores[w] = float(np.mean(errs))
    if not scores:
        return WindowChoice(windows[0], h, [])
    best = min(scores, key=lambda w: (scores[w], w))
    labels = [months[lead + (o + 1) * 12 - 1][:4] for o in origins]
    return WindowChoice(best, h, labels, scores)


@dataclass
class Elasticity:
    beta: float
    alpha: float
    r: float
    n: int

    def to_dict(self) -> dict:
        return {"beta": self.beta, "alpha": self.alpha, "r": self.r, "n": self.n}


def growth_elasticity(
    target: np.ndarray, driver: np.ndarray, months: Sequence[str], excluded: Sequence[int] = EXCLUDED_YEARS
) -> Elasticity:
    """g_target = alpha + beta * g_driver on annual growth rates (block sums)."""
    yt, yd = annual_blocks(target), annual_blocks(driver)
    lead = len(target) % 12
    years = [int(months[lead + (i + 1) * 12 - 1][:4]) for i in range(len(yt))]
    with np.errstate(divide="ignore", invalid="ignore"):
        gt, gd = yt[1:] / yt[:-1] - 1, yd[1:] / yd[:-1] - 1
    keep = np.array([yr not in excluded for yr in years[1:]]) & np.isfinite(gt) & np.isfinite(gd)
    gt, gd = gt[keep], gd[keep]
    if len(gt) < 3 or np.std(gd) < 1e-12:
        return Elasticity(0.0, float(np.mean(gt)) if len(gt) else 0.0, 0.0, int(len(gt)))
    beta, alpha = np.polyfit(gd, gt, 1)
    return Elasticity(float(beta), float(alpha), float(np.corrcoef(gd, gt)[0, 1]), int(len(gt)))


def growth_factor(steps: int, beta: float, growth: float | Sequence[float] | None, ref: float) -> np.ndarray:
    """Monthly multiplier (1 + beta * (g_year - ref)) ** (1/12), compounded over the steps.
    A constant `growth` gives (1 + beta * (g - ref)) ** (k / 12), k = 1..steps."""
    if growth is None or beta == 0.0:
        return np.ones(steps)
    rates = np.array([growth if np.isscalar(growth) else growth[min(s // 12, len(growth) - 1)] for s in range(steps)], dtype=float)  # type: ignore[index, arg-type]
    return np.cumprod((1 + beta * (rates - ref)) ** (1 / 12))


@dataclass
class LongTrend:
    """GM(1,1) projection for multi-year scenarios: chosen window + elasticity shift."""

    window: int
    beta: float = 0.0
    ref_growth: float = 0.0

    def path(self, trend: np.ndarray, steps: int, growth: float | Sequence[float] | None) -> np.ndarray:
        return gm_path(trend, self.window, steps) * growth_factor(steps, self.beta, growth, self.ref_growth)
