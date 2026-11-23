// Home Page Editor (Website Content Management) for administrators.
import { icon } from "./icons.js?v=202611231438";
import { db, SECTION_LABELS, CONTENT_TYPES, ITEM_CATEGORIES } from "./store.js?v=202611231438";
import { esc, fmtDate, fmtDateTime, relTime, toast, modal, emptyState } from "./ui.js?v=202611231438";
import { safeImg, safeUrl, fbEmbed } from "./home.js?v=202611231438";

const fire = () => window.dispatchEvent(new Event("rd360:render"));
const clone = (o) => JSON.parse(JSON.stringify(o));
const newId = () => Math.random().toString(36).slice(2, 10);
const TABS = [["sections", "Page and sections"], ["carousel", "Carousel"], ["achievement", "Achievements"], ["news", "News"], ["event", "Events"], ["resource", "Resources"], ["social", "Facebook"], ["contact", "Contact and statistics"], ["versions", "Version history"]];
const schedFields = (x = {}) => [
  { name: "start", label: "Show from (optional)", type: "date", value: x.start || "" },
  { name: "end", label: "Hide after (optional)", type: "date", value: x.end || "" },
  { name: "enabled", label: "Visible when published", type: "checkbox", value: x.enabled !== false, span: true },
];
const schedNote = (x) => x.enabled === false ? `<span class="tag">Hidden</span>` : (x.start && new Date(x.start) > new Date()) ? `<span class="tag">Scheduled ${fmtDate(x.start)}</span>` : (x.end && new Date(x.end + "T23:59:59") < new Date()) ? `<span class="tag">Expired</span>` : `<span class="badge s-done">Live</span>`;

