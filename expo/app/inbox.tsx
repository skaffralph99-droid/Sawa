import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  ArrowLeft,
  Bell,
  Camera,
  Sparkles,
} from "lucide-react-native";
import React, { useCallback, useMemo, useRef, useState } from "react";
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
import { useFriends } from "@/constants/friends";
import { useAuth } from "@/constants/auth";
import { hasSupabase } from "@/lib/supabase";
import { getPendingRequests, acceptFriendRequest } from "@/lib/friends";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const TABS = [
  { id: "all", label: "الكل" },
  { id: "plans", label: "البلانات" },
] as const;

type TabId = (typeof TABS)[number]["id"];

type NotifType = "planreal" | "joined" | "mosaic" | "request";

type FriendRequest = {
  kind: "request";
  id: string;
  category: "plans" | "all";
  group: "today" | "yesterday";
  read: boolean;
  avatar: string;
  title: string;
};

type StandardNotif = {
  kind: NotifType;
  id: string;
  category: "plans" | "all";
  group: "today" | "yesterday";
  read: boolean;
  title: string;
  subtitle: string;
  ago: string;
  // visual
  avatar?: string;
  mosaicTiles?: readonly (readonly [string, string])[];
  icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
};

type AnyNotif = StandardNotif | FriendRequest;

const TILES_A: readonly (readonly [string, string])[] = [
  ["#FF6B35", "#FF3CAC"],
  ["#FF3CAC", "#7B2FF7"],
  ["#7B2FF7", "#FF6B35"],
  ["#FFC857", "#FF3CAC"],
];

const NOTIFS: AnyNotif[] = [
  {
    kind: "planreal",
    id: "n1",
    category: "plans",
    group: "today",
    read: false,
    title: "وقت البلان ريل 🔥",
    subtitle: "بلانك — عندك دقيقتين",
    ago: "قبل ٥ دقائق",
    icon: Camera,
  },
  {
    kind: "joined",
    id: "n2",
    category: "plans",
    group: "today",
    read: false,
    title: "أحمد انضم لبلانك 🎉",
    subtitle: "يوم البحر اليوم ☀️",
    ago: "قبل ٢٣ دقيقة",
    avatar:
      "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=200&h=200&fit=crop&crop=faces",
  },
  {
    kind: "mosaic",
    id: "n3",
    category: "all",
    group: "today",
    read: true,
    title: "الموزاييك جاهز ✨",
    subtitle: "شوف لحظتك عالبحر",
    ago: "قبل ساعة",
    mosaicTiles: TILES_A,
  },
  {
    kind: "request",
    id: "n4",
    category: "all",
    group: "today",
    read: false,
    title: "سارة بدها تكون صاحبتك",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=faces",
  } as FriendRequest,
  {
    kind: "joined",
    id: "n5",
    category: "plans",
    group: "yesterday",
    read: true,
    title: "ليا انضمت لبلانك",
    subtitle: "قهوة الصبح ☕",
    ago: "أمس",
    avatar:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop&crop=faces",
  },
  {
    kind: "mosaic",
    id: "n6",
    category: "all",
    group: "yesterday",
    read: true,
    title: "موزاييك ماتش الفوتبول جاهز",
    subtitle: "شوف اللحظة",
    ago: "أمس",
    mosaicTiles: [
      ["#7B2FF7", "#FF3CAC"],
      ["#FF6B35", "#FFC857"],
      ["#FF3CAC", "#FF6B35"],
      ["#FFC857", "#7B2FF7"],
    ],
  },
  {
    kind: "joined",
    id: "n7",
    category: "plans",
    group: "yesterday",
    read: true,
    title: "زياد انضم لبلانك",
    subtitle: "ماتش فوتبول ⚽",
    ago: "أمس",
    avatar:
      "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&h=200&fit=crop&crop=faces",
  },
];

