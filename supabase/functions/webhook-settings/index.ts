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
  const startsStr = startsAt ? formatDate(startsAt) : "N/A";
  const expiresStr = expiresAt ? formatDate(expiresAt) : "N/A";

  const embed: any = {
    title: "New Quest Available!",
    color: 0x5865F2,
    fields: [
      { name: "**Rewards:**", value: rewardText, inline: false },
      { name: "**Tasks:**", value: taskLines.join("\n") || "N/A", inline: false },
      { name: "Game Name:", value: gameTitle || "N/A", inline: true },
      { name: "Quest Name:", value: questName, inline: true },
      { name: "Starts At:", value: `${startsStr} ${startsAt ? getRelative(startsAt, now) : ""}`, inline: false },
      { name: "Expires At:", value: `${expiresStr} ${expiresAt ? getRelative(expiresAt, now) : ""}`, inline: false },
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

  return { embed, components, questName, gameTitle, heroImage };
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

    const body = await req.json();
    const { action } = body;

    if (action === "get") {
      const { data } = await supabase
        .from("webhook_settings")
        .select("id, user_id, webhook_name, avatar_path, is_enabled, created_at, updated_at, webhook_url")
        .eq("user_id", user.id)
        .maybeSingle();

      return new Response(JSON.stringify({
        settings: data ? {
          id: data.id,
          webhook_name: data.webhook_name,
          avatar_path: data.avatar_path,
          is_enabled: data.is_enabled,
          has_webhook_url: !!data.webhook_url,
        } : null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save") {
      const { webhookUrl, webhookName, avatarPath, isEnabled } = body;
      const { data: existing } = await supabase
        .from("webhook_settings")
        .select("id, webhook_url")
        .eq("user_id", user.id)
        .maybeSingle();

      const updateData: any = {};
      if (webhookUrl !== undefined) updateData.webhook_url = webhookUrl;
      if (webhookName !== undefined) updateData.webhook_name = webhookName;
      if (avatarPath !== undefined) updateData.avatar_path = avatarPath;
      if (isEnabled !== undefined) updateData.is_enabled = isEnabled;

      if (existing) {
        await supabase.from("webhook_settings").update(updateData).eq("id", existing.id);
      } else {
        await supabase.from("webhook_settings").insert({ user_id: user.id, ...updateData });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "toggle") {
      const { data: existing } = await supabase
        .from("webhook_settings")
        .select("id, is_enabled, webhook_url, webhook_name, avatar_path")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existing) {
        return new Response(JSON.stringify({ error: "No webhook configured" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!existing.webhook_url && !existing.is_enabled) {
        return new Response(JSON.stringify({ error: "Set a webhook URL first" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newState = !existing.is_enabled;
      await supabase.from("webhook_settings").update({ is_enabled: newState }).eq("id", existing.id);

      // When enabling, immediately check and send new quests
      let initialSent = 0;
      if (newState) {
        try {
          // Find user's active token
          const { data: firstToken } = await supabase
            .from("discord_tokens")
            .select("id, encrypted_token")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();

          if (firstToken?.encrypted_token) {
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

            // Fetch quests from Discord
            const questsRes = await fetch(`${DISCORD_API}/quests/@me`, {
              headers: getDiscordHeaders(firstToken.encrypted_token),
            });

            if (questsRes.ok) {
              const questsData = await questsRes.json();
              const now = new Date();

              const activeQuests = (questsData.quests || [])
                .filter((q: any) => {
                  const expires = q.config?.expires_at;
                  return !expires || new Date(expires) > now;
                })
                .sort((a: any, b: any) => {
                  const aDate = new Date(a.config?.starts_at || 0).getTime();
                  const bDate = new Date(b.config?.starts_at || 0).getTime();
                  return bDate - aDate;
                });

              const avatarUrl = existing.avatar_path
                ? `${supabaseUrl}/storage/v1/object/public/webhook-avatars/${existing.avatar_path}`
                : undefined;

              for (const q of activeQuests) {
                if (q.user_status?.completed_at) continue;
                const questId = q.id;

                // Check if already notified
                const { data: existingNotif } = await supabase
                  .from("quest_logs")
                  .select("id")
                  .eq("user_id", user.id)
                  .like("message", `%WEBHOOK_SENT:${questId}%`)
                  .limit(1);

                if (existingNotif && existingNotif.length > 0) continue;

                const { embed, components, questName, gameTitle, heroImage } = buildQuestEmbed(q, supabaseUrl);

                const webhookRes = await fetch(existing.webhook_url!, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    username: existing.webhook_name || "Quest Notifier",
                    avatar_url: avatarUrl,
                    embeds: [embed],
                    components,
                  }),
                });

                if (webhookRes.ok) {
                  initialSent++;

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
            }
          }
        } catch (e) {
          console.error("Initial webhook send error:", e);
        }
      }

      return new Response(JSON.stringify({ is_enabled: newState, initial_sent: initialSent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "test") {
      const { tokenId } = body;

      const { data: settings } = await supabase
        .from("webhook_settings")
        .select("webhook_url, webhook_name, avatar_path")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!settings?.webhook_url) {
        return new Response(JSON.stringify({ error: "No webhook URL configured" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If no tokenId, find the user's first active token
      let resolvedTokenId = tokenId;
      if (!resolvedTokenId) {
        const { data: firstToken } = await supabase
          .from("discord_tokens")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        if (!firstToken) {
          return new Response(JSON.stringify({ error: "No Discord token found. Add a token first." }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        resolvedTokenId = firstToken.id;
      }

      // Fetch the token
      const { data: tokenRecord } = await supabase
        .from("discord_tokens")
        .select("encrypted_token")
        .eq("id", resolvedTokenId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!tokenRecord?.encrypted_token) {
        return new Response(JSON.stringify({ error: "Token not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch quests from Discord
      const questsRes = await fetch(`${DISCORD_API}/quests/@me`, {
        headers: getDiscordHeaders(tokenRecord.encrypted_token),
      });

      if (!questsRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch quests from Discord" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const questsData = await questsRes.json();
      const now = new Date();

      // Get active quests sorted by start date (latest first)
      const activeQuests = (questsData.quests || [])
        .filter((q: any) => {
          const expires = q.config?.expires_at;
          return !expires || new Date(expires) > now;
        })
        .sort((a: any, b: any) => {
          const aDate = new Date(a.config?.starts_at || 0).getTime();
          const bDate = new Date(b.config?.starts_at || 0).getTime();
          return bDate - aDate; // Latest first
        });

      if (!activeQuests.length) {
        return new Response(JSON.stringify({ error: "No active quests found" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const latestQuest = activeQuests[0];
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const { embed, components } = buildQuestEmbed(latestQuest, supabaseUrl);

      const avatarUrl = settings.avatar_path
        ? `${supabaseUrl}/storage/v1/object/public/webhook-avatars/${settings.avatar_path}`
        : undefined;

      const res = await fetch(settings.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: settings.webhook_name || "Quest Notifier",
          avatar_url: avatarUrl,
          embeds: [embed],
          components,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return new Response(JSON.stringify({ error: `Webhook failed: ${res.status}`, details: errText }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
