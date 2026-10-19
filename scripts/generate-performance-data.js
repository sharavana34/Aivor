/**
 * Generate shared performance JSON from MT5 Excel reports.
 *
 * Usage (from D:\\Aivor\\site):
 *   node --max-old-space-size=8192 scripts/generate-performance-data.js
 *
 * Inputs: docs/performance-reports originals (copied under data/source-reports).
 * Outputs: data/*.json + js/performance-data/manifest.js
 *
 * Runtime site pages fetch/read the JSON only — this script is offline.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const XLSX = require(path.join(ROOT, "vendor", "xlsx.full.min.js"));

const STORE_REPORTS = path.join(
  "C:",
  "Users",
  "ctc",
  "AppData",
  "Local",
  "Cursor",
  "AgentStores",
  "cursor_agent_stores",
  "bc-b24c0947-da3e-4d92-bcc8-affb033c17de",
  "files",
  "docs",
  "performance-reports"
);

const OUT_DATA = path.join(ROOT, "data");
const OUT_JS = path.join(ROOT, "js", "performance-data");
const SOURCE_COPIES = path.join(OUT_DATA, "source-reports");
const TMP_LIVE = path.join(ROOT, "_tmp_hf_live_xlsx");

const FILES = {
  "hf-live": {
    product: "hf",
    reportType: "live",
    file: "ReportHistory-26444548-Aivor-HF-Live.xlsx",
    mode: "live-stream"
  },
  "hf-backtest": {
    product: "hf",
    reportType: "backtest",
    file: "ReportTester-26444548-Aivor-HF-Backtest.xlsx",
    mode: "sheetjs"
  },
  "scalper-backtest": {
    product: "scalper",
    reportType: "backtest",
    file: "ReportTester-26444548-Aivor-Scalper-Backtest.xlsx",
    mode: "sheetjs"
  },
  "swing-backtest": {
    product: "swing",
    reportType: "backtest",
    file: "ReportTester-26444548-Aivor-Swing-backtest.xlsx",
    mode: "sheetjs"
  }
};

const MAX_TRADES = 2500; // closed deals kept in JSON for UI table

function round2(n) {
  return Math.round(n * 100) / 100;
}
function round4(n) {
  return Math.round(n * 10000) / 10000;
}
function parseNum(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  let s = String(v).trim().replace(/\u00a0/g, " ");
  s = s.replace(/\s+/g, "").replace(/^\+/, "");
  // MT5 often uses "- 12.34"
  s = s.replace(/^-\s*/, "-");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
function parseDealDate(t) {
  const m = String(t).match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  return m ? m[1] + "-" + m[2] + "-" + m[3] : null;
}
function parseDealDateTime(t) {
  const m = String(t).match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return parseDealDate(t);
  return m[1] + "-" + m[2] + "-" + m[3] + "T" + m[4] + ":" + m[5] + ":" + (m[6] || "00");
}
function isClosedDirection(dir) {
  return String(dir || "").toLowerCase() === "out";
}
function mean(nums) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function pad2(n) {
  return n < 10 ? "0" + n : String(n);
}
function monthLabel(y, m) {
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
  return names[m - 1] + " " + y;
}

