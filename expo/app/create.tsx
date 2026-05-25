import { LinearGradient } from "expo-linear-gradient";
import { router, Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import { X, MapPin, Calendar, Clock, Globe2, Lock, Plus, Minus, ChevronLeft, ChevronRight, Check } from "lucide-react-native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  I18nManager,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useT } from "@/constants/i18n";
import { useAuth } from "@/constants/auth";
import { useLocalPlans } from "@/constants/localPlans";
import { supabase, hasSupabase } from "@/lib/supabase";
import { createPlan } from "@/lib/plans";
import { schedulePlanReal } from "@/lib/planreal";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type ActivityId = "food" | "sport" | "night" | "beach" | "event" | "other";

type Activity = {
  id: ActivityId;
  emoji: string;
  label: string;
};

const ACTIVITIES: Activity[] = [
  { id: "food", emoji: "🍽️", label: "Food" },
  { id: "sport", emoji: "⚽", label: "Sport" },
  { id: "night", emoji: "🛋️", label: "Night out" },
  { id: "beach", emoji: "🏖️", label: "Beach" },
  { id: "event", emoji: "🎉", label: "Event" },
  { id: "other", emoji: "✨", label: "Other" },
];

type Visibility = "public" | "friends";

const MIN_PEOPLE = 3 as const;
const MAX_PEOPLE = 200 as const;

function toArabicNumber(n: number): string {
  return String(n);
}

export default function CreatePlanScreen() {
  const t = useT();
  const { user, profile, mode } = useAuth();
  const queryClient = useQueryClient();
  const { addPlan } = useLocalPlans();
  const [activity, setActivity] = useState<ActivityId | null>(null);
  const [title, setTitle] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState<null | "time" | "date">(null);
  const [maxPeople, setMaxPeople] = useState<number>(10);
  const [visibility, setVisibility] = useState<Visibility>("friends");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  const [planMode, setPlanMode] = useState<"now" | "schedule">("now");

  const friendsQuery = useQuery<FriendRow[]>({
    queryKey: ["friends-for-invite", user?.id ?? null],
    enabled: hasSupabase && mode === "signedIn" && !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("friendships")
        .select("user_id, friend_id, status")
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq("status", "accepted");
      if (error) {
        console.log("[create] friends error", error.message);
        return [];
      }
      const ids = new Set<string>();
      (data ?? []).forEach((row: { user_id: string; friend_id: string }) => {
        const other = row.user_id === user.id ? row.friend_id : row.user_id;
        ids.add(other);
      });
      if (ids.size === 0) return [];
      const { data: profs, error: pErr } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", Array.from(ids));
      if (pErr) {
        console.log("[create] profiles error", pErr.message);
        return [];
      }
      return (profs ?? []) as FriendRow[];
    },
  });
  const friends: FriendRow[] = friendsQuery.data ?? [];

  const haptic = useCallback((kind: "light" | "select" = "light") => {
    if (Platform.OS === "web") return;
    if (kind === "select") {
      Haptics.selectionAsync().catch(() => {});
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, []);

  const toggleInvite = useCallback((id: string) => {
    haptic("select");
    setInvitedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, [haptic]);

  const isReady =
    activity !== null && title.trim().length > 0 && location.trim().length > 0;

  const onClose = useCallback(() => {
    haptic("light");
    try { router.back(); } catch { router.replace("/home"); }
  }, [haptic]);

  const onSubmit = useCallback(async () => {
    if (!isReady || submitting) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    const emoji = ACTIVITIES.find((a) => a.id === activity)?.emoji ?? "✨";
    const creatorName = profile?.name?.trim() || user?.phone || "أنا";
    const creatorInitial = creatorName.charAt(0) || "أ";

    // Guest or no supabase → save locally so it shows in the demo flow
    if (!hasSupabase || !user || mode !== "signedIn") {
      addPlan({
        emoji,
        title: title.trim(),
        location: location.trim(),
        time,
        date,
        maxPeople,
        visibility,
        creatorName,
        creatorInitial,
      });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      router.back();
      return;
    }

    setSubmitting(true);
    try {
      const fullTitle = emoji ? `${emoji} ${title.trim()}` : title.trim();

      const now = new Date();
      const startsAt = planMode === "now" ? now : new Date(now.getTime() + 60 * 60 * 1000);
      const endsAt = planMode === "now" ? new Date(now.getTime() + 3 * 60 * 60 * 1000) : new Date(now.getTime() + 4 * 60 * 60 * 1000);

      const { ok, planId, error } = await createPlan({
        ownerId: user.id,
        title: fullTitle,
        location: location.trim(),
        activityType: activity ?? "other",
        privacy: visibility,
        maxPeople,
        timeLabel: time || undefined,
        dateLabel: date || undefined,
        startsAt,
        endsAt,
      });

      if (!ok || !planId) {
        console.log("[create] createPlan error", error);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        }
        Alert.alert(
          "Couldn't sync to cloud",
          error ?? "The plan was saved on this device but didn't sync to Supabase. Make sure you've run SUPABASE_SETUP.sql.",
        );
        setSubmitting(false);
        router.back();
        return;
      }

      // Invite selected friends as additional members
      if (invitedIds.length > 0) {
        const invites = invitedIds.map((fid) => ({ plan_id: planId, user_id: fid, status: "invited" }));
        const { error: memErr } = await supabase.from("plan_members").insert(invites);
        if (memErr) console.log("[create] plan_members error", memErr.message);
      }

      // Schedule the random PlanReal moment within the plan window
      const sched = await schedulePlanReal(planId, startsAt, endsAt);
      if (!sched.ok) console.log("[create] schedulePlanReal error", sched.error);

      await queryClient.invalidateQueries({ queryKey: ["plans"] });

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      router.back();
    } catch (e) {
      console.log("[create] unexpected error", e);
      setSubmitting(false);
    }
  }, [isReady, submitting, user, profile, mode, activity, title, location, time, date, maxPeople, visibility, queryClient, addPlan, invitedIds]);

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Header onClose={onClose} canPost={isReady} onPost={onSubmit} t={t} />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={8}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Right Now vs Schedule toggle */}
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
              <Pressable
                onPress={() => { haptic("select"); setPlanMode("now"); }}
                style={{
                  flex: 1, height: 52, borderRadius: 16,
                  alignItems: "center", justifyContent: "center",
                  overflow: "hidden",
                  borderWidth: planMode !== "now" ? 1 : 0,
                  borderColor: "#2D2A45",
                  backgroundColor: planMode !== "now" ? "#1A1730" : undefined,
                }}
              >
                {planMode === "now" ? (
                  <LinearGradient
                    colors={["#FF6B35", "#FF3CAC"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{"⚡ Right Now"}</Text>
                  </LinearGradient>
                ) : (
                  <Text style={{ color: "#9B9BB4", fontWeight: "600", fontSize: 15 }}>{"⚡ Right Now"}</Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => { haptic("select"); setPlanMode("schedule"); }}
                style={{
                  flex: 1, height: 52, borderRadius: 16,
                  alignItems: "center", justifyContent: "center",
                  overflow: "hidden",
                  borderWidth: planMode !== "schedule" ? 1 : 0,
                  borderColor: "#2D2A45",
                  backgroundColor: planMode !== "schedule" ? "#1A1730" : undefined,
                }}
              >
                {planMode === "schedule" ? (
                  <LinearGradient
                    colors={["#FF6B35", "#FF3CAC"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{"📅 Schedule"}</Text>
                  </LinearGradient>
                ) : (
                  <Text style={{ color: "#9B9BB4", fontWeight: "600", fontSize: 15 }}>{"📅 Schedule"}</Text>
                )}
              </Pressable>
            </View>
            {planMode === "now" && (
              <View style={{ backgroundColor: "#1A1730", borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <Text style={{ color: "#9B9BB4", fontSize: 13, textAlign: "center" }}>
                  {"🎲 PlanReal will fire within the next 3 hours"}
                </Text>
              </View>
            )}

            {/* Activity selector */}
            <Text style={styles.label}>{"What's the plan?"}</Text>
            <View style={styles.activityGrid}>
              {ACTIVITIES.map((a) => (
                <ActivityTile
                  key={a.id}
                  item={a}
                  selected={activity === a.id}
                  onPress={() => {
                    haptic("select");
                    setActivity(a.id);
                  }}
                  t={t}
                />
              ))}
            </View>

            {/* Title */}
            <Text style={[styles.label, styles.labelTop]}>{"Title"}</Text>
            <FieldBox focused={focusedField === "title"}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                onFocus={() => setFocusedField("title")}
                onBlur={() => setFocusedField(null)}
                placeholder={"e.g. Beach day ☀️"}
                placeholderTextColor={Colors.textDim}
                style={styles.input}
                textAlign="right"
                maxLength={60}
              />
            </FieldBox>

            {/* Location */}
            <Text style={[styles.label, styles.labelTop]}>{"Where?"}</Text>
            <FieldBox focused={focusedField === "location"}>
              <TextInput
                value={location}
                onChangeText={setLocation}
                onFocus={() => setFocusedField("location")}
                onBlur={() => setFocusedField(null)}
                placeholder={"Add a location"}
                placeholderTextColor={Colors.textDim}
                style={[styles.input, styles.inputWithIcon]}
                textAlign="right"
                maxLength={80}
              />
              <View style={styles.fieldIconLeft}>
                <GradientIcon size={22}>
                  <MapPin size={14} color="#FFFFFF" strokeWidth={2.4} />
                </GradientIcon>
              </View>
            </FieldBox>

            {/* Date & Time */}
            <View style={styles.row}>
              <DateTimeField
                style={styles.rowItem}
                label={"Time"}
                value={time}
                placeholder={"4:30 PM"}
                icon={<Clock size={16} color={Colors.textMuted} strokeWidth={2.2} />}
                onPress={() => {
                  haptic("select");
                  setPickerOpen("time");
                }}
              />
              <DateTimeField
                style={styles.rowItem}
                label={"Date"}
                value={date}
                placeholder={"Today"}
                icon={<Calendar size={16} color={Colors.textMuted} strokeWidth={2.2} />}
                onPress={() => {
                  haptic("select");
                  setPickerOpen("date");
                }}
              />
            </View>

            {/* Max people slider */}
            <Text style={[styles.label, styles.labelTop, styles.labelCenter]}>{"Max people"}</Text>
            <View style={styles.stepperRow}>
              <Pressable
                onPress={() => {
                  haptic("select");
                  setMaxPeople((n) => Math.max(MIN_PEOPLE, n - 1));
                }}
                onLongPress={() => {
                  haptic("select");
                  setMaxPeople((n) => Math.max(MIN_PEOPLE, n - 10));
                }}
                hitSlop={12}
                style={({ pressed }) => [styles.stepperBtn, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel={"Decrease"}
              >
                <Minus size={22} color={Colors.text} strokeWidth={2.6} />
              </Pressable>

              <View style={styles.stepperCenter}>
                <Text style={styles.peopleNumber}>
                  {String(maxPeople)} <Text style={styles.peopleUnit}>{"people"}</Text>
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  haptic("select");
                  setMaxPeople((n) => Math.min(MAX_PEOPLE, n + 1));
                }}
                onLongPress={() => {
                  haptic("select");
                  setMaxPeople((n) => Math.min(MAX_PEOPLE, n + 10));
                }}
                hitSlop={12}
                style={({ pressed }) => [styles.stepperBtnPrimary, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
                accessibilityLabel={"Increase"}
              >
                <LinearGradient
                  colors={[Colors.primary, Colors.secondary] as const}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.stepperGradient}
                >
                  <Plus size={24} color="#FFFFFF" strokeWidth={3} />
                </LinearGradient>
              </Pressable>
            </View>
            <PeopleSlider value={maxPeople} onChange={setMaxPeople} />
            <View style={styles.sliderMeta}>
              <Text style={styles.sliderMetaText}>{String(MIN_PEOPLE)}</Text>
              <Text style={styles.sliderMetaText}>{String(MAX_PEOPLE)}</Text>
            </View>

            {/* Invite friends (signed-in + friends-only) */}
            {hasSupabase && mode === "signedIn" && visibility === "friends" && friends.length > 0 ? (
              <>
                <Text style={[styles.label, styles.labelTop]}>{`Invite friends${invitedIds.length > 0 ? ` · ${invitedIds.length}` : ""}`}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.inviteRow}
                >
                  {friends.map((f) => {
                    const selected = invitedIds.includes(f.id);
                    const initial = (f.name ?? "?").charAt(0) || "?";
                    return (
                      <Pressable
                        key={f.id}
                        onPress={() => toggleInvite(f.id)}
                        style={({ pressed }) => [styles.inviteItem, pressed && { opacity: 0.7 }]}
                        accessibilityRole="button"
                      >
                        <View style={styles.inviteAvatarWrap}>
                          <LinearGradient
                            colors={[Colors.primary, Colors.secondary] as const}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                          />
                          <Text style={styles.inviteAvatarText}>{initial}</Text>
                          {selected ? (
                            <View style={styles.inviteCheck}>
                              <Check size={12} color="#fff" strokeWidth={3.2} />
                            </View>
                          ) : null}
                        </View>
                        <Text numberOfLines={1} style={[styles.inviteName, selected && styles.inviteNameSelected]}>
                          {f.name ?? "Friend"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}

            {/* Visibility */}
            <Text style={[styles.label, styles.labelTop]}>{"Who can see?"}</Text>
            <View style={styles.visibilityRow}>
              <VisibilityOption
                selected={visibility === "public"}
                onPress={() => {
                  haptic("select");
                  setVisibility("public");
                }}
                emoji="🌍"
                label={"Public"}
                icon={<Globe2 size={14} color="#FFFFFF" strokeWidth={2.2} />}
              />
              <VisibilityOption
                selected={visibility === "friends"}
                onPress={() => {
                  haptic("select");
                  setVisibility("friends");
                }}
                emoji="🔒"
                label={"Friends only"}
                icon={<Lock size={14} color="#FFFFFF" strokeWidth={2.2} />}
              />
            </View>

            <View style={{ height: 32 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <PickerSheet
        open={pickerOpen !== null}
        mode={pickerOpen ?? "time"}
        currentValue={pickerOpen === "time" ? time : date}
        onClose={() => setPickerOpen(null)}
        onPick={(v) => {
          if (pickerOpen === "time") setTime(v);
          else if (pickerOpen === "date") setDate(v);
          setPickerOpen(null);
        }}
      />
    </View>
  );
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
const WEEKDAY_SHORT = ["S", "M", "T", "W", "T", "F", "S"] as const;

function formatPickedDate(d: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  const sameYear = d.getFullYear() === today.getFullYear();
  const base = `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
  return sameYear ? base : `${base}, ${d.getFullYear()}`;
}

function PickerSheet({
  open,
  mode,
  currentValue,
  onClose,
  onPick,
}: {
  open: boolean;
  mode: "time" | "date";
  currentValue: string;
  onClose: () => void;
  onPick: (v: string) => void;
}) {
  const title = mode === "time" ? "Pick a time" : "Pick a date";
  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetCard} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            {currentValue ? (
              <Pressable
                onPress={() => onPick("")}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Clear"
              >
                <Text style={styles.sheetClear}>{"Clear"}</Text>
              </Pressable>
            ) : (
              <View style={{ width: 44 }} />
            )}
          </View>
          {mode === "time" ? (
            <TimePickerBody currentValue={currentValue} onPick={onPick} />
          ) : (
            <CalendarPickerBody currentValue={currentValue} onPick={onPick} />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TimePickerBody({
  currentValue,
  onPick,
}: {
  currentValue: string;
  onPick: (v: string) => void;
}) {
  const parsed = useMemo(() => {
    const m = currentValue.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (m) {
      return { hour: parseInt(m[1], 10), minute: parseInt(m[2], 10), period: m[3].toUpperCase() as "AM" | "PM" };
    }
    return { hour: 7, minute: 0, period: "PM" as "AM" | "PM" };
  }, [currentValue]);

  const [hour, setHour] = useState<number>(parsed.hour);
  const [minute, setMinute] = useState<number>(parsed.minute);
  const [period, setPeriod] = useState<"AM" | "PM">(parsed.period);

  const formatted = `${hour}:${String(minute).padStart(2, "0")} ${period}`;
  const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const minutes = useMemo(() => [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55], []);

  return (
    <View style={styles.timeBody}>
      <Text style={styles.timePreview}>{formatted}</Text>

      <View style={styles.timeColsRow}>
        <View style={styles.timeCol}>
          <Text style={styles.timeColLabel}>{"Hour"}</Text>
          <ScrollView style={styles.timeColScroll} showsVerticalScrollIndicator={false}>
            {hours.map((h) => {
              const sel = h === hour;
              return (
                <Pressable
                  key={h}
                  onPress={() => setHour(h)}
                  style={({ pressed }) => [styles.timeCell, sel && styles.timeCellSelected, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[styles.timeCellText, sel && styles.timeCellTextSelected]}>{String(h)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
        <View style={styles.timeCol}>
          <Text style={styles.timeColLabel}>{"Min"}</Text>
          <ScrollView style={styles.timeColScroll} showsVerticalScrollIndicator={false}>
            {minutes.map((m) => {
              const sel = m === minute;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMinute(m)}
                  style={({ pressed }) => [styles.timeCell, sel && styles.timeCellSelected, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[styles.timeCellText, sel && styles.timeCellTextSelected]}>{String(m).padStart(2, "0")}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
        <View style={styles.timeCol}>
          <Text style={styles.timeColLabel}>{" "}</Text>
          <View style={styles.periodCol}>
            {(["AM", "PM"] as const).map((p) => {
              const sel = p === period;
              return (
                <Pressable
                  key={p}
                  onPress={() => setPeriod(p)}
                  style={({ pressed }) => [styles.periodCell, sel && styles.periodCellSelected, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[styles.periodText, sel && styles.periodTextSelected]}>{p}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <Pressable
        onPress={() => onPick(formatted)}
        style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
      >
        <LinearGradient
          colors={[Colors.primary, Colors.secondary] as const}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.confirmGradient}
        >
          <Text style={styles.confirmText}>{"Set time"}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function CalendarPickerBody({
  currentValue,
  onPick,
}: {
  currentValue: string;
  onPick: (v: string) => void;
}) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [viewMonth, setViewMonth] = useState<Date>(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date | null>(null);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const goPrev = () => setViewMonth(new Date(year, month - 1, 1));
  const goNext = () => setViewMonth(new Date(year, month + 1, 1));

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  return (
    <View style={styles.calBody}>
      <View style={styles.calHeader}>
        <Pressable onPress={goPrev} hitSlop={10} style={({ pressed }) => [styles.calNavBtn, pressed && { opacity: 0.6 }]}>
          <ChevronLeft size={22} color={Colors.text} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.calTitle}>{`${MONTH_NAMES[month]} ${year}`}</Text>
        <Pressable onPress={goNext} hitSlop={10} style={({ pressed }) => [styles.calNavBtn, pressed && { opacity: 0.6 }]}>
          <ChevronRight size={22} color={Colors.text} strokeWidth={2.4} />
        </Pressable>
      </View>

      <View style={styles.calWeekRow}>
        {WEEKDAY_SHORT.map((w, i) => (
          <Text key={i} style={styles.calWeekText}>{w}</Text>
        ))}
      </View>

      <View style={styles.calGrid}>
        {cells.map((d, idx) => {
          if (d === null) return <View key={idx} style={styles.calCell} />;
          const cellDate = new Date(year, month, d);
          const isPast = cellDate.getTime() < today.getTime();
          const isToday = isSameDay(cellDate, today);
          const isSel = selected !== null && isSameDay(cellDate, selected);
          return (
            <Pressable
              key={idx}
              onPress={() => {
                if (isPast) return;
                setSelected(cellDate);
              }}
              disabled={isPast}
              style={({ pressed }) => [styles.calCell, pressed && !isPast && { opacity: 0.7 }]}
            >
              {isSel ? (
                <LinearGradient
                  colors={[Colors.primary, Colors.secondary] as const}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.calDayCircle}
                >
                  <Text style={styles.calDayTextSelected}>{String(d)}</Text>
                </LinearGradient>
              ) : (
                <View style={[styles.calDayCircle, isToday && styles.calDayCircleToday]}>
                  <Text style={[styles.calDayText, isPast && styles.calDayTextPast, isToday && styles.calDayTextToday]}>{String(d)}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => {
          if (selected) onPick(formatPickedDate(selected));
        }}
        disabled={!selected}
        style={({ pressed }) => [styles.confirmBtn, !selected && { opacity: 0.4 }, pressed && selected && { opacity: 0.85 }]}
        accessibilityRole="button"
      >
        <LinearGradient
          colors={[Colors.primary, Colors.secondary] as const}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.confirmGradient}
        >
          <Text style={styles.confirmText}>{selected ? `Set ${formatPickedDate(selected)}` : "Pick a date"}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function Header({
  onClose,
  canPost,
  onPost,
  t,
}: {
  onClose: () => void;
  canPost: boolean;
  onPost: () => void;
  t: (k: string) => string;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onClose}
        hitSlop={12}
        style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel={"Close"}
      >
        <X size={24} color={Colors.text} strokeWidth={2.2} />
      </Pressable>

      <Text style={styles.headerTitle}>{"New plan"}</Text>

      <Pressable
        onPress={onPost}
        disabled={!canPost}
        hitSlop={12}
        style={({ pressed }) => [styles.headerBtn, styles.postBtn, pressed && canPost && { opacity: 0.7 }]}
      >
        {canPost ? (
          <MaskedGradientText text={"Post"} />
        ) : (
          <Text style={styles.postDisabled}>{"Post"}</Text>
        )}
      </Pressable>
    </View>
  );
}

function MaskedGradientText({ text }: { text: string }) {
  // Visual gradient look using layered text + gradient fill is heavy on RN.
  // We approximate with bold orange text — close to the gradient start tone — with a subtle pink shadow.
  return (
    <Text
      style={{
        color: Colors.primary,
        fontSize: 16,
        fontWeight: "800",
        textShadowColor: "rgba(255,60,172,0.45)",
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
      }}
    >
      {text}
    </Text>
  );
}

function ActivityTile({
  item,
  selected,
  onPress,
  t,
}: {
  item: Activity;
  selected: boolean;
  onPress: () => void;
  t: (k: string) => string;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const onIn = () => {
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  };
  const onOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onIn}
        onPressOut={onOut}
        style={styles.activityWrap}
        accessibilityRole="button"
      >
        {selected ? (
          <LinearGradient
            colors={[Colors.primary, Colors.secondary] as const}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.activityBorder}
          >
            <View style={styles.activityInnerSelected}>
              <LinearGradient
                colors={["rgba(255,107,53,0.22)", "rgba(255,60,172,0.22)"] as const}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.activityEmoji}>{item.emoji}</Text>
              <Text style={styles.activityLabelSelected}>{t(item.label)}</Text>
            </View>
          </LinearGradient>
        ) : (
          <View style={styles.activityInner}>
            <Text style={styles.activityEmoji}>{item.emoji}</Text>
            <Text style={styles.activityLabel}>{t(item.label)}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function FieldBox({
  focused,
  children,
}: {
  focused: boolean;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.field,
        focused && styles.fieldFocused,
      ]}
    >
      {children}
    </View>
  );
}

function GradientIcon({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <LinearGradient
      colors={[Colors.primary, Colors.secondary] as const}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </LinearGradient>
  );
}

function DateTimeField({
  label,
  value,
  placeholder,
  icon,
  onPress,
  style,
}: {
  label: string;
  value: string;
  placeholder: string;
  icon: React.ReactNode;
  onPress: () => void;
  style?: object;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.dtField, style]} accessibilityRole="button">
      <View style={styles.dtTop}>
        <Text style={styles.dtLabel}>{label}</Text>
        {icon}
      </View>
      <Text style={[styles.dtValue, !value && styles.dtValuePlaceholder]}>
        {value || placeholder}
      </Text>
    </Pressable>
  );
}

function PeopleSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState<number>(0);
  const trackXRef = useRef<number>(0);
  const wrapRef = useRef<View | null>(null);
  const valueRef = useRef<number>(value);
  valueRef.current = value;

  const fraction = (value - MIN_PEOPLE) / (MAX_PEOPLE - MIN_PEOPLE);

  const updateFromX = useCallback(
    (x: number) => {
      if (trackWidth <= 0) return;
      const clamped = Math.max(0, Math.min(trackWidth, x));
      const frac = clamped / trackWidth;
      const raw = MIN_PEOPLE + frac * (MAX_PEOPLE - MIN_PEOPLE);
      const next = Math.max(MIN_PEOPLE, Math.min(MAX_PEOPLE, Math.round(raw)));
      if (next !== valueRef.current) {
        valueRef.current = next;
        onChange(next);
        if (Platform.OS !== "web") {
          Haptics.selectionAsync().catch(() => {});
        }
      }
    },
    [trackWidth, onChange]
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (e) => {
          const x = e.nativeEvent.pageX - trackXRef.current;
          updateFromX(x);
        },
        onPanResponderMove: (e) => {
          const x = e.nativeEvent.pageX - trackXRef.current;
          updateFromX(x);
        },
      }),
    [updateFromX]
  );

  const fillWidth = Math.max(0, Math.min(1, fraction)) * trackWidth;
  const thumbX = fillWidth - 14;

  return (
    <View
      ref={wrapRef}
      style={styles.sliderTrackWrap}
      onLayout={(e) => {
        setTrackWidth(e.nativeEvent.layout.width);
        if (wrapRef.current && typeof wrapRef.current.measureInWindow === "function") {
          wrapRef.current.measureInWindow((x: number) => {
            trackXRef.current = x;
          });
        }
      }}
      {...responder.panHandlers}
    >
      <View style={styles.sliderTrack} />
      {trackWidth > 0 && (
        <LinearGradient
          colors={[Colors.primary, Colors.secondary] as const}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.sliderFill, { width: fillWidth }]}
          pointerEvents="none"
        />
      )}
      {trackWidth > 0 && (
        <View style={[styles.sliderThumb, { left: thumbX }]} pointerEvents="none" />
      )}
    </View>
  );
}

function VisibilityOption({
  selected,
  onPress,
  emoji,
  label,
}: {
  selected: boolean;
  onPress: () => void;
  emoji: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} style={styles.visibilityWrap}>
      {selected ? (
        <LinearGradient
          colors={[Colors.primary, Colors.secondary] as const}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.visibilityInnerSelected}
        >
          <Text style={styles.visibilityText}>
            {label} {emoji}
          </Text>
        </LinearGradient>
      ) : (
        <View style={styles.visibilityInner}>
          <Text style={styles.visibilityTextInactive}>
            {label} {emoji}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  safe: { flex: 1 },
  flex: { flex: 1 },

  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerBtn: {
    minWidth: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  postBtn: { alignItems: "flex-end" },
  postDisabled: {
    color: Colors.textDim,
    fontSize: 16,
    fontWeight: "800",
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },

  label: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "left",
    marginBottom: 12,
  },
  labelTop: { marginTop: 24 },
  labelCenter: { textAlign: "center" },

  // Activity grid
  activityGrid: {
    flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  activityWrap: {
    width: 80,
    height: 80,
  },
  activityInner: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  activityBorder: {
    flex: 1,
    borderRadius: 16,
    padding: 2,
  },
  activityInnerSelected: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    gap: 4,
  },
  activityEmoji: {
    fontSize: 28,
    lineHeight: 32,
  },
  activityLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    writingDirection: "rtl",
  },
  activityLabelSelected: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: "800",
    writingDirection: "rtl",
  },

  // Field
  field: {
    height: 56,
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  fieldFocused: {
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "left",
    padding: 0,
  },
  inputWithIcon: {
    marginLeft: 12,
  },
  fieldIconLeft: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  // Date/time row
  row: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  rowItem: { flex: 1 },
  dtField: {
    height: 72,
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: "space-between",
  },
  dtTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dtLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    writingDirection: "rtl",
  },
  dtValue: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "right",
    writingDirection: "rtl",
  },
  dtValuePlaceholder: {
    color: Colors.textDim,
    fontWeight: "600",
  },

  // People slider
  peopleNumber: {
    color: Colors.text,
    fontSize: 32,
    fontWeight: "900",
    textAlign: "center",
    writingDirection: "rtl",
  },
  peopleUnit: {
    color: Colors.textMuted,
    fontSize: 16,
    fontWeight: "700",
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 4,
  },
  stepperCenter: { flex: 1, alignItems: "center" },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnPrimary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: Colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  stepperGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  sliderTrackWrap: {
    height: 44,
    justifyContent: "center",
    marginTop: 16,
  },
  sliderTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  sliderFill: {
    position: "absolute",
    left: 0,
    height: 8,
    borderRadius: 4,
  },
  sliderThumb: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  sliderMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -6,
    paddingHorizontal: 2,
  },
  sliderMetaText: {
    color: Colors.textDim,
    fontSize: 12,
    fontWeight: "700",
  },

  // Picker sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheetCard: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 16,
    maxHeight: "75%",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  sheetTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  sheetClear: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  sheetList: {
    marginTop: 6,
  },

  // Time picker
  timeBody: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  timePreview: {
    color: Colors.text,
    fontSize: 36,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 16,
  },
  timeColsRow: {
    flexDirection: "row",
    gap: 10,
    height: 220,
  },
  timeCol: {
    flex: 1,
  },
  timeColLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  timeColScroll: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeCell: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  timeCellSelected: {
    backgroundColor: "rgba(255,107,53,0.14)",
  },
  timeCellText: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  timeCellTextSelected: {
    color: Colors.primary,
    fontWeight: "900",
  },
  periodCol: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 6,
    gap: 6,
  },
  periodCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  periodCellSelected: {
    backgroundColor: "rgba(255,107,53,0.14)",
  },
  periodText: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  periodTextSelected: {
    color: Colors.primary,
    fontWeight: "900",
  },
  confirmBtn: {
    marginTop: 16,
    height: 52,
    borderRadius: 14,
    overflow: "hidden",
  },
  confirmGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  // Calendar
  calBody: {
    paddingTop: 12,
    paddingBottom: 20,
  },
  calHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  calNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  calTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  calWeekRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  calWeekText: {
    flex: 1,
    textAlign: "center",
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  calGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  calDayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  calDayCircleToday: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  calDayText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  calDayTextSelected: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  calDayTextToday: {
    color: Colors.primary,
    fontWeight: "900",
  },
  calDayTextPast: {
    color: Colors.textDim,
    opacity: 0.4,
  },
  sheetItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 8,
  },
  sheetItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(255,107,53,0.12)",
  },
  sheetItemText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  sheetItemTextSelected: {
    color: Colors.primary,
    fontWeight: "800",
  },

  // Visibility
  visibilityRow: {
    flexDirection: "row",
    gap: 12,
  },
  visibilityWrap: {
    flex: 1,
    height: 52,
  },
  visibilityInner: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  visibilityInnerSelected: {
    flex: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  visibilityText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    writingDirection: "rtl",
  },
  visibilityTextInactive: {
    color: Colors.textMuted,
    fontSize: 15,
    fontWeight: "700",
    writingDirection: "rtl",
  },

  // Invite friends
  inviteRow: {
    gap: 12,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  inviteItem: {
    width: 64,
    alignItems: "center",
    gap: 6,
  },
  inviteAvatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  inviteAvatarText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
  },
  inviteCheck: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.bg,
  },
  inviteName: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    maxWidth: 64,
  },
  inviteNameSelected: {
    color: Colors.text,
  },
});

type FriendRow = {
  id: string;
  name: string | null;
  avatar_url: string | null;
};
