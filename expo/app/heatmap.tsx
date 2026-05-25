import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Flame, RefreshCw } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { useAuth } from "@/constants/auth";
import { supabase, hasSupabase } from "@/lib/supabase";

type HeatZone = {
  location: string;
  count: number;
  activity_types: string[];
  heat: "warm" | "hot" | "fire";
};

type ActivePlan = {
  id: string;
  title: string;
  location: string | null;
  activity_type: string | null;
  created_at: string;
};

const ACTIVITY_EMOJI: Record<string, string> = {
  food: "🍽️",
  sport: "⚽",
  night: "🌙",
  beach: "🏖️",
  event: "🎉",
  other: "✨",
};

function getHeat(count: number): "warm" | "hot" | "fire" {
  if (count >= 6) return "fire";
  if (count >= 3) return "hot";
  return "warm";
}

function heatEmoji(heat: "warm" | "hot" | "fire"): string {
  if (heat === "fire") return "🔥🔥🔥";
  if (heat === "hot") return "🔥🔥";
  return "🔥";
}

function heatColor(heat: "warm" | "hot" | "fire"): string {
  if (heat === "fire") return Colors.secondary;
  if (heat === "hot") return Colors.primary;
  return Colors.warn ?? "#FFC857";
}

function heatLabel(heat: "warm" | "hot" | "fire"): string {
  if (heat === "fire") return "On Fire";
  if (heat === "hot") return "Hot";
  return "Warm";
}

