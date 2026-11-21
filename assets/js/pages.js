// Pages shared by both portals: project lists, project detail, repository,
// notifications, calendar, profile, settings and help.
import { icon } from "./icons.js";
import { db, CATEGORIES, catById, STAGES, STATUSES, ADMIN_TRANSITIONS, TERMINAL, AGENDA, ROLES, isOverdue, nextAction, progressOf } from "./store.js";
import { PREVIEW_MODE } from "./config.js";
import { esc, fmtDate, fmtDateTime, relTime, statusBadge, catBadge, progressBar, deadlineCell, toast, modal, emptyState, avatar, debounce, attachStrength } from "./ui.js";

export const FILTERS = {
  draft: { label: "Drafts", list: ["Draft"] },
  submitted: { label: "Submitted", list: ["Submitted"] },
  pending: { label: "Pending review", list: ["Under Initial Screening", "Under Technical Review", "Revision Resubmitted", "Pending Ethics Review", "Pending Approval"] },
  returned: { label: "Returned for revision", list: ["Returned for Revision"] },
  approved: { label: "Approved", list: ["Approved"] },
  ongoing: { label: "Ongoing implementation", list: ["Ongoing Implementation", "For Final Evaluation", "For Dissemination"] },
  completed: { label: "Completed / archived", list: ["Published", "Completed", "Archived"] },
  closed: { label: "Rejected / withdrawn", list: ["Rejected", "Withdrawn"] },
  screening: { label: "Pending screening", list: ["Submitted", "Under Initial Screening"] },
  technical: { label: "Pending technical review", list: ["Under Technical Review", "Revision Resubmitted"] },
  approval: { label: "Pending approval", list: ["Pending Approval", "Pending Ethics Review"] },
  published: { label: "Published / archived", list: ["Published", "Archived"] },
  active: { label: "Active projects", list: ["Submitted", "Under Initial Screening", "Under Technical Review", "Returned for Revision", "Revision Resubmitted", "Pending Ethics Review", "Pending Approval", "Approved", "Ongoing Implementation", "For Final Evaluation", "For Dissemination"] },
};
export function matchStatus(p, key) {
  if (!key) return true;
  if (key === "overdue") return isOverdue(p);
  if (FILTERS[key]) return FILTERS[key].list.includes(p.status);
  return p.status === key;
}
const yearOf = (p) => new Date(p.submitted_at || p.created_at).getFullYear();

