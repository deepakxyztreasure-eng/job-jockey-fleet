import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Production Staging Supabase Credentials matching the web app
export const SUPABASE_URL = 'https://staging.jodhagroup.app';
export const SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NzU4NzI2MCwiZXhwIjo0OTQzMjYwODYwLCJyb2xlIjoiYW5vbiJ9.KZsCarYscwU7CDT-LrzdXBwwJh0x509M6pIXOREFiwg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Ensures the logged-in driver's auth user ID is linked to the drivers table record
 */
export async function linkDriverAccount(): Promise<void> {
  try {
    await supabase.rpc('link_driver_account');
  } catch (err) {
    console.warn('Driver link error (handled safely):', err);
  }
}
