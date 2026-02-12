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
  Plus, Trash2, Zap, Trophy, Activity, TrendingUp, User, ArrowRight
} from "lucide-react";
import {
  questTypeIcons, statusIcons, getBoostImage, getBoostLevel,
  getRewardIcon, boostLevels, boostLevelImages
} from "@/lib/emojis";

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

const cardClass = "rounded-3xl bg-card/80 border border-foreground/[0.06] backdrop-blur-2xl glow-white-sm card-hover";

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
    const { data } = await supabase.from("discord_tokens").select("*").eq("user_id", user!.id).eq("is_active", true);
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

  const getStoredToken = async (tokenId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("discord-user-info", { body: { action: "get_token", tokenId } });
      if (error) throw error;
      return data?.token || null;
    } catch { return null; }
  };

  const fetchQuests = async () => {
    if (!selectedToken) return toast.error("اختر توكن أولاً");
    setLoadingQuests(true);
    try {
      const token = await getStoredToken(selectedToken.id);
      if (!token) return toast.error("لم يتم العثور على التوكن");
      const { data, error } = await supabase.functions.invoke("fetch-quests", { body: { token } });
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

  // Realtime logs
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
  const storedTokenRef = useRef<string | null>(null);

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
        const token = storedTokenRef.current;
        if (!token) return;
        const { data, error } = await supabase.functions.invoke("quest-heartbeat", { body: { sessionId: sid, token } });
        if (error) throw error;

        if (data?.progress !== undefined) {
          setLiveProgress({ progress: data.progress, target: data.target });
          setLogs(prev => [...prev, `📊 التقدم: ${data.progress}/${data.target}`]);
          // Update quest tasks in real-time
          setQuests(prev => prev.map(q => {
            if (q.id !== selectedQuest?.id) return q;
            return {
              ...q,
              tasks: q.tasks.map(t => ({
                ...t,
                current: data.progress,
                percent: data.target > 0 ? Math.round((data.progress / data.target) * 100) : t.percent,
              })),
            };
          }));
        }

        if (data?.done) {
          stopPolling();
          setSessionStatus(data.status);
          if (data.status === "completed") {
            toast.success("✅ تم إكمال المهمة بنجاح!");
            setLogs(prev => [...prev, "✅ تم إكمال المهمة بنجاح!"]);
            // Auto-reset after 3 seconds
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
      const token = await getStoredToken(selectedToken.id);
      if (!token) { setSessionStatus("idle"); return toast.error("لم يتم العثور على التوكن"); }
      storedTokenRef.current = token;

      const { data, error } = await supabase.functions.invoke("start-quest", {
        body: { token, questId: selectedQuest.id, method: selectedQuest.method },
      });
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
      if (action === "stop") { resetQuestState(); }
      else if (action === "pause") { stopPolling(); }
      else if (action === "resume") { startPolling(sessionId); }
    } catch (err: any) { toast.error(err.message); }
  };

  const isActive = sessionStatus === "running" || sessionStatus === "paused";
  const isQuestCompleted = (questId: string) => completedQuestIds.has(questId);

  const statusColors: Record<string, string> = {
    completed: "bg-success/15 text-success border border-success/20",
    running: "bg-warning/15 text-warning border border-warning/20",
    failed: "bg-destructive/15 text-destructive border border-destructive/20",
    stopped: "bg-muted/50 text-muted-foreground border border-border/30",
    paused: "bg-foreground/5 text-foreground/70 border border-border/30",
    pending: "bg-secondary text-secondary-foreground border border-border/30",
  };
  const statusLabels: Record<string, string> = {
    completed: "مكتمل", running: "قيد التشغيل", failed: "فشل",
    stopped: "متوقف", paused: "متوقف مؤقتاً", pending: "معلق",
  };

  const statItems = [
    { icon: Swords, label: "إجمالي الجلسات", value: stats.totalSessions, emoji: statusIcons.quest },
    { icon: Trophy, label: "المهمات المكتملة", value: stats.completedSessions, emoji: statusIcons.success },
    { icon: Activity, label: "جلسات نشطة", value: stats.runningSessions, emoji: statusIcons.online },
    { icon: TrendingUp, label: "إجمالي الحلول", value: stats.totalSolved, emoji: statusIcons.check },
  ];

  return (
    <div className="space-y-5">
      {/* Header + Stats Row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <motion.div className="p-2.5 rounded-2xl bg-foreground/5 border border-border/40 glow-white-sm" whileHover={{ scale: 1.05 }}>
            <Zap className="w-6 h-6 text-foreground" />
          </motion.div>
          <div>
            <h1 className="text-xl font-bold text-foreground">مرحباً، {user?.email?.split("@")[0]} 👋</h1>
            <p className="text-muted-foreground text-xs">إليك ملخص نشاطك ولوحة التحكم</p>
          </div>
        </motion.div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {statItems.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className={cardClass + " p-4 group"}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground mb-0.5">{s.label}</p>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
              </div>
              <img src={s.emoji} alt="" className="w-7 h-7 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Floating Add Token Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md p-4"
            onClick={() => setShowAddModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="rounded-3xl bg-card border border-border/40 p-8 max-w-md w-full glow-white-lg" onClick={e => e.stopPropagation()}>
              <div className="text-center mb-6">
                <img src={statusIcons.discord} alt="" className="w-12 h-12 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-foreground">إضافة توكن Discord</h2>
                <p className="text-sm text-muted-foreground mt-2">أدخل التوكن وسيتم حفظه بشكل آمن</p>
              </div>

              <div className="rounded-2xl bg-warning/5 border border-warning/20 p-4 mb-5">
                <p className="text-sm text-warning font-medium flex items-center gap-2">
                  <Shield className="w-4 h-4 shrink-0" />⚠️ تنبيه مهم
                </p>
                <p className="text-xs text-warning/70 mt-1 leading-relaxed">
                  استخدم توكن حساب وهمي (Alt Account) وليس حسابك الأساسي تجنباً لأي مشاكل.
                </p>
              </div>

              <div className="relative mb-4">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="password" value={newToken} onChange={e => setNewToken(e.target.value)}
                  placeholder="أدخل توكن Discord هنا" className="pl-10 h-12 rounded-2xl bg-secondary/50 border-border/40 text-base" />
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setShowAddModal(false)} variant="ghost" className="flex-1 h-12 rounded-2xl border border-border/30">
                  إلغاء
                </Button>
                <Button onClick={addToken} disabled={addingToken} className="flex-1 h-12 rounded-2xl bg-foreground text-background hover:bg-foreground/90">
                  {addingToken ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>حفظ التوكن</>}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Layout: Two columns */}
      <div className="flex flex-col lg:flex-row gap-4">
      
      {/* Left Column: Tokens + Recent Sessions */}
      <div className="flex flex-col gap-4 lg:w-1/2 lg:min-w-0">

      {/* Token Management */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className={cardClass + " p-5"}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <img src={statusIcons.discord} alt="" className="w-5 h-5" />
            التوكنات المحفوظة
          </h2>
          <Button onClick={() => setShowAddModal(true)} size="sm" className="rounded-2xl bg-foreground/5 text-foreground hover:bg-foreground/10 border border-border/30">
            <Plus className="w-4 h-4 ml-1" />إضافة توكن
          </Button>
        </div>

        {tokens.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <img src={statusIcons.customer} alt="" className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد توكنات محفوظة</p>
            <p className="text-sm">أضف توكن Discord للبدء</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tokens.map((t, i) => {
              const boostLevel = getBoostLevel(t.boost_months || 0);
              const isSelected = selectedToken?.id === t.id;
              return (
                <motion.div key={t.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  onClick={() => setSelectedToken(t)}
                  className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-300 ${isSelected ? "bg-foreground/5 ring-1 ring-foreground/20 glow-white-sm" : "bg-secondary/30 hover:bg-secondary/50"}`}>
                  <div className="relative">
                    {t.avatar_url ? (
                      <img src={t.avatar_url} alt="" className="w-12 h-12 rounded-2xl object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-foreground/5 flex items-center justify-center">
                        <User className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    {(t.boost_months || 0) > 0 && (
                      <img src={getBoostImage(t.boost_months || 0)} alt={`Boost ${boostLevel}`}
                        className="absolute -bottom-1 -right-1 w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{t.display_name || t.discord_username || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground truncate">@{t.discord_username}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <img src={statusIcons.online} alt="" className="w-4 h-4" />
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive rounded-xl p-2 h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); deleteToken(t.id); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Recent Sessions - same column as tokens */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className={cardClass + " p-5"}>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <img src={statusIcons.log} alt="" className="w-5 h-5" />
          آخر الجلسات
        </h2>
        {recentSessions.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <img src={statusIcons.messages} alt="" className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">لا توجد جلسات بعد</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentSessions.map((session, i) => (
              <motion.div key={session.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-secondary/20 hover:bg-secondary/30 transition-all border border-border/10">
                {session.hero_image ? (
                  <img src={session.hero_image} alt="" className="w-9 h-9 rounded-xl object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = statusIcons.quest; }} />
                ) : (
                  <img src={statusIcons.quest} alt="" className="w-9 h-9 rounded-xl" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{session.quest_name || session.quest_id}</p>
                  <p className="text-xs text-muted-foreground truncate">{session.game_title || "مهمة"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {session.target > 0 && (
                    <span className="text-xs text-muted-foreground">{Math.round((session.progress / session.target) * 100)}%</span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[session.status]}`}>
                    {statusLabels[session.status]}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      </div>{/* End Left Column */}

      {/* Right Column: Quest Solver */}
      {selectedToken && (
        <div className="lg:w-1/2 lg:min-w-0">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className={cardClass + " p-5"}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <img src={statusIcons.quest} alt="" className="w-5 h-5" />
              حل المهمات — {selectedToken.display_name || selectedToken.discord_username}
            </h2>
            <Button onClick={fetchQuests} disabled={loadingQuests || isActive} className="rounded-2xl bg-foreground text-background hover:bg-foreground/90">
              {loadingQuests ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4 ml-1" />جلب المهمات</>}
            </Button>
          </div>

          {/* Quests Grid */}
          <AnimatePresence>
            {quests.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {quests.map((quest, i) => {
                  const rewardIcon = getRewardIcon(quest.reward_name);
                  const alreadyCompleted = quest.completed || isQuestCompleted(quest.id);
                  return (
                    <motion.div key={quest.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                      onClick={() => {
                        if (isActive) return;
                        setSelectedQuest(quest);
                        setLogs([]);
                        setSessionStatus("idle");
                        setSessionId(null);
                        setLiveProgress(null);
                      }}
                      className={`rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 border border-border/30 ${
                        selectedQuest?.id === quest.id ? "ring-1 ring-foreground/30 glow-white" : "bg-secondary/10 hover:bg-secondary/20"
                      } ${alreadyCompleted ? "opacity-60" : ""}`}>
                      {quest.hero_image && (
                        <div className="h-28 overflow-hidden relative">
                          <img src={quest.hero_image} alt={quest.name} className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          {alreadyCompleted && (
                            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/20 border border-success/30">
                                <CheckCircle className="w-4 h-4 text-success" />
                                <span className="text-xs text-success font-medium">مكتملة</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-semibold text-foreground text-sm">{quest.name}</h3>
                          {alreadyCompleted ? (
                            <CheckCircle className="w-5 h-5 text-success shrink-0" />
                          ) : quest.supported ? (
                            <img src="/emojis/quest.png" alt="" className="w-5 h-5 shrink-0 opacity-60" />
                          ) : (
                            <XCircle className="w-5 h-5 text-muted-foreground shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{quest.game_title}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {rewardIcon && <img src={rewardIcon} alt="" className="w-4 h-4" />}
                          <p className="text-xs text-foreground/60 font-medium">{quest.reward_name}</p>
                        </div>

                        {quest.tasks?.map(task => {
                          const taskIcon = questTypeIcons[task.id];
                          return (
                            <div key={task.id} className="mt-2">
                              <div className="flex justify-between items-center text-xs text-muted-foreground mb-1">
                                <span className="flex items-center gap-1">
                                  {taskIcon && <img src={taskIcon} alt="" className="w-3.5 h-3.5" />}
                                  {task.id.replace(/_/g, " ")}
                                </span>
                                <span>{task.percent}%</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-secondary/50 overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${task.percent}%` }}
                                  className="h-full rounded-full bg-foreground/80" transition={{ duration: 0.8 }} />
                              </div>
                            </div>
                          );
                        })}

                        {quest.expires_at && (
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            تنتهي: {new Date(quest.expires_at).toLocaleDateString("ar")}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls */}
          {selectedQuest && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-secondary/20 border border-border/20 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <img src={statusIcons.quest} alt="" className="w-6 h-6" />
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">{selectedQuest.name}</h3>
                    <p className="text-xs text-muted-foreground">{selectedQuest.game_title}</p>
                    {isActive && (
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${sessionStatus === "running" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                        {sessionStatus === "running" ? "قيد التشغيل" : "متوقف مؤقتاً"}
                      </span>
                    )}
                    {sessionStatus === "completed" && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-success/15 text-success">
                        ✅ مكتملة — يتم إعادة التعيين...
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {sessionStatus === "idle" && (
                    <Button onClick={startSolving} 
                      disabled={!selectedQuest.supported || selectedQuest.completed || isQuestCompleted(selectedQuest.id)}
                      className="rounded-2xl bg-foreground text-background hover:bg-foreground/90 text-sm disabled:opacity-30">
                      {isQuestCompleted(selectedQuest.id) || selectedQuest.completed ? (
                        <><CheckCircle className="w-4 h-4 ml-1" /> مكتملة مسبقاً</>
                      ) : (
                        <><Play className="w-4 h-4 ml-1" /> بدء</>
                      )}
                    </Button>
                  )}
                  {sessionStatus === "running" && (
                    <>
                      <Button onClick={() => controlQuest("pause")} className="rounded-2xl bg-warning/10 text-warning hover:bg-warning/20 border border-warning/20 text-sm">
                        <Pause className="w-4 h-4 ml-1" /> إيقاف مؤقت
                      </Button>
                      <Button onClick={() => controlQuest("stop")} className="rounded-2xl bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 text-sm">
                        <Square className="w-4 h-4 ml-1" /> إيقاف
                      </Button>
                    </>
                  )}
                  {sessionStatus === "paused" && (
                    <>
                      <Button onClick={() => controlQuest("resume")} className="rounded-2xl bg-foreground text-background hover:bg-foreground/90 text-sm">
                        <RotateCcw className="w-4 h-4 ml-1" /> استئناف
                      </Button>
                      <Button onClick={() => controlQuest("stop")} className="rounded-2xl bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 text-sm">
                        <Square className="w-4 h-4 ml-1" /> إيقاف
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
                    className="bg-background/60 rounded-2xl p-3 font-mono text-xs max-h-48 overflow-y-auto space-y-0.5 border border-border/20"
                  >
                    {logs.map((log, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} className="text-muted-foreground">
                        <span className="text-foreground/30">[{i + 1}]</span> {log}
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </motion.div>
        </div>
      )}

      </div>{/* End Main Layout */}
    </div>
  );
}