/* ======================= project list ======================= */
export function projectsPage(portal, user, q, opts = {}) {
  const isAdmin = portal === "a";
  // Remember filters for this list during the session, so coming back from a project keeps them.
  const fkey = `rd360.filters.${portal}.${opts.page || "projects"}`;
  try {
    if (q.has("all")) { sessionStorage.removeItem(fkey); q.delete("all"); history.replaceState(null, "", `#/${portal}/${opts.page || "projects"}`); }
    else if ([...q.keys()].length === 0) { const saved = sessionStorage.getItem(fkey); if (saved) { q = new URLSearchParams(saved); history.replaceState(null, "", `#/${portal}/${opts.page || "projects"}?${saved}`); } }
    else sessionStorage.setItem(fkey, q.toString());
  } catch { /* storage blocked */ }
  let rows = opts.rows || db.visibleProjects(user);
  const text = (q.get("q") || "").toLowerCase();
  const cat = q.get("cat") || "", status = q.get("status") || "", school = q.get("school") || "", year = q.get("year") || "";
  const sort = q.get("sort") || "activity";
  let view = q.get("view");
  if (!view) { try { view = localStorage.getItem("rd360.view") || "cards"; } catch { view = "cards"; } }
  if (isAdmin && !q.get("view")) view = q.get("view") || "table";

  const years = [...new Set(rows.map(yearOf))].sort((a, b) => b - a);
  rows = rows.filter((p) => {
    if (cat && p.category !== cat) return false;
    if (!matchStatus(p, status)) return false;
    if (school && p.school_id !== school) return false;
    if (year && String(yearOf(p)) !== year) return false;
    if (text) {
      const owner = db.user(p.owner_id)?.name || "";
      const hay = [p.title, p.research_id, catById(p.category).name, p.status, db.school(p.school_id)?.name, p.tags, p.agenda, isAdmin ? owner : ""].join(" ").toLowerCase();
      if (!hay.includes(text)) return false;
    }
    return true;
  });
  const sorters = {
    activity: (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
    submitted: (a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0),
    title: (a, b) => a.title.localeCompare(b.title),
    deadline: (a, b) => new Date(a.deadline || "2999-01-01") - new Date(b.deadline || "2999-01-01"),
    status: (a, b) => Object.keys(STATUSES).indexOf(a.status) - Object.keys(STATUSES).indexOf(b.status),
  };
  rows.sort(sorters[sort] || sorters.activity);

  const statusOptions = [["", "All statuses"], ["overdue", "Overdue"], ...Object.entries(FILTERS).filter(([k]) => isAdmin || !["screening", "technical", "approval", "published", "active"].includes(k)).map(([k, v]) => [k, v.label]), ...Object.keys(STATUSES).map((s) => [s, `• ${s}`])];
  const sel = (name, value, options) => `<select name="${name}" aria-label="${name}">${options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  const active = [cat, status, school, year, text].some(Boolean);

  const toolbar = `<form class="toolbar" data-filters>
    <input type="search" name="q" value="${esc(q.get("q") || "")}" placeholder="Search title, Research ID, keywords…" aria-label="Search projects">
    ${sel("cat", cat, [["", "All categories"], ...CATEGORIES.map((c) => [c.id, c.name])])}
    ${sel("status", status, statusOptions)}
    ${isAdmin ? sel("school", school, [["", "All schools"], ...db.schools().map((s) => [s.id, s.name])]) : ""}
    ${sel("year", year, [["", "All years"], ...years.map((y) => [y, y])])}
    ${sel("sort", sort, [["activity", "Sort: latest activity"], ["submitted", "Sort: submission date"], ["title", "Sort: title"], ["deadline", "Sort: deadline"], ["status", "Sort: status"]])}
    ${active ? `<a class="btn btn-ghost btn-sm" href="#/${portal}/${opts.page || "projects"}?all=1">Clear all</a>` : ""}
    <div class="seg" style="margin-left:auto" role="group" aria-label="View">
      ${[["cards", "grid", "Cards"], ["table", "list", "Table"], ["kanban", "kanban", "Kanban"]].map(([v, ic, l]) => `<button type="button" data-view="${v}" class="${view === v ? "on" : ""}" aria-pressed="${view === v}">${icon(ic)}${l}</button>`).join("")}
    </div>
  </form>`;

  const link = (p) => `#/${portal}/project/${p.id}`;
  let body;
  if (!rows.length) {
    body = emptyState(active ? "No projects match these filters" : "No research projects yet",
      active ? "Try clearing a filter or searching a different keyword." : portal === "t" ? "Start your first proposal with the guided submission wizard." : "Submitted research will appear here.",
      portal === "t" && !active ? `<a class="btn btn-primary" href="#/t/submit">${icon("plus")}Submit new research</a>` : "");
  } else if (view === "table") {
    body = `<div class="table-wrap"><table><thead><tr><th>Research ID</th><th>Title</th>${isAdmin ? "<th>Researcher</th><th>School</th>" : ""}<th>Category</th><th>Status</th><th>Progress</th>${isAdmin ? "<th>Submitted</th>" : "<th>Next action</th>"}<th>Deadline</th></tr></thead><tbody>
      ${rows.map((p) => `<tr><td class="mono">${esc(p.research_id || "Draft")}</td><td style="min-width:240px"><a class="title-link" href="${link(p)}">${esc(p.title || "Untitled draft")}</a><div class="small muted">Updated ${relTime(p.updated_at)}</div></td>
      ${isAdmin ? `<td>${esc(db.user(p.owner_id)?.name)}</td><td class="small">${esc(db.school(p.school_id)?.name)}</td>` : ""}
      <td>${catBadge(p.category)}</td><td>${statusBadge(p.status)}</td><td style="min-width:120px">${progressBar(p)}</td>
      ${isAdmin ? `<td class="small">${fmtDate(p.submitted_at)}</td>` : `<td class="small">${esc(nextAction(p, "teacher"))}</td>`}<td class="small">${deadlineCell(p)}</td></tr>`).join("")}
    </tbody></table></div>`;
  } else if (view === "kanban") {
    const cols = [
      ["Draft", ["Draft"]], ["Screening", ["Submitted", "Under Initial Screening"]], ["Technical review", ["Under Technical Review", "Revision Resubmitted", "Pending Ethics Review"]],
      ["Revision", ["Returned for Revision"]], ["Approval", ["Pending Approval", "Approved"]], ["Implementation", ["Ongoing Implementation", "For Final Evaluation", "For Dissemination"]],
      ["Completed", ["Published", "Completed", "Archived"]], ["Closed", ["Rejected", "Withdrawn"]],
    ].filter(([n]) => isAdmin ? n !== "Draft" : true);
    body = `<div class="kanban">${cols.map(([name, list]) => { const items = rows.filter((p) => list.includes(p.status)); return `<section class="kan-col"><h4>${esc(name)}<span class="muted">${items.length}</span></h4>
      ${items.map((p) => `<a class="kan-item" href="${link(p)}" style="--c:${catById(p.category).color}"><b>${esc(p.title || "Untitled draft")}</b><span class="small muted mono">${esc(p.research_id || "Draft")}</span>${statusBadge(p.status)}${p.deadline ? `<span class="small ${isOverdue(p) ? "overdue" : "muted"}">${icon("clock")} ${fmtDate(p.deadline)}</span>` : ""}</a>`).join("") || `<p class="small muted">Empty</p>`}</section>`; }).join("")}</div>`;
  } else {
    body = `<div class="proj-grid">${rows.map((p) => projectCard(p, portal)).join("")}</div>`;
  }

  return {
    title: opts.title || (portal === "t" ? "My Research Projects" : "Research Management"),
    html: `${opts.intro || ""}<section class="card stack">${toolbar}<div class="small muted">${rows.length} project${rows.length === 1 ? "" : "s"}${status && (FILTERS[status] || status === "overdue") ? ` · ${esc(FILTERS[status]?.label || "Overdue")}` : ""}</div>${body}</section>`,
    bind(root) {
      const form = root.querySelector("[data-filters]");
      const apply = () => {
        const fd = new FormData(form); const params = new URLSearchParams();
        for (const [k, v] of fd.entries()) if (v) params.set(k, v);
        if (q.get("view")) params.set("view", q.get("view"));
        const s = params.toString();
        history.replaceState(null, "", `#/${portal}/${opts.page || "projects"}${s ? "?" + s : ""}`);
        window.dispatchEvent(new Event("rd360:render"));
      };
      form.addEventListener("change", (e) => { if (e.target.name !== "q") apply(); });
      const typed = debounce(() => { window.__rd360Focus = "q"; apply(); }, 350);
      form.querySelector("[name=q]").addEventListener("input", typed);
      form.addEventListener("submit", (e) => { e.preventDefault(); apply(); });
      form.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => {
        try { localStorage.setItem("rd360.view", b.dataset.view); } catch { /* ignore */ }
        q.set("view", b.dataset.view);
        history.replaceState(null, "", `#/${portal}/${opts.page || "projects"}?${q.toString()}`);
        window.dispatchEvent(new Event("rd360:render"));
      }));
    },
  };
}

export function projectCard(p, portal) {
  const c = catById(p.category);
  const role = portal === "t" ? "teacher" : "admin";
  return `<article class="proj-card" style="--c:${c.color}">
    <div class="row between">${catBadge(p.category)}${statusBadge(p.status)}</div>
    <h3><a class="title-link" style="color:var(--text)" href="#/${portal}/project/${p.id}">${esc(p.title || "Untitled draft")}</a></h3>
    <div class="meta"><span class="mono">${esc(p.research_id || "Not yet submitted")}</span>·<span>${esc(db.school(p.school_id)?.name || "No school selected")}</span></div>
    ${progressBar(p)}
    <div class="next"><b>Next:</b> ${esc(nextAction(p, role))}${p.deadline ? ` · <span class="${isOverdue(p) ? "overdue" : ""}">${fmtDate(p.deadline)}</span>` : ""}</div>
    <div class="row between small muted"><span>Updated ${relTime(p.updated_at)}</span>
      <span class="row" style="gap:6px">${portal === "t" && ["Draft", "Returned for Revision"].includes(p.status) ? `<a class="btn btn-primary btn-sm" href="#/t/submit?id=${p.id}">${p.status === "Draft" ? "Continue" : "Revise"}</a>` : ""}<a class="btn btn-ghost btn-sm" href="#/${portal}/project/${p.id}">Open</a></span></div>
  </article>`;
}