export function cmsPage(user, q) {
  const tab = q.get("tab") || "sections";
  const d = clone(db.cmsDraft());
  const pub = db.cmsPublished();
  const dirty = db.cmsDirty();
  const canPub = db.canPublish(user);
  const save = (msg) => { try { db.saveCms(user, d); if (msg) toast(msg); fire(); } catch (e) { toast(e.message, "err"); } };

  let body = "";
  if (tab === "sections") {
    body = `<section class="card stack"><div class="card-head" style="margin:0"><h2>Hero / welcome</h2><span class="sub">The first thing visitors see. Portal buttons are always shown.</span></div>
      <form class="grid-2" data-hero>
        <label class="field span-2">Small top line<input name="eyebrow" value="${esc(d.hero.eyebrow)}"></label>
        <label class="field"><span class="req">Headline</span><input name="title" value="${esc(d.hero.title)}" required></label>
        <label class="field">Tagline<input name="tagline" value="${esc(d.hero.tagline)}"></label>
        <label class="field span-2">Purpose statement<textarea name="text">${esc(d.hero.text)}</textarea></label>
        <div><button class="btn btn-ink btn-sm">${icon("save")}Save hero</button></div></form></section>
    <section class="card stack"><div class="card-head" style="margin:0"><h2>Sections</h2><span class="sub">Turn sections on or off, rename them and change their order. Empty sections stay hidden automatically.</span></div>
      ${d.sections.map((s, i) => `<div class="sec-row"><input type="checkbox" data-sec-on="${i}" ${s.enabled ? "checked" : ""} aria-label="Show ${esc(s.title)}">
        <div class="grow"><input type="text" data-sec-title="${i}" value="${esc(s.title)}" aria-label="Section title"><span class="small muted">${esc(SECTION_LABELS[s.key])}</span></div>
        <button class="icon-btn" data-sec-up="${i}" ${i ? "" : "disabled"} aria-label="Move up">${icon("up")}</button><button class="icon-btn" data-sec-down="${i}" ${i < d.sections.length - 1 ? "" : "disabled"} aria-label="Move down">${icon("down")}</button></div>`).join("")}
    </section>`;
  } else if (tab === "carousel") {
    body = `<section class="card stack"><div class="card-head" style="margin:0"><h2>Carousel slides</h2><button class="btn btn-ink btn-sm" data-add-slide>${icon("plus")}Add slide</button></div>
      <p class="small muted">Wide photos (16:9) work best. Slides rotate gently, pause on hover or focus, and stop for visitors who prefer reduced motion.</p>
      ${d.slides.length ? d.slides.map((s, i) => itemRow(s, i, "slide", d.slides.length)).join("") : emptyState("No slides yet", "Add a slide to feature district research achievements, events or announcements.")}</section>`;
  } else if (CONTENT_TYPES[tab]) {
    const list = d.items.map((x, i) => ({ x, i })).filter(({ x }) => x.type === tab);
    body = `<section class="card stack"><div class="card-head" style="margin:0"><h2>${esc(CONTENT_TYPES[tab])}</h2><button class="btn btn-ink btn-sm" data-add-item="${tab}">${icon("plus")}Add ${tab === "news" ? "announcement" : tab}</button></div>
      ${tab === "achievement" || tab === "news" ? `<p class="small muted">Keep a source link and attribution so details can be checked before publishing. Check consent before using photos of learners.</p>` : ""}
      ${list.length ? list.map(({ x, i }, k) => itemRow(x, i, "item", list.length, k)).join("") : emptyState("Nothing here yet", `Add ${CONTENT_TYPES[tab].toLowerCase()} to show them on the home page.`)}</section>`;
  } else if (tab === "social") {
    body = `<section class="card stack"><div class="card-head" style="margin:0"><h2>Facebook highlights</h2><button class="btn btn-ink btn-sm" data-add-social>${icon("plus")}Add Facebook post</button></div>
      <div class="notice">${icon("info")}<span>Paste the link of a <b>public</b> post from an official page. It's shown with Facebook's own embed and labeled as external content, with an "Open Facebook post" link in case the embed is blocked. Never paste passwords or private posts.</span></div>
      ${d.social.length ? d.social.map((s, i) => `<div class="item-row"><div class="thumb">${icon("external")}</div><div><b>${esc(s.title || "Facebook post")}</b><div class="small muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.url)}</div><div class="row" style="gap:6px;margin-top:4px">${schedNote(s)}${fbEmbed(s.url) ? "" : `<span class="tag" style="color:var(--danger)">Not a Facebook link</span>`}</div></div>
        <div class="row" style="gap:6px"><button class="btn btn-ghost btn-sm" data-edit-social="${i}">${icon("edit")}Edit</button><button class="icon-btn" data-del-social="${i}" aria-label="Delete">${icon("trash")}</button></div></div>`).join("") : emptyState("No Facebook posts yet", "Feature official public posts from the district's Facebook page.")}</section>`;
  } else if (tab === "contact") {
    const st = db.publicStats();
    body = `<section class="card stack"><div class="card-head" style="margin:0"><h2>Contact and help</h2><span class="sub">Only filled-in fields are shown.</span></div>
      <form class="grid-2" data-contact>
        <label class="field span-2">Office name<input name="office" value="${esc(d.contact.office)}"></label>
        <label class="field span-2">Address<input name="address" value="${esc(d.contact.address)}"></label>
        <label class="field">Official email<input type="email" name="email" value="${esc(d.contact.email)}"></label>
        <label class="field">Phone<input name="phone" value="${esc(d.contact.phone)}"></label>
        <label class="field">Office hours<input name="hours" value="${esc(d.contact.hours)}"></label>
        <label class="field">Facebook page link<input type="url" name="facebook" value="${esc(d.contact.facebook)}"></label>
        <label class="field span-2">Help note<textarea name="note">${esc(d.contact.note)}</textarea></label>
        <div><button class="btn btn-ink btn-sm">${icon("save")}Save contact</button></div></form></section>
    <section class="card stack"><div class="card-head" style="margin:0"><h2>Research at a glance</h2><span class="sub">Public statistics are counted from research records, never typed in.</span></div>
      <form class="stack" data-stats>
        ${[["completed", `Completed studies (now ${st.completed})`], ["schools", `Participating schools (now ${st.schools})`], ["active", `Active research projects (now ${st.active})`], ["categories", "Number of research categories (3)"]].map(([k, l]) => `<label class="row small"><input type="checkbox" name="${k}" ${d.stats[k] ? "checked" : ""}>${l}</label>`).join("")}
        <label class="field">Explanatory note (optional)<input name="note" value="${esc(d.stats.note || "")}" placeholder="e.g. Includes school year 2026–2027 submissions."></label>
        <p class="small muted">The section stays hidden until at least one research project has been submitted. An "As of" date is shown with the figures.</p>
        <div><button class="btn btn-ink btn-sm">${icon("save")}Save statistics settings</button></div></form></section>`;
  } else if (tab === "versions") {
    const vs = db.cmsVersions();
    body = `<section class="card stack"><div class="card-head" style="margin:0"><h2>Published versions</h2><span class="sub">The last 10 publications. Restoring copies a version into the draft; publish it to make it live.</span></div>
      ${vs.length ? `<div class="table-wrap"><table><thead><tr><th>Published</th><th>By</th><th>Content</th><th></th></tr></thead><tbody>${vs.map((v, k) => `<tr><td>${fmtDateTime(v.at)}${k === 0 && pub ? ' <span class="badge s-done">Current</span>' : ""}</td><td>${esc(db.user(v.by)?.name || "—")}</td>
        <td class="small">${v.content.slides.length} slides · ${v.content.items.length} items · ${v.content.social.length} Facebook posts</td><td><button class="btn btn-ghost btn-sm" data-restore="${v.id}">Restore to draft</button></td></tr>`).join("")}</tbody></table></div>` : emptyState("Nothing published yet", "Publish the home page to start the version history.")}</section>`;
  }

  return {
    title: "Home Page Editor",
    crumbs: [["Website", "#/a/cms"]],
    desc: "Edit the public home page without code. Changes stay in a private draft until you publish.",
    html: `<section class="card cms-bar">
        <div class="row">${dirty ? `<span class="cms-status">${icon("edit")}Draft has unpublished changes</span>` : `<span class="cms-status live">${icon("check")}Live page matches the draft</span>`}
          <span class="small muted">${pub ? `Published ${relTime(pub.published_at)} by ${esc(db.user(pub.published_by)?.name || "—")}` : "Not published yet — visitors see the default page."}${d.updated_at ? ` · Draft saved ${relTime(d.updated_at)}` : ""}</span></div>
        <div class="row"><button class="btn btn-ghost btn-sm" data-preview>${icon("eye")}Preview</button>
          ${dirty ? `<button class="btn btn-ghost btn-sm" data-discard>Discard draft</button>` : ""}
          ${pub && canPub ? `<button class="btn btn-ghost btn-sm" data-unpublish>Unpublish</button>` : ""}
          <button class="btn btn-green btn-sm" data-publish ${canPub && dirty ? "" : "disabled"} title="${canPub ? "" : "Your role can edit but not publish"}">${icon("send")}Publish</button></div>
      </section>
      <div class="tabs" role="tablist" style="width:100%">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${k === tab}" class="${k === tab ? "on" : ""}" data-tab="${k}">${esc(l)}</button>`).join("")}</div>
      ${body}`,
    bind(root) {
      root.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { location.hash = `#/a/cms?tab=${b.dataset.tab}`; }));
      root.querySelector("[data-preview]").addEventListener("click", () => openPreview());
      root.querySelector("[data-publish]")?.addEventListener("click", async () => {
        if (!(await modal({ title: "Publish the home page?", body: "Everyone visiting the website will see the current draft. Check the preview first, especially photos and names of learners.", confirm: "Publish now" }))) return;
        try { db.publishCms(user); toast("Home page published."); fire(); } catch (e) { toast(e.message, "err"); }
      });
      root.querySelector("[data-unpublish]")?.addEventListener("click", async () => {
        if (!(await modal({ title: "Unpublish the home page?", body: "Visitors will see the default page (hero, portals and lifecycle) until you publish again. Your draft is kept.", confirm: "Unpublish", danger: true }))) return;
        try { db.unpublishCms(user); toast("Home page unpublished."); fire(); } catch (e) { toast(e.message, "err"); }
      });
      root.querySelector("[data-discard]")?.addEventListener("click", async () => {
        if (!(await modal({ title: "Discard draft changes?", body: "The draft goes back to the currently published version.", confirm: "Discard", danger: true }))) return;
        db.discardCmsDraft(user); toast("Draft discarded."); fire();
      });

      // sections
      root.querySelector("[data-hero]")?.addEventListener("submit", (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); if (!f.title.trim()) return toast("The headline can't be empty.", "err"); Object.assign(d.hero, f); save("Hero saved to draft."); });
      root.querySelectorAll("[data-sec-on]").forEach((c) => c.addEventListener("change", () => { d.sections[c.dataset.secOn].enabled = c.checked; save(); }));
      root.querySelectorAll("[data-sec-title]").forEach((c) => c.addEventListener("change", () => { d.sections[c.dataset.secTitle].title = c.value.trim() || SECTION_LABELS[d.sections[c.dataset.secTitle].key]; save("Section renamed."); }));
      const move = (arr, i, dir) => { const j = i + dir; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
      root.querySelectorAll("[data-sec-up]").forEach((b) => b.addEventListener("click", () => { move(d.sections, +b.dataset.secUp, -1); save(); }));
      root.querySelectorAll("[data-sec-down]").forEach((b) => b.addEventListener("click", () => { move(d.sections, +b.dataset.secDown, 1); save(); }));

      // slides
      const slideForm = (s = {}) => modal({ title: s.id ? "Edit slide" : "Add slide", wide: true, confirm: "Save to draft", fields: [
        { name: "title", label: "Headline", required: true, value: s.title, span: true },
        { name: "kicker", label: "Small label above headline", value: s.kicker, hint: "e.g. Research Award" },
        { name: "alt", label: "Image description (alt text)", value: s.alt, hint: "Describe the photo for screen readers." },
        { name: "text", label: "Short description", type: "textarea", value: s.text, span: true },
        { name: "image", label: "Slide image", type: "image", value: s.image },
        { name: "button", label: "Button label (optional)", value: s.button },
        { name: "url", label: "Button link", value: s.url, hint: "https://… or an internal page like #/register" },
        ...schedFields(s)] });
      root.querySelector("[data-add-slide]")?.addEventListener("click", async () => { const r = await slideForm(); if (!r) return; if (r.url && !safeUrl(r.url)) return toast("Links must start with https://, http:// or #/.", "err"); d.slides.push({ id: newId(), ...r }); save("Slide added to draft."); });
      bindRows(root, "slide", d.slides, slideForm, save);

      // items
      const itemForm = (type, x = {}) => modal({ title: `${x.id ? "Edit" : "Add"} ${type === "news" ? "announcement" : type}`, wide: true, confirm: "Save to draft", fields: [
        { name: "title", label: "Title", required: true, value: x.title, span: true },
        { name: "summary", label: "Summary", type: "textarea", value: x.summary, span: true },
        ...(type === "resource" ? [{ name: "url", label: "Download / resource link", required: true, value: x.url, hint: "Link to the file on Google Drive, DepEd site, etc.", span: true }] : [
          { name: "category", label: "Category", type: "select", value: x.category || "", options: [{ value: "", label: "—" }, ...ITEM_CATEGORIES.map((c) => ({ value: c, label: c }))] },
          { name: "date", label: type === "event" ? "Event date" : "Date", type: "date", value: x.date || "", required: type === "event" },
          { name: "attribution", label: "School / team / office", value: x.attribution },
          { name: "url", label: "Source or details link", value: x.url },
          { name: "image", label: "Featured image", type: "image", value: x.image },
          { name: "alt", label: "Image description (alt text)", value: x.alt },
          { name: "pinned", label: "Pin to the top", type: "checkbox", value: x.pinned }]),
        ...schedFields(x)] });
      root.querySelector("[data-add-item]")?.addEventListener("click", async (e) => {
        const type = e.currentTarget.dataset.addItem; const r = await itemForm(type); if (!r) return;
        if (r.url && !safeUrl(r.url)) return toast("Links must start with https://, http:// or #/.", "err");
        d.items.push({ id: newId(), type, ...r }); save("Added to draft.");
      });
      bindRows(root, "item", d.items, (x) => itemForm(x.type, x), save);

      // social
      const socialForm = (s = {}) => modal({ title: s.id ? "Edit Facebook post" : "Add Facebook post", wide: true, confirm: "Save to draft", fields: [
        { name: "url", label: "Public Facebook post link", required: true, value: s.url, span: true, hint: "Example: https://www.facebook.com/YourPage/posts/…" },
        { name: "title", label: "Title", value: s.title }, { name: "source", label: "Source / page name", value: s.source || "" },
        { name: "caption", label: "Caption or context", type: "textarea", value: s.caption, span: true },
        { name: "date", label: "Post date", type: "date", value: s.date || "" }, ...schedFields(s)] });
      root.querySelector("[data-add-social]")?.addEventListener("click", async () => { const r = await socialForm(); if (!r) return; if (!fbEmbed(r.url)) return toast("That isn't a public facebook.com or fb.watch link.", "err"); d.social.push({ id: newId(), ...r }); save("Facebook post added to draft."); });
      root.querySelectorAll("[data-edit-social]").forEach((b) => b.addEventListener("click", async () => { const s = d.social[b.dataset.editSocial]; const r = await socialForm(s); if (!r) return; if (!fbEmbed(r.url)) return toast("That isn't a public facebook.com or fb.watch link.", "err"); Object.assign(s, r); save("Saved to draft."); }));
      root.querySelectorAll("[data-del-social]").forEach((b) => b.addEventListener("click", async () => { if (!(await modal({ title: "Remove this Facebook post?", confirm: "Remove", danger: true }))) return; d.social.splice(+b.dataset.delSocial, 1); save("Removed from draft."); }));

      // contact & stats
      root.querySelector("[data-contact]")?.addEventListener("submit", (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); if (f.facebook && !safeUrl(f.facebook)) return toast("The Facebook link must start with https://", "err"); Object.assign(d.contact, f); save("Contact saved to draft."); });
      root.querySelector("[data-stats]")?.addEventListener("submit", (e) => { e.preventDefault(); const fd = new FormData(e.target); d.stats = { completed: fd.has("completed"), schools: fd.has("schools"), active: fd.has("active"), categories: fd.has("categories"), note: String(fd.get("note") || "") }; save("Statistics settings saved to draft."); });
      root.querySelectorAll("[data-restore]").forEach((b) => b.addEventListener("click", async () => {
        if (!(await modal({ title: "Restore this version into the draft?", body: "Your current draft will be replaced. Nothing changes publicly until you publish.", confirm: "Restore" }))) return;
        db.restoreCmsVersion(user, b.dataset.restore); toast("Version restored to draft."); location.hash = "#/a/cms?tab=sections";
      }));
    },
  };
}

