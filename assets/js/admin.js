// Administrator portal pages.
import { icon } from "./icons.js";
import { db, CATEGORIES, catById, STAGES, STATUSES, ADMIN_TRANSITIONS, TERMINAL, ROLES, isOverdue, nextAction } from "./store.js";
import { esc, fmtDate, fmtDateTime, relTime, statusBadge, catBadge, progressBar, deadlineCell, toast, modal, emptyState, hbar, donut, trend, downloadCSV } from "./ui.js";
import { FILTERS, matchStatus, doTransition, projectsPage } from "./pages.js";

const fire = () => window.dispatchEvent(new Event("rd360:render"));
const refreshed = () => `<p class="chart-meta">Computed from ${db.projects().filter((p) => p.status !== "Draft").length} submitted records · refreshed ${fmtDateTime(new Date())}</p>`;

function analyticsData(rows) {
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i)); return d; });
  return {
    trend: months.map((m) => ({ label: m.toLocaleString("en-PH", { month: "short" }), value: rows.filter((p) => { const s = new Date(p.submitted_at); return s.getMonth() === m.getMonth() && s.getFullYear() === m.getFullYear(); }).length })),
    cats: CATEGORIES.map((c) => ({ label: c.name, value: rows.filter((p) => p.category === c.id).length, color: c.color, href: `#/a/research?cat=${c.id}` })),
    stages: [
      ["Screening", "screening", "#173D73"], ["Technical review", "technical", "#3678F5"], ["Returned for revision", "returned", "#D9541E"], ["Pending approval", "approval", "#C77700"],
      ["Approved", "approved", "#2F6FD6"], ["Ongoing", "ongoing", "#19A6BE"], ["Completed / archived", "completed", "#249653"], ["Rejected / withdrawn", "closed", "#9AA5B8"],
    ].map(([label, k, color]) => ({ label, value: rows.filter((p) => matchStatus(p, k)).length, color, href: `#/a/research?status=${k}` })),
    schools: db.schools().map((s) => ({ label: s.name.replace("Elementary School", "ES").replace("National High School", "NHS").replace("Integrated School", "IS").replace("Senior High School", "SHS").replace("High School", "HS"), value: rows.filter((p) => p.school_id === s.id).length, color: s.type === "Elementary" ? "#19A6BE" : "#173D73", href: `#/a/research?school=${s.id}` })).sort((a, b) => b.value - a.value),
  };
}

/* ======================= executive dashboard ======================= */
export function adminDashboard(user) {
  const rows = db.visibleProjects(user);
  const researchers = new Set(rows.map((p) => p.owner_id));
  const schools = new Set(rows.map((p) => p.school_id));
  const tones = { INK: "k-ink", "#3678F5": "k-sky", "#173D73": "k-white", "#5B6CC9": "k-lav", "#D9541E": "k-peach", "#C77700": "k-cream", "#2F6FD6": "k-sky", "#19A6BE": "k-mint", "#D93636": "k-white k-alert", "#249653": "k-mint", "#1D7A45": "k-mint" };
  const kpi = (label, n, href, ic, color, foot = "View records") => `<a class="kpi ${tones[color] || "k-white"}" href="${href}"><div class="top"><span class="lbl">${esc(label)}</span><span class="ic">${icon(ic)}</span></div><span class="val">${n}</span><span class="foot">${esc(foot)} ${icon("chevron")}</span></a>`;
  const ac = db.approvalCounts(); const pendingUsers = ac.accounts; const reminders = db.approvalReminders();
  const firstRun = !db.schools().length || db.users().length < 2 || !db.cmsPublished();
  const c = (k) => rows.filter((p) => matchStatus(p, k)).length;
  const overdue = rows.filter(isOverdue);
  const a = analyticsData(rows);
  const queue = rows.filter((p) => ["Submitted", "Revision Resubmitted", "Pending Approval"].includes(p.status)).slice(0, 5);
  return {
    title: "Executive Dashboard",
    html: `<section class="welcome"><div><h2>Good day, ${esc(user.name.split(" ")[0])}.</h2><p>Schools District of Aliaga · ${rows.length} submitted research record${rows.length === 1 ? "" : "s"} · ${overdue.length} overdue${pendingUsers ? ` · ${pendingUsers} new account${pendingUsers === 1 ? "" : "s"} to approve` : ""}${ac.changes ? ` · ${ac.changes} profile change${ac.changes === 1 ? "" : "s"} to review` : ""}</p></div>
      <div class="row"><a class="btn btn-ghost" href="#/a/reports">${icon("download")}Reports</a><a class="btn btn-gold" href="#/a/queue">${icon("inbox")}Open submission queue</a></div></section>
    ${reminders.length ? `<section class="card"><div class="card-head"><h2>Waiting too long</h2><span class="sub">Items waiting 3 or more days for an administrator</span></div>
      <div class="stack" style="gap:8px">${reminders.slice(0, 6).map((r) => `<a class="remind" href="${r.href}">${icon("clock")}<span class="grow"><b class="small">${{ account: "New account", change: "Profile change", school: "School request" }[r.kind]}: ${esc(r.name)}</b></span><span class="wait late">${r.days} days</span></a>`).join("")}</div></section>` : ""}
    ${firstRun ? `<section class="card"><div class="card-head"><h2>Get the system ready</h2><span class="sub">Recommended first steps</span></div>
      <div class="stack" style="gap:10px">${[
        [db.schools().length > 0, "Add the district's schools", "Teachers choose their school when registering.", "#/a/schools"],
        [db.users().length > 1, "Create administrator and evaluator accounts", "Give coordinators and technical reviewers their own sign-in.", "#/a/users"],
        [!!db.cmsPublished(), "Publish the public home page", "Add highlights, news and contact details, then publish.", "#/a/cms"],
      ].map(([done, t, s, h]) => `<a class="notif ${done ? "" : "unread"}" href="${h}" style="color:var(--text);text-decoration:none"><span class="kpi-ic" style="width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:${done ? "var(--green-2)" : "var(--surface)"};color:${done ? "#fff" : "var(--muted)"}">${icon(done ? "check" : "chevron")}</span><div class="grow"><b class="small">${t}</b><div class="small muted">${s}</div></div></a>`).join("")}</div></section>` : ""}
    <section class="kpi-grid">
      ${kpi("Total projects", rows.length, "#/a/research", "folder", "INK")}
      ${kpi("New submissions", c("submitted"), "#/a/research?status=submitted", "send", "#173D73")}
      ${kpi("Pending screening", c("screening"), "#/a/research?status=screening", "inbox", "#5B6CC9")}
      ${kpi("Pending technical review", c("technical"), "#/a/research?status=technical", "check_clip", "#3678F5")}
      ${kpi("Returned for revision", c("returned"), "#/a/research?status=returned", "left", "#D9541E")}
      ${kpi("Pending approval", c("approval"), "#/a/research?status=approval", "clock", "#C77700")}
      ${kpi("Approved", c("approved"), "#/a/research?status=approved", "check", "#2F6FD6")}
      ${kpi("Ongoing implementation", c("ongoing"), "#/a/research?status=ongoing", "activity", "#19A6BE")}
      ${kpi("Overdue / stalled", overdue.length, "#/a/research?status=overdue", "alert", "#D93636", "Needs attention")}
      ${kpi("Completed", rows.filter((p) => p.status === "Completed").length, "#/a/research?status=Completed", "check_clip", "#249653")}
      ${kpi("Published / archived", c("published"), "#/a/research?status=published", "library", "#1D7A45")}
      ${kpi("Participating schools", schools.size, "#/a/schools", "school", "#173D73", `of ${db.schools().filter((s) => s.active).length} active schools`)}
      ${kpi("Active researchers", researchers.size, "#/a/users", "users", "#5B6CC9", "Open directory")}
    </section>
    <div class="charts">
      <section class="card"><div class="card-head"><h2>Submission trend</h2><span class="sub">Last 6 months</span></div>${trend(a.trend)}${refreshed()}</section>
      <section class="card"><div class="card-head"><h2>Category distribution</h2><span class="sub">Click a segment to drill down</span></div>${donut(a.cats, "Projects")}${refreshed()}</section>
      <section class="card"><div class="card-head"><h2>Workflow stage distribution</h2><span class="sub">Current status of every record</span></div>${hbar(a.stages)}</section>
      <section class="card"><div class="card-head"><h2>School participation</h2><span class="sub">Projects per school</span></div>${hbar(a.schools)}</section>
    </div>
    <div class="charts">
      <section class="card"><div class="card-head"><h2>Needs a decision</h2><a class="small" href="#/a/queue">Open queue</a></div>
        ${queue.length ? `<div class="stack" style="gap:10px">${queue.map((p) => `<a class="notif" style="color:var(--text);text-decoration:none" href="#/a/project/${p.id}"><div class="grow"><b class="small">${esc(p.title)}</b><div class="small muted mono">${esc(p.research_id)} · ${esc(db.school(p.school_id)?.name)}</div></div>${statusBadge(p.status)}</a>`).join("")}</div>` : `<p class="muted small">Queue is clear.</p>`}</section>
      <section class="card"><div class="card-head"><h2>Overdue projects</h2><a class="small" href="#/a/research?status=overdue">See all</a></div>
        ${overdue.length ? `<div class="stack" style="gap:10px">${overdue.slice(0, 5).map((p) => `<a class="notif" style="color:var(--text);text-decoration:none;border-left:4px solid var(--danger)" href="#/a/project/${p.id}"><div class="grow"><b class="small">${esc(p.title)}</b><div class="small muted">${esc(nextAction(p, "admin"))}</div></div><span class="small overdue">${fmtDate(p.deadline)}</span></a>`).join("")}</div>` : `<p class="muted small">No overdue projects.</p>`}</section>
    </div>`,
  };
}