/* ======================= project detail ======================= */
export function projectDetail(portal, user, id, q) {
  const p = db.project(id);
  if (!p || !db.canView(user, p)) {
    return { title: "Project not available", html: `<div class="card">${emptyState("This project isn't available", "It may not exist, or your account doesn't have access to it.", `<a class="btn btn-ghost" href="#/${portal}/dashboard">Back to dashboard</a>`)}</div>` };
  }
  const tab = q.get("tab") || "overview";
  const owner = db.user(p.owner_id), sch = db.school(p.school_id), ev = p.evaluator_id ? db.user(p.evaluator_id) : null;
  const isAdmin = ["admin", "superadmin"].includes(user.role);
  const transitions = isAdmin ? ADMIN_TRANSITIONS[p.status] || [] : [];

  const actions = [];
  if (portal === "t") {
    if (p.status === "Draft") actions.push(`<a class="btn btn-primary" href="#/t/submit?id=${p.id}">${icon("file")}Continue editing</a>`, `<button class="btn btn-ghost" data-do="delete">${icon("trash")}Delete draft</button>`);
    if (p.status === "Returned for Revision") actions.push(`<a class="btn btn-primary" href="#/t/submit?id=${p.id}&step=6">${icon("file")}Revise and resubmit</a>`);
    if (!TERMINAL.includes(p.status) && p.status !== "Draft" && !["Completed", "Published"].includes(p.status)) actions.push(`<button class="btn btn-ghost" data-do="withdraw">Withdraw</button>`);
  }
  transitions.forEach((t) => actions.push(`<button class="btn ${["Rejected", "Returned for Revision"].includes(t) ? "btn-ghost" : "btn-primary"} btn-sm" data-to="${esc(t)}">${icon(t === "Rejected" ? "x" : t === "Returned for Revision" ? "left" : "chevron")}${esc(t)}</button>`));
  if (isAdmin && ["Under Technical Review", "Revision Resubmitted", "Under Initial Screening"].includes(p.status)) actions.push(`<a class="btn btn-ghost btn-sm" href="#/a/evaluation">${icon("users")}Assign evaluator</a>`);
  if (user.role === "evaluator" && p.evaluator_id === user.id) actions.push(`<button class="btn btn-primary btn-sm" data-do="recommend">${icon("check_clip")}Submit recommendation</button>`);

  const tabs = [["overview", "Overview"], ["workflow", "Workflow"], ["documents", `Documents (${p.files.length})`], ["feedback", `Evaluation and Feedback (${p.feedback.length})`], ["activity", "Activity"]];
  const field = (label, v) => v ? `<dt>${esc(label)}</dt><dd>${esc(v)}</dd>` : "";
  const dlOr = (inner) => inner ? `<dl>${inner}</dl>` : `<p class="small muted">Not filled in yet.</p>`;
  let tabHtml = "";
  if (tab === "overview") {
    tabHtml = `<div class="stack">
      <div class="review-block"><h4>Research details</h4>${dlOr(field("Abstract", p.abstract) + field("Background / rationale", p.background) + field("Statement of the problem", p.problem) + field("Objectives", p.objectives) + field("Research questions", p.questions) + field("Significance", p.significance) + field("Target beneficiaries", p.beneficiaries))}</div>
      <div class="review-block"><h4>Methodology and implementation</h4>${dlOr(field("Research design", p.design) + field("Participants / respondents", p.participants) + field("Instruments", p.instruments) + field("Data collection", p.data_collection) + field("Data analysis", p.analysis) + field("Ethical considerations", p.ethics) + field("Timeline", p.timeline) + field("Milestones", p.milestones))}</div>
      <div class="review-block"><h4>Classification and resources</h4>${dlOr(field("Research agenda theme", p.agenda) + field("Funding source", p.funding) + field("Budget (PHP)", p.budget) + field("Tags", p.tags) + field("Research team", p.team))}</div></div>`;
  } else if (tab === "workflow") {
    const visited = new Set([p.status, ...p.history.map((h) => h.to).filter(Boolean)]);
    const condApplies = { revision: visited.has("Returned for Revision"), resubmitted: visited.has("Revision Resubmitted"), ethics: visited.has("Pending Ethics Review"), dissemination: visited.has("For Dissemination") || visited.has("Published"), publication: visited.has("Published") };
    const curStage = STATUSES[p.status]?.stage;
    const coreKeys = STAGES.filter((s) => !s.cond).map((s) => s.key);
    const curIdx = p.status === "Archived" ? coreKeys.length : coreKeys.indexOf(curStage);
    tabHtml = `<p class="small muted" style="margin-bottom:14px">Progress is calculated from completed stages. Conditional stages (dashed) count only when they apply to this project.</p><div class="timeline">${STAGES.map((s, i) => {
      let cls = "", note = "";
      if (s.cond) { cls = condApplies[s.key] ? "done" : "na"; note = condApplies[s.key] ? "Applied to this project" : "Not applicable"; }
      else { const k = coreKeys.indexOf(s.key); cls = k < curIdx ? "done" : k === curIdx && !TERMINAL.includes(p.status) ? "current" : ""; note = cls === "done" ? "Completed" : cls === "current" ? `In progress · ${nextAction(p, portal === "t" ? "teacher" : "admin")}` : "Upcoming"; }
      if (["Rejected", "Withdrawn"].includes(p.status) && cls === "") note = "Closed";
      return `<div class="tl-item ${cls}"><div class="tl-dot">${cls === "done" ? icon("check") : i + 1}</div><div><h4>${esc(s.name)}${s.cond ? ' <span class="tag">conditional</span>' : ""}</h4><p>${esc(note)}</p></div></div>`;
    }).join("")}</div>`;
  } else if (tab === "documents") {
    tabHtml = p.files.length ? `<div class="file-list">${p.files.map((f) => `<div class="file-item">${icon("file")}<span class="grow">${esc(f.name)}</span><span class="small muted">v${f.version || 1} · ${(f.size / 1024 / 1024).toFixed(2)} MB · ${fmtDate(f.uploaded_at)}</span>${f.path ? `<button class="btn btn-ghost btn-sm" data-openfile="${esc(f.path)}">${icon("eye")}Open</button>` : ""}</div>`).join("")}</div>
      ${PREVIEW_MODE ? `<div class="notice" style="margin-top:12px">${icon("info")}<span>Preview mode records file names only. Files will be stored in secure, access-controlled storage once the database is connected.</span></div>` : ""}`
      : emptyState("No documents yet", "Attachments added in the submission wizard appear here.");
  } else if (tab === "feedback") {
    tabHtml = p.feedback.length ? `<div class="activity">${p.feedback.map((f) => `<div class="act"><span class="ic">${icon("check_clip")}</span><div><b>${esc(db.user(f.by)?.name || "Reviewer")}</b><div>${esc(f.text)}</div><time>${fmtDateTime(f.at)}</time></div></div>`).join("")}</div>`
      : emptyState("No feedback released yet", "Researcher-facing feedback from screening and evaluation will appear here.");
  } else {
    tabHtml = `<div class="activity">${[...p.history].reverse().map((h) => `<div class="act"><span class="ic">${icon("history")}</span><div><b>${esc(h.action)}</b> <span class="muted">by ${esc(db.user(h.actor)?.name || "System")}</span>${h.note ? `<div class="small">Reason: ${esc(h.note)}</div>` : ""}<time>${fmtDateTime(h.at)}</time></div></div>`).join("")}</div>`;
  }

  return {
    title: p.research_id || "Draft project",
    crumbs: portal === "t" ? [["My Research Projects", "#/t/projects"]] : [["Research Management", "#/a/research"]],
    html: `<section class="card detail-head" style="border-top:4px solid ${catById(p.category).color}">
      <div class="row between"><div class="row">${catBadge(p.category)}${statusBadge(p.status)}${isOverdue(p) ? `<span class="badge s-stop">Overdue</span>` : ""}</div><span class="mono muted">${esc(p.research_id || "Research ID is assigned on submission")}</span></div>
      <h2>${esc(p.title || "Untitled draft")}</h2>
      ${progressBar(p)}
      <div class="facts">
        <div class="fact"><small>Researcher</small><span>${esc(owner?.name)}</span></div>
        <div class="fact"><small>School</small><span>${sch ? `<a class="school-link" href="#/${portal}/school/${sch.id}">${esc(sch.name)}</a>` : "—"}</span></div>
        <div class="fact"><small>Next action</small><span>${esc(nextAction(p, portal === "t" ? "teacher" : "admin"))}</span></div>
        <div class="fact"><small>Deadline</small><span>${deadlineCell(p)}</span></div>
        <div class="fact"><small>Submitted</small><span>${fmtDate(p.submitted_at)}</span></div>
        ${portal === "a" ? `<div class="fact"><small>Evaluator</small><span>${esc(ev?.name || "Not assigned")}</span></div>` : ""}
      </div>
      ${actions.length ? `<div class="row">${actions.join("")}</div>` : ""}
    </section>
    <section class="card"><div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${k === tab}" class="${k === tab ? "on" : ""}" data-tab="${k}">${esc(l)}</button>`).join("")}</div><div style="padding-top:18px">${tabHtml}</div></section>`,
    bind(root) {
      root.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { location.hash = `#/${portal}/project/${p.id}?tab=${b.dataset.tab}`; }));
      root.querySelectorAll("[data-openfile]").forEach((b) => b.addEventListener("click", async () => {
        const w = window.open("", "_blank", "noopener");
        try { const url = await db.fileUrl(b.dataset.openfile); if (w) w.location = url; else location.href = url; } catch (e) { w?.close(); toast(e.message, "err"); }
      }));
      root.querySelectorAll("[data-to]").forEach((b) => b.addEventListener("click", () => doTransition(user, p, b.dataset.to)));
      root.querySelector("[data-do=delete]")?.addEventListener("click", async () => {
        if (!(await modal({ title: "Delete this draft?", body: "This permanently removes the draft and its unsaved details.", confirm: "Delete draft", danger: true }))) return;
        try { db.deleteDraft(user, p.id); toast("Draft deleted."); location.hash = "#/t/projects"; } catch (e) { toast(e.message, "err"); }
      });
      root.querySelector("[data-do=withdraw]")?.addEventListener("click", async () => {
        const r = await modal({ title: "Withdraw this research?", body: "The record and its history are kept, but it will no longer move through the workflow.", fields: [{ name: "reason", label: "Reason for withdrawal", type: "textarea", required: true }], confirm: "Withdraw", danger: true });
        if (!r) return;
        try { db.withdraw(user, p.id, r.reason); toast("Research withdrawn."); window.dispatchEvent(new Event("rd360:render")); } catch (e) { toast(e.message, "err"); }
      });
      root.querySelector("[data-do=recommend]")?.addEventListener("click", async () => {
        const r = await modal({ title: "Submit evaluation recommendation", fields: [
          { name: "rec", label: "Recommendation", type: "select", options: ["Approve", "Approve with minor revisions", "Major revisions required", "Reject"].map((v) => ({ value: v, label: v })) },
          { name: "text", label: "Feedback for the researcher", type: "textarea", required: true }], confirm: "Submit recommendation" });
        if (!r) return;
        try { db.addEvaluation(user, p.id, r.rec, r.text); toast("Recommendation submitted."); window.dispatchEvent(new Event("rd360:render")); }
        catch (e) { toast(e.message, "err"); }
      });
    },
  };
}

