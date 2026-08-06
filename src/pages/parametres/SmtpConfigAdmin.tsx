import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Mail, Send, Server, Bell } from "lucide-react";

interface Settings {
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_from_name: string;
  smtp_from_email: string;
  smtp_secure: string;
  support_email: string;
  notif_email_enabled: string;
  notif_rappel_jours_defaut: string;
  app_name: string;
}

const DEFAULT: Settings = {
  smtp_host: "", smtp_port: "587", smtp_user: "",
  smtp_from_name: "", smtp_from_email: "", smtp_secure: "tls",
  support_email: "", notif_email_enabled: "true", notif_rappel_jours_defaut: "3",
  app_name: "",
};

export default function SmtpConfigAdmin() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [s, setS] = useState<Settings>(DEFAULT);
  const [password, setPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: roleData } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id);
      const admin = (roleData || []).some((r: any) => r.role === "admin");
      setIsAdmin(admin);
      if (!admin) { setLoading(false); return; }

      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", Object.keys(DEFAULT).concat(["smtp_password"]));
      const map: any = { ...DEFAULT };
      let pwSet = false;
      for (const row of data || []) {
        if (row.key === "smtp_password") { pwSet = !!row.value; continue; }
        if (row.key in map) map[row.key] = row.value || "";
      }
      setS(map);
      setHasPassword(pwSet);
      setTestTo(user.email || "");
      setLoading(false);
    })();
  }, [user]);

  const update = (k: keyof Settings, v: string) => setS((p) => ({ ...p, [k]: v }));

  async function handleSave() {
    setSaving(true);
    try {
      const rows = (Object.keys(s) as (keyof Settings)[]).map((key) => ({
        key, value: s[key], label: key, description: "", is_secret: false,
      }));
      if (password) {
        rows.push({ key: "smtp_password" as any, value: password, label: "smtp_password" as any, description: "", is_secret: true });
      }
      const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
      if (password) { setHasPassword(true); setPassword(""); }
      toast.success("Configuration enregistrée");
    } catch (e: any) {
      toast.error(`Échec: ${e?.message || e}`);
    } finally { setSaving(false); }
  }

  const smtpReady = !!(s.smtp_host && s.smtp_user && (hasPassword || password));

  async function handleTest() {
    if (!testTo) { toast.error("Renseigner un destinataire"); return; }
    if (!smtpReady) {
      toast.error("Configuration SMTP incomplète : renseignez le serveur, l'utilisateur et le mot de passe, puis cliquez sur « Enregistrer » avant de tester.");
      return;
    }
    if (password) {
      toast.error("Modifications non enregistrées : cliquez sur « Enregistrer » avant de tester.");
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-test-email", { body: { to: testTo } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Email envoyé à ${testTo}`);
    } catch (e: any) {
      toast.error(`Échec test: ${e?.message || e}`);
    } finally { setTesting(false); }
  }

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!isAdmin) {
    return <div className="p-8"><p className="text-muted-foreground">Accès réservé aux administrateurs.</p></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Mail className="h-6 w-6" /> Configuration SMTP & Emails</h1>
        <p className="text-muted-foreground">Serveur email auto-hébergé et règles d'envoi des notifications</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" /> Serveur SMTP</CardTitle>
          <CardDescription>Identifiants d'envoi. Le mot de passe est stocké de manière sécurisée et n'est jamais renvoyé au client.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Host</Label><Input value={s.smtp_host} onChange={(e) => update("smtp_host", e.target.value)} placeholder="smtp.example.com" /></div>
          <div><Label>Port</Label><Input type="number" value={s.smtp_port} onChange={(e) => update("smtp_port", e.target.value)} placeholder="587" /></div>
          <div><Label>Utilisateur</Label><Input value={s.smtp_user} onChange={(e) => update("smtp_user", e.target.value)} placeholder="noreply@example.com" /></div>
          <div>
            <Label>Mot de passe {hasPassword && <span className="text-xs text-muted-foreground">(défini)</span>}</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={hasPassword ? "••••••••" : "Renseigner le mot de passe"} />
          </div>
          <div><Label>Nom expéditeur</Label><Input value={s.smtp_from_name} onChange={(e) => update("smtp_from_name", e.target.value)} placeholder="GMAO Notifications" /></div>
          <div><Label>Email expéditeur</Label><Input type="email" value={s.smtp_from_email} onChange={(e) => update("smtp_from_email", e.target.value)} placeholder="noreply@example.com" /></div>
          <div>
            <Label>Sécurité</Label>
            <Select value={s.smtp_secure} onValueChange={(v) => update("smtp_secure", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tls">TLS (STARTTLS, port 587)</SelectItem>
                <SelectItem value="ssl">SSL (port 465)</SelectItem>
                <SelectItem value="none">Aucune</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Email de support (footer)</Label><Input type="email" value={s.support_email} onChange={(e) => update("support_email", e.target.value)} placeholder="support@example.com" /></div>
          <div className="md:col-span-2 flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Enregistrer la configuration
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5" /> Test d'envoi</CardTitle>
          <CardDescription>Envoie un email de validation via la configuration ci-dessus.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-3">
          <Input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="destinataire@example.com" className="flex-1" />
          <Button onClick={handleTest} disabled={testing || !smtpReady} variant="secondary"
            title={!smtpReady ? "Renseignez et enregistrez le host, l'utilisateur et le mot de passe SMTP" : undefined}>
            {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Envoyer un email de test
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notifications par email</CardTitle>
          <CardDescription>Pilote l'envoi global et les rappels d'échéance.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Activer les emails de notification</Label>
              <p className="text-xs text-muted-foreground">Désactiver ignore tous les envois sans toucher au code.</p>
            </div>
            <Switch checked={s.notif_email_enabled === "true"} onCheckedChange={(c) => update("notif_email_enabled", c ? "true" : "false")} />
          </div>
          <div>
            <Label>Délai de rappel avant échéance (jours)</Label>
            <Input type="number" min={1} max={30} value={s.notif_rappel_jours_defaut}
              onChange={(e) => update("notif_rappel_jours_defaut", e.target.value)} className="max-w-[180px]" />
            <p className="text-xs text-muted-foreground mt-1">Le job quotidien (07:00) parcourt tickets, préventifs et OF arrivant à échéance dans ce délai.</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Enregistrer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
