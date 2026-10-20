/**
 * Homepage performance preview — real AIVOR_CARD_METRICS only.
 * Does not invent sparklines or reference-mock KPIs.
 */
(function () {
  "use strict";

  function fmtPct(n, signed) {
    if (n == null || !isFinite(n)) return "—";
    var abs = Math.abs(n).toLocaleString(undefined, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0
    });
    if (!signed) return abs + "%";
    return (n > 0 ? "+" : n < 0 ? "−" : "") + abs + "%";
  }

  function fmtMoney(n, currency) {
    if (n == null || !isFinite(n)) return "—";
    var body = Math.abs(n).toLocaleString(undefined, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0
    });
    var sign = n > 0 ? "+" : n < 0 ? "−" : "";
    var cur = currency ? " " + currency : "";
    return sign + body + cur;
  }

  function card(label, valueHtml, note, valueClass) {
    return (
      '<article class="home-perf-card">' +
      '<p class="home-perf-card__label">' +
      label +
      "</p>" +
      '<p class="home-perf-card__value' +
      (valueClass ? " " + valueClass : "") +
      '">' +
      valueHtml +
      "</p>" +
      (note ? '<p class="home-perf-card__note">' + note + "</p>" : "") +
      "</article>"
    );
  }

  function render() {
    var host = document.querySelector("[data-home-perf]");
    if (!host) return;

    var pack = window.AIVOR_CARD_METRICS;
    var hf = pack && pack.hf;
    if (!hf) {
      host.innerHTML =
        '<p class="home-perf-empty">Published HF card metrics are not loaded. Open <a href="performance.html?product=hf&amp;type=live">Performance</a> for the full report.</p>';
      return;
    }

    var currency = (pack.currency && pack.currency.hf) || "";
    var period = hf.periodLabel || "Published HF live window";
    var months = hf.monthCount != null ? hf.monthCount + " months" : null;
    var note = months ? period + " · " + months + " · avg monthly" : period + " · avg monthly";

    var ret = hf.avgMonthlyReturnPct;
    var profit = hf.avgMonthlyNetProfit;
    var ddAmt = hf.avgMonthlyMaxEquityDd;
    var ddPct = hf.avgMonthlyMaxEquityDdPct;

    host.innerHTML =
      card(
        "Avg monthly return",
        fmtPct(ret, true),
        note,
        ret != null && ret >= 0 ? "is-pos" : ret != null ? "is-neg" : ""
      ) +
      card(
        "Avg monthly net profit",
        fmtMoney(profit, currency),
        "HF live · source card metrics",
        profit != null && profit >= 0 ? "is-pos" : profit != null ? "is-neg" : ""
      ) +
      card(
        "Avg monthly max equity DD",
        fmtMoney(ddAmt, currency),
        "Amount · HF live",
        "is-neg"
      ) +
      card(
        "Avg monthly max equity DD %",
        fmtPct(ddPct, false),
        "Percent · HF live",
        "is-neg"
      );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
