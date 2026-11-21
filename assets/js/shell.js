// Application shell: sidebar, top bar with breadcrumbs, mobile bottom navigation,
// notification drawer and profile menu.
import { icon } from "./icons.js";
import { db, ROLES } from "./store.js";
import { esc, avatar, relTime } from "./ui.js";

export const LOGO = "assets/img/aliaga-seal.png";

export const NAV = {
  t: [
    { group: "Workspace" },
    { k: "dashboard", label: "Dashboard", icon: "home" },
    { k: "projects", label: "My Research Projects", icon: "folder" },
    { k: "submit", label: "Submit New Research", icon: "plus" },
    { k: "repository", label: "Research Repository", icon: "library" },
    { k: "schools", label: "School Directory", icon: "school" },
    { group: "Research categories" },
    { k: "category/AR", label: "Action Research", color: "#D93636" },
    { k: "category/IGP", label: "Income Generating Project", color: "#249653" },
    { k: "category/INN", label: "Innovation", color: "#3478D4" },
    { group: "Stay on track" },
    { k: "notifications", label: "Notifications", icon: "bell", count: true },
    { k: "calendar", label: "Research Calendar", icon: "calendar" },
    { group: "Account" },
    { k: "profile", label: "My Profile", icon: "user" },
    { k: "settings", label: "Settings", icon: "settings" },
    { k: "help", label: "Help and User Guide", icon: "help" },
  ],
  a: [
    { group: "Overview" },
    { k: "dashboard", label: "Executive Dashboard", icon: "home", roles: ["admin", "superadmin"] },
    { k: "analytics", label: "District Analytics", icon: "chart", roles: ["admin", "superadmin"] },
    { group: "Research" },
    { k: "research", label: "Research Management", icon: "folder", roles: ["admin", "superadmin"] },
    { k: "queue", label: "Submission Queue", icon: "inbox", roles: ["admin", "superadmin"], queue: true },
    { k: "evaluation", label: "Technical Evaluation", icon: "check_clip" },
    { k: "workflow", label: "Workflow Management", icon: "workflow", roles: ["admin", "superadmin"] },
    { k: "monitoring", label: "Research Monitoring", icon: "activity", roles: ["admin", "superadmin"] },
    { k: "repository", label: "Repository Management", icon: "library", roles: ["admin", "superadmin"] },
    { group: "Research categories" },
    { k: "category/AR", label: "Action Research", color: "#D93636", roles: ["admin", "superadmin"] },
    { k: "category/IGP", label: "Income Generating Project", color: "#249653", roles: ["admin", "superadmin"] },
    { k: "category/INN", label: "Innovation", color: "#3478D4", roles: ["admin", "superadmin"] },
    { group: "Website" },
    { k: "cms", label: "Home Page Editor", icon: "globe", roles: ["admin", "superadmin"] },
    { group: "Administration" },
    { k: "schools", label: "School Management", icon: "school", roles: ["admin", "superadmin"], reqs: true },
    { k: "users", label: "User and Role Management", icon: "users", roles: ["admin", "superadmin"], pending: true },
    { k: "reports", label: "Reports and Exports", icon: "download", roles: ["admin", "superadmin"] },
    { k: "notifications", label: "Notifications and Deadlines", icon: "bell", count: true },
    { k: "audit", label: "Audit Logs", icon: "history", roles: ["admin", "superadmin"] },
    { k: "settings", label: "System Settings", icon: "settings" },
    { k: "help", label: "Help and Documentation", icon: "help" },
  ],
};
// The four most-used destinations for the phone bottom bar.
const BOTTOM = {
  t: [["dashboard", "home", "Dashboard"], ["projects", "folder", "Projects"], ["submit", "plus", "Submit"], ["notifications", "bell", "Notifications"]],
  a: [["dashboard", "home", "Dashboard"], ["queue", "inbox", "Queue"], ["research", "folder", "Research"], ["notifications", "bell", "Notifications"]],
  e: [["evaluation", "check_clip", "Evaluation"], ["notifications", "bell", "Notifications"], ["settings", "settings", "Settings"]],
};

export function navFor(portal, user) {
  return NAV[portal].filter((n) => n.group || !n.roles || n.roles.includes(user.role))
    .filter((n, i, arr) => !n.group || (arr[i + 1] && !arr[i + 1].group));
}

