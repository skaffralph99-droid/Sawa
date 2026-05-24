import { LinearGradient } from "expo-linear-gradient";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import { ChevronLeft, Share2 } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  I18nManager,
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
import { subscribeToMosaicReady } from "@/lib/planreal";

type Tint = readonly [string, string];

type Tile = {
  id: string;
  name: string;
  tint: Tint;
};

type Reaction = {
  id: string;
  emoji: string;
  count: number;
};

const TILES: readonly Tile[] = [
  { id: "t1", name: "أحمد", tint: ["#FF6B35", "#FF3CAC"] as const },
  { id: "t2", name: "سارة", tint: ["#7B2FF7", "#FF3CAC"] as const },
  { id: "t3", name: "خليل", tint: ["#FF3CAC", "#FF6B35"] as const },
  { id: "t4", name: "نور", tint: ["#7B2FF7", "#FF6B35"] as const },
] as const;

const INITIAL_REACTIONS: Reaction[] = [
  { id: "r1", emoji: "😂", count: 3 },
  { id: "r2", emoji: "❤️", count: 12 },
  { id: "r3", emoji: "🔥", count: 7 },
  { id: "r4", emoji: "😍", count: 5 },
  { id: "r5", emoji: "🤯", count: 2 },
];

function buzz(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(style).catch(() => {});
  }
}

function notify(type: Haptics.NotificationFeedbackType) {
  if (Platform.OS !== "web") {
    Haptics.notificationAsync(type).catch(() => {});
  }
}

function toArabicNumber(n: number): string {
  const map = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return String(n)
    .split("")
    .map((d) => map[Number(d)] ?? d)
    .join("");
}

function PressableScale({
  onPress,
  children,
  style,
  testID,
}: {
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
  testID?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      testID={testID}
      onPressIn={() => {
        Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
      }}
      onPressOut={() => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
      }}
      onPress={() => {
        buzz();
        onPress();
      }}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}

