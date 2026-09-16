from pathlib import Path
from threading import Thread

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .efficiency_service import build_efficiency_json, efficiency_distribution, efficiency_trend
from .data_service import (
    JOBS,
    create_job,
    financial_years,
    load_data,
    overview,
    run_refresh_job,
    trends,
)


app = FastAPI(
    title="ReNew Solar Dashboard API",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in settings.allowed_origins.split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/financial-years")
def years():
    try:
        daily, _, _ = load_data()
        return {"items": financial_years(daily)}
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        ) from exc


@app.get("/api/overview")
def get_overview(
    fy: str,
    period_type: str = "mtd",
    from_date: str | None = None,
    to_date: str | None = None,
    quarter: str | None = None,
    month: str | None = None,
):
    try:
        return overview(
            fy=fy,
            period_type=period_type,
            from_date=from_date,
            to_date=to_date,
            quarter=quarter,
            month=month,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc



@app.get("/api/efficiency-distribution")
def get_efficiency_distribution(fy: str, as_of: str, mode: str = "on_date"):
    try:
        return efficiency_distribution(fy=fy, as_of=as_of, mode=mode)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/efficiency-trend")
def get_efficiency_trend(
    fy: str,
    mode: str = "mtd",
    as_of: str | None = None,
    month: str | None = None,
):
    try:
        return efficiency_trend(fy=fy, mode=mode, as_of=as_of, month=month)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/efficiency-refresh")
def refresh_efficiency_json():
    try:
        payload = build_efficiency_json(force=True)
        return {"status": "completed", "daily_records": len(payload.get("daily", []))}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/trends")
def get_trends(fy: str):
    try:
        return trends(fy)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@app.post("/api/refresh", status_code=202)
def refresh():
    job = create_job()

    Thread(
        target=run_refresh_job,
        args=(job["id"],),
        daemon=True,
    ).start()

    return job


@app.get("/api/refresh/{job_id}")
def refresh_status(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(
            status_code=404,
            detail="Refresh job not found",
        )

    return JOBS[job_id]


# ---------------------------------------------------------------------------
# React production build
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"
FRONTEND_INDEX = FRONTEND_DIST / "index.html"
FRONTEND_ASSETS = FRONTEND_DIST / "assets"


# Vite places compiled JavaScript and CSS in frontend/dist/assets.
if FRONTEND_ASSETS.exists():
    app.mount(
        "/assets",
        StaticFiles(directory=str(FRONTEND_ASSETS)),
        name="frontend-assets",
    )


@app.get("/", include_in_schema=False)
def frontend_index():
    if not FRONTEND_INDEX.exists():
        raise HTTPException(
            status_code=404,
            detail=(
                "React production build was not found. "
                f"Expected file: {FRONTEND_INDEX}. "
                "Run npm.cmd run build in the frontend folder."
            ),
        )

    return FileResponse(
        path=FRONTEND_INDEX,
        media_type="text/html",
    )


# This catch-all route must remain the final route in this file.
@app.get("/{full_path:path}", include_in_schema=False)
def frontend_routes(full_path: str):
    requested_file = FRONTEND_DIST / full_path

    # Do not allow a URL path to escape the frontend build directory.
    try:
        requested_file.resolve().relative_to(FRONTEND_DIST.resolve())
    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail="File not found",
        ) from exc

    if requested_file.exists() and requested_file.is_file():
        return FileResponse(path=requested_file)

    if FRONTEND_INDEX.exists():
        return FileResponse(
            path=FRONTEND_INDEX,
            media_type="text/html",
        )

    raise HTTPException(
        status_code=404,
        detail=(
            "React production build was not found. "
            f"Expected file: {FRONTEND_INDEX}."
        ),
    )
