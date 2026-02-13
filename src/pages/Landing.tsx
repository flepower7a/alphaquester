import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  Zap, Shield, Gauge, Globe, ArrowLeft,
  Trophy, Swords, Users, CheckCircle2, Sparkles, Play
} from "lucide-react";

const features = [
  { icon: Swords, title: "حل تلقائي", description: "حل مهمات Discord تلقائياً بدون تدخل", emoji: "/emojis/quest.png" },
  { icon: Shield, title: "آمن 100%", description: "التوكنات مشفرة بالكامل في قاعدة البيانات", emoji: "/emojis/password.gif" },
  { icon: Gauge, title: "سريع وفعال", description: "أسرع حل مع تتبع مباشر للتقدم", emoji: "/emojis/speed.png" },
  { icon: Globe, title: "إحصائيات مفصلة", description: "تتبع أدائك ونشاطك بالتفصيل", emoji: "/emojis/location.gif" },
];

export default function Landing() {
  const [stats, setStats] = useState({ total_users: 0, total_completed: 0, total_active: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("public-stats");
        if (!error && data) setStats(data);
      } catch {}
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-hidden relative" dir="rtl">
      {/* Subtle grid background */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{ backgroundImage: "radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute w-[800px] h-[800px] -top-[400px] left-1/2 -translate-x-1/2 rounded-full bg-primary/[0.06] blur-[150px]" />
      </div>

      {/* Nav */}
      <motion.nav initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="sticky top-0 z-50 bg-background/60 backdrop-blur-2xl border-b border-border/30">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-extrabold text-foreground/90">Alpha Quester</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="rounded-lg text-muted-foreground text-xs">تسجيل الدخول</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="rounded-lg bg-gradient-primary text-white text-xs h-8 px-4">
                ابدأ الآن <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              </Button>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Hero — Asymmetric bento */}
      <section className="relative px-5 pt-20 pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Main hero block */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="lg:col-span-8 rounded-3xl bg-card/60 border border-border/30 p-8 md:p-12 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.04] rounded-full blur-[80px]" />
              <div className="relative z-10">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/8 border border-primary/15 mb-6 text-xs text-primary font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  الإصدار الأحدث متاح
                </motion.div>
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-black leading-[1.05] mb-5">
                  <span className="text-gradient-strong">الفا كويستر</span>
                </h1>
                <p className="text-base md:text-lg text-muted-foreground max-w-lg mb-8 leading-relaxed">
                  حل مهمات Discord تلقائياً. اختر المهمة، وابدأ — كل شيء بأمان وسرعة.
                </p>
                <Link to="/auth">
                  <Button size="lg" className="rounded-xl bg-gradient-primary text-white h-12 px-8 text-sm font-bold glow-primary hover:opacity-90 transition-all">
                    <Play className="w-4 h-4 ml-2 fill-white" />
                    ابدأ مجاناً
                  </Button>
                </Link>
              </div>
            </motion.div>

            {/* Stats bento cards */}
            <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-4">
              {[
                { value: stats.total_completed, label: "مهمة مكتملة", icon: CheckCircle2, gradient: "from-success/10 to-success/5" },
                { value: stats.total_users, label: "مستخدم", icon: Users, gradient: "from-primary/10 to-primary/5" },
                { value: stats.total_active, label: "نشطة الآن", icon: Swords, gradient: "from-warning/10 to-warning/5" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className={`rounded-2xl bg-gradient-to-br ${stat.gradient} border border-border/20 p-5 flex items-center gap-4`}
                >
                  <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center border border-border/30">
                    <stat.icon className="w-4.5 h-4.5 text-foreground/70" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-foreground">{stat.value.toLocaleString("en-US")}</p>
                    <p className="text-[11px] text-muted-foreground font-medium">{stat.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features — Bento grid */}
      <section className="px-5 py-16 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-10">
            <h2 className="text-3xl md:text-4xl font-black text-gradient-strong">لماذا Alpha Quester؟</h2>
            <p className="text-muted-foreground mt-2">كل ما تحتاجه في مكان واحد</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="group rounded-2xl bg-card/50 border border-border/20 p-6 hover:border-primary/20 hover:bg-card/80 transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-4">
                  <motion.img src={f.emoji} alt="" className="w-8 h-8 opacity-50 group-hover:opacity-80 transition-opacity" />
                  <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center">
                    <f.icon className="w-4 h-4 text-primary" />
                  </div>
                </div>
                <h3 className="font-bold text-foreground mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto rounded-3xl bg-gradient-to-br from-primary/8 to-accent/5 border border-primary/15 p-10 md:p-14 text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-5 glow-primary">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-gradient-strong mb-3">جاهز للبدء؟</h2>
          <p className="text-muted-foreground mb-8">أنشئ حسابك وابدأ بحل المهمات الآن</p>
          <Link to="/auth">
            <Button size="lg" className="rounded-xl bg-gradient-primary text-white px-10 h-12 font-bold glow-primary hover:opacity-90">
              أنشئ حسابك مجاناً <ArrowLeft className="w-4 h-4 mr-1" />
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/20 py-6 px-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-primary flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold">Alpha Quester</span>
          </div>
          <p>جميع الحقوق محفوظة © 2026</p>
        </div>
      </footer>
    </div>
  );
}
