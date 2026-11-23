// Connected mode: keeps the app's in-memory records in sync with Supabase.
// Reads what the signed-in person may see, sends each change back, and listens for live updates.
// Every rule is enforced again by the database (see supabase/schema.sql), so the browser can't cheat.
import { CONFIG } from "./config.js?v=202611230828";

let sb = null;           // Supabase client
let snap = {};           // last synced copy of each row, by collection
let uid = null;          // signed-in user id
let pushing = null, pushTimer = null, onRemote = null, onError = null, chan = null;

// collection key in the app -> table and columns
const C = [
  { key: "users", table: "profiles", cols: ["email", "role", "status", "school_id"], strip: ["cred"], noInsert: true },
  { key: "schools", table: "schools", cols: ["active"] },
  { key: "projects", table: "projects", cols: ["owner_id", "school_id", "status", "category", "evaluator_id", "visibility", "research_id"], del: true },
  { key: "notifications", table: "notifications", cols: ["user_id", "read"], noReturn: true }, // you may notify others but not read their notices
  { key: "audit", table: "audit", cols: ["actor"], insertOnly: true, noReturn: true, only: (o) => o.actor === uid },
  { key: "school_requests", table: "school_requests", cols: ["status"] },
  { key: "sessions", table: "sessions", pk: "sid", cols: ["user_id"] },
  { key: "invitations", table: "invitations", pk: "email", dbpk: "email", cols: ["email", "role", "school_id"], del: true, insertOnly: true },
];
const pkOf = (c) => c.pk || "id";
const dbPk = (c) => c.dbpk || "id";

function toRow(c, o) {
  const row = { [dbPk(c)]: o[pkOf(c)] }, data = { ...o };
  delete data[pkOf(c)];
  for (const k of c.cols) { row[k] = o[k] ?? null; delete data[k]; }
  for (const k of c.strip || []) delete data[k];
  if (c.key === "projects") row.research_id = o.research_id || null;
  row.data = data;
  return row;
}
function fromRow(c, r) {
  const o = { ...(r.data || {}) };
  for (const k of c.cols) o[k] = r[k];
  o[pkOf(c)] = r[dbPk(c)];
  if (c.key === "users" && !o.created_at) o.created_at = r.created_at;
  if (c.key === "projects" && r.research_id) o.research_id = r.research_id;
  if (c.key === "notifications" && !o.at) o.at = r.created_at;
  return o;
}
const json = (x) => JSON.stringify(x);

function loadScript(src) {
  return new Promise((res, rej) => {
    if (window.supabase?.createClient) return res();
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = () => rej(new Error("The database library couldn't load. Check your internet connection."));
    document.head.append(s);
  });
}

