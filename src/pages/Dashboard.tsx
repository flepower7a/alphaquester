import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Key, Search, Swords, Play, Square, RefreshCw, Pause,
  CheckCircle, XCircle, Clock, Shield, RotateCcw,
  Plus, Trash2, Zap, Trophy, Activity, TrendingUp, User, ArrowRight, Gift
} from "lucide-react";
import {
  questTypeIcons, statusIcons, getBoostImage, getBoostLevel,
  getRewardIcon, boostLevels, boostLevelImages
} from "@/lib/emojis";
import ActivityFeed from "@/components/ActivityFeed";
import CountdownTimer from "@/components/CountdownTimer";
import { fireQuestComplete } from "@/lib/confetti";

interface TokenRecord {
  id: string;
  discord_user_id: string | null;
  discord_username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  boost_months: number;
  nitro_type: string | null;
  is_active: boolean;
}

interface QuestData {
  id: string;
  config_id?: string;
  name: string;
  game_title: string;
  publisher: string;
  hero_image: string | null;
  reward_name: string;
  method: string;
  tasks: { id: string; type: string; target: number; current: number; percent: number; completed: boolean }[];
  expires_at: string;
  enrolled: boolean;
  completed: boolean;
  supported: boolean;
}

interface SessionStats {
  totalSessions: number;
  completedSessions: number;
  runningSessions: number;
  totalSolved: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [tokens, setTokens] = useState<TokenRecord[]>([]);
  const [selectedToken, setSelectedToken] = useState<TokenRecord | null>(null);
  const [newToken, setNewToken] = useState("");
  const [addingToken, setAddingToken] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const [quests, setQuests] = useState<QuestData[]>([]);
  const [loadingQuests, setLoadingQuests] = useState(false);
  const [selectedQuest, setSelectedQuest] = useState<QuestData | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [completedQuestIds, setCompletedQuestIds] = useState<Set<string>>(new Set());
  const [liveProgress, setLiveProgress] = useState<{ progress: number; target: number } | null>(null);

