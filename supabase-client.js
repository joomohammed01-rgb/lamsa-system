/* LAMSA: public browser client. Never put a service_role/secret key here. */
(() => {
  const SUPABASE_URL = 'https://lhyfzbdzppcbwipqdzkv.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_vpkNzG861kogYQq2bRpAcw_LfbWt316';
  if (!window.supabase?.createClient) {
    console.error('LAMSA: Supabase JS library did not load.');
    return;
  }
  window.lamsaSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
})();
