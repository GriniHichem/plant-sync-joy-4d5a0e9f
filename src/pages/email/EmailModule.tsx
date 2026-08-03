import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  CATEGORY_LABELS, EmailLog, EmailTemplate, extractVariables, renderTemplate,
  sendEmail, useEmailAccount, useEmailLogs, useEmailTemplates,
} from "@/hooks/useEmailModule";
import { PdrQuoteBuilder, QuoteDraft } from "@/components/email/PdrQuoteBuilder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Mail, MailCheck, MailX, Send, Loader2, Link2Off, Plug, History, FileText,
  AlertTriangle, CheckCircle2, Clock, Eye, RotateCcw, X, Paperclip, Truck,
} from "lucide-react";

type Prefill = {
  to?: string; subject?: string; body?: string; templateId?: string;
  vars?: Record<string, string>;
};

const TABS = ["templates", "devis", "compose", "history", "settings"] as const;
const TAB_SLUGS: Record<string, string> = {
  templates: "", devis: "devis-pdr", compose: "envoyer", history: "historique", settings: "parametres",
};
const SLUG_TABS: Record<string, string> = {
  "devis-pdr": "devis", envoyer: "compose", historique: "history", parametres: "settings",
};

export default function EmailModule() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const prefill = (location.state as { emailPrefill?: Prefill } | null)?.emailPrefill;
  const urlTab = params.tab ? SLUG_TABS[params.tab] : undefined;

  const { account, loading: accountLoading, connect, disconnect, isConnected } = useEmailAccount();
  const { templates, loading: templatesLoading } = useEmailTemplates();
  const { logs, loading: logsLoading, refresh: refreshLogs } = useEmailLogs();

  const [tab, setTab] = useState(prefill ? "compose" : (urlTab ?? "templates"));
  const [selected, setSelected] = useState<EmailTemplate | null>(null);
  const [vars, setVars] = useState<Record<string, string>>({});
  const [to, setTo] = useState(prefill?.to ?? "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(prefill?.subject ?? "");
  const [body, setBody] = useState(prefill?.body ?? "");
  const [attachments, setAttachments] = useState<QuoteDraft["attachments"]>([]);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<EmailLog | null>(null);

  useEffect(() => {
    if (urlTab && TABS.includes(urlTab as never)) setTab(urlTab);
    else if (!params.tab) setTab((t) => (prefill ? "compose" : t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.tab]);

  const changeTab = (v: string) => {
    setTab(v);
    const slug = TAB_SLUGS[v] ?? "";
    navigate(slug ? `/email/${slug}` : "/email", { replace: true });
  };


  const userName = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || user?.email || "";

  const autoVars = useMemo<Record<string, string>>(() => ({
    nom_utilisateur: userName,
    date: new Date().toLocaleDateString("fr-FR"),
    lien: window.location.origin,
    ...(prefill?.vars ?? {}),
  }), [userName, prefill?.vars]);

  const pickTemplate = (t: EmailTemplate) => {
    const keys = Array.from(new Set([...extractVariables(t.subject), ...extractVariables(t.body), ...(t.variables ?? [])]));
    const initial: Record<string, string> = {};
    keys.forEach((k) => { initial[k] = autoVars[k] ?? ""; });
    setSelected(t);
    setVars(initial);
    setTo(t.default_recipients ?? "");
    setCc("");
    setAttachments([]);
    setSubject(renderTemplate(t.subject, initial));
    setBody(renderTemplate(t.body, initial));
    changeTab(t.category === "achats" && /devis/i.test(t.name) ? "devis" : "compose");
  };

  // Applique les variables sur le modèle sélectionné
  useEffect(() => {
    if (!selected) return;
    setSubject(renderTemplate(selected.subject, vars));
    setBody(renderTemplate(selected.body, vars));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vars, selected?.id]);

  const resetCompose = () => {
    setSelected(null); setVars({}); setTo(""); setCc(""); setSubject(""); setBody("");
    setAttachments([]);
    changeTab("templates");
  };

  const applyQuoteDraft = (d: QuoteDraft) => {
    setSelected(null);
    setVars({});
    setTo(d.to);
    setCc("");
    setSubject(d.subject);
    setBody(d.body);
    setAttachments(d.attachments);
    changeTab("compose");
    toast({ title: "Brouillon généré", description: "Vérifiez puis envoyez la demande de devis." });
  };

  const handleSend = async () => {
    if (!isConnected) {
      toast({
        title: "Compte email non connecté",
        description: "Veuillez connecter votre compte email avant d'envoyer un message.",
        variant: "destructive",
      });
      changeTab("settings");
      return;
    }
    setSending(true);
    try {
      await sendEmail({
        to, cc, subject, body,
        is_html: selected?.is_html ?? true,
        template_id: selected?.id ?? null,
        template_name: selected?.name ?? (attachments.length || /Demande de devis/i.test(subject) ? "Demande de devis PDR" : null),
        attachments,
      });
      toast({ title: "Email envoyé avec succès" });
      await refreshLogs();
      resetCompose();
      changeTab("history");
    } catch (e) {
      toast({ title: "Échec de l'envoi", description: (e as Error).message, variant: "destructive" });
      await refreshLogs();
    } finally {
      setSending(false);
    }
  };

  const resend = (log: EmailLog) => {
    setSelected(null);
    setVars({});
    setTo(log.sent_to.join("; "));
    setCc(log.cc?.join("; ") ?? "");
    setSubject(log.subject);
    setBody(log.body ?? "");
    setAttachments([]);
    changeTab("compose");
  };


  const grouped = useMemo(() => {
    const map = new Map<string, EmailTemplate[]>();
    templates.forEach((t) => {
      const arr = map.get(t.category) ?? [];
      arr.push(t);
      map.set(t.category, arr);
    });
    return Array.from(map.entries());
  }, [templates]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" /> Email
          </h1>
          <p className="text-muted-foreground">Envoyez des emails depuis l'application via vos modèles</p>
        </div>
        {!accountLoading && (
          <Badge
            variant="outline"
            className={isConnected
              ? "gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
              : "gap-1.5 border-destructive/40 bg-destructive/10 text-destructive"}
          >
            {isConnected ? <MailCheck className="h-3.5 w-3.5" /> : <MailX className="h-3.5 w-3.5" />}
            {isConnected ? `Connecté — ${account?.email}` : "Déconnecté"}
          </Badge>
        )}
      </div>

      {!accountLoading && !isConnected && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Compte email non connecté</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            Veuillez connecter votre compte email avant d'envoyer un message.
            <Button size="sm" variant="outline" onClick={() => changeTab("settings")}>
              Paramètres Email
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList className="flex w-full overflow-x-auto sm:w-auto">
          <TabsTrigger value="templates" className="gap-1.5"><FileText className="h-4 w-4" />Modèles</TabsTrigger>
          <TabsTrigger value="devis" className="gap-1.5"><Truck className="h-4 w-4" />Devis PDR</TabsTrigger>
          <TabsTrigger value="compose" className="gap-1.5"><Send className="h-4 w-4" />Envoyer</TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5"><History className="h-4 w-4" />Historique</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5"><Plug className="h-4 w-4" />Paramètres</TabsTrigger>
        </TabsList>

        <TabsContent value="devis" className="pt-4">
          <PdrQuoteBuilder onDraft={applyQuoteDraft} />
        </TabsContent>


        {/* ---- Modèles ---- */}
        <TabsContent value="templates" className="space-y-5 pt-4">
          {templatesLoading && <p className="text-muted-foreground text-sm">Chargement…</p>}
          {!templatesLoading && templates.length === 0 && (
            <p className="text-muted-foreground text-sm">Aucun modèle disponible. Contactez votre administrateur.</p>
          )}
          {grouped.map(([cat, items]) => (
            <div key={cat} className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {CATEGORY_LABELS[cat] ?? cat}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {items.map((t) => (
                  <Card key={t.id} className="cursor-pointer transition-colors hover:border-primary/40" onClick={() => pickTemplate(t)}>
                    <CardContent className="space-y-1.5 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">{t.name}</p>
                        <Badge variant="secondary" className="shrink-0 text-[10px]">{CATEGORY_LABELS[t.category] ?? t.category}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{t.subject}</p>
                      {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {(t.variables ?? []).slice(0, 6).map((v) => (
                          <span key={v} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{`{{${v}}}`}</span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </TabsContent>

        {/* ---- Envoi ---- */}
        <TabsContent value="compose" className="pt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {selected ? `Modèle : ${selected.name}` : "Message libre"}
                </CardTitle>
                <CardDescription>Vous pouvez personnaliser l'objet et le corps avant l'envoi.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Destinataires <span className="text-muted-foreground text-xs">(séparés par ; ou ,)</span></Label>
                  <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="nom@entreprise.com; autre@entreprise.com" className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label>Copie (Cc)</Label>
                  <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Optionnel" className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label>Objet</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label>Corps du message {selected?.is_html !== false && <span className="text-muted-foreground text-xs">(HTML)</span>}</Label>
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} className="font-mono text-xs" />
                </div>
                {attachments.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5"><Paperclip className="h-4 w-4" />Pièces jointes ({attachments.length})</Label>
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((a, i) => (
                        <Badge key={`${a.url}-${i}`} variant="secondary" className="gap-1.5 py-1">
                          <span className="max-w-[180px] truncate">{a.filename}</span>
                          <button
                            type="button"
                            aria-label={`Retirer ${a.filename}`}
                            onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">

                  <Button onClick={handleSend} disabled={sending} className="h-11 gap-2">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Envoyer
                  </Button>
                  <Button variant="outline" onClick={resetCompose} className="h-11 gap-2">
                    <X className="h-4 w-4" /> Annuler
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {selected && Object.keys(vars).length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Variables</CardTitle>
                    <CardDescription>Remplies automatiquement quand c'est possible.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Object.keys(vars).map((k) => (
                      <div key={k} className="space-y-1">
                        <Label className="font-mono text-xs">{`{{${k}}}`}</Label>
                        <Input
                          value={vars[k]}
                          onChange={(e) => setVars((p) => ({ ...p, [k]: e.target.value }))}
                          className="h-10"
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Prévisualisation</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-2 text-sm font-medium">{subject || "(objet vide)"}</p>
                  <Separator className="mb-3" />
                  {selected?.is_html === false
                    ? <pre className="whitespace-pre-wrap text-sm">{body}</pre>
                    : <div className="prose-sm max-w-none text-sm [&_a]:text-primary" dangerouslySetInnerHTML={{ __html: body }} />}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ---- Historique ---- */}
        <TabsContent value="history" className="pt-4">
          <Card>
            <CardContent className="p-0">
              {logsLoading && <p className="p-4 text-sm text-muted-foreground">Chargement…</p>}
              {!logsLoading && logs.length === 0 && <p className="p-4 text-sm text-muted-foreground">Aucun email envoyé pour le moment.</p>}
              {logs.length > 0 && (
                <div className="divide-y">
                  {logs.map((l) => (
                    <div key={l.id} className="flex flex-wrap items-center gap-3 p-3">
                      <StatusBadge status={l.status} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{l.subject}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {new Date(l.sent_at ?? l.created_at).toLocaleString("fr-FR")} · {l.sent_to.join(", ")}
                          {l.template_name ? ` · ${l.template_name}` : ""}
                        </p>
                        {l.status === "failed" && l.error_message && (
                          <p className="truncate text-xs text-destructive">{l.error_message}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setPreview(l)}>
                          <Eye className="h-4 w-4" /> Afficher
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => resend(l)}>
                          <RotateCcw className="h-4 w-4" /> Renvoyer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Paramètres ---- */}
        <TabsContent value="settings" className="pt-4">
          <EmailSettings
            account={account}
            loading={accountLoading}
            onConnect={connect}
            onDisconnect={disconnect}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-8 text-base">{preview?.subject}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-3 text-sm">
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>De : {preview.from_email}</p>
                <p>À : {preview.sent_to.join(", ")}</p>
                {preview.cc?.length > 0 && <p>Cc : {preview.cc.join(", ")}</p>}
                <p>Le {new Date(preview.sent_at ?? preview.created_at).toLocaleString("fr-FR")}</p>
              </div>
              <Separator />
              {preview.is_html
                ? <div className="prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: preview.body ?? "" }} />
                : <pre className="whitespace-pre-wrap">{preview.body}</pre>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "sent") {
    return <Badge variant="outline" className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="h-3 w-3" />Envoyé</Badge>;
  }
  if (status === "failed") {
    return <Badge variant="outline" className="gap-1 border-destructive/40 bg-destructive/10 text-destructive"><AlertTriangle className="h-3 w-3" />Échec</Badge>;
  }
  return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />En attente</Badge>;
}

function EmailSettings({ account, loading, onConnect, onDisconnect }: {
  account: ReturnType<typeof useEmailAccount>["account"];
  loading: boolean;
  onConnect: ReturnType<typeof useEmailAccount>["connect"];
  onDisconnect: ReturnType<typeof useEmailAccount>["disconnect"];
}) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [provider, setProvider] = useState("gmail");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [secure, setSecure] = useState("tls");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  const connected = !!account?.is_connected;

  const handleConnect = async () => {
    setBusy(true);
    try {
      await onConnect({
        email: email.trim(),
        password,
        provider,
        smtp_host: provider === "custom" ? host.trim() : undefined,
        smtp_port: provider === "custom" ? Number(port) : undefined,
        smtp_secure: provider === "custom" ? secure : undefined,
        display_name: displayName.trim() || undefined,
      });
      setPassword("");
      toast({ title: "Compte email connecté" });
    } catch (e) {
      toast({ title: "Connexion impossible", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await onDisconnect();
      toast({ title: "Compte email déconnecté" });
    } catch (e) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-base">Paramètres Email</CardTitle>
        <CardDescription>
          Connectez votre compte pour envoyer des emails en votre nom. Le mot de passe est chiffré
          avant d'être stocké et n'est jamais réaffiché.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : connected ? (
          <>
            <div className="rounded-lg border bg-muted/40 p-4">
              <div className="flex items-center gap-2 font-medium text-emerald-600">
                <MailCheck className="h-4 w-4" /> Connecté
              </div>
              <p className="mt-1 text-sm">{account?.email}</p>
              <p className="text-xs text-muted-foreground">
                {account?.smtp_host}:{account?.smtp_port} ({account?.smtp_secure}) ·
                {account?.connected_at ? ` depuis le ${new Date(account.connected_at).toLocaleString("fr-FR")}` : ""}
              </p>
            </div>
            <Button variant="destructive" onClick={handleDisconnect} disabled={busy} className="h-11 gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
              Déconnecter
            </Button>
          </>
        ) : (
          <>
            {account?.last_error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{account.last_error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label>Fournisseur</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gmail">Gmail</SelectItem>
                  <SelectItem value="outlook">Outlook / Microsoft 365</SelectItem>
                  <SelectItem value="custom">Serveur SMTP personnalisé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Adresse email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="h-11" placeholder="prenom.nom@entreprise.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Mot de passe {provider !== "custom" && <span className="text-xs text-muted-foreground">(mot de passe d'application)</span>}</Label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="h-11" autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label>Nom affiché <span className="text-xs text-muted-foreground">(optionnel)</span></Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-11" />
            </div>
            {provider === "custom" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Serveur SMTP</Label>
                  <Input value={host} onChange={(e) => setHost(e.target.value)} className="h-11" placeholder="smtp.entreprise.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Port</Label>
                  <Input value={port} onChange={(e) => setPort(e.target.value)} className="h-11" inputMode="numeric" />
                </div>
                <div className="space-y-1.5">
                  <Label>Sécurité</Label>
                  <Select value={secure} onValueChange={setSecure}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tls">STARTTLS</SelectItem>
                      <SelectItem value="ssl">SSL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <Button onClick={handleConnect} disabled={busy || !email || !password} className="h-11 gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              Se connecter
            </Button>
            <p className="text-xs text-muted-foreground">
              Gmail et Outlook exigent un mot de passe d'application (authentification à deux facteurs activée).
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