function extractHeaderMeta(rows) {
  const meta = {
    kind: "unknown",
    name: "",
    account: "",
    company: "",
    currency: "",
    depositHeader: null,
    expert: "",
    symbol: "",
    periodRaw: "",
    server: "",
    reportDate: ""
  };
  const title = String((rows[0] && rows[0][0]) || "");
  if (/Trade History/i.test(title)) meta.kind = "live";
  else if (/Strategy Tester/i.test(title)) meta.kind = "tester";

  if (rows[1] && rows[1][0] && !/^(Settings|Name:)/i.test(String(rows[1][0]))) {
    meta.server = String(rows[1][0]).trim();
  }

  function cellVal(row, preferCols) {
    for (const c of preferCols) {
      if (row[c] != null && String(row[c]).trim() !== "") return row[c];
    }
    return "";
  }

  for (let i = 0; i < Math.min(160, rows.length); i++) {
    const a = String(rows[i][0] || "").trim();
    // Tester reports put values in col D (3); live Trade History often uses col B (1).
    const v = cellVal(rows[i], [3, 1, 2, 4]);
    if (a.startsWith("Name:")) meta.name = String(v || "").trim();
    if (a.startsWith("Account:")) {
      const s = String(v || "");
      meta.account = (s.match(/^(\d+)/) || [])[1] || s.split("(")[0].trim();
      const cur = s.match(/\(([A-Z]{3})\b/);
      if (cur) meta.currency = cur[1];
      if (/Vantage/i.test(s) && !meta.company) meta.company = "Vantage Markets";
    }
    if (a.startsWith("Company:")) {
      meta.company = String(v || "")
        .replace(/\s*\(Pty\)\s*Ltd\.?/i, "")
        .trim();
    }
    if (a.startsWith("Currency:")) {
      const cur = String(v || "").trim();
      if (/^[A-Z]{3}$/.test(cur)) meta.currency = cur;
      else meta.currencyNote = cur;
    }
    if (a.startsWith("Initial Deposit:") || a === "Initial Deposit") {
      meta.depositHeader = parseNum(v);
    }
    if (a.startsWith("Expert:")) meta.expert = String(v || "").trim();
    if (a.startsWith("Symbol:")) meta.symbol = String(v || "").trim();
    if (a.startsWith("Period:")) meta.periodRaw = String(v || "").trim();
    if (a.startsWith("Date:")) meta.reportDate = String(v || "").trim();
  }
  // Fallback: scan early cells for Account "(USC, …)" if column layout differed.
  if (!meta.currency) {
    for (let i = 0; i < Math.min(40, rows.length); i++) {
      for (let c = 0; c < Math.min(8, (rows[i] || []).length); c++) {
        const s = String(rows[i][c] || "");
        const m2 = s.match(/(\d{5,})\s*\(([A-Z]{3})\b/);
        if (m2) {
          meta.account = meta.account || m2[1];
          meta.currency = m2[2];
        }
      }
    }
  }
  return meta;
}

function extractTesterResults(rows) {
  const out = {};
  let inResults = false;
  for (let i = 0; i < Math.min(200, rows.length); i++) {
    const a = String(rows[i][0] || "").trim();
    if (a === "Results") {
      inResults = true;
      continue;
    }
    if (!inResults) continue;
    if (a === "Orders" || a === "Deals" || a === "Positions") break;

    function grab(label, cols) {
      if (a.startsWith(label)) {
        for (const c of cols) {
          const v = rows[i][c];
          if (v != null && String(v).trim() !== "") return String(v).trim();
        }
      }
      return null;
    }

    const net = grab("Total Net Profit:", [3]);
    if (net != null) out.totalNetProfit = parseNum(net);
    const gp = grab("Gross Profit:", [3]);
    if (gp != null) out.grossProfit = parseNum(gp);
    const gl = grab("Gross Loss:", [3]);
    if (gl != null) out.grossLoss = parseNum(gl);
    const pf = grab("Profit Factor:", [3]);
    if (pf != null) out.profitFactor = parseNum(pf);
    const rf = grab("Recovery Factor:", [3]);
    if (rf != null) out.recoveryFactor = parseNum(rf);
    const tt = grab("Total Trades:", [3]);
    if (tt != null) out.totalTrades = parseNum(tt);
    const td = grab("Total Deals:", [3]);
    if (td != null) out.totalDeals = parseNum(td);

    // drawdowns in columns 7 / 11
    if (a.startsWith("Gross Profit:") || a.startsWith("Total Net Profit:")) {
      // Balance / Equity absolute on same rows for Net/Gross lines
    }
    if (a.startsWith("Gross Profit:")) {
      const balMax = String(rows[i][7] || "");
      const eqMax = String(rows[i][11] || "");
      const bm = balMax.match(/([\d\s.,]+)\s*\(([\d.,]+)\s*%\)/);
      const em = eqMax.match(/([\d\s.,]+)\s*\(([\d.,]+)\s*%\)/);
      if (bm) {
        out.balanceDrawdownMaximalAmount = parseNum(bm[1]);
        out.balanceDrawdownMaximalPct = parseNum(bm[2]);
      }
      if (em) {
        out.equityDrawdownMaximalAmount = parseNum(em[1]);
        out.equityDrawdownMaximalPct = parseNum(em[2]);
      }
    }
    if (a.startsWith("Profit Trades") || (rows[i][4] && String(rows[i][4]).startsWith("Profit Trades"))) {
      const pt = String(rows[i][7] || "");
      const lt = String(rows[i][11] || "");
      const pm = pt.match(/([\d\s]+)\s*\(([\d.,]+)\s*%\)/);
      const lm = lt.match(/([\d\s]+)\s*\(([\d.,]+)\s*%\)/);
      if (pm) {
        out.profitTrades = parseNum(pm[1]);
        out.profitTradesPct = parseNum(pm[2]);
      }
      if (lm) {
        out.lossTrades = parseNum(lm[1]);
        out.lossTradesPct = parseNum(lm[2]);
      }
    }
    if (rows[i][4] && String(rows[i][4]).startsWith("Average profit trade:")) {
      out.avgProfitTrade = parseNum(rows[i][7]);
      out.avgLossTrade = parseNum(rows[i][11]);
    }
  }
  return out;
}

function findDealsSection(rows) {
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || "").trim() === "Deals") {
      const header = (rows[i + 1] || []).map((x) => String(x == null ? "" : x).trim());
      if (header[0] === "Time" && header.indexOf("Deal") >= 0 && header.indexOf("Balance") >= 0) {
        return { start: i, header };
      }
    }
  }
  return null;
}

