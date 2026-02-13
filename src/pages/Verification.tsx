import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Shield, Check, X, ArrowRight, Loader2, Crown, Rocket, Star, Clock, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type VerifyState = "idle" | "loading" | "success" | "error";

export default function Verification() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [codes, setCodes] = useState(["", "", "", ""]);
  const [state, setState] = useState<VerifyState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [checking, setChecking] = useState(true);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!user) return;
    const checkPremium = async () => {
      const { data } = await supabase.from("profiles").select("account_type").eq("user_id", user.id).single();
      if (data?.account_type === "premium") navigate("/dashboard", { replace: true });
      else setChecking(false);
    };
    checkPremium();
  }, [user, navigate]);

  const handleChange = (index: number, value: string) => {
    const clean = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 4);
    const next = [...codes];
    next[index] = clean;
    setCodes(next);
    if (clean.length === 4 && index < 3) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && codes[index] === "" && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 16);
    const next = ["", "", "", ""];
    for (let i = 0; i < 4; i++) next[i] = pasted.slice(i * 4, (i + 1) * 4);
    setCodes(next);
    let lastFilledIndex = -1;
    for (let j = next.length - 1; j >= 0; j--) { if (next[j].length > 0) { lastFilledIndex = j; break; } }
    if (lastFilledIndex >= 0 && lastFilledIndex < 3 && next[lastFilledIndex].length === 4) inputRefs.current[lastFilledIndex + 1]?.focus();
  };

  const fullCode = `${codes[0]}-${codes[1]}-${codes[2]}-${codes[3]}`;
  const isComplete = codes.every((c) => c.length === 4);

  const handleVerify = async () => {
    if (!isComplete) return;
    setState("loading");
    setErrorMsg("");
    try {
      const res = await supabase.functions.invoke("verify-subscription", { body: { code: fullCode } });
      if (res.error) throw new Error("خطأ في الاتصال");
      if (res.data.valid) { setState("success"); toast.success("تم تفعيل الاشتراك بنجاح!"); }
      else { setState("error"); setErrorMsg(res.data.message || "كود غير صالح"); }
    } catch {
      setState("error"); setErrorMsg("حدث خطأ، حاول مرة أخرى");
    }
  };

  const features = [
    { icon: Rocket, title: "حل تلقائي للمهمات", desc: "محرك ذكي يحل المهمات بالكامل بدون تدخل" },
    { icon: Crown, title: "وصول غير محدود", desc: "جميع المهمات والمكافآت متاحة لك" },
    { icon: Clock, title: "حل سريع وفوري", desc: "تقنية متقدمة تنجز المهمات بأسرع وقت" },
    { icon: Shield, title: "حماية كاملة", desc: "تشفير متقدم وحماية لحسابك" },
    { icon: Globe, title: "دعم جميع المناطق", desc: "يعمل من أي مكان بدون قيود" },
    { icon: Star, title: "تحديثات مستمرة", desc: "مهمات جديدة تُضاف أول بأول" },
  ];

  if (checking) {
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
        <div className="orb orb-purple w-[600px] h-[600px] top-1/4 right-1/4 opacity-40" />
        <div className="orb orb-blue w-[500px] h-[500px] bottom-1/3 left-1/3 opacity-25" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="text-center mb-10">
          <motion.div className="inline-flex items-center gap-3 mb-5" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }}>
            <div className="p-4 rounded-xl bg-gradient-primary glow-primary animate-pulse-glow">
              <Shield className="w-9 h-9 text-white" />
            </div>
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-black text-gradient-strong mb-3">أهلاً بك في بريميوم ألفا</h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">أدخل كود الاشتراك للوصول الكامل لجميع المميزات</p>
        </motion.div>

        {/* Main Card */}
        <motion.div initial={{ opacity: 0, y: 25, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.3 }} className="w-full max-w-lg">
          <div className="card-modern rounded-2xl p-8 gradient-border">
            <AnimatePresence mode="wait">
              {state === "success" ? (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}
                    className="w-20 h-20 rounded-full bg-success/10 border border-success/20 flex items-center justify-center mx-auto mb-5 glow-success">
                    <Check className="w-10 h-10 text-success" />
                  </motion.div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">تم التفعيل بنجاح! 🎉</h2>
                  <p className="text-muted-foreground mb-6">أنت الآن عضو بريميوم، استمتع بجميع المميزات</p>
                  <Button onClick={() => navigate("/dashboard", { replace: true })}
                    className="w-full h-13 rounded-xl bg-gradient-primary text-white hover:opacity-90 font-bold text-base glow-primary">
                    <span className="flex items-center gap-2">الذهاب للوحة التحكم <ArrowRight className="w-4 h-4 rotate-180" /></span>
                  </Button>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="mb-6">
                    <label className="text-foreground/70 mb-3 block text-sm font-medium">كود الاشتراك</label>
                    <div className="flex items-center justify-center gap-2 md:gap-3 dir-ltr" dir="ltr" onPaste={handlePaste}>
                      {codes.map((code, i) => (
                        <div key={i} className="flex items-center gap-2 md:gap-3">
                          <input ref={(el) => (inputRefs.current[i] = el)} type="text" maxLength={4} value={code}
                            onChange={(e) => handleChange(i, e.target.value)} onKeyDown={(e) => handleKeyDown(i, e)}
                            className="w-[72px] md:w-20 h-14 md:h-16 text-center text-lg md:text-xl font-bold tracking-[0.2em] rounded-xl bg-secondary/50 border border-primary/[0.1] text-foreground focus:border-primary/30 focus:ring-1 focus:ring-primary/20 outline-none transition-all duration-300 uppercase"
                            placeholder="••••" />
                          {i < 3 && <span className="text-primary/20 text-2xl font-light select-none">—</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <AnimatePresence>
                    {state === "error" && errorMsg && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/15 flex items-center gap-2 text-destructive text-sm">
                        <X className="w-4 h-4 shrink-0" />{errorMsg}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <Button onClick={handleVerify} disabled={!isComplete || state === "loading"}
                    className="w-full h-13 rounded-xl bg-gradient-primary text-white hover:opacity-90 font-bold text-base transition-all duration-500 hover:scale-[1.02] glow-primary hover:glow-gradient disabled:opacity-40">
                    {state === "loading" ? (
                      <motion.div className="flex items-center gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <Loader2 className="w-5 h-5 animate-spin" /><span>جاري التحقق...</span>
                      </motion.div>
                    ) : (
                      <span className="flex items-center gap-2">تحقق من الاشتراك <Shield className="w-4 h-4" /></span>
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Features Grid */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="w-full max-w-3xl mt-12">
          <h3 className="text-xl font-bold text-center text-gradient mb-6">مميزات الاشتراك البريميوم</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 + i * 0.08 }}
                className="card-modern rounded-xl p-5 group">
                <div className="w-10 h-10 rounded-lg bg-gradient-primary glow-sm flex items-center justify-center mb-3">
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <h4 className="font-bold text-foreground text-sm mb-1">{f.title}</h4>
                <p className="text-muted-foreground text-xs leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
