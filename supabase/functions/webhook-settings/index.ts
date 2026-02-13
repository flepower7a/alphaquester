import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { action, webhookUrl, webhookName, avatarPath, isEnabled } = await req.json();

    if (action === "get") {
      // Return settings WITHOUT webhook_url (use service role to check if url exists)
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
      // Check if exists
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
        await supabase
          .from("webhook_settings")
          .update(updateData)
          .eq("id", existing.id);
      } else {
        await supabase
          .from("webhook_settings")
          .insert({ user_id: user.id, ...updateData });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "toggle") {
      const { data: existing } = await supabase
        .from("webhook_settings")
        .select("id, is_enabled, webhook_url")
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
      await supabase
        .from("webhook_settings")
        .update({ is_enabled: newState })
        .eq("id", existing.id);

      return new Response(JSON.stringify({ is_enabled: newState }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "test") {
      // Send a test webhook message
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

      const avatarUrl = settings.avatar_path
        ? `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/webhook-avatars/${settings.avatar_path}`
        : undefined;

      const res = await fetch(settings.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: settings.webhook_name || "Quest Notifier",
          avatar_url: avatarUrl,
          embeds: [{
            title: "✅ Test Notification",
            description: "Webhook is working correctly!",
            color: 0x5865F2,
            timestamp: new Date().toISOString(),
            footer: { text: "Discord • Test", icon_url: "https://cdn.discordapp.com/embed/avatars/0.png" },
          }],
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
