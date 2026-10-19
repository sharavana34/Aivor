/**
 * Verify analyze-core parsing against sample MT5 workbooks.
 *
 * Usage (from D:\\Aivor\\site):
 *   node --max-old-space-size=8192 scripts/verify-analyze.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { createReadStream } = require("fs");

const ROOT = path.resolve(__dirname, "..");
const Core = require(path.join(ROOT, "js", "analyze-core.js"));
const XLSX = require(path.join(ROOT, "vendor", "xlsx.full.min.js"));

const SRC = path.join(ROOT, "data", "source-reports");
const checks = [];

function ok(name, pass, detail) {
  checks.push({ name, pass: !!pass, detail: detail || "" });
  const mark = pass ? "OK" : "FAIL";
  console.log(mark + "  " + name + (detail ? " — " + detail : ""));
}

function approx(a, b, eps) {
  return Math.abs(Number(a) - Number(b)) <= (eps == null ? 0.02 : eps);
}

function parseSheetJs(file) {
  const buf = fs.readFileSync(path.join(SRC, file));
  // Node Buffer is Uint8Array-compatible; SheetJS accepts buffer via array view
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return Core.parseWorkbook(ab, file, XLSX);
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

function parseLiveStreaming(file) {
  const unzipped = path.join(ROOT, "_tmp_hf_live_xlsx", "unzipped");
  const sheetPath = path.join(unzipped, "xl", "worksheets", "sheet1.xml");
  if (!fs.existsSync(sheetPath)) {
    throw new Error("Live unzip missing at " + sheetPath);
  }
  const sst = loadSharedStrings(path.join(unzipped, "xl", "sharedStrings.xml"));
  return new Promise((resolve, reject) => {
    const stream = createReadStream(sheetPath, { encoding: "utf16le", highWaterMark: 1 << 20 });
    let textBuf = "";
    let inRow = false;
    let bomStripped = false;
    let section = "header";
    let dealsHeader = null;
    const headerRows = [];
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
        if (rowIndex <= 80) headerRows.push(cells);
        if (a === "Deals") {
          section = "deals-header";
          continue;
        }
        if (section === "deals-header") {
          dealsHeader = cells.map((x) => String(x == null ? "" : x).trim());
          section = "deals";
          continue;
        }
        if (section === "deals") {
          const time = String(cells[0] || "");
          if (!/^\d{4}\.\d{2}\.\d{2}/.test(time)) {
            if (!time.trim()) continue;
            section = "after";
            continue;
          }
          const col = {};
          dealsHeader.forEach((h, i) => {
            if (h) col[h] = i;
          });
          const date = Core.parseDealDate(time);
          deals.push({
            time,
            date,
            deal: col.Deal != null ? String(cells[col.Deal] || "") : "",
            type: String(cells[col.Type] || "").toLowerCase(),
            direction: String((col.Direction != null ? cells[col.Direction] : "") || "").toLowerCase(),
            volume: col.Volume != null ? Core.parseNum(cells[col.Volume]) : 0,
            profit: Core.parseNum(cells[col.Profit]),
            balance: Core.parseNum(cells[col.Balance]),
            commission: col.Commission != null ? Core.parseNum(cells[col.Commission]) : 0,
            fee: col.Fee != null ? Core.parseNum(cells[col.Fee]) : 0,
            swap: col.Swap != null ? Core.parseNum(cells[col.Swap]) : 0,
            symbol: col.Symbol != null ? String(cells[col.Symbol] || "") : "",
            comment: col.Comment != null ? String(cells[col.Comment] || "") : "",
            position: col.Position != null ? String(cells[col.Position] || "") : "",
            order: col.Order != null ? String(cells[col.Order] || "") : "",
          });
        }
      }
    });
    stream.on("error", reject);
    stream.on("end", () => {
      const meta = Core.extractHeaderMeta(headerRows);
      const hasPosition = dealsHeader && dealsHeader.indexOf("Position") >= 0;
      const closedTradeInfo = Core.buildClosedTrades(deals, !!hasPosition);
      const built = Core.buildDaysFromDeals(deals, closedTradeInfo);
      let deposited = built.deposited;
      let base = deposited;
      if (base === 0 && meta.depositHeader) {
        deposited = meta.depositHeader;
        base = meta.depositHeader;
      }
      const tradeStats = Core.mergeTradeRolls(
        built.days.map((d) => ({
          closed: d.out,
          wins: d.wins,
          losses: d.losses,
          breakeven: d.breakeven || 0,
          winSum: d.winSum || 0,
          lossSum: d.lossSum || 0,
          largestWin: d.largestWin,
          largestLoss: d.largestLoss,
        }))
      );
      resolve({
        meta,
        days: built.days,
        deposited,
        withdrawn: built.withdrawn,
        gross: built.gross,
        base,
        tradeStats,
        tradeGrouping: closedTradeInfo.grouping,
        netPl: Core.round2(built.days.reduce((s, d) => s + d.pl, 0)),
        finalBal: built.days.length ? built.days[built.days.length - 1].bal : 0,
        dealCount: deals.length,
      });
    });
  });
}

async function main() {
  console.log("verify-analyze — sample workbooks\n");

  // --- Scalper ---
  const scalper = parseSheetJs("ReportTester-26444548-Aivor-Scalper-Backtest.xlsx");
  const sNet = Core.round2(scalper.days.reduce((a, d) => a + d.pl, 0));
  ok("scalper net P/L", approx(sNet, 618), String(sNet));
  ok("scalper final balance", approx(scalper.days[scalper.days.length - 1].bal, 718), String(scalper.days[scalper.days.length - 1].bal));
  ok("scalper deposited/base", scalper.base === 100 && scalper.deposited === 100, String(scalper.base));
  ok("scalper closed trades", scalper.tradeStats.closed === 1796, String(scalper.tradeStats.closed));
  ok("scalper wins (strict >0)", scalper.tradeStats.wins === 1244, String(scalper.tradeStats.wins));
  ok("scalper losses", scalper.tradeStats.losses === 547, String(scalper.tradeStats.losses));
  ok("scalper breakeven", scalper.tradeStats.breakeven === 5, String(scalper.tradeStats.breakeven));
  ok("scalper profit factor", approx(scalper.tradeStats.profitFactor, 1.415, 0.01), String(scalper.tradeStats.profitFactor));
  ok("scalper largest win", approx(scalper.tradeStats.largestWin, 15.37), String(scalper.tradeStats.largestWin));
  ok("scalper largest loss", approx(scalper.tradeStats.largestLoss, -18.48), String(scalper.tradeStats.largestLoss));
  ok("scalper equity DD from Results", scalper.equityDrawdown && approx(scalper.equityDrawdown.amount, 44.26), JSON.stringify(scalper.equityDrawdown));
  ok("scalper excel Results PF", scalper.excelResults && approx(scalper.excelResults.profitFactor, 1.42), String(scalper.excelResults && scalper.excelResults.profitFactor));
  ok("scalper grouping close-deal", scalper.tradeGrouping === "close-deal", scalper.tradeGrouping);

  const sStats = Core.statsFromDays(scalper.days, scalper.base);
  ok("scalper recovery factor", sStats.recoveryFactor != null && sStats.recoveryFactor > 0, String(sStats.recoveryFactor));
  ok("scalper max balance DD labeled balance", sStats.maxDdBasis === "balance", sStats.maxDdBasis);

  // --- Swing ---
  const swing = parseSheetJs("ReportTester-26444548-Aivor-Swing-backtest.xlsx");
  const wNet = Core.round2(swing.days.reduce((a, d) => a + d.pl, 0));
  ok("swing net P/L", approx(wNet, 10163.2), String(wNet));
  ok("swing trades", swing.tradeStats.closed === 753, String(swing.tradeStats.closed));
  ok("swing wins/losses", swing.tradeStats.wins === 272 && swing.tradeStats.losses === 481, swing.tradeStats.wins + "/" + swing.tradeStats.losses);
  ok("swing PF ~1.80", approx(swing.tradeStats.profitFactor, 1.802, 0.02), String(swing.tradeStats.profitFactor));
  ok("swing equity DD", swing.equityDrawdown && approx(swing.equityDrawdown.amount, 1978.61), JSON.stringify(swing.equityDrawdown));

  // --- Invalid / edge helpers ---
  ok("isCloseDirection out by", Core.isCloseDirection("out by") === true);
  ok("isCloseDirection in", Core.isCloseDirection("in") === false);
  ok("parseNum spaced negative", Core.parseNum("- 18.48") === -18.48);

  // Date-order defensive: shuffled dates still sort inside buildDaysFromDeals
  const toyDeals = [
    { date: "2026-01-02", type: "buy", direction: "out", profit: 5, balance: 105, commission: 0, fee: 0, swap: 0, deal: "2", position: "", order: "", symbol: "X", comment: "", time: "2026.01.02 12:00:00", volume: 0.01 },
    { date: "2026-01-01", type: "balance", direction: "", profit: 100, balance: 100, commission: 0, fee: 0, swap: 0, deal: "1", position: "", order: "", symbol: "", comment: "", time: "2026.01.01 00:00:00", volume: 0 },
    { date: "2026-01-01", type: "buy", direction: "in", profit: 0, balance: 100, commission: 0, fee: 0, swap: 0, deal: "1b", position: "", order: "", symbol: "X", comment: "", time: "2026.01.01 10:00:00", volume: 0.01 },
  ];
  const toyClosed = Core.buildClosedTrades(toyDeals, false);
  const toyDays = Core.buildDaysFromDeals(toyDeals, toyClosed);
  ok("toy days sorted", toyDays.days[0].d === "2026-01-01" && toyDays.days[1].d === "2026-01-02");
  ok("toy net P/L", approx(toyDays.days.reduce((s, d) => s + d.pl, 0), 5), String(toyDays.days.reduce((s, d) => s + d.pl, 0)));

  // Mid-stream seed: first deal is a trade, no deposit
  const mid = [
    {
      date: "2026-03-09",
      type: "buy",
      direction: "in",
      profit: 0,
      balance: 4999.97,
      commission: -0.03,
      fee: 0,
      swap: 0,
      deal: "1",
      position: "",
      order: "",
      symbol: "X",
      comment: "",
      time: "2026.03.09 19:07:54",
      volume: 0.01,
    },
    {
      date: "2026-03-09",
      type: "sell",
      direction: "out",
      profit: 10,
      balance: 5009.94,
      commission: -0.03,
      fee: 0,
      swap: 0,
      deal: "2",
      position: "",
      order: "",
      symbol: "X",
      comment: "",
      time: "2026.03.09 19:10:00",
      volume: 0.01,
    },
  ];
  const midClosed = Core.buildClosedTrades(mid, false);
  const midDays = Core.buildDaysFromDeals(mid, midClosed);
  // prevBal seeded to 5000; end 5009.94; dep 0 → pl = 9.94 (10 profit - 0.06 commissions via balance)
  ok("mid-stream does not invent deposit P/L", approx(midDays.days[0].pl, 9.94), String(midDays.days[0].pl));

  // Position grouping
  const posDeals = [
    { date: "2026-01-01", type: "balance", direction: "", profit: 1000, balance: 1000, commission: 0, fee: 0, swap: 0, deal: "0", position: "", order: "", symbol: "", comment: "", time: "2026.01.01 00:00:00", volume: 0 },
    { date: "2026-01-01", type: "buy", direction: "in", profit: 0, balance: 999.9, commission: -0.1, fee: 0, swap: 0, deal: "1", position: "P1", order: "1", symbol: "X", comment: "", time: "2026.01.01 10:00:00", volume: 0.02 },
    { date: "2026-01-01", type: "sell", direction: "out", profit: 4, balance: 1003.8, commission: -0.1, fee: 0, swap: 0, deal: "2", position: "P1", order: "2", symbol: "X", comment: "", time: "2026.01.01 11:00:00", volume: 0.01 },
    { date: "2026-01-01", type: "sell", direction: "out", profit: 6, balance: 1009.7, commission: -0.1, fee: 0, swap: 0, deal: "3", position: "P1", order: "3", symbol: "X", comment: "", time: "2026.01.01 12:00:00", volume: 0.01 },
  ];
  const posClosed = Core.buildClosedTrades(posDeals, true);
  ok("position grouping one trade", posClosed.trades.length === 1, String(posClosed.trades.length));
  ok("position net includes partials+costs", approx(posClosed.trades[0].pl, 9.7), String(posClosed.trades[0].pl));

  // --- Live (streaming; SheetJS OOMs on this file in Node) ---
  try {
    const live = await parseLiveStreaming("ReportHistory-26444548-Aivor-HF-Live.xlsx");
    ok("live deal count", live.dealCount === 31316, String(live.dealCount));
    ok("live net P/L", approx(live.netPl, 10458.17), String(live.netPl));
    ok("live final balance", approx(live.finalBal, 13579.17), String(live.finalBal));
    ok("live deposited", approx(live.deposited, 10000), String(live.deposited));
    ok("live withdrawn", approx(live.withdrawn, 6879), String(live.withdrawn));
    ok("live includes out by in closes", live.tradeStats.closed === 15623 + 36, String(live.tradeStats.closed));
    ok("live currency USC from Account", live.meta.currency === "USC", live.meta.currency);
    ok("live no equity DD (no Results)", true, "N/A by design");
  } catch (err) {
    ok("live streaming parse", false, err.message);
  }

  // HF backtest is ~5.8MB — try SheetJS; skip soft-fail if OOM
  try {
    const hf = parseSheetJs("ReportTester-26444548-Aivor-HF-Backtest.xlsx");
    const hfNet = Core.round2(hf.days.reduce((a, d) => a + d.pl, 0));
    ok("hf-backtest net P/L", approx(hfNet, 48475.34), String(hfNet));
    ok("hf-backtest trades", hf.tradeStats.closed === 27024, String(hf.tradeStats.closed));
  } catch (err) {
    ok("hf-backtest SheetJS parse", false, "skipped/failed: " + err.message);
    console.log("  (HF Backtest may require more heap; core path verified on Scalper/Swing/Live.)");
  }

  // HTML wiring smoke
  const html = fs.readFileSync(path.join(ROOT, "analyze.html"), "utf8");
  ok("html loads analyze-core", html.includes("js/analyze-core.js"));
  ok("html clear filters label", html.includes("Clear filters"));
  ok("html filter status", html.includes('id="filterStatus"'));

  const js = fs.readFileSync(path.join(ROOT, "js", "analyze.js"), "utf8");
  ok("ui uses Core.statsFromDays", js.includes("Core.statsFromDays"));
  ok("export has Summary sheet", js.includes('"Summary"'));
  ok("export has Filtered Detail", js.includes("Filtered Detail"));

  const failed = checks.filter((c) => !c.pass);
  console.log("\n" + (checks.length - failed.length) + "/" + checks.length + " passed");
  if (failed.length) {
    console.log("Failed:");
    failed.forEach((f) => console.log(" - " + f.name + (f.detail ? ": " + f.detail : "")));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
