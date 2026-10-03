import json
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from foresight.anfis import ANFIS  # noqa: E402
from foresight.api import check, train  # noqa: E402
from foresight.denton import denton, denton_slsqp  # noqa: E402
from foresight.gwo import gwo_optimize, per_vector  # noqa: E402
from foresight.pipeline import (  # noqa: E402
    DegnaConfig,
    TrendModel,
    export_model,
    fit_degna,
    forecast_degna,
    scenario_exog,
    trend_model,
)

ANNUAL = [462.68, 535.32, 590.23, 612.25, 646.40, 713.53, 801.40, 866.11, 936.09,
          1065.66, 1196.63, 1215.41, 1206.75, 1273.84, 1357.17, 1457.18]
PATTERN = np.array([0.92, 0.78, 1.0, 1.02, 1.08, 1.1, 1.12, 1.08, 1.02, 1.0, 0.97, 0.99])


def monthly_indicator(seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    years = len(ANNUAL)
    level = np.repeat(np.array(ANNUAL) / 12, 12) * 0.3
    return level * np.tile(PATTERN, years) * (1 + 0.02 * rng.standard_normal(years * 12))


def payload(years=ANNUAL, start=2009) -> dict:
    ind = monthly_indicator()[: len(years) * 12]
    months = [f"{start + i // 12}-{i % 12 + 1:02d}" for i in range(len(ind))]
    rng = np.random.default_rng(1)
    iip = np.linspace(40, 140, len(ind)) * np.tile(PATTERN, len(years)) + rng.normal(0, 2, len(ind))
    return {
        "frequency": "annual",
        "how": "sum",
        "target": {"name": "Energy", "periods": [str(start + i) for i in range(len(years))], "values": list(years)},
        "indicator": {"name": "Elec", "periods": months, "values": ind.tolist()},
        "exog": [{"name": "IIP", "periods": months, "values": iip.tolist()}],
    }


def test_denton_matches_slsqp_and_constraints():
    ind = monthly_indicator()
    exact = denton(np.array(ANNUAL), ind)
    np.testing.assert_allclose(exact.reshape(-1, 12).sum(axis=1), ANNUAL, rtol=1e-10)
    iterative = denton_slsqp(np.array(ANNUAL), ind)
    np.testing.assert_allclose(exact, iterative, rtol=5e-3)
    objective = lambda x: np.sum(np.diff(x / ind) ** 2)  # noqa: E731
    assert objective(exact) <= objective(iterative) + 1e-12


def test_denton_mean_and_additive():
    ind = monthly_indicator()
    x = denton(np.array(ANNUAL) / 12, ind, how="mean")
    np.testing.assert_allclose(x.reshape(-1, 12).mean(axis=1), np.array(ANNUAL) / 12, rtol=1e-10)
    shifted = ind - ind.mean()
    y = denton(np.array(ANNUAL), shifted, method="additive")
    np.testing.assert_allclose(y.reshape(-1, 12).sum(axis=1), ANNUAL, rtol=1e-10)


def test_anfis_vectorised_equals_loop():
    rng = np.random.default_rng(3)
    model = ANFIS(4, 4)
    x = rng.random((50, 4))
    pop = rng.uniform(-2, 2, (7, model.n_params))
    many = model.predict_many(x, pop)
    for i in range(7):
        np.testing.assert_allclose(many[i], model.predict(x, pop[i]), rtol=1e-10, atol=1e-12)


def test_gwo_vectorised_matches_exact_path():
    rng = np.random.default_rng(4)
    model = ANFIS(3, 2)
    x, y = rng.random((40, 3)), rng.random(40)
    fast = gwo_optimize(lambda p: model.mse_many(p, x, y), model.n_params, 12, 30, seed=42)
    exact = gwo_optimize(per_vector(lambda p: model.mse(p, x, y)), model.n_params, 12, 30, seed=42)
    assert fast[1] == pytest.approx(exact[1], rel=1e-9)


def test_scenario_exog_keeps_annual_growth():
    last = np.column_stack([np.tile(PATTERN, 1) * 100, np.tile(PATTERN, 1) * 50])
    out = scenario_exog(last, np.array([0.05, 0.10]), years=3)
    totals = out.reshape(3, 12, 2).sum(axis=1)
    np.testing.assert_allclose(totals[:, 0], last[:, 0].sum() * 1.05 ** np.arange(1, 4), rtol=1e-10)
    np.testing.assert_allclose(totals[:, 1], last[:, 1].sum() * 1.10 ** np.arange(1, 4), rtol=1e-10)


def levels(result: dict) -> dict:
    return {i["code"]: i["level"] for i in result["items"]}


def test_check_happy_path():
    result = json.loads(check(json.dumps(payload())))
    assert not result["blocked"]
    assert result["prepared"]["trainEnd"] == 192 - 36 - 1
    assert result["drivers"][0]["name"] == "IIP"


def test_check_blocks_short_and_low_correlation():
    short = json.loads(check(json.dumps(payload(ANNUAL[:5]))))
    assert levels(short).get("too-short") == "block"
    noisy = payload()
    noisy["indicator"]["values"] = list(np.random.default_rng(9).random(192) + 1)
    assert levels(json.loads(check(json.dumps(noisy)))).get("low-corr") == "block"


def test_check_partial_last_year_and_duplicates():
    p = payload()
    p["indicator"]["periods"] = p["indicator"]["periods"][:-4]
    p["indicator"]["values"] = p["indicator"]["values"][:-4]
    p["exog"][0]["periods"] = p["exog"][0]["periods"][:-4]
    p["exog"][0]["values"] = p["exog"][0]["values"][:-4]
    result = json.loads(check(json.dumps(p)))
    assert levels(result).get("partial-period") == "warn"
    assert len(result["prepared"]["target"]) == 180
    dup = payload()
    dup["target"]["periods"].append("2010")
    dup["target"]["values"].append(1.0)
    assert levels(json.loads(check(json.dumps(dup)))).get("duplicate") == "block"


def test_check_interpolates_small_gaps_and_blocks_zeros():
    p = payload()
    p["exog"][0]["values"][50] = None
    result = json.loads(check(json.dumps(p)))
    assert levels(result).get("interpolated") == "warn"
    z = payload()
    z["frequency"] = "monthly"
    z["target"] = {"name": "x", "periods": z["indicator"]["periods"], "values": [0.0] + z["indicator"]["values"][1:]}
    assert levels(json.loads(check(json.dumps(z)))).get("non-positive") == "block"


def test_train_end_to_end_fast():
    prepared = json.loads(check(json.dumps(payload())))["prepared"]
    prepared["selected"] = [0]
    out = json.loads(train(json.dumps(prepared), "fast"))
    assert [m["name"] for m in out["models"]] == ["DeGNA"]
    degna = out["models"][0]["metrics"]
    assert degna["mape"] < 15
    assert len(out["model"]["params"]) == 4 * 3 * 2 + 4 * 4
    trends = out["model"]["trends"]
    assert len(trends["gm11"]["tail"]) == trends["gm11"]["window"] == out["longTrend"]["window"]
    reg = trends["regression"]
    assert reg is None or (reg["useDrivers"] and len(reg["coef"]) == 2)


@pytest.fixture(scope="module")
def small_fit():
    p = payload()
    target = denton(np.array(ANNUAL), np.array(p["indicator"]["values"]))
    exog = np.column_stack([p["exog"][0]["values"], monthly_indicator(5) * 2])
    return fit_degna(target, exog, 155, DegnaConfig(gwo_runs=1, gwo_wolves=10, gwo_iter=10))


def test_trend_model_modes_and_fallback(small_fit):
    aligned = trend_model(small_fit, "aligned")
    paper = trend_model(small_fit, "paper")
    assert aligned.n_hist == paper.n_hist == len(small_fit.trend)
    assert aligned.use_drivers and len(aligned.coef) == 3
    assert not np.allclose(aligned.coef, paper.coef)
    no_drivers = fit_degna(small_fit.target, small_fit.exog[:, :0], 155, small_fit.config)
    line = trend_model(no_drivers, "aligned")
    assert not line.use_drivers and len(line.coef) == 1
    assert line.predict(0, np.zeros(0)) == pytest.approx(line.intercept + line.coef[0] * line.n_hist)


def test_forecast_degna_both_trends(small_fit):
    future = scenario_exog(small_fit.exog[-12:], np.array([0.06, 0.04]), 2)
    reg = trend_model(small_fit, "aligned")
    gm = forecast_degna(small_fit, future, small_fit.scaler_x)
    rg = forecast_degna(small_fit, future, small_fit.scaler_x, reg)
    assert gm.shape == rg.shape == (24,)
    assert np.all(np.isfinite(gm)) and np.all(np.isfinite(rg))
    # The two forecasts share the ANFIS branch; they differ by the trend only.
    nl = gm - _gm_trend(small_fit, 24)
    expected_rg = nl + np.array([reg.predict(i, future[i]) for i in range(24)])
    np.testing.assert_allclose(rg, expected_rg, rtol=1e-10)


def _gm_trend(fit, h):
    from foresight.gm11 import gm11_forecast

    return gm11_forecast(fit.trend, h, fit.config.gm_window)


def test_export_model_has_both_trends(small_fit):
    reg = trend_model(small_fit, "aligned")
    out = export_model(small_fit, small_fit.scaler_x, reg)
    assert out["trends"]["gm11"]["window"] == 12
    np.testing.assert_allclose(out["trends"]["gm11"]["tail"], small_fit.trend[-12:])
    r = out["trends"]["regression"]
    assert set(r) == {"useDrivers", "coef", "intercept", "r2", "nHist"}
    assert r["nHist"] == len(small_fit.trend)
    assert export_model(small_fit, small_fit.scaler_x, None)["trends"]["regression"] is None
    assert isinstance(TrendModel(False, np.array([1.0]), 0.0, 0.0, 3).to_dict()["coef"], list)


def test_long_trend_window_elasticity_and_shift():
    from foresight.longterm import LongTrend, growth_elasticity, growth_factor, select_long_window

    months = [f"{2009 + i // 12}-{i % 12 + 1:02d}" for i in range(192)]
    t = np.arange(192)
    rng = np.random.default_rng(0)
    driver = 50 * 1.06 ** (t / 12) * (1 + 0.05 * np.sin(2 * np.pi * t / 12)) + rng.normal(0, 0.5, 192)
    target = 30 * 1.07 ** (t / 12) * (1 + 0.1 * np.sin(2 * np.pi * t / 12))
    choice = select_long_window(target, months)
    assert choice.window in (12, 24, 36, 48, 60)
    assert choice.origins == ["2014", "2015", "2016", "2017", "2018"]
    assert choice.mape[choice.window] == min(choice.mape.values())
    el = growth_elasticity(target, driver, months)
    assert el.n == 13  # 15 annual growth rates minus 2020 and 2021
    np.testing.assert_allclose(growth_factor(24, 0.5, 0.07, 0.07), np.ones(24))
    np.testing.assert_allclose(growth_factor(24, 0.5, 0.09, 0.07)[11], 1.01, rtol=1e-12)
    path = LongTrend(24, 0.5, 0.07).path(target[-60:], 36, 0.07)
    assert path.shape == (36,) and np.all(np.isfinite(path))


def test_train_reports_long_trend():
    prepared = json.loads(check(json.dumps(payload())))["prepared"]
    out = json.loads(train(json.dumps(prepared), "fast"))
    lt = out["longTrend"]
    assert lt["window"] == out["model"]["trends"]["gm11"]["window"]
    assert len(out["model"]["trends"]["gm11"]["tail"]) == lt["window"]
    assert out["model"]["trends"]["gm11"]["refGrowth"] == out["baseRates"][0]
