/**
 * PlanReal Test — Pack Opening
 * Parent controls ALL reveals via index state.
 * Each card only opens when parent says so.
 */
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { X, SwitchCamera, Check, ChevronLeft } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated, Easing, Image, Platform,
  Pressable, ScrollView, StyleSheet,
  Text, View, useWindowDimensions,
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
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
    ])).start();
  }, [pulse]);
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "space-between", padding: 32 }}>
      <View style={{ alignItems: "center", paddingTop: 40 }}>
        <Animated.Text style={{ fontSize: 80, transform: [{ scale: pulse }] }}>📦</Animated.Text>
        <Text style={{ color: Colors.text, fontSize: 28, fontWeight: "800", marginTop: 20, textAlign: "center" }}>PlanReal Test</Text>
        <Text style={{ color: Colors.textMuted, fontSize: 15, textAlign: "center", lineHeight: 22, marginTop: 8 }}>
          {"Take 4 photos.\nEach one is a sealed card.\nWatch them burst open one by one."}
        </Text>
      </View>
      <View style={{ width: "100%", gap: 12 }}>
        {["Take 4 photos one by one", "Each photo = a sealed mystery card", "Cards burst open one by one", "Mosaic locks in — share it"].map((label, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <LinearGradient colors={[Colors.primary, Colors.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>{i + 1}</Text>
            </LinearGradient>
            <Text style={{ color: Colors.text, fontSize: 15, fontWeight: "600" }}>{label}</Text>
          </View>
        ))}
      </View>
      <Pressable onPress={() => { buzz(); onStart(); }} style={{ width: "100%", height: 58, borderRadius: 29, overflow: "hidden" }}>
        <LinearGradient colors={[Colors.primary, Colors.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}>Open a Pack ⚡</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ─── CAPTURE ──────────────────────────────────────────────
function CaptureScreen({ photos, onCapture }: { photos: string[]; onCapture: (uri: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const cameraRef = useRef<CameraView | null>(null);
  const [capturing, setCapturing] = useState(false);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const shotIndex = photos.length;
  const name = NAMES[shotIndex] ?? "Friend";
  const isLast = shotIndex === SHOT_COUNT - 1;

  const doCapture = useCallback(async () => {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);
    buzz(Haptics.ImpactFeedbackStyle.Heavy);
    flashAnim.setValue(1);
    Animated.timing(flashAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.87, duration: 65, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 28, bounciness: 14 }),
    ]).start();
    try {
      const p = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (p?.uri) { notify(Haptics.NotificationFeedbackType.Success); onCapture(p.uri); }
    } catch {}
    setCapturing(false);
  }, [capturing, flashAnim, btnScale, onCapture]);

  if (!permission) return <View style={{ flex: 1, backgroundColor: "#000" }} />;
  if (!permission.granted) return (
    <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: "center", justifyContent: "center", gap: 20 }}>
      <Text style={{ color: Colors.text, fontSize: 16 }}>Camera access needed</Text>
      <Pressable onPress={requestPermission} style={{ height: 52, borderRadius: 26, overflow: "hidden" }}>
        <LinearGradient colors={[Colors.primary, Colors.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, paddingHorizontal: 28, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Allow Camera</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView style={StyleSheet.absoluteFill} ref={cameraRef} facing={facing} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#fff", opacity: flashAnim }]} />
      <LinearGradient colors={["rgba(13,11,30,0.92)", "transparent"]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 180 }} />

      <SafeAreaView edges={["top"]} style={{ position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", paddingTop: 8 }}>
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 10 }}>
          {Array.from({ length: SHOT_COUNT }).map((_, i) => (
            <View key={i} style={{
              width: 32, height: 32, borderRadius: 16,
              backgroundColor: i < photos.length ? "#3DDC97" : "rgba(255,255,255,0.1)",
              borderWidth: i === shotIndex ? 2.5 : 1.5,
              borderColor: i < photos.length ? "#3DDC97" : i === shotIndex ? Colors.primary : "rgba(255,255,255,0.25)",
              alignItems: "center", justifyContent: "center",
            }}>
              {i < photos.length
                ? <Check size={14} color="#fff" strokeWidth={3} />
                : <Text style={{ color: i === shotIndex ? Colors.primary : "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "800" }}>{i + 1}</Text>
              }
            </View>
          ))}
        </View>
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>
          Card {shotIndex + 1} — <Text style={{ color: Colors.primary }}>{name}</Text>
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 }}>
          {isLast ? "Last card — make it legendary" : `${SHOT_COUNT - shotIndex - 1} cards left`}
        </Text>
      </SafeAreaView>

      {photos.length > 0 && (
        <View style={{ position: "absolute", top: 140, left: 20, flexDirection: "row", gap: 8 }}>
          {photos.map((uri, i) => (
            <View key={i} style={{ width: 52, height: 52, borderRadius: 10, overflow: "hidden", borderWidth: 2, borderColor: "#3DDC97" }}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            </View>
          ))}
        </View>
      )}

      <LinearGradient colors={["transparent", "rgba(13,11,30,0.97)"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingTop: 80 }}>
        <SafeAreaView edges={["bottom"]} style={{ alignItems: "center", paddingBottom: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingHorizontal: 56, marginBottom: 14 }}>
            <Pressable onPress={() => { buzz(Haptics.ImpactFeedbackStyle.Light); setFacing((f) => f === "back" ? "front" : "back"); }} style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}>
              <SwitchCamera size={28} color="#fff" strokeWidth={2} />
            </Pressable>
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <Pressable onPress={doCapture} disabled={capturing} style={{ width: 88, height: 88, borderRadius: 44, borderWidth: 4, borderColor: "rgba(255,255,255,0.65)", overflow: "hidden" }}>
                <LinearGradient colors={[Colors.primary, Colors.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 36 }}>{isLast ? "⚡" : "📸"}</Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
            <View style={{ width: 52 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

// ─── SINGLE CARD ──────────────────────────────────────────
// revealed prop controlled by parent — NOT internal timers
function PackCard({
  uri, name, size, revealed,
}: {
  uri: string; name: string; size: number; revealed: boolean;
}) {
  // Animation values
  const sealedOpacity = useRef(new Animated.Value(1)).current;
  const photoOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const nameSlide = useRef(new Animated.Value(16)).current;
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!revealed || hasAnimated.current) return;
    hasAnimated.current = true;

    // 1. Shake — anticipation
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 7, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -7, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 5, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -5, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start(() => {
      // 2. BURST — heavy haptic + scale spike
      buzz(Haptics.ImpactFeedbackStyle.Heavy);

      Animated.sequence([
        Animated.timing(cardScale, { toValue: 1.22, duration: 100, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
        Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 8 }),
      ]).start();

      // 3. Sealed face OUT
      Animated.timing(sealedOpacity, { toValue: 0, duration: 180, useNativeDriver: true }).start();

      // 4. Photo IN
      Animated.timing(photoOpacity, { toValue: 1, duration: 280, useNativeDriver: true }).start(() => {
        // 5. Glow pulse
        Animated.loop(Animated.sequence([
          Animated.timing(glowOpacity, { toValue: 0.75, duration: 1000, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.2, duration: 1000, useNativeDriver: true }),
        ])).start();
        // 6. Name slides up
        Animated.parallel([
          Animated.timing(nameOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.spring(nameSlide, { toValue: 0, useNativeDriver: true, speed: 22, bounciness: 10 }),
        ]).start();
      });
    });
  }, [revealed]);

  return (
    <Animated.View style={{
      width: size, height: size,
      transform: [{ scale: cardScale }, { translateX: shakeX }],
    }}>
      {/* Glow */}
      <Animated.View pointerEvents="none" style={{
        position: "absolute", top: -10, left: -10, right: -10, bottom: -10,
        borderRadius: 16, opacity: glowOpacity,
      }}>
        <LinearGradient colors={[Colors.primary + "CC", Colors.secondary + "CC"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: 16 }} />
      </Animated.View>

      {/* Photo */}
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 12, overflow: "hidden", opacity: photoOpacity }]}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.82)"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingTop: 28, paddingBottom: 8, paddingHorizontal: 8 }}>
          <Animated.Text style={{ color: "#fff", fontSize: 13, fontWeight: "800", opacity: nameOpacity, transform: [{ translateY: nameSlide }] }}>
            {name}
          </Animated.Text>
        </LinearGradient>
      </Animated.View>

      {/* Sealed card */}
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 12, overflow: "hidden", opacity: sealedOpacity }]}>
        <LinearGradient colors={["#1E1A38", "#0D0B1E", "#1E1A38"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* Diagonal lines */}
        <View style={{ ...StyleSheet.absoluteFillObject, opacity: 0.12, overflow: "hidden" }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={i} style={{
              position: "absolute",
              top: `${i * 14 - 5}%`, left: -30, right: -30,
              height: 1.5, backgroundColor: Colors.primary,
              transform: [{ rotate: "-20deg" }],
            }} />
          ))}
        </View>
        {/* Center icon */}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <LinearGradient colors={[Colors.primary, Colors.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size * 0.42, height: size * 0.42, borderRadius: size * 0.1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: size * 0.18 }}>📸</Text>
          </LinearGradient>
          <Text style={{ color: "rgba(155,155,180,0.6)", fontSize: 10, fontWeight: "700", marginTop: 6, letterSpacing: 2.5 }}>SAWA</Text>
        </View>
        {/* Top + bottom label */}
        <View style={{ position: "absolute", top: 8, left: 8, right: 8, flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: "rgba(255,107,53,0.5)", fontSize: 9, fontWeight: "800" }}>PLANREAL</Text>
          <Text style={{ color: "rgba(255,107,53,0.5)", fontSize: 9, fontWeight: "800" }}>2025</Text>
        </View>
        <View style={{ position: "absolute", bottom: 8, left: 8, right: 8, flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: "rgba(255,60,172,0.5)", fontSize: 9, fontWeight: "800" }}>◈</Text>
          <Text style={{ color: "rgba(255,60,172,0.5)", fontSize: 9, fontWeight: "800" }}>◈</Text>
        </View>
        {/* Shimmer */}
        <LinearGradient colors={["transparent", "rgba(255,255,255,0.05)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </Animated.View>
  );
}

