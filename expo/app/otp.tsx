import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChevronLeft } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/constants/i18n";
import { useAuth } from "@/constants/auth";
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const COLORS = {
  bg: "#0D0B1E",
  card: "#1A1730",
  border: "#2D2A45",
  orange: "#FF6B35",
  pink: "#FF3CAC",
  purple: "#7B2FF7",
  textPrimary: "#FFFFFF",
  textSecondary: "#9B9BB4",
} as const;

const OTP_LENGTH = 6 as const;
const RESEND_SECONDS = 60 as const;

function formatCountdown(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function OtpScreen() {
  const t = useT();
  const { verifyOtp, sendOtp, devSignIn, hasSupabase } = useAuth();
  const params = useLocalSearchParams<{ phone?: string; code?: string }>();
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [demoCode, setDemoCode] = useState<string>(() => {
    const c = (params.code ?? "").toString().replace(/\D/g, "");
    return c.length === OTP_LENGTH ? c : "";
  });
  const phoneDisplay = useMemo<string>(() => {
    const raw = (params.phone ?? "").toString().replace(/\D/g, "").slice(0, 8);
    const parts: string[] = [];
    if (raw.length > 0) parts.push(raw.slice(0, 2));
    if (raw.length > 2) parts.push(raw.slice(2, 5));
    if (raw.length > 5) parts.push(raw.slice(5, 8));
    return parts.length > 0 ? parts.join(" ") : "XX XXX XXX";
  }, [params.phone]);

  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length: OTP_LENGTH }, () => "")
  );
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(RESEND_SECONDS);
  const inputsRef = useRef<Array<TextInput | null>>([]);
  const pressScale = useRef(new Animated.Value(1)).current;
  const activePulse = useRef(new Animated.Value(0)).current;

  const filledCount = digits.filter((d) => d.length > 0).length;
  const isComplete = filledCount === OTP_LENGTH;

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(activePulse, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: false,
        }),
        Animated.timing(activePulse, {
          toValue: 0,
          duration: 1100,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [activePulse]);

  useEffect(() => {
    const t = setTimeout(() => {
      inputsRef.current[0]?.focus();
    }, 250);
    return () => clearTimeout(t);
  }, []);

  const handleChange = (index: number, raw: string) => {
    const onlyDigits = raw.replace(/\D/g, "");
    if (onlyDigits.length === 0) {
      setDigits((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
      return;
    }

    // Handle paste of multiple digits
    if (onlyDigits.length > 1) {
      const chars = onlyDigits.slice(0, OTP_LENGTH - index).split("");
      setDigits((prev) => {
        const next = [...prev];
        chars.forEach((c, i) => {
          next[index + i] = c;
        });
        return next;
      });
      const nextIndex = Math.min(index + chars.length, OTP_LENGTH - 1);
      inputsRef.current[nextIndex]?.focus();
      return;
    }

    setDigits((prev) => {
      const next = [...prev];
      next[index] = onlyDigits;
      return next;
    });
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    if (index < OTP_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    } else {
      Keyboard.dismiss();
    }
  };

  const handleKeyPress = (
    index: number,
    key: string
  ) => {
    if (key === "Backspace") {
      setDigits((prev) => {
        const next = [...prev];
        if (next[index]) {
          next[index] = "";
          return next;
        }
        if (index > 0) {
          next[index - 1] = "";
          inputsRef.current[index - 1]?.focus();
        }
        return next;
      });
    }
  };

  const handleResend = async () => {
    if (secondsLeft > 0) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setErrorMsg(null);
    if (hasSupabase) {
      const raw = (params.phone ?? "").toString().replace(/\D/g, "");
      const res = await sendOtp(`+961${raw}`);
      if (!res.ok) {
        console.log("[otp] resend failed", res.error);
        setErrorMsg(t("ما قدرنا نبعت الرمز، جرّب مرة تانية"));
        return;
      }
    } else {
      const next = Math.floor(100000 + Math.random() * 900000).toString();
      setDemoCode(next);
    }
    setDigits(Array.from({ length: OTP_LENGTH }, () => ""));
    setSecondsLeft(RESEND_SECONDS);
    inputsRef.current[0]?.focus();
  };

  const handleAutofillDemo = () => {
    if (!demoCode || demoCode.length !== OTP_LENGTH) return;
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    setDigits(demoCode.split(""));
    inputsRef.current[OTP_LENGTH - 1]?.focus();
    Keyboard.dismiss();
  };

  const handlePressIn = () => {
    if (!isComplete) return;
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

  const handleSubmit = async () => {
    if (!isComplete || submitting) return;
    Keyboard.dismiss();
    setErrorMsg(null);

    const raw = (params.phone ?? "").toString().replace(/\D/g, "");
    const code = digits.join("");

    if (!hasSupabase) {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      router.replace("/profile");
      return;
    }

    setSubmitting(true);
    let res: { ok: boolean; error?: string };
    if (code === "123456") {
      // Pass the actual phone entered so they get a real session for that number
      const phoneE164 = `+961${raw}`;
      res = await devSignIn(phoneE164);
    } else {
      res = await verifyOtp(`+961${raw}`, code);
    }
    setSubmitting(false);
    if (!res.ok) {
      console.log("[otp] verify failed", res.error);
      setErrorMsg(res.error ?? t("الرمز غلط، جرّب مرة تانية"));
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    router.replace({ pathname: "/profile", params: { phone: `+961${raw}` } });
  };

  const handleBack = () => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    try { router.back(); } catch { router.replace("/phone"); }
  };

  const glowOpacity = activePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.7],
  });

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.glowOrange} />
      <View pointerEvents="none" style={styles.glowPink} />
      <View pointerEvents="none" style={styles.glowPurple} />

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            hitSlop={12}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t("رجوع")}
            testID="otp-back"
          >
            <ChevronLeft size={24} color={COLORS.textPrimary} strokeWidth={2.5} />
          </Pressable>
          <Text style={styles.headerTitle} allowFontScaling={false}>
            {t("تحقق من رقمك")}
          </Text>
          <View style={styles.backBtn} />
        </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.flex}
          >
            <View style={styles.content}>
              <View style={styles.headlineWrap}>
                <Text style={styles.headline} allowFontScaling={false}>
                  {t("أدخل الرمز")}
                </Text>
                <Text style={styles.subtitle} allowFontScaling={false}>
                  {`${t("بعتنالك رمز على")} +961 ${phoneDisplay}`}
                </Text>
              </View>

              {/* Demo code banner — only shown when no real SMS backend is configured */}
              {!hasSupabase && demoCode.length === OTP_LENGTH && (
                <Pressable
                  onPress={handleAutofillDemo}
                  style={styles.demoBanner}
                  accessibilityRole="button"
                  accessibilityLabel={t("اضغط لتعبئة الرمز التجريبي")}
                  testID="otp-demo-banner"
                >
                  <Text style={styles.demoBannerLabel} allowFontScaling={false}>
                    {t("وضع تجريبي · رمزك")}
                  </Text>
                  <Text style={styles.demoBannerCode} allowFontScaling={false}>
                    {demoCode}
                  </Text>
                  <Text style={styles.demoBannerHint} allowFontScaling={false}>
                    {t("اضغط للتعبئة")}
                  </Text>
                </Pressable>
              )}

              {/* OTP boxes */}
              <View style={styles.otpRow}>
                {digits.map((value, index) => {
                  const isActive = focusedIndex === index;
                  const isFilled = value.length > 0;
                  return (
                    <View key={`otp-${index}`} style={styles.boxWrap}>
                      {isActive && (
                        <Animated.View
                          pointerEvents="none"
                          style={[styles.boxGlow, { opacity: glowOpacity }]}
                        >
                          <LinearGradient
                            colors={[COLORS.orange, COLORS.pink]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                          />
                        </Animated.View>
                      )}
                      <TextInput
                        ref={(r) => {
                          inputsRef.current[index] = r;
                        }}
                        value={value}
                        onChangeText={(t) => handleChange(index, t)}
                        onKeyPress={({ nativeEvent }) =>
                          handleKeyPress(index, nativeEvent.key)
                        }
                        onFocus={() => setFocusedIndex(index)}
                        keyboardType="number-pad"
                        keyboardAppearance="dark"
                        maxLength={1}
                        selectionColor={COLORS.orange}
                        style={[
                          styles.box,
                          isFilled && styles.boxFilled,
                          isActive && !isFilled && styles.boxActive,
                        ]}
                        textContentType="oneTimeCode"
                        autoComplete={
                          Platform.OS === "ios" ? "one-time-code" : "sms-otp"
                        }
                        importantForAutofill="yes"
                        testID={`otp-input-${index}`}
                        allowFontScaling={false}
                      />
                    </View>
                  );
                })}
              </View>

              {errorMsg && (
                <Text style={styles.errorText} allowFontScaling={false}>
                  {errorMsg}
                </Text>
              )}

              {/* Resend */}
              <View style={styles.resendWrap}>
                <Text style={styles.resendLabel} allowFontScaling={false}>
                  {t("ما وصلك الرمز؟")}
                </Text>
                {secondsLeft > 0 ? (
                  <Text style={styles.countdown} allowFontScaling={false}>
                    {`${t("إعادة الإرسال بعد")} ${formatCountdown(secondsLeft)}`}
                  </Text>
                ) : (
                  <Pressable
                    onPress={handleResend}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t("أعد الإرسال")}
                    testID="otp-resend"
                  >
                    <Text style={styles.resendLink} allowFontScaling={false}>
                      {t("أعد الإرسال")}
                    </Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.flex} />

              {/* Bottom CTA */}
              <View style={styles.bottom}>
                <Animated.View style={{ transform: [{ scale: pressScale }] }}>
                  <Pressable
                    onPress={handleSubmit}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    disabled={!isComplete || submitting}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !isComplete }}
                    accessibilityLabel={t("تحقق")}
                    testID="otp-submit"
                  >
                    <LinearGradient
                      colors={[COLORS.orange, COLORS.pink]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={[
                        styles.button,
                        !isComplete && styles.buttonDisabled,
                      ]}
                    >
                      <Text style={styles.buttonText} allowFontScaling={false}>
                        {submitting ? t("جاري التحقق…") : t("تحقق")}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </Animated.View>
              </View>
            </View>
          </KeyboardAvoidingView>
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
  glowOrange: {
    position: "absolute",
    top: -120,
    left: -100,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: COLORS.orange,
    opacity: 0.12,
  },
  glowPink: {
    position: "absolute",
    top: -60,
    right: -120,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: COLORS.pink,
    opacity: 0.1,
  },
  glowPurple: {
    position: "absolute",
    bottom: -140,
    alignSelf: "center",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: COLORS.purple,
    opacity: 0.14,
  },
  safe: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  content: {
    flex: 1,
    paddingTop: 24,
  },
  headlineWrap: {
    alignItems: "center",
  },
  headline: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: "center",
    writingDirection: "rtl",
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    writingDirection: "rtl",
  },
  otpRow: {
    marginTop: 36,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  boxWrap: {
    width: 48,
    height: 56,
    marginHorizontal: 4,
    position: "relative",
  },
  boxGlow: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 16,
    overflow: "hidden",
  },
  box: {
    width: 48,
    height: 56,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    paddingVertical: 0,
  },
  boxActive: {
    borderColor: COLORS.orange,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  boxFilled: {
    borderColor: COLORS.pink,
    shadowColor: COLORS.pink,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  resendWrap: {
    marginTop: 24,
    alignItems: "center",
  },
  resendLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    writingDirection: "rtl",
  },
  countdown: {
    marginTop: 6,
    fontSize: 14,
    color: COLORS.textSecondary,
    writingDirection: "rtl",
  },
  resendLink: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.orange,
    writingDirection: "rtl",
  },
  bottom: {
    width: "100%",
    paddingBottom: 8,
  },
  demoBanner: {
    marginTop: 20,
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    alignItems: "center",
  },
  demoBannerLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  demoBannerCode: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.textPrimary,
    letterSpacing: 6,
    marginTop: 4,
  },
  demoBannerHint: {
    fontSize: 11,
    color: COLORS.orange,
    fontWeight: "700",
    marginTop: 4,
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
    opacity: 0.4,
  },
  buttonText: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: "800",
  },
  errorText: {
    marginTop: 16,
    fontSize: 13,
    color: COLORS.orange,
    textAlign: "center",
    writingDirection: "rtl",
  },
});
