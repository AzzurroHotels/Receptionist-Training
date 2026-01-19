(function () {
  const session = rt_requireAdminOrRedirect("login.html");
  if (!session) return;

  rt_seedIfMissing();

  const goTrainingBtn = document.getElementById("goTrainingBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  const globalProcessList = document.getElementById("globalProcessList");
  const saveGlobalBtn = document.getElementById("saveGlobalBtn");
  const globalMsg = document.getElementById("globalMsg");

  const userTbody = document.getElementById("userTbody");
  const userMsg = document.getElementById("userMsg");

  // These must match process IDs used in index.html sections
  const ALL_PROCESSES = [
    { id: "quick-start", title: "Quick Start (First Day)" },
    { id: "check-in", title: "Check-In Process" },
    { id: "after-hours", title: "After-Hours / Late Check-In" },
    { id: "noise", title: "Common Complaint: Noise" },
    { id: "locked-out", title: "Lost Key / Locked Out" }
  ];

  function isProtectedUser(u) {
    // ✅ Only Admin_01 is protected (case-insensitive)
    return (u.username || "").toLowerCase() === "admin_01";
  }

  goTrainingBtn.addEventListener("click", () => (window.location.href = "index.html"));
  logoutBtn.addEventListener("click", () => {
    rt_logout();
    window.location.href = "login.html";
  });

  function setMsg(el, text, ok) {
    el.textContent = text || "";
    el.classList.toggle("ok", !!ok);
  }

  /* =========================
     GLOBAL TRAINEE VISIBILITY
  ========================= */
  function renderGlobalSettings() {
    const settings = rt_getTrainingSettings();
    const enabled = new Set(settings.traineeEnabledProcesses || []);

    globalProcessList.innerHTML = "";
    ALL_PROCESSES.forEach((p) => {
      const div = document.createElement("div");
      div.className = "checkItem";
      div.innerHTML = `
        <label>
          <input type="checkbox" data-gproc="${p.id}" ${enabled.has(p.id) ? "checked" : ""} />
          <div>
            <div><b>${p.title}</b></div>
            <div class="muted">Process ID: ${p.id}</div>
          </div>
        </label>
      `;
      globalProcessList.appendChild(div);
    });
  }

  saveGlobalBtn.addEventListener("click", () => {
    const checked = Array.from(document.querySelectorAll("input[data-gproc]"))
      .filter((i) => i.checked)
      .map((i) => i.getAttribute("data-gproc"));

    // If none checked => means "all enabled"
    rt_setTrainingSettings({ traineeEnabledProcesses: checked });
    setMsg(globalMsg, "Saved global trainee visibility settings.", true);
    setTimeout(() => setMsg(globalMsg, "", false), 1800);
  });

  /* =========================
     USERS TABLE
  ========================= */
  function renderUsers() {
    const users = rt_getUsers();
    userTbody.innerHTML = "";

    users.forEach((u) => {
      const protectedUser = isProtectedUser(u);
      const isAdmin = u.role === "admin";
      const allowed = u.allowedProcesses || [];

      const allowedSummary = isAdmin || allowed.includes("*")
        ? `<span class="pill">ALL</span>`
        : allowed.length
          ? allowed.map((pid) => `<span class="pill">${pid}</span>`).join("")
          : `<span class="pill">DEFAULT</span>`;

      const roleDisabled = protectedUser ? "disabled" : "";
      const statusDisabled = protectedUser ? "disabled" : "";
      const activeDisabled = protectedUser ? "disabled" : "";

      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td><b>${u.username}</b>${protectedUser ? ` <span class="pill">PROTECTED</span>` : ""}</td>

        <td>
          <select data-role="${u.id}" ${roleDisabled}>
            <option value="trainee" ${u.role === "trainee" ? "selected" : ""}>trainee</option>
            <option value="admin" ${u.role === "admin" ? "selected" : ""}>admin</option>
          </select>
        </td>

        <td>
          <select data-status="${u.id}" ${statusDisabled}>
            <option value="approved" ${u.status === "approved" ? "selected" : ""}>approved</option>
            <option value="pending" ${u.status === "pending" ? "selected" : ""}>pending</option>
          </select>
        </td>

        <td>
          <label style="display:flex;gap:8px;align-items:center">
            <input type="checkbox" data-active="${u.id}" ${u.active ? "checked" : ""} ${activeDisabled}/>
            <span>${u.active ? "Yes" : "No"}</span>
          </label>
        </td>

        <td>
          <div style="margin-bottom:6px">${allowedSummary}</div>

          ${
            isAdmin
              ? `<div class="muted">Admin sees all processes.</div>`
              : `
                <div class="muted">Choose allowed processes for this user:</div>
                <div style="display:grid;gap:6px;margin-top:8px">
                  ${ALL_PROCESSES.map(
                    (p) => `
                      <label style="display:flex;gap:8px;align-items:center">
                        <input type="checkbox" data-uproc="${u.id}" value="${p.id}" ${allowed.includes(p.id) ? "checked" : ""}/>
                        <span>${p.title}</span>
                      </label>
                    `
                  ).join("")}
                </div>
                <div class="muted" style="margin-top:8px">
                  If none selected, user will see global trainee-enabled processes (or all if global is blank).
                </div>
              `
          }
        </td>

        <td>
          ${
            protectedUser
              ? `<span class="muted">Protected</span>`
              : `
                <button class="smallBtn" data-approve="${u.id}">Approve</button>
                <button class="smallBtn" data-disable="${u.id}">${u.active ? "Disable" : "Enable"}</button>
                <button class="smallBtn" data-resetpw="${u.id}">Reset PW</button>
                <button class="smallBtn" data-delete="${u.id}">Delete</button>
              `
          }
        </td>
      `;

      userTbody.appendChild(tr);
    });

    wireUserEvents();
  }

  function wireUserEvents() {
    // Role changes
    document.querySelectorAll("select[data-role]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const userId = sel.getAttribute("data-role");
        const newRole = sel.value;

        if (newRole === "admin") {
          rt_updateUser(userId, { role: "admin", allowedProcesses: ["*"], status: "approved", active: true });
        } else {
          rt_updateUser(userId, { role: "trainee", allowedProcesses: [] });
        }

        setMsg(userMsg, "Updated role.", true);
        renderUsers();
        setTimeout(() => setMsg(userMsg, "", false), 1200);
      });
    });

    // Status changes
    document.querySelectorAll("select[data-status]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const userId = sel.getAttribute("data-status");
        rt_updateUser(userId, { status: sel.value });
        setMsg(userMsg, "Updated status.", true);
        setTimeout(() => setMsg(userMsg, "", false), 1200);
      });
    });

    // Active toggle
    document.querySelectorAll("input[data-active]").forEach((chk) => {
      chk.addEventListener("change", () => {
        const userId = chk.getAttribute("data-active");
        rt_updateUser(userId, { active: chk.checked });
        setMsg(userMsg, "Updated active flag.", true);
        setTimeout(() => setMsg(userMsg, "", false), 1200);
      });
    });

    // Per-user allowed processes (only for trainees)
    const grouped = new Map(); // userId -> [checkboxes]
    document.querySelectorAll("input[data-uproc]").forEach((chk) => {
      const userId = chk.getAttribute("data-uproc");
      if (!grouped.has(userId)) grouped.set(userId, []);
      grouped.get(userId).push(chk);
    });

    grouped.forEach((boxes, userId) => {
      boxes.forEach((b) => {
        b.addEventListener("change", () => {
          const selected = boxes.filter((x) => x.checked).map((x) => x.value);
          rt_updateUser(userId, { allowedProcesses: selected });
          setMsg(userMsg, "Saved allowed processes.", true);
          setTimeout(() => setMsg(userMsg, "", false), 1200);
        });
      });
    });

    // Approve
    document.querySelectorAll("button[data-approve]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const userId = btn.getAttribute("data-approve");
        rt_updateUser(userId, { status: "approved", active: true });
        setMsg(userMsg, "User approved.", true);
        renderUsers();
        setTimeout(() => setMsg(userMsg, "", false), 1200);
      });
    });

    // Disable / Enable
    document.querySelectorAll("button[data-disable]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const userId = btn.getAttribute("data-disable");
        const users = rt_getUsers();
        const u = users.find((x) => x.id === userId);
        if (!u) return;

        rt_updateUser(userId, { active: !u.active });
        setMsg(userMsg, u.active ? "User disabled." : "User enabled.", true);
        renderUsers();
        setTimeout(() => setMsg(userMsg, "", false), 1200);
      });
    });

    // Reset password
    document.querySelectorAll("button[data-resetpw]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const userId = btn.getAttribute("data-resetpw");
        const newPw = prompt("Enter new password (min 6 chars):");
        if (!newPw || newPw.length < 6) {
          setMsg(userMsg, "Password reset cancelled or too short.", false);
          return;
        }
        rt_updateUser(userId, { password: newPw });
        setMsg(userMsg, "Password updated.", true);
        setTimeout(() => setMsg(userMsg, "", false), 1500);
      });
    });

    // Delete
    document.querySelectorAll("button[data-delete]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const userId = btn.getAttribute("data-delete");
        const users = rt_getUsers();
        const u = users.find((x) => x.id === userId);

        if (!u) return;

        if ((u.username || "").toLowerCase() === "admin_01") {
          alert("Admin_01 is protected and cannot be deleted.");
          return;
        }

        if (!confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;

        rt_deleteUser(userId);
        setMsg(userMsg, "User deleted.", true);
        renderUsers();
        setTimeout(() => setMsg(userMsg, "", false), 1200);
      });
    });
  }

  // Init
  renderGlobalSettings();
  renderUsers();
})();
