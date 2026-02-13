import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Zap, Mail, Lock, User, ArrowLeft, RefreshCw } from "lucide-react";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("تم تسجيل الدخول بنجاح!");
        navigate("/verification");
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin, data: { username } },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب بنجاح!");
        navigate("/verification");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden" dir="rtl">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute w-[600px] h-[600px] top-1/3 left-1/2 -translate-x-1/2 rounded-full bg-primary/[0.04] blur-[120px]" />
      </div>

      {/* Nav */}
      <div className="sticky top-0 z-50 bg-background/60 backdrop-blur-2xl border-b border-border/30">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-extrabold text-gradient-strong">Alpha Quester</span>
          </Link>
        </div>
      </div>

      {/* Content — two-panel bento */}
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)] px-4 py-8">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Info panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="hidden lg:flex rounded-3xl bg-gradient-to-br from-primary/8 to-accent/4 border border-border/20 p-10 flex-col justify-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center mb-6 glow-primary">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-3xl font-black text-gradient-strong mb-3">أهلاً بك في Alpha Quester</h2>
            <p className="text-muted-foreground leading-relaxed mb-8">
              أسرع وأسهل طريقة لحل مهمات Discord تلقائياً بأمان وفعالية عالية
            </p>
            <div className="space-y-3">
              {["حل تلقائي بالكامل", "تشفير متقدم للحماية", "تتبع مباشر للتقدم"].map((t, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm text-foreground/70">
                  <div className="w-5 h-5 rounded-md bg-success/10 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-success" />
                  </div>
                  {t}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-3xl bg-card/60 border border-border/20 p-8 md:p-10"
          >
            <div className="mb-8">
              <h1 className="text-2xl font-black text-foreground">{isLogin ? "تسجيل الدخول" : "إنشاء حساب"}</h1>
              <p className="text-sm text-muted-foreground mt-1">{isLogin ? "مرحباً بعودتك" : "أنشئ حسابك للبدء"}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence mode="wait">
                {!isLogin && (
                  <motion.div key="username" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                    <Label className="text-foreground/60 mb-2 block text-xs font-semibold">اسم المستخدم</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                      <Input value={username} onChange={(e) => setUsername(e.target.value)}
                        placeholder="أدخل اسم المستخدم"
                        className="pl-10 h-11 rounded-xl bg-background/50 border-border/40 text-sm" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <Label className="text-foreground/60 mb-2 block text-xs font-semibold">البريد الإلكتروني</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com" required
                    className="pl-10 h-11 rounded-xl bg-background/50 border-border/40 text-sm" />
                </div>
              </div>

              <div>
                <Label className="text-foreground/60 mb-2 block text-xs font-semibold">كلمة المرور</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" required minLength={6}
                    className="pl-10 h-11 rounded-xl bg-background/50 border-border/40 text-sm" />
                </div>
              </div>

              <Button type="submit" disabled={loading}
                className="w-full h-11 rounded-xl bg-gradient-primary text-white font-bold text-sm hover:opacity-90 transition-all glow-sm mt-2">
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : (
                  <span className="flex items-center gap-2">
                    {isLogin ? "تسجيل الدخول" : "إنشاء حساب"}
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button onClick={() => setIsLogin(!isLogin)}
                className="text-xs text-muted-foreground hover:text-primary transition-colors">
                {isLogin ? "ليس لديك حساب؟ أنشئ واحداً" : "لديك حساب؟ سجل دخولك"}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
