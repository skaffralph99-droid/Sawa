import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://pxvuufpghdmcnctdecum.supabase.co";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4dnV1ZnBnaGRtY25jdGRlY3VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MTg0MzIsImV4cCI6MjA5NTE5NDQzMn0.ff6SYGB6WPnA7-pN73uoFcjqnYC3YXZF02j7J3SNrwU";

export const hasSupabase: boolean = url.length > 0 && anonKey.length > 0;

if (!hasSupabase) {
  console.log(
    "[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY — running in guest/local mode."
  );
}

/**
 * Single shared Supabase client.
 * Uses AsyncStorage for session persistence on native, default localStorage on web.
 */
export const supabase: SupabaseClient = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder",
  {
    auth: {
      storage: Platform.OS === "web" ? undefined : (AsyncStorage as unknown as never),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === "web",
    },
  }
);

export type ProfileRow = {
  id: string;
  phone: string | null;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
};
