import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

export type LocalPlan = {
  id: string;
  emoji: string;
  title: string;
  location: string;
  time: string;
  date: string;
  maxPeople: number;
  visibility: "public" | "friends";
  creatorName: string;
  creatorInitial: string;
  createdAt: number;
};

const STORAGE_KEY = "sawa.localPlans.v1";

export const [LocalPlansProvider, useLocalPlans] = createContextHook(() => {
  const [plans, setPlans] = useState<LocalPlan[]>([]);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw) as LocalPlan[];
          if (Array.isArray(parsed)) setPlans(parsed);
        }
      } catch (e) {
        console.log("[localPlans] hydrate error", e);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(plans)).catch((e) =>
      console.log("[localPlans] persist error", e)
    );
  }, [plans, hydrated]);

  const addPlan = useCallback((plan: Omit<LocalPlan, "id" | "createdAt">) => {
    const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const next: LocalPlan = { ...plan, id, createdAt: Date.now() };
    setPlans((prev) => [next, ...prev]);
    return next;
  }, []);

  const removePlan = useCallback((id: string) => {
    setPlans((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clearPlans = useCallback(async () => {
    setPlans([]);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.log("[localPlans] clear error", e);
    }
  }, []);

  return { plans, addPlan, removePlan, clearPlans, hydrated };
});
