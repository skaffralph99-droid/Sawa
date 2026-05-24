import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  Bell,
  Plus,
  Search,
  Home as HomeIcon,
  User as UserIcon,
  MapPin,
  Clock,
  Users,
  Sparkles,
} from "lucide-react-native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useT } from "@/constants/i18n";
import { useAuth } from "@/constants/auth";
import { useLocalPlans, type LocalPlan } from "@/constants/localPlans";
import { supabase, hasSupabase } from "@/lib/supabase";
import { fetchActivePlans } from "@/lib/plans";
import { useQuery } from "@tanstack/react-query";

const DEFAULT_AVATAR_URL =
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop&crop=faces";

type PlanKind = "beach" | "dinner" | "football" | "hangout" | "party" | "coffee";

type Member = { initial: string; tint: readonly [string, string] };

type Plan = {
  id: string;
  emoji: string;
  kindTint: readonly [string, string];
  creator: { name: string; role: string; tint: readonly [string, string]; initial: string };
  title: string;
  location: string;
  time: string;
  spots: string;
  members: Member[];
  extraCount: number;
  ago: string;
};



const TABS = [
  { id: "plans", label: "Plans 🎯" },
  { id: "moments", label: "Moments ✨" },
] as const;

const FILTERS = ["All", "Friends", "Nearby"] as const;

type Moment = {
  id: string;
  title: string;
  people: string;
  when: string;
  location: string;
  tiles: readonly (readonly [string, string])[];
};

const MOMENT_TILE_PALETTES: readonly (readonly [string, string])[] = [
  ["#FF6B35", "#FF3CAC"],
  ["#FF3CAC", "#7B2FF7"],
  ["#7B2FF7", "#FF6B35"],
  ["#FFC857", "#FF3CAC"],
  ["#FF6B35", "#FFC857"],
  ["#7B2FF7", "#FF3CAC"],
  ["#FF3CAC", "#FFC857"],
  ["#FF6B35", "#7B2FF7"],
  ["#FFC857", "#7B2FF7"],
];

function makeTiles(seed: number, count: number): readonly (readonly [string, string])[] {
  const out: (readonly [string, string])[] = [];
  for (let i = 0; i < count; i++) {
    out.push(MOMENT_TILE_PALETTES[(seed + i * 3) % MOMENT_TILE_PALETTES.length]);
  }
  return out;
}



function MosaicTiles({ tiles, cols }: { tiles: readonly (readonly [string, string])[]; cols: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, { flexDirection: "row", flexWrap: "wrap" }]}>
      {tiles.map((t, i) => (
        <View key={i} style={{ width: `${100 / cols}%`, aspectRatio: 1, overflow: "hidden" }}>
          <LinearGradient
            colors={t}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ))}
    </View>
  );
}

function MomentOverlay({ moment, size }: { moment: Moment; size: "sm" | "lg" }) {
  const t = useT();
  const titleSize = size === "lg" ? 18 : 12;
  const metaSize = size === "lg" ? 12 : 10;
  return (
    <>
      <LinearGradient
        colors={["rgba(13,11,30,0)", "rgba(13,11,30,0.55)", "rgba(13,11,30,0.95)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFill, { top: size === "lg" ? "45%" : "55%" }]}
      />
      <View style={{ position: "absolute", left: size === "lg" ? 16 : 10, right: size === "lg" ? 16 : 10, bottom: size === "lg" ? 14 : 10 }}>
        <Text
          numberOfLines={1}
          style={{
            color: "#fff",
            fontSize: titleSize,
            fontWeight: "800" as const,
            textAlign: "right",
            writingDirection: "rtl",
          }}
        >
          {t(moment.title)}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: Colors.textMuted,
            fontSize: metaSize,
            fontWeight: "600" as const,
            marginTop: 2,
            textAlign: "right",
            writingDirection: "rtl",
          }}
        >
          {t(moment.people)} · {t(moment.when)}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: Colors.textMuted,
            fontSize: metaSize,
            fontWeight: "600" as const,
            marginTop: 1,
            textAlign: "right",
            writingDirection: "rtl",
          }}
        >
          📍 {t(moment.location)}
        </Text>
      </View>
    </>
  );
}

