from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from .config import settings

GOOD_GRADE_MAP = {"A": "A Grade", "B": "B Grade", "P": "B-EL", "E": "EB"}
GRADES = ["A Grade", "B-EL", "B Grade", "EB"]
JSON_NAME = "sap_efficiency_daily.json"


def norm(value: object) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value).lower()).strip()


def _paths() -> tuple[Path, Path]:
    return settings.data_dir / "Efficiency.xlsx", settings.data_dir / JSON_NAME


def _number(value: object) -> float | None:
    return None if value is None or pd.isna(value) else float(value)


def _iso_date(value: pd.Timestamp) -> str:
    return value.date().isoformat()


def build_efficiency_json(force: bool = False) -> dict:
    """Build daily SAP/Halm efficiencies and daily SAP grade-band distribution.

    SAP daily efficiency is exactly SUM(row MW * row Efficiency) / SUM(row MW)
    for the same Created on date and good grades A, B, P and E.
    """
    workbook_path, json_path = _paths()
    if not workbook_path.exists():
        raise FileNotFoundError(f"Missing workbook: {workbook_path.name}")
    if not force and json_path.exists() and json_path.stat().st_mtime_ns >= workbook_path.stat().st_mtime_ns:
        return json.loads(json_path.read_text(encoding="utf-8"))

    book = pd.ExcelFile(workbook_path, engine="openpyxl")
    sheets = {str(name).strip().lower(): name for name in book.sheet_names}
    if "sap" not in sheets or "halm" not in sheets:
        raise ValueError("Efficiency.xlsx must contain Halm and SAP sheets")

    sap = pd.read_excel(
        book,
        sheet_name=sheets["sap"],
        usecols=lambda column: norm(column) in {
            "mw", "target cell product description", "efficiency", "grade", "quantity", "created on"
        },
    )
    sap.columns = [norm(column) for column in sap.columns]
    sap["period"] = pd.to_datetime(sap["created on"], errors="coerce", dayfirst=True).dt.normalize()
    sap["mw"] = pd.to_numeric(sap["mw"], errors="coerce")
    sap["efficiency"] = pd.to_numeric(sap["efficiency"], errors="coerce")
    sap["quantity"] = pd.to_numeric(sap["quantity"], errors="coerce")
    sap["grade_name"] = sap["grade"].astype(str).str.strip().str.upper().map(GOOD_GRADE_MAP)
    description = sap["target cell product description"].fillna("").astype(str)
    sap = sap[
        sap["period"].notna()
        & sap["grade_name"].notna()
        & ~description.str.contains(r"reject|rejection", case=False, regex=True, na=False)
        & sap["efficiency"].notna()
    ].copy()
    sap["efficiency_band"] = np.floor(sap["efficiency"] * 10 + 1e-9) / 10

    weighted = sap[(sap["mw"] > 0) & (sap["efficiency"] > 0)].copy()
    weighted["mw_x_efficiency"] = weighted["mw"] * weighted["efficiency"]
    sap_daily = weighted.groupby("period", as_index=False).agg(
        sum_mw_x_efficiency=("mw_x_efficiency", "sum"),
        sum_mw=("mw", "sum"),
    )
    sap_daily["sap_efficiency"] = sap_daily["sum_mw_x_efficiency"] / sap_daily["sum_mw"].replace(0, np.nan)

    distribution = sap.groupby(["period", "efficiency_band", "grade_name"], as_index=False).agg(
        cells=("quantity", lambda values: values.sum(min_count=1)),
        mw=("mw", lambda values: values.sum(min_count=1)),
    )

    halm = pd.read_excel(
        book,
        sheet_name=sheets["halm"],
        usecols=lambda column: norm(column) in {
            "date", "cells tested halm", "average eff halm", "halm avg efficiency"
        },
    )
    halm.columns = [norm(column) for column in halm.columns]
    efficiency_column = "average eff halm" if "average eff halm" in halm.columns else "halm avg efficiency"
    halm["period"] = pd.to_datetime(halm["date"], errors="coerce", dayfirst=True).dt.normalize()
    halm["halm_efficiency"] = pd.to_numeric(halm[efficiency_column], errors="coerce")
    halm["halm_cells"] = pd.to_numeric(halm.get("cells tested halm"), errors="coerce")
    halm = halm.dropna(subset=["period", "halm_efficiency"])
    halm["halm_cells_x_efficiency"] = halm["halm_cells"] * halm["halm_efficiency"]
    halm_daily = halm.groupby("period", as_index=False).agg(
        halm_efficiency=("halm_efficiency", "mean"),
        halm_cells=("halm_cells", lambda values: values.sum(min_count=1)),
        halm_cells_x_efficiency=("halm_cells_x_efficiency", lambda values: values.sum(min_count=1)),
    )

    combined = sap_daily.merge(halm_daily, on="period", how="outer").sort_values("period")
    daily = [
        {
            "date": _iso_date(row.period),
            "sum_mw_x_efficiency": _number(row.get("sum_mw_x_efficiency")),
            "sum_mw": _number(row.get("sum_mw")),
            "sap_efficiency": _number(row.get("sap_efficiency")),
            "halm_efficiency": _number(row.get("halm_efficiency")),
            "halm_cells": _number(row.get("halm_cells")),
            "halm_cells_x_efficiency": _number(row.get("halm_cells_x_efficiency")),
        }
        for _, row in combined.iterrows()
    ]
    distribution_daily = [
        {
            "date": _iso_date(row.period),
            "efficiency": float(row.efficiency_band),
            "grade": str(row.grade_name),
            "cells": _number(row.cells),
            "mw": _number(row.mw),
        }
        for _, row in distribution.iterrows()
    ]
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": workbook_path.name,
        "date_field": "Created on",
        "formula": "SUM(MW * Efficiency) / SUM(MW)",
        "daily": daily,
        "distribution_daily": distribution_daily,
    }
    json_path.write_text(json.dumps(payload, indent=2, allow_nan=False), encoding="utf-8")
    return payload


