/**
 * SAWA — PlanReal Polaroid Reveal
 * 4 polaroids drop from above, one by one.
 * Each develops like a real polaroid.
 * Dark film aesthetic. Instagram-ready.
 */
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { X, SwitchCamera, Check, Share2, Download, ChevronLeft } from "lucide-react-native";
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

const NAMES     = ["You", "Ahmad", "Sara", "Khalil"];
const SHOT_COUNT = 4;
type Phase = "intro" | "capture" | "reveal";

// Each polaroid has a slight rotation and offset for that "scattered on table" feel
const POLAROID_CONFIG = [
  { rotate: -4.5, dx: -6,  dy: 0   },  // top-left — slightly tilted left
  { rotate:  3.2, dx:  6,  dy: 4   },  // top-right — slightly tilted right
  { rotate:  5.8, dx: -8,  dy: 0   },  // bottom-left — more tilt
  { rotate: -2.8, dx:  4,  dy: -4  },  // bottom-right — slight tilt
];

function buzz(s = Haptics.ImpactFeedbackStyle.Medium) {
  if (Platform.OS !== "web") Haptics.impactAsync(s).catch(() => {});
}
function success() {
  if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

// ─── GRAIN TEXTURE OVERLAY ───────────────────────────────────
// Simulated film grain using small dots
function GrainOverlay() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 40 }).map((_, i) => (
        <View key={i} style={{
          position: "absolute",
          width: 1.5, height: 1.5,
          borderRadius: 1,
          backgroundColor: "rgba(255,255,255,0.04)",
          top: `${(i * 7.3) % 100}%`,
          left: `${(i * 13.7) % 100}%`,
        }} />
      ))}
    </View>
  );
}

