/**
 * AIVOR Copy Trading directory — 12 setups (3 products × 4 brokers).
 * Commission and default copy URL come from AIVOR_COPY_TRADING_META /
 * AIVOR_CONFIG. Do not invent returns, DD, win rates, or broker URLs.
 */
(function () {
  /** Single configurable source for commission display (all 12 rows). */
  const META = {
    commissionPct: 5,
    commissionLabel: "5%",
    commissionNote:
      "Displayed provider commission for this directory sample. Not verified against each broker’s live terms — confirm on the destination before copying.",
    /**
     * Default copy destination (sample). All rows currently resolve here.
     * Per-broker overrides: set brokerCopyUrls[brokerId] when available.
     */
    defaultCopyUrlKey: "COPY_TRADING_URL",
    brokerCopyUrls: {
      vantage: null /* use default / COPY_TRADING_URL until broker-specific IDs exist */,
      "ic-markets": null,
      exness: null,
      octafx: null
    },
    urlDisclosure:
      "Copy Strategy currently opens the same configured destination for every row. Broker-specific URLs will be updated when available."
  };

  const PRODUCTS = {
    hf: {
      id: "hf",
      name: "AIVOR HF",
      short: "HF",
      monogram: "HF",
      tradingStyle: "High-frequency",
      instrument: "XAUUSD",
      icon: "hf"
    },
    scalper: {
      id: "scalper",
      name: "AIVOR Scalper",
      short: "Scalper",
      monogram: "SC",
      tradingStyle: "Scalping",
      instrument: "XAUUSD",
      icon: "scalper"
    },
    swing: {
      id: "swing",
      name: "AIVOR Swing",
      short: "Swing",
      monogram: "SW",
      tradingStyle: "Swing",
      instrument: "XAUUSD",
      icon: "swing"
    }
  };

  const BROKERS = {
    vantage: {
      id: "vantage",
      name: "Vantage",
      monogram: "V",
      tone: "vantage",
      logo: "assets/brokers/vantage.png"
    },
    "ic-markets": {
      id: "ic-markets",
      name: "IC Markets",
      monogram: "IC",
      tone: "ic",
      logo: "assets/brokers/ic-markets.png"
    },
    exness: {
      id: "exness",
      name: "Exness",
      monogram: "EX",
      tone: "exness",
      logo: "assets/brokers/exness.png"
    },
    octafx: {
      id: "octafx",
      name: "OctaFX",
      monogram: "OX",
      tone: "octafx",
      logo: "assets/brokers/octa.png"
    }
  };

  /**
   * Performance / status rules (no invented metrics):
   * - HF + Vantage: Live; performance = Live results available
   * - HF + other brokers: Pending; performance not available
   * - Scalper & Swing: Backtest status; Backtest only performance
   */
  function rowSpec(productKey, brokerKey) {
    const product = PRODUCTS[productKey];
    const broker = BROKERS[brokerKey];
    const isHfVantage = productKey === "hf" && brokerKey === "vantage";
    const isHf = productKey === "hf";
    const styleLine = `${product.tradingStyle} · ${product.instrument}`;

    let status;
    let performance;
    let risk;

    if (isHfVantage) {
      status = "Live";
      performance = { label: "Live results available", kind: "live" };
      risk = {
        label: "View risk details",
        kind: "live",
        href: "performance.html?product=hf&type=live"
      };
    } else if (isHf) {
      status = "Pending";
      performance = { label: "Not available", kind: "unavailable" };
      risk = {
        label: "View risk details",
        kind: "live",
        href: "performance.html?product=hf&type=live"
      };
    } else {
      status = "Backtest";
      performance = { label: "Backtest only", kind: "backtest" };
      risk = {
        label: "View backtest risk",
        kind: "backtest",
        href: `performance.html?product=${productKey}&type=backtest`
      };
    }

    return {
      id: `${brokerKey}-${productKey}`,
      productKey: product.id,
      brokerKey: broker.id,
      strategyId: isHfVantage ? "1067466" : null,
      strategyName: product.name,
      productName: product.name,
      productIcon: product.icon,
      productMonogram: product.monogram,
      productSubline: styleLine,
      broker: broker.name,
      brokerMonogram: broker.monogram,
      brokerTone: broker.tone,
      brokerLogo: broker.logo,
      tradingStyle: product.tradingStyle,
      instrument: product.instrument,
      performance: performance,
      riskDrawdown: risk,
      status: status,
      /* Resolve via META + config; brokerCopyUrls reserved for future per-broker URLs */
      externalCopyUrlKey: META.defaultCopyUrlKey,
      externalCopyUrl: null,
      brokerCopyUrlSlot: brokerKey,
      fees: {
        provider: META.commissionLabel,
        broker:
          "Broker spreads, swaps, and commissions are separate — verify with the broker.",
        note: META.commissionNote
      },
      performanceInsight: isHfVantage
        ? "Live copy setup on Vantage. No return or drawdown figures are published in this directory — review the live profile for provider-published metrics."
        : isHf
          ? "AIVOR HF live copy is configured on Vantage only. This broker row has no verified live copy metrics yet."
          : "Backtest-only product. No live copy metrics are published for this directory row.",
      details: {
        summary: isHfVantage
          ? "Copy trading of AIVOR HF on Vantage Markets. Your copy account mirrors the signal provider according to your allocation and the broker’s copy rules."
          : `Directory row for ${product.name} × ${broker.name}. Broker-specific copy destination pending configuration.`,
        howTo: isHfVantage
          ? [
              "Open or log in to a Vantage Markets account.",
              "Review the live copy-trading profile (fees, risk, account requirements).",
              "Fund only capital you can afford to risk.",
              "Choose allocation and start copying.",
              "Monitor on the broker; stop or resize if it no longer fits your risk."
            ]
          : [
              "Use this directory to compare product × broker setups.",
              "Broker-specific Copy Strategy links will appear when configured.",
              "Do not invent third-party links — only use URLs published here."
            ],
        notes: [
          META.urlDisclosure,
          "Past performance is not indicative of future results."
        ]
      }
    };
  }

  const ORDER = [
    ["hf", "vantage"],
    ["hf", "ic-markets"],
    ["hf", "exness"],
    ["hf", "octafx"],
    ["scalper", "vantage"],
    ["scalper", "ic-markets"],
    ["scalper", "exness"],
    ["scalper", "octafx"],
    ["swing", "vantage"],
    ["swing", "ic-markets"],
    ["swing", "exness"],
    ["swing", "octafx"]
  ];

  window.AIVOR_COPY_TRADING_META = META;
  window.AIVOR_COPY_TRADING_PRODUCTS = PRODUCTS;
  window.AIVOR_COPY_TRADING_BROKERS = BROKERS;
  window.AIVOR_COPY_TRADING = ORDER.map(([p, b]) => rowSpec(p, b));
})();
