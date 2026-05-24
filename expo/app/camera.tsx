import { LinearGradient } from "expo-linear-gradient";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { Check, SwitchCamera, X, Camera as CameraIcon } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useT } from "@/constants/i18n";

type Tint = readonly [string, string];

type Member = {
  id: string;
  name: string;
  initial: string;
  tint: Tint;
  isMe?: boolean;
  submitted: boolean;
};

const INITIAL_MEMBERS: Member[] = [
  { id: "u1", name: "رالف", initial: "ر", tint: ["#FF6B35", "#FF3CAC"], submitted: true },
  { id: "u2", name: "كريم", initial: "ك", tint: ["#FF3CAC", "#7B2FF7"], submitted: true },
  { id: "me", name: "أنت", initial: "أ", tint: ["#FFC857", "#FF6B35"], isMe: true, submitted: false },
  { id: "u3", name: "ليا", initial: "ل", tint: ["#7B2FF7", "#FF6B35"], submitted: false },
  { id: "u4", name: "نور", initial: "ن", tint: ["#FFC857", "#FF3CAC"], submitted: false },
  { id: "u5", name: "مازن", initial: "م", tint: ["#FF6B35", "#7B2FF7"], submitted: false },
];

const TOTAL_SECONDS = 120;

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function buzz(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium): void {
  if (Platform.OS === "web") return;
  Haptics.impactAsync(style).catch(() => {});
}

function notify(type: Haptics.NotificationFeedbackType): void {
  if (Platform.OS === "web") return;
  Haptics.notificationAsync(type).catch(() => {});
}

