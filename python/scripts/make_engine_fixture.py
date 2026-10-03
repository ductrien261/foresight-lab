"""Create src/test/fixtures/engine.json so the TypeScript engine is tested against
the Python reference on the same model, drivers and forecasts."""

import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tests"))

from foresight.denton import denton  # noqa: E402
from foresight.longterm import LongTrend, growth_elasticity, select_long_window  # noqa: E402
from foresight.pipeline import (  # noqa: E402
    DegnaConfig,
    export_model,
    fit_degna,
    forecast_degna,
    scenario_exog,
    trend_model,
)
from test_core import ANNUAL, monthly_indicator, payload  # noqa: E402

p = payload()
target = denton(np.array(ANNUAL), np.array(p["indicator"]["values"]))
exog = np.column_stack([p["exog"][0]["values"], monthly_indicator(5) * 2])
fit = fit_degna(target, exog, 155, DegnaConfig(gwo_runs=2, gwo_wolves=30, gwo_iter=60))
last_year = exog[-12:]
rates = [0.06, 0.04]
future = scenario_exog(last_year, np.array(rates), 3)
reg = trend_model(fit, "aligned")
months = [f"{2009 + i // 12}-{i % 12 + 1:02d}" for i in range(len(target))]
choice = select_long_window(target, months)
beta = growth_elasticity(target, exog[:, 0], months).beta
long = LongTrend(choice.window, beta if abs(beta) > 0.05 else 0.5, 0.03)  # strong enough to test the shift
assert reg.use_drivers, "fixture should exercise the regression with drivers"

out = {
    "denton": {"low": ANNUAL, "indicator": p["indicator"]["values"], "result": target.tolist()},
    "model": export_model(fit, fit.scaler_x, reg, long),
    "lastYear": last_year.tolist(),
    "rates": rates,
    "future": future.tolist(),
    "forecast": {
        "gm11": forecast_degna(fit, future, fit.scaler_x, long, rates[0]).tolist(),
        "gm11Path": forecast_degna(fit, future, fit.scaler_x, long, [0.02, 0.08, 0.05]).tolist(),
        "gm11Plain": forecast_degna(fit, future, fit.scaler_x, long, None).tolist(),
        "regression": forecast_degna(fit, future, fit.scaler_x, reg).tolist(),
    },
}
path = ROOT.parent / "src" / "test" / "fixtures" / "engine.json"
path.write_text(json.dumps(out))
print("wrote", path.relative_to(ROOT.parent).as_posix())
