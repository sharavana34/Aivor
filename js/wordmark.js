/**
 * AIVOR shared wordmark injector.
 * Upgrades any [data-aivor-mark] element into the premium AI/V/OR mark.
 * Fallback text "AIVOR" remains until this runs (SEO / no-JS).
 */
(function () {
  const SIZES = { nav: 1, hero: 1, footer: 1, title: 1, inline: 1 };

  function markHtml(size, opts) {
    const s = SIZES[size] ? size : "inline";
    const decorative = opts && opts.decorative;
    const open = decorative
      ? `<span class="aivor-mark aivor-mark--${s}" aria-hidden="true">`
      : `<span class="aivor-mark aivor-mark--${s}" role="img" aria-label="AIVOR">`;
    return (
      open +
      `<span class="aivor-mark__parts"${decorative ? "" : ' aria-hidden="true"'}>` +
      `<span class="aivor-mark__ai">AI</span>` +
      `<span class="aivor-mark__v"><span class="aivor-mark__v-core">V</span></span>` +
      `<span class="aivor-mark__or">OR</span>` +
      `</span></span>`
    );
  }

  function enhance(el) {
    if (!el || el.querySelector(".aivor-mark")) return;
    const size = el.getAttribute("data-aivor-size") || "inline";
    const decorative = el.closest("a.logo") != null || el.getAttribute("data-aivor-decorative") === "true";
    const prefix = el.getAttribute("data-aivor-prefix") || "";
    const suffix = el.getAttribute("data-aivor-suffix") || "";
    el.innerHTML = prefix + markHtml(size, { decorative: decorative }) + suffix;
  }

  function run() {
    document.querySelectorAll("[data-aivor-mark]").forEach(enhance);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }

  window.AIVOR_WORDMARK = { enhance: enhance, render: markHtml };
})();
