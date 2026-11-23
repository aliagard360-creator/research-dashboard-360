// Teacher / Researcher portal: dashboard and the six-step submission wizard.
import { icon } from "./icons.js?v=202611231438";
import { db, CATEGORIES, catById, RESEARCH_TYPES, AGENDA, FUNDING, isOverdue, nextAction, TERMINAL } from "./store.js?v=202611231438";
import { PREVIEW_MODE } from "./config.js?v=202611231438";
import { esc, fmtDate, fmtDateTime, relTime, toast, modal, emptyState, debounce, daysLeft, statusBadge } from "./ui.js?v=202611231438";
import { FILTERS, matchStatus, projectCard } from "./pages.js?v=202611231438";

/* ======================= dashboard ======================= */
export function teacherDashboard(user) {
  const mine = db.visibleProjects(user);
  const school = db.school(user.school_id);
  const kpis = [
    ["", "Total projects", "folder", "k-ink"],
    ["draft", "Drafts", "file", "k-white"],
    ["submitted", "Submitted", "send", "k-sky"],
    ["pending", "Pending review", "clock", "k-cream"],
    ["returned", "Returned for revision", "left", "k-peach"],
    ["approved", "Approved", "check", "k-lav"],
    ["ongoing", "Ongoing implementation", "activity", "k-mint"],
    ["completed", "Completed / archived", "library", "k-mint"],
  ];
  const priority = mine.filter((p) => ["Draft", "Returned for Revision", "Ongoing Implementation", "For Final Evaluation", "Approved"].includes(p.status) || isOverdue(p))
    .sort((a, b) => (a.status === "Returned for Revision" ? -1 : 0) - (b.status === "Returned for Revision" ? -1 : 0) || new Date(a.deadline || "2999") - new Date(b.deadline || "2999")).slice(0, 5);
  const notes = db.notificationsFor(user.id).slice(0, 5);
  const hr = new Date().getHours();
  const greet = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
  const first = user.name.split(" ")[0];

  return {
    title: "Dashboard",
    html: `<section class="welcome"><div><h2>${greet}, ${esc(first)}.</h2><p>${esc(school?.name || "")} · ${esc(user.position || "")}${priority.length ? ` · ${priority.length} item${priority.length === 1 ? "" : "s"} need your attention` : " · You're all caught up"}</p></div>
      <div class="row"><a class="btn btn-ghost" href="#/t/projects">${icon("folder")}My projects</a><a class="btn btn-gold" href="#/t/submit">${icon("plus")}Submit new research</a></div></section>
    <section class="kpi-grid" aria-label="Project counts">${kpis.map(([k, label, ic, color]) => {
      const n = mine.filter((p) => matchStatus(p, k)).length;
      return `<a class="kpi ${color}" href="#/t/projects${k ? "?status=" + k : ""}"><div class="top"><span class="lbl">${esc(label)}</span><span class="ic">${icon(ic)}</span></div><span class="val">${n}</span><span class="foot">View list ${icon("chevron")}</span></a>`;
    }).join("")}</section>
    <section><div class="card-head"><h2 style="font-size:17px">Research categories</h2><span class="sub">Live counts of your projects</span></div>
      <div class="cat-cards">${CATEGORIES.map((c) => `<article class="cat-card" style="--c:${c.color}"><div class="top"><span class="ic">${icon(c.icon)}</span><h3><a href="#/t/category/${c.id}" style="color:inherit">${esc(c.name)}</a></h3><span class="count">${mine.filter((p) => p.category === c.id).length}</span></div>
        <p>${esc(c.desc)}</p><div class="row"><a class="btn btn-ghost btn-sm" href="#/t/category/${c.id}">Explore</a><a class="btn btn-sm" style="background:${c.color};color:#fff" href="#/t/submit?cat=${c.id}">${icon("plus")}Start</a></div></article>`).join("")}</div></section>
    <div class="charts">
      <section class="card"><div class="card-head"><h2>Priority actions</h2><span class="sub">Tasks that need you</span></div>
        ${priority.length ? `<div class="stack" style="gap:10px">${priority.map((p) => `<a class="notif" style="color:var(--text);text-decoration:none;border-left:4px solid ${catById(p.category).color}" href="${["Draft", "Returned for Revision"].includes(p.status) ? `#/t/submit?id=${p.id}${p.status === "Returned for Revision" ? "&step=6" : ""}` : `#/t/project/${p.id}`}">
          <div class="grow"><b class="small">${esc(nextAction(p, "teacher"))}</b><div class="small muted">${esc(p.title || "Untitled draft")}</div></div>
          <div style="text-align:right">${statusBadge(p.status)}${p.deadline ? `<div class="small ${isOverdue(p) ? "overdue" : "muted"}" style="margin-top:4px">${daysLeft(p.deadline)}</div>` : ""}</div></a>`).join("")}</div>`
        : emptyState("Nothing urgent", "New tasks appear here when a deadline approaches or feedback arrives.")}</section>
      <section class="card"><div class="card-head"><h2>Recent updates</h2><a class="small" href="#/t/notifications">All notifications</a></div>
        ${notes.length ? `<div class="activity">${notes.map((n) => `<div class="act"><span class="ic">${icon("bell")}</span><div><div class="small">${esc(n.message)}</div><time>${relTime(n.at)}</time></div></div>`).join("")}</div>` : `<p class="muted small">No updates yet.</p>`}</section>
    </div>
    ${mine.length ? `<section><div class="card-head"><h2 style="font-size:17px">Latest projects</h2><a class="small" href="#/t/projects">See all</a></div><div class="proj-grid">${[...mine].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 3).map((p) => projectCard(p, "t")).join("")}</div></section>` : ""}`,
  };
}

/* ======================= submission wizard ======================= */
const STEPS = [
  { title: "Project identity", why: "Identify the study and who is responsible for it, so reviewers and the district can track it.", fields: [
    { k: "title", label: "Research title", req: true, span: 2 },
    { k: "category", label: "Research category", type: "select", req: true, options: CATEGORIES.map((c) => [c.id, c.name]) },
    { k: "research_type", label: "Research type", type: "select", req: true, options: RESEARCH_TYPES.map((t) => [t, t]) },
    { k: "school_id", label: "School", type: "school", req: true },
    { k: "school_year", label: "School year", req: true, placeholder: "2026-2027" },
    { k: "team", label: "Research team / proponents", type: "textarea", hint: "One name per line, with position." },
    { k: "contact", label: "Designated contact (name and mobile)" },
  ] },
  { title: "Research details", why: "Explain what the study is about and why it matters. Reviewers use this to judge relevance.", fields: [
    { k: "abstract", label: "Abstract", type: "textarea", req: true, span: 2, hint: "150–300 words summarizing purpose, method and expected results." },
    { k: "background", label: "Background / rationale", type: "textarea", span: 2 },
    { k: "problem", label: "Statement of the problem", type: "textarea", reqFor: ["AR"] },
    { k: "objectives", label: "Objectives", type: "textarea", req: true },
    { k: "questions", label: "Research questions", type: "textarea", reqFor: ["AR"] },
    { k: "significance", label: "Significance of the study", type: "textarea" },
    { k: "beneficiaries", label: "Target beneficiaries", type: "textarea", reqFor: ["INN", "IGP"], span: 2 },
  ] },
  { title: "Methodology", why: "Describe how you will carry out the study, including how participants are protected.", fields: [
    { k: "design", label: "Research design", type: "textarea", req: true },
    { k: "participants", label: "Participants / respondents", type: "textarea", req: true },
    { k: "instruments", label: "Research instruments", type: "textarea" },
    { k: "data_collection", label: "Data collection procedure", type: "textarea" },
    { k: "analysis", label: "Data analysis plan", type: "textarea" },
    { k: "ethics", label: "Ethical considerations", type: "textarea", hint: "Consent/assent, privacy, and data protection measures." },
    { k: "timeline", label: "Implementation timeline", type: "textarea" },
    { k: "milestones", label: "Milestones", type: "textarea", hint: "One per line, with target date." },
  ] },
  { title: "Classification", why: "Link the study to the research agenda and funding, so the district can report and plan.", fields: [
    { k: "agenda", label: "Research agenda theme", type: "select", req: true, options: AGENDA.map((a) => [a, a]) },
    { k: "funding", label: "Funding source", type: "select", options: FUNDING.map((f) => [f, f]), reqFor: ["IGP"] },
    { k: "budget", label: "Budget (PHP)", inputType: "number", reqFor: ["IGP"], hint: "Required for Income Generating Projects." },
    { k: "tags", label: "Keywords / tags", hint: "Separate with commas." },
  ] },
  { title: "Attachments", why: "Upload the proposal manuscript and required forms. Each new file keeps a version number.", fields: [] },
  { title: "Review and submit", why: "Check everything once more. The readiness checklist shows anything still missing.", fields: [] },
];
const ALLOWED = [".pdf", ".doc", ".docx"];
const MAX_MB = 10;
let wiz = null; // the draft being edited
let saveTimer = null;

function blank(user, cat) {
  let st = null;
  try { st = JSON.parse(sessionStorage.getItem("rd360.starter") || "null"); sessionStorage.removeItem("rd360.starter"); } catch { /* ignore */ }
  if (st && st.category === cat) return { category: cat, research_type: "", title: st.title || "", abstract: st.idea || "", school_id: user.school_id || "", school_year: "2026-2027", files: [] };
  return { category: cat && CATEGORIES.some((c) => c.id === cat) ? cat : "", research_type: "", title: "", school_id: user.school_id || "", school_year: "2026-2027", files: [] };
}
function isReq(f, d) { return f.req || (f.reqFor || []).includes(d.category); }
export function missingFields(d) {
  const miss = [];
  STEPS.forEach((s, i) => s.fields.forEach((f) => { if (isReq(f, d) && !String(d[f.k] || "").trim()) miss.push({ step: i + 1, label: f.label }); }));
  if (!(d.files || []).length) miss.push({ step: 5, label: "Proposal manuscript (at least one attachment)" });
  return miss;
}

export function wizardPage(user, q) {
  const id = q.get("id");
  if (!wiz || (id && wiz.id !== id) || (!id && wiz.id)) {
    const existing = id ? db.project(id) : null;
    if (id && (!existing || existing.owner_id !== user.id)) return { title: "Submit New Research", html: `<div class="card">${emptyState("Draft not found", "This draft may have been deleted or belongs to another account.", `<a class="btn btn-primary" href="#/t/submit">Start a new submission</a>`)}</div>` };
    if (existing && !["Draft", "Returned for Revision"].includes(existing.status)) return { title: "Submit New Research", html: `<div class="card">${emptyState("This project is locked", "Submitted projects can only be edited when they are returned for revision.", `<a class="btn btn-ghost" href="#/t/project/${existing.id}">Open project</a>`)}</div>` };
    wiz = existing ? JSON.parse(JSON.stringify(existing)) : blank(user, q.get("cat"));
  }
  const step = Math.min(6, Math.max(1, Number(q.get("step")) || 1));
  const d = wiz;
  const revising = d.status === "Returned for Revision";
  const schools = db.schools().filter((s) => s.active || s.id === d.school_id);

  const stepBar = `<nav class="wizard-steps" aria-label="Submission steps">${STEPS.map((s, i) => `<button type="button" class="wstep ${i + 1 === step ? "on" : i + 1 < step ? "done" : ""}" data-step="${i + 1}" ${i + 1 === step ? 'aria-current="step"' : ""}><span class="bar"></span><b>Step ${i + 1}</b><span>${esc(s.title)}</span></button>`).join("")}</nav>`;
  const input = (f) => {
    const v = d[f.k] ?? "";
    const req = isReq(f, d);
    let el;
    if (f.type === "textarea") el = `<textarea name="${f.k}" ${req ? "required" : ""}>${esc(v)}</textarea>`;
    else if (f.type === "select") el = `<select name="${f.k}" ${req ? "required" : ""}><option value="">Select…</option>${f.options.map(([val, l]) => `<option value="${esc(val)}" ${val === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
    else if (f.type === "school") el = `<select name="${f.k}" required><option value="">Select your school…</option>${["Elementary", "Secondary", "Integrated"].filter((t) => schools.some((s) => s.type === t)).map((t) => `<optgroup label="${t}">${schools.filter((s) => s.type === t).map((s) => `<option value="${s.id}" ${s.id === v ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</optgroup>`).join("")}</select>`;
    else el = `<input name="${f.k}" type="${f.inputType || "text"}" value="${esc(v)}" placeholder="${esc(f.placeholder || "")}" ${req ? "required" : ""}>`;
    return `<label class="field ${f.span === 2 ? "span-2" : ""}"><span class="${req ? "req" : ""}">${esc(f.label)}</span>${el}${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ""}</label>`;
  };

  let body = "";
  if (step <= 4) {
    body = `<div class="grid-2">${STEPS[step - 1].fields.map(input).join("")}</div>`;
    if (step === 1 && d.category) { const c = catById(d.category); body = `<div class="notice" style="border-left:4px solid ${c.color}">${icon(c.icon)}<span><b>${esc(c.name)}:</b> ${esc(c.desc)}</span></div>` + body; }
  } else if (step === 5) {
    body = `<div class="stack"><label class="dropzone" data-drop>${icon("upload")}<b>Drop files here or click to choose</b><span class="small">Proposal manuscript, required forms and supporting documents. PDF, DOC or DOCX, up to ${MAX_MB} MB each.</span><input type="file" multiple accept="${ALLOWED.join(",")}" hidden data-files></label>
      <div class="file-list">${(d.files || []).map((f, i) => `<div class="file-item">${icon("file")}<span class="grow">${esc(f.name)}</span><span class="small muted">v${f.version || 1} · ${(f.size / 1024 / 1024).toFixed(2)} MB</span><button type="button" class="icon-btn" data-rmfile="${i}" aria-label="Remove ${esc(f.name)}">${icon("x")}</button></div>`).join("") || `<p class="small muted">No files attached yet.</p>`}</div>
      ${PREVIEW_MODE ? `<div class="notice">${icon("info")}<span>Preview mode records file names and sizes only. Real uploads go to secure storage once the database is connected.</span></div>` : ""}</div>`;
  } else {
    const miss = missingFields(d);
    const c = d.category ? catById(d.category) : null;
    const dl = (pairs) => `<dl>${pairs.filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("") || "<dd class='muted'>Nothing entered yet.</dd>"}</dl>`;
    body = `<div class="stack">
      <div class="review-block" style="border-color:${miss.length ? "#f3c1b5" : "#b7e4c7"}"><h4 style="color:${miss.length ? "var(--ar)" : "var(--ok)"}">Readiness checklist</h4>
        <div class="checklist">${miss.length ? miss.map((m) => `<div class="no">${icon("x")}<span>${esc(m.label)} <a href="#" data-step="${m.step}">(step ${m.step})</a></span></div>`).join("") : `<div class="yes">${icon("check")}<span>All required information and attachments are complete.</span></div>`}</div></div>
      ${revising && d.feedback?.length ? `<div class="review-block"><h4>Revision items from reviewers</h4>${d.feedback.map((f) => `<p class="small" style="margin-bottom:6px">• ${esc(f.text)} <span class="muted">(${fmtDate(f.at)})</span></p>`).join("")}</div>` : ""}
      <div class="review-block"><h4>Project identity</h4>${dl([["Title", d.title], ["Category", c?.name], ["Research type", d.research_type], ["School", db.school(d.school_id)?.name], ["School year", d.school_year], ["Team", d.team], ["Contact", d.contact]])}</div>
      <div class="review-block"><h4>Research details</h4>${dl([["Abstract", d.abstract], ["Problem", d.problem], ["Objectives", d.objectives], ["Questions", d.questions], ["Beneficiaries", d.beneficiaries]])}</div>
      <div class="review-block"><h4>Methodology</h4>${dl([["Design", d.design], ["Participants", d.participants], ["Instruments", d.instruments], ["Ethics", d.ethics], ["Milestones", d.milestones]])}</div>
      <div class="review-block"><h4>Classification and attachments</h4>${dl([["Agenda theme", d.agenda], ["Funding", d.funding], ["Budget (PHP)", d.budget], ["Tags", d.tags], ["Attachments", (d.files || []).map((f) => f.name).join("\n")]])}</div>
      <label class="row" style="font-size:14px;align-items:flex-start"><input type="checkbox" data-declare style="width:auto;margin-top:3px"><span>I declare that this proposal is original, the information is true and correct, and I have the consent needed to collect data from participants in line with the Data Privacy Act of 2012.</span></label>
    </div>`;
  }

  const saved = d.updated_at ? `${icon("check")}Saved ${relTime(d.updated_at)}` : "Not saved yet";
  return {
    title: revising ? "Revise and Resubmit" : d.id ? "Edit Draft" : "Submit New Research",
    crumbs: [["My Research Projects", "#/t/projects"]],
    desc: STEPS[step - 1].why,
    html: `<section class="card stack">
      <div class="row between"><div><h2 style="font-size:17px">${esc(d.title || "New research proposal")}</h2><p class="small muted">Step ${step} of 6 · ${esc(STEPS[step - 1].title)} · Fields marked <span style="color:var(--ar)">*</span> are required</p></div>
        <span class="save-state ${d.updated_at ? "saved" : ""}" data-save aria-live="polite">${saved}</span></div>
      ${stepBar}
      <form data-wiz class="stack" novalidate>${body}</form>
      <div class="row between" style="border-top:1px solid var(--border);padding-top:16px">
        <button class="btn btn-ghost" data-nav="${step - 1}" ${step === 1 ? "disabled" : ""}>${icon("left")}Back</button>
        <div class="row"><button class="btn btn-ghost" data-savenow>${icon("save")}Save draft</button>
        ${step < 6 ? `<button class="btn btn-primary" data-nav="${step + 1}">Next${icon("chevron")}</button>` : `<button class="btn btn-primary" data-submit disabled>${icon("send")}${revising ? "Resubmit revision" : "Submit research"}</button>`}</div>
      </div></section>`,
    bind(root) {
      const form = root.querySelector("[data-wiz]");
      const state = root.querySelector("[data-save]");
      const persist = (quiet) => {
        if (!d.title?.trim() && !d.id) { if (!quiet) toast("Add a research title before saving.", "err"); return false; }
        try {
          const p = db.saveDraft(user, d);
          d.id = p.id; d.updated_at = p.updated_at; d.status = p.status;
          if (!q.get("id")) history.replaceState(null, "", `#/t/submit?id=${p.id}&step=${step}`);
          state.className = "save-state saved"; state.innerHTML = `${icon("check")}Saved ${fmtDateTime(p.updated_at)}`;
          window.__rd360Dirty = false;
          if (!quiet) toast("Draft saved.");
          return true;
        } catch (e) {
          state.className = "save-state failed"; state.innerHTML = `${icon("alert")}Unable to save <button type="button" class="btn btn-ghost btn-sm" data-retry>Retry</button>`;
          state.querySelector("[data-retry]").addEventListener("click", () => persist(false));
          toast(e.message, "err"); return false;
        }
      };
      const autosave = debounce(() => persist(true), 900);
      form.addEventListener("input", (e) => {
        const el = e.target; if (!el.name) return;
        d[el.name] = el.value;
        window.__rd360Dirty = true;
        state.className = "save-state saving"; state.textContent = "Saving…";
        autosave();
      });
      form.addEventListener("change", (e) => { if (e.target.name === "category") { d.category = e.target.value; persist(true); window.dispatchEvent(new Event("rd360:render")); } });
      const go = (n) => { if (window.__rd360Dirty) persist(true); location.hash = `#/t/submit?${d.id ? `id=${d.id}&` : ""}step=${n}`; };
      root.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); go(b.dataset.step); }));
      root.querySelectorAll("[data-nav]").forEach((b) => b.addEventListener("click", () => go(b.dataset.nav)));
      root.querySelector("[data-savenow]").addEventListener("click", () => persist(false));

      // attachments
      const addFiles = async (list) => {
        if (db.cloudMode && !d.id && !persist(false)) return; // the draft must exist before its files
        if (db.cloudMode) await db.flush();
        for (const f of list) {
          const ext = "." + f.name.split(".").pop().toLowerCase();
          if (!ALLOWED.includes(ext)) { toast(`${f.name}: only PDF, DOC and DOCX files are accepted.`, "err"); continue; }
          if (f.size > MAX_MB * 1024 * 1024) { toast(`${f.name} is larger than ${MAX_MB} MB.`, "err"); continue; }
          let path = null;
          if (db.cloudMode) {
            const st = root.querySelector("[data-save]"); if (st) { st.className = "save-state saving"; st.textContent = `Uploading ${f.name}…`; }
            try { path = await db.uploadFile(d.id, f); } catch (err) { toast(err.message, "err"); continue; }
          }
          const prev = (d.files || []).filter((x) => x.name === f.name);
          d.files = [...(d.files || []), { name: f.name, size: f.size, type: f.type, uploaded_at: new Date().toISOString(), version: prev.length + 1, ...(path ? { path } : {}) }];
        }
        if (persist(true) || !d.id) window.dispatchEvent(new Event("rd360:render"));
      };
      const drop = root.querySelector("[data-drop]");
      if (drop) {
        root.querySelector("[data-files]").addEventListener("change", (e) => addFiles(e.target.files));
        drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("drag"); });
        drop.addEventListener("dragleave", () => drop.classList.remove("drag"));
        drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("drag"); addFiles(e.dataTransfer.files); });
        root.querySelectorAll("[data-rmfile]").forEach((b) => b.addEventListener("click", () => { d.files.splice(Number(b.dataset.rmfile), 1); persist(true); window.dispatchEvent(new Event("rd360:render")); }));
      }

      // submit
      const submitBtn = root.querySelector("[data-submit]");
      if (submitBtn) {
        const ready = () => { submitBtn.disabled = !(root.querySelector("[data-declare]").checked && !missingFields(d).length); };
        root.querySelector("[data-declare]").addEventListener("change", ready);
        submitBtn.addEventListener("click", async () => {
          if (!persist(true)) return;
          const ok = await modal({ title: revising ? "Resubmit this revision?" : "Submit this research?", body: "After submitting, the proposal is locked until reviewers return it for revision.", confirm: revising ? "Resubmit" : "Submit" });
          if (!ok) return;
          try {
            const p = db.submit(user, d.id);
            await db.flush(); // in connected mode the database issues the Research ID
            wiz = null; window.__rd360Dirty = false;
            await modal({ title: "Submission received", body: `<b>Research ID:</b> <span class="mono">${esc(p.research_id)}</span><br><b>Title:</b> ${esc(p.title)}<br><b>Status:</b> ${esc(p.status)}<br><b>Received:</b> ${fmtDateTime(p.history.at(-1).at)}<br><br>You'll be notified when screening is complete.`, confirm: "View project", cancel: "Close" });
            location.hash = `#/t/project/${p.id}`;
          } catch (e) { toast(e.message, "err"); }
        });
      }
    },
  };
}
export function resetWizard() { wiz = null; }
