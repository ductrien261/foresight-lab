"""Small numeric helpers that mirror scikit-learn exactly, so the core runs in
Pyodide without scikit-learn and still reproduces the published notebook."""

from __future__ import annotations

import numpy as np


class MinMaxScaler:
    """Same arithmetic as sklearn.preprocessing.MinMaxScaler(feature_range=(0, 1))."""

    def fit(self, x: np.ndarray) -> "MinMaxScaler":
        x = np.asarray(x, dtype=float)
        self.data_min_ = np.nanmin(x, axis=0)
        self.data_max_ = np.nanmax(x, axis=0)
        data_range = self.data_max_ - self.data_min_
        data_range = np.where(data_range < 10 * np.finfo(float).eps, 1.0, data_range)
        self.scale_ = 1.0 / data_range
        self.min_ = 0.0 - self.data_min_ * self.scale_
        return self

    def transform(self, x: np.ndarray) -> np.ndarray:
        out = np.array(x, dtype=float, copy=True)
        out *= self.scale_
        out += self.min_
        return out

    def fit_transform(self, x: np.ndarray) -> np.ndarray:
        return self.fit(x).transform(x)

    def inverse_transform(self, x: np.ndarray) -> np.ndarray:
        out = np.array(x, dtype=float, copy=True)
        out -= self.min_
        out /= self.scale_
        return out

    def to_dict(self) -> dict:
        return {"min": self.min_.tolist(), "scale": self.scale_.tolist()}


def linear_regression(x: np.ndarray, y: np.ndarray) -> tuple[np.ndarray, float, float]:
    """Ordinary least squares with intercept, centred like sklearn.LinearRegression.

    Returns (coef, intercept, r2)."""
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    x_mean = x.mean(axis=0)
    y_mean = y.mean()
    coef = np.linalg.lstsq(x - x_mean, y - y_mean, rcond=None)[0]
    intercept = float(y_mean - x_mean @ coef)
    pred = x @ coef + intercept
    ss_res = float(np.sum((y - pred) ** 2))
    ss_tot = float(np.sum((y - y_mean) ** 2))
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0
    return coef, intercept, r2


def metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    """RMSE, MAE, MAPE (%), R2 and max absolute error, as in the notebook."""
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    err = y_true - y_pred
    ss_tot = float(np.sum((y_true - y_true.mean()) ** 2))
    return {
        "rmse": float(np.sqrt(np.mean(err**2))),
        "mae": float(np.mean(np.abs(err))),
        "mape": float(np.mean(np.abs(err / (y_true + 1e-8))) * 100),
        "r2": float(1.0 - np.sum(err**2) / ss_tot) if ss_tot > 0 else 0.0,
        "maxae": float(np.max(np.abs(err))),
    }
