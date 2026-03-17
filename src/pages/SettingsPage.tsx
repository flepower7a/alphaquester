import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { User, Globe, Save, Key, Trash2, Zap, Bot, Info } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const [username, setUsername] = useState("");
  const [language, setLanguage] = useState("ar");
  const [saving, setSaving] = useState(false);
  const [tokens, setTokens] = useState<any[]>([]);
  const [autoQuest, setAutoQuest] = useState(false);
  const [togglingAuto, setTogglingAuto] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).single()
      .then(({ data }) => {
        if (data) {
          setUsername(data.username || "");
          setLanguage(data.language || "ar");
          setAutoQuest(!!(data as any).auto_quest_enabled);
        }
      });
    supabase.from("discord_tokens")
      .select("id, discord_user_id, discord_username, display_name, avatar_url, is_active")
      .eq("user_id", user.id)
      .then(({ data }) => { if (data) setTokens(data); });
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ username, language }).eq("user_id", user.id);
    toast[error ? "error" : "success"](error ? "خطأ في الحفظ" : "تم الحفظ");
    setSaving(false);
  };

  const deleteToken = async (id: string) => {
    const { error } = await supabase.from("discord_tokens").delete().eq("id", id);
    if (!error) { setTokens(tokens.filter(t => t.id !== id)); toast.success("تم حذف التوكن"); }
  };

  const toggleAutoQuest = async () => {
    if (!user) return;
    setTogglingAuto(true);
    const newVal = !autoQuest;
    const { error } = await supabase.from("profiles").update({
      auto_quest_enabled: newVal,
    } as any).eq("user_id", user.id);

    if (error) {
      toast.error("خطأ في تغيير الإعداد");
    } else {
      setAutoQuest(newVal);
      if (newVal) {
        toast.success("🤖 تم تفعيل الحل التلقائي! سيتم فحص المهمات كل ساعة وحلها تلقائياً لجميع التوكنات");
        // Trigger immediate first check
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
          const url = `${supabaseUrl}/functions/v1/auto-quest`;
          await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ action: "check" }),
          });
        } catch { /* non-blocking */ }
      } else {
        toast.success("تم إيقاف الحل التلقائي");
      }
    }
    setTogglingAuto(false);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-lg font-black text-foreground">الإعدادات</h1>

      {/* Auto-Quest Toggle — Feature Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gradient-to-br from-primary/8 to-accent/4 border border-primary/20 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/15">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">الحل التلقائي</h2>
              <p className="text-[10px] text-muted-foreground">يحل المهمات تلقائياً لجميع التوكنات</p>
            </div>
          </div>
          <Switch
            checked={autoQuest}
            onCheckedChange={toggleAutoQuest}
            disabled={togglingAuto || tokens.length === 0}
          />
        </div>
        
        <div className="rounded-xl bg-background/40 border border-border/15 p-3 space-y-1.5">
          <div className="flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-primary/60 mt-0.5 shrink-0" />
            <div className="text-[10px] text-muted-foreground space-y-1">
              <p>• يفحص المهمات الجديدة كل ساعة بتوكن عشوائي</p>
              <p>• عند وجود مهمة جديدة يبدأ حلها لـ <span className="text-primary font-semibold">جميع التوكنات</span></p>
              <p>• يرسل heartbeats كل دقيقة ويستلم المكافأة تلقائياً</p>
              <p>• لا تحتاج تفتح الموقع — كل شيء يعمل بالخلفية</p>
            </div>
          </div>
        </div>

        {tokens.length === 0 && (
          <p className="text-[10px] text-warning font-medium flex items-center gap-1">
            <Zap className="w-3 h-3" />
            أضف توكن واحد على الأقل لتفعيل الحل التلقائي
          </p>
        )}

        {autoQuest && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-success/8 border border-success/15">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <p className="text-[10px] text-success font-semibold">نشط — يعمل بالخلفية</p>
          </div>
        )}
      </motion.div>

      {/* Profile — bento card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="rounded-2xl bg-card/50 border border-border/20 p-5 space-y-4">
        <h2 className="text-sm font-bold flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-primary" /> الملف الشخصي
        </h2>

        <div>
          <Label className="mb-1.5 block text-[11px] font-semibold text-foreground/60">اسم المستخدم</Label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)}
            className="h-10 rounded-xl bg-background/50 border-border/30 text-sm" />
        </div>

        <div>
          <Label className="mb-1.5 block text-[11px] font-semibold text-foreground/60 flex items-center gap-1">
            <Globe className="w-3 h-3" /> اللغة
          </Label>
          <div className="flex gap-2">
            {[{ value: "ar", label: "العربية 🇸🇦" }, { value: "en", label: "English 🇬🇧" }].map((lang) => (
              <button key={lang.value} onClick={() => setLanguage(lang.value)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  language === lang.value
                    ? "bg-primary/12 text-primary"
                    : "bg-background/30 text-muted-foreground hover:text-foreground border border-border/20"
                }`}>
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={saveProfile} disabled={saving}
          className="rounded-lg bg-gradient-primary text-white text-xs h-9 px-4 hover:opacity-90">
          <Save className="w-3 h-3 ml-1" />{saving ? "جاري..." : "حفظ"}
        </Button>
      </motion.div>

      {/* Tokens */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-2xl bg-card/50 border border-border/20 p-5">
        <h2 className="text-sm font-bold flex items-center gap-1.5 mb-3">
          <Key className="w-3.5 h-3.5 text-primary" /> التوكنات المحفوظة
        </h2>
        {tokens.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">لا توكنات</p>
        ) : (
          <div className="space-y-2">
            {tokens.map((token) => (
              <div key={token.id} className="flex items-center gap-3 p-3 rounded-xl bg-background/20 border border-border/10">
                <Key className="w-3.5 h-3.5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{token.discord_username || "غير معروف"}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{token.discord_user_id || "***"}</p>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                  token.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                }`}>
                  {token.is_active ? "نشط" : "غير نشط"}
                </span>
                <Button variant="ghost" size="icon" onClick={() => deleteToken(token.id)}
                  className="rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/8 h-7 w-7">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
