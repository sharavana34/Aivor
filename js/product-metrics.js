/**
 * Product-card metrics for HF / Scalper / Swing.
 * Prefers owner-supplied display values (source: "owner-supplied").
 * Does not invent figures or pretend to fetch live MyFXBook data.
 * Optional monthly-series mean path remains for a future verified HF window only.
 */
(function () {
  "use strict";

  var REQUIRED_MONTHS = 12;
  var VERIFY_NOTE =
    "Owner-supplied; currency/calculation pending verification.";

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function monthKey(year, month) {
    return year + "-" + pad2(month);
  }

  function parseAsOf(raw) {
    if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      var p = raw.split("-").map(Number);
      return new Date(p[0], p[1] - 1, p[2]);
    }
    return new Date();
  }

  function lastCompleteMonthKeys(asOfDate) {
    var y = asOfDate.getFullYear();
    var m = asOfDate.getMonth() + 1;
    var keys = [];
    var cy = y;
    var cm = m - 1;
    if (cm < 1) {
      cm = 12;
      cy -= 1;
    }
    for (var i = 0; i < REQUIRED_MONTHS; i++) {
      keys.unshift(monthKey(cy, cm));
      cm -= 1;
      if (cm < 1) {
        cm = 12;
        cy -= 1;
      }
    }
    return keys;
  }

  function indexMonths(months) {
    var map = Object.create(null);
    if (!Array.isArray(months)) return map;
    for (var i = 0; i < months.length; i++) {
      var row = months[i];
      if (!row || typeof row.year !== "number" || typeof row.month !== "number") continue;
      map[monthKey(row.year, row.month)] = row;
    }
    return map;
  }

  function mean(nums) {
    if (!nums.length) return null;
    var sum = 0;
    for (var i = 0; i < nums.length; i++) sum += nums[i];
    return sum / nums.length;
  }

  function formatPlainNumber(amount) {
    if (amount == null || !isFinite(amount)) return null;
    return Math.abs(amount).toLocaleString(undefined, {
      maximumFractionDigits: 0
    });
  }

  function formatPctPlain(pct, opts) {
    if (pct == null || !isFinite(pct)) return null;
    var body =
      Math.abs(pct).toLocaleString(undefined, {
        maximumFractionDigits: 0
      }) + "%";
    if (opts && opts.signed && pct > 0) return "+" + body;
    if (opts && opts.signed && pct < 0) return "-" + body;
    return body;
  }

  function emptyResult(extra) {
    return Object.assign(
      {
        available: false,
        reason: "no-data",
        mode: null,
        periodLabel: "Last 12 months",
        avgProfit: null,
        avgReturnPct: null,
        avgDrawdownAmount: null,
        avgDrawdownPct: null,
        currency: null,
        drawdownBasis: null,
        source: null,
        verificationNote: VERIFY_NOTE,
        startingCapital: null,
        metricLabels: null
      },
      extra || {}
    );
  }

  function resolveStartingCapital(raw) {
    if (!raw || !Array.isArray(raw.options) || !raw.options.length) return null;
    var options = [];
    for (var i = 0; i < raw.options.length; i++) {
      var opt = raw.options[i];
      if (!opt || typeof opt.display !== "string" || !opt.display) continue;
      options.push({
        accountKind: opt.accountKind === "cent" || opt.accountKind === "standard" ? opt.accountKind : null,
        label: typeof opt.label === "string" ? opt.label : "",
        display: opt.display
      });
    }
    if (!options.length) return null;
    return {
      kind: raw.kind === "owner-recommendation" ? "owner-recommendation" : raw.kind || null,
      lotSize: typeof raw.lotSize === "number" ? raw.lotSize : null,
      options: options,
      note: typeof raw.note === "string" ? raw.note : ""
    };
  }

  function resolveMetricLabels(data) {
    /* Unified card labels — amount/pct share one row label each. */
    var defaults = {
      profit: "Avg. Monthly Profit",
      returnPct: "Avg. Monthly Profit",
      drawdown: "Avg. Monthly Max Equity DD",
      drawdownPct: "Avg. Monthly Max Equity DD"
    };
    var labels = data && data.metricLabels;
    if (!labels || typeof labels !== "object") return defaults;
    return {
      profit: typeof labels.profit === "string" ? labels.profit : defaults.profit,
      returnPct: typeof labels.returnPct === "string" ? labels.returnPct : defaults.returnPct,
      drawdown: typeof labels.drawdown === "string" ? labels.drawdown : defaults.drawdown,
      drawdownPct: typeof labels.drawdownPct === "string" ? labels.drawdownPct : defaults.drawdownPct
    };
  }

  /** Prefer supplied display averages (Excel-backed or owner) — do not invent. */
  function fromSupplied(data) {
    var s = data && data.supplied;
    if (!s || typeof s !== "object") return null;
    if (data.source !== "owner-supplied" && data.source !== "excel-report") return null;

    var hasAny =
      typeof s.avgMonthlyNetProfit === "number" ||
      typeof s.avgMonthlyReturnPct === "number" ||
      typeof s.avgMonthlyMaxEquityDd === "number" ||
      typeof s.avgMonthlyMaxEquityDdPct === "number";
    if (!hasAny) return null;

    return {
      available: true,
      reason: data.source === "excel-report" ? "excel-report" : "owner-supplied",
      mode: data.source === "excel-report" ? "excel-report" : "owner-supplied",
      periodLabel: typeof data.periodLabel === "string" ? data.periodLabel : "Last 12 months",
      avgProfit: typeof s.avgMonthlyNetProfit === "number" ? s.avgMonthlyNetProfit : null,
      avgReturnPct: typeof s.avgMonthlyReturnPct === "number" ? s.avgMonthlyReturnPct : null,
      avgDrawdownAmount: typeof s.avgMonthlyMaxEquityDd === "number" ? s.avgMonthlyMaxEquityDd : null,
      avgDrawdownPct: typeof s.avgMonthlyMaxEquityDdPct === "number" ? s.avgMonthlyMaxEquityDdPct : null,
      currency: data.currency || null,
      drawdownBasis: data.drawdownBasis === "equity" ? "equity" : data.drawdownBasis || null,
      source: data.source,
      verificationNote:
        typeof data.verificationNote === "string" && data.verificationNote
          ? data.verificationNote
          : VERIFY_NOTE,
      startingCapital: resolveStartingCapital(data.startingCapital),
      metricLabels: resolveMetricLabels(data)
    };
  }

  /**
   * Legacy path: mean of a full verified 12-month window (HF only).
   * Unused while months[] is empty / incomplete.
   */
  function computeFromMonths(data) {
    if (!data || data.productId !== "hf") {
      return emptyResult({ reason: "missing-dataset" });
    }

    var startingCapital = resolveStartingCapital(data.startingCapital);
    var keys = lastCompleteMonthKeys(parseAsOf(data.asOf));
    var byKey = indexMonths(data.months);
    var profits = [];
    var returns = [];
    var ddPcts = [];
    var ddAmts = [];
    var allHaveReturn = true;
    var allHaveDdAmt = true;
    var capitalBase =
      typeof data.capitalBase === "number" && isFinite(data.capitalBase) && data.capitalBase > 0
        ? data.capitalBase
        : null;

    for (var i = 0; i < keys.length; i++) {
      var row = byKey[keys[i]];
      if (!row) {
        return emptyResult({
          reason: "incomplete-window",
          windowKeys: keys,
          currency: data.currency || null,
          drawdownBasis: data.drawdownBasis,
          source: data.source,
          startingCapital: startingCapital,
          metricLabels: resolveMetricLabels(data)
        });
      }
      if (typeof row.profit !== "number" || !isFinite(row.profit)) {
        return emptyResult({
          reason: "invalid-profit",
          windowKeys: keys,
          currency: data.currency || null,
          source: data.source,
          startingCapital: startingCapital,
          metricLabels: resolveMetricLabels(data)
        });
      }
      if (typeof row.maxDrawdownPct !== "number" || !isFinite(row.maxDrawdownPct)) {
        return emptyResult({
          reason: "invalid-drawdown",
          windowKeys: keys,
          currency: data.currency || null,
          source: data.source,
          startingCapital: startingCapital,
          metricLabels: resolveMetricLabels(data)
        });
      }

      profits.push(row.profit);
      ddPcts.push(row.maxDrawdownPct);

      if (typeof row.returnPct === "number" && isFinite(row.returnPct)) {
        returns.push(row.returnPct);
      } else if (capitalBase) {
        returns.push((row.profit / capitalBase) * 100);
      } else {
        allHaveReturn = false;
      }

      if (typeof row.maxDrawdownAmount === "number" && isFinite(row.maxDrawdownAmount)) {
        ddAmts.push(row.maxDrawdownAmount);
      } else {
        allHaveDdAmt = false;
      }
    }

    return {
      available: true,
      reason: "ok",
      mode: "monthly-series",
      periodLabel: "Last 12 complete months",
      windowKeys: keys,
      avgProfit: mean(profits),
      avgReturnPct: allHaveReturn ? mean(returns) : null,
      avgDrawdownPct: mean(ddPcts),
      avgDrawdownAmount: allHaveDdAmt ? mean(ddAmts) : null,
      currency: data.currency || null,
      drawdownBasis: data.drawdownBasis,
      source: data.source,
      verificationNote: data.currency ? null : VERIFY_NOTE,
      startingCapital: startingCapital,
      metricLabels: resolveMetricLabels(data)
    };
  }

  function getProductData(productId) {
    var bag = window.AIVOR_PRODUCT_DATA;
    if (bag && productId && bag[productId]) return bag[productId];
    if (productId === "hf") return window.AIVOR_HF_MONTHLY || null;
    return null;
  }

  function computeProductMetrics(data) {
    if (!data) return emptyResult({ reason: "missing-dataset" });
    var supplied = fromSupplied(data);
    if (supplied) return supplied;
    if (data.productId === "hf") return computeFromMonths(data);
    return emptyResult({
      reason: "no-data",
      periodLabel: typeof data.periodLabel === "string" ? data.periodLabel : "Period not provided",
      startingCapital: resolveStartingCapital(data.startingCapital),
      metricLabels: resolveMetricLabels(data),
      verificationNote:
        typeof data.verificationNote === "string" && data.verificationNote
          ? data.verificationNote
          : VERIFY_NOTE
    });
  }

  function computeHfMetrics(data) {
    return computeProductMetrics(data || window.AIVOR_HF_MONTHLY);
  }

  function setText(el, text) {
    if (el) el.textContent = text;
  }

  function setTone(el, tone) {
    if (!el) return;
    el.classList.remove(
      "product-metric__value--profit",
      "product-metric__value--drawdown",
      "product-metric__value--muted",
      "product-metric__value--neutral"
    );
    if (tone) el.classList.add("product-metric__value--" + tone);
  }

  function renderCapital(card, capital) {
    if (!card) return;
    var block = card.querySelector("[data-metric-block='starting-capital']");
    if (!block) return;
    var list = block.querySelector("[data-metric='starting-capital-list']");
    var note = block.querySelector("[data-metric='starting-capital-note']");

    if (!capital || !capital.options || !capital.options.length) {
      block.hidden = true;
      return;
    }

    block.hidden = false;
    if (list) {
      list.textContent = "";
      for (var i = 0; i < capital.options.length; i++) {
        var opt = capital.options[i];
        var li = document.createElement("li");
        li.className = "product-capital__option";
        if (opt.accountKind) {
          li.setAttribute("data-account-kind", opt.accountKind);
        }

        var kind = document.createElement("span");
        kind.className = "product-capital__kind";
        kind.textContent = opt.label || (opt.accountKind === "cent" ? "Cent" : opt.accountKind === "standard" ? "Standard USD" : "Account");

        var display = document.createElement("span");
        display.className = "product-capital__display";
        display.textContent = opt.display;

        li.appendChild(kind);
        li.appendChild(display);
        list.appendChild(li);
      }
    }
    setText(note, capital.note || "");
  }

  function renderProductMetrics(root, metrics) {
    if (!root) return;

    var card = root.closest(".product-card") || root.parentElement;
    var periodEl = root.querySelector("[data-metric='period-label']");
    var profitLabel = root.querySelector("[data-metric='avg-profit-label']");
    var returnLabel = root.querySelector("[data-metric='avg-return-label']");
    var ddLabel = root.querySelector("[data-metric='avg-dd-label']");
    var ddPctLabel = root.querySelector("[data-metric='avg-dd-pct-label']");
    var profitValue = root.querySelector("[data-metric='avg-profit-value']");
    var returnValue = root.querySelector("[data-metric='avg-return-value']");
    var ddValue = root.querySelector("[data-metric='avg-dd-value']");
    var ddPctValue = root.querySelector("[data-metric='avg-dd-pct-value']");
    var verifyNote = root.querySelector("[data-metric='verify-note']");
    var labels = metrics.metricLabels || resolveMetricLabels(null);

    root.hidden = false;
    root.setAttribute("data-metrics-state", metrics.available ? "ready" : "unavailable");
    root.setAttribute("data-metrics-source", metrics.source || metrics.mode || "none");

    setText(periodEl, metrics.periodLabel || "Last 12 months");
    /* Prefer unified row labels so all three cards stay structurally identical. */
    setText(profitLabel, "Avg. Monthly Profit");
    setText(returnLabel, labels.returnPct);
    setText(ddLabel, "Avg. Monthly Max Equity DD");
    setText(ddPctLabel, labels.drawdownPct);

    if (!metrics.available) {
      setText(profitValue, "Data unavailable");
      setText(returnValue, "Data unavailable");
      setText(ddValue, "Data unavailable");
      setText(ddPctValue, "Data unavailable");
      setTone(profitValue, "muted");
      setTone(returnValue, "muted");
      setTone(ddValue, "muted");
      setTone(ddPctValue, "muted");
      setText(verifyNote, metrics.verificationNote || "");
      renderCapital(card, metrics.startingCapital);
      return;
    }

    /* No currency symbol when currency is unspecified; amount and % stay separate. */
    var profitText = formatPlainNumber(metrics.avgProfit);
    setText(profitValue, profitText || "Data unavailable");
    setTone(profitValue, profitText ? "profit" : "muted");

    var returnText = formatPctPlain(metrics.avgReturnPct, { signed: true });
    setText(returnValue, returnText || "Data unavailable");
    setTone(returnValue, returnText ? "profit" : "muted");

    var ddAmtText = formatPlainNumber(metrics.avgDrawdownAmount);
    setText(ddValue, ddAmtText || "Data unavailable");
    setTone(ddValue, ddAmtText ? "drawdown" : "muted");

    var ddPctText = formatPctPlain(metrics.avgDrawdownPct);
    setText(ddPctValue, ddPctText || "Data unavailable");
    setTone(ddPctValue, ddPctText ? "drawdown" : "muted");

    setText(verifyNote, metrics.verificationNote || "");

    renderCapital(card, metrics.startingCapital);
  }

  function init() {
    var roots = document.querySelectorAll(".product-metrics[data-product]");
    if (!roots.length) {
      var legacy = document.getElementById("hf-product-metrics");
      if (legacy) {
        renderProductMetrics(legacy, computeHfMetrics(getProductData("hf")));
      }
      return;
    }
    for (var i = 0; i < roots.length; i++) {
      var root = roots[i];
      var productId = root.getAttribute("data-product");
      renderProductMetrics(root, computeProductMetrics(getProductData(productId)));
    }
  }

  window.AIVOR_PRODUCT_METRICS = {
    computeHfMetrics: computeHfMetrics,
    computeProductMetrics: computeProductMetrics,
    getProductData: getProductData,
    lastCompleteMonthKeys: lastCompleteMonthKeys
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