  const [stats, setStats] = useState<SessionStats>({ totalSessions: 0, completedSessions: 0, runningSessions: 0, totalSolved: 0 });
  const [recentSessions, setRecentSessions] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    loadTokens();
    loadStats();
    loadRecentSessions();
    loadCompletedQuests();
  }, [user]);

  const loadTokens = async () => {
    const { data } = await supabase.from("discord_tokens")
      .select("id, discord_user_id, discord_username, display_name, avatar_url, boost_months, nitro_type, is_active")
      .eq("user_id", user!.id).eq("is_active", true);
    if (data) {
      setTokens(data as TokenRecord[]);
      if (data.length > 0 && !selectedToken) setSelectedToken(data[0] as TokenRecord);
    }
  };

  const loadStats = async () => {
    const { data: sessions } = await supabase.from("quest_sessions").select("status").eq("user_id", user!.id);
    const { data: profile } = await supabase.from("profiles").select("total_solved_quests").eq("user_id", user!.id).maybeSingle();
    if (sessions) {
      setStats({
        totalSessions: sessions.length,
        completedSessions: sessions.filter(s => s.status === "completed").length,
        runningSessions: sessions.filter(s => s.status === "running").length,
        totalSolved: profile?.total_solved_quests || 0,
      });
    }
  };

  const loadRecentSessions = async () => {
    const { data } = await supabase.from("quest_sessions").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(5);
    if (data) setRecentSessions(data);
  };

  const loadCompletedQuests = async () => {
    const { data } = await supabase.from("quest_sessions").select("quest_id").eq("user_id", user!.id).eq("status", "completed");
    if (data) setCompletedQuestIds(new Set(data.map(s => s.quest_id)));
  };

  const addToken = async () => {
    if (!newToken.trim()) return toast.error("أدخل التوكن");
    setAddingToken(true);
    try {
      const { data, error } = await supabase.functions.invoke("discord-user-info", { body: { token: newToken.trim(), action: "add" } });
      if (error) throw error;
      toast.success(`تم إضافة ${data.discord_user.display_name}`);
      setNewToken("");
      setShowAddModal(false);
      loadTokens();
    } catch (err: any) {
      toast.error(err.message || "توكن غير صالح");
    } finally {
      setAddingToken(false);
    }
  };

  const deleteToken = async (tokenId: string) => {
    try {
      const { error } = await supabase.functions.invoke("discord-user-info", { body: { action: "delete", tokenId } });
      if (error) throw error;
      toast.success("تم حذف التوكن");
      if (selectedToken?.id === tokenId) setSelectedToken(null);
      loadTokens();
    } catch { toast.error("خطأ في حذف التوكن"); }
  };

  const fetchQuests = async () => {
    if (!selectedToken) return toast.error("اختر توكن أولاً");
    setLoadingQuests(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-quests", { body: { tokenId: selectedToken.id } });
      if (error) throw error;
      if (data?.quests) {
        setQuests(data.quests);
        toast.success(`تم جلب ${data.quests.length} مهمة`);
      }
    } catch (err: any) {
      toast.error(err.message || "خطأ في جلب المهمات");
    } finally {
      setLoadingQuests(false);
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`logs-${sessionId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "quest_logs", filter: `session_id=eq.${sessionId}` },
        (payload: any) => setLogs(prev => [...prev, payload.new.message])
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "quest_sessions", filter: `id=eq.${sessionId}` },
        (payload: any) => {
          setSessionStatus(payload.new.status);
          if (payload.new.status === "completed") toast.success("✅ تم إكمال المهمة!");
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const stopPolling = () => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  };

  const resetQuestState = () => {
    stopPolling();
    setSessionId(null);
    setSessionStatus("idle");
    setLogs([]);
    setSelectedQuest(null);
    loadStats();
    loadRecentSessions();
    loadCompletedQuests();
  };

  const startPolling = (sid: string) => {
    stopPolling();
    const method = selectedQuest?.method;
    const delay = (method === "WATCH_VIDEO" || method === "WATCH_VIDEO_ON_MOBILE") ? 6000 : 31000;

    pollingRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("quest-heartbeat", { body: { sessionId: sid } });
        if (error) throw error;

        if (data?.progress !== undefined) {
          setLiveProgress({ progress: data.progress, target: data.target });
          setLogs(prev => [...prev, `📊 التقدم: ${data.progress}/${data.target}`]);
          setQuests(prev => prev.map(q => {
            if (q.id !== selectedQuest?.id) return q;
            return { ...q, tasks: q.tasks.map(t => ({ ...t, current: data.progress, percent: data.target > 0 ? Math.round((data.progress / data.target) * 100) : t.percent })) };
          }));
        }

        if (data?.done) {
          stopPolling();
          setSessionStatus(data.status);
          if (data.status === "completed") {
            toast.success("✅ تم إكمال المهمة بنجاح!");
            setLogs(prev => [...prev, "✅ تم إكمال المهمة بنجاح!"]);
            setTimeout(() => resetQuestState(), 3000);
          } else if (data.status === "failed") {
            setLogs(prev => [...prev, `❌ فشلت المهمة: ${data.error || ""}`]);
          }
        }
      } catch (err: any) {
        setLogs(prev => [...prev, `❌ خطأ: ${err.message}`]);
        stopPolling();
        setSessionStatus("failed");
      }
    }, delay);
  };

  const startSolving = async () => {
    if (!selectedQuest || !selectedToken) return;
    setSessionStatus("running");
    setLogs(["⏳ جاري بدء حل المهمة..."]);
    try {
      const { data, error } = await supabase.functions.invoke("start-quest", { body: { tokenId: selectedToken.id, questId: selectedQuest.id, method: selectedQuest.method } });
      if (error) throw error;
      if (data?.session?.id) {
        setSessionId(data.session.id);
        setLogs(prev => [...prev, "✅ تم إنشاء الجلسة، بدء إرسال heartbeats..."]);
        startPolling(data.session.id);
      }
    } catch (err: any) {
      setLogs(prev => [...prev, `❌ ${err.message}`]);
      setSessionStatus("idle");
    }
  };

  const controlQuest = async (action: "pause" | "resume" | "stop") => {
    if (!sessionId) return;
    try {
      const { data, error } = await supabase.functions.invoke("pause-quest", { body: { sessionId, action } });
      if (error) throw error;
      setSessionStatus(data.status);
      setLogs(prev => [...prev, data.message]);
      if (action === "stop") resetQuestState();
      else if (action === "pause") stopPolling();
      else if (action === "resume") startPolling(sessionId);
    } catch (err: any) { toast.error(err.message); }
  };

  const isActive = sessionStatus === "running" || sessionStatus === "paused";
  const isQuestCompleted = (questId: string) => completedQuestIds.has(questId);

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
      {/* Greeting + Stats — Bento Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Welcome card — spans 2 on mobile, 1 on desktop */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="col-span-2 lg:col-span-1 rounded-2xl bg-gradient-to-br from-primary/8 to-accent/4 border border-border/20 p-4 flex flex-col justify-center">
          <p className="text-xs text-muted-foreground mb-0.5">مرحباً 👋</p>
          <p className="text-sm font-bold text-foreground truncate">{user?.email?.split("@")[0]}</p>
        </motion.div>
        {[
          { icon: Swords, label: "جلسات", value: stats.totalSessions },
          { icon: Trophy, label: "مكتملة", value: stats.completedSessions },
          { icon: Activity, label: "نشطة", value: stats.runningSessions },
          { icon: TrendingUp, label: "إجمالي", value: stats.totalSolved },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * (i + 1) }}
            className="rounded-2xl bg-card/50 border border-border/20 p-4">
            <div className="flex items-center justify-between mb-1">
              <s.icon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-lg font-black text-foreground">{s.value}</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Add Token Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
            onClick={() => setShowAddModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 15 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="rounded-2xl bg-card border border-border/30 p-7 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <div className="text-center mb-5">
                <div className="w-12 h-12 rounded-xl bg-gradient-accent flex items-center justify-center mx-auto mb-3">
                  <img src={statusIcons.discord} alt="" className="w-7 h-7" />
                </div>
                <h2 className="text-lg font-bold text-foreground">إضافة توكن Discord</h2>
                <p className="text-xs text-muted-foreground mt-1">سيتم حفظه بشكل مشفر وآمن</p>
              </div>

              <div className="rounded-xl bg-warning/5 border border-warning/15 p-3 mb-4">
                <p className="text-xs text-warning font-medium flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 shrink-0" />⚠️ استخدم حساب وهمي (Alt Account)
                </p>
              </div>

              <div className="relative mb-4">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                <Input type="password" value={newToken} onChange={e => setNewToken(e.target.value)}
                  placeholder="أدخل توكن Discord" className="pl-10 h-11 rounded-xl bg-background/50 border-border/40 text-sm" />
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setShowAddModal(false)} variant="ghost" className="flex-1 h-10 rounded-xl border border-border/30 text-xs">إلغاء</Button>
                <Button onClick={addToken} disabled={addingToken} className="flex-1 h-10 rounded-xl bg-gradient-primary text-white text-xs hover:opacity-90">
                  {addingToken ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "حفظ"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Tokens — compact left panel */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="lg:col-span-4 rounded-2xl bg-card/50 border border-border/20 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold flex items-center gap-1.5">
              <img src={statusIcons.discord} alt="" className="w-4 h-4" />
              التوكنات
            </h2>
            <Button onClick={() => setShowAddModal(true)} size="sm" className="rounded-lg bg-primary/10 text-primary hover:bg-primary/15 text-[10px] h-7 px-2.5">
              <Plus className="w-3 h-3 ml-0.5" />إضافة
            </Button>
          </div>

          {tokens.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <img src={statusIcons.customer} alt="" className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-xs">أضف توكن للبدء</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tokens.map((t, i) => {
                const boostLevel = getBoostLevel(t.boost_months || 0);
                const isSelected = selectedToken?.id === t.id;
                return (
                  <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    onClick={() => setSelectedToken(t)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                      isSelected ? "bg-primary/8 border border-primary/20" : "bg-background/30 border border-transparent hover:border-border/30"
                    }`}>
                    <div className="relative">
                      {t.avatar_url ? (
                        <img src={t.avatar_url} alt="" className="w-9 h-9 rounded-lg object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-gradient-accent flex items-center justify-center">
                          <User className="w-4 h-4 text-white" />
                        </div>
                      )}
                      {(t.boost_months || 0) > 0 && (
                        <img src={getBoostImage(t.boost_months || 0)} alt="" className="absolute -bottom-1 -right-1 w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{t.display_name || t.discord_username || "Unknown"}</p>
                      <p className="text-[10px] text-muted-foreground truncate">@{t.discord_username}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive p-1 h-6 w-6 rounded-md"
                      onClick={(e) => { e.stopPropagation(); deleteToken(t.id); }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Recent Sessions below tokens */}
          <div className="mt-4 pt-4 border-t border-border/20">
            <h3 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
              <img src={statusIcons.log} alt="" className="w-3.5 h-3.5" />
              آخر الجلسات
            </h3>
            {recentSessions.length === 0 ? (
              <p className="text-[10px] text-muted-foreground text-center py-3">لا جلسات بعد</p>
            ) : (
              <div className="space-y-1.5">
                {recentSessions.map((session) => (
                  <div key={session.id} className="flex items-center gap-2 p-2 rounded-lg bg-background/20 hover:bg-background/40 transition-colors">
                    {session.hero_image ? (
                      <img src={session.hero_image} alt="" className="w-7 h-7 rounded-md object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = statusIcons.quest; }} />
                    ) : (
                      <img src={statusIcons.quest} alt="" className="w-7 h-7 rounded-md" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-foreground truncate">{session.quest_name || session.quest_id}</p>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${statusColors[session.status]}`}>
                      {statusLabels[session.status]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Quest Solver — main area */}
        {selectedToken && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="lg:col-span-8 rounded-2xl bg-card/50 border border-border/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold flex items-center gap-1.5">
                <img src={statusIcons.quest} alt="" className="w-4 h-4" />
                حل المهمات — {selectedToken.display_name || selectedToken.discord_username}
              </h2>
              <Button onClick={fetchQuests} disabled={loadingQuests || isActive}
                className="rounded-lg bg-primary/10 text-primary hover:bg-primary/15 text-[10px] h-7 px-2.5">
                {loadingQuests ? <RefreshCw className="w-3 h-3 animate-spin" /> : <><Search className="w-3 h-3 ml-0.5" />جلب</>}
              </Button>
            </div>

            {/* Quests Grid — smaller cards */}
            {quests.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <img src={statusIcons.quest} alt="" className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs">اضغط "جلب" لعرض المهمات المتاحة</p>
              </div>
            ) : (
            <AnimatePresence>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
                {quests.map((quest, i) => {
                  const rewardIcon = getRewardIcon(quest.reward_name);
                  const alreadyCompleted = quest.completed || isQuestCompleted(quest.id);
                  return (
                    <motion.div key={quest.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}
                      onClick={() => {
                        if (isActive) return;
                        setSelectedQuest(quest);
                        setLogs([]);
                        setSessionStatus("idle");
                        setSessionId(null);
                        setLiveProgress(null);
                      }}
                      className={`rounded-xl overflow-hidden cursor-pointer transition-all duration-200 border ${
                        selectedQuest?.id === quest.id ? "border-primary/30 bg-primary/[0.03]" : "border-border/15 hover:border-border/30"
                      } ${alreadyCompleted ? "opacity-50" : ""}`}>
                      {quest.hero_image && (
                        <div className="h-24 overflow-hidden relative">
                          <img src={quest.hero_image} alt={quest.name} className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          {alreadyCompleted && (
                            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-success/10 text-success text-[10px] font-semibold">
                                <CheckCircle className="w-3 h-3" />مكتملة
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="p-3">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-bold text-foreground text-xs leading-tight">{quest.name}</h3>
                          {alreadyCompleted ? (
                            <CheckCircle className="w-4 h-4 text-success shrink-0" />
                          ) : quest.supported ? (
                            <img src="/emojis/quest.png" alt="" className="w-4 h-4 shrink-0 opacity-50" />
                          ) : (
                            <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{quest.game_title}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {rewardIcon && <img src={rewardIcon} alt="" className="w-3.5 h-3.5" />}
                          <p className="text-[10px] text-primary/50 font-medium">{quest.reward_name}</p>
                        </div>

                        {quest.tasks?.map(task => {
                          const taskIcon = questTypeIcons[task.id];
                          return (
                            <div key={task.id} className="mt-2">
                              <div className="flex justify-between items-center text-[10px] text-muted-foreground mb-0.5">
                                <span className="flex items-center gap-1">
                                  {taskIcon && <img src={taskIcon} alt="" className="w-3 h-3" />}
                                  {task.id.replace(/_/g, " ")}
                                </span>
                                <span>{task.percent}%</span>
                              </div>
                              <div className="h-1 rounded-full bg-border/30 overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${task.percent}%` }}
                                  className="h-full rounded-full bg-primary/60" transition={{ duration: 0.6 }} />
                              </div>
                            </div>
                          );
                        })}

                        {quest.expires_at && (
                          <p className="text-[9px] text-muted-foreground mt-1.5 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(quest.expires_at).toLocaleDateString("ar")}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
            )}

            {/* Controls */}
            {selectedQuest && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-background/30 border border-border/15 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <img src={statusIcons.quest} alt="" className="w-5 h-5" />
                    <div>
                      <h3 className="font-bold text-foreground text-xs">{selectedQuest.name}</h3>
                      <p className="text-[10px] text-muted-foreground">{selectedQuest.game_title}</p>
                      {isActive && (
                        <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold ${sessionStatus === "running" ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning"}`}>
                          {sessionStatus === "running" ? "يعمل" : "موقف"}
                        </span>
                      )}
                      {sessionStatus === "completed" && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-success/10 text-success">✅ مكتملة</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {sessionStatus === "idle" && (
                      <Button onClick={startSolving}
                        disabled={!selectedQuest.supported || selectedQuest.completed || isQuestCompleted(selectedQuest.id)}
                        className="rounded-lg bg-gradient-primary text-white text-[10px] h-7 px-3 hover:opacity-90 disabled:opacity-30">
                        {isQuestCompleted(selectedQuest.id) || selectedQuest.completed ? (
                          <><CheckCircle className="w-3 h-3 ml-0.5" />مكتملة</>
                        ) : (
                          <><Play className="w-3 h-3 ml-0.5" />بدء</>
                        )}
                      </Button>
                    )}
                    {sessionStatus === "running" && (
                      <>
                        <Button onClick={() => controlQuest("pause")} className="rounded-lg bg-warning/8 text-warning hover:bg-warning/15 text-[10px] h-7 px-2.5 border border-warning/15">
                          <Pause className="w-3 h-3 ml-0.5" />إيقاف
                        </Button>
                        <Button onClick={() => controlQuest("stop")} className="rounded-lg bg-destructive/8 text-destructive hover:bg-destructive/15 text-[10px] h-7 px-2.5 border border-destructive/15">
                          <Square className="w-3 h-3 ml-0.5" />إنهاء
                        </Button>
                      </>
                    )}
                    {sessionStatus === "paused" && (
                      <>
                        <Button onClick={() => controlQuest("resume")} className="rounded-lg bg-gradient-primary text-white text-[10px] h-7 px-2.5 hover:opacity-90">
                          <RotateCcw className="w-3 h-3 ml-0.5" />استئناف
                        </Button>
                        <Button onClick={() => controlQuest("stop")} className="rounded-lg bg-destructive/8 text-destructive hover:bg-destructive/15 text-[10px] h-7 px-2.5 border border-destructive/15">
                          <Square className="w-3 h-3 ml-0.5" />إنهاء
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Logs */}
                <AnimatePresence>
                  {logs.length > 0 && sessionStatus !== "idle" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-background/50 rounded-lg p-2.5 font-mono text-[10px] max-h-36 overflow-y-auto space-y-0.5 border border-border/10 mt-2"
                    >
                      {logs.map((log, i) => (
                        <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-muted-foreground">
                          <span className="text-primary/25">[{i + 1}]</span> {log}
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
