
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { supabase, hasSupabase } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(userId: string): Promise<{
  ok: boolean;
  token?: string;
  error?: string;
}> {
  if (!Device.isDevice) {
    return { ok: false, error: "Push notifications only work on physical devices" };
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF6B35",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    return { ok: false, error: "Permission not granted" };
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  if (!hasSupabase) return { ok: true, token };

  const { error } = await supabase.from("push_tokens").upsert(
    { user_id: userId, token, updated_at: new Date().toISOString() },
    { onConflict: "token" }
  );
  if (error) return { ok: false, error: error.message };

  return { ok: true, token };
}

export function setupNotificationHandlers(
  onPlanRealNotification: (planId: string) => void,
  onMosaicReadyNotification: (planId: string) => void
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as {
      type?: string;
      planId?: string;
    };
    if (data.type === "planreal" && data.planId) {
      onPlanRealNotification(data.planId);
    } else if (data.type === "mosaic_ready" && data.planId) {
      onMosaicReadyNotification(data.planId);
    }
  });
  return () => subscription.remove();
}

export async function sendLocalPlanRealNotification(planId: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "📸 Time for PlanReal!",
      body: "You have 2 minutes to capture the moment!",
      data: { type: "planreal", planId },
      sound: true,
    },
    trigger: null,
  });
}
