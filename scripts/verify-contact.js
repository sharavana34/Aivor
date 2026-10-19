const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const assert = (c, m) => {
  if (!c) throw new Error(m);
};

const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "js/config.js"), "utf8"), ctx);
const cfg = ctx.window.AIVOR_CONFIG;

assert(cfg.TELEGRAM_CONTACT_URL === "https://t.me/aivorforex", "telegram url");
assert(cfg.WHATSAPP_URL == null, "whatsapp null");
assert(cfg.FACEBOOK_URL == null, "facebook null");
assert(cfg.INSTAGRAM_URL == null, "instagram null");
assert(cfg.YOUTUBE_URL == null, "youtube null");
assert("CONTACT_API_URL" in cfg, "CONTACT_API_URL key");
assert(
  cfg.CONTACT_API_URL === "" || cfg.CONTACT_API_URL == null,
  "CONTACT_API_URL empty until user deploys"
);

const html = fs.readFileSync(path.join(root, "contact.html"), "utf8");
assert(html.includes("css/contact.css"), "contact.css linked");
assert(html.includes("js/contact.js"), "contact.js linked");
assert(html.includes("Let's talk"), "hero");
assert(html.includes("Connect with AIVOR"), "social section");
assert(html.includes("Quick links"), "quick links");
assert(html.includes("Looking for a quick answer?"), "faq cta");
assert(html.includes("Visit FAQ"), "faq link");
assert(html.includes('href="products.html"'), "products link");
assert(html.includes('href="performance.html"'), "perf link");
assert(html.includes('href="copy-trading.html"'), "ct link");
assert(html.includes('href="how-it-works.html"'), "hiw link");
assert(html.includes('href="faq.html"'), "faq href");
assert(html.includes('data-social="telegram"'), "tg social");
assert(html.includes('data-social="youtube"'), "yt social");
assert(html.includes('name="website"'), "honeypot");
assert(html.includes("Send message"), "submit label");
assert(html.includes("contactManualTelegram"), "manual fallback button");
assert(!html.toLowerCase().includes("message sent successfully"), "no false success");
assert(!/name=["']password["']/i.test(html), "no password field");
assert(!/name=["']investor/i.test(html), "no investor field");
assert(
  !/TELEGRAM_BOT_TOKEN|bot[_\s-]?token|chat[_\s-]?id\s*[:=]/i.test(html),
  "no secrets in html"
);

const js = fs.readFileSync(path.join(root, "js/contact.js"), "utf8");
assert(js.includes("CONTACT_API_URL") || js.includes("getContactApiUrl"), "api url check");
assert(js.includes("submitToWorker") || js.includes("fetch("), "worker fetch");
assert(js.includes("Sending…") || js.includes("Sending"), "loading state");
assert(js.includes("Message delivered"), "success only after confirm");
assert(js.includes("is-coming-soon"), "coming soon class");
assert(js.includes("AIVOR Website Contact"), "format header");
assert(!js.includes("Message sent successfully"), "no legacy false success");
assert(!js.includes("localStorage"), "no localStorage");
assert(
  !/TELEGRAM_BOT_TOKEN|bot_token|chat_id\s*=/i.test(js),
  "no bot secrets in contact.js"
);
assert(js.includes("not configured"), "unset API message");

const configSrc = fs.readFileSync(path.join(root, "js/config.js"), "utf8");
assert(
  !/["']\d{8,}:[A-Za-z0-9_-]{30,}["']/.test(configSrc),
  "no hardcoded bot token in config"
);
assert(
  !/CONTACT_API_URL:\s*["']https:\/\/[^"']+["']/.test(configSrc) ||
    /CONTACT_API_URL:\s*["']["']/.test(configSrc),
  "CONTACT_API_URL not prefilled with a live workers URL"
);

const css = fs.readFileSync(path.join(root, "css/contact.css"), "utf8");
assert(css.includes(".page-contact"), "scoped css");
assert(css.includes("contact-social-grid"), "social grid");
assert(css.includes("contact-manual"), "manual button css");

const workerDir = path.join(root, "workers", "aivor-contact-api");
assert(fs.existsSync(path.join(workerDir, "src", "index.js")), "worker entry");
assert(fs.existsSync(path.join(workerDir, "wrangler.toml")), "wrangler.toml");
assert(fs.existsSync(path.join(workerDir, "README.md")), "worker readme");

const workerJs = fs.readFileSync(path.join(workerDir, "src", "index.js"), "utf8");
assert(workerJs.includes("sendMessage"), "telegram sendMessage");
assert(workerJs.includes("TELEGRAM_BOT_TOKEN"), "uses env token");
assert(workerJs.includes("TELEGRAM_CHAT_ID"), "uses env chat id");
assert(workerJs.includes("sharavana34.github.io"), "cors origin");
assert(workerJs.includes("OPTIONS"), "preflight");
assert(!/:\s*["']\d{6,}:[A-Za-z0-9_-]{20,}/.test(workerJs), "no hardcoded token");

const wrangler = fs.readFileSync(path.join(workerDir, "wrangler.toml"), "utf8");
assert(!/^\s*TELEGRAM_BOT_TOKEN\s*=/m.test(wrangler), "no token assignment in toml");
assert(!/^\s*TELEGRAM_CHAT_ID\s*=/m.test(wrangler), "no chat id assignment in toml");
assert(!/["']\d{8,}:[A-Za-z0-9_-]{30,}["']/.test(wrangler), "no hardcoded token in toml");
assert(!/\[vars\][\s\S]*TELEGRAM_/i.test(wrangler), "no telegram secrets under [vars]");

[
  "index.html",
  "products.html",
  "performance.html",
  "copy-trading.html",
  "how-it-works.html",
  "faq.html",
  "analyze.html"
].forEach((f) => {
  const h = fs.readFileSync(path.join(root, f), "utf8");
  assert(h.includes("contact.html"), `${f} has contact nav/footer`);
});

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
assert(isValidEmail("a@b.co"), "email ok");
assert(!isValidEmail("bad"), "email bad");
assert(!isValidEmail("a@b"), "email incomplete");

function formatTelegramMessage(data) {
  return [
    "AIVOR Website Contact",
    "",
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    `Topic: ${data.topic}`,
    `Product: ${data.product}`,
    "",
    "Message:",
    data.message
  ].join("\n");
}
const sample = formatTelegramMessage({
  name: "Alex",
  email: "alex@example.com",
  topic: "MT5 Setup",
  product: "HF",
  message: "Need install help please"
});
assert(sample.startsWith("AIVOR Website Contact"), "format start");
assert(sample.includes("Name: Alex"), "format name");
assert(sample.includes("Topic: MT5 Setup"), "format topic");

console.log("ALL CONTACT CHECKS PASSED");
