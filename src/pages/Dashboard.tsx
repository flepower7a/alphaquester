import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Key, Search, Swords, Play, Square, RefreshCw, Pause,
  CheckCircle, XCircle, Clock, Sparkles, Shield, RotateCcw,
  Plus, Trash2, Zap, Trophy, Activity, TrendingUp, User
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

export default function Dashboard() {
  const { user } = useAuth();
  const [tokens, setTokens] = useState<TokenRecord[]>([]);
  const [selectedToken, setSelectedToken] = useState<TokenRecord | null>(null);
  const [newToken, setNewToken] = useState("");
  const [addingToken, setAddingToken] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Quest solving state
  const [quests, setQuests] = useState<QuestData[]>([]);
  const [loadingQuests, setLoadingQuests] = useState(false);
  const [selectedQuest, setSelectedQuest] = useState<QuestData | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string>("idle");
  const [logs, setLogs] = useState<string[]>([]);

  // Stats
  const [stats, setStats] = useState<SessionStats>({ totalSessions: 0, completedSessions: 0, runningSessions: 0, totalSolved: 0 });

  // Recent sessions
  const [recentSessions, setRecentSessions] = useState<any[]>([]);

  // Load tokens
  useEffect(() => {
    if (!user) return;
    loadTokens();
    loadStats();
    loadRecentSessions();
  }, [user]);

  const loadTokens = async () => {
    const { data } = await supabase
      .from("discord_tokens")
      .select("*")
      .eq("user_id", user!.id)
      .eq("is_active", true);
    if (data) {
      setTokens(data as TokenRecord[]);
      if (data.length > 0 && !selectedToken) {
        setSelectedToken(data[0] as TokenRecord);
      }
    }
  };

  const loadStats = async () => {
    const { data: sessions } = await supabase
      .from("quest_sessions")
      .select("status")
      .eq("user_id", user!.id);
    const { data: profile } = await supabase
      .from("profiles")
      .select("total_solved_quests")
      .eq("user_id", user!.id)
      .maybeSingle();
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
    const { data } = await supabase
      .from("quest_sessions")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(5);
    if (data) setRecentSessions(data);
  };

  const addToken = async () => {
    if (!newToken.trim()) return toast.error("أدخل التوكن");
    setAddingToken(true);
    try {
      const { data, error } = await supabase.functions.invoke("discord-user-info", {
        body: { token: newToken.trim(), action: "add" },
      });
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
      const { error } = await supabase.functions.invoke("discord-user-info", {
        body: { action: "delete", tokenId },
      });
      if (error) throw error;
      toast.success("تم حذف التوكن");
      if (selectedToken?.id === tokenId) setSelectedToken(null);
      loadTokens();
    } catch { toast.error("خطأ في حذف التوكن"); }
  };

  // Get stored token from DB via edge function
  const getStoredToken = async (tokenId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("discord-user-info", {
        body: { action: "get_token", tokenId },
      });
      if (error) throw error;
      return data?.token || null;
    } catch { return null; }
  };

  // Quest fetching - uses stored token
  const fetchQuests = async () => {
    if (!selectedToken) return toast.error("اختر توكن أولاً");
    setLoadingQuests(true);
    try {
      const token = await getStoredToken(selectedToken.id);
      if (!token) return toast.error("لم يتم العثور على التوكن");
      const { data, error } = await supabase.functions.invoke("fetch-quests", {
        body: { token },
      });
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

  const startSolving = async () => {
    if (!selectedQuest || !selectedToken) return;
    setSessionStatus("running");
    setLogs(["⏳ جاري بدء حل المهمة..."]);
    try {
      const token = await getStoredToken(selectedToken.id);
      if (!token) { setSessionStatus("idle"); return toast.error("لم يتم العثور على التوكن"); }
      const { data, error } = await supabase.functions.invoke("start-quest", {
        body: { token, questId: selectedQuest.id, method: selectedQuest.method },
      });
      if (error) throw error;
      if (data?.session?.id) setSessionId(data.session.id);
      setLogs(prev => [...prev, "✅ تم بدء حل المهمة"]);
    } catch (err: any) {
      setLogs(prev => [...prev, `❌ ${err.message}`]);
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
      setLogs(prev => [...prev, data.message]);
      if (action === "stop") { setSessionId(null); setSessionStatus("idle"); }
    } catch (err: any) { toast.error(err.message); }
  };

  const isActive = sessionStatus === "running" || sessionStatus === "paused";

  const statusColors: Record<string, string> = {
    completed: "bg-success/20 text-success",
    running: "bg-warning/20 text-warning",
    failed: "bg-destructive/20 text-destructive",
    stopped: "bg-muted text-muted-foreground",
    paused: "bg-accent/20 text-accent",
    pending: "bg-secondary text-secondary-foreground",
  };
  const statusLabels: Record<string, string> = {
    completed: "مكتمل", running: "قيد التشغيل", failed: "فشل",
    stopped: "متوقف", paused: "متوقف مؤقتاً", pending: "معلق",
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-primary/20 glow-sm">
          <Zap className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            مرحباً، {user?.email?.split("@")[0]} 👋
          </h1>
          <p className="text-muted-foreground">إليك ملخص نشاطك ولوحة التحكم</p>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Swords, label: "إجمالي الجلسات", value: stats.totalSessions, color: "bg-primary/20 text-primary", emoji: statusIcons.quest },
          { icon: Trophy, label: "المهمات المكتملة", value: stats.completedSessions, color: "bg-success/20 text-success", emoji: statusIcons.success },
          { icon: Activity, label: "جلسات نشطة", value: stats.runningSessions, color: "bg-warning/20 text-warning", emoji: statusIcons.online },
          { icon: TrendingUp, label: "إجمالي الحلول", value: stats.totalSolved, color: "bg-accent/20 text-accent", emoji: statusIcons.check },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="glass rounded-3xl p-5 hover:glow-sm transition-all group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
              </div>
              <img src={s.emoji} alt="" className="w-8 h-8 group-hover:scale-110 transition-transform" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Floating Add Token Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
            onClick={() => setShowAddModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass rounded-3xl p-8 max-w-md w-full glow-primary" onClick={e => e.stopPropagation()}>
              <div className="text-center mb-6">
                <img src={statusIcons.discord} alt="" className="w-12 h-12 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-foreground">إضافة توكن Discord</h2>
                <p className="text-sm text-muted-foreground mt-2">أدخل التوكن وسيتم حفظه بشكل آمن</p>
              </div>

              <div className="rounded-2xl bg-warning/10 border border-warning/30 p-4 mb-5">
                <p className="text-sm text-warning font-medium flex items-center gap-2">
                  <Shield className="w-4 h-4 shrink-0" />
                  ⚠️ تنبيه مهم
                </p>
                <p className="text-xs text-warning/80 mt-1 leading-relaxed">
                  استخدم توكن حساب وهمي (Alt Account) وليس حسابك الأساسي تجنباً لأي مشاكل. نحن غير مسؤولين عن أي إجراءات تتخذ ضد الحساب.
                </p>
              </div>

              <div className="relative mb-4">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="password" value={newToken} onChange={e => setNewToken(e.target.value)}
                  placeholder="أدخل توكن Discord هنا" className="pl-10 h-12 rounded-2xl bg-secondary/50 border-border/50 text-base" />
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setShowAddModal(false)} variant="ghost" className="flex-1 h-12 rounded-2xl">
                  إلغاء
                </Button>
                <Button onClick={addToken} disabled={addingToken} className="flex-1 h-12 rounded-2xl bg-primary hover:bg-primary/90 glow-sm">
                  {addingToken ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>
                    <img src={statusIcons.check} alt="" className="w-4 h-4 ml-1" />
                    حفظ التوكن
                  </>}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mt-4 text-center flex items-center justify-center gap-1">
                <img src={statusIcons.password} alt="" className="w-3 h-3" />
                التوكن محمي ومخفي ومحفوظ بقاعدة البيانات فقط
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Token Management */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="glass rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <img src={statusIcons.discord} alt="" className="w-5 h-5" />
            التوكنات المحفوظة
          </h2>
          <Button onClick={() => setShowAddModal(true)} size="sm" className="rounded-2xl bg-primary/20 text-primary hover:bg-primary/30">
            <Plus className="w-4 h-4 ml-1" />
            إضافة توكن
          </Button>
        </div>

        {/* Token Cards */}
        {tokens.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <img src={statusIcons.customer} alt="" className="w-12 h-12 mx-auto mb-3 opacity-50" />
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
                  className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all ${isSelected ? "bg-primary/15 ring-2 ring-primary glow-sm" : "bg-secondary/30 hover:bg-secondary/50"}`}>
                  <div className="relative">
                    {t.avatar_url ? (
                      <img src={t.avatar_url} alt="" className="w-12 h-12 rounded-2xl object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    {(t.boost_months || 0) > 0 && (
                      <img src={getBoostImage(t.boost_months || 0)} alt={`Boost ${boostLevel}`}
                        className="absolute -bottom-1 -right-1 w-5 h-5" title={`بوست المستوى ${boostLevel}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-foreground truncate">{t.display_name || t.discord_username || "Unknown"}</p>
                      <img src={statusIcons.check} alt="" className="w-4 h-4" />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">@{t.discord_username}</p>
                    {(t.boost_months || 0) > 0 && (
                      <p className="text-xs text-primary mt-0.5">
                        بوست المستوى {boostLevel} • {t.boost_months} شهر
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <img src={statusIcons.online} alt="" className="w-4 h-4" />
                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 rounded-xl p-2 h-8 w-8"
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

      {/* Quest Solver Section */}
      {selectedToken && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="glass rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <img src={statusIcons.quest} alt="" className="w-5 h-5" />
              حل المهمات — {selectedToken.display_name || selectedToken.discord_username}
            </h2>
            <Button onClick={fetchQuests} disabled={loadingQuests || isActive} className="rounded-2xl bg-primary hover:bg-primary/90 glow-sm">
              {loadingQuests ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4 ml-1" />جلب المهمات</>}
            </Button>
          </div>

          {/* Quests Grid */}
          <AnimatePresence>
            {quests.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {quests.map((quest, i) => {
                  const rewardIcon = getRewardIcon(quest.reward_name);
                  return (
                    <motion.div key={quest.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                      onClick={() => !isActive && setSelectedQuest(quest)}
                      className={`rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 hover:glow-sm border border-border/50 ${selectedQuest?.id === quest.id ? "ring-2 ring-primary glow-primary" : "bg-secondary/20"}`}>
                      {quest.hero_image && (
                        <div className="h-28 overflow-hidden relative">
                          <img src={quest.hero_image} alt={quest.name} className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          {quest.completed && (
                            <div className="absolute top-2 right-2">
                              <img src={statusIcons.success} alt="completed" className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground text-sm">{quest.name}</h3>
                            <img src={statusIcons.check} alt="" className="w-4 h-4" />
                          </div>
                          {quest.completed ? (
                            <img src={statusIcons.success} alt="" className="w-5 h-5" />
                          ) : quest.supported ? (
                            <Sparkles className="w-5 h-5 text-primary" />
                          ) : (
                            <img src={statusIcons.notsupported} alt="" className="w-5 h-5" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{quest.game_title}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {rewardIcon && <img src={rewardIcon} alt="" className="w-4 h-4" />}
                          <p className="text-xs text-primary font-medium">{quest.reward_name}</p>
                        </div>

                        {/* Tasks with type icons */}
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
                              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${task.percent}%` }}
                                  className="h-full rounded-full bg-primary" transition={{ duration: 0.8 }} />
                              </div>
                            </div>
                          );
                        })}

                        {quest.expires_at && (
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <img src={statusIcons.expire} alt="" className="w-3 h-3" />
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
            <div className="rounded-2xl bg-secondary/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <img src={statusIcons.quest} alt="" className="w-6 h-6" />
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">{selectedQuest.name}</h3>
                    <p className="text-xs text-muted-foreground">{selectedQuest.game_title}</p>
                    {isActive && (
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${sessionStatus === "running" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>
                        <img src={sessionStatus === "running" ? statusIcons.online : statusIcons.timer} alt="" className="w-3 h-3 inline mr-1" />
                        {sessionStatus === "running" ? "قيد التشغيل" : "متوقف مؤقتاً"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {sessionStatus === "idle" && (
                    <Button onClick={startSolving} disabled={!selectedQuest.supported || selectedQuest.completed}
                      className="rounded-2xl bg-success hover:bg-success/90 text-success-foreground glow-sm text-sm">
                      <img src={statusIcons.start} alt="" className="w-4 h-4 ml-1" /> بدء
                    </Button>
                  )}
                  {sessionStatus === "running" && (
                    <>
                      <Button onClick={() => controlQuest("pause")} className="rounded-2xl bg-warning hover:bg-warning/90 text-warning-foreground text-sm">
                        <Pause className="w-4 h-4 ml-1" /> إيقاف مؤقت
                      </Button>
                      <Button onClick={() => controlQuest("stop")} variant="destructive" className="rounded-2xl text-sm">
                        <img src={statusIcons.stop} alt="" className="w-4 h-4 ml-1" /> إيقاف
                      </Button>
                    </>
                  )}
                  {sessionStatus === "paused" && (
                    <>
                      <Button onClick={() => controlQuest("resume")} className="rounded-2xl bg-success hover:bg-success/90 text-success-foreground glow-sm text-sm">
                        <RotateCcw className="w-4 h-4 ml-1" /> استئناف
                      </Button>
                      <Button onClick={() => controlQuest("stop")} variant="destructive" className="rounded-2xl text-sm">
                        <img src={statusIcons.stop} alt="" className="w-4 h-4 ml-1" /> إيقاف
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Logs */}
              {logs.length > 0 && (
                <div className="bg-background/80 rounded-2xl p-3 font-mono text-xs max-h-48 overflow-y-auto space-y-0.5">
                  {logs.map((log, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} className="text-muted-foreground">
                      <span className="text-primary/50">[{i + 1}]</span> {log}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* Recent Sessions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="glass rounded-3xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <img src={statusIcons.log} alt="" className="w-5 h-5" />
          آخر الجلسات
        </h2>
        {recentSessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <img src={statusIcons.messages} alt="" className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد جلسات بعد</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentSessions.map((session, i) => (
              <motion.div key={session.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 p-3 rounded-2xl bg-secondary/30 hover:bg-secondary/50 transition-all">
                {session.hero_image ? (
                  <img src={session.hero_image} alt="" className="w-10 h-10 rounded-xl object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = statusIcons.quest; }} />
                ) : (
                  <img src={statusIcons.quest} alt="" className="w-10 h-10 rounded-xl" />
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

      {/* Boost Levels Reference */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
        className="glass rounded-3xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <img src={boostLevelImages[1]} alt="" className="w-5 h-5" />
          مستويات البوست
        </h2>
        <div className="flex flex-wrap gap-3">
          {boostLevels.map(bl => (
            <div key={bl.level} className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-secondary/30 text-sm">
              <img src={boostLevelImages[bl.level]} alt="" className="w-5 h-5" />
              <span className="text-muted-foreground">المستوى {bl.level}</span>
              <span className="text-xs text-primary">{bl.months} شهر</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