function itemRow(x, i, kind, total, k = i) {
  return `<div class="item-row"><div class="thumb">${safeImg(x.image) ? `<img src="${safeImg(x.image)}" alt="">` : icon(kind === "slide" ? "image" : "file")}</div>
    <div style="min-width:0"><b>${esc(x.title)}</b>${x.pinned ? ' <span class="tag">Pinned</span>' : ""}<div class="small muted">${esc([x.category, x.date && fmtDate(x.date), x.attribution].filter(Boolean).join(" · ") || x.text || x.summary || "")}</div><div class="row" style="gap:6px;margin-top:4px">${schedNote(x)}</div></div>
    <div class="row" style="gap:6px;flex-wrap:nowrap">
      <button class="icon-btn" data-${kind}-up="${i}" ${k ? "" : "disabled"} aria-label="Move up">${icon("up")}</button>
      <button class="icon-btn" data-${kind}-down="${i}" ${k < total - 1 ? "" : "disabled"} aria-label="Move down">${icon("down")}</button>
      <button class="btn btn-ghost btn-sm" data-${kind}-edit="${i}">${icon("edit")}Edit</button>
      <button class="icon-btn" data-${kind}-dup="${i}" aria-label="Duplicate">${icon("copy")}</button>
      <button class="icon-btn" data-${kind}-del="${i}" aria-label="Delete">${icon("trash")}</button></div></div>`;
}
function bindRows(root, kind, arr, form, save) {
  const sameType = (i, dir) => { // next index with the same type (items share one array)
    for (let j = i + dir; j >= 0 && j < arr.length; j += dir) if (!arr[i].type || arr[j].type === arr[i].type) return j;
    return -1;
  };
  root.querySelectorAll(`[data-${kind}-up],[data-${kind}-down]`).forEach((b) => b.addEventListener("click", () => {
    const up = b.hasAttribute(`data-${kind}-up`); const i = +(up ? b.getAttribute(`data-${kind}-up`) : b.getAttribute(`data-${kind}-down`));
    const j = sameType(i, up ? -1 : 1); if (j < 0) return; [arr[i], arr[j]] = [arr[j], arr[i]]; save();
  }));
  root.querySelectorAll(`[data-${kind}-edit]`).forEach((b) => b.addEventListener("click", async () => {
    const x = arr[+b.getAttribute(`data-${kind}-edit`)]; const r = await form(x); if (!r) return;
    if (r.url && !safeUrl(r.url)) return toast("Links must start with https://, http:// or #/.", "err");
    Object.assign(x, r); save("Saved to draft.");
  }));
  root.querySelectorAll(`[data-${kind}-dup]`).forEach((b) => b.addEventListener("click", () => {
    const i = +b.getAttribute(`data-${kind}-dup`); arr.splice(i + 1, 0, { ...clone(arr[i]), id: newId(), title: arr[i].title + " (copy)", enabled: false }); save("Duplicated as a hidden copy.");
  }));
  root.querySelectorAll(`[data-${kind}-del]`).forEach((b) => b.addEventListener("click", async () => {
    if (!(await modal({ title: "Delete this item from the draft?", body: "It disappears from the public page the next time you publish.", confirm: "Delete", danger: true }))) return;
    arr.splice(+b.getAttribute(`data-${kind}-del`), 1); save("Deleted from draft.");
  }));
}

function openPreview() {
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.innerHTML = `<div class="modal wide" role="dialog" aria-modal="true" aria-label="Draft preview" style="width:min(1300px,100%)">
    <div class="row between"><h3>Draft preview</h3><div class="row"><div class="seg" role="group" aria-label="Device size">
      <button class="on" data-w="100%">${icon("monitor")}Desktop</button><button data-w="820px">${icon("tablet")}Tablet</button><button data-w="390px">${icon("phone")}Mobile</button></div>
      <button class="icon-btn" data-x aria-label="Close preview">${icon("x")}</button></div></div>
    <iframe class="preview-frame" src="${location.pathname}#/preview" title="Home page draft preview"></iframe></div>`;
  document.body.append(wrap);
  const frame = wrap.querySelector("iframe");
  const close = () => { wrap.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap || e.target.closest("[data-x]")) return close();
    const b = e.target.closest("[data-w]"); if (!b) return;
    wrap.querySelectorAll("[data-w]").forEach((x) => x.classList.toggle("on", x === b));
    frame.style.maxWidth = b.dataset.w;
  });
}
