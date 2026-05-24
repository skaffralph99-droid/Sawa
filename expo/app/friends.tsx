import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Check, ChevronLeft, QrCode, Search, Share2, X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useT } from "@/constants/i18n";
import { useAuth } from "@/constants/auth";
import { useFriends, type FriendProfile } from "@/constants/friends";
import { getFriends, sendFriendRequest } from "@/lib/friends";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type DemoFriend = {
  id: string;
  name: string;
  plans: string;
  photo?: string;
  gradient: readonly [string, string];
};

const DEMO_FRIENDS: DemoFriend[] = [
  {
    id: "f1",
    name: "أحمد قاسم",
    plans: "٥ بلانات سوا ✨",
    photo:
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop&crop=faces",
    gradient: ["#FF6B35", "#FF3CAC"],
  },
  {
    id: "f2",
    name: "سارة منصور",
    plans: "١٢ بلان سوا ✨",
    photo:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=faces",
    gradient: ["#FF3CAC", "#7B2FF7"],
  },
  {
    id: "f3",
    name: "خليل عقل",
    plans: "٨ بلانات سوا ✨",
    photo:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces",
    gradient: ["#7B2FF7", "#FF6B35"],
  },
];

const GRADIENTS: readonly (readonly [string, string])[] = [
  ["#FF6B35", "#FF3CAC"],
  ["#FF3CAC", "#7B2FF7"],
  ["#7B2FF7", "#FF6B35"],
  ["#FFC857", "#FF3CAC"],
  ["#FF6B35", "#FFC857"],
];

function gradientFor(id: string): readonly [string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

function PressableScale({
  onPress,
  children,
  style,
  scaleTo = 0.97,
  disabled = false,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  style?: any;
  scaleTo?: number;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = useCallback(() => {
    Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, friction: 7, tension: 200 }).start();
  }, [scale, scaleTo]);
  const onOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 180 }).start();
  }, [scale]);
  const handle = useCallback(() => {
    if (disabled) return;
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    onPress?.();
  }, [onPress, disabled]);
  return (
    <Pressable onPressIn={onIn} onPressOut={onOut} onPress={handle} disabled={disabled}>
      <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}

function Avatar({
  size,
  photo,
  gradient,
  initial,
}: {
  size: number;
  photo?: string | null;
  gradient: readonly [string, string];
  initial: string;
}) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden" }}>
      {photo ? (
        <Image source={{ uri: photo }} style={{ width: "100%", height: "100%" }} />
      ) : (
        <LinearGradient
          colors={[gradient[0], gradient[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: "#fff", fontSize: size * 0.4, fontWeight: "800" }}>{initial}</Text>
        </LinearGradient>
      )}
    </View>
  );
}

type RowState = "add" | "pending" | "friend" | "incoming";

function PersonRow({
  profile,
  state,
  onAdd,
  onCancel,
  onAccept,
  onDecline,
  subtitle,
  busy,
}: {
  profile: FriendProfile;
  state: RowState;
  onAdd?: () => void;
  onCancel?: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  subtitle: string;
  busy?: boolean;
}) {
  const t = useT();
  const initial = (profile.name ?? "?").trim().charAt(0) || "?";
  return (
    <View style={styles.row}>
      {state === "incoming" ? (
        <View style={{ flexDirection: "row-reverse", gap: 8 }}>
          <PressableScale onPress={onAccept} disabled={busy}>
            <LinearGradient
              colors={[Colors.primary, Colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.addBtn}
            >
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.addBtnText}>{t("قبول")}</Text>
              )}
            </LinearGradient>
          </PressableScale>
          <PressableScale onPress={onDecline} disabled={busy}>
            <View style={[styles.addBtn, styles.addBtnDecline]}>
              <Text style={styles.addBtnDeclineText}>{t("رفض")}</Text>
            </View>
          </PressableScale>
        </View>
      ) : state === "add" ? (
        <PressableScale onPress={onAdd} disabled={busy}>
          <LinearGradient
            colors={[Colors.primary, Colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addBtn}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.addBtnText}>{t("Add")}</Text>
            )}
          </LinearGradient>
        </PressableScale>
      ) : state === "pending" ? (
        <PressableScale onPress={onCancel} disabled={busy}>
          <View style={[styles.addBtn, styles.addBtnPending]}>
            <Text style={styles.addBtnPendingText}>{t("بانتظار")}</Text>
          </View>
        </PressableScale>
      ) : (
        <View style={[styles.addBtn, styles.addBtnDone]}>
          <Check size={14} color={Colors.success} strokeWidth={2.8} />
          <Text style={styles.addBtnDoneText}>{t("صاحبك")}</Text>
        </View>
      )}

      <View style={styles.rowBody}>
        <Avatar
          size={44}
          photo={profile.avatar_url}
          gradient={gradientFor(profile.id)}
          initial={initial}
        />
        <View style={styles.rowText}>
          <Text style={styles.rowName} numberOfLines={1}>{profile.name ?? t("بدون اسم")}</Text>
          <Text style={styles.rowSub} numberOfLines={1}>{subtitle}</Text>
        </View>
      </View>
    </View>
  );
}

