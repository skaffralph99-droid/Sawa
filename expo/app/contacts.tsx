import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Contacts from "expo-contacts";
import { BookUser, Lock, ChevronLeft } from "lucide-react-native";
import React, { useRef, useState } from "react";
import { useT } from "@/constants/i18n";
import {
  Animated,
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

export default function ContactsPermissionScreen() {
  const t = useT();
  const [submitting, setSubmitting] = useState<boolean>(false);
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

  const goHome = () => {
    router.replace("/home");
  };

  const handleAllow = async () => {
    if (submitting) return;
    setSubmitting(true);
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    try {
      if (Platform.OS === "web") {
        goHome();
        return;
      }
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === "granted" && Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch (e) {
      console.log("[contacts] permission request failed", e);
    } finally {
      goHome();
    }
  };

  const handleSkip = () => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    goHome();
  };

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.glowCenter} />

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.backRow}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
              try { router.back(); } catch { router.replace("/home"); }
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("Back")}
            style={styles.backBtn}
            testID="contacts-back"
          >
            <ChevronLeft size={24} color={COLORS.textPrimary} strokeWidth={2.5} />
          </Pressable>
        </View>
        <View style={styles.content}>
          <View style={styles.flex} />

          {/* Illustration */}
          <View style={styles.illusWrap}>
            <View pointerEvents="none" style={styles.illusGlow} />
            <LinearGradient
              colors={[COLORS.orange, COLORS.pink]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.illusCircle}
            >
              <BookUser size={48} color={COLORS.textPrimary} strokeWidth={2} />
            </LinearGradient>
          </View>

          <Text style={styles.title} allowFontScaling={false}>
            {t("Find Your Friends on Sawa")}
          </Text>

          <Text style={styles.subtitle} allowFontScaling={false}>
            {t(
              "We'll check which of your contacts are already on Sawa so you can follow their plans and join them"
            )}
          </Text>

          {/* Privacy card */}
          <View style={styles.privacyCard}>
            <LinearGradient
              colors={[COLORS.orange, COLORS.pink]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.lockBadge}
            >
              <Lock size={12} color={COLORS.textPrimary} strokeWidth={2.5} />
            </LinearGradient>
            <View style={styles.privacyText}>
              <Text style={styles.privacyTitle} allowFontScaling={false}>
                {t("Your numbers are never shared")}
              </Text>
              <Text style={styles.privacySub} allowFontScaling={false}>
                {t("We only check who's on Sawa")}
              </Text>
            </View>
          </View>

          <View style={styles.flex} />

          {/* Bottom CTAs */}
          <View style={styles.bottom}>
            <Animated.View style={{ transform: [{ scale: pressScale }] }}>
              <Pressable
                onPress={handleAllow}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel={t("Allow Access to Contacts")}
                testID="contacts-allow"
              >
                <LinearGradient
                  colors={[COLORS.orange, COLORS.pink]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={[styles.button, submitting && styles.buttonDisabled]}
                >
                  <Text style={styles.buttonText} allowFontScaling={false}>
                    {t("Allow Access to Contacts")}
                  </Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>

            <Pressable
              onPress={handleSkip}
              accessibilityRole="button"
              accessibilityLabel={t("Not Now")}
              testID="contacts-skip"
              style={styles.skipBtn}
            >
              <Text style={styles.skipText} allowFontScaling={false}>
                {t("Not Now")}
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
  backRow: {
    height: 44,
    justifyContent: "center",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
  },
  content: {
    flex: 1,
  },
  illusWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  illusGlow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: COLORS.pink,
    opacity: 0.25,
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
  privacyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 28,
    gap: 12,
  },
  lockBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  privacyText: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  privacySub: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textSecondary,
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