function readDealsFromRows(rows) {
  const dealsSec = findDealsSection(rows);
  if (!dealsSec) throw new Error("Could not find Deals table");
  const col = {};
  dealsSec.header.forEach((h, i) => {
    if (h) col[h] = i;
  });
  const need = ["Time", "Type", "Profit", "Balance"];
  for (const n of need) {
    if (col[n] == null) throw new Error("Deals missing column " + n);
  }
  const deals = [];
  for (let i = dealsSec.start + 2; i < rows.length; i++) {
    const r = rows[i];
    const time = String(r[col.Time] || "");
    if (!/^\d{4}\.\d{2}\.\d{2}/.test(time)) {
      // allow blank footer totals row
      if (!time.trim()) continue;
      break;
    }
    const date = parseDealDate(time);
    if (!date) continue;
    deals.push({
      time,
      date,
      dateTime: parseDealDateTime(time),
      deal: col.Deal != null ? String(r[col.Deal] || "") : "",
      type: String(r[col.Type] || "").toLowerCase(),
      direction: String((col.Direction != null ? r[col.Direction] : "") || "").toLowerCase(),
      volume: col.Volume != null ? parseNum(r[col.Volume]) : null,
      price: col.Price != null ? parseNum(r[col.Price]) : null,
      profit: parseNum(r[col.Profit]),
      balance: parseNum(r[col.Balance]),
      commission: col.Commission != null ? parseNum(r[col.Commission]) : 0,
      fee: col.Fee != null ? parseNum(r[col.Fee]) : 0,
      swap: col.Swap != null ? parseNum(r[col.Swap]) : 0,
      symbol: col.Symbol != null ? String(r[col.Symbol] || "") : "",
      comment: col.Comment != null ? String(r[col.Comment] || "") : ""
    });
  }
  return deals;
}