export async function doTransition(user, p, to) {
  const needsFeedback = to === "Returned for Revision";
  const fields = [{ name: "reason", label: "Reason / basis for this decision", type: "textarea", required: true }];
  if (needsFeedback) fields.push({ name: "feedback", label: "Revision items for the researcher", type: "textarea", required: true, hint: "Visible to the researcher." });
  else fields.push({ name: "feedback", label: "Feedback to release to the researcher (optional)", type: "textarea" });
  const r = await modal({ title: `Move to "${to}"?`, body: `${esc(p.research_id)} · ${esc(p.title)}<br>Current status: ${esc(p.status)}. This action is recorded in the audit log.`, fields, confirm: `Confirm: ${to}`, danger: to === "Rejected" });
  if (!r) return;
  try { db.transition(user, p.id, to, r.reason, r.feedback); toast(`${p.research_id} moved to ${to}.`); window.dispatchEvent(new Event("rd360:render")); }
  catch (e) { toast(e.message, "err"); }
}

/* ======================= repository ======================= */
export function repositoryPage(portal, user, q) {
  const text = (q.get("q") || "").toLowerCase(), cat = q.get("cat") || "", theme = q.get("theme") || "";
  const all = db.repositoryItems(user);
  const isAdmin = ["admin", "superadmin"].includes(user.role);
  const rows = all.filter((p) => (!cat || p.category === cat) && (!theme || p.agenda === theme) &&
    (!text || [p.title, p.abstract, p.tags, p.research_id, db.user(p.owner_id)?.name, db.school(p.school_id)?.name].join(" ").toLowerCase().includes(text)));
  return {
    title: portal === "t" ? "Research Repository" : "Repository Management",
    html: `<section class="card stack">
      <div class="row between"><p class="muted small">Completed and approved-for-repository research from across the district. ${all.length} item${all.length === 1 ? "" : "s"} indexed.</p></div>
      <form class="toolbar" data-repo><input type="search" name="q" value="${esc(q.get("q") || "")}" placeholder="Search title, author, school, keywords…" aria-label="Search repository">
        <select name="cat" aria-label="Category"><option value="">All categories</option>${CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === cat ? "selected" : ""}>${c.name}</option>`).join("")}</select>
        <select name="theme" aria-label="Theme"><option value="">All research themes</option>${AGENDA.map((a) => `<option ${a === theme ? "selected" : ""}>${esc(a)}</option>`).join("")}</select>
        <button class="btn btn-primary btn-sm">${icon("search")}Search</button></form>
      ${rows.length ? `<div class="proj-grid">${rows.map((p) => `<article class="proj-card" style="--c:${catById(p.category).color}">
        <div class="row between">${catBadge(p.category)}${statusBadge(p.status)}</div>
        <h3>${esc(p.title)}</h3>
        <p class="small muted">${esc(db.user(p.owner_id)?.name)} · ${esc(db.school(p.school_id)?.name)} · ${new Date(p.submitted_at).getFullYear()}</p>
        <p class="small">${esc((p.abstract || "").slice(0, 160))}${(p.abstract || "").length > 160 ? "…" : ""}</p>
        <div class="row" style="gap:6px">${p.agenda ? `<span class="tag">${esc(p.agenda)}</span>` : ""}${(p.tags || "").split(",").filter(Boolean).slice(0, 3).map((t) => `<span class="tag">${esc(t.trim())}</span>`).join("")}</div>
        <div class="row"><button class="btn btn-ghost btn-sm" data-cite="${p.id}">${icon("eye")}Abstract and citation</button>
        ${isAdmin ? `<select data-vis="${p.id}" aria-label="Visibility" style="width:auto;border-radius:999px;padding:7px 12px">${[["restricted", "Restricted"], ["district", "District only"], ["public", "Public"]].map(([v, l]) => `<option value="${v}" ${(p.visibility || "district") === v ? "selected" : ""}>${l}</option>`).join("")}</select>` : ""}</div></article>`).join("")}</div>`
        : emptyState("No repository items found", "Try a different keyword or filter.")}
    </section>`,
    bind(root) {
      root.querySelector("[data-repo]").addEventListener("submit", (e) => {
        e.preventDefault();
        const params = new URLSearchParams([...new FormData(e.target).entries()].filter(([, v]) => v));
        location.hash = `#/${portal}/repository?${params}`;
      });
      root.querySelectorAll("[data-vis]").forEach((s) => s.addEventListener("change", async () => {
        const p = db.project(s.dataset.vis);
        if (s.value === "public" && !(await modal({ title: "Make this study public?", body: "Its title, abstract, author, school and year will appear on the public home page under Featured Research. Confirm the researcher's consent and that no confidential data is included.", confirm: "Make public" }))) { s.value = p.visibility || "district"; return; }
        db.setVisibility(user, p.id, s.value); toast("Visibility updated.");
      }));
      root.querySelectorAll("[data-cite]").forEach((b) => b.addEventListener("click", () => {
        const p = db.project(b.dataset.cite);
        const cite = `${db.user(p.owner_id)?.name} (${new Date(p.submitted_at).getFullYear()}). ${p.title}. ${catById(p.category).name}, ${db.school(p.school_id)?.name}. RESEARCH DASHBOARD 360 Repository, Schools District of Aliaga. ${p.research_id}.`;
        modal({ title: p.title, body: `<b>Abstract.</b> ${esc(p.abstract)}<br><br><b>Suggested citation.</b><br><span class="mono">${esc(cite)}</span>`, confirm: "Copy citation", cancel: "Close" })
          .then((ok) => { if (ok) navigator.clipboard?.writeText(cite).then(() => toast("Citation copied."), () => toast("Copy not allowed in this browser.", "err")); });
      }));
    },
  };
}

