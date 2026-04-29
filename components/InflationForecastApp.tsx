"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// ── Nigeria NBS CPI headline inflation (monthly, Jan 2021 – Dec 2024) ─────────
// Format: { label: "Jan-21", value: rate }
const HISTORICAL: { label: string; value: number }[] = [
  { label: "Jan-21", value: 16.47 }, { label: "Feb-21", value: 17.33 }, { label: "Mar-21", value: 18.17 },
  { label: "Apr-21", value: 18.12 }, { label: "May-21", value: 17.93 }, { label: "Jun-21", value: 17.75 },
  { label: "Jul-21", value: 17.38 }, { label: "Aug-21", value: 17.01 }, { label: "Sep-21", value: 16.63 },
  { label: "Oct-21", value: 15.99 }, { label: "Nov-21", value: 15.40 }, { label: "Dec-21", value: 15.63 },
  { label: "Jan-22", value: 15.60 }, { label: "Feb-22", value: 15.70 }, { label: "Mar-22", value: 15.92 },
  { label: "Apr-22", value: 16.82 }, { label: "May-22", value: 17.71 }, { label: "Jun-22", value: 18.60 },
  { label: "Jul-22", value: 19.64 }, { label: "Aug-22", value: 20.52 }, { label: "Sep-22", value: 20.77 },
  { label: "Oct-22", value: 21.09 }, { label: "Nov-22", value: 21.47 }, { label: "Dec-22", value: 21.34 },
  { label: "Jan-23", value: 21.82 }, { label: "Feb-23", value: 21.91 }, { label: "Mar-23", value: 22.04 },
  { label: "Apr-23", value: 22.22 }, { label: "May-23", value: 22.41 }, { label: "Jun-23", value: 22.79 },
  { label: "Jul-23", value: 24.08 }, { label: "Aug-23", value: 25.80 }, { label: "Sep-23", value: 26.72 },
  { label: "Oct-23", value: 27.33 }, { label: "Nov-23", value: 28.20 }, { label: "Dec-23", value: 28.92 },
  { label: "Jan-24", value: 29.90 }, { label: "Feb-24", value: 31.70 }, { label: "Mar-24", value: 33.20 },
  { label: "Apr-24", value: 33.69 }, { label: "May-24", value: 33.95 }, { label: "Jun-24", value: 34.19 },
  { label: "Jul-24", value: 33.40 }, { label: "Aug-24", value: 32.15 }, { label: "Sep-24", value: 32.70 },
  { label: "Oct-24", value: 33.88 }, { label: "Nov-24", value: 34.60 }, { label: "Dec-24", value: 34.80 },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HORIZON_MONTHS = [3, 6, 12];

// ── Holt-Winters additive triple exponential smoothing ─────────────────────────
function holtWinters(
  data: number[],
  alpha: number,  // level smoothing
  beta: number,   // trend smoothing
  gamma: number,  // seasonal smoothing
  seasonLen: number,
  horizon: number
) {
  const n = data.length;
  if (n < seasonLen * 2) return { forecasts: [], levels: [], trends: [], seasonals: [] };

  // Initialise
  const levels: number[] = new Array(n).fill(0);
  const trends: number[] = new Array(n).fill(0);
  const seasonals: number[] = new Array(n).fill(0);

  // Initial level = mean of first season
  let initLevel = data.slice(0, seasonLen).reduce((a, b) => a + b, 0) / seasonLen;
  // Initial trend = avg of slopes between first two seasons
  let initTrend = 0;
  for (let i = 0; i < seasonLen; i++) {
    initTrend += (data[i + seasonLen] - data[i]) / seasonLen;
  }
  initTrend /= seasonLen;

  // Initial seasonals: observed - level per period
  const initSeasonals: number[] = [];
  for (let i = 0; i < seasonLen; i++) {
    initSeasonals.push(data[i] - initLevel);
  }

  levels[0] = initLevel;
  trends[0] = initTrend;
  for (let i = 0; i < seasonLen; i++) seasonals[i] = initSeasonals[i];

  // Smoothing
  for (let t = 1; t < n; t++) {
    const sIdx = t < seasonLen ? t : t - seasonLen;
    const prevLevel = levels[t - 1];
    const prevTrend = trends[t - 1];
    const prevSeasonal = seasonals[t < seasonLen ? t : t - seasonLen];

    levels[t] = alpha * (data[t] - prevSeasonal) + (1 - alpha) * (prevLevel + prevTrend);
    trends[t] = beta * (levels[t] - prevLevel) + (1 - beta) * prevTrend;
    seasonals[t] = gamma * (data[t] - levels[t]) + (1 - gamma) * prevSeasonal;
  }

  // Extend seasonals array
  const allSeasonals = [...seasonals];
  while (allSeasonals.length < n + horizon) {
    allSeasonals.push(allSeasonals[allSeasonals.length - seasonLen]);
  }

  const lastLevel = levels[n - 1];
  const lastTrend = trends[n - 1];
  const forecasts: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    const f = lastLevel + h * lastTrend + allSeasonals[n - 1 + h];
    forecasts.push(parseFloat(f.toFixed(2)));
  }

  return { forecasts, levels, trends, seasonals };
}

