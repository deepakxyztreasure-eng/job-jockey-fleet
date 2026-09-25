// Connected to external Supabase project (Lovable Cloud disabled)
import { createClient } from '@supabase/supabase-js';
// Typed loosely: external database schema differs from generated types

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://staging.jodhagroup.app";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NzU4NzI2MCwiZXhwIjo0OTQzMjYwODYwLCJyb2xlIjoiYW5vbiJ9.KZsCarYscwU7CDT-LrzdXBwwJh0x509M6pIXOREFiwg";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<any>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
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