/* ======================= notifications ======================= */
export function notificationsPage(portal, user) {
  const list = db.notificationsFor(user.id);
  const upcoming = db.visibleProjects(user).filter((p) => p.deadline && !TERMINAL.includes(p.status)).sort((a, b) => new Date(a.deadline) - new Date(b.deadline)).slice(0, 8);
  return {
    title: portal === "t" ? "Notifications" : "Notifications and Deadlines",
    html: `<div class="charts">
      <section class="card"><div class="card-head"><h2>Inbox</h2><button class="btn btn-ghost btn-sm" data-all ${list.some((n) => !n.read) ? "" : "disabled"}>Mark all as read</button></div>
        <div class="stack" style="gap:10px">${list.length ? list.map((n) => `<div class="notif ${n.read ? "" : "unread"} ${n.kind === "security" ? "sec" : ""}"><div class="grow"><div>${esc(n.message)}</div><time>${fmtDateTime(n.at)}</time></div>
          <div class="row" style="gap:6px;align-self:center">${n.project_id ? `<a class="btn btn-ghost btn-sm" href="#/${portal}/project/${n.project_id}" data-read="${n.id}">Open</a>` : ""}${n.read ? "" : `<button class="btn btn-ghost btn-sm" data-mark="${n.id}">Mark read</button>`}</div></div>`).join("") : emptyState("No notifications", "Updates about your research will appear here.")}</div></section>
      <section class="card"><div class="card-head"><h2>Upcoming deadlines</h2><a class="small" href="#/${portal}/${portal === "t" ? "calendar" : "monitoring"}">View all</a></div>
        <div class="cal-list">${upcoming.length ? upcoming.map((p) => calItem(p, portal)).join("") : `<p class="muted small">No upcoming deadlines.</p>`}</div></section></div>`,
    bind(root) {
      root.querySelector("[data-all]")?.addEventListener("click", () => { db.markRead(user.id); window.dispatchEvent(new Event("rd360:render")); });
      root.querySelectorAll("[data-mark]").forEach((b) => b.addEventListener("click", () => { db.markRead(user.id, b.dataset.mark); window.dispatchEvent(new Event("rd360:render")); }));
      root.querySelectorAll("[data-read]").forEach((b) => b.addEventListener("click", () => db.markRead(user.id, b.dataset.read)));
    },
  };
}
const calItem = (p, portal) => { const d = new Date(p.deadline); return `<a class="cal-item" href="#/${portal}/project/${p.id}"><div class="cal-date"><small>${d.toLocaleString("en-PH", { month: "short" })}</small><b>${d.getDate()}</b></div><div><b class="small">${esc(p.title)}</b><div class="small muted">${esc(nextAction(p, portal === "t" ? "teacher" : "admin"))} · <span class="${isOverdue(p) ? "overdue" : ""}">${esc(p.status)}</span></div></div></a>`; };

