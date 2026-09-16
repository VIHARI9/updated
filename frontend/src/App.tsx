import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Info,
  LayoutDashboard,
  Leaf,
  Maximize2,
  Minus,
  Moon,
  Percent,
  RefreshCw,
  Sun,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api } from "./api";


type SparkPoint = { period: string; value: number };
type KPI = { title: string; actual: number; plan: number | null; variance: number | null; achievement_pct: number | null; unit: string; sparkline?: SparkPoint[] };
type ProductionRow = { label: string; on_date_cells: number; on_date_mw: number | null; period_cells: number; period_mw: number | null; ytd_cells: number; ytd_mw: number | null };
type PercentageRow = { label: string; on_date: number; period: number; ytd: number };
type Overview = { as_of: string; period: { type: string; label: string; start: string; end: string }; kpis: KPI[]; distribution: ProductionRow[]; rejection: ProductionRow[]; yield_table: PercentageRow[]; rejection_percentage_table: PercentageRow[] };
type Trends = { production: any[]; rejection: any[]; yield: any[]; wafer_loss: any[]; breakage: Record<string, number>; breakage_daily?: any[]; monthly_average: any[] };
type EfficiencyGrade = { cells: number | null; mw: number | null; distribution_pct: number | null; cumulative_mw: number | null };
type EfficiencyDistribution = { mode: string; label: string; start: string; end: string; rows: { efficiency: number; grades: Record<string, EfficiencyGrade> }[]; totals: { grade: string; cells: number | null; mw: number | null; distribution_pct: number | null }[] };
const fmt = (
  value: number | null | undefined,
  decimals = 2,
) =>
  value == null
    ? "N/A"
    : Number(value).toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });


const tableFmt = (value: number | null | undefined, decimals = 2) => value == null ? "" : fmt(value, decimals);
const percentTick = (value: number) =>
  `${Number(value).toFixed(2)}%`;


const shortDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
    },
  );


const monthLabel = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString(
    "en-GB",
    {
      month: "short",
      year: "2-digit",
    },
  );