// ─── INTRO ───────────────────────────────────────────────────
function IntroScreen({ onStart }: { onStart: () => void }) {
  const scale = useRef(new Animated.Value(0.92)).current;
  const op    = useRef(new Animated.Value(0)).current;
  const btnY  = useRef(new Animated.Value(20)).current;
  const btnOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 8 }),
        Animated.timing(op, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(btnY, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 10 }),
        Animated.timing(btnOp, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#0D0B1E" }}>
      <GrainOverlay />
      {/* Vignette */}
      <LinearGradient colors={["rgba(0,0,0,0.6)", "transparent", "transparent", "rgba(0,0,0,0.6)"]} locations={[0, 0.3, 0.7, 1]} style={StyleSheet.absoluteFill} />

      <View style={{ flex: 1, alignItems: "center", justifyContent: "space-between", padding: 36 }}>
        <Animated.View style={{ alignItems: "center", paddingTop: 50, opacity: op, transform: [{ scale }] }}>
          {/* Mini polaroid preview */}
          <View style={{ transform: [{ rotate: "-5deg" }], marginBottom: -20, zIndex: 1 }}>
            <View style={{ width: 100, height: 120, backgroundColor: "#F5F0E8", borderRadius: 2, padding: 6, paddingBottom: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 12 }}>
              <View style={{ flex: 1, backgroundColor: "#2A2540", borderRadius: 1, overflow: "hidden" }}>
                <LinearGradient colors={["#FF6B35", "#FF3CAC"]} style={{ flex: 1 }} />
              </View>
              <Text style={{ color: "#888", fontSize: 8, fontWeight: "600", textAlign: "center", marginTop: 4, fontStyle: "italic" }}>tonight</Text>
            </View>
          </View>
          <View style={{ transform: [{ rotate: "4deg" }] }}>
            <View style={{ width: 100, height: 120, backgroundColor: "#F5F0E8", borderRadius: 2, padding: 6, paddingBottom: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 12 }}>
              <View style={{ flex: 1, backgroundColor: "#1E1830", borderRadius: 1, overflow: "hidden" }}>
                <LinearGradient colors={["#BF5FFF", "#FF3CAC"]} style={{ flex: 1 }} />
              </View>
              <Text style={{ color: "#888", fontSize: 8, fontWeight: "600", textAlign: "center", marginTop: 4, fontStyle: "italic" }}>memories</Text>
            </View>
          </View>

          <Text style={{ color: "#fff", fontSize: 34, fontWeight: "900", letterSpacing: -1.5, marginTop: 32, textAlign: "center" }}>
            PlanReal
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, letterSpacing: 4, fontWeight: "700", marginTop: 6 }}>
            MEMORY POLAROIDS
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", lineHeight: 22, marginTop: 16 }}>
            {"4 photos.\nDrop like polaroids.\nDevelop one by one."}
          </Text>
        </Animated.View>

        <Animated.View style={{ width: "100%", opacity: btnOp, transform: [{ translateY: btnY }] }}>
          <Pressable onPress={() => { buzz(Haptics.ImpactFeedbackStyle.Heavy); onStart(); }} style={{ height: 62, borderRadius: 31, overflow: "hidden" }}>
            <LinearGradient colors={["#FF6B35", "#FF3CAC"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900", letterSpacing: 0.5 }}>
                📷  Take 4 Photos
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

// ─── CAPTURE ─────────────────────────────────────────────────
function CaptureScreen({ photos, onCapture }: { photos: string[]; onCapture: (uri: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const cameraRef = useRef<CameraView | null>(null);
  const [capturing, setCapturing] = useState(false);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const btnScale  = useRef(new Animated.Value(1)).current;
  const shotIndex = photos.length;
  const isLast    = shotIndex === SHOT_COUNT - 1;

  const doCapture = useCallback(async () => {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);
    buzz(Haptics.ImpactFeedbackStyle.Heavy);
    flashAnim.setValue(1);
    Animated.timing(flashAnim, { toValue: 0, duration: 350, useNativeDriver: true }).start();
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.86, duration: 70, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 26, bounciness: 18 }),
    ]).start();
    try {
      const p = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (p?.uri) { success(); onCapture(p.uri); }
    } catch {}
    setCapturing(false);
  }, [capturing, flashAnim, btnScale, onCapture]);

  if (!permission) return <View style={{ flex: 1, backgroundColor: "#000" }} />;
  if (!permission.granted) return (
    <View style={{ flex: 1, backgroundColor: "#0D0B1E", alignItems: "center", justifyContent: "center", gap: 20 }}>
      <Text style={{ color: "#fff", fontSize: 16 }}>Camera needed</Text>
      <Pressable onPress={requestPermission} style={{ height: 52, borderRadius: 26, overflow: "hidden" }}>
        <LinearGradient colors={["#FF6B35", "#FF3CAC"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, paddingHorizontal: 28, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Allow Camera</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView style={StyleSheet.absoluteFill} ref={cameraRef} facing={facing} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#fff", opacity: flashAnim }]} />
      <LinearGradient colors={["rgba(13,11,30,0.94)", "transparent"]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 200 }} />

      <SafeAreaView edges={["top"]} style={{ position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", paddingTop: 10 }}>
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 10 }}>
          {Array.from({ length: SHOT_COUNT }).map((_, i) => (
            <View key={i} style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: i < photos.length ? "#3DDC97" : "rgba(255,255,255,0.06)",
              borderWidth: i === shotIndex ? 2.5 : 1,
              borderColor: i < photos.length ? "#3DDC97" : i === shotIndex ? "#FF6B35" : "rgba(255,255,255,0.12)",
              alignItems: "center", justifyContent: "center",
            }}>
              {i < photos.length
                ? <Check size={14} color="#fff" strokeWidth={3} />
                : <Text style={{ color: i === shotIndex ? "#FF6B35" : "rgba(255,255,255,0.25)", fontSize: 11, fontWeight: "900" }}>{i + 1}</Text>}
            </View>
          ))}
        </View>
        <Text style={{ color: "#fff", fontSize: 17, fontWeight: "900" }}>
          Polaroid {shotIndex + 1} — <Text style={{ color: "#FF6B35" }}>{NAMES[shotIndex]}</Text>
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 3 }}>
          {isLast ? "Last polaroid" : `${SHOT_COUNT - shotIndex - 1} left`}
        </Text>
      </SafeAreaView>

      {photos.length > 0 && (
        <View style={{ position: "absolute", top: 148, left: 20, flexDirection: "row", gap: 6 }}>
          {photos.map((uri, i) => (
            <View key={i} style={{ width: 48, height: 58, backgroundColor: "#F5F0E8", padding: 3, paddingBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 8 }}>
              <Image source={{ uri }} style={{ flex: 1 }} resizeMode="cover" />
            </View>
          ))}
        </View>
      )}

      <LinearGradient colors={["transparent", "rgba(13,11,30,0.97)"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingTop: 80 }}>
        <SafeAreaView edges={["bottom"]} style={{ alignItems: "center", paddingBottom: 30 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingHorizontal: 56, marginBottom: 16 }}>
            <Pressable onPress={() => { buzz(Haptics.ImpactFeedbackStyle.Light); setFacing((f) => f === "back" ? "front" : "back"); }} style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}>
              <SwitchCamera size={28} color="rgba(255,255,255,0.7)" strokeWidth={2} />
            </Pressable>
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <Pressable onPress={doCapture} disabled={capturing} style={{ width: 94, height: 94, borderRadius: 47, borderWidth: 3.5, borderColor: "rgba(255,255,255,0.45)", overflow: "hidden" }}>
                <LinearGradient colors={["#FF6B35", "#FF3CAC"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 38 }}>{isLast ? "⚡" : "📷"}</Text>
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

