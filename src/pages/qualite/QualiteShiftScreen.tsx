import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveDialog } from "@/components/responsive/ResponsiveDialog";
import { ClipboardCheck, Play, Square, AlertTriangle, RefreshCw, Factory, ListChecks, History } from "lucide-react";
import { useActiveQualityShift, deriveShiftTypeFromHour } from "@/hooks/useActiveQualityShift";
import { OfControlsPanel } from "@/components/qualite/OfControlsPanel";
import { MaintenanceRiskPanel } from "@/components/qualite/MaintenanceRiskPanel";
import { ShiftHistoryPanel } from "@/components/qualite/ShiftHistoryPanel";
import { logAudit } from "@/lib/audit";
import { sortOfsByPriority, computeShiftKpis } from "@/lib/qualityShiftLogic";
import { useCriticalOverdueAlarm } from "@/hooks/useCriticalOverdueAlarm";

interface OfItem {
  id: string;
  numero: string;
  product_id: string | null;
  line_id: string | null;
  productLabel: string;
  lineLabel: string;
  onCoveredLine: boolean;
  due: number;
  overdue: number;
  criticalOverdue: number;
}


const lbl = (r?: { name?: string | null; designation?: string | null; code?: string | null } | null) =>
  r ? (r.name || r.designation || r.code || "—") : "—";

