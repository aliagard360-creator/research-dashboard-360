// RESEARCH DASHBOARD 360 — router, splash, sign-in, setup and registration.
import { PREVIEW_MODE, CLOUD, CONFIG } from "./config.js?v=202611230828";
import { icon } from "./icons.js?v=202611230828";
import { db, passwordProblem } from "./store.js?v=202611230828";
import { esc, toast, modal, attachStrength } from "./ui.js?v=202611230828";
import { shell, bindShell, LOGO } from "./shell.js?v=202611230828";
import { homeHtml, bindHome } from "./home.js?v=202611230828";
import { projectsPage, projectDetail, repositoryPage, notificationsPage, calendarPage, settingsPage, helpPage } from "./pages.js?v=202611230828";
import { profilePage } from "./profile.js?v=202611230828";
import { schoolDirectory, schoolPage, publicSchoolHtml } from "./school.js?v=202611230828";
import { teacherDashboard, wizardPage } from "./teacher.js?v=202611230828";
import { adminDashboard, analyticsPage, queuePage, evaluationPage, workflowPage, monitoringPage, schoolsPage, usersPage, reportsPage, auditPage } from "./admin.js?v=202611230828";
import { cmsPage } from "./cms.js?v=202611230828";
import { categoryPage, publicCategoryHtml } from "./category.js?v=202611230828";
import { installUx, afterNavigate } from "./ux.js?v=202611230828";
import { privacyPage, guidePage } from "./info.js?v=202611230828";

const app = document.getElementById("app");
if (window.__rd360Framed) throw new Error("RESEARCH DASHBOARD 360 cannot be shown inside another website.");
const isAdminRole = (u) => ["admin", "superadmin", "evaluator"].includes(u?.role);
export const portalHome = (u) => (u.role === "teacher" ? "#/t/dashboard" : u.role === "evaluator" ? "#/a/evaluation" : "#/a/dashboard");

function parse() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, qs] = raw.split("?");
  return { parts: path.split("/").filter(Boolean), q: new URLSearchParams(qs || "") };
}
const banner = () => PREVIEW_MODE ? `<div class="preview-banner" role="note">${icon("info")}<span><b>Local mode:</b> accounts and records are saved only in this browser until the district database is connected.</span></div>` : "";