/* ======================= calendar ======================= */
export function calendarPage(portal, user, q) {
  const base = q.get("m") ? new Date(q.get("m") + "-01T00:00:00") : new Date();
  const y = base.getFullYear(), m = base.getMonth();
  const first = new Date(y, m, 1), start = new Date(y, m, 1 - first.getDay());
  const events = db.visibleProjects(user).filter((p) => p.deadline && !TERMINAL.includes(p.status));
  const key = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const byDay = {};
  events.forEach((p) => { const k = key(new Date(p.deadline)); (byDay[k] ||= []).push(p); });
  const today = key(new Date());
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const mm = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const prev = mm(new Date(y, m - 1, 1)), next = mm(new Date(y, m + 1, 1));
  const upcoming = events.filter((p) => new Date(p.deadline) >= new Date(y, m, 1)).sort((a, b) => new Date(a.deadline) - new Date(b.deadline)).slice(0, 10);
  return {
    title: "Research Calendar",
    html: `<section class="card"><div class="card-head"><h2>${base.toLocaleString("en-PH", { month: "long", year: "numeric" })}</h2>
      <div class="row"><a class="btn btn-ghost btn-sm" href="#/${portal}/calendar?m=${prev}">${icon("left")}Previous</a><a class="btn btn-ghost btn-sm" href="#/${portal}/calendar">Today</a><a class="btn btn-ghost btn-sm" href="#/${portal}/calendar?m=${next}">Next${icon("chevron")}</a></div></div>
      <div class="month-grid">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => `<div class="dow">${d}</div>`).join("")}
      ${days.map((d) => { const ev = byDay[key(d)] || []; return `<div class="day ${d.getMonth() !== m ? "out" : ""} ${key(d) === today ? "today" : ""} ${ev.length ? "has" : ""}"><span>${d.getDate()}</span>${ev.map((p) => `<a class="ev ${isOverdue(p) ? "late" : ""}" href="#/${portal}/project/${p.id}" title="${esc(p.title)}">${esc(p.research_id || p.title)}</a>`).join("")}</div>`; }).join("")}</div></section>
      <section class="card"><div class="card-head"><h2>Agenda</h2><span class="sub">Deadlines from ${base.toLocaleString("en-PH", { month: "long" })} onward</span></div>
      <div class="cal-list">${upcoming.length ? upcoming.map((p) => calItem(p, portal)).join("") : `<p class="muted small">No deadlines scheduled.</p>`}</div></section>`,
  };
}

/* ======================= profile ======================= */
export function profilePage(portal, user) {
  const sch = db.school(user.school_id);
  const needs = db.profileNeedsApproval(user);
  const pc = user.pending_change?.fields || null;
  const label = { name: "Full name", position: "Position", school_id: "School", photo: "Profile photo" };
  const show = (k, v) => k === "school_id" ? (db.school(v)?.name || "District Office") : k === "photo" ? (v ? "New photo" : "Remove photo") : v;
  const schools = db.schools().filter((s) => s.active || s.id === user.school_id);
  return {
    title: "My Profile",
    desc: needs ? "Changes to your name, position, school or photo are reviewed by an administrator before they appear." : "",
    html: `${pc ? `<section class="notice warn" style="max-width:820px">${icon("clock")}<div class="grow"><b>Waiting for approval since ${fmtDateTime(user.pending_change.at)}</b>
        <ul style="margin:6px 0 8px;padding-left:18px">${Object.entries(pc).map(([k, v]) => `<li>${esc(label[k])}: <b>${esc(show(k, v))}</b>${k === "photo" && v ? ` <img src="${esc(v)}" alt="" style="width:28px;height:28px;border-radius:50%;vertical-align:middle;margin-left:4px">` : ""}</li>`).join("")}</ul>
        <button type="button" class="btn btn-ghost btn-sm" data-cancelchange>Cancel request</button></div></section>` : ""}
    ${user.change_note ? `<section class="notice" style="max-width:820px">${icon("info")}<span>Your last profile change wasn't approved: ${esc(user.change_note)}</span></section>` : ""}
    <section class="card" style="max-width:820px"><form class="stack" data-profile>
      <div class="row" style="gap:18px">${avatar(user, "lg")}<div class="stack" style="gap:8px"><b>Profile photo</b><span class="small muted">JPG or PNG, up to 2 MB.${needs ? " A new photo shows after approval." : ""}</span>
        <div class="row"><label class="btn btn-ghost btn-sm" style="cursor:pointer">${icon("upload")}${user.photo ? "Change photo" : "Upload photo"}<input type="file" accept="image/png,image/jpeg" hidden data-photo></label>${user.photo ? `<button type="button" class="btn btn-ghost btn-sm" data-rmphoto>Remove</button>` : ""}</div></div></div>
      <div class="grid-2">
        <label class="field"><span class="req">Full name</span><input name="name" value="${esc(pc?.name ?? user.name)}" required></label>
        <label class="field"><span class="req">Position / designation</span><input name="position" value="${esc(pc?.position ?? user.position ?? "")}" required></label>
        <label class="field">Institutional email<input value="${esc(user.email || "")}" disabled><span class="hint">Your sign-in email can only be changed by an administrator.</span></label>
        ${user.role === "teacher" ? `<label class="field">School<select name="school_id">${schools.map((s) => `<option value="${s.id}" ${(pc?.school_id ?? user.school_id) === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>`
          : `<label class="field">School<input value="${esc(sch?.name || "District Office")}" disabled></label>`}
        <label class="field">Role<input value="${esc(ROLES[user.role])}" disabled></label>
        <label class="field">Member since<input value="${fmtDate(user.created_at)}" disabled></label>
      </div>
      <div class="row"><button class="btn btn-primary">${icon(needs ? "send" : "save")}${needs ? "Send changes for approval" : "Save changes"}</button></div></form></section>`,
    bind(root) {
      const rerender = () => window.dispatchEvent(new Event("rd360:render"));
      const apply = (fields, okMsg) => {
        try {
          if (needs) { db.requestProfileChange(user, fields); toast("Sent to an administrator for approval."); }
          else { db.updateUser(user, user.id, fields); toast(okMsg); }
          rerender();
        } catch (err) { toast(err.message, "err"); }
      };
      root.querySelector("[data-profile]").addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const fields = { name: String(fd.get("name")).trim(), position: String(fd.get("position")).trim() };
        if (fd.has("school_id")) fields.school_id = String(fd.get("school_id"));
        if (!fields.name || !fields.position) return toast("Name and position are required.", "err");
        apply(fields, "Profile saved.");
      });
      root.querySelector("[data-cancelchange]")?.addEventListener("click", () => { db.cancelProfileChange(user); toast("Request cancelled."); rerender(); });
      root.querySelector("[data-photo]").addEventListener("change", (e) => {
        const f = e.target.files[0]; if (!f) return;
        if (!["image/png", "image/jpeg"].includes(f.type)) return toast("Please choose a JPG or PNG image.", "err");
        if (f.size > 2 * 1024 * 1024) return toast("The photo must be 2 MB or smaller.", "err");
        const img = new Image(), url = URL.createObjectURL(f);
        img.onload = () => { // square-crop and shrink to 256px
          const s = Math.min(img.width, img.height), c = document.createElement("canvas"); c.width = c.height = 256;
          c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
          URL.revokeObjectURL(url);
          apply({ photo: c.toDataURL("image/jpeg", 0.85) }, "Profile photo updated.");
        };
        img.src = url;
      });
      root.querySelector("[data-rmphoto]")?.addEventListener("click", () => apply({ photo: null }, "Profile photo removed."));
    },
  };
}

