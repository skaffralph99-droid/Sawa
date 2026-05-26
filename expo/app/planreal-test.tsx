/**
 * SAWA — PlanReal Mosaic Reveal
 * Cinematic pack-opening experience.
 * Every card bursts open one by one.
 * Dark. Premium. Emotional.
 */
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { X, SwitchCamera, Check, ChevronLeft, Share2, Download } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated, Easing, Image, Platform,
  Pressable, ScrollView, StyleSheet,
  Text, View, useWindowDimensions, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as MediaLibrary from "expo-media-library";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import Colors from "@/constants/colors";

// ─── CONFIG ──────────────────────────────────────────────────
const NAMES   = ["You", "Ahmad", "Sara", "Khalil"];
const ROLES   = ["🔥 Life of the Party", "⏰ The Late One", "😂 The Comedian", "👀 The Observer"];
const WORDS   = ["UNREAL", "Finally", "Chaotic", "Love"];
const SHOT_COUNT = 4;

type Phase = "intro" | "capture" | "reveal";
type RevealPhase = "entry" | "cards" | "revealing" | "assembling" | "done";

// Category themes
const THEMES: Record<string, { primary: string; secondary: string; label: string }> = {
  beach:   { primary: "#FF6B35", secondary: "#FFB347", label: "Beach Day" },
  night:   { primary: "#BF5FFF", secondary: "#FF3CAC", label: "Night Out" },
  hiking:  { primary: "#4CAF50", secondary: "#8BC34A", label: "Hike" },
  food:    { primary: "#FF8C42", secondary: "#FFD166", label: "Dinner" },
  sport:   { primary: "#00BCD4", secondary: "#3F51B5", label: "Game Day" },
  other:   { primary: "#FF6B35", secondary: "#FF3CAC", label: "Tonight" },
};

function buzz(s: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) {
  if (Platform.OS !== "web") Haptics.impactAsync(s).catch(() => {});
}
function notifyH(t: Haptics.NotificationFeedbackType) {
  if (Platform.OS !== "web") Haptics.notificationAsync(t).catch(() => {});
}
function heartbeat() {
  if (Platform.OS === "web") return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}), 180);
}

// ─── FLOATING PARTICLE ───────────────────────────────────────
function Particle({ color, delay }: { color: string; delay: number }) {
  const x = useRef(new Animated.Value(Math.random() * 300 - 150)).current;
  const y = useRef(new Animated.Value(Math.random() * 600)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const size = 2 + Math.random() * 3;

  useEffect(() => {
    const run = () => {
      x.setValue(Math.random() * 300 - 150);
      y.setValue(600);
      opacity.setValue(0);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0.6, duration: 400, useNativeDriver: true, delay }),
        Animated.timing(y, { toValue: -100, duration: 4000 + Math.random() * 3000, useNativeDriver: true, delay, easing: Easing.linear }),
        Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true, delay: delay + 3200 }),
      ]).start(run);
    };
    run();
  }, []);

  return (
    <Animated.View pointerEvents="none" style={{
      position: "absolute", width: size, height: size,
      borderRadius: size / 2, backgroundColor: color,
      opacity, transform: [{ translateX: x }, { translateY: y }],
      left: "50%",
    }} />
  );
}

