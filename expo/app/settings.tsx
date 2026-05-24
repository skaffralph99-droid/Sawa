import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  Bell,
  ChevronLeft,
  HelpCircle,
  Languages,
  LogOut,
  Lock,
  Share2,
  Star,
  Stethoscope,
  Trash2,
  UserCircle2,
} from "lucide-react-native";
import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useLang } from "@/constants/i18n";
import { useAuth } from "@/constants/auth";

const PROFILE_PHOTO_URL =
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=400&fit=crop&crop=faces";

type RowProps = {
  icon: React.ReactNode;
  label: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  labelColor?: string;
  isLast?: boolean;
};

function PressableScale({
  onPress,
  children,
  style,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  style?: any;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = useCallback(() => {
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, friction: 7, tension: 200 }).start();
  }, [scale]);
  const onOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 180 }).start();
  }, [scale]);
  const handle = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    onPress?.();
  }, [onPress]);
  return (
    <Pressable onPressIn={onIn} onPressOut={onOut} onPress={handle}>
      <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}

function GradientIcon({ children }: { children: (color: string) => React.ReactNode }) {
  return (
    <View style={iconStyles.wrap}>
      <LinearGradient
        colors={[Colors.primary, Colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={iconStyles.bg}
      >
        <View style={iconStyles.inner}>{children("#FFFFFF")}</View>
      </LinearGradient>
    </View>
  );
}

const iconStyles = StyleSheet.create({
  wrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    overflow: "hidden",
  },
  bg: { flex: 1, alignItems: "center", justifyContent: "center" },
  inner: { alignItems: "center", justifyContent: "center" },
});

function LangSwitch({
  value,
  onChange,
}: {
  value: "en" | "ar";
  onChange: (v: "en" | "ar") => void;
}) {
  const handle = useCallback(
    (next: "en" | "ar") => {
      if (next === value) return;
      if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
      onChange(next);
    },
    [value, onChange]
  );

  return (
    <View style={langStyles.wrap}>
      <Pressable
        onPress={() => handle("en")}
        hitSlop={6}
        style={langStyles.segment}
      >
        {value === "en" ? (
          <LinearGradient
            colors={[Colors.primary, Colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <Text
          style={[
            langStyles.label,
            value === "en" ? langStyles.labelOn : langStyles.labelOff,
          ]}
        >
          EN
        </Text>
      </Pressable>
      <Pressable
        onPress={() => handle("ar")}
        hitSlop={6}
        style={langStyles.segment}
      >
        {value === "ar" ? (
          <LinearGradient
            colors={[Colors.primary, Colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <Text
          style={[
            langStyles.label,
            value === "ar" ? langStyles.labelOn : langStyles.labelOff,
          ]}
        >
          ع
        </Text>
      </Pressable>
    </View>
  );
}

const langStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: "#2D2A45",
    borderRadius: 12,
    padding: 2,
    height: 28,
  },
  segment: {
    minWidth: 34,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  label: {
    fontSize: 12,
    fontWeight: "800" as const,
    letterSpacing: 0.4,
  },
  labelOn: { color: "#FFFFFF" },
  labelOff: { color: "#9B9BB4" },
});

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.spring(anim, {
      toValue: value ? 1 : 0,
      useNativeDriver: false,
      friction: 8,
      tension: 140,
    }).start();
  }, [value, anim]);

  const translate = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });

  const handle = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    onChange(!value);
  }, [value, onChange]);

  return (
    <Pressable onPress={handle} hitSlop={8} style={toggleStyles.outer}>
      {value ? (
        <LinearGradient
          colors={[Colors.primary, Colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "#2D2A45" }]} />
      )}
      <Animated.View style={[toggleStyles.thumb, { transform: [{ translateX: translate }] }]} />
    </Pressable>
  );
}

const toggleStyles = StyleSheet.create({
  outer: {
    width: 46,
    height: 26,
    borderRadius: 13,
    overflow: "hidden",
    justifyContent: "center",
  },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
});

