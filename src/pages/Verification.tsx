import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Shield, Check, X, ArrowRight, Loader2, Crown, Rocket, Star, Layout, Clock, Globe } from "lucide-react";
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

  // Check if already premium
  useEffect(() => {
    if (!user) return;
    const checkPremium = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("user_id", user.id)
        .single();
      if (data?.account_type === "premium") {
        navigate("/dashboard", { replace: true });
      } else {
        setChecking(false);
      }
    };
    checkPremium();
  }, [user, navigate]);

  const handleChange = (index: number, value: string) => {
    const clean = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 4);
    const next = [...codes];
    next[index] = clean;
    setCodes(next);
    if (clean.length === 4 && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && codes[index] === "" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 16);
    const next = ["", "", "", ""];
    for (let i = 0; i < 4; i++) {
      next[i] = pasted.slice(i * 4, (i + 1) * 4);
    }
    setCodes(next);
    let lastFilledIndex = -1;
    for (let j = next.length - 1; j >= 0; j--) { if (next[j].length > 0) { lastFilledIndex = j; break; } }
    if (lastFilledIndex >= 0 && lastFilledIndex < 3 && next[lastFilledIndex].length === 4) {
      inputRefs.current[lastFilledIndex + 1]?.focus();
    }
  };

  const fullCode = `${codes[0]}-${codes[1]}-${codes[2]}-${codes[3]}`;
  const isComplete = codes.every((c) => c.length === 4);

  const handleVerify = async () => {
    if (!isComplete) return;
    setState("loading");
    setErrorMsg("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("verify-subscription", {
        body: { code: fullCode },
      });

      if (res.error) throw new Error("خطأ في الاتصال");

      const result = res.data;
      if (result.valid) {
        setState("success");
        toast.success("تم تفعيل الاشتراك بنجاح!");
      } else {
        setState("error");
        setErrorMsg(result.message || "كود غير صالح");
      }
    } catch (err: any) {
      setState("error");
      setErrorMsg("حدث خطأ، حاول مرة أخرى");
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
        <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      {/* Ambient white waves */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full">
          <svg className="absolute top-[10%] left-0 w-full opacity-[0.03]" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path fill="white" d="M0,160L48,170.7C96,181,192,203,288,186.7C384,171,480,117,576,112C672,107,768,149,864,170.7C960,192,1056,192,1152,176C1248,160,1344,128,1392,112L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
          </svg>
          <svg className="absolute top-[40%] left-0 w-full opacity-[0.025] rotate-180" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path fill="white" d="M0,96L60,112C120,128,240,160,360,165.3C480,171,600,149,720,149.3C840,149,960,171,1080,176C1200,181,1320,171,1380,165.3L1440,160L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z" />
          </svg>
          <svg className="absolute bottom-0 left-0 w-full opacity-[0.04]" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path fill="white" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,218.7C672,235,768,245,864,234.7C960,224,1056,192,1152,176C1248,160,1344,160,1392,160L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
          </svg>
        </div>
        <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-foreground/[0.03] rounded-full blur-[150px]" />
        <div className="absolute bottom-1/3 left-1/3 w-[500px] h-[500px] bg-foreground/[0.025] rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-10"
        >
          <motion.div
            className="inline-flex items-center gap-3 mb-5"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          >
            <div className="p-4 rounded-2xl bg-foreground/5 border border-foreground/10 glow-white animate-pulse-glow">
              <Shield className="w-9 h-9 text-foreground" />
            </div>
          </motion.div>
          <motion.h1
            className="text-4xl md:text-5xl font-black text-gradient-strong mb-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            أهلاً بك في بريميوم ألفا
          </motion.h1>
          <motion.p
            className="text-muted-foreground text-lg max-w-md mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            أدخل كود الاشتراك للوصول الكامل لجميع المميزات
          </motion.p>
        </motion.div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 25, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-lg"
        >
          <div className="rounded-3xl bg-card/80 border border-foreground/[0.07] backdrop-blur-2xl p-8 glow-white relative overflow-hidden">
            {/* Wave inside card */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
              <svg className="absolute -bottom-1 left-0 w-full opacity-[0.04]" viewBox="0 0 1440 200" preserveAspectRatio="none">
                <path fill="white" d="M0,100L80,110C160,120,320,140,480,130C640,120,800,80,960,70C1120,60,1280,80,1360,90L1440,100L1440,200L0,200Z" />
              </svg>
            </div>

            <AnimatePresence mode="wait">
              {state === "success" ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="text-center py-6 relative z-10"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                    className="w-20 h-20 rounded-full bg-[hsl(var(--success)/0.1)] border border-[hsl(var(--success)/0.2)] flex items-center justify-center mx-auto mb-5 glow-success"
                  >
                    <Check className="w-10 h-10 text-[hsl(var(--success))]" />
                  </motion.div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">تم التفعيل بنجاح! 🎉</h2>
                  <p className="text-muted-foreground mb-6">أنت الآن عضو بريميوم، استمتع بجميع المميزات</p>
                  <Button
                    onClick={() => navigate("/dashboard", { replace: true })}
                    className="w-full h-13 rounded-2xl bg-foreground text-background hover:bg-foreground/90 font-bold text-base glow-white-sm hover:glow-white transition-all duration-500"
                  >
                    <span className="flex items-center gap-2">
                      الذهاب للوحة التحكم
                      <ArrowRight className="w-4 h-4 rotate-180" />
                    </span>
                  </Button>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10">
                  {/* Code Input */}
                  <div className="mb-6">
                    <label className="text-foreground/70 mb-3 block text-sm font-medium">كود الاشتراك</label>
                    <div className="flex items-center justify-center gap-2 md:gap-3 dir-ltr" dir="ltr" onPaste={handlePaste}>
                      {codes.map((code, i) => (
                        <div key={i} className="flex items-center gap-2 md:gap-3">
                          <input
                            ref={(el) => (inputRefs.current[i] = el)}
                            type="text"
                            maxLength={4}
                            value={code}
                            onChange={(e) => handleChange(i, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(i, e)}
                            className="w-[72px] md:w-20 h-14 md:h-16 text-center text-lg md:text-xl font-bold tracking-[0.2em] rounded-2xl bg-background/80 border border-foreground/[0.08] text-foreground focus:border-foreground/25 focus:glow-white-sm outline-none transition-all duration-300 uppercase"
                            placeholder="••••"
                          />
                          {i < 3 && (
                            <span className="text-foreground/15 text-2xl font-light select-none">—</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Error message */}
                  <AnimatePresence>
                    {state === "error" && errorMsg && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-4 p-3 rounded-xl bg-[hsl(var(--destructive)/0.1)] border border-[hsl(var(--destructive)/0.15)] flex items-center gap-2 text-[hsl(var(--destructive))] text-sm"
                      >
                        <X className="w-4 h-4 shrink-0" />
                        {errorMsg}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Verify Button */}
                  <Button
                    onClick={handleVerify}
                    disabled={!isComplete || state === "loading"}
                    className="w-full h-13 rounded-2xl bg-foreground text-background hover:bg-foreground/90 font-bold text-base transition-all duration-500 hover:scale-[1.02] glow-white-sm hover:glow-white disabled:opacity-40 disabled:hover:scale-100"
                  >
                    {state === "loading" ? (
                      <motion.div
                        className="flex items-center gap-3"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>جاري التحقق...</span>
                      </motion.div>
                    ) : (
                      <span className="flex items-center gap-2">
                        تحقق من الاشتراك
                        <Shield className="w-4 h-4" />
                      </span>
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="w-full max-w-3xl mt-12"
        >
          <h3 className="text-xl font-bold text-center text-gradient mb-6">مميزات الاشتراك البريميوم</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.08 }}
                className="rounded-2xl bg-card/60 border border-foreground/[0.06] backdrop-blur-xl p-5 card-hover relative overflow-hidden group"
              >
                {/* Wave inside feature card */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <svg className="absolute -bottom-1 left-0 w-full opacity-[0.06]" viewBox="0 0 400 80" preserveAspectRatio="none">
                    <path fill="white" d="M0,40L50,35C100,30,200,20,300,25C350,28,400,40,400,40L400,80L0,80Z" />
                  </svg>
                </div>
                <div className="relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-foreground/5 border border-foreground/[0.08] flex items-center justify-center mb-3 glow-white-xs">
                    <f.icon className="w-5 h-5 text-foreground/80" />
                  </div>
                  <h4 className="font-bold text-foreground text-sm mb-1">{f.title}</h4>
                  <p className="text-muted-foreground text-xs leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
