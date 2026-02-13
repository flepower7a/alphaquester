import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISCORD_API = "https://discord.com/api/v9";

function getDiscordHeaders(token: string): Record<string, string> {
  const sp = btoa(JSON.stringify({
    os: "Windows", browser: "Chrome", device: "", system_locale: "en",
    browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9044 Chrome/120.0.6099.291 Electron/28.2.10 Safari/537.36",
    browser_version: "142.0.0.0", os_version: "10", release_channel: "stable",
    client_build_number: 971383, client_event_source: null,
  }));
  return {
    accept: "*/*", authorization: token.trim(),
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9044 Chrome/120.0.6099.291 Electron/28.2.10 Safari/537.36",
    "x-super-properties": sp, "content-type": "application/json",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const { token, action, tokenId } = await req.json();

    // Action: add token
    if (action === "add" && token) {
      // Validate token with Discord
      const res = await fetch(`${DISCORD_API}/users/@me`, { headers: getDiscordHeaders(token) });
      if (!res.ok) {
        return new Response(JSON.stringify({ error: "Invalid Discord token" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const discordUser = await res.json();

      const avatarUrl = discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${discordUser.avatar.startsWith("a_") ? "gif" : "png"}?size=256`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUser.discriminator || "0") % 5}.png`;

      const displayName = discordUser.global_name || discordUser.username;

      // Try to get boost and nitro info
      let boostMonths = 0;
      let nitroMonths = 0;
      try {
        const profileRes = await fetch(`${DISCORD_API}/users/${discordUser.id}/profile`, {
          headers: getDiscordHeaders(token),
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          if (profile.premium_guild_since) {
            const boostDate = new Date(profile.premium_guild_since);
            const now = new Date();
            boostMonths = Math.floor((now.getTime() - boostDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
          }
          if (profile.premium_since) {
            const nitroDate = new Date(profile.premium_since);
            const now = new Date();
            nitroMonths = Math.floor((now.getTime() - nitroDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
          }
        }
      } catch { /* ignore */ }

      // Simple hash for storage (not the actual token)
      const encoder = new TextEncoder();
      const data = encoder.encode(token);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const tokenHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

      // Check if token already exists
      const { data: existing } = await supabase
        .from("discord_tokens")
        .select("id")
        .eq("user_id", user.id)
        .eq("discord_user_id", discordUser.id)
        .maybeSingle();

      let result;
      if (existing) {
        const { data: updated, error } = await supabase
          .from("discord_tokens")
          .update({
            token_hash: tokenHash,
            encrypted_token: token.trim(),
            discord_username: discordUser.username,
            display_name: displayName,
            avatar_url: avatarUrl,
            boost_months: boostMonths,
            nitro_months: nitroMonths,
            nitro_type: discordUser.premium_type ? String(discordUser.premium_type) : null,
            is_active: true,
            last_used_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        result = updated;
      } else {
        const { data: inserted, error } = await supabase
          .from("discord_tokens")
          .insert({
            user_id: user.id,
            token_hash: tokenHash,
            encrypted_token: token.trim(),
            discord_user_id: discordUser.id,
            discord_username: discordUser.username,
            display_name: displayName,
            avatar_url: avatarUrl,
            boost_months: boostMonths,
            nitro_months: nitroMonths,
            nitro_type: discordUser.premium_type ? String(discordUser.premium_type) : null,
          })
          .select()
          .single();
        if (error) throw error;
        result = inserted;
      }

      // Don't expose token in response
      const { encrypted_token: _, ...safeResult } = result;
      return new Response(JSON.stringify({
        token_record: safeResult,
        discord_user: { id: discordUser.id, username: discordUser.username, display_name: displayName, avatar_url: avatarUrl, boost_months: boostMonths },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: refresh all tokens info (exclude encrypted_token from response)
    if (action === "refresh") {
      const { data: tokens } = await supabase
        .from("discord_tokens")
        .select("id, discord_user_id, discord_username, display_name, avatar_url, boost_months, nitro_type, is_active, created_at, last_used_at")
        .eq("user_id", user.id)
        .eq("is_active", true);

      return new Response(JSON.stringify({ tokens: tokens || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: get token for quest operations (returns actual token server-side only)
    if (action === "get_token" && tokenId) {
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

      return new Response(JSON.stringify({ token: tokenRecord.encrypted_token }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: delete token
    if (action === "delete" && tokenId) {
      await supabase.from("discord_tokens").delete().eq("id", tokenId).eq("user_id", user.id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