function buildFromDeals(deals, meta, excelResults) {
  // chronological assumed
  let deposited = 0;
  let withdrawn = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let wins = 0;
  let losses = 0;
  let closed = 0;
  let winSum = 0;
  let lossSum = 0;

  const byDate = new Map();
  for (const d of deals) {
    if (!byDate.has(d.date)) byDate.set(d.date, []);
    byDate.get(d.date).push(d);

    if (d.type === "balance") {
      if (d.profit > 0) deposited += d.profit;
      else if (d.profit < 0) withdrawn += Math.abs(d.profit);
    } else {
      if (d.profit > 0) grossProfit += d.profit;
      else if (d.profit < 0) grossLoss += d.profit; // negative
      if (isClosedDirection(d.direction)) {
        closed += 1;
        if (d.profit > 0) {
          wins += 1;
          winSum += d.profit;
        } else if (d.profit < 0) {
          losses += 1;
          lossSum += d.profit;
        }
      }
    }
  }

  const dates = [...byDate.keys()].sort();
  // Seed previous balance so mid-stream live histories (no deposit deal) do not
  // count opening equity as trading profit.
  let prevBal = null;
  if (deposited === 0 && deals.length) {
    const first = deals[0];
    if (first.type === "balance") prevBal = 0;
    else {
      prevBal = round2(first.balance - first.profit - first.commission - first.swap);
    }
  } else {
    prevBal = 0;
  }

  const daily = [];
  for (const date of dates) {
    const list = byDate.get(date);
    let dep = 0;
    let wd = 0;
    let dayGross = 0;
    let dayComm = 0;
    let dayWins = 0;
    let dayLosses = 0;
    let dayOut = 0;
    for (const d of list) {
      if (d.type === "balance") {
        if (d.profit > 0) dep += d.profit;
        else if (d.profit < 0) wd += d.profit;
      } else {
        dayGross += d.profit;
        dayComm += d.commission + (d.fee || 0) + d.swap;
        if (isClosedDirection(d.direction)) {
          dayOut += 1;
          if (d.profit > 0) dayWins += 1;
          else if (d.profit < 0) dayLosses += 1;
        }
      }
    }
    const endBal = list[list.length - 1].balance;
    const pl = round2(endBal - prevBal - dep - wd);
    daily.push({
      d: date,
      pl,
      bal: endBal,
      equity: endBal, // deal history has balance; floating equity unavailable
      gross: round2(dayGross),
      comm: round2(dayComm),
      wins: dayWins,
      losses: dayLosses,
      out: dayOut,
      dep: round2(dep),
      wd: round2(wd)
    });
    prevBal = endBal;
  }

  const firstDepositDeal = deals.find((d) => d.type === "balance" && d.profit > 0);
  const initialBalance =
    meta.depositHeader != null
      ? meta.depositHeader
      : firstDepositDeal
        ? round2(firstDepositDeal.profit)
        : deals.length
          ? round2(
              deals[0].type === "balance"
                ? deals[0].profit
                : deals[0].balance - deals[0].profit - deals[0].commission - deals[0].swap
            )
          : daily[0]?.bal || 0;
  const finalBalance = daily.length ? daily[daily.length - 1].bal : initialBalance;
  // Trading net = sum of daily trading P/L (deposits/withdrawals excluded by construction)
  const tradingNet = round2(daily.reduce((s, d) => s + d.pl, 0));

  // Balance peak-to-trough DD from daily end balances
  let peak = -Infinity;
  let maxDdAmt = 0;
  let maxDdPct = 0;
  const ddSeries = [];
  for (const d of daily) {
    if (d.bal > peak) peak = d.bal;
    const ddAmt = round2(peak - d.bal);
    const ddPct = peak > 0 ? round4((ddAmt / peak) * 100) : 0;
    if (ddAmt > maxDdAmt) maxDdAmt = ddAmt;
    if (ddPct > maxDdPct) maxDdPct = ddPct;
    ddSeries.push({ t: d.d, drawdownAmount: ddAmt, drawdownPct: ddPct, balance: d.bal });
  }

  // Monthly aggregation with starting equity = prior day end balance (or initial)
  const monthMap = new Map();
  let runningBalBefore = initialBalance;
  // rebuild with intra-month peak from daily
  for (let i = 0; i < daily.length; i++) {
    const d = daily[i];
    const key = d.d.slice(0, 7);
    if (!monthMap.has(key)) {
      const [y, m] = key.split("-").map(Number);
      monthMap.set(key, {
        year: y,
        month: m,
        key,
        label: monthLabel(y, m),
        startingEquity: runningBalBefore,
        endingEquity: d.bal,
        netProfit: 0,
        trades: 0,
        wins: 0,
        losses: 0,
        peak: runningBalBefore,
        maxDrawdownAmount: 0,
        days: []
      });
    }
    const row = monthMap.get(key);
    row.netProfit = round2(row.netProfit + d.pl);
    row.endingEquity = d.bal;
    row.trades += d.out;
    row.wins += d.wins;
    row.losses += d.losses;
    row.days.push(d);
    if (d.bal > row.peak) row.peak = d.bal;
    const dd = round2(row.peak - d.bal);
    if (dd > row.maxDrawdownAmount) row.maxDrawdownAmount = dd;
    runningBalBefore = d.bal;
  }

  const monthly = [...monthMap.values()].map((row) => {
    const start = row.startingEquity > 0 ? row.startingEquity : initialBalance;
    const returnPct = start > 0 ? round4((row.netProfit / start) * 100) : null;
    const maxDrawdownPct =
      row.peak > 0 ? round4((row.maxDrawdownAmount / row.peak) * 100) : null;
    return {
      year: row.year,
      month: row.month,
      key: row.key,
      label: row.label,
      netProfit: round2(row.netProfit),
      returnPct,
      startingEquity: round2(row.startingEquity),
      endingEquity: round2(row.endingEquity),
      maxDrawdownAmount: round2(row.maxDrawdownAmount),
      maxDrawdownPct,
      trades: row.trades,
      wins: row.wins,
      losses: row.losses
    };
  });

  const avgMonthlyNetProfit = mean(monthly.map((m) => m.netProfit));
  const avgMonthlyReturnPct = mean(monthly.filter((m) => m.returnPct != null).map((m) => m.returnPct));
  const avgMonthlyMaxEquityDd = mean(monthly.map((m) => m.maxDrawdownAmount));
  const avgMonthlyMaxEquityDdPct = mean(
    monthly.filter((m) => m.maxDrawdownPct != null).map((m) => m.maxDrawdownPct)
  );

  const periodFrom = daily[0]?.d || null;
  const periodTo = daily[daily.length - 1]?.d || null;
  const periodLabel =
    periodFrom && periodTo
      ? periodFrom.slice(0, 7) === periodTo.slice(0, 7)
        ? monthLabel(Number(periodFrom.slice(0, 4)), Number(periodFrom.slice(5, 7)))
        : periodFrom.replace(/-/g, ".") + " – " + periodTo.replace(/-/g, ".")
      : meta.periodRaw || "Period unavailable";

  const returnPct =
    initialBalance > 0 ? round4((tradingNet / initialBalance) * 100) : null;

  // Prefer Excel Results equity DD when present (tester); else balance DD from series
  const summaryMaxDdAmt =
    excelResults && excelResults.equityDrawdownMaximalAmount != null
      ? excelResults.equityDrawdownMaximalAmount
      : maxDdAmt;
  const summaryMaxDdPct =
    excelResults && excelResults.equityDrawdownMaximalPct != null
      ? excelResults.equityDrawdownMaximalPct
      : maxDdPct;
  const summaryDdBasis =
    excelResults && excelResults.equityDrawdownMaximalAmount != null ? "equity" : "balance";

  const profitFactor =
    excelResults && excelResults.profitFactor != null
      ? excelResults.profitFactor
      : grossLoss < 0
        ? round4(grossProfit / Math.abs(grossLoss))
        : null;

  const recoveryFactor =
    excelResults && excelResults.recoveryFactor != null
      ? excelResults.recoveryFactor
      : summaryMaxDdAmt > 0
        ? round4(tradingNet / summaryMaxDdAmt)
        : null;

  const totalTrades =
    excelResults && excelResults.totalTrades != null ? excelResults.totalTrades : closed;
  const winningTrades =
    excelResults && excelResults.profitTrades != null ? excelResults.profitTrades : wins;
  const losingTrades =
    excelResults && excelResults.lossTrades != null ? excelResults.lossTrades : losses;
  const winRatePct =
    totalTrades > 0 ? round4((winningTrades / totalTrades) * 100) : null;

  const avgWin =
    excelResults && excelResults.avgProfitTrade != null
      ? excelResults.avgProfitTrade
      : wins > 0
        ? round2(winSum / wins)
        : null;
  const avgLoss =
    excelResults && excelResults.avgLossTrade != null
      ? excelResults.avgLossTrade
      : losses > 0
        ? round2(lossSum / losses)
        : null;

  // Equity/balance chart: daily end points (real chronological)
  const equitySeries = daily.map((d) => ({
    t: d.d,
    balance: d.bal,
    equity: d.equity,
    netProfitCum: null
  }));
  let cum = 0;
  for (const p of equitySeries) {
    const day = daily.find((d) => d.d === p.t);
    cum = round2(cum + (day ? day.pl : 0));
    p.netProfitCum = cum;
  }

  const closedTrades = deals
    .filter((d) => d.type !== "balance" && isClosedDirection(d.direction))
    .map((d) => ({
      time: d.time,
      date: d.date,
      deal: d.deal,
      symbol: d.symbol,
      type: d.type,
      direction: d.direction,
      volume: d.volume,
      price: d.price,
      commission: d.commission,
      swap: d.swap,
      profit: d.profit,
      balance: d.balance,
      comment: d.comment
    }));

  const tradesTruncated = closedTrades.length > MAX_TRADES;
  const trades = tradesTruncated
    ? closedTrades.slice(closedTrades.length - MAX_TRADES)
    : closedTrades;

  // Currency: live Account (USC); tester may say "profit in pips" — use deposit currency if known
  let currency = meta.currency || null;
  let currencyNote = meta.currencyNote || null;
  if (!currency && /USC/i.test(meta.account || "")) currency = "USC";

  return {
    available: true,
    unavailableReason: null,
    product: null, // filled by caller
    reportType: null,
    currency,
    currencyNote,
    period: {
      from: periodFrom,
      to: periodTo,
      label: periodLabel,
      raw: meta.periodRaw || null
    },
    meta: {
      kind: meta.kind,
      name: meta.name || null,
      account: meta.account || null,
      company: meta.company || null,
      expert: meta.expert || null,
      symbol: meta.symbol || null,
      server: meta.server || null,
      reportDate: meta.reportDate || null
    },
    summary: {
      initialBalance: round2(initialBalance),
      finalBalance: round2(finalBalance),
      netProfit: tradingNet,
      grossProfit: round2(
        excelResults && excelResults.grossProfit != null ? excelResults.grossProfit : grossProfit
      ),
      grossLoss: round2(
        excelResults && excelResults.grossLoss != null ? excelResults.grossLoss : grossLoss
      ),
      returnPct,
      maxDrawdownAmount: round2(summaryMaxDdAmt),
      maxDrawdownPct: round4(summaryMaxDdPct),
      maxDrawdownBasis: summaryDdBasis,
      balanceMaxDrawdownAmount: round2(maxDdAmt),
      balanceMaxDrawdownPct: round4(maxDdPct),
      profitFactor,
      recoveryFactor,
      totalTrades,
      winningTrades,
      losingTrades,
      winRatePct,
      avgWin,
      avgLoss,
      deposited: round2(deposited),
      withdrawn: round2(withdrawn)
    },
    excelResults: excelResults || null,
    charts: {
      equityBalance: equitySeries,
      monthlyPl: monthly.map((m) => ({ t: m.key, label: m.label, value: m.netProfit })),
      monthlyReturnPct: monthly.map((m) => ({ t: m.key, label: m.label, value: m.returnPct })),
      drawdown: ddSeries,
      aggregation: "daily end-of-day balance from Deals (not fabricated)"
    },
    monthly,
    cardMetrics: {
      avgMonthlyNetProfit: avgMonthlyNetProfit != null ? round2(avgMonthlyNetProfit) : null,
      avgMonthlyReturnPct: avgMonthlyReturnPct != null ? round4(avgMonthlyReturnPct) : null,
      avgMonthlyMaxEquityDd: avgMonthlyMaxEquityDd != null ? round2(avgMonthlyMaxEquityDd) : null,
      avgMonthlyMaxEquityDdPct:
        avgMonthlyMaxEquityDdPct != null ? round4(avgMonthlyMaxEquityDdPct) : null,
      periodLabel,
      monthCount: monthly.length,
      method: {
        avgMonthlyNetProfit: "Arithmetic mean of monthly trading net P/L (deposits/withdrawals excluded).",
        avgMonthlyReturnPct:
          "Arithmetic mean of (month net P/L / month starting equity) × 100, starting equity = prior end balance.",
        avgMonthlyMaxEquityDd:
          "Arithmetic mean of each month's peak-to-trough drawdown on end-of-day balance within that month (floating equity unavailable in Deals).",
        avgMonthlyMaxEquityDdPct: "Arithmetic mean of each month's peak-to-trough drawdown % vs intra-month peak."
      }
    },
    trades: {
      available: closedTrades.length > 0,
      totalClosed: closedTrades.length,
      returned: trades.length,
      truncated: tradesTruncated,
      note: tradesTruncated
        ? "Returning the most recent " + MAX_TRADES + " closed deals (direction=out)."
        : "All closed deals (direction=out).",
      rows: trades
    },
    chartPointCounts: {
      equityBalance: equitySeries.length,
      monthlyPl: monthly.length,
      monthlyReturnPct: monthly.length,
      drawdown: ddSeries.length,
      closedTrades: closedTrades.length
    }
  };
}