export default function CameraScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ planId?: string }>();
  void params;
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [seconds, setSeconds] = useState<number>(TOTAL_SECONDS);
  const [captured, setCaptured] = useState<boolean>(false);
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const cameraRef = useRef<CameraView | null>(null);

  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const captureScale = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, [pulse, spin]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [seconds]);

  // Mock: other members submit gradually
  useEffect(() => {
    const pending = members.filter((m) => !m.submitted && !m.isMe);
    if (pending.length === 0) return;
    const t = setTimeout(() => {
      setMembers((prev) => {
        const idx = prev.findIndex((m) => !m.submitted && !m.isMe);
        if (idx < 0) return prev;
        const copy = [...prev];
        copy[idx] = { ...copy[idx], submitted: true };
        return copy;
      });
      notify(Haptics.NotificationFeedbackType.Success);
    }, 6000 + Math.random() * 6000);
    return () => clearTimeout(t);
  }, [members]);

  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  const submittedCount = useMemo(() => members.filter((m) => m.submitted).length, [members]);
  const allDone = submittedCount === members.length;

  useEffect(() => {
    if (!allDone) return;
    const t = setTimeout(() => {
      router.replace("/mosaic");
    }, 1400);
    return () => clearTimeout(t);
  }, [allDone]);

  const handlePressIn = useCallback(() => {
    Animated.spring(captureScale, { toValue: 0.9, useNativeDriver: true, friction: 6 }).start();
  }, [captureScale]);
  const handlePressOut = useCallback(() => {
    Animated.spring(captureScale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
  }, [captureScale]);

  const onCapture = useCallback(async () => {
    if (captured) return;
    buzz(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.sequence([
      Animated.timing(flash, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
    try {
      if (cameraRef.current && Platform.OS !== "web") {
        await cameraRef.current.takePictureAsync({ quality: 0.7, skipProcessing: true });
      }
    } catch (e) {
      console.log("capture failed", e);
    }
    setCaptured(true);
    setMembers((prev) => prev.map((m) => (m.isMe ? { ...m, submitted: true } : m)));
    notify(Haptics.NotificationFeedbackType.Success);
  }, [captured, flash]);

  const onFlip = useCallback(() => {
    buzz(Haptics.ImpactFeedbackStyle.Light);
    setFacing((f) => (f === "back" ? "front" : "back"));
  }, []);

  const onClose = useCallback(() => {
    try { router.back(); } catch { router.replace("/home"); }
  }, []);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false, animation: "fade" }} />

      {/* Camera preview */}
      {permission?.granted && Platform.OS !== "web" ? (
        <CameraView
          ref={(r) => {
            cameraRef.current = r;
          }}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mode="picture"
        />
      ) : (
        <LinearGradient
          colors={["#1A1730", "#0D0B1E", "#1A1730"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.simNoise} pointerEvents="none" />
        </LinearGradient>
      )}

      {/* Dark overlay 30% */}
      <View style={styles.dim} pointerEvents="none" />

      {/* Flash on capture */}
      <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flash }]} />

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        {/* Top row: close + PlanReal pill */}
        <View style={styles.topRow}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <X size={22} color="#FFFFFF" strokeWidth={2.4} />
          </Pressable>

          <View style={styles.pillWrap}>
            <View style={styles.pill}>
              <LinearGradient
                colors={[Colors.primary, Colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.pillIcon}
              >
                <CameraIcon size={12} color="#FFFFFF" strokeWidth={2.6} />
              </LinearGradient>
              <Text style={styles.pillText}>PlanReal</Text>
            </View>
          </View>

          <Pressable
            onPress={onFlip}
            hitSlop={12}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <SwitchCamera size={22} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
        </View>

        {/* Center timer */}
        <View style={styles.centerWrap}>
          <View style={styles.timerWrap}>
            <Animated.View
              style={[
                styles.timerHalo,
                { opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
              ]}
            >
              <LinearGradient
                colors={[Colors.primary, Colors.secondary]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
            </Animated.View>

            <Animated.View style={[styles.ringSpin, { transform: [{ rotate: spinDeg }] }]}>
              <LinearGradient
                colors={[Colors.primary, Colors.secondary, "rgba(255,107,53,0)"]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
              />
            </Animated.View>

            <View style={styles.timerInner}>
              <Text style={styles.timerText}>{fmt(seconds)}</Text>
            </View>
          </View>

          <Text style={styles.captureHint}>
            {captured ? t("عم ننتظر الباقين...") : t("صوّر اللحظة")}
          </Text>
          <Text style={styles.captureSub}>
            {submittedCount} {t("من")} {members.length} {t("صوّروا")}
          </Text>
        </View>

        {/* Bottom area */}
        <View style={styles.bottomArea}>
          {/* Member progress row */}
          <View style={styles.membersRow}>
            {members.map((m) => (
              <MemberDot key={m.id} member={m} />
            ))}
          </View>

          {/* Capture button */}
          <View style={styles.captureRow}>
            <Animated.View style={{ transform: [{ scale: captureScale }] }}>
              <Pressable
                onPress={onCapture}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={captured}
                style={styles.captureOuter}
              >
                <View style={styles.captureRing}>
                  {captured ? (
                    <LinearGradient
                      colors={["#3DDC97", "#1FB47A"]}
                      style={styles.captureInner}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Check size={28} color="#FFFFFF" strokeWidth={3} />
                    </LinearGradient>
                  ) : (
                    <LinearGradient
                      colors={[Colors.primary, Colors.secondary]}
                      style={styles.captureInner}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    />
                  )}
                </View>
              </Pressable>
            </Animated.View>
          </View>

          {captured && (
            <Text style={styles.doneText}>{t("تم التصوير ✓")}</Text>
          )}

          {!permission?.granted && Platform.OS !== "web" && (
            <Pressable onPress={requestPermission} style={styles.permBtn}>
              <Text style={styles.permText}>{t("السماح بالكاميرا")}</Text>
            </Pressable>
          )}

          {allDone && (
            <View style={styles.allDoneWrap}>
              <Text style={styles.allDoneText}>{t("كل الشباب صوّروا 🎉")}</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

function MemberDot({ member }: { member: Member }) {
  const scale = useRef(new Animated.Value(member.submitted ? 1 : 0.95)).current;
  useEffect(() => {
    if (member.submitted) {
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    }
  }, [member.submitted, scale]);

  return (
    <Animated.View style={[styles.dotWrap, { transform: [{ scale }] }]}>
      {member.submitted ? (
        <LinearGradient
          colors={[Colors.primary, Colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.dotGradientRing}
        >
          <View style={styles.dotInnerWrap}>
            <LinearGradient
              colors={member.tint}
              style={styles.dotInner}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.dotInitial}>{member.initial}</Text>
            </LinearGradient>
            <View style={styles.checkBadge}>
              <Check size={10} color="#0D0B1E" strokeWidth={3.5} />
            </View>
          </View>
        </LinearGradient>
      ) : (
        <View style={styles.dotDim}>
          <Text style={[styles.dotInitial, { color: "rgba(255,255,255,0.55)" }]}>
            {member.initial}
          </Text>
        </View>
      )}
      {member.isMe && <View style={styles.meDot} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(13,11,30,0.30)" },
  flash: { ...StyleSheet.absoluteFillObject, backgroundColor: "#FFFFFF" },
  simNoise: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(123,47,247,0.10)" },
  safe: { flex: 1, justifyContent: "space-between" },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.7 },

  pillWrap: { flex: 1, alignItems: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.70)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  pillIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" as const, letterSpacing: 0.4 },

  centerWrap: { alignItems: "center", justifyContent: "center" },
  timerWrap: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  timerHalo: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: "hidden",
  },
  ringSpin: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
  },
  timerInner: {
    position: "absolute",
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderRadius: 57,
    backgroundColor: "rgba(0,0,0,0.62)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  timerText: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "800" as const,
    fontVariant: ["tabular-nums"],
    letterSpacing: 1,
  },
  captureHint: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700" as const,
    marginTop: 18,
  },
  captureSub: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },

  bottomArea: { paddingHorizontal: 16, paddingBottom: 8, alignItems: "center" },

  membersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginBottom: 24,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  dotWrap: { width: 44, alignItems: "center" },
  dotGradientRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dotInnerWrap: { width: 40, height: 40, borderRadius: 20 },
  dotInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dotInitial: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" as const },
  dotDim: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(26,23,48,0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#3DDC97",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#0D0B1E",
  },
  meDot: {
    position: "absolute",
    top: -4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFC857",
  },

  captureRow: { alignItems: "center", justifyContent: "center" },
  captureOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  captureRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  captureInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: {
    color: "#3DDC97",
    fontSize: 14,
    fontWeight: "700" as const,
    marginTop: 12,
  },
  permBtn: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  permText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" as const },

  allDoneWrap: { marginTop: 14 },
  allDoneText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" as const },
});
