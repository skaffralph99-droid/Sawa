import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChevronLeft, Settings } from "lucide-react-native";
import React, { useCallback, useMemo, useRef } from "react";
import {
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
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
import { getUserTimeline, type PlanRow } from "@/lib/plans";
import { useQuery } from "@tanstack/react-query";

const DEFAULT_AVATAR_URL =
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=400&fit=crop&crop=faces";

type TimelineEntry = {
  id: string;
  title: string;
  activity: string;
  people: string;
  date: string;
  tiles: readonly (readonly [string, string])[];
  mosaicUrl?: string | null;
};

const TILE_PALETTE: readonly (readonly [string, string])[] = [
  ["#FF6B35", "#FF3CAC"],
  ["#FF3CAC", "#7B2FF7"],
  ["#7B2FF7", "#FF6B35"],
  ["#FFC857", "#FF3CAC"],
  ["#FF6B35", "#FFC857"],
  ["#7B2FF7", "#FF3CAC"],
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function tilesFor(id: string): readonly (readonly [string, string])[] {
  const seed = Math.abs(hashString(id));
  const out: (readonly [string, string])[] = [];
  for (let i = 0; i < 4; i++) out.push(TILE_PALETTE[(seed + i * 3) % TILE_PALETTE.length]);
  return out;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

type Stat = { value: string; label: string };

type PressableScaleProps = {
  onPress?: () => void;
  children: React.ReactNode;
  style?: any;
};

function PressableScale({ onPress, children, style }: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = useCallback(() => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 7, tension: 200 }).start();
  }, [scale]);
  const onOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 180 }).start();
  }, [scale]);
  const handle = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    onPress?.();
  }, [onPress]);
  return (
    <Pressable onPressIn={onIn} onPressOut={onOut} onPress={handle}>
      <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}

