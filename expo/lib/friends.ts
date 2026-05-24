
import { supabase } from "./supabase";

export async function sendFriendRequest(
  fromUserId: string,
  toUserId: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("friendships").insert({
    user_id: fromUserId,
    friend_id: toUserId,
    status: "pending",
  });
  if (error) {
    if (error.message.includes("duplicate") || error.message.includes("unique")) {
      return { ok: false, error: "Request already sent" };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function acceptFriendRequest(
  currentUserId: string,
  fromUserId: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("user_id", fromUserId)
    .eq("friend_id", currentUserId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getFriends(userId: string): Promise<{
  friends: { id: string; name: string | null; avatar_url: string | null }[];
  error?: string;
}> {
  const { data, error } = await supabase
    .from("friendships")
    .select("user_id, friend_id, status")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq("status", "accepted");
  if (error) return { friends: [], error: error.message };

  const friendIds = (data ?? []).map((row) =>
    row.user_id === userId ? row.friend_id : row.user_id
  );
  if (friendIds.length === 0) return { friends: [] };

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, name, avatar_url")
    .in("id", friendIds);
  if (profilesError) return { friends: [], error: profilesError.message };

  return { friends: (profiles ?? []) as { id: string; name: string | null; avatar_url: string | null }[] };
}

export async function getPendingRequests(userId: string): Promise<{
  requests: { fromUserId: string; name: string | null; avatar_url: string | null; createdAt: string }[];
  error?: string;
}> {
  const { data, error } = await supabase
    .from("friendships")
    .select("user_id, created_at")
    .eq("friend_id", userId)
    .eq("status", "pending");
  if (error) return { requests: [], error: error.message };
  if (!data || data.length === 0) return { requests: [] };

  const fromIds = data.map((r) => r.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, avatar_url")
    .in("id", fromIds);

  const profileMap = new Map(
    (profiles ?? []).map((p: { id: string; name: string | null; avatar_url: string | null }) => [p.id, p])
  );

  return {
    requests: data.map((r) => {
      const profile = profileMap.get(r.user_id);
      return {
        fromUserId: r.user_id,
        name: profile?.name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        createdAt: r.created_at,
      };
    }),
  };
}

export async function getFriendshipStatus(
  userId: string,
  otherUserId: string
): Promise<"none" | "pending_sent" | "pending_received" | "accepted"> {
  const { data } = await supabase
    .from("friendships")
    .select("user_id, friend_id, status")
    .or(`and(user_id.eq.${userId},friend_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},friend_id.eq.${userId})`)
    .maybeSingle();
  if (!data) return "none";
  if (data.status === "accepted") return "accepted";
  if (data.user_id === userId) return "pending_sent";
  return "pending_received";
}

export async function removeFriend(
  userId: string,
  otherUserId: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("friendships")
    .delete()
    .or(`and(user_id.eq.${userId},friend_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},friend_id.eq.${userId})`);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
