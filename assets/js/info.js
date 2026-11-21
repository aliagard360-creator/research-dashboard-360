// Public information pages: Data Privacy Notice (#/privacy) and the Teacher User Guide (#/guide).
import { icon } from "./icons.js";
import { esc } from "./ui.js";
import { CONFIG } from "./config.js";

const UPDATED = "November 21, 2026";
const OFFICE = "District Research Office, Schools District of Aliaga";
const mail = () => `<a href="mailto:${esc(CONFIG.SUPERADMIN_EMAIL)}">${esc(CONFIG.SUPERADMIN_EMAIL)}</a>`;
const toc = (items) => `<nav class="info-toc card" aria-label="On this page"><b>On this page</b>${items.map(([id, t]) => `<a href="#" data-goto="${id}">${esc(t)}</a>`).join("")}</nav>`;
const sec = (id, n, title, body) => `<section class="info-sec card" id="${id}"><h2><span class="info-n">${n}</span>${esc(title)}</h2>${body}</section>`;
const bindToc = (root) => root.querySelectorAll("[data-goto]").forEach((a) => a.addEventListener("click", (e) => {
  e.preventDefault(); root.querySelector(`#${a.dataset.goto}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}));
const hero = (kicker, title, lead, ic) => `<section class="info-hero"><span class="info-ic">${icon(ic)}</span><div><span class="pf-kicker">${esc(kicker)}</span><h1>${esc(title)}</h1><p>${lead}</p><small class="muted">Last updated ${UPDATED}</small></div></section>`;

/* ======================= Data Privacy Notice ======================= */
export function privacyPage() {
  const parts = [
    ["who", "Who we are"], ["what", "What we collect"], ["why", "Why we collect it"], ["who-sees", "Who can see it"],
    ["where", "Where it is stored"], ["keep", "How long we keep it"], ["protect", "How we protect it"],
    ["cookies", "Browser storage and outside services"], ["rights", "Your rights"], ["contact", "Contact us"],
  ];
  const html = `<div class="info">
    ${hero("Republic Act No. 10173", "Data Privacy Notice", "How RESEARCH DASHBOARD 360 collects, uses and protects your personal information, in line with the <b>Data Privacy Act of 2012</b> and the rules of the National Privacy Commission.", "shield")}
    <div class="info-layout">${toc(parts)}<div class="info-body">
    ${sec("who", 1, "Who we are", `<p>RESEARCH DASHBOARD 360 is the research management system of the <b>${esc(CONFIG.DISTRICT)}</b>, ${esc(CONFIG.DIVISION)}, ${esc(CONFIG.REGION)}. The ${esc(OFFICE)} is responsible for the personal information processed in this system.</p>`)}
    ${sec("what", 2, "What we collect", `<ul class="info-list">
      <li><b>Account details:</b> full name, email address, position or designation, school, and your password (stored only in scrambled, one-way form; no one can read it, including administrators).</li>
      <li><b>Profile details you choose to add:</b> profile photo, short bio and research interests.</li>
      <li><b>Research records:</b> titles, abstracts, methods, co-researchers, budgets, attached proposal files, evaluation feedback and status history.</li>
      <li><b>Security records:</b> sign-in times, the type of device and browser used (for example "Chrome on Windows"), and a log of important actions such as approvals and status changes.</li>
    </ul><p class="muted small">We do not ask for government ID numbers, bank details or other sensitive personal information. Please do not upload files that contain learners' names, grades or other personal data of participants unless your approved research design requires it and consent was obtained.</p>`)}
    ${sec("why", 3, "Why we collect it", `<ul class="info-list">
      <li>To create and verify your account and confirm you belong to a school in the district.</li>
      <li>To receive, screen, evaluate, approve, monitor and archive research, as part of the district's research management.</li>
      <li>To send you notices about your account and your research (for example, approval or revision requests).</li>
      <li>To prepare district reports and statistics. Reports use counts and summaries, not your personal details.</li>
      <li>To keep the system secure and to investigate misuse.</li>
    </ul><p>We process this information because it is needed for the district's public function of managing research, and, for optional details such as your photo and bio, because you chose to provide them.</p>`)}
    ${sec("who-sees", 4, "Who can see it", `<div class="info-grid">
      <div><b>${icon("user")}You</b><span>Everything in your own account and research.</span></div>
      <div><b>${icon("shield")}District administrators</b><span>Account details and submitted research, to approve accounts and manage the research process.</span></div>
      <div><b>${icon("check")}Evaluators</b><span>Only the research assigned to them for evaluation.</span></div>
      <div><b>${icon("school")}Other teachers</b><span>Your name, school and completed research shared within the district. Never your drafts or research under review.</span></div>
      <div><b>${icon("globe")}The public</b><span>Only completed studies an administrator marks <b>Public</b>: title, abstract, author, school and year. Never your email or files.</span></div>
    </div><p>We do not sell, rent or share your personal information with anyone outside DepEd, except when the law requires it.</p>`)}
    ${sec("where", 5, "Where it is stored", `<p>Your information is stored in a secured database run by <b>Supabase</b>, on servers in <b>Singapore</b>. The website itself is published through <b>GitHub Pages</b>, which holds only the website's program files and no personal information. Both services are bound by their own security and privacy commitments.</p>`)}
    ${sec("keep", 6, "How long we keep it", `<ul class="info-list">
      <li><b>Accounts</b> stay while you are an active member of the district. If you transfer, retire or ask us to close your account, it is deactivated.</li>
      <li><b>Completed research</b> is kept as part of the district's research records, following DepEd records rules, because it forms part of the district's knowledge base.</li>
      <li><b>Registrations that are never approved</b> and unused drafts may be deleted during regular clean-up.</li>
      <li>When information is no longer needed, it is deleted or made anonymous.</li>
    </ul>`)}
    ${sec("protect", 7, "How we protect it", `<ul class="info-list">
      <li>Every connection is encrypted (HTTPS).</li>
      <li>Database rules decide what each role can see, so a person cannot open records that are not theirs, even by changing the web address.</li>
      <li>New accounts need administrator approval, and repeated wrong passwords lock sign-in for a while.</li>
      <li>You are signed out automatically after a period without activity, and you can sign out other devices from <b>Settings → Security</b>.</li>
      <li>Proposal files are private and open only through short-lived links for people allowed to see them.</li>
      <li>Important actions are recorded in an audit log.</li>
    </ul><p class="muted small">If we learn of a personal data breach that may harm you, we will inform you and the National Privacy Commission as the law requires.</p>`)}
    ${sec("cookies", 8, "Browser storage and outside services", `<p>The website saves a few small items in your browser to keep you signed in and to remember choices such as light or dark mode. We do not use advertising or tracking cookies, and we do not use analytics services.</p>
      <p>The website loads its fonts from Google Fonts. If an administrator shows a Facebook post on the home page, Facebook may set its own cookies when that post is displayed; those are covered by Facebook's privacy policy.</p>`)}
    ${sec("rights", 9, "Your rights", `<p>Under the Data Privacy Act, you have the right to:</p>
      <div class="info-chips">${["Be informed", "Access your data", "Correct your data", "Object to processing", "Have data erased or blocked", "Data portability", "Claim damages", "File a complaint"].map((r) => `<span>${icon("check")}${esc(r)}</span>`).join("")}</div>
      <p>You can view and correct most of your details yourself in <b>My Profile</b>. Changes to your name, position, school or photo are checked by an administrator first, to keep district records accurate. For anything else, contact us below. If you believe your rights were violated, you may also file a complaint with the <b>National Privacy Commission</b> (privacy.gov.ph).</p>`)}
    ${sec("contact", 10, "Contact us", `<div class="info-contact">${icon("mail")}<div><b>${esc(OFFICE)}</b><span>${esc(CONFIG.DIVISION)}</span><span>Email: ${mail()}</span></div></div>
      <p class="muted small">We may update this notice when the system changes. The date at the top shows the latest version.</p>`)}
    </div></div></div>`;
  return { title: "Data Privacy Notice", html, bind: bindToc };
}

/* ======================= Teacher User Guide ======================= */
const steps = (list) => `<ol class="info-steps">${list.map((s) => `<li>${s}</li>`).join("")}</ol>`;
const tip = (t) => `<div class="notice">${icon("bulb")}<span>${t}</span></div>`;

export function guidePage(user) {
  const parts = [
    ["start", "Create your account"], ["approval", "Wait for approval"], ["signin", "Sign in"], ["profile", "Set up your profile"],
    ["submit", "Submit your research"], ["track", "Track your research"], ["revise", "Answer a revision"], ["after", "After approval"],
    ["password", "Password and security"], ["faq", "Common questions"],
  ];
  const html = `<div class="info">
    ${hero("For teachers and researchers", "User Guide", "Everything you need to register, submit your research and follow it until it is completed. It takes about 10 minutes to read.", "help")}
    <div class="info-quick">${[["user", "Register", "start"], ["check", "Get approved", "approval"], ["send", "Submit research", "submit"], ["activity", "Track it", "track"]].map(([ic, t, id], i) => `<a href="#" data-goto="${id}" class="info-q"><span>${i + 1}</span>${icon(ic)}<b>${t}</b></a>`).join("")}</div>
    <div class="info-layout">${toc(parts)}<div class="info-body">
    ${sec("start", 1, "Create your account", steps([
      `On the home page, click <b>Create an account</b>.`,
      `Type your full name, your position, and your <b>email address</b> (your DepEd email is best).`,
      `Choose your <b>school</b> from the list. If your school is missing, use <b>My school isn't listed</b> and type its name and School ID; an administrator will add it.`,
      `Make a strong password: at least 8 characters with letters and numbers. Don't use your name or email in it.`,
      `Tick the Data Privacy agreement and click <b>Create account</b>.`,
      `Open your email and click the <b>confirmation link</b>. Check your Spam folder if you don't see it after a few minutes.`,
    ]) + tip(`Use an email you can open anytime. You'll need it to confirm your account and to reset a forgotten password.`))}
    ${sec("approval", 2, "Wait for approval", `<p>An administrator checks that you belong to the school you chose, then approves your account. Until then, signing in shows a <b>Waiting for approval</b> page with your details.</p>` +
      tip(`If your registration is <b>returned</b>, the page tells you why. Fix the details and click <b>Resubmit for approval</b>.`))}
    ${sec("signin", 3, "Sign in", steps([
      `On the home page, click <b>Teacher / Researcher sign in</b>.`,
      `Enter your email and password.`,
      `You'll see your <b>Dashboard</b>: your research, what needs your action, and upcoming deadlines.`,
    ]) + `<p class="muted small">For your safety, you're signed out automatically after some time without activity. After 5 wrong passwords, sign-in is paused for 10 minutes.</p>`)}
    ${sec("profile", 4, "Set up your profile", steps([
      `Click your name or photo, then <b>My Profile</b>.`,
      `Add a short <b>bio</b> and your <b>research interests</b>. These save right away.`,
      `Changing your <b>name, position, school or photo</b> sends a request to an administrator. The change appears after it is approved.`,
    ]))}
    ${sec("submit", 5, "Submit your research", `<p>Click <b>Submit New Research</b>. The form has six short steps, and your <b>draft saves automatically</b>, so you can stop and continue later.</p>
      <div class="info-wizard">${[["Project identity", "Category, title, school year and co-researchers."], ["Research details", "Background, problem and objectives."], ["Methodology", "Design, participants, data gathering and ethics."], ["Classification", "Research agenda and funding."], ["Attachments", "Your proposal file (PDF or Word, up to 10 MB)."], ["Review and submit", "A checklist shows anything still missing."]].map(([t, d], i) => `<div><span>${i + 1}</span><b>${t}</b><small>${d}</small></div>`).join("")}</div>
      <p>Choose the right <b>category</b>:</p>
      <div class="info-cats"><span style="--c:#D93636"><b>Action Research</b>Studies that solve classroom or school problems.</span><span style="--c:#249653"><b>Income Generating Project</b>School-based projects that raise resources.</span><span style="--c:#3478D4"><b>Innovation</b>New strategies, tools or programs.</span></div>
      <p>When you click <b>Submit</b>, you receive a <b>Research ID</b> (for example <span class="mono">RD360-2026-0001</span>). Keep it; it identifies your study in every report.</p>` +
      tip(`After submitting, you can't edit the study unless it is returned to you for revision. Check the Review step carefully.`))}
    ${sec("track", 6, "Track your research", `<p>Open <b>My Research</b> to see each study's status, progress bar and next step. You also get a <b>notification</b> (bell icon) whenever something changes.</p>
      <div class="info-flow">${["Submitted", "Initial screening", "Technical review", "Approval", "Implementation", "Final evaluation", "Completed"].map((s) => `<span>${esc(s)}</span>`).join(icon("chevron"))}</div>`)}
    ${sec("revise", 7, "Answer a revision", steps([
      `If your study is <b>Returned for Revision</b>, open it and read the reviewer's feedback.`,
      `Click <b>Revise and resubmit</b>, update the details, and upload the revised file in Attachments. Older versions are kept.`,
      `On the <b>Review and submit</b> step, click <b>Resubmit revision</b>.`,
    ]))}
    ${sec("after", 8, "After approval", `<ul class="info-list">
      <li>Your study moves to <b>Ongoing Implementation</b>. Keep its milestones up to date so the district can help on time.</li>
      <li>When finished, it goes to final evaluation, then becomes <b>Completed</b> and is added to the <b>Research Repository</b>, where other teachers in the district can learn from it.</li>
      <li>An administrator may mark outstanding studies <b>Public</b> so they appear on the home page, after confirming your consent.</li>
    </ul>`)}
    ${sec("password", 9, "Password and security", `<ul class="info-list">
      <li><b>Forgot your password?</b> On the sign-in page, click <b>Forgot your password?</b> and follow the link sent to your email.</li>
      <li><b>Change your password</b> anytime in <b>Settings</b>.</li>
      <li><b>Signed in on another computer?</b> Go to <b>Settings → Security</b> to see your devices and sign them out.</li>
      <li>Never share your password. District staff will never ask for it.</li>
    </ul>`)}
    ${sec("faq", 10, "Common questions", [
      ["I didn't receive the confirmation email.", "Wait a few minutes and check Spam or Promotions. If it still hasn't arrived, ask the District Research Office to check your account."],
      ["My account is still waiting for approval.", "Administrators approve accounts during office days. If it takes more than three days, contact the District Research Office."],
      ["Can I work on my proposal on my phone?", "Yes. The website works on phones, tablets and computers. Your draft is saved, so you can start on one device and continue on another."],
      ["Who can see my draft?", "Only you. Administrators see your research only after you submit it."],
      ["I submitted the wrong file.", "Contact the District Research Office. They can return the study to you for revision so you can upload the right file."],
    ].map(([q, a]) => `<details class="info-faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("") +
      `<div class="info-contact">${icon("mail")}<div><b>Still need help?</b><span>${esc(OFFICE)}</span><span>Email: ${mail()}</span></div></div>`)}
    </div></div>
    ${user ? "" : `<section class="cta-band" style="margin-top:20px"><div><h2>Ready to start?</h2><p>Create your account and submit your first research.</p></div><div class="row"><a class="btn btn-gold" href="#/register">Create an account</a><a class="btn info-cta-ghost" href="#/login/teacher">Sign in</a></div></section>`}
    </div>`;
  return { title: "User Guide", html, bind: bindToc };
}