def _payload() -> dict:
    return build_efficiency_json(force=False)


def _fy_bounds(fy: str) -> tuple[pd.Timestamp, pd.Timestamp]:
    start_year = int(fy.split()[1].split("-")[0])
    return pd.Timestamp(start_year, 4, 1), pd.Timestamp(start_year + 1, 3, 31)


def _daily_frame(payload: dict) -> pd.DataFrame:
    frame = pd.DataFrame(payload.get("daily", []))
    if frame.empty:
        return frame
    frame["period"] = pd.to_datetime(frame["date"], errors="coerce")
    return frame.dropna(subset=["period"]).sort_values("period")


def efficiency_trend(fy: str, mode: str = "mtd", as_of: str | None = None, month: str | None = None) -> dict:
    """Read graph values from JSON.

    on_date: one daily point; month: all available daily points in YYYY-MM;
    mtd: all daily points from month start through as_of; ytd: one weighted
    point per FY month, with the final month ending at its last available date.
    """
    frame = _daily_frame(_payload())
    fy_start, fy_end = _fy_bounds(fy)
    frame = frame[(frame.period >= fy_start) & (frame.period <= fy_end)].copy()
    if frame.empty:
        return {"mode": mode, "items": []}
    effective_end = min(pd.Timestamp(as_of).normalize(), frame.period.max()) if as_of else frame.period.max()
    selected_mode = mode.lower()
    if selected_mode == "on_date":
        view = frame[frame.period == effective_end].copy()
    elif selected_mode == "month":
        selected_month = pd.Period(month or effective_end.strftime("%Y-%m"), freq="M")
        view = frame[frame.period.dt.to_period("M") == selected_month].copy()
    elif selected_mode == "mtd":
        view = frame[(frame.period >= effective_end.replace(day=1)) & (frame.period <= effective_end)].copy()
    elif selected_mode == "ytd":
        view = frame[(frame.period >= fy_start) & (frame.period <= effective_end)].copy()
        view["month"] = view.period.dt.to_period("M")
        monthly_rows = []
        for period, group in view.groupby("month", sort=True):
            sum_product = pd.to_numeric(group["sum_mw_x_efficiency"], errors="coerce").sum(min_count=1)
            sum_mw = pd.to_numeric(group["sum_mw"], errors="coerce").sum(min_count=1)
            halm_product = pd.to_numeric(group["halm_cells_x_efficiency"], errors="coerce").sum(min_count=1)
            halm_cells = pd.to_numeric(group["halm_cells"], errors="coerce").sum(min_count=1)
            monthly_rows.append({
                "period": period.start_time.date().isoformat(),
                "period_end": group.period.max().date().isoformat(),
                "sap_efficiency": None if pd.isna(sum_product) or pd.isna(sum_mw) or sum_mw <= 0 else float(sum_product / sum_mw),
                "halm_efficiency": None if pd.isna(halm_product) or pd.isna(halm_cells) or halm_cells <= 0 else float(halm_product / halm_cells),
            })
        return {"mode": "ytd", "items": monthly_rows}
    else:
        raise ValueError("Mode must be on_date, month, mtd, or ytd")
    return {
        "mode": selected_mode,
        "items": [
            {
                "period": row.period.date().isoformat(),
                "sap_efficiency": _number(row.get("sap_efficiency")),
                "halm_efficiency": _number(row.get("halm_efficiency")),
            }
            for _, row in view.iterrows()
        ],
    }


