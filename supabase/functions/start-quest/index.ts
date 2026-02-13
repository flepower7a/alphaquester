import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISCORD_API = "https://discord.com/api/v9";

function generateSuperProperties(): string {
  const sp = {
    os: "Windows", browser: "Chrome", device: "", system_locale: "en",
    has_client_mods: false,
    browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9044 Chrome/120.0.6099.291 Electron/28.2.10 Safari/537.36",
    browser_version: "142.0.0.0", os_version: "10", referrer: "", referring_domain: "",
    referrer_current: "https://discord.com/", referring_domain_current: "discord.com",
    release_channel: "stable", client_build_number: 971383, client_event_source: null,
  };
  return btoa(JSON.stringify(sp));
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tokenId, questId, method } = await req.json();

    if (!tokenId || !questId || !method) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch token server-side only
    const { data: tokenRecord } = await supabase
      .from("discord_tokens")
      .select("encrypted_token")
      .eq("id", tokenId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!tokenRecord?.encrypted_token) {
      return new Response(JSON.stringify({ error: "Token not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const discordToken = tokenRecord.encrypted_token;

    // Fetch quest details from Discord
    const questsRes = await fetch(`${DISCORD_API}/quests/@me`, {
      headers: getDiscordHeaders(discordToken),
    });

    if (!questsRes.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch quests" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const questsData = await questsRes.json();
    const quest = questsData.quests?.find((q: any) => q.id === questId);
    if (!quest) {
      return new Response(JSON.stringify({ error: "Quest not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = quest.config;
    const tasks = config?.task_config_v2?.tasks || config?.task_config?.tasks || {};
    const task = tasks[method];
    const target = task?.target || 0;
    const progress = quest.user_status?.progress?.[method]?.value || 0;

    // Create session with token_id reference (not the actual token)
    const { data: session, error: sessionError } = await supabase
      .from("quest_sessions")
      .insert({
        user_id: user.id,
        token_id: tokenId,
        quest_id: questId,
        quest_name: config?.messages?.quest_name,
        game_title: config?.messages?.game_title,
        reward_name: config?.rewards_config?.rewards?.[0]?.messages?.name,
        method,
        status: "running",
        progress,
        target,
        hero_image: config?.assets?.hero
          ? (config.assets.hero.startsWith("http") ? config.assets.hero : `https://cdn.discordapp.com/quests/${config?.id || questId}/${config.assets.hero}`)
          : null,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (sessionError) {
      return new Response(JSON.stringify({ error: "Failed to create session" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("quest_logs").insert({
      session_id: session.id, user_id: user.id,
      message: "🚀 تم إنشاء الجلسة وبدء الحل", level: "info",
    });

    return new Response(JSON.stringify({ session, message: "Quest session created" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