function render() {
  const { parts, q } = parse();
  const user = db.currentUser();
  const [seg, page = "dashboard", arg] = parts;

  // public pages
  if (!seg) {
    const c = db.cmsPublished() || db.cmsDraft();
    return paint(banner() + homeHtml(user, c), (r) => bindHome(r, render), "RESEARCH DASHBOARD 360 — Schools District of Aliaga");
  }
  if (seg === "preview") { // draft preview for the Home Page Editor (admins only)
    if (!user || !["admin", "superadmin"].includes(user.role)) { location.hash = "#/"; return; }
    return paint(`<div class="preview-banner">${icon("eye")}<span><b>Draft preview</b> — visitors can't see these changes until they're published.</span></div>` + homeHtml(user, db.cmsDraft(), { preview: true }), (r) => bindHome(r, render), "Draft preview");
  }
  if (seg === "setup") return db.setupRequired() ? paint(banner() + setupPage(), bindSetup, "First-time setup") : (location.hash = "#/login/admin", undefined);
  if (seg === "login") {
    if (user) { location.hash = portalHome(user); return; }
    return paint(banner() + loginPage(page === "admin" ? "admin" : "teacher"), bindLogin, page === "admin" ? "Administrator sign in" : "Sign in");
  }
  if (seg === "schools" || seg === "school") {
    const sp = seg === "schools" ? schoolDirectory(null, user, q) : schoolPage(null, user, page === "dashboard" ? "" : page);
    if (!sp) { location.hash = "#/schools"; return; }
    return paint(banner() + publicSchoolHtml(user, sp), (r) => sp.bind?.(r), `${sp.title} — RESEARCH DASHBOARD 360`);
  }
  if (seg === "category") {
    const cp = categoryPage(null, user, page === "dashboard" ? "" : page);
    if (!cp) { location.hash = "#/"; return; }
    return paint(banner() + publicCategoryHtml(user, cp), (r) => cp.bind(r), `${cp.title} — RESEARCH DASHBOARD 360`);
  }
  if (seg === "privacy" || seg === "guide") {
    const ip = seg === "privacy" ? privacyPage() : guidePage(user);
    return paint(banner() + publicSchoolHtml(user, ip), (r) => ip.bind(r), `${ip.title} — RESEARCH DASHBOARD 360`);
  }
  if (seg === "register") return paint(banner() + registerPage(), bindRegister, "Create an account");
  if (seg === "pending") {
    if (!user) { location.hash = "#/login/teacher"; return; }
    if (user.status === "active") { location.hash = portalHome(user); return; }
    return paint(banner() + pendingPage(user), (r) => bindPending(r, user), "Waiting for approval");
  }
  if (seg === "reset-password") {
    if (!user) { window.__rd360LoginNote = "That password reset link has expired. Request a new one with “Forgot your password?”."; location.hash = "#/login/teacher"; return; }
    return paint(banner() + resetPage(user), (r) => bindReset(r, user), "Set a new password");
  }
  if (seg === "change-password") {
    if (!user) { location.hash = "#/login/teacher"; return; }
    return paint(banner() + changePasswordPage(user), (r) => bindChangePassword(r, user), "Change your password");
  }

  // protected portals
  const portal = seg === "t" ? "t" : seg === "a" ? "a" : null;
  if (!portal) { location.hash = "#/"; return; }
  if (!user && window.__rd360Revoked) { window.__rd360Revoked = false; window.__rd360LoginNote = "You were signed out because this session was ended from another device. If that wasn't you, change your password."; toast("You were signed out because this session was ended from another device.", "warn"); location.hash = `#/login/${portal === "a" ? "admin" : "teacher"}`; return; }
  if (!user && window.__rd360Expired) { window.__rd360Expired = false; idleWarn?.remove(); idleWarn = null; window.__rd360LoginNote = `You were signed out after ${db.idleMinutes()} minutes without activity, to keep your account safe.`; toast(`You were signed out after ${db.idleMinutes()} minutes without activity.`, "warn"); location.hash = `#/login/${portal === "a" ? "admin" : "teacher"}`; return; }
  if (!user) { toast("Please sign in to continue."); location.hash = `#/login/${portal === "a" ? "admin" : "teacher"}`; return; }
  if (user.must_change) { location.hash = "#/change-password"; return; }
  if (user.status !== "active") { location.hash = "#/pending"; return; } // not yet approved: status page only
  if (portal === "t" && user.role !== "teacher") { location.hash = portalHome(user); return; }
  if (portal === "a" && !isAdminRole(user)) { toast("You don't have access to the Administrator Portal.", "err"); location.hash = portalHome(user); return; }
  const adminOnly = ["dashboard", "analytics", "research", "queue", "workflow", "monitoring", "repository", "schools", "users", "reports", "audit", "cms"];
  if (portal === "a" && user.role === "evaluator" && adminOnly.includes(page)) { location.hash = "#/a/evaluation"; return; }

  if (["admin", "superadmin"].includes(user.role)) db.runReminders();
  const views = portal === "t" ? {
    dashboard: () => teacherDashboard(user),
    projects: () => projectsPage("t", user, q),
    submit: () => wizardPage(user, q),
    project: () => projectDetail("t", user, arg, q),
    repository: () => repositoryPage("t", user, q),
    notifications: () => notificationsPage("t", user),
    calendar: () => calendarPage("t", user, q),
    profile: () => profilePage("t", user),
    settings: () => settingsPage("t", user),
    help: () => helpPage("t"),
    category: () => categoryPage("t", user, arg),
    schools: () => schoolDirectory("t", user, q),
    school: () => schoolPage("t", user, arg),
  } : {
    dashboard: () => adminDashboard(user),
    analytics: () => analyticsPage(user, q),
    research: () => projectsPage("a", user, q, { page: "research" }),
    queue: () => queuePage(user),
    evaluation: () => evaluationPage(user),
    workflow: () => workflowPage(),
    monitoring: () => monitoringPage(user),
    repository: () => repositoryPage("a", user, q),
    cms: () => cmsPage(user, q),
    schools: () => schoolsPage(user),
    users: () => usersPage(user, q),
    reports: () => reportsPage(user, q),
    notifications: () => notificationsPage("a", user),
    calendar: () => calendarPage("a", user, q),
    audit: () => auditPage(user, q),
    settings: () => settingsPage("a", user),
    profile: () => profilePage("a", user),
    help: () => helpPage("a"),
    project: () => projectDetail("a", user, arg, q),
    category: () => categoryPage("a", user, arg),
    school: () => schoolPage("a", user, arg),
  };
  const view = views[page];
  if (!view) { location.hash = portalHome(user); return; }
  let v;
  try { v = view(); if (!v) { location.hash = portalHome(user); return; } }
  catch (err) {
    console.error(err);
    v = { title: "Something went wrong", html: `<div class="card"><div class="empty"><div class="ic">${icon("alert")}</div><h3>This page couldn't load</h3><p>${esc(err.message)}</p><button class="btn btn-ink" data-reload>Try again</button></div></div>` };
  }
  const activeKey = page === "project" ? (portal === "t" ? "projects" : "research") : page === "school" ? "schools" : page === "category" ? `category/${String(arg || "").toUpperCase()}` : page;
  paint(banner() + shell(portal, user, activeKey, v), (root) => { bindShell(root, portal, user, render); v.bind?.(root); }, `${v.title} — RESEARCH DASHBOARD 360`);
}