/* ======================= analytics ======================= */
export function analyticsPage(user, q) {
  const cat = q.get("cat") || "", type = q.get("type") || "", year = q.get("year") || "";
  let rows = db.visibleProjects(user);
  const years = [...new Set(rows.map((p) => new Date(p.submitted_at).getFullYear()))].sort((a, b) => b - a);
  rows = rows.filter((p) => (!cat || p.category === cat) && (!type || db.school(p.school_id)?.type === type) && (!year || String(new Date(p.submitted_at).getFullYear()) === year));
  const a = analyticsData(rows);
  const done = rows.filter((p) => ["Completed", "Published", "Archived"].includes(p.status));
  const decided = rows.filter((p) => !["Submitted", "Under Initial Screening", "Under Technical Review", "Revision Resubmitted", "Pending Approval", "Pending Ethics Review"].includes(p.status));
  const turnaround = (() => {
    const xs = rows.map((p) => { const h = p.history.find((x) => x.actor !== p.owner_id && x.to); return h && p.submitted_at ? (new Date(h.at) - new Date(p.submitted_at)) / 86400000 : null; }).filter((x) => x != null && x >= 0);
    return xs.length ? (xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(1) : "—";
  })();
  const revCycles = rows.filter((p) => p.history.some((h) => h.to === "Returned for Revision")).length;
  const sel = (name, value, opts) => `<select name="${name}">${opts.map(([v, l]) => `<option value="${v}" ${String(v) === value ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  return {
    title: "District Analytics",
    html: `<section class="card"><form class="toolbar" data-af>${sel("cat", cat, [["", "All categories"], ...CATEGORIES.map((c) => [c.id, c.name])])}${sel("type", type, [["", "All school types"], ["Elementary", "Elementary"], ["Secondary", "Secondary"]])}${sel("year", year, [["", "All years"], ...years.map((y) => [y, y])])}<span class="small muted">Reporting period: ${year || "all years"} · ${rows.length} records</span></form></section>
    <section class="kpi-grid">
      <div class="kpi k-sky"><span class="lbl">Records in scope</span><span class="val">${rows.length}</span><span class="foot">Current count</span></div>
      <div class="kpi k-mint"><span class="lbl">Completion rate</span><span class="val">${rows.length ? Math.round((done.length / rows.length) * 100) : 0}%</span><span class="foot">${done.length} completed of ${rows.length}</span></div>
      <div class="kpi k-cream"><span class="lbl">Avg. days to first action</span><span class="val">${turnaround}</span><span class="foot">Submission → first admin action</span></div>
      <div class="kpi k-peach"><span class="lbl">Projects with revisions</span><span class="val">${revCycles}</span><span class="foot">Returned at least once</span></div>
      <div class="kpi k-lav"><span class="lbl">Decided / in later stages</span><span class="val">${decided.length}</span><span class="foot">Past review stages</span></div>
    </section>
    <div class="charts">
      <section class="card"><div class="card-head"><h2>Submission trend</h2><span class="sub">Last 6 months</span></div>${trend(a.trend)}${refreshed()}</section>
      <section class="card"><div class="card-head"><h2>Category mix</h2></div>${donut(a.cats, "Projects")}</section>
      <section class="card"><div class="card-head"><h2>Workflow analytics</h2><span class="sub">Counts by stage</span></div>${hbar(a.stages)}</section>
      <section class="card"><div class="card-head"><h2>School analytics</h2><span class="sub">Submissions per school</span></div>${hbar(a.schools)}</section>
    </div>`,
    bind(root) { root.querySelector("[data-af]").addEventListener("change", (e) => { const p = new URLSearchParams([...new FormData(e.currentTarget).entries()].filter(([, v]) => v)); location.hash = `#/a/analytics?${p}`; }); },
  };
}

/* ======================= submission queue ======================= */
export function queuePage(user) {
  const rows = db.visibleProjects(user).filter((p) => (ADMIN_TRANSITIONS[p.status] || []).length && ["Submitted", "Under Initial Screening", "Under Technical Review", "Revision Resubmitted", "Pending Ethics Review", "Pending Approval"].includes(p.status))
    .sort((a, b) => new Date(a.deadline || "2999") - new Date(b.deadline || "2999"));
  return {
    title: "Submission Queue",
    html: `<section class="card stack"><p class="small muted">Submissions waiting for screening, evaluation or a decision, oldest deadline first. Every action requires a reason and is written to the audit log.</p>
      ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Research ID</th><th>Title</th><th>Researcher / school</th><th>Category</th><th>Status</th><th>Evaluator</th><th>Deadline</th><th>Actions</th></tr></thead><tbody>
      ${rows.map((p) => `<tr><td class="mono">${esc(p.research_id)}</td><td style="min-width:220px"><a class="title-link" href="#/a/project/${p.id}">${esc(p.title)}</a><div class="small muted">Submitted ${fmtDate(p.submitted_at)}</div></td>
        <td class="small">${esc(db.user(p.owner_id)?.name)}<br><span class="muted">${esc(db.school(p.school_id)?.name)}</span></td><td>${catBadge(p.category)}</td><td>${statusBadge(p.status)}</td>
        <td class="small">${esc(db.user(p.evaluator_id)?.name || "—")}</td><td class="small">${deadlineCell(p)}</td>
        <td><div class="row" style="gap:6px;flex-wrap:nowrap">${ADMIN_TRANSITIONS[p.status].map((t) => `<button class="btn ${["Rejected", "Returned for Revision"].includes(t) ? "btn-ghost" : "btn-primary"} btn-sm" data-id="${p.id}" data-to="${esc(t)}" title="${esc(t)}">${esc(t.replace("Under ", "").replace("Pending ", ""))}</button>`).join("")}</div></td></tr>`).join("")}
      </tbody></table></div>` : emptyState("The queue is clear", "New submissions and resubmissions will appear here.")}</section>`,
    bind(root) { root.querySelectorAll("[data-to]").forEach((b) => b.addEventListener("click", () => doTransition(user, db.project(b.dataset.id), b.dataset.to))); },
  };
}

/* ======================= technical evaluation ======================= */
export function evaluationPage(user) {
  const isEval = user.role === "evaluator";
  const rows = isEval ? db.visibleProjects(user) : db.visibleProjects(user).filter((p) => ["Under Initial Screening", "Under Technical Review", "Revision Resubmitted", "Pending Ethics Review"].includes(p.status));
  const evaluators = db.users().filter((u) => u.role === "evaluator" && u.status === "active");
  const load = (id) => db.projects().filter((p) => p.evaluator_id === id && !TERMINAL.includes(p.status) && !["Completed", "Published"].includes(p.status)).length;
  return {
    title: "Technical Evaluation",
    html: `${isEval ? `<div class="notice">${icon("info")}<span>You can see only the submissions formally assigned to you. Open a project to submit your recommendation; the final decision stays with the authorized administrator.</span></div>` :
      `<section class="card"><div class="card-head"><h2>Evaluator workload</h2></div><div class="row">${evaluators.map((e) => `<span class="tag" style="font-size:13px;padding:6px 10px">${esc(e.name)} · <b>${load(e.id)}</b> active</span>`).join("") || `<span class="muted small">No evaluators yet. Assign the Evaluator role in User and Role Management.</span>`}</div></section>`}
    <section class="card stack">${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Research ID</th><th>Title</th><th>Status</th><th>Evaluator</th><th>Due date</th>${isEval ? "<th></th>" : "<th>Assign</th>"}</tr></thead><tbody>
      ${rows.map((p) => `<tr><td class="mono">${esc(p.research_id)}</td><td style="min-width:220px"><a class="title-link" href="#/a/project/${p.id}">${esc(p.title)}</a><div class="small muted">${esc(db.user(p.owner_id)?.name)} · ${esc(db.school(p.school_id)?.name)}</div></td><td>${statusBadge(p.status)}</td>
        <td class="small">${esc(db.user(p.evaluator_id)?.name || "Not assigned")}</td><td class="small">${deadlineCell(p)}</td>
        ${isEval ? `<td><a class="btn btn-primary btn-sm" href="#/a/project/${p.id}">Review</a></td>` : `<td><form class="row" style="gap:6px;flex-wrap:nowrap" data-assign="${p.id}"><select name="ev" style="min-width:150px" aria-label="Evaluator"><option value="">— Evaluator —</option>${evaluators.filter((e) => e.id !== p.owner_id).map((e) => `<option value="${e.id}" ${e.id === p.evaluator_id ? "selected" : ""}>${esc(e.name)}</option>`).join("")}</select><input type="date" name="due" aria-label="Due date" style="width:150px" value="${p.deadline ? p.deadline.slice(0, 10) : ""}"><button class="btn btn-primary btn-sm">Save</button></form></td>`}</tr>`).join("")}
      </tbody></table></div>` : emptyState(isEval ? "No assigned submissions" : "Nothing to assign", isEval ? "Assignments from the Research Administrator will appear here." : "Projects under screening or technical review appear here.")}</section>`,
    bind(root) {
      root.querySelectorAll("[data-assign]").forEach((f) => f.addEventListener("submit", async (e) => {
        e.preventDefault(); const fd = new FormData(f);
        const p = db.project(f.dataset.assign);
        if (fd.get("ev") && fd.get("ev") !== p.evaluator_id && p.evaluator_id) {
          const r = await modal({ title: "Reassign evaluator?", fields: [{ name: "reason", label: "Reason for reassignment", type: "textarea", required: true }], confirm: "Reassign" });
          if (!r) return;
          db.log(user.id, "Reassigned evaluator", "project", p.id, r.reason);
        }
        try { db.assignEvaluator(user, p.id, fd.get("ev"), fd.get("due")); toast("Assignment saved."); fire(); } catch (err) { toast(err.message, "err"); }
      }));
    },
  };
}

/* ======================= workflow ======================= */
export function workflowPage() {
  return {
    title: "Workflow Management",
    html: `<div class="notice">${icon("info")}<span>Current workflow template: <b>District Research Lifecycle v1</b>. Editing stages, deadlines and notification rules will be added in a later update; changes will be versioned so active projects keep the template they started with.</span></div>
    <section class="card"><div class="card-head"><h2>Lifecycle stages</h2><span class="sub">Dashed = conditional (excluded from progress when not applicable)</span></div>
      <div class="lifecycle">${STAGES.map((s, i) => `<div class="step ${s.cond ? "cond" : ""}"><div class="num">${i + 1}</div><div class="lbl">${esc(s.name)}</div>${s.cond ? '<div class="cond-note">when applicable</div>' : ""}</div>`).join("")}</div></section>
    <section class="card"><div class="card-head"><h2>Valid status transitions</h2><span class="sub">Only these moves are allowed for administrators</span></div>
      <div class="table-wrap"><table><thead><tr><th>From status</th><th>Allowed next statuses</th></tr></thead><tbody>
      <tr><td>${statusBadge("Draft")}</td><td class="small">Submitted <span class="muted">(by the researcher)</span></td></tr>
      ${Object.entries(ADMIN_TRANSITIONS).map(([f, ts]) => `<tr><td>${statusBadge(f)}</td><td><div class="row" style="gap:6px">${ts.map(statusBadge).join("")}</div></td></tr>`).join("")}
      <tr><td>${statusBadge("Returned for Revision")}</td><td class="small">Revision Resubmitted <span class="muted">(by the researcher)</span></td></tr>
      </tbody></table></div></section>`,
  };
}

/* ======================= monitoring ======================= */
export function monitoringPage(user) {
  const rows = db.visibleProjects(user).filter((p) => ["Approved", "Ongoing Implementation", "For Final Evaluation", "For Dissemination"].includes(p.status))
    .sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)) || new Date(a.deadline || "2999") - new Date(b.deadline || "2999"));
  return {
    title: "Research Monitoring",
    html: `<section class="kpi-grid">
      <a class="kpi k-mint" href="#/a/research?status=ongoing"><span class="lbl">Under implementation</span><span class="val">${rows.length}</span><span class="foot">Approved to dissemination</span></a>
      <a class="kpi k-white k-alert" href="#/a/research?status=overdue"><span class="lbl">Overdue updates</span><span class="val">${rows.filter(isOverdue).length}</span><span class="foot">Need technical assistance</span></a>
      <a class="kpi k-cream" href="#/a/research?status=For Final Evaluation"><span class="lbl">For final evaluation</span><span class="val">${rows.filter((p) => p.status === "For Final Evaluation").length}</span><span class="foot">Completion evidence due</span></a></section>
    <section class="card">${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Research ID</th><th>Title</th><th>School</th><th>Status</th><th>Progress</th><th>Next milestone / deadline</th><th></th></tr></thead><tbody>
      ${rows.map((p) => `<tr><td class="mono">${esc(p.research_id)}</td><td style="min-width:220px"><a class="title-link" href="#/a/project/${p.id}">${esc(p.title)}</a></td><td class="small">${esc(db.school(p.school_id)?.name)}</td><td>${statusBadge(p.status)}</td><td style="min-width:120px">${progressBar(p)}</td><td class="small">${deadlineCell(p)}</td>
        <td><button class="btn btn-ghost btn-sm" data-req="${p.id}">Request update</button></td></tr>`).join("")}</tbody></table></div>` : emptyState("No projects under implementation", "Approved projects will be monitored here.")}</section>`,
    bind(root) {
      root.querySelectorAll("[data-req]").forEach((b) => b.addEventListener("click", async () => {
        const p = db.project(b.dataset.req);
        const r = await modal({ title: "Request an implementation update", body: esc(p.title), fields: [{ name: "msg", label: "Message to the researcher", type: "textarea", required: true, value: "Please post your latest milestone update and supporting evidence." }], confirm: "Send request" });
        if (!r) return;
        db.requestUpdate(user, p.id, r.msg);
        toast("Update request sent to the researcher.");
      }));
    },
  };
}

/* ======================= schools ======================= */
const daysAgo = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
const waitBadge = (iso) => { const d = daysAgo(iso); return `<span class="wait ${d >= 3 ? "late" : ""}">${d === 0 ? "today" : `waiting ${d} day${d === 1 ? "" : "s"}`}</span>`; };

export function schoolsPage(user) {
  const rows = db.schools();
  const reqs = db.schoolRequests();
  return {
    title: "School Management",
    html: `${reqs.length ? `<section class="card stack"><div class="card-head" style="margin:0"><h2>School requests</h2><span class="sub">Teachers typed these schools because they weren't in the list</span></div>
      ${reqs.map((r) => `<div class="req-row"><div><b>${esc(r.name)}</b><small>Requested by ${r.by.map((id) => esc(db.user(id)?.name || "someone")).join(", ")} · ${relTime(r.at)}${daysAgo(r.at) >= 3 ? ` · <span class="wait late">waiting ${daysAgo(r.at)} days</span>` : ""}</small></div>
        <div class="row" style="gap:6px"><button class="btn btn-green btn-sm" data-req-add="${r.id}">${icon("plus")}Add to directory</button><button class="btn btn-ghost btn-sm" data-req-link="${r.id}">Same as a listed school</button><button class="btn btn-ghost btn-sm" data-req-no="${r.id}">Decline</button></div></div>`).join("")}</section>` : ""}<div class="charts" style="grid-template-columns:minmax(0,2fr) minmax(280px,1fr)">
      <section class="card"><div class="card-head"><h2>District school directory</h2><span class="sub">${rows.length} schools · ${rows.filter((s) => s.active).length} active</span></div>
        <div class="table-wrap"><table><thead><tr><th>School</th><th>Type</th><th>Location</th><th>Users</th><th>Projects</th><th>Status</th><th></th></tr></thead><tbody>
        ${rows.map((s) => `<tr><td><a class="title-link" href="#/a/school/${s.id}"><b>${esc(s.name)}</b></a>${s.code ? `<div class="small muted">ID ${esc(s.code)}</div>` : ""}</td><td class="small">${esc(s.type)}</td><td class="small">${esc(s.location)}</td>
          <td>${db.users().filter((u) => u.school_id === s.id).length}</td><td><a href="#/a/research?school=${s.id}">${db.projects().filter((p) => p.school_id === s.id && p.status !== "Draft").length}</a></td>
          <td>${s.active ? `<span class="badge s-done">Active</span>` : `<span class="badge s-draft">Inactive</span>`}</td><td><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn btn-ghost btn-sm" data-edit="${s.id}">${icon("edit")}Edit</button><button class="btn btn-ghost btn-sm" data-toggle="${s.id}">${s.active ? "Deactivate" : "Activate"}</button></div></td></tr>`).join("") || `<tr><td colspan="7"><div class="empty"><div class="ic">${icon("school")}</div><h3>No schools yet</h3><p>Add the official list of district schools. Teachers pick their school when they register.</p></div></td></tr>`}
        </tbody></table></div><p class="chart-meta">Schools are deactivated, never deleted, so historical research records stay linked.</p></section>
      <section class="card"><div class="card-head"><h2>Add a school</h2></div><form class="stack" data-add>
        <label class="field"><span class="req">School name</span><input name="name" required></label>
        <label class="field">School ID<input name="code" inputmode="numeric"></label>
        <label class="field"><span class="req">Classification</span><select name="type"><option>Elementary</option><option>Secondary</option><option>Integrated</option></select></label>
        <label class="field">Location<input name="location" placeholder="Barangay, Aliaga"></label>
        <button class="btn btn-ink">${icon("plus")}Add school</button></form></section></div>`,
    bind(root) {
      root.querySelectorAll("[data-req-add]").forEach((b) => b.addEventListener("click", async () => {
        const r = db.schoolRequests().find((x) => x.id === b.dataset.reqAdd);
        const f = await modal({ title: "Add school to the directory", body: `Requested as "${esc(r.name)}". Check the official name and School ID first.`, confirm: "Add and link teachers", fields: [
          { name: "name", label: "Official school name", required: true, value: r.name }, { name: "code", label: "School ID" },
          { name: "type", label: "Classification", type: "select", value: "Elementary", options: ["Elementary", "Secondary", "Integrated"].map((v) => ({ value: v, label: v })) },
          { name: "location", label: "Location", value: "Aliaga, Nueva Ecija" }] });
        if (!f) return;
        try { const sc = db.resolveSchoolRequest(user, r.id, f); toast(`${sc.name} added; ${r.by.length} teacher${r.by.length === 1 ? "" : "s"} linked.`); fire(); } catch (e) { toast(e.message, "err"); }
      }));
      root.querySelectorAll("[data-req-link]").forEach((b) => b.addEventListener("click", async () => {
        const r = db.schoolRequests().find((x) => x.id === b.dataset.reqLink);
        const f = await modal({ title: "Link to a school already listed", body: `Use this when "${esc(r.name)}" is a typo or another name for a listed school.`, confirm: "Link teachers", fields: [
          { name: "existing_id", label: "School", type: "select", required: true, value: "", options: [{ value: "", label: "Choose the school…" }, ...db.schools().filter((s) => s.active).sort((a, c) => a.name.localeCompare(c.name)).map((s) => ({ value: s.id, label: s.name }))] }] });
        if (!f) return;
        try { const sc = db.resolveSchoolRequest(user, r.id, f); toast(`Linked to ${sc.name}.`); fire(); } catch (e) { toast(e.message, "err"); }
      }));
      root.querySelectorAll("[data-req-no]").forEach((b) => b.addEventListener("click", async () => {
        const r = db.schoolRequests().find((x) => x.id === b.dataset.reqNo);
        const f = await modal({ title: `Decline "${r.name}"?`, fields: [{ name: "reason", label: "Reason (sent to the teacher)", type: "textarea", required: true, value: "This school isn't part of the Schools District of Aliaga." }], confirm: "Decline", danger: true });
        if (!f) return;
        try { db.declineSchoolRequest(user, r.id, f.reason); toast("Request declined."); fire(); } catch (e) { toast(e.message, "err"); }
      }));
      root.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", async () => {
        const s = db.school(b.dataset.edit);
        const r = await modal({ title: `Edit ${s.name}`, confirm: "Save", fields: [
          { name: "name", label: "School name", required: true, value: s.name }, { name: "code", label: "School ID", value: s.code },
          { name: "type", label: "Classification", type: "select", value: s.type, options: [{ value: "Elementary", label: "Elementary" }, { value: "Secondary", label: "Secondary" }, { value: "Integrated", label: "Integrated" }] },
          { name: "location", label: "Location", value: s.location }] });
        if (!r) return;
        try { db.updateSchool(user, s.id, r); toast("School updated."); fire(); } catch (err) { toast(err.message, "err"); }
      }));
      root.querySelector("[data-add]").addEventListener("submit", (e) => {
        e.preventDefault();
        try { db.addSchool(user, Object.fromEntries(new FormData(e.target))); toast("School added."); fire(); } catch (err) { toast(err.message, "err"); }
      });
      root.querySelectorAll("[data-toggle]").forEach((b) => b.addEventListener("click", async () => {
        const s = db.school(b.dataset.toggle);
        if (!(await modal({ title: `${s.active ? "Deactivate" : "Activate"} ${s.name}?`, body: s.active ? "The school will no longer be selectable for new submissions. Existing records are kept." : "The school will be selectable again.", confirm: s.active ? "Deactivate" : "Activate", danger: s.active }))) return;
        db.toggleSchool(user, s.id); toast("School updated."); fire();
      }));
    },
  };
}

/* ======================= users ======================= */
export function usersPage(user, q) {
  const role = q.get("role") || "";
  const all = db.users();
  const rows = all.filter((u) => role === "pending" ? u.status === "pending" : role === "changes" ? !!u.pending_change : role === "returned" ? u.status === "rejected" : !role || u.role === role);
  const superA = user.role === "superadmin";
  const pending = all.filter((u) => u.status === "pending").length;
  const changes = all.filter((u) => u.pending_change).length;
  const returned = all.filter((u) => u.status === "rejected").length;
  const statusBadge2 = (s) => s === "active" ? `<span class="badge s-done">Active</span>` : s === "pending" ? `<span class="badge s-review">Awaiting approval</span>` : s === "rejected" ? `<span class="badge s-returned">Returned for changes</span>` : `<span class="badge s-stop">Suspended</span>`;
  const label = { name: "Name", position: "Position", school_id: "School", photo: "Photo" };
  const shown = (k, v) => k === "school_id" ? esc(db.school(v)?.name || "District Office") : k === "photo" ? (v ? `<img src="${esc(v)}" alt="New photo" style="width:44px;height:44px;border-radius:50%;object-fit:cover;vertical-align:middle">` : "Remove photo") : esc(v);
  const current = (u, k) => k === "photo" ? (u.photo ? `<img src="${esc(u.photo)}" alt="Current photo" style="width:44px;height:44px;border-radius:50%;object-fit:cover;vertical-align:middle">` : "No photo") : shown(k, u[k]);
  const roleOptions = Object.entries(ROLES).filter(([k]) => (superA || ["teacher", "evaluator"].includes(k)) && !(db.cloudMode && k === "superadmin"));
  return {
    title: "User and Role Management",
    desc: "Approve registrations, create staff accounts, change roles and reset passwords.",
    action: `<button class="btn btn-ink btn-sm" data-create>${icon("plus")}${db.cloudMode ? "Invite someone" : "Create account"}</button>`,
    html: `${db.cloudMode && db.invitations().length ? `<section class="card stack"><div class="card-head" style="margin:0"><h2>Invited, not yet registered</h2><span class="sub">They get their role automatically when they register with this email</span></div>
      ${db.invitations().map((i) => `<div class="sess-row"><span class="sess-ic">${icon("mail")}</span><span class="grow"><b>${esc(i.name || i.email)}</b><small>${esc(i.email)} · ${esc(ROLES[i.role])}${i.school_id ? ` · ${esc(db.school(i.school_id)?.name || "")}` : ""}</small></span><button class="btn btn-ghost btn-sm" data-uninvite="${esc(i.email)}">Cancel</button></div>`).join("")}</section>` : ""}<section class="card stack"><div class="row between"><div class="seg">${[["", "All"], ["pending", `New accounts (${pending})`], ["changes", `Profile changes (${changes})`], ...(returned ? [["returned", `Returned (${returned})`]] : []), ...Object.entries(ROLES)].map(([k, l]) => `<a href="#/a/users${k ? "?role=" + k : ""}" class="${role === k ? "on" : ""}">${esc(l)}</a>`).join("")}</div>
      <span class="small muted">${superA ? "You can change roles as Super Administrator." : "Only a Super Administrator can change roles or create administrator accounts."}</span></div>
      ${role === "changes" ? (rows.length ? `<div class="table-wrap"><table><thead><tr><th>Person</th><th>Change requested</th><th>Current</th><th>Requested</th><th>Actions</th></tr></thead><tbody>
        ${rows.map((u) => Object.keys(u.pending_change.fields).map((k, i, ks) => `<tr>${i === 0 ? `<td rowspan="${ks.length}"><b>${esc(u.name)}</b><div class="small muted">${esc(ROLES[u.role])} · ${esc(u.email || "")}</div><div class="small muted">Sent ${relTime(u.pending_change.at)}</div></td>` : ""}
          <td>${label[k]}</td><td class="small">${current(u, k)}</td><td class="small"><b>${shown(k, u.pending_change.fields[k])}</b></td>
          ${i === 0 ? `<td rowspan="${ks.length}"><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn btn-green btn-sm" data-okchange="${u.id}">Approve</button><button class="btn btn-ghost btn-sm" data-nochange="${u.id}">Decline</button></div></td>` : ""}</tr>`).join("")).join("")}
        </tbody></table></div>` : `<div class="empty"><div class="ic">${icon("check")}</div><h3>No profile changes waiting</h3><p>When teachers or evaluators edit their name, position, school or photo, the change waits here for approval.</p></div>`)
      : rows.length ? `${role === "pending" ? `<div class="bulk-bar"><label class="row small" style="gap:8px"><input type="checkbox" data-bulkall>Select all</label><span class="small" data-bulkn>0 selected</span><button class="btn btn-gold btn-sm" data-bulkgo disabled>${icon("check")}Approve selected</button><span class="small" style="opacity:.75">Accounts without a school are skipped; approve those one by one.</span></div>` : ""}<div class="table-wrap"><table><thead><tr><th>Name and sign-in</th><th>School</th><th>Role</th><th>Status</th><th>Projects</th><th>Actions</th></tr></thead><tbody>
      ${rows.map((u) => `<tr><td>${role === "pending" && u.status === "pending" ? `<input type="checkbox" data-bulk="${u.id}" aria-label="Select ${esc(u.name)}" style="margin-right:8px;vertical-align:middle">` : ""}<b>${esc(u.name)}</b><div class="small muted">${esc(u.position || "")}</div><div class="small">${esc(u.email || "")}${u.username ? `${u.email ? " · " : ""}@${esc(u.username)}` : ""}</div></td>
        <td class="small">${esc(db.school(u.school_id)?.name || (u.requested_school ? `Requested: ${u.requested_school}` : "District Office"))}</td>
        <td>${superA && u.id !== user.id ? `<select data-role="${u.id}" aria-label="Role for ${esc(u.name)}" style="min-width:170px;border-radius:999px">${Object.entries(ROLES).map(([k, l]) => `<option value="${k}" ${k === u.role ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>` : `<span class="tag">${esc(ROLES[u.role])}</span>`}</td>
        <td>${statusBadge2(u.status)}${u.status === "pending" ? `<div style="margin-top:4px">${waitBadge(u.resubmitted_at || u.created_at)}</div>` : ""}${u.pending_change ? `<div style="margin-top:4px">${waitBadge(u.pending_change.at)}</div>` : ""}${u.must_change ? `<div class="small muted">Temporary password</div>` : ""}</td>
        <td>${db.projects().filter((p) => p.owner_id === u.id && p.status !== "Draft").length}</td>
        <td>${u.id === user.id ? `<span class="small muted">You</span>` : `<div class="row" style="gap:6px;flex-wrap:nowrap">
          ${u.status === "pending" ? `<button class="btn btn-green btn-sm" data-approve="${u.id}">Approve</button><button class="btn btn-ghost btn-sm" data-reject="${u.id}">Return</button>` : ""}
          ${u.pending_change ? `<a class="btn btn-ghost btn-sm" href="#/a/users?role=changes">Review change</a>` : ""}
          ${!["pending", "rejected"].includes(u.status) ? `<button class="btn btn-ghost btn-sm" data-status="${u.id}">${u.status === "active" ? "Suspend" : "Reactivate"}</button>` : ""}
          ${u.role !== "superadmin" || superA ? `<button class="icon-btn" data-reset="${u.id}" title="Reset password" aria-label="Reset password for ${esc(u.name)}">${icon("key")}</button>` : ""}</div>`}</td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty"><div class="ic">${icon("users")}</div><h3>${role === "pending" ? "No new accounts waiting" : role === "returned" ? "No returned registrations" : "No accounts in this group"}</h3><p>Create staff accounts with the button above. Teachers register from the public home page.</p></div>`}</section>`,
    bind(root) {
      root.querySelector("[data-create]").addEventListener("click", async () => {
        const r = await modal({ title: db.cloudMode ? "Invite someone" : "Create an account", wide: true, confirm: db.cloudMode ? "Send invitation" : "Create account", body: db.cloudMode ? "Enter their email and role. They then register on this website with that same email and choose their own password. Their role is applied automatically, with no approval step." : "The person signs in with the email or username and this temporary password, then must choose their own password.", fields: [
          { name: "name", label: "Full name", required: true, span: true },
          { name: "email", label: "Email", type: "email", required: db.cloudMode }, ...(db.cloudMode ? [] : [{ name: "username", label: "Username (optional)" }]),
          { name: "role", label: "Role", type: "select", value: "evaluator", options: roleOptions.map(([v, l]) => ({ value: v, label: l })) },
          { name: "school_id", label: "School", type: "select", value: "", options: [{ value: "", label: "District Office" }, ...db.schools().filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }))] },
          { name: "position", label: "Position / designation" },
          ...(db.cloudMode ? [] : [{ name: "password", label: "Temporary password", required: true, hint: "At least 8 characters with letters and numbers. Share it privately." }])] });
        if (!r) return;
        try {
          const u = await db.createAccount(user, r);
          if (u.invited) await modal({ title: "Invitation saved", body: `Ask <b>${esc(u.name)}</b> to register on this website with <b>${esc(u.email)}</b>. Their account will be ready right away with the role you chose, with no approval step.`, confirm: "OK", cancel: "Close" });
          else toast(`Account created for ${u.name}.`);
          fire();
        } catch (e) { toast(e.message, "err"); }
      });
      root.querySelectorAll("[data-uninvite]").forEach((b) => b.addEventListener("click", () => { db.cancelInvitation(user, b.dataset.uninvite); toast("Invitation cancelled."); fire(); }));
      root.querySelectorAll("[data-approve]").forEach((b) => b.addEventListener("click", async () => {
        const u = db.user(b.dataset.approve);
        const schools = db.schools().filter((s) => s.active);
        const r = await modal({ title: `Approve ${u.name}?`, body: `${esc(u.email)} · ${esc(u.position)}${u.requested_school ? `<br>Requested school: <b>${esc(u.requested_school)}</b>. Add it in School Management first if it's missing.` : ""}`, confirm: "Approve account",
          fields: u.school_id ? [] : [{ name: "school_id", label: "Assign school", type: "select", required: true, value: "", options: [{ value: "", label: "Choose the school…" }, ...schools.map((s) => ({ value: s.id, label: s.name }))] }] });
        if (!r) return;
        try { if (r.school_id) db.updateUser(user, u.id, { school_id: r.school_id }); db.approveUser(user, u.id); toast("Account approved."); fire(); } catch (e) { toast(e.message, "err"); }
      }));
      const boxes = [...root.querySelectorAll("[data-bulk]")], go = root.querySelector("[data-bulkgo]"), cnt = root.querySelector("[data-bulkn]");
      const sync = () => { const n = boxes.filter((x) => x.checked).length; if (cnt) cnt.textContent = `${n} selected`; if (go) go.disabled = !n; };
      boxes.forEach((x) => x.addEventListener("change", sync));
      root.querySelector("[data-bulkall]")?.addEventListener("change", (e) => { boxes.forEach((x) => { x.checked = e.target.checked; }); sync(); });
      go?.addEventListener("click", async () => {
        const ids = boxes.filter((x) => x.checked).map((x) => x.dataset.bulk);
        if (!(await modal({ title: `Approve ${ids.length} account${ids.length === 1 ? "" : "s"}?`, body: "Each person gets full access and a notification.", confirm: "Approve all" }))) return;
        const r = db.approveUsers(user, ids);
        if (r.skipped.length) await modal({ title: `${r.ok.length} approved, ${r.skipped.length} skipped`, body: `<ul style="padding-left:18px;margin:0">${r.skipped.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`, confirm: "OK", cancel: "Close" });
        else toast(`${r.ok.length} account${r.ok.length === 1 ? "" : "s"} approved.`);
        fire();
      });
      root.querySelectorAll("[data-reject]").forEach((b) => b.addEventListener("click", async () => {
        const u = db.user(b.dataset.reject);
        const r = await modal({ title: `Return ${u.name}'s registration?`, body: "They'll see your reason, can fix their details and resubmit. The account can't use the system until approved.", fields: [{ name: "reason", label: "What needs to change", type: "textarea", required: true, value: "" }], confirm: "Return for changes" });
        if (!r) return;
        try { db.rejectUser(user, u.id, r.reason); toast("Registration returned for changes."); fire(); } catch (e) { toast(e.message, "err"); }
      }));
      root.querySelectorAll("[data-okchange]").forEach((b) => b.addEventListener("click", async () => {
        const u = db.user(b.dataset.okchange);
        if (!(await modal({ title: `Approve ${u.name}'s profile change?`, body: "The new details replace the current ones right away.", confirm: "Approve change" }))) return;
        try { db.approveProfileChange(user, u.id); toast("Profile change approved."); fire(); } catch (e) { toast(e.message, "err"); }
      }));
      root.querySelectorAll("[data-nochange]").forEach((b) => b.addEventListener("click", async () => {
        const u = db.user(b.dataset.nochange);
        const r = await modal({ title: `Decline ${u.name}'s profile change?`, fields: [{ name: "reason", label: "Reason (shown to them)", type: "textarea", required: true }], confirm: "Decline", danger: true });
        if (!r) return;
        try { db.rejectProfileChange(user, u.id, r.reason); toast("Profile change declined."); fire(); } catch (e) { toast(e.message, "err"); }
      }));
      root.querySelectorAll("[data-reset]").forEach((b) => b.addEventListener("click", async () => {
        const u = db.user(b.dataset.reset);
        if (db.cloudMode) {
          if (!(await modal({ title: `Send ${u.name} a password reset link?`, body: `A link to set a new password goes to <b>${esc(u.email)}</b>.`, confirm: "Send link" }))) return;
          try { await db.resetPassword(user, u.id); toast("Reset link sent."); } catch (e) { toast(e.message, "err"); }
          return;
        }
        const r = await modal({ title: `Reset password for ${u.name}?`, body: "They'll sign in with this temporary password and must change it right away.", fields: [{ name: "password", label: "Temporary password", required: true }], confirm: "Reset password" });
        if (!r) return;
        try { await db.resetPassword(user, u.id, r.password); toast("Temporary password set."); fire(); } catch (e) { toast(e.message, "err"); }
      }));
      root.querySelectorAll("[data-role]").forEach((s) => s.addEventListener("change", async () => {
        const u = db.user(s.dataset.role);
        const r = await modal({ title: `Change role for ${u.name}?`, body: `${esc(ROLES[u.role])} → <b>${esc(ROLES[s.value])}</b>`, fields: [{ name: "reason", label: "Reason", type: "textarea", required: true }], confirm: "Change role" });
        if (!r) { s.value = u.role; return; }
        try { db.updateUser(user, u.id, { role: s.value }); db.log(user.id, `Role changed to ${s.value}`, "user", u.id, r.reason); toast("Role updated."); fire(); } catch (e) { s.value = u.role; toast(e.message, "err"); }
      }));
      root.querySelectorAll("[data-status]").forEach((b) => b.addEventListener("click", async () => {
        const u = db.user(b.dataset.status); const to = u.status === "active" ? "suspended" : "active";
        if (!(await modal({ title: `${to === "active" ? "Reactivate" : "Suspend"} ${u.name}?`, body: to === "suspended" ? "The user will not be able to sign in. Their records are kept." : "The user will be able to sign in again.", confirm: to === "active" ? "Reactivate" : "Suspend", danger: to === "suspended" }))) return;
        try { db.setUserStatus(user, u.id, to); toast("Account updated."); fire(); } catch (e) { toast(e.message, "err"); }
      }));
    },
  };
}

