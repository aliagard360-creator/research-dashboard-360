// Data layer. Local mode keeps everything in this browser's localStorage.
// Connected mode (config.js filled in) keeps the same records in Supabase through cloud.js.
import { CONFIG, CLOUD } from "./config.js?v=202611231438";
import { cloud } from "./cloud.js?v=202611231438";

export const CATEGORIES = [
  { id: "AR", name: "Action Research", short: "Action Research", color: "#D93636", icon: "flask",
    desc: "Classroom and school-based studies that solve immediate teaching and learning problems." },
  { id: "IGP", name: "Income Generating Project", short: "IGP", color: "#249653", icon: "coins",
    desc: "School-based enterprise projects that generate resources to support school programs." },
  { id: "INN", name: "Innovation", short: "Innovation", color: "#3478D4", icon: "bulb",
    desc: "New programs, tools, or practices that improve learning delivery and school operations." },
];
export const catById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];

// Lifecycle stages (conditional stages are excluded from progress when not applicable).
export const STAGES = [
  { key: "draft", name: "Draft Preparation" },
  { key: "submission", name: "Research Submission" },
  { key: "screening", name: "Initial Screening" },
  { key: "technical", name: "Technical Evaluation" },
  { key: "revision", name: "Returned for Revision", cond: true },
  { key: "resubmitted", name: "Revised Submission", cond: true },
  { key: "ethics", name: "Ethics Review", cond: true },
  { key: "approval", name: "Approval / Rejection" },
  { key: "implementation", name: "Implementation and Monitoring" },
  { key: "final", name: "Final Evaluation" },
  { key: "dissemination", name: "Dissemination", cond: true },
  { key: "publication", name: "Publication", cond: true },
  { key: "archiving", name: "Digital Archiving" },
];
export const CORE_STAGES = STAGES.filter((s) => !s.cond).map((s) => s.key);

// Standard status vocabulary -> badge group and the core stage currently in progress.
export const STATUSES = {
  "Draft": { group: "draft", stage: "draft" },
  "Submitted": { group: "review", stage: "screening" },
  "Under Initial Screening": { group: "review", stage: "screening" },
  "Under Technical Review": { group: "review", stage: "technical" },
  "Returned for Revision": { group: "returned", stage: "technical" },
  "Revision Resubmitted": { group: "review", stage: "technical" },
  "Pending Ethics Review": { group: "review", stage: "approval" },
  "Pending Approval": { group: "review", stage: "approval" },
  "Approved": { group: "approved", stage: "implementation" },
  "Ongoing Implementation": { group: "ongoing", stage: "implementation" },
  "For Final Evaluation": { group: "ongoing", stage: "final" },
  "For Dissemination": { group: "ongoing", stage: "archiving" },
  "Published": { group: "done", stage: "archiving" },
  "Completed": { group: "done", stage: "archiving" },
  "Archived": { group: "done", stage: null },
  "Rejected": { group: "stop", stage: null },
  "Withdrawn": { group: "stop", stage: null },
};
export const TERMINAL = ["Archived", "Rejected", "Withdrawn"];

// Allowed administrator transitions (server-side rules once Supabase is connected).
export const ADMIN_TRANSITIONS = {
  "Submitted": ["Under Initial Screening"],
  "Under Initial Screening": ["Under Technical Review", "Returned for Revision", "Rejected"],
  "Under Technical Review": ["Pending Approval", "Pending Ethics Review", "Returned for Revision"],
  "Revision Resubmitted": ["Under Technical Review"],
  "Pending Ethics Review": ["Pending Approval", "Returned for Revision"],
  "Pending Approval": ["Approved", "Rejected"],
  "Approved": ["Ongoing Implementation"],
  "Ongoing Implementation": ["For Final Evaluation"],
  "For Final Evaluation": ["Completed", "For Dissemination", "Returned for Revision"],
  "For Dissemination": ["Published"],
  "Published": ["Archived"],
  "Completed": ["Archived"],
};
const STAGE_DAYS = { "Under Initial Screening": 7, "Under Technical Review": 14, "Returned for Revision": 14, "Pending Ethics Review": 14, "Pending Approval": 7, "Ongoing Implementation": 90, "For Final Evaluation": 14, "For Dissemination": 30, "Submitted": 7 };

export const RESEARCH_TYPES = ["Action Research", "Basic Research", "Policy Research", "Innovation Study", "School-based Enterprise"];
export const AGENDA = [
  "Teaching and Learning", "Child Protection", "Human Resource Development", "Governance",
  "Inclusive Education", "Disaster Risk Reduction and Management", "Gender and Development", "Other",
];
export const FUNDING = ["Self-funded", "School MOOE", "Basic Education Research Fund (BERF)", "LGU / Special Education Fund", "Partner / Donor", "Not applicable"];
export const ROLES = { teacher: "Teacher / Researcher", evaluator: "Evaluator", admin: "Research Administrator", superadmin: "Super Administrator" };

/* ---------------- progress helpers ---------------- */
export function progressOf(p) {
  if (p.status === "Archived") return 100;
  if (p.status === "Rejected" || p.status === "Withdrawn") return null;
  const st = STATUSES[p.status]?.stage;
  const idx = CORE_STAGES.indexOf(st);
  return Math.round((Math.max(idx, 0) / CORE_STAGES.length) * 100);
}
export function isOverdue(p) {
  if (!p.deadline || p.status === "Draft" || TERMINAL.includes(p.status) || p.status === "Completed" || p.status === "Published") return false;
  return new Date(p.deadline) < startOfToday();
}
export function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
export function nextAction(p, role = "teacher") {
  const t = {
    "Draft": ["Complete and submit your proposal", "Waiting for researcher to submit"],
    "Submitted": ["Waiting for initial screening", "Start initial screening"],
    "Under Initial Screening": ["Waiting for screening result", "Record screening outcome"],
    "Under Technical Review": ["Waiting for technical evaluation", "Complete technical evaluation"],
    "Returned for Revision": ["Revise and resubmit your proposal", "Waiting for researcher revision"],
    "Revision Resubmitted": ["Waiting for re-evaluation", "Review the revised submission"],
    "Pending Ethics Review": ["Waiting for ethics review", "Complete ethics review"],
    "Pending Approval": ["Waiting for final decision", "Issue final decision"],
    "Approved": ["Start implementation", "Confirm implementation start"],
    "Ongoing Implementation": ["Post milestone updates", "Monitor implementation"],
    "For Final Evaluation": ["Submit completion evidence", "Conduct final evaluation"],
    "For Dissemination": ["Disseminate findings", "Record dissemination"],
    "Published": ["Published", "Archive to repository"],
    "Completed": ["Completed", "Archive to repository"],
    "Archived": ["Archived in repository", "Archived in repository"],
    "Rejected": ["Closed: rejected", "Closed: rejected"],
    "Withdrawn": ["Closed: withdrawn", "Closed: withdrawn"],
  }[p.status] || ["", ""];
  return role === "teacher" ? t[0] : t[1];
}

/* ---------------- storage ----------------
   Local mode keeps all records in this browser only. When Supabase is connected,
   these same functions will call the shared database instead. */
