/**
 * AIVOR dual theme — default dark on first visit; persist light|dark after user choice.
 * Early bootstrap (inline in <head>) mirrors resolveTheme() before paint (no FOUC).
 * Full UI (toggle) runs after DOM ready via init().
 * prefers-color-scheme never overrides a saved manual choice (and is not used for default).
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "aivor-theme";
  var THEMES = { light: "light", dark: "dark" };
  var DEFAULT_THEME = THEMES.dark;

  function readStored() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      if (v === THEMES.light || v === THEMES.dark) return v;
    } catch (e) { /* private mode */ }
    return null;
  }

  function resolveTheme(explicit) {
    if (explicit === THEMES.light || explicit === THEMES.dark) return explicit;
    return readStored() || DEFAULT_THEME;
  }

  function applyTheme(theme, opts) {
    var t = theme === THEMES.light ? THEMES.light : THEMES.dark;
    var root = document.documentElement;
    root.setAttribute("data-theme", t);
    try {
      if (!opts || opts.persist !== false) {
        localStorage.setItem(STORAGE_KEY, t);
      }
    } catch (e) { /* ignore */ }

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", t === THEMES.light ? "#F7FAFC" : "#0B0F14");
    }

    try {
      global.dispatchEvent(
        new CustomEvent("aivor:themechange", { detail: { theme: t } })
      );
    } catch (e) { /* IE ignore */ }

    syncToggles(t);
    return t;
  }

  function currentTheme() {
    var attr = document.documentElement.getAttribute("data-theme");
    if (attr === THEMES.light || attr === THEMES.dark) return attr;
    return resolveTheme();
  }

  function toggleTheme() {
    /* Always persist — this is an explicit user choice */
    return applyTheme(currentTheme() === THEMES.light ? THEMES.dark : THEMES.light);
  }

  function syncToggles(theme) {
    var t = theme || currentTheme();
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", t === THEMES.dark ? "true" : "false");
      btn.setAttribute(
        "aria-label",
        t === THEMES.dark ? "Switch to light theme" : "Switch to dark theme"
      );
      var label = btn.querySelector("[data-theme-toggle-label]");
      if (label) label.textContent = t === THEMES.dark ? "Light" : "Dark";
    });
  }

  function boot() {
    /* Do not persist on boot — only honor stored preference or dark default */
    applyTheme(resolveTheme(), { persist: false });
  }

  function init() {
    /* Re-apply so meta + toggles sync after DOM exists; do not write default to storage */
    var stored = readStored();
    applyTheme(resolveTheme(), { persist: !!stored });

    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      if (btn.getAttribute("data-theme-bound") === "1") return;
      btn.setAttribute("data-theme-bound", "1");
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        toggleTheme();
      });
    });
  }

  global.AIVOR_THEME = {
    boot: boot,
    init: init,
    apply: applyTheme,
    toggle: toggleTheme,
    current: currentTheme,
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT: DEFAULT_THEME
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
