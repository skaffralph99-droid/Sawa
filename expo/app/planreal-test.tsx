/**
 * PlanReal Test Screen
 * Take 4 photos from one phone — see the full mosaic reveal animation.
 * Navigate to this screen from home or settings for testing.
 */
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { X, SwitchCamera, Check, ChevronLeft } from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
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
        Animated.timing(pulse, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  return (
    <View style={intro.root}>
      <View style={intro.top}>
        <Animated.Text style={[intro.emoji, { transform: [{ scale: pulse }] }]}>📸</Animated.Text>
        <Text style={intro.title}>PlanReal Test</Text>
        <Text style={intro.sub}>
          {"Take 4 shots from one phone.\nSee the full mosaic reveal."}
        </Text>
      </View>

      <View style={intro.steps}>
        {[
          { n: "1", label: "Take 4 photos one by one" },
          { n: "2", label: "Each shot represents a friend" },
          { n: "3", label: "Watch the mosaic build live" },
          { n: "4", label: "Share to Instagram" },
        ].map((s) => (
          <View key={s.n} style={intro.stepRow}>
            <LinearGradient
              colors={[Colors.primary, Colors.secondary]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={intro.stepNum}
            >
              <Text style={intro.stepNumText}>{s.n}</Text>
            </LinearGradient>
            <Text style={intro.stepLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={() => { buzz(); onStart(); }}
        style={intro.btn}
      >
        <LinearGradient
          colors={[Colors.primary, Colors.secondary]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={intro.btnGrad}
        >
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
function CaptureScreen({
  photos,
  onCapture,
}: {
  photos: string[];
  onCapture: (uri: string) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const cameraRef = useRef<CameraView | null>(null);
  const [capturing, setCapturing] = useState(false);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const captureScale = useRef(new Animated.Value(1)).current;

  const shotIndex = photos.length; // 0..3
  const name = NAMES[shotIndex] ?? "Friend";
  const isLast = shotIndex === SHOT_COUNT - 1;

  const flashScreen = useCallback(() => {
    flashAnim.setValue(1);
    Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  }, [flashAnim]);

  const handleCapture = useCallback(async () => {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);
    buzz(Haptics.ImpactFeedbackStyle.Heavy);

    Animated.sequence([
      Animated.timing(captureScale, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.spring(captureScale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 10 }),
    ]).start();

    flashScreen();

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: false });
      if (photo?.uri) {
        notify(Haptics.NotificationFeedbackType.Success);
        onCapture(photo.uri);
      }
    } catch (e) {
      console.log("[test-camera] capture error", e);
    }
    setCapturing(false);
  }, [capturing, flashScreen, captureScale, onCapture]);

  if (!permission) return <View style={cap.root} />;
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
    <View style={cap.root}>
      <CameraView style={StyleSheet.absoluteFill} ref={cameraRef} facing={facing} />

      {/* Flash overlay */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#fff", opacity: flashAnim }]} />

      {/* Dark overlay top */}
      <LinearGradient colors={["rgba(13,11,30,0.85)", "transparent"]} style={cap.topOverlay} />

      {/* Progress dots */}
      <SafeAreaView edges={["top"]} style={cap.progressWrap}>
        <View style={cap.progressRow}>
          {Array.from({ length: SHOT_COUNT }).map((_, i) => (
            <View
              key={i}
              style={[
                cap.dot,
                i < photos.length && cap.dotDone,
                i === photos.length && cap.dotActive,
              ]}
            >
              {i < photos.length && <Check size={12} color="#fff" strokeWidth={3} />}
            </View>
          ))}
        </View>
        <Text style={cap.shotLabel}>
          {`Shot ${shotIndex + 1} of ${SHOT_COUNT} — `}
          <Text style={{ color: Colors.primary }}>{name}</Text>
        </Text>
      </SafeAreaView>

      {/* Thumbnails row */}
      {photos.length > 0 && (
        <View style={cap.thumbRow}>
          {photos.map((uri, i) => (
            <View key={i} style={cap.thumb}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} />
              <LinearGradient
                colors={[Colors.primary, Colors.secondary]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={cap.thumbCheck}
              >
                <Check size={10} color="#fff" strokeWidth={3} />
              </LinearGradient>
            </View>
          ))}
        </View>
      )}

      {/* Bottom controls */}
      <LinearGradient colors={["transparent", "rgba(13,11,30,0.95)"]} style={cap.bottomOverlay}>
        <SafeAreaView edges={["bottom"]} style={cap.bottomSafe}>
          <View style={cap.controls}>
            {/* Flip */}
            <Pressable onPress={() => { buzz(Haptics.ImpactFeedbackStyle.Light); setFacing((f) => f === "back" ? "front" : "back"); }} style={cap.sideBtn}>
              <SwitchCamera size={24} color="#fff" strokeWidth={2} />
            </Pressable>

            {/* Capture */}
            <Animated.View style={{ transform: [{ scale: captureScale }] }}>
              <Pressable onPress={handleCapture} disabled={capturing} style={cap.captureOuter}>
                <LinearGradient
                  colors={[Colors.primary, Colors.secondary]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={cap.captureInner}
                >
                  {isLast
                    ? <Text style={{ fontSize: 28 }}>✨</Text>
                    : <Text style={{ fontSize: 28 }}>📸</Text>
                  }
                </LinearGradient>
              </Pressable>
            </Animated.View>

            {/* Spacer */}
            <View style={cap.sideBtn} />
          </View>

          <Text style={cap.hint}>
            {isLast ? "Last shot — make it count!" : `${SHOT_COUNT - shotIndex - 1} more after this`}
          </Text>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const cap = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  permRoot: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg, gap: 20 },
  permText: { color: Colors.text, fontSize: 16 },
  permBtn: { height: 52, borderRadius: 26, overflow: "hidden" },
  permBtnGrad: { flex: 1, paddingHorizontal: 28, alignItems: "center", justifyContent: "center" },
  permBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  topOverlay: { position: "absolute", top: 0, left: 0, right: 0, height: 140 },
  progressWrap: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", paddingTop: 8 },
  progressRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  dot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center", justifyContent: "center",
  },
  dotDone: { backgroundColor: Colors.success ?? "#3DDC97", borderColor: Colors.success ?? "#3DDC97" },
  dotActive: { borderColor: Colors.primary, borderWidth: 2 },
  shotLabel: { color: "#fff", fontSize: 14, fontWeight: "700" },
  thumbRow: { position: "absolute", top: 120, left: 20, right: 20, flexDirection: "row", gap: 8 },
  thumb: { width: 56, height: 56, borderRadius: 10, overflow: "hidden", backgroundColor: Colors.card },
  thumbCheck: { position: "absolute", bottom: 3, right: 3, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  bottomOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, paddingTop: 60 },
  bottomSafe: { alignItems: "center", paddingBottom: 16 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingHorizontal: 48, marginBottom: 12 },
  sideBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  captureOuter: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: "rgba(255,255,255,0.6)", overflow: "hidden" },
  captureInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  hint: { color: "rgba(255,255,255,0.6)", fontSize: 13 },
});

// ─── MOSAIC REVEAL ────────────────────────────────────────
function MosaicReveal({ photos }: { photos: string[] }) {
  const { width } = useWindowDimensions();
  const mosaicSize = Math.min(width * 0.9, 400);
  const gap = 3;
  const tileSize = (mosaicSize - gap) / 2;

  const tileAnims = useRef(photos.map(() => new Animated.Value(0))).current;
  const containerScale = useRef(new Animated.Value(0.88)).current;
  const containerOpacity = useRef(new Animated.Value(0)).current;
  const borderOpacity = useRef(new Animated.Value(0)).current;
  const vibeAnim = useRef(new Animated.Value(0)).current;
  const shareSlide = useRef(new Animated.Value(80)).current;
  const shareOpacity = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;
  const mosaicRef = useRef<View>(null);

  const [vibeScore, setVibeScore] = useState(0);
  const targetVibe = useRef(Math.floor(82 + Math.random() * 18)).current; // 82-100
  const [reactions, setReactions] = useState([
    { id: "r1", emoji: "😂", count: 3 },
    { id: "r2", emoji: "❤️", count: 12 },
    { id: "r3", emoji: "🔥", count: 7 },
    { id: "r4", emoji: "😍", count: 5 },
    { id: "r5", emoji: "🤯", count: 2 },
  ]);
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);

  // Run the full reveal sequence
  useEffect(() => {
    // Phase 1: container fades in
    Animated.parallel([
      Animated.timing(containerOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(containerScale, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 8 }),
    ]).start();

    // Phase 2: tiles stagger in one by one — 900ms apart
    const tileSequence = Animated.stagger(
      900,
      tileAnims.map((a) =>
        Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 10 })
      )
    );

    tileSequence.start(() => {
      // After all tiles in — haptic success
      notify(Haptics.NotificationFeedbackType.Success);

      // Phase 3: border glows
      Animated.timing(borderOpacity, { toValue: 1, duration: 700, useNativeDriver: true }).start();

      // Phase 4: vibe score counts up
      Animated.timing(vibeAnim, { toValue: targetVibe, duration: 1800, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
      vibeAnim.addListener(({ value }) => setVibeScore(Math.floor(value)));

      // Phase 5: share button slides up
      Animated.parallel([
        Animated.spring(shareSlide, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 10, delay: 400 }),
        Animated.timing(shareOpacity, { toValue: 1, duration: 400, useNativeDriver: true, delay: 400 }),
      ]).start();
    });

    // Continuous glow loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(glowPulse, { toValue: 0, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();

    return () => { vibeAnim.removeAllListeners(); };
  }, []);

  const glowOpacity = glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });
  const glowScale = glowPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  const handleShare = useCallback(async () => {
    buzz();
    if (!mosaicRef.current) return;
    try {
      const uri = await captureRef(mosaicRef, { format: "png", quality: 1, result: "tmpfile" });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share your Sawa mosaic" });
      }
    } catch (e) {
      console.log("[mosaic-reveal] share error", e);
    }
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
    } catch (e) {
      console.log("[mosaic-reveal] save error", e);
    }
  }, []);

  const vibeEmoji = targetVibe >= 95 ? "🔥🔥🔥" : targetVibe >= 85 ? "🔥🔥" : "🔥";

  return (
    <View style={rev.root}>
      <SafeAreaView edges={["top"]} style={rev.safe}>
        {/* Header */}
        <View style={rev.header}>
          <Pressable onPress={() => router.back()} style={rev.backBtn}>
            <ChevronLeft size={24} color={Colors.textMuted} strokeWidth={2} />
          </Pressable>
          <Text style={rev.headerTitle}>Your Moment ✨</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Glow behind mosaic */}
        <Animated.View
          pointerEvents="none"
          style={[rev.glow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
        >
          <LinearGradient
            colors={[Colors.primary + "60", Colors.secondary + "60", Colors.accent + "60"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ flex: 1, borderRadius: 999 }}
          />
        </Animated.View>

        {/* Mosaic container */}
        <Animated.View
          style={[rev.mosaicWrap, {
            opacity: containerOpacity,
            transform: [{ scale: containerScale }],
            width: mosaicSize, height: mosaicSize,
          }]}
        >
          {/* Gradient border */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: borderOpacity, borderRadius: 20 }]}>
            <LinearGradient
              colors={[Colors.primary, Colors.secondary, Colors.accent]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 20, padding: 2 }]}
            />
          </Animated.View>

          {/* Grid */}
          <View
            ref={mosaicRef}
            style={[rev.grid, { width: mosaicSize - 4, height: mosaicSize - 4, gap }]}
          >
            {photos.map((uri, i) => {
              const anim = tileAnims[i] ?? new Animated.Value(0);
              const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
              const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] });
              const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

              return (
                <Animated.View
                  key={i}
                  style={[
                    rev.tile,
                    { width: tileSize, height: tileSize, opacity, transform: [{ translateY }, { scale }] },
                  ]}
                >
                  <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  {/* Name strip */}
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.7)"]}
                    style={rev.nameStrip}
                  >
                    <Text style={rev.tileName}>{NAMES[i] ?? "Friend"}</Text>
                  </LinearGradient>
                </Animated.View>
              );
            })}

            {/* Bottom meta bar */}
            <View style={rev.metaBar}>
              <Text style={rev.metaLocation}>📍 Zahle · Now</Text>
              <Text style={rev.metaSawa}>Sawa ◈</Text>
            </View>
          </View>
        </Animated.View>

        {/* Vibe score */}
        <Animated.View style={[rev.vibeWrap, { opacity: shareOpacity }]}>
          <Text style={rev.vibeText}>
            Tonight's vibe: <Text style={rev.vibeScore}>{vibeScore}/100</Text> {vibeEmoji}
          </Text>
        </Animated.View>

        {/* Reactions */}
        <Animated.View style={[rev.reactionsRow, { opacity: shareOpacity }]}>
          {reactions.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => {
                buzz(Haptics.ImpactFeedbackStyle.Light);
                setSelectedReaction((cur) => cur === r.id ? null : r.id);
                setReactions((prev) => prev.map((x) =>
                  x.id === r.id
                    ? { ...x, count: selectedReaction === r.id ? x.count - 1 : x.count + 1 }
                    : x
                ));
              }}
              style={[rev.reactionBtn, selectedReaction === r.id && rev.reactionBtnActive]}
            >
              <Text style={rev.reactionEmoji}>{r.emoji}</Text>
              <Text style={rev.reactionCount}>{r.count}</Text>
            </Pressable>
          ))}
        </Animated.View>

        {/* Share + Save buttons */}
        <Animated.View style={[rev.actions, { opacity: shareOpacity, transform: [{ translateY: shareSlide }] }]}>
          <Pressable onPress={handleShare} style={rev.shareBtn}>
            <LinearGradient
              colors={[Colors.primary, Colors.secondary]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={rev.shareBtnGrad}
            >
              <Text style={rev.shareBtnText}>Share to Instagram 🔗</Text>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={handleSave} style={rev.saveBtn}>
            <Text style={rev.saveBtnText}>Save to Photos</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={{ marginTop: 6 }}>
            <Text style={[rev.saveBtnText, { color: Colors.textMuted }]}>Done</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const rev = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  safe: { flex: 1, alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingHorizontal: 16, paddingTop: 8, marginBottom: 12 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: Colors.text, fontSize: 18, fontWeight: "800" },
  glow: { position: "absolute", width: 300, height: 300, top: 80, borderRadius: 150 },
  mosaicWrap: { borderRadius: 20, overflow: "hidden", marginBottom: 16, alignItems: "center", justifyContent: "center" },
  grid: { flexWrap: "wrap", flexDirection: "row", backgroundColor: Colors.bg, borderRadius: 18, overflow: "hidden" },
  tile: { overflow: "hidden", borderRadius: 4 },
  nameStrip: { position: "absolute", bottom: 0, left: 0, right: 0, paddingTop: 20, paddingBottom: 6, paddingHorizontal: 6 },
  tileName: { color: "#fff", fontSize: 11, fontWeight: "700" },
  metaBar: { position: "absolute", bottom: 6, left: 10, right: 10, flexDirection: "row", justifyContent: "space-between" },
  metaLocation: { color: "rgba(155,155,180,0.8)", fontSize: 10 },
  metaSawa: { color: "rgba(155,155,180,0.8)", fontSize: 10 },
  vibeWrap: { marginBottom: 12 },
  vibeText: { color: Colors.textMuted, fontSize: 14, fontWeight: "600" },
  vibeScore: { color: Colors.primary, fontWeight: "800" },
  reactionsRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  reactionBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.card, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#2D2A45" },
  reactionBtnActive: { borderColor: Colors.primary },
  reactionEmoji: { fontSize: 16 },
  reactionCount: { color: Colors.textMuted, fontSize: 12, fontWeight: "700" },
  actions: { width: "90%", gap: 10, paddingBottom: 20 },
  shareBtn: { height: 54, borderRadius: 27, overflow: "hidden" },
  shareBtnGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
  shareBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  saveBtn: { height: 54, borderRadius: 27, borderWidth: 1.5, borderColor: Colors.secondary, alignItems: "center", justifyContent: "center" },
  saveBtnText: { color: Colors.text, fontSize: 15, fontWeight: "700" },
});

// ─── ROOT SCREEN ──────────────────────────────────────────
export default function PlanRealTestScreen() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [photos, setPhotos] = useState<string[]>([]);

  const handleCapture = useCallback((uri: string) => {
    setPhotos((prev) => {
      const next = [...prev, uri];
      if (next.length >= SHOT_COUNT) {
        // Small delay so last photo is visible before transition
        setTimeout(() => setPhase("reveal"), 400);
      }
      return next;
    });
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <Stack.Screen options={{ headerShown: false, animation: "fade" }} />

      {phase === "intro" && (
        <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
          {/* Back button */}
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
              <X size={24} color={Colors.textMuted} strokeWidth={2} />
            </Pressable>
          </View>
          <IntroScreen onStart={() => setPhase("capture")} />
        </SafeAreaView>
      )}

      {phase === "capture" && (
        <CaptureScreen photos={photos} onCapture={handleCapture} />
      )}

      {phase === "reveal" && photos.length === SHOT_COUNT && (
        <MosaicReveal photos={photos} />
      )}
    </View>
  );
}