export default function QualiteShiftScreen() {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const { shift, loading, refresh } = useActiveQualityShift();

  const [teams, setTeams] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [openStart, setOpenStart] = useState(false);
  const [openClose, setOpenClose] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);
  const [startTeamId, setStartTeamId] = useState<string>("");
  const [startTeamLocked, setStartTeamLocked] = useState(false);
  const [startLineIds, setStartLineIds] = useState<string[]>([]);
  const [observations, setObservations] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [ofs, setOfs] = useState<OfItem[]>([]);
  const [ofsLoading, setOfsLoading] = useState(false);
  const [selectedOfId, setSelectedOfId] = useState<string>("");
  const [stats, setStats] = useState({ checks: 0, conforms: 0, nonConforms: 0, ncs: 0, ofs: 0, conformityRate: null as number | null });

  const criticalOverdue = useMemo(() => ofs.reduce((s, o) => s + (o.criticalOverdue ?? 0), 0), [ofs]);
  useCriticalOverdueAlarm(criticalOverdue, !!shift);


  const canStart =
    hasRole("admin") ||
    hasRole("controleur_qualite") ||
    hasRole("responsable_controle_qualite") ||
    hasRole("directeur_qualite");

  useEffect(() => {
    (async () => {
      const [t, l] = await Promise.all([
        supabase.from("shift_teams").select("*").eq("is_active", true).order("code"),
        supabase.from("production_lines").select("id, code, designation").eq("is_active", true).order("code"),
      ]);
      setTeams(t.data ?? []);
      setLines(l.data ?? []);
    })();
  }, []);

  // Shift KPIs
  useEffect(() => {
    if (!shift) { setStats({ checks: 0, conforms: 0, nonConforms: 0, ncs: 0, ofs: 0, conformityRate: null }); return; }
    (async () => {
      const [checksRes, ncRes] = await Promise.all([
        supabase.from("quality_checks" as any).select("id, is_conform, of_id").eq("quality_shift_id", shift.id),
        supabase.from("quality_non_conformities" as any).select("id").eq("quality_shift_id", shift.id),
      ]);
      const k = computeShiftKpis((checksRes.data as any[]) ?? [], ((ncRes.data as any[]) ?? []).length);
      setStats({ checks: k.checks, conforms: k.conforms, nonConforms: k.nonConforms, ncs: k.ncs, ofs: k.ofs, conformityRate: k.conformityRate });

    })();
  }, [shift, ofs]);

  // Active OFs + due status — une seule RPC batch pour tous les OF
  const loadOfs = async () => {
    setOfsLoading(true);
    const { data, error } = await (supabase as any).rpc("get_quality_due_for_shift", {
      p_quality_shift_id: shift?.id ?? null,
      p_limit: 60,
    });
    if (error) {
      toast({ title: "Erreur de chargement des OF", description: error.message, variant: "destructive" });
      setOfsLoading(false);
      return;
    }
    const items: OfItem[] = ((data as any[]) ?? []).map((r) => ({
      id: r.of_id,
      numero: r.numero,
      product_id: r.product_id,
      line_id: r.line_id,
      productLabel: r.product_label ?? "—",
      lineLabel: r.line_label ?? "—",
      onCoveredLine: !!r.on_covered_line,
      due: r.due ?? 0,
      overdue: r.overdue ?? 0,
      criticalOverdue: r.critical_overdue ?? 0,
    }));

    const sorted = sortOfsByPriority(items);
    setOfs(sorted);
    if (sorted.length > 0 && !sorted.some((o) => o.id === selectedOfId)) {
      setSelectedOfId(sorted[0].id);
    }
    setOfsLoading(false);
  };


  useEffect(() => {
    loadOfs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shift?.id]);

  async function loadStartContext() {
    setStartTeamId("");
    setStartTeamLocked(false);
    setStartLineIds([]);

    const [{ data: ofRows }, { data: scopeRows }] = await Promise.all([
      supabase.from("ordres_fabrication" as any).select("line_id").eq("statut", "en_cours" as any),
      user
        ? supabase.rpc("get_scope_shift_context" as any, { _user_id: user.id, _scope: "quality" })
        : Promise.resolve({ data: null } as any),
    ]);

    const activeLineIds = Array.from(
      new Set(((ofRows as any[]) ?? []).map((o) => o.line_id).filter(Boolean)),
    ) as string[];
    setStartLineIds(activeLineIds);

    const scope = Array.isArray(scopeRows) ? scopeRows[0] : scopeRows;
    if (scope?.team_id) {
      setStartTeamId(scope.team_id);
      setStartTeamLocked(true);
    }
  }

  function openStartDialog() {
    void loadStartContext();
    setOpenStart(true);
  }

  async function handleStart() {
    if (!user) return;
    setSubmitting(true);
    try {
      const { data: ofRows } = await supabase
        .from("ordres_fabrication" as any)
        .select("line_id")
        .eq("statut", "en_cours" as any);
      const activeLineIds = Array.from(
        new Set(((ofRows as any[]) ?? []).map((o) => o.line_id).filter(Boolean)),
      ) as string[];
      const today = new Date().toISOString().slice(0, 10);
      const shiftType = deriveShiftTypeFromHour(new Date().getHours());
      const { data: qsData, error } = await supabase
        .from("quality_shifts" as any)
        .insert({ date_shift: today, shift_type: shiftType, shift_team_id: startTeamId || null, controller_id: user.id, heure_debut: new Date().toISOString(), is_active: true } as any)
        .select("id").single();
      if (error) throw error;
      const newId = (qsData as any).id;
      if (activeLineIds.length > 0) {
        const { error: linesErr } = await supabase
          .from("quality_shift_lines" as any)
          .insert(activeLineIds.map((lid) => ({ quality_shift_id: newId, production_line_id: lid })) as any);
        if (linesErr) throw linesErr;
      }
      await logAudit({ action_type: "create", module: "parametres" as any, entity_type: "quality_shift", entity_id: newId, action_label: "Ouverture shift qualité", new_values: { lines: activeLineIds, team_id: startTeamId || null } });
      toast({ title: "Shift qualité démarré" });
      setOpenStart(false);
      await refresh();
    } catch (e: any) {
      toast({ title: "Erreur au démarrage", description: e.message, variant: "destructive" });
    } finally { setSubmitting(false); }
  }

  async function handleClose() {
    if (!shift) return;
    if (!observations.trim()) { toast({ title: "Observations obligatoires", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("quality_shifts" as any)
        .update({ is_active: false, heure_fin: new Date().toISOString(), observations } as any).eq("id", shift.id);
      if (error) throw error;
      await logAudit({ action_type: "update", module: "parametres" as any, entity_type: "quality_shift", entity_id: shift.id, action_label: "Clôture shift qualité", new_values: { observations } });
      toast({ title: "Shift qualité clôturé" });
      setOpenClose(false);
      setObservations("");
      await refresh();
    } catch (e: any) {
      toast({ title: "Erreur à la clôture", description: e.message, variant: "destructive" });
    } finally { setSubmitting(false); }
  }

  async function handleRefreshLinks() {
    if (!shift) return;
    const { data, error } = await supabase.rpc("quality_shift_refresh_links" as any, { p_quality_shift_id: shift.id } as any);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Liens rafraîchis (${data ?? 0} ajout(s))` });
    await refresh();
  }

  const shiftTypeLabel = useMemo(() => {
    if (!shift) return "";
    return shift.shift_type === "matin" ? "Matin" : shift.shift_type === "apres_midi" ? "Après-midi" : "Nuit";
  }, [shift]);

  const selectedOf = useMemo(() => ofs.find((o) => o.id === selectedOfId) ?? null, [ofs, selectedOfId]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Chargement...</div>;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Tableau de shift qualité</h1>
            <p className="text-sm text-muted-foreground">Choisissez un OF, saisissez ses contrôles et pilotez les risques maintenance.</p>
          </div>
        </div>
        {!shift && canStart && (
          <Button size="lg" onClick={openStartDialog} className="min-h-[48px]">
            <Play className="h-5 w-5 mr-2" /> Démarrer un shift
          </Button>
        )}
      </div>

      {!shift && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Aucun shift qualité actif. {canStart ? "Cliquez sur \"Démarrer un shift\" pour commencer votre quart." : "Vous n'avez pas le rôle nécessaire pour ouvrir un shift contrôle."}
          </CardContent>
        </Card>
      )}

      {shift && (
        <>
          {/* Bandeau shift actif */}
          <Card className="border-primary/40">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant="default" className="text-sm py-1 px-3">
                    {shift.team ? `Équipe ${shift.team.code}` : "Équipe non assignée"}
                  </Badge>
                  <Badge variant="secondary">{shiftTypeLabel}</Badge>
                  <span className="text-sm text-muted-foreground">
                    Démarré à {new Date(shift.heure_debut).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · {shift.production_shift_ids.length} shift(s) production lié(s)
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleRefreshLinks}>
                    <RefreshCw className="h-4 w-4 mr-2" /> Rafraîchir liens
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setOpenClose(true)}>
                    <Square className="h-4 w-4 mr-2" /> Clôturer
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiBox label="Contrôles" value={stats.checks} />
              <KpiBox label="Conformes" value={stats.conforms} variant="success" />
              <KpiBox label="NC ouvertes" value={stats.ncs} variant={stats.ncs > 0 ? "warning" : "default"} />
              <KpiBox label="OF couverts" value={stats.ofs} />
            </CardContent>
          </Card>

          {/* Master-détail */}
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            {/* Liste des OF actifs */}
            <Card className="h-fit">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2"><Factory className="h-5 w-5" /> OF actifs ({ofs.length})</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadOfs} disabled={ofsLoading}>
                    <RefreshCw className={`h-4 w-4 ${ofsLoading ? "animate-spin" : ""}`} />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 space-y-1 max-h-[70vh] overflow-y-auto">
                {ofsLoading && <p className="text-sm text-muted-foreground p-2">Chargement…</p>}
                {!ofsLoading && ofs.length === 0 && <p className="text-sm text-muted-foreground p-2">Aucun OF en cours.</p>}
                {ofs.map((o) => {
                  const active = o.id === selectedOfId;
                  return (
                    <button
                      key={o.id}
                      onClick={() => setSelectedOfId(o.id)}
                      className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${active ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{o.numero}</span>
                        {o.overdue > 0 ? (
                          <Badge variant="destructive" className="text-[10px]">{o.overdue} retard</Badge>
                        ) : o.due > 0 ? (
                          <Badge variant="outline" className="border-amber-500 text-amber-600 text-[10px]">{o.due} à saisir</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">à jour</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{o.productLabel} · {o.lineLabel}</div>
                      {o.onCoveredLine && <span className="text-[10px] text-primary">Ligne couverte</span>}
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Détail OF */}
            <div className="space-y-4 min-w-0">
              {!selectedOf ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">
                  Sélectionnez un OF pour saisir ses contrôles.
                </CardContent></Card>
              ) : (
                <>
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <ListChecks className="h-5 w-5 text-primary" />
                          {selectedOf.numero}
                          <span className="text-sm font-normal text-muted-foreground">· {selectedOf.productLabel} · {selectedOf.lineLabel}</span>
                        </CardTitle>
                        <Button variant="outline" size="sm" onClick={() => setOpenHistory(true)}>
                          <History className="h-4 w-4 mr-2" /> Historique
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <OfControlsPanel
                        ofId={selectedOf.id}
                        ofNumero={selectedOf.numero}
                        productId={selectedOf.product_id}
                        lineId={selectedOf.line_id}
                        activeQualityShift={shift}
                        onSaved={loadOfs}
                      />
                    </CardContent>
                  </Card>

                  <MaintenanceRiskPanel ofId={selectedOf.id} ofNumero={selectedOf.numero} lineId={selectedOf.line_id} qualityShiftId={shift?.id ?? null} />

                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Dialog démarrage */}
      <ResponsiveDialog open={openStart} onOpenChange={setOpenStart} title="Démarrer un shift contrôle" description="Sélectionnez l'équipe si elle n'est pas déjà configurée. Les lignes viennent automatiquement des OF actifs.">
        <div className="space-y-4">
          <div>
            <Label>Équipe {startTeamLocked && <span className="text-xs text-muted-foreground">(planning)</span>}</Label>
            <Select value={startTeamId} onValueChange={setStartTeamId} disabled={startTeamLocked}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Choisir une équipe" /></SelectTrigger>
              <SelectContent>
                {teams.map((t) => <SelectItem key={t.id} value={t.id}>Équipe {t.code} — {t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Lignes ciblées automatiquement</Label>
            <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-xs text-muted-foreground">Aucune sélection nécessaire : les lignes sont déduites des OF actifs au démarrage du shift.</p>
              {startLineIds.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {lines
                    .filter((l) => startLineIds.includes(l.id))
                    .map((l) => (
                      <Badge key={l.id} variant="secondary" className="rounded-md">
                        {l.code} — {l.designation}
                      </Badge>
                    ))}
                </div>
              ) : (
                <p className="text-xs text-amber-600">Aucun OF actif pour le moment. Le shift peut quand même démarrer.</p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpenStart(false)} disabled={submitting}>Annuler</Button>
            <Button onClick={handleStart} disabled={submitting}>
              <Play className="h-4 w-4 mr-2" /> {submitting ? "Démarrage..." : "Démarrer"}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>

      {/* Dialog clôture */}
      <ResponsiveDialog open={openClose} onOpenChange={setOpenClose} title="Clôturer le shift contrôle" description="Décrivez les observations marquantes du quart (obligatoire).">
        <div className="space-y-4">
          <div>
            <Label>Observations de fin de shift *</Label>
            <Textarea className="mt-1" rows={5} value={observations} onChange={(e) => setObservations(e.target.value)}
              placeholder="Synthèse du quart, points d'attention, NC à suivre..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpenClose(false)} disabled={submitting}>Annuler</Button>
            <Button onClick={handleClose} disabled={submitting || !observations.trim()} variant="destructive">
              <Square className="h-4 w-4 mr-2" /> {submitting ? "Clôture..." : "Clôturer"}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>

      {/* Dialog historique de saisie */}
      {shift && (
        <ResponsiveDialog open={openHistory} onOpenChange={setOpenHistory} className="max-w-4xl" title="Historique de saisie du shift" description="Consultez toutes les valeurs saisies et filtrez rapidement par contrôle.">
          <ShiftHistoryPanel qualityShiftId={shift.id} filterOfId={selectedOf?.id} />
        </ResponsiveDialog>
      )}
    </div>
  );
}

function KpiBox({ label, value, variant = "default" }: { label: string; value: number; variant?: "default" | "success" | "warning" }) {
  const colorClass = variant === "success" ? "text-success" : variant === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="border rounded-lg p-3 text-center">
      <div className={`text-2xl font-bold tabular-nums ${colorClass}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