/* ======================= reports ======================= */
const REPORTS = {
  register: { name: "Submission register", cols: ["Research ID", "Title", "Category", "Researcher", "School", "Status", "Submitted", "Deadline"],
    row: (p) => [p.research_id, p.title, catById(p.category).name, db.user(p.owner_id)?.name, db.school(p.school_id)?.name, p.status, fmtDate(p.submitted_at), fmtDate(p.deadline)] },
  overdue: { name: "Overdue report", filter: isOverdue, cols: ["Research ID", "Title", "School", "Status", "Deadline", "Next action"],
    row: (p) => [p.research_id, p.title, db.school(p.school_id)?.name, p.status, fmtDate(p.deadline), nextAction(p, "admin")] },
  implementation: { name: "Implementation report", filter: (p) => ["Approved", "Ongoing Implementation", "For Final Evaluation", "For Dissemination"].includes(p.status), cols: ["Research ID", "Title", "School", "Status", "Deadline"],
    row: (p) => [p.research_id, p.title, db.school(p.school_id)?.name, p.status, fmtDate(p.deadline)] },
  repository: { name: "Repository inventory", filter: (p) => ["Completed", "Published", "Archived"].includes(p.status), cols: ["Research ID", "Title", "Author", "School", "Theme", "Year", "Status"],
    row: (p) => [p.research_id, p.title, db.user(p.owner_id)?.name, db.school(p.school_id)?.name, p.agenda, new Date(p.submitted_at).getFullYear(), p.status] },
  schools: { name: "School research profiles", school: true, cols: ["School", "Type", "Total", "Action Research", "IGP", "Innovation", "Completed", "Active"] },
};
export function reportsPage(user, q) {
  const type = q.get("r") || "register", cat = q.get("cat") || "";
  const R = REPORTS[type];
  const base = db.visibleProjects(user).filter((p) => !cat || p.category === cat);
  let cols = R.cols, data;
  if (R.school) {
    data = db.schools().map((s) => { const ps = base.filter((p) => p.school_id === s.id); return [s.name, s.type, ps.length, ps.filter((p) => p.category === "AR").length, ps.filter((p) => p.category === "IGP").length, ps.filter((p) => p.category === "INN").length, ps.filter((p) => matchStatus(p, "completed")).length, ps.filter((p) => matchStatus(p, "active")).length]; });
  } else data = base.filter(R.filter || (() => true)).map(R.row);
  const stamp = new Date();
  return {
    title: "Reports and Exports",
    html: `<section class="card stack"><form class="toolbar" data-rf>
      <select name="r" aria-label="Report">${Object.entries(REPORTS).map(([k, v]) => `<option value="${k}" ${k === type ? "selected" : ""}>${esc(v.name)}</option>`).join("")}</select>
      <select name="cat" aria-label="Category"><option value="">All categories</option>${CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === cat ? "selected" : ""}>${c.name}</option>`).join("")}</select>
      <div class="row" style="margin-left:auto"><button type="button" class="btn btn-ghost btn-sm" data-print>${icon("file")}Print / PDF</button><button type="button" class="btn btn-primary btn-sm" data-csv>${icon("download")}Download CSV (Excel)</button></div></form>
      <div><h2 style="font-size:18px">${esc(R.name)}</h2><p class="small muted">Scope: Schools District of Aliaga · Category: ${esc(cat ? catById(cat).name : "All")} · Generated ${fmtDateTime(stamp)} by ${esc(user.name)} · For official use only</p></div>
      ${data.length ? `<div class="table-wrap"><table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${data.map((r) => `<tr>${r.map((v) => `<td class="small">${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : emptyState("No records for this report", "Change the report type or category.")}</section>`,
    bind(root) {
      const f = root.querySelector("[data-rf]");
      f.addEventListener("change", () => { const p = new URLSearchParams([...new FormData(f).entries()].filter(([, v]) => v)); location.hash = `#/a/reports?${p}`; });
      root.querySelector("[data-csv]").addEventListener("click", () => {
        downloadCSV(`RD360_${type}_${stamp.toISOString().slice(0, 10)}.csv`, [[`${R.name} — Schools District of Aliaga — generated ${fmtDateTime(stamp)} — For official use only`], cols, ...data]);
        db.log(user.id, `Exported ${R.name}`, "report", type, cat ? `Category ${cat}` : "All categories");
        toast("Report downloaded.");
      });
      root.querySelector("[data-print]").addEventListener("click", () => { db.log(user.id, `Printed ${R.name}`, "report", type); window.print(); });
    },
  };
}

/* ======================= audit ======================= */
export function auditPage(user, q) {
  const text = (q.get("q") || "").toLowerCase();
  const rows = db.audit().filter((a) => !text || [a.action, db.user(a.actor)?.name, a.reason, a.target_type].join(" ").toLowerCase().includes(text)).slice(0, 200);
  return {
    title: "Audit Logs",
    html: `<section class="card stack"><form class="toolbar" data-q><input type="search" name="q" value="${esc(q.get("q") || "")}" placeholder="Filter by action, user or reason…"><button class="btn btn-primary btn-sm">Filter</button><span class="small muted">Most recent 200 events. Passwords and tokens are never logged.</span></form>
      <div class="table-wrap"><table><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Reason</th></tr></thead><tbody>
      ${rows.map((a) => { const p = a.target_type === "project" ? db.project(a.target_id) : null; return `<tr><td class="small" style="white-space:nowrap">${fmtDateTime(a.at)}</td><td class="small">${esc(db.user(a.actor)?.name || "System")}</td><td>${esc(a.action)}</td>
        <td class="small">${p ? `<a href="#/a/project/${p.id}">${esc(p.research_id || "Draft")}</a>` : esc(a.target_type)}</td><td class="small">${esc(a.reason)}</td></tr>`; }).join("") || `<tr><td colspan="5" class="muted">No events.</td></tr>`}
      </tbody></table></div></section>`,
    bind(root) { root.querySelector("[data-q]").addEventListener("submit", (e) => { e.preventDefault(); location.hash = `#/a/audit?q=${encodeURIComponent(new FormData(e.target).get("q"))}`; }); },
  };
}

export { projectsPage };
