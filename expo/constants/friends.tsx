import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";

import { hasSupabase, supabase, type ProfileRow } from "@/lib/supabase";
import { useAuth } from "@/constants/auth";

export type FriendProfile = {
  id: string;
  name: string | null;
  avatar_url: string | null;
};

export type FriendshipRow = {
  user_id: string;
  friend_id: string;
  status: "pending" | "accepted" | "blocked";
  created_at: string;
};

export type IncomingRequest = {
  id: string; // requester id
  profile: FriendProfile | null;
  created_at: string;
};

type State = {
  isReady: boolean;
  canSync: boolean;
  friends: FriendProfile[];
  incoming: IncomingRequest[];
  outgoing: FriendProfile[];
  refresh: () => Promise<void>;
  searchUsers: (q: string) => Promise<FriendProfile[]>;
  sendRequest: (friendId: string) => Promise<{ ok: boolean; error?: string }>;
  cancelRequest: (friendId: string) => Promise<{ ok: boolean; error?: string }>;
  acceptRequest: (requesterId: string) => Promise<{ ok: boolean; error?: string }>;
  declineRequest: (requesterId: string) => Promise<{ ok: boolean; error?: string }>;
  removeFriend: (friendId: string) => Promise<{ ok: boolean; error?: string }>;
  isPendingOutgoing: (id: string) => boolean;
  isFriend: (id: string) => boolean;
};