function ensureLiveUnzipped(srcFile) {
  const unzipped = path.join(TMP_LIVE, "unzipped");
  const sheet = path.join(unzipped, "xl", "worksheets", "sheet1.xml");
  if (fs.existsSync(sheet) && fs.statSync(sheet).size > 1000) return unzipped;
  fs.rmSync(TMP_LIVE, { recursive: true, force: true });
  fs.mkdirSync(TMP_LIVE, { recursive: true });
  const zipPath = path.join(TMP_LIVE, "live.zip");
  fs.copyFileSync(srcFile, zipPath);
  execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      "Expand-Archive -LiteralPath '" + zipPath + "' -DestinationPath '" + unzipped + "' -Force"
    ],
    { stdio: "inherit" }
  );
  return unzipped;
}

function loadSharedStrings(sstPath) {
  const text = fs.readFileSync(sstPath).toString("utf16le").replace(/^\uFEFF/, "");
  const out = [];
  const simple = /<si><t[^>]*>([^<]*)<\/t><\/si>/g;
  let m;
  while ((m = simple.exec(text))) out.push(m[1]);
  return out;
}

function colToIndex(col) {
  let n = 0;
  for (let i = 0; i < col.length; i++) n = n * 26 + (col.charCodeAt(i) - 64);
  return n - 1;
}

