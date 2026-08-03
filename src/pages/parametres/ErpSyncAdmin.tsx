import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAllRoles } from "@/hooks/useAllRoles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2, Plug, Copy, PlayCircle, ShieldCheck, Activity, ListChecks,
  RefreshCw, AlertTriangle, CheckCircle2, BookOpen, KeyRound, Eye, EyeOff, Server,
} from "lucide-react";


const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/erp-sync/api`;

const DEFAULT_ROLES = [
  "admin",
  "responsable_si",
  "bureau_methode",
  "gestionnaire_magasin",
  "responsable_magasin",
];

const ENDPOINTS: { path: string; label: string; group: string }[] = [
  { path: "/ping", label: "Sonde de disponibilité", group: "Système" },
  { path: "/docs", label: "Spécification OpenAPI", group: "Système" },
  { path: "/sync/articles?limit=5", label: "Articles PDR", group: "Export" },
  { path: "/sync/articles/production?limit=5", label: "Produits finis", group: "Export" },
  { path: "/sync/nomenclatures?limit=5", label: "Nomenclatures (BOM)", group: "Export" },
  { path: "/sync/stock?limit=5", label: "Stocks", group: "Export" },
  { path: "/sync/orders?limit=5", label: "Ordres de fabrication", group: "Export" },
  { path: "/sync/campagnes?limit=5", label: "Campagnes réception", group: "Export" },
  { path: "/sync/whoami", label: "Vérifier l'authentification", group: "Système" },
  { path: "/sync/status", label: "État de santé", group: "Supervision" },

  { path: "/sync/last", label: "Dernière synchronisation", group: "Supervision" },
  { path: "/sync/history?limit=5", label: "Historique des appels", group: "Supervision" },
];

interface StateRow {
  resource: string;
  last_success_at: string | null;
  last_error_at: string | null;
  last_record_count: number | null;
  last_error: string | null;
}

interface LogRow {
  id: string;
  created_at: string;
  direction: string;
  resource: string;
  method: string;
  status_code: number;
  ok: boolean;
  record_count: number | null;
  duration_ms: number | null;
  actor_email: string | null;
  error: string | null;
}

const fmt = (v: string | null) => (v ? new Date(v).toLocaleString("fr-FR") : "—");

export default function ErpSyncAdmin() {
  const { hasRole, loading: authLoading } = useAuth();
  const isAdmin = hasRole("admin");
  const { roles: allRoles } = useAllRoles();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [allowedRoles, setAllowedRoles] = useState<string[]>(DEFAULT_ROLES);
  const [retention, setRetention] = useState("30");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [serviceUserId, setServiceUserId] = useState("");
  const [users, setUsers] = useState<{ id: string; label: string }[]>([]);
  const [testWithKey, setTestWithKey] = useState(false);


  const [state, setState] = useState<StateRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [okFilter, setOkFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const [testPath, setTestPath] = useState(ENDPOINTS[0].path);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: number; body: string } | null>(null);

  const loadConfig = useCallback(async () => {
    const [{ data }, { data: profs }] = await Promise.all([
      supabase
        .from("app_settings")
        .select("key, value")
        .in("key", [
          "erp_sync.enabled",
          "erp_sync.allowed_roles",
          "erp_sync.log_retention_days",
          "erp_sync.api_key",
          "erp_sync.service_user_id",
        ]),
      supabase.from("profiles").select("user_id, first_name, last_name").eq("is_active", true).order("last_name"),
    ]);
    const map: Record<string, string> = {};
    for (const r of data ?? []) map[r.key] = r.value ?? "";
    setEnabled(map["erp_sync.enabled"] !== "false");
    const roles = (map["erp_sync.allowed_roles"] ?? "").split(",").map((r) => r.trim()).filter(Boolean);
    setAllowedRoles(roles.length ? roles : DEFAULT_ROLES);
    setRetention(map["erp_sync.log_retention_days"] || "30");
    setApiKey(map["erp_sync.api_key"] || "");
    setServiceUserId(map["erp_sync.service_user_id"] || "");
    setUsers(
      (profs ?? []).map((p) => ({
        id: p.user_id,
        label: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.user_id,
      })),
    );
  }, []);


  const loadActivity = useCallback(async () => {
    setRefreshing(true);
    const [{ data: st }, logsRes] = await Promise.all([
      supabase.from("erp_sync_state" as never).select("*").order("resource"),
      (() => {
        let q = supabase
          .from("erp_sync_logs" as never)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);
        if (okFilter !== "all") q = q.eq("ok", okFilter === "ok");
        return q;
      })(),
    ]);
    setState((st ?? []) as unknown as StateRow[]);
    setLogs((logsRes.data ?? []) as unknown as LogRow[]);
    setRefreshing(false);
  }, [okFilter]);

  useEffect(() => {
    if (authLoading || !isAdmin) { setLoading(!authLoading ? false : true); return; }
    (async () => {
      await Promise.all([loadConfig(), loadActivity()]);
      setLoading(false);
    })();
  }, [authLoading, isAdmin, loadConfig, loadActivity]);

  const stats = useMemo(() => {
    const cutoff = Date.now() - 24 * 3600 * 1000;
    const recent = logs.filter((l) => new Date(l.created_at).getTime() >= cutoff);
    const errors = recent.filter((l) => !l.ok).length;
    return { calls: recent.length, errors, healthy: errors === 0 };
  }, [logs]);

  function generateKey() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const raw = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    setApiKey(`erp_${raw}`);
    setShowKey(true);
    toast.info("Clé générée — copiez-la puis enregistrez");
  }

  async function handleSave() {
    if (!allowedRoles.length) {
      toast.error("Sélectionnez au moins un rôle autorisé");
      return;
    }
    if (apiKey && apiKey.trim().length < 16) {
      toast.error("La clé de service doit contenir au moins 16 caractères");
      return;
    }
    if (apiKey && !serviceUserId) {
      toast.error("Sélectionnez l'utilisateur technique associé à la clé de service");
      return;
    }
    setSaving(true);
    try {
      const rows = [
        { key: "erp_sync.enabled", value: enabled ? "true" : "false", label: "API ERP activée", description: "Interrupteur global de l'API de synchronisation ERP", is_secret: false },
        { key: "erp_sync.allowed_roles", value: allowedRoles.join(","), label: "Rôles autorisés API ERP", description: "Rôles pouvant appeler l'API de synchronisation", is_secret: false },
        { key: "erp_sync.log_retention_days", value: String(Math.max(1, parseInt(retention) || 30)), label: "Rétention des journaux ERP (jours)", description: "Durée de conservation des journaux d'appels", is_secret: false },
        { key: "erp_sync.api_key", value: apiKey.trim(), label: "Clé de service API ERP", description: "Clé machine-to-machine (header X-API-Key). Plusieurs clés séparées par des virgules pour la rotation.", is_secret: true },
        { key: "erp_sync.service_user_id", value: serviceUserId, label: "Utilisateur technique API ERP", description: "Compte auquel sont imputées les écritures faites via clé de service", is_secret: false },
      ];
      const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
      toast.success("Configuration enregistrée — prise en compte immédiate par l'API");
    } catch (e) {
      toast.error(`Échec: ${(e as Error).message}`);
    } finally { setSaving(false); }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const headers: Record<string, string> = { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY };
      if (testWithKey) {
        if (!apiKey.trim()) throw new Error("Aucune clé de service saisie");
        headers["X-API-Key"] = apiKey.trim();
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      }
      const res = await fetch(`${BASE_URL}${testPath}`, { headers });
      const text = await res.text();
      let pretty = text;
      try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /* texte brut */ }
      setTestResult({ status: res.status, body: pretty.slice(0, 4000) });
      if (res.ok) toast.success(`${res.status} — réponse reçue`);
      else toast.error(`${res.status} — voir le détail`);
      loadActivity();
    } catch (e) {
      toast.error(`Échec de l'appel: ${(e as Error).message}`);
    } finally { setTesting(false); }
  }


  function copy(v: string) {
    navigator.clipboard?.writeText(v);
    toast.success("Copié");
  }

  if (authLoading || loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!isAdmin) {
    return (
      <div className="p-8">
        <Card className="max-w-lg">
          <CardContent className="p-6 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">Accès réservé aux administrateurs</p>
              <p className="text-sm text-muted-foreground">
                Seul le rôle Administrateur peut consulter et modifier la configuration de l'API ERP.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Plug className="h-6 w-6" /> API de synchronisation ERP</h1>
          <p className="text-muted-foreground">Configuration, supervision et test de l'interface ERP — réservé à l'administrateur</p>
        </div>
        <Badge variant={enabled ? "default" : "destructive"} className="text-xs">
          {enabled ? "API activée" : "API désactivée"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground truncate">État</p>
          <p className={`text-lg font-bold flex items-center gap-1 ${stats.healthy ? "text-emerald-600" : "text-amber-600"}`}>
            {stats.healthy ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {stats.healthy ? "Sain" : "Dégradé"}
          </p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground truncate">Appels 24 h</p>
          <p className="text-lg font-bold tabular-nums">{stats.calls}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground truncate">Erreurs 24 h</p>
          <p className={`text-lg font-bold tabular-nums ${stats.errors ? "text-destructive" : ""}`}>{stats.errors}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground truncate">Ressources suivies</p>
          <p className="text-lg font-bold tabular-nums">{state.length}</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="config">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="test">Test des endpoints</TabsTrigger>
          <TabsTrigger value="activity">Supervision</TabsTrigger>
          <TabsTrigger value="doc">Documentation</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" /> Disponibilité</CardTitle>
              <CardDescription>
                Lorsque l'API est désactivée, tous les endpoints métier répondent 503. Les sondes
                <code className="mx-1">/ping</code> et <code className="mx-1">/docs</code> restent accessibles.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>API de synchronisation activée</Label>
                  <p className="text-sm text-muted-foreground">Interrupteur global côté serveur</p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
              <div className="space-y-2">
                <Label>URL de base (à communiquer à l'ERP)</Label>
                <div className="flex gap-2">
                  <Input readOnly value={BASE_URL} className="font-mono text-xs" />
                  <Button type="button" variant="outline" size="icon" onClick={() => copy(BASE_URL)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2 max-w-xs">
                <Label>Rétention des journaux (jours)</Label>
                <Input type="number" min={1} value={retention} onChange={(e) => setRetention(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" /> Clé de service (intégration serveur )</CardTitle>
              <CardDescription>
                Pour un serveur ERP auto-hébergé : aucune session utilisateur nécessaire, il suffit d'envoyer
                l'en-tête <code className="mx-1">X-API-Key</code>. Plusieurs clés séparées par des virgules
                permettent une rotation sans coupure.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Clé de service</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={apiKey}
                    type={showKey ? "text" : "password"}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="erp_..."
                    className="font-mono text-xs"
                  />
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="icon" onClick={() => setShowKey((v) => !v)}>
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button type="button" variant="outline" size="icon" onClick={() => copy(apiKey)} disabled={!apiKey}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" onClick={generateKey}>Générer</Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Laissez vide pour désactiver l'accès par clé (seul le JWT applicatif sera accepté).
                </p>
              </div>
              <div className="space-y-2 max-w-sm">
                <Label>Utilisateur technique (imputation des écritures)</Label>
                <Select value={serviceUserId} onValueChange={setServiceUserId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un compte" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Les consommations importées par l'ERP seront tracées sur ce compte.
                </p>
              </div>
            </CardContent>
          </Card>


          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" /> Rôles autorisés à appeler l'API</CardTitle>
              <CardDescription>
                Un jeton applicatif est toujours exigé. Seuls les rôles cochés obtiennent une réponse (sinon 403).
                L'accès à cet écran de configuration reste, lui, exclusivement administrateur.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {allRoles.map((r) => {
                  const checked = allowedRoles.includes(r.code);
                  return (
                    <label key={r.code} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/50">
                      <Checkbox
                        checked={checked}
                        disabled={r.code === "admin"}
                        onCheckedChange={(v) =>
                          setAllowedRoles((prev) => (v ? [...new Set([...prev, r.code])] : prev.filter((c) => c !== r.code)))
                        }
                      />
                      <span className="text-sm truncate">{r.label}</span>
                      {r.isCustom && <Badge variant="outline" className="text-[10px] ml-auto">perso</Badge>}
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Le rôle Administrateur est toujours autorisé afin de ne jamais perdre la main sur l'interface.
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Enregistrer
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="test" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Appel de test</CardTitle>
              <CardDescription>
                L'appel est journalisé comme un appel ERP réel. Choisissez le mode d'authentification pour
                valider exactement ce que fera votre serveur.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={testPath} onValueChange={setTestPath}>
                  <SelectTrigger className="sm:flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENDPOINTS.map((e) => (
                      <SelectItem key={e.path} value={e.path}>
                        {e.group} — {e.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleTest} disabled={testing}>
                  {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
                  Tester
                </Button>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={testWithKey} onCheckedChange={(v) => setTestWithKey(!!v)} />
                Tester avec la clé de service (X-API-Key) au lieu de ma session
              </label>
              <p className="text-xs font-mono text-muted-foreground break-all">GET {BASE_URL}{testPath}</p>

              {testResult && (
                <div className="space-y-2">
                  <Badge variant={testResult.status < 400 ? "default" : "destructive"}>HTTP {testResult.status}</Badge>
                  <pre className="text-xs bg-muted rounded-lg p-3 overflow-auto max-h-80 whitespace-pre-wrap">{testResult.body}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={okFilter} onValueChange={setOkFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les appels</SelectItem>
                <SelectItem value="ok">Succès uniquement</SelectItem>
                <SelectItem value="ko">Erreurs uniquement</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadActivity} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} /> Rafraîchir
            </Button>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ListChecks className="h-4 w-4" /> État par ressource</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Ressource</th>
                      <th className="text-left p-3">Dernier succès</th>
                      <th className="text-left p-3">Volume</th>
                      <th className="text-left p-3">Dernière erreur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.length === 0 && (
                      <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Aucune synchronisation enregistrée</td></tr>
                    )}
                    {state.map((s) => (
                      <tr key={s.resource} className="border-t">
                        <td className="p-3 font-mono text-xs">{s.resource}</td>
                        <td className="p-3">{fmt(s.last_success_at)}</td>
                        <td className="p-3 tabular-nums">{s.last_record_count ?? "—"}</td>
                        <td className="p-3 text-xs text-muted-foreground max-w-[16rem] truncate">
                          {s.last_error ? `${fmt(s.last_error_at)} — ${s.last_error}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Journal des appels (100 derniers)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Date</th>
                      <th className="text-left p-3">Ressource</th>
                      <th className="text-left p-3">Méthode</th>
                      <th className="text-left p-3">Code</th>
                      <th className="text-left p-3">Lignes</th>
                      <th className="text-left p-3">Durée</th>
                      <th className="text-left p-3">Acteur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 && (
                      <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Aucun appel journalisé</td></tr>
                    )}
                    {logs.map((l) => (
                      <tr key={l.id} className="border-t">
                        <td className="p-3 whitespace-nowrap">{fmt(l.created_at)}</td>
                        <td className="p-3 font-mono text-xs">{l.resource}</td>
                        <td className="p-3">{l.method}</td>
                        <td className="p-3">
                          <Badge variant={l.ok ? "outline" : "destructive"} className="text-xs">{l.status_code}</Badge>
                        </td>
                        <td className="p-3 tabular-nums">{l.record_count ?? "—"}</td>
                        <td className="p-3 tabular-nums">{l.duration_ms != null ? `${l.duration_ms} ms` : "—"}</td>
                        <td className="p-3 text-xs text-muted-foreground truncate max-w-[12rem]">
                          {l.actor_email ?? "—"}{l.error ? ` — ${l.error}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="doc" className="pt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4" /> Intégration depuis votre serveur (hors Lovable)</CardTitle>
              <CardDescription>
                Deux en-têtes suffisent : <code>apikey</code> (clé publiable du backend) et <code>X-API-Key</code>
                (clé de service ci-dessus). Aucune connexion utilisateur, aucun rafraîchissement de jeton.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  t: "Vérifier la connexion (curl)",
                  c: `curl -s "${BASE_URL}/sync/whoami" \\
  -H "apikey: $LOVABLE_ANON_KEY" \\
  -H "X-API-Key: $ERP_API_KEY"`,
                },
                {
                  t: "Exporter les articles (pagination)",
                  c: `curl -s "${BASE_URL}/sync/articles?page=1&limit=500&updated_since=2026-01-01T00:00:00Z" \\
  -H "apikey: $LOVABLE_ANON_KEY" \\
  -H "X-API-Key: $ERP_API_KEY"`,
                },
                {
                  t: "Importer des consommations (idempotent via erp_ref)",
                  c: `curl -s -X POST "${BASE_URL}/sync/consumption/pdr" \\
  -H "apikey: $LOVABLE_ANON_KEY" \\
  -H "X-API-Key: $ERP_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"items":[{"article_code":"CHN-08B","quantite":1,"of_numero":"OF-2026-0005","erp_ref":"ERP-000123"}]}'`,
                },
                {
                  t: "Variables d'environnement côté serveur",
                  c: `LOVABLE_ANON_KEY=${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}
ERP_API_BASE=${BASE_URL}
ERP_API_KEY=<clé de service générée dans cet écran>`,
                },
              ].map((s) => (
                <div key={s.t} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">{s.t}</p>
                    <Button variant="ghost" size="icon" onClick={() => copy(s.c)}><Copy className="h-4 w-4" /></Button>
                  </div>
                  <pre className="text-xs bg-muted rounded-lg p-3 overflow-x-auto whitespace-pre">{s.c}</pre>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Codes de retour : 200 OK, 207 import partiel, 400 validation, 401 clé/jeton invalide,
                403 rôle insuffisant, 404 endpoint inconnu, 503 API désactivée. En cas de 503, réessayez plus tard :
                l'interrupteur est piloté depuis cet écran.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" /> Endpoints disponibles</CardTitle>
              <CardDescription>
                Authentification : <code>X-API-Key</code> (serveur) ou <code>Authorization: Bearer &lt;jeton&gt;</code>, plus <code>apikey</code>.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {["Système", "Export", "Supervision"].map((g) => (
                <div key={g} className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">{g}</p>
                  {ENDPOINTS.filter((e) => e.group === g).map((e) => (
                    <div key={e.path} className="flex items-center justify-between gap-3 rounded-md border p-2">
                      <div className="min-w-0">
                        <p className="text-sm truncate">{e.label}</p>
                        <p className="text-xs font-mono text-muted-foreground truncate">GET {e.path.split("?")[0]}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => copy(`${BASE_URL}${e.path.split("?")[0]}`)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ))}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Import (ERP → application)</p>
                {["/sync/consumption/pdr", "/sync/consumption/articles", "/sync/consumption/batch"].map((p) => (
                  <div key={p} className="flex items-center justify-between gap-3 rounded-md border p-2">
                    <p className="text-xs font-mono text-muted-foreground truncate">POST {p}</p>
                    <Button variant="ghost" size="icon" onClick={() => copy(`${BASE_URL}${p}`)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