function MosaicTile({ tile, index, anim }: { tile: Tile; index: number; anim: Animated.Value }) {
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });

  return (
    <Animated.View style={[styles.tile, { opacity, transform: [{ translateY }, { scale }] }]}>
      <LinearGradient
        colors={tile.tint}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* soft glossy sheen */}
      <LinearGradient
        colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0)"] as const}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.6 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* grain dots for texture */}
      <View pointerEvents="none" style={styles.tileGrain}>
        {Array.from({ length: 10 }).map((_, i) => (
          <View
            key={`g-${index}-${i}`}
            style={[
              styles.grainDot,
              {
                top: `${(i * 13 + index * 7) % 90}%`,
                left: `${(i * 19 + index * 11) % 90}%`,
                opacity: 0.08 + ((i + index) % 3) * 0.04,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.tileNameStrip}>
        <Text style={styles.tileName}>{tile.name}</Text>
      </View>
    </Animated.View>
  );
}

function GradientBorder({ radius, children, width = 1.5 }: { radius: number; children: React.ReactNode; width?: number }) {
  return (
    <LinearGradient
      colors={["#FF6B35", "#FF3CAC", "#7B2FF7"] as const}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: radius, padding: width }}
    >
      <View style={{ borderRadius: radius - width, overflow: "hidden", backgroundColor: Colors.bg }}>{children}</View>
    </LinearGradient>
  );
}

export default function MosaicRevealScreen() {
  const t = useT();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ planId?: string }>();
  const planId = (params.planId ?? "") as string;
  const [remoteMosaicUrl, setRemoteMosaicUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) return;
    const channel = subscribeToMosaicReady(planId, (url) => {
      setRemoteMosaicUrl(url);
    });
    return () => {
      try { channel.unsubscribe(); } catch {}
    };
  }, [planId]);
  const mosaicSize = Math.min(width * 0.9, 420);
  const tileGap = 3;
  const tileSize = (mosaicSize - tileGap) / 2;

  const tileAnims = useRef(TILES.map(() => new Animated.Value(0))).current;
  const containerScale = useRef(new Animated.Value(0.94)).current;
  const containerOpacity = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  const [reactions, setReactions] = useState<Reaction[]>(INITIAL_REACTIONS);
  const [selectedReaction, setSelectedReaction] = useState<string | null>("r2");
  const [busy, setBusy] = useState<"share" | "save" | null>(null);
  const mosaicRef = useRef<View>(null);

  const captureMosaic = useCallback(async (): Promise<string | null> => {
    if (!mosaicRef.current) return null;
    try {
      const uri = await captureRef(mosaicRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      return uri;
    } catch (e) {
      console.log("[mosaic] capture failed", e);
      return null;
    }
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(containerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(containerScale, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 8 }),
    ]).start();

    Animated.stagger(
      140,
      tileAnims.map((a) =>
        Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 9 })
      )
    ).start(() => {
      notify(Haptics.NotificationFeedbackType.Success);
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
  }, [containerOpacity, containerScale, glow, rotate, tileAnims]);

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const rotateDeg = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const onReact = useCallback((id: string) => {
    notify(Haptics.NotificationFeedbackType.Success);
    setSelectedReaction((cur) => {
      const wasSelected = cur === id;
      setReactions((prev) =>
        prev.map((r) => {
          if (r.id === id) {
            return { ...r, count: wasSelected ? Math.max(0, r.count - 1) : r.count + 1 };
          }
          if (cur && r.id === cur) {
            return { ...r, count: Math.max(0, r.count - 1) };
          }
          return r;
        })
      );
      return wasSelected ? null : id;
    });
  }, []);

  const doShare = useCallback(async (impact: Haptics.ImpactFeedbackStyle) => {
    if (busy) return;
    buzz(impact);
    setBusy("share");
    try {
      const uri = await captureMosaic();
      const message = t("هاللحظة رح تفضل معك للأبد ✨");
      if (Platform.OS === "web") {
        const navAny = navigator as unknown as { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
        if (typeof navAny.share === "function") {
          await navAny.share({ title: "Sawa", text: message, url: uri ?? undefined });
        } else {
          Alert.alert(t("المشاركة"), message);
        }
      } else {
        await Share.share(
          uri ? { url: uri, message, title: "Sawa" } : { message, title: "Sawa" }
        );
      }
      notify(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.log("[mosaic] share failed", e);
    } finally {
      setBusy(null);
    }
  }, [busy, captureMosaic, t]);

  const onShare = useCallback(() => {
    doShare(Haptics.ImpactFeedbackStyle.Medium);
  }, [doShare]);

  const onSharePill = useCallback(() => {
    doShare(Haptics.ImpactFeedbackStyle.Light);
  }, [doShare]);

  const onSave = useCallback(async () => {
    if (busy) return;
    buzz(Haptics.ImpactFeedbackStyle.Light);
    setBusy("save");
    try {
      const uri = await captureMosaic();
      if (!uri) {
        Alert.alert(t("تعذر الحفظ"), t("حاول مرة أخرى"));
        return;
      }
      if (Platform.OS === "web") {
        try {
          const a = document.createElement("a");
          a.href = uri;
          a.download = "sawa-mosaic.png";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          notify(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
          console.log("[mosaic] web save failed", e);
        }
        return;
      }
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t("الإذن مطلوب"), t("فعّل الإذن للصور لحفظ الصورة"));
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      notify(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("تم الحفظ ✨"), t("تم حفظ الصورة في معرض الصور"));
    } catch (e) {
      console.log("[mosaic] save failed", e);
      Alert.alert(t("تعذر الحفظ"), t("حاول مرة أخرى"));
    } finally {
      setBusy(null);
    }
  }, [busy, captureMosaic, t]);

  const shareIcon = useMemo(
    () => (
      <View style={styles.shareIconWrap}>
        <LinearGradient
          colors={["#FF6B35", "#FF3CAC", "#7B2FF7"] as const}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.shareIconInner}>
          <Share2 color={Colors.text} size={18} strokeWidth={2.4} />
        </View>
      </View>
    ),
    []
  );

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* central radial-ish glow (purple at 10%) */}
      <View pointerEvents="none" style={styles.bgGlowWrap}>
        <LinearGradient
          colors={["rgba(123,47,247,0.18)", "rgba(123,47,247,0.05)", "rgba(13,11,30,0)"] as const}
          style={styles.bgGlow}
          start={{ x: 0.5, y: 0.3 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>

      {/* decorative floating blurred blobs */}
      <View pointerEvents="none" style={[styles.blob, { top: -40, left: -30, backgroundColor: "#FF6B35", opacity: 0.18 }]} />
      <View pointerEvents="none" style={[styles.blobSmall, { top: 80, right: -20, backgroundColor: "#FF3CAC", opacity: 0.16 }]} />
      <View pointerEvents="none" style={[styles.blob, { bottom: -60, left: -40, backgroundColor: "#7B2FF7", opacity: 0.14 }]} />

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={styles.header}>
          <PressableScale
            onPress={() => {
              buzz(Haptics.ImpactFeedbackStyle.Light);
              try {
                router.back();
              } catch {
                router.replace("/home");
              }
            }}
            style={styles.headerSide}
          >
            <View style={styles.backBtn}>
              <ChevronLeft color={Colors.text} size={22} strokeWidth={2.4} />
            </View>
          </PressableScale>
          <Text style={styles.headerTitle}>{t("لحظتكم")}</Text>
          <PressableScale onPress={onShare} style={styles.headerSide}>
            {shareIcon}
          </PressableScale>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Mosaic */}
          <View style={styles.mosaicCenter}>
            {/* Outer gradient glow */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.mosaicGlow,
                {
                  width: mosaicSize + 40,
                  height: mosaicSize + 40,
                  opacity: glowOpacity,
                  transform: [{ scale: glowScale }, { rotate: rotateDeg }],
                },
              ]}
            >
              <LinearGradient
                colors={["#FF6B35", "#FF3CAC", "#7B2FF7", "#FF6B35"] as const}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: 40 }]}
              />
            </Animated.View>

            <Animated.View
              ref={mosaicRef as unknown as React.RefObject<Animated.View>}
              collapsable={false}
              style={[
                styles.mosaic,
                {
                  width: mosaicSize,
                  height: mosaicSize,
                  opacity: containerOpacity,
                  transform: [{ scale: containerScale }],
                },
              ]}
            >
              {remoteMosaicUrl ? (
                <Image source={{ uri: remoteMosaicUrl }} style={{ width: mosaicSize, height: mosaicSize }} resizeMode="cover" />
              ) : (
              <View style={styles.mosaicGrid}>
                <View style={{ flexDirection: "row" }}>
                  <View style={{ width: tileSize, height: tileSize }}>
                    <MosaicTile tile={TILES[0]} index={0} anim={tileAnims[0]} />
                  </View>
                  <View style={{ width: tileGap, height: tileSize }} />
                  <View style={{ width: tileSize, height: tileSize }}>
                    <MosaicTile tile={TILES[1]} index={1} anim={tileAnims[1]} />
                  </View>
                </View>
                <View style={{ height: tileGap, width: "100%" }} />
                <View style={{ flexDirection: "row" }}>
                  <View style={{ width: tileSize, height: tileSize }}>
                    <MosaicTile tile={TILES[2]} index={2} anim={tileAnims[2]} />
                  </View>
                  <View style={{ width: tileGap, height: tileSize }} />
                  <View style={{ width: tileSize, height: tileSize }}>
                    <MosaicTile tile={TILES[3]} index={3} anim={tileAnims[3]} />
                  </View>
                </View>
              </View>
              )}

              {/* Bottom meta row inside mosaic */}
              <View style={styles.mosaicFooter} pointerEvents="none">
                <LinearGradient
                  colors={["rgba(13,11,30,0)", "rgba(13,11,30,0.85)"] as const}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.mosaicFooterRow}>
                  <Text style={styles.mosaicFooterText}>{t("📍 جونيه")}</Text>
                  <Text style={styles.mosaicFooterBrand}>{t("سوا ◈")}</Text>
                </View>
              </View>
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
                        <View style={[styles.reactionCircleInner]}>
                          <Text style={[styles.reactionEmoji, styles.reactionEmojiBig]}>{r.emoji}</Text>
                        </View>
                      </GradientBorder>
                    ) : (
                      <View style={styles.reactionCircle}>
                        <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                      </View>
                    )}
                    <Text style={[styles.reactionCount, selected && styles.reactionCountActive]}>
                      {toArabicNumber(r.count)}
                    </Text>
                  </View>
                </PressableScale>
              );
            })}
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <PressableScale onPress={onSharePill}>
              <LinearGradient
                colors={["#FF6B35", "#FF3CAC"] as const}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>{t("شارك على Instagram")}</Text>
              </LinearGradient>
            </PressableScale>

            <View style={{ height: 12 }} />

            <PressableScale onPress={onSave}>
              <GradientBorder radius={26} width={1.5}>
                <View style={styles.secondaryBtn}>
                  <Text style={styles.secondaryBtnText}>{t("احفظ الصورة")}</Text>
                </View>
              </GradientBorder>
            </PressableScale>
          </View>

          <Text style={styles.bottomQuote}>{t("هاللحظة رح تفضل معك للأبد ✨")}</Text>

          <PressableScale onPress={() => router.replace("/home")} style={{ alignSelf: "center", marginTop: 18 }}>
            <Text style={styles.doneLink}>{t("تم")}</Text>
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

  header: {
    flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 52,
  },
  headerSide: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: { color: Colors.text, fontSize: 18, fontWeight: "800", textAlign: "center" },

  shareIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  shareIconInner: {
    position: "absolute",
    top: 1.5,
    left: 1.5,
    right: 1.5,
    bottom: 1.5,
    borderRadius: 17,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },

  scroll: { paddingBottom: 40, paddingHorizontal: 20 },

  mosaicCenter: { alignItems: "center", justifyContent: "center", marginTop: 4, marginBottom: 8 },
  mosaicGlow: {
    position: "absolute",
    borderRadius: 40,
    shadowColor: "#FF3CAC",
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
  },
  mosaic: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    overflow: "hidden",
    padding: 0,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  mosaicGrid: {
    backgroundColor: Colors.bg,
    padding: 0,
  },
  tile: { flex: 1, overflow: "hidden", justifyContent: "flex-end" },
  tileGrain: { ...StyleSheet.absoluteFillObject },
  grainDot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#fff",
  },
  tileNameStrip: {
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  tileName: { color: Colors.text, fontSize: 11, fontWeight: "800", textAlign: "center" },

  mosaicFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 18,
    paddingBottom: 10,
  },
  mosaicFooterRow: {
    flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mosaicFooterText: { color: Colors.textMuted, fontSize: 10, fontWeight: "700" },
  mosaicFooterBrand: { color: Colors.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 1 },

  reactionRow: {
    flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 20,
    paddingHorizontal: 4,
  },
  reactionItem: { alignItems: "center" },
  reactionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionCircleInner: {
    width: 41,
    height: 41,
    borderRadius: 21,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionEmoji: { fontSize: 20 },
  reactionEmojiBig: { fontSize: 24 },
  reactionCount: { marginTop: 6, color: Colors.textMuted, fontSize: 12, textAlign: "center", fontWeight: "700" },
  reactionCountActive: { color: Colors.text },

  actions: { marginTop: 22 },
  primaryBtn: {
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF3CAC",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  primaryBtnText: { color: Colors.text, fontSize: 16, fontWeight: "800" },
  secondaryBtn: {
    height: 49,
    borderRadius: 24.5,
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { color: Colors.text, fontSize: 16, fontWeight: "700" },

  bottomQuote: {
    marginTop: 22,
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    fontWeight: "600",
  },

  doneLink: { color: Colors.textMuted, fontSize: 14, fontWeight: "700", padding: 8 },
});
