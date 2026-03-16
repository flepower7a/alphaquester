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
  WATCH_VIDEO: "▶️", WATCH_VIDEO_ON_MOBILE: "📱", PLAY_ON_DESKTOP: "🖥️",
  STREAM_ON_DESKTOP: "📡", PLAY_ACTIVITY: "🎮", PLAY_ON_XBOX: "🟢", PLAY_ON_PLAYSTATION: "🔵",
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}  ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`;
}

function getRelative(iso: string, now: Date): string {
  const diff = new Date(iso).getTime() - now.getTime();
  const absDiff = Math.abs(diff);
  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(absDiff / (1000 * 60 * 60));
  if (diff < 0) return days > 0 ? `(${days} days ago)` : `(${hours} hours ago)`;
  return days > 0 ? `(in ${days} days)` : `(in ${hours} hours)`;
}

function buildQuestEmbed(q: any, supabaseUrl: string) {
  const config = q.config;
  const questId = q.id;
  const now = new Date();

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

  const taskLines = Object.keys(tasks).map((key) => {
    const task = tasks[key];
    const target = task.target || 0;
    const emoji = TASK_EMOJIS[key] || "📋";
    const isDuration = DURATION_QUESTS.includes(key);
    const label = key.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
    return `• ${label} for ${isDuration ? formatDuration(target) : target} ${emoji}`;
  });

  const rewardName = reward?.messages?.name || "No Reward";
  const rewardText = `• ${rewardName} 💎`;
  const startsTs = startsAt ? Math.floor(new Date(startsAt).getTime() / 1000) : null;
  const expiresTs = expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : null;

  const embed: any = {
    title: "New Quest Available!",
    color: 0x5865F2,
    fields: [
      { name: "**Rewards:**", value: rewardText, inline: false },
      { name: "**Tasks:**", value: taskLines.join("\n") || "N/A", inline: false },
      { name: "Game Name:", value: gameTitle || "N/A", inline: true },
      { name: "Quest Name:", value: questName, inline: true },
      { name: "Starts At:", value: startsTs ? `<t:${startsTs}:F> (<t:${startsTs}:R>)` : "N/A", inline: false },
      { name: "Expires At:", value: expiresTs ? `<t:${expiresTs}:F> (<t:${expiresTs}:R>)` : "N/A", inline: false },
    ],
    timestamp: now.toISOString(),
    footer: {
      text: `Discord • ${formatDate(now.toISOString())}`,
      icon_url: "https://cdn.discordapp.com/embed/avatars/0.png",
    },
  };

  if (heroImage) embed.image = { url: heroImage };
  embed.thumbnail = { url: `${supabaseUrl}/storage/v1/object/public/webhook-avatars/orb-icon.png` };

  const components = [{
    type: 1,
    components: [{
      type: 2, style: 5,
      label: "View Quest",
      url: `https://discord.com/quests/${questId}`,
      emoji: { name: "🔗" },
    }],
  }];

  return { embed, components, questName, gameTitle, heroImage, questId };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Support both authenticated user calls and cron (no auth)
    let userId: string | null = null;
    let tokenId: string | null = null;

    const authHeader = req.headers.get("Authorization");
    
    let bodySafe: any = {};
    try { bodySafe = await req.json(); } catch { /* empty body from cron */ }

    const action = bodySafe?.action || "cron";

    if (action === "check" && authHeader) {
      // Authenticated single-user check
      const jwt = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
      tokenId = bodySafe?.tokenId || null;

      const result = await processUserWebhook(supabase, supabaseUrl, userId, tokenId);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cron mode: process ALL users with enabled webhooks
    const { data: allSettings } = await supabase
      .from("webhook_settings")
      .select("user_id, webhook_url, webhook_name, avatar_path, is_enabled")
      .eq("is_enabled", true);

    if (!allSettings || allSettings.length === 0) {
      return new Response(JSON.stringify({ message: "No enabled webhooks" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;
    for (const settings of allSettings) {
      if (!settings.webhook_url) continue;
      try {
        const result = await processUserWebhook(supabase, supabaseUrl, settings.user_id, null);
        totalSent += result.sent || 0;
      } catch (e) {
        console.error(`Error processing user ${settings.user_id}:`, e);
      }
    }

    return new Response(JSON.stringify({ success: true, totalSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processUserWebhook(
  supabase: any, supabaseUrl: string, userId: string, tokenId: string | null
): Promise<any> {
  // Get webhook settings
  const { data: settings } = await supabase
    .from("webhook_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!settings?.is_enabled || !settings?.webhook_url) {
    return { skipped: true, reason: "Webhook disabled or not configured" };
  }

  // Get discord token
  let resolvedTokenId = tokenId;
  if (!resolvedTokenId) {
    const { data: firstToken } = await supabase
      .from("discord_tokens")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!firstToken) return { skipped: true, reason: "No active token" };
    resolvedTokenId = firstToken.id;
  }

  const { data: tokenRecord } = await supabase
    .from("discord_tokens")
    .select("encrypted_token")
    .eq("id", resolvedTokenId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!tokenRecord?.encrypted_token) {
    return { error: "Token not found" };
  }

  const token = tokenRecord.encrypted_token;

  // Fetch quests from Discord
  const response = await fetch(`${DISCORD_API}/quests/@me`, {
    headers: getDiscordHeaders(token),
  });

  if (!response.ok) {
    return { error: "Failed to fetch quests" };
  }

  const data = await response.json();
  const now = new Date();

  const activeQuests = (data.quests || []).filter((q: any) => {
    const expires = q.config?.expires_at;
    return !expires || new Date(expires) > now;
  });

  const avatarUrl = settings.avatar_path
    ? `${supabaseUrl}/storage/v1/object/public/webhook-avatars/${settings.avatar_path}`
    : undefined;

  let sentCount = 0;

  for (const q of activeQuests) {
    const questId = q.id;
    if (q.user_status?.completed_at) continue;

    // Check if already notified
    const { data: existingNotif } = await supabase
      .from("quest_logs")
      .select("id")
      .eq("user_id", userId)
      .like("message", `%WEBHOOK_SENT:${questId}%`)
      .limit(1);

    if (existingNotif && existingNotif.length > 0) continue;

    const { embed, components, questName, gameTitle, heroImage } = buildQuestEmbed(q, supabaseUrl);

    const webhookRes = await fetch(settings.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: settings.webhook_name || "Quest Notifier",
        avatar_url: avatarUrl,
        embeds: [embed],
        components,
      }),
    });

    if (webhookRes.ok) {
      sentCount++;

      const { data: systemSession } = await supabase
        .from("quest_sessions")
        .select("id")
        .eq("user_id", userId)
        .eq("quest_id", `webhook_${questId}`)
        .maybeSingle();

      let sessionId: string;
      if (systemSession) {
        sessionId = systemSession.id;
      } else {
        const { data: newSession } = await supabase
          .from("quest_sessions")
          .insert({
            user_id: userId,
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
        user_id: userId,
        message: `WEBHOOK_SENT:${questId} - ${questName}`,
        level: "info",
      });
    }
  }

  return { success: true, sent: sentCount };
}
