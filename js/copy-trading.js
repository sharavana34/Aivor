/**
 * Copy Trading directory + detail view.
 * Loads setups by unique id (not strategy name alone).
 */
(function () {
  const cfg = window.AIVOR_CONFIG || {};
  const raw = Array.isArray(window.AIVOR_COPY_TRADING)
    ? window.AIVOR_COPY_TRADING
    : [];

  function resolveCopyUrl(entry) {
    if (!entry) return null;
    if (entry.externalCopyUrl) return entry.externalCopyUrl;
    if (entry.externalCopyUrlKey && cfg[entry.externalCopyUrlKey]) {
      return cfg[entry.externalCopyUrlKey];
    }
    return null;
  }

  function hydrate(entry) {
    return Object.assign({}, entry, {
      externalCopyUrl: resolveCopyUrl(entry)
    });
  }

  const DATA = raw.map(hydrate);

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatPerformance(p) {
    if (!p) return "Not published";
    if (p.value != null && p.period) {
      return `${p.value} (${p.period})`;
    }
    if (p.value != null) return String(p.value);
    return p.label || "Not published";
  }

  function formatRisk(r) {
    if (!r) return "Verify with broker";
    if (r.value != null) {
      return r.period ? `${r.value} (${r.period})` : String(r.value);
    }
    return r.label || "Verify with broker";
  }

  function formatInstruments(list) {
    if (!Array.isArray(list) || !list.length) return "Verify with broker";
    return list.join(", ");
  }

  function statusClass(status) {
    const s = String(status || "").toLowerCase();
    if (s === "live") return "ctd-status--live";
    if (s.indexOf("coming") >= 0) return "ctd-status--soon";
    if (s.indexOf("pending") >= 0) return "ctd-status--pending";
    return "ctd-status--muted";
  }

  function detailHref(id) {
    return `copy-trading-detail.html?id=${encodeURIComponent(id)}`;
  }

  function uniqueValues(key, mapFn) {
    const set = new Set();
    DATA.forEach((e) => {
      if (key === "instruments") {
        (e.instruments || []).forEach((i) => set.add(i));
      } else if (mapFn) {
        set.add(mapFn(e));
      } else {
        set.add(e[key]);
      }
    });
    return Array.from(set).filter(Boolean).sort((a, b) =>
      String(a).localeCompare(String(b))
    );
  }

  function fillSelect(el, values, allLabel) {
    if (!el) return;
    el.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = allLabel;
    el.appendChild(optAll);
    values.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      el.appendChild(opt);
    });
  }

  function getFilters() {
    return {
      strategy: (document.getElementById("ctd-filter-strategy") || {}).value || "",
      broker: (document.getElementById("ctd-filter-broker") || {}).value || "",
      accountType: (document.getElementById("ctd-filter-account") || {}).value || "",
      instrument: (document.getElementById("ctd-filter-instrument") || {}).value || "",
      status: (document.getElementById("ctd-filter-status") || {}).value || "",
      search: ((document.getElementById("ctd-search") || {}).value || "").trim().toLowerCase(),
      sort: (document.getElementById("ctd-sort") || {}).value || "status"
    };
  }

  function matches(entry, f) {
    if (f.strategy && entry.strategyName !== f.strategy) return false;
    if (f.broker && entry.broker !== f.broker) return false;
    if (f.accountType && entry.accountType !== f.accountType) return false;
    if (f.status && entry.status !== f.status) return false;
    if (f.instrument) {
      const list = entry.instruments || [];
      if (!list.includes(f.instrument)) return false;
    }
    if (f.search) {
      const blob = [
        entry.strategyName,
        entry.broker,
        entry.platform,
        entry.accountType,
        entry.tradingStyle,
        entry.status,
        entry.strategyId,
        formatInstruments(entry.instruments),
        formatPerformance(entry.performance)
      ]
        .join(" ")
        .toLowerCase();
      if (blob.indexOf(f.search) < 0) return false;
    }
    return true;
  }

  function statusRank(s) {
    if (s === "Live") return 0;
    if (s === "Setup Pending") return 1;
    if (s === "Coming Soon") return 2;
    return 3;
  }

  function sortEntries(list, sortKey) {
    const out = list.slice();
    out.sort((a, b) => {
      if (sortKey === "strategy") {
        return a.strategyName.localeCompare(b.strategyName) || a.broker.localeCompare(b.broker);
      }
      if (sortKey === "broker") {
        return a.broker.localeCompare(b.broker) || a.strategyName.localeCompare(b.strategyName);
      }
      if (sortKey === "name") {
        return a.strategyName.localeCompare(b.strategyName);
      }
      /* default: status then strategy */
      const sr = statusRank(a.status) - statusRank(b.status);
      if (sr !== 0) return sr;
      return a.strategyName.localeCompare(b.strategyName) || a.broker.localeCompare(b.broker);
    });
    return out;
  }

  function actionButtons(entry, sizeClass) {
    const detail = `<a class="btn btn-secondary ${sizeClass}" href="${escapeHtml(detailHref(entry.id))}">View Details</a>`;
    let copyBtn;
    if (entry.externalCopyUrl) {
      copyBtn = `<a class="btn btn-primary ${sizeClass}" href="${escapeHtml(entry.externalCopyUrl)}" target="_blank" rel="noopener noreferrer">Copy Strategy</a>`;
    } else {
      copyBtn = `<span class="btn btn-ghost ${sizeClass} is-coming-soon" aria-disabled="true">Copy Strategy</span>`;
    }
    return `<div class="ctd-actions">${detail}${copyBtn}</div>`;
  }

  function renderTable(list) {
    const tbody = document.getElementById("ctd-tbody");
    if (!tbody) return;
    if (!list.length) {
      tbody.innerHTML =
        '<tr><td colspan="9" class="ctd-empty">No setups match these filters.</td></tr>';
      return;
    }
    tbody.innerHTML = list
      .map(
        (e) => `<tr>
      <td data-label="Strategy"><strong>${escapeHtml(e.strategyName)}</strong>${
          e.strategyId
            ? `<br><code class="ctd-id">${escapeHtml(e.strategyId)}</code>`
            : ""
        }</td>
      <td data-label="Broker">${escapeHtml(e.broker)}</td>
      <td data-label="Platform">${escapeHtml(e.platform)}</td>
      <td data-label="Account">${escapeHtml(e.accountType)}</td>
      <td data-label="Instruments">${escapeHtml(formatInstruments(e.instruments))}</td>
      <td data-label="Performance">${escapeHtml(formatPerformance(e.performance))}</td>
      <td data-label="Risk">${escapeHtml(formatRisk(e.riskDrawdown))}</td>
      <td data-label="Status"><span class="ctd-status ${statusClass(e.status)}">${escapeHtml(e.status)}</span></td>
      <td data-label="Actions">${actionButtons(e, "btn-sm")}</td>
    </tr>`
      )
      .join("");
  }

  function renderCards(list) {
    const wrap = document.getElementById("ctd-cards");
    if (!wrap) return;
    if (!list.length) {
      wrap.innerHTML = '<p class="ctd-empty">No setups match these filters.</p>';
      return;
    }
    wrap.innerHTML = list
      .map(
        (e) => `<article class="ctd-card glass-panel" data-id="${escapeHtml(e.id)}">
      <header class="ctd-card-head">
        <div>
          <h3>${escapeHtml(e.strategyName)}</h3>
          ${
            e.strategyId
              ? `<code class="ctd-id">${escapeHtml(e.strategyId)}</code>`
              : ""
          }
        </div>
        <span class="ctd-status ${statusClass(e.status)}">${escapeHtml(e.status)}</span>
      </header>
      <dl class="ctd-card-meta">
        <div><dt>Broker</dt><dd>${escapeHtml(e.broker)}</dd></div>
        <div><dt>Platform</dt><dd>${escapeHtml(e.platform)}</dd></div>
        <div><dt>Account</dt><dd>${escapeHtml(e.accountType)}</dd></div>
        <div><dt>Instruments</dt><dd>${escapeHtml(formatInstruments(e.instruments))}</dd></div>
        <div><dt>Style</dt><dd>${escapeHtml(e.tradingStyle)}</dd></div>
        <div><dt>Performance</dt><dd>${escapeHtml(formatPerformance(e.performance))}</dd></div>
        <div><dt>Risk / drawdown</dt><dd>${escapeHtml(formatRisk(e.riskDrawdown))}</dd></div>
      </dl>
      ${actionButtons(e, "btn-sm")}
    </article>`
      )
      .join("");
  }

  function updateCount(n) {
    const el = document.getElementById("ctd-count");
    if (!el) return;
    el.textContent = n === 1 ? "1 setup" : `${n} setups`;
  }

  function applyDirectory() {
    const f = getFilters();
    const filtered = sortEntries(DATA.filter((e) => matches(e, f)), f.sort);
    renderTable(filtered);
    renderCards(filtered);
    updateCount(filtered.length);
  }

  function initDirectoryFilters() {
    fillSelect(
      document.getElementById("ctd-filter-strategy"),
      uniqueValues("strategyName"),
      "All strategies"
    );
    fillSelect(
      document.getElementById("ctd-filter-broker"),
      uniqueValues("broker"),
      "All brokers"
    );
    fillSelect(
      document.getElementById("ctd-filter-account"),
      uniqueValues("accountType"),
      "All account types"
    );
    fillSelect(
      document.getElementById("ctd-filter-instrument"),
      uniqueValues("instruments"),
      "All instruments"
    );
    fillSelect(
      document.getElementById("ctd-filter-status"),
      uniqueValues("status"),
      "All statuses"
    );

    const ids = [
      "ctd-filter-strategy",
      "ctd-filter-broker",
      "ctd-filter-account",
      "ctd-filter-instrument",
      "ctd-filter-status",
      "ctd-search",
      "ctd-sort"
    ];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("change", applyDirectory);
      el.addEventListener("input", applyDirectory);
    });

    const reset = document.getElementById("ctd-reset");
    if (reset) {
      reset.addEventListener("click", () => {
        ids.forEach((id) => {
          const el = document.getElementById(id);
          if (!el) return;
          if (el.tagName === "SELECT") el.selectedIndex = 0;
          else el.value = "";
        });
        const sort = document.getElementById("ctd-sort");
        if (sort) sort.value = "status";
        applyDirectory();
      });
    }
  }

  function findById(id) {
    if (!id) return null;
    return DATA.find((e) => e.id === id) || null;
  }

  function readSetupId() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("id")) return params.get("id");
    const hash = window.location.hash.replace(/^#/, "");
    if (hash.startsWith("id=")) return decodeURIComponent(hash.slice(3));
    if (hash) return decodeURIComponent(hash);
    return null;
  }

  function renderDetail(entry) {
    const root = document.getElementById("ctd-detail");
    const missing = document.getElementById("ctd-detail-missing");
    if (!root) return;

    if (!entry) {
      root.hidden = true;
      if (missing) missing.hidden = false;
      return;
    }
    if (missing) missing.hidden = true;
    root.hidden = false;

    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setText("ctd-d-title", entry.strategyName);
    setText("ctd-d-status", entry.status);
    const statusEl = document.getElementById("ctd-d-status");
    if (statusEl) {
      statusEl.className = `ctd-status ${statusClass(entry.status)}`;
    }
    setText(
      "ctd-d-strategy-id",
      entry.strategyId ? `Strategy ID ${entry.strategyId}` : "Strategy ID not assigned"
    );
    setText("ctd-d-broker", entry.broker);
    setText("ctd-d-platform", entry.platform);
    setText("ctd-d-account", entry.accountType);
    setText("ctd-d-instruments", formatInstruments(entry.instruments));
    setText("ctd-d-style", entry.tradingStyle);
    setText("ctd-d-perf", formatPerformance(entry.performance));
    setText("ctd-d-risk", formatRisk(entry.riskDrawdown));
    setText("ctd-d-insight", entry.performanceInsight || "Not published");
    setText(
      "ctd-d-fee-provider",
      (entry.fees && entry.fees.provider) || "Not published"
    );
    setText(
      "ctd-d-fee-broker",
      (entry.fees && entry.fees.broker) || "Verify with broker"
    );
    setText(
      "ctd-d-fee-note",
      (entry.fees && entry.fees.note) ||
        "Distinguish provider fees from broker spreads, swaps, and commissions."
    );
    setText(
      "ctd-d-summary",
      (entry.details && entry.details.summary) || ""
    );

    const how = document.getElementById("ctd-d-howto");
    if (how) {
      const steps = (entry.details && entry.details.howTo) || [];
      how.innerHTML = steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("");
    }

    const notes = document.getElementById("ctd-d-notes");
    if (notes) {
      const list = (entry.details && entry.details.notes) || [];
      notes.innerHTML = list.map((s) => `<li>${escapeHtml(s)}</li>`).join("");
      notes.hidden = !list.length;
    }

    const cta = document.getElementById("ctd-d-copy");
    if (cta) {
      if (entry.externalCopyUrl) {
        cta.href = entry.externalCopyUrl;
        cta.target = "_blank";
        cta.rel = "noopener noreferrer";
        cta.classList.remove("is-coming-soon", "is-disabled");
        cta.removeAttribute("aria-disabled");
        cta.textContent = "Copy Strategy";
      } else {
        cta.href = "#";
        cta.removeAttribute("target");
        cta.removeAttribute("rel");
        cta.classList.add("is-coming-soon");
        cta.setAttribute("aria-disabled", "true");
        cta.textContent = "Copy Strategy — not available yet";
        cta.onclick = (ev) => ev.preventDefault();
      }
    }

    document.title = `${entry.strategyName} · Copy Trading · AIVOR`;
  }

  function initDirectory() {
    if (!document.body.classList.contains("page-copy-directory")) return;
    initDirectoryFilters();
    applyDirectory();

    /* Optional deep-link: ?id= or #id= opens detail page */
    const id = readSetupId();
    if (id && findById(id)) {
      window.location.replace(detailHref(id));
    }
  }

  function initDetail() {
    if (!document.body.classList.contains("page-copy-detail")) return;
    const id = readSetupId();
    renderDetail(findById(id));
    window.addEventListener("hashchange", () => {
      renderDetail(findById(readSetupId()));
    });
  }

  window.AIVOR_COPY_TRADING_API = {
    getAll: () => DATA.slice(),
    getById: findById,
    resolveCopyUrl
  };

  initDirectory();
  initDetail();
})();
