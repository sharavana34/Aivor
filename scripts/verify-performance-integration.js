"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml"
};

const srv = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split("?")[0]);
  if (u === "/") u = "/performance.html";
  const fp = path.join(root, u.replace(/^\//, ""));
  if (!fp.startsWith(root) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    res.writeHead(404);
    res.end("no");
    return;
  }
  res.writeHead(200, { "Content-Type": mime[path.extname(fp)] || "text/plain" });
  fs.createReadStream(fp).pipe(res);
});

srv.listen(8765, async () => {
  const urls = [
    "/performance.html?product=hf&type=backtest",
    "/performance.html?product=hf&type=live",
    "/performance.html?product=scalper&type=backtest",
    "/performance.html?product=scalper&type=live",
    "/performance.html?product=swing&type=backtest",
    "/performance.html?product=swing&type=live",
    "/data/hf-live.json",
    "/data/hf-backtest.json",
    "/data/scalper-backtest.json",
    "/data/swing-backtest.json",
    "/data/scalper-live.json",
    "/data/swing-live.json",
    "/js/performance-data/hf-live.js",
    "/js/performance-data/hf-backtest.js",
    "/js/performance-data/scalper-backtest.js",
    "/js/performance-data/swing-backtest.js",
    "/js/performance-data/scalper-live.js",
    "/js/performance-data/swing-live.js",
    "/js/performance.js",
    "/js/performance-data/card-metrics.js",
    "/products.html"
  ];
  for (const u of urls) {
    const r = await fetch("http://127.0.0.1:8765" + u);
    console.log(r.status, u);
  }

  function extractAssignedJson(src, marker) {
    const i = src.indexOf(marker);
    if (i < 0) throw new Error("missing marker: " + marker);
    const start = i + marker.length;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let p = start; p < src.length; p++) {
      const ch = src[p];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') {
        inStr = true;
        continue;
      }
      if (ch === "{" || ch === "[") depth++;
      else if (ch === "}" || ch === "]") {
        depth--;
        if (depth === 0) return JSON.parse(src.slice(start, p + 1));
      }
    }
    throw new Error("unclosed JSON after " + marker);
  }

  const m = fs.readFileSync(path.join(root, "js/performance-data/card-metrics.js"), "utf8");
  const json = extractAssignedJson(m, "window.AIVOR_CARD_METRICS = ");
  const live = JSON.parse(fs.readFileSync(path.join(root, "data/hf-live.json"), "utf8"));
  const bt = JSON.parse(fs.readFileSync(path.join(root, "data/hf-backtest.json"), "utf8"));
  const sc = JSON.parse(fs.readFileSync(path.join(root, "data/scalper-backtest.json"), "utf8"));
  const sw = JSON.parse(fs.readFileSync(path.join(root, "data/swing-backtest.json"), "utf8"));
  const scLive = JSON.parse(fs.readFileSync(path.join(root, "data/scalper-live.json"), "utf8"));
  const swLive = JSON.parse(fs.readFileSync(path.join(root, "data/swing-live.json"), "utf8"));

  function pick(cm) {
    return {
      avgMonthlyNetProfit: cm.avgMonthlyNetProfit,
      avgMonthlyReturnPct: cm.avgMonthlyReturnPct,
      avgMonthlyMaxEquityDd: cm.avgMonthlyMaxEquityDd,
      avgMonthlyMaxEquityDdPct: cm.avgMonthlyMaxEquityDdPct,
      periodLabel: cm.periodLabel
    };
  }

  function loadJsBundle(key) {
    const src = fs.readFileSync(
      path.join(root, "js/performance-data", key + ".js"),
      "utf8"
    );
    return extractAssignedJson(
      src,
      "window.AIVOR_PERF_DATA[" + JSON.stringify(key) + "] = "
    );
  }

  const combos = [
    ["hf", "backtest", true, 48475.34],
    ["hf", "live", true, 10458.17],
    ["scalper", "backtest", true, 618],
    ["scalper", "live", false, null],
    ["swing", "backtest", true, 10163.2],
    ["swing", "live", false, null]
  ];

  console.log("--- six combinations (JSON + JS bundle) ---");
  for (const [product, type, expectAvail, expectNet] of combos) {
    const key = product + "-" + type;
    const fromJson = JSON.parse(
      fs.readFileSync(path.join(root, "data", key + ".json"), "utf8")
    );
    const fromJs = loadJsBundle(key);
    const jsonOk =
      fromJson.available === expectAvail &&
      (expectNet == null || fromJson.summary.netProfit === expectNet);
    const jsOk =
      fromJs.available === expectAvail &&
      (expectNet == null || (fromJs.summary && fromJs.summary.netProfit === expectNet));
    const match =
      JSON.stringify(fromJson.summary) === JSON.stringify(fromJs.summary) &&
      fromJson.available === fromJs.available;
    console.log(
      key,
      "jsonOk=" + jsonOk,
      "jsOk=" + jsOk,
      "json===js=" + match,
      "available=" + fromJson.available,
      expectNet != null ? "net=" + fromJson.summary.netProfit : fromJson.unavailableReason
    );
  }

  // Simulate performance.js routing decisions
  const AVAILABILITY = {
    hf: { backtest: true, live: true },
    scalper: { backtest: true, live: false },
    swing: { backtest: true, live: false }
  };
  console.log("--- route simulation ---");
  for (const [product, type, expectAvail] of combos) {
    const hardBlock = !AVAILABILITY[product][type];
    const key = product + "-" + type;
    const data = JSON.parse(
      fs.readFileSync(path.join(root, "data", key + ".json"), "utf8")
    );
    const ui =
      hardBlock || data.available === false ? "UNAVAILABLE" : "VERIFIED REPORT";
    const expectedUi = expectAvail ? "VERIFIED REPORT" : "UNAVAILABLE";
    console.log(key, "ui=" + ui, "ok=" + (ui === expectedUi));
  }

  console.log("SYNC hf", JSON.stringify(pick(live.cardMetrics)) === JSON.stringify(pick(json.hf)));
  console.log("SYNC scalper", sc.cardMetrics.avgMonthlyNetProfit === json.scalper.avgMonthlyNetProfit);
  console.log("SYNC swing", sw.cardMetrics.avgMonthlyNetProfit === json.swing.avgMonthlyNetProfit);
  console.log("HF live≠backtest", live.summary.netProfit !== bt.summary.netProfit, live.summary.netProfit, bt.summary.netProfit);
  console.log("scalper live unavailable", scLive.available === false, scLive.unavailableReason);
  console.log("swing live unavailable", swLive.available === false, swLive.unavailableReason);
  console.log("excel vs summary net hf-bt", bt.excelResults.totalNetProfit, bt.summary.netProfit);
  console.log("excel vs summary net sc", sc.excelResults.totalNetProfit, sc.summary.netProfit);
  console.log("excel vs summary net sw", sw.excelResults.totalNetProfit, sw.summary.netProfit);
  console.log("chart pts", {
    hfLive: live.chartPointCounts,
    hfBt: bt.chartPointCounts,
    sc: sc.chartPointCounts,
    sw: sw.chartPointCounts
  });

  // Subpath base check: assetBase from /Aivor/js/performance.js
  const fakeBase = "https://example.github.io/Aivor/";
  const dataUrl = fakeBase + "data/hf-backtest.json";
  const scriptUrl = fakeBase + "js/performance-data/hf-backtest.js";
  console.log("gh-pages paths", dataUrl, scriptUrl);

  srv.close();
});
