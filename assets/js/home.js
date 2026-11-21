// Public home page, rendered from the published CMS content (or the draft, in preview).
import { icon } from "./icons.js";
import { db, CATEGORIES, STAGES, CONTENT_TYPES, catById } from "./store.js";
import { esc, fmtDate } from "./ui.js";
import { LOGO } from "./shell.js";

/* ---------- safety helpers for admin-entered content ---------- */
export const safeImg = (src) => (typeof src === "string" && (/^data:image\/(png|jpe?g|webp|gif);base64,/.test(src) || /^https:\/\//.test(src)) ? src : "");
export const safeUrl = (u) => { const s = String(u || "").trim(); return /^https?:\/\//i.test(s) || /^#\//.test(s) || /^mailto:/i.test(s) ? s : ""; };
export function fbEmbed(url) {
  const u = String(url || "").trim();
  if (!/^https:\/\/(www\.|m\.|web\.)?(facebook\.com|fb\.watch)\//i.test(u)) return null;
  const video = /\/videos?\/|fb\.watch|\/reel\//i.test(u);
  return `https://www.facebook.com/plugins/${video ? "video" : "post"}.php?href=${encodeURIComponent(u)}&show_text=true&width=500`;
}
const live = (x) => x.enabled !== false && (!x.start || new Date(x.start) <= new Date()) && (!x.end || new Date(x.end + "T23:59:59") >= new Date());
const ext = (u) => /^https?:\/\//i.test(u) ? ' target="_blank" rel="noopener noreferrer"' : "";

export function homeHtml(user, content, { preview = false } = {}) {
  const c = content;
  const setup = db.setupRequired();
  const stats = db.publicStats();
  const slides = (c.slides || []).filter(live);
  const items = (type) => (c.items || []).filter((i) => i.type === type && live(i)).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.date || 0) - new Date(a.date || 0));
  const featured = db.repositoryItems(null).slice(0, 6);
  const social = (c.social || []).filter(live);
  const contactHas = ["address", "email", "phone", "facebook", "hours"].some((k) => c.contact?.[k]);

  const sectionHtml = {
    carousel: () => slides.length ? `<div class="carousel ${slides.length === 1 ? "single" : ""}" data-carousel tabindex="0" aria-roledescription="carousel" aria-label="Featured research highlights">
        ${slides.map((s, i) => `<div class="slide ${i ? "" : "on"}" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${slides.length}">
          ${safeImg(s.image) ? `<img src="${safeImg(s.image)}" alt="${esc(s.alt || "")}" ${i ? 'loading="lazy"' : ""}>` : ""}
          <div class="txt">${s.kicker ? `<span class="tagline">${esc(s.kicker)}</span>` : ""}<h3>${esc(s.title)}</h3>${s.text ? `<p>${esc(s.text)}</p>` : ""}
          ${s.button && safeUrl(s.url) ? `<div><a class="btn btn-gold" href="${esc(safeUrl(s.url))}"${ext(s.url)}>${esc(s.button)}${icon("arrow")}</a></div>` : ""}</div></div>`).join("")}
        <div class="dots" role="tablist">${slides.map((_, i) => `<button role="tab" aria-label="Show slide ${i + 1}" class="${i ? "" : "on"}" data-dot="${i}"></button>`).join("")}</div>
        <div class="controls"><button data-prev aria-label="Previous slide">${icon("left")}</button><button data-pause aria-label="Pause slideshow">${icon("pause")}</button><button data-next aria-label="Next slide">${icon("chevron")}</button></div>
      </div>` : "",
    stats: () => {
      if (!stats.total) return "";
      const tiles = [
        c.stats?.completed && [stats.completed, "Completed studies", "t-mint"],
        c.stats?.schools && [stats.schools, "Participating schools", "t-lav"],
        c.stats?.active && [stats.active, "Active research projects", "t-peach"],
        c.stats?.categories && [CATEGORIES.length, "Research categories", "t-sky"],
      ].filter(Boolean);
      return tiles.length ? `<div class="stat-row">${tiles.map(([n, l, cls]) => `<div class="stat ${cls}"><b>${n}</b><span>${l}</span></div>`).join("")}</div>
        <p class="asof">As of ${fmtDate(new Date())}. Counts come from records in RESEARCH DASHBOARD 360.${c.stats?.note ? " " + esc(c.stats.note) : ""}</p>` : "";
    },
    achievement: () => cards(items("achievement"), "award"),
    news: () => cards(items("news"), "megaphone"),
    featured: () => featured.length ? `<div class="card-grid">${featured.map((p) => { const cat = catById(p.category); return `<article class="content-card"><div class="body">
        <span class="cat-badge" style="--c:${cat.color}">${icon(cat.icon)}${esc(cat.short)}</span><h3>${esc(p.title)}</h3>
        <p class="small muted">${esc((p.abstract || "").slice(0, 170))}${(p.abstract || "").length > 170 ? "…" : ""}</p>
        <div class="meta">${esc(db.school(p.school_id)?.name || "")} · ${new Date(p.submitted_at).getFullYear()}</div></div></article>`; }).join("")}</div>` : "",
    social: () => social.length ? `<div class="social-grid">${social.map((s) => { const src = fbEmbed(s.url); return `<article class="social-card">
        <span class="ext-label">${icon("external")}External content · Facebook</span>${s.title ? `<h3 style="font-size:17px">${esc(s.title)}</h3>` : ""}${s.caption ? `<p class="small muted">${esc(s.caption)}</p>` : ""}
        ${src ? `<iframe src="${esc(src)}" loading="lazy" title="${esc(s.title || "Facebook post")}" allow="encrypted-media; picture-in-picture" referrerpolicy="no-referrer-when-downgrade"></iframe>` : ""}
        <div class="row between small muted"><span>${esc(s.source || "Facebook")}${s.date ? " · " + fmtDate(s.date) : ""}</span><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">Open Facebook post ${icon("external")}</a></div>
        <p class="small muted">If the post doesn't appear, your browser or network may block Facebook embeds. Use the link above.</p></article>`; }).join("")}</div>` : "",
    event: () => {
      const ev = items("event").filter((e) => !e.date || new Date(e.date + "T23:59:59") >= new Date()).sort((a, b) => new Date(a.date || "2999") - new Date(b.date || "2999"));
      return ev.length ? `<div class="event-list">${ev.map((e) => { const d = e.date ? new Date(e.date + "T00:00:00") : null; return `<article class="event">
        <div class="date">${d ? `<small>${d.toLocaleString("en-PH", { month: "short" })}</small><b>${d.getDate()}</b>` : "<small>TBA</small>"}</div>
        <div><h3 style="font-size:16px">${esc(e.title)}</h3><p class="small muted">${esc(e.summary || "")}${e.attribution ? ` · ${esc(e.attribution)}` : ""}</p></div>
        ${safeUrl(e.url) ? `<a class="btn btn-ghost btn-sm" href="${esc(safeUrl(e.url))}"${ext(e.url)}>Details</a>` : "<span></span>"}</article>`; }).join("")}</div>` : "";
    },
    resource: () => { const rs = items("resource"); return rs.length ? `<div class="card-grid">${rs.map((r) => `<a class="resource" href="${esc(safeUrl(r.url) || "#")}"${ext(r.url)}><span class="ic">${icon("file")}</span><span><b>${esc(r.title)}</b><br><span class="small muted">${esc(r.summary || "")}</span></span></a>`).join("")}</div>` : ""; },
    contact: () => contactHas || c.contact?.note ? `<div class="contact-card"><div class="stack"><h2>${esc(c.contact.office || "Contact and Help")}</h2><p style="opacity:.75">${esc(c.contact.note || "")}</p>
        <div class="row"><a class="btn btn-gold" href="#/login/teacher">Teacher sign in</a></div></div>
        <dl>${[["address", "Address", "map"], ["email", "Email", "mail"], ["phone", "Phone", "phone"], ["hours", "Office hours", "clock"], ["facebook", "Facebook page", "external"]].filter(([k]) => c.contact[k]).map(([k, l]) => `<div><dt>${l}</dt><dd>${k === "email" ? `<a href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a>` : k === "facebook" && safeUrl(c.contact.facebook) ? `<a href="${esc(safeUrl(c.contact.facebook))}" target="_blank" rel="noopener noreferrer">${esc(c.contact.facebook)}</a>` : esc(c.contact[k])}</dd></div>`).join("")}</dl></div>` : "",
  };
  function cards(list, ic) {
    return list.length ? `<div class="card-grid">${list.map((i) => `<article class="content-card">
      <div class="media">${safeImg(i.image) ? `<img src="${safeImg(i.image)}" alt="${esc(i.alt || "")}" loading="lazy">` : icon(ic)}</div>
      <div class="body"><div class="meta">${i.pinned ? `<span class="pin">Pinned</span>` : ""}<span>${[i.category && esc(i.category), i.date && fmtDate(i.date)].filter(Boolean).join(" · ")}</span></div>
        <h3>${esc(i.title)}</h3>${i.summary ? `<p class="small muted">${esc(i.summary)}</p>` : ""}${i.attribution ? `<p class="small">${esc(i.attribution)}</p>` : ""}
        ${safeUrl(i.url) ? `<a class="small" href="${esc(safeUrl(i.url))}"${ext(i.url)}>Read more ${icon("arrow")}</a>` : ""}</div></article>`).join("")}</div>` : "";
  }

  const rendered = (c.sections || []).filter((s) => s.enabled).map((s) => ({ ...s, html: sectionHtml[s.key]?.() || "" })).filter((s) => s.html);
  const navLinks = rendered.filter((s) => ["carousel", "news", "event", "resource", "contact"].includes(s.key)).slice(0, 4);

  return `<header class="home-header"><div class="inner">
      <a class="brand" href="#/"><img class="brand-logo" src="${LOGO}" alt="Aliaga District seal"><div><b>RESEARCH DASHBOARD 360</b><small>Schools District of Aliaga</small></div></a>
      <nav class="home-nav" aria-label="Page sections">${navLinks.map((s) => `<a href="#sec-${s.key}" data-jump="sec-${s.key}">${{ carousel: "Highlights", news: "News", event: "Events", resource: "Resources", contact: "Contact" }[s.key]}</a>`).join("")}<a href="#/schools">Schools</a></nav>
      <div class="row"><button class="icon-btn" data-theme-toggle aria-label="Switch to ${document.documentElement.dataset.theme === "dark" ? "light" : "dark"} mode">${icon(document.documentElement.dataset.theme === "dark" ? "sun" : "moon")}</button>
      ${user ? `<a class="btn btn-ink btn-sm" href="${user.role === "teacher" ? "#/t/dashboard" : "#/a/dashboard"}">My workspace</a>` : `<a class="btn btn-ink btn-sm" href="#/login/teacher">Sign in</a>`}</div></div></header>
  <main>
    ${setup && !preview ? `<div class="wrap" style="padding-top:12px"><div class="notice warn">${icon("key")}<span><b>First-time setup:</b> no Super Administrator exists yet. <a href="#/setup">Create the Super Administrator account</a> to start using RESEARCH DASHBOARD 360.</span></div></div>` : ""}
    <section class="hero"><div class="aurora" aria-hidden="true"><i></i><i></i><i></i></div><div class="wrap">
      <div class="hero-grid">
        <div class="hero-main">
          <span class="eyebrow"><img src="${LOGO}" alt="">${esc(c.hero.eyebrow)}</span>
          <h1>${(() => { const w = String(c.hero.title || "").trim().split(" "); const last = w.pop(); return `${esc(w.join(" "))} <span class="hl">${esc(last || "")}</span>`; })()}</h1>
          <p class="tagline">${esc(c.hero.tagline)}</p>
          <p class="lead">${esc(c.hero.text)}</p>
          <div class="row"><a class="btn btn-ink" href="#/login/teacher">Teacher / Researcher sign in <span class="arrow-chip">${icon("arrow")}</span></a><a class="btn btn-ghost" href="#/register">Create an account</a></div>
          <span class="hero-deco"></span>
        </div>
        <div class="hero-side">
          <a class="tile big ink" href="#/login/admin"><span class="chip">${icon("shield")}</span><p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase">Restricted</p><h3>Administrator Portal</h3><p>Screening, evaluation, monitoring, analytics and website management for district research staff.</p></a>
          ${CATEGORIES.map((cat, i) => `<a class="tile cat-link ${["t-peach", "t-mint", "t-sky"][i]} ${i === 2 ? "big" : ""}" href="#/category/${cat.id}"><span class="chip" style="color:${cat.color}">${icon(cat.icon)}</span><h3>${esc(cat.name)}</h3><p>${esc(cat.desc)}</p><span class="go-cat" style="color:${cat.color}">Explore ${icon("arrow")}</span></a>`).join("")}
        </div>
      </div>
    </div></section>
    <section class="stats-strip reveal" aria-label="District research at a glance"><div class="wrap"><div class="ss-grid">
      ${[["school", db.schools().filter((s) => s.active).length, "Public schools in the district"], ["folder", stats.total, "Research projects submitted"], ["check_clip", stats.completed, "Completed studies"], ["layers", CATEGORIES.length, "Research categories"]].map(([ic, n, l]) => `<div class="ss-item"><span class="ss-ic">${icon(ic === "layers" ? "grid" : ic)}</span><b data-count="${n}">0</b><span>${l}</span></div>`).join("")}
    </div></div></section>
    <section class="marquee" aria-label="Schools of the district"><div class="mq-track">${[0, 1].map((k) => `<div class="mq-set" ${k ? 'aria-hidden="true"' : ""}>${db.schools().filter((s) => s.active).map((s) => `<a href="#/school/${s.id}" class="mq-chip" ${k ? 'tabindex="-1"' : ""}>${icon(s.type === "Elementary" ? "grad" : "school")}${esc(s.name)}</a>`).join("")}</div>`).join("")}</div></section>
    ${rendered.map((s) => `<section class="section reveal" id="sec-${s.key}"><div class="wrap"><div class="section-head"><div><h2>${esc(s.title)}</h2></div></div>${s.html}</div></section>`).join("")}

    <section class="section reveal"><div class="wrap"><div class="section-head"><div><h2>How it works</h2><p>Four steps from an idea in your classroom to a study the whole district can learn from.</p></div></div>
      <ol class="how">${[
        ["user", "Create your account", "Register with your DepEd email and choose your school. The District Research Coordinator approves it."],
        ["file", "Submit your proposal", "A six-step guide saves as you go and tells you exactly what's still missing."],
        ["check_clip", "Review and approval", "Screening, technical evaluation and revisions, with every decision and comment recorded."],
        ["library", "Implement and share", "Post progress, complete the study and publish it to the district research repository."],
      ].map(([ic, h, p], i) => `<li class="how-step"><span class="how-n">${i + 1}</span><span class="how-ic">${icon(ic)}</span><h3>${h}</h3><p>${p}</p></li>`).join("")}</ol></div></section>
    <section class="section reveal"><div class="wrap"><div class="section-head"><div><h2>From proposal to digital archive</h2><p>Every project follows one clear, traceable workflow. Progress comes from completed stages, never typed-in percentages.</p></div></div>
      <div class="card"><div class="lifecycle">${STAGES.map((s, i) => `<div class="step ${s.cond ? "cond" : ""}"><div class="num">${i + 1}</div><div class="lbl">${esc(s.name)}</div>${s.cond ? '<div class="cond-note">when applicable</div>' : ""}</div>`).join("")}</div></div></div></section>

    <section class="section reveal"><div class="wrap"><div class="cta-band">
      <div><h2>Ready to share your research?</h2><p>Join the teachers and school leaders of Aliaga building an evidence-based district.</p></div>
      <div class="row">${user ? `<a class="btn btn-gold" href="${user.role === "teacher" ? "#/t/submit" : "#/a/dashboard"}">${icon(user.role === "teacher" ? "plus" : "home")}${user.role === "teacher" ? "Submit research" : "Open my workspace"}</a>` : `<a class="btn btn-gold" href="#/register">${icon("user")}Create an account</a><a class="btn btn-ghost-onc" href="#/login/teacher">Sign in</a>`}</div>
    </div></div></section>
  </main>
  <footer class="home-footer"><div class="inner ft-grid">
    <div class="ft-brand"><span class="row" style="gap:10px"><img src="${LOGO}" alt="" width="40" height="40" style="border-radius:50%"><b>RESEARCH DASHBOARD 360</b></span>
      <p>A smart digital research governance, monitoring, analytics and knowledge management system for the Schools District of Aliaga.</p>
      <p class="small">SDO Nueva Ecija · DepEd Region III</p></div>
    <div><h4>Portals</h4><a href="#/login/teacher">Teacher sign in</a><a href="#/register">Create an account</a><a href="#/login/admin">Administrator sign in</a></div>
    <div><h4>Explore</h4><a href="#/schools">School directory</a>${CATEGORIES.map((ct) => `<a href="#/category/${ct.id}">${esc(ct.name)}</a>`).join("")}</div>
    <div><h4>Help</h4>${c.contact?.email ? `<a href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a>` : ""}<span>${esc(c.contact?.office || "District Research Office")}</span><a href="#/guide">User guide for teachers</a><a href="#/privacy">Data Privacy Notice</a><span class="small">Personal data is handled in line with the Data Privacy Act of 2012.</span></div>
  </div><div class="inner ft-base"><span>© ${new Date().getFullYear()} Schools District of Aliaga</span><span>One Platform. One Dashboard. One Research Ecosystem.</span></div></footer>`;
}

export function bindHome(root, rerender) {
  root.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("rd360.theme", next); } catch { /* ignore */ }
    rerender();
  });
  root.querySelectorAll("[data-jump]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); document.getElementById(a.dataset.jump)?.scrollIntoView({ behavior: "smooth" }); }));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const countUp = (el) => {
    const n = Number(el.dataset.count) || 0;
    if (reduce || !n) { el.textContent = n; return; }
    const t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / 1100); el.textContent = Math.round(n * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  const reveals = root.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) { reveals.forEach((r) => r.classList.add("in")); root.querySelectorAll("[data-count]").forEach(countUp); }
  else {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) return; e.target.classList.add("in"); e.target.querySelectorAll("[data-count]").forEach(countUp); io.unobserve(e.target); }), { threshold: 0.15 });
    reveals.forEach((r) => io.observe(r));
    setTimeout(() => reveals.forEach((r) => { if (!r.classList.contains("in")) { r.classList.add("in"); r.querySelectorAll("[data-count]").forEach(countUp); } }), 4000);
  }
  const car = root.querySelector("[data-carousel]");
  if (!car) return;
  const slides = [...car.querySelectorAll(".slide")], dots = [...car.querySelectorAll("[data-dot]")];
  if (slides.length < 2) return;
  let i = 0, timer = null, paused = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pauseBtn = car.querySelector("[data-pause]");
  const show = (n) => { i = (n + slides.length) % slides.length; slides.forEach((s, k) => s.classList.toggle("on", k === i)); dots.forEach((d, k) => d.classList.toggle("on", k === i)); };
  const start = () => { stop(); if (!paused && document.body.contains(car)) timer = setInterval(() => { if (!document.body.contains(car)) return stop(); show(i + 1); }, 6500); };
  const stop = () => { clearInterval(timer); timer = null; };
  const setPaused = (p) => { paused = p; pauseBtn.innerHTML = icon(p ? "play" : "pause"); pauseBtn.setAttribute("aria-label", p ? "Play slideshow" : "Pause slideshow"); p ? stop() : start(); };
  setPaused(paused);
  car.querySelector("[data-prev]").addEventListener("click", () => { show(i - 1); start(); });
  car.querySelector("[data-next]").addEventListener("click", () => { show(i + 1); start(); });
  pauseBtn.addEventListener("click", () => setPaused(!paused));
  dots.forEach((d) => d.addEventListener("click", () => { show(Number(d.dataset.dot)); start(); }));
  car.addEventListener("mouseenter", stop); car.addEventListener("mouseleave", start);
  car.addEventListener("focusin", stop); car.addEventListener("focusout", start);
  car.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") show(i - 1); if (e.key === "ArrowRight") show(i + 1); });
  let x0 = null;
  car.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; stop(); }, { passive: true });
  car.addEventListener("touchend", (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1)); x0 = null; start(); });
}
