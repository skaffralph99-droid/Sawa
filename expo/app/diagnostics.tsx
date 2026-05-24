import { router, Stack } from "expo-router";
import { ChevronLeft, CheckCircle2, XCircle, Loader2 } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { hasSupabase, supabase } from "@/lib/supabase";
import { useAuth } from "@/constants/auth";

const COLORS = {
  bg: "#0D0B1E",
  card: "#1A1730",
  border: "#2D2A45",
  orange: "#FF6B35",
  pink: "#FF3CAC",
  green: "#22C55E",
  red: "#EF4444",
  textPrimary: "#FFFFFF",
  textSecondary: "#9B9BB4",
} as const;

type CheckStatus = "pending" | "ok" | "fail";
type Check = {
  key: string;
  label: string;
  status: CheckStatus;
  detail?: string;
};

const TABLES: string[] = ["profiles", "plans", "plan_members", "moments", "friendships"];

export default function DiagnosticsScreen() {
  const { user, session, profile } = useAuth();
  const [checks, setChecks] = useState<Check[]>([]);
  const [running, setRunning] = useState<boolean>(false);

  const run = useCallback(async () => {
    setRunning(true);
    const out: Check[] = [];

    // 1. Env vars
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
    out.push({
      key: "env",
      label: "Environment variables",
      status: hasSupabase ? "ok" : "fail",
      detail: hasSupabase
        ? `URL: ${url.slice(0, 40)}…  Key length: ${key.length}`
        : `Missing — url.length=${url.length}, key.length=${key.length}. Bundle was built before env vars were set. Reload the app to pick up the new build.`,
    });
    setChecks([...out]);

    // 2. Auth session
    if (hasSupabase) {
      const { data, error } = await supabase.auth.getSession();
      out.push({
        key: "session",
        label: "Auth session",
        status: error ? "fail" : "ok",
        detail: error
          ? error.message
          : data.session
            ? `Signed in as ${data.session.user.phone ?? data.session.user.id.slice(0, 8)}`
            : "No active session (signed out)",
      });
      setChecks([...out]);
    }

    // 3. Each table reachable
    if (hasSupabase) {
      for (const table of TABLES) {
        const { error } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true })
          .limit(1);
        out.push({
          key: `table-${table}`,
          label: `Table: public.${table}`,
          status: error ? "fail" : "ok",
          detail: error ? error.message : "Reachable",
        });
        setChecks([...out]);
      }
    }

    // 4. Storage bucket
    if (hasSupabase) {
      const { data, error } = await supabase.storage.from("photos").list("", { limit: 1 });
      out.push({
        key: "storage",
        label: "Storage bucket: photos",
        status: error ? "fail" : "ok",
        detail: error ? error.message : `OK (${data?.length ?? 0} entries visible)`,
      });
      setChecks([...out]);
    }

    setRunning(false);
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const handleBack = () => {
    try {
      router.back();
    } catch {
      router.replace("/");
    }
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn}>
            <ChevronLeft size={24} color={COLORS.textPrimary} strokeWidth={2.5} />
          </Pressable>
          <Text style={styles.headerTitle} allowFontScaling={false}>
            Supabase Diagnostics
          </Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>
            This screen runs live checks against your Supabase project so you can see exactly what's
            failing.
          </Text>

          {/* Current user card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Current user</Text>
            <Row label="User ID" value={user?.id ?? "—"} />
            <Row label="Phone" value={user?.phone ?? "—"} />
            <Row label="Profile name" value={profile?.name ?? "—"} />
            <Row label="Session" value={session ? "active" : "none"} />
          </View>

          {/* Checks */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Connection checks</Text>
              <Pressable
                onPress={run}
                disabled={running}
                style={({ pressed }) => [styles.rerunBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.rerunText}>{running ? "Running…" : "Re-run"}</Text>
              </Pressable>
            </View>

            {checks.length === 0 ? (
              <Text style={styles.muted}>Running checks…</Text>
            ) : (
              checks.map((c) => <CheckRow key={c.key} check={c} />)
            )}
          </View>

          {/* Help block */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>If a check failed</Text>
            <Text style={styles.help}>
              • <Text style={styles.bold}>Environment variables</Text> red → set
              EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your project env.
            </Text>
            <Text style={styles.help}>
              • <Text style={styles.bold}>Tables</Text> red ("relation does not exist") → open
              Supabase → SQL Editor → paste the contents of{" "}
              <Text style={styles.mono}>SUPABASE_SETUP.sql</Text> → Run.
            </Text>
            <Text style={styles.help}>
              • <Text style={styles.bold}>Storage</Text> red → the SQL script also creates the
              <Text style={styles.mono}> photos</Text> bucket — re-run it.
            </Text>
            <Text style={styles.help}>
              • <Text style={styles.bold}>OTP "phone provider not enabled"</Text> when signing in →
              Supabase → Authentication → Providers → Phone → turn it on and connect Twilio (or
              MessageBird / Vonage).
            </Text>
            <Text style={styles.help}>
              • <Text style={styles.bold}>Session = none</Text> after verifying OTP → look at the
              error message that pops up on the OTP screen and match it to one of the above.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function CheckRow({ check }: { check: Check }) {
  const Icon =
    check.status === "ok" ? CheckCircle2 : check.status === "fail" ? XCircle : Loader2;
  const color =
    check.status === "ok"
      ? COLORS.green
      : check.status === "fail"
        ? COLORS.red
        : COLORS.textSecondary;
  return (
    <View style={styles.check}>
      <Icon size={18} color={color} strokeWidth={2.5} />
      <View style={styles.checkBody}>
        <Text style={styles.checkLabel}>{check.label}</Text>
        {check.detail ? (
          <Text style={[styles.checkDetail, { color }]} numberOfLines={3}>
            {check.detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  safe: { flex: 1, paddingHorizontal: 20 },
  header: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  backBtn: { width: 40, height: 40, alignItems: "flex-start", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: COLORS.textPrimary },
  scroll: { paddingTop: 12, paddingBottom: 32, gap: 16 },
  subtitle: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 10,
  },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: "800" },
  rerunBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.orange,
  },
  rerunText: { color: COLORS.textPrimary, fontSize: 12, fontWeight: "700" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  rowLabel: { color: COLORS.textSecondary, fontSize: 13 },
  rowValue: { color: COLORS.textPrimary, fontSize: 13, fontWeight: "600", flexShrink: 1 },
  muted: { color: COLORS.textSecondary, fontSize: 13 },
  check: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  checkBody: { flex: 1, gap: 2 },
  checkLabel: { color: COLORS.textPrimary, fontSize: 13, fontWeight: "600" },
  checkDetail: { fontSize: 12, lineHeight: 16 },
  help: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18 },
  bold: { color: COLORS.textPrimary, fontWeight: "700" },
  mono: { fontFamily: "Courier", color: COLORS.orange },
});
