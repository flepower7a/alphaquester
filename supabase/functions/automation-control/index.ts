import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * Automation control center backend.
 * Every action is scoped to the authenticated user.
 * Actions: run_check | run_heartbeat | sweep | stop_all | retry_failed
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    const callAutoQuest = async (payload: Record<string, unknown>) => {
      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/auto-quest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ ...payload, userId: user.id }),
      });
      return await res.json().catch(() => ({}));
    };

    if (action === "run_check") return json({ success: true, result: await callAutoQuest({ action: "check" }) });
    if (action === "run_heartbeat") return json({ success: true, result: await callAutoQuest({ action: "heartbeat" }) });
    if (action === "sweep") {
      const minutes = Number(body?.minutes) >= 0 ? Number(body.minutes) : 10;
      return json({ success: true, result: await callAutoQuest({ action: "sweep", minutes }) });
    }

    if (action === "stop_all") {
      const { data, error } = await supabase
        .from("quest_sessions")
        .update({ status: "stopped", error_message: "تم الإيقاف من مركز التحكم" })
        .eq("user_id", user.id)
        .in("status", ["running", "pending"])
        .select("id");
      if (error) return json({ error: error.message }, 400);
      return json({ success: true, stopped: data?.length || 0 });
    }

    if (action === "retry_failed") {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { data, error } = await supabase
        .from("quest_sessions")
        .update({ status: "running", error_message: null, last_beat_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .in("status", ["failed", "stopped"])
        .gt("created_at", since)
        .lt("progress", 1)
        .select("id");
      if (error) return json({ error: error.message }, 400);
      return json({ success: true, retried: data?.length || 0 });
    }

    if (action === "clear_history") {
      const { data: rows } = await supabase
        .from("quest_sessions").select("id")
        .eq("user_id", user.id).in("status", ["failed", "stopped"]);
      const ids = (rows || []).map((r: any) => r.id);
      if (ids.length) {
        await supabase.from("quest_logs").delete().in("session_id", ids);
        await supabase.from("quest_sessions").delete().in("id", ids);
      }
      return json({ success: true, deleted: ids.length });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
