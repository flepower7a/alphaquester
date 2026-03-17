import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISCORD_API = "https://discord.com/api/v9";

const SUPPORTED_QUESTS = [
  "WATCH_VIDEO", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP",
  "PLAY_ACTIVITY", "WATCH_VIDEO_ON_MOBILE"
];

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

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

    let bodySafe: any = {};
    try { bodySafe = await req.json(); } catch { /* empty */ }

    const action = bodySafe?.action || "check";

    // === ACTION: check — find new quests and create sessions for all tokens ===
    if (action === "check") {
      // Get all users with auto_quest_enabled
      const { data: autoUsers } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("auto_quest_enabled", true);

      if (!autoUsers || autoUsers.length === 0) {
        return new Response(JSON.stringify({ message: "No auto-quest users" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let totalCreated = 0;

      for (const profile of autoUsers) {
        try {
          const created = await checkAndCreateSessions(supabase, profile.user_id);
          totalCreated += created;
        } catch (e) {
          console.error(`Error checking user ${profile.user_id}:`, e);
        }
      }

      return new Response(JSON.stringify({ success: true, totalCreated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === ACTION: heartbeat — send heartbeats for all active auto sessions ===
    if (action === "heartbeat") {
      const { data: activeSessions } = await supabase
        .from("quest_sessions")
        .select("*")
        .eq("status", "running")
        .like("quest_name", "%[AUTO]%");

      if (!activeSessions || activeSessions.length === 0) {
        return new Response(JSON.stringify({ message: "No active auto sessions" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let completed = 0;
      let heartbeats = 0;

      for (const session of activeSessions) {
        try {
          if (!session.token_id) continue;

          const { data: tokenRecord } = await supabase
            .from("discord_tokens")
            .select("encrypted_token")
            .eq("id", session.token_id)
            .maybeSingle();

          if (!tokenRecord?.encrypted_token) {
            await supabase.from("quest_sessions").update({ status: "failed" }).eq("id", session.id);
            continue;
          }

          const discordToken = tokenRecord.encrypted_token;
          const method = session.method;
          const target = session.target || 0;

          // Send heartbeat
          let endpoint: string;
          let body: any;

          if (method === "WATCH_VIDEO" || method === "WATCH_VIDEO_ON_MOBILE") {
            const progress = session.progress || 0;
            const startDate = Math.floor(Date.now() / 1000) - progress;
            endpoint = `${DISCORD_API}/quests/${session.quest_id}/video-progress`;
            body = { timestamp: Math.floor(Date.now() / 1000) - startDate };
          } else {
            endpoint = `${DISCORD_API}/quests/${session.quest_id}/heartbeat`;
            body = { stream_key: `call:${session.quest_id}:1`, terminal: false };
          }

          const res = await fetch(endpoint, {
            method: "POST",
            headers: getDiscordHeaders(discordToken),
            body: JSON.stringify(body),
          });

          if (!res.ok) {
            const errText = await res.text().catch(() => "");
            console.error(`Heartbeat failed for session ${session.id}: ${res.status} ${errText}`);
            if (res.status === 401 || res.status === 403) {
              await supabase.from("quest_sessions").update({ status: "failed" }).eq("id", session.id);
              await supabase.from("quest_logs").insert({
                session_id: session.id, user_id: session.user_id,
                message: `❌ [AUTO] فشل الـ heartbeat: ${res.status}`, level: "error",
              });
            }
            continue;
          }

          heartbeats++;
          const data = await res.json();
          const taskProgress = data?.progress?.[method];

          if (taskProgress) {
            const progress = taskProgress.value || session.progress || 0;
            const isCompleted = !!taskProgress.completed_at || progress >= target;

            await supabase.from("quest_sessions").update({
              progress,
              status: isCompleted ? "completed" : "running",
              completed_at: isCompleted ? new Date().toISOString() : null,
            }).eq("id", session.id);

            await supabase.from("quest_logs").insert({
              session_id: session.id, user_id: session.user_id,
              message: isCompleted
                ? `✅ [AUTO] تم إكمال المهمة! ${progress}/${target}`
                : `📊 [AUTO] التقدم: ${progress}/${target}`,
              level: isCompleted ? "success" : "info",
            });

            if (isCompleted) {
              completed++;
              // Auto-claim reward
              try {
                const rewards = data?.config?.rewards_config?.rewards || [];
                const reward = rewards[0];
                if (reward && !reward.claimed) {
                  const claimRes = await fetch(`${DISCORD_API}/quests/${session.quest_id}/claim-reward`, {
                    method: "POST",
                    headers: getDiscordHeaders(discordToken),
                    body: JSON.stringify({}),
                  });
                  if (claimRes.ok) {
                    await supabase.from("quest_logs").insert({
                      session_id: session.id, user_id: session.user_id,
                      message: `🎁 [AUTO] تم استلام المكافأة تلقائياً!`, level: "success",
                    });
                  }
                }
              } catch (e) {
                console.error("Auto-claim error:", e);
              }

              // Update profile stats
              const { data: p } = await supabase.from("profiles")
                .select("total_solved_quests").eq("user_id", session.user_id).single();
              if (p) {
                await supabase.from("profiles").update({
                  total_solved_quests: (p.total_solved_quests || 0) + 1,
                }).eq("user_id", session.user_id);
              }
            }
          }

          // Small delay between tokens to avoid rate limits
          await sleep(2000);
        } catch (e) {
          console.error(`Error processing session ${session.id}:`, e);
        }
      }

      return new Response(JSON.stringify({ success: true, heartbeats, completed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function checkAndCreateSessions(supabase: any, userId: string): Promise<number> {
  // Get ALL active tokens for this user
  const { data: allTokens } = await supabase
    .from("discord_tokens")
    .select("id, encrypted_token, discord_username")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!allTokens || allTokens.length === 0) return 0;

  // Pick a random token to check quests
  const checkToken = allTokens[Math.floor(Math.random() * allTokens.length)];

  const questsRes = await fetch(`${DISCORD_API}/quests/@me`, {
    headers: getDiscordHeaders(checkToken.encrypted_token),
  });

  if (!questsRes.ok) return 0;

  const questsData = await questsRes.json();
  const now = new Date();

  const activeQuests = (questsData.quests || []).filter((q: any) => {
    const expires = q.config?.expires_at;
    if (expires && new Date(expires) < now) return false;
    if (q.user_status?.completed_at) return false;
    return true;
  });

  let created = 0;

  for (const q of activeQuests) {
    const config = q.config;
    const tasks = config?.task_config_v2?.tasks || config?.task_config?.tasks || {};
    const solveMethod = Object.keys(tasks).find(key => SUPPORTED_QUESTS.includes(key));
    if (!solveMethod) continue;

    const task = tasks[solveMethod];
    const target = task?.target || 0;
    const questName = config?.messages?.quest_name || "Unknown";
    const gameTitle = config?.messages?.game_title || "";
    const heroImage = config?.assets?.hero
      ? (config.assets.hero.startsWith("http") ? config.assets.hero : `https://cdn.discordapp.com/${config.assets.hero}`)
      : null;
    const rewardName = config?.rewards_config?.rewards?.[0]?.messages?.name || "";

    // For EACH token, check if session already exists, if not create one
    for (const tokenRecord of allTokens) {
      // Check if session already exists for this token + quest combo
      const { data: existing } = await supabase
        .from("quest_sessions")
        .select("id")
        .eq("user_id", userId)
        .eq("quest_id", q.id)
        .eq("token_id", tokenRecord.id)
        .in("status", ["running", "completed"])
        .maybeSingle();

      if (existing) continue;

      // Check this token's progress on this quest
      let progress = 0;
      try {
        const tokenQuestsRes = await fetch(`${DISCORD_API}/quests/@me`, {
          headers: getDiscordHeaders(tokenRecord.encrypted_token),
        });
        if (tokenQuestsRes.ok) {
          const tokenData = await tokenQuestsRes.json();
          const tq = tokenData.quests?.find((x: any) => x.id === q.id);
          if (tq?.user_status?.completed_at) continue; // Already completed on this token
          progress = tq?.user_status?.progress?.[solveMethod]?.value || 0;
        }
        await sleep(1500); // Rate limit protection
      } catch { /* ignore */ }

      const { data: session } = await supabase
        .from("quest_sessions")
        .insert({
          user_id: userId,
          token_id: tokenRecord.id,
          quest_id: q.id,
          quest_name: `[AUTO] ${questName}`,
          game_title: gameTitle,
          reward_name: rewardName,
          method: solveMethod,
          status: "running",
          progress,
          target,
          hero_image: heroImage,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (session) {
        created++;
        await supabase.from("quest_logs").insert({
          session_id: session.id, user_id: userId,
          message: `🤖 [AUTO] بدء حل "${questName}" تلقائياً للتوكن ${tokenRecord.discord_username || tokenRecord.id.slice(0, 8)}`,
          level: "info",
        });
      }
    }
  }

  return created;
}
