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
  const [selectedDuration, setSelectedDuration] = useState(DURATIONS[2]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [checkingExpired, setCheckingExpired] = useState(false);

  const isAdmin = user && ADMIN_EMAILS.includes(user.email || "");

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate("/", { replace: true });
  }, [authLoading, isAdmin, navigate]);

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supabase.functions.invoke("admin-codes", { body: { action: "list" } });
      if (res.data?.codes) setCodes(res.data.codes);
    } catch { toast.error("خطأ في جلب الأكواد"); }
    setLoading(false);
  }, []);

  useEffect(() => { if (isAdmin) fetchCodes(); }, [isAdmin, fetchCodes]);

  const generateCode = async () => {
    setGenerating(true);
    try {
      const res = await supabase.functions.invoke("admin-codes", { body: { action: "generate", duration_days: selectedDuration.days } });
      if (res.data?.code) { setCodes((prev) => [res.data.code, ...prev]); toast.success("تم إنشاء الكود بنجاح"); }
      else toast.error("فشل إنشاء الكود");
    } catch { toast.error("خطأ في الاتصال"); }
    setGenerating(false);
  };

  const deleteCode = async (id: string) => {
    setDeleting(id);
    try {
      const res = await supabase.functions.invoke("admin-codes", { body: { action: "delete", code_id: id } });
      if (res.data?.success) { setCodes((prev) => prev.filter((c) => c.id !== id)); toast.success("تم حذف الكود"); }
    } catch { toast.error("خطأ في الحذف"); }
    setDeleting(null);
  };

  const checkExpired = async () => {
    setCheckingExpired(true);
    try {
      const res = await supabase.functions.invoke("admin-codes", { body: { action: "check-expired" } });
      if (res.data) { toast.success(`تم إلغاء ${res.data.revoked} اشتراك منتهي`); fetchCodes(); }
    } catch { toast.error("خطأ"); }
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
    if (code.is_used && isExpired(code.expires_at)) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/15 text-destructive">منتهي</span>;
    if (code.is_used) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning/15 text-warning">مستخدم</span>;
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-success/15 text-success">متاح</span>;
  };

  if (authLoading || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="orb orb-purple w-[500px] h-[500px] top-1/4 right-1/4 opacity-30" />
        <div className="orb orb-blue w-[400px] h-[400px] bottom-1/3 left-1/4 opacity-20" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-3.5 rounded-xl bg-gradient-primary glow-primary animate-pulse-glow">
              <Key className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-gradient-strong mb-2">إدارة أكواد الاشتراك</h1>
          <p className="text-muted-foreground">إنشاء وإدارة أكواد الاشتراك البريميوم</p>
        </motion.div>

        {/* Actions */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center gap-3 mb-8">
          {/* Duration Dropdown */}
          <div className="relative w-full sm:w-auto">
            <button onClick={() => setDurationOpen(!durationOpen)}
              className="w-full sm:w-52 h-12 px-4 rounded-xl card-modern flex items-center justify-between text-sm font-medium text-foreground/80">
              <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-primary/50" />{selectedDuration.label}</span>
              <motion.div animate={{ rotate: durationOpen ? 180 : 0 }}><ChevronDown className="w-4 h-4 text-muted-foreground" /></motion.div>
            </button>
            <AnimatePresence>
              {durationOpen && (
                <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  className="absolute top-full mt-2 w-full sm:w-52 rounded-xl card-modern overflow-hidden z-50">
                  {DURATIONS.map((d) => (
                    <button key={d.days} onClick={() => { setSelectedDuration(d); setDurationOpen(false); }}
                      className={`w-full px-4 py-3 text-right text-sm transition-all hover:bg-primary/5 ${
                        selectedDuration.days === d.days ? "text-primary font-bold bg-primary/[0.04]" : "text-muted-foreground"
                      }`}>{d.label}</button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Button onClick={generateCode} disabled={generating}
            className="w-full sm:w-auto h-12 px-6 rounded-xl bg-gradient-primary text-white hover:opacity-90 font-bold glow-primary hover:glow-gradient transition-all duration-500">
            {generating ? <RefreshCw className="w-4 h-4 animate-spin ml-2" /> : <Plus className="w-4 h-4 ml-2" />}
            {generating ? "جاري الإنشاء..." : "إنشاء كود جديد"}
          </Button>

          <Button onClick={checkExpired} disabled={checkingExpired} variant="outline"
            className="w-full sm:w-auto h-12 px-5 rounded-xl border-primary/[0.1] text-muted-foreground hover:text-foreground hover:bg-primary/5">
            {checkingExpired ? <RefreshCw className="w-4 h-4 animate-spin ml-2" /> : <AlertTriangle className="w-4 h-4 ml-2" />}
            فحص المنتهية
          </Button>
        </motion.div>

        {/* Codes List */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : codes.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16 card-modern rounded-2xl">
              <Key className="w-12 h-12 text-primary/20 mx-auto mb-4" />
              <p className="text-muted-foreground">لا توجد أكواد حالياً</p>
              <p className="text-muted-foreground/50 text-sm mt-1">أنشئ أول كود بالضغط على الزر أعلاه</p>
            </motion.div>
          ) : (
            <AnimatePresence>
              {codes.map((code, i) => (
                <motion.div key={code.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -50 }}
                  transition={{ delay: i * 0.04 }} className="card-modern rounded-xl p-5 group">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <code className="text-foreground font-mono font-bold text-base tracking-wider" dir="ltr">{code.code}</code>
                        {getStatusBadge(code)}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>أُنشئ: {formatDate(code.created_at)}</span>
                        <span>ينتهي: {formatDate(code.expires_at)}</span>
                        {code.is_used && <span>استُخدم: {formatDate(code.used_at)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => copyCode(code.code, code.id)} className="w-10 h-10 rounded-lg hover:bg-primary/5">
                        {copiedId === code.id ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteCode(code.id)} disabled={deleting === code.id}
                        className="w-10 h-10 rounded-lg hover:bg-destructive/10">
                        {deleting === code.id ? <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" /> : <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />}
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
