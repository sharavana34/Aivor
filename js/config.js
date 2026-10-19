/**
 * AIVOR site link configuration
 * Known live URLs are set below. Null / empty / TODO entries must not be invented —
 * the UI shows “Coming soon” instead of a working href.
 */
window.AIVOR_CONFIG = {
  /* Provided — live */
  TELEGRAM_TRIAL_URL: "https://t.me/aivorforex",
  TELEGRAM_CONTACT_URL: "https://t.me/aivorforex",
  MYFXBOOK_URL: "https://www.myfxbook.com/portfolio/xgold-scalper/11973715",

  /* Live copy-trading product (Vantage) — query string preserved exactly */
  COPY_TRADING_URL:
    "https://secure.vantagemarkets.com/copyTrading/visitor/discover/discoverDetail?strategyId=1067466&c=ewIuPhf0sNkBYluWnJLINQ%3D%3D&platform=copytrading&autoCertification=false",

  /*
   * Contact form → Cloudflare Worker (aivor-contact-api).
   * Set to your deployed Worker HTTPS URL after `wrangler deploy`.
   * Leave empty / null until deployed — the form will say the API is not
   * configured and will NOT claim Telegram delivery.
   * See: workers/aivor-contact-api/README.md
   * Never put TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID here.
   */
  CONTACT_API_URL: "", // e.g. "https://aivor-contact-api.<subdomain>.workers.dev"

  /* TODO — set when available */
  SCALPER_URL: null, // TODO
  SWING_URL: null, // TODO

  /*
   * Social profile URLs (Contact page + header icons).
   * Only set a string when the official AIVOR profile is confirmed.
   * Leave null/empty for Coming soon — never invent handles.
   * Telegram is the active support channel today.
   */
  FACEBOOK_URL: null, // TODO — official Facebook URL
  INSTAGRAM_URL: null, // TODO — official Instagram URL
  WHATSAPP_URL: null, // TODO — official WhatsApp URL
  YOUTUBE_URL: null // TODO — official YouTube URL
};
