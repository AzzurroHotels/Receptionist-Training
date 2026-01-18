(function () {
  const searchInput   = document.getElementById("searchInput");
  const clearBtn      = document.getElementById("clearBtn");
  const navList       = document.getElementById("navList");
  const searchMeta    = document.getElementById("searchMeta");
  const dropdown      = document.getElementById("searchDropdown");
  const lastUpdated   = document.getElementById("lastUpdated");

  const themeToggle   = document.getElementById("themeToggle");
  const iconMoon      = document.getElementById("iconMoon");
  const iconSun       = document.getElementById("iconSun");

  const adminBtn      = document.getElementById("adminBtn");
  const logoutBtn     = document.getElementById("logoutBtn");

  rt_seedIfMissing();
  const session = rt_getSession();
  if (!session) { window.location.href = "login.html"; return; }

  // UI buttons
  if (logoutBtn) logoutBtn.addEventListener("click", () => { rt_logout(); window.location.href = "login.html"; });
  if (adminBtn) {
    adminBtn.addEventListener("click", () => window.location.href = "admin.html");
    if (session.role !== "admin") adminBtn.style.display = "none";
  }

  const sectionsAll = Array.from(document.querySelectorAll(".docSection"));

  // Determine processes available
  const allProcessIds = sectionsAll.map(sec => sec.getAttribute("data-process-id")).filter(Boolean);

  // Find current user
  const user = rt_findUserByUsername(session.username);
  if (!user) { rt_logout(); window.location.href = "login.html"; return; }

  // Read global trainee settings
  const settings = rt_getTrainingSettings();
  const traineeEnabled = settings.traineeEnabledProcesses || [];

  // Compute visible process IDs based on user role + permissions
  const visibleProcessIds = rt_getVisibleProcessIdsForUser(user, allProcessIds, traineeEnabled);
  const visibleSet = new Set(visibleProcessIds);

  // Hide non-visible sections entirely
  sectionsAll.forEach(sec => {
    const pid = sec.getAttribute("data-process-id");
    sec.classList.toggle("hidden", !visibleSet.has(pid));
  });

  // Build list of visible sections (for nav + search)
  const sections = sectionsAll.filter(sec => !sec.classList.contains("hidden"));

  // If user has no visible processes, show message
  if (!sections.length) {
    document.querySelector(".content").innerHTML = `
      <div class="card">
        <h2>No processes assigned</h2>
        <p>Your account has no approved processes yet. Please contact admin.</p>
      </div>`;
    return;
  }

  /* =========================
     THEME
  ========================= */
  function updateThemeIcons(theme) {
    if (!iconMoon || !iconSun) return;
    if (theme === "dark") {
      iconMoon.classList.add("hidden");
      iconSun.classList.remove("hidden");
    } else {
      iconSun.classList.add("hidden");
      iconMoon.classList.remove("hidden");
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    updateThemeIcons(theme);
  }

  function initTheme() {
    const saved = localStorage.getItem("theme");
    applyTheme(saved === "dark" ? "dark" : "light");
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      applyTheme(current === "dark" ? "light" : "dark");
    });
  }

  /* =========================
     NAVIGATION (ONE SECTION AT A TIME)
  ========================= */
  function ensureIds() {
    sections.forEach((sec, i) => {
      if (!sec.id) sec.id = `sec-${i}`;
      const details = Array.from(sec.querySelectorAll("details.accordion"));
      details.forEach((d, j) => {
        if (!d.id) d.id = `${sec.id}-detail-${j}`;
      });
    });
  }

  function buildNav() {
    navList.innerHTML = "";
    sections.forEach((sec) => {
      const title = (sec.getAttribute("data-title") || sec.querySelector("h2")?.textContent || sec.id).trim();

      const li = document.createElement("li");
      const a  = document.createElement("a");
      a.href = "#";
      a.textContent = title;

      a.addEventListener("click", (e) => {
        e.preventDefault();
        showSection(sec.id, true);
        closeDropdown();
        clearSearchMeta();
      });

      li.appendChild(a);
      navList.appendChild(li);
    });
  }

  function setActiveNav(sectionId) {
    const links = Array.from(navList.querySelectorAll("a"));
    links.forEach((a) => a.classList.remove("active"));

    const sec = document.getElementById(sectionId);
    const title = (sec?.getAttribute("data-title") || sec?.querySelector("h2")?.textContent || "").trim();
    const match = links.find((a) => a.textContent.trim() === title);
    if (match) match.classList.add("active");
  }

  function showSection(sectionId, scrollTop) {
    sections.forEach((sec) => {
      sec.classList.toggle("hidden", sec.id !== sectionId);
      sec.style.display = "";
    });
    setActiveNav(sectionId);
    if (scrollTop) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* =========================
     SEARCH (INTELLIGENT JUMP)
  ========================= */
  function normalize(str) {
    return (str || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenize(str) {
    const s = normalize(str);
    return s ? s.split(" ") : [];
  }

  function buildSearchEntries() {
    const entries = [];

    sections.forEach((sec) => {
      const sectionTitle = (sec.getAttribute("data-title") || sec.querySelector("h2")?.textContent || sec.id).trim();
      const sectionTags  = (sec.getAttribute("data-tags") || "").trim();
      const sectionText  = `${sectionTitle} ${sectionTags} ${sec.textContent || ""}`;

      entries.push({
        type: "section",
        label: sectionTitle,
        meta: "Process",
        sectionId: sec.id,
        targetId: sec.id,
        text: sectionText
      });

      const details = Array.from(sec.querySelectorAll("details.accordion"));
      details.forEach((d) => {
        const title = (d.getAttribute("data-title") || d.querySelector("summary")?.textContent || d.id).trim();
        const keywords = (d.getAttribute("data-keywords") || "").trim();
        const text = `${title} ${keywords} ${d.textContent || ""}`;

        entries.push({
          type: "detail",
          label: title,
          meta: `Inside: ${sectionTitle}`,
          sectionId: sec.id,
          targetId: d.id,
          text
        });
      });
    });

    return entries;
  }

  function score(query, entry) {
    const qTokens = tokenize(query);
    const tTokens = tokenize(entry.text);
    if (!qTokens.length || !tTokens.length) return 0;

    let hits = 0;
    qTokens.forEach((t) => { if (tTokens.includes(t)) hits++; });

    let s = hits / qTokens.length;

    if (normalize(entry.label).includes(normalize(query))) s += 0.3;
    if (entry.type === "detail") s += 0.1;

    return s;
  }

  let SEARCH_ENTRIES = [];

  function findMatches(query) {
    return SEARCH_ENTRIES
      .map((e) => ({ e, s: score(query, e) }))
      .filter((x) => x.s > 0.15)
      .sort((a, b) => b.s - a.s)
      .slice(0, 6);
  }

  function clearSearchMeta() {
    if (searchMeta) searchMeta.textContent = "";
  }

  function closeDropdown() {
    if (!dropdown) return;
    dropdown.classList.add("hidden");
    dropdown.innerHTML = "";
  }

  function openDropdown(matches) {
    if (!dropdown || !matches.length) { closeDropdown(); return; }

    dropdown.innerHTML = "";
    matches.forEach(({ e }) => {
      const item = document.createElement("div");
      item.className = "searchItem";

      const t = document.createElement("div");
      t.className = "searchItemTitle";
      t.textContent = e.label;

      const m = document.createElement("div");
      m.className = "searchItemMeta";
      m.textContent = e.meta;

      item.appendChild(t);
      item.appendChild(m);

      item.addEventListener("click", () => jumpTo(e));
      dropdown.appendChild(item);
    });

    dropdown.classList.remove("hidden");
  }

  function highlight(el) {
    if (!el) return;
    el.classList.add("jumpHighlight");
    setTimeout(() => el.classList.remove("jumpHighlight"), 1600);
  }

  function jumpTo(entry) {
    showSection(entry.sectionId, false);
    closeDropdown();

    const target = document.getElementById(entry.targetId);
    if (target?.tagName?.toLowerCase() === "details") target.open = true;

    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    highlight(target);

    if (searchMeta) searchMeta.textContent = `Jumped to: ${entry.label}`;
  }

  let debounce = null;

  searchInput.addEventListener("input", () => {
    clearTimeout(debounce);
    const q = searchInput.value.trim();

    if (!q) { closeDropdown(); clearSearchMeta(); return; }

    debounce = setTimeout(() => {
      const matches = findMatches(q);
      openDropdown(matches);
      searchMeta.textContent = matches.length
        ? `Suggestions for: "${q}" (press Enter to jump)`
        : `No matches for: "${q}"`;
    }, 120);
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const matches = findMatches(searchInput.value);
      if (matches.length) jumpTo(matches[0].e);
    }
    if (e.key === "Escape") {
      closeDropdown();
      clearSearchMeta();
    }
  });

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    closeDropdown();
    clearSearchMeta();
    searchInput.focus();
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== searchInput) closeDropdown();
  });

  /* =========================
     INIT
  ========================= */
  ensureIds();
  buildNav();
  initTheme();

  SEARCH_ENTRIES = buildSearchEntries();

  // Show first visible section
  showSection(sections[0].id, false);

  if (lastUpdated) {
    lastUpdated.textContent = new Date().toLocaleDateString(undefined, {
      year: "numeric", month: "long", day: "numeric"
    });
  }
})();
