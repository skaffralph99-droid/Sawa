/**
 * PlanReal Test Screen
 * Take 4 photos from one phone — see the full mosaic reveal animation.
 */
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { X, SwitchCamera, Check, ChevronLeft } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as MediaLibrary from "expo-media-library";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";

import Colors from "@/constants/colors";

const NAMES = ["You", "Ahmad", "Sara", "Khalil"];
const SHOT_COUNT = 4;

type Phase = "intro" | "capture" | "reveal";

function buzz(s: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) {
  if (Platform.OS !== "web") Haptics.impactAsync(s).catch(() => {});
}
function notify(t: Haptics.NotificationFeedbackType) {
  if (Platform.OS !== "web") Haptics.notificationAsync(t).catch(() => {});
}

// ─── INTRO ────────────────────────────────────────────────
function IntroScreen({ onStart }: { onStart: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  return (
    <View style={intro.root}>
      <View style={intro.top}>
        <Animated.Text style={[intro.emoji, { transform: [{ scale: pulse }] }]}>📸</Animated.Text>
        <Text style={intro.title}>PlanReal Test</Text>
        <Text style={intro.sub}>{"Take 4 shots from one phone.\nSee the full mosaic reveal."}</Text>
      </View>
      <View style={intro.steps}>
        {[
          { n: "1", label: "Take 4 photos one by one" },
          { n: "2", label: "Each shot = one friend's moment" },
          { n: "3", label: "Watch the mosaic build live" },
          { n: "4", label: "Share to Instagram" },
        ].map((s) => (
          <View key={s.n} style={intro.stepRow}>
            <LinearGradient colors={[Colors.primary, Colors.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={intro.stepNum}>
              <Text style={intro.stepNumText}>{s.n}</Text>
            </LinearGradient>
            <Text style={intro.stepLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
      <Pressable onPress={() => { buzz(); onStart(); }} style={intro.btn}>
        <LinearGradient colors={[Colors.primary, Colors.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={intro.btnGrad}>
          <Text style={intro.btnText}>Start PlanReal Test ⚡</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const intro = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "space-between", padding: 32 },
  top: { alignItems: "center", paddingTop: 40 },
  emoji: { fontSize: 72, marginBottom: 20 },
  title: { color: Colors.text, fontSize: 28, fontWeight: "800", marginBottom: 10, textAlign: "center" },
  sub: { color: Colors.textMuted, fontSize: 15, textAlign: "center", lineHeight: 22 },
  steps: { width: "100%", gap: 14 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  stepNum: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  stepNumText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  stepLabel: { color: Colors.text, fontSize: 15, fontWeight: "600" },
  btn: { width: "100%", height: 56, borderRadius: 28, overflow: "hidden" },
  btnGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "800" },
});

// ─── CAPTURE ──────────────────────────────────────────────
function CaptureScreen({ photos, onCapture }: { photos: string[]; onCapture: (uri: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const cameraRef = useRef<CameraView | null>(null);
  const [capturing, setCapturing] = useState(false);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const captureScale = useRef(new Animated.Value(1)).current;

  const shotIndex = photos.length;
  const name = NAMES[shotIndex] ?? "Friend";
  const isLast = shotIndex === SHOT_COUNT - 1;

  const flashScreen = useCallback(() => {
    flashAnim.setValue(1);
    Animated.timing(flashAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
  }, [flashAnim]);

  const handleCapture = useCallback(async () => {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);
    buzz(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.sequence([
      Animated.timing(captureScale, { toValue: 0.9, duration: 60, useNativeDriver: true }),
      Animated.spring(captureScale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 12 }),
    ]).start();
    flashScreen();
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: false });
      if (photo?.uri) {
        notify(Haptics.NotificationFeedbackType.Success);
        onCapture(photo.uri);
      }
    } catch (e) {
      console.log("[camera] error", e);
    }
    setCapturing(false);
  }, [capturing, flashScreen, captureScale, onCapture]);

  if (!permission) return <View style={{ flex: 1, backgroundColor: "#000" }} />;
  if (!permission.granted) {
    return (
      <View style={cap.permRoot}>
        <Text style={cap.permText}>Camera access needed</Text>
        <Pressable onPress={requestPermission} style={cap.permBtn}>
          <LinearGradient colors={[Colors.primary, Colors.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cap.permBtnGrad}>
            <Text style={cap.permBtnText}>Allow Camera</Text>
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView style={StyleSheet.absoluteFill} ref={cameraRef} facing={facing} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#fff", opacity: flashAnim }]} />
      <LinearGradient colors={["rgba(13,11,30,0.9)", "transparent"]} style={cap.topOverlay} />

      <SafeAreaView edges={["top"]} style={cap.progressWrap}>
        <View style={cap.progressRow}>
          {Array.from({ length: SHOT_COUNT }).map((_, i) => (
            <View key={i} style={[cap.dot, i < photos.length && cap.dotDone, i === photos.length && cap.dotActive]}>
              {i < photos.length && <Check size={12} color="#fff" strokeWidth={3} />}
            </View>
          ))}
        </View>
        <Text style={cap.shotLabel}>
          Shot {shotIndex + 1} of {SHOT_COUNT} — <Text style={{ color: Colors.primary }}>{name}</Text>
        </Text>
      </SafeAreaView>

      {photos.length > 0 && (
        <View style={cap.thumbRow}>
          {photos.map((uri, i) => (
            <View key={i} style={cap.thumb}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              <LinearGradient colors={[Colors.primary, Colors.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={cap.thumbCheck}>
                <Check size={9} color="#fff" strokeWidth={3} />
              </LinearGradient>
            </View>
          ))}
        </View>
      )}

      <LinearGradient colors={["transparent", "rgba(13,11,30,0.96)"]} style={cap.bottomOverlay}>
        <SafeAreaView edges={["bottom"]} style={cap.bottomSafe}>
          <View style={cap.controls}>
            <Pressable onPress={() => { buzz(Haptics.ImpactFeedbackStyle.Light); setFacing((f) => f === "back" ? "front" : "back"); }} style={cap.sideBtn}>
              <SwitchCamera size={26} color="#fff" strokeWidth={2} />
            </Pressable>
            <Animated.View style={{ transform: [{ scale: captureScale }] }}>
              <Pressable onPress={handleCapture} disabled={capturing} style={cap.captureOuter}>
                <LinearGradient colors={[Colors.primary, Colors.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={cap.captureInner}>
                  <Text style={{ fontSize: 32 }}>{isLast ? "✨" : "📸"}</Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
            <View style={cap.sideBtn} />
          </View>
          <Text style={cap.hint}>{isLast ? "Last shot — make it count!" : `${SHOT_COUNT - shotIndex - 1} more after this`}</Text>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const cap = StyleSheet.create({
  permRoot: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg, gap: 20 },
  permText: { color: Colors.text, fontSize: 16 },
  permBtn: { height: 52, borderRadius: 26, overflow: "hidden" },
  permBtnGrad: { flex: 1, paddingHorizontal: 28, alignItems: "center", justifyContent: "center" },
  permBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  topOverlay: { position: "absolute", top: 0, left: 0, right: 0, height: 160 },
  progressWrap: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", paddingTop: 8 },
  progressRow: { flexDirection: "row", gap: 12, marginBottom: 10 },
  dot: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center" },
  dotDone: { backgroundColor: "#3DDC97", borderColor: "#3DDC97" },
  dotActive: { borderColor: Colors.primary, borderWidth: 2.5 },
  shotLabel: { color: "#fff", fontSize: 15, fontWeight: "700" },
  thumbRow: { position: "absolute", top: 125, left: 20, right: 20, flexDirection: "row", gap: 8 },
  thumb: { width: 58, height: 58, borderRadius: 12, overflow: "hidden", backgroundColor: Colors.card, borderWidth: 2, borderColor: Colors.primary + "80" },
  thumbCheck: { position: "absolute", bottom: 3, right: 3, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  bottomOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, paddingTop: 80 },
  bottomSafe: { alignItems: "center", paddingBottom: 20 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingHorizontal: 52, marginBottom: 14 },
  sideBtn: { width: 50, height: 50, alignItems: "center", justifyContent: "center" },
  captureOuter: { width: 88, height: 88, borderRadius: 44, borderWidth: 3.5, borderColor: "rgba(255,255,255,0.7)", overflow: "hidden" },
  captureInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  hint: { color: "rgba(255,255,255,0.55)", fontSize: 13 },
});

// ─── MOSAIC REVEAL ────────────────────────────────────────
function MosaicReveal({ photos }: { photos: string[] }) {
  const { width } = useWindowDimensions();

  // Mosaic is a fixed square — 90% of screen width
  const mosaicSize = Math.min(width * 0.9, 380);
  const GAP = 4;
  const TILE = (mosaicSize - GAP) / 2; // Each tile is exactly half minus the gap

  // One Animated.Value per tile
  const tileAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  // Other animation values
  const containerScale = useRef(new Animated.Value(0.85)).current;
  const containerOpacity = useRef(new Animated.Value(0)).current;
  const borderAnim = useRef(new Animated.Value(0)).current;
  const vibeValue = useRef(new Animated.Value(0)).current;
  const shareSlide = useRef(new Animated.Value(100)).current;
  const shareOpacity = useRef(new Animated.Value(0)).current;
  const glowLoop = useRef(new Animated.Value(0)).current;
  const titleScale = useRef(new Animated.Value(0.8)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;

  const mosaicRef = useRef<View>(null);
  const [vibeScore, setVibeScore] = useState(0);
  const targetVibe = useRef(Math.floor(85 + Math.random() * 15)).current;
  const [reactions, setReactions] = useState([
    { id: "r1", emoji: "😂", count: 3 },
    { id: "r2", emoji: "❤️", count: 12 },
    { id: "r3", emoji: "🔥", count: 7 },
    { id: "r4", emoji: "😍", count: 5 },
    { id: "r5", emoji: "🤯", count: 2 },
  ]);
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);

  useEffect(() => {
    // Step 1: Title fades in
    Animated.parallel([
      Animated.spring(titleScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 12 }),
      Animated.timing(titleOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    // Step 2: Container appears (slight delay)
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(containerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(containerScale, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 6 }),
      ]).start();
    }, 300);

    // Step 3: Tiles reveal one by one with 700ms gap — haptic each time
    const delays = [600, 1300, 2000, 2700];
    tileAnims.forEach((anim, i) => {
      setTimeout(() => {
        buzz(Haptics.ImpactFeedbackStyle.Medium);
        Animated.spring(anim, {
          toValue: 1,
          useNativeDriver: true,
          speed: 18,
          bounciness: 14,
        }).start();
      }, delays[i]);
    });

    // Step 4: After last tile — big haptic + border glow
    setTimeout(() => {
      notify(Haptics.NotificationFeedbackType.Success);
      Animated.timing(borderAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, 3200);

    // Step 5: Vibe score counts up
    setTimeout(() => {
      vibeValue.addListener(({ value }) => setVibeScore(Math.floor(value)));
      Animated.timing(vibeValue, {
        toValue: targetVibe,
        duration: 2000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, 3500);

    // Step 6: Share button slides up
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(shareSlide, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 12 }),
        Animated.timing(shareOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]).start(() => {
        notify(Haptics.NotificationFeedbackType.Success);
      });
    }, 4200);

    // Glow loop — runs forever
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowLoop, { toValue: 1, duration: 1800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(glowLoop, { toValue: 0, duration: 1800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();

    return () => { vibeValue.removeAllListeners(); };
  }, []);

  const glowOpacity = glowLoop.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.65] });
  const glowScale = glowLoop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const vibeEmoji = targetVibe >= 95 ? "🔥🔥🔥" : targetVibe >= 88 ? "🔥🔥" : "🔥";

  const handleShare = useCallback(async () => {
    buzz();
    if (!mosaicRef.current) return;
    try {
      const uri = await captureRef(mosaicRef, { format: "png", quality: 1, result: "tmpfile" });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(uri, { mimeType: "image/png" });
    } catch (e) { console.log("[share] error", e); }
  }, []);

  const handleSave = useCallback(async () => {
    buzz();
    if (!mosaicRef.current) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") return;
      const uri = await captureRef(mosaicRef, { format: "png", quality: 1, result: "tmpfile" });
      await MediaLibrary.saveToLibraryAsync(uri);
      notify(Haptics.NotificationFeedbackType.Success);
    } catch (e) { console.log("[save] error", e); }
  }, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      contentContainerStyle={rv.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* Title */}
      <Animated.View style={[rv.titleWrap, { opacity: titleOpacity, transform: [{ scale: titleScale }] }]}>
        <Text style={rv.titleText}>Your Moment ✨</Text>
        <Text style={rv.titleSub}>Same moment — 4 angles</Text>
      </Animated.View>

      {/* Glow blob behind mosaic */}
      <Animated.View
        pointerEvents="none"
        style={[rv.glow, { opacity: glowOpacity, transform: [{ scale: glowScale }], width: mosaicSize + 60, height: mosaicSize + 60 }]}
      >
        <LinearGradient
          colors={[Colors.primary + "80", Colors.secondary + "80", Colors.accent + "80"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ flex: 1, borderRadius: 999 }}
        />
      </Animated.View>

      {/* Mosaic wrapper with gradient border */}
      <Animated.View style={{ opacity: containerOpacity, transform: [{ scale: containerScale }] }}>
        {/* Animated gradient border */}
        <Animated.View style={{ opacity: borderAnim }}>
          <LinearGradient
            colors={[Colors.primary, Colors.secondary, Colors.accent, Colors.primary]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ borderRadius: 22, padding: 2.5 }}
          >
            {/* Inner mosaic grid */}
            <View
              ref={mosaicRef}
              style={{
                width: mosaicSize,
                height: mosaicSize,
                backgroundColor: Colors.bg,
                borderRadius: 20,
                overflow: "hidden",
              }}
            >
              {/* TOP ROW */}
              <View style={{ flexDirection: "row", gap: GAP }}>
                {/* Tile 0 — top left */}
                <TileView anim={tileAnims[0]} uri={photos[0]} name={NAMES[0]} size={TILE} />
                {/* Tile 1 — top right */}
                <TileView anim={tileAnims[1]} uri={photos[1]} name={NAMES[1]} size={TILE} />
              </View>

              {/* GAP ROW */}
              <View style={{ height: GAP, backgroundColor: Colors.bg }} />

              {/* BOTTOM ROW */}
              <View style={{ flexDirection: "row", gap: GAP }}>
                {/* Tile 2 — bottom left */}
                <TileView anim={tileAnims[2]} uri={photos[2]} name={NAMES[2]} size={TILE} />
                {/* Tile 3 — bottom right */}
                <TileView anim={tileAnims[3]} uri={photos[3]} name={NAMES[3]} size={TILE} />
              </View>

              {/* Meta bar overlay at very bottom */}
              <View style={rv.metaBar}>
                <Text style={rv.metaLeft}>📍 Zahle · Now</Text>
                <Text style={rv.metaRight}>Sawa ◈</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Border off state — plain border while building */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, {
            borderRadius: 22,
            borderWidth: 1.5,
            borderColor: "#2D2A45",
            opacity: borderAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          }]}
        />
      </Animated.View>

      {/* Vibe score */}
      <Animated.View style={[rv.vibeRow, { opacity: shareOpacity }]}>
        <Text style={rv.vibeText}>
          {"Tonight's vibe: "}
          <Text style={rv.vibeNum}>{vibeScore}/100</Text>
          {" " + vibeEmoji}
        </Text>
      </Animated.View>

      {/* Reactions */}
      <Animated.View style={[rv.reactRow, { opacity: shareOpacity }]}>
        {reactions.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => {
              buzz(Haptics.ImpactFeedbackStyle.Light);
              const wasSelected = selectedReaction === r.id;
              setSelectedReaction(wasSelected ? null : r.id);
              setReactions((prev) =>
                prev.map((x) =>
                  x.id === r.id ? { ...x, count: wasSelected ? x.count - 1 : x.count + 1 } : x
                )
              );
            }}
            style={[rv.reactionBtn, selectedReaction === r.id && rv.reactionActive]}
          >
            <Text style={rv.reactionEmoji}>{r.emoji}</Text>
            <Text style={rv.reactionCount}>{r.count}</Text>
          </Pressable>
        ))}
      </Animated.View>

      {/* Share + Save */}
      <Animated.View style={[rv.actions, { opacity: shareOpacity, transform: [{ translateY: shareSlide }] }]}>
        <Pressable onPress={handleShare} style={rv.shareBtn}>
          <LinearGradient colors={[Colors.primary, Colors.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={rv.shareBtnGrad}>
            <Text style={rv.shareBtnText}>Share to Instagram 🔗</Text>
          </LinearGradient>
        </Pressable>
        <Pressable onPress={handleSave} style={rv.saveBtn}>
          <Text style={rv.saveBtnText}>Save to Photos</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ marginTop: 8, alignItems: "center" }}>
          <Text style={{ color: Colors.textMuted, fontSize: 14, fontWeight: "600" }}>Try Again</Text>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

// Single tile component
function TileView({ anim, uri, name, size }: { anim: Animated.Value; uri: string; name: string; size: number }) {
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        opacity,
        transform: [{ scale }, { translateY }],
        overflow: "hidden",
      }}
    >
      {/* Photo */}
      <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />

      {/* Gradient name strip */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.75)"]}
        style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0,
          paddingTop: 28, paddingBottom: 8, paddingHorizontal: 8,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>{name}</Text>
      </LinearGradient>
    </Animated.View>
  );
}

const rv = StyleSheet.create({
  scroll: { alignItems: "center", paddingTop: 60, paddingBottom: 60, gap: 20 },
  titleWrap: { alignItems: "center", marginBottom: 4 },
  titleText: { color: Colors.text, fontSize: 26, fontWeight: "800" },
  titleSub: { color: Colors.textMuted, fontSize: 14, marginTop: 4 },
  glow: { position: "absolute", top: 60, borderRadius: 999 },
  metaBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: "rgba(13,11,30,0.5)",
  },
  metaLeft: { color: "rgba(155,155,180,0.85)", fontSize: 10, fontWeight: "600" },
  metaRight: { color: "rgba(155,155,180,0.85)", fontSize: 10, fontWeight: "600" },
  vibeRow: { alignItems: "center" },
  vibeText: { color: Colors.textMuted, fontSize: 15, fontWeight: "600" },
  vibeNum: { color: Colors.primary, fontWeight: "800", fontSize: 15 },
  reactRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  reactionBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: Colors.card, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: "#2D2A45",
  },
  reactionActive: { borderColor: Colors.primary },
  reactionEmoji: { fontSize: 16 },
  reactionCount: { color: Colors.textMuted, fontSize: 13, fontWeight: "700" },
  actions: { width: "85%", gap: 12 },
  shareBtn: { height: 56, borderRadius: 28, overflow: "hidden" },
  shareBtnGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
  shareBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  saveBtn: { height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: Colors.secondary, alignItems: "center", justifyContent: "center" },
  saveBtnText: { color: Colors.text, fontSize: 15, fontWeight: "700" },
});

// ─── ROOT ─────────────────────────────────────────────────
export default function PlanRealTestScreen() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [photos, setPhotos] = useState<string[]>([]);

  const handleCapture = useCallback((uri: string) => {
    setPhotos((prev) => {
      const next = [...prev, uri];
      if (next.length >= SHOT_COUNT) {
        setTimeout(() => setPhase("reveal"), 500);
      }
      return next;
    });
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <Stack.Screen options={{ headerShown: false, animation: "fade" }} />

      {phase === "intro" && (
        <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
              <X size={22} color={Colors.textMuted} strokeWidth={2} />
            </Pressable>
          </View>
          <IntroScreen onStart={() => setPhase("capture")} />
        </SafeAreaView>
      )}

      {phase === "capture" && (
        <CaptureScreen photos={photos} onCapture={handleCapture} />
      )}

      {phase === "reveal" && photos.length === SHOT_COUNT && (
        <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
              <ChevronLeft size={24} color={Colors.textMuted} strokeWidth={2} />
            </Pressable>
          </View>
          <MosaicReveal photos={photos} />
        </SafeAreaView>
      )}
    </View>
  );
}