/* ======================= settings ======================= */
export function settingsPage(portal, user) {
  const prefs = user.prefs || { email: true, deadlines: true, decisions: true };
  const theme = document.documentElement.dataset.theme || "light";
  return {
    title: portal === "t" ? "Settings" : "System Settings",
    html: `<section class="card stack" style="max-width:820px"><h2 style="font-size:16px">Appearance</h2>
      <div class="seg" role="group" aria-label="Theme">${["light", "dark"].map((t) => `<button type="button" data-theme-set="${t}" class="${theme === t ? "on" : ""}">${icon(t === "light" ? "sun" : "moon")}${t === "light" ? "Light" : "Dark"}</button>`).join("")}</div></section>
    <section class="card stack" style="max-width:820px"><h2 style="font-size:16px">Notification preferences</h2>
      <form class="stack" data-prefs>${[["decisions", "Status changes and decisions"], ["deadlines", "Deadline reminders"], ["email", "Also send by email (when email delivery is configured)"]].map(([k, l]) => `<label class="row" style="font-size:14px"><input type="checkbox" name="${k}" style="width:auto" ${prefs[k] ? "checked" : ""}>${l}</label>`).join("")}
      <div><button class="btn btn-primary btn-sm">Save preferences</button></div></form></section>
    ${securityHtml(user)}
    <section class="card stack" style="max-width:820px"><h2 style="font-size:16px">Password</h2>
      <form class="grid-2" data-pw><label class="field span-2"><span class="req">Current password</span><input type="password" name="current" autocomplete="current-password" required></label>
        <label class="field"><span class="req">New password</span><input type="password" name="next" autocomplete="new-password" required><span class="hint">At least 8 characters, with letters and numbers.</span></label>
        <label class="field"><span class="req">Confirm new password</span><input type="password" name="next2" autocomplete="new-password" required></label>
        <div><button class="btn btn-ink btn-sm">${icon("key")}Change password</button></div></form></section>
    ${user.role === "superadmin" ? `<section class="card stack" style="max-width:820px"><h2 style="font-size:16px">System options</h2>
      <form class="stack" data-sys>
        <label class="row small" style="flex-wrap:nowrap"><input type="checkbox" name="adminsCanPublish" ${db.settings().adminsCanPublish ? "checked" : ""}>Research Administrators can publish home page content (otherwise only the Super Administrator can)</label>
        <label class="field" style="max-width:340px">Sign out after inactivity<select name="idleMinutes">${[15, 30, 60, 120].map((m) => `<option value="${m}" ${Number(db.settings().idleMinutes || 30) === m ? "selected" : ""}>${m} minutes</option>`).join("")}</select><span class="hint">Shorter is safer on shared computers.</span></label>
        <div><button class="btn btn-ink btn-sm">Save options</button></div></form></section>
    <section class="card stack" style="max-width:820px;border:1px solid color-mix(in srgb, var(--ar) 35%, transparent)"><h2 style="font-size:16px;color:var(--danger)">Erase all data</h2>
      <p class="small muted">${PREVIEW_MODE ? "Permanently deletes every account, school, research record, notification, audit entry and home page content saved in this browser. The site returns to first-time setup." : "Erasing the shared database is done from the database console, not from this page."}</p>
      ${PREVIEW_MODE ? `<div><button class="btn btn-danger btn-sm" data-erase>${icon("trash")}Erase all data…</button></div>` : ""}</section>` : ""}`,
    bind(root) {
      root.querySelectorAll("[data-theme-set]").forEach((b) => b.addEventListener("click", () => {
        document.documentElement.dataset.theme = b.dataset.themeSet;
        try { localStorage.setItem("rd360.theme", b.dataset.themeSet); } catch { /* ignore */ }
        window.dispatchEvent(new Event("rd360:render"));
      }));
      root.querySelector("[data-prefs]").addEventListener("submit", (e) => {
        e.preventDefault(); const fd = new FormData(e.target);
        db.updateUser(user, user.id, { prefs: { decisions: fd.has("decisions"), deadlines: fd.has("deadlines"), email: fd.has("email") } }); toast("Preferences saved.");
      });
      attachStrength(root);
      bindSecurity(root, user);
      root.querySelector("[data-pw]").addEventListener("submit", async (e) => {
        e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
        if (f.next !== f.next2) return toast("The new passwords don't match.", "err");
        const btn = e.target.querySelector("button"); btn.disabled = true;
        try { await db.changePassword(user.id, f.current, f.next); e.target.reset(); toast("Password changed."); }
        catch (err) { toast(err.message, "err"); }
        btn.disabled = false;
      });
      root.querySelector("[data-sys]")?.addEventListener("submit", (e) => {
        e.preventDefault(); const fd = new FormData(e.target);
        try { db.updateSettings(user, { adminsCanPublish: fd.has("adminsCanPublish"), idleMinutes: Number(fd.get("idleMinutes")) || 30 }); toast("System options saved."); } catch (err) { toast(err.message, "err"); }
      });
      root.querySelector("[data-erase]")?.addEventListener("click", async () => {
        const r = await modal({ title: "Erase all data?", body: "This cannot be undone. Type <b>ERASE</b> to confirm.", fields: [{ name: "confirm", label: "Confirmation", required: true }], confirm: "Erase everything", danger: true });
        if (!r) return;
        if (r.confirm.trim() !== "ERASE") return toast("Type ERASE in capital letters to confirm.", "err");
        try { db.eraseAll(user); location.hash = "#/setup"; toast("All data erased."); } catch (err) { toast(err.message, "err"); }
      });
    },
  };
}

