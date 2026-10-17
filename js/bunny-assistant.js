/**
 * AIVOR homepage bunny — auto sleep→wake→react→talk→sleep loop.
 * Mounts only on body.page-home (index.html). No click required for cycle.
 */
(function () {
  if (!document.body || !document.body.classList.contains("page-home")) return;

  const cfg = window.AIVOR_CONFIG || {};
  const STORAGE_KEY = "aivor_bunny_session_v3";
  const MAX_AUTO_SHOWS = 8;
  const FIRST_IDLE_MIN = 8000;
  const FIRST_IDLE_MAX = 15000;
  const BETWEEN_MIN = 25000;
  const BETWEEN_MAX = 45000;
  const TALK_MIN = 7000;
  const TALK_MAX = 10000;
  const AFTER_DISMISS_MIN = 30000;
  const AFTER_DISMISS_MAX = 50000;
  const WAKING_MS = 600;
  const REACTING_MS = 700;
  const SEED_MS = 260;
  const EXPAND_MS = 320;
  const CONTRACT_MS = 280;
  const YAWN_MS = 450;

  const ICON_MIN =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>';
  const ICON_CLOSE =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>';

  const BUNNY_SVG =
    '<svg class="bunny-figure" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 180" fill="none" aria-hidden="true">' +
    "<defs>" +
    '<radialGradient id="bunnyFur" cx="40%" cy="35%" r="70%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="55%" stop-color="#F4F7FB"/><stop offset="100%" stop-color="#D8DEE9"/></radialGradient>' +
    '<radialGradient id="bunnyEarIn" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#B8EFFF"/><stop offset="100%" stop-color="#7AD4F5"/></radialGradient>' +
    '<radialGradient id="bunnyCheek" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#FFB4C8" stop-opacity=".55"/><stop offset="100%" stop-color="#FFB4C8" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="bunnyAccent" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#4DD4FF"/><stop offset="1" stop-color="#00C2FF"/></linearGradient>' +
    "</defs>" +
    '<g class="bunny-body"><ellipse cx="80" cy="138" rx="38" ry="30" fill="url(#bunnyFur)"/><ellipse cx="80" cy="142" rx="22" ry="14" fill="#EEF3F8" opacity=".9"/><circle cx="80" cy="138" r="5" fill="url(#bunnyAccent)" opacity=".85"/></g>' +
    '<g class="bunny-feet"><ellipse cx="62" cy="164" rx="16" ry="9" fill="#F0F4F8"/><ellipse cx="98" cy="164" rx="16" ry="9" fill="#F0F4F8"/><ellipse cx="62" cy="164" rx="8" ry="4" fill="#CFE8F5" opacity=".7"/><ellipse cx="98" cy="164" rx="8" ry="4" fill="#CFE8F5" opacity=".7"/></g>' +
    '<g class="bunny-arms"><ellipse cx="44" cy="136" rx="11" ry="16" fill="url(#bunnyFur)" transform="rotate(-18 44 136)"/><ellipse cx="116" cy="136" rx="11" ry="16" fill="url(#bunnyFur)" transform="rotate(18 116 136)"/></g>' +
    '<g class="bunny-head">' +
    '<g class="bunny-ear bunny-ear-l" style="transform-origin:52px 78px"><ellipse cx="48" cy="36" rx="16" ry="42" fill="url(#bunnyFur)"/><ellipse cx="48" cy="40" rx="8" ry="28" fill="url(#bunnyEarIn)" opacity=".9"/></g>' +
    '<g class="bunny-ear bunny-ear-r" style="transform-origin:108px 78px"><ellipse cx="112" cy="36" rx="16" ry="42" fill="url(#bunnyFur)"/><ellipse cx="112" cy="40" rx="8" ry="28" fill="url(#bunnyEarIn)" opacity=".9"/></g>' +
    '<ellipse class="bunny-face" cx="80" cy="96" rx="52" ry="48" fill="url(#bunnyFur)"/>' +
    '<ellipse cx="48" cy="108" rx="12" ry="8" fill="url(#bunnyCheek)"/><ellipse cx="112" cy="108" rx="12" ry="8" fill="url(#bunnyCheek)"/>' +
    '<g class="bunny-eye bunny-eye-l"><ellipse cx="58" cy="92" rx="13" ry="15" fill="#FFFFFF"/><ellipse class="bunny-pupil" cx="60" cy="94" rx="8" ry="9" fill="#1E88E5"/><ellipse class="bunny-pupil-shine" cx="56" cy="90" rx="3" ry="3.5" fill="#E8F9FF"/><rect class="bunny-lid" x="44" y="76" width="28" height="16" rx="8" fill="url(#bunnyFur)" opacity="0"/></g>' +
    '<g class="bunny-eye bunny-eye-r"><ellipse cx="102" cy="92" rx="13" ry="15" fill="#FFFFFF"/><ellipse class="bunny-pupil" cx="104" cy="94" rx="8" ry="9" fill="#1E88E5"/><ellipse class="bunny-pupil-shine" cx="100" cy="90" rx="3" ry="3.5" fill="#E8F9FF"/><rect class="bunny-lid" x="88" y="76" width="28" height="16" rx="8" fill="url(#bunnyFur)" opacity="0"/></g>' +
    '<ellipse class="bunny-nose" cx="80" cy="108" rx="5" ry="3.5" fill="#5A6A7A"/>' +
    '<path class="bunny-smile" d="M68 116 Q80 126 92 116" stroke="#5A6A7A" stroke-width="2.2" stroke-linecap="round" fill="none"/>' +
    '<circle cx="80" cy="58" r="4" fill="url(#bunnyAccent)" opacity=".55"/>' +
    "</g></svg>";

  function resolveHref(keys, fallback) {
    for (let i = 0; i < keys.length; i++) {
      const url = cfg[keys[i]];
      if (typeof url === "string" && url.trim()) return url.trim();
    }
    return fallback || "";
  }

  function isExternal(url) {
    return /^https?:\/\//i.test(url);
  }

  function randBetween(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  const MESSAGES = [
    {
      id: "trial",
      text: "Want to try AIVOR for free?",
      cta: "Try Free",
      href: resolveHref(["TELEGRAM_TRIAL_URL", "TELEGRAM_CONTACT_URL"], "")
    },
    {
      id: "live",
      text: "Curious about our live trading performance?",
      cta: "View Performance",
      href: "performance.html"
    },
    {
      id: "results",
      text: "Want to explore our trading results?",
      cta: "See Performance",
      href: "performance.html"
    },
    {
      id: "analyze",
      text: "Got a trading report? Let's analyze it!",
      cta: "Analyze My Report",
      href: "analyze.html"
    }
  ];

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function loadState() {
    const blank = {
      autoShows: 0,
      nextIndex: 0,
      closedForSession: false,
      lastDismissAt: 0
    };
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return blank;
      const p = JSON.parse(raw);
      return {
        autoShows: Number(p.autoShows) || 0,
        nextIndex: Number(p.nextIndex) || 0,
        closedForSession: !!p.closedForSession,
        lastDismissAt: Number(p.lastDismissAt) || 0
      };
    } catch (_) {
      return blank;
    }
  }

  function saveState() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (_) {
      /* ignore */
    }
  }

  let session = loadState();
  let root;
  let cloud;
  let msgEl;
  let ctaEl;
  let mascotBtn;
  let liveRegion;

  let animState = "sleeping";
  let bubbleOpen = false;
  let interactionPaused = false;
  let cycleToken = 0;
  let scheduleTimer = null;
  let stepTimer = null;
  let earTimer = null;
  let runningCycle = false;
  let pendingResume = false;

  function clearSchedule() {
    if (scheduleTimer) {
      clearTimeout(scheduleTimer);
      scheduleTimer = null;
    }
  }

  function clearStep() {
    if (stepTimer) {
      clearTimeout(stepTimer);
      stepTimer = null;
    }
  }

  function clearAllTimers() {
    clearSchedule();
    clearStep();
    if (earTimer) {
      clearTimeout(earTimer);
      earTimer = null;
    }
  }

  function bumpToken() {
    cycleToken += 1;
    return cycleToken;
  }

  function wait(ms, token) {
    return new Promise((resolve) => {
      clearStep();
      stepTimer = window.setTimeout(() => {
        stepTimer = null;
        resolve(token === cycleToken);
      }, ms);
    });
  }

  function setAnimState(next) {
    animState = next;
    if (!root) return;
    root.setAttribute("data-state", next);
    root.classList.toggle("is-minimized", next === "sleeping");
    root.classList.remove("is-curious", "is-ear-twitch", "is-yawn");
    if (!mascotBtn) return;
    const labels = {
      sleeping: "Wake AIVOR assistant",
      waking: "AIVOR assistant waking",
      reacting: "AIVOR assistant",
      talking: "AIVOR assistant tip open"
    };
    mascotBtn.setAttribute("aria-label", labels[next] || "AIVOR assistant");
    mascotBtn.setAttribute("aria-expanded", next === "talking" ? "true" : "false");
  }

  function setCloudPhase(phase) {
    if (!cloud) return;
    cloud.setAttribute("data-phase", phase);
    cloud.hidden = phase === "hidden";
  }

  function announce(text) {
    if (!liveRegion) return;
    liveRegion.textContent = "";
    window.requestAnimationFrame(() => {
      liveRegion.textContent = text;
    });
  }

  function applyCta(msg) {
    const href = msg.href || "";
    ctaEl.textContent = msg.cta;
    ctaEl.removeAttribute("aria-disabled");
    ctaEl.classList.remove("is-disabled");
    if (!href) {
      ctaEl.setAttribute("href", "#");
      ctaEl.setAttribute("aria-disabled", "true");
      ctaEl.classList.add("is-disabled");
      ctaEl.removeAttribute("target");
      ctaEl.removeAttribute("rel");
      return;
    }
    ctaEl.setAttribute("href", href);
    if (isExternal(href)) {
      ctaEl.setAttribute("target", "_blank");
      ctaEl.setAttribute("rel", "noopener noreferrer");
    } else {
      ctaEl.removeAttribute("target");
      ctaEl.removeAttribute("rel");
    }
  }

  function nextMessage() {
    const idx = ((session.nextIndex % MESSAGES.length) + MESSAGES.length) % MESSAGES.length;
    const msg = MESSAGES[idx];
    session.nextIndex = (idx + 1) % MESSAGES.length;
    return msg;
  }

  function stopSleepTicks() {
    if (earTimer) {
      clearTimeout(earTimer);
      earTimer = null;
    }
    if (root) root.classList.remove("is-ear-twitch", "is-yawn");
  }

  function scheduleSleepEarTwitch() {
    if (reduceMotion || animState !== "sleeping") return;
    earTimer = window.setTimeout(() => {
      earTimer = null;
      if (animState !== "sleeping" || !root) return;
      root.classList.add("is-ear-twitch");
      window.setTimeout(() => {
        if (root) root.classList.remove("is-ear-twitch");
        scheduleSleepEarTwitch();
      }, 500);
    }, 7000 + Math.random() * 10000);
  }

  function enterSleeping(opts) {
    const options = opts || {};
    stopSleepTicks();
    setCloudPhase("hidden");
    bubbleOpen = false;
    runningCycle = false;
    setAnimState("sleeping");
    if (!reduceMotion) scheduleSleepEarTwitch();
    if (options.scheduleNext && !session.closedForSession) {
      scheduleWake(options.delayMs);
    }
  }

  function canStartAutoCycle() {
    if (session.closedForSession) return false;
    if (session.autoShows >= MAX_AUTO_SHOWS) return false;
    if (interactionPaused) return false;
    if (document.hidden) return false;
    if (runningCycle || bubbleOpen) return false;
    if (animState !== "sleeping") return false;
    return true;
  }

  function scheduleWake(delayMs) {
    clearSchedule();
    if (session.closedForSession) return;
    if (session.autoShows >= MAX_AUTO_SHOWS) return;

    let waitMs =
      typeof delayMs === "number" ? delayMs : randBetween(BETWEEN_MIN, BETWEEN_MAX);

    if (session.lastDismissAt) {
      const remain = AFTER_DISMISS_MIN - (Date.now() - session.lastDismissAt);
      if (remain > waitMs) waitMs = remain;
    }

    scheduleTimer = window.setTimeout(() => {
      scheduleTimer = null;
      if (!canStartAutoCycle()) {
        if (!session.closedForSession && session.autoShows < MAX_AUTO_SHOWS) {
          pendingResume = true;
          scheduleWake(8000);
        }
        return;
      }
      runCycle({ manual: false });
    }, waitMs);
  }

  async function closeCloud(token) {
    if (!bubbleOpen && cloud && cloud.getAttribute("data-phase") === "hidden") {
      return true;
    }
    if (!reduceMotion) {
      setCloudPhase("contract");
      if (!(await wait(CONTRACT_MS, token))) return false;
    }
    setCloudPhase("hidden");
    bubbleOpen = false;
    return token === cycleToken;
  }

  async function openCloud(msg, token) {
    msgEl.textContent = msg.text;
    applyCta(msg);

    if (reduceMotion) {
      setCloudPhase("open");
      bubbleOpen = true;
      announce(msg.text + " " + msg.cta);
      return token === cycleToken;
    }

    setCloudPhase("seed");
    if (!(await wait(SEED_MS, token))) return false;
    setCloudPhase("expand");
    if (!(await wait(EXPAND_MS, token))) return false;
    setCloudPhase("open");
    bubbleOpen = true;
    announce(msg.text + " " + msg.cta);
    return token === cycleToken;
  }

  /**
   * Full cycle: sleeping → waking → reacting → talking → sleeping
   */
  async function runCycle(opts) {
    const options = opts || {};
    if (runningCycle && !options.force) return;
    if (session.closedForSession && !options.manual) return;
    if (interactionPaused && !options.manual) {
      pendingResume = true;
      scheduleWake(8000);
      return;
    }

    clearSchedule();
    const token = bumpToken();
    clearStep();
    runningCycle = true;
    stopSleepTicks();

    const msg = nextMessage();
    if (!options.manual) {
      session.autoShows += 1;
    }
    saveState();

    /* waking */
    setAnimState("waking");
    if (!(await wait(reduceMotion ? 80 : WAKING_MS, token))) return;

    if (interactionPaused && !options.manual) {
      runningCycle = false;
      enterSleeping({ scheduleNext: true, delayMs: 8000 });
      return;
    }

    /* reacting */
    setAnimState("reacting");
    if (!(await wait(reduceMotion ? 80 : REACTING_MS, token))) return;

    /* talking */
    setAnimState("talking");
    if (!(await openCloud(msg, token))) return;

    const talkMs = reduceMotion ? 8000 : randBetween(TALK_MIN, TALK_MAX);
    if (!(await wait(talkMs, token))) return;

    /* close cloud + yawn into sleep */
    if (!(await closeCloud(token))) return;

    if (!reduceMotion) {
      setAnimState("sleeping");
      root.classList.add("is-yawn");
      await wait(YAWN_MS, token);
      if (root) root.classList.remove("is-yawn");
    }

    if (token !== cycleToken) return;

    enterSleeping({
      scheduleNext: !session.closedForSession && session.autoShows < MAX_AUTO_SHOWS,
      delayMs: randBetween(BETWEEN_MIN, BETWEEN_MAX)
    });
  }

  async function dismissToSleep(opts) {
    const options = opts || {};
    const token = bumpToken();
    clearAllTimers();
    runningCycle = false;
    session.lastDismissAt = Date.now();
    if (options.closeSession) session.closedForSession = true;
    saveState();

    await closeCloud(token);
    enterSleeping({
      scheduleNext: !session.closedForSession && session.autoShows < MAX_AUTO_SHOWS,
      delayMs: randBetween(AFTER_DISMISS_MIN, AFTER_DISMISS_MAX)
    });
    if (options.closeSession) {
      announce("Assistant closed for this session.");
    }
  }

  async function onMascotClick() {
    if (session.closedForSession) {
      session.closedForSession = false;
      saveState();
    }

    if (bubbleOpen || animState === "talking") {
      await dismissToSleep({});
      return;
    }

    if (runningCycle && (animState === "waking" || animState === "reacting")) {
      return;
    }

    /* Immediate wake + open from sleeping */
    clearAllTimers();
    await runCycle({ manual: true, force: true });
  }

  function isInteractiveTarget(el) {
    if (!el || el === document.body) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (el.isContentEditable) return true;
    if (
      el.closest &&
      el.closest(
        "form, .analyzer, [data-analyzer], .dropzone, [role='textbox'], input[type='file']"
      )
    ) {
      return true;
    }
    return false;
  }

  function setPaused(paused) {
    interactionPaused = paused;
    if (paused) {
      clearSchedule();
      pendingResume = true;
    } else if (
      pendingResume &&
      !runningCycle &&
      !bubbleOpen &&
      !session.closedForSession &&
      session.autoShows < MAX_AUTO_SHOWS &&
      animState === "sleeping" &&
      !document.hidden
    ) {
      pendingResume = false;
      scheduleWake(randBetween(BETWEEN_MIN, BETWEEN_MAX));
    }
  }

  function mount() {
    root = document.createElement("aside");
    root.className = "bunny-assistant is-minimized";
    root.setAttribute("aria-label", "AIVOR assistant");
    root.setAttribute("data-state", "sleeping");

    cloud = document.createElement("div");
    cloud.className = "bunny-cloud";
    cloud.id = "bunny-assistant-bubble";
    cloud.setAttribute("role", "dialog");
    cloud.setAttribute("aria-label", "AIVOR tip");
    cloud.setAttribute("data-phase", "hidden");
    cloud.hidden = true;

    const shell = document.createElement("div");
    shell.className = "bunny-cloud-shell";

    const head = document.createElement("div");
    head.className = "bunny-bubble-head";
    const actions = document.createElement("div");
    actions.className = "bunny-bubble-actions";

    const minBtn = document.createElement("button");
    minBtn.type = "button";
    minBtn.className = "bunny-icon-btn bunny-minimize";
    minBtn.setAttribute("aria-label", "Dismiss tip");
    minBtn.innerHTML = ICON_MIN;

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "bunny-icon-btn bunny-close";
    closeBtn.setAttribute("aria-label", "Close assistant for this session");
    closeBtn.innerHTML = ICON_CLOSE;

    actions.appendChild(minBtn);
    actions.appendChild(closeBtn);
    head.appendChild(actions);

    const content = document.createElement("div");
    content.className = "bunny-cloud-content";
    msgEl = document.createElement("p");
    msgEl.className = "bunny-msg";
    msgEl.id = "bunny-assistant-msg";
    ctaEl = document.createElement("a");
    ctaEl.className = "bunny-cta";
    ctaEl.setAttribute("aria-describedby", "bunny-assistant-msg");
    content.appendChild(msgEl);
    content.appendChild(ctaEl);
    shell.appendChild(head);
    shell.appendChild(content);

    const tail = document.createElement("div");
    tail.className = "bunny-cloud-tail";
    tail.setAttribute("aria-hidden", "true");
    tail.innerHTML = "<span></span><span></span><span></span>";

    cloud.appendChild(shell);
    cloud.appendChild(tail);
    cloud.setAttribute("aria-labelledby", "bunny-assistant-msg");

    mascotBtn = document.createElement("button");
    mascotBtn.type = "button";
    mascotBtn.className = "bunny-mascot-btn";
    mascotBtn.setAttribute("aria-expanded", "false");
    mascotBtn.setAttribute("aria-controls", "bunny-assistant-bubble");
    mascotBtn.setAttribute("aria-label", "Wake AIVOR assistant");
    mascotBtn.innerHTML = BUNNY_SVG;

    liveRegion = document.createElement("div");
    liveRegion.className = "bunny-sr-only";
    liveRegion.setAttribute("aria-live", "polite");
    liveRegion.setAttribute("aria-atomic", "true");

    root.appendChild(cloud);
    root.appendChild(mascotBtn);
    root.appendChild(liveRegion);
    document.body.appendChild(root);

    setAnimState("sleeping");
    scheduleSleepEarTwitch();

    minBtn.addEventListener("click", () => dismissToSleep({}));
    closeBtn.addEventListener("click", () => dismissToSleep({ closeSession: true }));
    mascotBtn.addEventListener("click", () => {
      onMascotClick();
    });

    ctaEl.addEventListener("click", (e) => {
      if (ctaEl.getAttribute("aria-disabled") === "true") e.preventDefault();
    });

    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape" && bubbleOpen) {
          e.preventDefault();
          dismissToSleep({});
        }
      },
      true
    );

    document.addEventListener(
      "focusin",
      (e) => {
        if (isInteractiveTarget(e.target) && !root.contains(e.target)) setPaused(true);
      },
      true
    );
    document.addEventListener(
      "focusout",
      () => {
        window.setTimeout(() => {
          const active = document.activeElement;
          if (!isInteractiveTarget(active) || root.contains(active)) setPaused(false);
        }, 0);
      },
      true
    );

    /* Also postpone while typing/uploading even if focus left briefly */
    document.addEventListener(
      "input",
      (e) => {
        if (isInteractiveTarget(e.target) && !root.contains(e.target)) setPaused(true);
      },
      true
    );

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        bumpToken();
        clearAllTimers();
        runningCycle = false;
        setCloudPhase("hidden");
        bubbleOpen = false;
        setAnimState("sleeping");
        pendingResume = true;
      } else {
        if (animState === "sleeping") scheduleSleepEarTwitch();
        if (
          pendingResume &&
          !session.closedForSession &&
          session.autoShows < MAX_AUTO_SHOWS
        ) {
          pendingResume = false;
          scheduleWake(randBetween(BETWEEN_MIN, BETWEEN_MAX));
        }
      }
    });

    /* Start sleeping — no message on load; first wake after 8–15s */
    if (!session.closedForSession && session.autoShows < MAX_AUTO_SHOWS) {
      const first = randBetween(FIRST_IDLE_MIN, FIRST_IDLE_MAX);
      const cool = session.lastDismissAt
        ? Math.max(0, AFTER_DISMISS_MIN - (Date.now() - session.lastDismissAt))
        : 0;
      scheduleWake(Math.max(first, cool));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
