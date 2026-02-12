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

function generateSuperProperties(): string {
  const superProperties = {
    os: "Windows",
    browser: "Chrome",
    device: "",
    system_locale: "en",
    has_client_mods: false,
    browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9044 Chrome/120.0.6099.291 Electron/28.2.10 Safari/537.36",
    browser_version: "142.0.0.0",
    os_version: "10",
    referrer: "",
    referring_domain: "",
    referrer_current: "https://discord.com/",
    referring_domain_current: "discord.com",
    release_channel: "stable",
    client_build_number: 971383,
    client_event_source: null,
  };
  return btoa(JSON.stringify(superProperties));
}

function getDiscordHeaders(token: string): Record<string, string> {
  return {
    accept: "*/*",
    "accept-language": "en,en-US;q=0.9,ar;q=0.8",
    authorization: token.trim(),
    priority: "u=1, i",
    "sec-ch-ua": '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9044 Chrome/120.0.6099.291 Electron/28.2.10 Safari/537.36",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "x-discord-locale": "en-US",
    "x-super-properties": generateSuperProperties(),
    "x-debug-options": "bugReporterEnabled",
    "content-type": "application/json",
    origin: "https://discord.com",
    referer: "https://discord.com/quest-home",
    "x-discord-timezone": "Africa/Algiers",
  };
}

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

    // Fetch quests from Discord with full client headers
    const response = await fetch(`${DISCORD_API}/quests/@me`, {
      headers: getDiscordHeaders(token),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Discord API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Invalid token or failed to fetch", details: errorText }), {
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

        // Build correct hero image URL
        let heroImage: string | null = null;
        if (config?.assets?.hero) {
          const hero = config.assets.hero;
          // If hero is already a full URL, use it
          if (hero.startsWith("http")) {
            heroImage = hero;
          } else {
            // Try quest-assets path with config ID
            const configId = config?.id || q.id;
            heroImage = `https://cdn.discordapp.com/quest-assets/${configId}/${hero}`;
          }
        }

        return {
          id: q.id,
          config_id: config?.id,
          name: config?.messages?.quest_name || "Unknown Quest",
          game_title: config?.messages?.game_title || "",
          publisher: config?.messages?.game_publisher || "",
          hero_image: heroImage,
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
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
