import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISCORD_API = "https://discord.com/api/v9";

const DURATION_QUESTS = [
  "WATCH_VIDEO", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP",
  "PLAY_ACTIVITY", "WATCH_VIDEO_ON_MOBILE", "PLAY_ON_XBOX", "PLAY_ON_PLAYSTATION"
];

const TASK_EMOJIS: Record<string, string> = {
  WATCH_VIDEO: "▶️",
  WATCH_VIDEO_ON_MOBILE: "📱",
  PLAY_ON_DESKTOP: "🖥️",
  STREAM_ON_DESKTOP: "📡",
  PLAY_ACTIVITY: "🎮",
  PLAY_ON_XBOX: "🟢",
  PLAY_ON_PLAYSTATION: "🔵",
};

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

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m} minutes ${s} seconds` : `${m} minutes`;
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

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, tokenId } = await req.json();

    if (action !== "check") {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get webhook settings
    const { data: settings } = await supabase
      .from("webhook_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!settings?.is_enabled || !settings?.webhook_url) {
      return new Response(JSON.stringify({ skipped: true, reason: "Webhook disabled or not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get discord token
    if (!tokenId) {
      return new Response(JSON.stringify({ error: "tokenId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const token = tokenRecord.encrypted_token;

    // Fetch quests from Discord
    const response = await fetch(`${DISCORD_API}/quests/@me`, {
      headers: getDiscordHeaders(token),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch quests" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const now = new Date();

    // Get previously notified quest IDs
    const { data: notifiedQuests } = await supabase
      .from("quest_sessions")
      .select("quest_id")
      .eq("user_id", user.id);

    const notifiedIds = new Set((notifiedQuests || []).map((q: any) => q.quest_id));

    // Also check what we've already webhook-notified
    // We'll store notified quest IDs in a simple approach - check quest_logs for webhook messages
    // For simplicity, let's track via a special prefix in quest_logs

    const activeQuests = (data.quests || []).filter((q: any) => {
      const expires = q.config?.expires_at;
      return !expires || new Date(expires) > now;
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const avatarUrl = settings.avatar_path
      ? `${supabaseUrl}/storage/v1/object/public/webhook-avatars/${settings.avatar_path}`
      : undefined;

    const orbIconUrl = `${supabaseUrl}/storage/v1/object/public/webhook-avatars/orb-icon.png`;

    let sentCount = 0;

    for (const q of activeQuests) {
      const config = q.config;
      const questId = q.id;

      // Skip already enrolled/completed quests
      if (q.user_status?.completed_at) continue;

      // Check if already notified about this quest via webhook
      const { data: existingNotif } = await supabase
        .from("quest_logs")
        .select("id")
        .eq("user_id", user.id)
        .like("message", `%WEBHOOK_SENT:${questId}%`)
        .limit(1);

      if (existingNotif && existingNotif.length > 0) continue;

      // Build embed
      const tasks = config?.task_config_v2?.tasks || config?.task_config?.tasks || {};
      const rewards = config?.rewards_config?.rewards || [];
      const reward = rewards[0];
      const questName = config?.messages?.quest_name || "Unknown Quest";
      const gameTitle = config?.messages?.game_title || "";
      const startsAt = config?.starts_at;
      const expiresAt = config?.expires_at;

      let heroImage: string | null = null;
      if (config?.assets?.hero) {
        const hero = config.assets.hero;
        heroImage = hero.startsWith("http") ? hero : `https://cdn.discordapp.com/${hero}`;
      }

      // Build tasks description
      const taskLines = Object.keys(tasks).map((key) => {
        const task = tasks[key];
        const target = task.target || 0;
        const emoji = TASK_EMOJIS[key] || "📋";
        const isDuration = DURATION_QUESTS.includes(key);
        const label = key.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
        return `• ${label} for ${isDuration ? formatDuration(target) : target} ${emoji}`;
      });

      // Build reward text
      const rewardName = reward?.messages?.name || "No Reward";
      const rewardText = `• ${rewardName} 💎`;

      // Format dates
      const formatDate = (iso: string) => {
        const d = new Date(iso);
        return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}  ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`;
      };

      const startsStr = startsAt ? formatDate(startsAt) : "N/A";
      const expiresStr = expiresAt ? formatDate(expiresAt) : "N/A";

      // Calculate relative time
      const getRelative = (iso: string) => {
        const diff = new Date(iso).getTime() - now.getTime();
        const absDiff = Math.abs(diff);
        const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor(absDiff / (1000 * 60 * 60));
        if (diff < 0) return days > 0 ? `(${days} days ago)` : `(${hours} hours ago)`;
        return days > 0 ? `(in ${days} days)` : `(in ${hours} hours)`;
      };

      const embed: any = {
        title: "New Quest Available!",
        color: 0x5865F2,
        fields: [
          { name: "**Rewards:**", value: rewardText, inline: false },
          { name: "**Tasks:**", value: taskLines.join("\n"), inline: false },
          { name: "Game Name:", value: gameTitle || "N/A", inline: true },
          { name: "Quest Name:", value: questName, inline: true },
          { name: "Starts At:", value: `${startsStr} ${startsAt ? getRelative(startsAt) : ""}`, inline: false },
          { name: "Expires At:", value: `${expiresStr} ${expiresAt ? getRelative(expiresAt) : ""}`, inline: false },
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: `Discord • ${formatDate(new Date().toISOString())}`,
          icon_url: "https://cdn.discordapp.com/embed/avatars/0.png",
        },
      };

      // Add hero image
      if (heroImage) {
        embed.image = { url: heroImage };
      }

      // Add thumbnail (orb icon)
      embed.thumbnail = { url: "/emojis/orbIcon.png" };

      // Build button
      const components = [{
        type: 1,
        components: [
          {
            type: 2,
            style: 5, // Link button
            label: "View Quest",
            url: `https://discord.com/quests/${questId}`,
            emoji: { name: "🔗" },
          },
        ],
      }];

      const webhookBody: any = {
        username: settings.webhook_name || "Quest Notifier",
        avatar_url: avatarUrl,
        embeds: [embed],
        components,
      };

      const webhookRes = await fetch(settings.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookBody),
      });

      if (webhookRes.ok) {
        sentCount++;
        // Log that we notified this quest
        // Use a dummy session_id approach - create a minimal log
        // We need a session_id... let's create a system session for webhook logs
        const { data: systemSession } = await supabase
          .from("quest_sessions")
          .select("id")
          .eq("user_id", user.id)
          .eq("quest_id", `webhook_${questId}`)
          .maybeSingle();

        let sessionId: string;
        if (systemSession) {
          sessionId = systemSession.id;
        } else {
          const { data: newSession } = await supabase
            .from("quest_sessions")
            .insert({
              user_id: user.id,
              quest_id: `webhook_${questId}`,
              status: "completed",
              quest_name: questName,
              game_title: gameTitle,
              hero_image: heroImage,
            })
            .select("id")
            .single();
          sessionId = newSession!.id;
        }

        await supabase.from("quest_logs").insert({
          session_id: sessionId,
          user_id: user.id,
          message: `WEBHOOK_SENT:${questId} - ${questName}`,
          level: "info",
        });
      }
    }

    return new Response(JSON.stringify({ success: true, sent: sentCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