function FeaturedMoment({ moment }: { moment: Moment }) {
  const t = useT();
  return (
    <PressableScale onPress={() => console.log("moment", moment.id)} style={{ marginBottom: 12 }}>
      <View style={styles.featuredWrap}>
        <LinearGradient
          colors={[Colors.primary, Colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.featuredInner}>
          <MosaicTiles tiles={moment.tiles} cols={4} />
          <MomentOverlay moment={moment} size="lg" />
          <View style={styles.featuredBadge}>
            <Sparkles size={11} color="#fff" strokeWidth={2.6} />
            <Text style={styles.featuredBadgeText}>{t("الأحدث")}</Text>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

function MomentGridCard({ moment }: { moment: Moment }) {
  return (
    <PressableScale onPress={() => console.log("moment", moment.id)} style={styles.gridCardWrap}>
      <View style={styles.gridCard}>
        <MosaicTiles tiles={moment.tiles} cols={3} />
        <MomentOverlay moment={moment} size="sm" />
      </View>
    </PressableScale>
  );
}

function MomentsEmpty({ onCreate }: { onCreate: () => void }) {
  const t = useT();
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyShapeWrap}>
        <LinearGradient
          colors={[Colors.primary, Colors.secondary, Colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.emptyShape}
        />
        <View style={styles.emptyShapeInner}>
          <Sparkles size={28} color="#fff" strokeWidth={2.4} />
        </View>
      </View>
      <Text style={styles.emptyTitle}>{t("ما في لحظات بعد")}</Text>
      <Text style={styles.emptySub}>{t("عمل أول plan وعيش اللحظة")}</Text>
      <Pressable
        onPress={() => {
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onCreate();
        }}
        style={styles.emptyBtn}
      >
        <LinearGradient
          colors={[Colors.primary, Colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.emptyBtnText}>{t("عمل plan هلق")}</Text>
      </Pressable>
    </View>
  );
}

function Avatar({ initial, tint, size = 28, borderColor }: { initial: string; tint: readonly [string, string]; size?: number; borderColor?: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: borderColor ? 2 : 0,
        borderColor: borderColor ?? "transparent",
      }}
    >
      <LinearGradient colors={tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Text style={{ color: "#fff", fontWeight: "800" as const, fontSize: size * 0.42 }}>{initial}</Text>
    </View>
  );
}

function PressableScale({ children, onPress, style }: { children: React.ReactNode; onPress?: () => void; style?: any }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, friction: 7 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start()}
        onPress={() => {
          if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
          onPress?.();
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const t = useT();
  return (
    <PressableScale onPress={() => router.push({ pathname: "/plan", params: { id: plan.id } })} style={styles.cardWrap}>
      <View style={styles.card}>
        {/* Top row */}
        <View style={styles.cardTopRow}>
          <View style={styles.kindCircle}>
            <LinearGradient colors={plan.kindTint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Text style={styles.kindEmoji}>{plan.emoji}</Text>
          </View>

          <View style={styles.creatorBlock}>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.creatorName}>{t(plan.creator.name)}</Text>
              <Text style={styles.creatorRole}>{t(plan.creator.role)}</Text>
            </View>
            <Avatar initial={plan.creator.initial} tint={plan.creator.tint} size={32} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.planTitle}>{t(plan.title)}</Text>

        {/* Info row */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <MapPin size={13} color={Colors.textMuted} strokeWidth={2.2} />
            <Text style={styles.infoText}>{t(plan.location)}</Text>
          </View>
          <View style={styles.infoDot} />
          <View style={styles.infoItem}>
            <Clock size={13} color={Colors.textMuted} strokeWidth={2.2} />
            <Text style={styles.infoText}>{t(plan.time)}</Text>
          </View>
          <View style={styles.infoDot} />
          <View style={styles.infoItem}>
            <Users size={13} color={Colors.textMuted} strokeWidth={2.2} />
            <Text style={styles.infoText}>{t(plan.spots)}</Text>
          </View>
        </View>

        {/* Members */}
        <View style={styles.memberRow}>
          {plan.members.slice(0, 4).map((m, i) => (
            <View key={i} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i }}>
              <Avatar initial={m.initial} tint={m.tint} size={28} borderColor={Colors.card} />
            </View>
          ))}
          {plan.extraCount > 0 ? (
            <View style={{ marginLeft: -8, zIndex: 1 }}>
              <Avatar initial={`+${plan.extraCount}`} tint={Colors.gradient.slice(0, 2) as unknown as readonly [string, string]} size={28} borderColor={Colors.card} />
            </View>
          ) : null}
        </View>

        {/* Bottom row */}
        <View style={styles.bottomRow}>
          <Text style={styles.ago}>{t(plan.ago)}</Text>
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.push({ pathname: "/plan", params: { id: plan.id } });
            }}
            style={styles.joinBtn}
          >
            <LinearGradient colors={[Colors.primary, Colors.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            <Text style={styles.joinBtnText}>{t("انضم")}</Text>
          </Pressable>
        </View>
      </View>
    </PressableScale>
  );
}

type RemotePlanRow = {
  id: string;
  owner_id: string;
  title: string;
  location: string | null;
  privacy: string;
  created_at: string;
};

const MEMBER_PALETTES: readonly (readonly [string, string])[] = [
  ["#FF6B35", "#FF3CAC"],
  ["#FF3CAC", "#7B2FF7"],
  ["#7B2FF7", "#FF6B35"],
  ["#FFC857", "#FF3CAC"],
  ["#FF6B35", "#FFC857"],
];

function localPlanToPlan(lp: LocalPlan): Plan {
  const tint = MEMBER_PALETTES[Math.abs(hashString(lp.id)) % MEMBER_PALETTES.length] as readonly [string, string];
  const metaParts: string[] = [];
  if (lp.date) metaParts.push(lp.date);
  if (lp.time) metaParts.push(lp.time);
  const timeLabel = metaParts.length > 0 ? metaParts.join(" · ") : timeAgo(new Date(lp.createdAt).toISOString());
  return {
    id: lp.id,
    emoji: lp.emoji || "✨",
    kindTint: tint,
    creator: {
      name: lp.creatorName,
      role: "عامل البلان",
      tint,
      initial: lp.creatorInitial,
    },
    title: lp.title,
    location: lp.location,
    time: timeLabel,
    spots: `1 / ${lp.maxPeople}`,
    members: [{ initial: lp.creatorInitial, tint }],
    extraCount: 0,
    ago: timeAgo(new Date(lp.createdAt).toISOString()),
  };
}

function remoteToPlan(row: RemotePlanRow, ownerName: string, memberCount: number): Plan {
  const name = ownerName?.trim() || "شخص";
  const initial = name.charAt(0) || "\u0634";
  const tint = MEMBER_PALETTES[Math.abs(hashString(row.id)) % MEMBER_PALETTES.length] as readonly [string, string];
  return {
    id: row.id,
    emoji: extractEmoji(row.title) || "\u2728",
    kindTint: tint,
    creator: { name, role: "\u0639\u0627\u0645\u0644 \u0627\u0644\u0628\u0644\u0627\u0646", tint, initial },
    title: stripLeadingEmoji(row.title),
    location: row.location ?? "",
    time: timeAgo(row.created_at),
    spots: `${memberCount}`,
    members: [],
    extraCount: 0,
    ago: timeAgo(row.created_at),
  };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function extractEmoji(s: string): string {
  const match = s.match(/^(\p{Extended_Pictographic})/u);
  return match?.[1] ?? "";
}

function stripLeadingEmoji(s: string): string {
  return s.replace(/^(\p{Extended_Pictographic})\s*/u, "");
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "\u0627\u0644\u0622\u0646";
  if (mins < 60) return `\u0645\u0646\u0630 ${mins} \u062f\u0642\u064a\u0642\u0629`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `\u0645\u0646\u0630 ${hrs} \u0633\u0627\u0639\u0629`;
  const days = Math.floor(hrs / 24);
  return `\u0645\u0646\u0630 ${days} \u064a\u0648\u0645`;
}

type RemoteMomentRow = {
  id: string;
  author_id: string;
  plan_id: string | null;
  photo_url: string;
  caption: string | null;
  created_at: string;
};

function remoteMomentToMoment(row: RemoteMomentRow): Moment {
  const seed = Math.abs(hashString(row.id));
  return {
    id: row.id,
    title: row.caption ?? "✨",
    people: "",
    when: timeAgo(row.created_at),
    location: "",
    tiles: makeTiles(seed, 9),
  };
}

export default function HomeScreen() {
  const t = useT();
  const { mode, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["id"]>("plans");
  const [activeFilter, setActiveFilter] = useState<string>("الكل");

  const plansQuery = useQuery<Plan[]>({
    queryKey: ["plans"],
    enabled: hasSupabase && mode === "signedIn",
    queryFn: async () => {
      const { plans, error } = await fetchActivePlans(user?.id ?? "");
      if (error) {
        console.log("[home] plans query error", error);
        return [];
      }
      const rows: RemotePlanRow[] = plans.map((p) => ({
        id: p.id,
        owner_id: p.owner_id,
        title: p.title,
        location: p.location,
        privacy: p.privacy,
        created_at: p.created_at,
      }));
      if (rows.length === 0) return [];

      const ownerIds = Array.from(new Set(rows.map((r) => r.owner_id)));
      const planIds = rows.map((r) => r.id);

      const [profilesRes, membersRes] = await Promise.all([
        supabase.from("profiles").select("id, name").in("id", ownerIds),
        supabase.from("plan_members").select("plan_id").in("plan_id", planIds),
      ]);

      if (profilesRes.error) console.log("[home] profiles error", profilesRes.error.message);
      if (membersRes.error) console.log("[home] members error", membersRes.error.message);

      const nameById = new Map<string, string>();
      (profilesRes.data ?? []).forEach((p: { id: string; name: string | null }) => {
        nameById.set(p.id, p.name ?? "");
      });
      const countById = new Map<string, number>();
      (membersRes.data ?? []).forEach((m: { plan_id: string }) => {
        countById.set(m.plan_id, (countById.get(m.plan_id) ?? 0) + 1);
      });

      return rows.map((r) => remoteToPlan(r, nameById.get(r.owner_id) ?? "", countById.get(r.id) ?? 0));
    },
  });

  const remotePlans = plansQuery.data ?? [];
  const { plans: localPlans } = useLocalPlans();
  const localAsPlans: Plan[] = useMemo(() => localPlans.map(localPlanToPlan), [localPlans]);
  // When signed in, ONLY show plans from Supabase (per-account). Local plans are
  // a guest/offline-only fallback — otherwise they'd leak across accounts on the
  // same device since AsyncStorage isn't scoped to a user.
  const displayPlans: Plan[] =
    mode === "signedIn" ? remotePlans : [...localAsPlans, ...remotePlans];

  const momentsQuery = useQuery<Moment[]>({
    queryKey: ["moments"],
    enabled: hasSupabase && mode === "signedIn",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moments")
        .select("id, author_id, plan_id, photo_url, caption, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        console.log("[home] moments error", error.message);
        return [];
      }
      return ((data ?? []) as RemoteMomentRow[]).map(remoteMomentToMoment);
    },
  });
  const displayMoments: Moment[] = momentsQuery.data ?? [];

  const onCreate = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push("/create");
  }, []);

  const fabScale = useRef(new Animated.Value(1)).current;

  const navItems = useMemo(
    () => [
      { id: "home", label: "الرئيسية", icon: HomeIcon, active: true },
      { id: "discover", label: "اكتشف", icon: Search, active: false },
      { id: "me", label: "أنا", icon: UserIcon, active: false },
    ],
    []
  );

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Text style={styles.brand}>{t("سوا")}</Text>
          <View style={styles.topActions}>
            <Pressable style={styles.bellBtn} onPress={() => router.push("/inbox")}>
              <Bell size={20} color={Colors.text} strokeWidth={2.2} />
              <View style={styles.notifDot} />
            </Pressable>
            <Pressable style={styles.profileBtn} onPress={() => router.push("/me")}>
              <Image source={{ uri: profile?.avatar_url ?? DEFAULT_AVATAR_URL }} style={styles.profileImg} />
            </Pressable>
          </View>
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                style={styles.tab}
                onPress={() => {
                  if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
                  setActiveTab(tab.id);
                }}
              >
                {isActive ? (
                  <LinearGradient
                    colors={[Colors.primary, Colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
                  />
                ) : null}
                <Text style={[styles.tabText, isActive ? styles.tabTextActive : styles.tabTextInactive]}>{t(tab.label)}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Filter row (Plans only) */}
        {activeTab === "plans" ? (
          <View style={styles.filterScrollWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {FILTERS.map((f) => {
              const isActive = activeFilter === f;
              return (
                <Pressable
                  key={f}
                  onPress={() => {
                    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
                    setActiveFilter(f);
                  }}
                  style={[styles.chip, !isActive && styles.chipInactive]}
                >
                  {isActive ? (
                    <LinearGradient
                      colors={[Colors.primary, Colors.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
                    />
                  ) : null}
                  <Text style={[styles.chipText, isActive ? styles.chipTextActive : styles.chipTextInactive]}>{t(f)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          </View>
        ) : (
          <View style={{ height: 16 }} />
        )}

        {activeTab === "plans" ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={plansQuery.isFetching}
                onRefresh={() => plansQuery.refetch()}
                tintColor={Colors.text}
              />
            }
          >
            {displayPlans.length === 0 ? (
              <MomentsEmpty onCreate={onCreate} />
            ) : (
              displayPlans.map((p) => <PlanCard key={p.id} plan={p} />)
            )}
            <View style={{ height: 80 }} />
          </ScrollView>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.momentsContent}
          >
            {displayMoments.length === 0 ? (
              <MomentsEmpty onCreate={onCreate} />
            ) : (
              <>
                <FeaturedMoment moment={displayMoments[0]} />
                <View style={styles.grid}>
                  {displayMoments.slice(1).map((m, i) => (
                    <View
                      key={m.id}
                      style={[styles.gridItem, { marginRight: i % 2 === 0 ? 8 : 0 }]}
                    >
                      <MomentGridCard moment={m} />
                    </View>
                  ))}
                </View>
                <View style={{ height: 100 }} />
              </>
            )}
          </ScrollView>
        )}

        {/* FAB */}
        <Animated.View style={[styles.fabWrap, { transform: [{ scale: fabScale }] }]}>
          <Pressable
            onPressIn={() => Animated.spring(fabScale, { toValue: 0.92, useNativeDriver: true, friction: 6 }).start()}
            onPressOut={() => Animated.spring(fabScale, { toValue: 1, useNativeDriver: true, friction: 5 }).start()}
            onPress={onCreate}
            style={styles.fab}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fabGradient}
            >
              <Plus size={28} color="#fff" strokeWidth={3} />
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </SafeAreaView>

      {/* Bottom navigation */}
      <SafeAreaView edges={["bottom"]} style={styles.bottomNavSafe}>
        <View style={styles.bottomNav}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Pressable
                key={item.id}
                style={styles.navItem}
                onPress={() => {
                  if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
                  if (item.id === "me") {
                    router.push("/me");
                  } else if (item.id === "discover") {
                    router.push("/friends");
                  }
                }}
              >
                {item.active ? (
                  <LinearGradient
                    colors={[Colors.primary, Colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.navIconActive}
                  >
                    <Icon size={20} color="#fff" strokeWidth={2.6} />
                  </LinearGradient>
                ) : (
                  <View style={styles.navIconInactive}>
                    <Icon size={20} color={Colors.textMuted} strokeWidth={2.2} />
                  </View>
                )}
                <Text style={[styles.navLabel, item.active ? styles.navLabelActive : styles.navLabelInactive]}>
                  {t(item.label)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  safe: { flex: 1 },

  // Top bar
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: "800" as const,
    writingDirection: "rtl",
  },
  topActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2D2A45",
  },
  notifDot: {
    position: "absolute",
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.bg,
  },
  profileBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: "#2D2A45",
  },
  profileImg: { width: "100%", height: "100%" },

  // Tab bar
  tabBar: {
    marginHorizontal: 20,
    height: 44,
    backgroundColor: Colors.card,
    borderRadius: 22,
    padding: 4,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#2D2A45",
  },
  tab: {
    flex: 1,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "800" as const,
  },
  tabTextActive: { color: "#fff" },
  tabTextInactive: { color: Colors.textMuted },

  // Filter row
  filterScrollWrap: {
    height: 60,
  },
  filterRow: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  chipInactive: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: "#2D2A45",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700" as const,
  },
  chipTextActive: { color: "#fff" },
  chipTextInactive: { color: Colors.textMuted },

  // Moments
  momentsContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
  },
  featuredWrap: {
    borderRadius: 16,
    padding: 1.5,
    overflow: "hidden",
  },
  featuredInner: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 14.5,
    overflow: "hidden",
    backgroundColor: Colors.card,
  },
  featuredBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(13,11,30,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  featuredBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800" as const,
    writingDirection: "rtl",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  gridItem: {
    width: "50%",
    paddingRight: 0,
    marginBottom: 8,
  },
  gridCardWrap: {
    width: "100%",
  },
  gridCard: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: "#2D2A45",
  },

  // Empty
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  emptyShapeWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    transform: [{ rotate: "12deg" }],
  },
  emptyShape: {
    ...StyleSheet.absoluteFillObject,
  },
  emptyShapeInner: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(13,11,30,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "800" as const,
    writingDirection: "rtl",
    textAlign: "center",
  },
  emptySub: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: "600" as const,
    marginTop: 6,
    writingDirection: "rtl",
    textAlign: "center",
  },
  emptyBtn: {
    marginTop: 24,
    height: 52,
    paddingHorizontal: 28,
    borderRadius: 26,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800" as const,
    writingDirection: "rtl",
  },

  // Card list
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  cardWrap: { marginBottom: 12 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: "#2D2A45",
    borderRadius: 16,
    padding: 16,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kindCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  kindEmoji: { fontSize: 18 },
  creatorBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  creatorName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "800" as const,
    writingDirection: "rtl",
  },
  creatorRole: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "600" as const,
    marginTop: 1,
    writingDirection: "rtl",
  },
  planTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "800" as const,
    marginTop: 12,
    textAlign: "right",
    writingDirection: "rtl",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 8,
  },
  infoItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: "600" as const,
  },
  infoDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textDim,
    marginHorizontal: 8,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  ago: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "600" as const,
    writingDirection: "rtl",
  },
  joinBtn: {
    width: 90,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  joinBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800" as const,
    writingDirection: "rtl",
  },

  // FAB
  fabWrap: {
    position: "absolute",
    right: 20,
    bottom: 20,
    borderRadius: 28,
    shadowColor: Colors.secondary,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  fabGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  // Bottom nav
  bottomNavSafe: {
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: "#2D2A45",
  },
  bottomNav: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 20,
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    flex: 1,
  },
  navIconActive: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  navIconInactive: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: {
    fontSize: 10,
    fontWeight: "700" as const,
    writingDirection: "rtl",
  },
  navLabelActive: { color: Colors.text },
  navLabelInactive: { color: Colors.textMuted },
});
