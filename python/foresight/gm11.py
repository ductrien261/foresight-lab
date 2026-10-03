"""GM(1,1) grey model with a rolling window, one step ahead (as in the notebook)."""

from __future__ import annotations

import numpy as np


def gm11_fit(window: np.ndarray) -> tuple[float, float, float]:
    x0 = np.asarray(window, dtype=float)
    n = len(x0)
    x1 = np.cumsum(x0)
    z1 = (x1[:-1] + x1[1:]) / 2.0
    b_mat = np.column_stack([-z1, np.ones(n - 1)])
    a, b = np.linalg.lstsq(b_mat, x0[1:], rcond=None)[0]
    return float(a), float(b), float(x0[0])


def gm11_next(window: np.ndarray) -> float:
    """Forecast the value right after `window`."""
    k = len(window)
    a, b, first = gm11_fit(window)
    x1_k = (first - b / a) * np.exp(-a * k) + b / a
    x1_km1 = (first - b / a) * np.exp(-a * (k - 1)) + b / a
    return float(x1_k - x1_km1)


def gm11_rolling(series: np.ndarray, window: int = 12) -> np.ndarray:
    """One-step-ahead predictions; the first `window` points are copied through."""
    series = np.asarray(series, dtype=float)
    out = np.zeros(len(series))
    out[:window] = series[:window]
    for i in range(window, len(series)):
        out[i] = gm11_next(series[i - window : i])
    return out


def gm11_forecast(series: np.ndarray, h: int, window: int = 12) -> np.ndarray:
    """Forecast h steps ahead using recursive rolling-window GM(1,1).

    Implements paper Step 3: starting from the last `window` values of `series`,
    predicts one step at a time, appending each prediction to the rolling buffer.
    This mirrors how the model is used during inference in forecast_degna().
    """
    series = np.asarray(series, dtype=float)
    buf = list(series[-window:])
    out = np.zeros(h)
    for i in range(h):
        v = gm11_next(np.array(buf))
        out[i] = v
        buf.append(v)
        buf.pop(0)
    return out
