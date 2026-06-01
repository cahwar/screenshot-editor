// Single Supabase client for the whole app. Configured via Vite env vars at
// build time. The anon key is public by design — access is gated by Postgres
// Row-Level Security, not by hiding the key.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True only when both env vars are set. When false the app stays a pure
 *  localStorage-only tool (auth UI hides, sync is a no-op). */
export const isSupabaseConfigured = Boolean(url && anon);

// Fall back to harmless placeholders so createClient never throws when env is
// absent; nothing will be called because isSupabaseConfigured gates all usage.
export const supabase = createClient(
  url ?? "https://placeholder.supabase.co",
  anon ?? "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
