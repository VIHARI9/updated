from __future__ import annotations

import calendar
import re
import subprocess
import sys
import uuid
from pathlib import Path
from threading import Lock

import numpy as np
import pandas as pd

from .config import settings

REFRESH_LOCK = Lock()
JOBS: dict[str, dict] = {}
FILES = {
    "quality": "Daywise Data.xlsx",
    "mw": "Daywise MW Report.xlsx",
    "plan": "Plan.xlsx",
    "targets": "targets.xlsx",
}


def norm(value: object) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value).lower()).strip()


def read_workbook(path: Path) -> pd.DataFrame:
    frame = pd.read_excel(path, engine="openpyxl")
    frame.columns = [norm(column) for column in frame.columns]
    return frame.dropna(how="all")


def pick(frame: pd.DataFrame, aliases: list[str], default: float = 0.0) -> pd.Series:
    normalized = {norm(column): column for column in frame.columns}
    for alias in aliases:
        key = norm(alias)
        if key in normalized:
            return pd.to_numeric(frame[normalized[key]], errors="coerce").fillna(default)
    return pd.Series(default, index=frame.index, dtype=float)


def pick_date(frame: pd.DataFrame, aliases: list[str]) -> pd.Series:
    normalized = {norm(column): column for column in frame.columns}
    for alias in aliases:
        key = norm(alias)
        if key in normalized:
            return pd.to_datetime(frame[normalized[key]], errors="coerce", dayfirst=True)
    return pd.Series(pd.NaT, index=frame.index, dtype="datetime64[ns]")


def load_targets(path: Path) -> pd.DataFrame:
    """Read the horizontal AOP target workbook and return one row per month."""
    if not path.exists():
        return pd.DataFrame(columns=["period"])
    raw = pd.read_excel(path, header=None, engine="openpyxl")
    dates = pd.to_datetime(raw.iloc[0, 1:], errors="coerce", dayfirst=True)
    aliases = {
        "a grade": "a_yield_target_pct",
        "b grade": "b_yield_target_pct",
        "b el grade": "bel_yield_target_pct",
        "eb": "eb_yield_target_pct",
        "for grade": "or_target_pct",
        "er grade": "er_target_pct",
        "month breakages": "breakage_target_pct",
        "target b bel eb": "secondary_yield_target_pct",
        "wafer loss": "wafer_loss_target_pct",
    }
    result = pd.DataFrame({"period": dates})
    for row_index in range(1, len(raw.index)):
        label = norm(raw.iloc[row_index, 0])
        field = aliases.get(label)
        if not field:
            continue
        values = pd.to_numeric(raw.iloc[row_index, 1:], errors="coerce")
        # Workbook stores ratios (0.925 = 92.5%). API returns percentages.
        result[field] = values.to_numpy(dtype=float) * 100
    return result.dropna(subset=["period"]).sort_values("period").reset_index(drop=True)