// ─── MOSAIC REVEAL ────────────────────────────────────────
function MosaicReveal({ photos }: { photos: string[] }) {
  const { width } = useWindowDimensions();
  const MOSAIC = Math.min(width * 0.88, 370);
  const GAP = 8;
  const TILE = (MOSAIC - GAP) / 2;

  // Parent controls which cards are revealed
  // Start at -1 (none revealed), tick up one by one
  const [revealedIndex, setRevealedIndex] = useState(-1);
  const allRevealed = revealedIndex >= SHOT_COUNT - 1;

  // Post-reveal elements
  const borderOpacity = useRef(new Animated.Value(0)).current;
  const vibeValue = useRef(new Animated.Value(0)).current;
  const shareSlide = useRef(new Animated.Value(80)).current;
  const shareOpacity = useRef(new Animated.Value(0)).current;
  const containerScale = useRef(new Animated.Value(0.92)).current;
  const containerOpacity = useRef(new Animated.Value(0)).current;

  const mosaicRef = useRef<View>(null);
  const [vibeScore, setVibeScore] = useState(0);
  const targetVibe = useRef(Math.floor(88 + Math.random() * 12)).current;
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const [reactions, setReactions] = useState([
    { id: "r1", emoji: "😂", count: 3 },
    { id: "r2", emoji: "❤️", count: 12 },
    { id: "r3", emoji: "🔥", count: 7 },
    { id: "r4", emoji: "😍", count: 5 },
    { id: "r5", emoji: "🤯", count: 2 },
  ]);

  // Step 1: Container pops in
  useEffect(() => {
    Animated.parallel([
      Animated.timing(containerOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(containerScale, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 8 }),
    ]).start();

    // Step 2: Start revealing cards one at a time
    // Each card: 500ms shake animation + 400ms burst = ~900ms total
    // Wait 1400ms between each card start to let shake complete fully
    const BETWEEN = 1600; // ms between each card starting

    // Card 0 starts after 800ms (let mosaic settle first)
    const t0 = setTimeout(() => setRevealedIndex(0), 800);
    const t1 = setTimeout(() => setRevealedIndex(1), 800 + BETWEEN);
    const t2 = setTimeout(() => setRevealedIndex(2), 800 + BETWEEN * 2);
    const t3 = setTimeout(() => setRevealedIndex(3), 800 + BETWEEN * 3);

    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // Step 3: After all revealed
  useEffect(() => {
    if (!allRevealed) return;
    notify(Haptics.NotificationFeedbackType.Success);

    setTimeout(() => {
      Animated.timing(borderOpacity, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    }, 400);

    setTimeout(() => {
      vibeValue.addListener(({ value }) => setVibeScore(Math.floor(value)));
      Animated.timing(vibeValue, { toValue: targetVibe, duration: 2000, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    }, 800);

    setTimeout(() => {
      Animated.parallel([
        Animated.spring(shareSlide, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 12 }),
        Animated.timing(shareOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }, 1400);

    return () => { vibeValue.removeAllListeners(); };
  }, [allRevealed]);

  const handleShare = useCallback(async () => {
    buzz();
    if (!mosaicRef.current) return;
    try {
      const uri = await captureRef(mosaicRef, { format: "png", quality: 1, result: "tmpfile" });
      const ok = await Sharing.isAvailableAsync();
      if (ok) await Sharing.shareAsync(uri, { mimeType: "image/png" });
    } catch {}
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
    } catch {}
  }, []);

  const vibeEmoji = targetVibe >= 95 ? "🔥🔥🔥" : targetVibe >= 90 ? "🔥🔥" : "🔥";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      contentContainerStyle={{ alignItems: "center", paddingTop: 16, paddingBottom: 60, gap: 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Title */}
      <View style={{ alignItems: "center" }}>
        <Text style={{ color: Colors.text, fontSize: 24, fontWeight: "800" }}>
          {allRevealed ? "Your Mosaic 🔥" : "Opening Pack..."}
        </Text>
        <Text style={{ color: Colors.textMuted, fontSize: 13, marginTop: 3 }}>
          {allRevealed
            ? "Same moment — 4 angles"
            : `${Math.max(0, revealedIndex + 1)} of ${SHOT_COUNT} revealed`
          }
        </Text>
      </View>

      {/* Mosaic */}
      <Animated.View style={{ opacity: containerOpacity, transform: [{ scale: containerScale }] }}>

        {/* Gradient border — animated on after reveal */}
        <Animated.View style={{ opacity: borderOpacity }}>
          <LinearGradient
            colors={[Colors.primary, Colors.secondary, Colors.accent]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ borderRadius: 22, padding: 2.5 }}
          >
            <View
              ref={mosaicRef}
              style={{
                width: MOSAIC, height: MOSAIC,
                backgroundColor: Colors.bg,
                borderRadius: 20, overflow: "hidden",
              }}
            >
              {/* GRID: 2 columns side by side */}
              <View style={{ flex: 1, flexDirection: "row", padding: 6, gap: GAP }}>
                {/* LEFT COLUMN */}
                <View style={{ flex: 1, gap: GAP }}>
                  <PackCard uri={photos[0]} name={NAMES[0]} size={TILE} revealed={revealedIndex >= 0} />
                  <PackCard uri={photos[2]} name={NAMES[2]} size={TILE} revealed={revealedIndex >= 2} />
                </View>
                {/* RIGHT COLUMN */}
                <View style={{ flex: 1, gap: GAP }}>
                  <PackCard uri={photos[1]} name={NAMES[1]} size={TILE} revealed={revealedIndex >= 1} />
                  <PackCard uri={photos[3]} name={NAMES[3]} size={TILE} revealed={revealedIndex >= 3} />
                </View>
              </View>

              {/* Meta bar */}
              <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "rgba(13,11,30,0.6)" }}>
                <Text style={{ color: "rgba(155,155,180,0.8)", fontSize: 10, fontWeight: "600" }}>📍 Zahle · Now</Text>
                <Text style={{ color: "rgba(155,155,180,0.8)", fontSize: 10, fontWeight: "600" }}>Sawa ◈</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Plain border while building */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, {
            borderRadius: 22,
            borderWidth: 1.5,
            borderColor: "#2D2A45",
            opacity: borderOpacity.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          }]}
        />
      </Animated.View>

      {/* Vibe score */}
      <Animated.View style={{ opacity: shareOpacity, alignItems: "center" }}>
        <Text style={{ color: Colors.textMuted, fontSize: 15, fontWeight: "600" }}>
          {"Tonight's vibe: "}
          <Text style={{ color: Colors.primary, fontWeight: "800" }}>{vibeScore}/100</Text>
          {" " + vibeEmoji}
        </Text>
      </Animated.View>

      {/* Reactions */}
      <Animated.View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center", opacity: shareOpacity }}>
        {reactions.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => {
              buzz(Haptics.ImpactFeedbackStyle.Light);
              const was = selectedReaction === r.id;
              setSelectedReaction(was ? null : r.id);
              setReactions((prev) => prev.map((x) => x.id === r.id ? { ...x, count: was ? x.count - 1 : x.count + 1 } : x));
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.card, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: selectedReaction === r.id ? Colors.primary : "#2D2A45" }}
          >
            <Text style={{ fontSize: 17 }}>{r.emoji}</Text>
            <Text style={{ color: Colors.textMuted, fontSize: 13, fontWeight: "700" }}>{r.count}</Text>
          </Pressable>
        ))}
      </Animated.View>

      {/* Buttons */}
      <Animated.View style={{ width: "85%", gap: 12, opacity: shareOpacity, transform: [{ translateY: shareSlide }] }}>
        <Pressable onPress={handleShare} style={{ height: 56, borderRadius: 28, overflow: "hidden" }}>
          <LinearGradient colors={[Colors.primary, Colors.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>Share to Instagram 🔗</Text>
          </LinearGradient>
        </Pressable>
        <Pressable onPress={handleSave} style={{ height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: Colors.secondary, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: Colors.text, fontSize: 15, fontWeight: "700" }}>Save to Photos</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ alignItems: "center", paddingVertical: 8 }}>
          <Text style={{ color: Colors.textMuted, fontSize: 14, fontWeight: "600" }}>Try Again</Text>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

// ─── ROOT ─────────────────────────────────────────────────
export default function PlanRealTestScreen() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [photos, setPhotos] = useState<string[]>([]);

  const handleCapture = useCallback((uri: string) => {
    setPhotos((prev) => {
      const next = [...prev, uri];
      if (next.length >= SHOT_COUNT) setTimeout(() => setPhase("reveal"), 500);
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
        <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 8, marginBottom: 4 }}>
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
