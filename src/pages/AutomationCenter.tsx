import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Activity, RefreshCw, Bot, Zap, Brush, Square, RotateCcw,
  CheckCircle2, XCircle, Clock, Cpu, Trash2, ShieldCheck, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SessionRow {
  id: string;
  quest_name: string | null;
  game_title: string | null;
  method: string | null;
  status: string;
  progress: number | null;
  target: number | null;
  last_beat_at: string | null;
  started_at: string | null;
  created_at: string;
  error_message: string | null;
}

const METHOD_LABELS: Record<string, string> = {
  WATCH_VIDEO: "مشاهدة فيديو",
  WATCH_VIDEO_ON_MOBILE: "مشاهدة فيديو (جوال)",
  PLAY_ON_DESKTOP: "لعب على الكمبيوتر",
  STREAM_ON_DESKTOP: "بث على الكمبيوتر",
  PLAY_ACTIVITY: "نشاط داخل ديسكورد",
  ACHIEVEMENT_IN_ACTIVITY: "إنجاز داخل نشاط",
  PLAY_ON_XBOX: "لعب على Xbox",
  PLAY_ON_PLAYSTATION: "لعب على PlayStation",
};

const SUPPORT_MATRIX = [
  { type: "WATCH_VIDEO", ok: true, note: "يُحل تلقائياً بنبضات آمنة" },
  { type: "WATCH_VIDEO_ON_MOBILE", ok: true, note: "يُحل تلقائياً بنفس آلية الفيديو" },
  { type: "PLAY_ON_DESKTOP", ok: true, note: "نبضة كل دقيقة حتى إكمال المدة" },
  { type: "STREAM_ON_DESKTOP", ok: true, note: "نبضة مع مفتاح قناة حقيقي" },
  { type: "PLAY_ACTIVITY", ok: true, note: "نبضة مع مفتاح قناة حقيقي" },
  { type: "ACHIEVEMENT_IN_ACTIVITY", ok: false, note: "ديسكورد يقبل التقدم من اللعبة فقط (bots only) — تحتاج لعبها بنفسك" },
  { type: "PLAY_ON_XBOX", ok: false, note: "يتطلب ربط حساب Xbox" },
  { type: "PLAY_ON_PLAYSTATION", ok: false, note: "يتطلب ربط حساب PlayStation" },
];

const STALE_MS = 10 * 60 * 1000;

