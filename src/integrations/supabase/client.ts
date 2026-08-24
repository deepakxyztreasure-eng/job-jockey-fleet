// Connected to external Supabase project (Lovable Cloud disabled)
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || "http://141.136.44.163:8000";
const SUPABASE_PUBLISHABLE_KEY = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NzM3OTcyMCwiZXhwIjo0OTQzMDUzMzIwLCJyb2xlIjoiYW5vbiJ9.dzUnUL5xtQ-hbcenGt-MLkhsJwMv8u1tTZcmJo5Tlwk";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    
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
