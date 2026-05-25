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
    async (phoneE164?: string): Promise<{ ok: boolean; error?: string }> => {
      if (!hasSupabase) return { ok: false, error: "supabase-not-configured" };

      // Use the phone number passed in (from OTP screen) or default test number
      const phone = phoneE164 ?? "+96170000001";

      console.log("[auth] devSignIn — sending OTP to", phone);

      // Step 1: Send OTP
      const { error: otpErr } = await supabase.auth.signInWithOtp({ phone });
      if (otpErr) {
        console.log("[auth] devSignIn OTP send error:", otpErr.message);
        // If sending OTP fails — try anonymous as last resort
        const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
        if (!anonError && anonData.session) {
          setSession(anonData.session);
          setIsGuest(false);
          console.log("[auth] devSignIn fallback anonymous OK, uid:", anonData.session.user.id);
          return { ok: true };
        }
        return { ok: false, error: otpErr.message };
      }

      // Step 2: Verify with 123456
      const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
        phone,
        token: "123456",
        type: "sms",
      });

      if (verifyErr || !verifyData.session) {
        console.log("[auth] devSignIn OTP verify error:", verifyErr?.message);
        // Fallback to anonymous
        const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
        if (!anonError && anonData.session) {
          setSession(anonData.session);
          setIsGuest(false);
          console.log("[auth] devSignIn fallback anonymous OK, uid:", anonData.session.user.id);
          return { ok: true };
        }
        return { ok: false, error: verifyErr?.message ?? "verify-failed" };
      }

      setSession(verifyData.session);
      setIsGuest(false);
      console.log("[auth] devSignIn OK, uid:", verifyData.session.user.id, "phone:", phone);
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