const cellTick = (value: number) => {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k`;
  }

  return `${value}`;
};


const axis = {
  tick: {
    fill: "#43544a",
    fontSize: 11,
    fontWeight: 600,
  },
  tickLine: false,
  axisLine: {
    stroke: "#aebbb3",
  },
};


function KpiSparkline({ color, id, points = [] }: { color: string; id: string; points?: SparkPoint[] }) {
  const values = points.map((point) => Number(point.value)).filter(Number.isFinite);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const range = max - min || 1;
  const coords = values.map((value, index) => `${values.length <= 1 ? 0 : (index / (values.length - 1)) * 260},${36 - ((value - min) / range) * 28}`);
  return <svg className="kpiSparkline" viewBox="0 0 260 42" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.24"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>{coords.length > 1 && <><polygon fill={`url(#${id})`} points={`0,42 ${coords.join(" ")} 260,42`}/><polyline className="sparkLine" stroke={color} points={coords.join(" ")}/></>}</svg>;
}
function KpiCard({ k, index }: { k: KPI; index: number }) {
  const targetLabel = k.title === "Run rate" ? "Required" : "Plan";
  const achievement = k.plan && k.plan > 0 ? (k.actual / k.plan) * 100 : (k.achievement_pct ?? 0);
  const cappedWidth = Math.min(Math.max(achievement, 0), 120) / 1.2;
  const gap = k.plan == null ? null : k.plan - k.actual;
  const status = achievement < 50 ? "critical" : achievement < 75 ? "high-gap" : achievement < 90 ? "moderate" : achievement < 100 ? "near" : achievement <= 105 ? "achieved" : "exceeding";
  const statusColor = `var(--status-${status})`;
  const iconMap = [CalendarDays, BarChart3, TrendingUp, Zap, Target];
  const FeatureIcon = iconMap[index] ?? BarChart3;

  return (
    <article className={`kpi status-${status}`}>
      <div className="kpiHeader">
        <div className={`kpiIcon kpiIcon${index + 1}`}><FeatureIcon /></div>
        <div className="kpiTitle"><span className="statusDot" style={{ background: statusColor }} />{k.title}</div>
        <ChevronRight className="kpiChevron" />
      </div>

      <div className="compare">
        <div>
          <small>{targetLabel}</small>
          <strong>{fmt(k.plan)}</strong>
          <em>{k.unit}</em>
        </div>
        <i />
        <div>
          <small>Actual</small>
          <strong>{fmt(k.actual)}</strong>
          <em>{k.unit}</em>
        </div>
      </div>

      <div className="performanceTrack" aria-label={`${fmt(achievement, 1)} percent achieved`}>
        <span style={{ width: `${cappedWidth}%`, background: statusColor }} />
      </div>

      <footer>
        <b style={{ color: statusColor }}>
          {gap == null ? "Comparison unavailable" : `${gap > 0 ? "-" : "+"}${fmt(Math.abs(gap))} ${k.unit}`}
        </b>
        <span>{k.plan == null ? "" : `${fmt(achievement, 1)}% achieved`}</span>
      </footer>
      <KpiSparkline color={statusColor} id={`spark-${index}`} points={k.sparkline} />
    </article>
  );
}
function Chart({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel chartPanel">
      <div className="chartHeading">
        <div>
          <h2>{title}</h2>

          {subtitle && (
            <p>{subtitle}</p>
          )}
        </div>
      </div>

      <div className="chart">
        {children}
      </div>
    </section>
  );
}


function TooltipBox({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const raw = String(label ?? "");
  const heading = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? shortDate(raw) : raw;
  const order: Record<string, number> = { "Overall MW": 1, "A Grade MW": 2, "Total Saleable Cells": 3, "Target MW": 4 };
  const items = [...payload].sort((a: any, b: any) => (order[String(a.name)] ?? 99) - (order[String(b.name)] ?? 99));
  return <div className="tooltip"><b>{heading}</b>{items.map((item: any) => <span key={`${item.dataKey}-${item.name}`} style={{color:item.color}}>{item.name}: {fmt(item.value,2)}{String(item.name).includes("%") ? "%" : ""}</span>)}</div>;
}
export default function App() {
  const [tab, setTab] =
    useState("overview");

  const [years, setYears] =
    useState<string[]>([]);

  const [fy, setFy] =
    useState("");

  const [overview, setOverview] =
    useState<Overview | null>(null);

  const [trends, setTrends] =
    useState<Trends | null>(null);

  const [error, setError] =
    useState("");

  const [refreshing, setRefreshing] =
    useState(false);

  const [fromDate, setFromDate] =
    useState("");

  const [toDate, setToDate] =
    useState("");

  const [overviewPeriodType, setOverviewPeriodType] = useState<"mtd" | "custom" | "month" | "quarter">("mtd");
  const [overviewFromDate, setOverviewFromDate] = useState("");
  const [overviewToDate, setOverviewToDate] = useState("");
  const [overviewQuarter, setOverviewQuarter] = useState("Q1");
  const [overviewMonth, setOverviewMonth] = useState("");
  const [efficiencyMode, setEfficiencyMode] = useState<"on_date" | "mtd" | "ytd">("on_date");
  const [efficiencyDistribution, setEfficiencyDistribution] = useState<EfficiencyDistribution | null>(null);
  const [efficiencyTrend, setEfficiencyTrend] = useState<any[]>([]);
  const [efficiencyTrendMode, setEfficiencyTrendMode] = useState<"on_date" | "month" | "mtd" | "ytd">("mtd");
  const [efficiencyTrendMonth, setEfficiencyTrendMonth] = useState("");
  const [theme, setTheme] =
    useState<"light" | "dark">(() => {
      const savedTheme =
        window.localStorage.getItem(
          "solar-dashboard-theme",
        );

      if (
        savedTheme === "light" ||
        savedTheme === "dark"
      ) {
        return savedTheme;
      }

      const prefersDarkMode =
        window.matchMedia(
          "(prefers-color-scheme: dark)",
        ).matches;

      return prefersDarkMode
        ? "dark"
        : "light";
    });


  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      theme,
    );

    window.localStorage.setItem(
      "solar-dashboard-theme",
      theme,
    );
  }, [theme]);


  const load = async (
    value: string,
  ) => {
    const [
      overviewData,
      trendsData,
    ] = await Promise.all([
      api.get<Overview>(`/api/overview?${new URLSearchParams({ fy: value, period_type: overviewPeriodType, ...(overviewFromDate ? { from_date: overviewFromDate } : {}), ...(overviewToDate ? { to_date: overviewToDate } : {}), ...(overviewPeriodType === "quarter" ? { quarter: overviewQuarter } : {}), ...(overviewPeriodType === "month" && overviewMonth ? { month: overviewMonth } : {}) }).toString()}`),
      api.get<Trends>(
        `/api/trends?fy=${encodeURIComponent(
          value,
        )}`,
      ),
    ]);

    setOverview(overviewData);
    setTrends(trendsData);
  };


  useEffect(() => {
    api
      .get<{ items: string[] }>(
        "/api/financial-years",
      )
      .then((response) => {
        setYears(response.items);
        setFy(response.items[0] || "");
      })
      .catch((reason) => {
        setError(String(reason));
      });
  }, []);


  useEffect(() => {
    if (!fy) {
      return;
    }

    setError("");

    load(fy).catch((reason) => {
      setError(String(reason));
    });
  }, [fy, overviewPeriodType, overviewFromDate, overviewToDate, overviewQuarter, overviewMonth]);
  


  useEffect(() => {
    if (!fy || !overview?.as_of) return;
    api.get<EfficiencyDistribution>(`/api/efficiency-distribution?${new URLSearchParams({ fy, as_of: overview.as_of, mode: efficiencyMode }).toString()}`)
      .then(setEfficiencyDistribution)
      .catch((reason) => setError(String(reason)));
  }, [fy, overview?.as_of, efficiencyMode]);

  useEffect(() => {
    if (!fy) return;
    const params = new URLSearchParams({
      fy,
      mode: efficiencyTrendMode,
      ...(overview?.as_of ? { as_of: overview.as_of } : {}),
      ...(efficiencyTrendMode === "month" && efficiencyTrendMonth ? { month: efficiencyTrendMonth } : {}),
    });
    api.get<{ items: any[] }>(`/api/efficiency-trend?${params.toString()}`)
      .then((response) => setEfficiencyTrend(response.items ?? []))
      .catch((reason) => setError(String(reason)));
  }, [fy, overview?.as_of, efficiencyTrendMode, efficiencyTrendMonth]);

  async function refresh() {
    setRefreshing(true);
    setError("");

    try {
      const job = await api.post<any>(
        "/api/refresh",
      );

      const timer =
        window.setInterval(
          async () => {
            const status =
              await api.get<any>(
                `/api/refresh/${job.id}`,
              );

            if (
              status.status ===
                "completed" ||
              status.status ===
                "failed"
            ) {
              clearInterval(timer);
              setRefreshing(false);

              if (
                status.status ===
                "failed"
              ) {
                setError(status.error);
              } else {
                await load(fy);
              }
            }
          },
          1500,
        );
    } catch (reason) {
      setRefreshing(false);
      setError(String(reason));
    }
  }


  const trendDateBounds = useMemo(() => {
    const periods = (trends?.production ?? [])
      .map((row: any) => String(row.period ?? ""))
      .filter(Boolean)
      .sort();

    return {
      min: periods[0] ?? "",
      max: periods[periods.length - 1] ?? "",
    };
  }, [trends]);


  useEffect(() => {
    setFromDate(trendDateBounds.min);
    setToDate(trendDateBounds.max);
    setOverviewToDate(trendDateBounds.max);
    setOverviewFromDate(trendDateBounds.max ? `${trendDateBounds.max.slice(0,7)}-01` : "");
    setOverviewMonth(trendDateBounds.max.slice(0,7));
  }, [fy, trendDateBounds.min, trendDateBounds.max]);


  const inSelectedRange = (period: string) => {
    if (!period) {
      return false;
    }

    return (
      (!fromDate || period >= fromDate) &&
      (!toDate || period <= toDate)
    );
  };


  const filteredProduction = useMemo(
    () => (trends?.production ?? []).filter(
      (row: any) => inSelectedRange(String(row.period ?? "")),
    ),
    [trends, fromDate, toDate],
  );

  const filteredRejection = useMemo(
    () => (trends?.rejection ?? []).filter(
      (row: any) => inSelectedRange(String(row.period ?? "")),
    ),
    [trends, fromDate, toDate],
  );

  const filteredYield = useMemo(
    () => (trends?.yield ?? []).filter(
      (row: any) => inSelectedRange(String(row.period ?? "")),
    ),
    [trends, fromDate, toDate],
  );

  const filteredWaferLoss = useMemo(
    () => (trends?.wafer_loss ?? []).filter(
      (row: any) => inSelectedRange(String(row.period ?? "")),
    ),
    [trends, fromDate, toDate],
  );

  const filteredMonthlyAverage = useMemo(() => {
    const monthly = new Map<string, { total: number; count: number }>();

    for (const row of filteredProduction) {
      const month = String(row.period ?? "").slice(0, 7);
      if (!month) continue;

      const current = monthly.get(month) ?? { total: 0, count: 0 };
      current.total += Number(row.total_mw) || 0;
      current.count += 1;
      monthly.set(month, current);
    }

    return Array.from(monthly.entries()).map(([month, value]) => ({
      period: `${month}-01`,
      avg_mw_per_day: value.count ? value.total / value.count : 0,
    }));
  }, [filteredProduction]);


  const breakage = useMemo(() => {
    const fields = [
      "total_breakage",
      "rw_breakage",
      "bw_breakage",
      "alw_breakage",
      "agw_breakage",
      "cell_breakage",
    ];

    const labels: Record<string, string> = {
      total_breakage: "Total Breakage",
      rw_breakage: "R-W Breakage",
      bw_breakage: "B-W Breakage",
      alw_breakage: "AL-W Breakage",
      agw_breakage: "AG-W Breakage",
      cell_breakage: "Cell Breakage",
    };

    const dailyRows = (trends?.breakage_daily ?? []).filter(
      (row: any) => inSelectedRange(String(row.period ?? "")),
    );

    if (dailyRows.length) {
      return fields.map((field) => ({
        name: labels[field],
        value: dailyRows.reduce(
          (sum: number, row: any) => sum + (Number(row[field]) || 0),
          0,
        ),
      }));
    }

    return fields.map((field) => ({
      name: labels[field],
      value: Number(trends?.breakage?.[field]) || 0,
    }));
  }, [trends, fromDate, toDate]);


  return (
    <div className="app">
      <header className="dashboardHeader">
        <img src="/company_logo.png" alt="Company logo" />

        <div className="brand">
          <h1>
            SOLAR MANUFACTURING DASHBOARD
          </h1>

          <p>
            Final Product - Production and
            Quality Intelligence
          </p>
        </div>

        <div className="controls">
          <label>
            Financial year

            <select
              value={fy}
              onChange={(event) =>
                setFy(event.target.value)
              }
            >
              {years.map((year) => (
                <option key={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          {tab === "overview" && <><label>Period<select value={overviewPeriodType} onChange={(e)=>setOverviewPeriodType(e.target.value as typeof overviewPeriodType)}><option value="mtd">Current MTD</option><option value="custom">Custom Range</option><option value="month">Month</option><option value="quarter">Quarter</option></select></label>{overviewPeriodType === "custom" && <><label>From date<input type="date" value={overviewFromDate} min={trendDateBounds.min} max={overviewToDate || trendDateBounds.max} onChange={(e)=>setOverviewFromDate(e.target.value)}/></label><label>To date<input type="date" value={overviewToDate} min={overviewFromDate || trendDateBounds.min} max={trendDateBounds.max} onChange={(e)=>setOverviewToDate(e.target.value)}/></label></>}{overviewPeriodType === "month" && <label>Month<input type="month" value={overviewMonth} min={trendDateBounds.min.slice(0,7)} max={trendDateBounds.max.slice(0,7)} onChange={(e)=>setOverviewMonth(e.target.value)}/></label>}{overviewPeriodType === "quarter" && <label>Quarter<select value={overviewQuarter} onChange={(e)=>setOverviewQuarter(e.target.value)}><option>Q1</option><option>Q2</option><option>Q3</option><option>Q4</option></select></label>}</>}
          {tab === "trends" && (
            <>
              <label>
                From date
                <input
                  type="date"
                  value={fromDate}
                  min={trendDateBounds.min}
                  max={toDate || trendDateBounds.max}
                  onChange={(event) => setFromDate(event.target.value)}
                  style={{
                    display: "block",
                    minWidth: 145,
                    marginTop: 5,
                    padding: "10px 11px",
                    color: "#17271f",
                    background: "#ffffff",
                    border: "1px solid #c9d9cb",
                    borderRadius: 10,
                  }}
                />
              </label>

              <label>
                To date
                <input
                  type="date"
                  value={toDate}
                  min={fromDate || trendDateBounds.min}
                  max={trendDateBounds.max}
                  onChange={(event) => setToDate(event.target.value)}
                  style={{
                    display: "block",
                    minWidth: 145,
                    marginTop: 5,
                    padding: "10px 11px",
                    color: "#17271f",
                    background: "#ffffff",
                    border: "1px solid #c9d9cb",
                    borderRadius: 10,
                  }}
                />
              </label>
            </>
          )}

          <div className="asof">
            AS OF
            <b>
              {overview?.as_of || "-"}
            </b>
          </div>
          <button
            type="button"
            className="themeToggle"
            onClick={() => setTheme((currentTheme) => currentTheme === "light" ? "dark" : "light")}
            aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            <span className="themeOption"><Sun /></span>
            <span className={`themeThumb ${theme === "dark" ? "isDark" : ""}`} />
            <span className="themeOption"><Moon /></span>
          </button>
          <button
            onClick={refresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={
                refreshing
                  ? "spin"
                  : ""
              }
            />

            {refreshing
              ? "Refreshing"
              : "Refresh SAP Data"}
          </button>
        </div>
      </header>


      {error && (
        <div className="error">
          {error}
        </div>
      )}


      <nav>
        <button
          className={
            tab === "overview"
              ? "active"
              : ""
          }
          onClick={() =>
            setTab("overview")
          }
        >
          <LayoutDashboard />
          <span>Overview</span>
        </button>

        <button
          className={
            tab === "trends"
              ? "active"
              : ""
          }
          onClick={() =>
            setTab("trends")
          }
        >
          <BarChart3 />
          <span>Trends</span>
        </button>
      </nav>


      <main>
        {tab === "overview" &&
          overview && (
            <>
              <div className="kpiGrid">
                {(overview.kpis ?? []).map(
                  (kpi, index) => (
                    <KpiCard
                      key={kpi.title}
                      k={kpi}
                      index={index}
                    />
                  ),
                )}
              </div>


              <div
                className="floatingTableGrid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 20,
                  alignItems: "stretch",
                  marginTop: 20,
                }}
              >
                <section
                  className="panel floatingTableCard"
                  style={{
                    marginTop: 0,
                    minWidth: 0,
                    height: "100%",
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: 18,
                    boxShadow: "0 12px 30px rgba(0, 74, 40, 0.10)",
                  }}
                >
                  <h2
                    style={{
                      margin: "4px 0 18px",
                      minHeight: 42,
                      color: "#10291c",
                      fontSize: "clamp(26px, 1.8vw, 34px)",
                      fontWeight: 900,
                      lineHeight: 1.15,
                      textAlign: "left",
                    }}
                  >
                    <BarChart3 className="sectionIcon" />
                    Production Distribution
                    <Info className="infoIcon" />
                  </h2>
                  <div className="tableWrap" style={{ flex: 1 }}>
                    <table className="productionMatrix"><thead><tr><th rowSpan={2}>Grade / Type</th><th colSpan={2}>On Date</th><th colSpan={2}>{overview.period.label}</th><th colSpan={2}>YTD</th></tr><tr><th>Cells</th><th>MW</th><th>Cells</th><th>MW</th><th>Cells</th><th>MW</th></tr></thead><tbody><tr className="group"><th colSpan={7}>Production</th></tr>{overview.distribution.map(row=><tr key={row.label} className={row.label === "Good Cells" ? "total" : ""}><th>{row.label}</th><td>{tableFmt(row.on_date_cells,0)}</td><td>{tableFmt(row.on_date_mw,2)}</td><td>{tableFmt(row.period_cells,0)}</td><td>{tableFmt(row.period_mw,2)}</td><td>{tableFmt(row.ytd_cells,0)}</td><td>{tableFmt(row.ytd_mw,2)}</td></tr>)}<tr className="group rejectionGroup"><th colSpan={7}>Rejection</th></tr>{overview.rejection.map(row=><tr key={row.label} className={row.label === "Wafer Loss Cells" ? "lossTotal" : ""}><th>{row.label}</th><td>{tableFmt(row.on_date_cells,0)}</td><td>{tableFmt(row.on_date_mw,2)}</td><td>{tableFmt(row.period_cells,0)}</td><td>{tableFmt(row.period_mw,2)}</td><td>{tableFmt(row.ytd_cells,0)}</td><td>{tableFmt(row.ytd_mw,2)}</td></tr>)}</tbody></table>
                  </div>
                </section>

                <section
                  className="panel floatingTableCard"
                  style={{
                    marginTop: 0,
                    minWidth: 0,
                    height: "100%",
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: 18,
                    boxShadow: "0 12px 30px rgba(0, 74, 40, 0.10)",
                  }}
                >
                  <h2
                    style={{
                      margin: "4px 0 18px",
                      minHeight: 42,
                      color: "#10291c",
                      fontSize: "clamp(26px, 1.8vw, 34px)",
                      fontWeight: 900,
                      lineHeight: 1.15,
                      textAlign: "left",
                    }}
                  >
                    <Percent className="sectionIcon" />
                    Yield % Distribution
                    <Info className="infoIcon" />
                  </h2>
                  <div className="tableWrap" style={{ flex: 1 }}>
                    <table className="yieldMatrix">
                      <thead>
                        <tr>
                          <th>Grade / Type</th>
                          <th>On Date</th>
                          <th>{overview.period.label}</th>
                          <th>YTD</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="group"><th colSpan={4}>Yield</th></tr>
                        {(overview.yield_table ?? []).map((row) => (
                          <tr key={row.label} className={row.label === "Good Cells" ? "total" : ""}>
                            <th>{row.label === "Good Cells" ? "Total Yield" : row.label}</th>
                            <td>{fmt(row.on_date, 2)}%</td>
                            <td>{fmt(row.period, 2)}%</td>
                            <td>{fmt(row.ytd, 2)}%</td>
                          </tr>
                        ))}
                        <tr className="group rejectionGroup"><th colSpan={4}>Rejection</th></tr>
                        {(overview.rejection_percentage_table ?? []).map((row) => (
                          <tr key={row.label} className={row.label === "Wafer Loss" ? "lossTotal" : ""}>
                            <th>{row.label}</th>
                            <td>{fmt(row.on_date, 2)}%</td>
                            <td>{fmt(row.period, 2)}%</td>
                            <td>{fmt(row.ytd, 2)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
              <section className="panel efficiencyTableCard">
                <div className="efficiencyTableHeading">
                  <div><h2><Percent className="sectionIcon" />Grade &amp; Efficiency-wise SAP Distribution</h2><p>{efficiencyDistribution ? `${shortDate(efficiencyDistribution.start)} to ${shortDate(efficiencyDistribution.end)}` : ""}</p></div>
                  <label>Period<select value={efficiencyMode} onChange={(event) => setEfficiencyMode(event.target.value as typeof efficiencyMode)}><option value="on_date">On Date</option><option value="mtd">MTD</option><option value="ytd">YTD</option></select></label>
                </div>
                <div className="tableWrap efficiencyTableWrap">
                  <table className="efficiencyMatrix">
                    <thead><tr><th rowSpan={2}>Efficiency %</th>{["A Grade", "B-EL", "B Grade", "EB"].map((grade) => <th key={grade} colSpan={grade === "A Grade" ? 3 : 2}>{grade}</th>)}</tr><tr><th>MW</th><th>Distrib. %</th><th>Cumulative MW</th>{["B-EL", "B Grade", "EB"].flatMap((grade) => [<th key={`${grade}-mw`}>MW</th>, <th key={`${grade}-dist`}>Distrib. %</th>])}</tr></thead>
                     <tbody>
                       <tr className="group"><th colSpan={10}>SAP EFFICIENCY</th></tr>
                       {(efficiencyDistribution?.rows ?? []).map((row, rowIndex) => <tr key={row.efficiency} className={rowIndex % 2 === 0 ? "effRow" : ""}><th>{fmt(row.efficiency, 1)}</th>{["A Grade", "B-EL", "B Grade", "EB"].flatMap((grade) => { const item = row.grades[grade]; const mw = item?.mw == null ? "" : fmt(item.mw, 2); const dist = item?.distribution_pct == null ? "" : `${fmt(item.distribution_pct, 2)}%`; const values = grade === "A Grade" ? [mw, dist, item?.cumulative_mw == null ? "" : fmt(item.cumulative_mw, 2)] : [mw, dist]; return values.map((value, index) => <td key={`${grade}-${index}`}>{value}</td>); })}</tr>)}
                       {!!efficiencyDistribution?.totals.length && <tr className="total"><th>Grand Total</th>{["A Grade", "B-EL", "B Grade", "EB"].flatMap((grade) => { const item = efficiencyDistribution.totals.find((total) => total.grade === grade); const values = grade === "A Grade" ? [item?.mw == null ? "" : fmt(item.mw, 2), item?.distribution_pct == null ? "" : `${fmt(item.distribution_pct, 2)}%`, item?.mw == null ? "" : fmt(item.mw, 2)] : [item?.mw == null ? "" : fmt(item.mw, 2), item?.distribution_pct == null ? "" : `${fmt(item.distribution_pct, 2)}%`]; return values.map((value, index) => <td key={`${grade}-total-${index}`}>{value}</td>); })}</tr>}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        {tab === "trends" &&
          trends && (
            <>
              <Chart
                title="Daywise Production Trend"
                subtitle="Total saleable cells with Overall MW and A Grade MW"
              >
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <ComposedChart
                    data={
                      filteredProduction
                    }
                    margin={{
                      top: 25,
                      right: 24,
                      left: 10,
                      bottom: 42,
                    }}
                  >
                    <CartesianGrid
                      stroke="#dfe7e1"
                      vertical={false}
                      strokeDasharray="4 4"
                    />

                    <XAxis
                      {...axis}
                      dataKey="period"
                      tickFormatter={
                        shortDate
                      }
                      interval="preserveStartEnd"
                      minTickGap={40}
                      angle={-35}
                      textAnchor="end"
                      height={70}
                    />

                    <YAxis
                      {...axis}
                      yAxisId="cells"
                      tickFormatter={
                        cellTick
                      }
                      label={{
                        value:
                          "Production (Cells)",
                        angle: -90,
                        position:
                          "insideLeft",
                        fill: "#26352d",
                      }}
                    />

                    <YAxis
                      {...axis}
                      yAxisId="mw"
                      orientation="right"
                      domain={[
                        "auto",
                        "auto",
                      ]}
                      label={{
                        value:
                          "Production (MW)",
                        angle: 90,
                        position:
                          "insideRight",
                        fill: "#26352d",
                      }}
                    />

                    <Tooltip
                      content={
                        <TooltipBox />
                      }
                    />

                    <Legend
                      verticalAlign="top"
                      align="center"
                      wrapperStyle={{
                        paddingBottom: 14,
                      }}
                    />

                    <Line yAxisId="mw" type="stepAfter" dataKey="production_target_mw" stroke="#7B8794" strokeWidth={2.5} strokeDasharray="7 5" dot={false} name="Target MW" connectNulls />
                    <Bar yAxisId="mw" dataKey="a_mw" fill="var(--chart-a-grade)" name="A Grade MW" radius={[5, 5, 0, 0]} isAnimationActive />
                    <Line yAxisId="mw" type="monotone" dataKey="total_mw" stroke="var(--chart-overall)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} name="Overall MW" connectNulls isAnimationActive />
                    <Line yAxisId="cells" type="monotone" dataKey="total_cells" stroke="var(--chart-saleable)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} name="Total Saleable Cells" connectNulls isAnimationActive />
                  </ComposedChart>
                </ResponsiveContainer>
              </Chart>


              <Chart
                title="Daywise Rejection Trend"
                subtitle="ER includes ER(Q); OR represents FOR"
              >
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <LineChart
                    data={
                      filteredRejection
                    }
                    margin={{
                      top: 25,
                      right: 30,
                      bottom: 48,
                      left: 8,
                    }}
                  >
                    <CartesianGrid
                      stroke="#e5ebe6"
                      vertical={false}
                      strokeDasharray="4 4"
                    />

                    <XAxis
                      {...axis}
                      dataKey="period"
                      tickFormatter={
                        shortDate
                      }
                      interval="preserveStartEnd"
                      minTickGap={45}
                      angle={-35}
                      textAnchor="end"
                      height={72}
                      label={{
                        value:
                          "Production Date",
                        position:
                          "insideBottom",
                        offset: -17,
                        fill: "#43544a",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    />

                    <YAxis
                      {...axis}
                      tickFormatter={
                        percentTick
                      }
                      domain={[
                        0,
                        (
                          dataMax: number,
                        ) =>
                          Math.max(
                            Math.ceil(
                              dataMax *
                                1.15,
                            ),
                            1,
                          ),
                      ]}
                      width={65}
                      label={{
                        value:
                          "Rejection (%)",
                        angle: -90,
                        position:
                          "insideLeft",
                        fill: "#43544a",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    />

                    <Tooltip
                      content={
                        <TooltipBox />
                      }
                      cursor={{
                        stroke: "#b6c5ba",
                        strokeDasharray:
                          "4 4",
                      }}
                    />

                    <Legend
                      verticalAlign="top"
                      align="center"
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{
                        paddingBottom: 15,
                        color: "#26352d",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    />

                    <Line type="stepAfter" dataKey="breakage_target_pct" name="Breakage Target %" stroke="var(--chart-breakage-target)" strokeWidth={2.5} strokeDasharray="7 5" dot={false} connectNulls />
                    <Line type="stepAfter" dataKey="er_target_pct" name="ER Target %" stroke="var(--chart-er-target)" strokeWidth={2.5} strokeDasharray="7 5" dot={false} connectNulls />
                    <Line type="stepAfter" dataKey="or_target_pct" name="OR Target %" stroke="var(--chart-or-target)" strokeWidth={2.5} strokeDasharray="7 5" dot={false} connectNulls />
                    <Line
                      type="monotone"
                      dataKey="breakage_pct"
                      name="Breakage %"
                      stroke="var(--chart-breakage)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{
                        r: 5,
                        fill: "var(--chart-breakage)",
                        stroke: "#ffffff",
                        strokeWidth: 2,
                      }}
                      connectNulls
                    />

                    <Line
                      type="monotone"
                      dataKey="er_pct"
                      name="ER %"
                      stroke="var(--chart-er)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{
                        r: 5,
                        fill: "var(--chart-er)",
                        stroke: "#ffffff",
                        strokeWidth: 2,
                      }}
                      connectNulls
                    />

                    <Line
                      type="monotone"
                      dataKey="or_pct"
                      name="OR %"
                      stroke="var(--chart-or)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{
                        r: 5,
                        fill: "var(--chart-or)",
                        stroke: "#ffffff",
                        strokeWidth: 2,
                      }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Chart>


              <Chart
                title="Yield Trend (%)"
                subtitle="Independent scales preserve visibility across all yield grades"
              >
                <div className="yieldSmallMultiples">
                  <div className="yieldSubChart yieldSubChartPrimary">
                    <div className="yieldScaleLabel">
                      <span className="yieldDot yieldDotAGrade" />
                      A Grade Yield
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={filteredYield}
                        syncId="yield-trends"
                        margin={{ top: 12, right: 24, bottom: 0, left: 8 }}
                      >
                        <CartesianGrid stroke="#e5ebe6" vertical={false}
                      strokeDasharray="4 4" />
                        <XAxis dataKey="period" hide />
                        <YAxis
                          {...axis}
                          width={62}
                          tickFormatter={percentTick}
                          domain={[
                            (dataMin: number) => Math.max(Math.floor(dataMin - 2), 0),
                            (dataMax: number) => Math.min(Math.ceil(dataMax + 2), 100),
                          ]}
                        />
                        <Tooltip
                          content={<TooltipBox />}
                          cursor={{ stroke: "#b6c5ba", strokeDasharray: "4 4" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="a_yield_pct"
                          name="A Grade %"
                          stroke="var(--chart-a-grade)"
                          strokeWidth={3}
                          dot={false}
                          activeDot={{ r: 5, fill: "var(--chart-a-grade)", stroke: "#ffffff", strokeWidth: 2 }}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="yieldSubChart yieldSubChartSecondary">
                    <div className="yieldScaleLabel">
                      <span className="yieldDot yieldDotBEL" />
                      B-EL Yield
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={filteredYield}
                        syncId="yield-trends"
                        margin={{ top: 12, right: 24, bottom: 0, left: 8 }}
                      >
                        <CartesianGrid stroke="#e5ebe6" vertical={false}
                      strokeDasharray="4 4" />
                        <XAxis dataKey="period" hide />
                        <YAxis
                          {...axis}
                          width={62}
                          tickFormatter={percentTick}
                          domain={[
                            0,
                            (dataMax: number) => Math.max(Math.ceil(dataMax * 1.1), 5),
                          ]}
                        />
                        <Tooltip
                          content={<TooltipBox />}
                          cursor={{ stroke: "#b6c5ba", strokeDasharray: "4 4" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="bel_yield_pct"
                          name="B-EL %"
                          stroke="var(--chart-er)"
                          strokeWidth={2.7}
                          dot={false}
                          activeDot={{ r: 5, fill: "var(--chart-er)", stroke: "#ffffff", strokeWidth: 2 }}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="yieldSubChart yieldSubChartSmall">
                    <div className="yieldScaleLabel">
                      <span className="yieldDot yieldDotBGrade" />
                      B Grade
                      <span className="yieldDot yieldDotEB" />
                      EB
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={filteredYield}
                        syncId="yield-trends"
                        margin={{ top: 12, right: 24, bottom: 46, left: 8 }}
                      >
                        <CartesianGrid stroke="#e5ebe6" vertical={false}
                      strokeDasharray="4 4" />
                        <XAxis
                          {...axis}
                          dataKey="period"
                          tickFormatter={shortDate}
                          interval="preserveStartEnd"
                          minTickGap={45}
                          angle={-35}
                          textAnchor="end"
                          height={64}
                        />
                        <YAxis
                          {...axis}
                          width={62}
                          tickFormatter={percentTick}
                          domain={[
                            0,
                            (dataMax: number) =>
                              Math.max(Math.ceil(dataMax * 1.2 * 10) / 10, 0.5),
                          ]}
                          allowDecimals
                        />
                        <Tooltip
                          content={<TooltipBox />}
                          cursor={{ stroke: "#b6c5ba", strokeDasharray: "4 4" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="b_yield_pct"
                          name="B Grade %"
                          stroke="var(--chart-or)"
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 5, fill: "var(--chart-or)", stroke: "#ffffff", strokeWidth: 2 }}
                          connectNulls
                        />
                        <Line
                          type="monotone"
                          dataKey="eb_yield_pct"
                          name="EB %"
                          stroke="var(--chart-eb)"
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 5, fill: "var(--chart-eb)", stroke: "#ffffff", strokeWidth: 2 }}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Chart>


              <Chart
                title="Wafer Loss Trend (%)"
                subtitle="ER + OR + Breakage"
              >
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <LineChart
                    data={
                      filteredWaferLoss
                    }
                    margin={{
                      top: 28,
                      right: 24,
                      left: 8,
                      bottom: 48,
                    }}
                  >
                    <CartesianGrid
                      stroke="#e3e9e4"
                      vertical={false}
                      strokeDasharray="4 4"
                    />

                    <XAxis
                      {...axis}
                      dataKey="period"
                      tickFormatter={
                        shortDate
                      }
                      interval="preserveStartEnd"
                      minTickGap={45}
                      angle={-35}
                      textAnchor="end"
                      height={72}
                    />

                    <YAxis
                      {...axis}
                      domain={[
                        0,
                        (
                          dataMax: number,
                        ) =>
                          Math.max(
                            Math.ceil(
                              dataMax *
                                1.15,
                            ),
                            1,
                          ),
                      ]}
                      tickFormatter={
                        percentTick
                      }
                    />

                    <Tooltip
                      content={
                        <TooltipBox />
                      }
                    />

                    <Legend />

                    <Line type="stepAfter" dataKey="wafer_loss_target_pct" name="Target %" stroke="#7B8794" strokeWidth={2.5} strokeDasharray="7 5" dot={false} connectNulls />
                    <Line
                      type="monotone"
                      dataKey="wafer_loss_pct"
                      stroke="var(--chart-breakage)"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{
                        r: 5,
                        fill: "var(--chart-breakage)",
                        stroke: "#ffffff",
                        strokeWidth: 2,
                      }}
                      name="Wafer Loss %"
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Chart>


              <div className="efficiencyTrendControls"><label>Efficiency view<select value={efficiencyTrendMode} onChange={(event) => setEfficiencyTrendMode(event.target.value as typeof efficiencyTrendMode)}><option value="on_date">On Date</option><option value="month">Selected Month</option><option value="mtd">MTD</option><option value="ytd">YTD</option></select></label>{efficiencyTrendMode === "month" && <label>Month<input type="month" value={efficiencyTrendMonth} onChange={(event) => setEfficiencyTrendMonth(event.target.value)} /></label>}</div>
              <Chart title="Halm vs SAP Efficiency Trend" subtitle="Daily points for On Date, Month and MTD; monthly weighted points for YTD">
                <ResponsiveContainer width="100%" height="100%"><LineChart data={efficiencyTrend} margin={{top:28,right:24,left:8,bottom:48}}><CartesianGrid stroke="#e3e9e4" vertical={false} strokeDasharray="4 4"/><XAxis {...axis} dataKey="period" tickFormatter={shortDate} interval="preserveStartEnd" minTickGap={45} angle={-35} textAnchor="end" height={72}/><YAxis {...axis} tickFormatter={percentTick} domain={["auto", "auto"]}/><Tooltip content={<TooltipBox />}/><Legend/><Line type="monotone" dataKey="halm_efficiency" name="Halm Efficiency %" stroke="var(--chart-a-grade)" strokeWidth={2.7} dot={false} activeDot={{r:5}} connectNulls isAnimationActive/><Line type="monotone" dataKey="sap_efficiency" name="SAP Efficiency %" stroke="var(--chart-overall)" strokeWidth={2.7} dot={false} activeDot={{r:5}} connectNulls isAnimationActive/></LineChart></ResponsiveContainer>
              </Chart>
              <div className="bottomChartGrid">
              <Chart title="Breakage Distribution">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <BarChart
                    data={breakage}
                    margin={{
                      top: 30,
                      right: 20,
                      left: 8,
                      bottom: 50,
                    }}
                  >
                    <CartesianGrid
                      stroke="#e3e9e4"
                      vertical={false}
                      strokeDasharray="4 4"
                    />

                    <XAxis
                      {...axis}
                      dataKey="name"
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={68}
                    />

                    <YAxis
                      {...axis}
                      tickFormatter={
                        cellTick
                      }
                    />

                    <Tooltip
                      content={
                        <TooltipBox />
                      }
                    />

                    <Bar
                      dataKey="value"
                      fill="#79c143"
                      name="Breakage Cells"
                      radius={[
                        6,
                        6,
                        0,
                        0,
                      ]}
                    >
                      {breakage.map((entry, index) => {
                        const breakageColors = [
                          "#F5223B",
                          "#F59E0B",
                          "#D9A441",
                          "#8B5CF6",
                          "#C8D91E",
                          "#12B76A",
                        ];

                        return (
                          <Cell
                            key={`breakage-${entry.name}`}
                            fill={breakageColors[index % breakageColors.length]}
                          />
                        );
                      })}

                      <LabelList
                        dataKey="value"
                        position="top"
                        formatter={(
                          value: any,
                        ) =>
                          fmt(value, 0)
                        }
                        fill="#26352d"
                        fontSize={10}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Chart>


              <Chart title="Monthly Average MW Production per Day" subtitle="Actual vs target MW per production day, per month">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <LineChart
                    data={(trends?.monthly_average ?? []).filter((row: any) => inSelectedRange(String(row.period ?? "")))}
                    margin={{
                      top: 28,
                      right: 24,
                      left: 8,
                      bottom: 32,
                    }}
                  >
                    <CartesianGrid
                      stroke="#e3e9e4"
                      vertical={false}
                      strokeDasharray="4 4"
                    />

                    <XAxis
                      {...axis}
                      dataKey="period"
                      tickFormatter={
                        monthLabel
                      }
                    />

                    <YAxis
                      {...axis}
                      domain={[
                        (dataMin: number) => Math.max(Math.floor(dataMin * 0.92), 0),
                        (dataMax: number) => Math.ceil(dataMax * 1.08),
                      ]}
                      label={{
                        value:
                          "Average MW/day",
                        angle: -90,
                        position:
                          "insideLeft",
                        fill: "#26352d",
                      }}
                    />

                    <Tooltip
                      content={
                        <TooltipBox />
                      }
                    />

                    <Legend />

                    <Line
                      type="stepAfter"
                      dataKey="target_mw_per_day"
                      name="Target MW/day"
                      stroke="#7B8794"
                      strokeWidth={2.5}
                      strokeDasharray="7 5"
                      dot={false}
                      connectNulls
                    />

                    <Line
                      type="monotone"
                      dataKey="avg_mw_per_day"
                      stroke="var(--success)"
                      strokeWidth={3}
                      dot={{
                        r: 5,
                        fill: "var(--success)",
                        stroke: "#087A50",
                      }}
                      activeDot={{
                        r: 6,
                        fill: "var(--success)",
                        stroke: "#ffffff",
                        strokeWidth: 2,
                      }}
                      name="Average MW/day"
                    >
                      <LabelList
                        dataKey="avg_mw_per_day"
                        position="top"
                        formatter={(
                          value: any,
                        ) =>
                          fmt(value, 2)
                        }
                        fill="var(--success)"
                        fontSize={10}
                      />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </Chart>
              </div>
            </>
          )}
      </main>
      <footer className="dashboardFooter">
        <div><Leaf /><span>Powering a Cleaner Tomorrow</span></div>
        <div className="footerStatus"><span className="liveDot" />Live Data from SAP<i />Last Updated: {overview?.as_of || "-"}</div>
      </footer>
    </div>
  );
}
