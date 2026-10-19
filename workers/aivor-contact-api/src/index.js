/**
 * AIVOR Contact API — Cloudflare Worker
 *
 * Accepts POST JSON from the Contact form, validates input, and delivers
 * a plain-text Telegram notification via Bot API sendMessage.
 *
 * Secrets (set with `wrangler secret put`, NEVER commit):
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_CHAT_ID
 *
 * Rate limit: in-memory Map per client IP. Resets when the isolate is
 * recycled — for production hardening, prefer Cloudflare Rate Limiting
 * or Durable Objects.
 */

const ALLOWED_ORIGINS = [
  "https://sharavana34.github.io",
  "http://localhost:3000",
  "http://localhost:5500",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5500",
  "http://localhost:8080",
  "http://127.0.0.1:8080"
];

const LIMITS = {
  name: 100,
  email: 254,
  topic: 80,
  product: 80,
  message: 4000,
  bodyBytes: 16_384
};

const RATE = {
  windowMs: 60_000,
  maxPerWindow: 5
};

/** @type {Map<string, { count: number, resetAt: number }>} */
const rateMap = new Map();

const TOPIC_ALLOW = new Set([
  "Product / EA",
  "MT5 Setup",
  "Copy Trading",
  "Performance Report",
  "Billing / Purchase",
  "Other"
]);

function corsHeaders(origin) {
  const allow =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin)
    }
  });
}

function clientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE.windowMs };
    rateMap.set(ip, entry);
  }
  entry.count += 1;
  if (rateMap.size > 5000) {
    for (const [key, val] of rateMap) {
      if (now >= val.resetAt) rateMap.delete(key);
    }
  }
  return entry.count <= RATE.maxPerWindow;
}

function escapePlain(value) {
  return String(value)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

function isValidEmail(value) {
  if (value.length > LIMITS.email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validatePayload(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "Invalid request body." };
  }

  const honeypot = escapePlain(data.website ?? data.honeypot ?? "");
  if (honeypot) {
    /* Silent spam drop — same shape as success so bots learn nothing */
    return { ok: false, spam: true };
  }

  const name = escapePlain(data.name ?? "");
  const email = escapePlain(data.email ?? "").toLowerCase();
  const topic = escapePlain(data.topic ?? "");
  const productRaw = escapePlain(data.product ?? "");
  const message = escapePlain(data.message ?? "");

  if (!name || name.length > LIMITS.name) {
    return { ok: false, error: "Please provide a valid name." };
  }
  if (!email || !isValidEmail(email)) {
    return { ok: false, error: "Please provide a valid email address." };
  }
  if (!topic || topic.length > LIMITS.topic || !TOPIC_ALLOW.has(topic)) {
    return { ok: false, error: "Please select a valid topic." };
  }
  if (productRaw.length > LIMITS.product) {
    return { ok: false, error: "Product value is too long." };
  }
  if (!message || message.length < 10 || message.length > LIMITS.message) {
    return {
      ok: false,
      error: "Message must be between 10 and 4000 characters."
    };
  }

  return {
    ok: true,
    fields: {
      name,
      email,
      topic,
      product: productRaw || "Not specified",
      message
    }
  };
}

function formatTelegramText(fields) {
  return [
    "AIVOR Website Contact",
    "",
    `Name: ${fields.name}`,
    `Email: ${fields.email}`,
    `Topic: ${fields.topic}`,
    `Product: ${fields.product}`,
    "",
    "Message:",
    fields.message
  ].join("\n");
}

async function sendTelegram(env, text) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return { ok: false, status: 503, error: "Contact service is not configured." };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true
      })
    });
  } catch (_) {
    return {
      ok: false,
      status: 502,
      error: "Could not reach the notification service. Please try again."
    };
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (_) {
    payload = null;
  }

  if (!response.ok || !payload || payload.ok !== true) {
    return {
      ok: false,
      status: 502,
      error: "Notification delivery failed. Please try again in a moment."
    };
  }

  return { ok: true };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (origin && !ALLOWED_ORIGINS.includes(origin)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }

    if (request.method !== "POST") {
      return jsonResponse(
        { ok: false, error: "Method not allowed. Use POST." },
        405,
        origin
      );
    }

    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return jsonResponse({ ok: false, error: "Origin not allowed." }, 403, origin);
    }

    const ip = clientIp(request);
    if (!checkRateLimit(ip)) {
      return jsonResponse(
        { ok: false, error: "Too many requests. Please wait a minute and try again." },
        429,
        origin
      );
    }

    const contentType = request.headers.get("Content-Type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return jsonResponse(
        { ok: false, error: "Content-Type must be application/json." },
        415,
        origin
      );
    }

    const raw = await request.arrayBuffer();
    if (raw.byteLength === 0 || raw.byteLength > LIMITS.bodyBytes) {
      return jsonResponse(
        { ok: false, error: "Request body is empty or too large." },
        413,
        origin
      );
    }

    let data;
    try {
      data = JSON.parse(new TextDecoder().decode(raw));
    } catch (_) {
      return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400, origin);
    }

    const validated = validatePayload(data);
    if (validated.spam) {
      /* Honeypot: look like success without notifying Telegram */
      return jsonResponse({ ok: true }, 200, origin);
    }
    if (!validated.ok) {
      return jsonResponse({ ok: false, error: validated.error }, 400, origin);
    }

    const text = formatTelegramText(validated.fields);
    const result = await sendTelegram(env, text);

    if (!result.ok) {
      return jsonResponse(
        { ok: false, error: result.error },
        result.status || 502,
        origin
      );
    }

    return jsonResponse({ ok: true }, 200, origin);
  }
};