function parseRowCells(rowXml, sst) {
  const cells = [];
  // Self-closing and open cells must be separate alternatives — a greedy
  // [^>]* before (?:\/>|>…) can swallow "/><c …><v>n</v></c>" incorrectly.
  const re = /<c r="([A-Z]+)(\d+)"([^>]*?)\/>|<c r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/g;
  let m;
  while ((m = re.exec(rowXml))) {
    const col = m[1] || m[4];
    const attrs = m[3] || m[6] || "";
    const inner = m[7] || "";
    let val = "";
    const vm = inner.match(/<v>([^<]*)<\/v>/);
    const tm = inner.match(/<t[^>]*>([^<]*)<\/t>/);
    if (/t="s"/.test(attrs) && vm) val = sst[Number(vm[1])] || "";
    else if (tm) val = tm[1];
    else if (vm) val = vm[1];
    cells[colToIndex(col)] = val;
  }
  return cells;
}

function readLiveReportStreaming(srcFile) {
  console.log("  streaming HF Live XML…");
  const unzipped = ensureLiveUnzipped(srcFile);
  const sst = loadSharedStrings(path.join(unzipped, "xl", "sharedStrings.xml"));
  const sheetPath = path.join(unzipped, "xl", "worksheets", "sheet1.xml");

  const rows = [];
  const stream = fs.createReadStream(sheetPath, { encoding: "utf16le", highWaterMark: 1 << 20 });

  return new Promise((resolve, reject) => {
    let textBuf = "";
    let inRow = false;
    let bomStripped = false;
    let section = "header";
    let dealsHeader = null;
    let dealsStartRow = -1;
    const deals = [];
    let rowIndex = 0;

    stream.on("data", (chunk) => {
      textBuf += chunk;
      if (!bomStripped) {
        if (textBuf.charCodeAt(0) === 0xfeff) textBuf = textBuf.slice(1);
        bomStripped = true;
      }
      while (true) {
        if (!inRow) {
          const i = textBuf.indexOf("<row");
          if (i < 0) {
            if (textBuf.length > 200) textBuf = textBuf.slice(-80);
            break;
          }
          textBuf = textBuf.slice(i);
          inRow = true;
        }
        const end = textBuf.indexOf("</row>");
        if (end < 0) break;
        const rowXml = textBuf.slice(0, end + 6);
        textBuf = textBuf.slice(end + 6);
        inRow = false;
        rowIndex++;
        const cells = parseRowCells(rowXml, sst);
        const a = String(cells[0] || "").trim();

        if (rowIndex <= 80) rows.push(cells);

        if (a === "Deals") {
          section = "deals-header";
          continue;
        }
        if (section === "deals-header") {
          dealsHeader = cells.map((x) => String(x == null ? "" : x).trim());
          section = "deals";
          dealsStartRow = rowIndex;
          continue;
        }
        if (section === "deals") {
          const time = String(cells[0] || "");
          if (!/^\d{4}\.\d{2}\.\d{2}/.test(time)) {
            if (!time.trim()) continue;
            section = "after-deals";
            continue;
          }
          // Map by header names
          const col = {};
          dealsHeader.forEach((h, i) => {
            if (h) col[h] = i;
          });
          const date = parseDealDate(time);
          deals.push({
            time,
            date,
            dateTime: parseDealDateTime(time),
            deal: col.Deal != null ? String(cells[col.Deal] || "") : "",
            type: String(cells[col.Type] || "").toLowerCase(),
            direction: String((col.Direction != null ? cells[col.Direction] : "") || "").toLowerCase(),
            volume: col.Volume != null ? parseNum(cells[col.Volume]) : null,
            price: col.Price != null ? parseNum(cells[col.Price]) : null,
            profit: parseNum(cells[col.Profit]),
            balance: parseNum(cells[col.Balance]),
            commission: col.Commission != null ? parseNum(cells[col.Commission]) : 0,
            fee: col.Fee != null ? parseNum(cells[col.Fee]) : 0,
            swap: col.Swap != null ? parseNum(cells[col.Swap]) : 0,
            symbol: col.Symbol != null ? String(cells[col.Symbol] || "") : "",
            comment: col.Comment != null ? String(cells[col.Comment] || "") : ""
          });
        }
      }
    });

    stream.on("error", reject);
    stream.on("end", () => {
      console.log("  live rows", rowIndex, "deals", deals.length, "headerRows", rows.length);
      if (!deals.length) {
        reject(new Error("HF Live: no deals parsed"));
        return;
      }
      const meta = extractHeaderMeta(rows);
      resolve({ meta, deals, excelResults: null });
    });
  });
}

