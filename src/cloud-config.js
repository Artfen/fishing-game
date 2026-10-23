// Optional cloud saves (Supabase). Leave these empty to keep the game guest-only: nothing
// about accounts is shown until a backend is configured.
//
// On Vercel, prefer setting SUPABASE_URL and SUPABASE_ANON_KEY as environment variables
// instead; api/cloud-config.js hands them to the game. Use this file only for hosts
// without serverless functions. See "Cloud saves" in the README.
//
// Only ever put the project's public anon (or "publishable") key here. It is safe in the
// browser because row level security limits every player to their own save. NEVER put the
// service_role (or "secret") key here or anywhere in the client: the game refuses to use one.
export const CLOUD_CONFIG = {
  url: '',     // e.g. 'https://abcdefghijklmnop.supabase.co'
  anonKey: '', // the anon / publishable key
};