export default function HeatmapScreen() {
  const { mode } = useAuth();
  const [selectedZone, setSelectedZone] = useState<HeatZone | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const haptic = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
  }, []);

  const plansQuery = useQuery<ActivePlan[]>({
    queryKey: ["heatmap-plans"],
    enabled: hasSupabase && mode === "signedIn",
    refetchInterval: 60_000, // auto refresh every 60 seconds
    queryFn: async () => {
      const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("plans")
        .select("id, title, location, activity_type, created_at")
        .eq("status", "active")
        .eq("privacy", "public")
        .gte("created_at", since);
      if (error) { console.log("[heatmap] error", error.message); return []; }
      setLastUpdated(new Date());
      return (data ?? []) as ActivePlan[];
    },
  });

  // Group plans by location into heat zones
  const heatZones: HeatZone[] = React.useMemo(() => {
    const plans = plansQuery.data ?? [];
    const map = new Map<string, { count: number; types: string[] }>();
    plans.forEach((p) => {
      if (!p.location) return;
      const key = p.location.trim();
      const existing = map.get(key) ?? { count: 0, types: [] };
      existing.count += 1;
      if (p.activity_type && !existing.types.includes(p.activity_type)) {
        existing.types.push(p.activity_type);
      }
      map.set(key, existing);
    });
    return Array.from(map.entries())
      .map(([location, { count, types }]) => ({
        location,
        count,
        activity_types: types,
        heat: getHeat(count),
      }))
      .sort((a, b) => b.count - a.count);
  }, [plansQuery.data]);

  // Plans for selected zone
  const zonePlans = React.useMemo(() => {
    if (!selectedZone) return [];
    return (plansQuery.data ?? []).filter(
      (p) => p.location?.trim() === selectedZone.location
    ).slice(0, 3);
  }, [selectedZone, plansQuery.data]);

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Live Energy 🔥</Text>
            <Text style={styles.headerSub}>Where is everyone right now</Text>
          </View>
          <Pressable
            onPress={() => { haptic(); plansQuery.refetch(); }}
            style={styles.refreshBtn}
          >
            <RefreshCw size={18} color={Colors.textMuted} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Live indicator */}
        <View style={styles.liveRow}>
          <LiveDot />
          <Text style={styles.liveText}>Live</Text>
          <Text style={styles.liveTime}>
            {"  ·  Updated "}
            {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>

        {/* Map placeholder — visual heat grid */}
        <View style={styles.mapContainer}>
          <LinearGradient
            colors={["#0D0B1E", "#15122B", "#0D0B1E"]}
            style={StyleSheet.absoluteFill}
          />
          {heatZones.length === 0 ? (
            <View style={styles.mapEmpty}>
              <Text style={styles.mapEmptyEmoji}>🌙</Text>
              <Text style={styles.mapEmptyTitle}>Quiet right now</Text>
              <Text style={styles.mapEmptySub}>Be the first to create a plan</Text>
              <Pressable
                onPress={() => { haptic(); router.push("/create"); }}
                style={styles.mapEmptyBtn}
              >
                <LinearGradient
                  colors={[Colors.primary, Colors.secondary]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.mapEmptyBtnGrad}
                >
                  <Text style={styles.mapEmptyBtnText}>Create a Plan</Text>
                </LinearGradient>
              </Pressable>
            </View>
          ) : (
            // Visual heat bubbles arranged on pseudo-map
            <View style={styles.bubblesContainer}>
              {heatZones.slice(0, 8).map((zone, i) => (
                <HeatBubble
                  key={zone.location}
                  zone={zone}
                  index={i}
                  selected={selectedZone?.location === zone.location}
                  onPress={() => {
                    haptic();
                    setSelectedZone(
                      selectedZone?.location === zone.location ? null : zone
                    );
                  }}
                />
              ))}
            </View>
          )}
        </View>

        {/* Zone detail panel */}
        {selectedZone && (
          <View style={styles.zoneDetail}>
            <View style={styles.zoneDetailHeader}>
              <View>
                <Text style={styles.zoneDetailName}>{selectedZone.location}</Text>
                <Text style={styles.zoneDetailCount}>
                  {selectedZone.count} active {selectedZone.count === 1 ? "plan" : "plans"}
                </Text>
              </View>
              <View style={[styles.heatBadge, { borderColor: heatColor(selectedZone.heat) }]}>
                <Text style={[styles.heatBadgeText, { color: heatColor(selectedZone.heat) }]}>
                  {heatEmoji(selectedZone.heat)} {heatLabel(selectedZone.heat)}
                </Text>
              </View>
            </View>
            {zonePlans.map((plan) => (
              <Pressable
                key={plan.id}
                onPress={() => { haptic(); router.push({ pathname: "/plan", params: { id: plan.id } }); }}
                style={styles.zonePlan}
              >
                <Text style={styles.zonePlanEmoji}>
                  {ACTIVITY_EMOJI[plan.activity_type ?? "other"] ?? "✨"}
                </Text>
                <Text style={styles.zonePlanTitle} numberOfLines={1}>{plan.title}</Text>
                <Text style={styles.zonePlanAgo}>{timeAgo(plan.created_at)}</Text>
                <Text style={styles.zonePlanJoin}>Join →</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => { haptic(); router.push("/home"); }}
              style={styles.seeAllBtn}
            >
              <Text style={styles.seeAllText}>See all plans here →</Text>
            </Pressable>
          </View>
        )}

        {/* Bottom list: Hottest Right Now */}
        {!selectedZone && (
          <>
            <Text style={styles.listTitle}>Hottest Right Now</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hotList}
            >
              {heatZones.length === 0 ? (
                <View style={styles.hotEmpty}>
                  <Text style={styles.hotEmptyText}>No active plans yet</Text>
                </View>
              ) : (
                heatZones.map((zone) => (
                  <Pressable
                    key={zone.location}
                    onPress={() => { haptic(); setSelectedZone(zone); }}
                    style={styles.hotCard}
                  >
                    <Text style={styles.hotCardEmoji}>
                      {ACTIVITY_EMOJI[zone.activity_types[0] ?? "other"] ?? "✨"}
                    </Text>
                    <Text style={styles.hotCardName} numberOfLines={1}>{zone.location}</Text>
                    <Text style={styles.hotCardHeat}>{heatEmoji(zone.heat)}</Text>
                    <Text style={styles.hotCardCount}>{zone.count} plans active</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

function HeatBubble({
  zone, index, selected, onPress,
}: {
  zone: HeatZone;
  index: number;
  selected: boolean;
  onPress: () => void;
}) {
  const pulse = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const size = zone.heat === "fire" ? 80 : zone.heat === "hot" ? 64 : 48;
  const color = heatColor(zone.heat);

  // Pseudo-random positions based on index
  const positions = [
    { top: 40, left: 60 },
    { top: 80, left: 200 },
    { top: 120, left: 110 },
    { top: 40, left: 290 },
    { top: 100, left: 20 },
    { top: 60, left: 340 },
    { top: 140, left: 260 },
    { top: 20, left: 160 },
  ];
  const pos = positions[index % positions.length];

  return (
    <Pressable
      onPress={onPress}
      style={[styles.bubble, { top: pos.top, left: pos.left }]}
    >
      <Animated.View
        style={[
          styles.bubbleOuter,
          {
            width: size + 20,
            height: size + 20,
            borderRadius: (size + 20) / 2,
            backgroundColor: color + "30",
            transform: [{ scale: pulse }],
          },
        ]}
      />
      <View
        style={[
          styles.bubbleInner,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color + (selected ? "CC" : "60"),
            borderWidth: selected ? 2 : 0,
            borderColor: "#fff",
          },
        ]}
      >
        <Text style={styles.bubbleEmoji}>
          {zone.heat === "fire" ? "🔥" : zone.heat === "hot" ? "🟠" : "🟡"}
        </Text>
      </View>
      <Text style={[styles.bubbleLabel, { color }]} numberOfLines={1}>
        {zone.location.length > 10 ? zone.location.slice(0, 10) + "…" : zone.location}
      </Text>
    </Pressable>
  );
}

function LiveDot() {
  const pulse = React.useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.5, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[styles.liveDot, { transform: [{ scale: pulse }] }]}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  safe: { flex: 1 },

  header: {
    flexDirection: "row", alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
  },
  headerTitle: { color: Colors.text, fontSize: 22, fontWeight: "800" },
  headerSub: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.card, alignItems: "center",
    justifyContent: "center", borderWidth: 1, borderColor: "#2D2A45",
  },

  liveRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, marginBottom: 12,
  },
  liveDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.success ?? "#3DDC97", marginRight: 6,
  },
  liveText: { color: Colors.success ?? "#3DDC97", fontSize: 12, fontWeight: "700" },
  liveTime: { color: Colors.textMuted, fontSize: 12 },

  mapContainer: {
    height: 200, marginHorizontal: 20, borderRadius: 20,
    overflow: "hidden", borderWidth: 1, borderColor: "#2D2A45",
    marginBottom: 16,
  },
  mapEmpty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  mapEmptyEmoji: { fontSize: 36, marginBottom: 8 },
  mapEmptyTitle: { color: Colors.text, fontSize: 16, fontWeight: "700", marginBottom: 4 },
  mapEmptySub: { color: Colors.textMuted, fontSize: 13, marginBottom: 16 },
  mapEmptyBtn: { height: 44, borderRadius: 22, overflow: "hidden" },
  mapEmptyBtnGrad: { flex: 1, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
  mapEmptyBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  bubblesContainer: { flex: 1, position: "relative" },
  bubble: { position: "absolute", alignItems: "center" },
  bubbleOuter: { position: "absolute" },
  bubbleInner: { alignItems: "center", justifyContent: "center" },
  bubbleEmoji: { fontSize: 18 },
  bubbleLabel: { fontSize: 10, fontWeight: "700", marginTop: 2, maxWidth: 80, textAlign: "center" },

  zoneDetail: {
    marginHorizontal: 20, backgroundColor: Colors.card,
    borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: "#2D2A45",
  },
  zoneDetailHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 12,
  },
  zoneDetailName: { color: Colors.text, fontSize: 16, fontWeight: "800" },
  zoneDetailCount: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },
  heatBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, borderWidth: 1,
  },
  heatBadgeText: { fontSize: 12, fontWeight: "700" },
  zonePlan: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#2D2A45", gap: 8,
  },
  zonePlanEmoji: { fontSize: 18 },
  zonePlanTitle: { color: Colors.text, fontSize: 13, fontWeight: "600", flex: 1 },
  zonePlanAgo: { color: Colors.textMuted, fontSize: 11 },
  zonePlanJoin: { color: Colors.primary, fontSize: 13, fontWeight: "700" },
  seeAllBtn: { marginTop: 10 },
  seeAllText: { color: Colors.secondary, fontSize: 13, fontWeight: "700" },

  listTitle: {
    color: Colors.text, fontSize: 16, fontWeight: "800",
    paddingHorizontal: 20, marginBottom: 10,
  },
  hotList: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
  hotEmpty: { paddingVertical: 20 },
  hotEmptyText: { color: Colors.textMuted, fontSize: 14 },
  hotCard: {
    width: 140, backgroundColor: Colors.card,
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: "#2D2A45",
  },
  hotCardEmoji: { fontSize: 28, marginBottom: 8 },
  hotCardName: { color: Colors.text, fontSize: 14, fontWeight: "700", marginBottom: 4 },
  hotCardHeat: { fontSize: 14, marginBottom: 4 },
  hotCardCount: { color: Colors.textMuted, fontSize: 11 },
});
