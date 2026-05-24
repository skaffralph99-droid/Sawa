import createContextHook from "@nkzw/create-context-hook";
import type { Session, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { hasSupabase, supabase, type ProfileRow } from "@/lib/supabase";

export type AuthMode = "loading" | "signedOut" | "guest" | "signedIn";

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Bootstrap: load existing session from storage
  useEffect(() => {
    let mounted = true;
    if (!hasSupabase) {
      setIsLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setIsLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Fetch profile whenever user changes
  const user: User | null = session?.user ?? null;
  useEffect(() => {
    if (!user || !hasSupabase) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.log("[auth] profile load error", error.message);
        return;
      }
      setProfile(data as ProfileRow | null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const sendOtp = useCallback(async (phoneE164: string): Promise<{ ok: boolean; error?: string }> => {
    if (!hasSupabase) return { ok: false, error: "supabase-not-configured" };
    const { error } = await supabase.auth.signInWithOtp({ phone: phoneE164 });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, []);

  const verifyOtp = useCallback(
    async (phoneE164: string, code: string): Promise<{ ok: boolean; error?: string }> => {
      if (!hasSupabase) return { ok: false, error: "supabase-not-configured" };
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phoneE164,
        token: code,
        type: "sms",
      });
      if (error) return { ok: false, error: error.message };
      setSession(data.session);
      setIsGuest(false);
      console.log("[auth] signed in, session user:", JSON.stringify(data.session?.user ?? null));
      return { ok: true };
    },
    []
  );

  const devSignIn = useCallback(
    async (): Promise<{ ok: boolean; error?: string }> => {
      if (!hasSupabase) return { ok: false, error: "supabase-not-configured" };
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.log("[auth] anonymous sign-in error:", JSON.stringify(error));
        return { ok: false, error: error.message };
      }
      if (!data.session) {
        console.log("[auth] anonymous sign-in returned no session");
        return { ok: false, error: "no-session" };
      }
      setSession(data.session);
      setIsGuest(false);
      console.log("[auth] anonymous sign-in, session user:", JSON.stringify(data.session.user));
      return { ok: true };
    },
    []
  );

  const saveProfile = useCallback(
    async (input: { name: string; avatarUrl: string | null }): Promise<{ ok: boolean; error?: string }> => {
      if (!user || !hasSupabase) return { ok: false, error: "no-user" };
      const row = {
        id: user.id,
        phone: user.phone ?? null,
        name: input.name,
        avatar_url: input.avatarUrl,
      };
      console.log("[auth] saveProfile upserting row:", JSON.stringify(row));
      const { data, error } = await supabase
        .from("profiles")
        .upsert(row, { onConflict: "id" })
        .select()
        .single();
      if (error) {
        console.log("[auth] saveProfile upsert error:", JSON.stringify(error));
        return { ok: false, error: error.message };
      }
      console.log("[auth] saveProfile upsert result:", JSON.stringify(data));
      console.log("[auth] profile saved, user:", JSON.stringify(user));
      setProfile(data as ProfileRow);
      return { ok: true };
    },
    [user]
  );

  const continueAsGuest = useCallback(() => {
    setIsGuest(true);
  }, []);

  const signOut = useCallback(async () => {
    if (hasSupabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    setSession(null);
    setProfile(null);
    setIsGuest(false);
  }, []);

  const mode: AuthMode = isLoading
    ? "loading"
    : user
      ? "signedIn"
      : isGuest
        ? "guest"
        : "signedOut";

  return {
    mode,
    isLoading,
    isGuest,
    user,
    session,
    profile,
    hasSupabase,
    sendOtp,
    verifyOtp,
    devSignIn,
    saveProfile,
    continueAsGuest,
    signOut,
  };
});
