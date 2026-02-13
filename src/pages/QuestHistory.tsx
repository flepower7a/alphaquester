import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { History, CheckCircle, XCircle, Clock } from "lucide-react";
import { statusIcons } from "@/lib/emojis";

export default function QuestHistory() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    const query = supabase.from("quest_sessions").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (filter !== "all") query.eq("status", filter);
    query.then(({ data }) => { if (data) setSessions(data); });
  }, [user, filter]);

  const filters = [
    { value: "all", label: "الكل" },
    { value: "completed", label: "مكتمل" },
    { value: "running", label: "نشط" },
    { value: "paused", label: "متوقف مؤقتاً" },
    { value: "failed", label: "فشل" },
    { value: "stopped", label: "متوقف" },
  ];

  const statusColors: Record<string, string> = {
    completed: "bg-success/15 text-success border border-success/20",
    running: "bg-primary/15 text-primary border border-primary/20",
    failed: "bg-destructive/15 text-destructive border border-destructive/20",
    stopped: "bg-muted/50 text-muted-foreground border border-border/30",
    paused: "bg-warning/15 text-warning border border-warning/20",
    pending: "bg-secondary text-secondary-foreground border border-border/30",
  };

  const statusLabels: Record<string, string> = {
    completed: "مكتمل", running: "قيد التشغيل", failed: "فشل",
    stopped: "متوقف", paused: "متوقف مؤقتاً", pending: "معلق",
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <motion.div className="p-2.5 rounded-xl bg-gradient-primary glow-sm" whileHover={{ scale: 1.05 }}>
            <History className="w-6 h-6 text-white" />
          </motion.div>
          سجل المهمات
        </h1>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
              filter === f.value
                ? "bg-gradient-primary text-white glow-sm"
                : "bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-primary/[0.08]"
            }`}>
            {f.label}
          </button>
        ))}
      </motion.div>

      {/* Sessions */}
      {sessions.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-modern rounded-2xl p-12 text-center">
          <History className="w-16 h-16 mx-auto text-primary/20 mb-4" />
          <p className="text-muted-foreground text-lg">لا توجد جلسات</p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session, i) => (
            <motion.div key={session.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="card-modern rounded-2xl p-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-accent flex items-center justify-center shrink-0">
                  <img src="/emojis/quest.png" alt="" className="w-8 h-8" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{session.quest_name || session.quest_id}</h3>
                  <p className="text-sm text-muted-foreground">{session.game_title}</p>
                  <p className="text-sm text-primary/60">{session.reward_name}</p>
                </div>
                <div className="text-right space-y-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium inline-block ${statusColors[session.status]}`}>
                    {statusLabels[session.status]}
                  </span>
                  {session.target > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">{Math.round((session.progress / session.target) * 100)}%</div>
                      <div className="w-24 h-1.5 rounded-full bg-secondary/50 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-primary transition-all"
                          style={{ width: `${Math.min(100, (session.progress / session.target) * 100)}%` }} />
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">{new Date(session.created_at).toLocaleDateString("ar")}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
