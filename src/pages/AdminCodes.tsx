import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Plus, Trash2, Copy, Check, Clock, ChevronDown, RefreshCw, Key, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ADMIN_EMAILS = ["sf1@sf1.sf1", "uwu@alpha.dcq"];

interface SubCode {
  id: string;
  code: string;
  is_used: boolean;
  used_by: string | null;
  used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

const DURATIONS = [
  { label: "يوم واحد", days: 1 },
  { label: "أسبوع", days: 7 },
  { label: "شهر", days: 30 },
  { label: "3 أشهر", days: 90 },
  { label: "6 أشهر", days: 180 },
  { label: "سنة كاملة", days: 365 },
];

export default function AdminCodes() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [codes, setCodes] = useState<SubCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [durationOpen, setDurationOpen] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(DURATIONS[2]); // default: month
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [checkingExpired, setCheckingExpired] = useState(false);

  const isAdmin = user && ADMIN_EMAILS.includes(user.email || "");

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/", { replace: true });
    }
  }, [authLoading, isAdmin, navigate]);

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    const res = await supabase.functions.invoke("admin-codes", {
      method: "GET",
      body: undefined,
      headers: { "Content-Type": "application/json" },
    });
    // Edge functions via invoke always use POST, let's use query params
    const res2 = await supabase.functions.invoke("admin-codes?action=list");
    if (res2.data?.codes) {
      setCodes(res2.data.codes);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) fetchCodes();
  }, [isAdmin, fetchCodes]);

  const generateCode = async () => {
    setGenerating(true);
    try {
      const res = await supabase.functions.invoke("admin-codes?action=generate", {
        body: { duration_days: selectedDuration.days },
      });
      if (res.data?.code) {
        setCodes((prev) => [res.data.code, ...prev]);
        toast.success("تم إنشاء الكود بنجاح");
      } else {
        toast.error("فشل إنشاء الكود");
      }
    } catch {
      toast.error("خطأ في الاتصال");
    }
    setGenerating(false);
  };

  const deleteCode = async (id: string) => {
    setDeleting(id);
    try {
      const res = await supabase.functions.invoke("admin-codes?action=delete", {
        body: { code_id: id },
      });
      if (res.data?.success) {
        setCodes((prev) => prev.filter((c) => c.id !== id));
        toast.success("تم حذف الكود");
      }
    } catch {
      toast.error("خطأ في الحذف");
    }
    setDeleting(null);
  };

  const checkExpired = async () => {
    setCheckingExpired(true);
    try {
      const res = await supabase.functions.invoke("admin-codes?action=check-expired", {
        body: {},
      });
      if (res.data) {
        toast.success(`تم إلغاء ${res.data.revoked} اشتراك منتهي`);
        fetchCodes();
      }
    } catch {
      toast.error("خطأ");
    }
    setCheckingExpired(false);
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.success("تم نسخ الكود");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isExpired = (date: string | null) => date && new Date(date) < new Date();
  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
  };

  const getStatusBadge = (code: SubCode) => {
    if (code.is_used && isExpired(code.expires_at)) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[hsl(var(--destructive)/0.15)] text-[hsl(var(--destructive))]">منتهي</span>;
    }
    if (code.is_used) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]">مستخدم</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]">متاح</span>;
  };

  if (authLoading || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      {/* Background waves */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <svg className="absolute top-[15%] left-0 w-full opacity-[0.03]" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path fill="white" d="M0,160L48,170.7C96,181,192,203,288,186.7C384,171,480,117,576,112C672,107,768,149,864,170.7C960,192,1056,192,1152,176C1248,160,1344,128,1392,112L1440,96L1440,320L0,320Z" />
        </svg>
        <svg className="absolute bottom-0 left-0 w-full opacity-[0.035]" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path fill="white" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,218.7C672,235,768,245,864,234.7C960,224,1056,192,1152,176C1248,160,1344,160,1392,160L1440,160L1440,320L0,320Z" />
        </svg>
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-foreground/[0.025] rounded-full blur-[140px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-3.5 rounded-2xl bg-foreground/5 border border-foreground/10 glow-white animate-pulse-glow">
              <Key className="w-8 h-8 text-foreground" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-gradient-strong mb-2">إدارة أكواد الاشتراك</h1>
          <p className="text-muted-foreground">إنشاء وإدارة أكواد الاشتراك البريميوم</p>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center gap-3 mb-8"
        >
          {/* Duration Dropdown */}
          <div className="relative w-full sm:w-auto">
            <button
              onClick={() => setDurationOpen(!durationOpen)}
              className="w-full sm:w-52 h-12 px-4 rounded-2xl bg-card/80 border border-foreground/[0.08] backdrop-blur-xl flex items-center justify-between text-sm font-medium text-foreground/80 hover:border-foreground/15 transition-all duration-300 glow-white-xs"
            >
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                {selectedDuration.label}
              </span>
              <motion.div animate={{ rotate: durationOpen ? 180 : 0 }} transition={{ duration: 0.3 }}>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </button>
            <AnimatePresence>
              {durationOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full mt-2 w-full sm:w-52 rounded-2xl bg-card/95 border border-foreground/[0.08] backdrop-blur-2xl overflow-hidden z-50 glow-white-sm"
                >
                  {DURATIONS.map((d) => (
                    <button
                      key={d.days}
                      onClick={() => { setSelectedDuration(d); setDurationOpen(false); }}
                      className={`w-full px-4 py-3 text-right text-sm transition-all duration-200 hover:bg-foreground/5 ${
                        selectedDuration.days === d.days ? "text-foreground font-bold bg-foreground/[0.04]" : "text-muted-foreground"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Generate Button */}
          <Button
            onClick={generateCode}
            disabled={generating}
            className="w-full sm:w-auto h-12 px-6 rounded-2xl bg-foreground text-background hover:bg-foreground/90 font-bold glow-white-sm hover:glow-white transition-all duration-500 hover:scale-[1.02]"
          >
            {generating ? (
              <RefreshCw className="w-4 h-4 animate-spin ml-2" />
            ) : (
              <Plus className="w-4 h-4 ml-2" />
            )}
            {generating ? "جاري الإنشاء..." : "إنشاء كود جديد"}
          </Button>

          {/* Check Expired */}
          <Button
            onClick={checkExpired}
            disabled={checkingExpired}
            variant="outline"
            className="w-full sm:w-auto h-12 px-5 rounded-2xl border-foreground/[0.08] hover:border-foreground/15 text-muted-foreground hover:text-foreground glow-white-xs hover:glow-white-sm transition-all duration-300"
          >
            {checkingExpired ? <RefreshCw className="w-4 h-4 animate-spin ml-2" /> : <AlertTriangle className="w-4 h-4 ml-2" />}
            فحص المنتهية
          </Button>
        </motion.div>

        {/* Codes List */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            </div>
          ) : codes.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16 rounded-3xl bg-card/50 border border-foreground/[0.05] backdrop-blur-xl"
            >
              <Key className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">لا توجد أكواد حالياً</p>
              <p className="text-muted-foreground/50 text-sm mt-1">أنشئ أول كود بالضغط على الزر أعلاه</p>
            </motion.div>
          ) : (
            <AnimatePresence>
              {codes.map((code, i) => (
                <motion.div
                  key={code.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-2xl bg-card/70 border border-foreground/[0.06] backdrop-blur-xl p-5 card-hover relative overflow-hidden group"
                >
                  {/* Wave accent */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <svg className="absolute -bottom-1 left-0 w-full opacity-[0.05]" viewBox="0 0 400 60" preserveAspectRatio="none">
                      <path fill="white" d="M0,30L50,25C100,20,200,10,300,18C350,22,400,30,400,30L400,60L0,60Z" />
                    </svg>
                  </div>

                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <code className="text-foreground font-mono font-bold text-base tracking-wider" dir="ltr">
                          {code.code}
                        </code>
                        {getStatusBadge(code)}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>أُنشئ: {formatDate(code.created_at)}</span>
                        <span>ينتهي: {formatDate(code.expires_at)}</span>
                        {code.is_used && <span>استُخدم: {formatDate(code.used_at)}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => copyCode(code.code, code.id)}
                        className="w-10 h-10 rounded-xl hover:bg-foreground/5 transition-all"
                      >
                        {copiedId === code.id ? (
                          <Check className="w-4 h-4 text-[hsl(var(--success))]" />
                        ) : (
                          <Copy className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteCode(code.id)}
                        disabled={deleting === code.id}
                        className="w-10 h-10 rounded-xl hover:bg-[hsl(var(--destructive)/0.1)] transition-all"
                      >
                        {deleting === code.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-muted-foreground hover:text-[hsl(var(--destructive))]" />
                        )}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </motion.div>
      </div>
    </div>
  );
}
