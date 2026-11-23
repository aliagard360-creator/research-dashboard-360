// Shared UI helpers: escaping, formatting, toasts, modals, charts, badges.
import { icon } from "./icons.js?v=202611230828";
import { STATUSES, catById, progressOf, isOverdue, passwordScore, passwordProblem } from "./store.js?v=202611230828";

export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—");
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
export function relTime(d) {
  if (!d) return "—";
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  const f = (n, u) => `${Math.floor(n)} ${u}${Math.floor(n) === 1 ? "" : "s"} ago`;
  if (s < 60) return "just now";
  if (s < 3600) return f(s / 60, "minute");
  if (s < 86400) return f(s / 3600, "hour");
  if (s < 86400 * 30) return f(s / 86400, "day");
  return fmtDate(d);
}
export function daysLeft(d) {
  if (!d) return "";
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const n = Math.round((new Date(d).setHours(0, 0, 0, 0) - t) / 86400000);
  if (n < 0) return `${-n} day${n === -1 ? "" : "s"} overdue`;
  if (n === 0) return "due today";
  return `${n} day${n === 1 ? "" : "s"} left`;
}
export const initials = (name = "") => name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && !/^(dr|mr|ms|mrs)\.?$/i.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "RD";
export const avatar = (u, cls = "") => `<span class="avatar ${cls}">${u?.photo ? `<img src="${esc(u.photo)}" alt="">` : esc(initials(u?.name))}</span>`;
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

export const statusBadge = (s) => `<span class="badge s-${STATUSES[s]?.group || "draft"}">${esc(s)}</span>`;
export const catBadge = (id) => { const c = catById(id); return `<span class="cat-badge" style="--c:${c.color}">${icon(c.icon)}${esc(c.short)}</span>`; };
export const progressBar = (p) => { const v = progressOf(p); return v == null ? `<span class="muted small">Closed</span>` : `<div class="row" style="gap:8px;flex-wrap:nowrap"><div class="progress" style="flex:1" role="progressbar" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="100"><i style="width:${v}%"></i></div><span class="small muted">${v}%</span></div>`; };
export const deadlineCell = (p) => (p.deadline ? `<span class="${isOverdue(p) ? "overdue" : ""}">${fmtDate(p.deadline)}<br><span class="small ${isOverdue(p) ? "overdue" : "muted"}">${daysLeft(p.deadline)}</span></span>` : `<span class="muted">—</span>`);

/* ---------------- toasts ---------------- */
export function toast(msg, kind = "ok", action = null) {
  let box = document.querySelector(".toasts");
  if (!box) { box = document.createElement("div"); box.className = "toasts"; box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite"); document.body.append(box); }
  const t = document.createElement("div");
  t.className = `toast ${kind}`;
  t.innerHTML = `${icon(kind === "err" ? "alert" : kind === "warn" ? "clock" : "check")}<span>${esc(msg)}</span>`;
  if (action) {
    const b = document.createElement("button"); b.type = "button"; b.textContent = action.label;
    b.addEventListener("click", () => { action.onClick(); t.remove(); });
    t.append(b);
  }
  box.append(t);
  if (!action?.sticky) setTimeout(() => t.remove(), action ? 9000 : 3800);
  return t;
}

/* Live password strength meter under each new-password field. */
export function attachStrength(root) {
  root.querySelectorAll("form").forEach((form) => {
    const inp = form.querySelector('input[autocomplete="new-password"]');
    if (!inp || inp.dataset.meter) return;
    inp.dataset.meter = "1";
    const m = document.createElement("div");
    m.className = "pw-meter"; m.setAttribute("aria-live", "polite");
    m.innerHTML = `<div class="bars"><i></i><i></i><i></i><i></i></div><span></span>`;
    (inp.closest(".pw-wrap") || inp).insertAdjacentElement("afterend", m);
    const labels = ["Too weak", "Weak", "Fair", "Good", "Strong"];
    const upd = () => {
      const v = inp.value, sc = v ? passwordScore(v) : 0, problem = v ? passwordProblem(v) : null;
      m.dataset.score = v ? sc : "";
      m.querySelector("span").textContent = v ? (problem || labels[sc]) : "";
      m.classList.toggle("bad", !!problem);
    };
    inp.addEventListener("input", upd);
  });
}

/* ---------------- modal ----------------
   fields: [{name, label, type: textarea|select|date|text, options, required, value}] */
export function compressImage(file, maxW = 1400, quality = 0.78) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return reject(new Error("Please choose a JPG, PNG, WEBP or GIF image."));
    if (file.size > 8 * 1024 * 1024) return reject(new Error("The image must be 8 MB or smaller."));
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width), c = document.createElement("canvas");
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That image couldn't be read.")); };
    img.src = url;
  });
}

