import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Zap, Mail, Lock, User, ArrowRight, Sparkles } from "lucide-react";

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
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin, data: { username } },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب بنجاح!");
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-foreground/[0.02] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-foreground/[0.015] rounded-full blur-3xl" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }} className="w-full max-w-md relative z-10">
        
        <motion.div className="text-center mb-8" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="p-3 rounded-2xl bg-foreground/5 border border-border/30 glow-white-sm">
              <Zap className="w-8 h-8 text-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gradient">Alpha Quester</h1>
          <p className="text-muted-foreground mt-2">{isLogin ? "مرحباً بعودتك" : "أنشئ حسابك الآن"}</p>
        </motion.div>

        <div className="rounded-3xl bg-card/80 border border-border/30 backdrop-blur-xl p-8 glow-white-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div key="username" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                  <Label className="text-foreground/70 mb-2 block">اسم المستخدم</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={username} onChange={(e) => setUsername(e.target.value)}
                      placeholder="أدخل اسم المستخدم" className="pl-10 h-12 rounded-2xl bg-secondary/50 border-border/30" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <Label className="text-foreground/70 mb-2 block">البريد الإلكتروني</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com" required className="pl-10 h-12 rounded-2xl bg-secondary/50 border-border/30" />
              </div>
            </div>

            <div>
              <Label className="text-foreground/70 mb-2 block">كلمة المرور</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required minLength={6} className="pl-10 h-12 rounded-2xl bg-secondary/50 border-border/30" />
              </div>
            </div>

            <Button type="submit" disabled={loading}
              className="w-full h-12 rounded-2xl bg-foreground text-background hover:bg-foreground/90 font-semibold text-base transition-all duration-300 hover:scale-[1.02] glow-white-sm">
              {loading ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <Sparkles className="w-5 h-5" />
                </motion.div>
              ) : (
                <span className="flex items-center gap-2">
                  {isLogin ? "تسجيل الدخول" : "إنشاء حساب"}
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {isLogin ? "ليس لديك حساب؟ أنشئ واحداً" : "لديك حساب؟ سجل دخولك"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
