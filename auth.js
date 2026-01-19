/* =========================================================
   AUTH + USER STORE (localStorage-based)
   Works for local testing + GitHub Pages (static).
========================================================= */

const RT_STORE_KEY = "rt_users_v1";
const RT_SESSION_KEY = "rt_session_v1";

function rt_nowISO() {
  return new Date().toISOString();
}

function rt_loadUsers() {
  const raw = localStorage.getItem(RT_STORE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function rt_saveUsers(users) {
  localStorage.setItem(RT_STORE_KEY, JSON.stringify(users));
}

function rt_seedIfMissing() {
  const existing = rt_loadUsers();
  if (existing && Array.isArray(existing)) return;

  const seed = [
    {
      id: "u_admin_01",
      username: "Admin_01",
      password: "Admin@2026", // client-side only (training portal)
      role: "admin",
      status: "approved",     // approved | pending
      active: true,
      allowedProcesses: ["*"], // admin sees all
      createdAt: rt_nowISO(),
      updatedAt: rt_nowISO()
    },
    {
      id: "u_trainee_01",
      username: "Trainee_01",
      password: "Trainee@2026",
      role: "trainee",
      status: "approved",
      active: true,
      // If empty -> we will default to all processes enabled for trainees
      allowedProcesses: [],
      createdAt: rt_nowISO(),
      updatedAt: rt_nowISO()
    }
  ];

  rt_saveUsers(seed);
}

function rt_getUsers() {
  rt_seedIfMissing();
  return rt_loadUsers() || [];
}

function rt_setUsers(users) {
  rt_saveUsers(users);
}

function rt_findUserByUsername(username) {
  const users = rt_getUsers();
  return users.find(u => (u.username || "").toLowerCase() === (username || "").toLowerCase()) || null;
}

function rt_isValidUsername(username) {
  // simple: letters, numbers, underscore, hyphen; 3-32 chars
  return /^[A-Za-z0-9_-]{3,32}$/.test(username);
}

function rt_login(username, password) {
  const user = rt_findUserByUsername(username);
  if (!user) return { ok: false, reason: "Invalid username or password." };
  if (user.password !== password) return { ok: false, reason: "Invalid username or password." };
  if (user.status !== "approved") return { ok: false, reason: "Your account is pending approval. Please contact admin." };
  if (!user.active) return { ok: false, reason: "Your account is disabled. Please contact admin." };

  const session = {
    username: user.username,
    role: user.role,
    userId: user.id,
    loggedInAt: rt_nowISO()
  };
  localStorage.setItem(RT_SESSION_KEY, JSON.stringify(session));
  return { ok: true, user: session };
}

function rt_logout() {
  localStorage.removeItem(RT_SESSION_KEY);
}

function rt_getSession() {
  const raw = localStorage.getItem(RT_SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function rt_requireSessionOrRedirect(redirectTo) {
  const s = rt_getSession();
  if (!s) {
    window.location.href = redirectTo;
    return null;
  }
  return s;
}

function rt_requireAdminOrRedirect(redirectTo) {
  const s = rt_getSession();
  if (!s || s.role !== "admin") {
    window.location.href = redirectTo;
    return null;
  }
  return s;
}

function rt_createPendingAccount(username, password) {
  if (!rt_isValidUsername(username)) {
    return { ok: false, reason: "Username must be 3–32 characters: letters, numbers, underscore, hyphen." };
  }
  if (!password || password.length < 6) {
    return { ok: false, reason: "Password must be at least 6 characters." };
  }

  const users = rt_getUsers();
  if (users.some(u => (u.username || "").toLowerCase() === username.toLowerCase())) {
    return { ok: false, reason: "Username already exists." };
  }

  const newUser = {
    id: "u_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16),
    username,
    password,
    role: "trainee",
    status: "pending",
    active: true,
    allowedProcesses: [],
    createdAt: rt_nowISO(),
    updatedAt: rt_nowISO()
  };

  users.push(newUser);
  rt_setUsers(users);
  return { ok: true, user: newUser };
}

function rt_updateUser(userId, patch) {
  const users = rt_getUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx < 0) return { ok: false, reason: "User not found." };

  const updated = { ...users[idx], ...patch, updatedAt: rt_nowISO() };
  users[idx] = updated;
  rt_setUsers(users);
  return { ok: true, user: updated };
}

function rt_deleteUser(userId) {
  const users = rt_getUsers();
  const filtered = users.filter(u => u.id !== userId);
  rt_setUsers(filtered);
  return { ok: true };
}

/* For training page: compute visible processes for current user */
function rt_getVisibleProcessIdsForUser(user, allProcessIds, traineeEnabledIds) {
  if (!user) return [];

  if (user.role === "admin") {
    return allProcessIds; // admin sees all
  }

  // trainee:
  // Step 1: global trainee enabled
  const enabled = new Set(traineeEnabledIds && traineeEnabledIds.length ? traineeEnabledIds : allProcessIds);

  // Step 2: per-user allowed
  const allowed = user.allowedProcesses || [];
  if (!allowed.length) {
    // if no specific list -> default to enabled
    return allProcessIds.filter(id => enabled.has(id));
  }

  // support "*" wildcard (future-proof)
  if (allowed.includes("*")) {
    return allProcessIds.filter(id => enabled.has(id));
  }

  // intersection
  return allProcessIds.filter(id => enabled.has(id) && allowed.includes(id));
}

/* Admin can set global enabled processes for trainees */
const RT_TRAINING_SETTINGS_KEY = "rt_training_settings_v1";

function rt_getTrainingSettings() {
  const raw = localStorage.getItem(RT_TRAINING_SETTINGS_KEY);
  if (!raw) {
    const def = { traineeEnabledProcesses: [] }; // empty = all enabled
    localStorage.setItem(RT_TRAINING_SETTINGS_KEY, JSON.stringify(def));
    return def;
  }
  try { return JSON.parse(raw); } catch {
    const def = { traineeEnabledProcesses: [] };
    localStorage.setItem(RT_TRAINING_SETTINGS_KEY, JSON.stringify(def));
    return def;
  }
}

function rt_setTrainingSettings(settings) {
  localStorage.setItem(RT_TRAINING_SETTINGS_KEY, JSON.stringify(settings));
}
