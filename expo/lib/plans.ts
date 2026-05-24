import { supabase } from "./supabase";

export type PlanRow = {
  id: string;
  owner_id: string;
  title: string;
  location: string | null;
  privacy: string;
  activity_type: string | null;
  status: string;
  time_label: string | null;
  date_label: string | null;
  max_people: number | null;
  starts_at: string | null;
  ends_at: string | null;
  planreal_scheduled_at: string | null;
  planreal_fired_at: string | null;
  mosaic_url: string | null;
  mosaic_public_at: string | null;
  created_at: string;
};

export async function fetchActivePlans(userId: string): Promise<{
  plans: PlanRow[];
  error?: string;
}> {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) return { plans: [], error: error.message };
  return { plans: (data ?? []) as PlanRow[] };
}

export async function fetchPlanWithMembers(planId: string): Promise<{
  plan: PlanRow | null;
  members: { userId: string; name: string | null; avatarUrl: string | null; joinType: string; submittedAt: string | null }[];
  error?: string;
}> {
  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("*")
    .eq("id", planId)
    .single();
  if (planError) return { plan: null, members: [], error: planError.message };

  const { data: members, error: membersError } = await supabase
    .from("plan_members")
    .select("user_id, join_type, submitted_at, profile:profiles!plan_members_user_id_fkey(name, avatar_url)")
    .eq("plan_id", planId);
  if (membersError) return { plan: plan as PlanRow, members: [], error: membersError.message };

  return {
    plan: plan as PlanRow,
    members: (members ?? []).map((m: any) => ({
      userId: m.user_id,
      name: m.profile?.name ?? null,
      avatarUrl: m.profile?.avatar_url ?? null,
      joinType: m.join_type ?? "joined",
      submittedAt: m.submitted_at ?? null,
    })),
  };
}

export async function joinPlan(planId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("plan_members").upsert(
    { plan_id: planId, user_id: userId, join_type: "joined", status: "joined" },
    { onConflict: "plan_id,user_id" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function leavePlan(planId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("plan_members")
    .delete()
    .eq("plan_id", planId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function createPlan(params: {
  ownerId: string;
  title: string;
  location: string;
  activityType: string;
  privacy: "public" | "friends";
  maxPeople: number;
  timeLabel?: string;
  dateLabel?: string;
  startsAt?: Date;
  endsAt?: Date;
}): Promise<{ ok: boolean; planId?: string; error?: string }> {
  const { data, error } = await supabase
    .from("plans")
    .insert({
      owner_id: params.ownerId,
      title: params.title,
      location: params.location,
      activity_type: params.activityType,
      privacy: params.privacy,
      max_people: params.maxPeople,
      time_label: params.timeLabel ?? null,
      date_label: params.dateLabel ?? null,
      starts_at: params.startsAt?.toISOString() ?? null,
      ends_at: params.endsAt?.toISOString() ?? null,
      status: "active",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await supabase.from("plan_members").insert({
    plan_id: data.id,
    user_id: params.ownerId,
    join_type: "creator",
    status: "joined",
  });

  return { ok: true, planId: data.id };
}

export async function getUserTimeline(userId: string): Promise<{
  plans: (PlanRow & { memberCount: number })[];
  error?: string;
}> {
  const { data: memberRows, error: memError } = await supabase
    .from("plan_members")
    .select("plan_id")
    .eq("user_id", userId);
  if (memError) return { plans: [], error: memError.message };
  if (!memberRows || memberRows.length === 0) return { plans: [] };

  const planIds = memberRows.map((r: { plan_id: string }) => r.plan_id);
  const { data: plans, error: plansError } = await supabase
    .from("plans")
    .select("*")
    .in("id", planIds)
    .order("created_at", { ascending: false });
  if (plansError) return { plans: [], error: plansError.message };

  const { data: allMembers } = await supabase
    .from("plan_members")
    .select("plan_id")
    .in("plan_id", planIds);
  const countMap = new Map<string, number>();
  (allMembers ?? []).forEach((m: { plan_id: string }) => {
    countMap.set(m.plan_id, (countMap.get(m.plan_id) ?? 0) + 1);
  });

  return {
    plans: (plans ?? []).map((p: PlanRow) => ({
      ...p,
      memberCount: countMap.get(p.id) ?? 1,
    })),
  };
}

export function subscribeToPlanMembers(planId: string, onChange: () => void) {
  return supabase
    .channel(`plan-members:${planId}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "plan_members",
      filter: `plan_id=eq.${planId}`,
    }, onChange)
    .subscribe();
}