/* ======================= help ======================= */
export function helpPage(portal) {
  const t = portal === "t";
  const items = t ? [
    ["Submitting a proposal", "Open Submit New Research. The wizard has six steps and saves your draft automatically. The Review step lists anything still missing. Your Research ID is created when you submit."],
    ["Tracking your research", "Each project shows its status, progress, next required action and deadline. Click any dashboard card to see the matching projects."],
    ["Responding to revisions", "When a project is Returned for Revision, open it, read the feedback, update the details or attachments, then resubmit from the Review step."],
    ["Implementation updates", "Approved projects move to Ongoing Implementation. Keep milestones current so the district can provide timely technical assistance."],
    ["Repository", "Completed research is searchable in the Research Repository by title, author, school, theme and keywords."],
  ] : [
    ["Screening submissions", "Use the Submission Queue. Each action asks for a reason and is recorded in the audit log. Only valid next steps are offered for each status."],
    ["Assigning evaluators", "In Technical Evaluation, assign an evaluator and set a due date. Researchers can never evaluate their own work."],
    ["Monitoring", "Research Monitoring lists approved and ongoing projects with overdue indicators. Dashboard cards and charts open the exact records behind each number."],
    ["Schools and users", "Maintain the official school directory and approve accounts. Only a Super Administrator can change roles, and the last active Super Administrator is protected."],
    ["Reports", "Reports and Exports builds registers and summaries from the current filters and downloads them as CSV (opens in Excel) or prints to PDF."],
  ];
  return {
    title: t ? "Help and User Guide" : "Help and Documentation",
    html: `<section class="card stack" style="max-width:900px">${items.map(([h, b]) => `<details class="review-block" open><summary style="cursor:pointer;font-weight:700">${esc(h)}</summary><p class="small" style="margin-top:8px">${esc(b)}</p></details>`).join("")}
      <div class="notice">${icon("info")}<span>Need help? Contact the District Research Coordinator, ${esc("Schools District of Aliaga")}.</span></div></section>`,
  };
}

/* ======================= security: where you're signed in ======================= */
function securityHtml(user) {
  const { active, recent } = db.sessionsFor(user.id);
  const ic = (label) => icon(/phone|iPad/i.test(label) ? "phone" : "monitor");
  const row = (r, live) => `<div class="sess-row ${r.current ? "current" : ""}"><span class="sess-ic">${ic(r.label)}</span>
    <span class="grow"><b>${esc(r.label)}</b><small>${live ? (r.current ? "This device · active now" : `Last active ${relTime(r.last)}`) : `${esc(r.why || "Ended")} · ${relTime(r.ended || r.last)}`} · signed in ${fmtDateTime(r.at)}</small></span>
    ${live ? (r.current ? `<span class="badge s-done">This device</span>` : `<button class="btn btn-ghost btn-sm" data-endsess="${r.sid}">Sign out</button>`) : ""}</div>`;
  return `<section class="card stack" style="max-width:820px" id="security"><div class="card-head" style="margin:0"><h2 style="font-size:16px">Where you're signed in</h2>
      ${active.filter((r) => !r.current).length ? `<button class="btn btn-ghost btn-sm" data-signout-others>${icon("logout")}Sign out everywhere else</button>` : ""}</div>
    <p class="small muted">You get a security alert when your account is used on a new device, and after wrong passwords are entered. If something looks unfamiliar, sign that device out and change your password.</p>
    <div class="sess">${active.map((r) => row(r, true)).join("") || `<p class="small muted">No active sessions.</p>`}</div>
    ${recent.length ? `<details><summary class="small" style="cursor:pointer">Recent sessions (${recent.length})</summary><div class="sess" style="margin-top:8px">${recent.map((r) => row(r, false)).join("")}</div></details>` : ""}
    <div><button class="btn btn-ghost btn-sm" data-signout-all>${icon("logout")}Sign out of all devices, including this one</button></div></section>`;
}
function bindSecurity(root, user) {
  root.querySelectorAll("[data-endsess]").forEach((b) => b.addEventListener("click", () => {
    try { db.endSession(user, b.dataset.endsess); toast("That device is signed out."); window.dispatchEvent(new Event("rd360:render")); } catch (e) { toast(e.message, "err"); }
  }));
  root.querySelector("[data-signout-others]")?.addEventListener("click", async () => {
    if (!(await modal({ title: "Sign out everywhere else?", body: "Every other device signed in to your account will be signed out. This device stays signed in.", confirm: "Sign out others" }))) return;
    const n = db.signOutEverywhere(user, false); toast(`${n} other session${n === 1 ? "" : "s"} signed out.`); window.dispatchEvent(new Event("rd360:render"));
  });
  root.querySelector("[data-signout-all]")?.addEventListener("click", async () => {
    if (!(await modal({ title: "Sign out of all devices?", body: "You'll be signed out here too and need to sign in again.", confirm: "Sign out everywhere", danger: true }))) return;
    db.signOutEverywhere(user, true); location.hash = "#/"; toast("Signed out of all devices.");
  });
}
