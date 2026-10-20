(function () {
  const cfg = window.AIVOR_CONFIG || {};

  function bindConfigLinks() {
    document.querySelectorAll("[data-config-url]").forEach((el) => {
      const key = el.getAttribute("data-config-url");
      const url = cfg[key];
      if (url) {
        el.setAttribute("href", url);
        if (/^https?:/i.test(url)) {
          el.setAttribute("target", "_blank");
          el.setAttribute("rel", "noopener noreferrer");
        }
        el.classList.remove("is-disabled", "is-coming-soon");
        el.removeAttribute("aria-disabled");
        if (el.classList.contains("float-social__link") || el.classList.contains("header-social__link")) {
          el.removeAttribute("title");
          el.removeAttribute("tabindex");
        }
      } else {
        el.setAttribute("href", "#");
        el.classList.add("is-coming-soon");
        el.setAttribute("aria-disabled", "true");
        el.removeAttribute("target");
        el.removeAttribute("rel");
        el.addEventListener("click", (e) => e.preventDefault());
        const label = el.querySelector("[data-coming-soon-label]");
        if (label) label.textContent = "Coming soon";
        /* Floating / legacy header icons stay visible when URL is null; no invented href */
        if (el.classList.contains("float-social__link") || el.classList.contains("header-social__link")) {
          const name = (el.getAttribute("aria-label") || "Social").replace(/\s*[—-]\s*Coming soon$/i, "");
          el.setAttribute("aria-label", `${name} — Coming soon`);
          el.setAttribute("title", `${name} — Coming soon`);
          el.setAttribute("tabindex", "-1");
        }
      }
    });
  }

  function initFaq() {
    document.querySelectorAll(".faq-item").forEach((item) => {
      const btn = item.querySelector(".faq-q");
      const panel = item.querySelector(".faq-a");
      if (!btn || !panel) return;
      btn.addEventListener("click", () => {
        const open = item.classList.contains("is-open");
        document.querySelectorAll(".faq-item.is-open").forEach((other) => {
          if (other !== item) {
            other.classList.remove("is-open");
            const ob = other.querySelector(".faq-q");
            const op = other.querySelector(".faq-a");
            if (ob) ob.setAttribute("aria-expanded", "false");
            if (op) op.hidden = true;
          }
        });
        item.classList.toggle("is-open", !open);
        btn.setAttribute("aria-expanded", open ? "false" : "true");
        panel.hidden = open;
      });
    });
  }

  function initReveal() {
    const nodes = document.querySelectorAll(".reveal");
    if (!nodes.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach((n) => n.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
    );
    nodes.forEach((n) => io.observe(n));
  }

  function initCopyright() {
    document.querySelectorAll("[data-year]").forEach((el) => {
      el.textContent = String(new Date().getFullYear());
    });
  }

  function initHeroParticles() {
    const layer = document.querySelector("[data-particles]");
    if (!layer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const count = 18;
    for (let i = 0; i < count; i++) {
      const span = document.createElement("span");
      span.className = "hero-particle";
      span.style.left = `${Math.random() * 100}%`;
      span.style.top = `${Math.random() * 100}%`;
      span.style.animationDelay = `${(Math.random() * 6).toFixed(2)}s`;
      span.style.animationDuration = `${(5 + Math.random() * 7).toFixed(2)}s`;
      layer.appendChild(span);
    }
  }

  bindConfigLinks();
  initFaq();
  initReveal();
  initCopyright();
  initHeroParticles();
})();