export const [FriendsProvider, useFriends] = createContextHook<State>(() => {
  const { user, mode } = useAuth();
  const queryClient = useQueryClient();
  const canSync = hasSupabase && mode === "signedIn" && !!user;
  const myId = user?.id ?? null;

  const friendshipsQuery = useQuery<FriendshipRow[]>({
    queryKey: ["friendships", myId],
    enabled: canSync,
    queryFn: async () => {
      if (!myId) return [];
      const { data, error } = await supabase
        .from("friendships")
        .select("user_id, friend_id, status, created_at")
        .or(`user_id.eq.${myId},friend_id.eq.${myId}`);
      if (error) {
        console.log("[friends] load error", error.message);
        return [];
      }
      return (data ?? []) as FriendshipRow[];
    },
    staleTime: 1000 * 30,
  });

  const allRows = friendshipsQuery.data ?? [];

  const { friendIds, incomingIds, outgoingIds } = useMemo(() => {
    const friendIds: string[] = [];
    const incomingIds: { id: string; created_at: string }[] = [];
    const outgoingIds: string[] = [];
    if (!myId) return { friendIds, incomingIds, outgoingIds };
    for (const r of allRows) {
      if (r.status === "accepted") {
        const other = r.user_id === myId ? r.friend_id : r.user_id;
        friendIds.push(other);
      } else if (r.status === "pending") {
        if (r.friend_id === myId) {
          incomingIds.push({ id: r.user_id, created_at: r.created_at });
        } else if (r.user_id === myId) {
          outgoingIds.push(r.friend_id);
        }
      }
    }
    return { friendIds, incomingIds, outgoingIds };
  }, [allRows, myId]);

  const allProfileIds = useMemo(() => {
    const s = new Set<string>();
    friendIds.forEach((id) => s.add(id));
    incomingIds.forEach((r) => s.add(r.id));
    outgoingIds.forEach((id) => s.add(id));
    return Array.from(s);
  }, [friendIds, incomingIds, outgoingIds]);

  const profilesQuery = useQuery<FriendProfile[]>({
    queryKey: ["friend-profiles", myId, allProfileIds.join(",")],
    enabled: canSync && allProfileIds.length > 0,
    queryFn: async () => {
      if (allProfileIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", allProfileIds);
      if (error) {
        console.log("[friends] profiles error", error.message);
        return [];
      }
      return (data ?? []) as FriendProfile[];
    },
    staleTime: 1000 * 60,
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, FriendProfile>();
    (profilesQuery.data ?? []).forEach((p) => m.set(p.id, p));
    return m;
  }, [profilesQuery.data]);

  const friends: FriendProfile[] = useMemo(
    () => friendIds.map((id) => profileMap.get(id) ?? { id, name: null, avatar_url: null }),
    [friendIds, profileMap]
  );
  const incoming: IncomingRequest[] = useMemo(
    () =>
      incomingIds.map(({ id, created_at }) => ({
        id,
        profile: profileMap.get(id) ?? { id, name: null, avatar_url: null },
        created_at,
      })),
    [incomingIds, profileMap]
  );
  const outgoing: FriendProfile[] = useMemo(
    () => outgoingIds.map((id) => profileMap.get(id) ?? { id, name: null, avatar_url: null }),
    [outgoingIds, profileMap]
  );

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["friendships", myId] });
    await queryClient.invalidateQueries({ queryKey: ["friend-profiles"] });
  }, [queryClient, myId]);

  const searchUsers = useCallback(
    async (q: string): Promise<FriendProfile[]> => {
      const term = q.trim();
      if (!canSync || !myId || term.length < 2) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .neq("id", myId)
        .ilike("name", `%${term}%`)
        .limit(20);
      if (error) {
        console.log("[friends] search error", error.message);
        return [];
      }
      return (data ?? []) as FriendProfile[];
    },
    [canSync, myId]
  );

  const sendMutation = useMutation({
    mutationFn: async (friendId: string) => {
      if (!myId) throw new Error("no-user");
      // If they already sent us a request, accept it instead
      const existingIncoming = allRows.find(
        (r) => r.user_id === friendId && r.friend_id === myId && r.status === "pending"
      );
      if (existingIncoming) {
        const { error } = await supabase
          .from("friendships")
          .update({ status: "accepted" })
          .eq("user_id", friendId)
          .eq("friend_id", myId);
        if (error) throw new Error(error.message);
        // also mirror an accepted row from me → them
        await supabase
          .from("friendships")
          .upsert(
            { user_id: myId, friend_id: friendId, status: "accepted" },
            { onConflict: "user_id,friend_id" }
          );
        return;
      }
      const { error } = await supabase
        .from("friendships")
        .upsert(
          { user_id: myId, friend_id: friendId, status: "pending" },
          { onConflict: "user_id,friend_id" }
        );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => refresh(),
  });

  const cancelMutation = useMutation({
    mutationFn: async (friendId: string) => {
      if (!myId) throw new Error("no-user");
      const { error } = await supabase
        .from("friendships")
        .delete()
        .eq("user_id", myId)
        .eq("friend_id", friendId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => refresh(),
  });

  const acceptMutation = useMutation({
    mutationFn: async (requesterId: string) => {
      if (!myId) throw new Error("no-user");
      const { error } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("user_id", requesterId)
        .eq("friend_id", myId);
      if (error) throw new Error(error.message);
      // mirror so both directions appear as accepted
      await supabase
        .from("friendships")
        .upsert(
          { user_id: myId, friend_id: requesterId, status: "accepted" },
          { onConflict: "user_id,friend_id" }
        );
    },
    onSuccess: () => refresh(),
  });

  const declineMutation = useMutation({
    mutationFn: async (requesterId: string) => {
      if (!myId) throw new Error("no-user");
      const { error } = await supabase
        .from("friendships")
        .delete()
        .eq("user_id", requesterId)
        .eq("friend_id", myId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => refresh(),
  });

  const removeFriendMutation = useMutation({
    mutationFn: async (friendId: string) => {
      if (!myId) throw new Error("no-user");
      const { error } = await supabase
        .from("friendships")
        .delete()
        .or(
          `and(user_id.eq.${myId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${myId})`
        );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => refresh(),
  });

  const wrap = useCallback(
    async (
      fn: (arg: string) => Promise<void>,
      arg: string
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        await fn(arg);
        return { ok: true };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "unknown";
        console.log("[friends] mutation error", msg);
        return { ok: false, error: msg };
      }
    },
    []
  );

  const sendRequest = useCallback((id: string) => wrap(sendMutation.mutateAsync, id), [wrap, sendMutation]);
  const cancelRequest = useCallback((id: string) => wrap(cancelMutation.mutateAsync, id), [wrap, cancelMutation]);
  const acceptRequest = useCallback((id: string) => wrap(acceptMutation.mutateAsync, id), [wrap, acceptMutation]);
  const declineRequest = useCallback((id: string) => wrap(declineMutation.mutateAsync, id), [wrap, declineMutation]);
  const removeFriend = useCallback((id: string) => wrap(removeFriendMutation.mutateAsync, id), [wrap, removeFriendMutation]);

  const isPendingOutgoing = useCallback((id: string) => outgoingIds.includes(id), [outgoingIds]);
  const isFriend = useCallback((id: string) => friendIds.includes(id), [friendIds]);

  return {
    isReady: !friendshipsQuery.isLoading,
    canSync,
    friends,
    incoming,
    outgoing,
    refresh,
    searchUsers,
    sendRequest,
    cancelRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
    isPendingOutgoing,
    isFriend,
  };
});
