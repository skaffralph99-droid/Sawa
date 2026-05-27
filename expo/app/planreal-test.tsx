/**
 * SAWA — PlanReal Cinematic Reveal
 * Insane. Every card is its own event.
 * Full-screen shake. White flash. Particles everywhere.
 * This is the moment people screen-record.
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
  Text, View, useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as MediaLibrary from "expo-media-library";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import Colors from "@/constants/colors";

// ─── CONSTANTS ───────────────────────────────────────────────
const NAMES  = ["You", "Ahmad", "Sara", "Khalil"];
const ROLES  = ["🔥 Life of the Party", "⏰ The Late One", "😂 The Comedian", "👀 The Observer"];
const WORDS  = ["UNREAL", "Finally", "Chaotic", "Love"];
const SHOT_COUNT = 4;
type Phase = "intro" | "capture" | "reveal";

const THEME = {
  primary:   "#FF6B35",
  secondary: "#FF3CAC",
  accent:    "#BF5FFF",
  bg:        "#070510",
};

// ─── HAPTICS ─────────────────────────────────────────────────
function light()  { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }
function medium() { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); }
function heavy()  { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}); }
function success(){ if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); }
function triple() {
  heavy();
  setTimeout(heavy, 80);
  setTimeout(heavy, 160);
}

// ─── FLOATING PARTICLE ───────────────────────────────────────
function AmbientParticle({ color, startX, delay }: { color: string; startX: number; delay: number }) {
  const y = useRef(new Animated.Value(800)).current;
  const x = useRef(new Animated.Value(startX)).current;
  const op = useRef(new Animated.Value(0)).current;
  const size = 1.5 + Math.random() * 3;

  useEffect(() => {
    const run = () => {
      y.setValue(800);
      x.setValue(startX + (Math.random() - 0.5) * 60);
      op.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(op, { toValue: 0.7, duration: 500, delay, useNativeDriver: true }),
          Animated.timing(op, { toValue: 0, duration: 500, delay: 3500, useNativeDriver: true }),
        ]),
        Animated.timing(y, { toValue: -100, duration: 5000, delay, useNativeDriver: true, easing: Easing.linear }),
        Animated.timing(x, { toValue: startX + (Math.random() - 0.5) * 120, duration: 5000, delay, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ]).start(run);
    };
    run();
  }, []);

  return (
    <Animated.View pointerEvents="none" style={{
      position: "absolute", width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, opacity: op,
      transform: [{ translateX: x }, { translateY: y }],
    }} />
  );
}

// Burst particle — flies outward from a point
function BurstParticle({ angle, speed, color, visible }: { angle: number; speed: number; color: string; visible: boolean }) {
  const dist = useRef(new Animated.Value(0)).current;
  const op   = useRef(new Animated.Value(0)).current;
  const size = 3 + Math.random() * 5;
  const rad  = (angle * Math.PI) / 180;

  useEffect(() => {
    if (!visible) return;
    dist.setValue(0); op.setValue(1);
    Animated.parallel([
      Animated.timing(dist, { toValue: speed, duration: 600, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      Animated.sequence([
        Animated.timing(op, { toValue: 1, duration: 50, useNativeDriver: true }),
        Animated.timing(op, { toValue: 0, duration: 550, delay: 50, useNativeDriver: true }),
      ]),
    ]).start();
  }, [visible]);

  const tx = dist.interpolate({ inputRange: [0, speed], outputRange: [0, Math.cos(rad) * speed] });
  const ty = dist.interpolate({ inputRange: [0, speed], outputRange: [0, Math.sin(rad) * speed] });

  return (
    <Animated.View pointerEvents="none" style={{
      position: "absolute", width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, opacity: op,
      transform: [{ translateX: tx }, { translateY: ty }],
    }} />
  );
}

// ─── INTRO ───────────────────────────────────────────────────
function IntroScreen({ onStart }: { onStart: () => void }) {
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOp    = useRef(new Animated.Value(0)).current;
  const glowOp    = useRef(new Animated.Value(0)).current;
  const contentOp = useRef(new Animated.Value(0)).current;
  const btnScale  = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 14 }),
        Animated.timing(logoOp, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(glowOp, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
      Animated.timing(contentOp, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 10 }),
    ]).start();

    Animated.loop(Animated.sequence([
      Animated.timing(glowOp, { toValue: 0.4, duration: 2000, useNativeDriver: true }),
      Animated.timing(glowOp, { toValue: 1, duration: 2000, useNativeDriver: true }),
    ])).start();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: THEME.bg }}>
      {/* Ambient particles */}
      {Array.from({ length: 16 }).map((_, i) => (
        <AmbientParticle key={i} color={i % 3 === 0 ? THEME.primary : i % 3 === 1 ? THEME.secondary : THEME.accent} startX={30 + (i * 23) % 340} delay={i * 220} />
      ))}

      {/* Big radial glow */}
      <Animated.View pointerEvents="none" style={{
        position: "absolute", top: "10%", left: "-30%", right: "-30%", height: 500,
        borderRadius: 250, opacity: glowOp,
      }}>
        <LinearGradient colors={[THEME.primary + "30", THEME.secondary + "20", "transparent"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1, borderRadius: 250 }} />
      </Animated.View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "space-between", padding: 36 }}>
        <View style={{ alignItems: "center", paddingTop: 50 }}>
          <Animated.Text style={{ fontSize: 80, transform: [{ scale: logoScale }], opacity: logoOp }}>
            📦
          </Animated.Text>
          <Animated.View style={{ alignItems: "center", opacity: logoOp }}>
            <Text style={{ color: "#fff", fontSize: 36, fontWeight: "900", letterSpacing: -1.5, marginTop: 16 }}>
              PlanReal
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, letterSpacing: 4, fontWeight: "700", marginTop: 6 }}>
              MEMORY CARDS
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={{ width: "100%", gap: 16, opacity: contentOp }}>
          {[
            ["📸", "Take 4 real photos"],
            ["📦", "4 sealed memory cards"],
            ["💥", "Each card BURSTS open"],
            ["✨", "Mosaic locked forever"],
          ].map(([icon, label], i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <LinearGradient colors={[THEME.primary + "30", THEME.secondary + "20"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ fontSize: 20 }}>{icon}</Text>
              </LinearGradient>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 15, fontWeight: "600" }}>{label}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View style={{ width: "100%", transform: [{ scale: btnScale }] }}>
          <Pressable onPress={() => { triple(); onStart(); }} style={{ height: 62, borderRadius: 31, overflow: "hidden" }}>
            <LinearGradient colors={[THEME.primary, THEME.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900", letterSpacing: 0.5 }}>
                Open Pack ⚡
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
    heavy();
    flashAnim.setValue(1);
    Animated.timing(flashAnim, { toValue: 0, duration: 350, useNativeDriver: true }).start();
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.84, duration: 65, useNativeDriver: true }),
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
    <View style={{ flex: 1, backgroundColor: THEME.bg, alignItems: "center", justifyContent: "center", gap: 20 }}>
      <Text style={{ color: "#fff", fontSize: 16 }}>Camera needed</Text>
      <Pressable onPress={requestPermission} style={{ height: 52, borderRadius: 26, overflow: "hidden" }}>
        <LinearGradient colors={[THEME.primary, THEME.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, paddingHorizontal: 28, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Allow Camera</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView style={StyleSheet.absoluteFill} ref={cameraRef} facing={facing} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#fff", opacity: flashAnim }]} />
      <LinearGradient colors={["rgba(7,5,16,0.94)", "transparent"]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 200 }} />

      <SafeAreaView edges={["top"]} style={{ position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", paddingTop: 10 }}>
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 10 }}>
          {Array.from({ length: SHOT_COUNT }).map((_, i) => (
            <View key={i} style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: i < photos.length ? "#3DDC97" : "rgba(255,255,255,0.05)",
              borderWidth: i === shotIndex ? 2.5 : 1,
              borderColor: i < photos.length ? "#3DDC97" : i === shotIndex ? THEME.primary : "rgba(255,255,255,0.12)",
              alignItems: "center", justifyContent: "center",
            }}>
              {i < photos.length
                ? <Check size={14} color="#fff" strokeWidth={3} />
                : <Text style={{ color: i === shotIndex ? THEME.primary : "rgba(255,255,255,0.25)", fontSize: 11, fontWeight: "900" }}>{i + 1}</Text>}
            </View>
          ))}
        </View>
        <Text style={{ color: "#fff", fontSize: 17, fontWeight: "900" }}>
          Card {shotIndex + 1} — <Text style={{ color: THEME.primary }}>{NAMES[shotIndex]}</Text>
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 3 }}>
          {isLast ? "Last card" : `${SHOT_COUNT - shotIndex - 1} cards left`}
        </Text>
      </SafeAreaView>

      {photos.length > 0 && (
        <View style={{ position: "absolute", top: 148, left: 20, flexDirection: "row", gap: 8 }}>
          {photos.map((uri, i) => (
            <View key={i} style={{ width: 52, height: 52, borderRadius: 10, overflow: "hidden", borderWidth: 2, borderColor: "#3DDC97" }}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            </View>
          ))}
        </View>
      )}

      <LinearGradient colors={["transparent", "rgba(7,5,16,0.97)"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingTop: 80 }}>
        <SafeAreaView edges={["bottom"]} style={{ alignItems: "center", paddingBottom: 30 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingHorizontal: 56, marginBottom: 16 }}>
            <Pressable onPress={() => { light(); setFacing((f) => f === "back" ? "front" : "back"); }} style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}>
              <SwitchCamera size={28} color="rgba(255,255,255,0.7)" strokeWidth={2} />
            </Pressable>
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <Pressable onPress={doCapture} disabled={capturing} style={{ width: 94, height: 94, borderRadius: 47, borderWidth: 3.5, borderColor: "rgba(255,255,255,0.45)", overflow: "hidden" }}>
                <LinearGradient colors={[THEME.primary, THEME.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
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

// ─── SINGLE SEALED CARD ──────────────────────────────────────
function SealedCard({
  uri, name, role, word, size, state, onDone, index,
}: {
  uri: string; name: string; role: string; word: string;
  size: number;
  state: "sealed" | "charging" | "bursting" | "revealed";
  onDone: () => void;
  index: number;
}) {
  const sealedOp   = useRef(new Animated.Value(1)).current;
  const photoOp    = useRef(new Animated.Value(0)).current;
  const photoScale = useRef(new Animated.Value(0.6)).current;
  const cardScale  = useRef(new Animated.Value(1)).current;
  const cardOp     = useRef(new Animated.Value(1)).current;
  const shakeX     = useRef(new Animated.Value(0)).current;
  const shakeY     = useRef(new Animated.Value(0)).current;
  const glowOp     = useRef(new Animated.Value(0)).current;
  const glowScale  = useRef(new Animated.Value(1)).current;
  const flashOp    = useRef(new Animated.Value(0)).current;
  const nameY      = useRef(new Animated.Value(16)).current;
  const nameOp     = useRef(new Animated.Value(0)).current;
  const roleOp     = useRef(new Animated.Value(0)).current;
  const wordOp     = useRef(new Animated.Value(0)).current;
  const [showBurst, setShowBurst] = useState(false);
  const hasCharged  = useRef(false);
  const hasBurst    = useRef(false);

  // Entry: subtle scale-in stagger — cards already visible
  useEffect(() => {
    const delay = index * 200;
    cardScale.setValue(0.88);
    cardOp.setValue(0);
    setTimeout(() => {
      light();
      Animated.parallel([
        Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 12 }),
        Animated.timing(cardOp, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
      Animated.loop(Animated.sequence([
        Animated.timing(glowOp, { toValue: 0.45, duration: 1600, useNativeDriver: true }),
        Animated.timing(glowOp, { toValue: 0.1, duration: 1600, useNativeDriver: true }),
      ])).start();
    }, delay);
  }, []);

  // CHARGING phase: glow intensifies rapidly
  useEffect(() => {
    if (state !== "charging" || hasCharged.current) return;
    hasCharged.current = true;
    medium();
    // Rapid glow intensification
    Animated.loop(Animated.sequence([
      Animated.timing(glowOp, { toValue: 0.95, duration: 180, useNativeDriver: true }),
      Animated.timing(glowOp, { toValue: 0.5, duration: 180, useNativeDriver: true }),
    ])).start();
    Animated.timing(glowScale, { toValue: 1.15, duration: 600, useNativeDriver: true }).start();
  }, [state]);

  // BURST phase
  useEffect(() => {
    if (state !== "bursting" || hasBurst.current) return;
    hasBurst.current = true;

    // 1. VIOLENT SHAKE
    light();
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 12,  duration: 40, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -12, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 10,  duration: 40, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -10, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeY, { toValue: -8,  duration: 35, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 8,   duration: 40, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -8,  duration: 40, useNativeDriver: true }),
      Animated.timing(shakeY, { toValue: 5,   duration: 35, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 5,   duration: 35, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -3,  duration: 35, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0,   duration: 30, useNativeDriver: true }),
      Animated.timing(shakeY, { toValue: 0,   duration: 30, useNativeDriver: true }),
    ]).start(() => {
      // 2. TRIPLE HAPTIC + SCALE SPIKE
      triple();
      setShowBurst(true);

      // Card scale explodes up then bounces back
      Animated.sequence([
        Animated.timing(cardScale, { toValue: 1.35, duration: 80, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
        Animated.spring(cardScale, { toValue: 1.0, useNativeDriver: true, speed: 26, bounciness: 6 }),
      ]).start();

      // White flash from card center
      Animated.sequence([
        Animated.timing(flashOp, { toValue: 1, duration: 50, useNativeDriver: true }),
        Animated.timing(flashOp, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();

      // Sealed card disappears
      Animated.timing(sealedOp, { toValue: 0, duration: 120, useNativeDriver: true }).start();

      // Photo punches through: scale from 0.6 → 1.08 → 1.0
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(photoOp, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.spring(photoScale, { toValue: 1.08, useNativeDriver: true, speed: 20, bounciness: 4 }),
        ]).start(() => {
          Animated.spring(photoScale, { toValue: 1.0, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
          success();

          // Name, role, word
          Animated.parallel([
            Animated.spring(nameY, { toValue: 0, useNativeDriver: true, speed: 22, bounciness: 14 }),
            Animated.timing(nameOp, { toValue: 1, duration: 250, useNativeDriver: true }),
          ]).start();
          setTimeout(() => Animated.timing(roleOp, { toValue: 1, duration: 280, useNativeDriver: true }).start(), 200);
          setTimeout(() => {
            Animated.timing(wordOp, { toValue: 1, duration: 280, useNativeDriver: true }).start();
            // Settled persistent glow
            Animated.loop(Animated.sequence([
              Animated.timing(glowOp, { toValue: 0.8, duration: 1400, useNativeDriver: true }),
              Animated.timing(glowOp, { toValue: 0.3, duration: 1400, useNativeDriver: true }),
            ])).start();
            glowScale.setValue(1);
            onDone();
          }, 400);
        });
      }, 80);
    });
  }, [state]);

  // Burst particles — only when bursting
  const burstAngles = Array.from({ length: 16 }, (_, i) => i * 22.5);

  return (
    <Animated.View style={{
      width: size, height: size,
      opacity: cardOp,
      transform: [
        { scale: Animated.multiply(cardScale, glowScale.interpolate({ inputRange: [1, 1.15], outputRange: [1, 1] })) },
        { translateX: shakeX },
        { translateY: shakeY },
      ],
    }}>
      {/* OUTER GLOW RING */}
      <Animated.View pointerEvents="none" style={{
        position: "absolute", top: -18, left: -18, right: -18, bottom: -18,
        borderRadius: 30, opacity: glowOp,
        transform: [{ scale: glowScale }],
      }}>
        <LinearGradient colors={[THEME.primary, THEME.secondary, THEME.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: 30 }} />
      </Animated.View>

      {/* BURST PARTICLES */}
      {showBurst && (
        <View pointerEvents="none" style={{ position: "absolute", top: size / 2 - 10, left: size / 2 - 10, width: 20, height: 20 }}>
          {burstAngles.map((angle, i) => (
            <BurstParticle key={i} angle={angle} speed={60 + Math.random() * 120} color={i % 3 === 0 ? THEME.primary : i % 3 === 1 ? THEME.secondary : "#fff"} visible={showBurst} />
          ))}
        </View>
      )}

      {/* PHOTO */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: photoOp, borderRadius: 14, overflow: "hidden", transform: [{ scale: photoScale }] }]}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        {/* Cinematic vignette */}
        <LinearGradient colors={["transparent", "transparent", "rgba(0,0,0,0.9)"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, top: "40%" }} />
        {/* Name strip */}
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingBottom: 10, paddingHorizontal: 10 }}>
          <Animated.Text style={{ color: "#fff", fontSize: 14, fontWeight: "900", opacity: nameOp, transform: [{ translateY: nameY }] }}>
            {name}
          </Animated.Text>
          <Animated.Text style={{ color: THEME.primary, fontSize: 10, fontWeight: "800", opacity: roleOp, marginTop: 1 }}>
            {role}
          </Animated.Text>
          <Animated.Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, fontWeight: "700", letterSpacing: 1.5, opacity: wordOp, marginTop: 1 }}>
            "{word}"
          </Animated.Text>
        </View>
      </Animated.View>

      {/* WHITE FLASH */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 14, backgroundColor: "#fff", opacity: flashOp }]} />

      {/* SEALED CARD */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: sealedOp, borderRadius: 14, overflow: "hidden" }]}>
        <LinearGradient colors={["#1A1530", "#0C0A1A", "#181430", "#0A0814"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* Diagonal lines */}
        {Array.from({ length: 9 }).map((_, i) => (
          <View key={i} pointerEvents="none" style={{
            position: "absolute", top: `${i * 13 - 8}%`, left: -50, right: -50,
            height: 1, backgroundColor: THEME.primary, opacity: 0.07,
            transform: [{ rotate: "-20deg" }],
          }} />
        ))}
        {/* Shimmer */}
        <LinearGradient colors={["transparent", "rgba(255,255,255,0.05)", "rgba(255,255,255,0.02)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* Emblem */}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
          <View style={{ width: size * 0.42, height: size * 0.42, borderRadius: size * 0.12, overflow: "hidden" }}>
            <LinearGradient colors={[THEME.primary + "99", THEME.secondary + "99"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: size * 0.19 }}>📸</Text>
            </LinearGradient>
          </View>
          <Text style={{ color: "rgba(255,255,255,0.18)", fontSize: 8, fontWeight: "900", letterSpacing: 5 }}>SAWA</Text>
        </View>
        {/* Edge border */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }]} />
      </Animated.View>
    </Animated.View>
  );
}