const KEY = "rd360.local.v2";
const SESSION = "rd360.session.v2";
const OLD_KEYS = ["rd360.preview.v1", "rd360.session.v1"]; // sample data from the first preview: erased
let memory = null;
const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const remove = (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };
function write(k, v) {
  try { localStorage.setItem(k, v); return true; }
  catch (e) {
    if (e && (e.name === "QuotaExceededError" || e.code === 22)) throw new Error("Browser storage is full. Use smaller images or remove old content, then try again.");
    return false; // storage blocked (private mode): keep working in memory
  }
}


/* ---------------- official Aliaga school directory ----------------
   Source: DepEd SDO Nueva Ecija elementary and junior high school directories
   (deped-ne.net.ph, read 2026-11-21), Aliaga district only. Aliaga Senior High School is
   not in either directory and was added at the district's request; fill in its School ID. */
export const SCHOOL_TYPES = ["Elementary", "Secondary", "Integrated"];
export const ALIAGA_SCHOOLS = [
  ["105171", "Aliaga Central School", "Elementary", "Medina St. Poblacion Centro, Aliaga, Nueva Ecija"],
  ["105172", "Betes Elementary School", "Elementary", "Zone 4, Brgy. Betes, Aliaga, Nueva Ecija"],
  ["105173", "Bibiclat Elementary School", "Elementary", "Zone 4, Bibiclat, Aliaga, Nueva Ecija"],
  ["105174", "Bucot Elementary School", "Elementary", "Purok 2, Bucot, Aliaga, Nueva Ecija"],
  ["105179", "Don Benigno Carriedo Elementary School", "Elementary", "Purok 3, Magsaysay, Aliaga, Nueva Ecija"],
  ["105175", "Don Emiliano Soriano Elementary School", "Elementary", "Purok 2, Macabucod, Aliaga, Nueva Ecija"],
  ["105176", "Doña Elena L. Soriano Elementary School", "Elementary", "Zone 7, Bibiclat, Aliaga, Nueva Ecija"],
  ["105177", "Gaudencio Medina Elementary School", "Elementary", "San Felipe Bata, Aliaga, Nueva Ecija"],
  ["105180", "Gaudencio Medina Pantoc Elementary School", "Elementary", "Purok 2, Pantoc, Aliaga, Nueva Ecija"],
  ["105178", "La Purisima Elementary School", "Elementary", "La Purisima, Aliaga, Nueva Ecija"],
  ["105181", "San Carlos Elementary School", "Elementary", "Purok 4, San Carlos, Aliaga, Nueva Ecija 3111"],
  ["105182", "San Emiliano Elementary School", "Elementary", "Purok 6, San Emiliano, Aliaga, Nueva Ecija"],
  ["105183", "San Eustacio Elementary School", "Elementary", "San Eustacio, Aliaga, Nueva Ecija"],
  ["105184", "San Felipe Elementary School", "Elementary", "Purok 3, San Felipe Matanda, Aliaga, Nueva Ecija"],
  ["105186", "San Pablo (B) Elementary School", "Elementary", "San Pablo Bata, Aliaga, Nueva Ecija"],
  ["105187", "San Pablo (M) Elementary School", "Elementary", "Hulo Street, San Pablo Matanda, Aliaga, Nueva Ecija"],
  ["105188", "Santiago Elementary School", "Elementary", "Purok 3, Santiago, Aliaga, Nueva Ecija"],
  ["105189", "Sta. Monica Elementary School", "Elementary", "Centro, Sta. Monica, Aliaga, Nueva Ecija"],
  ["105190", "Sto. Rosario Elementary School", "Elementary", "Centro-A, Sto. Rosario, Aliaga, Nueva Ecija"],
  ["105191", "Sto. Tomas Elementary School", "Elementary", "Liwanag Street, Sto. Tomas, Aliaga, Nueva Ecija"],
  ["105192", "Sunson Elementary School", "Elementary", "Zone 1, Brgy. Sunson, Aliaga, Nueva Ecija"],
  ["105193", "Umangan Elementary School", "Elementary", "Purok 3, Umangan, Aliaga, Nueva Ecija"],
  ["501823", "San Juan Integrated School", "Integrated", "Centro, San Juan, Aliaga, Nueva Ecija"],
  ["300783", "Aliaga National High School", "Secondary", "Poblacion East II, Aliaga, Nueva Ecija"],
  ["300839", "Restituto B. Peria High School", "Secondary", "Zone 4, Bibiclat, Aliaga, Nueva Ecija"],
  ["306807", "San Carlos High School", "Secondary", "Purok 4, Brgy. San Carlos, Aliaga, Nueva Ecija"],
  ["306811", "Umangan National High School", "Secondary", "Purok 3, Umangan, Aliaga, Nueva Ecija"],
  ["300860", "Vicente R. Bumanlag, Sr. National High School", "Secondary", "Liwanag St., Sto. Tomas, Aliaga, Nueva Ecija 3111"],
  ["", "Aliaga Senior High School", "Secondary", "Aliaga, Nueva Ecija"],
];
const officialSchools = () => ALIAGA_SCHOOLS.map(([code, name, type, location]) => ({
  id: uid(), name, code, type, location, email: code ? `${code}@deped.gov.ph` : "", active: true, official: true,
}));
// Add any official school that isn't already in the directory (matched by School ID or name).
function mergeOfficialSchools(state) {
  const norm2 = (x) => String(x || "").trim().toLowerCase();
  for (const sc of officialSchools()) {
    const hit = state.schools.find((x) => (sc.code && x.code === sc.code) || norm2(x.name) === norm2(sc.name));
    if (hit) { if (!hit.code && sc.code) hit.code = sc.code; if (!hit.email && sc.email) hit.email = sc.email; if (sc.type === "Integrated") hit.type = "Integrated"; hit.official = true; }
    else state.schools.push(sc);
  }
  state.schoolsSeeded = 1;
}

export function emptyState() {
  return {
    version: 2, seq: 0, created_at: now(),
    settings: { requireApproval: true, adminsCanPublish: true, uploadMaxMB: 10, idleMinutes: 30 },
    schools: officialSchools(), schoolsSeeded: 1, users: [], projects: [], notifications: [], audit: [],
    cms: { draft: defaultContent(), published: null, versions: [] },
  };
}
function load() {
  if (memory) return memory;
  if (CLOUD) { memory = { ...emptyState(), schools: [], cloud: true }; return memory; } // filled by db.init()
  OLD_KEYS.forEach(remove);
  const raw = read(KEY);
  if (raw) {
    try {
      memory = JSON.parse(raw);
      if (!memory.schoolsSeeded) { mergeOfficialSchools(memory); persist(); }
      return memory;
    } catch { /* corrupted: start clean */ }
  }
  memory = emptyState();
  persist();
  return memory;
}
function persist() { if (CLOUD) cloud.schedule(() => memory); else write(KEY, JSON.stringify(memory)); }
const uid = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "").slice(0, 16) : Math.random().toString(36).slice(2, 10) + Date.now().toString(36));
function now() { return new Date().toISOString(); }
const daysFrom = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); return d.toISOString(); };
const norm = (s) => String(s || "").trim().toLowerCase();