let lastPath = null;
function paint(html, bind, title) {
  app.innerHTML = html;
  bind?.(app);
  app.querySelectorAll("[data-reload]").forEach((b) => b.addEventListener("click", () => location.reload()));
  if (title) document.title = title;
  const path = location.hash.split("?")[0];
  if (path !== lastPath) { const first = lastPath === null; window.scrollTo(0, 0); lastPath = path; afterNavigate(app, first); }
  if (window.__rd360Focus) { const el = app.querySelector(`[name="${window.__rd360Focus}"]`); if (el) { el.focus(); const n = el.value.length; el.setSelectionRange?.(n, n); } window.__rd360Focus = null; }
  const splash = document.getElementById("splash");
  if (splash && !splash.classList.contains("done")) { splash.classList.add("done"); setTimeout(() => splash.remove(), 400); }
}

/* ---------- shared form helpers ---------- */
const pwField = (name, label, auto, hint = "") => `<label class="field"><span class="req">${label}</span><span class="pw-wrap"><input type="password" name="${name}" autocomplete="${auto}" required><button type="button" data-showpw aria-label="Show password">${icon("eye")}</button></span>${hint ? `<span class="hint">${hint}</span>` : ""}</label>`;
function bindPwToggles(root) {
  attachStrength(root);
  root.querySelectorAll("[data-showpw]").forEach((b) => b.addEventListener("click", () => {
    const inp = b.previousElementSibling; const show = inp.type === "password";
    inp.type = show ? "text" : "password"; b.setAttribute("aria-label", show ? "Hide password" : "Show password");
  }));
}
function showErrors(form, errors) {
  form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
  form.querySelectorAll(".err").forEach((el) => el.remove());
  form.querySelector(".error-summary")?.remove();
  if (!errors.length) return false;
  for (const [name, msg] of errors) {
    const el = form.querySelector(`[name="${name}"]`);
    if (el) { el.setAttribute("aria-invalid", "true"); (el.closest(".pw-wrap") || el).insertAdjacentHTML("afterend", `<span class="err">${esc(msg)}</span>`); }
  }
  form.insertAdjacentHTML("afterbegin", `<div class="error-summary" role="alert"><b>Please fix ${errors.length === 1 ? "this" : `these ${errors.length}`}:</b><ul>${errors.map(([, m]) => `<li>${esc(m)}</li>`).join("")}</ul></div>`);
  form.querySelector("[aria-invalid]")?.focus();
  return true;
}
const busy = (btn, text) => { btn.disabled = true; btn.dataset.label = btn.innerHTML; btn.innerHTML = `<span class="mini-loader" style="color:inherit">${text}</span>`; };
const idle = (btn) => { btn.disabled = false; btn.innerHTML = btn.dataset.label; };
const authHead = (badge, admin) => `<a class="brand" href="#/"><img class="brand-logo" src="${LOGO}" alt="Aliaga District seal"><div><b>RESEARCH DASHBOARD 360</b><small>Schools District of Aliaga</small></div></a>
  <span class="auth-badge ${admin ? "admin" : ""}">${icon(admin ? "shield" : "grad")}${badge}</span>`;