function QRPattern() {
  const SIZE = 21;
  const cells = useMemo(() => {
    const seed = "sawa-ralph-2025";
    const arr: boolean[] = [];
    for (let i = 0; i < SIZE * SIZE; i++) {
      const c = seed.charCodeAt(i % seed.length);
      arr.push(((c * (i + 7)) % 7) > 3);
    }
    const setBlock = (cx: number, cy: number) => {
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
          const isEdge = x === 0 || x === 6 || y === 0 || y === 6;
          const isInner = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          arr[(cy + y) * SIZE + (cx + x)] = isEdge || isInner;
        }
      }
    };
    const clearBlock = (cx: number, cy: number) => {
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const idx = (cy + y) * SIZE + (cx + x);
          if (idx < arr.length) arr[idx] = false;
        }
      }
    };
    clearBlock(0, 0); setBlock(0, 0);
    clearBlock(SIZE - 7, 0); setBlock(SIZE - 7, 0);
    clearBlock(0, SIZE - 7); setBlock(0, SIZE - 7);
    return arr;
  }, []);

  return (
    <View style={qrStyles.grid}>
      {cells.map((on, i) => (
        <View key={i} style={[qrStyles.cell, { backgroundColor: on ? "#0D0B1E" : "transparent" }]} />
      ))}
    </View>
  );
}

