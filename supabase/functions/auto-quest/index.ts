import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISCORD_API = "https://discord.com/api/v9";

/** Task types we can actually solve without a real Discord client. */
const SUPPORTED_QUESTS = [
  "WATCH_VIDEO", "WATCH_VIDEO_ON_MOBILE",
  "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY",
];

const VIDEO_TASKS = ["WATCH_VIDEO", "WATCH_VIDEO_ON_MOBILE"];
const QUEST_LOCATION = 11; // QUEST_HOME_DESKTOP

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run `worker` over `items` with bounded concurrency (fast but rate-limit safe). */
async function mapPool<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = await worker(items[i], i);
      } catch (e) {
        console.error("pool worker error:", e);
        results[i] = null as unknown as R;
      }
    }
  });
  await Promise.all(runners);
  return results;
}

/** Auto-accept (enroll) a quest for a token without any user interaction. */
async function enrollQuest(token: string, questId: string, quest: any): Promise<any | null> {
  try {
    const body: Record<string, unknown> = { location: QUEST_LOCATION };
    if (quest?.traffic_metadata_sealed) body.traffic_metadata_sealed = quest.traffic_metadata_sealed;
    if (quest?.metadata_sealed) body.metadata_sealed = quest.metadata_sealed;

    const res = await fetch(`${DISCORD_API}/quests/${questId}/enroll`, {
      method: "POST", headers: getDiscordHeaders(token), body: JSON.stringify(body),
    });
    if (res.ok) return await res.json().catch(() => ({}));
    const errText = await res.text().catch(() => "");
    if (res.status === 400 || res.status === 409) return {}; // most likely already enrolled
    console.error(`Enroll failed for ${questId}: ${res.status} ${errText}`);
    return null;
  } catch (e) {
    console.error("Enroll error:", e);
    return null;
  }
}

/** Discord requires `platform` + `location` on claim-reward; try the known variants. */
async function claimReward(token: string, questId: string): Promise<boolean> {
  const variants = [
    { platform: 0, location: QUEST_LOCATION },
    { platform: 1, location: QUEST_LOCATION },
    { platform: 2, location: QUEST_LOCATION },
  ];
  for (const v of variants) {
    try {
      const res = await fetch(`${DISCORD_API}/quests/${questId}/claim-reward`, {
        method: "POST", headers: getDiscordHeaders(token), body: JSON.stringify(v),
      });
      if (res.ok) return true;
      const txt = await res.text().catch(() => "");
      if (res.status === 400 && txt.includes("already")) return true;
    } catch { /* try next */ }
  }
  return false;
}