/* ======================= first-time setup ======================= */
function setupPage() {
  return `<div class="auth-wrap"><div class="auth-card">
    ${authHead("First-time setup", true)}
    <h1>Create the Super Administrator</h1>
    <p class="muted small">This account manages the whole system: schools, user roles, settings and the public home page. It can only be created once.</p>
    <form class="stack" data-setup novalidate>
      <label class="field"><span class="req">Full name</span><input name="name" autocomplete="name" required></label>
      ${CLOUD ? `<label class="field">Super Administrator email<input type="email" name="email" value="${esc(CONFIG.SUPERADMIN_EMAIL)}" readonly><span class="hint">Only this district account can be the Super Administrator.</span></label><input type="hidden" name="username" value="">`
        : `<label class="field"><span class="req">Username</span><input name="username" autocomplete="username" placeholder="e.g. RD360ADMIN" required><span class="hint">Used to sign in. Not case-sensitive.</span></label>
      <label class="field">Email (optional)<input type="email" name="email" autocomplete="email"><span class="hint">You can also sign in with this email.</span></label>`}
      ${pwField("password", "Password", "new-password", "At least 8 characters, with letters and numbers.")}
      ${pwField("password2", "Confirm password", "new-password")}
      <button class="btn btn-ink">Create Super Administrator</button>
    </form>
    <a class="small" href="#/">${icon("left")} Back to home</a></div></div>`;
}
function bindSetup(root) {
  bindPwToggles(root);
  const form = root.querySelector("[data-setup]");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const errs = [];
    if (!d.name.trim()) errs.push(["name", "Enter your full name."]);
    if (!CLOUD && !d.username.trim()) errs.push(["username", "Choose a username."]);
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) errs.push(["email", "Enter a valid email address."]);
    const pp = passwordProblem(d.password, d); if (pp) errs.push(["password", pp]);
    if (d.password !== d.password2) errs.push(["password2", "Passwords don't match."]);
    if (showErrors(form, errs)) return;
    const btn = form.querySelector("button.btn"); busy(btn, "Creating account…");
    try {
      const u = await db.createSuperAdmin(d);
      if (u.confirm) {
        root.querySelector(".auth-card").innerHTML = `${authHead("Almost done", true)}<div class="empty"><div class="ic">${icon("mail")}</div><h3>Confirm the email address</h3>
          <p>We sent a confirmation link to <b>${esc(CONFIG.SUPERADMIN_EMAIL)}</b>. Open it, then sign in on the Administrator page.</p><a class="btn btn-ink" href="#/login/admin">Administrator sign in</a></div>`;
        return;
      }
      db.signIn(u.id); toast("Super Administrator created. Welcome!");
      location.hash = "#/a/dashboard";
    } catch (err) { idle(btn); toast(err.message, "err"); }
  });
}

