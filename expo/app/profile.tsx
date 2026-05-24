import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Camera, Plus } from "lucide-react-native";
import React, { useRef, useState } from "react";
import { useT } from "@/constants/i18n";
import { useAuth } from "@/constants/auth";
import { uploadPhoto } from "@/lib/upload";
import {
  Animated,
  Image,
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

const NAME_MAX = 30 as const;

export default function ProfileScreen() {
  const t = useT();
  const { saveProfile, hasSupabase, user } = useAuth();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [name, setName] = useState<string>("");
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pressScale = useRef(new Animated.Value(1)).current;
  const nameInputRef = useRef<TextInput>(null);

  const trimmedName = name.trim();
  const isReady = photoUri !== null && trimmedName.length > 0;

  const handlePickPhoto = async () => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (!result.canceled && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (e) {
      console.log("[profile] photo pick failed", e);
    }
  };

  const handlePressIn = () => {
    if (!isReady) return;
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
    if (!isReady || submitting) return;
    Keyboard.dismiss();
    setErrorMsg(null);

    if (!hasSupabase || !user) {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      router.replace("/home");
      return;
    }

    setSubmitting(true);
    try {
      let avatarUrl: string | null = null;
      if (photoUri) {
        avatarUrl = await uploadPhoto(photoUri, `avatars/${user.id}`);
      }
      const res = await saveProfile({ name: trimmedName, avatarUrl });
      if (!res.ok) {
        console.log("[profile] save failed", res.error);
        setErrorMsg(res.error ?? t("ما قدرنا نحفظ الملف، جرّب مرة تانية"));
        setSubmitting(false);
        return;
      }
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      router.replace("/home");
    } catch (e) {
      console.log("[profile] upload failed", e);
      const msg = e instanceof Error ? e.message : t("ما قدرنا نحفظ الملف، جرّب مرة تانية");
      setErrorMsg(msg);
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.glowOrange} />
      <View pointerEvents="none" style={styles.glowPink} />
      <View pointerEvents="none" style={styles.glowPurple} />

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        {/* Progress (step 2 of 2) */}
        <View style={styles.progressRow}>
          <View style={styles.progressSegment}>
            <LinearGradient
              colors={[COLORS.orange, COLORS.pink]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <View style={styles.progressSegment}>
            <LinearGradient
              colors={[COLORS.orange, COLORS.pink]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        </View>

        <View style={styles.header}>
          <Text style={styles.headerTitle} allowFontScaling={false}>
            {t("عرّف عن نفسك")}
          </Text>
          <Text style={styles.headerSubtitle} allowFontScaling={false}>
            {t("بدنا نعرف مين أنت")}
          </Text>
        </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.flex}
          >
            <View style={styles.content}>
              {/* Profile photo */}
              <View style={styles.photoWrap}>
                <Pressable
                  onPress={handlePickPhoto}
                  accessibilityRole="button"
                  accessibilityLabel={t("اختر صورتك")}
                  testID="profile-photo"
                >
                  <LinearGradient
                    colors={[COLORS.orange, COLORS.pink]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.photoBorder}
                  >
                    <View style={styles.photoInner}>
                      {photoUri ? (
                        <Image
                          source={{ uri: photoUri }}
                          style={styles.photoImage}
                        />
                      ) : (
                        <Camera
                          size={32}
                          color={COLORS.textSecondary}
                          strokeWidth={2}
                        />
                      )}
                    </View>
                  </LinearGradient>

                  <View style={styles.plusBadgeWrap} pointerEvents="none">
                    <LinearGradient
                      colors={[COLORS.orange, COLORS.pink]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.plusBadge}
                    >
                      <Plus size={14} color={COLORS.textPrimary} strokeWidth={3} />
                    </LinearGradient>
                  </View>
                </Pressable>
              </View>

              {/* Name input */}
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel} allowFontScaling={false}>
                  {t("اسمك")}
                </Text>
                <Pressable
                  onPress={() => nameInputRef.current?.focus()}
                  style={[
                    styles.inputField,
                    isFocused && styles.inputFieldFocused,
                  ]}
                >
                  <TextInput
                    ref={nameInputRef}
                    value={name}
                    onChangeText={(t) => setName(t.slice(0, NAME_MAX))}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder={t("مثلاً: رالف")}
                    placeholderTextColor={COLORS.textSecondary}
                    selectionColor={COLORS.orange}
                    keyboardAppearance="dark"
                    style={styles.input}
                    maxLength={NAME_MAX}
                    testID="profile-name"
                    allowFontScaling={false}
                    autoCorrect={false}
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                    textAlign={Platform.OS === "android" ? "right" : undefined}
                  />
                </Pressable>
                <Text style={styles.charCount} allowFontScaling={false}>
                  {`${trimmedName.length}/${NAME_MAX}`}
                </Text>
              </View>

              {errorMsg && (
                <Text style={styles.errorText} allowFontScaling={false}>
                  {errorMsg}
                </Text>
              )}

              <View style={styles.flex} />

              {/* Bottom CTA */}
              <View style={styles.bottom}>
                <Animated.View style={{ transform: [{ scale: pressScale }] }}>
                  <Pressable
                    onPress={handleSubmit}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    disabled={!isReady || submitting}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !isReady }}
                    accessibilityLabel={t("هيا نبدأ")}
                    testID="profile-submit"
                  >
                    <LinearGradient
                      colors={[COLORS.orange, COLORS.pink]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={[
                        styles.button,
                        !isReady && styles.buttonDisabled,
                      ]}
                    >
                      <Text style={styles.buttonText} allowFontScaling={false}>
                        {submitting ? t("جاري الحفظ…") : t("هيا نبدأ 🎉")}
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
  progressRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    overflow: "hidden",
  },
  header: {
    alignItems: "center",
    marginTop: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textPrimary,
    textAlign: "center",
    writingDirection: "rtl",
  },
  headerSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    writingDirection: "rtl",
  },
  content: {
    flex: 1,
    paddingTop: 8,
  },
  photoWrap: {
    alignItems: "center",
    marginTop: 32,
  },
  photoBorder: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.pink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  photoInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photoImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  plusBadgeWrap: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    padding: 3,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  plusBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  inputBlock: {
    marginTop: 32,
  },
  inputLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "right",
    writingDirection: "rtl",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  inputField: {
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  inputFieldFocused: {
    borderColor: COLORS.orange,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  input: {
    color: COLORS.textPrimary,
    fontSize: 16,
    textAlign: "right",
    writingDirection: Platform.OS === "ios" ? "rtl" : "auto",
    paddingVertical: 0,
    height: "100%",
  },
  charCount: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "right",
    paddingHorizontal: 4,
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
    opacity: 0.4,
  },
  buttonText: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: "800",
  },
  errorText: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.orange,
    textAlign: "center",
    writingDirection: "rtl",
  },
});
