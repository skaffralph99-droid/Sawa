import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { Bell, Zap, Users, Camera } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { useT } from "@/constants/i18n";
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

const COLORS = {
  bg: "#0D0B1E",
  card: "#1A1730",
  orange: "#FF6B35",
  pink: "#FF3CAC",
  purple: "#7B2FF7",
  textPrimary: "#FFFFFF",
  textSecondary: "#9B9BB4",
} as const;

type FeatureRow = {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  text: string;
};

export default function NotificationsPermissionScreen() {
  const t = useT();
  const [submitting, setSubmitting] = useState<boolean>(false);
  const pressScale = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

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

  const goBack = () => {
    try {
      router.back();
    } catch {
      router.replace("/home");
    }
  };

  const handleEnable = async () => {
    if (submitting) return;
    setSubmitting(true);
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    try {
      if (Platform.OS === "web") {
        goBack();
        return;
      }
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === "granted" && Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch (e) {
      console.log("[notifications] permission request failed", e);
    } finally {
      goBack();
    }
  };

  const handleSkip = () => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    goBack();
  };

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  const ringScale2 = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
  const ringOpacity2 = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0] });

  const features: FeatureRow[] = [
    { icon: Zap, text: t("Instant alert when PlanReal fires") },
    { icon: Users, text: t("Your whole group gets it simultaneously") },
    { icon: Camera, text: t("Only 2 minutes — don't miss it") },
  ];

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.glowCenter} />

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.content}>
          <View style={styles.flex} />

          {/* Illustration */}
          <View style={styles.illusWrap}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pulseRing,
                { transform: [{ scale: ringScale }], opacity: ringOpacity },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pulseRing,
                { transform: [{ scale: ringScale2 }], opacity: ringOpacity2 },
              ]}
            />
            <View pointerEvents="none" style={styles.illusGlow} />
            <LinearGradient
              colors={[COLORS.orange, COLORS.pink]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.illusCircle}
            >
              <Bell size={48} color={COLORS.textPrimary} strokeWidth={2} />
            </LinearGradient>
          </View>

          <Text style={styles.title} allowFontScaling={false}>
            {t("Don't Miss the PlanReal")} 📸
          </Text>

          <Text style={styles.subtitle} allowFontScaling={false}>
            {t(
              "PlanReal fires at a random moment. You need notifications to open the camera and capture the moment with your friends at the same time"
            )}
          </Text>

          {/* Feature rows */}
          <View style={styles.features}>
            {features.map((f, idx) => {
              const Icon = f.icon;
              return (
                <View key={`feat-${idx}`} style={styles.featureRow}>
                  <LinearGradient
                    colors={[COLORS.orange, COLORS.pink]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.featureBadge}
                  >
                    <Icon size={18} color={COLORS.textPrimary} strokeWidth={2.5} />
                  </LinearGradient>
                  <Text style={styles.featureText} allowFontScaling={false}>
                    {f.text}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.flex} />

          {/* Bottom CTAs */}
          <View style={styles.bottom}>
            <Animated.View style={{ transform: [{ scale: pressScale }] }}>
              <Pressable
                onPress={handleEnable}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel={t("Enable Notifications")}
                testID="notifications-enable"
              >
                <LinearGradient
                  colors={[COLORS.orange, COLORS.pink]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={[styles.button, submitting && styles.buttonDisabled]}
                >
                  <Text style={styles.buttonText} allowFontScaling={false}>
                    {t("Enable Notifications")}
                  </Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>

            <Pressable
              onPress={handleSkip}
              accessibilityRole="button"
              accessibilityLabel={t("Later")}
              testID="notifications-skip"
              style={styles.skipBtn}
            >
              <Text style={styles.skipText} allowFontScaling={false}>
                {t("Later")}
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
    overflow: "hidden",
  },
  flex: { flex: 1 },
  glowCenter: {
    position: "absolute",
    top: "20%",
    alignSelf: "center",
    width: 460,
    height: 460,
    borderRadius: 230,
    backgroundColor: COLORS.purple,
    opacity: 0.15,
  },
  safe: {
    flex: 1,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
  },
  illusWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    height: 160,
  },
  illusGlow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: COLORS.pink,
    opacity: 0.25,
  },
  pulseRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: COLORS.orange,
    backgroundColor: "transparent",
  },
  illusCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.pink,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.textPrimary,
    textAlign: "center",
    marginTop: 24,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    marginTop: 12,
    paddingHorizontal: 8,
  },
  features: {
    marginTop: 28,
    gap: 14,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: "500",
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
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: "800",
  },
  skipBtn: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
});
