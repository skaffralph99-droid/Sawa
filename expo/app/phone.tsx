import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChevronLeft } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/constants/i18n";
import { useAuth } from "@/constants/auth";
import { supabase } from "@/lib/supabase";
import {
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
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

function formatLocalNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const parts: string[] = [];
  if (digits.length > 0) parts.push(digits.slice(0, 2));
  if (digits.length > 2) parts.push(digits.slice(2, 5));
  if (digits.length > 5) parts.push(digits.slice(5, 8));
  return parts.join(" ");
}

type ExistingUser = {
  id: string;
  name: string | null;
  avatar_url: string | null;
};

export default function PhoneScreen() {
  const t = useT();
  const { sendOtp, hasSupabase } = useAuth();
  const [value, setValue] = useState<string>("");
  const [focused, setFocused] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState<boolean>(false);
  const [existingUser, setExistingUser] = useState<ExistingUser | null>(null);
  const [checkedPhone, setCheckedPhone] = useState<string>("");
  const pressScale = useRef(new Animated.Value(1)).current;
  const inputRef = useRef<TextInput>(null);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, []);

  const digits = useMemo<string>(() => value.replace(/\D/g, ""), [value]);
  const isValid = digits.length >= 7;
  const phoneE164 = `+961${digits}`;

  // Check phone existence after user finishes typing (debounced)
  useEffect(() => {
    if (checkTimer.current) clearTimeout(checkTimer.current);

    if (digits.length < 7) {
      setExistingUser(null);
      setCheckedPhone("");
      setChecking(false);
      return;
    }

    if (phoneE164 === checkedPhone) return;

    setChecking(true);
    setExistingUser(null);
    setErrorMsg(null);

    checkTimer.current = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id, name, avatar_url")
          .eq("phone", phoneE164)
          .not("name", "is", null)
          .maybeSingle();

        setExistingUser(data as ExistingUser | null);
        setCheckedPhone(phoneE164);
      } catch {
        setExistingUser(null);
      } finally {
        setChecking(false);
      }
    }, 600);

    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, [digits]);

  const onChange = (next: string) => setValue(formatLocalNumber(next));

  const handlePressIn = () => {
    if (!isValid) return;
    Animated.spring(pressScale, { toValue: 0.97, useNativeDriver: true, friction: 7 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
  };

  const handleSubmit = async () => {
    if (!isValid || submitting || checking) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Keyboard.dismiss();
    setErrorMsg(null);

    if (!hasSupabase) {
      const demoCode = Math.floor(100000 + Math.random() * 900000).toString();
      router.push({ pathname: "/otp", params: { phone: digits, code: demoCode, isReturning: existingUser ? "1" : "0" } });
      return;
    }

    setSubmitting(true);
    const res = await sendOtp(phoneE164);
    setSubmitting(false);

    if (!res.ok) {
      setErrorMsg(res.error ?? t("ما قدرنا نبعت الرمز، جرّب مرة تانية"));
      return;
    }

    router.push({
      pathname: "/otp",
      params: {
        phone: digits,
        isReturning: existingUser ? "1" : "0",
      },
    });
  };

  const handleBack = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    try { router.back(); } catch { router.replace("/"); }
  };

  const isReturning = !!existingUser && checkedPhone === phoneE164 && !checking;
  const showChecking = checking && digits.length >= 7;

  const buttonLabel = submitting
    ? t("جاري الإرسال…")
    : isReturning
      ? t("أرسل رمز الدخول")
      : t("إرسال الرمز");

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.glowOrange} />
      <View pointerEvents="none" style={styles.glowPink} />

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn} accessibilityRole="button">
            <ChevronLeft size={24} color={COLORS.textPrimary} strokeWidth={2.5} />
          </Pressable>
          <Text style={styles.headerTitle} allowFontScaling={false}>
            {t("رقم هاتفك")}
          </Text>
          <View style={styles.backBtn} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.headlineWrap}>
              {/* Dynamic headline based on state */}
              {isReturning ? (
                <>
                  <Text style={styles.headline} allowFontScaling={false}>
                    {t("أهلاً وسهلاً! 👋")}
                  </Text>
                  {/* User avatar + name card */}
                  <View style={styles.returningCard}>
                    <View style={styles.returningAvatarWrap}>
                      {existingUser?.avatar_url ? (
                        <Image source={{ uri: existingUser.avatar_url }} style={styles.returningAvatar} />
                      ) : (
                        <LinearGradient
                          colors={[COLORS.orange, COLORS.pink]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.returningAvatar}
                        >
                          <Text style={styles.returningInitial} allowFontScaling={false}>
                            {(existingUser?.name ?? "?").charAt(0).toUpperCase()}
                          </Text>
                        </LinearGradient>
                      )}
                    </View>
                    <View>
                      <Text style={styles.returningName} allowFontScaling={false}>
                        {existingUser?.name ?? ""}
                      </Text>
                      <Text style={styles.returningHint} allowFontScaling={false}>
                        {t("رح نبعتلك رمز لتدخل على حسابك")}
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.headline} allowFontScaling={false}>
                    {t("شو رقمك؟")}
                  </Text>
                  <Text style={styles.subtitle}>{t("رح نبعتلك رمز تحقق")}</Text>
                </>
              )}

              {/* Phone input */}
              <Pressable
                onPress={() => inputRef.current?.focus()}
                style={[styles.inputWrap, focused && styles.inputWrapFocused]}
              >
                <View style={styles.countryBox} pointerEvents="none">
                  <Text style={styles.flag} allowFontScaling={false}>🇱🇧</Text>
                  <Text style={styles.dial} allowFontScaling={false}>+961</Text>
                </View>
                <View style={styles.separator} pointerEvents="none" />
                <TextInput
                  ref={inputRef}
                  value={value}
                  onChangeText={onChange}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="XX XXX XXX"
                  placeholderTextColor="#5A5872"
                  keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
                  keyboardAppearance="dark"
                  inputMode="numeric"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  autoFocus
                  style={styles.input}
                  maxLength={10}
                  textAlign="left"
                  selectionColor={COLORS.orange}
                  testID="phone-input"
                />
                {/* Checking spinner inside input */}
                {showChecking && (
                  <ActivityIndicator
                    size="small"
                    color={COLORS.orange}
                    style={{ marginLeft: 8 }}
                  />
                )}
              </Pressable>

              {/* Error message */}
              {errorMsg && (
                <Text style={styles.errorText} allowFontScaling={false}>
                  {errorMsg}
                </Text>
              )}

              {/* "New here?" hint when not returning */}
              {isValid && !checking && !isReturning && checkedPhone === phoneE164 && (
                <Text style={styles.newHint} allowFontScaling={false}>
                  {t("رقم جديد — رح نسجّلك على Sawa ✨")}
                </Text>
              )}
            </View>

            <View style={styles.flex} />

            {/* CTA */}
            <View style={styles.bottom}>
              <Animated.View style={{ transform: [{ scale: pressScale }] }}>
                <Pressable
                  onPress={handleSubmit}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  disabled={!isValid || submitting || checking}
                  accessibilityRole="button"
                  testID="phone-submit"
                >
                  <LinearGradient
                    colors={[COLORS.orange, COLORS.pink]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={[styles.button, (!isValid || checking) && styles.buttonDisabled]}
                  >
                    <Text style={styles.buttonText} allowFontScaling={false}>
                      {buttonLabel}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </Animated.View>
              <Text style={styles.reassure}>{t("ما رح نبعتلك أي شي تاني")}</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg, overflow: "hidden" },
  flex: { flex: 1 },
  glowOrange: {
    position: "absolute", top: -120, left: -100,
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: COLORS.orange, opacity: 0.12,
  },
  glowPink: {
    position: "absolute", top: -60, right: -120,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: COLORS.pink, opacity: 0.1,
  },
  safe: { flex: 1, paddingHorizontal: 24 },
  header: {
    height: 48, flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginTop: 4,
  },
  backBtn: { width: 40, height: 40, alignItems: "flex-start", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary, textAlign: "center" },
  content: { flexGrow: 1, paddingTop: 24 },
  headlineWrap: { alignItems: "flex-end" },
  headline: {
    fontSize: 28, fontWeight: "800", color: COLORS.textPrimary,
    marginBottom: 8, textAlign: "right", writingDirection: "rtl",
  },
  subtitle: {
    fontSize: 15, color: COLORS.textSecondary,
    textAlign: "right", writingDirection: "rtl",
  },

  // Returning user card
  returningCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    width: "100%",
  },
  returningAvatarWrap: {
    width: 52, height: 52, borderRadius: 26, overflow: "hidden",
  },
  returningAvatar: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: "center", justifyContent: "center",
  },
  returningInitial: {
    color: "#fff", fontSize: 22, fontWeight: "800",
  },
  returningName: {
    color: COLORS.textPrimary, fontSize: 17, fontWeight: "800",
    textAlign: "right", writingDirection: "rtl",
  },
  returningHint: {
    color: COLORS.textSecondary, fontSize: 13,
    textAlign: "right", writingDirection: "rtl", marginTop: 2,
  },

  inputWrap: {
    marginTop: 24, width: "100%", height: 60,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 16, paddingHorizontal: 16,
    flexDirection: "row", alignItems: "center",
  },
  inputWrapFocused: {
    borderColor: COLORS.orange,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55, shadowRadius: 14, elevation: 8,
  },
  countryBox: { flexDirection: "row", alignItems: "center", paddingRight: 12 },
  flag: { fontSize: 20, marginRight: 8 },
  dial: { fontSize: 16, color: COLORS.textPrimary, fontWeight: "600" },
  separator: { width: 1, height: 28, backgroundColor: COLORS.border, marginRight: 12 },
  input: {
    flex: 1, color: COLORS.textPrimary, fontSize: 18,
    fontWeight: "600", letterSpacing: 1, paddingVertical: 0, writingDirection: "ltr",
  },
  newHint: {
    marginTop: 10, fontSize: 13, color: COLORS.orange,
    textAlign: "right", writingDirection: "rtl",
  },
  bottom: { width: "100%", paddingBottom: 8 },
  button: {
    height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center",
    shadowColor: COLORS.pink, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 20, elevation: 10,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: COLORS.textPrimary, fontSize: 17, fontWeight: "800" },
  reassure: {
    fontSize: 12, color: COLORS.textSecondary,
    textAlign: "center", marginTop: 12,
  },
  errorText: {
    marginTop: 12, fontSize: 13, color: COLORS.orange,
    textAlign: "right", writingDirection: "rtl",
  },
});