export default function AutomationCenter() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [stats, setStats] = useState({ running: 0, stale: 0, completed_today: 0, failed_today: 0, tokens: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: rows }, { data: overview }] = await Promise.all([
      supabase
        .from("quest_sessions")
        .select("id, quest_name, game_title, method, status, progress, target, last_beat_at, started_at, created_at, error_message")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(60),
      supabase.rpc("get_automation_overview"),
    ]);
    setSessions((rows as SessionRow[]) || []);
    if (overview) setStats(overview as any);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Live updates + light auto-refresh so the numbers always reflect reality
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("automation-center")
      .on("postgres_changes", { event: "*", schema: "public", table: "quest_sessions", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    const interval = setInterval(load, 20000);
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, [user, load]);

  const runAction = async (action: string, label: string) => {
    setBusy(action);
    try {
      const { data, error } = await supabase.functions.invoke("automation-control", { body: { action } });
      if (error) throw error;
      const r = data?.result ?? data;
      const detail = r?.totalCreated != null ? `مهام جديدة: ${r.totalCreated}`
        : r?.heartbeats != null ? `نبضات: ${r.heartbeats} • مكتملة: ${r.completed}`
        : r?.swept != null ? `تم تنظيف ${r.swept}`
        : data?.stopped != null ? `تم إيقاف ${data.stopped}`
        : data?.retried != null ? `تم إعادة ${data.retried}`
        : data?.deleted != null ? `تم حذف ${data.deleted}`
        : "";
      toast.success(`${label} ✅ ${detail}`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || `فشل: ${label}`);
    } finally {
      setBusy(null);
    }
  };

  const running = useMemo(() => sessions.filter((s) => s.status === "running"), [sessions]);
  const isStale = (s: SessionRow) =>
    Date.now() - new Date(s.last_beat_at || s.started_at || s.created_at).getTime() > STALE_MS;
  const staleCount = running.filter(isStale).length;

  const cards = [
    { label: "مهام نشطة", value: running.length, icon: Activity, tone: "text-primary" },
    { label: "مهام متوقفة فعلياً", value: staleCount, icon: AlertTriangle, tone: "text-amber-400" },
    { label: "مكتملة (24س)", value: stats.completed_today, icon: CheckCircle2, tone: "text-emerald-400" },
    { label: "فاشلة (24س)", value: stats.failed_today, icon: XCircle, tone: "text-destructive" },
    { label: "توكنات فعالة", value: stats.tokens, icon: Cpu, tone: "text-accent" },
  ];

  const actions = [
    { action: "run_check", label: "فحص المهام الآن", icon: Bot, hint: "يفحص كل التوكنات معاً ويقبل المهام تلقائياً" },
    { action: "run_heartbeat", label: "نبضة فورية", icon: Zap, hint: "يدفع تقدم كل المهام النشطة بالتوازي" },
    { action: "sweep", label: "تنظيف المعلّقة", icon: Brush, hint: "يوقف الجلسات بدون نشاط لأكثر من 10 دقائق" },
    { action: "stop_all", label: "إيقاف الكل", icon: Square, hint: "يوقف كل الجلسات النشطة فوراً" },
    { action: "retry_failed", label: "إعادة المحاولة", icon: RotateCcw, hint: "يعيد تشغيل الجلسات الفاشلة بدون تقدم" },
    { action: "clear_history", label: "حذف الفاشلة", icon: Trash2, hint: "ينظّف سجلات الجلسات الفاشلة والمتوقفة" },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            مركز التحكم الآلي
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            تحكم كامل بمحرك الحل التلقائي: تشغيل فوري، تنظيف، ومتابعة حقيقية لكل جلسة.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          تحديث
        </Button>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl bg-card/60 border border-border/40 p-4 backdrop-blur-xl"
          >
            <c.icon className={cn("w-4 h-4 mb-2", c.tone)} />
            <p className="text-2xl font-extrabold text-foreground">{c.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{c.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Quick actions */}
      <section className="rounded-2xl bg-card/60 border border-border/40 p-4 backdrop-blur-xl">
        <h2 className="text-sm font-bold text-foreground mb-3">أوامر سريعة</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {actions.map((a) => (
            <button
              key={a.action}
              onClick={() => runAction(a.action, a.label)}
              disabled={!!busy}
              className="text-right rounded-xl border border-border/40 bg-muted/20 hover:bg-primary/10 hover:border-primary/30 transition-all p-3 disabled:opacity-50"
            >
              <div className="flex items-center gap-2 mb-1">
                <a.icon className={cn("w-4 h-4 text-primary", busy === a.action && "animate-spin")} />
                <span className="text-[13px] font-bold text-foreground">{a.label}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{a.hint}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Live sessions */}
      <section className="rounded-2xl bg-card/60 border border-border/40 p-4 backdrop-blur-xl">
        <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          الجلسات النشطة ({running.length})
        </h2>
        {running.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">لا توجد جلسات نشطة الآن.</p>
        ) : (
          <div className="space-y-2">
            {running.map((s) => {
              const pct = s.target && s.target > 0
                ? Math.min(100, Math.floor(((s.progress || 0) / s.target) * 100)) : 0;
              const stale = isStale(s);
              return (
                <div key={s.id} className="rounded-xl border border-border/30 bg-muted/10 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-foreground truncate">
                        {(s.quest_name || "").replace("[AUTO] ", "")}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {METHOD_LABELS[s.method || ""] || s.method || "—"} • {s.progress || 0}/{s.target || 0}
                      </p>
                    </div>
                    <span className={cn(
                      "shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1",
                      stale ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400"
                    )}>
                      <Clock className="w-3 h-3" />
                      {stale ? "بدون نشاط" : "يعمل"}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                    <div className="h-full bg-gradient-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  {s.error_message && (
                    <p className="text-[10px] text-destructive mt-1.5">{s.error_message}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Support matrix */}
      <section className="rounded-2xl bg-card/60 border border-border/40 p-4 backdrop-blur-xl">
        <h2 className="text-sm font-bold text-foreground mb-3">أنواع المهام والدعم</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {SUPPORT_MATRIX.map((m) => (
            <div key={m.type} className="flex items-start gap-2 rounded-xl border border-border/30 bg-muted/10 p-3">
              {m.ok
                ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                : <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />}
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-foreground">{METHOD_LABELS[m.type] || m.type}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{m.note}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
