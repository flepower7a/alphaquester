import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Trophy, Swords, TrendingUp, Calendar, Target } from "lucide-react";

export default function StatsPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0, completed: 0, failed: 0, running: 0,
    successRate: 0, avgCompletionTime: "—",
  });

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    const { data } = await supabase.from("quest_sessions").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
    if (data) {
      setSessions(data);
      const completed = data.filter(s => s.status === "completed");
      const failed = data.filter(s => s.status === "failed");
      const running = data.filter(s => s.status === "running");
      let avgTime = "—";
      if (completed.length > 0) {
        const times = completed.filter(s => s.started_at && s.completed_at).map(s => new Date(s.completed_at).getTime() - new Date(s.started_at).getTime());
        if (times.length > 0) { const mins = Math.round(times.reduce((a, b) => a + b, 0) / times.length / 60000); avgTime = mins < 60 ? `${mins} دقيقة` : `${Math.round(mins / 60)} ساعة`; }
      }
      setStats({ total: data.length, completed: completed.length, failed: failed.length, running: running.length, successRate: data.length > 0 ? Math.round((completed.length / data.length) * 100) : 0, avgCompletionTime: avgTime });
    }
  };

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dayStr = date.toISOString().split("T")[0];
    const count = sessions.filter(s => s.created_at?.startsWith(dayStr)).length;
    const completed = sessions.filter(s => s.created_at?.startsWith(dayStr) && s.status === "completed").length;
    return { date: date.toLocaleDateString("ar", { weekday: "short" }), count, completed };
  });
  const maxCount = Math.max(...last7Days.map(d => d.count), 1);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-black text-foreground">الإحصائيات</h1>

      {/* Bento stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: "إجمالي", value: stats.total, icon: Target },
          { label: "مكتملة", value: stats.completed, icon: Trophy },
          { label: "فاشلة", value: stats.failed, icon: Swords },
          { label: "نسبة النجاح", value: `${stats.successRate}%`, icon: TrendingUp },
          { label: "نشطة", value: stats.running, icon: BarChart3 },
          { label: "متوسط الإكمال", value: stats.avgCompletionTime, icon: Calendar },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="rounded-2xl bg-card/50 border border-border/20 p-4">
            <div className="flex items-center justify-between mb-1">
              <s.icon className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <p className="text-xl font-black text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Activity chart */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="rounded-2xl bg-card/50 border border-border/20 p-5">
        <h2 className="text-sm font-bold mb-5 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-primary" />
          آخر 7 أيام
        </h2>
        <div className="flex items-end justify-between gap-2 h-32">
          {last7Days.map((day, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full flex flex-col items-center gap-0.5 flex-1 justify-end">
                <span className="text-[9px] text-muted-foreground">{day.count}</span>
                <motion.div
                  className="w-full max-w-6 rounded-md bg-primary/8 relative overflow-hidden"
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max((day.count / maxCount) * 100, 6)}%` }}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.04 }}
                >
                  {day.completed > 0 && (
                    <div className="absolute bottom-0 w-full bg-primary/40 rounded-b-md"
                      style={{ height: `${(day.completed / day.count) * 100}%` }} />
                  )}
                </motion.div>
              </div>
              <span className="text-[9px] text-muted-foreground">{day.date}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-3 text-[9px] text-muted-foreground">
          <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded bg-primary/8" /> إجمالي</span>
          <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded bg-primary/40" /> مكتملة</span>
        </div>
      </motion.div>
    </div>
  );
}
