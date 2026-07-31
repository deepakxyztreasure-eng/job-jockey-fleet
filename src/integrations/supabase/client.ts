// Connected to external Supabase project (Lovable Cloud disabled)
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Hardcoded so Lovable Cloud cannot override these values
const SUPABASE_URL = "https://udvevmetftkcfqwdknjj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_pIEBqjyDuMVb6CnzH6Xxrw_hGAKyl6t";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    storageKey: "jodha-auth",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  }
});

// Ask the browser to keep our storage (prevents iOS/Android evicting the saved login)
if (typeof navigator !== "undefined" && navigator.storage?.persist) {
  navigator.storage.persisted?.().then((already) => {
    if (!already) navigator.storage.persist().catch(() => {});
  }).catch(() => {});
}
