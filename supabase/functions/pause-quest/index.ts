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

    const { sessionId, action } = await req.json();

    if (!sessionId || !action) {
      return new Response(JSON.stringify({ error: "Missing sessionId or action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the session belongs to the user
    const { data: session, error: sessionError } = await supabase
      .from("quest_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let newStatus: string;
    let logMessage: string;

    if (action === "pause") {
      if (session.status !== "running") {
        return new Response(JSON.stringify({ error: "Session is not running" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      newStatus = "paused";
      logMessage = "⏸️ تم إيقاف المهمة مؤقتاً";
    } else if (action === "resume") {
      if (session.status !== "paused") {
        return new Response(JSON.stringify({ error: "Session is not paused" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      newStatus = "running";
      logMessage = "▶️ تم استئناف المهمة";
    } else if (action === "stop") {
      if (session.status !== "running" && session.status !== "paused") {
        return new Response(JSON.stringify({ error: "Session is not active" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      newStatus = "stopped";
      logMessage = "⏹️ تم إيقاف المهمة نهائياً";
    } else {
      return new Response(JSON.stringify({ error: "Invalid action. Use: pause, resume, stop" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update session status
    await supabase
      .from("quest_sessions")
      .update({ status: newStatus })
      .eq("id", sessionId);

    // Add log entry
    await supabase.from("quest_logs").insert({
      session_id: sessionId,
      user_id: user.id,
      message: logMessage,
      level: action === "stop" ? "warning" : "info",
    });

    return new Response(JSON.stringify({ status: newStatus, message: logMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