// ─── MOSAIC REVEAL SCREEN ────────────────────────────────────
function MosaicReveal({ photos }: { photos: string[] }) {
  const { width } = useWindowDimensions();
  const mosaicSize  = Math.min(width * 0.9, 380);
  const GAP  = 5;
  const TILE = (mosaicSize - GAP) / 2;

  // Card states: sealed → charging → bursting → revealed
  const [cardStates, setCardStates] = useState<Array<"sealed"|"charging"|"bursting"|"revealed">>(
    ["sealed", "sealed", "sealed", "sealed"]
  );
  const [doneCount, setDoneCount] = useState(0);
  const allDone = doneCount >= SHOT_COUNT;

  const mosaicRef = useRef<View>(null);

  // Screen-level effects
  const screenShakeX  = useRef(new Animated.Value(0)).current;
  const screenShakeY  = useRef(new Animated.Value(0)).current;
  const screenFlash   = useRef(new Animated.Value(0)).current;
  const bgGlow        = useRef(new Animated.Value(0)).current;
  const titleOp       = useRef(new Animated.Value(0)).current;
  const titleY        = useRef(new Animated.Value(24)).current;
  const borderOp      = useRef(new Animated.Value(0)).current;
  const vibeValue     = useRef(new Animated.Value(0)).current;
  const shareSlide    = useRef(new Animated.Value(80)).current;
  const shareOp       = useRef(new Animated.Value(0)).current;
  const [vibeScore, setVibeScore] = useState(0);
  const targetVibe = useRef(Math.floor(88 + Math.random() * 12)).current;
  const [burstIndex, setBurstIndex] = useState(-1);

  // Screen shake on burst
  const doScreenShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(screenShakeX, { toValue: 14,  duration: 35, useNativeDriver: true }),
      Animated.timing(screenShakeX, { toValue: -14, duration: 35, useNativeDriver: true }),
      Animated.timing(screenShakeY, { toValue: -8,  duration: 35, useNativeDriver: true }),
      Animated.timing(screenShakeX, { toValue: 10,  duration: 35, useNativeDriver: true }),
      Animated.timing(screenShakeX, { toValue: -8,  duration: 35, useNativeDriver: true }),
      Animated.timing(screenShakeY, { toValue: 5,   duration: 30, useNativeDriver: true }),
      Animated.timing(screenShakeX, { toValue: 4,   duration: 30, useNativeDriver: true }),
      Animated.timing(screenShakeX, { toValue: 0,   duration: 25, useNativeDriver: true }),
      Animated.timing(screenShakeY, { toValue: 0,   duration: 25, useNativeDriver: true }),
    ]).start();
    // Full screen white flash
    Animated.sequence([
      Animated.timing(screenFlash, { toValue: 0.35, duration: 40, useNativeDriver: true }),
      Animated.timing(screenFlash, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  // Kick off sequence
  useEffect(() => {
    // BG glow fades in
    Animated.timing(bgGlow, { toValue: 1, duration: 1000, useNativeDriver: true }).start();
    // Title
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(titleOp, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(titleY, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 8 }),
      ]).start();
    }, 300);
    // Start charging card 0 after cards appear (1.2s)
    setTimeout(() => startCharge(0), 1200);
  }, []);

  const startCharge = useCallback((index: number) => {
    setCardStates((prev) => {
      const next = [...prev];
      next[index] = "charging";
      return next;
    });
    // After 700ms charging — BURST
    setTimeout(() => {
      setBurstIndex(index);
      setCardStates((prev) => {
        const next = [...prev];
        next[index] = "bursting";
        return next;
      });
      doScreenShake();
    }, 700);
  }, [doScreenShake]);

  const handleCardDone = useCallback((index: number) => {
    setCardStates((prev) => {
      const next = [...prev];
      next[index] = "revealed";
      return next;
    });
    setDoneCount((c) => {
      const next = c + 1;
      if (next < SHOT_COUNT) {
        // 600ms pause then charge next
        setTimeout(() => startCharge(index + 1), 600);
      }
      return next;
    });
  }, [startCharge]);

  // Post-reveal sequence
  useEffect(() => {
    if (!allDone) return;
    success();
    setTimeout(() => {
      Animated.timing(borderOp, { toValue: 1, duration: 900, useNativeDriver: true }).start();
    }, 400);
    setTimeout(() => {
      vibeValue.addListener(({ value }) => setVibeScore(Math.floor(value)));
      Animated.timing(vibeValue, { toValue: targetVibe, duration: 2400, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => {
        success();
      });
    }, 900);
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(shareSlide, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 12 }),
        Animated.timing(shareOp, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]).start();
    }, 2000);
    return () => { vibeValue.removeAllListeners(); };
  }, [allDone]);

  const handleShare = useCallback(async () => {
    heavy();
    if (!mosaicRef.current) return;
    try {
      const uri = await captureRef(mosaicRef, { format: "png", quality: 1, result: "tmpfile" });
      const ok = await Sharing.isAvailableAsync();
      if (ok) await Sharing.shareAsync(uri, { mimeType: "image/png" });
    } catch {}
  }, []);

  const handleSave = useCallback(async () => {
    medium();
    if (!mosaicRef.current) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") return;
      const uri = await captureRef(mosaicRef, { format: "png", quality: 1, result: "tmpfile" });
      await MediaLibrary.saveToLibraryAsync(uri);
      success();
    } catch {}
  }, []);

  const statusText =
    doneCount === 0 ? "Your memories are sealed..." :
    doneCount < SHOT_COUNT ? `${doneCount} of ${SHOT_COUNT} revealed...` :
    "Locked in forever ✨";

  const vibeEmoji = targetVibe >= 97 ? "🔥🔥🔥" : targetVibe >= 92 ? "🔥🔥" : "🔥";

  return (
    <View style={{ flex: 1, backgroundColor: THEME.bg }}>
      {/* Ambient particles */}
      {Array.from({ length: 14 }).map((_, i) => (
        <AmbientParticle key={i} color={i % 3 === 0 ? THEME.primary : i % 3 === 1 ? THEME.secondary : THEME.accent} startX={20 + (i * 25) % 360} delay={i * 300} />
      ))}

      {/* Background glow */}
      <Animated.View pointerEvents="none" style={{
        position: "absolute", top: "10%", left: "-20%", right: "-20%", height: 500,
        borderRadius: 250, opacity: bgGlow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }),
      }}>
        <LinearGradient colors={[THEME.primary, THEME.secondary, "transparent"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1, borderRadius: 250 }} />
      </Animated.View>

      {/* Full screen flash on burst */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#fff", opacity: screenFlash, zIndex: 999 }]} />

      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ alignItems: "center", paddingTop: 16, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Inner wrapper gets the shake — not the whole screen */}
        <Animated.View style={{ alignItems: "center", width: "100%", transform: [{ translateX: screenShakeX }, { translateY: screenShakeY }] }}>
        {/* Status */}
        <Animated.View style={{ alignItems: "center", marginBottom: 28, opacity: titleOp, transform: [{ translateY: titleY }] }}>
          <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: "900", letterSpacing: 4, marginBottom: 6 }}>SAWA · PLANREAL</Text>
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: -0.5 }}>{statusText}</Text>
        </Animated.View>

        {/* CARDS — always visible */}
        <View>
          <View ref={mosaicRef} style={{ width: mosaicSize, height: mosaicSize, backgroundColor: THEME.bg, borderRadius: 20, overflow: "hidden" }}>
            {/* TOP ROW */}
            <View style={{ flexDirection: "row", height: TILE }}>
              <SealedCard uri={photos[0]} name={NAMES[0]} role={ROLES[0]} word={WORDS[0]} size={TILE} state={cardStates[0]} onDone={() => handleCardDone(0)} index={0} />
              <View style={{ width: GAP }} />
              <SealedCard uri={photos[1]} name={NAMES[1]} role={ROLES[1]} word={WORDS[1]} size={TILE} state={cardStates[1]} onDone={() => handleCardDone(1)} index={1} />
            </View>
            <View style={{ height: GAP }} />
            {/* BOTTOM ROW */}
            <View style={{ flexDirection: "row", height: TILE }}>
              <SealedCard uri={photos[2]} name={NAMES[2]} role={ROLES[2]} word={WORDS[2]} size={TILE} state={cardStates[2]} onDone={() => handleCardDone(2)} index={2} />
              <View style={{ width: GAP }} />
              <SealedCard uri={photos[3]} name={NAMES[3]} role={ROLES[3]} word={WORDS[3]} size={TILE} state={cardStates[3]} onDone={() => handleCardDone(3)} index={3} />
            </View>
            {/* Meta bar */}
            <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 5, backgroundColor: "rgba(7,5,16,0.7)", borderBottomLeftRadius: 20, borderBottomRightRadius: 20 }}>
              <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, fontWeight: "700", letterSpacing: 1.5 }}>📍 ZAHLE · NOW</Text>
              <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, fontWeight: "900", letterSpacing: 3 }}>SAWA ◈</Text>
            </View>
          </View>

          {/* Gradient border — fades in after all revealed */}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 20, opacity: borderOp }]}>
            <LinearGradient colors={[THEME.primary, THEME.secondary, THEME.accent, THEME.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2.5, borderTopLeftRadius: 20, borderTopRightRadius: 20 }} />
            <LinearGradient colors={[THEME.primary, THEME.secondary, THEME.accent, THEME.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2.5, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 }} />
            <LinearGradient colors={[THEME.primary, THEME.secondary, THEME.accent]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 2.5, borderTopLeftRadius: 20, borderBottomLeftRadius: 20 }} />
            <LinearGradient colors={[THEME.primary, THEME.secondary, THEME.accent]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 2.5, borderTopRightRadius: 20, borderBottomRightRadius: 20 }} />
          </Animated.View>
        </View>

        {/* Vibe score */}
        <Animated.View style={{ alignItems: "center", marginTop: 28, opacity: shareOp }}>
          <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: "900", letterSpacing: 4 }}>TONIGHT'S VIBE</Text>
          <Text style={{ color: "#fff", fontSize: 52, fontWeight: "900", letterSpacing: -2.5, marginTop: 4 }}>
            {vibeScore}<Text style={{ fontSize: 20, color: "rgba(255,255,255,0.25)", fontWeight: "700" }}>/100</Text>
          </Text>
          <Text style={{ fontSize: 22, marginTop: -6 }}>{vibeEmoji}</Text>
        </Animated.View>

        {/* Buttons */}
        <Animated.View style={{ width: "86%", gap: 12, marginTop: 28, opacity: shareOp, transform: [{ translateY: shareSlide }] }}>
          <Pressable onPress={handleShare} style={{ height: 60, borderRadius: 30, overflow: "hidden" }}>
            <LinearGradient colors={[THEME.primary, THEME.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <Share2 size={18} color="#fff" strokeWidth={2.5} />
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>Share to Instagram</Text>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={handleSave} style={{ height: 60, borderRadius: 30, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <Download size={16} color="rgba(255,255,255,0.6)" strokeWidth={2.5} />
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, fontWeight: "700" }}>Save to Photos</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={{ alignItems: "center", paddingVertical: 14 }}>
            <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 13, fontWeight: "600" }}>Try Again</Text>
          </Pressable>
        </Animated.View>
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────
export default function PlanRealTestScreen() {
  const [phase, setPhase]   = useState<Phase>("intro");
  const [photos, setPhotos] = useState<string[]>([]);

  const handleCapture = useCallback((uri: string) => {
    setPhotos((prev) => {
      const next = [...prev, uri];
      if (next.length >= SHOT_COUNT) setTimeout(() => setPhase("reveal"), 700);
      return next;
    });
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: THEME.bg }}>
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
