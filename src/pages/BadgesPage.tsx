import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { boostLevels, boostLevelImages } from "@/lib/emojis";

const nitroLevels = [
  { level: "Stone", months: 0, image: "/emojis/nitro_level_stone.png" },
  { level: "Bronze", months: 1, image: "/emojis/nitro_level_Bronze.png" },
  { level: "Silver", months: 3, image: "/emojis/nitro_level_Silver.png" },
  { level: "Gold", months: 6, image: "/emojis/nitro_level_Gold.png" },
  { level: "Platinum", months: 12, image: "/emojis/nitro_level_Platinum.png" },
  { level: "Diamond", months: 24, image: "/emojis/nitro_level_Diamond.png" },
  { level: "Emerald", months: 36, image: "/emojis/nitro_level_emerald.png" },
  { level: "Ruby", months: 60, image: "/emojis/nitro_level_Ruby.png" },
  { level: "Opal", months: 72, image: "/emojis/nitro_level_Opal.png" },
];

interface TokenRecord {
  id: string;
  discord_username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  boost_months: number;
  nitro_months: number;
  nitro_type: string | null;
}

function getBoostLevelInfo(months: number) {
  const sorted = [...boostLevels].sort((a, b) => b.months - a.months);
  const current = sorted.find(l => l.months <= months) || boostLevels[0];
  const next = [...boostLevels].sort((a, b) => a.months - b.months).find(l => l.months > months);
  return { current, next };
}

function getNitroLevelInfo(months: number) {
  const sorted = [...nitroLevels].sort((a, b) => b.months - a.months);
  const current = sorted.find(l => l.months <= months) || nitroLevels[0];
  const next = [...nitroLevels].sort((a, b) => a.months - b.months).find(l => l.months > months);
  return { current, next };
}

