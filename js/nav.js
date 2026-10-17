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
    "analyze.html": ICON(
      '<path d="M4 19V5M4 19h16"/><rect x="7" y="11" width="2.5" height="5" rx=".4" fill="currentColor" stroke="none"/><rect x="11.25" y="8" width="2.5" height="8" rx=".4" fill="currentColor" stroke="none"/><rect x="15.5" y="5.5" width="2.5" height="10.5" rx=".4" fill="currentColor" stroke="none"/>'
    )
  };

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

  function initHeader() {
    const header = document.querySelector(".site-header");
    const toggle = document.querySelector(".nav-toggle");
    const nav = document.querySelector(".nav");
    if (!header) return;

    const inner = header.querySelector(".inner");
    const mobileMq = window.matchMedia("(max-width: 1100px)");

    /*
      Root-cause fix: .inner (and potentially .site-header stacking contexts)
      use backdrop-filter / filters that create a containing block for
      position:fixed descendants. A fixed .nav inside those nodes only covers
      the capsule — or keeps left/transform stuck at 100% of that box.
      On mobile, park .nav on document.body so fixed == viewport.
      On desktop, put it back inside .inner so display:contents grid still works.
    */
    const placeNav = () => {
      if (!nav || !inner) return;
      if (mobileMq.matches) {
        if (nav.parentElement !== document.body) {
          document.body.appendChild(nav);
        }
      } else if (nav.parentElement !== inner) {
        const anchor = toggle && toggle.parentElement === inner ? toggle : null;
        if (anchor) inner.insertBefore(nav, anchor);
        else inner.appendChild(nav);
      }
    };
    placeNav();
    if (typeof mobileMq.addEventListener === "function") {
      mobileMq.addEventListener("change", placeNav);
    } else if (typeof mobileMq.addListener === "function") {
      mobileMq.addListener(placeNav);
    }

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
      nav.style.setProperty("background", "rgba(8, 11, 16, 0.98)", "important");
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

    nav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => setOpen(false, { restoreFocus: false }));
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