/* ======================= sign in ======================= */
function loginPage(kind) {
  const admin = kind === "admin";
  return `<div class="auth-wrap"><div class="auth-card">
    ${authHead(admin ? "Administrator Portal" : "Teacher / Researcher Portal", admin)}
    <h1>${admin ? "Administrator sign in" : "Welcome back"}</h1>
    ${window.__rd360LoginNote ? `<div class="notice warn" role="status">${icon("clock")}<span>${esc(window.__rd360LoginNote)}</span></div>` : ""}
    ${db.setupRequired() ? `<div class="notice warn">${icon("key")}<span>No accounts exist yet. <a href="#/setup">Run first-time setup</a> to create the Super Administrator.</span></div>` : ""}
    <form class="stack" data-login novalidate>
      <label class="field"><span class="req">${admin && !CLOUD ? "Username or email" : admin ? "Email" : "Institutional email"}</span><input name="id" type="${admin && !CLOUD ? "text" : "email"}" autocomplete="username" required></label>
      ${pwField("password", "Password", "current-password")}
      <button class="btn ${admin ? "btn-green" : "btn-ink"}">Sign in</button>
      <a class="small" href="#" data-forgot>Forgot your password?</a>
    </form>
    ${admin ? `<p class="small muted">Administrator and evaluator accounts are created by the Super Administrator. There is no public registration.</p>` : `<div class="divider">New to RD360?</div><a class="btn btn-ghost" href="#/register">Create a teacher account</a>`}
    <div class="row between small"><a href="#/">${icon("left")} Home</a><a href="#/login/${admin ? "teacher" : "admin"}">${admin ? "Teacher sign in" : "Administrator sign in"}</a></div>
  </div></div>`;
}
function bindLogin(root) {
  bindPwToggles(root);
  const form = root.querySelector("[data-login]");
  root.querySelector("[data-forgot]").addEventListener("click", async (e) => {
    e.preventDefault();
    if (CLOUD) {
      const r = await modal({ title: "Reset your password", body: "Enter your account email. We'll send a link to set a new password.", fields: [{ name: "email", label: "Email", type: "email", required: true, value: form.id.value }], confirm: "Send reset link" });
      if (!r) return;
      try { await db.sendPasswordReset(r.email); toast("If that email has an account, a reset link is on its way. Check your inbox and spam folder."); } catch (err) { toast(err.message, "err"); }
      return;
    }
    modal({ title: "Reset your password", body: "Contact the District Research Coordinator or the Super Administrator. They can set a temporary password for your account, which you'll change the next time you sign in. Self-service email reset will be available once the district database is connected.", confirm: "OK", cancel: "Close" });
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const errs = [];
    if (!d.id.trim()) errs.push(["id", "Enter your username or email."]);
    if (!d.password) errs.push(["password", "Enter your password."]);
    if (showErrors(form, errs)) return;
    const btn = form.querySelector("button.btn"); busy(btn, "Signing in…");
    try {
      const u = await db.authenticate(d.id, d.password);
      window.__rd360LoginNote = null;
      const alerts = db.signIn(u.id);
      alerts.forEach((a) => toast(a, "warn"));
      showTransition();
      location.hash = u.must_change ? "#/change-password" : u.status !== "active" ? "#/pending" : portalHome(u);
    } catch (err) { idle(btn); showErrors(form, [["password", err.message]]); }
  });
}
function showTransition() {
  const t = document.createElement("div");
  t.className = "portal-transition"; t.setAttribute("role", "status");
  t.innerHTML = `<span class="mini-loader">Opening your workspace…</span>`;
  document.body.append(t);
  requestAnimationFrame(() => setTimeout(() => t.remove(), 250));
}

/* ======================= change password (forced on first sign-in) ======================= */
function changePasswordPage(user) {
  return `<div class="auth-wrap"><div class="auth-card">
    ${authHead("Account security", user.role !== "teacher")}
    <h1>${user.must_change ? "Set a new password" : "Change password"}</h1>
    ${user.must_change ? `<div class="notice">${icon("key")}<span>Your account uses a temporary password. Choose a new one to continue.</span></div>` : ""}
    <form class="stack" data-cp novalidate>
      ${pwField("current", "Current (temporary) password", "current-password")}
      ${pwField("password", "New password", "new-password", "At least 8 characters, with letters and numbers.")}
      ${pwField("password2", "Confirm new password", "new-password")}
      <button class="btn btn-ink">Save new password</button>
    </form>
    <button class="btn btn-ghost btn-sm" data-out>Log out</button></div></div>`;
}
function bindChangePassword(root, user) {
  bindPwToggles(root);
  root.querySelector("[data-out]").addEventListener("click", () => { db.signOut(); location.hash = "#/"; });
  const form = root.querySelector("[data-cp]");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const errs = [];
    const pp = passwordProblem(d.password, user); if (pp) errs.push(["password", pp]);
    if (d.password === d.current) errs.push(["password", "Choose a password different from the temporary one."]);
    if (d.password !== d.password2) errs.push(["password2", "Passwords don't match."]);
    if (showErrors(form, errs)) return;
    const btn = form.querySelector("button.btn"); busy(btn, "Saving…");
    try { await db.changePassword(user.id, d.current, d.password); toast("Password updated."); location.hash = portalHome(user); }
    catch (err) { idle(btn); showErrors(form, [["current", err.message]]); }
  });
}

