# Nigerian Inflation Forecasting Model

An interactive inflation forecasting dashboard built on Holt-Winters triple exponential smoothing, trained on 48 months of NBS headline CPI data (Jan 2021 – Dec 2024). Produces 3, 6, and 12-month forecasts with configurable confidence intervals.

## What It Does

- Loads 48 months of NBS monthly headline CPI observations (Jan 2021 – Dec 2024)
- Fits a **Holt-Winters additive model** decomposing the series into level (L), trend (T), and seasonal (S) components
- Forecast formula: **F(t+h) = (L + h·T) + S(t+h−m)** where m = 12 (annual seasonality)
- Generates 3-month, 6-month, and 12-month point forecasts with 90/95/99% confidence intervals
- Benchmarks forecasts against the CBN's 2025 inflation target (21.4%)
- Renders an animated chart showing last 24 months of actuals bridged into the forecast fan

## Interactive Controls

| Control | Description |
|---|---|
| α (Level) | Responsiveness to recent level changes. Higher = more reactive. |
| β (Trend) | Trend smoothing. Lower = smoother long-run trend. |
| γ (Seasonal) | Seasonal factor update speed. Higher = adapts faster to seasonal shifts. |
| CI Level | Confidence interval width — 90%, 95%, or 99% |
| Horizon | Forecast horizon — 3, 6, or 12 months |

## Key Inflation Drivers Covered

- FX pass-through (naira depreciation → import cost inflation)
- PMS subsidy removal and downstream deregulation
- Food supply shocks (flooding, insecurity in farming states)
- CBN monetary tightening (MPR 27.5%)
- Base effects from elevated 2024 CPI prints

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Recharts** — ComposedChart with Area CI bands and Line overlays
- **Tailwind CSS**
- Pure client-side computation — no API calls

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Data Sources

- NBS National Bureau of Statistics — monthly headline CPI (2021–2024)
- CBN Central Bank of Nigeria — monetary policy targets

---

Built by [Muhammed Adediran](https://adediran.xyz/contact)
