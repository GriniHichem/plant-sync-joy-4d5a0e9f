import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollTable } from "@/components/responsive/ScrollTable";
import { ResponsiveDialog } from "@/components/responsive/ResponsiveDialog";
import {
  ArrowLeft, FileText, Link2, Lock, RotateCcw, Save, Search, Target, Unlock,
} from "lucide-react";
import {
  EVENT_TYPES, buildReportHtml, canEditInvestigation, countByType, eventTypeClass,
  eventTypeLabel, filterEvents, formatOffset, offsetMinutes, printReport,
  probableSource, sortEvents, statusLabel, timelinePosition,
  defaultLotReference,
} from "@/lib/lotInvestigation";
import { logInvestigation, useLotEvents, useLotInvestigation, useLotInvestigationPermissions } from "@/hooks/useLotInvestigations";

const NONE = "__none__";
const OPEN_NC_STATUSES = ["draft", "declared", "under_review", "blocked", "decision_pending", "action_in_progress"];

const fmtTime = (v: string) =>
  new Date(v).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const fmtDate = (v: string) => new Date(v).toLocaleDateString("fr-FR");

export default function QualiteEnqueteLotDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth() as any;
  const { canManage } = useLotInvestigationPermissions();
  const { inv, logs, loading, reload } = useLotInvestigation(id);

  const [products, setProducts] = useState<{ id: string; code: string | null; designation: string }[]>([]);
  const [ncs, setNcs] = useState<{ id: string; nc_number: string | null; title: string; status: string }[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  const [draft, setDraft] = useState({
    lot_reference: "", product_id: NONE, anomaly_description: "",
    analysis: "", conclusion: "", window_hours: "2",
    production_date: "", production_time: "",
  });
  const [saving, setSaving] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [ncDialog, setNcDialog] = useState(false);
  const [ncMode, setNcMode] = useState<"link" | "create">("link");
  const [ncPick, setNcPick] = useState<string>(NONE);
  const [newNc, setNewNc] = useState({ title: "", nc_type: "produit_fini", severity: "major" });

  useEffect(() => {
    (async () => {
      const [p, n, pr] = await Promise.all([
        (supabase as any).from("products").select("id, code, designation").order("designation"),
        (supabase as any).from("quality_non_conformities").select("id, nc_number, title, status").order("detected_at", { ascending: false }).limit(300),
        (supabase as any).from("profiles").select("user_id, first_name, last_name"),
      ]);
      setProducts((p.data ?? []) as typeof products);
      setNcs((n.data ?? []) as typeof ncs);
      const map: Record<string, string> = {};
      for (const row of (pr.data ?? []) as any[]) {
        map[row.user_id] = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Utilisateur";
      }
      setProfiles(map);
    })();
  }, []);

  useEffect(() => {
    if (!inv) return;
    setDraft({
      lot_reference: inv.lot_reference ?? "",
      product_id: inv.product_id ?? NONE,
      anomaly_description: inv.anomaly_description ?? "",
      analysis: inv.analysis ?? "",
      conclusion: inv.conclusion ?? "",
      window_hours: String(inv.window_hours ?? 2),
      production_date: inv.production_date,
      production_time: inv.production_time.slice(0, 5),
    });
  }, [inv?.id, inv?.updated_at]);

  const eventParams = useMemo(
    () =>
      draft.production_date && draft.production_time
        ? {
            date: draft.production_date,
            time: draft.production_time,
            windowHours: Number(String(draft.window_hours).replace(",", ".")) || 2,
          }
        : undefined,
    [draft.production_date, draft.production_time, draft.window_hours],
  );
  const { events, loading: eventsLoading, window: win } = useLotEvents(eventParams);

  const sorted = useMemo(() => sortEvents(events), [events]);
  const visible = useMemo(
    () => filterEvents(sorted, { types: typeFilter, search }),
    [sorted, typeFilter, search],
  );
  const counts = useMemo(() => countByType(sorted), [sorted]);
  const source = useMemo(() => (win ? probableSource(sorted, win.center) : null), [sorted, win]);

  const editable = canManage && !!inv && canEditInvestigation(inv);
  const productLabel = (pid: string | null) => {
    const p = products.find((x) => x.id === pid);
    return p ? `${p.code ? p.code + " · " : ""}${p.designation}` : "—";
  };
  const ncLabelOf = (nid: string | null) => {
    const n = ncs.find((x) => x.id === nid);
    return n ? `${n.nc_number ?? "NC"} — ${n.title}` : null;
  };

  const save = async () => {
    if (!inv) return;
    setSaving(true);
    const payload = {
      lot_reference: draft.lot_reference.trim() || defaultLotReference(draft.production_date) || null,
      product_id: draft.product_id === NONE ? null : draft.product_id,
      anomaly_description: draft.anomaly_description.trim() || null,
      analysis: draft.analysis.trim() || null,
      conclusion: draft.conclusion.trim() || null,
      window_hours: Number(String(draft.window_hours).replace(",", ".")) || 2,
      production_date: draft.production_date,
      production_time: draft.production_time,
    };
    const { error } = await (supabase as any)
      .from("quality_lot_investigations").update(payload).eq("id", inv.id);
    setSaving(false);
    if (error) {
      toast({ title: "Enregistrement impossible", description: error.message, variant: "destructive" });
      return;
    }
    await logInvestigation(inv.id, "Modification de l'enquête", payload as Record<string, unknown>);
    toast({ title: "Enquête enregistrée" });
    await reload();
  };

  const toggleStatus = async () => {
    if (!inv) return;
    const closing = inv.status !== "cloturee";
    const { error } = await (supabase as any)
      .from("quality_lot_investigations")
      .update(
        closing
          ? { status: "cloturee", closed_at: new Date().toISOString(), closed_by: user?.id ?? null }
          : { status: "en_cours", reopened_at: new Date().toISOString(), closed_at: null, closed_by: null },
      )
      .eq("id", inv.id);
    if (error) {
      toast({ title: "Action impossible", description: error.message, variant: "destructive" });
      return;
    }
    await logInvestigation(inv.id, closing ? "Clôture de l'enquête" : "Réouverture de l'enquête");
    toast({ title: closing ? "Enquête clôturée" : "Enquête réouverte" });
    await reload();
  };

  const linkNc = async () => {
    if (!inv) return;
    let ncId = ncPick === NONE ? null : ncPick;
    if (ncMode === "create") {
      if (!newNc.title.trim()) {
        toast({ title: "Titre de la non-conformité obligatoire", variant: "destructive" });
        return;
      }
      const { data, error } = await (supabase as any)
        .from("quality_non_conformities")
        .insert({
          title: newNc.title.trim(),
          nc_type: newNc.nc_type,
          severity: newNc.severity,
          status: "declared",
          description: inv.anomaly_description,
          product_id: inv.product_id,
          lot_number: inv.lot_reference,
          detected_at: new Date(`${inv.production_date}T${inv.production_time.slice(0, 5)}:00`).toISOString(),
          declared_by: user?.id ?? null,
        })
        .select().single();
      if (error) {
        toast({ title: "Création NC impossible", description: error.message, variant: "destructive" });
        return;
      }
      ncId = data.id;
      setNcs((prev) => [{ id: data.id, nc_number: data.nc_number, title: data.title, status: data.status }, ...prev]);
    }
    if (!ncId) {
      toast({ title: "Sélectionnez une non-conformité", variant: "destructive" });
      return;
    }
    const { error } = await (supabase as any)
      .from("quality_lot_investigations").update({ nc_id: ncId }).eq("id", inv.id);
    if (error) {
      toast({ title: "Liaison impossible", description: error.message, variant: "destructive" });
      return;
    }
    await logInvestigation(inv.id, "Liaison à une non-conformité", { nc_id: ncId });
    toast({ title: "Enquête reliée à la non-conformité" });
    setNcDialog(false);
    await reload();
  };

  const unlinkNc = async () => {
    if (!inv) return;
    await (supabase as any).from("quality_lot_investigations").update({ nc_id: null }).eq("id", inv.id);
    await logInvestigation(inv.id, "Suppression du lien avec la non-conformité");
    await reload();
  };

  const report = () => {
    if (!inv) return;
    const html = buildReportHtml({
      inv,
      productLabel: productLabel(inv.product_id),
      ncLabel: ncLabelOf(inv.nc_id),
      events: sorted,
      logs: logs.map((l) => ({
        action: l.action,
        created_at: l.created_at,
        user_label: l.user_id ? profiles[l.user_id] ?? "Utilisateur" : "—",
      })),
      signature: { name: `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "—" },
    });
    if (!printReport(html)) {
      toast({ title: "Fenêtre bloquée", description: "Autorisez les pop-ups pour générer le rapport.", variant: "destructive" });
    }
  };

  const toggleType = (t: string) =>
    setTypeFilter((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Chargement de l'enquête…</div>;
  }
  if (!inv) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-muted-foreground">Enquête introuvable.</p>
        <Button variant="outline" onClick={() => navigate("/qualite/enquetes-lot")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/qualite/enquetes-lot")} aria-label="Retour">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-2xl font-semibold tracking-tight font-mono">
                {inv.investigation_number ?? "Enquête"}
              </h1>
              <Badge variant={inv.status === "cloturee" ? "secondary" : "default"}>{statusLabel(inv.status)}</Badge>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground">
              Production du {fmtDate(inv.production_date)} à {inv.production_time.slice(0, 5)} · périmètre ± {inv.window_hours} h
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={report}>
            <FileText className="h-4 w-4 mr-2" /> Rapport
          </Button>
          {canManage && (
            <>
              <Button variant="outline" onClick={() => setNcDialog(true)}>
                <Link2 className="h-4 w-4 mr-2" /> {inv.nc_id ? "Changer la NC" : "Relier à une NC"}
              </Button>
              <Button variant={inv.status === "cloturee" ? "outline" : "default"} onClick={toggleStatus}>
                {inv.status === "cloturee" ? <Unlock className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                {inv.status === "cloturee" ? "Réouvrir" : "Clôturer"}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Colonne gauche : infos + chronologie visuelle */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Informations du lot</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Date production</Label>
                  <Input type="date" disabled={!editable} value={draft.production_date}
                    onChange={(e) => setDraft({ ...draft, production_date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Heure production</Label>
                  <Input type="time" disabled={!editable} value={draft.production_time}
                    onChange={(e) => setDraft({ ...draft, production_time: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">N° de lot (défaut : jour de l'année)</Label>
                  <Input disabled={!editable} placeholder={`Auto : ${defaultLotReference(draft.production_date)}`} value={draft.lot_reference}
                    onChange={(e) => setDraft({ ...draft, lot_reference: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Périmètre (± h)</Label>
                  <Input inputMode="decimal" disabled={!editable} value={draft.window_hours}
                    onChange={(e) => setDraft({ ...draft, window_hours: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Produit concerné</Label>
                <Select value={draft.product_id} disabled={!editable}
                  onValueChange={(v) => setDraft({ ...draft, product_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Non précisé</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ""}{p.designation}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description de l'anomalie</Label>
                <Textarea rows={3} disabled={!editable} value={draft.anomaly_description}
                  onChange={(e) => setDraft({ ...draft, anomaly_description: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Analyse</Label>
                <Textarea rows={3} disabled={!editable} value={draft.analysis}
                  onChange={(e) => setDraft({ ...draft, analysis: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Conclusion</Label>
                <Textarea rows={2} disabled={!editable} value={draft.conclusion}
                  onChange={(e) => setDraft({ ...draft, conclusion: e.target.value })} />
              </div>
              {editable && (
                <Button className="w-full" onClick={save} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" /> {saving ? "Enregistrement…" : "Enregistrer"}
                </Button>
              )}
              {inv.nc_id && (
                <div className="rounded-lg border p-3 text-xs space-y-2">
                  <div className="font-medium">Non-conformité liée</div>
                  <div className="text-muted-foreground">{ncLabelOf(inv.nc_id) ?? "NC"}</div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/qualite/non-conformites?focus=${inv.nc_id}`)}>
                      Ouvrir la NC
                    </Button>
                    {canManage && (
                      <Button variant="ghost" size="sm" onClick={unlinkNc}>Délier</Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Source probable
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {source ? (
                <div className="space-y-1">
                  <Badge variant="outline" className={eventTypeClass(String(source.event_type))}>
                    {eventTypeLabel(String(source.event_type))}
                  </Badge>
                  <div className="font-medium">{source.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtTime(source.occurred_at)} · {win ? formatOffset(offsetMinutes(source.occurred_at, win.center)) : ""}
                  </div>
                  {source.detail && <div className="text-xs text-muted-foreground">{source.detail}</div>}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Aucun événement impactant détecté sur la période.</p>
              )}
            </CardContent>
          </Card>

          {/* Chronologie visuelle */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Chronologie</CardTitle></CardHeader>
            <CardContent>
              {win && (
                <div className="text-[11px] text-muted-foreground mb-2 flex justify-between">
                  <span>{fmtTime(win.from.toISOString())}</span>
                  <span className="font-medium text-foreground">{fmtTime(win.center.toISOString())}</span>
                  <span>{fmtTime(win.to.toISOString())}</span>
                </div>
              )}
              <div className="relative pl-3 border-l-2 border-border space-y-3 max-h-[420px] overflow-y-auto">
                {win && (
                  <div
                    className="absolute -left-[5px] w-2 h-2 rounded-full bg-primary ring-4 ring-primary/20"
                    style={{ top: `${timelinePosition(win.center.toISOString(), win.from, win.to)}%` }}
                    aria-hidden
                  />
                )}
                {!visible.length && (
                  <p className="text-xs text-muted-foreground">{eventsLoading ? "Chargement…" : "Aucun événement"}</p>
                )}
                {visible.map((e, i) => (
                  <div key={`${e.event_type}-${e.ref_id}-${i}`} className="relative">
                    <span className="absolute -left-[17px] top-1.5 h-2 w-2 rounded-full bg-muted-foreground" />
                    <div className="text-[11px] text-muted-foreground">
                      {fmtTime(e.occurred_at)} · {win ? formatOffset(offsetMinutes(e.occurred_at, win.center)) : ""}
                    </div>
                    <Badge variant="outline" className={`${eventTypeClass(String(e.event_type))} text-[10px] mt-0.5`}>
                      {eventTypeLabel(String(e.event_type))}
                    </Badge>
                    <div className="text-xs font-medium">{e.title}</div>
                    {e.detail && <div className="text-[11px] text-muted-foreground">{e.detail}</div>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Colonne droite : liste détaillée */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-3 md:p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Rechercher dans les événements…"
                  value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge
                  variant={typeFilter.length ? "outline" : "default"}
                  className="cursor-pointer rounded-full"
                  onClick={() => setTypeFilter([])}
                >
                  Tous ({sorted.length})
                </Badge>
                {EVENT_TYPES.map((t) => (
                  <Badge
                    key={t.value}
                    variant="outline"
                    className={`cursor-pointer rounded-full ${typeFilter.includes(t.value) ? t.className : ""}`}
                    onClick={() => toggleType(t.value)}
                  >
                    {t.label} ({counts[t.value] ?? 0})
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Événements ({visible.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollTable>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Heure</TableHead>
                      <TableHead>Écart</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Événement</TableHead>
                      <TableHead>Détail</TableHead>
                      <TableHead>Durée</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventsLoading && (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">Chargement des événements…</TableCell></TableRow>
                    )}
                    {!eventsLoading && !visible.length && (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">Aucun événement sur la période</TableCell></TableRow>
                    )}
                    {visible.map((e, i) => (
                      <TableRow key={`${e.event_type}-${e.ref_id}-${i}`} className="even:bg-muted/30">
                        <TableCell className="text-xs whitespace-nowrap">{fmtTime(e.occurred_at)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {win ? formatOffset(offsetMinutes(e.occurred_at, win.center)) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${eventTypeClass(String(e.event_type))} text-[10px]`}>
                            {eventTypeLabel(String(e.event_type))}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{e.title ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{e.detail ?? "—"}</TableCell>
                        <TableCell className="text-xs tabular-nums">
                          {e.duration_minutes != null ? `${Math.round(e.duration_minutes)} min` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollTable>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <RotateCcw className="h-4 w-4" /> Historique de l'enquête
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!logs.length && <p className="text-xs text-muted-foreground">Aucun historique.</p>}
              {logs.map((l) => (
                <div key={l.id} className="text-xs flex flex-wrap gap-x-2 border-b last:border-0 pb-1.5">
                  <span className="text-muted-foreground whitespace-nowrap">
                    {fmtDate(l.created_at)} {fmtTime(l.created_at)}
                  </span>
                  <span className="font-medium">{l.action}</span>
                  <span className="text-muted-foreground">
                    {l.user_id ? profiles[l.user_id] ?? "Utilisateur" : "—"}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog NC */}
      <ResponsiveDialog
        open={ncDialog}
        onOpenChange={setNcDialog}
        title="Relier à une non-conformité"
        description="Une enquête est associée à une seule non-conformité"
        className="max-w-lg"
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button variant={ncMode === "link" ? "default" : "outline"} size="sm" onClick={() => setNcMode("link")}>
              NC existante
            </Button>
            <Button variant={ncMode === "create" ? "default" : "outline"} size="sm" onClick={() => setNcMode("create")}>
              Nouvelle NC
            </Button>
          </div>

          {ncMode === "link" ? (
            <div className="space-y-1.5">
              <Label>Non-conformités en cours</Label>
              <Select value={ncPick} onValueChange={setNcPick}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {ncs.filter((n) => OPEN_NC_STATUSES.includes(n.status)).map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {(n.nc_number ?? "NC") + " — " + n.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Titre *</Label>
                <Input value={newNc.title} onChange={(e) => setNewNc({ ...newNc, title: e.target.value })}
                  placeholder="Ex : défaut de texture" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={newNc.nc_type} onValueChange={(v) => setNewNc({ ...newNc, nc_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["produit_fini", "emballage", "matiere_premiere", "process", "aspect", "autre"].map((t) => (
                        <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Gravité</Label>
                  <Select value={newNc.severity} onValueChange={(v) => setNewNc({ ...newNc, severity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minor">Mineure</SelectItem>
                      <SelectItem value="major">Majeure</SelectItem>
                      <SelectItem value="critical">Critique</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setNcDialog(false)}>Annuler</Button>
            <Button onClick={linkNc}>{ncMode === "create" ? "Créer et relier" : "Relier"}</Button>
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
