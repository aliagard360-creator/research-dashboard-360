// RESEARCH DASHBOARD 360 configuration.
// Local mode: leave SUPABASE_URL and SUPABASE_ANON_KEY empty. Everything is saved in this browser only.
// Connected mode: paste the two values from Supabase → Project Settings → API. The anon (public) key is
// safe to publish: the database's row-level security decides what each person can see and change.
export const CONFIG = {
  SUPABASE_URL: "https://sczkinckkoneyfviiwso.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjemtpbmNra29uZXlmdmlpd3NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUyNTAwMzUsImV4cCI6MjExMDgyNjAzNX0.sckgCYzi-eAeaREI68EpmCbW5kOTP_Vm8AbKxetqPWQ",
  SUPERADMIN_EMAIL: "aliagard360@gmail.com",
  DISTRICT: "Schools District of Aliaga",
  DIVISION: "Schools Division Office of Nueva Ecija",
  REGION: "DepEd Region III",
};

export const CLOUD = !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
export const PREVIEW_MODE = !CLOUD;
