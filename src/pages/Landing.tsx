import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  Zap, Shield, Gauge, Globe, ArrowRight,
  Sparkles, ChevronRight, Trophy, Swords, Users, CheckCircle2
} from "lucide-react";

const features = [
  {
    icon: Swords,
    title: "حل تلقائي",
    description: "حل مهمات Discord تلقائياً بدون أي تدخل يدوي",
    emoji: "/emojis/quest.png",
  },
  {
    icon: Shield,
    title: "آمن 100%",
    description: "التوكنات محفوظة بشكل مشفر في قاعدة البيانات",
    emoji: "/emojis/password.gif",
  },
  {
    icon: Gauge,
    title: "سريع وفعال",
    description: "أسرع حل للمهمات مع تتبع مباشر للتقدم",
    emoji: "/emojis/speed.png",
  },
  {
    icon: Globe,
    title: "إحصائيات مفصلة",
    description: "تتبع أدائك ونشاطك مع رسوم بيانية وإحصائيات",
    emoji: "/emojis/location.gif",
  },
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

  const displayStats = [
    { value: stats.total_completed, label: "مهمة مكتملة", icon: CheckCircle2 },
    { value: stats.total_users, label: "مستخدم مسجل", icon: Users },
    { value: stats.total_active, label: "مهمة نشطة الآن", icon: Swords },
  ];

  return (
    <div className="min-h-screen bg-background overflow-hidden" style={{ fontFamily: "'Cairo', sans-serif" }}>
      {/* Navbar */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-border/20"
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-foreground/5 border border-border/30">
              <Zap className="w-5 h-5 text-foreground" />
            </div>
            <span className="text-lg font-bold text-gradient">Alpha Quester</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" className="rounded-2xl text-muted-foreground hover:text-foreground">
                تسجيل الدخول
              </Button>
            </Link>
            <Link to="/auth">
              <Button className="rounded-2xl bg-foreground text-background hover:bg-foreground/90">
                ابدأ الآن
                <ArrowRight className="w-4 h-4 mr-1" />
              </Button>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-1/3 w-[600px] h-[600px] bg-foreground/[0.02] rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-foreground/[0.015] rounded-full blur-3xl" />
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/5 border border-border/30 mb-6">
              <Sparkles className="w-4 h-4 text-foreground/60" />
              <span className="text-sm text-foreground/60 font-medium">الإصدار الأحدث متاح الآن</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
              <span className="text-gradient">الفا كويستر</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
              حل مهمات Discord تلقائياً. أدخل التوكن واختر المهمة وابدأ الحل. كل شيء يتم بأمان وسرعة.
            </p>

            <div className="flex items-center justify-center gap-4">
              <Link to="/auth">
                <Button size="lg" className="rounded-2xl bg-foreground text-background hover:bg-foreground/90 px-8 h-14 text-base hover:scale-105 transition-transform glow-white">
                  ابدأ مجاناً
                  <ChevronRight className="w-5 h-5 mr-1" />
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-20">
            {displayStats.map((stat, i) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.1 }}
                className="rounded-3xl bg-card/60 border border-border/20 backdrop-blur-xl p-6 text-center glow-white-sm card-hover">
                <stat.icon className="w-6 h-6 text-foreground/50 mx-auto mb-2" />
                <p className="text-3xl font-bold text-gradient">{stat.value.toLocaleString("ar-SA")}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-3">لماذا Alpha Quester؟</h2>
            <p className="text-muted-foreground">كل ما تحتاجه لحل مهمات Discord في مكان واحد</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map((feature, i) => (
              <motion.div key={feature.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="rounded-3xl bg-card/60 border border-border/20 backdrop-blur-xl p-7 glow-white-sm card-hover group">
                <div className="flex items-center gap-3 mb-4">
                  <img src={feature.emoji} alt="" className="w-8 h-8 opacity-70 group-hover:opacity-100 transition-opacity" />
                  <div className="p-3 rounded-2xl bg-foreground/5 border border-border/30 group-hover:glow-white-sm transition-all">
                    <feature.icon className="w-6 h-6 text-foreground/70" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="max-w-3xl mx-auto rounded-3xl bg-card/60 border border-border/20 backdrop-blur-xl p-12 text-center glow-white">
          <Trophy className="w-12 h-12 text-foreground/50 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-foreground mb-3">جاهز للبدء؟</h2>
          <p className="text-muted-foreground mb-6">أنشئ حسابك وابدأ بحل المهمات الآن</p>
          <Link to="/auth">
            <Button size="lg" className="rounded-2xl bg-foreground text-background hover:bg-foreground/90 px-10 h-14 text-base hover:scale-105 transition-transform glow-white">
              أنشئ حسابك مجاناً
              <ArrowRight className="w-5 h-5 mr-1" />
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/15 py-8 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-foreground/40" />
            <span>Alpha Quester</span>
          </div>
          <p>جميع الحقوق محفوظة © 2026</p>
        </div>
      </footer>
    </div>
  );
}
