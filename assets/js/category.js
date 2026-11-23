// Immersive, interactive page for each research category (Action Research, IGP, Innovation).
// Shown publicly at #/category/<ID> and inside the portals at #/t/category/<ID> and #/a/category/<ID>.
import { icon } from "./icons.js?v=202611231438";
import { db, CATEGORIES, catById, isOverdue } from "./store.js?v=202611231438";
import { esc, fmtDate, toast } from "./ui.js?v=202611231438";
import { LOGO } from "./shell.js?v=202611231438";
import { projectCard } from "./pages.js?v=202611231438";

/* ---------- content for each category ---------- */
export const CAT_CONTENT = {
  AR: {
    tagline: "Solve a real problem in your own classroom.",
    intro: "Action Research is a cycle: you notice a learning problem, try a planned intervention, gather evidence and reflect on what changed. It's the most common study teachers in the district carry out.",
    who: ["Classroom teachers", "Master teachers", "School heads", "Learning support staff"],
    steps: [
      ["Identify the problem", "Pick one specific, observable problem in your class or school, such as low reading fluency in one section. Gather baseline evidence so you can measure change later."],
      ["Plan the intervention", "Choose a strategy that could solve it, define your participants and instruments, and set your research questions. Plan how you will protect learners' privacy."],
      ["Act", "Carry out the intervention for the planned period. Keep notes and records as you go."],
      ["Observe and measure", "Collect the same evidence as your baseline: test scores, observation checklists, attendance or work samples."],
      ["Reflect and share", "Compare before and after, explain what worked and why, and share the results with your school. A good finding often becomes the next cycle."],
    ],
    needs: ["Statement of the problem", "Research questions", "Research design and participants", "Ethical considerations (consent and assent)", "Proposal manuscript (PDF or Word)"],
    topics: ["Reading fluency", "Numeracy skills", "Learner attendance", "Classroom management", "Formative assessment", "Inclusive education", "Learner well-being", "Science process skills"],
    tool: "cycle",
    example: ["Peer reading sessions and reading fluency of Grade 3 learners", "Many Grade 3 learners read below grade level, and peer reading may help."]
  },
  IGP: {
    tagline: "Turn school resources into support for learners.",
    intro: "An Income Generating Project is a small school enterprise. It uses school resources, skills or space to earn income that goes back into school programs, and it is documented and reported like research.",
    who: ["School heads", "TLE and livelihood teachers", "School finance staff", "Teachers with community partners"],
    steps: [
      ["Find the opportunity", "Look at what the school has (space, equipment, skills) and what the community needs."],
      ["Write the business plan", "Describe the product or service, target buyers, budget, funding source and who manages the money."],
      ["Get approval", "Submit the plan for screening and evaluation. IGPs need a clear budget before approval."],
      ["Operate and keep records", "Run the project and record all income, expenses and stock. Records are your evidence."],
      ["Report and reinvest", "Report results each period and show how income supported school programs."],
    ],
    needs: ["Target beneficiaries", "Funding source", "Budget in pesos", "Implementation plan and participants", "Proposal manuscript (PDF or Word)"],
    topics: ["School garden produce", "Seedling nursery", "Printing and binding", "Food processing", "Handicrafts", "Recycling and upcycling", "Tailoring services", "Hydroponics"],
    tool: "calculator",
    example: ["School seedling nursery for the community", "Selling vegetable seedlings can fund our feeding program supplies."]
  },
  INN: {
    tagline: "Build something new that makes learning better.",
    intro: "An Innovation is a new program, material, tool or practice that improves how learners learn or how schools run. It is designed, piloted, measured and then shared so other schools can adopt it.",
    who: ["Teachers with a new idea", "ICT coordinators", "School heads", "Teams across schools"],
    steps: [
      ["Spot the gap", "Name the problem current practice doesn't solve, and who it affects."],
      ["Design the innovation", "Describe what is new, how it works and what it needs. Keep a first version simple."],
      ["Pilot it", "Try it with a small group first and record what happens."],
      ["Measure results", "Compare against how things were before. Collect evidence that it works."],
      ["Scale and share", "Improve it, document it and help other schools adopt it."],
    ],
    needs: ["Target beneficiaries", "Design of the innovation", "Participants and pilot plan", "How results will be measured", "Proposal manuscript (PDF or Word)"],
    topics: ["Learning apps", "Contextualized materials", "QR learning stations", "Parent partnership programs", "Monitoring tools", "Gamified lessons", "Reading corners", "Learner tracking"],
    tool: "canvas",
    example: ["QR learning stations for Grade 5 numeracy", "QR-coded challenges around the campus can make fractions practice more engaging."]
  },
};

