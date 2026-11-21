// RESEARCH DASHBOARD 360 configuration.
// Local mode: leave SUPABASE_URL and SUPABASE_ANON_KEY empty. Everything is saved in this browser only.
// Connected mode: paste the two values from Supabase → Project Settings → API. The anon (public) key is
// safe to publish: the database's row-level security decides what each person can see and change.
export const CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  SUPERADMIN_EMAIL: "aliagard360@gmail.com",
  DISTRICT: "Schools District of Aliaga",
  DIVISION: "Schools Division Office of Nueva Ecija",
  REGION: "DepEd Region III",
};

export const CLOUD = !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
export const PREVIEW_MODE = !CLOUD;
