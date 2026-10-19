/**
 * FAQ page — search, category filters, accordion (ARIA + keyboard).
 * Scoped to .page-faq; does not rely on site.js initFaq.
 */
(function () {
  if (!document.body.classList.contains("page-faq")) return;

  const search = document.getElementById("faq-search");
  const clearBtn = document.getElementById("faq-clear");
  const categoryButtons = Array.from(document.querySelectorAll(".faq-cat"));
  const items = Array.from(document.querySelectorAll(".faq-acc-item"));
  const groups = Array.from(document.querySelectorAll(".faq-group"));
  const resultText = document.getElementById("faq-result-text");
  const empty = document.getElementById("faq-empty");

  if (!search || !clearBtn || !resultText || !empty) return;

  let selectedCategory = "all";

  function updateCategoryCounts() {
    const totals = { all: items.length };
    items.forEach((item) => {
      const cat = item.dataset.category;
      if (!cat) return;
      totals[cat] = (totals[cat] || 0) + 1;
    });
    categoryButtons.forEach((btn) => {
      const cat = btn.dataset.category;
      const countEl = btn.querySelector(".faq-cat-count");
      if (countEl && cat && totals[cat] != null) {
        countEl.textContent = String(totals[cat]);
      }
    });
  }

  function updateFilters() {
    const query = search.value.trim().toLowerCase();
    let visibleCount = 0;

    items.forEach((item) => {
      const categoryMatch =
        selectedCategory === "all" || item.dataset.category === selectedCategory;
      const textMatch = !query || item.innerText.toLowerCase().includes(query);
      const visible = categoryMatch && textMatch;
      item.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    groups.forEach((group) => {
      const hasVisible = Array.from(group.querySelectorAll(".faq-acc-item")).some(
        (item) => !item.hidden
      );
      group.hidden = !hasVisible;
    });

    resultText.innerHTML =
      "Showing <strong>" +
      visibleCount +
      "</strong> question" +
      (visibleCount === 1 ? "" : "s");

    empty.classList.toggle("is-visible", visibleCount === 0);
    empty.setAttribute("aria-hidden", visibleCount === 0 ? "false" : "true");
  }

  categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedCategory = button.dataset.category || "all";
      categoryButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", active ? "true" : "false");
      });
      updateFilters();
    });
  });

  search.addEventListener("input", updateFilters);

  clearBtn.addEventListener("click", () => {
    search.value = "";
    updateFilters();
    search.focus();
  });

  function setAccordionOpen(item, open) {
    const btn = item.querySelector(".faq-acc-q");
    const panel = item.querySelector(".faq-acc-a");
    if (!btn || !panel) return;
    item.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    panel.hidden = !open;
  }

  items.forEach((item) => {
    const btn = item.querySelector(".faq-acc-q");
    const panel = item.querySelector(".faq-acc-a");
    if (!btn || !panel) return;

    setAccordionOpen(item, false);

    btn.addEventListener("click", () => {
      const willOpen = !item.classList.contains("is-open");
      items.forEach((other) => {
        if (other !== item) setAccordionOpen(other, false);
      });
      setAccordionOpen(item, willOpen);
    });

    btn.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        btn.click();
      }
    });
  });

  updateCategoryCounts();
  updateFilters();
})();
