"""Suggest exogenous drivers: relevance to the part of the series ANFIS models
(seasonal + residual after STL), measured on training months only."""

from __future__ import annotations

import numpy as np
from statsmodels.tsa.seasonal import STL

MAX_DRIVERS = 3
MIN_ABS_R = 0.2
REDUNDANT_R = 0.9


def suggest_drivers(target: np.ndarray, exog: np.ndarray, names: list[str], train_end: int, warmup: int = 13) -> list[dict]:
    y = np.asarray(target, dtype=float)[warmup:]
    x = np.asarray(exog, dtype=float).reshape(len(target), -1)[warmup:]
    n_train = train_end - warmup + 1
    if x.shape[1] == 0:
        return []
    stl = STL(y, period=12, robust=True).fit()
    nonlinear = (np.asarray(stl.seasonal) + np.asarray(stl.resid))[:n_train]

    rows = []
    for j, name in enumerate(names):
        col = x[:n_train, j]
        r = float(np.corrcoef(col, nonlinear)[0, 1]) if np.std(col) > 0 else 0.0
        rows.append({"name": name, "index": j, "r": r, "selected": False, "reason": ""})

    ranked = sorted(rows, key=lambda row: -abs(row["r"]))
    chosen: list[dict] = []
    for row in ranked:
        if abs(row["r"]) < MIN_ABS_R:
            row["reason"] = f"Tương quan yếu (|R| = {abs(row['r']):.2f} < {MIN_ABS_R})"
            continue
        twin = next(
            (c for c in chosen if abs(np.corrcoef(x[:n_train, c["index"]], x[:n_train, row["index"]])[0, 1]) > REDUNDANT_R),
            None,
        )
        if twin is not None:
            row["reason"] = f"Trùng thông tin với {twin['name']}"
            continue
        if len(chosen) >= MAX_DRIVERS:
            row["reason"] = f"Đã đủ {MAX_DRIVERS} biến mạnh hơn"
            continue
        row["selected"] = True
        row["reason"] = f"Liên quan rõ tới phần mùa vụ và biến động (|R| = {abs(row['r']):.2f})"
        chosen.append(row)
    return rows