/** PLAY_ACTIVITY heartbeats need a real channel id in the stream key. */
const channelCache = new Map<string, string | null>();
async function getActivityChannelId(token: string): Promise<string | null> {
  if (channelCache.has(token)) return channelCache.get(token)!;
  let id: string | null = null;
  try {
    const res = await fetch(`${DISCORD_API}/users/@me/channels`, { headers: getDiscordHeaders(token) });
    if (res.ok) {
      const dms = await res.json();
      id = Array.isArray(dms) && dms[0]?.id ? dms[0].id : null;
    }
  } catch { /* ignore */ }
  channelCache.set(token, id);
  return id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const started = Date.now();
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let bodySafe: any = {};
    try { bodySafe = await req.json(); } catch { /* empty */ }
    const action = bodySafe?.action || "check";

    // === ACTION: sweep — stop sessions with no recent activity ===
    if (action === "sweep") {
      const minutes = Number(bodySafe?.minutes) >= 0 ? Number(bodySafe.minutes) : 10;
      if (bodySafe?.userId) {
        const cutoff = new Date(Date.now() - minutes * 60_000).toISOString();
        const { data: stale } = await supabase
          .from("quest_sessions")
          .select("id, last_beat_at, started_at, created_at")
          .eq("user_id", bodySafe.userId)
          .in("status", ["running", "pending"]);
        const ids = (stale || [])
          .filter((s: any) => new Date(s.last_beat_at || s.started_at || s.created_at).toISOString() < cutoff)
          .map((s: any) => s.id);
        if (ids.length) {
          await supabase.from("quest_sessions")
            .update({ status: "stopped", error_message: "تم إيقافها يدوياً: لا يوجد نشاط" })
            .in("id", ids);
        }
        return json({ success: true, swept: ids.length });
      }
      const { data, error } = await supabase.rpc("sweep_stale_quest_sessions", { p_minutes: minutes });
      if (error) throw error;
      return json({ success: true, swept: data ?? 0 });
    }

    // === ACTION: check — find new quests and create sessions for all tokens ===
    if (action === "check") {
      let usersQuery = supabase.from("profiles").select("user_id").eq("auto_quest_enabled", true);
      if (bodySafe?.userId) usersQuery = usersQuery.eq("user_id", bodySafe.userId);
      const { data: autoUsers } = await usersQuery;

      if (!autoUsers?.length) return json({ message: "No auto-quest users", totalCreated: 0 });

      const perUser = await mapPool(autoUsers, 4, (p) => checkAndCreateSessions(supabase, p.user_id));
      const totalCreated = perUser.reduce((a: number, b: any) => a + (b || 0), 0);
      return json({ success: true, users: autoUsers.length, totalCreated, ms: Date.now() - started });
    }

    // === ACTION: heartbeat — pulse every active auto session, all in parallel ===
    if (action === "heartbeat") {
      const onlySession = bodySafe?.sessionId;
      let query = supabase
        .from("quest_sessions")
        .select("*")
        .eq("status", "running")
        .not("token_id", "is", null);
      if (onlySession) query = query.eq("id", onlySession);
      else query = query.like("quest_name", "%[AUTO]%");
      if (bodySafe?.userId) query = query.eq("user_id", bodySafe.userId);

      const { data: activeSessions } = await query;
      if (!activeSessions?.length) return json({ message: "No active auto sessions", heartbeats: 0, completed: 0 });

      // Load every needed token in ONE query instead of one query per session.
      const tokenIds = [...new Set(activeSessions.map((s: any) => s.token_id))];
      const { data: tokenRows } = await supabase
        .from("discord_tokens").select("id, encrypted_token").in("id", tokenIds);
      const tokenMap = new Map((tokenRows || []).map((t: any) => [t.id, t.encrypted_token]));

      // Group by token: different tokens run fully in parallel, sessions of the
      // same token run one after another so Discord doesn't rate-limit it.
      const groups = new Map<string, any[]>();
      for (const s of activeSessions) {
        if (!groups.has(s.token_id)) groups.set(s.token_id, []);
        groups.get(s.token_id)!.push(s);
      }

      let heartbeats = 0, completed = 0, failed = 0;

      await mapPool([...groups.entries()], 10, async ([tokenId, sessions]) => {
        const discordToken = tokenMap.get(tokenId);
        if (!discordToken) {
          await supabase.from("quest_sessions")
            .update({ status: "failed", error_message: "التوكن غير موجود" })
            .in("id", sessions.map((s: any) => s.id));
          failed += sessions.length;
          return;
        }
        for (const session of sessions) {
          const r = await pulseSession(supabase, session, discordToken);
          if (r.beat) heartbeats++;
          if (r.completed) completed++;
          if (r.failed) failed++;
        }
      });

      return json({ success: true, sessions: activeSessions.length, heartbeats, completed, failed, ms: Date.now() - started });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Send progress for one session and persist the result. */
async function pulseSession(supabase: any, session: any, discordToken: string) {
  const method: string = session.method;
  const target: number = session.target || 0;
  const isVideo = VIDEO_TASKS.includes(method);
  let progressValue: number = session.progress || 0;
  let data: any = null;
  let ok = false;
  let lastStatus = 0;

  try {
    if (isVideo) {
      // Discord validates the reported watch time against real elapsed time,
      // so step by 8s every ~2.5s and stop as soon as it rejects the jump.
      const endpoint = `${DISCORD_API}/quests/${session.quest_id}/video-progress`;
      for (let i = 0; i < 16; i++) {
        const nextTimestamp = target > 0 ? Math.min(target, progressValue + 8) : progressValue + 8;
        const res = await fetch(endpoint, {
          method: "POST", headers: getDiscordHeaders(discordToken),
          body: JSON.stringify({ timestamp: nextTimestamp }),
        });
        lastStatus = res.status;
        if (!res.ok) {
          if (res.status === 400 && ok) break;
          if (res.status === 400 || res.status === 404) {
            const enrolled = await enrollQuest(discordToken, session.quest_id, null);
            if (enrolled) { await sleep(1200); continue; }
          }
          break;
        }
        ok = true;
        data = await res.json().catch(() => null);
        const tp = data?.progress?.[method] || data?.progress?.WATCH_VIDEO || data?.progress?.WATCH_VIDEO_ON_MOBILE;
        if (tp?.value != null) progressValue = Math.max(progressValue, tp.value);
        if (tp?.completed_at || (target > 0 && progressValue >= target)) break;
        await sleep(2500);
      }
    } else {
      let streamKey = `call:${session.quest_id}:1`;
      if (method === "PLAY_ACTIVITY" || method === "STREAM_ON_DESKTOP") {
        const channelId = await getActivityChannelId(discordToken);
        if (channelId) streamKey = `call:${channelId}:1`;
      }
      let res = await fetch(`${DISCORD_API}/quests/${session.quest_id}/heartbeat`, {
        method: "POST", headers: getDiscordHeaders(discordToken),
        body: JSON.stringify({ stream_key: streamKey, terminal: false }),
      });
      if (!res.ok && (res.status === 400 || res.status === 404)) {
        const enrolled = await enrollQuest(discordToken, session.quest_id, null);
        if (enrolled) {
          await sleep(1000);
          res = await fetch(`${DISCORD_API}/quests/${session.quest_id}/heartbeat`, {
            method: "POST", headers: getDiscordHeaders(discordToken),
            body: JSON.stringify({ stream_key: streamKey, terminal: false }),
          });
        }
      }
      lastStatus = res.status;
      ok = res.ok;
      if (ok) data = await res.json().catch(() => null);
    }

    if (!ok) {
      // Only give up on hard auth/permission errors; transient errors retry next round.
      if (lastStatus === 401 || lastStatus === 403) {
        await supabase.from("quest_sessions").update({
          status: "failed", last_beat_at: new Date().toISOString(),
          error_message: `Discord ${lastStatus}`,
        }).eq("id", session.id);
        await supabase.from("quest_logs").insert({
          session_id: session.id, user_id: session.user_id,
          message: `❌ [AUTO] فشل النبض: ${lastStatus}`, level: "error",
        });
        return { beat: false, completed: false, failed: true };
      }
      await supabase.from("quest_sessions")
        .update({ last_beat_at: new Date().toISOString(), error_message: `محاولة فاشلة: ${lastStatus}` })
        .eq("id", session.id);
      return { beat: false, completed: false, failed: false };
    }

    const tp = data?.progress?.[method]
      || (isVideo ? (data?.progress?.WATCH_VIDEO || data?.progress?.WATCH_VIDEO_ON_MOBILE) : null);
    const progress = Math.max(progressValue, tp?.value || 0);
    const isCompleted = !!tp?.completed_at || (target > 0 && progress >= target);

    await supabase.from("quest_sessions").update({
      progress,
      status: isCompleted ? "completed" : "running",
      completed_at: isCompleted ? new Date().toISOString() : null,
      last_beat_at: new Date().toISOString(),
      error_message: null,
    }).eq("id", session.id);

    await supabase.from("quest_logs").insert({
      session_id: session.id, user_id: session.user_id,
      message: isCompleted
        ? `✅ [AUTO] تم إكمال المهمة! ${progress}/${target}`
        : `📊 [AUTO] التقدم: ${progress}/${target}`,
      level: isCompleted ? "success" : "info",
    });

    if (isCompleted) {
      const claimed = await claimReward(discordToken, session.quest_id);
      if (claimed) {
        await supabase.from("quest_logs").insert({
          session_id: session.id, user_id: session.user_id,
          message: `🎁 [AUTO] تم استلام المكافأة تلقائياً!`, level: "success",
        });
      }
      const { data: p } = await supabase.from("profiles")
        .select("total_solved_quests").eq("user_id", session.user_id).maybeSingle();
      if (p) {
        await supabase.from("profiles").update({
          total_solved_quests: (p.total_solved_quests || 0) + 1,
        }).eq("user_id", session.user_id);
      }
    }

    return { beat: true, completed: isCompleted, failed: false };
  } catch (e) {
    console.error(`pulse error for session ${session.id}:`, e);
    return { beat: false, completed: false, failed: false };
  }
}

async function checkAndCreateSessions(supabase: any, userId: string): Promise<number> {
  const { data: allTokens } = await supabase
    .from("discord_tokens")
    .select("id, encrypted_token, discord_username")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!allTokens?.length) return 0;

  // Fetch the quest list for EVERY token in parallel (one call per token, no more
  // per-quest refetching). This is the main speed-up.
  const tokenStates = await mapPool(allTokens, 10, async (t: any) => {
    try {
      const res = await fetch(`${DISCORD_API}/quests/@me`, { headers: getDiscordHeaders(t.encrypted_token) });
      if (!res.ok) return { token: t, quests: [] as any[], ok: false };
      const d = await res.json();
      return { token: t, quests: d?.quests || [], ok: true };
    } catch {
      return { token: t, quests: [] as any[], ok: false };
    }
  });

  const healthy = tokenStates.filter((s: any) => s?.ok);
  if (!healthy.length) return 0;

  const now = new Date();

  // Existing sessions for this user in one query (avoids N queries).
  const { data: existingRows } = await supabase
    .from("quest_sessions")
    .select("quest_id, token_id, status")
    .eq("user_id", userId)
    .in("status", ["running", "completed"]);
  const existing = new Set((existingRows || []).map((r: any) => `${r.quest_id}|${r.token_id}`));

  const inserts: any[] = [];

  await mapPool(healthy, 10, async (state: any) => {
    const token = state.token;
    for (const q of state.quests) {
      const config = q.config;
      const expires = config?.expires_at;
      if (expires && new Date(expires) < now) continue;
      if (q.user_status?.completed_at) continue;

      const tasks = config?.task_config_v2?.tasks || config?.task_config?.tasks || {};
      const solveMethod = Object.keys(tasks).find((k) => SUPPORTED_QUESTS.includes(k));
      if (!solveMethod) continue; // e.g. ACHIEVEMENT_IN_ACTIVITY — Discord only lets the game grant it
      if (existing.has(`${q.id}|${token.id}`)) continue;

      let progress = q.user_status?.progress?.[solveMethod]?.value || 0;
      if (!q.user_status?.enrolled_at) {
        const status = await enrollQuest(token.encrypted_token, q.id, q);
        if (!status) continue;
        progress = status?.progress?.[solveMethod]?.value || progress;
      }

      const heroImage = config?.assets?.hero
        ? (config.assets.hero.startsWith("http") ? config.assets.hero : `https://cdn.discordapp.com/${config.assets.hero}`)
        : null;

      inserts.push({
        user_id: userId,
        token_id: token.id,
        quest_id: q.id,
        quest_name: `[AUTO] ${config?.messages?.quest_name || "Unknown"}`,
        game_title: config?.messages?.game_title || "",
        reward_name: config?.rewards_config?.rewards?.[0]?.messages?.name || "",
        method: solveMethod,
        status: "running",
        progress,
        target: tasks[solveMethod]?.target || 0,
        hero_image: heroImage,
        started_at: new Date().toISOString(),
        last_beat_at: new Date().toISOString(),
      });
      existing.add(`${q.id}|${token.id}`);
    }
  });

  if (!inserts.length) return 0;

  const { data: created } = await supabase.from("quest_sessions").insert(inserts).select("id, quest_name");
  if (created?.length) {
    await supabase.from("quest_logs").insert(created.map((s: any) => ({
      session_id: s.id, user_id: userId,
      message: `🤖 [AUTO] بدء حل "${(s.quest_name || "").replace("[AUTO] ", "")}" تلقائياً`,
      level: "info",
    })));
  }
  return created?.length || 0;
}
