import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISCORD_API = "https://discord.com/api/v9";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const jwtToken = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwtToken);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { token: discordToken, questId, method } = await req.json();

    if (!discordToken || !questId || !method) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch quest details
    const questsRes = await fetch(`${DISCORD_API}/quests/@me`, {
      headers: { Authorization: discordToken, "Content-Type": "application/json" },
    });

    if (!questsRes.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch quests" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const questsData = await questsRes.json();
    const quest = questsData.quests?.find((q: any) => q.id === questId);
    if (!quest) {
      return new Response(JSON.stringify({ error: "Quest not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = quest.config;
    const tasks = config?.task_config_v2?.tasks || config?.task_config?.tasks || {};
    const task = tasks[method];
    const target = task?.target || 0;
    const progress = quest.user_status?.progress?.[method]?.value || 0;

    // Create session
    const { data: session, error: sessionError } = await supabase
      .from("quest_sessions")
      .insert({
        user_id: user.id,
        quest_id: questId,
        quest_name: config?.messages?.quest_name,
        game_title: config?.messages?.game_title,
        reward_name: config?.rewards_config?.rewards?.[0]?.messages?.name,
        method,
        status: "running",
        progress,
        target,
        hero_image: config?.assets?.hero
          ? `https://cdn.discordapp.com/quests/${questId}/${config.assets.hero}`
          : null,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (sessionError) {
      return new Response(JSON.stringify({ error: "Failed to create session" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Start solving in background
    solveQuest(supabase, discordToken, questId, method, target, progress, session.id, user.id);

    return new Response(JSON.stringify({ session, message: "Quest solving started" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function solveQuest(
  supabase: any,
  discordToken: string,
  questId: string,
  method: string,
  target: number,
  startProgress: number,
  sessionId: string,
  userId: string
) {
  let progress = startProgress;
  const maxIterations = 200;

  try {
    for (let i = 0; i < maxIterations; i++) {
      let endpoint: string;
      let body: any;

      if (method === "WATCH_VIDEO" || method === "WATCH_VIDEO_ON_MOBILE") {
        const startDate = Math.floor(Date.now() / 1000) - progress;
        endpoint = `${DISCORD_API}/quests/${questId}/video-progress`;
        body = { timestamp: Math.floor(Date.now() / 1000) - startDate };
      } else {
        endpoint = `${DISCORD_API}/quests/${questId}/heartbeat`;
        body = { stream_key: `call:${questId}:1`, terminal: false };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: discordToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        await supabase.from("quest_sessions").update({ status: "failed" }).eq("id", sessionId);
        await supabase.from("quest_logs").insert({
          session_id: sessionId, user_id: userId,
          message: "فشل إرسال heartbeat", level: "error",
        });
        break;
      }

      const data = await res.json();
      const taskProgress = data?.progress?.[method];

      if (taskProgress) {
        progress = taskProgress.value || progress;
        const completed = !!taskProgress.completed_at;

        await supabase.from("quest_sessions").update({
          progress,
          status: completed ? "completed" : "running",
          completed_at: completed ? new Date().toISOString() : null,
        }).eq("id", sessionId);

        await supabase.from("quest_logs").insert({
          session_id: sessionId, user_id: userId,
          message: completed ? `✅ تم إكمال المهمة! ${progress}/${target}` : `📊 التقدم: ${progress}/${target}`,
          level: completed ? "success" : "info",
        });

        if (completed || progress >= target) {
          // Increment profile counter
          const { data: profile } = await supabase
            .from("profiles")
            .select("total_solved_quests")
            .eq("user_id", userId)
            .single();
          
          if (profile) {
            await supabase.from("profiles").update({
              total_solved_quests: (profile.total_solved_quests || 0) + 1,
            }).eq("user_id", userId);
          }
          break;
        }
      }

      const delay = (method === "WATCH_VIDEO" || method === "WATCH_VIDEO_ON_MOBILE") ? 5000 : 30000;
      await new Promise((r) => setTimeout(r, delay));
    }
  } catch (err) {
    await supabase.from("quest_sessions").update({ status: "failed" }).eq("id", sessionId);
    await supabase.from("quest_logs").insert({
      session_id: sessionId, user_id: userId,
      message: `❌ خطأ: ${err.message}`, level: "error",
    });
  }
}
