/**
 * Copy Trading directory + detail view.
 * Directory: 7-column table, 12 product×broker rows, compact filters.
 */
(function () {
  const cfg = window.AIVOR_CONFIG || {};
  const meta = window.AIVOR_COPY_TRADING_META || {
    commissionLabel: "5%",
    commissionNote: "",
    defaultCopyUrlKey: "COPY_TRADING_URL",
    brokerCopyUrls: {},
    urlDisclosure: ""
  };
  const raw = Array.isArray(window.AIVOR_COPY_TRADING)
    ? window.AIVOR_COPY_TRADING
    : [];

  function resolveCopyUrl(entry) {
    if (!entry) return null;
    if (entry.externalCopyUrl) return entry.externalCopyUrl;
    const slot = entry.brokerCopyUrlSlot;
    const brokerMap = meta.brokerCopyUrls || {};
    if (slot && brokerMap[slot]) return brokerMap[slot];
    if (entry.externalCopyUrlKey && cfg[entry.externalCopyUrlKey]) {
      return cfg[entry.externalCopyUrlKey];
    }
    if (meta.defaultCopyUrlKey && cfg[meta.defaultCopyUrlKey]) {
      return cfg[meta.defaultCopyUrlKey];
    }
    return null;
  }

  function hydrate(entry) {
    return Object.assign({}, entry, {
      externalCopyUrl: resolveCopyUrl(entry),
      commissionLabel: meta.commissionLabel || "5%"
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

  /** Human-readable status — never render raw keys like live_LABEL. */
  function formatStatus(status) {
    const rawStatus = String(status == null ? "" : status).trim();
    if (!rawStatus) return "Not available";
    const cleaned = rawStatus
      .replace(/_LABEL$/i, "")
      .replace(/_/g, " ")
      .trim();
    const key = cleaned.toLowerCase();
    if (key === "live") return "Live";
    if (key === "pending" || key === "setup pending") return "Pending";
    if (key === "backtest" || key === "coming soon") return "Backtest";
    return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function formatPerformance(p) {
    if (!p) return "Not available";
    if (p.value != null && p.period) {
      return `${p.value} (${p.period})`;
    }
    if (p.value != null) return String(p.value);
    return p.label || "Not available";
  }

  function formatRisk(r) {
    if (!r) return "Not available";
    if (r.value != null) {
      return r.period ? `${r.value} (${r.period})` : String(r.value);
    }
    return r.label || "Not available";
  }

  function perfKindClass(p) {
    const kind = (p && p.kind) || "";
    if (kind === "live") return "ctd-perf--live";
    if (kind === "backtest") return "ctd-perf--backtest";
    return "ctd-perf--muted";
  }

  function statusClass(status) {
    const s = formatStatus(status).toLowerCase();
    if (s === "live") return "ctd-status--live";
    if (s === "backtest") return "ctd-status--backtest";
    if (s === "pending") return "ctd-status--pending";
    return "ctd-status--muted";
  }

  function detailHref(id) {
    return `copy-trading-detail.html?id=${encodeURIComponent(id)}`;
  }

  function productCell(entry) {
    const name = entry.productName || entry.strategyName || "";
    const iconKey = entry.productIcon || entry.productKey || "";
    const mono =
      entry.productMonogram ||
      (iconKey === "scalper" ? "SC" : iconKey === "swing" ? "SW" : "HF");
    const sub =
      entry.productSubline ||
      [entry.tradingStyle, entry.instrument].filter(Boolean).join(" · ");
    return `<div class="ctd-entity ctd-entity--product ctd-entity--${escapeHtml(iconKey)}">
      <span class="ctd-product-mono ctd-product-mono--${escapeHtml(iconKey)}" aria-hidden="true">${escapeHtml(mono)}</span>
      <span class="ctd-entity__text">
        <span class="ctd-entity__name">${escapeHtml(name)}</span>
        ${sub ? `<span class="ctd-entity__sub">${escapeHtml(sub)}</span>` : ""}
      </span>
    </div>`;
  }

  function brokerMonoHtml(tone, mono) {
    return `<span class="ctd-broker-mono ctd-broker-mono--${escapeHtml(tone)}" aria-hidden="true">${escapeHtml(mono)}</span>`;
  }

  function brokerCell(entry) {
    const tone = entry.brokerTone || "default";
    const mono = entry.brokerMonogram || (entry.broker || "?").slice(0, 2);
    const name = entry.broker || "";
    const logo = entry.brokerLogo;
    const mark = logo
      ? `<span class="ctd-broker-logo-wrap">
      <img class="ctd-broker-logo" src="${escapeHtml(logo)}" alt="" width="96" height="24" loading="lazy" decoding="async" data-broker-tone="${escapeHtml(tone)}" data-broker-mono="${escapeHtml(mono)}" onerror="this.onerror=null;var w=this.closest('.ctd-broker-logo-wrap');if(!w)return;var s=document.createElement('span');s.className='ctd-broker-mono ctd-broker-mono--'+(this.getAttribute('data-broker-tone')||'default');s.setAttribute('aria-hidden','true');s.textContent=this.getAttribute('data-broker-mono')||'';w.replaceWith(s);">
    </span>`
      : brokerMonoHtml(tone, mono);
    return `<div class="ctd-entity ctd-entity--broker">
      ${mark}
      <span class="ctd-entity__name">${escapeHtml(name)}</span>
    </div>`;
  }

  function commissionBadge(entry) {
    const label = entry.commissionLabel || meta.commissionLabel || "5%";
    return `<span class="ctd-commission" title="${escapeHtml(meta.commissionNote || "")}">${escapeHtml(label)}</span>`;
  }

  function riskCell(entry) {
    const r = entry.riskDrawdown;
    if (!r) {
      return `<span class="ctd-risk ctd-risk--muted">Not available</span>`;
    }
    if (r.href) {
      const kind = r.kind === "backtest" ? "backtest" : "live";
      return `<a class="ctd-risk ctd-risk--link ctd-risk--${kind}" href="${escapeHtml(r.href)}">${escapeHtml(formatRisk(r))}</a>`;
    }
    return `<span class="ctd-risk ctd-risk--muted">${escapeHtml(formatRisk(r))}</span>`;
  }

  function uniqueValues(mapFn) {
    const set = new Set();
    DATA.forEach((e) => {
      const v = mapFn(e);
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
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
      product:
        (document.getElementById("ctd-filter-product") || {}).value || "",
      broker: (document.getElementById("ctd-filter-broker") || {}).value || "",
      status: (document.getElementById("ctd-filter-status") || {}).value || "",
      search: (
        (document.getElementById("ctd-search") || {}).value || ""
      ).trim().toLowerCase()
    };
  }

  function matches(entry, f) {
    const productName = entry.productName || entry.strategyName;
    const statusLabel = formatStatus(entry.status);
    if (f.product && productName !== f.product) return false;
    if (f.broker && entry.broker !== f.broker) return false;
    if (f.status && statusLabel !== f.status) return false;
    if (f.search) {
      const blob = [
        productName,
        entry.broker,
        entry.tradingStyle,
        entry.instrument,
        entry.strategyId,
        statusLabel,
        formatPerformance(entry.performance),
        formatRisk(entry.riskDrawdown),
        entry.commissionLabel
      ]
        .join(" ")
        .toLowerCase();
      if (blob.indexOf(f.search) < 0) return false;
    }
    return true;
  }

  function statusRank(s) {
    const label = formatStatus(s);
    if (label === "Live") return 0;
    if (label === "Pending") return 1;
    if (label === "Backtest") return 2;
    return 3;
  }

  function sortEntries(list) {
    const productOrder = { "AIVOR HF": 0, "AIVOR Scalper": 1, "AIVOR Swing": 2 };
    const brokerOrder = {
      Vantage: 0,
      "IC Markets": 1,
      Exness: 2,
      OctaFX: 3
    };
    return list.slice().sort((a, b) => {
      const pa = productOrder[a.productName || a.strategyName] ?? 9;
      const pb = productOrder[b.productName || b.strategyName] ?? 9;
      if (pa !== pb) return pa - pb;
      const ba = brokerOrder[a.broker] ?? 9;
      const bb = brokerOrder[b.broker] ?? 9;
      if (ba !== bb) return ba - bb;
      return statusRank(a.status) - statusRank(b.status);
    });
  }

  function actionButton(entry) {
    if (entry.externalCopyUrl) {
      return `<a class="ctd-action-btn" href="${escapeHtml(entry.externalCopyUrl)}" target="_blank" rel="noopener noreferrer">Copy strategy</a>`;
    }
    return `<span class="ctd-action-btn is-coming-soon" aria-disabled="true">Copy strategy</span>`;
  }

  function renderTable(list) {
    const tbody = document.getElementById("ctd-tbody");
    if (!tbody) return;
    if (!list.length) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="ctd-empty">No setups match these filters.</td></tr>';
      return;
    }
    tbody.innerHTML = list
      .map((e) => {
        const statusLabel = formatStatus(e.status);
        return `<tr data-product="${escapeHtml(e.productKey || "")}" data-broker="${escapeHtml(e.brokerKey || "")}">
      <td data-label="Product / Strategy">${productCell(e)}</td>
      <td data-label="Broker">${brokerCell(e)}</td>
      <td data-label="Commission">${commissionBadge(e)}</td>
      <td data-label="Performance"><span class="ctd-perf ${perfKindClass(e.performance)}">${escapeHtml(formatPerformance(e.performance))}</span></td>
      <td data-label="Risk">${riskCell(e)}</td>
      <td data-label="Status"><span class="ctd-status ${statusClass(e.status)}">${escapeHtml(statusLabel)}</span></td>
      <td data-label="Action" class="ctd-td-action">${actionButton(e)}</td>
    </tr>`;
      })
      .join("");
  }

  function renderCards(list) {
    const root = document.getElementById("ctd-cards");
    if (!root) return;
    if (!list.length) {
      root.innerHTML =
        '<p class="ctd-empty glass-panel ctd-card">No setups match these filters.</p>';
      return;
    }
    root.innerHTML = list
      .map((e) => {
        const statusLabel = formatStatus(e.status);
        return `<article class="ctd-card glass-panel" role="listitem" data-product="${escapeHtml(e.productKey || "")}" data-broker="${escapeHtml(e.brokerKey || "")}">
  <div class="ctd-card-head">
    ${productCell(e)}
    <span class="ctd-status ${statusClass(e.status)}">${escapeHtml(statusLabel)}</span>
  </div>
  <dl class="ctd-card-meta">
    <div><dt>Broker</dt><dd>${brokerCell(e)}</dd></div>
    <div><dt>Commission</dt><dd>${commissionBadge(e)}</dd></div>
    <div><dt>Performance</dt><dd><span class="ctd-perf ${perfKindClass(e.performance)}">${escapeHtml(formatPerformance(e.performance))}</span></dd></div>
    <div><dt>Risk</dt><dd>${riskCell(e)}</dd></div>
  </dl>
  <div class="ctd-actions">${actionButton(e)}</div>
</article>`;
      })
      .join("");
  }

  function updateCount(n, total) {
    const el = document.getElementById("ctd-count");
    if (!el) return;
    const t = typeof total === "number" ? total : DATA.length;
    if (n === t) {
      el.textContent = n === 1 ? "1 setup" : `${n} setups`;
    } else {
      el.textContent = `${n} of ${t} setups`;
    }
  }

  function applyDirectory() {
    const f = getFilters();
    const filtered = sortEntries(DATA.filter((e) => matches(e, f)));
    renderTable(filtered);
    renderCards(filtered);
    updateCount(filtered.length, DATA.length);
  }

  function initDirectoryFilters() {
    fillSelect(
      document.getElementById("ctd-filter-product"),
      uniqueValues((e) => e.productName || e.strategyName),
      "All strategies"
    );
    fillSelect(
      document.getElementById("ctd-filter-broker"),
      uniqueValues((e) => e.broker),
      "All brokers"
    );
    fillSelect(
      document.getElementById("ctd-filter-status"),
      uniqueValues((e) => formatStatus(e.status)),
      "All statuses"
    );

    const ids = [
      "ctd-filter-product",
      "ctd-filter-broker",
      "ctd-filter-status",
      "ctd-search"
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
        applyDirectory();
      });
    }

    const note = document.getElementById("ctd-url-note");
    if (note && meta.urlDisclosure) {
      note.textContent = meta.urlDisclosure;
    }

    const feeNote = document.getElementById("ctd-fee-sample-note");
    if (feeNote && meta.commissionNote) {
      feeNote.textContent = meta.commissionNote;
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

    setText("ctd-d-title", entry.productName || entry.strategyName);
    setText("ctd-d-status", formatStatus(entry.status));
    const statusEl = document.getElementById("ctd-d-status");
    if (statusEl) {
      statusEl.className = `ctd-status ${statusClass(entry.status)}`;
    }
    setText(
      "ctd-d-strategy-id",
      entry.strategyId
        ? `Strategy ID ${entry.strategyId}`
        : "Strategy ID not assigned"
    );
    setText("ctd-d-broker", entry.broker);
    setText("ctd-d-platform", entry.platform || "Verify with broker");
    setText("ctd-d-account", entry.accountType || "Verify with broker");
    setText(
      "ctd-d-instruments",
      Array.isArray(entry.instruments) && entry.instruments.length
        ? entry.instruments.join(", ")
        : entry.instrument || "Verify with broker"
    );
    setText("ctd-d-style", entry.tradingStyle);
    setText("ctd-d-perf", formatPerformance(entry.performance));
    setText("ctd-d-risk", formatRisk(entry.riskDrawdown));
    setText("ctd-d-insight", entry.performanceInsight || "Not available");
    setText(
      "ctd-d-fee-provider",
      (entry.fees && entry.fees.provider) ||
        entry.commissionLabel ||
        meta.commissionLabel ||
        "Not available"
    );
    setText(
      "ctd-d-fee-broker",
      (entry.fees && entry.fees.broker) || "Verify with broker"
    );
    setText(
      "ctd-d-fee-note",
      (entry.fees && entry.fees.note) ||
        meta.commissionNote ||
        "Distinguish provider fees from broker spreads, swaps, and commissions."
    );
    setText("ctd-d-summary", (entry.details && entry.details.summary) || "");

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
        cta.textContent = "Copy strategy";
      } else {
        cta.href = "#";
        cta.removeAttribute("target");
        cta.removeAttribute("rel");
        cta.classList.add("is-coming-soon");
        cta.setAttribute("aria-disabled", "true");
        cta.textContent = "Copy strategy — not available yet";
        cta.onclick = (ev) => ev.preventDefault();
      }
    }

    document.title = `${entry.productName || entry.strategyName} · Copy Trading · AIVOR`;
  }

  function initDirectory() {
    if (!document.body.classList.contains("page-copy-directory")) return;
    initDirectoryFilters();
    applyDirectory();

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
    resolveCopyUrl,
    formatStatus,
    meta: meta
  };

  initDirectory();
  initDetail();
})();
