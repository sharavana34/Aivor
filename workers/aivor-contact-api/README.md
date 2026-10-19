# AIVOR Contact API (`aivor-contact-api`)

Cloudflare Worker that accepts Contact form POSTs and delivers a **plain-text** Telegram notification via Bot API `sendMessage`.

**Bot username (docs only):** `@LaaksAdibot`  
**Never** put the bot token or chat ID in HTML, frontend JS, JSON, GitHub config, source control, logs, or error messages.

## Path

```
D:\Aivor\site\workers\aivor-contact-api\
```

| File | Role |
|------|------|
| `src/index.js` | Worker entry |
| `wrangler.toml` | Worker name + entry (no secrets) |
| `README.md` | This setup guide |

## Prerequisites

- Cloudflare account
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npx wrangler` is enough)
- Telegram bot `@LaaksAdibot` (token from [@BotFather](https://t.me/BotFather) — keep it private)

## Exact setup & test steps

### 1. Create the Cloudflare Worker

From this folder:

```bash
cd D:\Aivor\site\workers\aivor-contact-api
npx wrangler login
```

Confirm `wrangler.toml` has `name = "aivor-contact-api"` and `main = "src/index.js"`.

### 2. Add secrets securely

Do **not** paste secrets into any repo file. Set them only via Wrangler (or the Cloudflare dashboard → Workers → Settings → Variables → Encrypt):

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
```

When prompted, paste the value and press Enter. Values stay in Cloudflare — they are never written to disk by these commands in a commit-able form.

### 3. Start a chat with the bot

Open Telegram, search **`@LaaksAdibot`**, open the chat, and send:

```
/start
```

The bot cannot message you until you have started the chat.

### 4. Obtain your chat ID safely

After `/start`, call Telegram’s `getUpdates` **from your own machine** (terminal / browser), using your token only locally — **do not** commit the URL or response.

Example (replace `YOUR_BOT_TOKEN` only in your local shell; never save it in the repo):

```bash
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates"
```

In the JSON, find `message.chat.id` (a number, often negative for groups). That value is `TELEGRAM_CHAT_ID`. Put it into Cloudflare with `wrangler secret put` (step 2), not into source control.

If `getUpdates` is empty, send another message to the bot and retry.

### 5. Deploy the Worker

```bash
cd D:\Aivor\site\workers\aivor-contact-api
npx wrangler deploy
```

Note the HTTPS URL Wrangler prints, e.g. `https://aivor-contact-api.<your-subdomain>.workers.dev`.

### 6. Point the Contact page at the Worker

Edit `D:\Aivor\site\js\config.js` (and the same file under GitHub Pages if you deploy the site separately):

```js
CONTACT_API_URL: "https://aivor-contact-api.<your-subdomain>.workers.dev"
```

Until this is set (empty / placeholder), the Contact form shows that the API is **not configured** and will **not** claim the message was sent.

Optional local test: the Worker also allows CORS from `http://localhost:3000`, `:5500`, `:8080` (and `127.0.0.1` equivalents). Documented in `src/index.js` (`ALLOWED_ORIGINS`). Production allowlist includes `https://sharavana34.github.io`.

### 7. Submit a test enquiry

1. Open the Contact page (local or `https://sharavana34.github.io/Aivor/contact.html`).
2. Fill required fields and submit.
3. Confirm a Telegram message arrives in the chat you started with `@LaaksAdibot`.
4. Success in the UI means the Worker received `ok: true` from Telegram `sendMessage` — not clipboard fallback.

### 8. Revoke / rotate later

This bot is temporary. When finished:

1. Revoke or rotate the token in [@BotFather](https://t.me/BotFather).
2. Update Cloudflare: `npx wrangler secret put TELEGRAM_BOT_TOKEN` with the new token (or delete the Worker).
3. Remove or blank `CONTACT_API_URL` in `js/config.js` if the Worker is retired.

## API contract

- **Method:** `POST` only (`OPTIONS` for CORS preflight)
- **Body:** JSON `{ name, email, topic, product?, message, website? }`
  - `website` is a honeypot (must be empty)
- **Success:** `{ "ok": true }` — only after Telegram confirms delivery
- **Errors:** `{ "ok": false, "error": "<safe message>" }` — never includes secrets

## Rate limiting

In-memory Map keyed by client IP (5 requests / 60s per isolate). Counters reset when the Cloudflare isolate is recycled. For stricter production limits, enable [Cloudflare Rate Limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/) on the Worker route.

## Security checklist

- [ ] No token / chat ID in HTML, JS, JSON, `wrangler.toml` `[vars]`, GitHub Actions, or docs examples
- [ ] Secrets only via `wrangler secret put` or encrypted dashboard vars
- [ ] CORS locked to the GitHub Pages origin (plus localhost for local test)
- [ ] Honeypot + length limits + topic allowlist on the Worker
- [ ] Frontend shows success **only** when the Worker returns `{ ok: true }`