/* ---------------- passwords (PBKDF2-SHA256, never stored in plain text) ---------------- */
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function hashPassword(password, saltB64) {
  const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 210000, hash: "SHA-256" }, key, 256);
  return { salt: b64(salt), hash: b64(bits) };
}
// Passwords people guess first. Matched without case, numbers and symbols at the end ignored.
const COMMON = ["password", "passw0rd", "qwerty", "qwertyuiop", "letmein", "welcome", "admin", "administrator", "iloveyou", "abc", "abcd", "abcdef", "monkey", "dragon", "sunshine", "princess", "football", "baseball", "deped", "depedph", "teacher", "student", "school", "research", "aliaga", "nuevaecija", "rd360", "rd360admin", "philippines", "manila", "changeme", "default", "test", "guest", "user", "login"];
export function passwordProblem(pw, ctx = {}) {
  if (!pw || pw.length < 8) return "Password must be at least 8 characters.";
  if (pw.length > 128) return "Password must be 128 characters or fewer.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Password must include letters and numbers.";
  const core = pw.toLowerCase().replace(/[^a-z]/g, "");
  if (core.length < 3) return "Use at least 3 letters in your password.";
  if (!core || COMMON.includes(core) || /^(1234|12345|123456|1234567|12345678)/.test(pw)) return "That password is too common. Choose something harder to guess.";
  const parts = [ctx.email && String(ctx.email).split("@")[0], ctx.username, ...(String(ctx.name || "").split(/\s+/))].map((x) => String(x || "").toLowerCase()).filter((x) => x.length >= 4);
  if (parts.some((x) => pw.toLowerCase().includes(x))) return "Don't include your name, username or email in your password.";
  return null;
}
export function passwordScore(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  if (passwordProblem(pw)) s = Math.min(s, 1);
  return s; // 0-4
}
const LOCK_AFTER = 5, LOCK_MINUTES = 10;

/* ---------------- this device (for sign-in alerts and the sessions list) ---------------- */
export function deviceInfo() {
  let id = null;
  try { id = localStorage.getItem("rd360.device"); if (!id) { id = uid(); localStorage.setItem("rd360.device", id); } } catch { id = "unknown"; }
  const ua = navigator.userAgent || "";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Android/.test(ua) ? "Android phone" : /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Windows/.test(ua) ? "Windows computer" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux computer" : "device";
  return { id, label: `${browser} on ${os}` };
}
const REMIND_DAYS = 3;
const daysSince = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

// strip credentials before handing a user object to the UI
const safe = (u) => { if (!u) return u; const { cred, ...rest } = u; return rest; };

/* ---------------- default public home page content ---------------- */
export const CONTENT_TYPES = {
  achievement: "Research Achievements",
  news: "Latest News and Announcements",
  event: "Upcoming Events and Deadlines",
  resource: "Resources and Downloads",
};
export const ITEM_CATEGORIES = ["Research Awards", "Research Conferences", "Research Presentations", "Published Studies", "Innovation", "Action Research", "Income Generating Projects", "Trainings and Capacity Building", "Partnerships", "District Announcements"];
export const SECTION_LABELS = {
  carousel: "Featured Research Carousel", stats: "Research at a Glance", achievement: "Research Achievements", news: "Latest News and Announcements",
  featured: "Featured Research and Innovation", social: "Facebook / Social Media Highlights", event: "Upcoming Events and Deadlines", resource: "Resources and Downloads", contact: "Contact and Help",
};
function defaultContent() {
  return {
    hero: {
      eyebrow: "Schools District of Aliaga · SDO Nueva Ecija · DepEd Region III",
      title: "Research. Tracking. Impact.",
      tagline: "One Platform. One Dashboard. One Research Ecosystem.",
      text: "RESEARCH DASHBOARD 360 brings research submission, evaluation, monitoring, analytics and a searchable research repository into one secure place for every school in the district.",
    },
    sections: Object.keys(SECTION_LABELS).map((key) => ({ key, enabled: true, title: SECTION_LABELS[key] })),
    slides: [], items: [], social: [],
    contact: { office: "District Research Office, Schools District of Aliaga", address: "", email: "", phone: "", facebook: "", hours: "", note: "For account or submission concerns, contact the District Research Coordinator." },
    stats: { completed: true, schools: true, active: true, categories: true, note: "" },
    updated_at: null, updated_by: null,
  };
}

