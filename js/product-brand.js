/**
 * Shared AIVOR product identity (not the site logo).
 * Names and availability only — no metrics invented here.
 */
(function () {
  "use strict";

  var PRODUCTS = {
    hf: {
      key: "hf",
      shortName: "HF",
      fullName: "AIVOR HF",
      availability: { live: true, backtest: true },
      statusLabel: "Live"
    },
    scalper: {
      key: "scalper",
      shortName: "Scalper",
      fullName: "AIVOR Scalper",
      availability: { live: false, backtest: true },
      statusLabel: "Ready for Purchase"
    },
    swing: {
      key: "swing",
      shortName: "Swing",
      fullName: "AIVOR Swing",
      availability: { live: false, backtest: true },
      statusLabel: "Ready for Purchase"
    }
  };

  function get(key) {
    return PRODUCTS[key] || null;
  }

  function typeLabel(type) {
    if (type === "live") return "Live Results";
    if (type === "backtest") return "Backtest Results";
    return "";
  }

  window.AIVOR_PRODUCTS = PRODUCTS;
  window.AIVOR_PRODUCT_BRAND = {
    get: get,
    typeLabel: typeLabel,
    list: Object.keys(PRODUCTS).map(function (k) {
      return PRODUCTS[k];
    })
  };
})();
