/**
 * Aivor analyze — pure workbook parse + metrics (browser + Node).
 * No DOM. UI lives in analyze.js.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.AivorAnalyzeCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

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
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function parseDealDate(t) {
    const m = String(t).match(/^(\d{4})\.(\d{2})\.(\d{2})/);
    return m ? m[1] + "-" + m[2] + "-" + m[3] : null;
  }

  function isCloseDirection(dir) {
    const d = String(dir || "").toLowerCase();
    return d === "out" || d === "out by";
  }

  function cellVal(row, preferCols) {
    for (let i = 0; i < preferCols.length; i++) {
      const c = preferCols[i];
      if (row[c] != null && String(row[c]).trim() !== "") return row[c];
    }
    return "";
  }

  function extractHeaderMeta(rows) {
    const meta = {
      kind: "unknown",
      name: "",
      account: "",
      company: "",
      currency: "",
      currencyNote: "",
      depositHeader: null,
      expert: "",
      symbol: "",
      period: "",
      server: "",
      reportDate: "",
    };
    const title = String((rows[0] && rows[0][0]) || "");
    if (/Trade History/i.test(title)) meta.kind = "live";
    else if (/Strategy Tester/i.test(title)) meta.kind = "tester";

    if (rows[1] && rows[1][0] && !/^(Settings|Name:)/i.test(String(rows[1][0]))) {
      meta.server = String(rows[1][0]).trim();
    }

    for (let i = 0; i < Math.min(160, rows.length); i++) {
      const a = String(rows[i][0] || "").trim();
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
      if (a.startsWith("Period:")) meta.period = String(v || "").trim();
      if (a.startsWith("Date:")) meta.reportDate = String(v || "").trim();
    }

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

      function grab(label) {
        if (a.startsWith(label)) {
          for (let c = 1; c <= 4; c++) {
            const v = rows[i][c];
            if (v != null && String(v).trim() !== "") return String(v).trim();
          }
        }
        return null;
      }

      const net = grab("Total Net Profit:");
      if (net != null) out.totalNetProfit = parseNum(net);
      const gp = grab("Gross Profit:");
      if (gp != null) out.grossProfit = parseNum(gp);
      const gl = grab("Gross Loss:");
      if (gl != null) out.grossLoss = parseNum(gl);
      const pf = grab("Profit Factor:");
      if (pf != null) out.profitFactor = parseNum(pf);
      const rf = grab("Recovery Factor:");
      if (rf != null) out.recoveryFactor = parseNum(rf);
      const tt = grab("Total Trades:");
      if (tt != null) out.totalTrades = parseNum(tt);
      const td = grab("Total Deals:");
      if (td != null) out.totalDeals = parseNum(td);

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
      if (rows[i][4] && String(rows[i][4]).startsWith("Largest profit trade:")) {
        out.largestProfitTrade = parseNum(rows[i][7]);
        out.largestLossTrade = parseNum(rows[i][11]);
      }
    }
    return Object.keys(out).length ? out : null;
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

  function readDeals(rows, dealsSec) {
    const col = {};
    dealsSec.header.forEach((h, i) => {
      if (h) col[h] = i;
    });
    const need = ["Time", "Type", "Profit", "Balance"];
    for (let i = 0; i < need.length; i++) {
      if (col[need[i]] == null) throw new Error('Deals table is missing the "' + need[i] + '" column.');
    }
    const hasPosition = col.Position != null;
    const deals = [];
    for (let i = dealsSec.start + 2; i < rows.length; i++) {
      const r = rows[i];
      const time = String(r[col.Time] || "");
      if (!/^\d{4}\.\d{2}\.\d{2}/.test(time)) {
        if (!time.trim()) continue;
        break;
      }
      const date = parseDealDate(time);
      if (!date) continue;
      deals.push({
        time,
        date,
        deal: col.Deal != null ? String(r[col.Deal] || "") : "",
        type: String(r[col.Type] || "").toLowerCase(),
        direction: String((col.Direction != null ? r[col.Direction] : "") || "").toLowerCase(),
        volume: col.Volume != null ? parseNum(r[col.Volume]) : 0,
        profit: parseNum(r[col.Profit]),
        balance: parseNum(r[col.Balance]),
        commission: col.Commission != null ? parseNum(r[col.Commission]) : 0,
        fee: col.Fee != null ? parseNum(r[col.Fee]) : 0,
        swap: col.Swap != null ? parseNum(r[col.Swap]) : 0,
        symbol: col.Symbol != null ? String(r[col.Symbol] || "") : "",
        comment: col.Comment != null ? String(r[col.Comment] || "") : "",
        position: hasPosition ? String(r[col.Position] || "") : "",
        order: col.Order != null ? String(r[col.Order] || "") : "",
      });
    }
    return { deals, hasPosition, columns: Object.keys(col) };
  }

  /**
   * Build closed trades.
   * - With Position column: one trade per position that has ≥1 close deal; net = Σ(profit+comm+fee+swap).
   * - Without: one trade per close deal (out / out by); P/L = Profit column on that deal.
   */
  function buildClosedTrades(deals, hasPosition) {
    if (hasPosition) {
      const map = new Map();
      deals.forEach((d) => {
        if (d.type === "balance" || !d.position) return;
        if (!map.has(d.position)) {
          map.set(d.position, {
            id: d.position,
            symbol: d.symbol,
            profit: 0,
            costs: 0,
            closeDate: null,
            closeTime: null,
            closes: 0,
            opens: 0,
          });
        }
        const t = map.get(d.position);
        t.profit += d.profit;
        t.costs += d.commission + d.fee + d.swap;
        if (d.symbol) t.symbol = d.symbol;
        if (d.direction === "in") t.opens += 1;
        if (isCloseDirection(d.direction)) {
          t.closes += 1;
          t.closeDate = d.date;
          t.closeTime = d.time;
        }
      });
      const trades = [];
      map.forEach((t) => {
        if (t.closes === 0) return;
        const pl = round2(t.profit + t.costs);
        trades.push({
          id: t.id,
          date: t.closeDate,
          time: t.closeTime,
          symbol: t.symbol,
          pl,
          partialCloses: t.closes > 1,
          basis: "position-net",
        });
      });
      trades.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
      return {
        trades,
        grouping: "position",
        note: "Closed trades grouped by Position ID. Trade P/L = sum of Profit + Commission + Fee + Swap for all deals of that position.",
      };
    }

    const trades = [];
    deals.forEach((d) => {
      if (d.type === "balance") return;
      if (!isCloseDirection(d.direction)) return;
      trades.push({
        id: d.deal || d.order || d.time,
        date: d.date,
        time: d.time,
        symbol: d.symbol,
        pl: round2(d.profit),
        closeCosts: round2(d.commission + d.fee + d.swap),
        direction: d.direction,
        partialCloses: false,
        basis: "close-deal-profit",
      });
    });
    return {
      trades,
      grouping: "close-deal",
      note: "No Position column in Deals — each close deal (Direction out or out by) counts as one trade. Trade P/L uses the close deal Profit column. Entry commissions on in deals are reflected in daily balance P/L, not attributed per trade.",
    };
  }

  function emptyTradeRoll() {
    return {
      closed: 0,
      wins: 0,
      losses: 0,
      breakeven: 0,
      winSum: 0,
      lossSum: 0,
      largestWin: null,
      largestLoss: null,
    };
  }

  function addTradeToRoll(roll, pl) {
    roll.closed += 1;
    if (pl > 0) {
      roll.wins += 1;
      roll.winSum = round2(roll.winSum + pl);
      if (roll.largestWin == null || pl > roll.largestWin) roll.largestWin = pl;
    } else if (pl < 0) {
      roll.losses += 1;
      roll.lossSum = round2(roll.lossSum + pl);
      if (roll.largestLoss == null || pl < roll.largestLoss) roll.largestLoss = pl;
    } else {
      roll.breakeven += 1;
    }
  }

  function finalizeTradeRoll(roll) {
    const winRatePct = roll.closed > 0 ? round4((roll.wins / roll.closed) * 100) : null;
    const avgWin = roll.wins > 0 ? round2(roll.winSum / roll.wins) : null;
    const avgLoss = roll.losses > 0 ? round2(roll.lossSum / roll.losses) : null;
    return Object.assign({}, roll, {
      winRatePct,
      profitFactor: roll.lossSum < 0 ? round4(roll.winSum / Math.abs(roll.lossSum)) : null,
      avgWin,
      avgLoss,
    });
  }

  function mergeTradeRolls(rolls) {
    const acc = emptyTradeRoll();
    rolls.forEach((r) => {
      acc.closed += r.closed;
      acc.wins += r.wins;
      acc.losses += r.losses;
      acc.breakeven += r.breakeven;
      acc.winSum = round2(acc.winSum + r.winSum);
      acc.lossSum = round2(acc.lossSum + r.lossSum);
      if (r.largestWin != null && (acc.largestWin == null || r.largestWin > acc.largestWin)) {
        acc.largestWin = r.largestWin;
      }
      if (r.largestLoss != null && (acc.largestLoss == null || r.largestLoss < acc.largestLoss)) {
        acc.largestLoss = r.largestLoss;
      }
    });
    return finalizeTradeRoll(acc);
  }

  function buildDaysFromDeals(deals, closedTradeInfo) {
    const byDate = new Map();
    deals.forEach((d) => {
      if (!byDate.has(d.date)) byDate.set(d.date, []);
      byDate.get(d.date).push(d);
    });

    const tradesByDate = new Map();
    closedTradeInfo.trades.forEach((t) => {
      if (!tradesByDate.has(t.date)) tradesByDate.set(t.date, []);
      tradesByDate.get(t.date).push(t);
    });

    const dates = [...byDate.keys()].sort();
    let deposited = 0;
    let withdrawn = 0;
    let grossAll = 0;
    const days = [];

    // Seed previous balance so mid-stream histories without a leading deposit
    // do not treat opening equity as trading profit.
    let prevBal = 0;
    let depositedProbe = 0;
    for (let i = 0; i < deals.length; i++) {
      if (deals[i].type === "balance" && deals[i].profit > 0) {
        depositedProbe += deals[i].profit;
      }
    }
    if (depositedProbe === 0 && deals.length) {
      const first = deals[0];
      if (first.type === "balance") prevBal = 0;
      else {
        prevBal = round2(first.balance - first.profit - first.commission - first.fee - first.swap);
      }
    }

    for (let di = 0; di < dates.length; di++) {
      const date = dates[di];
      const list = byDate.get(date);
      let dep = 0;
      let wd = 0;
      let dayGross = 0;
      let dayComm = 0;

      list.forEach((d) => {
        if (d.type === "balance") {
          if (d.profit > 0) {
            dep += d.profit;
            deposited += d.profit;
          } else if (d.profit < 0) {
            wd += d.profit;
            withdrawn += Math.abs(d.profit);
          }
        } else {
          dayGross += d.profit;
          dayComm += d.commission + d.fee + d.swap;
        }
      });

      const tradeRoll = emptyTradeRoll();
      (tradesByDate.get(date) || []).forEach((t) => addTradeToRoll(tradeRoll, t.pl));

      const endBal = list[list.length - 1].balance;
      const pl = round2(endBal - prevBal - dep - wd);
      days.push({
        d: date,
        pl,
        bal: endBal,
        gross: round2(dayGross),
        comm: round2(dayComm),
        wins: tradeRoll.wins,
        losses: tradeRoll.losses,
        breakeven: tradeRoll.breakeven,
        out: tradeRoll.closed,
        winSum: tradeRoll.winSum,
        lossSum: tradeRoll.lossSum,
        largestWin: tradeRoll.largestWin,
        largestLoss: tradeRoll.largestLoss,
        dep: round2(dep),
        wd: round2(wd),
      });
      grossAll += dayGross;
      prevBal = endBal;
    }

    return {
      days,
      deposited: round2(deposited),
      withdrawn: round2(withdrawn),
      gross: round2(grossAll),
    };
  }

  function balanceDrawdown(days) {
    let peak = days.length ? days[0].bal - days[0].pl : 0;
    let maxDd = 0;
    let maxDdPct = 0;
    days.forEach((d) => {
      if (d.bal > peak) peak = d.bal;
      const dd = peak - d.bal;
      if (dd > maxDd) {
        maxDd = dd;
        maxDdPct = peak > 0 ? (dd / peak) * 100 : 0;
      }
    });
    return { maxDd: round2(maxDd), maxDdPct: round4(maxDdPct), basis: "balance" };
  }

  function statsFromDays(days, base) {
    const pl = round2(days.reduce((s, d) => s + d.pl, 0));
    const winDays = days.filter((d) => d.pl > 0);
    const lossDays = days.filter((d) => d.pl < 0);
    const dayGain = winDays.reduce((s, d) => s + d.pl, 0);
    const dayLoss = lossDays.reduce((s, d) => s + d.pl, 0);
    const dayPf = dayLoss < 0 ? round4(dayGain / Math.abs(dayLoss)) : null;
    const dd = balanceDrawdown(days);
    const best = days.reduce((a, d) => (d.pl > a.pl ? d : a), days[0] || { pl: 0, d: "" });
    const worst = days.reduce((a, d) => (d.pl < a.pl ? d : a), days[0] || { pl: 0, d: "" });
    const trades = mergeTradeRolls(
      days.map((d) => ({
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
    return {
      pl,
      ret: base > 0 ? (pl / base) * 100 : 0,
      days: days.length,
      winDays: winDays.length,
      lossDays: lossDays.length,
      dayProfitFactor: dayPf,
      maxDd: dd.maxDd,
      maxDdPct: dd.maxDdPct,
      maxDdBasis: "balance",
      recoveryFactor: dd.maxDd > 0 ? round4(pl / dd.maxDd) : null,
      best,
      worst,
      bal: days.length ? days[days.length - 1].bal : 0,
      startBal: days.length ? round2(days[0].bal - days[0].pl) : 0,
      trades,
    };
  }

  function parseWorkbook(arrayBuffer, fileName, xlsxLib) {
    const XLSXref = xlsxLib || (typeof XLSX !== "undefined" ? XLSX : null);
    if (!XLSXref) throw new Error("SheetJS failed to load.");
    const wb = XLSXref.read(arrayBuffer, { type: "array", cellDates: false });
    if (!wb.SheetNames || !wb.SheetNames.length) {
      throw new Error("This workbook has no sheets.");
    }
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) throw new Error("Could not read the first worksheet.");
    const rows = XLSXref.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    if (!rows.length) throw new Error("This workbook is empty.");

    const meta = extractHeaderMeta(rows);
    const excelResults = meta.kind === "tester" ? extractTesterResults(rows) : null;
    const dealsSec = findDealsSection(rows);
    if (!dealsSec) {
      throw new Error(
        "Could not find a Deals table in this file. Export Trade History or Strategy Tester with the Deals section included."
      );
    }

    const { deals, hasPosition, columns } = readDeals(rows, dealsSec);
    if (!deals.length) throw new Error("The Deals table has no deal rows.");

    const closedTradeInfo = buildClosedTrades(deals, hasPosition);
    const built = buildDaysFromDeals(deals, closedTradeInfo);

    let deposited = built.deposited;
    let base = deposited;
    if (base === 0 && meta.depositHeader) {
      deposited = meta.depositHeader;
      base = meta.depositHeader;
    }
    if (base <= 0) {
      throw new Error("Could not determine the capital base (deposits / initial deposit).");
    }

    if (!meta.currency && /USC/i.test(fileName || "")) meta.currency = "USC";
    if (!meta.account) {
      const m = String(fileName || "").match(/(\d{5,})/);
      if (m) meta.account = m[1];
    }

    const fullTradeStats = mergeTradeRolls(
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

    return {
      account: meta.account || "—",
      name: meta.name || (meta.kind === "tester" ? meta.expert || "Strategy Tester" : "Account"),
      company: meta.company || meta.server || "—",
      currency: meta.currency || "",
      currencyNote: meta.currencyNote || "",
      kind: meta.kind,
      symbol: meta.symbol,
      period: meta.period,
      base,
      deposited,
      withdrawn: built.withdrawn,
      gross: built.gross,
      days: built.days,
      fileName: fileName || "report.xlsx",
      hasPosition,
      dealColumns: columns,
      tradeGrouping: closedTradeInfo.grouping,
      tradeGroupingNote: closedTradeInfo.note,
      tradeStats: fullTradeStats,
      excelResults,
      equityDrawdown:
        excelResults && excelResults.equityDrawdownMaximalAmount != null
          ? {
              amount: excelResults.equityDrawdownMaximalAmount,
              pct: excelResults.equityDrawdownMaximalPct,
              source: "strategy-tester-results",
            }
          : null,
      calculationBasis: {
        dailyPl:
          "Daily net P/L = end-of-day Balance − previous end-of-day Balance − deposits − withdrawals (withdrawals signed negative in the source Profit column). Includes commission, fee, and swap via balance.",
        capitalBase:
          "Return % uses total balance deposits found in Deals (or Initial Deposit when no deposit deals).",
        trades: closedTradeInfo.note,
        maxDrawdown:
          "Max drawdown on the dashboard is peak-to-trough on end-of-day Balance in the active filter window (balance-based, not floating equity).",
        equityDrawdown:
          "Floating equity drawdown is shown only when Strategy Tester Results include Equity Drawdown Maximal; otherwise not available from Deals alone.",
        recoveryFactor: "Recovery factor = window net P/L ÷ max balance drawdown (same window).",
      },
    };
  }

  return {
    parseNum,
    parseDealDate,
    isCloseDirection,
    extractHeaderMeta,
    extractTesterResults,
    findDealsSection,
    readDeals,
    buildClosedTrades,
    buildDaysFromDeals,
    balanceDrawdown,
    statsFromDays,
    mergeTradeRolls,
    parseWorkbook,
    round2,
    round4,
  };
});
