// School directory and one page per school. Public visitors see only public information;
// signed-in users see more, limited by role (admins: everything; teachers: their own school's people).
import { icon } from "./icons.js";
import { db, CATEGORIES, catById } from "./store.js";
import { esc, fmtDate, avatar, statusBadge, catBadge } from "./ui.js";
import { LOGO } from "./shell.js";

const DONE = ["Completed", "Published", "Archived"];
const base = (portal) => (portal ? `#/${portal}` : "#");
const short = (n) => n.replace("Elementary School", "ES").replace("National High School", "NHS").replace("Senior High School", "SHS").replace("Integrated School", "IS").replace("High School", "HS");
const typeTone = { Elementary: "t-mint", Secondary: "t-lav", Integrated: "t-cream" };
const mapsUrl = (s) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.name}, ${s.location || "Aliaga, Nueva Ecija"}`)}`;

function statsFor(sc) {
  const ps = db.projects().filter((p) => p.school_id === sc.id && p.status !== "Draft");
  const people = db.users().filter((u) => u.school_id === sc.id && u.status === "active");
  return {
    ps, people,
    submitted: ps.length,
    completed: ps.filter((p) => DONE.includes(p.status)).length,
    researchers: new Set(ps.map((p) => p.owner_id)).size || people.filter((u) => u.role === "teacher").length,
    byCat: CATEGORIES.map((c) => ({ c, n: ps.filter((p) => p.category === c.id).length })),
  };
}