/* ---------------- database API ---------------- */
export const db = {
  state: () => load(),
  settings: () => load().settings,
  schools: () => load().schools,
  school: (id) => load().schools.find((s) => s.id === id),
  users: () => load().users.map(safe),
  user: (id) => safe(load().users.find((u) => u.id === id)),
  projects: () => load().projects,
  project: (id) => load().projects.find((p) => p.id === id),
  audit: () => load().audit,

  /* ---------- first-run setup and sign-in ---------- */
  setupRequired: () => CLOUD ? !load().settings.superadmin_ready : !load().users.some((u) => u.role === "superadmin"),
  async createSuperAdmin({ name, username, email, password }) {
    const s = load();
    if (CLOUD) {
      if (!this.setupRequired()) throw new Error("Setup has already been completed.");
      if (norm(email) !== CONFIG.SUPERADMIN_EMAIL) throw new Error(`The Super Administrator must use ${CONFIG.SUPERADMIN_EMAIL}.`);
      const pp = passwordProblem(password, { name, email }); if (pp) throw new Error(pp);
      const r = await cloud.signUp(norm(email), password, { name: name.trim() });
      if (r.confirm) return { confirm: true };
      await this.reload(); return safe(load().users.find((u) => u.id === cloud.uid));
    }
    if (!this.setupRequired()) throw new Error("Setup has already been completed.");
    const pp = passwordProblem(password, { name, username, email }); if (pp) throw new Error(pp);
    const u = { id: uid(), name: name.trim(), username: norm(username) || null, email: norm(email) || null, role: "superadmin", school_id: null, position: "Super Administrator", status: "active", created_at: now(), cred: await hashPassword(password) };
    if (!u.username && !u.email) throw new Error("Enter a username or an email address.");
    s.users.push(u);
    this.log(u.id, "Created initial Super Administrator", "user", u.id);
    persist();
    return safe(u);
  },
  async authenticate(identifier, password) {
    if (CLOUD) {
      const email = norm(identifier);
      if (!email.includes("@")) throw new Error("Sign in with your email address.");
      const au = await cloud.signIn(email, password);
      await this.reload();
      const u = load().users.find((x) => x.id === au.id);
      if (!u) { await cloud.signOut(); throw new Error("Your account profile wasn't found. Contact the District Research Coordinator."); }
      if (u.status === "suspended") { await cloud.signOut(); throw new Error("This account is suspended. Contact the Research Administrator."); }
      return safe(u);
    }
    const s = load();
    const id = norm(identifier);
    // Throttle by the typed name, so it works the same for real and unknown accounts (no account guessing).
    s.throttle ||= {};
    const t = s.throttle[id] || { n: 0, until: 0 };
    if (t.until > Date.now()) {
      const mins = Math.ceil((t.until - Date.now()) / 60000);
      throw new Error(`Too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}, or ask an administrator to reset your password.`);
    }
    const u = s.users.find((x) => x.email === id || x.username === id);
    // same message for unknown user and wrong password
    const fail = () => {
      t.n += 1;
      if (u) { u.failed_since = (u.failed_since || 0) + 1; u.last_failed_at = now(); }
      if (t.n >= LOCK_AFTER) {
        t.until = Date.now() + LOCK_MINUTES * 60000; t.n = 0;
        if (u) {
          this.log(u.id, `Sign-in locked for ${LOCK_MINUTES} minutes after ${LOCK_AFTER} failed attempts`, "session", u.id);
          this.notify(u.id, `Security alert: ${LOCK_AFTER} wrong passwords were entered for your account, so sign-in was paused for ${LOCK_MINUTES} minutes. If this wasn't you, change your password.`, null, "security");
        }
      }
      s.throttle[id] = t; persist();
      const left = LOCK_AFTER - t.n;
      throw new Error(t.until > Date.now() ? `Too many failed attempts. Sign-in is paused for ${LOCK_MINUTES} minutes.` : `The username/email or password is incorrect.${left <= 2 ? ` ${left} attempt${left === 1 ? "" : "s"} left before a ${LOCK_MINUTES}-minute pause.` : ""}`);
    };
    if (!u || !u.cred) { await hashPassword(password || "x"); fail(); }
    const { hash } = await hashPassword(password, u.cred.salt);
    if (hash !== u.cred.hash) { this.log(u.id, "Failed sign-in attempt", "session", u.id); fail(); }
    delete s.throttle[id]; persist();
    if (u.status === "suspended") throw new Error("This account is suspended. Contact the Research Administrator.");
    return safe(u); // "pending" and "rejected" accounts sign in to their approval page only
  },
  /* sessions end after a period without activity (System Settings → idle minutes) */
  idleMinutes: () => Number(load().settings.idleMinutes) || 30,
  session() {
    const raw = read(SESSION); if (!raw) return null;
    try { const x = JSON.parse(raw); if (x && x.id) return x; } catch { /* old format: plain id */ }
    return { id: raw, last: Date.now() };
  },
  sessionRemainingMs() { const x = this.session(); return x ? x.last + this.idleMinutes() * 60000 - Date.now() : 0; },
  currentUser() {
    const x = this.session(); if (!x) return null;
    if (CLOUD && x.id !== cloud.uid) { remove(SESSION); return null; }
    const rec = x.sid ? (load().sessions || []).find((r) => r.sid === x.sid) : null;
    if (rec && rec.ended) { remove(SESSION); window.__rd360Revoked = true; return null; } // signed out from another device
    if (Date.now() - x.last > this.idleMinutes() * 60000) { this.log(x.id, "Session expired after inactivity", "session", x.id); if (rec) { rec.ended = now(); rec.why = "expired"; persist(); } remove(SESSION); window.__rd360Expired = true; return null; }
    const u = this.user(x.id); return u && ["active", "pending", "rejected"].includes(u.status) ? u : null;
  },
  touchSession(force) {
    const x = this.session();
    if (x && (force || Date.now() - x.last > 15000) && Date.now() - x.last <= this.idleMinutes() * 60000) {
      x.last = Date.now(); write(SESSION, JSON.stringify(x));
      const rec = x.sid && (load().sessions || []).find((r) => r.sid === x.sid);
      if (rec && !rec.ended) { rec.last = now(); persist(); }
    }
  },
  // Returns alerts to show right after sign-in (new device, failed attempts since last time).
  signIn(userId) {
    const s = load(), u = s.users.find((x) => x.id === userId), dev = deviceInfo(), sid = uid();
    s.sessions ||= [];
    s.sessions.push({ sid, user_id: userId, device_id: dev.id, label: dev.label, at: now(), last: now(), ended: null });
    const mine = s.sessions.filter((r) => r.user_id === userId);
    if (mine.length > 30) s.sessions = s.sessions.filter((r) => r.user_id !== userId || !r.ended || mine.slice(-30).includes(r));
    write(SESSION, JSON.stringify({ id: userId, sid, at: Date.now(), last: Date.now() }));
    const alerts = [];
    if (u) {
      u.known_devices ||= [];
      if (!u.known_devices.includes(dev.id)) {
        if (u.known_devices.length) {
          const msg = `New sign-in to your account on ${dev.label} (${new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}). If this wasn't you, change your password and sign out everywhere.`;
          this.notify(userId, msg, null, "security"); alerts.push(`New device: ${dev.label}. We've noted it on your account.`);
        }
        u.known_devices.push(dev.id);
      }
      if (u.failed_since) {
        const n = u.failed_since;
        this.notify(userId, `Security alert: ${n} failed sign-in attempt${n === 1 ? "" : "s"} on your account since your last sign-in (latest ${new Date(u.last_failed_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}). If this wasn't you, change your password.`, null, "security");
        alerts.push(`${n} failed sign-in attempt${n === 1 ? "" : "s"} since your last visit. Check Settings → Security if this wasn't you.`);
        u.failed_since = 0;
      }
    }
    this.log(userId, `Signed in on ${dev.label}`, "session", userId);
    persist();
    return alerts;
  },
  signOut() {
    if (CLOUD) cloud.signOut();
    const x = this.session();
    if (x) { this.log(x.id, "Signed out", "session", x.id); const rec = x.sid && (load().sessions || []).find((r) => r.sid === x.sid); if (rec && !rec.ended) { rec.ended = now(); rec.why = "signed out"; persist(); } }
    remove(SESSION);
  },
  sessionsFor(userId) {
    const cur = this.session()?.sid;
    const all = (load().sessions || []).filter((r) => r.user_id === userId).map((r) => ({ ...r, current: r.sid === cur, idle: !r.ended && Date.now() - new Date(r.last).getTime() > this.idleMinutes() * 60000 }));
    return { active: all.filter((r) => !r.ended && !r.idle).sort((a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0) || new Date(b.last) - new Date(a.last)), recent: all.filter((r) => r.ended || r.idle).sort((a, b) => new Date(b.ended || b.last) - new Date(a.ended || a.last)).slice(0, 6) };
  },
  endSession(user, sid) {
    const rec = (load().sessions || []).find((r) => r.sid === sid);
    if (!rec || (rec.user_id !== user.id && !["admin", "superadmin"].includes(user.role))) throw new Error("Session not found.");
    rec.ended = now(); rec.why = rec.user_id === user.id ? "signed out remotely" : "ended by an administrator";
    this.log(user.id, `Ended a session on ${rec.label}`, "session", rec.user_id);
    persist();
  },
  signOutEverywhere(user, includeThis = false) {
    const cur = this.session()?.sid; let n = 0;
    for (const r of load().sessions || []) if (r.user_id === user.id && !r.ended && (includeThis || r.sid !== cur)) { r.ended = now(); r.why = "signed out everywhere"; n++; }
    this.log(user.id, `Signed out everywhere (${n} session${n === 1 ? "" : "s"})`, "session", user.id);
    persist();
    if (CLOUD) cloud.signOut(includeThis ? "global" : "others");
    if (includeThis) remove(SESSION);
    return n;
  },
  async changePassword(userId, current, next) {
    const u = load().users.find((x) => x.id === userId);
    if (CLOUD) {
      const pp = passwordProblem(next, u); if (pp) throw new Error(pp);
      if (current !== null) { if (current === next) throw new Error("Choose a password different from your current one."); await cloud.verifyPassword(u.email, current); }
      await cloud.setPassword(next);
      this.log(userId, "Changed password", "user", userId); persist(); return;
    }
    if (current !== null) { const { hash } = await hashPassword(current, u.cred.salt); if (hash !== u.cred.hash) throw new Error("Your current password is incorrect."); }
    const pp = passwordProblem(next, u); if (pp) throw new Error(pp);
    if (current !== null && current === next) throw new Error("Choose a password different from your current one.");
    u.cred = await hashPassword(next); u.must_change = false;
    this.log(userId, "Changed password", "user", userId);
    persist();
  },
  async register(data) {
    const s = load();
    const email = norm(data.email);
    if (CLOUD) {
      const pp = passwordProblem(data.password, data); if (pp) throw new Error(pp);
      if (email === CONFIG.SUPERADMIN_EMAIL) throw new Error("That email is reserved for the Super Administrator.");
      const r = await cloud.signUp(email, data.password, { name: data.name.trim(), position: data.position.trim(), school_id: data.school_id || "", requested_school: data.requested_school?.trim() || "" });
      if (r.confirm) return { confirm: true, email, status: "pending", name: data.name.trim() };
      await this.reload();
      const u = load().users.find((x) => x.id === cloud.uid);
      return safe(u); // the database notifies administrators and files any school request
    }
    if (s.users.some((u) => u.email === email)) throw new Error("An account with this email already exists.");
    const pp = passwordProblem(data.password, data); if (pp) throw new Error(pp);
    const status = "pending"; // an administrator always approves new accounts first
    const u = { id: uid(), name: data.name.trim(), username: null, email, role: "teacher", school_id: data.school_id || null, requested_school: data.requested_school?.trim() || "", position: data.position.trim(), status, created_at: now(), cred: await hashPassword(data.password) };
    s.users.push(u);
    this.notifyAdmins(`New teacher registration awaiting approval: ${u.name}${u.requested_school ? ` (requested school: ${u.requested_school})` : ""}`, null);
    if (u.requested_school && !u.school_id) this.requestSchool(u, u.requested_school);
    this.log(u.id, "Registered account", "user", u.id);
    persist();
    return safe(u);
  },
  async createAccount(actor, data) {
    if (!["admin", "superadmin"].includes(actor.role)) throw new Error("Not authorized.");
    if (["admin", "superadmin"].includes(data.role) && actor.role !== "superadmin") throw new Error("Only a Super Administrator can create administrator accounts.");
    const s = load();
    if (CLOUD) {
      // Accounts can't be created from the browser; the person registers and gets this role automatically.
      const email = norm(data.email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter the person's email address.");
      if (data.role === "superadmin") throw new Error("There is only one Super Administrator.");
      if (s.users.some((u) => u.email === email)) throw new Error("This email already has an account. Change its role instead.");
      s.invitations ||= [];
      if (s.invitations.some((i) => i.email === email)) throw new Error("This email is already invited.");
      s.invitations.push({ email, role: data.role, school_id: data.school_id || null, name: data.name.trim(), position: data.position?.trim() || "", invited_by: actor.id, at: now() });
      this.log(actor.id, `Invited ${email} as ${ROLES[data.role]}`, "user", "");
      persist(); await this.flush();
      return { name: data.name.trim(), email, invited: true };
    }
    const email = norm(data.email), username = norm(data.username);
    if (!email && !username) throw new Error("Enter an email address or a username.");
    if (s.users.some((u) => (email && u.email === email) || (username && u.username === username))) throw new Error("An account with this email or username already exists.");
    const pp = passwordProblem(data.password); if (pp) throw new Error(pp);
    const u = { id: uid(), name: data.name.trim(), username: username || null, email: email || null, role: data.role, school_id: data.school_id || null, position: data.position?.trim() || "", status: "active", must_change: true, created_at: now(), cred: await hashPassword(data.password) };
    s.users.push(u);
    this.log(actor.id, `Created ${ROLES[u.role]} account`, "user", u.id);
    persist();
    return safe(u);
  },
  approveUser(actor, id) {
    if (!["admin", "superadmin"].includes(actor.role)) throw new Error("Not authorized.");
    const u = load().users.find((x) => x.id === id);
    if (!u || !["pending", "rejected"].includes(u.status)) throw new Error("This account is not waiting for approval.");
    if (!u.school_id) throw new Error("Assign a school before approving this account.");
    u.status = "active"; u.approved_at = now(); u.approved_by = actor.id; u.review_note = "";
    this.notify(u.id, "Your account was approved. Welcome to RESEARCH DASHBOARD 360!", null);
    this.log(actor.id, "Approved registration", "user", id);
    persist();
  },
  rejectUser(actor, id, reason) {
    if (!["admin", "superadmin"].includes(actor.role)) throw new Error("Not authorized.");
    const u = load().users.find((x) => x.id === id);
    if (!u || u.status !== "pending") throw new Error("This account is not waiting for approval.");
    if (!String(reason || "").trim()) throw new Error("Give a reason so the person knows what to fix.");
    u.status = "rejected"; u.review_note = reason.trim(); u.reviewed_at = now();
    this.notify(u.id, `Your registration needs changes: ${reason.trim()}`, null);
    this.log(actor.id, "Returned registration for changes", "user", id, reason);
    persist();
  },
  resubmitRegistration(user, data) {
    const u = load().users.find((x) => x.id === user.id);
    if (!u || !["pending", "rejected"].includes(u.status)) throw new Error("Your account is already approved.");
    if (!String(data.name || "").trim() || !String(data.position || "").trim()) throw new Error("Name and position are required.");
    if (!data.school_id && !String(data.requested_school || "").trim()) throw new Error("Choose your school or type it in.");
    Object.assign(u, { name: data.name.trim(), position: data.position.trim(), school_id: data.school_id || null, requested_school: String(data.requested_school || "").trim() });
    if (u.requested_school && !u.school_id) this.requestSchool(u, u.requested_school);
    const was = u.status; u.status = "pending"; u.review_note = ""; u.resubmitted_at = now();
    this.notifyAdmins(`${was === "rejected" ? "Registration resubmitted" : "Registration details updated"}: ${u.name}`, null);
    this.log(u.id, was === "rejected" ? "Resubmitted registration" : "Updated registration details", "user", u.id);
    persist();
    return safe(u);
  },

  /* profile changes by teachers and evaluators wait for an administrator */
  profileNeedsApproval: (u) => ["teacher", "evaluator"].includes(u?.role),
  requestProfileChange(user, fields) {
    const u = load().users.find((x) => x.id === user.id);
    const allowed = ["name", "position", "school_id", "photo"];
    const change = {};
    for (const k of allowed) if (k in fields && (fields[k] || null) !== (u[k] || null)) change[k] = fields[k] || null;
    if (!Object.keys(change).length) throw new Error("Nothing changed.");
    u.pending_change = { ...(u.pending_change?.fields || {}), ...change };
    u.pending_change = { fields: u.pending_change, at: now() };
    u.change_note = "";
    this.notifyAdmins(`Profile change waiting for approval: ${u.name} (${Object.keys(u.pending_change.fields).join(", ").replace("school_id", "school")})`, null);
    this.log(u.id, "Requested profile change", "user", u.id, Object.keys(change).join(", "));
    persist();
    return safe(u);
  },
  cancelProfileChange(user) {
    const u = load().users.find((x) => x.id === user.id);
    u.pending_change = null; persist();
  },
  approveProfileChange(actor, id) {
    if (!["admin", "superadmin"].includes(actor.role)) throw new Error("Not authorized.");
    const u = load().users.find((x) => x.id === id);
    if (!u?.pending_change) throw new Error("There is no change waiting for this account.");
    Object.assign(u, u.pending_change.fields);
    u.pending_change = null; u.change_note = "";
    this.notify(u.id, "Your profile changes were approved.", null);
    this.log(actor.id, "Approved profile change", "user", id);
    persist();
  },
  rejectProfileChange(actor, id, reason) {
    if (!["admin", "superadmin"].includes(actor.role)) throw new Error("Not authorized.");
    const u = load().users.find((x) => x.id === id);
    if (!u?.pending_change) throw new Error("There is no change waiting for this account.");
    if (!String(reason || "").trim()) throw new Error("Give a reason so the person knows why.");
    u.pending_change = null; u.change_note = reason.trim();
    this.notify(u.id, `Your profile change was not approved: ${reason.trim()}`, null);
    this.log(actor.id, "Declined profile change", "user", id, reason);
    persist();
  },
  /* ---------- bulk approval ---------- */
  approveUsers(actor, ids) {
    const ok = [], skipped = [];
    for (const id of ids) {
      const u = load().users.find((x) => x.id === id);
      try { this.approveUser(actor, id); ok.push(u.name); }
      catch (e) { skipped.push(`${u?.name || "Unknown"}: ${e.message}`); }
    }
    return { ok, skipped };
  },

  /* ---------- schools teachers asked for ---------- */
  schoolRequests: (status = "pending") => (load().school_requests || []).filter((r) => !status || r.status === status),
  requestSchool(user, text) {
    const s = load(); s.school_requests ||= [];
    const name = String(text || "").trim(); if (!name) return;
    const same = s.school_requests.find((r) => r.status === "pending" && norm(r.name) === norm(name) && (!CLOUD || ["admin", "superadmin"].includes(user.role) || r.by.includes(user.id)));
    if (same) { if (!same.by.includes(user.id)) same.by.push(user.id); }
    else { s.school_requests.push({ id: uid(), name, by: [user.id], at: now(), status: "pending" }); if (!CLOUD) this.notifyAdmins(`School requested for the directory: "${name}" (by ${user.name})`, null); }
    persist();
  },
  resolveSchoolRequest(admin, reqId, data) {
    const r = (load().school_requests || []).find((x) => x.id === reqId);
    if (!r || r.status !== "pending") throw new Error("This request was already handled.");
    const sc = data.existing_id ? this.school(data.existing_id) : this.addSchool(admin, data);
    if (!sc) throw new Error("Choose a school.");
    r.status = "added"; r.school_id = sc.id; r.handled_by = admin.id; r.handled_at = now();
    for (const uidv of r.by) {
      const u = load().users.find((x) => x.id === uidv);
      if (u && !u.school_id) { u.school_id = sc.id; u.requested_school = ""; this.notify(u.id, `Your school "${sc.name}" is now in the directory and linked to your account.`, null); }
    }
    this.log(admin.id, data.existing_id ? "Linked school request to an existing school" : "Added requested school", "school", sc.id, r.name);
    persist();
    return sc;
  },
  declineSchoolRequest(admin, reqId, reason) {
    const r = (load().school_requests || []).find((x) => x.id === reqId);
    if (!r || r.status !== "pending") throw new Error("This request was already handled.");
    if (!String(reason || "").trim()) throw new Error("Give a reason so the teacher knows what to do.");
    r.status = "declined"; r.note = reason.trim(); r.handled_by = admin.id; r.handled_at = now();
    for (const uidv of r.by) this.notify(uidv, `Your school request "${r.name}" wasn't added: ${reason.trim()}`, null);
    this.log(admin.id, "Declined school request", "school", "", `${r.name}: ${reason}`);
    persist();
  },

  /* ---------- reminders for items waiting too long ---------- */
  approvalReminders() {
    const out = [];
    for (const u of load().users) {
      if (u.status === "pending") { const d = daysSince(u.resubmitted_at || u.created_at); if (d >= REMIND_DAYS) out.push({ kind: "account", id: u.id, name: u.name, days: d, href: "#/a/users?role=pending" }); }
      if (u.pending_change) { const d = daysSince(u.pending_change.at); if (d >= REMIND_DAYS) out.push({ kind: "change", id: u.id, name: u.name, days: d, href: "#/a/users?role=changes" }); }
    }
    for (const r of this.schoolRequests()) { const d = daysSince(r.at); if (d >= REMIND_DAYS) out.push({ kind: "school", id: r.id, name: r.name, days: d, href: "#/a/schools" }); }
    return out.sort((a, b) => b.days - a.days);
  },
  // Sends each overdue item to admins' notifications at most once a day.
  runReminders() {
    const s = load(); s.reminded ||= {};
    const today = new Date().toISOString().slice(0, 10); let sent = 0;
    const what = { account: "New account", change: "Profile change", school: "School request" };
    for (const it of this.approvalReminders()) {
      const k = `${it.kind}:${it.id}`;
      if (s.reminded[k] === today) continue;
      s.reminded[k] = today; sent++;
      const me = this.currentUser(); if (me) this.notify(me.id, `Reminder: ${what[it.kind]} for ${it.name} has waited ${it.days} days.`, null);
    }
    if (sent) persist();
    return sent;
  },
  approvalCounts() {
    const us = load().users;
    return { accounts: us.filter((u) => u.status === "pending").length, changes: us.filter((u) => u.pending_change).length, schools: this.schoolRequests().length };
  },
  async resetPassword(actor, id, temp) {
    if (!["admin", "superadmin"].includes(actor.role)) throw new Error("Not authorized.");
    const u = load().users.find((x) => x.id === id);
    if (CLOUD) { await cloud.sendReset(u.email); this.log(actor.id, "Sent a password reset link", "user", id); persist(); return { emailed: true }; }
    if (u.role === "superadmin" && actor.role !== "superadmin") throw new Error("Only a Super Administrator can reset this account.");
    if (["admin"].includes(u.role) && actor.role !== "superadmin") throw new Error("Only a Super Administrator can reset administrator passwords.");
    const pp = passwordProblem(temp); if (pp) throw new Error(pp);
    u.cred = await hashPassword(temp); u.must_change = true;
    this.log(actor.id, "Reset password", "user", id);
    persist();
  },
  updateSettings(actor, fields) {
    if (actor.role !== "superadmin") throw new Error("Only a Super Administrator can change system settings.");
    Object.assign(load().settings, fields);
    this.log(actor.id, "Changed system settings", "settings", "", JSON.stringify(fields));
    persist();
  },

  /* ---------- visibility (mirrors the server-side policies planned for Supabase) ---------- */
  visibleProjects(user) {
    const all = load().projects;
    if (!user) return [];
    if (user.role === "teacher") return all.filter((p) => p.owner_id === user.id);
    if (user.role === "evaluator") return all.filter((p) => p.evaluator_id === user.id);
    return all.filter((p) => p.status !== "Draft");
  },
  canView(user, p) {
    if (!user || !p) return false;
    if (user.role === "teacher") return p.owner_id === user.id;
    if (user.role === "evaluator") return p.evaluator_id === user.id;
    return p.status !== "Draft";
  },
  repositoryItems(user) {
    const done = load().projects.filter((p) => ["Completed", "Published", "Archived"].includes(p.status));
    if (!user) return done.filter((p) => p.visibility === "public");
    if (["admin", "superadmin"].includes(user.role)) return done;
    return done.filter((p) => p.visibility !== "restricted" || p.owner_id === user.id);
  },
  setVisibility(actor, id, visibility) {
    const p = this.project(id);
    p.visibility = visibility;
    this.log(actor.id, `Repository visibility: ${visibility}`, "project", id);
    persist();
  },

  /* ---------- projects ---------- */
  saveDraft(user, data) {
    const s = load();
    let p = data.id ? s.projects.find((x) => x.id === data.id) : null;
    if (p && (p.owner_id !== user.id || !["Draft", "Returned for Revision"].includes(p.status))) throw new Error("This project can no longer be edited.");
    if (!p) {
      p = { id: uid(), research_id: null, owner_id: user.id, status: "Draft", created_at: now(), files: [], history: [], feedback: [], visibility: "district" };
      p.history.push({ at: now(), actor: user.id, action: "Draft created" });
      s.projects.push(p);
    }
    const { id, owner_id, status, research_id, history, feedback, created_at, visibility, ...fields } = data;
    Object.assign(p, fields, { updated_at: now() });
    persist();
    return p;
  },
  submit(user, id) {
    const s = load();
    const p = s.projects.find((x) => x.id === id);
    if (!p || p.owner_id !== user.id) throw new Error("Project not found.");
    if (p.status === "Draft") {
      const dup = s.projects.find((x) => x.id !== p.id && x.status !== "Draft" && norm(x.title) === norm(p.title) && x.owner_id === user.id);
      if (dup) throw new Error(`You already submitted a project with this title (${dup.research_id}).`);
      s.seq = (s.seq || 0) + 1;
      p.research_id = `RD360-${new Date().getFullYear()}-${String(s.seq).padStart(4, "0")}`;
      p.status = "Submitted";
      p.submitted_at = now();
      p.deadline = daysFrom(now(), STAGE_DAYS.Submitted);
      p.history.push({ at: now(), actor: user.id, action: "Submitted", from: "Draft", to: "Submitted" });
      this.notifyAdmins(`New submission ${p.research_id}: ${p.title}`, p.id);
      this.notify(user.id, `Submission received: ${p.research_id}. Your proposal is queued for initial screening.`, p.id);
    } else if (p.status === "Returned for Revision") {
      p.status = "Revision Resubmitted";
      p.deadline = daysFrom(now(), STAGE_DAYS["Under Technical Review"]);
      p.history.push({ at: now(), actor: user.id, action: "Revision resubmitted", from: "Returned for Revision", to: "Revision Resubmitted" });
      this.notifyAdmins(`Revision resubmitted: ${p.research_id}`, p.id);
    } else throw new Error("Only drafts or returned projects can be submitted.");
    p.updated_at = now();
    this.log(user.id, `Status: ${p.status}`, "project", p.id);
    persist();
    return p;
  },
  withdraw(user, id, reason) {
    const p = load().projects.find((x) => x.id === id);
    if (!p || p.owner_id !== user.id || TERMINAL.includes(p.status)) throw new Error("This project cannot be withdrawn.");
    const from = p.status;
    p.status = "Withdrawn"; p.updated_at = now();
    p.history.push({ at: now(), actor: user.id, action: "Withdrawn", from, to: "Withdrawn", note: reason });
    this.log(user.id, "Withdrew project", "project", p.id, reason);
    persist();
  },
  deleteDraft(user, id) {
    const s = load();
    const p = s.projects.find((x) => x.id === id);
    if (!p || p.owner_id !== user.id || p.status !== "Draft") throw new Error("Only your own drafts can be deleted.");
    s.projects = s.projects.filter((x) => x.id !== id);
    persist();
  },
  transition(admin, id, to, reason, feedbackText, emailTeacher = true) {
    if (!["admin", "superadmin"].includes(admin.role)) throw new Error("Not authorized.");
    const p = load().projects.find((x) => x.id === id);
    if (!p) throw new Error("Project not found.");
    if (p.owner_id === admin.id) throw new Error("You cannot make decisions on your own research.");
    if (!(ADMIN_TRANSITIONS[p.status] || []).includes(to)) throw new Error(`Cannot move from ${p.status} to ${to}.`);
    const from = p.status;
    p.status = to; p.updated_at = now();
    p.email_teacher = !!emailTeacher; // read by the database when it queues the email (supabase/email-updates.sql)
    p.deadline = STAGE_DAYS[to] ? daysFrom(now(), STAGE_DAYS[to]) : null;
    p.history.push({ at: now(), actor: admin.id, action: `Moved to ${to}`, from, to, note: reason });
    if (feedbackText) p.feedback.push({ at: now(), by: admin.id, text: feedbackText });
    this.notify(p.owner_id, `${p.research_id}: status changed to "${to}".${feedbackText ? " New feedback is available." : ""}`, p.id);
    this.log(admin.id, `Status ${from} → ${to}`, "project", p.id, reason);
    persist();
    return p;
  },
  assignEvaluator(admin, id, evaluatorId, due) {
    const p = load().projects.find((x) => x.id === id);
    if (!p) throw new Error("Project not found.");
    if (evaluatorId === p.owner_id) throw new Error("A researcher cannot evaluate their own project.");
    p.evaluator_id = evaluatorId || null;
    if (due) p.deadline = new Date(due).toISOString();
    p.history.push({ at: now(), actor: admin.id, action: evaluatorId ? `Evaluator assigned: ${this.user(evaluatorId)?.name}` : "Evaluator unassigned" });
    if (evaluatorId) this.notify(evaluatorId, `You were assigned to evaluate ${p.research_id}.`, p.id);
    this.log(admin.id, "Assigned evaluator", "project", p.id);
    persist();
  },
  addEvaluation(evaluator, id, rec, text) {
    const p = this.project(id);
    if (!p || p.evaluator_id !== evaluator.id) throw new Error("You are not assigned to this project.");
    p.feedback.push({ at: now(), by: evaluator.id, text: `[${rec}] ${text}` });
    p.history.push({ at: now(), actor: evaluator.id, action: `Evaluation submitted: ${rec}` });
    this.notifyAdmins(`Evaluation submitted for ${p.research_id}: ${rec}`, p.id);
    this.log(evaluator.id, "Submitted evaluation", "project", p.id, rec);
    persist();
  },
  requestUpdate(admin, id, msg) {
    const p = this.project(id);
    this.notify(p.owner_id, `Update requested for ${p.research_id}: ${msg}`, p.id);
    p.history.push({ at: now(), actor: admin.id, action: "Requested implementation update", note: msg });
    this.log(admin.id, "Requested implementation update", "project", p.id);
    persist();
  },

  /* ---------- schools and users ---------- */
  addSchool(admin, data) {
    const s = load();
    const name = data.name.trim();
    if (!name) throw new Error("School name is required.");
    if (s.schools.some((x) => norm(x.name) === norm(name))) throw new Error("That school is already in the directory.");
    if (data.code?.trim() && s.schools.some((x) => x.code && x.code === data.code.trim())) throw new Error("Another school already uses that School ID.");
    const sc = { id: uid(), name, code: data.code?.trim() || "", type: data.type, location: data.location?.trim() || "", active: true };
    s.schools.push(sc);
    this.log(admin.id, "Added school", "school", sc.id, name);
    persist();
    return sc;
  },
  updateSchool(admin, id, data) {
    const sc = load().schools.find((x) => x.id === id);
    if (load().schools.some((x) => x.id !== id && norm(x.name) === norm(data.name))) throw new Error("Another school already has that name.");
    Object.assign(sc, { name: data.name.trim(), code: data.code?.trim() || "", type: data.type, location: data.location?.trim() || "" });
    this.log(admin.id, "Edited school", "school", id, sc.name);
    persist();
  },
  toggleSchool(admin, id) {
    const sc = load().schools.find((x) => x.id === id); sc.active = !sc.active;
    this.log(admin.id, sc.active ? "Activated school" : "Deactivated school", "school", id, sc.name);
    persist();
  },
  updateUser(actor, id, fields) {
    const u = load().users.find((x) => x.id === id);
    if (actor.id !== id && !["admin", "superadmin"].includes(actor.role)) throw new Error("Not authorized.");
    if (fields.role && actor.role !== "superadmin") throw new Error("Only a Super Administrator can change roles.");
    if (actor.id === id && this.profileNeedsApproval(actor) && ["name", "position", "school_id", "photo"].some((k) => k in fields)) throw new Error("Name, position, school and photo changes need administrator approval.");
    if (fields.role && u.role === "superadmin" && fields.role !== "superadmin" && load().users.filter((x) => x.role === "superadmin" && x.status === "active").length < 2) throw new Error("The last active Super Administrator cannot be changed.");
    const { cred, ...clean } = fields;
    Object.assign(u, clean);
    this.log(actor.id, actor.id === id ? "Updated own profile" : "Updated user", "user", id);
    persist();
    return safe(u);
  },
  setUserStatus(actor, id, status) {
    const u = load().users.find((x) => x.id === id);
    if (u.id === actor.id) throw new Error("You cannot suspend your own account.");
    if (u.role === "superadmin" && actor.role !== "superadmin") throw new Error("Only a Super Administrator can change this account.");
    if (u.role === "superadmin" && status !== "active" && load().users.filter((x) => x.role === "superadmin" && x.status === "active").length < 2) throw new Error("The last active Super Administrator cannot be suspended.");
    u.status = status;
    this.log(actor.id, `Account ${status}`, "user", id);
    persist();
  },

  /* ---------- public home page content (CMS) ---------- */
  cmsDraft: () => load().cms.draft,
  cmsPublished: () => load().cms.published,
  cmsVersions: () => load().cms.versions,
  canPublish: (u) => u?.role === "superadmin" || (u?.role === "admin" && load().settings.adminsCanPublish),
  saveCms(actor, draft) {
    if (!["admin", "superadmin"].includes(actor.role)) throw new Error("Not authorized.");
    draft.updated_at = now(); draft.updated_by = actor.id;
    load().cms.draft = draft;
    persist();
  },
  cmsDirty() {
    const c = load().cms;
    if (!c.published) return true;
    const strip = ({ updated_at, updated_by, published_at, published_by, ...rest }) => JSON.stringify(rest);
    return strip(c.draft) !== strip(c.published);
  },
  publishCms(actor) {
    if (!this.canPublish(actor)) throw new Error("Your role cannot publish public content.");
    const c = load().cms;
    const snap = JSON.parse(JSON.stringify(c.draft));
    snap.published_at = now(); snap.published_by = actor.id;
    c.published = snap;
    c.versions.unshift({ id: uid(), at: snap.published_at, by: actor.id, content: snap });
    if (c.versions.length > 10) c.versions.length = 10;
    this.log(actor.id, "Published home page content", "cms", "");
    persist();
  },
  unpublishCms(actor) {
    if (!this.canPublish(actor)) throw new Error("Your role cannot unpublish public content.");
    load().cms.published = null;
    this.log(actor.id, "Unpublished home page content", "cms", "");
    persist();
  },
  discardCmsDraft(actor) {
    const c = load().cms;
    c.draft = c.published ? JSON.parse(JSON.stringify(c.published)) : defaultContent();
    this.log(actor.id, "Discarded home page draft", "cms", "");
    persist();
  },
  restoreCmsVersion(actor, versionId) {
    const v = load().cms.versions.find((x) => x.id === versionId);
    load().cms.draft = JSON.parse(JSON.stringify(v.content));
    this.log(actor.id, "Restored home page version into draft", "cms", versionId);
    persist();
  },
  publicStats() {
    const ps = load().projects.filter((p) => p.status !== "Draft");
    return {
      completed: ps.filter((p) => ["Completed", "Published", "Archived"].includes(p.status)).length,
      schools: new Set(ps.map((p) => p.school_id)).size,
      active: ps.filter((p) => !TERMINAL.includes(p.status) && !["Completed", "Published"].includes(p.status)).length,
      categories: CATEGORIES.map((c) => ({ ...c, n: ps.filter((p) => p.category === c.id).length })),
      total: ps.length,
    };
  },

  /* ---------- notifications and audit ---------- */
  notify(userId, message, projectId, kind = "") {
    load().notifications.unshift({ id: uid(), user_id: userId, message, project_id: projectId, at: now(), read: false, kind });
  },
  notifyAdmins(message, projectId) {
    load().users.filter((u) => ["admin", "superadmin"].includes(u.role) && u.status === "active").forEach((u) => this.notify(u.id, message, projectId));
  },
  notificationsFor: (userId) => load().notifications.filter((n) => n.user_id === userId),
  markRead(userId, id) {
    load().notifications.filter((n) => n.user_id === userId && (!id || n.id === id)).forEach((n) => (n.read = true));
    persist();
  },
  log(actorId, action, targetType, targetId, reason) {
    load().audit.unshift({ id: uid(), at: now(), actor: actorId, action, target_type: targetType, target_id: targetId, reason: reason || "" });
    if (memory.audit.length > 1000) memory.audit.length = 1000;
    persist();
  },

  /* ---------- connected mode ---------- */
  cloudMode: CLOUD,
  async init(hooks = {}) {
    if (!CLOUD) return;
    await cloud.start({
      onRemoteChange: async () => { await this.reload(); hooks.onChange?.(); },
      onSyncError: (errs) => { hooks.onError?.(errs); this.reload().then(() => hooks.onChange?.()); },
      onRecovery: () => hooks.onRecovery?.(),
      onSignedOut: () => { remove(SESSION); hooks.onChange?.(); },
    });
    await this.reload();
    // a valid Supabase session without a local session record (new tab): adopt it
    if (cloud.uid && !this.session()) write(SESSION, JSON.stringify({ id: cloud.uid, at: Date.now(), last: Date.now() }));
    cloud.listen();
  },
  async reload() {
    if (!CLOUD) return;
    memory = await cloud.pull({ settings: emptyState().settings, content: defaultContent });
  },
  async flush() { if (CLOUD) await cloud.flush(() => memory); },
  invitations: () => load().invitations || [],
  cancelInvitation(actor, email) {
    const s = load(); s.invitations = (s.invitations || []).filter((i) => i.email !== email);
    this.log(actor.id, `Cancelled invitation for ${email}`, "user", ""); persist();
  },
  async sendPasswordReset(email) { if (!CLOUD) throw new Error("Password reset emails work once the site is connected to the district database."); await cloud.sendReset(norm(email)); },
  async uploadFile(projectId, file) { return cloud.upload(projectId, file); },
  async fileUrl(path) { return cloud.fileUrl(path); },

  /* Super Administrator only: wipe everything stored in this browser and start over. */
  eraseAll(actor) {
    if (actor?.role !== "superadmin") throw new Error("Only a Super Administrator can erase all data.");
    if (CLOUD) throw new Error("The shared database can only be erased from the Supabase dashboard.");
    remove(KEY); remove(SESSION); memory = null; load();
  },
};

