import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAILS = ["sf1@sf1.sf1", "uwu@alpha.dcq"];

function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 16; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12, 16)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "غير مصرح" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
      return new Response(JSON.stringify({ error: "غير مصرح" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // GET - List all codes
    if (req.method === "GET" && action === "list") {
      const { data, error } = await supabaseAdmin
        .from("subscription_codes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ codes: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST - Generate new code
    if (req.method === "POST" && action === "generate") {
      const { duration_days } = await req.json();
      const code = generateCode();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (duration_days || 30));

      const { data, error } = await supabaseAdmin
        .from("subscription_codes")
        .insert({
          code,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ code: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE - Delete a code
    if (req.method === "POST" && action === "delete") {
      const { code_id } = await req.json();

      // If the code was used, revert the user to free
      const { data: codeData } = await supabaseAdmin
        .from("subscription_codes")
        .select("*")
        .eq("id", code_id)
        .single();

      if (codeData?.is_used && codeData?.used_by) {
        await supabaseAdmin
          .from("profiles")
          .update({ account_type: "free" })
          .eq("user_id", codeData.used_by);
      }

      const { error } = await supabaseAdmin
        .from("subscription_codes")
        .delete()
        .eq("id", code_id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST - Check & revoke expired codes
    if (req.method === "POST" && action === "check-expired") {
      const { data: expiredCodes } = await supabaseAdmin
        .from("subscription_codes")
        .select("*")
        .eq("is_used", true)
        .lt("expires_at", new Date().toISOString());

      let revoked = 0;
      if (expiredCodes) {
        for (const code of expiredCodes) {
          if (code.used_by) {
            await supabaseAdmin
              .from("profiles")
              .update({ account_type: "free" })
              .eq("user_id", code.used_by);

            await supabaseAdmin
              .from("subscription_codes")
              .delete()
              .eq("id", code.id);

            revoked++;
          }
        }
      }

      return new Response(JSON.stringify({ revoked }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "إجراء غير معروف" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "خطأ في الخادم" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