/* ======================= directory ======================= */
export function schoolDirectory(portal, user, q) {
  const text = (q.get("q") || "").toLowerCase(), type = q.get("type") || "";
  const all = db.schools().filter((s) => s.active || ["admin", "superadmin"].includes(user?.role));
  const rows = all.filter((s) => (!type || s.type === type) && (!text || [s.name, s.code, s.location].join(" ").toLowerCase().includes(text)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const counts = { Elementary: all.filter((s) => s.type === "Elementary").length, Secondary: all.filter((s) => s.type === "Secondary").length, Integrated: all.filter((s) => s.type === "Integrated").length };
  const html = `<div class="sd">
    <section class="sd-head">
      <div><span class="pf-kicker">Schools District of Aliaga</span><h2>${all.length} public schools</h2>
        <p class="muted">Every school in the district, with its DepEd School ID and research activity.</p></div>
      <div class="pf-stats">${[["Elementary", counts.Elementary], ["Secondary", counts.Secondary], ["Integrated", counts.Integrated]].map(([l, n]) => `<div><b>${n}</b><span>${l}</span></div>`).join("")}</div>
    </section>
    <form class="toolbar card" data-sdf style="padding:14px">
      <input type="search" name="q" value="${esc(q.get("q") || "")}" placeholder="Search by school name, School ID or barangay…" aria-label="Search schools">
      <div class="seg" role="group" aria-label="School type">${[["", "All"], ["Elementary", "Elementary"], ["Secondary", "Secondary"], ["Integrated", "Integrated"]].map(([v, l]) => `<button type="button" data-type="${v}" class="${type === v ? "on" : ""}">${l}</button>`).join("")}</div>
    </form>
    ${rows.length ? `<div class="sd-grid">${rows.map((s) => { const st = statsFor(s); return `<a class="sd-card" href="${base(portal)}/school/${s.id}">
      <span class="sd-ic ${typeTone[s.type] || "t-mint"}">${icon(s.type === "Elementary" ? "grad" : "school")}</span>
      <span class="sd-body"><b>${esc(s.name)}</b><small>${esc(s.type)}${s.code ? ` · ID ${esc(s.code)}` : ""}${s.active ? "" : " · Inactive"}</small><small class="muted">${esc(s.location || "")}</small></span>
      <span class="sd-nums"><span><b>${st.submitted}</b>studies</span><span><b>${st.completed}</b>done</span></span></a>`; }).join("")}</div>`
      : `<div class="card empty"><div class="ic">${icon("search")}</div><h3>No schools match</h3><p>Try a different name, School ID or barangay.</p></div>`}
  </div>`;
  return {
    title: "Schools",
    crumbs: [],
    html,
    bind(root) {
      const f = root.querySelector("[data-sdf]");
      const go = (t) => { const p = new URLSearchParams(); const v = f.q.value.trim(); if (v) p.set("q", v); if (t) p.set("type", t); window.__rd360Focus = "q"; history.replaceState(null, "", `${base(portal)}/schools${p.toString() ? "?" + p : ""}`); window.dispatchEvent(new Event("rd360:render")); };
      let tmr; f.q.addEventListener("input", () => { clearTimeout(tmr); tmr = setTimeout(() => go(q.get("type") || ""), 300); });
      f.addEventListener("submit", (e) => { e.preventDefault(); go(q.get("type") || ""); });
      f.querySelectorAll("[data-type]").forEach((b) => b.addEventListener("click", () => go(b.dataset.type)));
    },
  };
}

/* ======================= one school ======================= */
export function schoolPage(portal, user, id) {
  const sc = db.school(id);
  if (!sc) return null;
  const isAdmin = ["admin", "superadmin"].includes(user?.role);
  const sameSchool = user?.school_id === sc.id;
  const st = statsFor(sc);
  const maxCat = Math.max(1, ...st.byCat.map((x) => x.n));
  // which studies this viewer may see
  const studies = isAdmin ? st.ps
    : user ? db.repositoryItems(user).filter((p) => p.school_id === sc.id).concat(st.ps.filter((p) => p.owner_id === user.id && !DONE.includes(p.status)))
      : db.repositoryItems(null).filter((p) => p.school_id === sc.id);
  const people = isAdmin || sameSchool ? st.people.filter((u) => u.role === "teacher" || u.role === "evaluator") : [];
  const projHref = (p) => isAdmin ? `#/a/project/${p.id}` : user && p.owner_id === user.id ? `#/t/project/${p.id}` : null;

  const html = `<div class="sp">
    <section class="sp-hero">
      <div class="sp-hero-txt">
        <span class="pf-chip">${icon(sc.type === "Elementary" ? "grad" : "school")}${esc(sc.type)} school</span>
        <h1>${esc(sc.name)}</h1>
        <div class="sp-facts">
          ${sc.code ? `<span>${icon("file")}School ID <b>${esc(sc.code)}</b></span>` : `<span>${icon("info")}School ID not recorded yet</span>`}
          ${sc.location ? `<span>${icon("map")}${esc(sc.location)}</span>` : ""}
          ${sc.email ? `<a href="mailto:${esc(sc.email)}">${icon("mail")}${esc(sc.email)}</a>` : ""}
        </div>
        <div class="row" style="margin-top:14px"><a class="btn btn-ghost-onc" href="${mapsUrl(sc)}" target="_blank" rel="noopener noreferrer">${icon("map")}Open in Maps</a>
          ${isAdmin ? `<a class="btn btn-onc" href="#/a/research?school=${sc.id}">${icon("folder")}All research records</a>` : ""}
          ${user?.role === "teacher" && sameSchool ? `<a class="btn btn-onc" href="#/t/submit">${icon("plus")}Submit research</a>` : ""}</div>
      </div>
      <img class="sp-seal" src="${LOGO}" alt="">
    </section>

    <section class="sp-stats">
      <div class="stat t-mint"><b>${st.submitted}</b><span>Research submitted</span></div>
      <div class="stat t-sky"><b>${st.completed}</b><span>Completed studies</span></div>
      <div class="stat t-lav"><b>${st.researchers}</b><span>Researchers</span></div>
      <div class="stat t-peach"><b>${st.submitted ? Math.round((st.completed / st.submitted) * 100) : 0}%</b><span>Completion rate</span></div>
    </section>

    <div class="sp-two">
      <section class="pf-card"><div class="pf-card-head"><span class="pf-kicker">Research by category</span></div>
        <div class="sp-cats">${st.byCat.map(({ c, n }) => `<a href="${base(portal)}/category/${c.id}" style="--c:${c.color}"><span class="sp-cat-ic">${icon(c.icon)}</span><span class="grow"><b>${esc(c.name)}</b><span class="sp-track"><i style="width:${(n / maxCat) * 100}%"></i></span></span><b class="sp-n">${n}</b></a>`).join("")}</div>
      </section>
      <section class="pf-card"><div class="pf-card-head"><span class="pf-kicker">${people.length ? "Researchers and evaluators" : "Researchers"}</span><b>${people.length || st.researchers}</b></div>
        ${people.length ? `<ul class="sp-people">${people.slice(0, 12).map((u) => `<li>${avatar(u)}<span><b>${esc(u.name)}</b><small>${esc(u.position || "")}</small>${u.interests ? `<small class="muted">${esc(u.interests)}</small>` : ""}</span></li>`).join("")}</ul>${people.length > 12 ? `<p class="small muted">and ${people.length - 12} more</p>` : ""}`
          : `<p class="small muted">${user ? "Researcher names are visible to administrators and to staff of this school." : "Sign in to see more about this school's research."}</p>`}
      </section>
    </div>

    <section class="pf-card"><div class="pf-card-head"><span class="pf-kicker">${isAdmin ? "All submitted research" : "Research from this school"}</span><b>${studies.length}</b></div>
      ${studies.length ? `<div class="sp-list">${studies.slice(0, 20).map((p) => { const href = projHref(p); return `<${href ? `a href="${href}"` : "div"} class="sp-item" style="--c:${catById(p.category).color}">
        <span class="grow"><b>${esc(p.title)}</b><small>${catBadge(p.category)} <span class="mono">${esc(p.research_id || "")}</span> · ${esc(db.user(p.owner_id)?.name || "")} · ${fmtDate(p.submitted_at)}</small></span>${statusBadge(p.status)}</${href ? "a" : "div"}>`; }).join("")}</div>`
        : `<p class="small muted">${user ? "No research you can view from this school yet." : "No public studies from this school yet. Completed studies appear here once the district makes them public."}</p>`}
    </section>
  </div>`;
  return {
    title: sc.name,
    crumbs: [["Schools", `${base(portal)}/schools`]],
    html,
  };
}

/* public wrapper (no portal shell) */
export function publicSchoolHtml(user, page) {
  return `<header class="home-header"><div class="inner">
      <a class="brand" href="#/"><img class="brand-logo" src="${LOGO}" alt="Aliaga District seal"><div><b>RESEARCH DASHBOARD 360</b><small>Schools District of Aliaga</small></div></a>
      <div class="row"><a class="btn btn-ghost btn-sm" href="#/schools">${icon("school")}Schools</a><a class="btn btn-ghost btn-sm" href="#/">${icon("left")}Home</a>${user ? "" : `<a class="btn btn-ink btn-sm" href="#/login/teacher">Sign in</a>`}</div></div></header>
    <main class="wrap" style="padding-top:12px;padding-bottom:40px">${page.html}</main>`;
}