function readTesterReport(srcFile) {
  console.log("  reading with SheetJS…");
  const buf = fs.readFileSync(srcFile);
  const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  const meta = extractHeaderMeta(rows);
  const excelResults = extractTesterResults(rows);
  const deals = readDealsFromRows(rows);
  console.log("  rows", rows.length, "deals", deals.length);
  return { meta, deals, excelResults };
}

function unavailableStub(product, reportType, reason) {
  return {
    available: false,
    unavailableReason: reason,
    product,
    reportType,
    currency: null,
    period: null,
    meta: null,
    summary: null,
    charts: null,
    monthly: [],
    cardMetrics: null,
    trades: { available: false, rows: [] },
    chartPointCounts: null
  };
}

/** Write data/{key}.json and js/performance-data/{key}.js (file:// + HTTP). */
function writePerfDataset(key, data, pretty) {
  const jsonBody = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  const outPath = path.join(OUT_DATA, key + ".json");
  fs.writeFileSync(outPath, jsonBody);
  const jsPath = path.join(OUT_JS, key + ".js");
  fs.writeFileSync(
    jsPath,
    "/* Generated by scripts/generate-performance-data.js — do not edit by hand */\n" +
      "(function(){\n" +
      '"use strict";\n' +
      "window.AIVOR_PERF_DATA = window.AIVOR_PERF_DATA || {};\n" +
      "window.AIVOR_PERF_DATA[" +
      JSON.stringify(key) +
      "] = " +
      JSON.stringify(data) +
      ";\n" +
      "})();\n"
  );
  return outPath;
}

async function processOne(key, cfg) {
  const src = path.join(STORE_REPORTS, cfg.file);
  if (!fs.existsSync(src)) {
    console.warn("MISSING", src);
    return unavailableStub(cfg.product, cfg.reportType, "Report not available yet");
  }
  // copy original for regeneration reference (do not serve as runtime)
  fs.mkdirSync(SOURCE_COPIES, { recursive: true });
  const copyDest = path.join(SOURCE_COPIES, cfg.file);
  if (!fs.existsSync(copyDest) || fs.statSync(copyDest).size !== fs.statSync(src).size) {
    console.log("  copying source → data/source-reports/");
    fs.copyFileSync(src, copyDest);
  }

  let parsed;
  if (cfg.mode === "live-stream") {
    parsed = await readLiveReportStreaming(src);
  } else {
    parsed = readTesterReport(src);
  }

  // For tester currency "profit in pips" — keep note; do not invent ISO currency.
  // Live has USC from Account.
  const built = buildFromDeals(parsed.deals, parsed.meta, parsed.excelResults);
  built.product = cfg.product;
  built.reportType = cfg.reportType;
  built.sourceFile = cfg.file;
  built.generatedAt = new Date().toISOString();
  built.schemaVersion = 1;
  return built;
}

