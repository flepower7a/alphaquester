import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Check, X, ArrowLeft, Loader2, Rocket, Crown, Star, Clock, Globe } from "lucide-react";
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
    { icon: Rocket, title: "حل تلقائي", desc: "محرك ذكي يحل المهمات بالكامل" },
    { icon: Crown, title: "وصول غير محدود", desc: "جميع المهمات والمكافآت" },
    { icon: Clock, title: "حل سريع", desc: "تقنية متقدمة وسريعة" },
    { icon: Shield, title: "حماية كاملة", desc: "تشفير متقدم لحسابك" },
    { icon: Globe, title: "بدون قيود", desc: "يعمل من أي مكان" },
    { icon: Star, title: "تحديثات مستمرة", desc: "مهمات جديدة أول بأول" },
  ];

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden" dir="rtl">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute w-[600px] h-[600px] top-1/4 left-1/2 -translate-x-1/2 rounded-full bg-primary/[0.04] blur-[120px]" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-10">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-4 glow-primary">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-gradient-strong mb-2">بريميوم ألفا</h1>
          <p className="text-muted-foreground text-sm">أدخل كود الاشتراك للوصول الكامل</p>
        </motion.div>

        {/* Bento layout: form + features side by side */}
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Code form */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="lg:col-span-3 rounded-3xl bg-card/60 border border-border/20 p-8">
            <AnimatePresence mode="wait">
              {state === "success" ? (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}
                    className="w-16 h-16 rounded-full bg-success/10 border border-success/20 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-success" />
                  </motion.div>
                  <h2 className="text-xl font-bold text-foreground mb-2">تم التفعيل! 🎉</h2>
                  <p className="text-sm text-muted-foreground mb-5">أنت الآن عضو بريميوم</p>
                  <Button onClick={() => navigate("/dashboard", { replace: true })}
                    className="w-full h-11 rounded-xl bg-gradient-primary text-white font-bold text-sm glow-sm">
                    الذهاب للوحة التحكم <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  </Button>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <label className="text-foreground/60 mb-3 block text-xs font-semibold">كود الاشتراك</label>
                  <div className="flex items-center justify-center gap-2 md:gap-3" dir="ltr" onPaste={handlePaste}>
                    {codes.map((code, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input ref={(el) => (inputRefs.current[i] = el)} type="text" maxLength={4} value={code}
                          onChange={(e) => handleChange(i, e.target.value)} onKeyDown={(e) => handleKeyDown(i, e)}
                          className="w-16 md:w-[72px] h-12 md:h-14 text-center text-base font-bold tracking-[0.15em] rounded-xl bg-background/50 border border-border/40 text-foreground focus:border-primary/40 focus:ring-1 focus:ring-primary/20 outline-none transition-all uppercase"
                          placeholder="••••" />
                        {i < 3 && <span className="text-border text-xl select-none">—</span>}
                      </div>
                    ))}
                  </div>

                  <AnimatePresence>
                    {state === "error" && errorMsg && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        className="mt-4 p-3 rounded-xl bg-destructive/8 border border-destructive/15 flex items-center gap-2 text-destructive text-xs">
                        <X className="w-3.5 h-3.5 shrink-0" />{errorMsg}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <Button onClick={handleVerify} disabled={!isComplete || state === "loading"}
                    className="w-full h-11 rounded-xl bg-gradient-primary text-white font-bold text-sm mt-5 glow-sm hover:opacity-90 disabled:opacity-40">
                    {state === "loading" ? (
                      <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />جاري التحقق...</span>
                    ) : (
                      <span className="flex items-center gap-2">تحقق <Shield className="w-3.5 h-3.5" /></span>
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Features mini grid */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="lg:col-span-2 grid grid-cols-2 lg:grid-cols-1 gap-3">
            {features.slice(0, 4).map((f, i) => (
              <div key={i} className="rounded-2xl bg-card/40 border border-border/15 p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0 mt-0.5">
                  <f.icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">{f.title}</h4>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