/* ======================= teacher registration ======================= */
function registerPage() {
  const schools = db.schools().filter((s) => s.active);
  return `<div class="auth-wrap"><div class="auth-card wide">
    ${authHead("Teacher / Researcher registration", false)}
    <h1>Create your account</h1>
    <p class="muted small">After you register, the District Research Coordinator reviews your account. You can sign in to check its status, and you get full access once it's approved.</p>
    <form class="stack" data-reg novalidate>
      <div class="grid-2">
        <label class="field span-2"><span class="req">Full name</span><input name="name" autocomplete="name" required></label>
        <label class="field span-2"><span class="req">Institutional email</span><input type="email" name="email" placeholder="firstname.lastname@deped.gov.ph" autocomplete="email" required><span class="hint">Use your DepEd email. This is your sign-in name.</span></label>
        <label class="field span-2"><span class="req">Your school</span><select name="school_id"><option value="">${schools.length ? "Choose your school…" : "School list not set up yet"}</option>${["Elementary", "Secondary", "Integrated"].filter((t) => schools.some((s) => s.type === t)).map((t) => `<optgroup label="${t === "Integrated" ? "Integrated (elementary and secondary)" : t + " schools"}">${schools.filter((s) => s.type === t).sort((a, b) => a.name.localeCompare(b.name)).map((s) => `<option value="${s.id}">${esc(s.name)}${s.code ? ` (${esc(s.code)})` : ""}</option>`).join("")}</optgroup>`).join("")}</select><span class="hint">All public schools of the Schools District of Aliaga, with their School ID. <a href="#" data-missing>My school isn't listed</a></span></label>
        <label class="field span-2" data-req-school hidden>School name and School ID (for verification)<input name="requested_school" placeholder="e.g. Sample Elementary School, 1xxxxx"></label>
        <label class="field span-2"><span class="req">Position / designation</span><input name="position" placeholder="e.g. Teacher III, Master Teacher I" required></label>
        ${pwField("password", "Password", "new-password", "At least 8 characters, with letters and numbers.")}
        ${pwField("password2", "Confirm password", "new-password")}
      </div>
      <label class="row small" style="align-items:flex-start;flex-wrap:nowrap"><input type="checkbox" name="consent" style="margin-top:2px"><span>I agree that my personal information will be processed for district research management in line with the Data Privacy Act of 2012, as explained in the <a href="#/privacy" target="_blank" rel="noopener">Data Privacy Notice</a>.</span></label>
      <button class="btn btn-ink">Create account</button>
    </form>
    <p class="small muted">Already registered? <a href="#/login/teacher">Sign in</a></p>
  </div></div>`;
}
function bindRegister(root) {
  bindPwToggles(root);
  const form = root.querySelector("[data-reg]");
  const schools = db.schools().filter((s) => s.active);
  const reqBox = root.querySelector("[data-req-school]");
  if (!schools.length) reqBox.hidden = false;

  root.querySelector("[data-missing]").addEventListener("click", (e) => { e.preventDefault(); reqBox.hidden = false; reqBox.querySelector("input").focus(); });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const errs = [];
    if (!d.name.trim()) errs.push(["name", "Enter your full name."]);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email || "")) errs.push(["email", "Enter a valid email address."]);
    if (!d.school_id && !d.requested_school?.trim()) errs.push(["school_id", "Choose your school, or type it under “My school isn't listed”."]);
    if (!d.position.trim()) errs.push(["position", "Enter your position or designation."]);
    const pp = passwordProblem(d.password, d); if (pp) errs.push(["password", pp]);
    if (d.password !== d.password2) errs.push(["password2", "Passwords don't match."]);
    if (!d.consent) errs.push(["consent", "Please agree to the data privacy notice."]);
    if (showErrors(form, errs)) return;
    const btn = form.querySelector("button.btn"); busy(btn, "Creating account…");
    try {
      const u = await db.register(d);
      if (u.confirm) {
        root.querySelector(".auth-card").innerHTML = `${authHead("Check your email", false)}<div class="empty"><div class="ic">${icon("mail")}</div><h3>Confirm your email address</h3>
          <p>We sent a link to <b>${esc(u.email)}</b>. Open it to confirm your address, then sign in to follow your approval status.</p><a class="btn btn-ink" href="#/login/teacher">Go to sign in</a></div>`;
        return;
      }
      db.signIn(u.id); toast("Account created. An administrator will review it soon.");
      location.hash = "#/pending";
    } catch (err) { idle(btn); showErrors(form, [["email", err.message]]); }
  });
}


