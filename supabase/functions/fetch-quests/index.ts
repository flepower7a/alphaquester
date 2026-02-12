import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISCORD_API = "https://discord.com/api/v9";

const DURATION_QUESTS = [
  "WATCH_VIDEO", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP",
  "PLAY_ACTIVITY", "WATCH_VIDEO_ON_MOBILE", "PLAY_ON_XBOX", "PLAY_ON_PLAYSTATION"
];

const SUPPORTED_QUESTS = [
  "WATCH_VIDEO", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP",
  "PLAY_ACTIVITY", "WATCH_VIDEO_ON_MOBILE"
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "Token required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch quests from Discord
    const response = await fetch(`${DISCORD_API}/quests/@me`, {
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Invalid token or failed to fetch" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const now = new Date();

    const quests = (data.quests || [])
      .filter((q: any) => {
        const expires = q.config?.expires_at;
        return !expires || new Date(expires) > now;
      })
      .map((q: any) => {
        const config = q.config;
        const tasks = config?.task_config_v2?.tasks || config?.task_config?.tasks || {};
        const progress = q.user_status?.progress || {};

        const taskList = Object.keys(tasks).map((key) => {
          const task = tasks[key];
          const taskProgress = progress[key];
          const target = task.target || 0;
          const current = taskProgress?.value || 0;
          const percent = target > 0 ? Math.min(100, Math.floor((current / target) * 100)) : 0;
          const isDuration = DURATION_QUESTS.includes(key);
          const completed = !!taskProgress?.completed_at || percent >= 100;

          return { id: key, type: isDuration ? "duration" : "count", target, current, percent, completed };
        });

        const supported = taskList.some((t) => SUPPORTED_QUESTS.includes(t.id));
        const solveMethod = taskList.find((t) => SUPPORTED_QUESTS.includes(t.id));
        const rewards = config?.rewards_config?.rewards || [];
        const reward = rewards[0];
        const completed = !!q.user_status?.completed_at;

        return {
          id: q.id,
          name: config?.messages?.quest_name || "Unknown Quest",
          game_title: config?.messages?.game_title || "",
          publisher: config?.messages?.game_publisher || "",
          hero_image: config?.assets?.hero
            ? `https://cdn.discordapp.com/quests/${q.id}/${config.assets.hero}`
            : null,
          reward_name: reward?.messages?.name || "No Reward",
          method: solveMethod?.id || null,
          tasks: taskList,
          expires_at: config?.expires_at,
          enrolled: !!q.user_status?.enrolled_at,
          completed,
          supported,
        };
      });

    return new Response(JSON.stringify({ quests }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
