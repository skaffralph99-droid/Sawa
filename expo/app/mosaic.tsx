import { LinearGradient } from "expo-linear-gradient";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import { ChevronLeft, Share2 } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

import Colors from "@/constants/colors";
import { useT } from "@/constants/i18n";
import { supabase } from "@/lib/supabase";
import { subscribeToMosaicReady } from "@/lib/planreal";

type Tint = readonly [string, string];

type MemberTile = {
  userId: string;
  name: string;
  photoUrl: string | null;
  role: string | null;
  tint: Tint;
};

type Reaction = { id: string; emoji: string; count: number };

const TINTS: Tint[] = [
  ["#FF6B35", "#FF3CAC"],
  ["#7B2FF7", "#FF3CAC"],
  ["#FF3CAC", "#FF6B35"],
  ["#7B2FF7", "#FF6B35"],
  ["#FF6B35", "#7B2FF7"],
  ["#FF3CAC", "#7B2FF7"],
];

const INITIAL_REACTIONS: Reaction[] = [
  { id: "r1", emoji: "😂", count: 3 },
  { id: "r2", emoji: "❤️", count: 12 },
  { id: "r3", emoji: "🔥", count: 7 },
  { id: "r4", emoji: "😍", count: 5 },
  { id: "r5", emoji: "🤯", count: 2 },
];

function buzz(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) {
  if (Platform.OS !== "web") Haptics.impactAsync(style).catch(() => {});
}
function notify(type: Haptics.NotificationFeedbackType) {
  if (Platform.OS !== "web") Haptics.notificationAsync(type).catch(() => {});
}

