import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import apiClient from "@/api/apiClient";
import api from "@/api/dataLayer";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Camera, Loader2, Lock, User as UserIcon, Mail } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function Profile() {
  const { user } = useAuth();
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

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    api.entities.Member.filter({ user_id: user.id })
      .then((res) => {
        if (cancelled) return;
        const m = res[0] || null;
        setMember(m);
        setName(m?.name || user?.full_name || "");
        setAvatarUrl(m?.avatar_url || "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, [user?.id]);

  const handleUploadAvatar = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await apiClient.integrations.Core.UploadFile({ file });
      const url = res.file_url;
      setAvatarUrl(url);
      if (member) {
        await api.entities.Member.update(member.id, { avatar_url: url });
      }
      await apiClient.auth.updateMe({ avatar_url: url });
      toast({ title: "התמונה עודכנה", description: "תמונת הפרופיל נשמרה בהצלחה." });
    } catch (err) {
      toast({ title: "שגיאה", description: err.message || "העלאת התמונה נכשלה", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSavingName(true);
    try {
      if (member) {
        await api.entities.Member.update(member.id, { name: name.trim() });
      }
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
        userId: user.id,
        currentPassword,
        newPassword,
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

  const avatar = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1a1a1a&color=C5A880&bold=true`;

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
            <img src={avatar} alt={name} className="w-24 h-24 rounded-full ring-2 ring-primary/30 object-cover" />
            <label className="absolute bottom-0 left-0 w-8 h-8 rounded-full gold-bg flex items-center justify-center cursor-pointer shadow-lg">
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : (
                <Camera className="w-4 h-4 text-black" />
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files[0] && handleUploadAvatar(e.target.files[0])}
                disabled={uploading}
              />
            </label>
          </div>
          <p className="text-xs text-muted-foreground text-center">לחצ/י על המצלמה כדי להעלות תמונת פרופיל</p>
        </div>

        <div className="card-lux p-5 space-y-4">
          <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-sm">פרטים אישיים</h2>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">שם תצוגה</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12"
              placeholder="השם שלך"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">דוא״ל</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                value={user?.email || ""}
                readOnly
                className="pl-10 h-12 bg-muted/50"
              />
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
            <Input
              id="current"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="h-12"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new">סיסמה חדשה</Label>
            <Input
              id="new"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-12"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmNew">אישור סיסמה חדשה</Label>
            <Input
              id="confirmNew"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-12"
              required
            />
          </div>
          <Button type="submit" disabled={changingPassword || !currentPassword || !newPassword} className="w-full h-11">
            {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : "שנה סיסמה"}
          </Button>
        </form>
      </main>
    </div>
  );
}