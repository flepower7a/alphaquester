import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Key, Search, Swords, Play, Square, RefreshCw, Pause,
  CheckCircle, XCircle, Clock, Sparkles, Shield, RotateCcw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface QuestData {
  id: string;
  name: string;
  game_title: string;
  publisher: string;
  hero_image: string;
  reward_name: string;
  method: string;
  tasks: { id: string; type: string; target: number; current: number; percent: number; completed: boolean }[];
  expires_at: string;
  enrolled: boolean;
  completed: boolean;
  supported: boolean;
}

export default function QuestSolver() {
  const { user } = useAuth();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [quests, setQuests] = useState<QuestData[]>([]);
  const [selectedQuest, setSelectedQuest] = useState<QuestData | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string>("idle");
  const [logs, setLogs] = useState<string[]>([]);

  // Listen for real-time log updates
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`logs-${sessionId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "quest_logs",
        filter: `session_id=eq.${sessionId}`,
      }, (payload: any) => {
        setLogs((prev) => [...prev, payload.new.message]);
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "quest_sessions",
        filter: `id=eq.${sessionId}`,
      }, (payload: any) => {
        setSessionStatus(payload.new.status);
        if (payload.new.status === "completed") {
          toast.success("✅ تم إكمال المهمة بنجاح!");
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const fetchQuests = async () => {
    if (!token.trim()) {
      toast.error("أدخل التوكن أولاً");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-quests", {
        body: { token },
      });
      if (error) throw error;
      if (data?.quests) {
        setQuests(data.quests);
        if (data.quests.length > 0) {
          setSelectedQuest(data.quests[0]);
        }
        toast.success(`تم جلب ${data.quests.length} مهمة`);
      } else {
        toast.info("لا توجد مهمات متاحة");
      }
    } catch (err: any) {
      toast.error(err.message || "خطأ في جلب المهمات");
    } finally {
      setLoading(false);
    }
  };

  const startSolving = async () => {
    if (!selectedQuest || !user) return;
    setSessionStatus("running");
    setLogs(["⏳ جاري بدء حل المهمة..."]);

    try {
      const { data, error } = await supabase.functions.invoke("start-quest", {
        body: {
          token,
          questId: selectedQuest.id,
          method: selectedQuest.method,
        },
      });
      if (error) throw error;
      if (data?.session?.id) {
        setSessionId(data.session.id);
      }
      setLogs((prev) => [...prev, "✅ تم بدء حل المهمة بنجاح"]);
      toast.success("تم بدء حل المهمة!");
    } catch (err: any) {
      setLogs((prev) => [...prev, `❌ خطأ: ${err.message}`]);
      toast.error(err.message || "خطأ في بدء المهمة");
      setSessionStatus("idle");
    }
  };

  const controlQuest = async (action: "pause" | "resume" | "stop") => {
    if (!sessionId) return;
    try {
      const { data, error } = await supabase.functions.invoke("pause-quest", {
        body: { sessionId, action },
      });
      if (error) throw error;
      setSessionStatus(data.status);
      setLogs((prev) => [...prev, data.message]);
      toast.success(data.message);
      if (action === "stop") {
        setSessionId(null);
        setSessionStatus("idle");
      }
    } catch (err: any) {
      toast.error(err.message || "خطأ في التحكم بالمهمة");
    }
  };

  const isActive = sessionStatus === "running" || sessionStatus === "paused";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary/20 glow-sm">
            <Swords className="w-6 h-6 text-primary" />
          </div>
          حل المهمات
        </h1>
        <p className="text-muted-foreground mt-1">أدخل التوكن وابدأ بحل المهمات تلقائياً</p>
      </motion.div>

      {/* Token Input */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-3xl p-6"
      >
        <Label className="text-foreground/80 mb-3 block flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          توكن الوصول
        </Label>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="أدخل توكن Discord الخاص بك"
              className="pl-10 h-12 rounded-2xl bg-secondary/50 border-border/50"
              disabled={isActive}
            />
          </div>
          <Button
            onClick={fetchQuests}
            disabled={loading || isActive}
            className="h-12 px-6 rounded-2xl bg-primary hover:bg-primary/90 glow-sm"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                جلب المهمات
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <Shield className="w-3 h-3" />
          التوكن لا يُخزن ويُستخدم فقط لجلب المهمات
        </p>
      </motion.div>

      {/* Quests Grid */}
      <AnimatePresence>
        {quests.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {quests.map((quest, i) => (
              <motion.div
                key={quest.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => !isActive && setSelectedQuest(quest)}
                className={`glass rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 hover:glow-sm ${
                  selectedQuest?.id === quest.id ? "ring-2 ring-primary glow-primary" : ""
                }`}
              >
                {quest.hero_image && (
                  <div className="h-32 overflow-hidden">
                    <img src={quest.hero_image} alt={quest.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-foreground">{quest.name}</h3>
                      <p className="text-sm text-muted-foreground">{quest.game_title}</p>
                    </div>
                    {quest.completed ? (
                      <CheckCircle className="w-5 h-5 text-success" />
                    ) : quest.supported ? (
                      <Sparkles className="w-5 h-5 text-primary" />
                    ) : (
                      <XCircle className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm text-primary font-medium">{quest.reward_name}</p>
                  {quest.tasks?.map((task) => (
                    <div key={task.id} className="mt-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{task.id.replace(/_/g, " ")}</span>
                        <span>{task.percent}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${task.percent}%` }}
                          className="h-full rounded-full bg-primary"
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  ))}
                  {quest.expires_at && (
                    <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      تنتهي: {new Date(quest.expires_at).toLocaleDateString("ar")}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      {selectedQuest && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-3xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">{selectedQuest.name}</h3>
              <p className="text-sm text-muted-foreground">{selectedQuest.game_title}</p>
              {isActive && (
                <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${
                  sessionStatus === "running" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
                }`}>
                  {sessionStatus === "running" ? "قيد التشغيل" : "متوقف مؤقتاً"}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {sessionStatus === "idle" && (
                <Button
                  onClick={startSolving}
                  disabled={!selectedQuest.supported || selectedQuest.completed}
                  className="rounded-2xl bg-success hover:bg-success/90 text-success-foreground glow-sm"
                >
                  <Play className="w-4 h-4 mr-2" />
                  بدء الحل
                </Button>
              )}
              {sessionStatus === "running" && (
                <>
                  <Button
                    onClick={() => controlQuest("pause")}
                    className="rounded-2xl bg-warning hover:bg-warning/90 text-warning-foreground"
                  >
                    <Pause className="w-4 h-4 mr-2" />
                    إيقاف مؤقت
                  </Button>
                  <Button
                    onClick={() => controlQuest("stop")}
                    variant="destructive"
                    className="rounded-2xl"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    إيقاف نهائي
                  </Button>
                </>
              )}
              {sessionStatus === "paused" && (
                <>
                  <Button
                    onClick={() => controlQuest("resume")}
                    className="rounded-2xl bg-success hover:bg-success/90 text-success-foreground glow-sm"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    استئناف
                  </Button>
                  <Button
                    onClick={() => controlQuest("stop")}
                    variant="destructive"
                    className="rounded-2xl"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    إيقاف نهائي
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Logs */}
          {logs.length > 0 && (
            <div className="bg-background/80 rounded-2xl p-4 font-mono text-sm max-h-64 overflow-y-auto space-y-1">
              {logs.map((log, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-muted-foreground"
                >
                  <span className="text-primary/50">[{i + 1}]</span> {log}
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