function BadgeProgress({
  levels,
  currentMonths,
  type,
}: {
  levels: { level: string | number; months: number; image: string }[];
  currentMonths: number;
  type: "boost" | "nitro";
}) {
  const maxMonths = levels[levels.length - 1].months;
  const progressPercent = maxMonths > 0 ? Math.min((currentMonths / maxMonths) * 100, 100) : 0;

  // Display levels from lowest (left) to highest (right)
  const displayLevels = [...levels];

  return (
    <div className="mt-6">
      {/* Icons row - highest on left, lowest on right */}
      <div className="flex items-end justify-between mb-2 px-1">
        {displayLevels.map((lvl, i) => {
          const isReached = currentMonths >= lvl.months;
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <motion.img
                src={lvl.image}
                alt={String(lvl.level)}
                className={`w-7 h-7 sm:w-9 sm:h-9 transition-all duration-500 ${isReached ? "opacity-100 scale-100" : "opacity-30 scale-90 grayscale"}`}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: isReached ? 1 : 0.9, opacity: isReached ? 1 : 0.3 }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
              />
              <span className={`text-[9px] font-semibold ${isReached ? "text-foreground" : "text-muted-foreground/50"}`}>
                {lvl.months === 0 ? "0" : `${lvl.months}m`}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar - fills from RIGHT to LEFT (RTL) */}
      <div className="relative h-2.5 rounded-full bg-muted/50 overflow-hidden" dir="ltr">
        <motion.div
          className={`absolute inset-y-0 right-0 rounded-full ${type === "boost" ? "bg-gradient-to-l from-purple-500 via-pink-500 to-rose-400" : "bg-gradient-to-l from-blue-500 via-indigo-500 to-purple-500"}`}
          initial={{ width: "0%" }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
        />
        {progressPercent > 0 && (
          <motion.div
            className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full ${type === "boost" ? "bg-pink-400 shadow-[0_0_12px_hsl(330,80%,60%)]" : "bg-indigo-400 shadow-[0_0_12px_hsl(250,80%,60%)]"}`}
            initial={{ right: "0%" }}
            animate={{ right: `${Math.max(progressPercent - 1.5, 0)}%` }}
            transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          />
        )}
      </div>
    </div>
  );
}

export default function BadgesPage() {
  const { user } = useAuth();
  const [tokens, setTokens] = useState<TokenRecord[]>([]);
  const [selectedToken, setSelectedToken] = useState<TokenRecord | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadTokens = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("discord_tokens")
      .select("id, discord_username, display_name, avatar_url, boost_months, nitro_months, nitro_type")
      .eq("user_id", user.id)
      .eq("is_active", true);
    if (data && data.length > 0) {
      const mapped = data.map(d => ({
        ...d,
        boost_months: d.boost_months || 0,
        nitro_months: (d as any).nitro_months || 0,
      }));
      setTokens(mapped);
      if (!selectedToken || !mapped.find(t => t.id === selectedToken.id)) {
        setSelectedToken(mapped[0]);
      } else {
        setSelectedToken(mapped.find(t => t.id === selectedToken.id)!);
      }
    }
  };

  useEffect(() => { loadTokens(); }, [user]);

  const refreshBadges = async () => {
    if (!selectedToken) return;
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("discord-user-info", {
        body: { action: "refresh_badges", tokenId: selectedToken.id },
      });
      if (error) throw error;
      toast.success(`تم التحديث — بوست: ${data.boost_months} شهر، نيترو: ${data.nitro_months} شهر`);
      await loadTokens();
    } catch (err: any) {
      toast.error(err.message || "خطأ في التحديث");
    } finally {
      setRefreshing(false);
    }
  };

  const boostMonths = selectedToken?.boost_months || 0;
  const nitroMonths = selectedToken?.nitro_months || 0;
  const boostInfo = getBoostLevelInfo(boostMonths);
  const nitroInfo = getNitroLevelInfo(nitroMonths);

  const boostLevelsWithImages = boostLevels.map(l => ({
    level: l.level,
    months: l.months,
    image: boostLevelImages[l.level] || `/emojis/boost_level_${l.level}.png`,
  }));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <img src="/emojis/boost_level_9.png" alt="" className="w-7 h-7" />
            الشارات
          </h1>
          <p className="text-xs text-muted-foreground mt-1">شارات البوست والنيترو لحسابك</p>
        </div>
        {selectedToken && (
          <Button onClick={refreshBadges} disabled={refreshing} size="sm"
            className="rounded-lg bg-primary/10 text-primary hover:bg-primary/15 text-[10px] h-7 px-2.5">
            <RefreshCw className={`w-3 h-3 ml-1 ${refreshing ? "animate-spin" : ""}`} />
            تحديث
          </Button>
        )}
      </motion.div>

      {/* Token selector */}
      {tokens.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {tokens.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedToken(t)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                selectedToken?.id === t.id
                  ? "bg-primary/12 border border-primary/25 text-primary"
                  : "bg-card/50 border border-border/20 text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.avatar_url && <img src={t.avatar_url} alt="" className="w-5 h-5 rounded-md" />}
              {t.display_name || t.discord_username}
            </button>
          ))}
        </div>
      )}

      {!selectedToken ? (
        <div className="text-center py-16 text-muted-foreground">
          <img src="/emojis/boost_level_1.png" alt="" className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">أضف توكن من الرئيسية لعرض الشارات</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* ─── Boost Badge ─── */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="rounded-2xl bg-card/60 border border-border/20 p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <img src={boostLevelImages[boostInfo.current.level]} alt="" className="w-10 h-10" />
              <div>
                <h2 className="text-base font-extrabold text-foreground">شارة البوست — المستوى {boostInfo.current.level}</h2>
                <p className="text-xs text-muted-foreground">
                  مدة البوست: <span className="text-foreground font-bold">{boostMonths}</span> شهر
                </p>
              </div>
            </div>

            {boostInfo.next ? (
              <div className="rounded-xl bg-muted/20 border border-border/10 p-3 mb-2">
                <div className="flex items-center gap-2">
                  <img src={boostLevelImages[boostInfo.next.level]} alt="" className="w-6 h-6 opacity-60" />
                  <div>
                    <p className="text-xs font-bold text-foreground">المستوى التالي: {boostInfo.next.level}</p>
                    <p className="text-[10px] text-muted-foreground">
                      يحتاج <span className="text-primary font-bold">{boostInfo.next.months - boostMonths}</span> شهر إضافي (بعد {boostInfo.next.months} شهر)
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-success/5 border border-success/15 p-3 mb-2">
                <p className="text-xs font-bold text-success">🏆 وصلت للحد الأقصى!</p>
              </div>
            )}

            <BadgeProgress levels={boostLevelsWithImages} currentMonths={boostMonths} type="boost" />
          </motion.div>

          {/* ─── Nitro Badge ─── */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="rounded-2xl bg-card/60 border border-border/20 p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <img src={nitroInfo.current.image} alt="" className="w-10 h-10" />
              <div>
                <h2 className="text-base font-extrabold text-foreground">شارة النيترو — {nitroInfo.current.level}</h2>
                <p className="text-xs text-muted-foreground">
                  مدة النيترو: <span className="text-foreground font-bold">{nitroMonths}</span> شهر
                </p>
              </div>
            </div>

            {nitroInfo.next ? (
              <div className="rounded-xl bg-muted/20 border border-border/10 p-3 mb-2">
                <div className="flex items-center gap-2">
                  <img src={nitroInfo.next.image} alt="" className="w-6 h-6 opacity-60" />
                  <div>
                    <p className="text-xs font-bold text-foreground">المستوى التالي: {nitroInfo.next.level}</p>
                    <p className="text-[10px] text-muted-foreground">
                      يحتاج <span className="text-primary font-bold">{nitroInfo.next.months - nitroMonths}</span> شهر إضافي (بعد {nitroInfo.next.months} شهر)
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-success/5 border border-success/15 p-3 mb-2">
                <p className="text-xs font-bold text-success">🏆 وصلت للحد الأقصى!</p>
              </div>
            )}

            <BadgeProgress levels={nitroLevels} currentMonths={nitroMonths} type="nitro" />
          </motion.div>
        </div>
      )}
    </div>
  );
}
