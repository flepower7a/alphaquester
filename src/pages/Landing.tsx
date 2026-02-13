import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  Zap, Shield, Gauge, Globe, ArrowRight,
  ChevronRight, Trophy, Swords, Users, CheckCircle2, Sparkles
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
    <div className="min-h-screen bg-background overflow-hidden relative" style={{ fontFamily: "'Cairo', sans-serif" }}>
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="orb orb-purple w-[700px] h-[700px] -top-60 left-1/3 opacity-50" />
        <div className="orb orb-blue w-[500px] h-[500px] bottom-20 right-1/4 opacity-30" />
        <div className="orb orb-purple w-[300px] h-[300px] top-1/2 -left-20 opacity-20" />
      </div>

      {/* Navbar */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="fixed top-0 w-full z-50 bg-background/50 backdrop-blur-2xl border-b border-primary/[0.08]"
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="p-2 rounded-xl bg-gradient-primary glow-primary"
              whileHover={{ scale: 1.08 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <Zap className="w-5 h-5 text-white" />
            </motion.div>
            <span className="text-lg font-bold text-gradient-strong">Alpha Quester</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" className="rounded-xl text-muted-foreground hover:text-foreground hover:bg-primary/5">
                تسجيل الدخول
              </Button>
            </Link>
            <Link to="/auth">
              <Button className="rounded-xl bg-gradient-primary hover:opacity-90 text-white glow-primary hover:glow-gradient transition-all duration-500">
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
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/10 border border-primary/20 mb-8"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">الإصدار الأحدث متاح الآن</span>
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
                <Button size="lg" className="rounded-xl bg-gradient-primary text-white px-10 h-14 text-base font-bold hover:opacity-90 transition-all duration-300 glow-primary hover:glow-gradient animate-gradient bg-[length:200%_200%] bg-[linear-gradient(135deg,hsl(262_83%_58%),hsl(280_90%_50%),hsl(200_95%_55%),hsl(262_83%_58%))]">
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
                className="card-modern rounded-2xl p-7 text-center group"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-accent flex items-center justify-center mx-auto mb-4 group-hover:glow-accent transition-shadow duration-500">
                  <stat.icon className="w-5 h-5 text-white" />
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
                className="card-modern rounded-2xl p-8 group"
              >
                <div className="flex items-center gap-4 mb-5">
                  <motion.img
                    src={feature.emoji}
                    alt=""
                    className="w-10 h-10 opacity-60 group-hover:opacity-100 transition-all duration-500"
                    whileHover={{ rotate: 10, scale: 1.1 }}
                  />
                  <div className="p-3 rounded-xl bg-gradient-primary glow-sm">
                    <feature.icon className="w-6 h-6 text-white" />
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
          className="max-w-3xl mx-auto card-modern rounded-3xl p-14 text-center gradient-border animate-pulse-glow"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-6 glow-primary">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-4xl font-black text-gradient-strong mb-4">جاهز للبدء؟</h2>
          <p className="text-muted-foreground text-lg mb-8">أنشئ حسابك وابدأ بحل المهمات الآن</p>
          <Link to="/auth">
            <Button size="lg" className="rounded-xl bg-gradient-primary text-white px-12 h-14 text-base font-bold hover:opacity-90 transition-all duration-300 glow-primary hover:glow-gradient">
              أنشئ حسابك مجاناً
              <ArrowRight className="w-5 h-5 mr-1" />
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-primary/[0.06] py-8 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-primary">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-medium">Alpha Quester</span>
          </div>
          <p>جميع الحقوق محفوظة © 2026</p>
        </div>
      </footer>
    </div>
  );
}
