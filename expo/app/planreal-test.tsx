/**
 * PlanReal Test — Pack Opening Mosaic Reveal
 * Each photo revealed like opening a card pack.
 * Dark card flips to reveal the photo underneath.
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
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  ScrollView,
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
      Animated.timing(pulse, { toValue: 1.1, duration: 750, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
    ])).start();
  }, [pulse]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "space-between", padding: 32 }}>
      <View style={{ alignItems: "center", paddingTop: 40 }}>
        <Animated.Text style={{ fontSize: 80, transform: [{ scale: pulse }] }}>📦</Animated.Text>
        <Text style={{ color: Colors.text, fontSize: 28, fontWeight: "800", marginTop: 20, textAlign: "center" }}>PlanReal Test</Text>
        <Text style={{ color: Colors.textMuted, fontSize: 15, textAlign: "center", lineHeight: 22, marginTop: 8 }}>
          {"Take 4 photos.\nWatch them reveal like opening a card pack."}
        </Text>
      </View>
      <View style={{ width: "100%", gap: 12 }}>
        {["Take 4 photos one by one", "Each photo = a sealed card", "Cards flip open one by one", "Mosaic locks in — share it"].map((label, i) => (
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
    Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.88, duration: 70, useNativeDriver: true }),
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
        {/* Progress */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 10 }}>
          {Array.from({ length: SHOT_COUNT }).map((_, i) => (
            <View key={i} style={{
              width: 32, height: 32, borderRadius: 16,
              backgroundColor: i < photos.length ? "#3DDC97" : i === shotIndex ? "transparent" : "rgba(255,255,255,0.1)",
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

      {/* Thumbnail strip */}
      {photos.length > 0 && (
        <View style={{ position: "absolute", top: 140, left: 20, right: 20, flexDirection: "row", gap: 8 }}>
          {photos.map((uri, i) => (
            <View key={i} style={{ width: 56, height: 56, borderRadius: 10, overflow: "hidden", borderWidth: 2, borderColor: "#3DDC97" }}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            </View>
          ))}
        </View>
      )}

      <LinearGradient colors={["transparent", "rgba(13,11,30,0.97)"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingTop: 80 }}>
        <SafeAreaView edges={["bottom"]} style={{ alignItems: "center", paddingBottom: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingHorizontal: 56, marginBottom: 16 }}>
            <Pressable onPress={() => { buzz(Haptics.ImpactFeedbackStyle.Light); setFacing((f) => f === "back" ? "front" : "back"); }} style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}>
              <SwitchCamera size={28} color="#fff" strokeWidth={2} />
            </Pressable>
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <Pressable onPress={doCapture} disabled={capturing} style={{ width: 90, height: 90, borderRadius: 45, borderWidth: 4, borderColor: "rgba(255,255,255,0.65)", overflow: "hidden" }}>
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

// ─── PACK OPENING CARD ────────────────────────────────────
// Each card starts as a sealed dark card then "opens" to reveal the photo
function PackCard({
  uri, name, size, delay, onRevealed,
}: {
  uri: string; name: string; size: number; delay: number; onRevealed?: () => void;
}) {
  // Phase 0: sealed dark card
  // Phase 1: card shakes/vibrates (anticipation)
  // Phase 2: card "tears open" — scales up then reveals photo
  // Phase 3: photo locked in

  const sealed = useRef(new Animated.Value(1)).current;   // 1 = card face, 0 = photo
  const shake = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0)).current;
  const photoOpacity = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const nameSlide = useRef(new Animated.Value(20)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const run = () => {
      // Step 1: card slides/pops in from below
      Animated.spring(cardScale, {
        toValue: 1, useNativeDriver: true,
        speed: 16, bounciness: 12,
      }).start();

      // Step 2: after a moment — shake to build anticipation
      setTimeout(() => {
        buzz(Haptics.ImpactFeedbackStyle.Light);
        Animated.sequence([
          Animated.timing(shake, { toValue: 6, duration: 60, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -6, duration: 60, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 5, duration: 60, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -5, duration: 60, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 4, duration: 60, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -4, duration: 60, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
        ]).start();
      }, 300);

      // Step 3: BURST OPEN — big haptic + card scales up + photo floods in
      setTimeout(() => {
        buzz(Haptics.ImpactFeedbackStyle.Heavy);

        // Card "rips" — scale spike then settle
        Animated.sequence([
          Animated.timing(cardScale, { toValue: 1.18, duration: 120, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 8 }),
        ]).start();

        // Sealed card face fades out
        Animated.timing(sealed, { toValue: 0, duration: 200, useNativeDriver: true }).start();

        // Photo floods in
        Animated.timing(photoOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start(() => {
          // Glow pulse after reveal
          Animated.loop(Animated.sequence([
            Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
            Animated.timing(glowAnim, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
          ])).start();

          // Name slides up
          Animated.parallel([
            Animated.spring(nameSlide, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 10 }),
            Animated.timing(nameOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          ]).start();

          onRevealed?.();
        });
      }, 800);
    };

    const timer = setTimeout(run, delay);
    return () => clearTimeout(timer);
  }, []);

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.7] });
  const sealedOpacity = sealed.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Animated.View style={{
      width: size, height: size,
      transform: [{ scale: cardScale }, { translateX: shake }],
    }}>
      {/* Glow behind card */}
      <Animated.View pointerEvents="none" style={{
        position: "absolute",
        top: -12, left: -12, right: -12, bottom: -12,
        borderRadius: 20,
        opacity: glowOpacity,
      }}>
        <LinearGradient
          colors={[Colors.primary + "CC", Colors.secondary + "CC"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ flex: 1, borderRadius: 20 }}
        />
      </Animated.View>

      {/* Photo underneath */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: photoOpacity, borderRadius: 12, overflow: "hidden" }]}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        {/* Name strip */}
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.8)"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingTop: 32, paddingBottom: 8, paddingHorizontal: 10 }}>
          <Animated.Text style={{ color: "#fff", fontSize: 14, fontWeight: "800", opacity: nameOpacity, transform: [{ translateY: nameSlide }] }}>
            {name}
          </Animated.Text>
        </LinearGradient>
      </Animated.View>

      {/* Sealed card face — on top until opened */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: sealedOpacity, borderRadius: 12, overflow: "hidden" }]}>
        <LinearGradient
          colors={["#1A1730", "#0D0B1E", "#1A1730"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Card pattern */}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.15 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={{
              position: "absolute",
              top: `${i * 18}%`,
              left: -20, right: -20,
              height: 1,
              backgroundColor: Colors.primary,
              transform: [{ rotate: "-15deg" }],
            }} />
          ))}
        </View>
        {/* Sawa logo on card */}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <LinearGradient colors={[Colors.primary, Colors.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size * 0.45, height: size * 0.45, borderRadius: size * 0.12, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: size * 0.2, fontWeight: "800", color: "#fff" }}>📸</Text>
          </LinearGradient>
          <Text style={{ color: Colors.textMuted, fontSize: 11, fontWeight: "700", marginTop: 8, letterSpacing: 2 }}>SAWA</Text>
        </View>
        {/* Shimmer overlay */}
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.06)", "transparent"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </Animated.View>
  );
}

