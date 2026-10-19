/**
 * Static verification for Copy Trading directory (no browser).
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "js/config.js"), "utf8"), ctx);
vm.runInContext(
  fs.readFileSync(path.join(root, "js/copy-trading-data.js"), "utf8"),
  ctx
);

const data = ctx.window.AIVOR_COPY_TRADING;
const meta = ctx.window.AIVOR_COPY_TRADING_META;
const cfg = ctx.window.AIVOR_CONFIG;
const html = fs.readFileSync(path.join(root, "copy-trading.html"), "utf8");
const js = fs.readFileSync(path.join(root, "js/copy-trading.js"), "utf8");

const expectedUrl =
  "https://secure.vantagemarkets.com/copyTrading/visitor/discover/discoverDetail?strategyId=1067466&c=ewIuPhf0sNkBYluWnJLINQ%3D%3D&platform=copytrading&autoCertification=false";

const products = [...new Set(data.map((d) => d.productName))];
const brokers = [...new Set(data.map((d) => d.broker))];
const thCount = (html.match(/<th scope="col">/g) || []).length;
const cols = [
  "Product / Strategy",
  "Broker",
  "Commission",
  "Performance",
  "Risk",
  "Status",
  "Action"
];

const checks = [];
function ok(name, pass, detail) {
  checks.push({ name, pass: !!pass, detail: detail || "" });
}

ok("12 rows", data.length === 12, String(data.length));
ok("3 products", products.length === 3, products.join(", "));
ok("4 brokers", brokers.length === 4, brokers.join(", "));
ok(
  "every product×broker",
  products.every((p) =>
    brokers.every((b) => data.some((d) => d.productName === p && d.broker === b))
  )
);
ok("7 table headers", thCount === 7, String(thCount));
cols.forEach((c) =>
  ok(`header ${c}`, html.includes(`<th scope="col">${c}</th>`))
);
ok("no Platform header", !/<th[^>]*>Platform<\/th>/i.test(html));
ok("no Account header", !/<th[^>]*>Account<\/th>/i.test(html));
ok("no Instruments header", !/<th[^>]*>Instruments?<\/th>/i.test(html));
ok(
  "compact filters",
  ["ctd-filter-product", "ctd-filter-broker", "ctd-filter-status", "ctd-search", "ctd-reset"].every(
    (id) => html.includes(`id="${id}"`)
  )
);
ok(
  "filter labels",
  html.includes(">Strategy</label>") &&
    html.includes(">Broker</label>") &&
    html.includes(">Status</label>") &&
    html.includes(">Search</label>")
);
ok(
  "search placeholder",
  html.includes('placeholder="Strategy, broker, ID..."')
);
ok("reset filters label", html.includes(">Reset filters</button>"));
ok(
  "obsolete filters gone",
  ["ctd-filter-account", "ctd-filter-instrument", "ctd-filter-strategy", "ctd-sort"].every(
    (id) => !html.includes(id)
  )
);
ok(
  "hero title",
  /<h1>\s*AIVOR Copy Trading Strategies\s*<\/h1>/i.test(html)
);
ok(
  "hero eyebrow",
  /Copy Trading Directory/i.test(html)
);
ok(
  "subtitle",
  html.includes(
    "Compare available strategy setups, broker requirements, and published evidence before choosing where to copy."
  )
);
ok("Available Strategies heading", html.includes("Available Strategies"));
ok("no featured HF card block", !/ct-panel|featured.*HF|hf-featured/i.test(html));
ok("commission meta 5%", meta.commissionLabel === "5%");
ok("config URL exact", cfg.COPY_TRADING_URL === expectedUrl);
ok("brokerCopyUrls structure", meta.brokerCopyUrls && typeof meta.brokerCopyUrls === "object");
ok("url disclosure present", !!meta.urlDisclosure);

const brokersMeta = ctx.window.AIVOR_COPY_TRADING_BROKERS || {};
const expectedLogos = {
  vantage: "assets/brokers/vantage.png",
  "ic-markets": "assets/brokers/ic-markets.png",
  exness: "assets/brokers/exness.png",
  octafx: "assets/brokers/octa.png"
};
Object.keys(expectedLogos).forEach((id) => {
  const b = brokersMeta[id];
  ok(
    `broker ${id} logo path`,
    b && b.logo === expectedLogos[id],
    b ? b.logo : "missing"
  );
  ok(
    `broker ${id} logo file`,
    fs.existsSync(path.join(root, expectedLogos[id]))
  );
});
ok(
  "rows carry brokerLogo",
  data.every((d) => d.brokerLogo && expectedLogos[d.brokerKey] === d.brokerLogo)
);
ok("JS broker logo markup", js.includes("ctd-broker-logo") && js.includes("onerror"));
ok("CSS broker logo chip", fs.readFileSync(path.join(root, "css/site.css"), "utf8").includes(".ctd-broker-logo"));

const live = data.filter((d) => d.status === "Live");
ok("only HF×Vantage Live", live.length === 1 && live[0].id === "vantage-hf");
ok(
  "HF live perf label",
  live[0].performance.label === "Live results available" &&
    live[0].performance.kind === "live"
);
ok(
  "Scalper/Swing Backtest only",
  data
    .filter((d) => d.productKey !== "hf")
    .every(
      (d) =>
        d.performance.label === "Backtest only" && d.status === "Backtest"
    )
);
ok(
  "HF non-Vantage pending",
  data
    .filter((d) => d.productKey === "hf" && d.brokerKey !== "vantage")
    .every(
      (d) =>
        d.status === "Pending" && d.performance.label === "Not available"
    )
);
ok(
  "no invented numeric perf",
  data.every((d) => d.performance.value == null && d.riskDrawdown.value == null)
);
ok(
  "risk links present",
  data.every((d) => d.riskDrawdown && d.riskDrawdown.href)
);
ok(
  "no LABEL status bugs in data",
  data.every((d) => !/_LABEL/i.test(String(d.status)))
);
ok("JS formatStatus helper", js.includes("function formatStatus"));
ok("JS strips _LABEL", js.includes("_LABEL"));
ok("JS Copy strategy casing", js.includes(">Copy strategy</a>"));
ok("JS product filter", js.includes("ctd-filter-product"));
ok("JS colspan 7", js.includes('colspan="7"'));
ok("JS target blank + rel", js.includes('target="_blank"') && js.includes("noopener noreferrer"));

// Filter simulation
function match(entry, f) {
  if (f.product && entry.productName !== f.product) return false;
  if (f.broker && entry.broker !== f.broker) return false;
  if (f.status && entry.status !== f.status) return false;
  if (f.search) {
    const blob = [
      entry.productName,
      entry.broker,
      entry.status,
      entry.performance.label,
      entry.strategyId
    ]
      .join(" ")
      .toLowerCase();
    if (!blob.includes(f.search)) return false;
  }
  return true;
}
ok(
  "filter HF → 4",
  data.filter((e) => match(e, { product: "AIVOR HF", broker: "", status: "", search: "" })).length === 4
);
ok(
  "filter Vantage → 3",
  data.filter((e) => match(e, { product: "", broker: "Vantage", status: "", search: "" })).length === 3
);
ok(
  "filter Live → 1",
  data.filter((e) => match(e, { product: "", broker: "", status: "Live", search: "" })).length === 1
);
ok(
  "search octa → 3",
  data.filter((e) => match(e, { product: "", broker: "", status: "", search: "octa" })).length === 3
);
ok(
  "empty filter possible",
  data.filter((e) => match(e, { product: "AIVOR HF", broker: "OctaFX", status: "Live", search: "" })).length === 0
);

const failed = checks.filter((c) => !c.pass);
checks.forEach((c) => {
  console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}${c.detail ? " — " + c.detail : ""}`);
});
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