function Row({ icon, label, trailing, onPress, labelColor, isLast }: RowProps) {
  return (
    <PressableScale onPress={onPress}>
      <View style={[styles.row, isLast ? null : styles.rowBorder]}>
        <View style={styles.rowTrailing}>{trailing}</View>
        <View style={styles.rowMain}>
          <Text style={[styles.rowLabel, labelColor ? { color: labelColor } : null]}>{label}</Text>
          {icon}
        </View>
      </View>
    </PressableScale>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function Chevron() {
  return (
    <View style={styles.chev}>
      <ChevronLeft size={18} color={Colors.textMuted} strokeWidth={2.4} />
    </View>
  );
}

export default function SettingsScreen() {
  const { t, lang, setLang } = useLang();
  const { signOut } = useAuth();
  const [notifications, setNotifications] = useState<boolean>(true);
  const [timelinePrivate, setTimelinePrivate] = useState<boolean>(false);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.headerSide}
            hitSlop={12}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
              router.back();
            }}
          >
            <ChevronLeft size={26} color={Colors.text} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.headerTitle}>{t("الإعدادات")}</Text>
          <View style={styles.headerSide} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Profile card */}
          <View style={styles.profileCard}>
            <Pressable
              hitSlop={8}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
              }}
            >
              <LinearGradient
                colors={[Colors.primary, Colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.editPill}
              >
                <View style={styles.editInner}>
                  <Text style={styles.editText}>{t("تعديل")}</Text>
                </View>
              </LinearGradient>
            </Pressable>

            <View style={styles.profileBody}>
              <View style={styles.profileText}>
                <Text style={styles.profileName}>{t("رالف")}</Text>
                <Text style={styles.profilePhone}>+961 71 234 567</Text>
              </View>

              <View style={styles.avatarOuter}>
                <LinearGradient
                  colors={[Colors.primary, Colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarGradient}
                >
                  <View style={styles.avatarInner}>
                    <Image source={{ uri: PROFILE_PHOTO_URL }} style={styles.avatarImg} />
                  </View>
                </LinearGradient>
              </View>
            </View>
          </View>

          {/* SECTION 1 — Account */}
          <SectionTitle>{t("الحساب")}</SectionTitle>
          <View style={styles.sectionCard}>
            <Row
              icon={
                <GradientIcon>
                  {(c) => <UserCircle2 size={16} color={c} strokeWidth={2.3} />}
                </GradientIcon>
              }
              label={t("تعديل الملف الشخصي")}
              trailing={<Chevron />}
              onPress={() => router.push("/profile")}
            />
            <Row
              icon={
                <GradientIcon>
                  {(c) => <Bell size={16} color={c} strokeWidth={2.3} />}
                </GradientIcon>
              }
              label={t("الإشعارات")}
              trailing={<Toggle value={notifications} onChange={setNotifications} />}
            />
            <Row
              icon={
                <GradientIcon>
                  {(c) => <Languages size={16} color={c} strokeWidth={2.3} />}
                </GradientIcon>
              }
              label={t("اللغة")}
              trailing={
                <LangSwitch
                  value={lang}
                  onChange={(v) => setLang(v)}
                />
              }
            />
            <Row
              icon={
                <GradientIcon>
                  {(c) => <Lock size={16} color={c} strokeWidth={2.3} />}
                </GradientIcon>
              }
              label={t("خصوصية التايم لاين")}
              trailing={<Toggle value={timelinePrivate} onChange={setTimelinePrivate} />}
              isLast
            />
          </View>

          {/* SECTION — Developer */}
          <SectionTitle>{t("المطور")}</SectionTitle>
          <View style={styles.sectionCard}>
            <Row
              icon={
                <GradientIcon>
                  {(c) => <Stethoscope size={16} color={c} strokeWidth={2.3} />}
                </GradientIcon>
              }
              label={t("تشخيص Supabase")}
              trailing={<Chevron />}
              onPress={() => router.push("/diagnostics")}
              isLast
            />
          </View>

          {/* SECTION 2 — Support */}
          <SectionTitle>{t("الدعم")}</SectionTitle>
          <View style={styles.sectionCard}>
            <Row
              icon={
                <GradientIcon>
                  {(c) => <HelpCircle size={16} color={c} strokeWidth={2.3} />}
                </GradientIcon>
              }
              label={t("مساعدة")}
              trailing={<Chevron />}
            />
            <Row
              icon={
                <GradientIcon>
                  {(c) => <Star size={16} color={c} strokeWidth={2.3} fill={c} />}
                </GradientIcon>
              }
              label={t("قيّم التطبيق")}
              trailing={<Chevron />}
            />
            <Row
              icon={
                <GradientIcon>
                  {(c) => <Share2 size={16} color={c} strokeWidth={2.3} />}
                </GradientIcon>
              }
              label={t("شارك Sawa")}
              trailing={<Chevron />}
              isLast
            />
          </View>

          {/* SECTION 3 — Account actions */}
          <SectionTitle>{t("الحساب")}</SectionTitle>
          <View style={styles.sectionCard}>
            <Row
              icon={
                <View style={styles.dangerIcon}>
                  <LogOut size={16} color={Colors.primary} strokeWidth={2.3} />
                </View>
              }
              label={t("تسجيل الخروج")}
              labelColor={Colors.primary}
              onPress={async () => {
                if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
                await signOut();
                router.replace("/");
              }}
            />
            <Row
              icon={
                <View style={styles.dangerIcon}>
                  <Trash2 size={16} color={Colors.secondary} strokeWidth={2.3} />
                </View>
              }
              label={t("حذف الحساب")}
              labelColor={Colors.secondary}
              isLast
            />
          </View>

          {/* Version */}
          <Text style={styles.version}>{t("Sawa v1.0 · صنع بـ ❤️ بلبنان")}</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const AVATAR = 56;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  safe: { flex: 1 },

  header: {
    height: 52,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerSide: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "800" as const,
    writingDirection: "rtl",
  },

  scrollContent: { paddingBottom: 40 },

  // Profile card
  profileCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: "#2A2547",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  editPill: {
    borderRadius: 999,
    padding: 1.5,
  },
  editInner: {
    backgroundColor: Colors.card,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "800" as const,
  },
  profileBody: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  profileText: {
    flex: 1,
    alignItems: "flex-end",
  },
  profileName: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "800" as const,
    writingDirection: "rtl",
  },
  profilePhone: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: "600" as const,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  avatarOuter: {
    width: AVATAR + 4,
    height: AVATAR + 4,
    borderRadius: (AVATAR + 4) / 2,
    shadowColor: Colors.secondary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  avatarGradient: {
    width: AVATAR + 4,
    height: AVATAR + 4,
    borderRadius: (AVATAR + 4) / 2,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInner: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    overflow: "hidden",
    backgroundColor: Colors.bg,
    borderWidth: 2,
    borderColor: Colors.card,
  },
  avatarImg: { width: "100%", height: "100%" },

  // Sections
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "800" as const,
    letterSpacing: 1.5,
    textAlign: "right",
    writingDirection: "rtl",
    paddingHorizontal: 24,
    marginTop: 18,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    marginHorizontal: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2A2547",
  },

  // Row
  row: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#2D2A45",
  },
  rowMain: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  rowTrailing: {
    marginLeft: 4,
  },
  rowLabel: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "700" as const,
    writingDirection: "rtl",
    textAlign: "right",
  },
  chev: {
    width: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,107,53,0.10)",
  },

  version: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 28,
    writingDirection: "rtl",
  },
});
