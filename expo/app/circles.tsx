import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Plus, X, Search, Users, MapPin, ChevronLeft } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { useAuth } from "@/constants/auth";
import { supabase, hasSupabase } from "@/lib/supabase";

type Circle = {
  id: string;
  name: string;
  description: string | null;
  emoji: string;
  activity_type: string;
  location: string | null;
  creator_id: string;
  is_public: boolean;
  member_count: number;
  created_at: string;
};

const CIRCLE_EMOJIS = ["👥", "🏖️", "🍽️", "⚽", "🌙", "🎓", "🏔️", "🎉", "🎮", "🎵", "🚗", "💪"];

export default function CirclesScreen() {
  const { user, mode } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"mine" | "discover">("mine");
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");

  // New circle form state
  const [newEmoji, setNewEmoji] = useState("👥");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [creating, setCreating] = useState(false);

  const haptic = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
  }, []);

  // Fetch all public circles
  const allCirclesQuery = useQuery<Circle[]>({
    queryKey: ["circles-all"],
    enabled: hasSupabase && mode === "signedIn",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circles")
        .select("*")
        .eq("is_public", true)
        .order("member_count", { ascending: false });
      if (error) { console.log("[circles] all error", error.message); return []; }
      return (data ?? []) as Circle[];
    },
  });

  // Fetch user's joined circle IDs
  const myCircleIdsQuery = useQuery<string[]>({
    queryKey: ["my-circle-ids", user?.id],
    enabled: hasSupabase && mode === "signedIn" && !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("circle_members")
        .select("circle_id")
        .eq("user_id", user.id);
      if (error) { console.log("[circles] my ids error", error.message); return []; }
      return (data ?? []).map((r: { circle_id: string }) => r.circle_id);
    },
  });

  const allCircles: Circle[] = allCirclesQuery.data ?? [];
  const myCircleIds: string[] = myCircleIdsQuery.data ?? [];
  const myCircles = allCircles.filter((c) => myCircleIds.includes(c.id));
  const filtered = allCircles.filter((c) =>
    search.trim() === "" || c.name.toLowerCase().includes(search.toLowerCase())
  );

  const joinCircle = useCallback(async (circle: Circle) => {
    if (!user) return;
    haptic();
    // Use RPC which respects RLS and handles member_count via DB trigger
    const { data: rpcData, error } = await supabase.rpc("join_circle", { p_circle_id: circle.id });
    if (error || !(rpcData as any)?.ok) {
      Alert.alert("Error", error?.message ?? (rpcData as any)?.error ?? "Could not join circle");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["circles-all"] });
    queryClient.invalidateQueries({ queryKey: ["my-circle-ids"] });
  }, [user, haptic, queryClient]);

  const leaveCircle = useCallback(async (circle: Circle) => {
    if (!user) return;
    haptic();
    // Use RPC — member_count decremented automatically by DB trigger
    const { data: rpcData, error } = await supabase.rpc("leave_circle", { p_circle_id: circle.id });
    if (error) { Alert.alert("Error", error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["circles-all"] });
    queryClient.invalidateQueries({ queryKey: ["my-circle-ids"] });
  }, [user, haptic, queryClient]);

  const createCircle = useCallback(async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);
    const { data, error } = await supabase.from("circles").insert({
      name: newName.trim(),
      description: newDesc.trim() || null,
      emoji: newEmoji,
      location: newLocation.trim() || null,
      creator_id: user.id,
      is_public: true,
      member_count: 1,
    }).select().single();

    if (error) {
      Alert.alert("Error", error.message);
      setCreating(false);
      return;
    }

    // Add creator as admin member
    await supabase.from("circle_members").insert({
      circle_id: data.id,
      user_id: user.id,
      role: "admin",
    });

    queryClient.invalidateQueries({ queryKey: ["circles-all"] });
    queryClient.invalidateQueries({ queryKey: ["my-circle-ids"] });
    setCreating(false);
    setShowCreate(false);
    setNewName("");
    setNewDesc("");
    setNewLocation("");
    setNewEmoji("👥");
  }, [user, newName, newDesc, newEmoji, newLocation, queryClient]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => { haptic(); try { router.back(); } catch { router.replace("/home"); } }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.backBtn}
            testID="circles-back"
          >
            <ChevronLeft size={22} color={Colors.text} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.headerTitle}>Circles</Text>
          <Pressable onPress={() => { haptic(); setShowCreate(true); }} style={styles.addBtn}>
            <LinearGradient
              colors={[Colors.primary, Colors.secondary]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.addBtnGrad}
            >
              <Plus size={20} color="#fff" strokeWidth={2.8} />
            </LinearGradient>
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {(["mine", "discover"] as const).map((tab) => {
            const isActive = activeTab === tab;
            const label = tab === "mine" ? "My Circles" : "Discover";
            return (
              <Pressable key={tab} style={styles.tab} onPress={() => { haptic(); setActiveTab(tab); }}>
                {isActive && (
                  <LinearGradient
                    colors={[Colors.primary, Colors.secondary]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
                  />
                )}
                <Text style={[styles.tabText, isActive ? styles.tabActive : styles.tabInactive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Search (discover only) */}
        {activeTab === "discover" && (
          <View style={styles.searchWrap}>
            <Search size={16} color={Colors.textMuted} strokeWidth={2} style={{ marginRight: 8 }} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search circles..."
              placeholderTextColor={Colors.textMuted}
              style={styles.searchInput}
            />
          </View>
        )}

        {/* Content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={allCirclesQuery.isFetching}
              onRefresh={() => {
                allCirclesQuery.refetch();
                myCircleIdsQuery.refetch();
              }}
              tintColor={Colors.text}
            />
          }
        >
          {activeTab === "mine" && myCircles.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={styles.emptyTitle}>No circles yet</Text>
              <Text style={styles.emptySub}>Join a circle to find your people</Text>
              <Pressable onPress={() => { haptic(); setActiveTab("discover"); }} style={styles.emptyBtn}>
                <LinearGradient
                  colors={[Colors.primary, Colors.secondary]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.emptyBtnGrad}
                >
                  <Text style={styles.emptyBtnText}>Discover Circles</Text>
                </LinearGradient>
              </Pressable>
            </View>
          )}

          {(activeTab === "mine" ? myCircles : filtered).map((circle) => {
            const joined = myCircleIds.includes(circle.id);
            return (
              <CircleCard
                key={circle.id}
                circle={circle}
                joined={joined}
                onJoin={() => joinCircle(circle)}
                onLeave={() => leaveCircle(circle)}
                onPress={() => {}}
              />
            );
          })}
        </ScrollView>
      </SafeAreaView>

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" transparent presentationStyle="overFullScreen">
        <Pressable style={styles.modalOverlay} onPress={() => setShowCreate(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.dragHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Circle</Text>
            <Pressable onPress={() => setShowCreate(false)}>
              <X size={20} color={Colors.textMuted} />
            </Pressable>
          </View>

          {/* Emoji picker */}
          <Text style={styles.fieldLabel}>Choose an emoji</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={styles.emojiRow}>
              {CIRCLE_EMOJIS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => { haptic(); setNewEmoji(e); }}
                  style={[styles.emojiBtn, newEmoji === e && styles.emojiBtnActive]}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.fieldLabel}>Circle Name</Text>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="e.g. Zahle Nightlife"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
            maxLength={40}
          />

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            value={newDesc}
            onChangeText={setNewDesc}
            placeholder="What's this circle about?"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
            maxLength={100}
            multiline
            numberOfLines={2}
          />

          <Text style={styles.fieldLabel}>Location (optional)</Text>
          <TextInput
            value={newLocation}
            onChangeText={setNewLocation}
            placeholder="City or area"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
          />

          <Pressable
            onPress={createCircle}
            disabled={!newName.trim() || creating}
            style={[styles.createBtn, (!newName.trim() || creating) && { opacity: 0.5 }]}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.secondary]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.createBtnGrad}
            >
              {creating
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.createBtnText}>Create Circle</Text>
              }
            </LinearGradient>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function CircleCard({
  circle, joined, onJoin, onLeave, onPress,
}: {
  circle: Circle;
  joined: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.cardRow}>
        {/* Emoji */}
        <View style={styles.circleEmoji}>
          <LinearGradient
            colors={[Colors.primary, Colors.secondary]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.emojiGrad}
          >
            <Text style={styles.cardEmoji}>{circle.emoji}</Text>
          </LinearGradient>
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{circle.name}</Text>
          {circle.description ? (
            <Text style={styles.cardDesc} numberOfLines={1}>{circle.description}</Text>
          ) : null}
          <View style={styles.cardMeta}>
            {circle.location ? (
              <View style={styles.metaItem}>
                <MapPin size={11} color={Colors.textMuted} strokeWidth={2} />
                <Text style={styles.metaText}>{circle.location}</Text>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              <Users size={11} color={Colors.textMuted} strokeWidth={2} />
              <Text style={styles.metaText}>{circle.member_count} members</Text>
            </View>
          </View>
        </View>

        {/* Join / Leave */}
        <Pressable
          onPress={joined ? onLeave : onJoin}
          style={[styles.actionBtn, joined && styles.actionBtnJoined]}
        >
          {joined ? (
            <Text style={styles.actionBtnLeaveText}>Leave</Text>
          ) : (
            <LinearGradient
              colors={[Colors.primary, Colors.secondary]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          {!joined && <Text style={styles.actionBtnJoinText}>Join</Text>}
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  safe: { flex: 1 },

  header: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  headerTitle: { color: Colors.text, fontSize: 24, fontWeight: "800" },
  addBtn: { width: 40, height: 40, borderRadius: 20, overflow: "hidden" },
  addBtnGrad: { flex: 1, alignItems: "center", justifyContent: "center" },

  tabBar: {
    flexDirection: "row", marginHorizontal: 20, height: 44,
    backgroundColor: Colors.card, borderRadius: 22, padding: 4,
    borderWidth: 1, borderColor: "#2D2A45", marginBottom: 12,
  },
  tab: { flex: 1, borderRadius: 20, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  tabText: { fontSize: 14, fontWeight: "700" },
  tabActive: { color: "#fff" },
  tabInactive: { color: Colors.textMuted },

  searchWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 24, borderWidth: 1, borderColor: "#2D2A45",
    marginHorizontal: 20, marginBottom: 12,
    paddingHorizontal: 14, height: 44,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14 },

  list: { paddingHorizontal: 20, paddingBottom: 32 },

  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 24 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { color: Colors.text, fontSize: 20, fontWeight: "800", marginBottom: 8 },
  emptySub: { color: Colors.textMuted, fontSize: 14, textAlign: "center", marginBottom: 24 },
  emptyBtn: { height: 52, paddingHorizontal: 28, borderRadius: 26, overflow: "hidden" },
  emptyBtnGrad: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  emptyBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },

  card: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: "#2D2A45",
    borderRadius: 16, padding: 14, marginBottom: 10,
  },
  cardRow: { flexDirection: "row", alignItems: "center" },
  circleEmoji: { width: 48, height: 48, borderRadius: 24, overflow: "hidden", marginRight: 12 },
  emojiGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
  cardEmoji: { fontSize: 22 },
  cardInfo: { flex: 1 },
  cardName: { color: Colors.text, fontSize: 15, fontWeight: "700", marginBottom: 2 },
  cardDesc: { color: Colors.textMuted, fontSize: 12, marginBottom: 4 },
  cardMeta: { flexDirection: "row", gap: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { color: Colors.textMuted, fontSize: 11 },
  actionBtn: {
    width: 70, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
    overflow: "hidden", marginLeft: 8,
  },
  actionBtnJoined: {
    backgroundColor: "transparent",
    borderWidth: 1, borderColor: Colors.secondary,
  },
  actionBtnJoinText: { color: "#fff", fontSize: 13, fontWeight: "700", zIndex: 1 },
  actionBtnLeaveText: { color: Colors.secondary, fontSize: 13, fontWeight: "700" },

  // Modal
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  dragHandle: {
    width: 40, height: 4, backgroundColor: "#2D2A45",
    borderRadius: 2, alignSelf: "center", marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 20,
  },
  modalTitle: { color: Colors.text, fontSize: 18, fontWeight: "800" },
  fieldLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 },
  emojiRow: { flexDirection: "row", gap: 8, paddingRight: 20 },
  emojiBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.bg, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#2D2A45",
  },
  emojiBtnActive: { borderColor: Colors.primary, borderWidth: 2 },
  emojiText: { fontSize: 22 },
  input: {
    backgroundColor: Colors.bg, borderRadius: 12, height: 52,
    paddingHorizontal: 14, color: Colors.text, fontSize: 15,
    borderWidth: 1, borderColor: "#2D2A45", marginBottom: 14,
  },
  createBtn: { height: 54, borderRadius: 27, overflow: "hidden", marginTop: 8 },
  createBtnGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
  createBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