/* ======================= waiting for approval ======================= */
function pendingPage(user) {
  const rejected = user.status === "rejected";
  const schools = db.schools().filter((s) => s.active);
  const school = db.school(user.school_id);
  const step = (n, label, state) => `<li class="ap-step ${state}"><span>${state === "done" ? icon("check") : n}</span><b>${label}</b></li>`;
  return `<div class="auth-wrap"><div class="auth-card wide">
    ${authHead(rejected ? "Changes needed" : "Waiting for approval", false)}
    <h1>${rejected ? "Please update your registration" : `Thanks, ${esc(user.name.split(" ")[0])}. Your account is under review.`}</h1>
    <ol class="ap-steps">${step(1, "Account created", "done")}${step(2, rejected ? "Returned for changes" : "Administrator review", rejected ? "warn" : "now")}${step(3, "Full access", "")}</ol>
    ${rejected ? `<div class="notice warn">${icon("alert")}<span><b>Reason from the administrator:</b> ${esc(user.review_note || "No reason given.")}</span></div>`
      : `<div class="notice">${icon("clock")}<span>The District Research Coordinator checks that you belong to a school in the district. You'll get full access to your dashboard, profile and submissions as soon as you're approved.</span></div>`}
    <form class="stack" data-resubmit novalidate>
      <div class="grid-2">
        <label class="field span-2"><span class="req">Full name</span><input name="name" value="${esc(user.name)}" required></label>
        <label class="field span-2">Institutional email<input value="${esc(user.email || "")}" disabled></label>
        <label class="field"><span class="req">School</span><select name="school_id"><option value="">${schools.length ? "Choose your school…" : "School list not set up yet"}</option>${["Elementary", "Secondary", "Integrated"].filter((t) => schools.some((s) => s.type === t)).map((t) => `<optgroup label="${t === "Integrated" ? "Integrated (elementary and secondary)" : t + " schools"}">${schools.filter((s) => s.type === t).sort((a, b) => a.name.localeCompare(b.name)).map((s) => `<option value="${s.id}"${s.id === user.school_id ? " selected" : ""}>${esc(s.name)}${s.code ? ` (${esc(s.code)})` : ""}</option>`).join("")}</optgroup>`).join("")}</select></label>
        <label class="field">Or type your school (if not listed)<input name="requested_school" value="${esc(user.requested_school || "")}"></label>
        <label class="field span-2"><span class="req">Position / designation</span><input name="position" value="${esc(user.position || "")}" required></label>
      </div>
      <div class="row"><button class="btn btn-ink">${icon(rejected ? "send" : "save")}${rejected ? "Resubmit for approval" : "Update my details"}</button>
        <button type="button" class="btn btn-ghost" data-check>${icon("history")}Check status</button>
        <button type="button" class="btn btn-ghost" data-out>${icon("logout")}Sign out</button></div>
    </form>
    <p class="small muted">While you wait, you can read about the research categories: <a href="#/category/AR">Action Research</a>, <a href="#/category/IGP">Income Generating Project</a>, <a href="#/category/INN">Innovation</a>.${school ? "" : ""}</p>
  </div></div>`;
}
function bindPending(root, user) {
  root.querySelector("[data-out]").addEventListener("click", () => { db.signOut(); location.hash = "#/"; });
  root.querySelector("[data-check]").addEventListener("click", async () => {
    if (db.cloudMode) await db.reload();
    const u = db.currentUser();
    if (u?.status === "active") { toast("You're approved. Welcome!"); location.hash = portalHome(u); }
    else toast(u?.status === "rejected" ? "Your registration needs changes. See the reason above." : "Still waiting for review.");
    render();
  });
  const form = root.querySelector("[data-resubmit]");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const errs = [];
    if (!d.name.trim()) errs.push(["name", "Enter your full name."]);
    if (!d.position.trim()) errs.push(["position", "Enter your position or designation."]);
    if (!d.school_id && !d.requested_school.trim()) errs.push(["school_id", "Choose your school, or type it in the next box."]);
    if (showErrors(form, errs)) return;
    try { db.resubmitRegistration(user, d); toast(user.status === "rejected" ? "Resubmitted. An administrator will review it again." : "Details updated."); render(); }
    catch (err) { toast(err.message, "err"); }
  });
}


