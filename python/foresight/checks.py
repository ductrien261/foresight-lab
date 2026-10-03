"""Turn the user's columns into aligned monthly arrays and report every problem
as ok / warn / block, so nothing is fixed silently."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
from statsmodels.tsa.seasonal import STL

from .denton import denton, denton_slsqp

MIN_MONTHS = 72
COMFORT_MONTHS = 120


@dataclass
class Report:
    items: list[dict] = field(default_factory=list)

    def add(self, level: str, code: str, title: str, detail: str = "") -> None:
        self.items.append({"level": level, "code": code, "title": title, "detail": detail})

    @property
    def blocked(self) -> bool:
        return any(i["level"] == "block" for i in self.items)


_Q = re.compile(r"^(\d{4})\s*[-/ ]?\s*[Qq]([1-4])$")
_M = re.compile(r"^(\d{4})[-/.](\d{1,2})(?:[-/.]\d{1,2})?$")
_MY = re.compile(r"^(\d{1,2})[-/.](\d{4})$")
_Y = re.compile(r"^(\d{4})(?:\.0)?$")


def parse_period(label: str, freq: str) -> int:
    """Return a month index (year*12 + month-1) for the period's first month."""
    s = str(label).strip()
    if freq == "annual":
        m = _Y.match(s)
        if m:
            return int(m.group(1)) * 12
    if freq == "quarterly":
        m = _Q.match(s)
        if m:
            return int(m.group(1)) * 12 + (int(m.group(2)) - 1) * 3
    m = _M.match(s)
    if m and 1 <= int(m.group(2)) <= 12:
        return int(m.group(1)) * 12 + int(m.group(2)) - 1
    m = _MY.match(s)
    if m and 1 <= int(m.group(1)) <= 12:
        return int(m.group(2)) * 12 + int(m.group(1)) - 1
    raise ValueError(f"không đọc được mốc thời gian '{label}'")


def month_label(idx: int) -> str:
    return f"{idx // 12:04d}-{idx % 12 + 1:02d}"


def _series(col: dict, freq: str, report: Report, role: str) -> dict[int, float]:
    out: dict[int, float] = {}
    for label, value in zip(col["periods"], col["values"]):
        try:
            key = parse_period(label, freq)
        except ValueError as exc:
            report.add("block", "bad-period", f"{role}: mốc thời gian không hợp lệ", str(exc))
            continue
        v = None if value is None or (isinstance(value, float) and np.isnan(value)) else float(value)
        if key in out and out[key] is not None and v is not None and abs(out[key] - v) > 1e-9:
            report.add("block", "duplicate", f"{role}: trùng mốc thời gian có giá trị khác nhau", month_label(key))
        out[key] = v
    return out


def _fill_monthly(values: dict[int, Optional[float]], start: int, end: int, report: Report, role: str) -> Optional[np.ndarray]:
    idx = np.arange(start, end + 1)
    arr = np.array([values.get(int(i)) if values.get(int(i)) is not None else np.nan for i in idx], dtype=float)
    missing = np.isnan(arr)
    if not missing.any():
        return arr
    runs, run = [], 0
    for flag in missing:
        run = run + 1 if flag else 0
        runs.append(run)
    if missing.mean() > 0.05 or max(runs) > 2 or missing[0] or missing[-1]:
        report.add("block", "missing", f"{role}: thiếu quá nhiều tháng", f"{int(missing.sum())} tháng trống")
        return None
    arr[missing] = np.interp(idx[missing], idx[~missing], arr[~missing])
    report.add(
        "warn",
        "interpolated",
        f"{role}: đã nội suy {int(missing.sum())} tháng trống",
        ", ".join(month_label(int(i)) for i in idx[missing]),
    )
    return arr


def _disaggregate(low: np.ndarray, indicator: np.ndarray, ratio: int, how: str, method: str) -> np.ndarray:
    """Denton–Cholette as in the published notebook (SLSQP) for the usual case of sums
    with a positive indicator, so results match the report; the exact solver otherwise
    or if SLSQP does not converge."""
    if how == "sum" and method == "proportional":
        try:
            return denton_slsqp(low, indicator, ratio=ratio)
        except RuntimeError:
            pass
    return denton(low, indicator, ratio=ratio, how=how, method=method)  # type: ignore[arg-type]


