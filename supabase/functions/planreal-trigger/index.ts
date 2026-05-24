import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async () => {
  try {
    const now = new Date().toISOString();

    // Find plans where PlanReal should fire
    const { data: plans, error } = await supabase
      .from("plans")
      .select("id")
      .eq("status", "active")
      .lte("planreal_scheduled_at", now)
      .is("planreal_fired_at", null)
      .not("planreal_scheduled_at", "is", null);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!plans || plans.length === 0) {
      return new Response(JSON.stringify({ fired: 0 }), { status: 200 });
    }

    let fired = 0;

    for (const plan of plans) {
      // Mark as fired first to prevent double firing
      const { error: updateError } = await supabase
        .from("plans")
        .update({ planreal_fired_at: now })
        .eq("id", plan.id)
        .is("planreal_fired_at", null);

      if (updateError) continue;

      // Get all member push tokens
      const { data: members } = await supabase
        .from("plan_members")
        .select("user_id")
        .eq("plan_id", plan.id);

      if (!members || members.length < 3) continue;

      const userIds = members.map((m: { user_id: string }) => m.user_id);

      const { data: tokens } = await supabase
        .from("push_tokens")
        .select("token")
        .in("user_id", userIds);

      if (!tokens || tokens.length === 0) continue;

      // Send simultaneous push notifications via Expo
      const messages = tokens.map((t: { token: string }) => ({
        to: t.token,
        title: "📸 Time for PlanReal!",
        body: "You have 2 minutes to capture the moment!",
        data: { type: "planreal", planId: plan.id },
        sound: "default",
        priority: "high",
      }));

      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(messages),
      });

      fired++;
    }

    return new Response(JSON.stringify({ fired }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