// Generate future month labels starting from Jan-25
function futureLabels(horizon: number) {
  const labels: string[] = [];
  let m = 0; // Jan = 0
  let y = 25;
  for (let i = 0; i < horizon; i++) {
    labels.push(`${MONTHS[m]}-${y}`);
    m++;
    if (m === 12) { m = 0; y++; }
  }
  return labels;
}

// Confidence interval: residual std × z-score × sqrt(h)
function calcCI(residuals: number[], sigma: number, horizon: number, zScore: number) {
  const lo: number[] = [];
  const hi: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    const margin = zScore * sigma * Math.sqrt(h);
    lo.push(margin);
    hi.push(margin);
  }
  return { lo, hi };
}

function residualStd(data: number[], levels: number[], trends: number[], seasonals: number[], seasonLen: number) {
  const residuals = data.map((v, t) => {
    const fitted = levels[t] + trends[t] + (seasonals[t - seasonLen] ?? seasonals[t] ?? 0);
    return v - fitted;
  });
  const mean = residuals.reduce((a, b) => a + b, 0) / residuals.length;
  const variance = residuals.reduce((a, b) => a + (b - mean) ** 2, 0) / residuals.length;
  return Math.sqrt(variance);
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 16px", minWidth: 200 }}>
      <p style={{ color: "var(--accent2)", fontWeight: 700, marginBottom: 8 }}>{label}</p>
      {payload.map((p: any) => (
        p.value != null && (
          <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 20, marginBottom: 4 }}>
            <span style={{ color: p.color || "var(--muted)", fontSize: 13 }}>{p.name}</span>
            <span style={{ color: "var(--text)", fontWeight: 600, fontSize: 13 }}>{typeof p.value === "number" ? p.value.toFixed(2) : p.value}%</span>
          </div>
        )
      ))}
    </div>
  );
}

interface MetricBadgeProps {
  horizon: string;
  value: number;
  lo: number;
  hi: number;
  target: number;
}

function MetricBadge({ horizon, value, lo, hi, target }: MetricBadgeProps) {
  const above = value > target;
  return (
    <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: "18px 20px" }}>
      <div style={{ color: "var(--muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
        {horizon} Forecast
      </div>
      <div style={{ color: "var(--accent2)", fontSize: 30, fontWeight: 800, marginBottom: 4 }}>
        {value.toFixed(1)}%
      </div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10 }}>
        90% CI: {(value - hi).toFixed(1)}% – {(value + lo).toFixed(1)}%
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: above ? "#ef4444" : "#22c55e", display: "inline-block" }} />
        <span style={{ color: above ? "#ef4444" : "#22c55e", fontSize: 12, fontWeight: 600 }}>
          {above ? `${(value - target).toFixed(1)}pp above` : `${(target - value).toFixed(1)}pp below`} CBN target
        </span>
      </div>
    </div>
  );
}

