import { LinearGradient } from "expo-linear-gradient";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  ChevronLeft,
  Share2,
  MapPin,
  CalendarDays,
  Users,
  Camera,
} from "lucide-react-native";
import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useT } from "@/constants/i18n";
import { useAuth } from "@/constants/auth";
import { useLocalPlans } from "@/constants/localPlans";
import { supabase, hasSupabase } from "@/lib/supabase";
import { joinPlan, leavePlan } from "@/lib/plans";
import { checkAndFirePlanReal } from "@/lib/planreal";
import { sendLocalPlanRealNotification } from "@/lib/notifications";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type Tint = readonly [string, string];

type PlanMember = {
  id: string;
  name: string;
  joined: string;
  initial: string;
  tint: Tint;
  isCreator?: boolean;
};

type PlanDetail = {
  id: string;
  title: string;
  emoji: string;
  kindTint: Tint;
  location: string;
  dateTime: string;
  spots: string;
  members: PlanMember[];
};

const FALLBACK_TINT: Tint = ["#FF6B35", "#FF3CAC"];

function emptyPlan(id: string): PlanDetail {
  return {
    id,
    title: "",
    emoji: "✨",
    kindTint: FALLBACK_TINT,
    location: "",
    dateTime: "",
    spots: "",
    members: [],
  };
}

