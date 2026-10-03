# Foresight Lab

**Interactive simulation and forecasting dashboard for Vietnam's primary energy demand**, built on the DeGNA model published in *Computer Modeling in Engineering & Sciences* (CMES, 2026).

[![Paper](https://img.shields.io/badge/Paper-CMES%202026-blue?logo=doi)](https://doi.org/10.32604/cmes.2026.086196)
[![License: CC BY 4.0](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey)](https://creativecommons.org/licenses/by/4.0/)

---

## Overview

Foresight Lab is a fully static web application — all computation runs **in the browser**, no server required. It consists of two spaces:

| Space | Description |
|---|---|
| **Vietnam Energy** | Pre-trained DeGNA model with interactive scenario sliders (IIP, FDI), supply–demand balance against national plans (Decision 893, Decision 768), and impact analysis. |
| **Forecasting Tool** | Upload any Excel/CSV time series → automated data checks → variable selection → train DeGNA via Pyodide → test-set metrics → 3–72-month forecast with two trend extrapolation methods → export results. |

---

## The Model: DeGNA

**DeGNA** (**De**composition-based **G**rey–**N**euro-fuzzy **A**daptive inference) is a four-step hybrid framework:

```
Raw series
    └─► STL decomposition  ──►  Trend  ──►  Rolling-window GM(1,1)
                                │
                                └─►  Seasonal + Residual  ──►  GWO-ANFIS
                                                                    │
                                                               Forecast ◄──────────┘
```

1. **STL** separates the series into trend, seasonal, and residual components.  
2. **GM(1,1)** (Grey Model) projects the trend with a rolling window selected by multi-horizon back-testing.  
3. **GWO-ANFIS** — Grey Wolf Optimizer tuning an Adaptive Neuro-Fuzzy Inference System — forecasts the nonlinear seasonal + residual component.  
4. Components are recombined to produce the final forecast.

For multi-year horizons, the long-term trend window is re-selected by back-testing on 5 historical checkpoints, and scenario paths are applied via an elasticity coefficient β linking the target series growth to the leading exogenous driver (IIP for Vietnam).

> **Test-set accuracy on Vietnam data (one-step-ahead, 2022–2024): MAPE 4.1052%**

---

## Citation

If you use this code or the DeGNA model in your work, please cite:

```bibtex
@article{pham2026degna,
  title   = {A New Hybrid Framework Based on Grey and Neuro-Fuzzy Inference System
             for Energy Demand Forecasting in Vietnam},
  author  = {Pham, Xuan Kien and Nguyen, Van Dat and Phan, Van Thanh and Nguyen, Duc Trien},
  journal = {Computer Modeling in Engineering \& Sciences},
  volume  = {148},
  number  = {1},
  year    = {2026},
  doi     = {10.32604/cmes.2026.086196},
  url     = {https://doi.org/10.32604/cmes.2026.086196}
}
```

**Authors:**
Xuan Kien Pham¹ · Van Dat Nguyen²\* · Van Thanh Phan³\* · Duc Trien Nguyen⁴\*

¹ Ho Chi Minh University of Banking · ² Ho Chi Minh University of Banking  
³ Vietnam-Korea University of ICT, University of Da Nang · ⁴ Vietnam-Korea University of ICT, University of Da Nang

---

## Getting Started

### Requirements

- Node.js ≥ 20.12
- Python ≥ 3.10 (only for re-training or running Python tests)

### Install & run

```bash
npm install
npm run dev          # Dev server at http://localhost:5173
npm test             # TypeScript unit & integration tests
npm run test:py      # Python core tests (requires numpy scipy statsmodels pandas openpyxl pytest)
npm run build        # Production build → dist/
```

### Re-train the Vietnam model

`src/data/vietnam.json` ships with pre-trained parameters exported from the script below. Without model parameters, the free scenario sliders and Impact Analysis tab are locked. To regenerate:

```bash
python python/scripts/train_vietnam.py "path/to/Data_Energy_Vietnam.xlsx"
```

This retrains with the exact paper configuration (GWO: 30 runs × 80 wolves × 200 iterations, ~1 min), prints a comparison against the published test-set metrics, and overwrites `src/data/vietnam.json`.

**Reproducing Table 4.4 from the paper:** load `Data_Energy_Vietnam.xlsx` into the Forecasting Tool. You should get MAPE 4.1052%, window 60 months, β ≈ 0.023. Set the IIP reference rate to 6.5% and IIP/FDI scenario rates to 6.5%/5.5% to reproduce the Base scenario (difference ≤ 0.01 TWh due to Denton solver rounding for future exogenous series).

---

## Deployment

### GitHub Pages

```bash
npm run build
# Push the dist/ directory to your gh-pages branch,
# or configure GitHub Actions to deploy automatically.
```

The app uses **hash routing** (`/#/energy`, `/#/tool`), so deep links work without server-side 404 handling.

### Configuration

Copy `.env.example` to `.env`:

| Variable | Description |
|---|---|
| `VITE_PYODIDE_URL` | Pyodide CDN origin (defaults to jsDelivr). |
| `VITE_AI_PROXY_URL` | Optional AI proxy endpoint (see `ai-proxy/README.md`). Leave blank to hide the AI assistant panel. |

---

## Project Structure

```
python/
  foresight/          DeGNA core: denton, gm11, anfis, gwo, pipeline, checks, selection, api
  scripts/
    train_vietnam.py  Trains the model and exports vietnam.json
    make_engine_fixture.py  Generates TypeScript test fixtures from Python output

src/
  engine/             TypeScript port of Denton–Cholette and forecast loop (tested against Python)
  pages/
    Energy/           Vietnam Energy dashboard (3 tabs: Forecast, Balance, Impact)
    Tool/             Forecasting Tool (5-step wizard: Upload → Map → Check → Train → Result)
  workers/            Pyodide web worker (runs full Python pipeline in-browser)
  components/charts/  SVG line chart with zoom/pan controls
  content/vi.ts       All UI strings (Vietnamese)

ai-proxy/             Optional Cloudflare Worker for AI assistant proxying
```

---

## How the Long-Term Forecast Works

The standard GM(1,1) rolling window (Step 2 of DeGNA) is designed for one-step-ahead forecasting where each month's actual value is fed back in. For multi-year horizons without new actuals, `python/foresight/longterm.py` applies three adjustments:

1. **Window re-selection** — a longer window is chosen by back-testing on 5 historical checkpoints (each using only data available up to that point), minimising the annual total MAPE over a 6-year horizon. For Vietnam: 60-month window, MAPE 9.64%.
2. **Scenario shifting** — the GM(1,1) path is scaled by `(1 + β·(g − g_ref))^(k/12)`, where β is the elasticity between the target series and the first exogenous driver (Vietnam: β ≈ 0.023 vs. IIP).
3. **GWO-ANFIS** forecasts the seasonal + residual component using the training-set normaliser.

A regression-based trend (time + exogenous variables) is computed in parallel as a comparison line in both the Energy and Tool spaces.

---

## License

Source code: [MIT](LICENSE)  
Paper: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — © 2026 The Authors, Tech Science Press
