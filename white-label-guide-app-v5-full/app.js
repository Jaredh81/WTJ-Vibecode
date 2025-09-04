(function () {
  const PREVIEW = new URLSearchParams(location.search).get("preview") === "1";
  const STORAGE_KEY = "guidebook-draft";

  const brandName = document.getElementById("brandName");
  const brandLogo = document.getElementById("brandLogo");
  const grid = document.getElementById("grid");
  const search = document.getElementById("search");

  async function loadData() {
    if (PREVIEW) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) {
        console.warn("Draft parse failed", e);
      }
    }
    // fallback to /data/guide.json
    try {
      const res = await fetch("/data/guide.json", { cache: "no-store" });
      return await res.json();
    } catch (e) {
      console.warn("guide.json fetch failed", e);
      return { pages: [] };
    }
  }

  function applyTheme(d) {
    if (d.theme && d.theme.primary) {
      document.documentElement.style.setProperty("--primary", d.theme.primary);
    }
    if (d.theme && d.theme.logo) {
      brandLogo.src = d.theme.logo;
      brandLogo.style.display = "block";
    } else {
      brandLogo.style.display = "none";
    }
  }

  function render(d) {
    brandName.textContent = (d.property && d.property.name) || "Guide";

    const pages = (d.pages || []).filter((p) => p && p.enabled !== false);
    grid.innerHTML = "";

    pages.forEach((p) => {
      const card = document.createElement("button");
      card.className = "card";

      const ico = document.createElement("span");
      ico.className = "ico";
      ico.textContent = (p.icon && p.icon.emoji) || "★";

      const ttl = document.createElement("span");
      ttl.className = "ttl";
      ttl.textContent = p.title || p.name || "Untitled";

      card.append(ico, ttl);
      grid.appendChild(card);
    });
  }

  function wireSearch() {
    if (!search) return;
    search.addEventListener("input", () => {
      const q = search.value.toLowerCase();
      Array.from(grid.children).forEach((c) => {
        c.style.display = c.textContent.toLowerCase().includes(q) ? "" : "none";
      });
    });
  }

  loadData().then((d) => {
    applyTheme(d);
    render(d);
    wireSearch();
  });
})();