function Avatar({ initial, tint, size = 44 }: { initial: string; tint: Tint; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <LinearGradient colors={tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Text style={{ color: "#fff", fontWeight: "800" as const, fontSize: size * 0.4 }}>{initial}</Text>
    </View>
  );
}

function PressableScale({
  onPress,
  children,
  style,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  style?: object;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPressIn={() => {
          Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 60, bounciness: 0 }).start();
        }}
        onPressOut={() => {
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
        }}
        onPress={() => {
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPress?.();
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export default function PlanScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ id?: string }>();
  const planId = (params.id ?? "") as string;
  const isRemote = hasSupabase && isUuid(planId);
  const isLocal = planId.startsWith("local_");
  const { user, mode } = useAuth();
  const { plans: localPlans } = useLocalPlans();
  const queryClient = useQueryClient();

  const remoteQuery = useQuery({
    queryKey: ["plan", planId],
    enabled: isRemote,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("id, owner_id, title, location, privacy, created_at, owner:profiles!plans_owner_id_fkey(name), members:plan_members(user_id, status, created_at, profile:profiles!plan_members_user_id_fkey(name))")
        .eq("id", planId)
        .maybeSingle();
      if (error) {
        console.log("[plan] query error", error.message);
        return null;
      }
      return data;
    },
  });

  const plan = useMemo<PlanDetail>(() => {
    if (isRemote && remoteQuery.data) {
      const r = remoteQuery.data as any;
      const ownerName = r.owner?.name?.trim() || "\u0634\u062e\u0635";
      const members: PlanMember[] = (r.members ?? []).map((m: any, i: number): PlanMember => {
        const name = m.profile?.name?.trim() || "\u0639\u0636\u0648";
        const palettes: Tint[] = [
          ["#FF6B35", "#FF3CAC"],
          ["#FF3CAC", "#7B2FF7"],
          ["#7B2FF7", "#FF6B35"],
          ["#FFC857", "#FF3CAC"],
        ];
        return {
          id: m.user_id,
          name,
          joined: m.user_id === r.owner_id ? "\u0639\u0645\u0644 \u0627\u0644\u0628\u0644\u0627\u0646" : "\u0627\u0646\u0636\u0645",
          initial: name.charAt(0) || "\u0639",
          tint: palettes[i % palettes.length],
          isCreator: m.user_id === r.owner_id,
        };
      });
      return {
        id: r.id,
        title: r.title,
        emoji: "\u2728",
        kindTint: ["#FF6B35", "#FF3CAC"] as Tint,
        location: r.location ?? "",
        dateTime: "",
        spots: `${members.length} \u0623\u0634\u062e\u0627\u0635`,
        members: members.length > 0 ? members : [{ id: r.owner_id, name: ownerName, joined: "\u0639\u0645\u0644 \u0627\u0644\u0628\u0644\u0627\u0646", initial: ownerName.charAt(0) || "\u0639", tint: ["#FF6B35", "#FF3CAC"], isCreator: true }],
      };
    }
    if (isLocal) {
      const lp = localPlans.find((p) => p.id === planId);
      if (lp) {
        const dateTimeParts: string[] = [];
        if (lp.date) dateTimeParts.push(lp.date);
        if (lp.time) dateTimeParts.push(lp.time);
        return {
          id: lp.id,
          title: lp.title,
          emoji: lp.emoji || "✨",
          kindTint: FALLBACK_TINT,
          location: lp.location,
          dateTime: dateTimeParts.join(" · "),
          spots: `1 / ${lp.maxPeople}`,
          members: [
            {
              id: "creator",
              name: lp.creatorName,
              joined: "عمل البلان",
              initial: lp.creatorInitial,
              tint: FALLBACK_TINT,
              isCreator: true,
            },
          ],
        };
      }
    }
    return emptyPlan(planId);
  }, [isRemote, remoteQuery.data, isLocal, localPlans, planId]);

  const initiallyJoined = useMemo<boolean>(() => {
    if (!isRemote || !user || !remoteQuery.data) return false;
    const members = (remoteQuery.data as any).members ?? [];
    return members.some((m: any) => m.user_id === user.id);
  }, [isRemote, user, remoteQuery.data]);

  const [joined, setJoined] = useState<boolean>(false);
  useEffect(() => {
    setJoined(initiallyJoined);
  }, [initiallyJoined]);

  const onBack = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try { router.back(); } catch { router.replace("/home"); }
  }, []);

  const onShare = useCallback(async () => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    const url = `https://sawa.app/plan/${plan.id}`;
    const message = `${plan.title}\n${plan.location}${plan.dateTime ? ` · ${plan.dateTime}` : ""}\n${url}`;
    try {
      if (Platform.OS === "web") {
        const nav: any = typeof navigator !== "undefined" ? navigator : null;
        if (nav?.share) {
          await nav.share({ title: plan.title, text: message, url });
        } else if (nav?.clipboard?.writeText) {
          await nav.clipboard.writeText(url);
        }
        return;
      }
      await Share.share({ message, url, title: plan.title });
    } catch (e) {
      console.log("[plan] share error", e);
    }
  }, [plan.id, plan.title, plan.location, plan.dateTime]);

  const onToggleJoin = useCallback(async () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(
        joined ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    }
    const next = !joined;
    setJoined(next);

    if (!isRemote || !user || mode !== "signedIn") return;

    if (next) {
      const { ok, error } = await joinPlan(planId, user.id);
      if (!ok && error && !/duplicate/i.test(error)) {
        console.log("[plan] join error", error);
        setJoined(false);
        return;
      }
    } else {
      const { ok, error } = await leavePlan(planId, user.id);
      if (!ok) {
        console.log("[plan] leave error", error);
        setJoined(true);
        return;
      }
    }
    await queryClient.invalidateQueries({ queryKey: ["plan", planId] });
    await queryClient.invalidateQueries({ queryKey: ["plans"] });
  }, [joined, isRemote, user, mode, planId, queryClient]);

  // Pulsing glow behind PlanReal card
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] });

  // Poll for PlanReal fire moment
  useEffect(() => {
    if (!isRemote || !planId) return;
    let cancelled = false;
    const tick = async () => {
      const { shouldFire } = await checkAndFirePlanReal(planId);
      if (cancelled) return;
      if (shouldFire) {
        try { await sendLocalPlanRealNotification(planId); } catch (e) { console.log("[plan] notif error", e); }
        router.push({ pathname: "/camera", params: { planId } });
      }
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isRemote, planId]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Ambient background glow */}
      <View pointerEvents="none" style={styles.ambient}>
        <LinearGradient
          colors={["rgba(255,107,53,0.18)", "rgba(255,60,172,0.08)", "rgba(13,11,30,0)"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <SafeAreaView edges={["top"]} style={{ backgroundColor: "transparent" }}>
        <View style={styles.header}>
          <Pressable onPress={onBack} hitSlop={12} style={styles.headerBtn}>
            <ChevronLeft size={26} color="#fff" strokeWidth={2.4} />
          </Pressable>
          <Text numberOfLines={1} style={styles.headerTitle}>
            {t(plan.title)}
          </Text>
          <Pressable onPress={onShare} hitSlop={12} style={styles.headerBtn}>
            <LinearGradient
              colors={[Colors.primary, Colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.shareGradientWrap}
            >
              <View style={styles.shareInner}>
                <Share2 size={18} color={Colors.secondary} strokeWidth={2.4} />
              </View>
            </LinearGradient>
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.kindCircle}>
              <LinearGradient colors={plan.kindTint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Text style={styles.kindEmoji}>{plan.emoji}</Text>
            </View>
            <View style={styles.liveDotWrap}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>{t("مباشر")}</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>{t(plan.title)}</Text>

          <View style={styles.heroInfo}>
            <InfoRow icon={<MapPin size={16} color={Colors.textMuted} strokeWidth={2.2} />} text={t(plan.location)} />
            <InfoRow icon={<CalendarDays size={16} color={Colors.textMuted} strokeWidth={2.2} />} text={t(plan.dateTime)} />
            <InfoRow icon={<Users size={16} color={Colors.textMuted} strokeWidth={2.2} />} text={t(plan.spots)} />
          </View>
        </View>

        {/* PlanReal status card — tap to open camera */}
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            router.push({ pathname: "/camera", params: { planId: plan.id } });
          }}
          style={styles.planRealWrap}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.planRealGlow,
              { opacity: glowOpacity, transform: [{ scale: glowScale }] },
            ]}
          >
            <LinearGradient
              colors={["rgba(255,107,53,0.35)", "rgba(255,60,172,0.25)", "rgba(123,47,247,0.0)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <LinearGradient
            colors={[Colors.primary, Colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.planRealBorder}
          >
            <View style={styles.planRealInner}>
              <View style={styles.planRealIconWrap}>
                <LinearGradient
                  colors={["rgba(255,107,53,0.18)", "rgba(255,60,172,0.18)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Camera size={32} color="#fff" strokeWidth={2.2} />
              </View>

              <Text style={styles.planRealTitle}>{t("PlanReal رح يصير بوقت عشوائي")}</Text>
              <Text style={styles.planRealSub}>{t("الصور بتنلتقط بوقت البلان · كونوا جاهزين 👀")}</Text>
            </View>
          </LinearGradient>
        </Pressable>

        {/* Members */}
        <Text style={styles.sectionTitle}>{t("مين جاي؟")}</Text>
        <View style={styles.membersList}>
          {plan.members.map((m, i) => (
            <View
              key={m.id}
              style={[
                styles.memberRow,
                i === plan.members.length - 1 ? { borderBottomWidth: 0 } : null,
              ]}
            >
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <View style={styles.memberNameRow}>
                  {m.isCreator ? (
                    <LinearGradient
                      colors={[Colors.primary, Colors.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.creatorBadge}
                    >
                      <Text style={styles.creatorBadgeText}>{t("المنظم")}</Text>
                    </LinearGradient>
                  ) : null}
                  <Text style={styles.memberName}>{t(m.name)}</Text>
                </View>
                <Text style={styles.memberJoined}>{t(m.joined)}</Text>
              </View>
              <Avatar initial={m.initial} tint={m.tint} size={44} />
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <SafeAreaView edges={["bottom"]} style={styles.bottomBar}>
        <LinearGradient
          colors={["rgba(13,11,30,0)", "rgba(13,11,30,0.95)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.bottomFade}
          pointerEvents="none"
        />
        {joined ? (
          <Pressable onPress={onToggleJoin} style={styles.leaveBtn}>
            <Text style={styles.leaveBtnText}>{t("اترك البلان")}</Text>
          </Pressable>
        ) : (
          <PressableScale onPress={onToggleJoin} style={{ width: "100%" }}>
            <View style={styles.joinBtn}>
              <LinearGradient
                colors={[Colors.primary, Colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.joinBtnText}>{t("انضم للبلان")}</Text>
            </View>
          </PressableScale>
        )}
      </SafeAreaView>
    </View>
  );
}

function InfoRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoText}>{text}</Text>
      {icon}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  ambient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 340,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
    gap: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 18,
    fontWeight: "800" as const,
    textAlign: "center",
    writingDirection: "rtl",
  },
  shareGradientWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    padding: 1.5,
  },
  shareInner: {
    flex: 1,
    width: "100%",
    borderRadius: 17,
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },

  // Hero
  heroCard: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroTopRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kindCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  kindEmoji: { fontSize: 24 },
  liveDotWrap: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,107,53,0.14)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,107,53,0.45)",
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  liveText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: "800" as const,
    writingDirection: "rtl",
  },
  heroTitle: {
    marginTop: 14,
    color: "#fff",
    fontSize: 22,
    fontWeight: "800" as const,
    textAlign: "right",
    writingDirection: "rtl",
  },
  heroInfo: {
    marginTop: 14,
    gap: 10,
  },
  infoRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: "600" as const,
    writingDirection: "rtl",
    textAlign: "right",
    flex: 1,
  },

  // PlanReal card
  planRealWrap: {
    marginTop: 16,
    marginHorizontal: 16,
    position: "relative",
  },
  planRealGlow: {
    position: "absolute",
    left: -20,
    right: -20,
    top: -20,
    bottom: -20,
    borderRadius: 32,
    overflow: "hidden",
  },
  planRealBorder: {
    borderRadius: 16,
    padding: 1.5,
  },
  planRealInner: {
    backgroundColor: Colors.card,
    borderRadius: 14.5,
    padding: 20,
    alignItems: "center",
  },
  planRealIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,107,53,0.35)",
  },
  planRealTitle: {
    marginTop: 14,
    color: "#fff",
    fontSize: 15,
    fontWeight: "800" as const,
    textAlign: "center",
    writingDirection: "rtl",
  },
  planRealSub: {
    marginTop: 6,
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: "600" as const,
    textAlign: "center",
    writingDirection: "rtl",
  },

  // Members
  sectionTitle: {
    marginTop: 24,
    marginHorizontal: 16,
    color: "#fff",
    fontSize: 16,
    fontWeight: "800" as const,
    textAlign: "right",
    writingDirection: "rtl",
  },
  membersList: {
    marginTop: 12,
    marginHorizontal: 16,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
  },
  memberRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  memberNameRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  memberName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700" as const,
    writingDirection: "rtl",
    textAlign: "right",
  },
  creatorBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  creatorBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800" as const,
    writingDirection: "rtl",
  },
  memberJoined: {
    marginTop: 2,
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "600" as const,
    writingDirection: "rtl",
    textAlign: "right",
  },

  // Bottom
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  bottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: -40,
  },
  joinBtn: {
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.secondary,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  joinBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800" as const,
    writingDirection: "rtl",
  },
  leaveBtn: {
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,60,172,0.06)",
  },
  leaveBtnText: {
    color: Colors.secondary,
    fontSize: 16,
    fontWeight: "800" as const,
    writingDirection: "rtl",
  },
});
