import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Trophy, Swords, TrendingUp, Calendar, Target } from "lucide-react";
import { statusIcons } from "@/lib/emojis";

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
    const { data } = await supabase
      .from("quest_sessions")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });

    if (data) {
      setSessions(data);
      const completed = data.filter(s => s.status === "completed");
      const failed = data.filter(s => s.status === "failed");
      const running = data.filter(s => s.status === "running");
      
      let avgTime = "—";
      if (completed.length > 0) {
        const times = completed
          .filter(s => s.started_at && s.completed_at)
          .map(s => new Date(s.completed_at).getTime() - new Date(s.started_at).getTime());
        if (times.length > 0) {
          const avgMs = times.reduce((a, b) => a + b, 0) / times.length;
          const mins = Math.round(avgMs / 60000);
          avgTime = mins < 60 ? `${mins} دقيقة` : `${Math.round(mins / 60)} ساعة`;
        }
      }

      setStats({
        total: data.length,
        completed: completed.length,
        failed: failed.length,
        running: running.length,
        successRate: data.length > 0 ? Math.round((completed.length / data.length) * 100) : 0,
        avgCompletionTime: avgTime,
      });
    }
  };

  const cardClass = "rounded-3xl bg-card/80 border border-border/30 backdrop-blur-xl glow-white-sm card-hover";

  const statCards = [
    { label: "إجمالي المهمات", value: stats.total, icon: Target, emoji: statusIcons.quest },
    { label: "مكتملة", value: stats.completed, icon: Trophy, emoji: statusIcons.success },
    { label: "فاشلة", value: stats.failed, icon: Swords, emoji: statusIcons.fail },
    { label: "نسبة النجاح", value: `${stats.successRate}%`, icon: TrendingUp, emoji: statusIcons.check },
    { label: "نشطة حالياً", value: stats.running, icon: BarChart3, emoji: statusIcons.online },
    { label: "متوسط الإكمال", value: stats.avgCompletionTime, icon: Calendar, emoji: statusIcons.timer },
  ];

  // Get last 7 days activity
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
    <div className="max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <motion.div className="p-2.5 rounded-2xl bg-foreground/5 border border-border/40 glow-white-sm" whileHover={{ scale: 1.05 }}>
            <BarChart3 className="w-6 h-6 text-foreground" />
          </motion.div>
          الإحصائيات
        </h1>
        <p className="text-muted-foreground text-sm mt-1">نظرة شاملة على أدائك</p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className={cardClass + " p-5 group"}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
              </div>
              <img src={s.emoji} alt="" className="w-7 h-7 opacity-50 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Activity Chart */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className={cardClass + " p-6"}>
        <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          نشاط آخر 7 أيام
        </h2>
        <div className="flex items-end justify-between gap-2 h-40">
          {last7Days.map((day, i) => (
            <motion.div key={i} className="flex-1 flex flex-col items-center gap-2"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.05 }}>
              <div className="w-full flex flex-col items-center gap-1 flex-1 justify-end">
                <span className="text-xs text-muted-foreground">{day.count}</span>
                <motion.div 
                  className="w-full max-w-8 rounded-xl bg-foreground/10 border border-border/30 relative overflow-hidden"
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max((day.count / maxCount) * 100, 8)}%` }}
                  transition={{ duration: 0.6, delay: 0.6 + i * 0.05 }}
                >
                  {day.completed > 0 && (
                    <div className="absolute bottom-0 w-full bg-success/30 rounded-b-xl"
                      style={{ height: `${(day.completed / day.count) * 100}%` }} />
                  )}
                </motion.div>
              </div>
              <span className="text-xs text-muted-foreground">{day.date}</span>
            </motion.div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-foreground/10 border border-border/30" /> إجمالي</span>
          <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-success/30" /> مكتملة</span>
        </div>
      </motion.div>
    </div>
  );
}
