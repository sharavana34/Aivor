(function () {
  const ICON = (paths) =>
    `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;

  const NAV_ICONS = {
    "index.html": ICON('<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"/>'),
    "products.html": ICON(
      '<path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3zm0 0v18M4 7.5l8 4.5 8-4.5"/>'
    ),
    "copy-trading.html": ICON(
      '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'
    ),
    "performance.html": ICON('<path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-3"/>'),
    "how-it-works.html": ICON(
      '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8.2 7.5 10.5 15M15.8 7.5 13.5 15"/>'
    ),
    "faq.html": ICON(
      '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.2 1-1.2 2"/><circle cx="12" cy="17" r=".8" fill="currentColor" stroke="none"/>'
    ),
    "contact.html": ICON(
      '<path d="M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z"/>'
    ),
    /* Lucide-like file + bar chart (document analysis) */
    "analyze.html": ICON(
      '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M8 17v-3M12 17V9M16 17v-5"/>'
    )
  };

  /* Official brand mark paths (white fill on brand-coloured discs) */
  const SOCIAL_ICONS = {
    telegram:
      '<svg class="float-social__glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#fff" d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-2.82 2.35z"/></svg>',
    facebook:
      '<svg class="float-social__glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#fff" d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.4-.1-2.7-.1-2.7 0-4.5 1.6-4.5 4.6v1.8H7v3.1h2.6v8z"/></svg>',
    instagram:
      '<svg class="float-social__glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#fff" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>',
    whatsapp:
      '<svg class="float-social__glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#fff" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.85 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>'
  };

  const SOCIAL_ITEMS = [
    { id: "telegram", label: "Telegram", configKey: "TELEGRAM_CONTACT_URL", className: "float-social__link--telegram" },
    { id: "facebook", label: "Facebook", configKey: "FACEBOOK_URL", className: "float-social__link--facebook" },
    { id: "instagram", label: "Instagram", configKey: "INSTAGRAM_URL", className: "float-social__link--instagram" },
    { id: "whatsapp", label: "WhatsApp", configKey: "WHATSAPP_URL", className: "float-social__link--whatsapp" }
  ];

  function currentPage() {
    const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    return path === "" || path === "/" ? "index.html" : path;
  }

  function setActiveNav() {
    const page = currentPage();
    /* Detail route belongs under the Copy Trading directory nav item */
    const effective =
      page === "copy-trading-detail.html" ? "copy-trading.html" : page;
    document.querySelectorAll("[data-nav]").forEach((el) => {
      const nav = (el.getAttribute("data-nav") || "").toLowerCase();
      const active = nav === effective;
      el.classList.toggle("active", active);
      if (active) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });
  }

  function initNavIcons() {
    document.querySelectorAll("[data-nav]").forEach((a) => {
      if (a.querySelector(".nav-icon")) return;
      const key = (a.getAttribute("data-nav") || "").toLowerCase();
      const svg = NAV_ICONS[key];
      if (svg) a.insertAdjacentHTML("afterbegin", svg);
    });
  }

  function configUrl(key) {
    const cfg = window.AIVOR_CONFIG || {};
    const url = cfg[key];
    return typeof url === "string" && url.trim() ? url.trim() : null;
  }

  function bindSocialLink(el, url, label) {
    if (url) {
      el.setAttribute("href", url);
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
      el.classList.remove("is-coming-soon");
      el.removeAttribute("aria-disabled");
      el.removeAttribute("tabindex");
      el.setAttribute("aria-label", label);
      el.removeAttribute("title");
    } else {
      el.setAttribute("href", "#");
      el.classList.add("is-coming-soon");
      el.setAttribute("aria-disabled", "true");
      el.setAttribute("tabindex", "-1");
      el.removeAttribute("target");
      el.removeAttribute("rel");
      el.setAttribute("aria-label", label + " — Coming soon");
      el.setAttribute("title", label + " — Coming soon");
      el.addEventListener("click", (e) => e.preventDefault());
    }
  }

  function initFloatingSocial() {
    if (document.querySelector(".float-social")) return;

    const rail = document.createElement("aside");
    rail.className = "float-social";
    rail.setAttribute("aria-label", "Social media");

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "float-social__toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "float-social-list");
    toggle.setAttribute("aria-label", "Show social links");
    toggle.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7a3.3 3.3 0 0 0 0-1.39l7.02-4.11A2.99 2.99 0 1 0 14 5a3 3 0 0 0 .05.55L7.03 9.66a3 3 0 1 0 0 4.69l7.02 4.11c-.03.18-.05.36-.05.54a3 3 0 1 0 3-3z"/></svg>';

    const list = document.createElement("div");
    list.className = "float-social__list";
    list.id = "float-social-list";

    SOCIAL_ITEMS.forEach((item) => {
      const a = document.createElement("a");
      a.className = "float-social__link " + item.className;
      a.setAttribute("data-config-url", item.configKey);
      a.setAttribute("data-float-social", item.id);
      a.innerHTML = SOCIAL_ICONS[item.id] || "";
      bindSocialLink(a, configUrl(item.configKey), item.label);
      list.appendChild(a);
    });

    rail.appendChild(toggle);
    rail.appendChild(list);
    document.body.appendChild(rail);

    const mobileMq = window.matchMedia("(max-width: 768px)");
    const setExpanded = (open) => {
      rail.classList.toggle("is-expanded", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Hide social links" : "Show social links");
    };

    const syncMode = () => {
      if (mobileMq.matches) {
        rail.classList.add("is-compact");
        setExpanded(false);
      } else {
        rail.classList.remove("is-compact");
        setExpanded(true);
      }
    };
    syncMode();
    if (typeof mobileMq.addEventListener === "function") {
      mobileMq.addEventListener("change", syncMode);
    } else if (typeof mobileMq.addListener === "function") {
      mobileMq.addListener(syncMode);
    }

    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      setExpanded(!rail.classList.contains("is-expanded"));
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && rail.classList.contains("is-compact") && rail.classList.contains("is-expanded")) {
        setExpanded(false);
      }
    });
  }

  function initThemeToggle() {
    const actions = document.querySelector(".header-actions");
    if (!actions || actions.querySelector("[data-theme-toggle]")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-toggle";
    btn.setAttribute("data-theme-toggle", "");
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("aria-label", "Switch theme");
    btn.innerHTML =
      '<svg class="theme-toggle__icon theme-toggle__icon--moon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z"/></svg>' +
      '<svg class="theme-toggle__icon theme-toggle__icon--sun" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>' +
      '<span class="theme-toggle__label" data-theme-toggle-label>Theme</span>';

    const cta = actions.querySelector(".nav-cta");
    if (cta) actions.insertBefore(btn, cta);
    else actions.appendChild(btn);

    if (window.AIVOR_THEME && typeof window.AIVOR_THEME.init === "function") {
      window.AIVOR_THEME.init();
    }
  }

  function initHeader() {
    const header = document.querySelector(".site-header");
    const toggle = document.querySelector(".nav-toggle");
    const nav = document.querySelector(".nav");
    if (!header) return;

    /* Remove legacy header social cluster if any page still ships it */
    header.querySelectorAll(".header-social").forEach((el) => el.remove());

    initThemeToggle();
    initFloatingSocial();

    const inner = header.querySelector(".inner");
    const actions = inner && inner.querySelector(".header-actions");
    const mobileMq = window.matchMedia("(max-width: 1100px)");
    const cta = () => document.querySelector(".nav-cta");

    /*
      Structure (static HTML):
        .inner > .logo | .nav > .nav-links | .header-actions > (.theme-toggle + .nav-cta) | .nav-toggle

      Mobile drawer: .inner (and .site-header) use filters/backdrop that create a
      containing block for position:fixed. Park .nav on document.body so fixed
      covers the viewport. Move .nav-cta into the drawer (single node — no clone).

      Desktop: restore .nav inside .inner before .header-actions; restore CTA
      inside .header-actions after theme toggle.
    */
    const placeNav = () => {
      if (!nav || !inner) return;
      const analyzeCta = cta();
      const themeBtn = actions && actions.querySelector("[data-theme-toggle]");

      if (mobileMq.matches) {
        if (nav.parentElement !== document.body) {
          document.body.appendChild(nav);
        }
        if (analyzeCta && analyzeCta.parentElement !== nav) {
          nav.appendChild(analyzeCta);
        }
      } else {
        if (nav.parentElement !== inner) {
          const anchor =
            (actions && actions.parentElement === inner && actions) ||
            (toggle && toggle.parentElement === inner && toggle) ||
            null;
          if (anchor) inner.insertBefore(nav, anchor);
          else inner.appendChild(nav);
        }
        if (analyzeCta && actions) {
          if (analyzeCta.parentElement !== actions) {
            actions.appendChild(analyzeCta);
          }
          /* Keep theme toggle before Analyze CTA */
          if (themeBtn && themeBtn.parentElement === actions) {
            actions.insertBefore(themeBtn, analyzeCta);
          }
        }
      }
    };
    placeNav();
    if (typeof mobileMq.addEventListener === "function") {
      mobileMq.addEventListener("change", placeNav);
    } else if (typeof mobileMq.addListener === "function") {
      mobileMq.addListener(placeNav);
    }
    /* Catch late viewport / headless metric changes that skip matchMedia 'change' */
    window.addEventListener("load", placeNav);

    const onScroll = () => {
      header.classList.toggle("is-scrolled", window.scrollY > 16);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    if (!toggle || !nav) return;

    const applyDrawerBox = (open) => {
      if (!mobileMq.matches) {
        ["position","top","left","right","bottom","width","height","z-index",
         "opacity","visibility","pointer-events","transform","display",
         "flex-direction","overflow","padding","background","box-sizing"
        ].forEach((p) => nav.style.removeProperty(p));
        return;
      }
      /* Fully specify the drawer on the element — avoids containing-block and
         cascade fights that left stylesheet + partial inline metrics stuck. */
      nav.style.setProperty("display", "flex", "important");
      nav.style.setProperty("flex-direction", "column", "important");
      nav.style.setProperty("position", "fixed", "important");
      nav.style.setProperty("top", "0px", "important");
      nav.style.setProperty("bottom", "0px", "important");
      nav.style.setProperty("left", open ? "0px" : "100vw", "important");
      nav.style.setProperty("right", "auto", "important");
      nav.style.setProperty("width", "100vw", "important");
      nav.style.setProperty("height", "100dvh", "important");
      nav.style.setProperty("max-width", "100vw", "important");
      nav.style.setProperty("z-index", "60", "important");
      nav.style.setProperty("margin", "0", "important");
      nav.style.setProperty("box-sizing", "border-box", "important");
      nav.style.setProperty("overflow-x", "hidden", "important");
      nav.style.setProperty("overflow-y", "auto", "important");
      nav.style.setProperty("background", "var(--nav-drawer-bg)", "important");
      nav.style.setProperty("padding", "calc(var(--header-h, 64px) + 48px) var(--page-pad-x, 16px) 40px", "important");
      nav.style.setProperty("transform", "none", "important");
      nav.style.setProperty("opacity", open ? "1" : "0", "important");
      nav.style.setProperty("visibility", open ? "visible" : "hidden", "important");
      nav.style.setProperty("pointer-events", open ? "auto" : "none", "important");
    };

    const setOpen = (open, opts) => {
      const restoreFocus = !opts || opts.restoreFocus !== false;
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      document.body.classList.toggle("nav-open", open);
      applyDrawerBox(open);
      if (open) {
        const first = nav.querySelector("a");
        if (first) first.focus({ preventScroll: true });
      } else if (restoreFocus) {
        toggle.focus({ preventScroll: true });
      }
    };

    /* Sync closed drawer metrics after relocate */
    applyDrawerBox(false);

    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setOpen(!nav.classList.contains("is-open"));
    });

    /* Delegation so Analyze Report still closes the drawer after reparenting */
    nav.addEventListener("click", (e) => {
      const link = e.target && e.target.closest ? e.target.closest("a") : null;
      if (!link || !nav.contains(link)) return;
      setOpen(false, { restoreFocus: false });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        e.preventDefault();
        setOpen(false);
      }
    });

    /* Close when tapping the logo while the drawer is open */
    document.addEventListener("click", (e) => {
      if (!nav.classList.contains("is-open")) return;
      const t = e.target;
      if (nav.contains(t) || toggle.contains(t)) return;
      if (t.closest && t.closest(".logo")) {
        setOpen(false, { restoreFocus: false });
      }
    });

    window.addEventListener(
      "resize",
      () => {
        placeNav();
        if (!mobileMq.matches && nav.classList.contains("is-open")) {
          setOpen(false, { restoreFocus: false });
        }
      },
      { passive: true }
    );
  }

  setActiveNav();
  initNavIcons();
  initHeader();
})();
