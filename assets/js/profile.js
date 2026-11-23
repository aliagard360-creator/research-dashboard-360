// "My Profile" as a bento dashboard: big photo card, headline numbers, activity chart,
// completeness ring, getting-started checklist, project list and the editable details.
import { icon } from "./icons.js?v=202611230828";
import { db, ROLES, catById, TERMINAL, isOverdue } from "./store.js?v=202611230828";
import { esc, fmtDate, fmtDateTime, relTime, statusBadge, toast, initials } from "./ui.js?v=202611230828";

const rerender = () => window.dispatchEvent(new Event("rd360:render"));
const DONE = ["Completed", "Published", "Archived"];

export function profilePage(portal, user) {
  const needs = db.profileNeedsApproval(user);
  const pc = user.pending_change?.fields || null;
  const isTeacher = user.role === "teacher";
  const isAdmin = ["admin", "superadmin"].includes(user.role);
  const school = db.school(user.school_id);
  const schools = db.schools().filter((s) => s.active || s.id === user.school_id);
  const first = String(user.name || "").split(" ")[0];

  // ---- numbers (all from records) ----
  const mine = isTeacher ? db.visibleProjects(user) : user.role === "evaluator" ? db.visibleProjects(user) : [];
  const myActs = db.audit().filter((a) => a.actor === user.id);
  const stats = isTeacher
    ? [[mine.length, "Projects"], [mine.filter((p) => DONE.includes(p.status)).length, "Completed"], [mine.filter((p) => !DONE.includes(p.status) && !TERMINAL.includes(p.status) && p.status !== "Draft").length, "In progress"]]
    : user.role === "evaluator"
      ? [[mine.length, "Assigned"], [mine.filter((p) => p.feedback.some((f) => f.by === user.id)).length, "Reviewed"], [mine.filter(isOverdue).length, "Overdue"]]
      : [[myActs.filter((a) => /Approved/.test(a.action)).length, "Approvals"], [myActs.filter((a) => /^Status /.test(a.action)).length, "Decisions"], [myActs.length, "Actions"]];

  // ---- activity over the last 6 months ----
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i)); return d; });
  const inMonth = (iso, m) => { if (!iso) return false; const d = new Date(iso); return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear(); };
  const activity = months.map((m) => ({ label: m.toLocaleString("en-PH", { month: "short" }), n: isTeacher ? mine.reduce((s, p) => s + p.history.filter((h) => h.actor === user.id && inMonth(h.at, m)).length, 0) : myActs.filter((a) => inMonth(a.at, m)).length }));
  const maxA = Math.max(1, ...activity.map((a) => a.n));
  const totalA = activity.reduce((s, a) => s + a.n, 0);

  // ---- completeness ----
  const checks = [
    ["Profile photo", !!user.photo],
    ["Position", !!user.position],
    ["School", !!user.school_id || !isTeacher],
    ["Short bio", !!user.bio],
    ["Research interests", !!user.interests],
    ...(isTeacher ? [["First submission", mine.some((p) => p.status !== "Draft")], ["First completed study", mine.some((p) => DONE.includes(p.status))]] : []),
  ];
  const done = checks.filter((c) => c[1]).length;
  const pct = Math.round((done / checks.length) * 100);
  const R = 46, C = 2 * Math.PI * R;

  // ---- projects / tasks list for the dark card ----
  const listItems = isTeacher
    ? [...mine].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 5).map((p) => ({ title: p.title || "Untitled draft", sub: p.research_id || "Not submitted", status: p.status, color: catById(p.category).color, href: `#/t/project/${p.id}` }))
    : user.role === "evaluator"
      ? mine.slice(0, 5).map((p) => ({ title: p.title, sub: p.research_id, status: p.status, color: catById(p.category).color, href: `#/a/project/${p.id}` }))
      : myActs.slice(0, 5).map((a) => ({ title: a.action, sub: relTime(a.at), status: "", color: "var(--gold)", href: "#/a/audit" }));
  const upcoming = (isTeacher || user.role === "evaluator" ? mine : []).filter((p) => p.deadline && !TERMINAL.includes(p.status) && !DONE.includes(p.status)).sort((a, b) => new Date(a.deadline) - new Date(b.deadline)).slice(0, 3);

  const photo = pc && "photo" in pc ? pc.photo : user.photo;
  const label = { name: "Full name", position: "Position", school_id: "School", photo: "Profile photo" };
  const show = (k, v) => k === "school_id" ? (db.school(v)?.name || "District Office") : k === "photo" ? (v ? "New photo" : "Remove photo") : v;

  const html = `<div class="pf">
    <section class="pf-head">
      <div><h2>Welcome in, ${esc(first)}</h2>
        <div class="pf-chips"><span class="pf-chip dark">${icon(isAdmin ? "shield" : "grad")}${esc(ROLES[user.role])}</span><span class="pf-chip">${icon("school")}${esc(school?.name || "District Office")}</span><span class="pf-chip">${icon("calendar")}Member since ${fmtDate(user.created_at)}</span>${needs ? `<span class="pf-chip gold">${icon("shield")}Changes need approval</span>` : ""}</div></div>
      <div class="pf-stats">${stats.map(([n, l]) => `<div><b data-count="${n}">${n}</b><span>${esc(l)}</span></div>`).join("")}</div>
    </section>

    ${pc ? `<section class="notice warn">${icon("clock")}<div class="grow"><b>Waiting for approval since ${fmtDateTime(user.pending_change.at)}</b>
        <ul style="margin:6px 0 8px;padding-left:18px">${Object.entries(pc).map(([k, v]) => `<li>${esc(label[k])}: <b>${esc(show(k, v))}</b></li>`).join("")}</ul>
        <button type="button" class="btn btn-ghost btn-sm" data-cancelchange>Cancel request</button></div></section>` : ""}
    ${user.change_note ? `<section class="notice">${icon("info")}<span>Your last profile change wasn't approved: ${esc(user.change_note)}</span></section>` : ""}

    <div class="pf-grid">
      <article class="pf-card pf-photo">
        ${photo ? `<img src="${esc(photo)}" alt="Profile photo of ${esc(user.name)}">` : `<div class="pf-initials" aria-hidden="true">${esc(initials(user.name))}</div>`}
        ${pc && "photo" in pc ? `<span class="pf-pending">${icon("clock")}Waiting for approval</span>` : ""}
        <div class="pf-photo-info"><div><b>${esc(user.name)}</b><span>${esc(user.position || ROLES[user.role])}</span></div>
          ${school ? `<a class="pf-badge" href="#/${portal}/school/${school.id}" style="color:#fff;text-decoration:none">${esc(school ? school.name.replace("Elementary School", "ES").replace("National High School", "NHS").replace("Senior High School", "SHS").replace("High School", "HS").replace("Integrated School", "IS") : "District")}</a>` : `<span class="pf-badge">District</span>`}</div>
        <div class="pf-photo-actions"><label class="icon-btn" title="${photo ? "Change photo" : "Upload photo"}" aria-label="${photo ? "Change photo" : "Upload photo"}">${icon("upload")}<input type="file" accept="image/png,image/jpeg" hidden data-photo></label>${user.photo ? `<button type="button" class="icon-btn" data-rmphoto title="Remove photo" aria-label="Remove photo">${icon("trash")}</button>` : ""}</div>
      </article>

      <article class="pf-card pf-activity">
        <div class="pf-card-head"><div><span class="pf-kicker">Activity</span><b>${totalA}<small> ${isTeacher ? "project updates" : "actions"}</small></b></div><span class="pf-kicker">Last 6 months</span></div>
        <div class="pf-bars" role="img" aria-label="Activity per month: ${activity.map((a) => `${a.label} ${a.n}`).join(", ")}">${activity.map((a, i) => `<div class="pf-bar ${i === 5 ? "now" : ""}"><span style="--h:${Math.max(6, (a.n / maxA) * 100)}%">${a.n ? `<em>${a.n}</em>` : ""}</span><small>${a.label}</small></div>`).join("")}</div>
      </article>

      <article class="pf-card pf-ring-card">
        <div class="pf-card-head"><span class="pf-kicker">Profile strength</span>${pct === 100 ? `<span class="pf-chip gold small">${icon("award")}Complete</span>` : ""}</div>
        <div class="pf-ring"><svg viewBox="0 0 110 110" aria-hidden="true"><circle cx="55" cy="55" r="${R}" class="trk"/><circle cx="55" cy="55" r="${R}" class="val" style="stroke-dasharray:${(pct / 100) * C} ${C}"/></svg><div><b>${pct}%</b><span>${done} of ${checks.length}</span></div></div>
        <p class="small muted" style="text-align:center">${pct === 100 ? "Everything's filled in." : `Next: ${esc(checks.find((c) => !c[1])[0].toLowerCase())}.`}</p>
      </article>

      <article class="pf-card pf-start">
        <div class="pf-card-head"><span class="pf-kicker">Getting started</span><b>${pct}%</b></div>
        <div class="pf-seg">${checks.map((c) => `<i class="${c[1] ? "on" : ""}"></i>`).join("")}</div>
        <ul class="pf-checks">${checks.map(([l, ok]) => `<li class="${ok ? "ok" : ""}"><span>${icon(ok ? "check" : "clock")}</span>${esc(l)}</li>`).join("")}</ul>
      </article>

      <article class="pf-card pf-dark">
        <div class="pf-card-head"><span class="pf-kicker">${isTeacher ? "My research" : user.role === "evaluator" ? "Assigned to me" : "Recent actions"}</span><b>${isTeacher || user.role === "evaluator" ? mine.length : myActs.length}</b></div>
        ${listItems.length ? `<ul class="pf-list">${listItems.map((x) => `<li><a href="${x.href}"><i style="background:${x.color}"></i><span><b>${esc(x.title)}</b><small>${esc(x.sub)}${x.status ? ` · ${esc(x.status)}` : ""}</small></span>${icon("chevron")}</a></li>`).join("")}</ul>`
          : `<p class="pf-empty">${isTeacher ? "No projects yet." : "Nothing here yet."}</p>${isTeacher ? `<a class="btn btn-gold btn-sm" href="#/t/submit">${icon("plus")}Start a submission</a>` : ""}`}
      </article>

      <article class="pf-card pf-deadlines">
        <div class="pf-card-head"><span class="pf-kicker">Upcoming deadlines</span><a class="small" href="#/${portal}/calendar">Calendar</a></div>
        ${upcoming.length ? upcoming.map((p) => { const d = new Date(p.deadline); return `<a class="pf-dl ${isOverdue(p) ? "late" : ""}" href="#/${portal}/project/${p.id}"><span class="pf-date"><small>${d.toLocaleString("en-PH", { month: "short" })}</small><b>${d.getDate()}</b></span><span><b>${esc(p.title)}</b><small>${esc(p.status)}</small></span></a>`; }).join("")
          : `<p class="small muted">No deadlines coming up.</p>`}
      </article>
    </div>

    <section class="pf-card pf-form">
      <div class="pf-card-head"><div><span class="pf-kicker">Account details</span><b style="font-size:18px">Edit your profile</b></div>${needs ? `<span class="small muted">Name, position and school changes are reviewed first. Bio and interests save right away.</span>` : ""}</div>
      <form class="grid-2" data-profile>
        <label class="field"><span class="req">Full name</span><input name="name" value="${esc(pc?.name ?? user.name)}" required></label>
        <label class="field"><span class="req">Position / designation</span><input name="position" value="${esc(pc?.position ?? user.position ?? "")}" required></label>
        <label class="field">Institutional email<input value="${esc(user.email || (user.username ? "@" + user.username : ""))}" disabled><span class="hint">Only an administrator can change your sign-in email.</span></label>
        ${isTeacher ? `<label class="field">School<select name="school_id">${schools.map((s) => `<option value="${s.id}" ${(pc?.school_id ?? user.school_id) === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>`
          : `<label class="field">School<input value="${esc(school?.name || "District Office")}" disabled></label>`}
        <label class="field span-2">Short bio<textarea name="bio" maxlength="400" rows="3" placeholder="Grade 3 adviser and reading coordinator with five years of action research experience.">${esc(user.bio || "")}</textarea><span class="hint">Up to 400 characters.</span></label>
        <label class="field span-2">Research interests<input name="interests" maxlength="200" value="${esc(user.interests || "")}" placeholder="Reading fluency, inclusive education, learner well-being"><span class="hint">Separate with commas.</span></label>
        ${user.interests ? `<div class="span-2 pf-tags">${user.interests.split(",").map((t) => t.trim()).filter(Boolean).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
        <div class="row span-2"><button class="btn btn-primary">${icon(needs ? "send" : "save")}Save profile</button></div>
      </form>
    </section>
  </div>`;

  return {
    title: "My Profile",
    html,
    bind(root) {
      const sendChange = (fields, okMsg) => {
        try {
          if (needs) { db.requestProfileChange(user, fields); toast("Sent to an administrator for approval."); }
          else { db.updateUser(user, user.id, fields); toast(okMsg); }
          rerender();
        } catch (err) { if (err.message !== "Nothing changed.") toast(err.message, "err"); else return false; }
        return true;
      };
      root.querySelector("[data-profile]").addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const name = String(fd.get("name")).trim(), position = String(fd.get("position")).trim();
        if (!name || !position) return toast("Name and position are required.", "err");
        // bio and interests never need approval
        const free = { bio: String(fd.get("bio") || "").trim().slice(0, 400), interests: String(fd.get("interests") || "").trim().slice(0, 200) };
        const freeChanged = free.bio !== (user.bio || "") || free.interests !== (user.interests || "");
        if (freeChanged) db.updateUser(user, user.id, free);
        const reviewed = { name, position };
        if (fd.has("school_id")) reviewed.school_id = String(fd.get("school_id"));
        const curr = { name: user.name, position: user.position || "", school_id: user.school_id };
        const reviewedChanged = Object.keys(reviewed).some((k) => (reviewed[k] || "") !== (curr[k] || "") && !(pc && pc[k] === reviewed[k]));
        if (reviewedChanged) sendChange(reviewed, "Profile saved.");
        else if (freeChanged) { toast("Profile saved."); rerender(); }
        else toast("Nothing to save.");
      });
      root.querySelector("[data-cancelchange]")?.addEventListener("click", () => { db.cancelProfileChange(user); toast("Request cancelled."); rerender(); });
      root.querySelector("[data-photo]").addEventListener("change", (e) => {
        const f = e.target.files[0]; if (!f) return;
        if (!["image/png", "image/jpeg"].includes(f.type)) return toast("Choose a JPG or PNG image.", "err");
        if (f.size > 2 * 1024 * 1024) return toast("The photo must be 2 MB or smaller.", "err");
        const img = new Image(), url = URL.createObjectURL(f);
        img.onload = () => { // portrait crop (4:5), 480 px wide, for the photo card
          const W = 480, H = 600, ratio = W / H;
          let sw = img.width, sh = img.width / ratio;
          if (sh > img.height) { sh = img.height; sw = sh * ratio; }
          const c = document.createElement("canvas"); c.width = W; c.height = H;
          c.getContext("2d").drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, W, H);
          URL.revokeObjectURL(url);
          sendChange({ photo: c.toDataURL("image/jpeg", 0.85) }, "Profile photo updated.");
        };
        img.onerror = () => { URL.revokeObjectURL(url); toast("That image couldn't be read.", "err"); };
        img.src = url;
      });
      root.querySelector("[data-rmphoto]")?.addEventListener("click", () => sendChange({ photo: null }, "Profile photo removed."));
    },
  };
}