def load_data() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    paths = {key: settings.data_dir / name for key, name in FILES.items()}
    required = [paths["quality"], paths["mw"], paths["plan"]]
    missing = [path.name for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError("Missing workbook(s): " + ", ".join(missing))

    mw = read_workbook(paths["mw"])
    quality = read_workbook(paths["quality"])
    plan = read_workbook(paths["plan"])

    daily_mw = pd.DataFrame({
        "period": pick_date(mw, ["date", "day", "production date"]),
        "a_cells": pick(mw, ["a grade saleable", "a-grade saleable"]),
        "b_cells": pick(mw, ["b grade saleable", "b-grade saleable"]),
        "bel_cells": pick(mw, ["b el grade saleable", "b-el grade saleable"]),
        "eb_cells": pick(mw, ["eb grade saleable"]),
        "total_cells": pick(mw, ["total production"]),
        "a_mw": pick(mw, ["a grade saleable mw", "a-grade saleable mw"]),
        "b_mw": pick(mw, ["b grade saleable mw", "b-grade saleable mw"]),
        "bel_mw": pick(mw, ["b el grade saleable mw", "b-el grade saleable mw"]),
        "eb_mw": pick(mw, ["eb grade saleable mw"]),
        "total_mw": pick(mw, ["total production mw"]),
    }).dropna(subset=["period"])

    daily_quality = pd.DataFrame({
        "period": pick_date(quality, ["date", "day", "production date"]),
        "er_rejection_raw": pick(quality, ["er rejection"]),
        "for_rejection_raw": pick(quality, ["for rejection"]),
        "erq_rejection_raw": pick(quality, ["er q rejection", "er(q)rejection"]),
        "total_rejection": pick(quality, ["total rejection"]),
        "rw_breakage": pick(quality, ["r w breakage", "rw breakage"]),
        "bw_breakage": pick(quality, ["b w breakage", "bw breakage"]),
        "alw_breakage": pick(quality, ["al w breakage", "alw breakage"]),
        "agw_breakage": pick(quality, ["ag w breakage", "agw breakage"]),
        "cell_breakage": pick(quality, ["cell breakage"]),
        "total_breakage": pick(quality, ["total breakages", "total breakage"]),
        "a_yield_pct": pick(quality, ["a grade yield", "a-grade yield"]),
        "b_yield_pct": pick(quality, ["b grade yield", "b-grade yield"]),
        "bel_yield_pct": pick(quality, ["b el grade yield", "b-el grade yield"]),
        "eb_yield_pct": pick(quality, ["eb grade yield"]),
        "er_pct_raw": pick(quality, ["er", "er percent", "er pct"]),
        "for_pct_raw": pick(quality, ["for", "for percent", "for pct"]),
        "breakage_pct": pick(quality, ["breakage", "breakage percent", "breakage pct"]),
    }).dropna(subset=["period"])

    daily = daily_mw.merge(daily_quality, on="period", how="left").sort_values("period")
    daily["er_rejection"] = daily["er_rejection_raw"] + daily["erq_rejection_raw"]
    daily["or_rejection"] = daily["for_rejection_raw"]
    # Percentages map directly to workbook columns; ER(Q) is not added again.
    daily["er_pct"] = daily["er_pct_raw"]
    daily["or_pct"] = daily["for_pct_raw"]

    plan_data = pd.DataFrame({
        "period": pick_date(plan, ["month", "period", "date"]),
        "target_mw": pick(plan, ["total target", "target mw", "plan mw"]),
    }).dropna(subset=["period"]).sort_values("period")

    return daily, plan_data, load_targets(paths["targets"])


def fy_label(date: pd.Timestamp) -> str:
    start = date.year if date.month >= 4 else date.year - 1
    return f"FY {start}-{str(start + 1)[-2:]}"


def fy_bounds(label: str) -> tuple[pd.Timestamp, pd.Timestamp]:
    start = int(label.split()[1].split("-")[0])
    return pd.Timestamp(start, 4, 1), pd.Timestamp(start + 1, 3, 31)


def financial_years(frame: pd.DataFrame) -> list[str]:
    return sorted({fy_label(date) for date in frame["period"]}, reverse=True)


def quarter_bounds(fy: str, quarter: str) -> tuple[pd.Timestamp, pd.Timestamp]:
    fy_start, _ = fy_bounds(fy)
    number = int(quarter.upper().replace("Q", ""))
    if number not in (1, 2, 3, 4):
        raise ValueError("Quarter must be Q1, Q2, Q3, or Q4")
    start = fy_start + pd.DateOffset(months=(number - 1) * 3)
    return start, start + pd.DateOffset(months=3) - pd.Timedelta(days=1)


def resolve_overview_period(
    frame: pd.DataFrame,
    fy: str,
    period_type: str = "mtd",
    from_date: str | None = None,
    to_date: str | None = None,
    quarter: str | None = None,
    month: str | None = None,
):
    fy_start, fy_end = fy_bounds(fy)
    fy_data = frame[(frame.period >= fy_start) & (frame.period <= fy_end)].copy()
    if fy_data.empty:
        raise ValueError(f"No data found for {fy}")
    latest = fy_data.period.max()
    kind = (period_type or "mtd").lower()

    if kind == "quarter":
        requested_start, requested_end = quarter_bounds(fy, quarter or "Q1")
        label = (quarter or "Q1").upper()
    elif kind == "month":
        if not month or not re.fullmatch(r"\d{4}-\d{2}", month):
            raise ValueError("Month must use YYYY-MM format")
        requested_start = pd.Timestamp(f"{month}-01")
        requested_end = requested_start + pd.offsets.MonthEnd(1)
        label = "MTD"
    elif kind == "custom":
        if not to_date:
            raise ValueError("A To Date is required for a custom period")
        requested_end = pd.Timestamp(to_date)
        requested_start = pd.Timestamp(from_date) if from_date else requested_end.replace(day=1)
        # Within a single month, MTD always begins on day 1.
        if requested_start.to_period("M") == requested_end.to_period("M"):
            requested_start = requested_end.replace(day=1)
            label = "MTD"
        else:
            label = "Selected Period"
    else:
        requested_end = latest
        requested_start = latest.replace(day=1)
        label = "MTD"
        kind = "mtd"

    requested_start = max(requested_start, fy_start)
    requested_end = min(requested_end, fy_end, latest)
    if requested_start > requested_end:
        raise ValueError("The selected period contains no available data")
    selected = fy_data[(fy_data.period >= requested_start) & (fy_data.period <= requested_end)].copy()
    if selected.empty:
        raise ValueError("The selected period contains no available data")
    as_of = selected.period.max()
    selected = selected[selected.period <= as_of]
    on_date = selected[selected.period == as_of]
    ytd = fy_data[(fy_data.period >= fy_start) & (fy_data.period <= as_of)].copy()
    return fy_start, fy_end, as_of, requested_start, as_of, label, on_date, selected, ytd


def target_for(plan: pd.DataFrame, date: pd.Timestamp) -> float | None:
    row = plan[(plan.period.dt.year == date.year) & (plan.period.dt.month == date.month)]
    return None if row.empty else float(row.iloc[-1].target_mw)


def prorated_target(plan: pd.DataFrame, start: pd.Timestamp, end: pd.Timestamp) -> float | None:
    total = 0.0
    found = False
    cursor = start.replace(day=1)
    while cursor <= end:
        monthly = target_for(plan, cursor)
        month_end = cursor + pd.offsets.MonthEnd(1)
        overlap_start = max(start, cursor)
        overlap_end = min(end, month_end)
        if monthly is not None and overlap_start <= overlap_end:
            found = True
            days = (overlap_end - overlap_start).days + 1
            total += monthly / calendar.monthrange(cursor.year, cursor.month)[1] * days
        cursor = cursor + pd.DateOffset(months=1)
    return total if found else None


def weighted_pct(frame: pd.DataFrame, field: str) -> float:
    weights = frame["total_cells"].where(frame["total_cells"] > 0)
    valid = frame[field].notna() & weights.notna()
    if valid.any() and weights[valid].sum() > 0:
        return float((frame.loc[valid, field] * weights[valid]).sum() / weights[valid].sum())
    value = frame[field].mean()
    return 0.0 if pd.isna(value) else float(value)


def comparison(title: str, actual: float, plan: float | None, unit: str, sparkline: list[dict]) -> dict:
    variance = None if plan is None else actual - plan
    achievement = None if plan in (None, 0) else actual / plan * 100
    return {
        "title": title,
        "actual": actual,
        "plan": plan,
        "variance": variance,
        "achievement_pct": achievement,
        "unit": unit,
        "sparkline": sparkline,
    }


def spark_records(frame: pd.DataFrame, values: pd.Series) -> list[dict]:
    return [
        {"period": period.date().isoformat(), "value": round(float(value), 6)}
        for period, value in zip(frame.period, values)
        if not pd.isna(value)
    ]


def production_row(label: str, cells_field: str, mw_field: str, on_date, selected, ytd) -> dict:
    return {
        "label": label,
        "on_date_cells": float(on_date[cells_field].sum()),
        "on_date_mw": float(on_date[mw_field].sum()),
        "period_cells": float(selected[cells_field].sum()),
        "period_mw": float(selected[mw_field].sum()),
        "ytd_cells": float(ytd[cells_field].sum()),
        "ytd_mw": float(ytd[mw_field].sum()),
    }


def rejection_row(label: str, field: str, on_date, selected, ytd) -> dict:
    return {
        "label": label,
        "on_date_cells": float(on_date[field].sum()),
        "on_date_mw": None,
        "period_cells": float(selected[field].sum()),
        "period_mw": None,
        "ytd_cells": float(ytd[field].sum()),
        "ytd_mw": None,
    }


def overview(
    fy: str,
    period_type: str = "mtd",
    from_date: str | None = None,
    to_date: str | None = None,
    quarter: str | None = None,
    month: str | None = None,
) -> dict:
    daily, plan, _ = load_data()
    fy_start, _, as_of, period_start, period_end, period_label, on_date, selected, ytd = resolve_overview_period(
        daily, fy, period_type, from_date, to_date, quarter, month
    )

    on_actual = float(on_date.total_mw.sum())
    date_plan = prorated_target(plan, as_of, as_of)
    period_actual = float(selected.total_mw.sum())
    period_plan = prorated_target(plan, period_start, period_end)
    ytd_actual_mw = float(ytd.total_mw.sum())

    # YTD KPI compares actual FY production achieved through the effective
    # As Of date against the complete April-to-March financial-year plan.
    # The plan therefore remains fixed for the selected FY, while Actual and
    # the sparkline continue to end at the effective Overview date.
    fy_plan_end = fy_bounds(fy)[1]
    full_fy_plan_mw = prorated_target(plan, fy_start, fy_plan_end)
    # Run Rate follows the effective Overview range. Actual uses available
    # production dates; Required uses the range's prorated plan per calendar day.
    production_days = max(selected.period.nunique(), 1)
    run_rate = period_actual / production_days
    calendar_days = max((period_end.normalize() - period_start.normalize()).days + 1, 1)
    required = None if period_plan is None else period_plan / calendar_days

    selected_sorted = selected.sort_values("period")
    ytd_sorted = ytd.sort_values("period")
    selected_cumulative = selected_sorted.total_mw.cumsum()
    ytd_cumulative = ytd_sorted.total_mw.cumsum()
    run_rate_curve = selected_cumulative / np.arange(1, len(selected_sorted) + 1)

    # Establish the latest/current data date inside the chosen financial year.
    fy_end = fy_bounds(fy)[1]
    fy_data = daily[(daily.period >= fy_start) & (daily.period <= fy_end)].copy()
    latest_data_date = fy_data.period.max()

    # Production-to-date always runs from day 1 of the reference date's month
    # through that reference date. For the default dashboard the reference date
    # is the latest/current data date. For a historical filter it is the selected
    # period's effective end date.
    production_to_date_end = as_of
    production_to_date_start = production_to_date_end.replace(day=1)
    production_to_date_data = fy_data[
        (fy_data.period >= production_to_date_start) &
        (fy_data.period <= production_to_date_end)
    ].sort_values("period")
    production_to_date_actual = float(production_to_date_data.total_mw.sum())
    production_to_date_plan = prorated_target(
        plan, production_to_date_start, production_to_date_end
    )
    production_to_date_cumulative = production_to_date_data.total_mw.cumsum()
    production_to_date_title = (
        "Current month production to date"
        if production_to_date_end == latest_data_date
        else "Production to selected date"
    )

    # Plan Achievement Current Month ignores the Overview filter. Actual is
    # month-to-latest-date production, while Plan is the complete monthly target.
    current_month_as_of = latest_data_date
    current_month_start = current_month_as_of.replace(day=1)
    current_month_data = fy_data[
        (fy_data.period >= current_month_start) &
        (fy_data.period <= current_month_as_of)
    ].sort_values("period")
    current_month_actual = float(current_month_data.total_mw.sum())
    current_month_full_plan = target_for(plan, current_month_as_of)
    current_month_cumulative = current_month_data.total_mw.cumsum()
    current_month_achievement_values = (
        current_month_cumulative.div(current_month_full_plan).mul(100)
        if current_month_full_plan not in (None, 0)
        else None
    )

    distribution = [
        production_row(label, cells_field, mw_field, on_date, selected, ytd)
        for label, cells_field, mw_field in [
            ("A Grade", "a_cells", "a_mw"),
            ("B Grade", "b_cells", "b_mw"),
            ("B-EL", "bel_cells", "bel_mw"),
            ("EB", "eb_cells", "eb_mw"),
        ]
    ]
    good = {
        "label": "Good Cells",
        "on_date_cells": sum(row["on_date_cells"] for row in distribution),
        "on_date_mw": sum(row["on_date_mw"] for row in distribution),
        "period_cells": sum(row["period_cells"] for row in distribution),
        "period_mw": sum(row["period_mw"] for row in distribution),
        "ytd_cells": sum(row["ytd_cells"] for row in distribution),
        "ytd_mw": sum(row["ytd_mw"] for row in distribution),
    }
    distribution.append(good)

    rejection = [
        rejection_row(label, field, on_date, selected, ytd)
        for label, field in [("ER", "er_rejection"), ("OR", "or_rejection"), ("Breakage", "total_breakage")]
    ]
    bad = {
        "label": "Wafer Loss Cells",
        "on_date_cells": sum(row["on_date_cells"] for row in rejection),
        "on_date_mw": None,
        "period_cells": sum(row["period_cells"] for row in rejection),
        "period_mw": None,
        "ytd_cells": sum(row["ytd_cells"] for row in rejection),
        "ytd_mw": None,
    }
    rejection.append(bad)

    yield_fields = [("A Grade", "a_yield_pct"), ("B Grade", "b_yield_pct"), ("B-EL", "bel_yield_pct"), ("EB", "eb_yield_pct")]
    yield_rows = [
        {"label": label, "on_date": weighted_pct(on_date, field), "period": weighted_pct(selected, field), "ytd": weighted_pct(ytd, field)}
        for label, field in yield_fields
    ]
    yield_rows.append({
        "label": "Good Cells",
        "on_date": sum(weighted_pct(on_date, field) for _, field in yield_fields),
        "period": sum(weighted_pct(selected, field) for _, field in yield_fields),
        "ytd": sum(weighted_pct(ytd, field) for _, field in yield_fields),
    })

    rejection_pct_fields = [("ER", "er_pct"), ("OR", "or_pct"), ("Breakage", "breakage_pct")]
    rejection_pct_rows = [
        {"label": label, "on_date": weighted_pct(on_date, field), "period": weighted_pct(selected, field), "ytd": weighted_pct(ytd, field)}
        for label, field in rejection_pct_fields
    ]
    loss_fields = [field for _, field in rejection_pct_fields]
    rejection_pct_rows.append({
        "label": "Wafer Loss",
        "on_date": sum(weighted_pct(on_date, field) for field in loss_fields),
        "period": sum(weighted_pct(selected, field) for field in loss_fields),
        "ytd": sum(weighted_pct(ytd, field) for field in loss_fields),
    })

    return {
        "financial_year": fy,
        "as_of": as_of.date().isoformat(),
        "period": {
            "type": period_type,
            "label": period_label,
            "start": period_start.date().isoformat(),
            "end": period_end.date().isoformat(),
        },
        "kpis": [
            comparison("On-date production", on_actual, date_plan, "MW", spark_records(selected_sorted, selected_sorted.total_mw)),
            comparison(
                production_to_date_title,
                production_to_date_actual,
                production_to_date_plan,
                "MW",
                spark_records(production_to_date_data, production_to_date_data.total_mw),
            ),
            comparison(
                "YTD production",
                ytd_actual_mw / 1000,
                None if full_fy_plan_mw is None else full_fy_plan_mw / 1000,
                "GW",
                spark_records(ytd_sorted, ytd_sorted.total_mw / 1000),
            ),
            comparison("Run rate", run_rate, required, "MW/day", spark_records(selected_sorted, selected_sorted.total_mw)),
            comparison(
                "Plan achievement Current month",
                current_month_actual,
                current_month_full_plan,
                "MW",
                spark_records(current_month_data, current_month_achievement_values) if current_month_achievement_values is not None else [],
            ),
        ],
        "distribution": distribution,
        "rejection": rejection,
        "yield_table": yield_rows,
        "rejection_percentage_table": rejection_pct_rows,
    }


def attach_monthly_targets(data: pd.DataFrame, targets: pd.DataFrame) -> pd.DataFrame:
    if targets.empty:
        return data
    keyed = targets.copy()
    keyed["target_month"] = keyed.period.dt.to_period("M")
    result = data.copy()
    result["target_month"] = result.period.dt.to_period("M")
    fields = [column for column in keyed.columns if column not in {"period", "target_month"}]
    return result.merge(keyed[["target_month", *fields]], on="target_month", how="left").drop(columns="target_month")


def records(frame: pd.DataFrame, columns: list[str]) -> list[dict]:
    result = []
    for _, row in frame.iterrows():
        item = {"period": row.period.date().isoformat()}
        for column in columns:
            item[column] = None if pd.isna(row.get(column)) else float(row.get(column))
        result.append(item)
    return result


def trends(fy: str) -> dict:
    daily, plan, targets = load_data()
    start, end = fy_bounds(fy)
    data = daily[(daily.period >= start) & (daily.period <= end)].copy()
    data["wafer_loss_pct"] = data[["or_pct", "er_pct", "breakage_pct"]].sum(axis=1)
    data["production_target_mw"] = data.period.map(lambda date: (target_for(plan, date) or 0) / calendar.monthrange(date.year, date.month)[1])
    data = attach_monthly_targets(data, targets)
    monthly = data.set_index("period")["total_mw"].resample("MS").agg(["sum", "count"]).reset_index()
    monthly["avg_mw_per_day"] = monthly["sum"] / monthly["count"].replace(0, np.nan)
    monthly["target_mw_per_day"] = monthly.period.map(lambda date: (target_for(plan, date) or np.nan) / calendar.monthrange(date.year, date.month)[1])

    return {
        "production": records(data, ["total_cells", "a_mw", "total_mw", "production_target_mw"]),
        "rejection": records(data, ["er_pct", "or_pct", "breakage_pct", "er_target_pct", "or_target_pct", "breakage_target_pct"]),
        "yield": records(data, ["a_yield_pct", "b_yield_pct", "bel_yield_pct", "eb_yield_pct", "a_yield_target_pct", "b_yield_target_pct", "bel_yield_target_pct", "eb_yield_target_pct", "secondary_yield_target_pct"]),
        "wafer_loss": records(data, ["wafer_loss_pct", "wafer_loss_target_pct"]),
        "breakage": {field: float(data[field].sum()) for field in ["total_breakage", "rw_breakage", "bw_breakage", "alw_breakage", "agw_breakage", "cell_breakage"]},
        "breakage_daily": records(data, ["total_breakage", "rw_breakage", "bw_breakage", "alw_breakage", "agw_breakage", "cell_breakage"]),
        "monthly_average": records(monthly.dropna(subset=["avg_mw_per_day"]), ["avg_mw_per_day", "target_mw_per_day"]),
    }


def run_refresh_job(job_id: str) -> None:
    if not REFRESH_LOCK.acquire(blocking=False):
        JOBS[job_id].update(status="failed", error="Another refresh is already running")
        return
    try:
        JOBS[job_id].update(status="running", progress=10)
        if sys.platform != "win32":
            raise RuntimeError("SAP refresh requires Windows with SAP GUI")
        if not settings.sap_script.exists():
            raise RuntimeError(f"Missing SAP script: {settings.sap_script}")
        result = subprocess.run(
            ["cscript.exe", "//nologo", str(settings.sap_script), str(settings.data_dir)],
            capture_output=True,
            text=True,
            timeout=600,
        )
        if result.returncode:
            raise RuntimeError(result.stdout + result.stderr)
        load_data()
        JOBS[job_id].update(status="completed", progress=100, message=result.stdout.strip())
    except Exception as exc:
        JOBS[job_id].update(status="failed", progress=100, error=str(exc))
    finally:
        REFRESH_LOCK.release()


def create_job() -> dict:
    job_id = str(uuid.uuid4())
    JOBS[job_id] = {"id": job_id, "status": "queued", "progress": 0}
    return JOBS[job_id]