// ─── SINGLE POLAROID ─────────────────────────────────────────
function Polaroid({
  uri, name, size, config, shouldDrop, onLanded,
}: {
  uri: string; name: string;
  size: number;
  config: { rotate: number; dx: number; dy: number };
  shouldDrop: boolean; onLanded: () => void;
}) {
  const BORDER  = 10;
  const BOTTOM  = 32;
  const dropY   = useRef(new Animated.Value(-400)).current;
  const dropOp  = useRef(new Animated.Value(0)).current;
  const developOp = useRef(new Animated.Value(0)).current;  // 0 = white, 1 = photo
  const bounceR = useRef(new Animated.Value(0)).current;   // small rotation bounce on land
  const hasDropped = useRef(false);

  // Develop animation: photo fades from white → image (like real polaroid)
  const runDevelop = useCallback(() => {
    Animated.timing(developOp, {
      toValue: 1,
      duration: 1800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      success();
      onLanded();
    });
  }, [onLanded]);

  useEffect(() => {
    if (!shouldDrop || hasDropped.current) return;
    hasDropped.current = true;

    // 1. Drop from above
    dropOp.setValue(1);
    Animated.spring(dropY, {
      toValue: 0,
      useNativeDriver: true,
      speed: 12,
      bounciness: 18,
    }).start(() => {
      // 2. Land bounce — tiny rotation wiggle
      buzz(Haptics.ImpactFeedbackStyle.Medium);
      Animated.sequence([
        Animated.timing(bounceR, { toValue: 3, duration: 80, useNativeDriver: true }),
        Animated.timing(bounceR, { toValue: -2, duration: 80, useNativeDriver: true }),
        Animated.timing(bounceR, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(bounceR, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
      // 3. Start developing
      setTimeout(runDevelop, 150);
    });
  }, [shouldDrop]);

  const totalWidth  = size + BORDER * 2;
  const totalHeight = size + BORDER + BOTTOM;
  const rotateDeg = config.rotate;

  const photoRotate = bounceR.interpolate({
    inputRange: [-10, 10], outputRange: ["-10deg", "10deg"],
  });

  return (
    <Animated.View style={{
      transform: [
        { translateX: config.dx },
        { translateY: Animated.add(dropY, new Animated.Value(config.dy)) },
        { rotate: `${rotateDeg}deg` },
      ],
      opacity: dropOp,
      // Shadow for depth
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.7,
      shadowRadius: 20,
      elevation: 20,
    }}>
      {/* Polaroid frame */}
      <View style={{
        width: totalWidth, height: totalHeight,
        backgroundColor: "#F2EDE0",  // warm cream polaroid color
        borderRadius: 3,
        padding: BORDER,
        paddingBottom: BOTTOM,
      }}>
        {/* Photo area */}
        <View style={{ width: size, height: size, overflow: "hidden", backgroundColor: "#fff" }}>
          {/* Actual photo */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: developOp }]}>
            <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            {/* Subtle film look — slight vignette */}
            <LinearGradient
              colors={["rgba(0,0,0,0.15)", "transparent", "transparent", "rgba(0,0,0,0.2)"]}
              locations={[0, 0.3, 0.7, 1]}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          {/* White developing overlay — fades out */}
          <Animated.View style={[StyleSheet.absoluteFill, {
            backgroundColor: "#F0EDE6",
            opacity: developOp.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          }]} />
        </View>

        {/* Name strip — handwritten feel */}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{
            color: "#3A3530",
            fontSize: 11,
            fontStyle: "italic",
            fontWeight: "600",
            letterSpacing: 0.3,
          }}>
            {name.toLowerCase()}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── MOSAIC / REVEAL SCREEN ──────────────────────────────────
function MosaicReveal({ photos }: { photos: string[] }) {
  const { width } = useWindowDimensions();

  // Each polaroid is ~42% of screen width
  const POLSIZE   = Math.floor(width * 0.4);
  const H_GAP     = 16;
  const V_GAP     = 16;

  // Which polaroid is currently dropping (-1 = none started)
  const [currentDrop, setCurrentDrop] = useState(-1);
  const [landedCount, setLandedCount] = useState(0);
  const allLanded = landedCount >= SHOT_COUNT;

  const mosaicRef  = useRef<View>(null);
  const [vibeScore, setVibeScore] = useState(0);
  const targetVibe = useRef(Math.floor(88 + Math.random() * 12)).current;

  // Post-reveal anim values
  const vibeOp    = useRef(new Animated.Value(0)).current;
  const vibeValue = useRef(new Animated.Value(0)).current;
  const brandOp   = useRef(new Animated.Value(0)).current;
  const shareSlide = useRef(new Animated.Value(60)).current;
  const shareOp   = useRef(new Animated.Value(0)).current;
  const titleOp   = useRef(new Animated.Value(0)).current;
  const titleY    = useRef(new Animated.Value(20)).current;

  // Title fades in on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(titleOp, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(titleY, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 8 }),
    ]).start();
    // First polaroid drops after 800ms
    setTimeout(() => setCurrentDrop(0), 800);
  }, []);

  const handleLanded = useCallback((index: number) => {
    setLandedCount((c) => {
      const next = c + 1;
      if (next < SHOT_COUNT) {
        // 400ms between each drop
        setTimeout(() => setCurrentDrop(index + 1), 400);
      }
      return next;
    });
  }, []);

  // After all landed — vibe score + share
  useEffect(() => {
    if (!allLanded) return;
    // Brand mark fades in
    Animated.timing(brandOp, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    // Vibe score
    setTimeout(() => {
      Animated.timing(vibeOp, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      vibeValue.addListener(({ value }) => setVibeScore(Math.floor(value)));
      Animated.timing(vibeValue, {
        toValue: targetVibe, duration: 2000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, 600);
    // Share button
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(shareSlide, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 12 }),
        Animated.timing(shareOp, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }, 1600);
    return () => vibeValue.removeAllListeners();
  }, [allLanded]);

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
      success();
    } catch {}
  }, []);

  const statusText = landedCount === 0 ? "Developing..." :
    landedCount < SHOT_COUNT ? `${landedCount} of ${SHOT_COUNT} developed...` :
    "Tonight ✨";

  const vibeEmoji = targetVibe >= 96 ? "🔥🔥🔥" : targetVibe >= 92 ? "🔥🔥" : "🔥";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#0D0B1E" }}
      contentContainerStyle={{ alignItems: "center", paddingTop: 12, paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Film grain */}
      <GrainOverlay />
      {/* Vignette around screen */}
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <LinearGradient colors={["rgba(0,0,0,0.5)", "transparent"]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 120 }} />
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.4)"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 200 }} />
      </View>

      {/* Status / Title */}
      <Animated.View style={{ alignItems: "center", marginBottom: 24, opacity: titleOp, transform: [{ translateY: titleY }] }}>
        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: "700", letterSpacing: 4, marginBottom: 5 }}>
          SAWA · PLANREAL
        </Text>
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: -0.5 }}>
          {statusText}
        </Text>
      </Animated.View>

      {/* POLAROID BOARD — the main shareable area */}
      <View
        ref={mosaicRef}
        style={{
          width: width * 0.92,
          paddingVertical: 28,
          paddingHorizontal: 20,
          backgroundColor: "#0D0B1E",
          borderRadius: 16,
          alignItems: "center",
        }}
      >
        {/* Two rows of two polaroids */}
        <View style={{ flexDirection: "row", gap: H_GAP, marginBottom: V_GAP }}>
          {/* Polaroid 0 — top left */}
          <Polaroid uri={photos[0]} name={NAMES[0]} size={POLSIZE} config={POLAROID_CONFIG[0]} shouldDrop={currentDrop >= 0} onLanded={() => handleLanded(0)} />
          {/* Polaroid 1 — top right */}
          <Polaroid uri={photos[1]} name={NAMES[1]} size={POLSIZE} config={POLAROID_CONFIG[1]} shouldDrop={currentDrop >= 1} onLanded={() => handleLanded(1)} />
        </View>
        <View style={{ flexDirection: "row", gap: H_GAP }}>
          {/* Polaroid 2 — bottom left */}
          <Polaroid uri={photos[2]} name={NAMES[2]} size={POLSIZE} config={POLAROID_CONFIG[2]} shouldDrop={currentDrop >= 2} onLanded={() => handleLanded(2)} />
          {/* Polaroid 3 — bottom right */}
          <Polaroid uri={photos[3]} name={NAMES[3]} size={POLSIZE} config={POLAROID_CONFIG[3]} shouldDrop={currentDrop >= 3} onLanded={() => handleLanded(3)} />
        </View>

        {/* Sawa watermark — bottom of board */}
        <Animated.View style={{ marginTop: 20, alignItems: "center", opacity: brandOp }}>
          <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, fontWeight: "900", letterSpacing: 5 }}>
            SAWA ◈
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.15)", fontSize: 8, letterSpacing: 2, marginTop: 2 }}>
            📍 Zahle
          </Text>
        </Animated.View>
      </View>

      {/* Vibe score */}
      <Animated.View style={{ alignItems: "center", marginTop: 24, opacity: vibeOp }}>
        <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: "700", letterSpacing: 4 }}>
          TONIGHT'S VIBE
        </Text>
        <Text style={{ color: "#fff", fontSize: 48, fontWeight: "900", letterSpacing: -2.5, marginTop: 4 }}>
          {vibeScore}
          <Text style={{ fontSize: 18, color: "rgba(255,255,255,0.25)", fontWeight: "600" }}>/100</Text>
        </Text>
        <Text style={{ fontSize: 20, marginTop: -4 }}>{vibeEmoji}</Text>
      </Animated.View>

      {/* Share + Save */}
      <Animated.View style={{
        width: "86%", gap: 12, marginTop: 24,
        opacity: shareOp, transform: [{ translateY: shareSlide }],
      }}>
        <Pressable onPress={handleShare} style={{ height: 60, borderRadius: 30, overflow: "hidden" }}>
          <LinearGradient colors={["#FF6B35", "#FF3CAC"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <Share2 size={18} color="#fff" strokeWidth={2.5} />
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>Share to Instagram</Text>
          </LinearGradient>
        </Pressable>
        <Pressable onPress={handleSave} style={{ height: 60, borderRadius: 30, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <Download size={16} color="rgba(255,255,255,0.5)" strokeWidth={2.5} />
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, fontWeight: "700" }}>Save to Photos</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ alignItems: "center", paddingVertical: 14 }}>
          <Text style={{ color: "rgba(255,255,255,0.2)", fontSize: 13 }}>Try Again</Text>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────
export default function PlanRealTestScreen() {
  const [phase, setPhase]   = useState<Phase>("intro");
  const [photos, setPhotos] = useState<string[]>([]);

  const handleCapture = useCallback((uri: string) => {
    setPhotos((prev) => {
      const next = [...prev, uri];
      if (next.length >= SHOT_COUNT) setTimeout(() => setPhase("reveal"), 600);
      return next;
    });
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#0D0B1E" }}>
      <Stack.Screen options={{ headerShown: false, animation: "fade" }} />

      {phase === "intro" && (
        <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
              <X size={22} color="rgba(255,255,255,0.25)" strokeWidth={2} />
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
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
              <ChevronLeft size={24} color="rgba(255,255,255,0.25)" strokeWidth={2} />
            </Pressable>
          </View>
          <MosaicReveal photos={photos} />
        </SafeAreaView>
      )}
    </View>
  );
}