function PressableScale({ onPress, children, style }: { onPress: () => void; children: React.ReactNode; style?: any }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 6 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start()}
      onPress={() => { buzz(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}

function GradientBorder({ radius, children, width = 1.5 }: { radius: number; children: React.ReactNode; width?: number }) {
  return (
    <LinearGradient
      colors={["#FF6B35", "#FF3CAC", "#7B2FF7"]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ borderRadius: radius, padding: width }}
    >
      <View style={{ borderRadius: radius - width, overflow: "hidden", backgroundColor: Colors.bg }}>{children}</View>
    </LinearGradient>
  );
}

function MosaicTile({
  tile,
  tileSize,
  cardAnim,
  roleAnim,
}: {
  tile: MemberTile;
  tileSize: number;
  cardAnim: Animated.Value;
  roleAnim: Animated.Value;
}) {
  const translateY = cardAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const opacity = cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const scale = cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

  const roleTranslateY = roleAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  const roleOpacity = roleAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const roleScale = roleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  return (
    <Animated.View
      style={[
        styles.tile,
        {
          width: tileSize,
          height: tileSize,
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      {/* Photo or gradient fallback */}
      {tile.photoUrl ? (
        <Image
          source={{ uri: tile.photoUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={tile.tint}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Dark gradient overlay at bottom */}
      <LinearGradient
        colors={["rgba(13,11,30,0)", "rgba(13,11,30,0.85)"]}
        start={{ x: 0, y: 0.4 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Name + role strip at bottom */}
      <View style={styles.tileBottom} pointerEvents="none">
        <Text style={styles.tileName} numberOfLines={1}>{tile.name}</Text>

        {/* Role badge — animates in after pack opening */}
        {tile.role ? (
          <Animated.View
            style={[
              styles.roleBadge,
              {
                opacity: roleOpacity,
                transform: [{ translateY: roleTranslateY }, { scale: roleScale }],
              },
            ]}
          >
            <LinearGradient
              colors={["#FF6B35", "#FF3CAC"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.roleBadgeGradient}
            >
              <Text style={styles.roleBadgeText} numberOfLines={1}>{tile.role}</Text>
            </LinearGradient>
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );
}

export default function MosaicRevealScreen() {
  const t = useT();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ planId?: string }>();
  const planId = (params.planId ?? "") as string;

  const [members, setMembers] = useState<MemberTile[]>([]);
  const [remoteMosaicUrl, setRemoteMosaicUrl] = useState<string | null>(null);
  const [rolesVisible, setRolesVisible] = useState(false);
  const [reactions, setReactions] = useState<Reaction[]>(INITIAL_REACTIONS);
  const [selectedReaction, setSelectedReaction] = useState<string | null>("r2");
  const [busy, setBusy] = useState<"share" | "save" | null>(null);
  const mosaicRef = useRef<View>(null);

  const mosaicSize = Math.min(width * 0.92, 440);
  const tileGap = 3;
  const tileSize = (mosaicSize - tileGap) / 2;

  // We support up to 4 tiles — generate anims for 4 slots
  const cardAnims = useRef(Array.from({ length: 4 }, () => new Animated.Value(0))).current;
  const roleAnims = useRef(Array.from({ length: 4 }, () => new Animated.Value(0))).current;
  const containerScale = useRef(new Animated.Value(0.94)).current;
  const containerOpacity = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  // Fetch members with photos + roles
  useEffect(() => {
    if (!planId) return;
    const fetch = async () => {
      const { data, error } = await supabase
        .from("plan_members")
        .select("user_id, photo_url, role, join_type, profiles!plan_members_user_id_fkey(name)")
        .eq("plan_id", planId)
        .limit(4);
      if (error || !data) return;
      setMembers(
        data.map((m: any, i: number) => ({
          userId: m.user_id,
          name: m.profiles?.name ?? "?",
          photoUrl: m.photo_url ?? null,
          role: m.role ?? null,
          tint: TINTS[i % TINTS.length],
        }))
      );
    };
    fetch();
  }, [planId]);

  // Subscribe to mosaic ready
  useEffect(() => {
    if (!planId) return;
    const channel = subscribeToMosaicReady(planId, (url) => setRemoteMosaicUrl(url));
    return () => { try { channel.unsubscribe(); } catch {} };
  }, [planId]);

  // Run reveal animation when members load
  useEffect(() => {
    if (members.length === 0) return;

    Animated.parallel([
      Animated.timing(containerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(containerScale, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 8 }),
    ]).start();

    const count = Math.min(members.length, 4);
    const staggeredCards = Animated.stagger(
      180,
      cardAnims.slice(0, count).map((a) =>
        Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 9 })
      )
    );

    staggeredCards.start(() => {
      notify(Haptics.NotificationFeedbackType.Success);

      // After pack opening, reveal roles one by one
      setTimeout(() => {
        setRolesVisible(true);
        Animated.stagger(
          200,
          roleAnims.slice(0, count).map((a) =>
            Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 12 })
          )
        ).start(() => {
          buzz(Haptics.ImpactFeedbackStyle.Heavy);
        });
      }, 600);
    });

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 2400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(glow, { toValue: 0, duration: 2400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(rotate, { toValue: 1, duration: 18000, useNativeDriver: true, easing: Easing.linear })
    ).start();
  }, [members.length]);

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const rotateDeg = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const captureMosaic = useCallback(async (): Promise<string | null> => {
    if (!mosaicRef.current) return null;
    try {
      return await captureRef(mosaicRef, { format: "png", quality: 1, result: "tmpfile" });
    } catch {
      return null;
    }
  }, []);

  const doShare = useCallback(async () => {
    if (busy) return;
    buzz(Haptics.ImpactFeedbackStyle.Medium);
    setBusy("share");
    try {
      const uri = await captureMosaic();
      const message = "This moment is yours forever ✨ — Sawa ◈";
      if (Platform.OS === "web") {
        const nav = navigator as any;
        if (typeof nav.share === "function") await nav.share({ title: "Sawa", text: message, url: uri ?? undefined });
        else Alert.alert("Share", message);
      } else {
        await Share.share(uri ? { url: uri, message, title: "Sawa" } : { message, title: "Sawa" });
      }
      notify(Haptics.NotificationFeedbackType.Success);
    } catch {}
    finally { setBusy(null); }
  }, [busy, captureMosaic]);

  const onSave = useCallback(async () => {
    if (busy) return;
    buzz(Haptics.ImpactFeedbackStyle.Light);
    setBusy("save");
    try {
      const uri = await captureMosaic();
      if (!uri) { Alert.alert("Couldn't save", "Try again"); return; }
      if (Platform.OS === "web") {
        const a = document.createElement("a");
        a.href = uri; a.download = "sawa-mosaic.png";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      } else {
        const perm = await MediaLibrary.requestPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permission needed", "Allow access to photos to save"); return; }
        await MediaLibrary.saveToLibraryAsync(uri);
        notify(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Saved ✨", "Mosaic saved to your photos");
      }
    } catch {}
    finally { setBusy(null); }
  }, [busy, captureMosaic]);

  const onReact = useCallback((id: string) => {
    notify(Haptics.NotificationFeedbackType.Success);
    setSelectedReaction((cur) => {
      const wasSelected = cur === id;
      setReactions((prev) =>
        prev.map((r) => {
          if (r.id === id) return { ...r, count: wasSelected ? Math.max(0, r.count - 1) : r.count + 1 };
          if (cur && r.id === cur) return { ...r, count: Math.max(0, r.count - 1) };
          return r;
        })
      );
      return wasSelected ? null : id;
    });
  }, []);

  // Build 2×2 grid tiles (up to 4)
  const tiles = members.slice(0, 4);
  const topRow = tiles.slice(0, 2);
  const bottomRow = tiles.slice(2, 4);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <View pointerEvents="none" style={styles.bgGlowWrap}>
        <LinearGradient
          colors={["rgba(123,47,247,0.18)", "rgba(123,47,247,0.05)", "rgba(13,11,30,0)"]}
          style={styles.bgGlow}
          start={{ x: 0.5, y: 0.3 }} end={{ x: 0.5, y: 1 }}
        />
      </View>
      <View pointerEvents="none" style={[styles.blob, { top: -40, left: -30, backgroundColor: "#FF6B35", opacity: 0.18 }]} />
      <View pointerEvents="none" style={[styles.blobSmall, { top: 80, right: -20, backgroundColor: "#FF3CAC", opacity: 0.16 }]} />
      <View pointerEvents="none" style={[styles.blob, { bottom: -60, left: -40, backgroundColor: "#7B2FF7", opacity: 0.14 }]} />

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <PressableScale onPress={() => { try { router.back(); } catch { router.replace("/home"); } }} style={styles.headerSide}>
            <View style={styles.backBtn}><ChevronLeft color={Colors.text} size={22} strokeWidth={2.4} /></View>
          </PressableScale>
          <Text style={styles.headerTitle}>Your moment</Text>
          <PressableScale onPress={doShare} style={styles.headerSide}>
            <View style={styles.shareIconWrap}>
              <LinearGradient colors={["#FF6B35", "#FF3CAC", "#7B2FF7"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <View style={styles.shareIconInner}><Share2 color={Colors.text} size={18} strokeWidth={2.4} /></View>
            </View>
          </PressableScale>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.mosaicCenter}>
            {/* Outer glow ring */}
            <Animated.View
              pointerEvents="none"
              style={[styles.mosaicGlow, { width: mosaicSize + 40, height: mosaicSize + 40, opacity: glowOpacity, transform: [{ scale: glowScale }, { rotate: rotateDeg }] }]}
            >
              <LinearGradient colors={["#FF6B35", "#FF3CAC", "#7B2FF7", "#FF6B35"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 40 }]} />
            </Animated.View>

            <Animated.View
              ref={mosaicRef as any}
              collapsable={false}
              style={[styles.mosaic, { width: mosaicSize, height: mosaicSize, opacity: containerOpacity, transform: [{ scale: containerScale }] }]}
            >
              {remoteMosaicUrl ? (
                <Image source={{ uri: remoteMosaicUrl }} style={{ width: mosaicSize, height: mosaicSize }} resizeMode="cover" />
              ) : tiles.length > 0 ? (
                <View style={styles.mosaicGrid}>
                  <View style={{ flexDirection: "row" }}>
                    {topRow.map((tile, i) => (
                      <React.Fragment key={tile.userId}>
                        <MosaicTile tile={tile} tileSize={tileSize} cardAnim={cardAnims[i]} roleAnim={roleAnims[i]} />
                        {i < topRow.length - 1 && <View style={{ width: tileGap, height: tileSize }} />}
                      </React.Fragment>
                    ))}
                  </View>
                  {bottomRow.length > 0 && (
                    <>
                      <View style={{ height: tileGap, width: "100%" }} />
                      <View style={{ flexDirection: "row" }}>
                        {bottomRow.map((tile, i) => (
                          <React.Fragment key={tile.userId}>
                            <MosaicTile tile={tile} tileSize={tileSize} cardAnim={cardAnims[i + 2]} roleAnim={roleAnims[i + 2]} />
                            {i < bottomRow.length - 1 && <View style={{ width: tileGap, height: tileSize }} />}
                          </React.Fragment>
                        ))}
                      </View>
                    </>
                  )}
                </View>
              ) : (
                // Loading state
                <View style={[styles.mosaicGrid, { alignItems: "center", justifyContent: "center" }]}>
                  <Text style={{ color: Colors.textMuted, fontSize: 14 }}>Loading...</Text>
                </View>
              )}
            </Animated.View>
          </View>

          {/* Reactions */}
          <View style={styles.reactionRow}>
            {reactions.map((r) => {
              const selected = selectedReaction === r.id;
              return (
                <PressableScale key={r.id} onPress={() => onReact(r.id)} style={styles.reactionItem}>
                  <View>
                    {selected ? (
                      <GradientBorder radius={22} width={1.5}>
                        <View style={styles.reactionCircleInner}><Text style={[styles.reactionEmoji, styles.reactionEmojiBig]}>{r.emoji}</Text></View>
                      </GradientBorder>
                    ) : (
                      <View style={styles.reactionCircle}><Text style={styles.reactionEmoji}>{r.emoji}</Text></View>
                    )}
                    <Text style={[styles.reactionCount, selected && styles.reactionCountActive]}>{r.count}</Text>
                  </View>
                </PressableScale>
              );
            })}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <PressableScale onPress={doShare}>
              <LinearGradient colors={["#FF6B35", "#FF3CAC"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Share to Instagram</Text>
              </LinearGradient>
            </PressableScale>
            <View style={{ height: 12 }} />
            <PressableScale onPress={onSave}>
              <GradientBorder radius={26} width={1.5}>
                <View style={styles.secondaryBtn}><Text style={styles.secondaryBtnText}>Save image</Text></View>
              </GradientBorder>
            </PressableScale>
          </View>

          <Text style={styles.bottomQuote}>This moment is yours forever ✨</Text>
          <PressableScale onPress={() => router.replace("/home")} style={{ alignSelf: "center", marginTop: 18 }}>
            <Text style={styles.doneLink}>Done</Text>
          </PressableScale>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  safe: { flex: 1 },
  bgGlowWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  bgGlow: { width: 520, height: 520, borderRadius: 260 },
  blob: { position: "absolute", width: 220, height: 220, borderRadius: 200 },
  blobSmall: { position: "absolute", width: 140, height: 140, borderRadius: 140 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, height: 52 },
  headerSide: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  headerTitle: { color: Colors.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
  shareIconWrap: { width: 36, height: 36, borderRadius: 18, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  shareIconInner: { position: "absolute", top: 1.5, left: 1.5, right: 1.5, bottom: 1.5, borderRadius: 17, backgroundColor: Colors.card, alignItems: "center", justifyContent: "center" },
  scroll: { paddingBottom: 40, paddingHorizontal: 20 },
  mosaicCenter: { alignItems: "center", justifyContent: "center", marginTop: 4, marginBottom: 8 },
  mosaicGlow: { position: "absolute", borderRadius: 40 },
  mosaic: { backgroundColor: Colors.card, borderRadius: 20, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 16 }, elevation: 12 },
  mosaicGrid: { backgroundColor: Colors.bg },
  tile: { overflow: "hidden", justifyContent: "flex-end" },
  tileBottom: { paddingHorizontal: 8, paddingBottom: 8, paddingTop: 4 },
  tileName: { color: Colors.text, fontSize: 12, fontWeight: "800", textAlign: "center", marginBottom: 4 },
  roleBadge: { alignSelf: "center" },
  roleBadgeGradient: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  roleBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800", textAlign: "center" },
  reactionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 20, paddingHorizontal: 4 },
  reactionItem: { alignItems: "center" },
  reactionCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  reactionCircleInner: { width: 41, height: 41, borderRadius: 21, backgroundColor: Colors.card, alignItems: "center", justifyContent: "center" },
  reactionEmoji: { fontSize: 20 },
  reactionEmojiBig: { fontSize: 24 },
  reactionCount: { marginTop: 6, color: Colors.textMuted, fontSize: 12, textAlign: "center", fontWeight: "700" },
  reactionCountActive: { color: Colors.text },
  actions: { marginTop: 22 },
  primaryBtn: { height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", shadowColor: "#FF3CAC", shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  primaryBtnText: { color: Colors.text, fontSize: 16, fontWeight: "800" },
  secondaryBtn: { height: 49, borderRadius: 24.5, backgroundColor: Colors.bg, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { color: Colors.text, fontSize: 16, fontWeight: "700" },
  bottomQuote: { marginTop: 22, color: Colors.textMuted, fontSize: 13, textAlign: "center", fontWeight: "600" },
  doneLink: { color: Colors.textMuted, fontSize: 14, fontWeight: "700", padding: 8 },
});
