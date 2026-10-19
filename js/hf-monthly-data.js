/**
 * AIVOR product-card display data (HF / Scalper / Swing).
 *
 * Prefer Excel-backed card metrics from js/performance-data/card-metrics.js
 * (generated from MetaTrader reports). Fallback owner-supplied figures are
 * retained only if the generated bundle is missing.
 */
(function () {
  "use strict";

  var CAPITAL_NOTE_DUAL =
    "Cent and Standard are separate account types — not equivalent. Denomination pending.";

  var CAPITAL_NOTE_HF =
    "Recommendation only (not min deposit). Cent and Standard are separate — not equivalent.";

  var gen = window.AIVOR_CARD_METRICS || null;

  function fromGenerated(productId, fallback) {
    if (!gen || !gen[productId]) return fallback;
    var m = gen[productId];
    var currency = gen.currency && gen.currency[productId] ? gen.currency[productId] : null;
    var sourceKey = gen.sources && gen.sources[productId] ? gen.sources[productId] : null;
    return {
      productId: productId,
      source: "excel-report",
      sourceKey: sourceKey,
      sourceUrl: sourceKey ? "data/" + sourceKey + ".json" : null,
      currency: currency,
      capitalBase: null,
      profitIsNetAfterCosts: true,
      drawdownBasis: "balance",
      periodLabel: m.periodLabel || fallback.periodLabel,
      asOf: null,
      months: [],
      metricLabels: {
        profit: "Avg. Monthly Profit",
        returnPct: "Avg. Monthly Profit",
        drawdown: "Avg. Monthly Max Equity DD",
        drawdownPct: "Avg. Monthly Max Equity DD"
      },
      supplied: {
        avgMonthlyNetProfit: m.avgMonthlyNetProfit,
        avgMonthlyReturnPct: m.avgMonthlyReturnPct,
        avgMonthlyMaxEquityDd: m.avgMonthlyMaxEquityDd,
        avgMonthlyMaxEquityDdPct: m.avgMonthlyMaxEquityDdPct
      },
      startingCapital: fallback.startingCapital,
      verificationNote: currency
        ? "Excel-backed averages from " +
          (sourceKey || "report") +
          " (" +
          currency +
          "). " +
          (m.monthCount != null ? m.monthCount + " months. " : "") +
          "Monthly DD uses end-of-day balance peaks (floating equity unavailable in Deals)."
        : "Excel-backed averages from " +
          (sourceKey || "report") +
          ". Report currency field was not an ISO code; amounts shown in account units. " +
          (m.monthCount != null ? m.monthCount + " months. " : "") +
          "Monthly DD uses end-of-day balance peaks.",
      notes: "Shared with performance.html via data/" + (sourceKey || productId) + ".json"
    };
  }

  var hfFallback = {
    productId: "hf",
    source: "owner-supplied",
    currency: null,
    periodLabel: "Last 12 months",
    supplied: {
      avgMonthlyNetProfit: 4562,
      avgMonthlyReturnPct: 41,
      avgMonthlyMaxEquityDd: 2156,
      avgMonthlyMaxEquityDdPct: 21
    },
    startingCapital: {
      kind: "owner-recommendation",
      lotSize: 0.01,
      options: [
        { accountKind: "cent", display: "10,000 cents", label: "Cent" },
        { accountKind: "standard", display: "USD 1,000", label: "Standard USD" }
      ],
      note: CAPITAL_NOTE_HF
    },
    verificationNote: "Owner-supplied; currency/calculation pending verification."
  };

  var scalperFallback = {
    productId: "scalper",
    source: "owner-supplied",
    currency: null,
    periodLabel: "1 year",
    supplied: {
      avgMonthlyNetProfit: 40,
      avgMonthlyReturnPct: 40,
      avgMonthlyMaxEquityDd: 12,
      avgMonthlyMaxEquityDdPct: 12
    },
    startingCapital: {
      kind: "owner-recommendation",
      lotSize: null,
      options: [
        { accountKind: "cent", display: "100 cents", label: "Cent" },
        { accountKind: "standard", display: "USD 100", label: "Standard USD" }
      ],
      note: CAPITAL_NOTE_DUAL
    },
    verificationNote: "Owner-supplied; currency/calculation pending verification."
  };

  var swingFallback = {
    productId: "swing",
    source: "owner-supplied",
    currency: null,
    periodLabel: "Period not provided",
    supplied: {
      avgMonthlyNetProfit: 500,
      avgMonthlyReturnPct: 50,
      avgMonthlyMaxEquityDd: 300,
      avgMonthlyMaxEquityDdPct: 30
    },
    startingCapital: {
      kind: "owner-recommendation",
      lotSize: null,
      options: [
        { accountKind: "cent", display: "1,000 cents", label: "Cent" },
        { accountKind: "standard", display: "USD 1,000", label: "Standard USD" }
      ],
      note: CAPITAL_NOTE_DUAL
    },
    verificationNote: "Owner-supplied; period not provided — currency/calculation pending verification."
  };

  var hf = fromGenerated("hf", hfFallback);
  var scalper = fromGenerated("scalper", scalperFallback);
  var swing = fromGenerated("swing", swingFallback);

  window.AIVOR_PRODUCT_DATA = {
    hf: hf,
    scalper: scalper,
    swing: swing
  };

  window.AIVOR_HF_MONTHLY = hf;
})();
