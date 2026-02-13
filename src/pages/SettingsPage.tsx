import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, Globe, Save, Key, Trash2 } from "lucide-react";

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
    toast[error ? "error" : "success"](error ? "خطأ في الحفظ" : "تم الحفظ");
    setSaving(false);
  };

  const deleteToken = async (id: string) => {
    const { error } = await supabase.from("discord_tokens").delete().eq("id", id);
    if (!error) { setTokens(tokens.filter(t => t.id !== id)); toast.success("تم حذف التوكن"); }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-lg font-black text-foreground">الإعدادات</h1>

      {/* Profile — bento card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
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
