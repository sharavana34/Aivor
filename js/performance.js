/**
 * Performance page — loads shared Excel-backed JSON from data/.
 * Routes: ?product=hf|scalper|swing & type=backtest|live
 */
(function () {
  "use strict";

  var PRODUCTS = {
    hf: { label: "HF" },
    scalper: { label: "Scalper" },
    swing: { label: "Swing" }
  };
  var VALID_TYPES = { backtest: true, live: true };
  var AVAILABILITY = {
    hf: { backtest: true, live: true },
    scalper: { backtest: true, live: false },
    swing: { backtest: true, live: false }
  };

  var product = "hf";
  var type = "backtest";
  var hasValidProduct = true;
  var reportData = null;
  var monthFilter = "all";
  var chartMode = "balance";
  var cache = Object.create(null);
  var tradesExpanded = false;
  var tradesRenderedKey = "";
  var tradesRenderToken = 0;

  function $(id) {
    return document.getElementById(id);
  }

  function setText(id, text) {
    var el = $(id);
    if (el) el.textContent = text;
  }

  function setStatus(text, busy) {
    var el = $("status");
    if (!el) return;
    el.textContent = text;
    if (busy) {
      el.setAttribute("aria-busy", "true");
    } else {
      el.removeAttribute("aria-busy");
    }
  }

  function productLabel(key) {
    if (window.AIVOR_PRODUCT_BRAND && window.AIVOR_PRODUCT_BRAND.get(key)) {
      return window.AIVOR_PRODUCT_BRAND.get(key).shortName;
    }
    return PRODUCTS[key] ? PRODUCTS[key].label : key;
  }

  function resetTradesPanel() {
    tradesExpanded = false;
    tradesRenderedKey = "";
    tradesRenderToken += 1;
    var body = $("trades-panel-body");
    var toggle = $("trades-toggle");
    var loading = $("trades-loading");
    var err = $("trades-error");
    var tbody = document.querySelector("#trades-table tbody");
    if (body) body.hidden = true;
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
    }
    setText("trades-toggle-label", "Show Trade History");
    setText("trades-toggle-hint", "Closed deals load when expanded");
    if (loading) loading.hidden = true;
    if (err) {
      err.hidden = true;
      err.textContent = "";
    }
    if (tbody) tbody.innerHTML = "";
    setText("trades-sub", "Closed deals (direction = out)");
  }

  function tradesCacheKey(data) {
    return dataKey() + "|" + monthFilter + "|" + (data && data.trades ? data.trades.totalClosed : 0);
  }

  function setTradesExpanded(open) {
    tradesExpanded = !!open;
    var body = $("trades-panel-body");
    var toggle = $("trades-toggle");
    if (body) body.hidden = !tradesExpanded;
    if (toggle) toggle.setAttribute("aria-expanded", tradesExpanded ? "true" : "false");
    setText(
      "trades-toggle-label",
      tradesExpanded ? "Hide Trade History" : "Show Trade History"
    );
    setText(
      "trades-toggle-hint",
      tradesExpanded
        ? "Charts and KPIs stay available above"
        : "Closed deals load when expanded"
    );
  }

  function ensureTradesRendered(data) {
    if (!data) return;
    var key = tradesCacheKey(data);
    if (tradesRenderedKey === key) return;
    var loading = $("trades-loading");
    var err = $("trades-error");
    var token = ++tradesRenderToken;
    if (err) {
      err.hidden = true;
      err.textContent = "";
    }
    if (loading) loading.hidden = false;
    // Defer heavy DOM work until after paint (data already in memory).
    window.setTimeout(function () {
      if (token !== tradesRenderToken) return;
      try {
        renderTrades(data);
        tradesRenderedKey = key;
      } catch (e) {
        console.error(e);
        if (err) {
          err.hidden = false;
          err.textContent = "Could not render trade history. Try collapsing and expanding again.";
        }
      }
      if (loading) loading.hidden = true;
    }, 0);
  }

  function parseParams() {
    var params = new URLSearchParams(window.location.search);
    var rawProduct = (params.get("product") || "").toLowerCase().trim();
    var rawType = (params.get("type") || "").toLowerCase().trim();

    if (!rawProduct && !rawType) {
      hasValidProduct = true;
      product = "hf";
      type = "backtest";
      return;
    }

    if (PRODUCTS[rawProduct]) {
      hasValidProduct = true;
      product = rawProduct;
    } else if (rawProduct) {
      hasValidProduct = false;
      product = "";
    } else {
      hasValidProduct = true;
      product = "hf";
    }

    if (VALID_TYPES[rawType]) type = rawType;
    else type = "backtest";
  }

  function dataKey() {
    return product + "-" + type;
  }

  /** Site root URL (trailing slash), derived from this script so /Aivor/ subpaths work. */
  function assetBase() {
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].getAttribute("src") || "";
      if (!/(^|\/)performance\.js(\?|$)/.test(src)) continue;
      try {
        return new URL(src, window.location.href).href.replace(
          /js\/performance\.js(\?.*)?$/,
          ""
        );
      } catch (e) {
        /* fall through */
      }
    }
    try {
      return new URL(".", window.location.href).href;
    } catch (e2) {
      return "";
    }
  }

  function dataUrl() {
    return assetBase() + "data/" + dataKey() + ".json";
  }

  function dataScriptUrl() {
    return assetBase() + "js/performance-data/" + dataKey() + ".js";
  }

  function fmtNum(n, digits) {
    if (n == null || !isFinite(n)) return "—";
    var d = digits == null ? 2 : digits;
    return Number(n).toLocaleString("en-US", {
      minimumFractionDigits: d,
      maximumFractionDigits: d
    });
  }

  function fmtSigned(n, digits) {
    if (n == null || !isFinite(n)) return "—";
    var abs = fmtNum(Math.abs(n), digits);
    if (n > 0) return "+" + abs;
    if (n < 0) return "-" + abs;
    return abs;
  }

  function fmtPct(n, digits) {
    if (n == null || !isFinite(n)) return "—";
    var d = digits == null ? 2 : digits;
    var body =
      Math.abs(n).toLocaleString("en-US", {
        minimumFractionDigits: d,
        maximumFractionDigits: d
      }) + "%";
    if (n > 0) return "+" + body;
    if (n < 0) return "-" + body;
    return body;
  }

  function currencySuffix(data) {
    if (data && data.currency) return " " + data.currency;
    return "";
  }

  function toneClass(n) {
    if (n == null || !isFinite(n) || n === 0) return "";
    return n > 0 ? "is-pos" : "is-neg";
  }

  function loadViaScript(key) {
    return new Promise(function (resolve, reject) {
      if (window.AIVOR_PERF_DATA && window.AIVOR_PERF_DATA[key]) {
        resolve(window.AIVOR_PERF_DATA[key]);
        return;
      }
      var existing = document.querySelector(
        'script[data-aivor-perf="' + key + '"]'
      );
      if (existing) {
        existing.addEventListener("load", function () {
          if (window.AIVOR_PERF_DATA && window.AIVOR_PERF_DATA[key]) {
            resolve(window.AIVOR_PERF_DATA[key]);
          } else {
            reject(new Error("Dataset missing after script load: " + key));
          }
        });
        existing.addEventListener("error", function () {
          reject(new Error("Failed to load " + key + " script"));
        });
        return;
      }
      var s = document.createElement("script");
      s.src = dataScriptUrl();
      s.async = true;
      s.setAttribute("data-aivor-perf", key);
      s.onload = function () {
        if (window.AIVOR_PERF_DATA && window.AIVOR_PERF_DATA[key]) {
          resolve(window.AIVOR_PERF_DATA[key]);
        } else {
          reject(new Error("Dataset missing after script load: " + key));
        }
      };
      s.onerror = function () {
        reject(new Error("Failed to load " + key + " script"));
      };
      document.head.appendChild(s);
    });
  }

  function loadReport() {
    var key = dataKey();
    if (cache[key]) return Promise.resolve(cache[key]);
    if (window.AIVOR_PERF_DATA && window.AIVOR_PERF_DATA[key]) {
      cache[key] = window.AIVOR_PERF_DATA[key];
      return Promise.resolve(cache[key]);
    }

    // fetch() is blocked on file://; use generated JS bundles there.
    // On http(s) prefer JSON, fall back to the same JS bundle.
    var useFetch =
      window.location.protocol === "http:" ||
      window.location.protocol === "https:";

    var loader = useFetch
      ? fetch(dataUrl(), { cache: "no-cache" })
          .then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
          })
          .catch(function () {
            return loadViaScript(key);
          })
      : loadViaScript(key);

    return loader.then(function (json) {
      cache[key] = json;
      return json;
    });
  }

  function filteredMonths(data) {
    var months = (data && data.monthly) || [];
    if (monthFilter === "all") return months;
    return months.filter(function (m) {
      return m.key === monthFilter;
    });
  }

  function filteredEquity(data) {
    var pts = (data.charts && data.charts.equityBalance) || [];
    if (monthFilter === "all") return pts;
    return pts.filter(function (p) {
      return String(p.t).slice(0, 7) === monthFilter;
    });
  }

  function filteredDd(data) {
    var pts = (data.charts && data.charts.drawdown) || [];
    if (monthFilter === "all") return pts;
    return pts.filter(function (p) {
      return String(p.t).slice(0, 7) === monthFilter;
    });
  }

  function filteredTrades(data) {
    var rows = (data.trades && data.trades.rows) || [];
    if (monthFilter === "all") return rows;
    return rows.filter(function (t) {
      return t.date && t.date.slice(0, 7) === monthFilter;
    });
  }

  function renderSummary(data) {
    var grid = $("summary-grid");
    if (!grid) return;
    var s = data.summary || {};
    var cur = currencySuffix(data);
    var months = filteredMonths(data);
    var scoped = monthFilter !== "all" && months.length === 1 ? months[0] : null;
    var net = scoped ? scoped.netProfit : s.netProfit;
    var ret = scoped ? scoped.returnPct : s.returnPct;
    var ddAmt = scoped ? scoped.maxDrawdownAmount : s.maxDrawdownAmount;
    var ddPct = scoped ? scoped.maxDrawdownPct : s.maxDrawdownPct;
    var periodValue = scoped
      ? scoped.label
      : (data.period && data.period.label) || "—";
    var cards = [
      {
        label: "Net Profit",
        value: fmtSigned(net) + cur,
        note: scoped
          ? "Selected month trading P/L"
          : "Trading P/L (excl. deposits/withdrawals)",
        tone: toneClass(net)
      },
      {
        label: "Return",
        value: fmtPct(ret),
        note: scoped
          ? "vs month starting equity " + fmtNum(scoped.startingEquity) + cur
          : "vs initial balance " + fmtNum(s.initialBalance) + cur,
        tone: toneClass(ret)
      },
      {
        label: "Maximum Drawdown",
        value: fmtNum(ddAmt) + cur + " · " + fmtPct(ddPct),
        note: scoped
          ? "Intra-month peak-to-trough (end-of-day balance)"
          : (s.maxDrawdownBasis === "equity" ? "Equity" : "Balance") +
            " basis from report",
        tone: "is-neg"
      },
      {
        label: "Trading Period",
        value: periodValue,
        note: data.currency
          ? "Currency " + data.currency
          : data.currencyNote
            ? "Currency field: " + data.currencyNote
            : "Currency not stated as ISO code"
      }
    ];
    grid.innerHTML = cards
      .map(function (c) {
        return (
          '<div class="perf-summary-card">' +
          '<div class="perf-summary-label">' +
          c.label +
          "</div>" +
          '<div class="perf-summary-value ' +
          (c.tone || "") +
          '">' +
          c.value +
          "</div>" +
          '<div class="perf-summary-note">' +
          c.note +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderDetails(data) {
    var list = $("detail-list");
    if (!list) return;
    var m = data.meta || {};
    var s = data.summary || {};
    var rows = [
      ["Product", productLabel(product)],
      ["Report type", type === "live" ? "Live Results" : "Backtest Results"],
      ["Platform", "MetaTrader 5"],
      ["Account", m.account || "—"],
      ["Symbol", m.symbol || "XAUUSD"],
      ["Expert", m.expert || "—"],
      ["Company", m.company || "—"],
      ["Initial balance", fmtNum(s.initialBalance) + currencySuffix(data)],
      ["Final balance", fmtNum(s.finalBalance) + currencySuffix(data)],
      ["Source file", data.sourceFile || "—"]
    ];
    list.innerHTML = rows
      .map(function (r) {
        return (
          '<div class="perf-detail"><span>' +
          r[0] +
          "</span><span>" +
          r[1] +
          "</span></div>"
        );
      })
      .join("");
  }

  function renderMetricsTable(data) {
    var tbody = document.querySelector("#metrics-table tbody");
    if (!tbody) return;
    var s = data.summary || {};
    var cur = currencySuffix(data);
    var rows = [
      ["Gross profit", fmtNum(s.grossProfit) + cur],
      ["Gross loss", fmtNum(s.grossLoss) + cur],
      ["Profit factor", s.profitFactor != null ? fmtNum(s.profitFactor) : "—"],
      ["Recovery factor", s.recoveryFactor != null ? fmtNum(s.recoveryFactor) : "—"],
      ["Total trades", s.totalTrades != null ? fmtNum(s.totalTrades, 0) : "—"],
      ["Winning trades", s.winningTrades != null ? fmtNum(s.winningTrades, 0) : "—"],
      ["Losing trades", s.losingTrades != null ? fmtNum(s.losingTrades, 0) : "—"],
      ["Win rate", fmtPct(s.winRatePct)],
      ["Average win", fmtNum(s.avgWin) + cur],
      ["Average loss", fmtNum(s.avgLoss) + cur],
      ["Deposited", fmtNum(s.deposited) + cur],
      ["Withdrawn", fmtNum(s.withdrawn) + cur]
    ];
    tbody.innerHTML = rows
      .map(function (r) {
        return "<tr><td>" + r[0] + "</td><td>" + r[1] + "</td></tr>";
      })
      .join("");
  }

  function renderMonthSelect(data) {
    var sel = $("filter-month");
    if (!sel) return;
    var months = data.monthly || [];
    var html = '<option value="all">All months</option>';
    months.forEach(function (m) {
      html +=
        '<option value="' +
        m.key +
        '"' +
        (monthFilter === m.key ? " selected" : "") +
        ">" +
        m.label +
        "</option>";
    });
    sel.innerHTML = html;
    sel.value = monthFilter;
  }

  function renderMonthlyTable(data) {
    var tbody = document.querySelector("#monthly-table tbody");
    if (!tbody) return;
    var months = filteredMonths(data);
    var cur = currencySuffix(data);
    if (!months.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="perf-empty-cell">No months in this filter.</td></tr>';
      return;
    }
    tbody.innerHTML = months
      .map(function (m) {
        return (
          "<tr>" +
          "<td>" +
          m.label +
          "</td>" +
          '<td class="' +
          toneClass(m.netProfit) +
          '">' +
          fmtSigned(m.netProfit) +
          cur +
          "</td>" +
          '<td class="' +
          toneClass(m.returnPct) +
          '">' +
          fmtPct(m.returnPct) +
          "</td>" +
          '<td class="is-neg">' +
          fmtNum(m.maxDrawdownAmount) +
          cur +
          "</td>" +
          '<td class="is-neg">' +
          fmtPct(m.maxDrawdownPct) +
          "</td>" +
          "<td>" +
          fmtNum(m.trades, 0) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function renderTrades(data) {
    var tbody = document.querySelector("#trades-table tbody");
    var sub = $("trades-sub");
    if (!tbody) return;
    var rows = filteredTrades(data);
    var total = data.trades ? data.trades.totalClosed : 0;
    var note = data.trades ? data.trades.note : "";
    if (sub) {
      sub.textContent =
        (data.trades && data.trades.truncated
          ? "Showing " + rows.length + " of " + total + " closed deals (filtered). "
          : rows.length + " closed deals. ") + (note || "");
    }
    if (!rows.length) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="perf-empty-cell">No closed trades in this filter.</td></tr>';
      return;
    }
    // Show latest 200 in the filtered set for DOM size
    var view = rows.length > 200 ? rows.slice(rows.length - 200) : rows;
    var cur = currencySuffix(data);
    tbody.innerHTML = view
      .map(function (t) {
        return (
          "<tr>" +
          "<td>" +
          (t.time || "—") +
          "</td>" +
          "<td>" +
          (t.symbol || "—") +
          "</td>" +
          "<td>" +
          (t.type || "—") +
          "</td>" +
          "<td>" +
          (t.volume != null ? fmtNum(t.volume, 2) : "—") +
          "</td>" +
          "<td>" +
          (t.price != null ? fmtNum(t.price, 2) : "—") +
          "</td>" +
          '<td class="' +
          toneClass(t.profit) +
          '">' +
          fmtSigned(t.profit) +
          cur +
          "</td>" +
          "<td>" +
          fmtNum(t.balance) +
          cur +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function chartSeries(data) {
    if (chartMode === "monthlyPl") {
      return {
        title: "Monthly net P/L",
        sub: "One bar per calendar month — real monthly aggregates",
        points: filteredMonths(data).map(function (m) {
          return { t: m.key, label: m.label, y: m.netProfit };
        }),
        kind: "bar"
      };
    }
    if (chartMode === "monthlyRet") {
      return {
        title: "Monthly return %",
        sub: "Month net P/L ÷ month starting equity",
        points: filteredMonths(data).map(function (m) {
          return { t: m.key, label: m.label, y: m.returnPct };
        }),
        kind: "bar"
      };
    }
    if (chartMode === "dd") {
      return {
        title: "Drawdown (balance)",
        sub: "Peak-to-trough from end-of-day balance series",
        points: filteredDd(data).map(function (p) {
          return { t: p.t, label: p.t, y: p.drawdownAmount };
        }),
        kind: "line"
      };
    }
    return {
      title: "Balance",
      sub: "Daily end-of-day balance from Deals (not fabricated)",
      points: filteredEquity(data).map(function (p) {
        return { t: p.t, label: p.t, y: p.balance };
      }),
      kind: "line"
    };
  }

  function renderChart(data) {
    var svg = $("perf-chart");
    if (!svg) return;
    var series = chartSeries(data);
    setText("chart-title", series.title);
    setText("chart-sub", series.sub);
    var pts = series.points || [];
    setText(
      "chart-caption",
      pts.length
        ? pts.length + " real points · filter: " + (monthFilter === "all" ? "all months" : monthFilter)
        : "No points for this filter."
    );

    var W = 720;
    var H = 260;
    var pad = { l: 54, r: 16, t: 16, b: 36 };
    var iw = W - pad.l - pad.r;
    var ih = H - pad.t - pad.b;

    if (!pts.length) {
      svg.innerHTML =
        '<rect x="0" y="0" width="' +
        W +
        '" height="' +
        H +
        '" fill="transparent"/>' +
        '<text x="' +
        W / 2 +
        '" y="' +
        H / 2 +
        '" text-anchor="middle" fill="#8b9aab" font-size="13">No chart points</text>';
      return;
    }

    var ys = pts.map(function (p) {
      return Number(p.y) || 0;
    });
    var minY = Math.min.apply(null, ys);
    var maxY = Math.max.apply(null, ys);
    if (minY === maxY) {
      minY -= 1;
      maxY += 1;
    }
    if (series.kind === "bar" || chartMode === "dd") {
      if (minY > 0) minY = 0;
      if (maxY < 0) maxY = 0;
    }

    function xAt(i) {
      if (pts.length === 1) return pad.l + iw / 2;
      return pad.l + (i / (pts.length - 1)) * iw;
    }
    function yAt(v) {
      return pad.t + ((maxY - v) / (maxY - minY)) * ih;
    }

    var parts = [];
    parts.push(
      '<rect class="perf-chart-bg" x="0" y="0" width="' + W + '" height="' + H + '" rx="10"/>'
    );

    // grid
    for (var g = 0; g < 5; g++) {
      var gy = pad.t + (ih * g) / 4;
      var gv = maxY - ((maxY - minY) * g) / 4;
      parts.push(
        '<line x1="' +
          pad.l +
          '" y1="' +
          gy +
          '" x2="' +
          (W - pad.r) +
          '" y2="' +
          gy +
          '" class="perf-chart-grid"/>'
      );
      parts.push(
        '<text x="' +
          (pad.l - 8) +
          '" y="' +
          (gy + 4) +
          '" text-anchor="end" class="perf-chart-axis">' +
          fmtNum(gv, Math.abs(gv) >= 100 ? 0 : 2) +
          "</text>"
      );
    }

    if (series.kind === "bar") {
      var bw = Math.max(2, (iw / pts.length) * 0.7);
      pts.forEach(function (p, i) {
        var cx = pts.length === 1 ? pad.l + iw / 2 : pad.l + ((i + 0.5) / pts.length) * iw;
        var y0 = yAt(0);
        var y1 = yAt(p.y);
        var top = Math.min(y0, y1);
        var h = Math.max(1, Math.abs(y1 - y0));
        var cls = p.y >= 0 ? "perf-bar pos" : "perf-bar neg";
        parts.push(
          '<rect class="' +
            cls +
            '" x="' +
            (cx - bw / 2) +
            '" y="' +
            top +
            '" width="' +
            bw +
            '" height="' +
            h +
            '" rx="2"/>'
        );
      });
    } else {
      var d = "";
      pts.forEach(function (p, i) {
        d += (i ? " L " : "M ") + xAt(i) + " " + yAt(p.y);
      });
      parts.push('<path class="perf-line" d="' + d + '" fill="none"/>');
      if (pts.length <= 120) {
        pts.forEach(function (p, i) {
          parts.push(
            '<circle class="perf-dot" cx="' + xAt(i) + '" cy="' + yAt(p.y) + '" r="2.2"/>'
          );
        });
      }
    }

    // x labels: first / mid / last
    var labelIdx = [0, Math.floor((pts.length - 1) / 2), pts.length - 1];
    var seen = {};
    labelIdx.forEach(function (i) {
      if (seen[i] || !pts[i]) return;
      seen[i] = true;
      parts.push(
        '<text x="' +
          xAt(i) +
          '" y="' +
          (H - 12) +
          '" text-anchor="middle" class="perf-chart-axis">' +
          String(pts[i].label).slice(0, 12) +
          "</text>"
      );
    });

    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML = parts.join("");
  }

  function showUnavailable(reason) {
    var report = $("perf-report");
    var empty = $("perf-empty");
    if (report) report.hidden = true;
    if (empty) empty.hidden = false;
    setText("empty-title", reason || "Report not available yet");
    setText(
      "empty-body",
      product === "scalper" || product === "swing"
        ? PRODUCTS[product].label +
            " live performance data is not available yet. Backtest results are available from the Backtest Results tab."
        : "This report has not been supplied. No metrics are fabricated."
    );
    setStatus("UNAVAILABLE", false);
    resetTradesPanel();
  }

  function showInvalidProduct() {
    var report = $("perf-report");
    var empty = $("perf-empty");
    if (report) report.hidden = true;
    if (empty) empty.hidden = false;
    document.title = "Performance · Select a product · AIVOR by Vyuha Labs";
    setText("page-title", "Select a product");
    setText("crumb-product", "—");
    setText("perf-intro", "Choose HF, Scalper, or Swing to view a verified report.");
    setText("empty-title", "Select a product");
    setText(
      "empty-body",
      "Valid products are HF, Scalper, and Swing. Use the tabs above, or open a link from the Products page."
    );
    setStatus("PRODUCT NOT SELECTED", false);
    resetTradesPanel();
    syncTabs();
  }

  function syncTabs() {
    document.querySelectorAll("[data-product]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-product") === product);
    });
    document.querySelectorAll("[data-type]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-type") === type);
    });
    document.querySelectorAll("[data-chart]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-chart") === chartMode);
    });
  }

  function renderAvailable(data) {
    var report = $("perf-report");
    var empty = $("perf-empty");
    if (report) report.hidden = false;
    if (empty) empty.hidden = true;

    var label = productLabel(product);
    var tLabel = type === "live" ? "Live Results" : "Backtest Results";
    document.title = label + " " + tLabel + " · AIVOR by Vyuha Labs";
    setText("page-title", label + " " + (type === "live" ? "Live Performance" : "Backtest Performance"));
    setText("crumb-product", label);
    setText(
      "perf-intro",
      "Verified " +
        tLabel.toLowerCase() +
        " from MetaTrader Excel export. Live and backtest are never mixed."
    );
    setStatus("VERIFIED REPORT", false);
    setText(
      "filter-note",
      (data.charts && data.charts.aggregation) ||
        "Charts use chronological points from the Deals section."
    );

    renderMonthSelect(data);
    renderSummary(data);
    renderDetails(data);
    renderMetricsTable(data);
    renderMonthlyTable(data);
    renderChart(data);
    // Trade history stays collapsed; expensive table paint deferred until expand.
    if (tradesExpanded) {
      ensureTradesRendered(data);
    } else {
      setText("trades-sub", "Expand to load closed deals for this report.");
    }
    syncTabs();
  }

  function render() {
    syncTabs();

    if (!hasValidProduct) {
      showInvalidProduct();
      return;
    }

    var label = productLabel(product);
    setText("crumb-product", label);
    setText("page-title", label + " Performance");
    setStatus("LOADING", true);

    var avail = AVAILABILITY[product];
    if (!avail || !avail[type]) {
      showUnavailable(
        type === "live"
          ? "Live performance data not available yet"
          : "Report not available yet"
      );
      syncTabs();
      return;
    }

    loadReport()
      .then(function (data) {
        reportData = data;
        if (!data || data.available === false) {
          showUnavailable(data && data.unavailableReason);
          syncTabs();
          return;
        }
        // Reset month filter when switching reports if key missing
        if (monthFilter !== "all") {
          var ok = (data.monthly || []).some(function (m) {
            return m.key === monthFilter;
          });
          if (!ok) monthFilter = "all";
        }
        renderAvailable(data);
      })
      .catch(function (err) {
        console.error(err);
        showUnavailable("Report not available yet");
        syncTabs();
      });
  }

  function navigate(nextProduct, nextType) {
    if (nextProduct && PRODUCTS[nextProduct]) {
      product = nextProduct;
      hasValidProduct = true;
    }
    if (nextType && VALID_TYPES[nextType]) type = nextType;
    if (!hasValidProduct) {
      product = "hf";
      hasValidProduct = true;
    }
    monthFilter = "all";
    resetTradesPanel();
    var url = new URL(window.location.href);
    url.searchParams.set("product", product);
    url.searchParams.set("type", type);
    window.history.pushState({}, "", url);
    render();
  }

  function bind() {
    document.querySelectorAll("[data-product]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        navigate(btn.getAttribute("data-product"), type || "backtest");
      });
    });
    document.querySelectorAll("[data-type]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        navigate(product || "hf", btn.getAttribute("data-type"));
      });
    });
    document.querySelectorAll("[data-chart]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        chartMode = btn.getAttribute("data-chart") || "balance";
        syncTabs();
        if (reportData && reportData.available) renderChart(reportData);
      });
    });
    var monthSel = $("filter-month");
    if (monthSel) {
      monthSel.addEventListener("change", function () {
        monthFilter = monthSel.value || "all";
        tradesRenderedKey = "";
        if (reportData && reportData.available) {
          renderSummary(reportData);
          renderMonthlyTable(reportData);
          renderChart(reportData);
          if (tradesExpanded) {
            ensureTradesRendered(reportData);
          }
        }
      });
    }
    var tradesToggle = $("trades-toggle");
    if (tradesToggle) {
      tradesToggle.addEventListener("click", function () {
        if (!reportData || !reportData.available) return;
        if (tradesExpanded) {
          setTradesExpanded(false);
          return;
        }
        setTradesExpanded(true);
        ensureTradesRendered(reportData);
      });
    }
    window.addEventListener("popstate", function () {
      parseParams();
      monthFilter = "all";
      resetTradesPanel();
      render();
    });
  }

  // Prefer availability from generated manifest when present
  if (window.AIVOR_PERF_MANIFEST && window.AIVOR_PERF_MANIFEST.availability) {
    var av = window.AIVOR_PERF_MANIFEST.availability;
    Object.keys(av).forEach(function (p) {
      if (AVAILABILITY[p]) AVAILABILITY[p] = av[p];
    });
  }

  parseParams();
  bind();
  render();
})();