// ─── INTRO SCREEN ────────────────────────────────────────────
function IntroScreen({ onStart }: { onStart: () => void }) {
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1500, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0.4, duration: 1500, useNativeDriver: true }),
    ])).start();
  }, []);

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.7] });

  return (
    <View style={{ flex: 1, backgroundColor: "#0A0814" }}>
      {/* Ambient particles */}
      {Array.from({ length: 12 }).map((_, i) => (
        <Particle key={i} color={i % 2 === 0 ? "#FF6B35" : "#FF3CAC"} delay={i * 300} />
      ))}

      {/* Center glow */}
      <Animated.View pointerEvents="none" style={{
        position: "absolute", top: "25%", left: "10%", right: "10%",
        height: 300, borderRadius: 150, opacity: glowOpacity,
        backgroundColor: "#FF3CAC",
        transform: [{ scaleX: 2 }],
      }} />

      <Animated.View style={{ flex: 1, alignItems: "center", justifyContent: "space-between", padding: 36, opacity, transform: [{ scale }] }}>
        <View style={{ alignItems: "center", paddingTop: 60 }}>
          <Text style={{ fontSize: 64, marginBottom: 24 }}>📦</Text>
          <Text style={{ color: "#fff", fontSize: 32, fontWeight: "900", letterSpacing: -1, textAlign: "center" }}>
            PlanReal
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, marginTop: 10, textAlign: "center", lineHeight: 22 }}>
            {"4 sealed cards.\nEach one bursts open.\nOne by one."}
          </Text>
        </View>

        <View style={{ width: "100%", gap: 14 }}>
          {[
            ["📸", "Take 4 photos — one per person"],
            ["📦", "4 sealed memory cards appear"],
            ["💥", "Each card bursts open alone"],
            ["✨", "Mosaic locks in forever"],
          ].map(([icon, label], i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 18 }}>{icon}</Text>
              </View>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, fontWeight: "600" }}>{label}</Text>
            </View>
          ))}
        </View>

        <Pressable onPress={() => { buzz(Haptics.ImpactFeedbackStyle.Heavy); onStart(); }} style={{ width: "100%", height: 60, borderRadius: 30, overflow: "hidden" }}>
          <LinearGradient colors={["#FF6B35", "#FF3CAC"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900", letterSpacing: 0.5 }}>Open a Pack ⚡</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── CAPTURE SCREEN ──────────────────────────────────────────
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
      Animated.timing(btnScale, { toValue: 0.86, duration: 70, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 28, bounciness: 16 }),
    ]).start();
    try {
      const p = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (p?.uri) { notifyH(Haptics.NotificationFeedbackType.Success); onCapture(p.uri); }
    } catch {}
    setCapturing(false);
  }, [capturing, flashAnim, btnScale, onCapture]);

  if (!permission) return <View style={{ flex: 1, backgroundColor: "#000" }} />;
  if (!permission.granted) return (
    <View style={{ flex: 1, backgroundColor: "#0A0814", alignItems: "center", justifyContent: "center", gap: 20 }}>
      <Text style={{ color: "#fff", fontSize: 16 }}>Camera access needed</Text>
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
      <LinearGradient colors={["rgba(10,8,20,0.95)", "transparent"]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 200 }} />

      <SafeAreaView edges={["top"]} style={{ position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", paddingTop: 8 }}>
        {/* Progress */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
          {Array.from({ length: SHOT_COUNT }).map((_, i) => (
            <View key={i} style={{
              width: 34, height: 34, borderRadius: 17,
              backgroundColor: i < photos.length ? "#3DDC97" : "rgba(255,255,255,0.06)",
              borderWidth: i === shotIndex ? 2 : 1,
              borderColor: i < photos.length ? "#3DDC97" : i === shotIndex ? "#FF6B35" : "rgba(255,255,255,0.15)",
              alignItems: "center", justifyContent: "center",
            }}>
              {i < photos.length
                ? <Check size={14} color="#fff" strokeWidth={3} />
                : <Text style={{ color: i === shotIndex ? "#FF6B35" : "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: "800" }}>{i + 1}</Text>
              }
            </View>
          ))}
        </View>
        <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}>
          Card {shotIndex + 1} — <Text style={{ color: "#FF6B35" }}>{name}</Text>
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 3 }}>
          {isLast ? "Last one — make it legendary" : `${SHOT_COUNT - shotIndex - 1} cards left`}
        </Text>
      </SafeAreaView>

      {photos.length > 0 && (
        <View style={{ position: "absolute", top: 145, left: 20, right: 20, flexDirection: "row", gap: 8 }}>
          {photos.map((uri, i) => (
            <View key={i} style={{ width: 56, height: 56, borderRadius: 10, overflow: "hidden", borderWidth: 2, borderColor: "#3DDC97" }}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            </View>
          ))}
        </View>
      )}

      <LinearGradient colors={["transparent", "rgba(10,8,20,0.98)"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingTop: 100 }}>
        <SafeAreaView edges={["bottom"]} style={{ alignItems: "center", paddingBottom: 28 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingHorizontal: 56, marginBottom: 16 }}>
            <Pressable onPress={() => { buzz(Haptics.ImpactFeedbackStyle.Light); setFacing((f) => f === "back" ? "front" : "back"); }} style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}>
              <SwitchCamera size={28} color="rgba(255,255,255,0.8)" strokeWidth={2} />
            </Pressable>
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <Pressable onPress={doCapture} disabled={capturing} style={{ width: 92, height: 92, borderRadius: 46, borderWidth: 3.5, borderColor: "rgba(255,255,255,0.5)", overflow: "hidden" }}>
                <LinearGradient colors={["#FF6B35", "#FF3CAC"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 38 }}>{isLast ? "⚡" : "📸"}</Text>
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

// ─── SEALED CARD ─────────────────────────────────────────────
// shouldReveal: false = sealed, true = BURST open
function SealedCard({
  uri, name, role, word, size, shouldReveal, onDone, theme, index,
}: {
  uri: string; name: string; role: string; word: string;
  size: number; shouldReveal: boolean; onDone: () => void;
  theme: { primary: string; secondary: string };
  index: number;
}) {
  const sealedOpacity  = useRef(new Animated.Value(1)).current;
  const photoOpacity   = useRef(new Animated.Value(0)).current;
  const cardScale      = useRef(new Animated.Value(1)).current;
  const shakeX         = useRef(new Animated.Value(0)).current;
  const shakeY         = useRef(new Animated.Value(0)).current;
  const outerGlow      = useRef(new Animated.Value(0)).current;
  const innerGlow      = useRef(new Animated.Value(0)).current;
  const burstScale     = useRef(new Animated.Value(0)).current;
  const burstOpacity   = useRef(new Animated.Value(0)).current;
  const nameY          = useRef(new Animated.Value(20)).current;
  const nameOpacity    = useRef(new Animated.Value(0)).current;
  const roleOpacity    = useRef(new Animated.Value(0)).current;
  const wordOpacity    = useRef(new Animated.Value(0)).current;
  const hasRun         = useRef(false);

  // Entry animation — card slides in
  const entryY    = useRef(new Animated.Value(60)).current;
  const entryOp   = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const delay = index * 200;
    setTimeout(() => {
      heartbeat();
      Animated.parallel([
        Animated.spring(entryY, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 10 }),
        Animated.timing(entryOp, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
      // Sealed card ambient glow loop
      Animated.loop(Animated.sequence([
        Animated.timing(outerGlow, { toValue: 0.5, duration: 1800, useNativeDriver: true }),
        Animated.timing(outerGlow, { toValue: 0.15, duration: 1800, useNativeDriver: true }),
      ])).start();
    }, delay);
  }, []);

  // BURST SEQUENCE — triggered by parent
  useEffect(() => {
    if (!shouldReveal || hasRun.current) return;
    hasRun.current = true;

    // STEP 1: Intensify glow + inner glow
    Animated.timing(innerGlow, { toValue: 1, duration: 200, useNativeDriver: true }).start();

    // STEP 2: Violent shake
    setTimeout(() => {
      buzz(Haptics.ImpactFeedbackStyle.Light);
      Animated.sequence([
        Animated.timing(shakeX, { toValue: 10,  duration: 45, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -10, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 9,   duration: 45, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -9,  duration: 45, useNativeDriver: true }),
        Animated.timing(shakeY, { toValue: -6,  duration: 40, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 7,   duration: 45, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -7,  duration: 45, useNativeDriver: true }),
        Animated.timing(shakeY, { toValue: 0,   duration: 40, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 4,   duration: 40, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0,   duration: 40, useNativeDriver: true }),
      ]).start(() => {
        // STEP 3: BURST — heavy haptic + scale spike + burst flash
        buzz(Haptics.ImpactFeedbackStyle.Heavy);
        setTimeout(() => buzz(Haptics.ImpactFeedbackStyle.Heavy), 80);

        // Scale spike
        Animated.sequence([
          Animated.timing(cardScale, { toValue: 1.28, duration: 90, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.spring(cardScale, { toValue: 1.02, useNativeDriver: true, speed: 22, bounciness: 8 }),
        ]).start();

        // Burst flash
        Animated.sequence([
          Animated.timing(burstOpacity, { toValue: 0.9, duration: 60, useNativeDriver: true }),
          Animated.spring(burstScale, { toValue: 2.5, useNativeDriver: true, speed: 18, bounciness: 4 }),
          Animated.timing(burstOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start();

        // Sealed card disappears
        Animated.timing(sealedOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();

        // Photo floods in
        setTimeout(() => {
          Animated.timing(photoOpacity, { toValue: 1, duration: 350, useNativeDriver: true }).start(() => {
            // Name, role, word slide up
            notifyH(Haptics.NotificationFeedbackType.Success);
            Animated.parallel([
              Animated.spring(nameY, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 14 }),
              Animated.timing(nameOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
            ]).start();
            setTimeout(() => Animated.timing(roleOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start(), 200);
            setTimeout(() => {
              Animated.timing(wordOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
              // Persistent glow loop after reveal
              Animated.loop(Animated.sequence([
                Animated.timing(outerGlow, { toValue: 0.9, duration: 1200, useNativeDriver: true }),
                Animated.timing(outerGlow, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
              ])).start();
              onDone();
            }, 400);
          });
        }, 100);
      });
    }, 200);
  }, [shouldReveal]);

  const glowOpacity = outerGlow;

  return (
    <Animated.View style={{
      width: size, height: size,
      transform: [{ scale: cardScale }, { translateX: shakeX }, { translateY: Animated.add(entryY, shakeY) }],
      opacity: entryOp,
    }}>
      {/* Outer ambient glow ring */}
      <Animated.View pointerEvents="none" style={{
        position: "absolute", top: -16, left: -16, right: -16, bottom: -16,
        borderRadius: 28, opacity: glowOpacity,
      }}>
        <LinearGradient colors={[theme.primary, theme.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: 28 }} />
      </Animated.View>

      {/* Burst flash — white circle expansion */}
      <Animated.View pointerEvents="none" style={{
        position: "absolute",
        top: size / 2 - 20, left: size / 2 - 20,
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: "#fff",
        opacity: burstOpacity,
        transform: [{ scale: burstScale }],
      }} />

      {/* PHOTO LAYER */}
      <Animated.View style={[StyleSheet.absoluteFill, {
        opacity: photoOpacity, borderRadius: 16, overflow: "hidden",
      }]}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        {/* Inner glow during anticipation */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {
          opacity: innerGlow, borderRadius: 16,
        }]}>
          <LinearGradient colors={[theme.primary + "40", "transparent", theme.secondary + "40"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
        </Animated.View>
        {/* Name / role strip */}
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.88)"]} style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          paddingTop: 40, paddingBottom: 10, paddingHorizontal: 10,
        }}>
          <Animated.Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", opacity: nameOpacity, transform: [{ translateY: nameY }] }}>
            {name}
          </Animated.Text>
          <Animated.Text style={{ fontSize: 10, fontWeight: "700", opacity: roleOpacity, color: theme.primary, marginTop: 1 }}>
            {role}
          </Animated.Text>
          <Animated.Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "700", letterSpacing: 1, opacity: wordOpacity, marginTop: 1 }}>
            "{word}"
          </Animated.Text>
        </LinearGradient>
      </Animated.View>

      {/* SEALED CARD LAYER — on top until burst */}
      <Animated.View style={[StyleSheet.absoluteFill, {
        opacity: sealedOpacity, borderRadius: 16, overflow: "hidden",
      }]}>
        {/* Matte black gradient */}
        <LinearGradient colors={["#1C1830", "#0D0B1E", "#16132A", "#0A0814"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* Diagonal texture lines */}
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={i} pointerEvents="none" style={{
            position: "absolute",
            top: `${i * 14 - 10}%`, left: -40, right: -40,
            height: 1, opacity: 0.08,
            backgroundColor: theme.primary,
            transform: [{ rotate: "-22deg" }],
          }} />
        ))}
        {/* Metallic shimmer overlay */}
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.04)", "transparent", "rgba(255,255,255,0.06)", "transparent"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Center emblem */}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
          <View style={{ width: size * 0.44, height: size * 0.44, borderRadius: size * 0.12, overflow: "hidden" }}>
            <LinearGradient colors={[theme.primary + "AA", theme.secondary + "AA"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: size * 0.2 }}>📸</Text>
            </LinearGradient>
          </View>
          <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 9, fontWeight: "900", letterSpacing: 4 }}>SAWA</Text>
        </View>
        {/* Edge glow border */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {
          borderRadius: 16, borderWidth: 1,
          borderColor: theme.primary,
          opacity: innerGlow,
        }]} />
      </Animated.View>
    </Animated.View>
  );
}

