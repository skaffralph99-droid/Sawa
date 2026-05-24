import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import Colors from "@/constants/colors";
import { LangProvider } from "@/constants/i18n";
import { AuthProvider, useAuth } from "@/constants/auth";
import { LocalPlansProvider } from "@/constants/localPlans";
import { FriendsProvider } from "@/constants/friends";
import { setupNotificationHandlers, registerForPushNotifications } from "@/lib/notifications";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function NotificationsBridge() {
  const { user, mode } = useAuth();
  useEffect(() => {
    if (mode !== "signedIn" || !user) return;
    registerForPushNotifications(user.id).catch((e) => console.log("[notifications] register error", e));
    const teardown = setupNotificationHandlers(
      (planId) => router.push({ pathname: "/camera", params: { planId } }),
      (planId) => router.push({ pathname: "/mosaic", params: { planId } })
    );
    return teardown;
  }, [user, mode]);
  return null;
}

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bg },
        animation: "fade",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="phone" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="contacts" />
      <Stack.Screen name="home" />
      <Stack.Screen name="create" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
      <Stack.Screen name="plan" />
      <Stack.Screen name="camera" options={{ animation: "fade", presentation: "fullScreenModal" }} />
      <Stack.Screen name="mosaic" options={{ animation: "fade" }} />
      <Stack.Screen name="me" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="friends" />
      <Stack.Screen name="notifications" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
      <Stack.Screen name="inbox" />
      <Stack.Screen name="diagnostics" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LangProvider>
          <LocalPlansProvider>
            <FriendsProvider>
              <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.bg }}>
                <View style={{ flex: 1, backgroundColor: Colors.bg }}>
                  <StatusBar style="light" />
                  <NotificationsBridge />
                  <RootLayoutNav />
                </View>
              </GestureHandlerRootView>
            </FriendsProvider>
          </LocalPlansProvider>
        </LangProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