def efficiency_distribution(fy: str, as_of: str, mode: str = "on_date") -> dict:
    payload = _payload()
    frame = pd.DataFrame(payload.get("distribution_daily", []))
    end = pd.Timestamp(as_of).normalize()
    fy_start, fy_end = _fy_bounds(fy)
    end = min(end, fy_end)
    selected_mode = mode.lower()
    if selected_mode == "on_date":
        start, label = end, "On Date"
    elif selected_mode == "mtd":
        start, label = end.replace(day=1), "MTD"
    elif selected_mode == "ytd":
        start, label = fy_start, "YTD"
    else:
        raise ValueError("Mode must be on_date, mtd, or ytd")
    if frame.empty:
        return {"mode": selected_mode, "label": label, "start": _iso_date(start), "end": _iso_date(end), "rows": [], "totals": []}
    frame["period"] = pd.to_datetime(frame["date"], errors="coerce")
    data = frame[(frame.period >= start) & (frame.period <= end)].copy()
    denominator = pd.to_numeric(data["cells"], errors="coerce").sum(min_count=1)
    denominator = 0.0 if pd.isna(denominator) else float(denominator)
    grouped = data.groupby(["efficiency", "grade"], as_index=False).agg(
        cells=("cells", lambda values: pd.to_numeric(values, errors="coerce").sum(min_count=1)),
        mw=("mw", lambda values: pd.to_numeric(values, errors="coerce").sum(min_count=1)),
    )
    rows, cumulative = [], 0.0
    for band in sorted(grouped.efficiency.dropna().unique(), reverse=True):
        row = {"efficiency": float(band), "grades": {}}
        for grade in GRADES:
            hit = grouped[(grouped.efficiency == band) & (grouped.grade == grade)]
            if hit.empty:
                row["grades"][grade] = {"cells": None, "mw": None, "distribution_pct": None, "cumulative_mw": None}
                continue
            cells, mw = _number(hit.iloc[0].cells), _number(hit.iloc[0].mw)
            if grade == "A Grade" and mw is not None:
                cumulative += mw
            row["grades"][grade] = {
                "cells": cells,
                "mw": mw,
                "distribution_pct": None if cells is None or denominator <= 0 else cells / denominator * 100,
                "cumulative_mw": cumulative if grade == "A Grade" and mw is not None else None,
            }
        rows.append(row)
    totals = []
    for grade in GRADES:
        subset = data[data.grade == grade]
        cells = _number(pd.to_numeric(subset.cells, errors="coerce").sum(min_count=1))
        mw = _number(pd.to_numeric(subset.mw, errors="coerce").sum(min_count=1))
        totals.append({"grade": grade, "cells": cells, "mw": mw, "distribution_pct": None if cells is None or denominator <= 0 else cells / denominator * 100})
    return {"mode": selected_mode, "label": label, "start": _iso_date(start), "end": _iso_date(end), "rows": rows, "totals": totals}
