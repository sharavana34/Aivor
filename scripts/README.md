# Performance data generator

Offline script that converts MetaTrader Excel reports into shared JSON for GitHub Pages.

## Inputs

Original workbooks (do not modify):

`…/docs/performance-reports/*.xlsx`

Copies are kept under `site/data/source-reports/` for regeneration. Runtime pages never load `.xlsx` files.

`performance.js` loads `data/{product}-{type}.json` over http(s), and falls back to `js/performance-data/{product}-{type}.js` (also used on `file://`, where `fetch` of JSON is blocked).

## Run

```bash
cd D:\Aivor\site
node --max-old-space-size=8192 scripts/generate-performance-data.js
```

HF Live (~10MB xlsx / ~123MB UTF-16 sheet XML) is parsed by streaming the unzipped worksheet. Tester reports use SheetJS (`vendor/xlsx.full.min.js`).

## Outputs

| Path | Role |
|------|------|
| `data/hf-live.json` | HF live |
| `data/hf-backtest.json` | HF backtest |
| `data/scalper-backtest.json` | Scalper backtest |
| `data/swing-backtest.json` | Swing backtest |
| `data/scalper-live.json` / `data/swing-live.json` | Unavailable stubs |
| `data/manifest.json` | Index + discrepancies |
| `js/performance-data/*.js` | Same datasets as `window.AIVOR_PERF_DATA[key]` (file:// + fetch fallback) |
| `js/performance-data/manifest.js` | Browser manifest |
| `js/performance-data/card-metrics.js` | Product-card averages |

`performance.html` and `products.html` both read this shared source.
