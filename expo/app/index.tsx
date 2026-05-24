import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useRef } from "react";
import { useT } from "@/constants/i18n";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const COLORS = {
  bg: "#0D0B1E",
  orange: "#FF6B35",
  pink: "#FF3CAC",
  purple: "#7B2FF7",
  textPrimary: "#FFFFFF",
  textSecondary: "#9B9BB4",
} as const;

/**
 * Soft blurred decorative blob. Uses layered translucent circles to approximate
 * a blur effect that works on both iOS and Android (no native blur dependency).
 */
function Blob({
  color,
  size,
  opacity,
  style,
}: {
  color: string;
  size: number;
  opacity: number;
  style: { top?: number; left?: number; right?: number; bottom?: number };
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.blob,
        {
          width: size * 3,
          height: size * 3,
          borderRadius: (size * 3) / 2,
          backgroundColor: color,
          opacity: opacity * 0.35,
          ...style,
        },
      ]}
    >
      <View
        style={{
          position: "absolute",
          left: size,
          top: size,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: 0.9,
        }}
      />
    </View>
  );
}

export default function WelcomeScreen() {
  const t = useT();
  const pressScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 7,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
    }).start();
  };

  const handleStart = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    router.push("/phone");
  };

  const handleGuest = () => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    router.replace("/home");
  };

  return (
    <View style={styles.root}>
      {/* Center radial glow */}
      <View pointerEvents="none" style={styles.glowWrap}>
        <View style={styles.glowOuter} />
        <View style={styles.glowInner} />
      </View>

      {/* Decorative blobs */}
      <Blob color={COLORS.orange} size={60} opacity={0.25} style={{ top: SCREEN_H * 0.08, left: -40 }} />
      <Blob color={COLORS.pink} size={40} opacity={0.25} style={{ top: SCREEN_H * 0.1, right: -30 }} />
      <Blob color={COLORS.purple} size={50} opacity={0.2} style={{ top: SCREEN_H * 0.45, left: -50 }} />

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        {/* Center content */}
        <View style={styles.center}>
          <Text
            style={styles.arabicWordmark}
            allowFontScaling={false}
            accessibilityRole="header"
          >
            سوا
          </Text>
          <Text style={styles.latinWordmark} allowFontScaling={false}>
            SAWA
          </Text>
          <Text style={styles.tagline}>{t("عيش اللحظة مع أصحابك")}</Text>
        </View>

        {/* Bottom CTA */}
        <View style={styles.bottom}>
          <Animated.View style={{ transform: [{ scale: pressScale }] }}>
            <Pressable
              onPress={handleStart}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              accessibilityRole="button"
              accessibilityLabel={t("ابدأ برقم هاتفك")}
              testID="welcome-start-button"
            >
              <LinearGradient
                colors={[COLORS.orange, COLORS.pink]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.button}
              >
                <Text style={styles.buttonText} allowFontScaling={false}>
                  {t("ابدأ برقم هاتفك")}
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
          <Pressable
            onPress={handleGuest}
            accessibilityRole="button"
            accessibilityLabel={t("ادخل كضيف")}
            testID="welcome-guest-button"
            style={({ pressed }) => [styles.guestBtn, pressed && { opacity: 0.6 }]}
            hitSlop={8}
          >
            <Text style={styles.guestText} allowFontScaling={false}>
              {t("ادخل كضيف")}
            </Text>
          </Pressable>
          <Text style={styles.legal}>
            {t("بالتسجيل أنت موافق على شروط الاستخدام")}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const GLOW_SIZE = Math.max(SCREEN_W, SCREEN_H) * 1.1;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
    overflow: "hidden",
  },
  glowWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  glowOuter: {
    position: "absolute",
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    backgroundColor: COLORS.purple,
    opacity: 0.06,
  },
  glowInner: {
    position: "absolute",
    width: GLOW_SIZE * 0.55,
    height: GLOW_SIZE * 0.55,
    borderRadius: GLOW_SIZE * 0.275,
    backgroundColor: COLORS.purple,
    opacity: 0.15,
  },
  blob: {
    position: "absolute",
  },
  safe: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  arabicWordmark: {
    fontSize: 72,
    fontWeight: "900",
    color: COLORS.textPrimary,
    textAlign: "center",
    lineHeight: 88,
    letterSpacing: -1,
  },
  latinWordmark: {
    fontSize: 14,
    color: COLORS.textSecondary,
    letterSpacing: 8,
    textAlign: "center",
    marginTop: 8,
    fontWeight: "600",
  },
  tagline: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 16,
  },
  bottom: {
    width: "100%",
    paddingBottom: 8,
  },
  button: {
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.pink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  buttonText: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: "800",
  },
  guestBtn: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  guestText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    opacity: 0.85,
    textDecorationLine: "underline",
  },
  legal: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 12,
  },
});