/* ======================= new password from an emailed link ======================= */
function resetPage(user) {
  return `<div class="auth-wrap"><div class="auth-card">
    ${authHead("Account security", user.role !== "teacher")}
    <h1>Set a new password</h1>
    <p class="muted small">For ${esc(user.email || user.name)}.</p>
    <form class="stack" data-reset novalidate>
      ${pwField("password", "New password", "new-password", "At least 8 characters, with letters and numbers.")}
      ${pwField("password2", "Confirm new password", "new-password")}
      <button class="btn btn-ink">Save new password</button>
    </form></div></div>`;
}
function bindReset(root, user) {
  bindPwToggles(root);
  const form = root.querySelector("[data-reset]");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const errs = [];
    const pp = passwordProblem(d.password, user); if (pp) errs.push(["password", pp]);
    if (d.password !== d.password2) errs.push(["password2", "Passwords don't match."]);
    if (showErrors(form, errs)) return;
    const btn = form.querySelector("button.btn"); busy(btn, "Saving…");
    try { await db.changePassword(user.id, null, d.password); toast("Password updated. You're signed in."); location.hash = portalHome(user); }
    catch (err) { idle(btn); showErrors(form, [["password", err.message]]); }
  });
}

/* ======================= boot ======================= */
installUx(() => db.currentUser());
window.addEventListener("hashchange", render);
window.addEventListener("rd360:render", render);
window.addEventListener("beforeunload", (e) => { if (window.__rd360Dirty) { e.preventDefault(); e.returnValue = ""; } });
// Keep tabs in sync, without wiping what someone is typing.
window.addEventListener("storage", (e) => {
  if (!e.key || !e.key.startsWith("rd360.")) return;
  if (e.key.startsWith("rd360.session")) { if (!e.newValue) render(); return; } // signed out in another tab
  if (["rd360.theme", "rd360.view", "rd360.collapsed", "rd360.auth", "rd360.reminded", "rd360.device"].includes(e.key) || e.key.startsWith("rd360.prep.") || e.key.startsWith("rd360.filters.") || CLOUD) return;
  if (!window.__rd360Dirty) location.reload();
});

// Idle sign-out: any activity keeps the session alive; a warning appears one minute before it ends.
let idleWarn = null;
["pointerdown", "keydown", "scroll", "touchstart"].forEach((ev) => window.addEventListener(ev, () => { if (!idleWarn) db.touchSession(); }, { passive: true }));
setInterval(() => {
  if (!db.session()) return;
  const left = db.sessionRemainingMs();
  if (left <= 0) { idleWarn?.remove(); idleWarn = null; render(); return; }
  if (left < 60000 && !idleWarn) {
    idleWarn = toast("You'll be signed out in 1 minute because of inactivity.", "warn", { label: "Stay signed in", sticky: true, onClick: () => { idleWarn = null; db.touchSession(true); } });
  }
}, 10000);
(async () => {
  try {
    if (CLOUD) document.getElementById("splash-msg").textContent = "Connecting to the district database…";
    await db.init({
      onChange: () => { if (!window.__rd360Dirty && !document.querySelector(".modal-backdrop")) render(); },
      onError: (errs) => toast(`A change couldn't be saved: ${String(errs[0]).replace(/^\w+: /, "")}`, "err"),
      onRecovery: () => { location.hash = "#/reset-password"; },
    });
    render();
  } catch (err) {
    console.error(err);
    const msg = document.getElementById("splash-msg");
    if (msg) {
      msg.textContent = CLOUD ? "Couldn't reach the district database. Check your internet connection. " : "Something went wrong while starting. ";
      const b = document.createElement("button"); b.className = "btn btn-ghost btn-sm"; b.textContent = "Try again"; b.addEventListener("click", () => location.reload()); msg.append(b);
    }
  }
})();
