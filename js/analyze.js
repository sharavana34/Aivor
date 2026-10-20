/* Aivor report analyzer — UI layer (math in analyze-core.js). */
(function () {
  const Core = window.AivorAnalyzeCore;
  if (!Core) {
    console.error("AivorAnalyzeCore missing — load js/analyze-core.js first.");
    return;
  }

  const $ = (id) => document.getElementById(id);

  function chartToken(name, fallback) {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch (e) {
      return fallback;
    }
  }

  let DATA = null;
  let DAYS = [];
  let BASE = 0;
  let state = { view: "day", month: "all", week: "all", from: "", to: "", side: "all", q: "", sort: "d", dir: 1 };
  let dateRangeError = "";

  function parseISO(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  function iso(dt) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }
  function mondayOf(dt) {
    const x = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    const off = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - off);
    return iso(x);
  }
  function pretty(s) {
    const [y, m, d] = s.split("-");
    return d + "-" + m + "-" + y;
  }
  function round2(n) {
    return Core.round2(n);
  }
  function money(n, digits) {
    const v = Number(n) || 0;
    return (v < 0 ? "-" : "") + Math.abs(v).toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }
  function usd(usc) {
    return "$" + money(usc / 100, 2);
  }
  function pct(n) {
    const v = Number(n) || 0;
    return (v > 0 ? "+" : "") + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
  }
  function cls(n) {
    return n > 0 ? "numpos" : n < 0 ? "numneg" : "";
  }
  function esc(s) {
    return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }
  function na(label) {
    return label || "Not available from this report";
  }

  function showError(msg) {
    const el = $("error");
    el.style.display = "block";
    el.textContent = msg;
  }
  function clearError() {
    const el = $("error");
    el.style.display = "none";
    el.textContent = "";
  }

  let loading = false;

  function yieldToUI() {
    return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
  }

  function setLoaderStatus(text) {
    const status = $("analyzeLoaderStatus");
    if (status) status.textContent = text;
  }

  function showLoader(text) {
    const loader = $("analyzeLoader");
    const drop = $("dropzone");
    const input = $("file");
    if (!loader || !drop) return;
    setLoaderStatus(text || "Reading workbook…");
    loader.hidden = false;
    loader.setAttribute("aria-busy", "true");
    drop.classList.add("is-loading");
    if (input) input.disabled = true;
    loading = true;
  }

  function hideLoader() {
    const loader = $("analyzeLoader");
    const drop = $("dropzone");
    const input = $("file");
    if (loader) {
      loader.hidden = true;
      loader.setAttribute("aria-busy", "false");
    }
    if (drop) drop.classList.remove("is-loading");
    if (input) input.disabled = false;
    loading = false;
  }

  function enrichDays(rawDays, base) {
    const days = rawDays.map((d, i) => {
      const dt = parseISO(d.d);
      return Object.assign({}, d, {
        dt,
        i,
        dow: dt.toLocaleDateString("en-GB", { weekday: "short" }),
        monthKey: d.d.slice(0, 7),
        monthLabel: dt.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
        weekKey: mondayOf(dt),
      });
    });
    const weekIndex = new Map();
    days.forEach((d) => {
      if (!weekIndex.has(d.weekKey)) weekIndex.set(d.weekKey, weekIndex.size + 1);
    });
    days.forEach((d) => {
      d.weekNo = weekIndex.get(d.weekKey);
    });
    let cum = 0;
    days.forEach((d) => {
      cum += d.pl;
      d.cum = round2(cum);
      d.pct = (d.pl / base) * 100;
      d.ret = (d.cum / base) * 100;
    });
    return days;
  }

  function loadData(data) {
    DATA = data;
    BASE = data.base;
    DAYS = enrichDays(data.days, BASE);
    state = { view: "day", month: "all", week: "all", from: "", to: "", side: "all", q: "", sort: "d", dir: 1 };
    dateRangeError = "";
    $("workspace").style.display = "block";
    $("download").disabled = false;
    $("month").value = "all";
    $("week").value = "all";
    $("from").value = "";
    $("to").value = "";
    $("side").value = "all";
    $("q").value = "";
    $("viewseg").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.view === "day"));
    fillSelects();
    renderHeader();
    render();
    $("workspace").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function fillSelects() {
    const month = $("month");
    const week = $("week");
    month.innerHTML = '<option value="all">All months</option>';
    const seenM = new Set();
    DAYS.forEach((d) => {
      if (seenM.has(d.monthKey)) return;
      seenM.add(d.monthKey);
      month.insertAdjacentHTML("beforeend", `<option value="${d.monthKey}">${esc(d.monthLabel)}</option>`);
    });
    week.innerHTML = '<option value="all">All weeks</option>';
    const seenW = new Set();
    DAYS.forEach((d) => {
      if (seenW.has(d.weekKey)) return;
      seenW.add(d.weekKey);
      const label = "Week " + d.weekNo + " · " + pretty(d.weekKey);
      week.insertAdjacentHTML("beforeend", `<option value="${d.weekKey}">${esc(label)}</option>`);
    });
  }

  function validateDateRange() {
    dateRangeError = "";
    if (state.from && state.to && state.from > state.to) {
      dateRangeError = "“From” date must be on or before “To” date.";
    }
    const err = $("filterError");
    if (err) {
      if (dateRangeError) {
        err.hidden = false;
        err.textContent = dateRangeError;
      } else {
        err.hidden = true;
        err.textContent = "";
      }
    }
    if ($("from")) $("from").classList.toggle("is-invalid", !!dateRangeError);
    if ($("to")) $("to").classList.toggle("is-invalid", !!dateRangeError);
    return !dateRangeError;
  }

  function filteredDays() {
    if (!validateDateRange()) return [];
    const q = state.q.trim().toLowerCase();
    return DAYS.filter((d) => {
      if (state.month !== "all" && d.monthKey !== state.month) return false;
      if (state.week !== "all" && d.weekKey !== state.week) return false;
      if (state.from && d.d < state.from) return false;
      if (state.to && d.d > state.to) return false;
      if (state.side === "win" && d.pl <= 0) return false;
      if (state.side === "loss" && d.pl >= 0) return false;
      if (q) {
        const blob = (pretty(d.d) + " " + d.d + " " + d.monthLabel + " week " + d.weekNo + " " + d.dow).toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }

  function activeFilterLabels() {
    const bits = [];
    if (state.month !== "all") {
      const opt = $("month").selectedOptions[0];
      bits.push(opt ? opt.textContent : state.month);
    }
    if (state.week !== "all") {
      const opt = $("week").selectedOptions[0];
      bits.push(opt ? opt.textContent : state.week);
    }
    if (state.from) bits.push("From " + pretty(state.from));
    if (state.to) bits.push("To " + pretty(state.to));
    if (state.side === "win") bits.push("Profit days only");
    if (state.side === "loss") bits.push("Loss days only");
    if (state.q.trim()) bits.push("Search “" + state.q.trim() + "”");
    return bits;
  }

  function groupOf(days, mode) {
    if (mode === "day") {
      return days.map((d) => ({
        key: d.d,
        label: pretty(d.d),
        sub: d.dow,
        week: "W" + d.weekNo,
        pl: d.pl,
        pct: d.pct,
        ret: d.ret,
        bal: d.bal,
        days: 1,
        winDays: d.pl > 0 ? 1 : 0,
        lossDays: d.pl < 0 ? 1 : 0,
        trades: d.out,
        wins: d.wins,
        losses: d.losses,
        breakeven: d.breakeven || 0,
        gross: d.gross,
        comm: d.comm,
        from: d.d,
        to: d.d,
        sort: d.d,
      }));
    }
    const map = new Map();
    days.forEach((d) => {
      const key = mode === "week" ? d.weekKey : d.monthKey;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(d);
    });
    const rows = [];
    map.forEach((list, key) => {
      const pl = round2(list.reduce((s, x) => s + x.pl, 0));
      const last = list[list.length - 1];
      const first = list[0];
      const trades = list.reduce((s, x) => s + x.out, 0);
      const wins = list.reduce((s, x) => s + x.wins, 0);
      const losses = list.reduce((s, x) => s + x.losses, 0);
      const breakeven = list.reduce((s, x) => s + (x.breakeven || 0), 0);
      const gross = round2(list.reduce((s, x) => s + x.gross, 0));
      const comm = round2(list.reduce((s, x) => s + x.comm, 0));
      const winDays = list.filter((x) => x.pl > 0).length;
      const lossDays = list.filter((x) => x.pl < 0).length;
      const label = mode === "week" ? "Week " + first.weekNo : first.monthLabel;
      const sub = pretty(first.d) + " – " + pretty(last.d);
      rows.push({
        key,
        label,
        sub,
        week: "W" + first.weekNo,
        pl,
        pct: (pl / BASE) * 100,
        ret: last.ret,
        bal: last.bal,
        days: list.length,
        winDays,
        lossDays,
        trades,
        wins,
        losses,
        breakeven,
        gross,
        comm,
        from: first.d,
        to: last.d,
        sort: first.d,
        list,
      });
    });
    return rows;
  }

  function curLabel() {
    const c = String(DATA.currency || "").trim();
    if (/^[A-Z]{3}$/.test(c)) return c;
    return "";
  }
  function withCur(amountText) {
    const c = curLabel();
    return c ? amountText + " " + c : amountText;
  }
  function isUsc() {
    return String(DATA.currency || "").toUpperCase() === "USC";
  }

  function renderHeader() {
    const first = DAYS[0];
    const last = DAYS[DAYS.length - 1];
    const bits = [];
    bits.push(DATA.name);
    if (DATA.account && DATA.account !== "—") bits.push("Account " + DATA.account);
    if (DATA.company && DATA.company !== "—") bits.push(DATA.company);
    if (DATA.kind === "tester" && DATA.symbol) bits.push(DATA.symbol);
    bits.push(pretty(first.d) + " to " + pretty(last.d));
    $("subtitle").textContent = bits.join(" · ");

    const net = last.cum;
    $("pills").innerHTML = [
      ["Deposited", withCur(money(DATA.deposited, 2))],
      ["Withdrawn", withCur(money(DATA.withdrawn, 2))],
      ["Net profit", withCur(money(net, 2))],
      ["Total return", pct(last.ret)],
      ["Balance", withCur(money(last.bal, 2))],
    ]
      .map(([k, v]) => `<div class="pill">${esc(k)} <b>${esc(v)}</b></div>`)
      .join("");

    const baseLabel = withCur(money(BASE, 0)) || money(BASE, 0);
    let note =
      "P/L is the realized change in <b>balance</b> each day, after commission, fees and swap. Deposits, withdrawals and transfers are excluded from P/L. Profit % and Total Return use the <b>" +
      esc(baseLabel) +
      "</b> capital base (sum of deposit deals, or Initial Deposit when none)";
    if (isUsc()) {
      note +=
        " (100 USC = 1 USD, so the deposit is " +
        usd(DATA.deposited) +
        " and the net profit is " +
        usd(net) +
        ")";
    }
    note += ". Gross profit in the Profit column, before commission, was " + withCur(money(DATA.gross, 2)) + ".";
    note +=
      " Closed trades: " +
      esc(DATA.tradeGroupingNote || "") +
      " Max drawdown on this page is <b>balance-based</b> (end-of-day peaks); floating equity drawdown is " +
      (DATA.equityDrawdown
        ? withCur(money(DATA.equityDrawdown.amount, 2)) +
          " (" +
          DATA.equityDrawdown.pct.toFixed(2) +
          "%) from Strategy Tester Results"
        : "not available from Deals alone") +
      ".";
    if (DATA.currencyNote) {
      note += " Currency note from report: " + esc(DATA.currencyNote) + ".";
    }
    $("footnote").innerHTML = note;
  }

  function renderKpis(s) {
    const cur = curLabel();
    const usdHint = isUsc() ? "  ·  " + usd(s.pl) : "";
    const usdBal = isUsc() ? "  ·  " + usd(s.bal) : "";
    const curBit = cur ? cur : "account currency";
    const t = s.trades || {};
    const equityDd =
      DATA.equityDrawdown != null
        ? money(DATA.equityDrawdown.amount, 2) + " (" + DATA.equityDrawdown.pct.toFixed(2) + "%)"
        : na();
    const equityHint = DATA.equityDrawdown
      ? "from Strategy Tester Results (full report, not filter-scoped)"
      : "floating equity path not in Deals";

    const cards = [
      ["Net P/L", (s.pl > 0 ? "+" : "") + money(s.pl, 2), curBit + usdHint + " · balance-based", s.pl >= 0 ? "good" : "bad"],
      ["Window return", pct(s.ret), "of " + withCur(money(BASE, 0)) + " deposited", s.ret >= 0 ? "good" : "bad"],
      ["Ending balance", money(s.bal, 2), curBit + usdBal + "  ·  started window " + money(s.startBal, 2), "gold"],
      [
        "Profit days",
        s.winDays + " / " + s.days,
        s.lossDays + " loss days  ·  day P/F " + (s.dayProfitFactor == null ? "—" : s.dayProfitFactor.toFixed(2)),
        "blue",
      ],
      ["Best day", s.best && s.best.d ? (s.best.pl > 0 ? "+" : "") + money(s.best.pl, 2) : "—", s.best && s.best.d ? pretty(s.best.d) : "", "good"],
      ["Worst day", s.worst && s.worst.d ? money(s.worst.pl, 2) : "—", s.worst && s.worst.d ? pretty(s.worst.d) : "", "bad"],
      [
        "Max balance DD",
        money(s.maxDd, 2),
        s.maxDdPct.toFixed(2) + "% from a balance peak in this view",
        "bad",
      ],
      [
        "Recovery factor",
        s.recoveryFactor == null ? na("—") : s.recoveryFactor.toFixed(2),
        s.recoveryFactor == null ? "needs net P/L and balance DD > 0" : "net P/L ÷ max balance DD",
        "purple",
      ],
      [
        "Win rate",
        t.winRatePct == null ? "—" : t.winRatePct.toFixed(2) + "%",
        t.wins + " wins · " + t.losses + " losses · " + (t.breakeven || 0) + " BE",
        "good",
      ],
      [
        "Profit factor",
        t.profitFactor == null ? "—" : t.profitFactor.toFixed(2),
        "Σ winning trade P/L ÷ |Σ losing trade P/L|",
        "blue",
      ],
      [
        "Avg win / loss",
        (t.avgWin == null ? "—" : money(t.avgWin, 2)) + " / " + (t.avgLoss == null ? "—" : money(t.avgLoss, 2)),
        "per closed trade in this view",
        "gold",
      ],
      [
        "Largest win / loss",
        (t.largestWin == null ? "—" : "+" + money(t.largestWin, 2)) +
          " / " +
          (t.largestLoss == null ? "—" : money(t.largestLoss, 2)),
        "closed trades · " + (DATA.tradeGrouping === "position" ? "by position" : "by close deal"),
        "purple",
      ],
      [
        "Trades closed",
        money(t.closed || 0, 0),
        DATA.tradeGrouping === "position" ? "grouped by Position ID" : "close deals (out + out by)",
        "blue",
      ],
      ["Equity max DD", equityDd, equityHint, "bad"],
    ];
    $("kpis").innerHTML = cards
      .map(
        ([l, v, h, k]) =>
          `<article class="kpi ${k}"><div class="label">${esc(l)}</div><div class="value ${k === "good" ? "goodnum" : k === "bad" ? "badnum" : ""}">${esc(v)}</div><div class="hint">${esc(h)}</div></article>`
      )
      .join("");
  }

  function renderFilterStatus(days) {
    const el = $("filterStatus");
    if (!el) return;
    const labels = activeFilterLabels();
    if (!labels.length) {
      el.innerHTML =
        `<span class="filter-status-count">${days.length} day${days.length === 1 ? "" : "s"} in view</span>` +
        `<span class="filter-status-note">No filters · charts, KPIs, table and export stay in sync</span>`;
      return;
    }
    el.innerHTML =
      `<span class="filter-status-count">${days.length} day${days.length === 1 ? "" : "s"} match</span>` +
      `<span class="filter-status-chips">${labels.map((l) => `<span class="filter-chip">${esc(l)}</span>`).join("")}</span>`;
  }

  function renderTable(rows) {
    const view = state.view;
    const title = view === "day" ? "Daily results" : view === "week" ? "Weekly results" : "Monthly results";
    $("tableTitle").textContent = title;
    $("tableMeta").textContent = rows.length + (rows.length === 1 ? " row" : " rows");
    const cols =
      view === "day"
        ? [
            ["Date", "label"],
            ["Day", "sub"],
            ["Week", "week"],
            ["Net P/L", "pl"],
            ["Profit %", "pct"],
            ["Total return", "ret"],
            ["Balance", "bal"],
            ["Trades", "trades"],
            ["Wins", "wins"],
            ["Losses", "losses"],
            ["Gross", "gross"],
            ["Costs", "comm"],
          ]
        : [
            ["Period", "label"],
            ["Dates", "sub"],
            ["Days", "days"],
            ["Net P/L", "pl"],
            ["Profit %", "pct"],
            ["Total return", "ret"],
            ["End balance", "bal"],
            ["Profit days", "winDays"],
            ["Loss days", "lossDays"],
            ["Trades", "trades"],
            ["Gross", "gross"],
            ["Costs", "comm"],
          ];
    const head = "<thead><tr>" + cols.map(([name, key]) => `<th data-k="${key}">${esc(name)}</th>`).join("") + "</tr></thead>";
    if (!rows.length) {
      const emptyMsg = dateRangeError
        ? "Fix the date range to see results."
        : "Nothing matches these filters.";
      $("grid").innerHTML =
        head + '<tbody><tr><td class="empty" colspan="' + cols.length + '">' + esc(emptyMsg) + "</td></tr></tbody>";
      return;
    }
    const body = rows
      .map((r) => {
        const tone = r.pl > 0 ? "win" : r.pl < 0 ? "loss" : "";
        const tds = cols
          .map(([, key]) => {
            let val = r[key];
            if (key === "pl" || key === "bal" || key === "gross" || key === "comm") {
              val = `<span class="${cls(r[key])}">${money(r[key], 2)}</span>`;
            } else if (key === "pct" || key === "ret") {
              val = `<span class="${cls(r[key])}">${pct(r[key])}</span>`;
            } else val = esc(val);
            return `<td>${val}</td>`;
          })
          .join("");
        return `<tr class="${tone}">${tds}</tr>`;
      })
      .join("");
    $("grid").innerHTML = head + "<tbody>" + body + "</tbody>";
    $("grid").querySelectorAll("th").forEach((th) =>
      th.addEventListener("click", () => {
        const k = th.dataset.k;
        if (state.sort === k) state.dir *= -1;
        else {
          state.sort = k;
          state.dir = k === "label" || k === "sub" || k === "week" ? 1 : -1;
        }
        render();
      })
    );
  }

  function renderCards(rows) {
    const host = $("cards");
    if (state.view === "day") {
      host.innerHTML = "";
      return;
    }
    if (!rows.length) {
      host.innerHTML = '<p class="chart-empty">No periods match these filters.</p>';
      return;
    }
    host.innerHTML = rows
      .map((r) => {
        const list = r.list || [];
        const body = list
          .map((d) => {
            const tone = d.pl > 0 ? "win" : d.pl < 0 ? "loss" : "";
            return `<tr class="${tone}"><td>${pretty(d.d)}</td><td>${money(d.pl, 2)}</td><td>${pct(d.pct)}</td><td>${pct(d.ret)}</td></tr>`;
          })
          .join("");
        const tone = r.pl > 0 ? "win" : "loss";
        return `<article class="wcard">
      <h3>${esc(r.label)}</h3>
      <div class="range">${esc(r.sub)}</div>
      <div class="wcard-scroll">
      <table>
        <thead><tr><th>Date</th><th>P/L</th><th>Profit %</th><th>Total return</th></tr></thead>
        <tbody>${body}
          <tr class="total ${tone}"><td>Total</td><td>${money(r.pl, 2)}</td><td>${pct(r.pct)}</td><td>${pct(r.ret)}</td></tr>
        </tbody>
      </table>
      </div>
    </article>`;
      })
      .join("");
  }

  function chartBox(values) {
    let min = Math.min.apply(null, values);
    let max = Math.max.apply(null, values);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const pad = (max - min) * 0.08;
    return { min: min - pad, max: max + pad };
  }
  function yOf(v, box, top, height) {
    return top + ((box.max - v) / (box.max - box.min)) * height;
  }

  function chartEmpty(svg, captionEl, message) {
    svg.innerHTML = "";
    svg.onmousemove = null;
    svg.onmouseleave = null;
    svg.onclick = null;
    if (captionEl) captionEl.textContent = "";
    const parent = svg.parentElement;
    let empty = parent && parent.querySelector(".chart-empty");
    if (parent) {
      if (!empty) {
        empty = document.createElement("p");
        empty.className = "chart-empty";
        parent.appendChild(empty);
      }
      empty.hidden = false;
      empty.textContent = message;
    }
  }

  function clearChartEmpty(svg) {
    const parent = svg.parentElement;
    const empty = parent && parent.querySelector(".chart-empty");
    if (empty) empty.hidden = true;
  }

  function renderBalance(days) {
    const svg = $("balChart");
    const W = 760,
      H = 250,
      L = 46,
      R = 12,
      T = 16,
      B = 28;
    if (days.length < 2) {
      chartEmpty(
        svg,
        $("balCaption"),
        days.length === 0
          ? dateRangeError
            ? "Fix the date range to plot balance."
            : "No days in view — clear filters to see the balance chart."
          : "Need at least two days in view to plot a balance line."
      );
      return;
    }
    clearChartEmpty(svg);
    const box = chartBox(days.map((d) => d.bal));
    const innerW = W - L - R,
      innerH = H - T - B;
    const step = innerW / (days.length - 1);
    const pts = days.map((d, i) => [L + i * step, yOf(d.bal, box, T, innerH)]);
    const line = pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
    const area =
      line +
      ` ${pts[pts.length - 1][0].toFixed(1)},${(T + innerH).toFixed(1)} ${pts[0][0].toFixed(1)},${(T + innerH).toFixed(1)}`;
    const grids = [0, 0.25, 0.5, 0.75, 1]
      .map((t) => {
        const v = box.max - t * (box.max - box.min);
        const y = T + t * innerH;
        const axis = chartToken("--chart-axis", "#94a3b8");
        const grid = chartToken("--chart-grid", "rgba(148,163,184,.12)");
        return `<line x1="${L}" y1="${y}" x2="${W - R}" y2="${y}" stroke="${grid}" stroke-width="1"></line>
      <text x="${L - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="${axis}">${Math.round(v).toLocaleString("en-US")}</text>`;
      })
      .join("");
    const axis = chartToken("--chart-axis", "#94a3b8");
    const lineA = chartToken("--chart-line", "#00C2FF");
    const lineB = chartToken("--primary-deep", "#1E88E5");
    const lineC = chartToken("--primary-bright", "#4DD4FF");
    const areaFill = chartToken("--chart-area", "rgba(0,194,255,.14)");
    const xLabels = [0, Math.floor((days.length - 1) / 2), days.length - 1]
      .map((i) => {
        const x = L + i * step;
        return `<text x="${x}" y="${H - 8}" text-anchor="middle" font-size="11" fill="${axis}">${pretty(days[i].d).slice(0, 5)}</text>`;
      })
      .join("");
    svg.innerHTML = `${grids}<defs><linearGradient id="balStroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${lineA}"/><stop offset="55%" stop-color="${lineB}"/><stop offset="100%" stop-color="${lineC}"/></linearGradient></defs><polygon points="${area}" fill="${areaFill}"></polygon>
    <polyline points="${line}" fill="none" stroke="url(#balStroke)" stroke-width="2.4" stroke-linejoin="round"></polyline>${xLabels}`;
    $("balCaption").textContent =
      withCur(money(days[0].bal, 0) + " → " + money(days[days.length - 1].bal, 0)) + " · end-of-day balance";
    svg.onmousemove = (ev) => {
      const rect = svg.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * W;
      let idx = Math.round((x - L) / step);
      idx = Math.max(0, Math.min(days.length - 1, idx));
      const d = days[idx];
      const tip = $("tip");
      tip.style.display = "block";
      tip.style.left = Math.min(ev.clientX + 14, window.innerWidth - 180) + "px";
      tip.style.top = ev.clientY + 14 + "px";
      tip.innerHTML = `<b>${pretty(d.d)}</b><br>Balance ${withCur(money(d.bal, 2))}<br>Day P/L ${money(d.pl, 2)} · ${pct(d.ret)} cumulative<br><span class="tip-sub">Balance series (not floating equity)</span>`;
    };
    svg.onmouseleave = () => {
      $("tip").style.display = "none";
    };
  }

  function renderBars() {
    const svg = $("barChart");
    const months = groupOf(DAYS, "month");
    if (!months.length) {
      chartEmpty(svg, null, "No monthly P/L to chart yet.");
      return;
    }
    clearChartEmpty(svg);
    const W = 420,
      H = 250,
      L = 36,
      R = 8,
      T = 16,
      B = 32;
    const vals = months.map((m) => m.pl);
    let min = Math.min(0, ...vals),
      max = Math.max(0, ...vals);
    if (min === max) max = min + 1;
    const pad = (max - min) * 0.12;
    min -= pad;
    max += pad;
    const innerW = W - L - R,
      innerH = H - T - B;
    const zero = T + ((max - 0) / (max - min)) * innerH;
    const gap = 8,
      bw = (innerW - gap * (months.length - 1)) / months.length;
    const bars = months
      .map((m, i) => {
        const x = L + i * (bw + gap);
        const y = yOf(m.pl, { min, max }, T, innerH);
        const y0 = zero;
        const top = Math.min(y, y0),
          h = Math.max(1, Math.abs(y - y0));
        const fill =
          m.pl >= 0
            ? chartToken("--chart-bar-pos", "#10b981")
            : chartToken("--chart-bar-neg", "#ef4444");
        const accent = chartToken("--chart-line", "#00C2FF");
        const on = state.month === m.key ? ` stroke="${accent}" stroke-width="1.5"` : "";
        const axis = chartToken("--chart-axis", "#94a3b8");
        return `<rect data-m="${m.key}" x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${fill}"${on} style="cursor:pointer"></rect>
      <text x="${(x + bw / 2).toFixed(1)}" y="${H - 10}" text-anchor="middle" font-size="10" fill="${axis}">${m.label.slice(0, 3)}</text>`;
      })
      .join("");
    const zeroStroke = chartToken("--line-soft", "rgba(255,255,255,.2)");
    svg.innerHTML = `<line x1="${L}" y1="${zero}" x2="${W - R}" y2="${zero}" stroke="${zeroStroke}"></line>` + bars;
    svg.querySelectorAll("rect").forEach((r) =>
      r.addEventListener("click", () => {
        state.month = state.month === r.dataset.m ? "all" : r.dataset.m;
        $("month").value = state.month;
        render();
      })
    );
    svg.onmousemove = (ev) => {
      const el = ev.target.closest ? ev.target.closest("rect") : null;
      const tip = $("tip");
      if (!el) {
        tip.style.display = "none";
        return;
      }
      const m = months.find((x) => x.key === el.dataset.m);
      tip.style.display = "block";
      tip.style.left = Math.min(ev.clientX + 14, window.innerWidth - 180) + "px";
      tip.style.top = ev.clientY + 14 + "px";
      const filtered = state.month === m.key;
      tip.innerHTML = `<b>${esc(m.label)}</b><br>${withCur(money(m.pl, 2))} · ${pct(m.pct)}<br><span class="tip-sub">${filtered ? "Click to clear month filter" : "Click to filter this month"}</span>`;
    };
    svg.onmouseleave = () => {
      $("tip").style.display = "none";
    };
  }

  function sortRows(rows) {
    const k = state.sort;
    const dir = state.dir;
    const numeric = ["pl", "pct", "ret", "bal", "days", "winDays", "lossDays", "trades", "wins", "losses", "gross", "comm"];
    rows.sort((a, b) => {
      let va = a[k],
        vb = b[k];
      if (k === "label" || k === "sub" || k === "week" || k === "d") {
        va = a.sort || a.label;
        vb = b.sort || b.label;
        return va < vb ? -dir : va > vb ? dir : 0;
      }
      if (numeric.includes(k)) return (va - vb) * dir;
      va = String(va);
      vb = String(vb);
      return va < vb ? -dir : va > vb ? dir : 0;
    });
    return rows;
  }

  function render() {
    if (!DAYS.length) return;
    const days = filteredDays();
    const s = Core.statsFromDays(days, BASE);
    renderFilterStatus(days);
    renderKpis(s);
    let rows = groupOf(days, state.view);
    rows = sortRows(rows);
    renderTable(rows);
    renderCards(state.view === "day" ? [] : rows);
    renderBalance(days);
    renderBars();
  }

  async function downloadExcel() {
    if (!DATA || !DAYS.length) return;
    if (typeof ExcelJS === "undefined") {
      showError("Excel export library failed to load.");
      return;
    }
    const wb = new ExcelJS.Workbook();
    wb.creator = "Aivor";
    const yellow = "FFD84A";
    const blue = "1E4F91";
    const greenBg = "E5F7EC";
    const redBg = "FDECEF";
    const green = "0C7A43";
    const red = "C4233A";

    function styleHeader(row) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: blue } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "right" };
      });
      row.getCell(1).alignment = { horizontal: "left" };
    }
    function toneRow(row, pl, fromCol) {
      const bg = pl > 0 ? greenBg : pl < 0 ? redBg : null;
      const fg = pl > 0 ? green : pl < 0 ? red : "172033";
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        if (col < fromCol) return;
        if (bg) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        if (col >= fromCol) cell.font = Object.assign({}, cell.font || {}, { color: { argb: "FF" + fg } });
      });
    }

    const filtered = filteredDays();
    const s = Core.statsFromDays(filtered, BASE);
    const filterLabels = activeFilterLabels();
    const cur = curLabel() || DATA.currencyNote || "";

    const summary = wb.addWorksheet("Summary");
    summary.columns = [
      { width: 32 },
      { width: 28 },
      { width: 56 },
    ];
    summary.addRow(["Aivor analyze export"]);
    summary.getRow(1).font = { bold: true, size: 14 };
    summary.addRow(["Source file", DATA.fileName]);
    summary.addRow(["Account", DATA.account]);
    summary.addRow(["Name", DATA.name]);
    summary.addRow(["Company", DATA.company]);
    summary.addRow(["Currency", cur || "(not stated)"]);
    summary.addRow(["Report kind", DATA.kind]);
    summary.addRow(["Filters", filterLabels.length ? filterLabels.join(" · ") : "None (full report)"]);
    summary.addRow(["Days in view", filtered.length]);
    summary.addRow([]);
    summary.addRow(["Metric", "Value", "Basis"]);
    styleHeader(summary.getRow(summary.rowCount));
    const t = s.trades || {};
    const metricRows = [
      ["Net P/L", s.pl, DATA.calculationBasis.dailyPl],
      ["Window return %", s.ret / 100, "Net P/L ÷ capital base"],
      ["Capital base", BASE, DATA.calculationBasis.capitalBase],
      ["Ending balance", s.bal, "Last end-of-day balance in view"],
      ["Deposited (full report)", DATA.deposited, "Sum of positive balance deals"],
      ["Withdrawn (full report)", DATA.withdrawn, "Sum of |negative| balance deals / transfers out"],
      ["Gross profit column (full)", DATA.gross, "Sum of non-balance Profit (commissions not subtracted here)"],
      ["Max balance drawdown", s.maxDd, DATA.calculationBasis.maxDrawdown],
      ["Max balance drawdown %", s.maxDdPct / 100, "Drawdown ÷ balance peak in view"],
      ["Recovery factor", s.recoveryFactor, DATA.calculationBasis.recoveryFactor],
      ["Trades closed", t.closed, DATA.tradeGroupingNote],
      ["Winning trades", t.wins, "Closed trade P/L > 0"],
      ["Losing trades", t.losses, "Closed trade P/L < 0"],
      ["Breakeven trades", t.breakeven || 0, "Closed trade P/L = 0"],
      ["Win rate", t.winRatePct == null ? null : t.winRatePct / 100, "Wins ÷ closed trades"],
      ["Profit factor (trades)", t.profitFactor, "Σ winning trade P/L ÷ |Σ losing trade P/L|"],
      ["Average win", t.avgWin, "Mean P/L of winning closed trades"],
      ["Average loss", t.avgLoss, "Mean P/L of losing closed trades"],
      ["Largest win", t.largestWin, "Max closed-trade P/L"],
      ["Largest loss", t.largestLoss, "Min closed-trade P/L"],
      [
        "Equity max DD",
        DATA.equityDrawdown ? DATA.equityDrawdown.amount : "Not available from this report",
        DATA.calculationBasis.equityDrawdown,
      ],
      [
        "Equity max DD %",
        DATA.equityDrawdown ? DATA.equityDrawdown.pct / 100 : "Not available from this report",
        "Strategy Tester Results when present",
      ],
      ["Day profit factor", s.dayProfitFactor, "Σ profit days ÷ |Σ loss days| (day P/L, not trades)"],
    ];
    metricRows.forEach((row) => {
      const r = summary.addRow(row);
      if (typeof row[1] === "number") {
        if (String(row[0]).indexOf("%") >= 0 || row[0] === "Win rate" || row[0] === "Window return %" || row[0] === "Max balance drawdown %" || row[0] === "Equity max DD %") {
          r.getCell(2).numFmt = "0.00%";
        } else if (row[0] === "Trades closed" || row[0] === "Winning trades" || row[0] === "Losing trades" || row[0] === "Breakeven trades" || row[0] === "Days in view") {
          r.getCell(2).numFmt = "0";
        } else {
          r.getCell(2).numFmt = "#,##0.00";
        }
      }
    });
    summary.addRow([]);
    summary.addRow(["Notes"]);
    summary.addRow(["Browser-only processing — file was not uploaded to a server."]);
    summary.addRow(["Costs column = Commission + Fee + Swap for the period (not double-counted in Net P/L)."]);
    summary.addRow(["Filtered Detail sheet matches the on-screen " + state.view + " view."]);
    summary.addRow(["Full Daily / Weekly / Monthly sheets are the unfiltered report."]);

    function addDetailSheet(name, mode, daySource) {
      const ws = wb.addWorksheet(name);
      const rows = groupOf(daySource, mode);
      if (mode === "day") {
        ws.columns = [
          { header: "Date", key: "d", width: 14 },
          { header: "Day", key: "dow", width: 8 },
          { header: "Week", key: "week", width: 8 },
          { header: "Net P/L", key: "pl", width: 12 },
          { header: "Profit %", key: "pct", width: 12 },
          { header: "Total return", key: "ret", width: 12 },
          { header: "Balance", key: "bal", width: 12 },
          { header: "Trades", key: "out", width: 10 },
          { header: "Wins", key: "wins", width: 8 },
          { header: "Losses", key: "losses", width: 8 },
          { header: "Gross", key: "gross", width: 12 },
          { header: "Costs", key: "comm", width: 12 },
          { header: "Deposits", key: "dep", width: 12 },
          { header: "Withdrawals", key: "wd", width: 12 },
        ];
        styleHeader(ws.getRow(1));
        daySource.forEach((d) => {
          const row = ws.addRow({
            d: d.d,
            dow: d.dow,
            week: "W" + d.weekNo,
            pl: d.pl,
            pct: d.pct / 100,
            ret: d.ret / 100,
            bal: d.bal,
            out: d.out,
            wins: d.wins,
            losses: d.losses,
            gross: d.gross,
            comm: d.comm,
            dep: d.dep,
            wd: d.wd,
          });
          ["pl", "bal", "gross", "comm", "dep", "wd"].forEach((k) => {
            row.getCell(k).numFmt = "#,##0.00";
          });
          row.getCell("pct").numFmt = "0.00%";
          row.getCell("ret").numFmt = "0.00%";
          toneRow(row, d.pl, 4);
        });
      } else {
        ws.columns = [
          { header: "Period", key: "label", width: 18 },
          { header: "From", key: "from", width: 12 },
          { header: "To", key: "to", width: 12 },
          { header: "Days", key: "days", width: 8 },
          { header: "Net P/L", key: "pl", width: 12 },
          { header: "Profit %", key: "pct", width: 12 },
          { header: "Total return", key: "ret", width: 12 },
          { header: "End balance", key: "bal", width: 12 },
          { header: "Profit days", key: "winDays", width: 12 },
          { header: "Loss days", key: "lossDays", width: 12 },
          { header: "Trades", key: "trades", width: 10 },
          { header: "Gross", key: "gross", width: 12 },
          { header: "Costs", key: "comm", width: 12 },
        ];
        styleHeader(ws.getRow(1));
        rows.forEach((r) => {
          const row = ws.addRow({
            label: r.label,
            from: r.from,
            to: r.to,
            days: r.days,
            pl: r.pl,
            pct: r.pct / 100,
            ret: r.ret / 100,
            bal: r.bal,
            winDays: r.winDays,
            lossDays: r.lossDays,
            trades: r.trades,
            gross: r.gross,
            comm: r.comm,
          });
          ["pl", "bal", "gross", "comm"].forEach((k) => {
            row.getCell(k).numFmt = "#,##0.00";
          });
          row.getCell("pct").numFmt = "0.00%";
          row.getCell("ret").numFmt = "0.00%";
          toneRow(row, r.pl, 5);
        });
      }
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: ws.columnCount },
      };
      return ws;
    }

    addDetailSheet("Filtered Detail", state.view === "day" ? "day" : state.view, filtered);

    // Week Cards — full report (unfiltered), same layout as before
    const weeks = groupOf(DAYS, "week");
    const cardsSheet = wb.addWorksheet("Week Cards", {
      views: [{ showGridLines: false }],
    });
    const colW = 14;
    cardsSheet.columns = [
      { width: colW },
      { width: 12 },
      { width: 12 },
      { width: 14 },
      { width: 2 },
      { width: colW },
      { width: 12 },
      { width: 12 },
      { width: 14 },
      { width: 2 },
      { width: colW },
      { width: 12 },
      { width: 12 },
      { width: 14 },
    ];
    const n = weeks.length;
    const perCol = Math.ceil(n / 3) || 1;
    function cardOrigin(idx) {
      const col = Math.floor(idx / perCol);
      const rowInCol = idx % perCol;
      let r = 1;
      for (let i = 0; i < rowInCol; i++) {
        const w = weeks[col * perCol + i];
        r += 3 + (w.list ? w.list.length : 0) + 1 + 1;
      }
      const c = 1 + col * 5;
      return { r, c };
    }
    weeks.forEach((w, idx) => {
      const { r, c } = cardOrigin(idx);
      const title = cardsSheet.getRow(r);
      title.getCell(c).value = w.label;
      cardsSheet.mergeCells(r, c, r, c + 3);
      for (let k = 0; k < 4; k++) {
        const cell = title.getCell(c + k);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: yellow } };
        cell.font = { bold: true };
        cell.alignment = { horizontal: "center" };
      }
      const range = cardsSheet.getRow(r + 1);
      range.getCell(c).value = w.sub;
      cardsSheet.mergeCells(r + 1, c, r + 1, c + 3);
      for (let k = 0; k < 4; k++) {
        const cell = range.getCell(c + k);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: yellow } };
        cell.font = { size: 10, color: { argb: "FF5C4A00" } };
        cell.alignment = { horizontal: "center" };
      }
      const head = cardsSheet.getRow(r + 2);
      ["Date", "P/L", "Profit %", "Total return"].forEach((h, i) => {
        const cell = head.getCell(c + i);
        cell.value = h;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: blue } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: i === 0 ? "left" : "right" };
      });
      (w.list || []).forEach((d, di) => {
        const row = cardsSheet.getRow(r + 3 + di);
        row.getCell(c).value = pretty(d.d);
        row.getCell(c + 1).value = d.pl;
        row.getCell(c + 1).numFmt = "#,##0.00";
        row.getCell(c + 2).value = d.pct / 100;
        row.getCell(c + 2).numFmt = "0.00%";
        row.getCell(c + 3).value = d.ret / 100;
        row.getCell(c + 3).numFmt = "0.00%";
        const bg = d.pl > 0 ? greenBg : d.pl < 0 ? redBg : null;
        const fg = d.pl > 0 ? green : d.pl < 0 ? red : "172033";
        for (let k = 0; k < 4; k++) {
          if (bg) row.getCell(c + k).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
          row.getCell(c + k).font = { color: { argb: "FF" + fg } };
          row.getCell(c + k).alignment = { horizontal: k === 0 ? "left" : "right" };
        }
      });
      const totalR = r + 3 + (w.list ? w.list.length : 0);
      const total = cardsSheet.getRow(totalR);
      total.getCell(c).value = "Total";
      total.getCell(c + 1).value = w.pl;
      total.getCell(c + 1).numFmt = "#,##0.00";
      total.getCell(c + 2).value = w.pct / 100;
      total.getCell(c + 2).numFmt = "0.00%";
      total.getCell(c + 3).value = w.ret / 100;
      total.getCell(c + 3).numFmt = "0.00%";
      for (let k = 0; k < 4; k++) {
        total.getCell(c + k).font = { bold: true, color: { argb: "FF" + (w.pl >= 0 ? green : red) } };
        total.getCell(c + k).alignment = { horizontal: k === 0 ? "left" : "right" };
      }
    });

    addDetailSheet("Daily (full)", "day", DAYS);
    addDetailSheet("Weekly (full)", "week", DAYS);
    addDetailSheet("Monthly (full)", "month", DAYS);

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    const baseName = (DATA.fileName || "report").replace(/\.xlsx$/i, "");
    a.href = URL.createObjectURL(blob);
    a.download = baseName + "-Aivor-Dashboard.xlsx";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function handleFile(file) {
    clearError();
    if (!file || loading) return;
    $("fileName").textContent = file.name;
    if (!/\.xlsx$/i.test(file.name)) {
      showError("Please choose an .xlsx MetaTrader report.");
      return;
    }
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > 12) {
      showError(
        "This file is " +
          sizeMb.toFixed(1) +
          " MB. Very large reports may run out of browser memory. Try exporting a shorter date range from MetaTrader, then reload."
      );
    }
    showLoader(sizeMb > 4 ? "Reading large workbook (" + sizeMb.toFixed(1) + " MB)…" : "Reading workbook…");
    try {
      await yieldToUI();
      const buf = await file.arrayBuffer();
      setLoaderStatus("Parsing deals…");
      await yieldToUI();
      const data = Core.parseWorkbook(buf, file.name);
      setLoaderStatus("Building dashboard…");
      await yieldToUI();
      loadData(data);
      hideLoader();
      if (sizeMb > 4) {
        clearError();
      }
    } catch (err) {
      console.error(err);
      hideLoader();
      $("workspace").style.display = "none";
      $("download").disabled = true;
      let msg = err && err.message ? err.message : "Could not parse this file.";
      if (/Invalid array length|out of memory|allocation/i.test(String(err && err.message))) {
        msg =
          "The browser ran out of memory reading this workbook. Export a shorter period from MetaTrader (Trade History / Strategy Tester with Deals) and try again. Nothing was uploaded.";
      }
      showError(msg);
    }
  }

  function wire() {
    const drop = $("dropzone");
    const input = $("file");
    if (!drop || !input) return;
    input.addEventListener("change", () => {
      if (loading) return;
      handleFile(input.files && input.files[0]);
    });
    ["dragenter", "dragover"].forEach((ev) =>
      drop.addEventListener(ev, (e) => {
        e.preventDefault();
        if (loading) return;
        drop.classList.add("drag");
      })
    );
    ["dragleave", "drop"].forEach((ev) =>
      drop.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.remove("drag");
      })
    );
    drop.addEventListener("drop", (e) => {
      if (loading) return;
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleFile(f);
    });

    $("viewseg").addEventListener("click", (ev) => {
      const btn = ev.target.closest("button");
      if (!btn) return;
      state.view = btn.dataset.view;
      state.sort = "d";
      state.dir = 1;
      $("viewseg").querySelectorAll("button").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      render();
    });
    $("month").addEventListener("change", (e) => {
      state.month = e.target.value;
      render();
    });
    $("week").addEventListener("change", (e) => {
      state.week = e.target.value;
      render();
    });
    $("from").addEventListener("change", (e) => {
      state.from = e.target.value;
      render();
    });
    $("to").addEventListener("change", (e) => {
      state.to = e.target.value;
      render();
    });
    $("side").addEventListener("change", (e) => {
      state.side = e.target.value;
      render();
    });
    $("q").addEventListener("input", (e) => {
      state.q = e.target.value;
      render();
    });
    $("reset").addEventListener("click", () => {
      state.month = "all";
      state.week = "all";
      state.from = "";
      state.to = "";
      state.side = "all";
      state.q = "";
      state.view = "day";
      state.sort = "d";
      state.dir = 1;
      dateRangeError = "";
      $("month").value = "all";
      $("week").value = "all";
      $("from").value = "";
      $("to").value = "";
      $("side").value = "all";
      $("q").value = "";
      $("viewseg").querySelectorAll("button").forEach((b) => {
        const on = b.dataset.view === "day";
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      render();
    });
    $("download").addEventListener("click", () => {
      downloadExcel().catch((err) => {
        console.error(err);
        showError("Download failed: " + (err.message || err));
      });
    });
  }

  window.AivorAnalyze = {
    parseWorkbook: (buf, name) => Core.parseWorkbook(buf, name),
    getData: () => DATA,
    getDays: () => DAYS,
    getState: () => Object.assign({}, state),
    statsFromDays: (days) => Core.statsFromDays(days, BASE),
    weekPl: (from, to) => round2(DAYS.filter((d) => d.d >= from && d.d <= to).reduce((s, d) => s + d.pl, 0)),
    core: Core,
  };

  window.addEventListener("aivor:themechange", () => {
    if (DATA && DAYS && DAYS.length) render();
  });

  wire();
})();
