(function () {
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll(".nav a[data-nav]").forEach((a) => {
    if (a.getAttribute("data-nav") === path) a.classList.add("active");
  });
})();
