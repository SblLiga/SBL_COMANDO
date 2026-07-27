import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import apiClient from "@/api/apiClient";
import api from "@/api/dataLayer";
import Header from "@/components/Header";
import UserAvatar from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Camera, Loader2, Lock, User as UserIcon, Mail } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { prepareImageForUpload, formatUploadError } from "@/lib/prepareImageUpload";

/** Prefer durable /api/media URLs over legacy ephemeral /uploads paths. */
function pickAvatarUrl(...candidates) {
  const list = candidates.filter((u) => typeof u === "string" && u.trim());
  const durable = list.find(
    (u) =>
      u.startsWith("/api/media/") ||
      u.startsWith("blob:") ||
      u.startsWith("data:") ||
      /^https?:\/\//i.test(u)
  );
  return durable || list[0] || "";
}

export default function Profile() {
  const { user, checkUserAuth } = useAuth();
  const { toast } = useToast();
  const [member, setMember] = useState(null);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const loadSeq = useRef(0);
  const uploadingRef = useRef(false);

  useEffect(() => {
    uploadingRef.current = uploading;
  }, [uploading]);

  useEffect(() => {
    if (!user?.id) return;
    const seq = ++loadSeq.current;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.entities.Member.filter({ user_id: user.id });
        if (cancelled || seq !== loadSeq.current) return;
        const m = res[0] || null;
        setMember(m);
        setName(m?.name || user?.full_name || "");
        // Never clobber an in-progress local preview / just-saved media URL
        if (uploadingRef.current) return;
        setAvatarUrl((prev) => {
          if (prev.startsWith("blob:") || prev.startsWith("/api/media/")) {
            return pickAvatarUrl(prev, user?.avatar_url, m?.avatar_url);
          }
          return pickAvatarUrl(user?.avatar_url, m?.avatar_url, prev);
        });
      } finally {
        if (!cancelled && seq === loadSeq.current) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.full_name, user?.avatar_url]);

  const persistAvatar = async (url) => {
    setAvatarUrl(url);
    let m = member;
    if (!m) {
      m = await api.entities.Member.create({
        name: name || user?.full_name || user?.email || "משתמש",
        user_id: user.id,
        role: user.role || "user",
        avatar_url: url,
        status: "בעקבות",
      });
    } else {
      m = await api.entities.Member.update(m.id, { avatar_url: url });
    }
    setMember(m);
    const me = await apiClient.auth.updateMe({ avatar_url: url });
    // Keep URL from server responses (avoid stale Member filter races)
    setAvatarUrl(pickAvatarUrl(url, me?.avatar_url, m?.avatar_url));
    await checkUserAuth?.();
  };

  const handleUploadAvatar = async (file) => {
    if (!file) return;
    const localPreview = URL.createObjectURL(file);
    setUploading(true);
    setAvatarUrl(localPreview);
    let savedUrl = "";
    try {
      const prepared = await prepareImageForUpload(file);
      const res = await apiClient.integrations.Core.UploadFile({ file: prepared, purpose: "avatar" });
      const url = res.file_url || res.url;
      if (!url) throw new Error("השרת לא החזיר קישור לתמונה");
      savedUrl = url;
      await persistAvatar(url);
      toast({ title: "התמונה עודכנה", description: "תמונת הפרופיל נשמרה ומוצגת לכל המשתמשים." });
    } catch (err) {
      console.error("[Profile] avatar upload failed", err);
      setAvatarUrl(pickAvatarUrl(savedUrl, member?.avatar_url, user?.avatar_url));
      toast({
        title: "העלאה נכשלה",
        description: formatUploadError(err),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      window.setTimeout(() => URL.revokeObjectURL(localPreview), 1500);
    }
  };

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSavingName(true);
    try {
      if (member) {
        await api.entities.Member.update(member.id, { name: name.trim() });
      }
      await apiClient.auth.updateMe({ full_name: name.trim() });
      await checkUserAuth?.();
      toast({ title: "השם עודכן", description: "השם נשמר בהצלחה." });
    } catch (err) {
      toast({ title: "שגיאה", description: err.message || "עדכון השם נכשל", variant: "destructive" });
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "שגיאה", description: "הסיסמאות החדשות אינן תואמות", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "שגיאה", description: "הסיסמה החדשה חייבת להכיל לפחות 6 תווים", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    try {
      await apiClient.auth.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast({ title: "הסיסמה שונתה", description: "הסיסמה עודכנה בהצלחה." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast({ title: "שגיאה", description: err.message || "שינוי הסיסמה נכשל", variant: "destructive" });
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <Header />
      <main className="max-w-md mx-auto px-4 pt-4 space-y-6">
        <Link
          to={user?.role === "admin" ? "/admin" : user?.role === "manager" ? "/manager" : "/"}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="w-4 h-4" />
          חזרה
        </Link>

        <h1 className="font-display text-2xl font-bold">הפרופיל שלי</h1>

        <div className="card-lux p-5 flex flex-col items-center gap-4">
          <div className="relative">
            <UserAvatar src={avatarUrl} name={name} className="w-24 h-24 ring-2 ring-primary/30" />
            <label className="absolute bottom-0 left-0 w-8 h-8 rounded-full gold-bg flex items-center justify-center cursor-pointer shadow-lg">
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : (
                <Camera className="w-4 h-4 text-black" />
              )}
              <input
                type="file"
                accept="image/*,.heic,.heif,.png,.jpg,.jpeg,.webp,.gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) handleUploadAvatar(f);
                }}
                disabled={uploading}
              />
            </label>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            לחצ/י על המצלמה כדי להעלות תמונת פרופיל (גם תמונות גדולות מהטלפון — נדחסות אוטומטית)
          </p>
        </div>

        <div className="card-lux p-5 space-y-4">
          <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-sm">פרטים אישיים</h2>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">שם תצוגה</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-12" placeholder="השם שלך" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">דוא״ל</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="email" value={user?.email || ""} readOnly className="pl-10 h-12 bg-muted/50" />
            </div>
          </div>
          <Button onClick={handleSaveName} disabled={savingName || !name.trim()} className="w-full h-11">
            {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : "שמור שם"}
          </Button>
        </div>

        <form onSubmit={handleChangePassword} className="card-lux p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-sm">שינוי סיסמה</h2>
          </div>
          <div className="space-y-2">
            <Label htmlFor="current">סיסמה נוכחית</Label>
            <Input id="current" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="h-12" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new">סיסמה חדשה</Label>
            <Input id="new" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-12" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmNew">אישור סיסמה חדשה</Label>
            <Input id="confirmNew" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-12" required />
          </div>
          <Button type="submit" disabled={changingPassword || !currentPassword || !newPassword} className="w-full h-11">
            {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : "שנה סיסמה"}
          </Button>
        </form>
      </main>
    </div>
  );
}
