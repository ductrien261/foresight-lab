"""Temporal disaggregation (annual or quarterly -> monthly).

`denton` solves the proportional (or additive) first-difference Denton problem
exactly through its KKT system. `denton_slsqp` is the iterative version used in
the published notebook and is kept to reproduce its numbers."""

from __future__ import annotations

from typing import Literal

import numpy as np
from scipy.optimize import minimize

Aggregation = Literal["sum", "mean", "last"]


def _aggregation_matrix(n_low: int, ratio: int, how: Aggregation) -> np.ndarray:
    a = np.zeros((n_low, n_low * ratio))
    for i in range(n_low):
        block = slice(i * ratio, (i + 1) * ratio)
        if how == "sum":
            a[i, block] = 1.0
        elif how == "mean":
            a[i, block] = 1.0 / ratio
        else:
            a[i, (i + 1) * ratio - 1] = 1.0
    return a


def denton(
    low: np.ndarray,
    indicator: np.ndarray,
    ratio: int = 12,
    how: Aggregation = "sum",
    method: Literal["proportional", "additive"] = "proportional",
) -> np.ndarray:
    """Disaggregate `low` (length n) onto `indicator` (length n * ratio)."""
    low = np.asarray(low, dtype=float)
    ind = np.asarray(indicator, dtype=float)
    n = len(low)
    m = n * ratio
    if len(ind) != m:
        raise ValueError(f"indicator has {len(ind)} points, expected {m}")
    if method == "proportional" and np.any(ind <= 0):
        raise ValueError("proportional Denton needs a strictly positive indicator")

    a = _aggregation_matrix(n, ratio, how)
    diff = np.diff(np.eye(m), axis=0)
    q = diff.T @ diff

    if method == "proportional":
        # x = D z, minimise ||diff z||^2 subject to A D z = low
        c = a * ind
        rhs = low
    else:
        # x = ind + u, minimise ||diff u||^2 subject to A u = low - A ind
        c = a
        rhs = low - a @ ind

    kkt = np.block([[2 * q, c.T], [c, np.zeros((n, n))]])
    sol = np.linalg.lstsq(kkt, np.concatenate([np.zeros(m), rhs]), rcond=None)[0]
    z = sol[:m]
    return z * ind if method == "proportional" else ind + z


def denton_slsqp(low: np.ndarray, indicator: np.ndarray, ratio: int = 12) -> np.ndarray:
    """Exact copy of the notebook's SLSQP Denton (sum constraint, proportional)."""
    y_low = np.asarray(low, dtype=float)
    x_ind = np.asarray(indicator, dtype=float)
    n = len(y_low)

    def objective(x_estim: np.ndarray) -> float:
        return float(np.sum(np.diff(x_estim / x_ind) ** 2))

    cons = []
    for i in range(n):

        def con_func(x: np.ndarray, i: int = i, t: float = y_low[i]) -> float:
            return float(np.sum(x[i * ratio : (i + 1) * ratio]) - t)

        cons.append({"type": "eq", "fun": con_func})

    x0 = x_ind * (np.sum(y_low) / np.sum(x_ind))
    sol = minimize(objective, x0, constraints=cons, method="SLSQP", options={"disp": False, "maxiter": 1000})
    if not sol.success:
        raise RuntimeError(f"Denton SLSQP failed: {sol.message}")
    return sol.x
