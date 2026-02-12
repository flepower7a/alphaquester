import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Swords, Trophy, Clock, TrendingUp, Zap, Activity } from "lucide-react";

interface Stats {
  totalSessions: number;
  completedSessions: number;
  runningSessions: number;
  totalSolved: number;
}

const StatCard = ({ icon: Icon, label, value, color, delay }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    className="glass rounded-3xl p-6 hover:glow-sm transition-all duration-300 group"
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <p className="text-3xl font-bold text-foreground">{value}</p>
      </div>
      <div className={`p-3 rounded-2xl ${color} transition-transform duration-300 group-hover:scale-110`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </motion.div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalSessions: 0,
    completedSessions: 0,
    runningSessions: 0,
    totalSolved: 0,
  });

  useEffect(() => {
    if (!user) return;
    
    const fetchStats = async () => {
      const { data: sessions } = await supabase
        .from("quest_sessions")
        .select("status")
        .eq("user_id", user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("total_solved_quests")
        .eq("user_id", user.id)
        .single();

      if (sessions) {
        setStats({
          totalSessions: sessions.length,
          completedSessions: sessions.filter((s) => s.status === "completed").length,
          runningSessions: sessions.filter((s) => s.status === "running").length,
          totalSolved: profile?.total_solved_quests || 0,
        });
      }
    };

    fetchStats();
  }, [user]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <div className="p-3 rounded-2xl bg-primary/20 glow-sm">
          <Zap className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            مرحباً، {user?.email?.split("@")[0]} 👋
          </h1>
          <p className="text-muted-foreground">إليك ملخص نشاطك</p>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Swords}
          label="إجمالي الجلسات"
          value={stats.totalSessions}
          color="bg-primary/20 text-primary"
          delay={0.1}
        />
        <StatCard
          icon={Trophy}
          label="المهمات المكتملة"
          value={stats.completedSessions}
          color="bg-success/20 text-success"
          delay={0.2}
        />
        <StatCard
          icon={Activity}
          label="جلسات نشطة"
          value={stats.runningSessions}
          color="bg-warning/20 text-warning"
          delay={0.3}
        />
        <StatCard
          icon={TrendingUp}
          label="إجمالي الحلول"
          value={stats.totalSolved}
          color="bg-accent/20 text-accent"
          delay={0.4}
        />
      </div>

      {/* Recent Sessions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass rounded-3xl p-6"
      >
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          آخر الجلسات
        </h2>
        <RecentSessions />
      </motion.div>
    </div>
  );
}

function RecentSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("quest_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setSessions(data);
      });
  }, [user]);

  const statusColors: Record<string, string> = {
    completed: "bg-success/20 text-success",
    running: "bg-warning/20 text-warning",
    failed: "bg-destructive/20 text-destructive",
    stopped: "bg-muted text-muted-foreground",
    pending: "bg-secondary text-secondary-foreground",
  };

  const statusLabels: Record<string, string> = {
    completed: "مكتمل",
    running: "قيد التشغيل",
    failed: "فشل",
    stopped: "متوقف",
    pending: "معلق",
  };

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Swords className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>لا توجد جلسات بعد</p>
        <p className="text-sm">ابدأ بحل مهمتك الأولى!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session, i) => (
        <motion.div
          key={session.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-center gap-4 p-4 rounded-2xl bg-secondary/30 hover:bg-secondary/50 transition-all"
        >
          {session.hero_image ? (
            <img src={session.hero_image} alt="" className="w-12 h-12 rounded-2xl object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Swords className="w-5 h-5 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">
              {session.quest_name || session.quest_id}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {session.game_title || "مهمة"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {session.target > 0 && (
              <span className="text-sm text-muted-foreground">
                {Math.round((session.progress / session.target) * 100)}%
              </span>
            )}
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[session.status]}`}>
              {statusLabels[session.status]}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