export const cloud = {
  get client() { return sb; },
  get uid() { return uid; },
  siteUrl: () => location.origin + location.pathname,

  async start({ onRemoteChange, onSyncError, onRecovery, onSignedOut }) {
    await loadScript("assets/vendor/supabase-2.45.4.js");
    sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
      auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true, autoRefreshToken: true, storageKey: "rd360.auth" },
    });
    onRemote = onRemoteChange; onError = onSyncError;
    sb.auth.onAuthStateChange((event, session) => {
      uid = session?.user?.id || null;
      if (event === "PASSWORD_RECOVERY") onRecovery?.();
      if (event === "SIGNED_OUT") onSignedOut?.();
    });
    const { data } = await sb.auth.getSession();
    uid = data.session?.user?.id || null;
    // tidy the address bar after an email link (?code=...)
    if (/[?&]code=/.test(location.search)) history.replaceState(null, "", location.pathname + location.hash);
  },

  /* ---------- read everything this person may see ---------- */
  async pull(defaults) {
    const { data: sess } = await sb.auth.getSession();
    uid = sess.session?.user?.id || null;
    const q = (t) => sb.from(t).select("*");
    const want = [q("settings").eq("id", "main"), q("schools"), q("cms")];
    if (uid) want.push(q("profiles"), q("projects"), q("notifications").eq("user_id", uid).order("created_at", { ascending: false }).limit(300),
      q("audit").order("created_at", { ascending: false }).limit(1000), q("school_requests"), q("sessions"), q("invitations"));
    else want.push(q("projects"));
    const res = await Promise.all(want);
    const bad = res.find((r) => r.error);
    if (bad) throw new Error(bad.error.message);
    const [settings, schools, cms, ...rest] = res.map((r) => r.data || []);
    const get = (key, rows) => rows.map((r) => fromRow(C.find((c) => c.key === key), r));
    const state = {
      version: 2, seq: 0, schoolsSeeded: 1, throttle: {}, cloud: true,
      settings: { ...defaults.settings, ...(settings[0]?.data || {}) },
      schools: get("schools", schools),
      users: uid ? get("users", rest[0]) : [],
      projects: get("projects", uid ? rest[1] : rest[0]),
      notifications: uid ? get("notifications", rest[2]) : [],
      audit: uid ? get("audit", rest[3]) : [],
      school_requests: uid ? get("school_requests", rest[4]) : [],
      sessions: uid ? get("sessions", rest[5]) : [],
      invitations: uid ? get("invitations", rest[6]) : [],
      cms: { draft: null, published: null, versions: [] },
    };
    const adminRow = cms.find((r) => r.id === "admin"), pubRow = cms.find((r) => r.id === "public");
    state.cms.draft = adminRow?.data?.draft || defaults.content();
    state.cms.versions = adminRow?.data?.versions || [];
    state.cms.published = pubRow?.data?.published || null;
    try { state.reminded = JSON.parse(localStorage.getItem("rd360.reminded") || "{}"); } catch { state.reminded = {}; }
    // remember exactly what the server sent, to send back only real changes
    snap = {};
    for (const c of C) { snap[c.key] = new Map(); for (const o of state[c.key]) snap[c.key].set(o[pkOf(c)], json(toRow(c, o))); }
    snap.settings = json(state.settings); snap.cmsAdmin = adminRow ? json({ draft: state.cms.draft, versions: state.cms.versions }) : null; snap.cmsPublic = json({ published: state.cms.published });
    return state;
  },

  /* ---------- send changes ---------- */
  schedule(getState) {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => this.push(getState()), 250);
  },
  async flush(getState) { clearTimeout(pushTimer); await this.push(getState()); },
  async push(state) {
    if (pushing) { await pushing; }
    pushing = (async () => {
      try { localStorage.setItem("rd360.reminded", json(state.reminded || {})); } catch { /* ignore */ }
      if (!uid) return;
      const errors = [];
      for (const c of C) {
        const seen = new Set();
        for (const o of state[c.key] || []) {
          const id = o[pkOf(c)]; seen.add(id);
          const row = toRow(c, o), s = json(row), prev = snap[c.key].get(id);
          if (prev === s) continue;
          if (c.only && !c.only(o)) { snap[c.key].set(id, s); continue; }
          if (prev !== undefined && c.insertOnly) { snap[c.key].set(id, s); continue; }
          let r;
          if (prev === undefined) {
            if (c.noInsert) { snap[c.key].set(id, s); continue; }
            r = c.noReturn ? await sb.from(c.table).insert(row) : await sb.from(c.table).insert(row).select();
          } else {
            const upd = { ...row }; delete upd[dbPk(c)];
            r = c.noReturn ? await sb.from(c.table).update(upd).eq(dbPk(c), id) : await sb.from(c.table).update(upd).eq(dbPk(c), id).select();
          }
          if (r.error) { errors.push(`${c.table}: ${r.error.message}`); continue; }
          // the server may add values (Research ID): take its version
          const back = r.data?.[0];
          if (back) { const fresh = fromRow(c, back); Object.assign(o, fresh); snap[c.key].set(id, json(toRow(c, o))); }
          else snap[c.key].set(id, s);
        }
        if (c.del) for (const id of [...snap[c.key].keys()]) if (!seen.has(id)) {
          const r = await sb.from(c.table).delete().eq(dbPk(c), id);
          if (r.error) errors.push(`${c.table}: ${r.error.message}`); else snap[c.key].delete(id);
        }
      }
      const st = json(state.settings);
      if (st !== snap.settings) {
        const r = await sb.from("settings").update({ data: state.settings }).eq("id", "main").select();
        if (r.error || !r.data?.length) errors.push("settings: only the Super Administrator can change system settings"); else snap.settings = st;
      }
      const ca = json({ draft: state.cms.draft, versions: state.cms.versions });
      if (snap.cmsAdmin !== null && ca !== snap.cmsAdmin) {
        const r = await sb.from("cms").update({ data: { draft: state.cms.draft, versions: state.cms.versions } }).eq("id", "admin").select();
        if (r.error) errors.push(`home page draft: ${r.error.message}`); else snap.cmsAdmin = ca;
      }
      const cp = json({ published: state.cms.published });
      if (cp !== snap.cmsPublic) {
        const r = await sb.from("cms").update({ data: { published: state.cms.published } }).eq("id", "public").select();
        if (r.error) errors.push(`home page: ${r.error.message}`); else snap.cmsPublic = cp;
      }
      if (errors.length) onError?.(errors);
    })();
    try { await pushing; } finally { pushing = null; }
  },

  /* ---------- live updates from other people ---------- */
  listen() {
    if (chan || !sb) return;
    let t;
    chan = sb.channel("rd360-live").on("postgres_changes", { event: "*", schema: "public" }, () => {
      clearTimeout(t); t = setTimeout(() => { if (!pushing) onRemote?.(); }, 700);
    }).subscribe();
  },

  /* ---------- accounts (Supabase Auth) ---------- */
  async signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      if (/confirm/i.test(error.message)) throw new Error("Confirm your email address first. Open the link we sent to your inbox, then sign in.");
      if (/rate|too many/i.test(error.message)) throw new Error("Too many sign-in attempts. Wait a few minutes and try again.");
      throw new Error("The email or password is incorrect.");
    }
    uid = data.user.id;
    return data.user;
  },
  async signUp(email, password, meta) {
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: meta, emailRedirectTo: this.siteUrl() } });
    if (error) throw new Error(/registered|exists/i.test(error.message) ? "An account with this email already exists." : error.message);
    uid = data.session?.user?.id || null;
    return { confirm: !data.session, user: data.user };
  },
  async verifyPassword(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error("Your current password is incorrect.");
  },
  async setPassword(password) {
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  },
  async sendReset(email) {
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: this.siteUrl() });
    if (error) throw new Error(/rate/i.test(error.message) ? "Too many emails were sent. Wait a minute and try again." : error.message);
  },
  async signOut(scope = "local") { try { await sb.auth.signOut({ scope }); } catch { /* already signed out */ } uid = null; },

  /* ---------- proposal files (private storage) ---------- */
  async upload(projectId, file) {
    const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
    const path = `${projectId}/${Date.now()}-${safeName}`;
    const { error } = await sb.storage.from("proposals").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (error) throw new Error(`${file.name}: ${error.message}`);
    return path;
  },
  async fileUrl(path) {
    const { data, error } = await sb.storage.from("proposals").createSignedUrl(path, 300);
    if (error) throw new Error("You don't have access to this file, or it was removed.");
    return data.signedUrl;
  },
};