export function modal({ title, body = "", fields = [], confirm = "Confirm", danger = false, cancel = "Cancel", wide = false }) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop";
    const fieldHtml = fields.map((f) => {
      const id = "mf_" + f.name;
      if (f.type === "checkbox") return `<label class="row small" style="flex-wrap:nowrap;${f.span ? "grid-column:1/-1" : ""}"><input type="checkbox" id="${id}" name="${f.name}" ${f.value ? "checked" : ""}><span>${esc(f.label)}</span></label>`;
      if (f.type === "image") return `<div class="field" style="display:grid;gap:6px;grid-column:1/-1"><span style="font-size:13px;font-weight:600">${esc(f.label)}</span>
        <div class="img-pick"><div class="prev" data-prev="${f.name}">${f.value ? `<img src="${esc(f.value)}" alt="">` : "No image"}</div>
        <div class="stack" style="gap:6px"><label class="btn btn-ghost btn-sm" style="cursor:pointer">${"Choose image"}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden data-img="${f.name}"></label>
        <button type="button" class="btn btn-ghost btn-sm" data-imgclear="${f.name}">Remove image</button></div></div>
        <input type="hidden" name="${f.name}" value="${esc(f.value || "")}"><span class="hint" style="font-size:12px;color:var(--muted)">${esc(f.hint || "Large photos are resized automatically.")}</span></div>`;
      const input = f.type === "textarea"
        ? `<textarea id="${id}" name="${f.name}" ${f.required ? "required" : ""}>${esc(f.value || "")}</textarea>`
        : f.type === "select"
          ? `<select id="${id}" name="${f.name}" ${f.required ? "required" : ""}>${f.options.map((o) => `<option value="${esc(o.value)}" ${o.value === f.value ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`
          : `<input id="${id}" name="${f.name}" type="${f.type || "text"}" value="${esc(f.value || "")}" ${f.required ? "required" : ""}>`;
      return `<label class="field" for="${id}" ${f.span ? 'style="grid-column:1/-1"' : ""}><span class="${f.required ? "req" : ""}">${esc(f.label)}</span>${input}${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ""}</label>`;
    }).join("");
    wrap.innerHTML = `<form class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="mtitle">
      <h3 id="mtitle">${esc(title)}</h3>${body ? `<div class="muted small">${body}</div>` : ""}${wide ? `<div class="grid-2">${fieldHtml}</div>` : fieldHtml}
      <div class="row" style="justify-content:flex-end"><button type="button" class="btn btn-ghost" data-x>${esc(cancel)}</button>
      <button type="submit" class="btn ${danger ? "btn-danger" : "btn-primary"}">${esc(confirm)}</button></div></form>`;
    const close = (v) => { wrap.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
    const onKey = (e) => { if (e.key === "Escape") close(null); };
    document.addEventListener("keydown", onKey);
    wrap.addEventListener("click", (e) => { if (e.target === wrap || e.target.closest("[data-x]")) close(null); });
    wrap.querySelectorAll("[data-img]").forEach((inp) => inp.addEventListener("change", async () => {
      const f = inp.files[0]; if (!f) return;
      try {
        const data = await compressImage(f);
        wrap.querySelector(`input[type=hidden][name="${inp.dataset.img}"]`).value = data;
        wrap.querySelector(`[data-prev="${inp.dataset.img}"]`).innerHTML = `<img src="${data}" alt="">`;
      } catch (err) { toast(err.message, "err"); }
    }));
    wrap.querySelectorAll("[data-imgclear]").forEach((b) => b.addEventListener("click", () => {
      wrap.querySelector(`input[type=hidden][name="${b.dataset.imgclear}"]`).value = "";
      wrap.querySelector(`[data-prev="${b.dataset.imgclear}"]`).textContent = "No image";
    }));
    wrap.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      for (const f of fields) if (f.required && !String(fd.get(f.name) || "").trim()) { toast(`${f.label} is required.`, "err"); wrap.querySelector(`[name="${f.name}"]`)?.focus(); return; }
      const out = Object.fromEntries(fd.entries());
      for (const f of fields) if (f.type === "checkbox") out[f.name] = fd.has(f.name);
      close(out);
    });
    document.body.append(wrap);
    (wrap.querySelector("input:not([type=hidden]):not([type=file]),select,textarea") || wrap.querySelector("button[type=submit]")).focus();
  });
}

/* ---------------- charts (computed from records, click-through) ---------------- */
export function hbar(items, { empty = "No records yet." } = {}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.some((i) => i.value)) return `<p class="muted small">${empty}</p>`;
  return `<div class="hbar">${items.map((i) => `<a href="${i.href || "#"}" title="${esc(i.label)}: ${i.value}">
    <span class="name">${esc(i.label)}</span><span class="track"><span class="fill" style="width:${(i.value / max) * 100}%;--c:${i.color || "var(--electric)"}"></span></span><span class="n">${i.value}</span></a>`).join("")}</div>`;
}
export function donut(items, centerLabel = "Total") {
  const total = items.reduce((a, b) => a + b.value, 0);
  const r = 60, c = 2 * Math.PI * r;
  let off = 0;
  const arcs = total ? items.filter((i) => i.value).map((i) => {
    const len = (i.value / total) * c;
    const s = `<a href="${i.href || "#"}"><circle class="seg-arc" r="${r}" cx="85" cy="85" fill="none" stroke="${i.color}" stroke-width="22" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-off}" transform="rotate(-90 85 85)"><title>${esc(i.label)}: ${i.value}</title></circle></a>`;
    off += len; return s;
  }).join("") : `<circle r="${r}" cx="85" cy="85" fill="none" stroke="var(--border)" stroke-width="22"/>`;
  return `<div class="donut-wrap"><svg viewBox="0 0 170 170" role="img" aria-label="${esc(centerLabel)} ${total}">${arcs}
    <text x="85" y="82" text-anchor="middle" style="font:700 28px var(--display);fill:var(--text)">${total}</text>
    <text x="85" y="104" text-anchor="middle" style="font:600 11px var(--font);fill:var(--muted)">${esc(centerLabel)}</text></svg>
    <div class="legend">${items.map((i) => `<a href="${i.href || "#"}"><i style="background:${i.color}"></i>${esc(i.label)}<b>${i.value}</b></a>`).join("")}</div></div>`;
}
export function trend(points) {
  const W = 560, H = 190, pad = 28;
  const max = Math.max(1, ...points.map((p) => p.value));
  const x = (i) => pad + (i * (W - pad * 2)) / Math.max(1, points.length - 1);
  const y = (v) => H - pad - (v / max) * (H - pad * 2);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${H - pad} L${x(0)},${H - pad} Z`;
  return `<div class="trend"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Submissions per month">
    <defs><linearGradient id="tg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3678F5" stop-opacity=".28"/><stop offset="1" stop-color="#19C9E4" stop-opacity="0"/></linearGradient></defs>
    ${[0, 0.5, 1].map((t) => `<line x1="${pad}" x2="${W - pad}" y1="${y(max * t)}" y2="${y(max * t)}" stroke="var(--border)" stroke-dasharray="3 4"/>`).join("")}
    <path d="${area}" fill="url(#tg)"/><path d="${line}" fill="none" stroke="#3678F5" stroke-width="2.5" stroke-linejoin="round"/>
    ${points.map((p, i) => `<g><circle cx="${x(i)}" cy="${y(p.value)}" r="4.5" fill="var(--surface)" stroke="#3678F5" stroke-width="2.5"><title>${esc(p.label)}: ${p.value} submission(s)</title></circle>
      <text x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(p.label)}</text>${p.value ? `<text x="${x(i)}" y="${y(p.value) - 10}" text-anchor="middle" style="fill:var(--text);font-weight:700">${p.value}</text>` : ""}</g>`).join("")}
  </svg></div>`;
}

export const emptyState = (title, text, action = "") => `<div class="empty"><div class="ic">${icon("inbox")}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;

export function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
