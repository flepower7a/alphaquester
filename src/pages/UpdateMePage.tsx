import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Bell, BellOff, Save, Upload, Send, Power, PowerOff,
  ExternalLink, ImageIcon, RefreshCw, Link2, Shield
} from "lucide-react";

interface WebhookSettings {
  webhook_name: string;
  avatar_path: string | null;
  is_enabled: boolean;
  has_webhook_url: boolean;
}

export default function UpdateMePage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<WebhookSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [testing, setTesting] = useState(false);

  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookName, setWebhookName] = useState("Quest Notifier");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("webhook-settings", {
        body: { action: "get" },
      });
      if (data?.settings) {
        setSettings(data.settings);
        setWebhookName(data.settings.webhook_name || "Quest Notifier");
        if (data.settings.avatar_path) {
          const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/webhook-avatars/${data.settings.avatar_path}`;
          setAvatarPreview(url);
        }
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("الحد الأقصى 2MB");
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const saveSettings = async () => {
    if (!user) return;
    setSaving(true);
    try {
      let avatarPath = settings?.avatar_path || null;

      // Upload avatar if changed
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${user.id}/webhook-avatar.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("webhook-avatars")
          .upload(path, avatarFile, { upsert: true });

        if (uploadErr) throw uploadErr;
        avatarPath = path;
      }

      const body: any = {
        action: "save",
        webhookName,
        avatarPath,
      };

      // Only send URL if user typed one
      if (webhookUrl.trim()) {
        body.webhookUrl = webhookUrl.trim();
      }

      const { error } = await supabase.functions.invoke("webhook-settings", { body });
      if (error) throw error;

      toast.success("تم الحفظ بنجاح");
      setWebhookUrl(""); // Clear after save
      loadSettings();
    } catch (err: any) {
      toast.error(err.message || "خطأ في الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const toggleWebhook = async () => {
    setToggling(true);
    try {
      const { data, error } = await supabase.functions.invoke("webhook-settings", {
        body: { action: "toggle" },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setSettings(prev => prev ? { ...prev, is_enabled: data.is_enabled } : prev);
      if (data.is_enabled) {
        const sent = data.initial_sent || 0;
        toast.success(sent > 0 ? `تم التفعيل وإرسال ${sent} مهمة` : "تم التفعيل — سيتم إرسال المهمات الجديدة تلقائياً");
      } else {
        toast.success("تم الإيقاف");
      }
    } catch (err: any) {
      toast.error(err.message || "خطأ");
    } finally {
      setToggling(false);
    }
  };

  const testWebhook = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("webhook-settings", {
        body: { action: "test" },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      toast.success("تم إرسال رسالة اختبار");
    } catch (err: any) {
      toast.error(err.message || "خطأ");
    } finally {
      setTesting(false);
    }
  };

  // Current date for preview
  const now = new Date();
  const previewDate = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}  ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          Update Me
        </h1>
        <p className="text-xs text-muted-foreground mt-1">إعداد ويب هوك Discord لإرسال إشعارات المهمات الجديدة تلقائياً</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── Settings Panel ─── */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-2xl bg-card/50 border border-border/20 p-5 space-y-5">

          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" /> Webhook Settings
          </h2>

          {/* Webhook URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Shield className="w-3 h-3" /> Webhook URL
            </label>
            <div className="rounded-xl bg-warning/5 border border-warning/15 p-2.5 mb-2">
              <p className="text-[10px] text-warning font-medium">⚠️ رابط الويب هوك محمي ولن يظهر بعد الحفظ</p>
            </div>
            <Input
              type="password"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder={settings?.has_webhook_url ? "••••••••• (محفوظ بالفعل)" : "https://discord.com/api/webhooks/..."}
              className="h-10 rounded-xl bg-background/50 border-border/40 text-sm"
            />
          </div>

          {/* Webhook Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Webhook Name</label>
            <Input
              value={webhookName}
              onChange={(e) => setWebhookName(e.target.value)}
              placeholder="Quest Notifier"
              className="h-10 rounded-xl bg-background/50 border-border/40 text-sm"
              maxLength={80}
            />
          </div>

          {/* Avatar Upload */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Webhook Avatar</label>
            <div className="flex items-center gap-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-14 h-14 rounded-full bg-muted/30 border-2 border-dashed border-border/40 flex items-center justify-center cursor-pointer hover:border-primary/40 transition-colors overflow-hidden"
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs h-8 rounded-lg border border-border/30"
                >
                  <Upload className="w-3 h-3 ml-1" /> رفع صورة
                </Button>
                <p className="text-[10px] text-muted-foreground mt-1">PNG, JPG — الحد 2MB</p>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={saveSettings} disabled={saving} className="flex-1 h-10 rounded-xl bg-gradient-primary text-white text-xs hover:opacity-90">
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <><Save className="w-3.5 h-3.5 ml-1" /> حفظ</>}
            </Button>
            <Button onClick={testWebhook} disabled={testing || !settings?.has_webhook_url} variant="outline" className="h-10 rounded-xl text-xs border-border/30">
              {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5 ml-1" /> تجربة</>}
            </Button>
          </div>

          {/* Toggle On/Off */}
          <div className="rounded-xl bg-background/30 border border-border/20 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground flex items-center gap-2">
                {settings?.is_enabled ? <Bell className="w-4 h-4 text-success" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
                {settings?.is_enabled ? "الإشعارات مفعلة" : "الإشعارات معطلة"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">كل مهمة جديدة ستُرسل تلقائياً عبر الويب هوك</p>
            </div>
            <Button
              onClick={toggleWebhook}
              disabled={toggling}
              variant={settings?.is_enabled ? "destructive" : "default"}
              size="sm"
              className="h-9 rounded-xl text-xs"
            >
              {toggling ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : settings?.is_enabled ? (
                <><PowerOff className="w-3.5 h-3.5 ml-1" /> إيقاف</>
              ) : (
                <><Power className="w-3.5 h-3.5 ml-1" /> تشغيل</>
              )}
            </Button>
          </div>
        </motion.div>

        {/* ─── Discord Live Preview ─── */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl overflow-hidden"
        >
          <div className="text-[10px] font-semibold text-muted-foreground px-3 py-2 bg-card/30 border border-border/10 rounded-t-2xl">
            LIVE PREVIEW
          </div>

          {/* Discord-style message container */}
          <div className="p-4 min-h-[500px]" style={{ backgroundColor: "#313338" }}>
            {/* Message */}
            <div className="flex gap-3" dir="ltr">
              {/* Avatar */}
              <div className="shrink-0 mt-0.5">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "#5865F2" }}>
                    <Bell className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                {/* Username + badge + time */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[15px] font-semibold" style={{ color: "#F2F3F5" }}>
                    {webhookName || "Quest Notifier"}
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#5865F2", color: "#fff" }}>
                    APP
                  </span>
                  <span className="text-[11px]" style={{ color: "#949BA4" }}>
                    {previewDate}
                  </span>
                </div>

                {/* Embed */}
                <div className="rounded-lg overflow-hidden max-w-[450px]" style={{ backgroundColor: "#2B2D31" }}>
                  <div className="flex">
                    {/* Left accent bar */}
                    <div className="w-1 shrink-0" style={{ backgroundColor: "#5865F2" }} />

                    <div className="p-3 flex-1">
                      {/* Embed header row */}
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-[15px] font-bold" style={{ color: "#F2F3F5" }}>New Quest Available!</p>
                        </div>
                        {/* Thumbnail - orb icon */}
                        <img src="/emojis/orbIcon.png" alt="" className="w-12 h-12 rounded-lg object-cover ml-3 shrink-0" />
                      </div>

                      {/* Rewards */}
                      <div className="mb-3">
                        <p className="text-[13px] font-bold mb-1" style={{ color: "#F2F3F5" }}>Rewards:</p>
                        <p className="text-[13px]" style={{ color: "#DBDEE1" }}>• 700 Orbs 💎</p>
                      </div>

                      {/* Tasks */}
                      <div className="mb-3">
                        <p className="text-[13px] font-bold mb-1" style={{ color: "#F2F3F5" }}>Tasks:</p>
                        <p className="text-[13px]" style={{ color: "#DBDEE1" }}>• Watch Video for 53 seconds ▶️</p>
                        <p className="text-[13px]" style={{ color: "#DBDEE1" }}>• Watch Video On Mobile for 53 seconds 📱</p>
                      </div>

                      {/* Game/Quest names inline */}
                      <div className="flex gap-6 mb-3">
                        <div>
                          <p className="text-[12px] font-semibold" style={{ color: "#949BA4" }}>Game Name:</p>
                          <p className="text-[13px]" style={{ color: "#DBDEE1" }}>Example Game</p>
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold" style={{ color: "#949BA4" }}>Quest Name:</p>
                          <p className="text-[13px]" style={{ color: "#DBDEE1" }}>Scarlet</p>
                        </div>
                      </div>

                      {/* Starts / Expires */}
                      <div className="mb-2">
                        <p className="text-[12px] font-semibold" style={{ color: "#949BA4" }}>Starts At:</p>
                        <p className="text-[13px]" style={{ color: "#DBDEE1" }}>{previewDate} (a day ago)</p>
                      </div>
                      <div className="mb-3">
                        <p className="text-[12px] font-semibold" style={{ color: "#949BA4" }}>Expires At:</p>
                        <p className="text-[13px]" style={{ color: "#DBDEE1" }}>2/20/2026  3:00 AM (in 6 days)</p>
                      </div>

                      {/* Hero Image placeholder */}
                      <div className="rounded-lg overflow-hidden mb-2">
                        <div className="w-full h-36 flex items-center justify-center rounded-lg" style={{ backgroundColor: "#1E1F22" }}>
                          <ImageIcon className="w-8 h-8" style={{ color: "#4E5058" }} />
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <img src="/emojis/discord.png" alt="" className="w-4 h-4 rounded-full" />
                        <span className="text-[11px]" style={{ color: "#949BA4" }}>Discord • {previewDate}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Buttons under embed */}
                <div className="flex gap-1 mt-1 max-w-[450px]" dir="ltr">
                  <button
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded text-[13px] font-medium transition-colors"
                    style={{ backgroundColor: "#4E5058", color: "#F2F3F5" }}
                  >
                    🔗 View Quest <ExternalLink className="w-3 h-3 ml-0.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