async function main() {
  fs.mkdirSync(OUT_DATA, { recursive: true });
  fs.mkdirSync(OUT_JS, { recursive: true });

  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    availability: {
      hf: { backtest: true, live: true },
      scalper: { backtest: true, live: false },
      swing: { backtest: true, live: false }
    },
    files: {}
  };

  const oldCards = {
    hf: { avgMonthlyNetProfit: 4562, avgMonthlyReturnPct: 41, avgMonthlyMaxEquityDd: 2156, avgMonthlyMaxEquityDdPct: 21 },
    scalper: { avgMonthlyNetProfit: 40, avgMonthlyReturnPct: 40, avgMonthlyMaxEquityDd: 12, avgMonthlyMaxEquityDdPct: 12 },
    swing: { avgMonthlyNetProfit: 500, avgMonthlyReturnPct: 50, avgMonthlyMaxEquityDd: 300, avgMonthlyMaxEquityDdPct: 30 }
  };

  const discrepancies = [];

  for (const [key, cfg] of Object.entries(FILES)) {
    console.log("\n===", key, "===");
    const data = await processOne(key, cfg);
    const outPath = writePerfDataset(key, data, false);
    const size = fs.statSync(outPath).size;
    console.log("  wrote", outPath, "+ js (" + Math.round(size / 1024) + " KB)");
    console.log(
      "  summary net",
      data.summary && data.summary.netProfit,
      "months",
      data.monthly && data.monthly.length,
      "equityPts",
      data.chartPointCounts && data.chartPointCounts.equityBalance
    );
    manifest.files[key] = {
      path: "data/" + key + ".json",
      jsPath: "js/performance-data/" + key + ".js",
      product: cfg.product,
      reportType: cfg.reportType,
      available: data.available,
      bytes: size,
      chartPointCounts: data.chartPointCounts,
      cardMetrics: data.cardMetrics
        ? {
            avgMonthlyNetProfit: data.cardMetrics.avgMonthlyNetProfit,
            avgMonthlyReturnPct: data.cardMetrics.avgMonthlyReturnPct,
            avgMonthlyMaxEquityDd: data.cardMetrics.avgMonthlyMaxEquityDd,
            avgMonthlyMaxEquityDdPct: data.cardMetrics.avgMonthlyMaxEquityDdPct,
            periodLabel: data.cardMetrics.periodLabel,
            monthCount: data.cardMetrics.monthCount
          }
        : null
    };

    if (data.available && data.cardMetrics && oldCards[cfg.product] && cfg.reportType === (cfg.product === "hf" ? "live" : "backtest")) {
      const o = oldCards[cfg.product];
      const n = data.cardMetrics;
      discrepancies.push({
        product: cfg.product,
        reportType: cfg.reportType,
        old: o,
        excelBacked: {
          avgMonthlyNetProfit: n.avgMonthlyNetProfit,
          avgMonthlyReturnPct: n.avgMonthlyReturnPct,
          avgMonthlyMaxEquityDd: n.avgMonthlyMaxEquityDd,
          avgMonthlyMaxEquityDdPct: n.avgMonthlyMaxEquityDdPct,
          periodLabel: n.periodLabel
        }
      });
    }
  }

  // stubs for unavailable live
  for (const product of ["scalper", "swing"]) {
    const key = product + "-live";
    const stub = unavailableStub(product, "live", "Live performance data not available yet");
    stub.generatedAt = new Date().toISOString();
    stub.schemaVersion = 1;
    writePerfDataset(key, stub, true);
    manifest.files[key] = {
      path: "data/" + key + ".json",
      jsPath: "js/performance-data/" + key + ".js",
      product,
      reportType: "live",
      available: false,
      reason: stub.unavailableReason
    };
  }

  manifest.discrepanciesVsOldCards = discrepancies;
  fs.writeFileSync(path.join(OUT_DATA, "manifest.json"), JSON.stringify(manifest, null, 2));

  const manifestJs =
    "/* Generated by scripts/generate-performance-data.js — do not edit by hand */\n" +
    "(function(){\n" +
    '"use strict";\n' +
    "window.AIVOR_PERF_MANIFEST = " +
    JSON.stringify(manifest) +
    ";\n" +
    "})();\n";
  fs.writeFileSync(path.join(OUT_JS, "manifest.js"), manifestJs);

  // Also emit a compact card-metrics JS for products.html (sync with JSON)
  const cardBag = {
    hf: manifest.files["hf-live"].cardMetrics,
    scalper: manifest.files["scalper-backtest"].cardMetrics,
    swing: manifest.files["swing-backtest"].cardMetrics,
    currency: {
      hf: null,
      scalper: null,
      swing: null
    },
    sources: {
      hf: "hf-live",
      scalper: "scalper-backtest",
      swing: "swing-backtest"
    },
    availability: manifest.availability
  };
  // fill currency from written files
  for (const p of ["hf", "scalper", "swing"]) {
    const key = cardBag.sources[p];
    const j = JSON.parse(fs.readFileSync(path.join(OUT_DATA, key + ".json"), "utf8"));
    cardBag.currency[p] = j.currency || null;
  }

  fs.writeFileSync(
    path.join(OUT_JS, "card-metrics.js"),
    "/* Generated — Excel-backed product card metrics */\n(function(){\n\"use strict\";\nwindow.AIVOR_CARD_METRICS = " +
      JSON.stringify(cardBag) +
      ";\n})();\n"
  );

  console.log("\nDone. Manifest → data/manifest.json");
  console.log("Discrepancies:", JSON.stringify(discrepancies, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
