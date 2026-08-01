import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISCORD_API = "https://discord.com/api/v9";

function superProps(mobile: boolean): string {
  const sp = mobile
    ? {
        os: "iOS", browser: "Discord iOS", device: "iPhone14,3", system_locale: "en-US",
        client_version: "245.0", os_version: "17.5.1", client_build_number: 71903,
        release_channel: "stable", device_vendor_id: crypto.randomUUID(), client_event_source: null,
      }
    : {
        os: "Windows", browser: "Chrome", device: "", system_locale: "en",
        has_client_mods: false,
        browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9044 Chrome/120.0.6099.291 Electron/28.2.10 Safari/537.36",
        browser_version: "142.0.0.0", os_version: "10", referrer: "", referring_domain: "",
        referrer_current: "https://discord.com/", referring_domain_current: "discord.com",
        release_channel: "stable", client_build_number: 971383, client_event_source: null,
      };
  return btoa(JSON.stringify(sp));
}

function headers(token: string, mobile = false): Record<string, string> {
  return {
    accept: "*/*", "accept-language": "en-US,en;q=0.9",
    authorization: token.trim(), "content-type": "application/json",
    "user-agent": mobile
      ? "Discord-iOS/245.0 (iPhone; iOS 17.5.1; Scale/3.00)"
      : "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9044 Chrome/120.0.6099.291 Electron/28.2.10 Safari/537.36",
    "x-super-properties": superProps(mobile),
    "x-discord-locale": "en-US", "x-debug-options": "bugReporterEnabled",
    origin: "https://discord.com", referer: "https://discord.com/quest-home",
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const log: any[] = [];
  try {
    const token = Deno.env.get("Token_Test");
    if (!token) throw new Error("Token_Test secret missing");

    const body = await req.json().catch(() => ({}));
    const mobile = !!body.mobileHeaders;
    const wantMobileTask = !!body.mobile;
    const beats = body.beats ?? 4;

    const qRes = await fetch(`${DISCORD_API}/quests/@me`, { headers: headers(token, mobile) });
    if (!qRes.ok) throw new Error(`quests/@me ${qRes.status} ${await qRes.text()}`);
    const qData = await qRes.json();
    const now = new Date();

    const wanted = wantMobileTask ? "WATCH_VIDEO_ON_MOBILE" : "WATCH_VIDEO";
    const candidates = (qData.quests || []).filter((q: any) => {
      const tasks = q.config?.task_config_v2?.tasks || q.config?.task_config?.tasks || {};
      if (!tasks[wanted]) return false;
      const exp = q.config?.expires_at;
      if (exp && new Date(exp) < now) return false;
      if (q.user_status?.completed_at) return false;
      return true;
    });

    log.push({
      totalQuests: (qData.quests || []).length,
      videoCandidates: candidates.map((q: any) => ({
        id: q.id, name: q.config?.messages?.quest_name,
        tasks: Object.keys(q.config?.task_config_v2?.tasks || q.config?.task_config?.tasks || {}),
        enrolled: !!q.user_status?.enrolled_at,
        progress: q.user_status?.progress,
      })),
    });

    const quest = body.questId
      ? candidates.find((q: any) => q.id === body.questId)
      : candidates[0];
    if (!quest) return new Response(JSON.stringify({ ok: false, reason: "no video quest available", log }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const tasks = quest.config?.task_config_v2?.tasks || quest.config?.task_config?.tasks || {};
    const target = tasks[wanted]?.target || 0;

    // enroll if needed
    if (!quest.user_status?.enrolled_at) {
      const eBody: Record<string, unknown> = { location: 11 };
      if (quest.traffic_metadata_sealed) eBody.traffic_metadata_sealed = quest.traffic_metadata_sealed;
      const eRes = await fetch(`${DISCORD_API}/quests/${quest.id}/enroll`, {
        method: "POST", headers: headers(token, mobile), body: JSON.stringify(eBody),
      });
      log.push({ enroll: eRes.status, text: (await eRes.text()).slice(0, 400) });
    } else {
      log.push({ enroll: "already enrolled" });
    }

    // video progress beats with 7x speed-up capped at real elapsed + 10s
    const startReal = Date.now();
    const prog = quest.user_status?.progress || {};
    const base = Math.max(prog?.WATCH_VIDEO?.value || 0, prog?.WATCH_VIDEO_ON_MOBILE?.value || 0);
    let ts = base;
    for (let i = 0; i < beats; i++) {
      const elapsed = (Date.now() - startReal) / 1000;
      const allowed = base + elapsed + 8;
      ts = Math.min(target, Math.max(ts, Math.min(allowed, ts + 7 * 6)));
      const pRes = await fetch(`${DISCORD_API}/quests/${quest.id}/video-progress`, {
        method: "POST", headers: headers(token, mobile),
        body: JSON.stringify({ timestamp: Math.floor(ts) }),
      });
      const text = await pRes.text();
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch { /* ignore */ }
      log.push({
        beat: i + 1, sentTimestamp: Math.floor(ts), status: pRes.status,
        progress: parsed?.progress ?? null,
        error: pRes.ok ? undefined : text.slice(0, 400),
      });
      if (!pRes.ok) break;
      const v = parsed?.progress?.[wanted] || parsed?.progress?.WATCH_VIDEO || parsed?.progress?.WATCH_VIDEO_ON_MOBILE;
      if (v?.value != null) ts = Math.max(ts, v.value);
      if (v?.completed_at) { log.push({ completed: true }); break; }
      await sleep(2000);
    }

    return new Response(JSON.stringify({ ok: true, questId: quest.id, method: wanted, target, log }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e), log }, null, 2), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