export function shell(portal, user, active, page) {
  const unread = db.notificationsFor(user.id).filter((n) => !n.read).length;
  const queueCount = db.projects().filter((p) => ["Submitted", "Revision Resubmitted"].includes(p.status)).length;
  const ac = db.approvalCounts(); const pendingUsers = ac.accounts + ac.changes;
  let collapsed = false;
  try { collapsed = localStorage.getItem("rd360.collapsed") === "1"; } catch { /* ignore */ }
  const nav = navFor(portal, user).map((n) => n.group
    ? `<div class="nav-group">${esc(n.group)}</div>`
    : `<a class="nav-link ${n.k === active ? "active" : ""}" href="#/${portal}/${n.k}" ${n.k === active ? 'aria-current="page"' : ""} title="${esc(n.label)}">
        ${n.color ? `<i class="cdot" style="background:${n.color}" aria-hidden="true"></i>` : icon(n.icon)}<span>${esc(n.label)}</span>${n.count && unread ? `<em class="count">${unread}</em>` : ""}${n.queue && queueCount ? `<em class="count q">${queueCount}</em>` : ""}${n.pending && pendingUsers ? `<em class="count q">${pendingUsers}</em>` : ""}${n.reqs && ac.schools ? `<em class="count q">${ac.schools}</em>` : ""}</a>`).join("");
  const crumbs = [[portal === "t" ? "Teacher Portal" : "Admin Portal", `#/${portal}/${user.role === "evaluator" ? "evaluation" : "dashboard"}`], ...(page.crumbs || [])];
  const bottom = (user.role === "evaluator" ? BOTTOM.e : BOTTOM[portal]).map(([k, ic, label]) =>
    `<a href="#/${portal}/${k}" class="${k === active ? "on" : ""}" aria-label="${label}" ${k === active ? 'aria-current="page"' : ""}>${icon(ic)}${k === "notifications" && unread ? `<span class="dot-count">${unread}</span>` : ""}</a>`).join("");

  return `<div class="shell ${collapsed ? "collapsed" : ""}" id="shell">
    <button type="button" class="skip-link" data-act="skip">Skip to main content</button>
    <aside class="sidebar" aria-label="Main navigation"><div class="panel">
      <a class="brand" href="#/${portal}/${user.role === "evaluator" ? "evaluation" : "dashboard"}"><img class="brand-logo" src="${LOGO}" alt="Aliaga District seal"><div><b>RESEARCH DASHBOARD 360</b><small>${portal === "t" ? "Teacher Portal" : "Admin Portal"}</small></div></a>
      <div class="role-chip ${portal === "a" ? "admin" : ""}">${esc(ROLES[user.role])}</div>
      <nav style="display:grid;gap:2px">${nav}</nav>
      <div class="spacer"></div>
      <a class="nav-link" href="#/" title="Public home page">${icon("globe")}<span>Public home page</span></a>
      <button class="nav-link" data-act="collapse" title="Collapse sidebar">${icon("sidebar")}<span>Collapse sidebar</span></button>
      <button class="nav-link" data-act="logout" title="Log out">${icon("logout")}<span>Log out</span></button>
    </div></aside>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn menu-btn" data-act="mobile-menu" aria-label="Open menu">${icon("menu")}</button>
        <div class="titles"><nav class="crumbs" aria-label="Breadcrumb">${crumbs.filter(([l]) => l !== page.title).map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join('<span aria-hidden="true">›</span>')}</nav><h1>${esc(page.title)}</h1></div>
        <form class="search" role="search" data-search><label class="sr-only" for="gsearch">Search research</label>${icon("search")}<input id="gsearch" type="search" placeholder="Search research…" autocomplete="off"></form>
        <button class="icon-btn" data-act="theme" aria-label="Switch to ${document.documentElement.dataset.theme === "dark" ? "light" : "dark"} mode">${icon(document.documentElement.dataset.theme === "dark" ? "sun" : "moon")}</button>
        <button class="icon-btn" data-act="drawer" aria-label="Notifications, ${unread} unread">${icon("bell")}${unread ? `<span class="dot-count">${unread}</span>` : ""}</button>
        <div class="rel">
          <button class="profile-btn" data-act="profile-menu" aria-haspopup="true" aria-expanded="false" aria-label="Account menu">${avatar(user)}<span class="who"><b>${esc(user.name)}</b><small>${esc(ROLES[user.role])}</small></span></button>
        </div>
      </header>
      <main class="content" id="content">
        ${page.desc || page.action ? `<div class="row between"><p class="page-desc" style="margin:0">${esc(page.desc || "")}</p>${page.action || ""}</div>` : ""}
        ${page.html}
      </main>
    </div>
    <nav class="bottom-nav" aria-label="Quick navigation">${bottom}<button data-act="mobile-menu" aria-label="More menu">${icon("menu")}</button></nav>
  </div>`;
}

