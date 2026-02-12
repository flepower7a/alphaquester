import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISCORD_API = "https://discord.com/api/v9";

function generateSuperProperties(): string {
  const superProperties = {
    os: "Windows", browser: "Chrome", device: "", system_locale: "en",
    has_client_mods: false,
    browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9044 Chrome/120.0.6099.291 Electron/28.2.10 Safari/537.36",
    browser_version: "142.0.0.0", os_version: "10", referrer: "", referring_domain: "",
    referrer_current: "https://discord.com/", referring_domain_current: "discord.com",
    release_channel: "stable", client_build_number: 971383, client_event_source: null,
  };
  return btoa(JSON.stringify(superProperties));
}

function getDiscordHeaders(token: string): Record<string, string> {
  return {
    accept: "*/*", "accept-language": "en,en-US;q=0.9,ar;q=0.8",
    authorization: token.trim(), priority: "u=1, i",
    "sec-ch-ua": '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9044 Chrome/120.0.6099.291 Electron/28.2.10 Safari/537.36",
    "sec-ch-ua-mobile": "?0", "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty", "sec-fetch-mode": "cors", "sec-fetch-site": "same-origin",
    "x-discord-locale": "en-US", "x-super-properties": generateSuperProperties(),
    "x-debug-options": "bugReporterEnabled", "content-type": "application/json",
    origin: "https://discord.com", referer: "https://discord.com/quest-home",
    "x-discord-timezone": "Africa/Algiers",
  };
}
const PROXIES = [
  "http://20.54.56.26:8080",
  "http://113.50.66.19:9091",
  "http://123.183.160.83:9091",
  "http://117.160.250.130:9999",
  "http://95.255.64.21:8081",
  "http://117.160.250.133:8081",
  "http://112.54.47.55:9091",
  "http://117.160.250.134:80",
  "http://36.67.168.117:8080",
  "http://117.160.250.130:81",
  "http://41.59.97.53:9999",
  "http://151.80.250.185:8080",
  "http://103.155.196.137:3125",
  "http://101.68.119.42:8085",
  "http://36.95.79.7:41890",
  "http://39.185.232.150:9091",
  "http://1.4.198.2:8080",
  "http://103.231.78.36:80",
  "http://51.91.157.66:80",
  "http://149.202.172.113:80",
  "http://159.203.84.241:3128",
  "http://18.190.155.129:80",
  "http://41.65.0.218:1976",
  "http://163.116.158.213:8081",
  "http://47.244.2.19:3128",
  "http://58.247.6.106:9002",
  "http://42.98.75.138:80",
  "http://175.6.173.23:9002",
  "http://47.114.89.183:8080",
  "http://34.213.226.46:9002",
  "http://117.12.49.114:9091",
];

let proxyIndex = 0;

function getNextProxy(): string {
  const proxy = PROXIES[proxyIndex % PROXIES.length];
  proxyIndex++;
  return proxy;
}

async function proxyFetch(url: string, options: RequestInit): Promise<Response> {
  // Try with proxy first, fallback to direct
  try {
    const proxy = getNextProxy();
    const client = Deno.createHttpClient({ proxy: { url: proxy } });
    const res = await fetch(url, { ...options, client } as any);
    return res;
  } catch {
    // Fallback to direct fetch
    return fetch(url, options);
  }
}

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
    const questsRes = await proxyFetch(`${DISCORD_API}/quests/@me`, {
      headers: getDiscordHeaders(discordToken),
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
      // Check if session was paused or stopped
      const { data: currentSession } = await supabase
        .from("quest_sessions")
        .select("status")
        .eq("id", sessionId)
        .single();

      if (currentSession?.status === "stopped") {
        await supabase.from("quest_logs").insert({
          session_id: sessionId, user_id: userId,
          message: "⏹️ تم إيقاف المهمة بواسطة المستخدم", level: "warning",
        });
        break;
      }

      if (currentSession?.status === "paused") {
        await new Promise((r) => setTimeout(r, 5000));
        i--;
        continue;
      }

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

      const res = await proxyFetch(endpoint, {
        method: "POST",
        headers: getDiscordHeaders(discordToken),
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
