import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  Zap, Shield, Gauge, Globe, ArrowRight,
  ChevronRight, Trophy, Swords, Users, CheckCircle2
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
      {/* Background ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-foreground/[0.03] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[300px] bg-foreground/[0.02] rounded-full blur-[100px]" />
      </div>

      {/* Navbar */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="fixed top-0 w-full z-50 bg-background/70 backdrop-blur-2xl border-b border-border/15"
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="p-2.5 rounded-2xl bg-foreground/5 border border-foreground/10 glow-white-sm"
              whileHover={{ scale: 1.08 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <Zap className="w-5 h-5 text-foreground" />
            </motion.div>
            <span className="text-lg font-bold text-gradient-strong">Alpha Quester</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" className="rounded-2xl text-muted-foreground hover:text-foreground hover:bg-foreground/5">
                تسجيل الدخول
              </Button>
            </Link>
            <Link to="/auth">
              <Button className="rounded-2xl bg-foreground text-background hover:bg-foreground/90 glow-white-sm hover:glow-white transition-shadow duration-500">
                ابدأ الآن
                <ArrowRight className="w-4 h-4 mr-1" />
              </Button>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Hero */}
      <section className="relative pt-36 pb-24 px-6">
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground/5 border border-foreground/10 mb-8 glow-white-xs"
            >
              <img src="/emojis/quest.png" className="w-4 h-4" alt="" />
              <span className="text-sm text-foreground/70 font-medium">الإصدار الأحدث متاح الآن</span>
            </motion.div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black leading-[1.1] mb-7">
              <span className="text-gradient-strong">الفا كويستر</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              حل مهمات Discord تلقائياً. أدخل التوكن واختر المهمة وابدأ الحل.
              <br />
              كل شيء يتم بأمان وسرعة.
            </p>

            <motion.div
              className="flex items-center justify-center gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <Link to="/auth">
                <Button size="lg" className="rounded-2xl bg-foreground text-background hover:bg-foreground/90 px-10 h-14 text-base font-bold hover:scale-[1.03] transition-all duration-300 glow-white hover:glow-white-lg">
                  ابدأ مجاناً
                  <ChevronRight className="w-5 h-5 mr-1" />
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-24"
          >
            {displayStats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.12 }}
                className="rounded-3xl bg-card/70 border border-foreground/[0.06] backdrop-blur-2xl p-7 text-center glow-white-sm card-hover group"
              >
                <div className="w-12 h-12 rounded-2xl bg-foreground/5 border border-foreground/[0.08] flex items-center justify-center mx-auto mb-4 group-hover:glow-white-sm transition-shadow duration-500">
                  <stat.icon className="w-5 h-5 text-foreground/60" />
                </div>
                <p className="text-4xl font-black text-gradient-strong">{stat.value.toLocaleString("ar-SA")}</p>
                <p className="text-sm text-muted-foreground mt-2">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-foreground/[0.015] rounded-full blur-[100px]" />
        </div>

        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-4xl font-black text-gradient-strong mb-4">لماذا Alpha Quester؟</h2>
            <p className="text-muted-foreground text-lg">كل ما تحتاجه لحل مهمات Discord في مكان واحد</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="rounded-3xl bg-card/70 border border-foreground/[0.06] backdrop-blur-2xl p-8 glow-white-sm card-hover group"
              >
                <div className="flex items-center gap-4 mb-5">
                  <motion.img
                    src={feature.emoji}
                    alt=""
                    className="w-10 h-10 opacity-60 group-hover:opacity-100 transition-all duration-500"
                    whileHover={{ rotate: 10, scale: 1.1 }}
                  />
                  <div className="p-3 rounded-2xl bg-foreground/5 border border-foreground/[0.08] group-hover:glow-white transition-shadow duration-500">
                    <feature.icon className="w-6 h-6 text-foreground/70" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto rounded-3xl bg-card/70 border border-foreground/[0.08] backdrop-blur-2xl p-14 text-center glow-white-lg animate-pulse-glow"
        >
          <div className="w-16 h-16 rounded-2xl bg-foreground/5 border border-foreground/[0.08] flex items-center justify-center mx-auto mb-6 glow-white-sm">
            <Trophy className="w-8 h-8 text-foreground/60" />
          </div>
          <h2 className="text-4xl font-black text-gradient-strong mb-4">جاهز للبدء؟</h2>
          <p className="text-muted-foreground text-lg mb-8">أنشئ حسابك وابدأ بحل المهمات الآن</p>
          <Link to="/auth">
            <Button size="lg" className="rounded-2xl bg-foreground text-background hover:bg-foreground/90 px-12 h-14 text-base font-bold hover:scale-[1.03] transition-all duration-300 glow-white hover:glow-white-lg">
              أنشئ حسابك مجاناً
              <ArrowRight className="w-5 h-5 mr-1" />
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-foreground/[0.05] py-8 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-foreground/5 border border-foreground/[0.06]">
              <Zap className="w-3.5 h-3.5 text-foreground/50" />
            </div>
            <span className="font-medium">Alpha Quester</span>
          </div>
          <p>جميع الحقوق محفوظة © 2026</p>
        </div>
      </footer>
    </div>
  );
}
