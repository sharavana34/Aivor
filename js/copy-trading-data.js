/**
 * AIVOR Copy Trading directory — one entry per broker setup (unique id).
 * Do not invent returns, fees, URLs, or charts. Use "Not published" /
 * "Verify with broker" when unverified. Wire live URLs via config keys.
 */
window.AIVOR_COPY_TRADING = [
  {
    id: "vantage-aivor-hf-1067466",
    strategyId: "1067466",
    strategyName: "AIVOR HF",
    broker: "Vantage Markets",
    platform: "Vantage Copy Trading",
    accountType: "Verify with broker",
    instruments: ["XAUUSD"],
    tradingStyle: "High-frequency systematic",
    performance: {
      value: null,
      period: null,
      label: "Not published"
    },
    riskDrawdown: {
      value: null,
      label: "Verify with broker"
    },
    performanceInsight:
      "No return, drawdown, or equity figures are published on this site for Strategy ID 1067466. Open the live Vantage profile to review provider-published metrics for the periods shown there.",
    fees: {
      provider: "Provider performance / profit-share fee may apply on Vantage. Exact percentage not verified from a public profile snapshot — check on the live page before copying.",
      broker:
        "Separately, your Vantage trading account pays normal broker costs (spreads, commissions, overnight financing where applicable). Those are broker charges, not the strategy provider fee.",
      note: "Provider fee vs broker spreads/swaps/commissions are different cost layers."
    },
    status: "Live",
    /* Resolved at runtime from AIVOR_CONFIG.COPY_TRADING_URL */
    externalCopyUrlKey: "COPY_TRADING_URL",
    externalCopyUrl: null,
    details: {
      summary:
        "Copy trading of AIVOR HF systematic execution on Vantage Markets. Your copy account mirrors the signal provider’s positions according to your allocation and the broker’s copy rules.",
      howTo: [
        "Open or log in to a Vantage Markets account.",
        "Review Strategy ID 1067466 on the live copy-trading profile (fees, risk, account requirements).",
        "Fund only capital you can afford to risk.",
        "Choose allocation and start copying on Vantage.",
        "Monitor on Vantage; stop or resize if it no longer fits your risk."
      ],
      notes: [
        "Independent AIVOR HF track record (MyFXBook) is separate from Vantage copy metrics.",
        "Instrument mix beyond XAUUSD — confirm on the live Vantage profile."
      ]
    }
  },
  {
    id: "pending-aivor-scalper",
    strategyId: null,
    strategyName: "AIVOR Scalper",
    broker: "Not assigned",
    platform: "Setup pending",
    accountType: "Verify with broker",
    instruments: ["Verify with broker"],
    tradingStyle: "Scalping",
    performance: {
      value: null,
      period: null,
      label: "Not published"
    },
    riskDrawdown: {
      value: null,
      label: "Verify with broker"
    },
    performanceInsight:
      "Copy setup is not live. No performance figures are published for this directory row.",
    fees: {
      provider: "Not published — verify with broker when a copy setup goes live.",
      broker: "Broker spreads, swaps, and commissions will depend on the assigned broker — verify before copying.",
      note: "Provider fee vs broker costs will be listed when a real setup is configured."
    },
    status: "Coming Soon",
    externalCopyUrlKey: null,
    externalCopyUrl: null,
    details: {
      summary:
        "AIVOR Scalper copy trading is planned. No broker link, strategy ID, or verified metrics are available yet.",
      howTo: [
        "Watch this directory for a Live or Setup Pending row with a real broker.",
        "Do not use invented third-party links — only copy URLs published here when configured."
      ],
      notes: ["Same strategy may appear in multiple rows for different brokers later."]
    }
  },
  {
    id: "pending-aivor-swing",
    strategyId: null,
    strategyName: "AIVOR Swing",
    broker: "Not assigned",
    platform: "Setup pending",
    accountType: "Verify with broker",
    instruments: ["Verify with broker"],
    tradingStyle: "Swing",
    performance: {
      value: null,
      period: null,
      label: "Not published"
    },
    riskDrawdown: {
      value: null,
      label: "Verify with broker"
    },
    performanceInsight:
      "Copy setup is not live. No performance figures are published for this directory row.",
    fees: {
      provider: "Not published — verify with broker when a copy setup goes live.",
      broker: "Broker spreads, swaps, and commissions will depend on the assigned broker — verify before copying.",
      note: "Provider fee vs broker costs will be listed when a real setup is configured."
    },
    status: "Coming Soon",
    externalCopyUrlKey: null,
    externalCopyUrl: null,
    details: {
      summary:
        "AIVOR Swing copy trading is planned. No broker link, strategy ID, or verified metrics are available yet.",
      howTo: [
        "Watch this directory for a Live or Setup Pending row with a real broker.",
        "Do not use invented third-party links — only copy URLs published here when configured."
      ],
      notes: ["Same strategy may appear in multiple rows for different brokers later."]
    }
  },
  {
    id: "pending-aivor-hf-extra",
    strategyId: null,
    strategyName: "AIVOR HF",
    broker: "Not assigned",
    platform: "Setup pending",
    accountType: "Verify with broker",
    instruments: ["XAUUSD"],
    tradingStyle: "High-frequency systematic",
    performance: {
      value: null,
      period: null,
      label: "Not published"
    },
    riskDrawdown: {
      value: null,
      label: "Verify with broker"
    },
    performanceInsight:
      "Additional broker setups for AIVOR HF are not configured. The live Vantage setup is listed separately (Strategy ID 1067466).",
    fees: {
      provider: "Not published — verify with broker when a copy setup goes live.",
      broker: "Broker costs depend on the assigned broker — verify before copying.",
      note: "Provider fee vs broker costs will be listed when a real setup is configured."
    },
    status: "Setup Pending",
    externalCopyUrlKey: null,
    externalCopyUrl: null,
    details: {
      summary:
        "Placeholder row for a future AIVOR HF copy setup on another broker. No URL or verified metrics yet.",
      howTo: [
        "Use the Live Vantage AIVOR HF row when you want to copy today.",
        "Additional brokers will appear here only when a real setup ID and copy URL are supplied."
      ],
      notes: ["Never invent broker links or performance for pending rows."]
    }
  }
];