// ─── MOSAIC REVEAL SCREEN ────────────────────────────────────
function MosaicReveal({ photos, activityType }: { photos: string[]; activityType: string }) {
  const { width } = useWindowDimensions();
  const theme = THEMES[activityType] ?? THEMES.other;
  const mosaicSize = Math.min(width * 0.9, 380);
  const GAP = 5;
  const TILE = (mosaicSize - GAP) / 2;

  // Phase state — parent controls everything
  const [revealPhase, setRevealPhase]   = useState<RevealPhase>("entry");
  const [currentCard, setCurrentCard]   = useState(-1);  // which card is opening (-1 = none)
  const [doneCards, setDoneCards]       = useState(0);
  const allDone = doneCards >= SHOT_COUNT;

  const mosaicRef = useRef<View>(null);
  const [vibeScore, setVibeScore]       = useState(0);
  const targetVibe = useRef(Math.floor(87 + Math.random() * 13)).current;

  // Animated values
  const bgGrain        = useRef(new Animated.Value(0)).current;
  const titleOpacity   = useRef(new Animated.Value(0)).current;
  const titleY         = useRef(new Animated.Value(30)).current;
  const borderOpacity  = useRef(new Animated.Value(0)).current;
  const vibeValue      = useRef(new Animated.Value(0)).current;
  const shareSlide     = useRef(new Animated.Value(100)).current;
  const shareOpacity   = useRef(new Animated.Value(0)).current;
  const assembleScale  = useRef(new Animated.Value(1)).current;

  // Entry sequence
  useEffect(() => {
    // Grain/ambient fade
    Animated.timing(bgGrain, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    // Title fades in
    setTimeout(() => {
      heartbeat();
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(titleY, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 10 }),
      ]).start();
    }, 400);
    // Cards phase starts after entry
    setTimeout(() => {
      setRevealPhase("cards");
      // First card reveals after cards appear
      setTimeout(() => {
        setRevealPhase("revealing");
        setCurrentCard(0);
      }, 1200);
    }, 800);
  }, []);

  // When a card finishes — wait then open next
  const handleCardDone = useCallback((index: number) => {
    setDoneCards((c) => {
      const next = c + 1;
      if (next < SHOT_COUNT) {
        // Pause between cards — 500ms
        setTimeout(() => setCurrentCard(index + 1), 500);
      }
      return next;
    });
  }, []);

  // When all done — assembly + vibe sequence
  useEffect(() => {
    if (!allDone) return;
    setRevealPhase("assembling");
    notifyH(Haptics.NotificationFeedbackType.Success);

    // Border glow
    setTimeout(() => {
      Animated.timing(borderOpacity, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    }, 300);

    // Slight assemble scale pulse
    setTimeout(() => {
      Animated.sequence([
        Animated.timing(assembleScale, { toValue: 1.03, duration: 200, useNativeDriver: true }),
        Animated.spring(assembleScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
      ]).start();
      heartbeat();
    }, 400);

    // Vibe score
    setTimeout(() => {
      vibeValue.addListener(({ value }) => setVibeScore(Math.floor(value)));
      Animated.timing(vibeValue, {
        toValue: targetVibe, duration: 2200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        notifyH(Haptics.NotificationFeedbackType.Success);
        setRevealPhase("done");
      });
    }, 800);

    // Share button
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(shareSlide, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 12 }),
        Animated.timing(shareOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]).start();
    }, 1800);

    return () => { vibeValue.removeAllListeners(); };
  }, [allDone]);

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
      notifyH(Haptics.NotificationFeedbackType.Success);
    } catch {}
  }, []);

  const vibeEmoji = targetVibe >= 95 ? "🔥🔥🔥" : targetVibe >= 90 ? "🔥🔥" : "🔥";
  const statusText = revealPhase === "entry" ? "Something is coming..." :
    revealPhase === "cards" ? "Your memories are sealed..." :
    revealPhase === "revealing" ? `${doneCards} of ${SHOT_COUNT} revealed...` :
    revealPhase === "assembling" ? "Locking in forever..." :
    "Your mosaic ✨";

  return (
    <View style={{ flex: 1, backgroundColor: "#0A0814" }}>
      {/* Ambient background particles — always */}
      {revealPhase !== "done" && Array.from({ length: 8 }).map((_, i) => (
        <Particle key={i} color={i % 2 === 0 ? theme.primary : theme.secondary} delay={i * 400} />
      ))}

      {/* Center background glow */}
      <Animated.View pointerEvents="none" style={{
        position: "absolute", top: "15%", left: "5%", right: "5%",
        height: 400, borderRadius: 200,
        backgroundColor: theme.primary,
        opacity: bgGrain.interpolate({ inputRange: [0, 1], outputRange: [0, 0.06] }),
        transform: [{ scaleX: 2.5 }],
      }} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ alignItems: "center", paddingTop: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status title */}
        <Animated.View style={{ alignItems: "center", marginBottom: 28, opacity: titleOpacity, transform: [{ translateY: titleY }] }}>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "700", letterSpacing: 3, marginBottom: 6 }}>
            PLANREAL
          </Text>
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: -0.5 }}>
            {statusText}
          </Text>
        </Animated.View>

        {/* Mosaic frame */}
        <Animated.View style={{ transform: [{ scale: assembleScale }] }}>
          {/* Gradient border — appears after all revealed */}
          <Animated.View style={{ opacity: borderOpacity }}>
            <LinearGradient
              colors={[theme.primary, theme.secondary, theme.primary]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ borderRadius: 24, padding: 2.5 }}
            >
              <View
                ref={mosaicRef}
                style={{
                  width: mosaicSize, height: mosaicSize,
                  backgroundColor: "#0A0814",
                  borderRadius: 22, overflow: "hidden",
                }}
              >
                {/* TOP ROW */}
                <View style={{ flexDirection: "row", height: TILE }}>
                  <SealedCard uri={photos[0]} name={NAMES[0]} role={ROLES[0]} word={WORDS[0]} size={TILE} shouldReveal={currentCard >= 0} onDone={() => handleCardDone(0)} theme={theme} index={0} />
                  <View style={{ width: GAP, backgroundColor: "#0A0814" }} />
                  <SealedCard uri={photos[1]} name={NAMES[1]} role={ROLES[1]} word={WORDS[1]} size={TILE} shouldReveal={currentCard >= 1} onDone={() => handleCardDone(1)} theme={theme} index={1} />
                </View>

                <View style={{ height: GAP, backgroundColor: "#0A0814" }} />

                {/* BOTTOM ROW */}
                <View style={{ flexDirection: "row", height: TILE }}>
                  <SealedCard uri={photos[2]} name={NAMES[2]} role={ROLES[2]} word={WORDS[2]} size={TILE} shouldReveal={currentCard >= 2} onDone={() => handleCardDone(2)} theme={theme} index={2} />
                  <View style={{ width: GAP, backgroundColor: "#0A0814" }} />
                  <SealedCard uri={photos[3]} name={NAMES[3]} role={ROLES[3]} word={WORDS[3]} size={TILE} shouldReveal={currentCard >= 3} onDone={() => handleCardDone(3)} theme={theme} index={3} />
                </View>

                {/* Meta bar */}
                <View style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  flexDirection: "row", justifyContent: "space-between",
                  paddingHorizontal: 12, paddingVertical: 5,
                  backgroundColor: "rgba(10,8,20,0.7)",
                }}>
                  <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: "700", letterSpacing: 1 }}>📍 ZAHLE · NOW</Text>
                  <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: "900", letterSpacing: 2 }}>SAWA ◈</Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Dark border while building */}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {
            borderRadius: 24, borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            opacity: borderOpacity.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          }]} />
        </Animated.View>

        {/* Vibe score */}
        <Animated.View style={{ alignItems: "center", marginTop: 24, opacity: shareOpacity }}>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "700", letterSpacing: 2 }}>
            TONIGHT'S VIBE
          </Text>
          <Text style={{ color: "#fff", fontSize: 42, fontWeight: "900", letterSpacing: -2, marginTop: 2 }}>
            {vibeScore}<Text style={{ fontSize: 18, color: "rgba(255,255,255,0.3)" }}>/100</Text>
          </Text>
          <Text style={{ fontSize: 20, marginTop: -4 }}>{vibeEmoji}</Text>
        </Animated.View>

        {/* Activity theme badge */}
        <Animated.View style={{ marginTop: 16, opacity: shareOpacity }}>
          <View style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: theme.primary + "60", backgroundColor: theme.primary + "15" }}>
            <Text style={{ color: theme.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>
              {(THEMES[activityType] ?? THEMES.other).label.toUpperCase()}
            </Text>
          </View>
        </Animated.View>

        {/* Share + Save */}
        <Animated.View style={{
          width: "85%", gap: 12, marginTop: 28,
          opacity: shareOpacity,
          transform: [{ translateY: shareSlide }],
        }}>
          <Pressable onPress={handleShare} style={{ height: 58, borderRadius: 29, overflow: "hidden" }}>
            <LinearGradient colors={[theme.primary, theme.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <Share2 size={18} color="#fff" strokeWidth={2.5} />
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>Share to Instagram</Text>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={handleSave} style={{ height: 58, borderRadius: 29, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 }}>
            <Download size={16} color="rgba(255,255,255,0.7)" strokeWidth={2.5} />
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 15, fontWeight: "700" }}>Save to Photos</Text>
          </Pressable>

          <Pressable onPress={() => router.back()} style={{ alignItems: "center", paddingVertical: 12 }}>
            <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, fontWeight: "600" }}>Try Again</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────
export default function PlanRealTestScreen() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [photos, setPhotos] = useState<string[]>([]);
  const [activityType] = useState("night"); // change to test different themes

  const handleCapture = useCallback((uri: string) => {
    setPhotos((prev) => {
      const next = [...prev, uri];
      if (next.length >= SHOT_COUNT) setTimeout(() => setPhase("reveal"), 600);
      return next;
    });
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#0A0814" }}>
      <Stack.Screen options={{ headerShown: false, animation: "fade" }} />

      {phase === "intro" && (
        <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
              <X size={22} color="rgba(255,255,255,0.3)" strokeWidth={2} />
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
              <ChevronLeft size={24} color="rgba(255,255,255,0.3)" strokeWidth={2} />
            </Pressable>
          </View>
          <MosaicReveal photos={photos} activityType={activityType} />
        </SafeAreaView>
      )}
    </View>
  );
}
