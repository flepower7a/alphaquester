import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISCORD_API = "https://discord.com/api/v9";

function superProps(): string {
  return btoa(JSON.stringify({
    os: "Windows", browser: "Discord Client", device: "", system_locale: "en-US",
    browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9044 Chrome/120.0.6099.291 Electron/28.2.10 Safari/537.36",
    browser_version: "28.2.10", os_version: "10.0.19045", os_arch: "x64",
    app_arch: "x64", system_locale_2: "en-US", has_client_mods: false,
    client_build_number: 971383, native_build_number: 64451,
    client_event_source: null, release_channel: "stable",
  }));
}

function headers(token: string): Record<string, string> {
  return {
    accept: "*/*", "accept-language": "en-US,en;q=0.9",
    authorization: token.trim(), "content-type": "application/json",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9044 Chrome/120.0.6099.291 Electron/28.2.10 Safari/537.36",
    "x-super-properties": superProps(), "x-discord-locale": "en-US",
    "x-debug-options": "bugReporterEnabled",
    origin: "https://discord.com", referer: "https://discord.com/quest-home",
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const log: any[] = [];
  try {
    const token = Deno.env.get("Token_Test");
    if (!token) throw new Error("Token_Test missing");
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "list";

    const qRes = await fetch(`${DISCORD_API}/quests/@me`, { headers: headers(token) });
    if (!qRes.ok) throw new Error(`quests/@me ${qRes.status} ${(await qRes.text()).slice(0, 300)}`);
    const qData = await qRes.json();
    const now = new Date();

    const all = (qData.quests || []).map((q: any) => {
      const tasks = q.config?.task_config_v2?.tasks || q.config?.task_config?.tasks || {};
      return {
        id: q.id,
        name: q.config?.messages?.quest_name,
        tasks: Object.entries(tasks).map(([k, v]: any) => ({ type: k, target: v?.target })),
        expires: q.config?.expires_at,
        expired: q.config?.expires_at ? new Date(q.config.expires_at) < now : false,
        enrolled: !!q.user_status?.enrolled_at,
        completed: !!q.user_status?.completed_at,
        progress: q.user_status?.progress,
        applicationId: q.config?.application?.id || q.config?.application_id,
      };
    });

    if (mode === "list") {
      const pending = all.filter((q: any) => !q.expired && !q.completed);
      const types = [...new Set(all.flatMap((q: any) => q.tasks.map((t: any) => t.type)))];
      return new Response(JSON.stringify({ ok: true, count: all.length, allTaskTypes: types, pendingCount: pending.length, pending }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "probe") {
      const qid = body.questId || all.find((q: any) => !q.expired && !q.completed)?.id;
      const paths = body.paths || [
        "achievement-progress", "activity-progress", "progress", "quest-progress",
        "achievements", "task-progress", "complete", "claim-reward",
      ];
      for (const path of paths) {
        const r = await fetch(`${DISCORD_API}/quests/${qid}/${path}`, {
          method: "POST", headers: headers(token),
          body: JSON.stringify(body.payload ?? { achievement_id: 1, count: 1, value: 1 }),
        });
        log.push({ path, status: r.status, body: (await r.text()).slice(0, 250) });
        await sleep(700);
      }
      return new Response(JSON.stringify({ ok: true, questId: qid, log }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === mode: activity — solve a PLAY_ACTIVITY quest ===
    const wanted = body.taskType || "PLAY_ACTIVITY";
    const candidates = all.filter((q: any) =>
      !q.expired && !q.completed && q.tasks.some((t: any) => t.type === wanted));
    log.push({ candidates: candidates.map((c: any) => ({ id: c.id, name: c.name, target: c.tasks })) });
    const quest = body.questId ? candidates.find((c: any) => c.id === body.questId) : candidates[0];
    if (!quest) {
      return new Response(JSON.stringify({ ok: false, reason: `no ${wanted} quest`, log }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const target = quest.tasks.find((t: any) => t.type === wanted)?.target || 0;

    if (!quest.enrolled) {
      const eRes = await fetch(`${DISCORD_API}/quests/${quest.id}/enroll`, {
        method: "POST", headers: headers(token), body: JSON.stringify({ location: 11 }),
      });
      log.push({ enroll: eRes.status, body: (await eRes.text()).slice(0, 300) });
    } else log.push({ enroll: "already" });

    // Need a real channel id for the stream_key. Try existing DM channels first.
    let channelId: string | null = body.channelId || null;
    if (!channelId) {
      const dmRes = await fetch(`${DISCORD_API}/users/@me/channels`, { headers: headers(token) });
      if (dmRes.ok) {
        const dms = await dmRes.json();
        channelId = dms?.[0]?.id || null;
        log.push({ dmChannels: Array.isArray(dms) ? dms.length : 0, picked: channelId });
      } else {
        log.push({ dmError: dmRes.status });
      }
    }
    if (!channelId) {
      // fall back to guild voice channel
      const gRes = await fetch(`${DISCORD_API}/users/@me/guilds`, { headers: headers(token) });
      if (gRes.ok) {
        const guilds = await gRes.json();
        for (const g of (guilds || []).slice(0, 5)) {
          const cRes = await fetch(`${DISCORD_API}/guilds/${g.id}/channels`, { headers: headers(token) });
          if (!cRes.ok) continue;
          const chans = await cRes.json();
          const voice = (chans || []).find((c: any) => c.type === 2);
          if (voice) { channelId = voice.id; log.push({ voiceChannelFrom: g.name }); break; }
          await sleep(400);
        }
      }
    }
    log.push({ channelId });

    const beats = body.beats ?? 6;
    const streamKeys = channelId
      ? [`call:${channelId}:1`, `call:${channelId}:${quest.id}`]
      : [`call:${quest.id}:1`];

    let value = 0;
    let usedKey: string | null = null;
    for (const key of streamKeys) {
      const probe = await fetch(`${DISCORD_API}/quests/${quest.id}/heartbeat`, {
        method: "POST", headers: headers(token),
        body: JSON.stringify({ stream_key: key, terminal: false }),
      });
      const text = await probe.text();
      log.push({ probeKey: key, status: probe.status, body: text.slice(0, 400) });
      if (probe.ok) { usedKey = key; try { const p = JSON.parse(text); value = p?.progress?.[wanted]?.value || 0; } catch { /* */ } break; }
    }

    if (usedKey) {
      for (let i = 1; i < beats; i++) {
        await sleep(body.interval ?? 20000);
        const r = await fetch(`${DISCORD_API}/quests/${quest.id}/heartbeat`, {
          method: "POST", headers: headers(token),
          body: JSON.stringify({ stream_key: usedKey, terminal: false }),
        });
        const t = await r.text();
        let p: any = null; try { p = JSON.parse(t); } catch { /* */ }
        const tp = p?.progress?.[wanted];
        if (tp?.value != null) value = tp.value;
        log.push({ beat: i + 1, status: r.status, value, completed: !!tp?.completed_at, err: r.ok ? undefined : t.slice(0, 300) });
        if (!r.ok || tp?.completed_at) break;
      }
    }

    return new Response(JSON.stringify({ ok: !!usedKey, questId: quest.id, name: quest.name, taskType: wanted, target, value, usedKey, log }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e), log }, null, 2), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
