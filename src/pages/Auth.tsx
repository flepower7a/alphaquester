import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Zap, Mail, Lock, User, ArrowRight, RefreshCw } from "lucide-react";

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
      {/* Background ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-foreground/[0.025] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-foreground/[0.02] rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 25, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <motion.div
            className="inline-flex items-center gap-2 mb-5"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <div className="p-3.5 rounded-2xl bg-foreground/5 border border-foreground/10 glow-white animate-pulse-glow">
              <Zap className="w-8 h-8 text-foreground" />
            </div>
          </motion.div>
          <h1 className="text-3xl font-black text-gradient-strong">Alpha Quester</h1>
          <p className="text-muted-foreground mt-2.5 text-base">{isLogin ? "مرحباً بعودتك" : "أنشئ حسابك الآن"}</p>
        </motion.div>

        {/* Form Card */}
        <motion.div
          className="rounded-3xl bg-card/80 border border-foreground/[0.07] backdrop-blur-2xl p-8 glow-white"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div key="username" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}>
                  <Label className="text-foreground/70 mb-2.5 block text-sm font-medium">اسم المستخدم</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={username} onChange={(e) => setUsername(e.target.value)}
                      placeholder="أدخل اسم المستخدم"
                      className="pl-10 h-12 rounded-2xl bg-background/80 border-foreground/[0.08] focus:border-foreground/20 focus:glow-white-sm transition-shadow" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <Label className="text-foreground/70 mb-2.5 block text-sm font-medium">البريد الإلكتروني</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com" required
                  className="pl-10 h-12 rounded-2xl bg-background/80 border-foreground/[0.08] focus:border-foreground/20 focus:glow-white-sm transition-shadow" />
              </div>
            </div>

            <div>
              <Label className="text-foreground/70 mb-2.5 block text-sm font-medium">كلمة المرور</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required minLength={6}
                  className="pl-10 h-12 rounded-2xl bg-background/80 border-foreground/[0.08] focus:border-foreground/20 focus:glow-white-sm transition-shadow" />
              </div>
            </div>

            <Button type="submit" disabled={loading}
              className="w-full h-13 rounded-2xl bg-foreground text-background hover:bg-foreground/90 font-bold text-base transition-all duration-500 hover:scale-[1.02] glow-white-sm hover:glow-white">
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  {isLogin ? "تسجيل الدخول" : "إنشاء حساب"}
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-7 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300 relative group"
            >
              {isLogin ? "ليس لديك حساب؟ أنشئ واحداً" : "لديك حساب؟ سجل دخولك"}
              <span className="absolute bottom-0 left-0 w-0 h-px bg-foreground/30 group-hover:w-full transition-all duration-300" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
