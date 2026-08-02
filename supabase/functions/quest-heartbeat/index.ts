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

    const { sessionId } = await req.json();

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Missing sessionId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get session (includes token_id)
    const { data: session, error: sessionError } = await supabase
      .from("quest_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If already completed/stopped/failed, return status
    if (["completed", "stopped", "failed"].includes(session.status)) {
      return new Response(JSON.stringify({ status: session.status, progress: session.progress, target: session.target, done: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If paused, just return
    if (session.status === "paused") {
      return new Response(JSON.stringify({ status: "paused", progress: session.progress, target: session.target, done: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the discord token server-side from token_id
    if (!session.token_id) {
      return new Response(JSON.stringify({ error: "No token linked to session" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tokenRecord } = await supabase
      .from("discord_tokens")
      .select("encrypted_token")
      .eq("id", session.token_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!tokenRecord?.encrypted_token) {
      return new Response(JSON.stringify({ error: "Token not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const discordToken = tokenRecord.encrypted_token;
    const method = session.method;
    const target = session.target || 0;
    let progress = session.progress || 0;

    // Send ONE heartbeat to Discord
    let endpoint: string;
    let body: any;

    const isVideo = method === "WATCH_VIDEO" || method === "WATCH_VIDEO_ON_MOBILE";

    if (isVideo) {
      // Discord rejects timestamps that jump too far ahead of real elapsed time,
      // so we advance the reported watch time by a small safe step each beat.
      const nextTimestamp = target > 0 ? Math.min(target, progress + 8) : progress + 8;
      endpoint = `${DISCORD_API}/quests/${session.quest_id}/video-progress`;
      body = { timestamp: nextTimestamp };
    } else {
      // Activity/stream quests need a real channel id inside the stream key.
      let streamKey = `call:${session.quest_id}:1`;
      if (method === "PLAY_ACTIVITY" || method === "STREAM_ON_DESKTOP") {
        try {
          const dmRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
            headers: getDiscordHeaders(discordToken),
          });
          if (dmRes.ok) {
            const dms = await dmRes.json();
            if (Array.isArray(dms) && dms[0]?.id) streamKey = `call:${dms[0].id}:1`;
          }
        } catch { /* keep fallback key */ }
      }
      endpoint = `${DISCORD_API}/quests/${session.quest_id}/heartbeat`;
      body = { stream_key: streamKey, terminal: false };
    }


    const sendBeat = () => fetch(endpoint, {
      method: "POST",
      headers: getDiscordHeaders(discordToken),
      body: JSON.stringify(body),
    });

    let res = await sendBeat();

    // Self-heal: quest not accepted yet on Discord -> accept it and retry once
    if (!res.ok && (res.status === 400 || res.status === 403 || res.status === 404)) {
      const enrollRes = await fetch(`${DISCORD_API}/quests/${session.quest_id}/enroll`, {
        method: "POST",
        headers: getDiscordHeaders(discordToken),
        body: JSON.stringify({ location: 11 }),
      });
      if (enrollRes.ok || enrollRes.status === 400 || enrollRes.status === 409) {
        await supabase.from("quest_logs").insert({
          session_id: sessionId, user_id: user.id,
          message: "✅ تم قبول المهمة تلقائياً وإعادة المحاولة", level: "info",
        });
        res = await sendBeat();
      }
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown error");
      await supabase.from("quest_sessions").update({
        status: "failed", last_beat_at: new Date().toISOString(),
        error_message: `Discord ${res.status}`,
      }).eq("id", sessionId);
      await supabase.from("quest_logs").insert({
        session_id: sessionId, user_id: user.id,
        message: `❌ فشل الـ heartbeat: ${res.status}`, level: "error",
      });
      return new Response(JSON.stringify({ status: "failed", error: `Discord API error: ${res.status}`, done: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    // Some quests report video progress under the sibling video event key
    const taskProgress = data?.progress?.[method]
      || (isVideo ? (data?.progress?.WATCH_VIDEO || data?.progress?.WATCH_VIDEO_ON_MOBILE) : null);

    if (taskProgress) {
      progress = Math.max(progress, taskProgress.value || 0);
      const completed = !!taskProgress.completed_at || (target > 0 && progress >= target);

      await supabase.from("quest_sessions").update({
        progress,
        status: completed ? "completed" : "running",
        completed_at: completed ? new Date().toISOString() : null,
        last_beat_at: new Date().toISOString(),
        error_message: null,
      }).eq("id", sessionId);

      await supabase.from("quest_logs").insert({
        session_id: sessionId, user_id: user.id,
        message: completed ? `✅ تم إكمال المهمة! ${progress}/${target}` : `📊 التقدم: ${progress}/${target}`,
        level: completed ? "success" : "info",
      });

      if (completed || progress >= target) {
        // Auto-claim reward — Discord requires platform + location on this call
        let claimed = false;
        try {
          for (const variant of [{ platform: 0, location: 11 }, { platform: 1, location: 11 }, { platform: 2, location: 11 }]) {
            const claimRes = await fetch(`${DISCORD_API}/quests/${session.quest_id}/claim-reward`, {
              method: "POST",
              headers: getDiscordHeaders(discordToken),
              body: JSON.stringify(variant),
            });
            if (claimRes.ok) {
              claimed = true;
              await supabase.from("quest_logs").insert({
                session_id: sessionId, user_id: user.id,
                message: `🎁 تم استلام المكافأة تلقائياً!`,
                level: "success",
              });
              break;
            }
          }
        } catch (e) {
          console.error("Auto-claim error:", e);
        }


        const { data: profile } = await supabase
          .from("profiles")
          .select("total_solved_quests")
          .eq("user_id", user.id)
          .single();
        if (profile) {
          await supabase.from("profiles").update({
            total_solved_quests: (profile.total_solved_quests || 0) + 1,
          }).eq("user_id", user.id);
        }

        return new Response(JSON.stringify({ status: "completed", progress, target, done: true, claimed }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ status: "running", progress, target, done: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