def prepare(payload: dict) -> tuple[Report, Optional[dict]]:
    report = Report()
    freq = payload["frequency"]
    target = _series(payload["target"], freq, report, "Biến mục tiêu")
    exogs = [(c["name"], _series(c, "monthly", report, c["name"])) for c in payload.get("exog", [])]
    if report.blocked:
        return report, None

    if freq == "monthly":
        keys = [k for k, v in target.items() if v is not None]
        start, end = min(keys), max(keys)
        y = _fill_monthly(target, start, end, report, "Biến mục tiêu")
        if y is None:
            return report, None
    else:
        ratio = 12 if freq == "annual" else 3
        ind_col = payload.get("indicator")
        if not ind_col:
            report.add("block", "no-indicator", "Cần một chỉ báo theo tháng để phân rã Denton")
            return report, None
        ind = _series(ind_col, "monthly", report, ind_col["name"])
        lows = sorted(k for k, v in target.items() if v is not None)
        full = [k for k in lows if all(ind.get(k + m) is not None for m in range(ratio))]
        dropped = sorted(set(lows) - set(full))
        if dropped:
            report.add(
                "warn",
                "partial-period",
                "Bỏ các kỳ chỉ báo chưa đủ tháng",
                ", ".join(month_label(k)[: 4 if ratio == 12 else 7] for k in dropped),
            )
        if not full:
            report.add("block", "no-overlap", "Biến mục tiêu và chỉ báo không có kỳ nào trùng nhau")
            return report, None
        gaps = [b - a for a, b in zip(full, full[1:]) if b - a != ratio]
        if gaps:
            report.add("block", "gap", "Biến mục tiêu bị thiếu kỳ ở giữa chuỗi", "Hãy cắt lấy đoạn liên tục")
            return report, None
        start, end = full[0], full[-1] + ratio - 1
        low = np.array([target[k] for k in full])
        indicator = np.array([ind[k] for k in range(start, end + 1)])
        how = payload.get("how", "sum")
        agg = indicator.reshape(-1, ratio)
        agg = agg.sum(axis=1) if how == "sum" else agg.mean(axis=1) if how == "mean" else agg[:, -1]
        r = float(np.corrcoef(low, agg)[0, 1]) if len(low) > 2 else 0.0
        if r < 0.5:
            report.add("block", "low-corr", f"Chỉ báo tương quan yếu với biến mục tiêu (R = {r:.2f})", "Chọn chỉ báo khác")
            return report, None
        if r < 0.8:
            report.add("warn", "mid-corr", f"Tương quan chỉ báo ở mức trung bình (R = {r:.2f})", f"Tính trên {len(low)} kỳ")
        else:
            report.add("ok", "corr", f"Chỉ báo tương quan tốt (R = {r:.2f})", f"Tính trên {len(low)} kỳ")
        method = "proportional" if np.all(indicator > 0) else "additive"
        if method == "additive":
            report.add("warn", "additive", "Chỉ báo có giá trị ≤ 0, dùng Denton dạng cộng")
        y = _disaggregate(low, indicator, ratio, how, method)
        report.add("ok", "denton", f"Đã phân rã {len(low)} kỳ thành {len(y)} tháng")

    n = len(y)
    if np.any(y <= 0):
        report.add("block", "non-positive", "Biến mục tiêu có giá trị ≤ 0", "GM(1,1) và MAPE cần số dương")
    if np.std(y) < 1e-9 * max(1.0, abs(np.mean(y))):
        report.add("block", "constant", "Biến mục tiêu gần như không đổi")
    if n < MIN_MONTHS:
        report.add("block", "too-short", f"Chỉ có {n} tháng, cần ít nhất {MIN_MONTHS}")
    elif n < COMFORT_MONTHS:
        report.add("warn", "short", f"Dữ liệu ngắn ({n} tháng): giảm số luật ANFIS, độ tin cậy thấp hơn")
    else:
        report.add("ok", "length", f"{n} tháng dữ liệu, từ {month_label(start)} đến {month_label(end)}")

    x_cols, names = [], []
    for name, values in exogs:
        col = _fill_monthly(values, start, end, report, name)
        if col is not None:
            x_cols.append(col)
            names.append(name)
    if report.blocked:
        return report, None

    stl = STL(y, period=12, robust=True).fit()
    resid, seas = np.asarray(stl.resid), np.asarray(stl.seasonal)
    strength = max(0.0, 1 - np.var(resid) / max(np.var(seas + resid), 1e-12))
    if strength < 0.3:
        report.add("warn", "weak-season", "Mùa vụ theo năm yếu", f"Độ mạnh mùa vụ {strength:.2f}")
    mad = np.median(np.abs(resid - np.median(resid))) * 1.4826 or 1.0
    out_idx = np.where(np.abs(resid - np.median(resid)) / mad > 4)[0]
    if len(out_idx):
        report.add(
            "warn",
            "outliers",
            f"{len(out_idx)} tháng bất thường (giữ nguyên, chỉ đánh dấu)",
            ", ".join(month_label(start + int(i)) for i in out_idx[:8]),
        )

    years = n // 12
    test_months = 12 * max(1, round(years * 0.2)) if n >= COMFORT_MONTHS else 12
    prepared = {
        "months": [month_label(i) for i in range(start, end + 1)],
        "target": y.tolist(),
        "exog": np.column_stack(x_cols).tolist() if x_cols else [[] for _ in range(n)],
        "exogNames": names,
        "trainEnd": n - test_months - 1,
        "nRules": 4 if n >= COMFORT_MONTHS else 2,
        "seasonStrength": strength,
    }
    return report, prepared