function StatCard({ stat }: { stat: Stat }) {
  const t = useT();
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{t(stat.value)}</Text>
      <View style={styles.statUnderline}>
        <LinearGradient
          colors={[Colors.primary, Colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <Text style={styles.statLabel}>{t(stat.label)}</Text>
    </View>
  );
}

function TimelineRow({ entry }: { entry: TimelineEntry }) {
  const t = useT();
  return (
    <PressableScale
      onPress={() => router.push({ pathname: "/mosaic", params: { planId: entry.id } })}
      style={styles.timelineCard}
    >
      <View style={styles.timelineInner}>
        <View style={styles.thumbWrap}>
          {entry.mosaicUrl ? (
            <Image source={{ uri: entry.mosaicUrl }} style={{ width: "100%", height: "100%" }} />
          ) : (
            <View style={styles.thumbGrid}>
              {entry.tiles.map((c, i) => (
                <LinearGradient
                  key={i}
                  colors={[c[0], c[1]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.thumbTile}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.timelineBody}>
          <Text style={styles.timelineTitle} numberOfLines={1}>
            {t(entry.title)}
          </Text>
          <Text style={styles.timelineMeta} numberOfLines={1}>
            {t(entry.activity)} · {t(entry.people)}
          </Text>
          <Text style={styles.timelineDate}>{t(entry.date)}</Text>
        </View>

        <View style={styles.chevWrap}>
          <ChevronLeft size={18} color={Colors.textMuted} strokeWidth={2.4} />
        </View>
      </View>
    </PressableScale>
  );
}

type TimelinePlan = PlanRow & { memberCount: number };

export default function MeScreen() {
  const t = useT();
  const { profile, user, mode } = useAuth();
  const { plans: localPlans } = useLocalPlans();
  const canSync = hasSupabase && mode === "signedIn" && !!user;

  const timelineQuery = useQuery<TimelinePlan[]>({
    queryKey: ["my-timeline", user?.id ?? null],
    enabled: canSync,
    queryFn: async () => {
      if (!user) return [];
      const { plans, error } = await getUserTimeline(user.id);
      if (error) console.log("[me] timeline error", error);
      return plans;
    },
  });

  const plansCountQuery = useQuery<number>({
    queryKey: ["my-plans-count", user?.id ?? null],
    enabled: canSync,
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("plans")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id);
      if (error) {
        console.log("[me] plans count error", error.message);
        return 0;
      }
      return count ?? 0;
    },
  });

  const friendsCountQuery = useQuery<number>({
    queryKey: ["my-friends-count", user?.id ?? null],
    enabled: canSync,
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase
        .from("friendships")
        .select("user_id, friend_id, status")
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq("status", "accepted");
      if (error) {
        console.log("[me] friends count error", error.message);
        return 0;
      }
      const ids = new Set<string>();
      (data ?? []).forEach((r: { user_id: string; friend_id: string }) => {
        const other = r.user_id === user.id ? r.friend_id : r.user_id;
        ids.add(other);
      });
      return ids.size;
    },
  });

  const timelinePlans = timelineQuery.data ?? [];
  const planCount = (plansCountQuery.data ?? 0) + localPlans.length;
  const momentsCount = timelinePlans.filter((p) => p.mosaic_url).length;
  const stats: Stat[] = useMemo(
    () => [
      { value: String(planCount), label: "Plans" },
      { value: String(momentsCount), label: "Moments" },
      { value: String(friendsCountQuery.data ?? 0), label: "Friends" },
    ],
    [planCount, momentsCount, friendsCountQuery.data]
  );
  const entries: TimelineEntry[] = useMemo(
    () =>
      timelinePlans.map((p) => ({
        id: p.id,
        title: p.title || "✨ Plan",
        activity: p.activity_type ?? "",
        people: `${p.memberCount} ${p.memberCount === 1 ? "person" : "people"}`,
        date: formatDate(p.created_at),
        tiles: tilesFor(p.id),
        mosaicUrl: p.mosaic_url,
      })),
    [timelinePlans]
  );

  const displayName = profile?.name?.trim() || t("أنا");
  const displayPhone = user?.phone ? `+${user.phone}` : "";
  const avatarUri = profile?.avatar_url ?? DEFAULT_AVATAR_URL;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerSide} />
          <Text style={styles.headerTitle}>{t("أنا")}</Text>
          <Pressable
            style={styles.headerSide}
            hitSlop={12}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
              router.push("/settings");
            }}
          >
            <Settings size={22} color={Colors.textMuted} strokeWidth={2.2} />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Profile section */}
          <View style={styles.profileSection}>
            <View style={styles.avatarOuter}>
              <LinearGradient
                colors={[Colors.primary, Colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarGradient}
              >
                <View style={styles.avatarInner}>
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                </View>
              </LinearGradient>
            </View>

            <Text style={styles.name}>{displayName}</Text>
            {displayPhone.length > 0 ? <Text style={styles.phone}>{displayPhone}</Text> : null}
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            {stats.map((s) => (
              <StatCard key={s.label} stat={s} />
            ))}
          </View>

          {/* Timeline title row */}
          <View style={styles.timelineHeader}>
            <Pressable hitSlop={8}>
              <Text style={styles.allText}>{t("الكل")}</Text>
            </Pressable>
            <Text style={styles.sectionTitle}>{t("ذكرياتك")}</Text>
          </View>

          {/* Timeline list */}
          <View style={styles.timelineList}>
            {entries.length === 0 ? (
              <View style={styles.emptyTimeline}>
                <Text style={styles.emptyTimelineTitle}>{t("ما في ذكريات بعد")}</Text>
                <Text style={styles.emptyTimelineSub}>{t("عمل بلان وصور لحظاتك")}</Text>
              </View>
            ) : (
              entries.map((e) => <TimelineRow key={e.id} entry={e} />)
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const AVATAR = 88;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  safe: { flex: 1 },

  header: {
    height: 52,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerSide: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "800" as const,
    writingDirection: "rtl",
  },

  scrollContent: { paddingBottom: 40 },

  // Profile
  profileSection: {
    alignItems: "center",
    marginTop: 16,
    paddingHorizontal: 24,
  },
  avatarOuter: {
    width: AVATAR + 6,
    height: AVATAR + 6,
    borderRadius: (AVATAR + 6) / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.secondary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  avatarGradient: {
    width: AVATAR + 6,
    height: AVATAR + 6,
    borderRadius: (AVATAR + 6) / 2,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInner: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    overflow: "hidden",
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.bg,
  },
  avatarImg: { width: "100%", height: "100%" },
  name: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: "800" as const,
    marginTop: 12,
    writingDirection: "rtl",
  },
  phone: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: "600" as const,
    marginTop: 4,
    letterSpacing: 0.3,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 22,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2A2547",
  },
  statValue: {
    color: Colors.primary,
    fontSize: 22,
    fontWeight: "800" as const,
    letterSpacing: 0.2,
  },
  statUnderline: {
    marginTop: 4,
    width: 22,
    height: 2,
    borderRadius: 1,
    overflow: "hidden",
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "700" as const,
    marginTop: 6,
    writingDirection: "rtl",
  },

  // Timeline header
  timelineHeader: {
    marginTop: 26,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "800" as const,
    textAlign: "right",
    writingDirection: "rtl",
  },
  allText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "800" as const,
    writingDirection: "rtl",
  },

  // Timeline list
  timelineList: {
    marginTop: 12,
    paddingHorizontal: 16,
  },
  timelineCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#2A2547",
  },
  timelineInner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  thumbWrap: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: Colors.bg,
  },
  thumbGrid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  thumbTile: {
    width: "50%",
    height: "50%",
    borderWidth: 1,
    borderColor: Colors.bg,
  },
  timelineBody: {
    flex: 1,
    justifyContent: "center",
  },
  timelineTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "800" as const,
    textAlign: "right",
    writingDirection: "rtl",
  },
  timelineMeta: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "600" as const,
    marginTop: 4,
    textAlign: "right",
    writingDirection: "rtl",
  },
  timelineDate: {
    color: Colors.textDim,
    fontSize: 11,
    fontWeight: "600" as const,
    marginTop: 4,
    textAlign: "right",
    writingDirection: "rtl",
  },
  chevWrap: {
    width: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTimeline: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyTimelineTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "800" as const,
    textAlign: "center",
    writingDirection: "rtl",
  },
  emptyTimelineSub: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: "600" as const,
    marginTop: 6,
    textAlign: "center",
    writingDirection: "rtl",
  },
});