function PressableScale({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPressIn={() =>
          Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 7 }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start()
        }
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

function MosaicThumb({ tiles }: { tiles: readonly (readonly [string, string])[] }) {
  return (
    <View style={styles.mosaicThumb}>
      <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap" }}>
        {tiles.slice(0, 4).map((c, i) => (
          <View key={i} style={{ width: "50%", height: "50%", overflow: "hidden" }}>
            <LinearGradient
              colors={c}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function NotifRow({
  item,
  onAccept,
  onDecline,
  onPress,
}: {
  item: AnyNotif;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onPress: (id: string) => void;
}) {
  const t = useT();
  const isPlanReal = item.kind === "planreal";

  return (
    <PressableScale onPress={() => onPress(item.id)} style={{ marginBottom: 10 }}>
      <View style={styles.rowWrap}>
        {/* Unread dot far left */}
        <View style={styles.dotCol}>
          {!item.read ? (
            <LinearGradient
              colors={[Colors.primary, Colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.unreadDot}
            />
          ) : (
            <View style={{ width: 8 }} />
          )}
        </View>

        <View style={[styles.card, !item.read && styles.cardUnread]}>
          {isPlanReal ? (
            <LinearGradient
              colors={[Colors.primary, Colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.leftBorder}
            />
          ) : null}

          {/* Left visual */}
          {item.kind === "planreal" ? (
            <LinearGradient
              colors={[Colors.primary, Colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.leftCircle}
            >
              <Text style={{ fontSize: 22 }}>📸</Text>
            </LinearGradient>
          ) : item.kind === "mosaic" && item.mosaicTiles ? (
            <MosaicThumb tiles={item.mosaicTiles} />
          ) : item.avatar ? (
            <View style={styles.avatarWrap}>
              <Image source={{ uri: item.avatar }} style={styles.avatarImg} />
            </View>
          ) : (
            <View style={styles.leftCircle}>
              <Bell size={20} color="#fff" strokeWidth={2.4} />
            </View>
          )}

          {/* Content */}
          <View style={styles.contentCol}>
            <Text style={styles.title} numberOfLines={2}>
              {t(item.title)}
            </Text>

            {item.kind !== "request" ? (
              <>
                {item.subtitle ? (
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {t(item.subtitle)}
                  </Text>
                ) : null}
                <Text style={styles.ago}>{t(item.ago)}</Text>
              </>
            ) : (
              <View style={styles.requestBtnRow}>
                <Pressable
                  style={styles.acceptBtn}
                  onPress={() => {
                    if (Platform.OS !== "web")
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    onAccept(item.id);
                  }}
                >
                  <LinearGradient
                    colors={[Colors.primary, Colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text style={styles.acceptText}>{t("قبول")}</Text>
                </Pressable>
                <Pressable
                  style={styles.declineBtn}
                  onPress={() => {
                    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
                    onDecline(item.id);
                  }}
                >
                  <Text style={styles.declineText}>{t("رفض")}</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

function EmptyState() {
  const t = useT();
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyCircle}>
        <LinearGradient
          colors={[Colors.primary, Colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Bell size={36} color="#fff" strokeWidth={2.4} />
      </View>
      <Text style={styles.emptyTitle}>{t("ما في إشعارات بعد")}</Text>
      <Text style={styles.emptySub}>
        {t("لما أصحابك ينضموا لبلاناتك رح تشوفهم هون")}
      </Text>
    </View>
  );
}

export default function InboxScreen() {
  const t = useT();
  const { user, mode } = useAuth();
  const queryClient = useQueryClient();
  const { canSync, declineRequest } = useFriends();
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [items, setItems] = useState<AnyNotif[]>(canSync ? [] : NOTIFS);
  const [dismissedReqIds, setDismissedReqIds] = useState<Record<string, boolean>>({});

  const pendingQuery = useQuery({
    queryKey: ["pending-friend-requests", user?.id ?? null],
    enabled: hasSupabase && mode === "signedIn" && !!user,
    queryFn: async () => {
      if (!user) return [];
      const { requests, error } = await getPendingRequests(user.id);
      if (error) console.log("[inbox] pending error", error);
      return requests;
    },
  });

  // Convert real incoming friend requests into inbox rows
  const liveRequests: AnyNotif[] = useMemo(() => {
    if (!canSync) return [];
    return (pendingQuery.data ?? [])
      .filter((r) => !dismissedReqIds[r.fromUserId])
      .map<FriendRequest>((r) => ({
        kind: "request",
        id: `req_${r.fromUserId}`,
        category: "all",
        group: "today",
        read: false,
        avatar: r.avatar_url ?? "",
        title: r.name
          ? `${r.name} ${t("بدو يكون صاحبك")}`
          : t("حدا بدو يكون صاحبك"),
      }));
  }, [canSync, pendingQuery.data, dismissedReqIds, t]);

  const merged: AnyNotif[] = useMemo(() => [...liveRequests, ...items], [liveRequests, items]);

  const filtered = useMemo(() => {
    if (activeTab === "all") return merged;
    return merged.filter((n) => n.category === "plans");
  }, [activeTab, merged]);

  const today = useMemo(() => filtered.filter((n) => n.group === "today"), [filtered]);
  const yesterday = useMemo(() => filtered.filter((n) => n.group === "yesterday"), [filtered]);

  const markAllRead = useCallback(() => {
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const onAccept = useCallback(
    (id: string) => {
      if (id.startsWith("req_")) {
        const realId = id.slice(4);
        setDismissedReqIds((prev) => ({ ...prev, [realId]: true }));
        if (user) {
          acceptFriendRequest(user.id, realId)
            .then(() => {
              queryClient.invalidateQueries({ queryKey: ["pending-friend-requests", user.id] });
              queryClient.invalidateQueries({ queryKey: ["friendships"] });
            })
            .catch(() => {});
        }
        return;
      }
      setItems((prev) => prev.filter((n) => n.id !== id));
    },
    [user, queryClient]
  );
  const onDecline = useCallback(
    (id: string) => {
      if (id.startsWith("req_")) {
        const realId = id.slice(4);
        setDismissedReqIds((prev) => ({ ...prev, [realId]: true }));
        declineRequest(realId).catch(() => {});
        return;
      }
      setItems((prev) => prev.filter((n) => n.id !== id));
    },
    [declineRequest]
  );
  const onPress = useCallback((id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const isEmpty = filtered.length === 0;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.headerBtn}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
              try { router.back(); } catch { router.replace("/home"); }
            }}
            accessibilityLabel="Back"
          >
            <ArrowLeft size={22} color={Colors.text} strokeWidth={2.4} />
          </Pressable>

          <Text style={styles.headerTitle}>{t("الإشعارات")}</Text>

          <Pressable
            style={styles.headerRightBtn}
            onPress={markAllRead}
            accessibilityLabel="Mark all read"
            testID="mark-all-read"
          >
            <LinearGradient
              colors={[Colors.primary, Colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.markAllGradWrap}
            >
              <View style={styles.markAllInner}>
                <Text style={styles.markAllText}>{t("تعليم الكل")}</Text>
              </View>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Tabs */}
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
                <Text
                  style={[
                    styles.tabText,
                    isActive ? styles.tabTextActive : styles.tabTextInactive,
                  ]}
                >
                  {t(tab.label)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {isEmpty ? (
          <EmptyState />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
          >
            {today.length > 0 ? (
              <>
                <Text style={styles.section}>{t("اليوم")}</Text>
                {today.map((n) => (
                  <NotifRow
                    key={n.id}
                    item={n}
                    onAccept={onAccept}
                    onDecline={onDecline}
                    onPress={onPress}
                  />
                ))}
              </>
            ) : null}

            {yesterday.length > 0 ? (
              <>
                <Text style={[styles.section, { marginTop: 18 }]}>{t("أمس")}</Text>
                <View style={{ opacity: 0.7 }}>
                  {yesterday.map((n) => (
                    <NotifRow
                      key={n.id}
                      item={n}
                      onAccept={onAccept}
                      onDecline={onDecline}
                      onPress={onPress}
                    />
                  ))}
                </View>
              </>
            ) : null}

            <View style={styles.footerHint}>
              <Sparkles size={12} color={Colors.textDim} strokeWidth={2.4} />
              <Text style={styles.footerHintText}>{t("شفت كل شي")}</Text>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  safe: { flex: 1 },

  // Header
  header: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "800" as const,
    writingDirection: "rtl",
  },
  headerRightBtn: {
    borderRadius: 16,
    overflow: "hidden",
  },
  markAllGradWrap: {
    borderRadius: 16,
    padding: 1,
  },
  markAllInner: {
    borderRadius: 15,
    backgroundColor: Colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: "800" as const,
    color: "transparent",
    // Gradient text fallback: use solid primary because RN can't gradient text easily
    // Approximation by giving it the primary color which reads close to the gradient
    ...(Platform.select({
      default: { color: Colors.secondary },
    }) as object),
  },

  // Tabs
  tabBar: {
    marginHorizontal: 20,
    marginTop: 4,
    height: 44,
    backgroundColor: Colors.card,
    borderRadius: 22,
    padding: 4,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: Colors.border,
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

  // List
  list: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 32,
  },
  section: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "800" as const,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 10,
    writingDirection: "rtl",
    textAlign: "right",
    paddingHorizontal: 4,
  },

  // Row
  rowWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  dotCol: {
    width: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  cardUnread: {
    backgroundColor: Colors.cardHi,
  },
  leftBorder: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  leftCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: Colors.cardHi,
  },
  avatarImg: { width: "100%", height: "100%" },
  mosaicThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: Colors.cardHi,
  },
  contentCol: {
    flex: 1,
    alignItems: "flex-end",
  },
  title: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "800" as const,
    textAlign: "right",
    writingDirection: "rtl",
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: "600" as const,
    marginTop: 3,
    textAlign: "right",
    writingDirection: "rtl",
  },
  ago: {
    color: Colors.textDim,
    fontSize: 11,
    fontWeight: "600" as const,
    marginTop: 4,
    writingDirection: "rtl",
  },

  // Request
  requestBtnRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  acceptBtn: {
    height: 32,
    paddingHorizontal: 18,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  acceptText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800" as const,
  },
  declineBtn: {
    height: 32,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "transparent",
  },
  declineText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: "700" as const,
  },

  // Empty
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    paddingBottom: 80,
  },
  emptyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 20,
    shadowColor: Colors.secondary,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "800" as const,
    textAlign: "center",
    writingDirection: "rtl",
  },
  emptySub: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: "600" as const,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
    writingDirection: "rtl",
  },

  footerHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 20,
    opacity: 0.7,
  },
  footerHintText: {
    color: Colors.textDim,
    fontSize: 11,
    fontWeight: "700" as const,
    writingDirection: "rtl",
  },
});