const counts = (list) => ({
  total: list.length,
  active: list.filter((p) => !["Draft", "Completed", "Published", "Archived", "Rejected", "Withdrawn"].includes(p.status)).length,
  done: list.filter((p) => ["Completed", "Published", "Archived"].includes(p.status)).length,
});

/* ---------- page ---------- */
export function categoryPage(portal, user, id) {
  const cat = CATEGORIES.find((c) => c.id === String(id || "").toUpperCase());
  if (!cat) return null;
  const k = CAT_CONTENT[cat.id];
  const isTeacher = user?.role === "teacher" && portal === "t";
  const isAdmin = portal === "a" && ["admin", "superadmin"].includes(user?.role);
  const mine = isTeacher || isAdmin ? db.visibleProjects(user).filter((p) => p.category === cat.id) : [];
  const repo = db.repositoryItems(portal ? user : null).filter((p) => p.category === cat.id);
  const district = db.projects().filter((p) => p.status !== "Draft" && p.category === cat.id);
  const n = isTeacher ? counts(mine) : counts(district);
  const scopeWord = isTeacher ? "Your" : "District";
  const startHref = isTeacher ? `#/t/submit?cat=${cat.id}` : user ? null : "#/login/teacher";
  const prepKey = `rd360.prep.${cat.id}`;
  let prep = [];
  try { prep = JSON.parse(localStorage.getItem(prepKey) || "[]"); } catch { /* ignore */ }

  const switcher = `<nav class="cat-switch" aria-label="Research categories">${CATEGORIES.map((c) => `<a href="${portal ? `#/${portal}/category/${c.id}` : `#/category/${c.id}`}" style="--c:${c.color}" class="${c.id === cat.id ? "on" : ""}" ${c.id === cat.id ? 'aria-current="page"' : ""}>${icon(c.icon)}<span>${esc(c.name)}</span></a>`).join("")}</nav>`;

  const tool = {
    cycle: `<section class="reveal cat-panel"><div class="cat-panel-head"><h2>The action research cycle</h2><p class="muted">Tap a stage. The cycle repeats: what you learn becomes the next problem to solve.</p></div>
      <div class="cycle-wrap"><svg class="cycle" viewBox="0 0 300 300" role="img" aria-label="Action research cycle: plan, act, observe, reflect">
        <circle cx="150" cy="150" r="104" fill="none" stroke="var(--c)" stroke-opacity=".25" stroke-width="14"/>
        <circle class="cycle-run" cx="150" cy="150" r="104" fill="none" stroke="var(--c)" stroke-width="14" stroke-linecap="round" stroke-dasharray="120 534"/>
        ${[["Plan", 150, 46], ["Act", 254, 150], ["Observe", 150, 254], ["Reflect", 46, 150]].map(([l, x, y], i) => `<g class="cycle-node" data-cyc="${i}" tabindex="0" role="button" aria-label="${l}"><circle cx="${x}" cy="${y}" r="34" fill="var(--surface)" stroke="var(--c)" stroke-width="3"/><text x="${x}" y="${y + 5}" text-anchor="middle" font-size="14" font-weight="600" fill="var(--text)">${l}</text></g>`).join("")}
        <text x="150" y="146" text-anchor="middle" font-size="12" fill="var(--muted)">Evidence</text><text x="150" y="164" text-anchor="middle" font-size="12" fill="var(--muted)">drives change</text>
      </svg><div class="cycle-info" data-cycinfo aria-live="polite"></div></div></section>`,
    calculator: `<section class="reveal cat-panel"><div class="cat-panel-head"><h2>Break-even planner</h2><p class="muted">A quick planning estimate for your business plan. It isn't saved and isn't part of your submission.</p></div>
      <form class="calc" data-calc>
        <label class="field">Starting capital (₱)<input type="number" min="0" step="100" name="cap" value="15000"></label>
        <label class="field">Expected monthly sales (₱)<input type="number" min="0" step="100" name="sales" value="6000"></label>
        <label class="field">Monthly costs (₱)<input type="number" min="0" step="100" name="cost" value="3500"></label>
      </form>
      <div class="calc-out" data-calcout aria-live="polite"></div></section>`,
    canvas: `<section class="reveal cat-panel"><div class="cat-panel-head"><h2>Innovation canvas</h2><p class="muted">Sketch your idea in four boxes. Fill all four to see how ready it is.</p></div>
      <form class="canvas" data-canvas>${[["gap", "The gap", "What isn't working now, and for whom?"], ["idea", "Your idea", "What is new, and how does it work?"], ["pilot", "Pilot", "Where and with whom will you try it first?"], ["measure", "Proof", "What evidence will show it works?"]].map(([nm, l, ph]) => `<label class="canvas-box"><b>${l}</b><textarea name="${nm}" placeholder="${ph}"></textarea></label>`).join("")}</form>
      <div class="meter" aria-hidden="true"><i data-meter></i></div><p class="small muted" data-meterlbl>0 of 4 boxes filled</p></section>`,
  }[k.tool];

  const projectList = isTeacher || isAdmin
    ? (mine.length ? `<div class="proj-grid">${mine.slice(0, 6).map((p) => projectCard(p, portal)).join("")}</div>${mine.length > 6 ? `<p class="small"><a href="${isTeacher ? "#/t/projects" : "#/a/research"}?cat=${cat.id}">See all ${mine.length} projects</a></p>` : ""}`
      : `<div class="empty"><div class="ic" style="background:color-mix(in srgb, var(--c) 14%, transparent);color:var(--c)">${icon(cat.icon)}</div><h3>${isTeacher ? `Start your first ${esc(cat.name)}` : `No ${esc(cat.name)} submissions yet`}</h3><p>${isTeacher ? "Use the idea starter above or open the submission wizard." : "Submitted projects in this category will appear here."}</p>${isTeacher ? `<a class="btn btn-cat" href="${startHref}">${icon("plus")}Start a submission</a>` : ""}</div>`)
    : (repo.length ? `<div class="card-grid">${repo.slice(0, 6).map((p) => `<article class="content-card"><div class="body"><h3>${esc(p.title)}</h3><p class="small muted">${esc((p.abstract || "").slice(0, 160))}</p><div class="meta">${esc(db.school(p.school_id)?.name || "")} · ${new Date(p.submitted_at).getFullYear()}</div></div></article>`).join("")}</div>`
      : `<p class="muted">Completed ${esc(cat.name)} studies approved for public viewing will appear here.</p>`);

  const html = `<div class="cat-page" style="--c:${cat.color}">
    ${switcher}
    <section class="cat-hero">
      <div class="cat-hero-txt">
        <span class="cat-kicker">${icon(cat.icon)} Research category</span>
        <h1>${esc(cat.name)}</h1>
        <p class="cat-tag">${esc(k.tagline)}</p>
        <p class="cat-intro">${esc(k.intro)}</p>
        <div class="row">${startHref ? `<a class="btn btn-onc" href="${startHref}">${icon("plus")}${isTeacher ? `Start ${esc(cat.short)} submission` : "Sign in to submit"}</a>` : ""}<a class="btn btn-ghost-onc" href="#cat-steps" data-jump="cat-steps">How it works ${icon("down")}</a></div>
      </div>
      <div class="cat-orb" aria-hidden="true"><span class="ring r1"></span><span class="ring r2"></span><span class="dot d1"></span><span class="dot d2"></span><span class="dot d3"></span><span class="core">${icon(cat.icon)}</span></div>
      <div class="cat-stats">
        <div><b data-count="${n.total}">0</b><span>${scopeWord} ${isTeacher ? "projects" : "submissions"}</span></div>
        <div><b data-count="${n.active}">0</b><span>In progress</span></div>
        <div><b data-count="${n.done}">0</b><span>Completed</span></div>
      </div>
    </section>

    <section class="reveal cat-panel" id="cat-steps"><div class="cat-panel-head"><h2>How an ${esc(cat.name)} moves forward</h2><p class="muted">Five stages. Use the arrows or tap a stage.</p></div>
      <div class="stepper" data-stepper>
        <div class="step-track"><i data-steptrack></i></div>
        <div class="step-dots">${k.steps.map((s, i) => `<button type="button" data-step="${i}" aria-label="Stage ${i + 1}: ${esc(s[0])}"><span>${i + 1}</span><em>${esc(s[0])}</em></button>`).join("")}</div>
        <div class="step-card" aria-live="polite"><h3 data-steph></h3><p data-stepp></p>
          <div class="row"><button type="button" class="btn btn-ghost btn-sm" data-stepprev>${icon("left")}Back</button><button type="button" class="btn btn-cat btn-sm" data-stepnext>Next${icon("chevron")}</button></div></div>
      </div></section>

    ${tool}

    <div class="cat-two">
      <section class="reveal cat-panel"><div class="cat-panel-head"><h2>Get ready</h2><p class="muted">What the submission wizard will ask for. Tick items as you prepare them; ticks stay in this browser.</p></div>
        <div class="prep" data-prep>${k.needs.map((t, i) => `<label class="prep-item ${prep.includes(i) ? "on" : ""}"><input type="checkbox" data-prepi="${i}" ${prep.includes(i) ? "checked" : ""}><span>${esc(t)}</span></label>`).join("")}</div>
        <div class="meter" aria-hidden="true"><i data-prepbar style="width:${Math.round((prep.length / k.needs.length) * 100)}%"></i></div>
        <p class="small muted" data-preplbl>${prep.length} of ${k.needs.length} ready</p></section>
      <section class="reveal cat-panel"><div class="cat-panel-head"><h2>Who it's for</h2></div>
        <ul class="who">${k.who.map((w) => `<li>${icon("user")}${esc(w)}</li>`).join("")}</ul>
        <div class="cat-panel-head" style="margin-top:18px"><h2>Topic ideas</h2><p class="muted">Tap a topic to use it in the idea starter.</p></div>
        <div class="topics">${k.topics.map((t) => `<button type="button" class="topic" data-topic="${esc(t)}">${esc(t)}</button>`).join("")}</div></section>
    </div>

    <section class="reveal cat-panel cat-starter"><div class="cat-panel-head"><h2>Idea starter</h2><p class="muted">Write a working title and one sentence about your idea.${isTeacher ? " We'll carry it into a new submission." : ""}</p></div>
      <form class="grid-2" data-starter>
        <label class="field span-2">Working title<input name="title" maxlength="200" placeholder="${esc(k.example[0])}"></label>
        <label class="field span-2">The problem or idea in one sentence<textarea name="idea" rows="3" maxlength="600" placeholder="${esc(k.example[1])}"></textarea></label>
        <div class="row span-2">${isTeacher ? `<button class="btn btn-cat">${icon("send")}Start submission with this</button>` : user ? `<span class="small muted">Only teacher accounts can start submissions.</span>` : `<a class="btn btn-cat" href="#/login/teacher">Sign in to continue</a>`}</div>
      </form></section>

    <section class="reveal cat-panel"><div class="cat-panel-head"><h2>Not sure this is the right category?</h2><p class="muted">Answer one question.</p></div>
      <div class="quiz"><p><b>What is your project mainly about?</b></p><div class="row">
        <button type="button" class="btn btn-ghost" data-quiz="AR">Solving a learning problem in my class</button>
        <button type="button" class="btn btn-ghost" data-quiz="IGP">Earning income for school programs</button>
        <button type="button" class="btn btn-ghost" data-quiz="INN">Creating a new tool or program</button></div><p class="quiz-out" data-quizout aria-live="polite"></p></div></section>

    <section class="reveal cat-panel"><div class="cat-panel-head"><h2>${isTeacher ? `Your ${esc(cat.name)} projects` : isAdmin ? `District ${esc(cat.name)} projects` : `Completed ${esc(cat.name)} studies`}</h2></div>${projectList}</section>
  </div>`;

  return {
    title: cat.name,
    crumbs: [["Research categories", portal ? `#/${portal}/category/${cat.id}` : "#/"]],
    html,
    bind(root) { bindCategory(root, cat, k, portal, isTeacher, prepKey); },
  };
}