export function bindShell(root, portal, user, rerender) {
  root.querySelector("[data-search]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = e.target.querySelector("input").value.trim();
    const page = portal === "t" ? "projects" : user.role === "evaluator" ? "evaluation" : "research";
    location.hash = `#/${portal}/${page}?q=${encodeURIComponent(q)}`;
  });
  const shellEl = root.querySelector("#shell");
  // Listen on the shell element (replaced every render) so handlers never stack up.
  shellEl.addEventListener("click", (e) => {
    if (e.target === shellEl && shellEl.classList.contains("mobile-open")) { shellEl.classList.remove("mobile-open"); return; }
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    if (act === "skip") {
      const m = root.querySelector("#content"); m.setAttribute("tabindex", "-1"); m.focus();
    } else if (act === "collapse") {
      shellEl.classList.toggle("collapsed");
      try { localStorage.setItem("rd360.collapsed", shellEl.classList.contains("collapsed") ? "1" : "0"); } catch { /* ignore */ }
    } else if (act === "mobile-menu") {
      shellEl.classList.toggle("mobile-open");
    } else if (act === "theme") {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("rd360.theme", next); } catch { /* ignore */ }
      rerender();
    } else if (act === "logout") {
      db.signOut(); location.hash = "#/";
    } else if (act === "drawer") {
      openDrawer(portal, user, rerender);
    } else if (act === "profile-menu") {
      const holder = b.parentElement;
      const open = holder.querySelector(".menu");
      if (open) { open.remove(); b.setAttribute("aria-expanded", "false"); return; }
      b.setAttribute("aria-expanded", "true");
      holder.insertAdjacentHTML("beforeend", `<div class="menu" role="menu">
        <a href="#/${portal}/profile" role="menuitem">${icon("user")}My profile</a>
        <a href="#/${portal}/settings" role="menuitem">${icon("settings")}Settings and password</a>
        <a href="#/${portal}/help" role="menuitem">${icon("help")}Help</a>
        <button data-act="logout" role="menuitem">${icon("logout")}Log out</button></div>`);
    }
  });
  // close the mobile drawer after navigating
  root.querySelectorAll(".sidebar a[href]").forEach((a) => a.addEventListener("click", () => shellEl.classList.remove("mobile-open")));
  document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { shellEl.classList.remove("mobile-open"); document.removeEventListener("keydown", esc); } });
}

function openDrawer(portal, user, rerender) {
  const list = db.notificationsFor(user.id);
  const wrap = document.createElement("div");
  wrap.innerHTML = `<div class="drawer-backdrop" data-close></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-label="Notifications">
    <header><h3 style="font-size:20px">Notifications</h3><div class="row"><button class="btn btn-ghost btn-sm" data-all ${list.some((n) => !n.read) ? "" : "disabled"}>Mark all as read</button><button class="icon-btn" data-close aria-label="Close">${icon("x")}</button></div></header>
    <div class="body">${list.length ? list.slice(0, 30).map((n) => `<a class="notif ${n.read ? "" : "unread"} ${n.kind === "security" ? "sec" : ""}" style="color:var(--text);text-decoration:none" href="${n.project_id ? `#/${portal}/project/${n.project_id}` : `#/${portal}/notifications`}" data-id="${n.id}">
      <div class="grow"><div class="small">${esc(n.message)}</div><time>${relTime(n.at)}</time></div></a>`).join("") : `<div class="empty"><div class="ic">${icon("bell")}</div><h3>You're all caught up</h3><p>Updates about research and deadlines will appear here.</p></div>`}</div>
  </aside>`;
  document.body.append(wrap);
  wrap.querySelector("[data-close].icon-btn")?.focus();
  const close = () => { wrap.remove(); rerender(); };
  const onKey = (e) => { if (e.key === "Escape") { document.removeEventListener("keydown", onKey); close(); } };
  document.addEventListener("keydown", onKey);
  wrap.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) { document.removeEventListener("keydown", onKey); close(); }
    else if (e.target.closest("[data-all]")) { db.markRead(user.id); document.removeEventListener("keydown", onKey); close(); }
    else { const a = e.target.closest("a[data-id]"); if (a) { db.markRead(user.id, a.dataset.id); document.removeEventListener("keydown", onKey); wrap.remove(); } }
  });
}
