// App-wide usability helpers: keyboard shortcuts, focus on navigation, offline notice, back-to-top.
import { icon } from "./icons.js?v=202611231438";
import { modal } from "./ui.js?v=202611231438";

const typing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

export function installUx(getUser) {
  // keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || typing(document.activeElement) || document.querySelector(".modal-backdrop")) return;
    const portal = (location.hash.match(/^#\/(t|a)\//) || [])[1];
    if (e.key === "/") {
      const s = document.getElementById("gsearch");
      if (s && s.offsetParent) { e.preventDefault(); s.focus(); }
    } else if (e.key === "?") {
      e.preventDefault(); showShortcuts(portal);
    } else if (e.key.toLowerCase() === "n" && portal === "t") {
      location.hash = "#/t/submit";
    } else if (e.key.toLowerCase() === "h" && portal) {
      const u = getUser(); if (u) location.hash = portal === "t" ? "#/t/dashboard" : u.role === "evaluator" ? "#/a/evaluation" : "#/a/dashboard";
    }
  });

  // offline notice
  const net = document.createElement("div");
  net.className = "net-banner"; net.setAttribute("role", "status");
  net.innerHTML = `${icon("alert")}<span>You're offline. Your work is still saved in this browser; fonts and Facebook posts may not load.</span>`;
  document.body.append(net);
  const syncNet = () => net.classList.toggle("on", !navigator.onLine);
  window.addEventListener("online", syncNet); window.addEventListener("offline", syncNet); syncNet();

  // back to top
  const top = document.createElement("button");
  top.type = "button"; top.className = "to-top"; top.setAttribute("aria-label", "Back to top"); top.innerHTML = icon("up");
  top.addEventListener("click", () => window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
  document.body.append(top);
  let raf = 0;
  window.addEventListener("scroll", () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; top.classList.toggle("on", window.scrollY > 700); }); }, { passive: true });
}

// After a page change: fade the content in and move keyboard/screen-reader focus to the page title.
export function afterNavigate(app, firstRender) {
  const main = app.querySelector("#content") || app.querySelector("main");
  if (main) { main.classList.remove("page-in"); void main.offsetWidth; main.classList.add("page-in"); }
  if (firstRender) return;
  // The old page was replaced, so focus would otherwise fall back to the top of the document.
  const h = app.querySelector(".topbar h1") || app.querySelector("main h1") || app.querySelector("h1");
  if (h && (document.activeElement === document.body || !document.activeElement)) {
    h.setAttribute("tabindex", "-1");
    h.focus({ preventScroll: true });
  }
}

function showShortcuts(portal) {
  const rows = [["/", "Search research"], ["?", "Show this list"], ["H", "Go to your dashboard"], ...(portal === "t" ? [["N", "Start a new submission"]] : []), ["Esc", "Close a dialog or menu"]];
  modal({
    title: "Keyboard shortcuts",
    body: `<div class="kbd-list">${rows.map(([k, l]) => `<div><kbd>${k}</kbd><span>${l}</span></div>`).join("")}</div>`,
    confirm: "Got it", cancel: "Close",
  });
}