/* ---------- public wrapper (no portal shell) ---------- */
export function publicCategoryHtml(user, page) {
  return `<header class="home-header"><div class="inner">
      <a class="brand" href="#/"><img class="brand-logo" src="${LOGO}" alt="Aliaga District seal"><div><b>RESEARCH DASHBOARD 360</b><small>Schools District of Aliaga</small></div></a>
      <div class="row"><a class="btn btn-ghost btn-sm" href="#/">${icon("left")}Home</a>${user ? `<a class="btn btn-ink btn-sm" href="${user.role === "teacher" ? "#/t/dashboard" : "#/a/dashboard"}">My workspace</a>` : `<a class="btn btn-ink btn-sm" href="#/login/teacher">Sign in</a>`}</div></div></header>
    <main class="wrap" style="padding-top:12px;padding-bottom:40px">${page.html}</main>`;
}

/* ---------- interactions ---------- */
function bindCategory(root, cat, k, portal, isTeacher, prepKey) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.querySelectorAll("[data-jump]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); root.querySelector("#" + a.dataset.jump)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); }));

  // count-up numbers and scroll reveal
  const countUp = (el) => {
    const target = Number(el.dataset.count) || 0;
    if (reduce || !target) { el.textContent = target; return; }
    const t0 = performance.now();
    const tick = (t) => { const p = Math.min(1, (t - t0) / 900); el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  };
  root.querySelectorAll("[data-count]").forEach(countUp);
  const reveals = root.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) reveals.forEach((r) => r.classList.add("in"));
  else {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
    reveals.forEach((r) => io.observe(r));
    setTimeout(() => reveals.forEach((r) => r.classList.add("in")), 4000); // never leave a section hidden
  }

  // stepper
  const st = root.querySelector("[data-stepper]");
  let si = 0;
  const showStep = (i) => {
    si = Math.max(0, Math.min(k.steps.length - 1, i));
    st.querySelector("[data-steph]").textContent = `${si + 1}. ${k.steps[si][0]}`;
    st.querySelector("[data-stepp]").textContent = k.steps[si][1];
    st.querySelectorAll("[data-step]").forEach((b, j) => { b.classList.toggle("on", j === si); b.classList.toggle("done", j < si); b.setAttribute("aria-pressed", j === si); });
    st.querySelector("[data-steptrack]").style.width = `${(si / (k.steps.length - 1)) * 100}%`;
    st.querySelector("[data-stepprev]").disabled = si === 0;
    const nx = st.querySelector("[data-stepnext]");
    nx.innerHTML = si === k.steps.length - 1 ? `Start over${icon("history")}` : `Next${icon("chevron")}`;
  };
  st.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => showStep(Number(b.dataset.step))));
  st.querySelector("[data-stepprev]").addEventListener("click", () => showStep(si - 1));
  st.querySelector("[data-stepnext]").addEventListener("click", () => showStep(si === k.steps.length - 1 ? 0 : si + 1));
  st.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") showStep(si + 1); if (e.key === "ArrowLeft") showStep(si - 1); });
  showStep(0);

  // action research cycle
  const info = root.querySelector("[data-cycinfo]");
  if (info) {
    const text = [["Plan", "Define the problem, your intervention, participants and how you'll measure change."], ["Act", "Carry out the intervention as planned and keep records."], ["Observe", "Collect evidence the same way as your baseline."], ["Reflect", "Compare results, explain what changed, and decide the next cycle."]];
    const nodes = root.querySelectorAll("[data-cyc]");
    const pick = (i) => { nodes.forEach((n, j) => n.classList.toggle("on", j === i)); info.innerHTML = `<h3>${text[i][0]}</h3><p>${text[i][1]}</p>`; root.querySelector(".cycle-run").style.strokeDashoffset = String(-163.4 * i + 60); };
    nodes.forEach((n, i) => { n.addEventListener("click", () => pick(i)); n.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(i); } }); });
    pick(0);
  }

  // IGP break-even calculator
  const calc = root.querySelector("[data-calc]");
  if (calc) {
    const out = root.querySelector("[data-calcout]");
    const peso = (v) => "₱" + Math.round(v).toLocaleString("en-PH");
    const run = () => {
      const cap = Math.max(0, Number(calc.cap.value) || 0), sales = Math.max(0, Number(calc.sales.value) || 0), cost = Math.max(0, Number(calc.cost.value) || 0);
      const net = sales - cost;
      if (net <= 0) { out.innerHTML = `<div class="calc-big warn"><b>No break-even</b><span>Monthly costs are equal to or higher than sales (net ${peso(net)} a month). Lower costs or raise sales.</span></div>`; return; }
      const months = cap / net, year = net * 12 - cap;
      out.innerHTML = `<div class="calc-big"><b>${months < 1 ? "Under 1" : months.toFixed(1)}</b><span>months to recover the capital</span></div>
        <div class="calc-row"><div><b>${peso(net)}</b><span>net income a month</span></div><div><b>${peso(year)}</b><span>${year >= 0 ? "left after one year" : "still to recover after one year"}</span></div></div>
        <div class="meter" title="Share of the first year needed to recover the capital"><i style="width:${Math.min(100, (months / 12) * 100)}%"></i></div>`;
    };
    calc.addEventListener("input", run); run();
  }

  // innovation canvas readiness
  const canvas = root.querySelector("[data-canvas]");
  if (canvas) {
    const bar = root.querySelector("[data-meter]"), lbl = root.querySelector("[data-meterlbl]");
    const run = () => { const n = [...canvas.querySelectorAll("textarea")].filter((t) => t.value.trim().length > 10).length; bar.style.width = `${n * 25}%`; lbl.textContent = n === 4 ? "All four boxes filled. Your idea is ready to write up." : `${n} of 4 boxes filled`; };
    canvas.addEventListener("input", run);
  }

  // preparation checklist
  root.querySelectorAll("[data-prepi]").forEach((cb) => cb.addEventListener("change", () => {
    const on = [...root.querySelectorAll("[data-prepi]")].filter((c) => c.checked).map((c) => Number(c.dataset.prepi));
    try { localStorage.setItem(prepKey, JSON.stringify(on)); } catch { /* ignore */ }
    cb.closest(".prep-item").classList.toggle("on", cb.checked);
    root.querySelector("[data-prepbar]").style.width = `${Math.round((on.length / k.needs.length) * 100)}%`;
    root.querySelector("[data-preplbl]").textContent = on.length === k.needs.length ? "Everything is ready. You can start your submission." : `${on.length} of ${k.needs.length} ready`;
  }));

  // topic chips fill the idea starter
  const starter = root.querySelector("[data-starter]");
  root.querySelectorAll("[data-topic]").forEach((b) => b.addEventListener("click", () => {
    starter.title.value = starter.title.value || `${b.dataset.topic}: `;
    starter.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    starter.title.focus();
  }));
  starter.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!isTeacher) return;
    const title = starter.title.value.trim(), idea = starter.idea.value.trim();
    if (!title) { toast("Add a working title first.", "err"); starter.title.focus(); return; }
    try { sessionStorage.setItem("rd360.starter", JSON.stringify({ category: cat.id, title, idea })); } catch { /* ignore */ }
    location.hash = `#/t/submit?cat=${cat.id}`;
  });

  // one-question quiz
  const qo = root.querySelector("[data-quizout]");
  root.querySelectorAll("[data-quiz]").forEach((b) => b.addEventListener("click", () => {
    const c = catById(b.dataset.quiz);
    const href = portal ? `#/${portal}/category/${c.id}` : `#/category/${c.id}`;
    qo.innerHTML = c.id === cat.id ? `${icon("check")} You're in the right place: <b>${esc(c.name)}</b>.` : `${icon("arrow")} That sounds like <a href="${href}" style="color:${c.color};font-weight:700">${esc(c.name)}</a>. Open its page.`;
  }));
}
