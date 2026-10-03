"""JSON entry points used by the browser worker (Pyodide) and by scripts."""

from __future__ import annotations

import json
from typing import Callable, Optional

import numpy as np

from .checks import prepare
from .longterm import LongTrend, growth_elasticity, select_long_window
from .pipeline import DegnaConfig, export_model, fit_degna, trend_model
from .selection import suggest_drivers

PRESETS = {
    "fast": {"gwo_runs": 3, "gwo_wolves": 40, "gwo_iter": 120},
    "standard": {"gwo_runs": 8, "gwo_wolves": 60, "gwo_iter": 200},
    "paper": {"gwo_runs": 30, "gwo_wolves": 80, "gwo_iter": 200},
}


def check(payload_json: str) -> str:
    report, prepared = prepare(json.loads(payload_json))
    drivers = []
    if prepared is not None and prepared["exogNames"]:
        drivers = suggest_drivers(
            np.array(prepared["target"]), np.array(prepared["exog"]), prepared["exogNames"], prepared["trainEnd"]
        )
    return json.dumps({"items": report.items, "blocked": report.blocked, "prepared": prepared, "drivers": drivers})


def _base_rates(exog: np.ndarray) -> list[float]:
    """Average annual growth of each driver over its last three full years."""
    rates = []
    for j in range(exog.shape[1]):
        col = exog[:, j]
        years = len(col) // 12
        if years < 4:
            rates.append(0.05)
            continue
        totals = col[len(col) - years * 12 :].reshape(years, 12).sum(axis=1)
        if totals[-4] <= 0 or totals[-1] <= 0:
            rates.append(0.05)
            continue
        rate = (totals[-1] / totals[-4]) ** (1 / 3) - 1
        rates.append(float(np.clip(rate, -0.2, 0.3)))
    return rates


def train(prepared_json: str, preset: str = "fast", on_progress: Optional[Callable[[str, float], None]] = None) -> str:
    p = json.loads(prepared_json)
    target = np.array(p["target"], dtype=float)
    keep = p.get("selected")
    exog_all = np.array(p["exog"], dtype=float).reshape(len(target), -1)
    names = p["exogNames"]
    if keep is not None:
        exog_all = exog_all[:, keep] if len(keep) else exog_all[:, :0]
        names = [names[i] for i in keep]

    config = DegnaConfig(n_rules=p.get("nRules", 4), **PRESETS[preset])
    fit = fit_degna(target, exog_all, p["trainEnd"], config, on_progress)
    model_y = fit.model_target
    # Comparison trend for the tool: only meaningful when it follows the drivers
    # (there are drivers and the regression fits with R2 > 0.5); otherwise GM(1,1) only.
    regression = trend_model(fit, "aligned")
    if not regression.use_drivers:
        regression = None

    # Long-term trend (report 4.4): GM(1,1) window re-selected by backtest; scenarios shift
    # it through the elasticity to the first driver, relative to its default growth rate.
    if on_progress is not None:
        on_progress("long", 0.0)
    choice = select_long_window(target, p["months"])
    base_rates = _base_rates(exog_all)
    elasticity = (
        growth_elasticity(target, exog_all[:, 0], p["months"]) if exog_all.shape[1] else None
    )
    long = LongTrend(
        choice.window,
        elasticity.beta if elasticity else 0.0,
        base_rates[0] if base_rates else 0.0,
    )

    degna = {"name": "DeGNA", "spec": f"{config.n_rules} luật", "pred": fit.fitted[fit.n_train :].tolist(), "metrics": fit.test_metrics()}
    months = p["months"][fit.start :]
    return json.dumps(
        {
            "months": months,
            "actual": model_y.tolist(),
            "fitted": fit.fitted.tolist(),
            "testStart": fit.n_train,
            "trend": fit.trend.tolist(),
            "nonlinear": fit.nonlinear.tolist(),
            "models": [degna],
            "exogNames": names,
            "lastYearExog": exog_all[-12:].tolist(),
            "baseRates": base_rates,
            "lastMonth": p["months"][-1],
            "model": export_model(fit, fit.scaler_x, regression, long),
            "longTrend": {
                **choice.to_dict(),
                "driver": names[0] if names else None,
                "elasticity": elasticity.to_dict() if elasticity else None,
            },
            "convergence": fit.history,
        }
    )
