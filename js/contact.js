/**
 * Contact page — social wiring + Worker-backed Telegram notification.
 * Success only after CONTACT_API_URL Worker confirms Telegram delivery.
 * Never stores visitor data; never embeds bot token / chat ID.
 */
(function () {
  const cfg = window.AIVOR_CONFIG || {};
  const TELEGRAM_URL = cfg.TELEGRAM_CONTACT_URL || "https://t.me/aivorforex";

  const SOCIAL_MAP = {
    telegram: "TELEGRAM_CONTACT_URL",
    whatsapp: "WHATSAPP_URL",
    facebook: "FACEBOOK_URL",
    instagram: "INSTAGRAM_URL",
    youtube: "YOUTUBE_URL"
  };

  function isLiveUrl(url) {
    return typeof url === "string" && /^https?:\/\//i.test(url.trim());
  }

  function getContactApiUrl() {
    const raw = cfg.CONTACT_API_URL;
    if (typeof raw !== "string") return "";
    const url = raw.trim();
    if (!url || /^https?:\/\/example\./i.test(url) || /your-subdomain|YOUR_|placeholder/i.test(url)) {
      return "";
    }
    if (!/^https:\/\//i.test(url)) return "";
    return url.replace(/\/+$/, "");
  }

  function wireSocialLinks() {
    Object.keys(SOCIAL_MAP).forEach((network) => {
      const el = document.querySelector(`[data-social="${network}"]`);
      if (!el) return;

      const url = cfg[SOCIAL_MAP[network]];
      const label = el.getAttribute("data-social-label") || network;

      if (isLiveUrl(url)) {
        el.setAttribute("href", url.trim());
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
        el.classList.remove("is-coming-soon");
        el.removeAttribute("aria-disabled");
        el.setAttribute("aria-label", `AIVOR on ${label}`);
        el.removeAttribute("tabindex");
        el.removeAttribute("role");
      } else {
        /* Non-navigating placeholder — never an active-looking href="#" */
        el.removeAttribute("href");
        el.removeAttribute("target");
        el.removeAttribute("rel");
        el.classList.add("is-coming-soon");
        el.setAttribute("aria-disabled", "true");
        el.setAttribute("role", "link");
        el.setAttribute("tabindex", "-1");
        el.setAttribute("aria-label", `${label} — Coming soon`);
        el.addEventListener("click", (e) => e.preventDefault());
      }
    });
  }

  function getField(form, name) {
    return form.elements.namedItem(name);
  }

  function setFieldInvalid(field, message) {
    const wrap = field.closest(".contact-field");
    if (!wrap) return;
    wrap.classList.add("is-invalid");
    const err = wrap.querySelector(".contact-error");
    if (err) err.textContent = message;
    field.setAttribute("aria-invalid", "true");
  }

  function clearFieldInvalid(field) {
    const wrap = field.closest(".contact-field");
    if (!wrap) return;
    wrap.classList.remove("is-invalid");
    field.removeAttribute("aria-invalid");
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function validateForm(form) {
    let firstInvalid = null;
    const name = getField(form, "name");
    const email = getField(form, "email");
    const topic = getField(form, "topic");
    const message = getField(form, "message");

    [name, email, topic, message].forEach((f) => {
      if (f) clearFieldInvalid(f);
    });

    const nameVal = String(name && name.value ? name.value : "").trim();
    const emailVal = String(email && email.value ? email.value : "").trim();
    const topicVal = String(topic && topic.value ? topic.value : "").trim();
    const messageVal = String(message && message.value ? message.value : "").trim();

    if (!nameVal) {
      setFieldInvalid(name, "Please enter your name.");
      firstInvalid = firstInvalid || name;
    } else if (nameVal.length > 100) {
      setFieldInvalid(name, "Name must be 100 characters or fewer.");
      firstInvalid = firstInvalid || name;
    }

    if (!emailVal) {
      setFieldInvalid(email, "Please enter your email address.");
      firstInvalid = firstInvalid || email;
    } else if (!isValidEmail(emailVal) || emailVal.length > 254) {
      setFieldInvalid(email, "Please enter a valid email address.");
      firstInvalid = firstInvalid || email;
    }

    if (!topicVal) {
      setFieldInvalid(topic, "Please select a topic.");
      firstInvalid = firstInvalid || topic;
    }

    if (!messageVal) {
      setFieldInvalid(message, "Please enter a message.");
      firstInvalid = firstInvalid || message;
    } else if (messageVal.length < 10) {
      setFieldInvalid(message, "Message must be at least 10 characters.");
      firstInvalid = firstInvalid || message;
    } else if (messageVal.length > 4000) {
      setFieldInvalid(message, "Message must be 4000 characters or fewer.");
      firstInvalid = firstInvalid || message;
    }

    if (firstInvalid) {
      firstInvalid.focus();
      return null;
    }

    const product = getField(form, "product");
    const productVal = String(product && product.value ? product.value : "").trim();
    const honeypot = getField(form, "website");
    const honeypotVal = String(honeypot && honeypot.value ? honeypot.value : "").trim();

    return {
      name: nameVal,
      email: emailVal,
      topic: topicVal,
      product: productVal || "Not specified",
      message: messageVal,
      website: honeypotVal
    };
  }

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

  async function copyText(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) {
        /* fall through */
      }
    }

    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (_) {
      return false;
    }
  }

  function showStatus(el, text, tone, htmlFallback) {
    if (!el) return;
    el.classList.remove("is-ok", "is-warn", "is-error");
    el.classList.add("is-visible");
    if (tone) el.classList.add(tone);
    if (htmlFallback) {
      el.innerHTML = text;
    } else {
      el.textContent = text;
    }
  }

  function tgManualLinkHtml() {
    return `<a href="${TELEGRAM_URL}" target="_blank" rel="noopener noreferrer">Open Telegram (t.me/aivorforex)</a>`;
  }

  /**
   * Optional secondary path — clearly labeled as manual, never “sent”.
   */
  async function runManualTelegramFallback(statusEl, data) {
    const formatted = formatTelegramMessage(data);
    let copied = false;
    let popupOpened = false;

    /* Open the tab synchronously inside the user gesture before awaiting clipboard.
       Otherwise mobile browsers may treat window.open as a popup and block it. */
    let win = null;
    try {
      /* Do not pass noopener in the feature string: browsers may then return
         null even when the tab opened. Sever opener immediately instead. */
      win = window.open(TELEGRAM_URL, "_blank");
      if (win) {
        try { win.opener = null; } catch (_) {}
        popupOpened = true;
      }
    } catch (_) {
      popupOpened = false;
    }
    try {
      copied = await copyText(formatted);
    } catch (_) {
      copied = false;
    }

    const prefix =
      "Automatic delivery is unavailable. Manual option: ";
    const tgLink = tgManualLinkHtml();

    if (copied && popupOpened) {
      showStatus(
        statusEl,
        prefix +
          "Telegram opened and your message was copied. Paste it into the AIVOR chat and send it yourself — this page did not deliver the message.",
        "is-warn",
        false
      );
    } else if (copied && !popupOpened) {
      showStatus(
        statusEl,
        prefix +
          `your message was copied. ${tgLink}, then paste and send it yourself — this page did not deliver the message.`,
        "is-warn",
        true
      );
    } else if (!copied && popupOpened) {
      showStatus(
        statusEl,
        prefix +
          "Telegram opened, but copy was blocked. Copy your message from the form, paste it into the AIVOR chat, and send it yourself — this page did not deliver the message.",
        "is-warn",
        false
      );
    } else {
      showStatus(
        statusEl,
        prefix +
          `copy your message from the form, then ${tgLink} and send it yourself — this page did not deliver the message.`,
        "is-error",
        true
      );
    }
  }

  async function submitToWorker(apiUrl, data) {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        topic: data.topic,
        product: data.product,
        message: data.message,
        website: data.website || ""
      })
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (_) {
      payload = null;
    }

    if (response.ok && payload && payload.ok === true) {
      return { ok: true };
    }

    const errMsg =
      (payload && typeof payload.error === "string" && payload.error) ||
      (response.status === 429
        ? "Too many requests. Please wait a minute and try again."
        : "Could not deliver your message. Please try again.");

    return { ok: false, error: errMsg, status: response.status };
  }

  function initForm() {
    const form = document.getElementById("contactForm");
    if (!form) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const statusEl = document.getElementById("formStatus");
    const defaultLabel = submitBtn ? submitBtn.textContent : "Send message";
    let inFlight = false;

    ["name", "email", "topic", "message"].forEach((name) => {
      const field = getField(form, name);
      if (!field) return;
      field.addEventListener("input", () => clearFieldInvalid(field));
      field.addEventListener("change", () => clearFieldInvalid(field));
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (inFlight) return;

      const data = validateForm(form);
      if (!data) return;

      /* Silent drop for honeypot fills — do not claim success */
      if (data.website) {
        showStatus(
          statusEl,
          "We could not process your message. Please contact us on Telegram instead.",
          "is-error",
          false
        );
        return;
      }

      const apiUrl = getContactApiUrl();

      if (!apiUrl) {
        /* Current production mode is manual Telegram. Prepare the message and
           open Telegram; never imply that this static site sent it automatically. */
        await runManualTelegramFallback(statusEl, data);
        return;
      }

      inFlight = true;
      form.setAttribute("aria-busy", "true");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.setAttribute("aria-busy", "true");
        submitBtn.textContent = "Sending…";
      }
      showStatus(statusEl, "Sending your message…", null, false);

      try {
        const result = await submitToWorker(apiUrl, data);
        /* Preserve form values — never reset on success or failure */
        if (result.ok) {
          showStatus(
            statusEl,
            "Message delivered. We’ll get back to you soon.",
            "is-ok",
            false
          );
        } else {
          showStatus(
            statusEl,
            (result.error || "Delivery failed.") + " You can retry — your fields are still filled in.",
            "is-error",
            false
          );
        }
      } catch (_) {
        showStatus(
          statusEl,
          "Network error — could not reach the contact service. Check your connection and retry. Your fields are still filled in.",
          "is-error",
          false
        );
      } finally {
        inFlight = false;
        form.removeAttribute("aria-busy");
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.removeAttribute("aria-busy");
          submitBtn.textContent = defaultLabel;
        }
      }
    });

    const manualBtn = document.getElementById("contactManualTelegram");
    if (manualBtn) {
      manualBtn.addEventListener("click", async () => {
        if (inFlight) return;
        const data = validateForm(form);
        if (!data) return;
        if (data.website) {
          showStatus(
            statusEl,
            "We could not prepare your message. Please contact us on Telegram instead.",
            "is-error",
            false
          );
          return;
        }
        manualBtn.disabled = true;
        try {
          await runManualTelegramFallback(statusEl, data);
        } finally {
          manualBtn.disabled = false;
        }
      });
    }
  }

  wireSocialLinks();
  initForm();
})();
