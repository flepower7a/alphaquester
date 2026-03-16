import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Activity, CheckCircle, XCircle, Play, Pause, Square, Bell, Zap } from "lucide-react";

interface LogEntry {
  id: string;
  message: string;
  level: string;
  created_at: string;
  session_id: string;
}

const levelIcons: Record<string, typeof Activity> = {
  success: CheckCircle,
  error: XCircle,
  info: Zap,
};

const levelColors: Record<string, string> = {
  success: "text-success",
  error: "text-destructive",
  info: "text-primary",
};

export default function ActivityFeed() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (!user) return;

    // Load initial logs
    supabase
      .from("quest_logs")
      .select("id, message, level, created_at, session_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(15)
      .then(({ data }) => {
        if (data) setLogs(data);
      });

    // Subscribe to realtime
    const channel = supabase
      .channel("activity-feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "quest_logs",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          setLogs((prev) => [payload.new as LogEntry, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "الآن";
    if (mins < 60) return `${mins}د`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}س`;
    return `${Math.floor(hrs / 24)}ي`;
  };

  if (logs.length === 0) {
    return (
      <div className="text-center py-6">
        <Activity className="w-6 h-6 mx-auto text-muted-foreground/20 mb-2" />
        <p className="text-[10px] text-muted-foreground">لا نشاط بعد</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <AnimatePresence initial={false}>
        {logs.map((log) => {
          const Icon = levelIcons[log.level || "info"] || Zap;
          const color = levelColors[log.level || "info"] || "text-muted-foreground";
          return (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -10, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-background/30 transition-colors"
            >
              <Icon className={`w-3 h-3 mt-0.5 shrink-0 ${color}`} />
              <p className="text-[10px] text-muted-foreground flex-1 leading-relaxed truncate">
                {log.message}
              </p>
              <span className="text-[9px] text-muted-foreground/50 shrink-0">
                {timeAgo(log.created_at)}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
