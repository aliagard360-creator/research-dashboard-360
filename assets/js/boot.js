// Runs before the app: frame protection, theme, and a safety net for the loading screen.
// Kept in a file (not inline) so the Content Security Policy can forbid inline scripts.
(function () {
  // Refuse to run inside another website's frame (clickjacking). Our own draft preview is same-origin, so it's allowed.
  if (window.self !== window.top) {
    var sameOrigin = false;
    try { sameOrigin = window.top.location.origin === window.location.origin; } catch (e) { sameOrigin = false; }
    if (!sameOrigin) {
      // Browsers block a framed page from navigating its parent, so hide everything instead.
      document.documentElement.style.display = "none";
      window.__rd360Framed = true;
      return;
    }
  }

  // Apply the saved or device theme before anything paints.
  try {
    var t = localStorage.getItem("rd360.theme");
    document.documentElement.dataset.theme = t || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  } catch (e) { /* storage blocked */ }

  // Rotating status lines on the loader (stops as soon as the app shows or reports a problem).
  window.addEventListener("DOMContentLoaded", function () {
    var lines = ["Preparing your research workspace…", "Gathering district research…", "Loading the 29 schools of Aliaga…", "Almost ready…"], i = 0;
    var msg = document.getElementById("splash-msg");
    var t = setInterval(function () {
      var s = document.getElementById("splash");
      if (!s || s.classList.contains("done") || !msg || msg.dataset.fixed || msg.querySelector("button")) return clearInterval(t);
      if (/database/.test(msg.textContent)) return; // connected mode shows its own status
      i = (i + 1) % lines.length; msg.textContent = lines[i];
    }, 1500);
  });
  // Never leave visitors on an endless loader.
  window.addEventListener("DOMContentLoaded", function () {
    setTimeout(function () {
      var s = document.getElementById("splash");
      var msg = document.getElementById("splash-msg");
      if (s && msg && !s.classList.contains("done")) {
        msg.textContent = "The workspace is taking longer than expected. ";
        var b = document.createElement("button");
        b.type = "button"; b.className = "btn btn-ghost btn-sm"; b.textContent = "Try again";
        b.addEventListener("click", function () { location.reload(); });
        msg.appendChild(b);
      }
    }, 8000);
  });
})();