export default function InflationForecastApp() {
  const [alpha, setAlpha] = useState(0.4);
  const [beta, setBeta] = useState(0.1);
  const [gamma, setGamma] = useState(0.3);
  const [ciLevel, setCiLevel] = useState(90);
  const [activeHorizon, setActiveHorizon] = useState(12);

  const data = HISTORICAL.map((h) => h.value);
  const seasonLen = 12;

  const { forecasts, levels, trends, seasonals } = useMemo(
    () => holtWinters(data, alpha, beta, gamma, seasonLen, activeHorizon),
    [data, alpha, beta, gamma, activeHorizon]
  );

  const sigma = useMemo(
    () => (levels.length > 0 ? residualStd(data, levels, trends, seasonals, seasonLen) : 1),
    [data, levels, trends, seasonals]
  );

  const zScore = ciLevel === 90 ? 1.645 : ciLevel === 95 ? 1.96 : 2.576;
  const ci = useMemo(() => calcCI(data, sigma, activeHorizon, zScore), [sigma, activeHorizon, zScore]);

  const futureLbls = futureLabels(activeHorizon);

  // Build chart data
  const histChartData = HISTORICAL.map((h, i) => ({
    label: h.label,
    historical: h.value,
    forecast: undefined as number | undefined,
    upper: undefined as number | undefined,
    lower: undefined as number | undefined,
  }));

  const forecastChartData = futureLbls.map((lbl, i) => ({
    label: lbl,
    historical: undefined as number | undefined,
    forecast: forecasts[i],
    upper: forecasts[i] !== undefined ? parseFloat((forecasts[i] + ci.hi[i]).toFixed(2)) : undefined,
    lower: forecasts[i] !== undefined ? Math.max(0, parseFloat((forecasts[i] - ci.lo[i]).toFixed(2))) : undefined,
  }));

  // Overlap: last historical point bridged to first forecast
  const chartData = [
    ...histChartData.slice(-24),
    { label: HISTORICAL[HISTORICAL.length - 1].label, historical: undefined, forecast: data[data.length - 1], upper: data[data.length - 1], lower: data[data.length - 1] },
    ...forecastChartData,
  ];

  // Forecast point estimates for 3, 6, 12 months
  const f3 = forecasts[2] ?? data[data.length - 1];
  const f6 = forecasts[5] ?? data[data.length - 1];
  const f12 = forecasts[11] ?? data[data.length - 1];
  const ci90_12 = ci.hi[11] ?? 0;
  const ci90_6 = ci.hi[5] ?? 0;
  const ci90_3 = ci.hi[2] ?? 0;
  const CBN_TARGET = 21.4; // CBN 2025 inflation target

  // Drivers panel data
  const drivers = [
    { driver: "FX pass-through", impact: "High", direction: "↑", note: "Naira weakness feeds import costs and PMS prices" },
    { driver: "PMS subsidy removal", impact: "High", direction: "↑", note: "Full downstream deregulation persists into 2025" },
    { driver: "Food supply shocks", impact: "Moderate", direction: "↑", note: "Flooding and insecurity in food-producing states" },
    { driver: "CBN tightening (MPR 27.5%)", impact: "Moderate", direction: "↓", note: "CRR hike and hawkish stance dampening demand" },
    { driver: "Base effects", impact: "Moderate", direction: "↓", note: "High 2024 base suggests softer YoY prints in H2 2025" },
    { driver: "Fiscal deficit monetisation", impact: "Low", direction: "↑", note: "CBN direct financing of fiscal gap reduced" },
  ];

  const directionColor = (d: string) => (d === "↑" ? "#ef4444" : "#22c55e");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #0b0e18 0%, #0d1220 60%, #111828 100%)", borderBottom: "1px solid var(--border)", padding: "56px 24px 48px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {["Holt-Winters ETS", "NBS CPI Data 2021–2024", "3/6/12-Month Forecasts", "Confidence Intervals"].map((tag) => (
            <span key={tag} style={{ background: "rgba(200,168,58,0.12)", border: "1px solid rgba(200,168,58,0.3)", color: "var(--accent2)", borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 500 }}>
              {tag}
            </span>
          ))}
        </div>
        <h1 style={{ fontSize: "clamp(26px, 5vw, 46px)", fontWeight: 800, color: "var(--text)", marginBottom: 16 }}>
          Nigerian Inflation Forecasting Model
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 16, maxWidth: 620, margin: "0 auto" }}>
          Triple exponential smoothing (Holt-Winters additive) trained on NBS headline CPI data, producing
          3, 6, and 12-month forecasts with configurable confidence intervals.
        </p>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px" }}>
        {/* Forecast badges */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 40 }}>
          <MetricBadge horizon="3-Month" value={f3} lo={ci90_3} hi={ci90_3} target={CBN_TARGET} />
          <MetricBadge horizon="6-Month" value={f6} lo={ci90_6} hi={ci90_6} target={CBN_TARGET} />
          <MetricBadge horizon="12-Month" value={f12} lo={ci90_12} hi={ci90_12} target={CBN_TARGET} />
          <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: "18px 20px" }}>
            <div style={{ color: "var(--muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>CBN 2025 Target</div>
            <div style={{ color: "#60a5fa", fontSize: 30, fontWeight: 800, marginBottom: 4 }}>{CBN_TARGET}%</div>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>Single-digit long-term aspiration</div>
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 8 }}>Last reading: <strong style={{ color: "var(--text)" }}>34.80%</strong> (Dec 2024)</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 32, alignItems: "start" }}>
          {/* Chart */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "28px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ color: "var(--text)", fontWeight: 700, fontSize: 18 }}>Inflation Trajectory & Forecast</h2>
                <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>Last 24 months of actuals + {activeHorizon}-month forecast</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {HORIZON_MONTHS.map((h) => (
                  <button key={h} onClick={() => setActiveHorizon(h)}
                    style={{
                      padding: "6px 14px", borderRadius: 6, border: "1px solid",
                      borderColor: activeHorizon === h ? "var(--accent)" : "var(--border)",
                      background: activeHorizon === h ? "rgba(200,168,58,0.15)" : "transparent",
                      color: activeHorizon === h ? "var(--accent2)" : "var(--muted)",
                      fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    {h}M
                  </button>
                ))}
              </div>
            </div>

            <ResponsiveContainer width="100%" height={380}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" stroke="var(--muted)" tick={{ fill: "var(--muted)", fontSize: 11 }} interval={3} />
                <YAxis domain={[10, 50]} stroke="var(--muted)" tick={{ fill: "var(--muted)", fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: "var(--muted)", fontSize: 13, paddingTop: 16 }} />
                <ReferenceLine y={CBN_TARGET} stroke="#60a5fa" strokeDasharray="4 4" label={{ value: "CBN target", fill: "#60a5fa", fontSize: 11, position: "right" }} />
                <Area dataKey="upper" name="Upper CI" fill="rgba(200,168,58,0.1)" stroke="none" connectNulls />
                <Area dataKey="lower" name="Lower CI" fill="var(--bg)" stroke="none" connectNulls />
                <Line dataKey="historical" name="Actual CPI" stroke="#60a5fa" strokeWidth={2.5} dot={false} connectNulls />
                <Line dataKey="forecast" name="HW Forecast" stroke="var(--accent)" strokeWidth={2.5} strokeDasharray="6 3" dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "24px 20px" }}>
              <h3 style={{ color: "var(--accent2)", fontWeight: 700, fontSize: 15, marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Model Parameters
              </h3>

              {[
                { label: "α — Level Smoothing", val: alpha, set: setAlpha, desc: "Responsiveness to recent level changes. High α → more reactive." },
                { label: "β — Trend Smoothing", val: beta, set: setBeta, desc: "Dampens trend component. Low β → smoother trend." },
                { label: "γ — Seasonal Smoothing", val: gamma, set: setGamma, desc: "Updates seasonal factors. High γ → seasonal pattern adapts faster." },
              ].map(({ label, val, set, desc }) => (
                <div key={label} style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ color: "var(--text)", fontWeight: 600, fontSize: 14 }}>{label}</span>
                    <span style={{ color: "var(--accent2)", fontWeight: 700 }}>{val.toFixed(2)}</span>
                  </div>
                  <input type="range" min={0.05} max={0.95} step={0.05} value={val}
                    onChange={(e) => set(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "var(--accent)" }}
                  />
                  <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{desc}</div>
                </div>
              ))}

              <div style={{ marginTop: 8 }}>
                <div style={{ color: "var(--text)", fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Confidence Interval</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[90, 95, 99].map((lvl) => (
                    <button key={lvl} onClick={() => setCiLevel(lvl)}
                      style={{
                        flex: 1, padding: "8px 0", borderRadius: 6, border: "1px solid",
                        borderColor: ciLevel === lvl ? "var(--accent)" : "var(--border)",
                        background: ciLevel === lvl ? "rgba(200,168,58,0.15)" : "transparent",
                        color: ciLevel === lvl ? "var(--accent2)" : "var(--muted)",
                        fontSize: 13, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      {lvl}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Model info */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px" }}>
              <h3 style={{ color: "var(--accent2)", fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Model Information</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { label: "Method", value: "Holt-Winters Additive" },
                  { label: "Season Length", value: "12 months" },
                  { label: "Training Data", value: "48 months" },
                  { label: "Residual σ", value: `${sigma.toFixed(2)}pp` },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ color: "var(--muted)", fontSize: 11 }}>{label}</div>
                    <div style={{ color: "var(--text)", fontWeight: 600, fontSize: 13 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Inflation Drivers */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "28px 24px", marginTop: 32 }}>
          <h2 style={{ color: "var(--text)", fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Key Inflation Drivers</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {drivers.map((d) => (
              <div key={d.driver} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ color: "var(--text)", fontWeight: 600, fontSize: 14 }}>{d.driver}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: directionColor(d.direction), fontSize: 18, fontWeight: 700 }}>{d.direction}</span>
                    <span style={{ background: d.impact === "High" ? "rgba(239,68,68,0.15)" : d.impact === "Moderate" ? "rgba(245,158,11,0.15)" : "rgba(34,197,94,0.15)", color: d.impact === "High" ? "#ef4444" : d.impact === "Moderate" ? "#f59e0b" : "#22c55e", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{d.impact}</span>
                  </div>
                </div>
                <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.6 }}>{d.note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Methodology */}
        <div style={{ marginTop: 24, padding: "20px 24px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
          <h3 style={{ color: "var(--accent2)", fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Methodology</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.8 }}>
            The <strong style={{ color: "var(--text)" }}>Holt-Winters additive model</strong> (triple exponential smoothing) decomposes the NBS headline CPI series
            into level (L), trend (T), and seasonal (S) components updated each period by α, β, and γ respectively.
            Forecast: <em style={{ color: "var(--text)" }}>F(t+h) = (L + h·T) + S(t+h−m)</em> where m = 12 (annual seasonality).
            Confidence intervals assume normally distributed residuals scaled by <em>σ√h</em>. Training data: 48 monthly NBS observations (Jan 2021 – Dec 2024).
          </p>
        </div>
      </div>

      <footer style={{ textAlign: "center", padding: "32px 24px", borderTop: "1px solid var(--border)", marginTop: 48 }}>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          Built by{" "}
          <a href="mailto:adediranabiola160@gmail.com" style={{ color: "var(--accent)", textDecoration: "none" }}>
            Abiola Adediran
          </a>{" "}
          · Holt-Winters ETS · NBS CPI Data
        </p>
      </footer>
    </div>
  );
}
