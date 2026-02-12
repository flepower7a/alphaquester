import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, User, Globe, Save, Key, Trash2 } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const [username, setUsername] = useState("");
  const [language, setLanguage] = useState("ar");
  const [saving, setSaving] = useState(false);
  const [tokens, setTokens] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).single()
      .then(({ data }) => { if (data) { setUsername(data.username || ""); setLanguage(data.language || "ar"); } });
    supabase.from("discord_tokens").select("*").eq("user_id", user.id)
      .then(({ data }) => { if (data) setTokens(data); });
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ username, language }).eq("user_id", user.id);
    toast[error ? "error" : "success"](error ? "خطأ في حفظ الإعدادات" : "تم حفظ الإعدادات");
    setSaving(false);
  };

  const deleteToken = async (id: string) => {
    const { error } = await supabase.from("discord_tokens").delete().eq("id", id);
    if (!error) { setTokens(tokens.filter(t => t.id !== id)); toast.success("تم حذف التوكن"); }
  };

  const cardClass = "rounded-3xl bg-card/80 border border-border/30 backdrop-blur-xl glow-white-sm";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <motion.div className="p-2.5 rounded-2xl bg-foreground/5 border border-border/40 glow-white-sm" whileHover={{ scale: 1.05 }}>
            <Settings className="w-6 h-6 text-foreground" />
          </motion.div>
          الإعدادات
        </h1>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={cardClass + " p-6 space-y-5"}>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <User className="w-5 h-5 text-muted-foreground" /> الملف الشخصي
        </h2>

        <div>
          <Label className="mb-2 block text-foreground/70">اسم المستخدم</Label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} className="h-12 rounded-2xl bg-secondary/50 border-border/30" />
        </div>

        <div>
          <Label className="mb-2 block text-foreground/70 flex items-center gap-2">
            <Globe className="w-4 h-4" /> اللغة
          </Label>
          <div className="flex gap-3">
            {[{ value: "ar", label: "العربية 🇸🇦" }, { value: "en", label: "English 🇬🇧" }].map((lang) => (
              <button key={lang.value} onClick={() => setLanguage(lang.value)}
                className={`px-5 py-3 rounded-2xl text-sm font-medium transition-all duration-300 ${
                  language === lang.value
                    ? "bg-foreground text-background"
                    : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50 border border-border/20"
                }`}>
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={saveProfile} disabled={saving} className="rounded-2xl bg-foreground text-background hover:bg-foreground/90 glow-white-sm">
          <Save className="w-4 h-4 mr-2" />{saving ? "جاري الحفظ..." : "حفظ"}
        </Button>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={cardClass + " p-6"}>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-muted-foreground" /> التوكنات المحفوظة
        </h2>
        {tokens.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4 text-center">لا توجد توكنات محفوظة</p>
        ) : (
          <div className="space-y-3">
            {tokens.map((token) => (
              <div key={token.id} className="flex items-center gap-3 p-4 rounded-2xl bg-secondary/20 border border-border/15">
                <Key className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{token.discord_username || "مستخدم غير معروف"}</p>
                  <p className="text-xs text-muted-foreground">{token.discord_user_id || "***"}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  token.is_active ? "bg-success/15 text-success border border-success/20" : "bg-muted/50 text-muted-foreground border border-border/20"
                }`}>
                  {token.is_active ? "نشط" : "غير نشط"}
                </span>
                <Button variant="ghost" size="icon" onClick={() => deleteToken(token.id)}
                  className="rounded-2xl text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