// ─── MOSAIC REVEAL ────────────────────────────────────────
function MosaicReveal({ photos }: { photos: string[] }) {
  const { width } = useWindowDimensions();
  const mosaicSize = Math.min(width * 0.88, 370);
  const GAP = 6;
  const TILE = (mosaicSize - GAP) / 2;

  const [revealedCount, setRevealedCount] = useState(0);
  const allRevealed = revealedCount >= SHOT_COUNT;

  // Overall container
  const containerScale = useRef(new Animated.Value(0.9)).current;
  const containerOpacity = useRef(new Animated.Value(0)).current;

  // Post-reveal elements
  const borderOpacity = useRef(new Animated.Value(0)).current;
  const vibeValue = useRef(new Animated.Value(0)).current;
  const shareSlide = useRef(new Animated.Value(80)).current;
  const shareOpacity = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;

  const mosaicRef = useRef<View>(null);
  const [vibeScore, setVibeScore] = useState(0);
  const targetVibe = useRef(Math.floor(87 + Math.random() * 13)).current;
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const [reactions, setReactions] = useState([
    { id: "r1", emoji: "😂", count: 3 },
    { id: "r2", emoji: "❤️", count: 12 },
    { id: "r3", emoji: "🔥", count: 7 },
    { id: "r4", emoji: "😍", count: 5 },
    { id: "r5", emoji: "🤯", count: 2 },
  ]);

  // Container pops in immediately
  useEffect(() => {
    Animated.parallel([
      Animated.timing(containerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(containerScale, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 8 }),
    ]).start();

    Animated.timing(titleAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  // After all cards revealed
  useEffect(() => {
    if (!allRevealed) return;

    notify(Haptics.NotificationFeedbackType.Success);

    // Gradient border appears
    Animated.timing(borderOpacity, { toValue: 1, duration: 800, useNativeDriver: true }).start();

    // Vibe score counts
    vibeValue.addListener(({ value }) => setVibeScore(Math.floor(value)));
    Animated.timing(vibeValue, { toValue: targetVibe, duration: 2200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();

    // Share slides up
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(shareSlide, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 12 }),
        Animated.timing(shareOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }, 600);

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

  // Pack opening delays — stagger each card
  // Card 0: starts at 400ms
  // Card 1: starts at 1800ms
  // Card 2: starts at 3200ms
  // Card 3: starts at 4600ms
  const CARD_DELAYS = [400, 1800, 3200, 4600];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      contentContainerStyle={{ alignItems: "center", paddingTop: 20, paddingBottom: 60, gap: 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Title */}
      <Animated.View style={{ alignItems: "center", opacity: titleAnim }}>
        <Text style={{ color: Colors.text, fontSize: 26, fontWeight: "800" }}>
          {allRevealed ? "Your Mosaic 🔥" : "Opening Pack..."}
        </Text>
        <Text style={{ color: Colors.textMuted, fontSize: 13, marginTop: 4 }}>
          {allRevealed ? "Same moment — 4 angles" : `${revealedCount} of ${SHOT_COUNT} revealed`}
        </Text>
      </Animated.View>

      {/* Mosaic with pack-opening cards */}
      <Animated.View style={{ opacity: containerOpacity, transform: [{ scale: containerScale }] }}>

        {/* Gradient border — appears after all revealed */}
        <Animated.View style={{ opacity: borderOpacity, borderRadius: 22, padding: 2.5 }}>
          <LinearGradient
            colors={[Colors.primary, Colors.secondary, Colors.accent]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ borderRadius: 20, padding: 2.5 }}
          >
            <View
              ref={mosaicRef}
              style={{
                width: mosaicSize, height: mosaicSize,
                backgroundColor: Colors.bg,
                borderRadius: 18, overflow: "hidden",
                padding: GAP / 2,
              }}
            >
              {/* 2x2 grid */}
              <View style={{ flex: 1, flexDirection: "row", gap: GAP }}>
                <View style={{ flex: 1, gap: GAP }}>
                  <PackCard uri={photos[0]} name={NAMES[0]} size={TILE} delay={CARD_DELAYS[0]} onRevealed={() => setRevealedCount((c) => c + 1)} />
                  <PackCard uri={photos[2]} name={NAMES[2]} size={TILE} delay={CARD_DELAYS[2]} onRevealed={() => setRevealedCount((c) => c + 1)} />
                </View>
                <View style={{ flex: 1, gap: GAP }}>
                  <PackCard uri={photos[1]} name={NAMES[1]} size={TILE} delay={CARD_DELAYS[1]} onRevealed={() => setRevealedCount((c) => c + 1)} />
                  <PackCard uri={photos[3]} name={NAMES[3]} size={TILE} delay={CARD_DELAYS[3]} onRevealed={() => setRevealedCount((c) => c + 1)} />
                </View>
              </View>

              {/* Meta bar */}
              <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "rgba(13,11,30,0.55)" }}>
                <Text style={{ color: "rgba(155,155,180,0.85)", fontSize: 10, fontWeight: "600" }}>📍 Zahle · Now</Text>
                <Text style={{ color: "rgba(155,155,180,0.85)", fontSize: 10, fontWeight: "600" }}>Sawa ◈</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Plain border while building — hides under gradient border */}
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

      {/* Vibe score — after reveal */}
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
            style={{
              flexDirection: "row", alignItems: "center", gap: 5,
              backgroundColor: Colors.card, borderRadius: 20,
              paddingHorizontal: 12, paddingVertical: 8,
              borderWidth: 1, borderColor: selectedReaction === r.id ? Colors.primary : "#2D2A45",
            }}
          >
            <Text style={{ fontSize: 17 }}>{r.emoji}</Text>
            <Text style={{ color: Colors.textMuted, fontSize: 13, fontWeight: "700" }}>{r.count}</Text>
          </Pressable>
        ))}
      </Animated.View>

      {/* Share + Save */}
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
