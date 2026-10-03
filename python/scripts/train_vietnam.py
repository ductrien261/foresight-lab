"""Rebuild the Vietnam model as in notebook v9 and export it for the web.

Training and test evaluation are exactly those of the published notebook (MAPE 4.1052).
Scenario forecasts 2025-2030 follow notebook v9 / report section 4.4:
- trend: recursive GM(1,1) whose window is re-selected by a multi-origin backtest
  (2014-2018, 6-year horizon), shifted per scenario by the elasticity of annual energy
  growth to annual IIP growth (2020-2021 excluded), relative to the Base IIP rate;
- nonlinear: GWO-ANFIS with the scaler fitted on the training months.
A regression of the trend on t, IIP and FDI is exported as a comparison line
(altAnnual / altMonthly).

Usage:  python scripts/train_vietnam.py path/to/Data_Energy_Vietnam.xlsx
Writes: ../src/data/vietnam.json  (takes a few minutes: 30 GWO runs x 80 wolves x 200 iterations)"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
from statsmodels.tsa.seasonal import STL

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from foresight.denton import denton_slsqp  # noqa: E402
from foresight.longterm import LongTrend, growth_elasticity, select_long_window  # noqa: E402
from foresight.pipeline import (  # noqa: E402
    DegnaConfig,
    export_model,
    fit_degna,
    forecast_degna,
    scenario_exog,
    trend_model,
)

PUBLISHED = {"rmse": 5.7620, "mae": 4.5071, "mape": 4.1052, "r2": 0.7977}
SCENARIOS = {  # notebook cell 58
    "low": {"iip": 0.045, "fdi": 0.030, "source": "IMF Article IV, 9/2025"},
    "base": {"iip": 0.065, "fdi": 0.055, "source": "World Bank Taking Stock, 9/2025"},
    "high": {"iip": 0.120, "fdi": 0.090, "source": "Nghị quyết Đại hội XIV, mục tiêu GDP ≥ 10%/năm"},
}


def main(xlsx: Path) -> None:
    df_year = pd.read_excel(xlsx, sheet_name="Yearly_Raw", index_col="Year")
    df_month = pd.read_excel(xlsx, sheet_name="Monthly_Indicators", parse_dates=["Date"], index_col="Date")
    years = df_year.index.intersection(df_month.index.year.unique())
    df_year = df_year.loc[years].sort_index()
    df_month = df_month[df_month.index.year.isin(years)].sort_index()

    energy = denton_slsqp(df_year["Energy_Yearly"].values, df_month["Elec_Sales"].values)
    exog = df_month[["IIP", "FDI"]].values.astype(float)
    months = [d.strftime("%Y-%m") for d in df_month.index]
    train_end = months.index("2021-12")

    t0 = time.time()
    fit = fit_degna(energy, exog, train_end, DegnaConfig(exact=True), lambda s, f: None)
    test = fit.test_metrics()
    print(f"fit {time.time() - t0:.0f}s  test {test}")
    for key, ref in PUBLISHED.items():
        flag = "OK " if abs(test[key] - ref) < 0.01 else "DIFF"
        print(f"  {flag} {key}: {test[key]:.4f} (published {ref})")

    last_year = exog[-12:]
    futures = {k: scenario_exog(last_year, np.array([v["iip"], v["fdi"]]), 6, paper=True) for k, v in SCENARIOS.items()}
    scaler = fit.scaler_x  # notebook v9: keep the training scaler, no refit on future drivers
    reg = trend_model(fit, "aligned")
    choice = select_long_window(energy, months)
    elasticity = growth_elasticity(energy, exog[:, 0], months)
    long = LongTrend(choice.window, elasticity.beta, SCENARIOS["base"]["iip"])
    print(f"long window: {choice.window} months, backtest MAPE {choice.mape} (origins {choice.origins})")
    print(f"elasticity: beta={elasticity.beta:.4f} alpha={elasticity.alpha:.4f} r={elasticity.r:.3f} n={elasticity.n}")
    print(f"trend regression: use_drivers={reg.use_drivers} r2={reg.r2:.4f} coef={np.round(reg.coef, 6).tolist()}")

    def run(trend, sort: bool) -> tuple[dict, dict]:
        cols = [forecast_degna(fit, futures[k], scaler, trend, SCENARIOS[k]["iip"]) for k in SCENARIOS]
        raw = np.column_stack(cols)
        if sort:  # the comparison line keeps Low <= Base <= High month by month
            raw = np.sort(raw, axis=1)
        monthly = {k: raw[:, i] for i, k in enumerate(SCENARIOS)}
        return monthly, {k: v.reshape(6, 12).sum(axis=1) for k, v in monthly.items()}

    monthly, annual = run(long, sort=False)  # main: notebook v9 (no sorting needed)
    alt_monthly, alt_annual = run(reg, sort=True)  # comparison: regression trend on t, IIP, FDI
    bad = sum(int(not (monthly["low"][t] <= monthly["base"][t] <= monthly["high"][t])) for t in range(72))
    print(f"months out of Low <= Base <= High order: {bad}/72")
    for k in SCENARIOS:
        print(f"  GM(1,1)    {k}: {np.round(annual[k], 2).tolist()}")
    for k in SCENARIOS:
        print(f"  regression {k}: {np.round(alt_annual[k], 2).tolist()}")

    stl = STL(fit.model_target, period=12, robust=True).fit()
    seasonal = np.asarray(stl.seasonal)
    model_months = months[fit.start :]
    profile = [float(np.mean([s for m, s in zip(model_months, seasonal) if int(m[5:]) == k + 1])) for k in range(12)]

    out = {
        "meta": {
            "title": "Nhu cầu năng lượng sơ cấp Việt Nam",
            "unit": "tỷ kWh",
            "source": "Data_Energy_Vietnam.xlsx; mô hình DeGNA (CMES, 2026), notebook v9",
            "generated": time.strftime("%Y-%m-%d"),
        },
        "annual": {"years": [int(y) for y in df_year.index], "values": df_year["Energy_Yearly"].round(2).tolist()},
        "monthly": {
            "months": months,
            "energy": np.round(energy, 4).tolist(),
            "iip": exog[:, 0].tolist(),
            "fdi": exog[:, 1].tolist(),
        },
        "test": {
            "months": model_months[fit.n_train :],
            "actual": np.round(fit.model_target[fit.n_train :], 4).tolist(),
            "degna": np.round(fit.fitted[fit.n_train :], 4).tolist(),
        },
        "models": [{"name": "DeGNA", **{k: round(v, 4) for k, v in test.items()}}],
        "walkForwardStd": 1.09,
        "seasonalProfile": profile,
        "scenarios": {
            k: {
                **v,
                "monthly": np.round(monthly[k], 4).tolist(),
                "annual": np.round(annual[k], 2).tolist(),
                "altMonthly": np.round(alt_monthly[k], 4).tolist(),
                "altAnnual": np.round(alt_annual[k], 2).tolist(),
            }
            for k, v in SCENARIOS.items()
        },
        "forecastYears": list(range(2025, 2031)),
        "lastYearExog": last_year.tolist(),
        "model": export_model(fit, scaler, reg, long),
        "longTrend": {**choice.to_dict(), "driver": "IIP", "elasticity": elasticity.to_dict()},
    }
    target = ROOT.parent / "src" / "data" / "vietnam.json"
    target.write_text(json.dumps(out, ensure_ascii=False), encoding='utf-8')
    print(f"wrote {target}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