const qrStyles = StyleSheet.create({
  grid: { width: "100%", aspectRatio: 1, flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 21}%`, height: `${100 / 21}%` },
});

export default function FriendsScreen() {
  const t = useT();
  const { profile, user, mode } = useAuth();
  const queryClient = useQueryClient();
  const {
    canSync,
    incoming,
    outgoing,
    refresh,
    searchUsers,
    cancelRequest,
    acceptRequest,
    declineRequest,
    isFriend,
    isPendingOutgoing,
  } = useFriends();

  const friendsQuery = useQuery<FriendProfile[]>({
    queryKey: ["friends-list", user?.id ?? null],
    enabled: canSync && !!user,
    queryFn: async () => {
      if (!user) return [];
      const { friends: list, error } = await getFriends(user.id);
      if (error) console.log("[friends] getFriends error", error);
      return list as FriendProfile[];
    },
  });
  const friends = friendsQuery.data ?? [];

  const [query, setQuery] = useState<string>("");
  const [focused, setFocused] = useState<boolean>(false);
  const [qrOpen, setQrOpen] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const markBusy = useCallback((id: string, val: boolean) => {
    setBusyIds((prev) => ({ ...prev, [id]: val }));
  }, []);

  // debounced search
  useEffect(() => {
    if (!canSync) {
      setSearchResults([]);
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const handle = setTimeout(async () => {
      const res = await searchUsers(q);
      if (!cancelled) {
        setSearchResults(res);
        setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, canSync, searchUsers]);

  const onAdd = useCallback(
    async (id: string) => {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (!user) return;
      markBusy(id, true);
      const { ok, error } = await sendFriendRequest(user.id, id);
      if (!ok) console.log("[friends] sendFriendRequest error", error);
      await queryClient.invalidateQueries({ queryKey: ["friends-list", user.id] });
      await refresh();
      markBusy(id, false);
    },
    [markBusy, user, queryClient, refresh]
  );
  const onCancel = useCallback(
    async (id: string) => {
      markBusy(id, true);
      await cancelRequest(id);
      markBusy(id, false);
    },
    [markBusy, cancelRequest]
  );
  const onAccept = useCallback(
    async (id: string) => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      markBusy(id, true);
      await acceptRequest(id);
      markBusy(id, false);
    },
    [markBusy, acceptRequest]
  );
  const onDecline = useCallback(
    async (id: string) => {
      markBusy(id, true);
      await declineRequest(id);
      markBusy(id, false);
    },
    [markBusy, declineRequest]
  );

  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const onInviteShare = useCallback(async () => {
    try {
      if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
      const message = t("انضم لـ Sawa وعيش اللحظة مع أصحابك — https://sawa.app");
      await Share.share({ message });
    } catch (e) {
      console.log("[friends] share error", e);
    }
  }, [t]);

  const stateFor = useCallback(
    (id: string): RowState => {
      if (isFriend(id)) return "friend";
      if (isPendingOutgoing(id)) return "pending";
      return "add";
    },
    [isFriend, isPendingOutgoing]
  );

  const showDemo = !canSync;
  const visibleFriends = showDemo ? [] : friends;
  const showSearch = query.trim().length >= 2;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.headerSide}
            hitSlop={12}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
              try { router.back(); } catch { router.replace("/home"); }
            }}
          >
            <View style={styles.backBtn}>
              <ChevronLeft size={22} color={Colors.text} strokeWidth={2.4} />
            </View>
          </Pressable>
          <Text style={styles.headerTitle}>{t("أصحابك")}</Text>
          <Pressable
            style={styles.headerSide}
            hitSlop={12}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
              setQrOpen(true);
            }}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.qrIconWrap}
            >
              <View style={styles.qrIconInner}>
                <QrCode size={18} color={Colors.text} strokeWidth={2.2} />
              </View>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <View style={[styles.searchBox, focused ? styles.searchBoxFocused : null]}>
            <Search size={18} color={Colors.textMuted} strokeWidth={2.2} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={canSync ? t("دور على اسم صاحبك") : t("دور على أصحابك")}
              placeholderTextColor={Colors.textMuted}
              style={styles.searchInput}
              textAlign="right"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            canSync ? (
              <RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={Colors.text} />
            ) : undefined
          }
        >
          {/* Search results */}
          {showSearch ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("نتائج البحث")}</Text>
              {searching ? (
                <View style={styles.searchingWrap}>
                  <ActivityIndicator color={Colors.primary} />
                </View>
              ) : searchResults.length === 0 ? (
                <View style={styles.searchingWrap}>
                  <Text style={styles.searchEmpty}>{t("ما لقينا حدا بهالاسم")}</Text>
                </View>
              ) : (
                <View style={styles.sectionCard}>
                  {searchResults.map((p) => (
                    <PersonRow
                      key={p.id}
                      profile={p}
                      state={stateFor(p.id)}
                      onAdd={() => onAdd(p.id)}
                      onCancel={() => onCancel(p.id)}
                      subtitle={t("على Sawa")}
                      busy={busyIds[p.id]}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : null}

          {/* Incoming requests */}
          {!showSearch && canSync && incoming.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t("طلبات صداقة")} · {incoming.length}
              </Text>
              <View style={styles.sectionCard}>
                {incoming.map((r) => (
                  <PersonRow
                    key={r.id}
                    profile={r.profile ?? { id: r.id, name: null, avatar_url: null }}
                    state="incoming"
                    onAccept={() => onAccept(r.id)}
                    onDecline={() => onDecline(r.id)}
                    subtitle={t("بدو يكون صاحبك")}
                    busy={busyIds[r.id]}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/* Outgoing pending */}
          {!showSearch && canSync && outgoing.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("طلبات مرسلة")}</Text>
              <View style={styles.sectionCard}>
                {outgoing.map((p) => (
                  <PersonRow
                    key={p.id}
                    profile={p}
                    state="pending"
                    onCancel={() => onCancel(p.id)}
                    subtitle={t("بانتظار الرد")}
                    busy={busyIds[p.id]}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/* Friends */}
          {!showSearch ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t("أصحابك")}
                {canSync && friends.length > 0 ? ` · ${friends.length}` : ""}
              </Text>

              {canSync ? (
                visibleFriends.length > 0 ? (
                  <View style={styles.sectionCard}>
                    {visibleFriends.map((f) => (
                      <PersonRow
                        key={f.id}
                        profile={f}
                        state="friend"
                        subtitle={t("صاحبك على Sawa")}
                      />
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyWrap}>
                    <View style={styles.emptyShapeOuter}>
                      <LinearGradient
                        colors={[Colors.primary, Colors.secondary, Colors.accent]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.emptyShape}
                      />
                      <View style={styles.emptyShapeGlow} />
                    </View>
                    <Text style={styles.emptyTitle}>{t("ما في أصحاب بعد")}</Text>
                    <Text style={styles.emptySub}>
                      {t("دور باسم صاحبك فوق أو ابعتلو دعوة")}
                    </Text>
                    <PressableScale onPress={onInviteShare}>
                      <LinearGradient
                        colors={[Colors.primary, Colors.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.emptyBtn}
                      >
                        <Share2 size={18} color={Colors.text} strokeWidth={2.4} />
                        <Text style={styles.emptyBtnText}>{t("دعوة أصحاب")}</Text>
                      </LinearGradient>
                    </PressableScale>
                  </View>
                )
              ) : (
                <>
                  <View style={styles.sectionCard}>
                    {DEMO_FRIENDS.map((f) => (
                      <View key={f.id} style={styles.row}>
                        <View style={[styles.addBtn, styles.addBtnDone]}>
                          <Check size={14} color={Colors.success} strokeWidth={2.8} />
                          <Text style={styles.addBtnDoneText}>{t("صاحبك")}</Text>
                        </View>
                        <View style={styles.rowBody}>
                          <Avatar
                            size={44}
                            photo={f.photo}
                            gradient={f.gradient}
                            initial={f.name.charAt(0)}
                          />
                          <View style={styles.rowText}>
                            <Text style={styles.rowName} numberOfLines={1}>{t(f.name)}</Text>
                            <Text style={styles.rowSub}>{t(f.plans)}</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                  <View style={styles.guestHint}>
                    <Text style={styles.guestHintText}>
                      {t("سجّل الدخول لتضيف أصحاب حقيقيين")}
                    </Text>
                    <PressableScale onPress={() => router.replace("/phone")}>
                      <LinearGradient
                        colors={[Colors.primary, Colors.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.guestBtn}
                      >
                        <Text style={styles.guestBtnText}>{t("تسجيل الدخول")}</Text>
                      </LinearGradient>
                    </PressableScale>
                  </View>
                </>
              )}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      {/* QR modal */}
      <Modal visible={qrOpen} transparent animationType="fade" onRequestClose={() => setQrOpen(false)}>
        <View style={styles.qrOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setQrOpen(false)} />
          <View style={styles.qrCardWrap}>
            <Pressable style={styles.qrClose} hitSlop={12} onPress={() => setQrOpen(false)}>
              <X size={22} color={Colors.text} strokeWidth={2.4} />
            </Pressable>

            <Text style={styles.qrName}>{profile?.name ?? t("رالف")}</Text>

            <View style={styles.qrCard}>
              <View style={styles.qrInner}>
                <QRPattern />
              </View>
              <View style={styles.qrLogoWrap}>
                <LinearGradient
                  colors={[Colors.primary, Colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.qrLogo}
                >
                  <Text style={styles.qrLogoText}>س</Text>
                </LinearGradient>
              </View>
            </View>

            <Text style={styles.qrSubtitle}>{t("امسح الكود")}</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

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
  headerSide: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "800" as const,
    writingDirection: "rtl",
  },
  qrIconWrap: { width: 36, height: 36, borderRadius: 12, padding: 1.5 },
  qrIconInner: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 10.5,
    alignItems: "center",
    justifyContent: "center",
  },

  searchWrap: { paddingHorizontal: 16, marginTop: 4 },
  searchBox: {
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: "#2D2A45",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
  },
  searchBoxFocused: {
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    fontWeight: "600" as const,
    writingDirection: "rtl",
    paddingVertical: 0,
  },

  scrollContent: { paddingBottom: 40 },

  section: { marginTop: 22 },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "800" as const,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    textAlign: "right",
    writingDirection: "rtl",
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    marginHorizontal: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2A2547",
  },

  row: {
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#221E3D",
  },
  rowBody: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    flex: 1,
    marginRight: 4,
  },
  rowText: { flex: 1 },
  rowName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "800" as const,
    textAlign: "right",
    writingDirection: "rtl",
  },
  rowSub: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "600" as const,
    marginTop: 3,
    textAlign: "right",
    writingDirection: "rtl",
  },

  addBtn: {
    height: 32,
    minWidth: 72,
    paddingHorizontal: 12,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: "#2D2A45",
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: "800" as const,
    writingDirection: "rtl",
  },
  addBtnDone: {
    backgroundColor: "rgba(61,220,151,0.14)",
    borderWidth: 1,
    borderColor: "rgba(61,220,151,0.45)",
  },
  addBtnDoneText: {
    color: Colors.success,
    fontSize: 12,
    fontWeight: "800" as const,
    writingDirection: "rtl",
  },
  addBtnPending: {
    backgroundColor: "rgba(255,200,87,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,200,87,0.45)",
  },
  addBtnPendingText: {
    color: "#FFC857",
    fontSize: 12,
    fontWeight: "800" as const,
    writingDirection: "rtl",
  },
  addBtnDecline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#3A3458",
  },
  addBtnDeclineText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "800" as const,
    writingDirection: "rtl",
  },

  searchingWrap: {
    paddingVertical: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  searchEmpty: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: "600" as const,
    writingDirection: "rtl",
  },

  emptyWrap: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
  },
  emptyShapeOuter: {
    width: 110,
    height: 110,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyShape: {
    width: 84,
    height: 84,
    borderRadius: 24,
    transform: [{ rotate: "12deg" }],
  },
  emptyShapeGlow: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(255,60,172,0.18)",
    zIndex: -1,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "800" as const,
    writingDirection: "rtl",
  },
  emptySub: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: "600" as const,
    marginTop: 6,
    textAlign: "center",
    writingDirection: "rtl",
  },
  emptyBtn: {
    height: 56,
    width: 260,
    borderRadius: 28,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 22,
    shadowColor: Colors.secondary,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  emptyBtnText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "800" as const,
    writingDirection: "rtl",
  },

  guestHint: {
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2547",
    alignItems: "center",
    gap: 12,
  },
  guestHintText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: "600" as const,
    textAlign: "center",
    writingDirection: "rtl",
  },
  guestBtn: {
    height: 40,
    paddingHorizontal: 22,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  guestBtnText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "800" as const,
  },

  // QR modal
  qrOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  qrCardWrap: { width: "100%", alignItems: "center" },
  qrClose: {
    position: "absolute",
    top: -56,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  qrName: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: "800" as const,
    marginBottom: 16,
    writingDirection: "rtl",
  },
  qrCard: {
    width: 240,
    height: 240,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF3CAC",
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
  },
  qrInner: { width: "100%", height: "100%" },
  qrLogoWrap: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -22,
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 4,
  },
  qrLogo: {
    flex: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  qrLogoText: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" as const },
  qrSubtitle: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: "600" as const,
    marginTop: 18,
    writingDirection: "rtl",
  },
});
