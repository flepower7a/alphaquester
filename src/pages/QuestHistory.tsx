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
    { value: "paused", label: "موقف" },
    { value: "failed", label: "فشل" },
    { value: "stopped", label: "متوقف" },
  ];

  const statusColors: Record<string, string> = {
    completed: "bg-success/10 text-success",
    running: "bg-primary/10 text-primary",
    failed: "bg-destructive/10 text-destructive",
    stopped: "bg-muted text-muted-foreground",
    paused: "bg-warning/10 text-warning",
    pending: "bg-muted text-muted-foreground",
  };
  const statusLabels: Record<string, string> = {
    completed: "مكتمل", running: "نشط", failed: "فشل",
    stopped: "متوقف", paused: "موقف", pending: "معلق",
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-black text-foreground">سجل المهمات</h1>
      </div>

      {/* Filters — pill style */}
      <div className="flex gap-1.5 flex-wrap">
        {filters.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 ${
              filter === f.value
                ? "bg-primary/12 text-primary"
                : "bg-card/50 text-muted-foreground hover:text-foreground border border-border/15"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Sessions — table-like rows */}
      {sessions.length === 0 ? (
        <div className="rounded-2xl bg-card/30 border border-border/15 p-10 text-center">
          <History className="w-10 h-10 mx-auto text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">لا توجد جلسات</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-card/30 border border-border/15 overflow-hidden divide-y divide-border/10">
          {sessions.map((session, i) => (
            <motion.div key={session.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
              className="flex items-center gap-3 p-3 hover:bg-card/50 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/6 to-accent/4 flex items-center justify-center shrink-0">
                <img src="/emojis/quest.png" alt="" className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground truncate">{session.quest_name || session.quest_id}</p>
                <p className="text-[10px] text-muted-foreground truncate">{session.game_title} · {session.reward_name}</p>
              </div>
              <div className="flex items-center gap-3">
                {session.target > 0 && (
                  <div className="hidden sm:block w-20">
                    <div className="h-1 rounded-full bg-border/20 overflow-hidden">
                      <div className="h-full rounded-full bg-primary/50 transition-all"
                        style={{ width: `${Math.min(100, (session.progress / session.target) * 100)}%` }} />
                    </div>
                    <p className="text-[9px] text-muted-foreground text-center mt-0.5">{Math.round((session.progress / session.target) * 100)}%</p>
                  </div>
                )}
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${statusColors[session.status]}`}>
                  {statusLabels[session.status]}
                </span>
                <span className="text-[9px] text-muted-foreground hidden md:block whitespace-nowrap">
                  {new Date(session.created_at).toLocaleDateString("ar")}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
