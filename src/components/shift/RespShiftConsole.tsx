import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

import { Textarea } from "@/components/ui/textarea";
import { ResponsiveDialog } from "@/components/responsive/ResponsiveDialog";
import { Plus, Square, Clock, Loader2, RefreshCw, Users, FileText } from "lucide-react";
import { logAudit } from "@/lib/audit";
import { ShiftSessionLiveStats } from "@/components/shift/ShiftSessionLiveStats";
import { ShiftSummaryDialog } from "@/components/shift/ShiftSummaryDialog";

import type { ShiftKind } from "@/contexts/ActiveShiftContext";

interface RespShiftConsoleProps {
  kind: ShiftKind;
}

const TITLES: Record<ShiftKind, string> = {
  production: "Console Responsable Production",
  maintenance: "Console Responsable Maintenance",
  quality: "Console Responsable Qualité",
};

const SUBTITLES: Record<ShiftKind, string> = {
  production: "Ouvrez et supervisez les sessions de shift de vos chefs de ligne.",
  maintenance: "Ouvrez et supervisez les sessions de shift de vos maintenanciers.",
  quality: "Ouvrez et supervisez les sessions de shift de vos contrôleurs qualité.",
};

const OPERATOR_ROLES: Record<ShiftKind, string[]> = {
  production: ["chef_ligne"],
  maintenance: ["maintenancier"],
  quality: ["controleur_qualite"],
};

const SHIFT_TYPES = [
  { value: "matin", label: "Matin" },
  { value: "apres_midi", label: "Après-midi" },
  { value: "nuit", label: "Nuit" },
];

function deriveShiftTypeFromHour(hour: number): "matin" | "apres_midi" | "nuit" {
  if (hour >= 5 && hour < 13) return "matin";
  if (hour >= 13 && hour < 21) return "apres_midi";
  return "nuit";
}

export function RespShiftConsole({ kind }: RespShiftConsoleProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [summarySession, setSummarySession] = useState<any | null>(null);

  // Form state
  const [operators, setOperators] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [ofs, setOfs] = useState<any[]>([]);
  const [operatorId, setOperatorId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [shiftType, setShiftType] = useState<string>(() =>
    deriveShiftTypeFromHour(new Date().getHours())
  );
  const [lineId, setLineId] = useState("");
  const [ofId, setOfId] = useState("__none__");
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [interventionReason, setInterventionReason] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    if (kind === "production") {
      const { data } = await supabase
        .from("shifts")
        .select(
          "*, shift_teams(code, name, color), production_lines(id, code, designation), ordres_fabrication(numero), profiles!shifts_chef_ligne_id_fkey(first_name, last_name)"
        )
        .eq("date_shift", today)
        .order("heure_debut", { ascending: false });
      setSessions((data as any[]) ?? []);
    } else if (kind === "maintenance") {
      const { data } = await supabase
        .from("maintenance_shifts" as any)
        .select("*, shift_teams(code, name, color)")
        .eq("date_shift", today)
        .order("heure_debut", { ascending: false });
      // hydrate operator profile
      const rows = (data as any[]) ?? [];
      if (rows.length) {
        const userIds = Array.from(new Set(rows.map((r) => r.maintenancier_id)));
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", userIds);
        const profMap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
        rows.forEach((r) => (r.profile = profMap.get(r.maintenancier_id) ?? null));
      }
      setSessions(rows);
    } else {
      const { data } = await supabase
        .from("quality_shifts" as any)
        .select("*, shift_teams(code, name, color)")
        .eq("date_shift", today)
        .order("heure_debut", { ascending: false });
      const rows = (data as any[]) ?? [];
      if (rows.length) {
        const userIds = Array.from(new Set(rows.map((r) => r.controller_id)));
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", userIds);
        const profMap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
        rows.forEach((r) => (r.profile = profMap.get(r.controller_id) ?? null));
      }
      setSessions(rows);
    }
    setLoading(false);
  }, [kind, today]);

  useEffect(() => {
    loadSessions();
    // realtime
    const tableName =
      kind === "production" ? "shifts" :
      kind === "maintenance" ? "maintenance_shifts" : "quality_shifts";
    const ch = supabase
      .channel(`resp-shift-${kind}`)
      .on("postgres_changes", { event: "*", schema: "public", table: tableName }, () => loadSessions())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [kind, loadSessions]);

  // Load form options when dialog opens
  useEffect(() => {
    if (!openDialog) return;
    (async () => {
      const roles = OPERATOR_ROLES[kind];
      const [{ data: roleRows }, teamsRes, linesRes] = await Promise.all([
        supabase.from("user_roles").select("user_id").in("role", roles as any),
        supabase.from("shift_teams").select("*").eq("is_active", true).order("code"),
        supabase.from("production_lines").select("id, code, designation").eq("is_active", true).order("code"),
      ]);
      const userIds = Array.from(new Set((roleRows ?? []).map((r: any) => r.user_id)));
      const { data: profs } = userIds.length
        ? await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds)
        : { data: [] as any[] };
      setOperators((profs as any[]) ?? []);
      setTeams(teamsRes.data ?? []);
      setLines(linesRes.data ?? []);

      if (kind === "production") {
        const { data: ofRows } = await supabase
          .from("ordres_fabrication")
          .select("id, numero, line_id")
          .in("statut", ["en_cours", "planifie"])
          .order("numero", { ascending: false });
        setOfs((ofRows as any[]) ?? []);
      }
    })();
  }, [openDialog, kind]);

  function resetForm() {
    setOperatorId("");
    setTeamId("");
    setLineId("");
    setOfId("__none__");
    setSelectedLineIds([]);
    
    setInterventionReason("");
    setShiftType(deriveShiftTypeFromHour(new Date().getHours()));
  }

  // La qualité est toujours en intervention personnelle : le responsable ne peut
  // ouvrir une session que pour lui-même. Les sessions des contrôleurs sont
  // créées automatiquement au démarrage de leur shift.
  const isQualitySelf = kind === "quality";

  async function handleOpenSession() {
    if (!isQualitySelf && !operatorId) {
      toast({ title: "Sélectionnez un opérateur", variant: "destructive" });
      return;
    }
    if (isQualitySelf && !interventionReason.trim()) {
      toast({ title: "Motif obligatoire", description: "Indiquez le motif de l'intervention personnelle.", variant: "destructive" });
      return;
    }
    if (kind === "production" && !lineId) {
      toast({ title: "Sélectionnez une ligne", variant: "destructive" });
      return;
    }
    if (kind === "maintenance" && selectedLineIds.length === 0) {
      toast({ title: "Sélectionnez au moins une ligne couverte", variant: "destructive" });
      return;
    }
    if (kind === "quality" && selectedLineIds.length === 0) {
      toast({ title: "Sélectionnez au moins une ligne contrôlée", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      if (kind === "production") {
        // Preflight : éviter doublon actif pour (of, ligne, jour, créneau)
        const { data: dup } = await supabase
          .from("shifts")
          .select("id")
          .eq("of_id", ofId === "__none__" ? "00000000-0000-0000-0000-000000000000" : ofId)
          .eq("line_id", lineId)
          .eq("date_shift", today)
          .eq("shift_type", shiftType as any)
          .eq("is_active", true)
          .maybeSingle();
        if (dup) {
          toast({ title: "Session déjà ouverte", description: "Une session est déjà active pour cette ligne sur ce créneau." });
          setSubmitting(false);
          return;
        }
        const { data, error } = await supabase
          .from("shifts")
          .insert({
            date_shift: today,
            shift_type: shiftType,
            shift_team_id: teamId || null,
            line_id: lineId,
            of_id: ofId === "__none__" ? null : ofId,
            chef_ligne_id: operatorId,
            heure_debut: new Date().toISOString(),
            is_active: true,
            opened_by: user?.id,
          } as any)
          .select()
          .single();
        if (error) throw error;
        await logAudit({
          action_type: "create",
          module: "gpao",
          action: "shift_open_for_user",
          entity_type: "shifts",
          entity_id: data.id,
          description: `Ouverture session shift production pour opérateur (par responsable)`,
        });
      } else if (kind === "maintenance") {
        const { data, error } = await supabase
          .from("maintenance_shifts" as any)
          .insert({
            date_shift: today,
            shift_type: shiftType,
            shift_team_id: teamId || null,
            maintenancier_id: operatorId,
            line_ids: selectedLineIds,
            heure_debut: new Date().toISOString(),
            is_active: true,
            opened_by: user?.id,
          })
          .select()
          .single();
        if (error) throw error;
        await logAudit({
          action_type: "create",
          module: "interventions",
          action: "maintenance_shift_open",
          entity_type: "maintenance_shifts",
          entity_id: (data as any).id,
          description: `Ouverture session shift maintenance pour maintenancier (par responsable)`,
        });
      } else {
        const reason = interventionReason.trim();
        const { data, error } = await supabase
          .from("quality_shifts" as any)
          .insert({
            date_shift: today,
            shift_type: shiftType,
            shift_team_id: teamId || null,
            controller_id: isQualitySelf ? user?.id : operatorId,
            heure_debut: new Date().toISOString(),
            is_active: true,
            opened_by: user?.id,
            is_self_intervention: isQualitySelf,
            intervention_reason: isQualitySelf ? reason : null,
            observations: isQualitySelf ? `[Intervention responsable] ${reason}` : null,
          })
          .select()
          .single();
        if (error) throw error;
        // Attach lines
        const qsId = (data as any).id;
        const linkRows = selectedLineIds.map((lid) => ({
          quality_shift_id: qsId,
          production_line_id: lid,
        }));
        if (linkRows.length) {
          await supabase.from("quality_shift_lines" as any).insert(linkRows);
        }
        await logAudit({
          action_type: "create",
          module: "system",
          action: isQualitySelf ? "quality_shift_self_intervention" : "quality_shift_open",
          entity_type: "quality_shifts",
          entity_id: qsId,
          description: isQualitySelf
            ? `Intervention personnelle du responsable qualité — motif: ${reason}`
            : `Ouverture session shift contrôle qualité (par responsable)`,
          metadata: isQualitySelf ? { reason } : undefined,
        });
      }

      toast({ title: "Session ouverte", description: "L'opérateur peut désormais utiliser son app." });
      setOpenDialog(false);
      resetForm();
      loadSessions();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForceClose(session: any) {
    const reason = window.prompt("Motif de la clôture forcée (obligatoire) :");
    if (!reason || !reason.trim()) return;
    try {
      const tableName =
        kind === "production" ? "shifts" :
        kind === "maintenance" ? "maintenance_shifts" : "quality_shifts";
      const { error } = await supabase
        .from(tableName as any)
        .update({
          is_active: false,
          heure_fin: new Date().toISOString(),
          observations: `[Forcée par responsable] ${reason}${session.observations ? " | " + session.observations : ""}`,
        })
        .eq("id", session.id);
      if (error) throw error;
      await logAudit({
        action_type: "update",
        module: kind === "production" ? "gpao" : kind === "maintenance" ? "interventions" : "system",
        action: "shift_force_close",
        entity_type: tableName,
        entity_id: session.id,
        description: `Clôture forcée de la session shift ${kind} — motif: ${reason}`,
        metadata: { reason },
      });
      toast({ title: "Session clôturée" });
      loadSessions();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  }

  const activeCount = sessions.filter((s) => s.is_active).length;
  const closedCount = sessions.length - activeCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{TITLES[kind]}</h1>
          <p className="text-sm text-muted-foreground">{SUBTITLES[kind]}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadSessions}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Rafraîchir
          </Button>
          <Button onClick={() => setOpenDialog(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            {kind === "quality" ? "Intervenir moi-même" : "Ouvrir une session"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground tracking-wider">Sessions actives</div>
            <div className="text-3xl font-bold mt-1 text-primary">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground tracking-wider">Clôturées aujourd'hui</div>
            <div className="text-3xl font-bold mt-1">{closedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground tracking-wider">Total du jour</div>
            <div className="text-3xl font-bold mt-1">{sessions.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Sessions du jour ({today})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-6 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Aucune session ouverte aujourd'hui.
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => {
                const operatorName =
                  kind === "production"
                    ? `${s.profiles?.first_name ?? ""} ${s.profiles?.last_name ?? ""}`.trim() || "—"
                    : `${s.profile?.first_name ?? ""} ${s.profile?.last_name ?? ""}`.trim() || "—";
                return (
                  <div
                    key={s.id}
                    className="p-3 border rounded-lg hover:bg-accent/30 transition space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 flex-wrap min-w-0">
                        {s.is_active ? (
                          <Badge variant="default" className="text-xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse mr-1.5" />
                            LIVE
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Clôturée</Badge>
                        )}
                        <div className="font-semibold text-sm">{operatorName}</div>
                        {kind === "quality" && s.is_self_intervention && (
                          <Badge
                            variant="outline"
                            className="text-xs border-amber-500/50 text-amber-600 dark:text-amber-400"
                            title={s.intervention_reason || undefined}
                          >
                            Intervention responsable
                          </Badge>
                        )}
                        {s.shift_teams && (
                          <Badge variant="outline" className="text-xs">Équipe {s.shift_teams.code}</Badge>
                        )}
                        <Badge variant="outline" className="text-xs capitalize">{String(s.shift_type).replace("_", " ")}</Badge>
                        {kind === "production" && s.production_lines && (
                          <Badge variant="outline" className="text-xs">{s.production_lines.code}</Badge>
                        )}
                        {kind === "production" && s.ordres_fabrication && (
                          <Badge variant="outline" className="text-xs">{s.ordres_fabrication.numero}</Badge>
                        )}
                        <div className="text-xs text-muted-foreground tabular-nums flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(s.heure_debut).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                          {s.heure_fin && (
                            <>→ {new Date(s.heure_fin).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setSummarySession(s)}>
                          <FileText className="h-3.5 w-3.5 mr-1.5" />
                          Bilan
                        </Button>
                        {s.is_active && (
                          <Button size="sm" variant="outline" onClick={() => handleForceClose(s)}>
                            <Square className="h-3.5 w-3.5 mr-1.5" />
                            Forcer clôture
                          </Button>
                        )}
                      </div>
                    </div>
                    <ShiftSessionLiveStats kind={kind} sessionId={s.id} />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>






      <ResponsiveDialog
        open={openDialog}
        onOpenChange={(o) => {
          setOpenDialog(o);
          if (!o) resetForm();
        }}
        title={kind === "quality" ? "Intervention personnelle du responsable qualité" : "Ouvrir une session de shift"}
        description={kind === "quality" ? "Vous devenez le contrôleur pour ce créneau. Indiquez le motif." : "Sélectionnez l'opérateur et le contexte de la session."}
      >
        <div className="space-y-4">
          {kind === "quality" && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-3">
              <div>
                <Label className="text-sm">Intervention personnelle</Label>
                <p className="text-xs text-muted-foreground">
                  Vous ouvrez une session en tant que contrôleur (absence, intervention sensible).
                  Les sessions des contrôleurs sont créées automatiquement au démarrage de leur shift.
                </p>
              </div>
              <div>
                <Label>Motif de l'intervention personnelle *</Label>
                <Textarea
                  value={interventionReason}
                  onChange={(e) => setInterventionReason(e.target.value)}
                  placeholder="ex. absence du contrôleur, intervention sensible…"
                  rows={2}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {!isQualitySelf && (
            <div>
              <Label>Opérateur *</Label>
              <Select value={operatorId} onValueChange={setOperatorId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {operators.map((o) => (
                    <SelectItem key={o.user_id} value={o.user_id}>
                      {o.first_name} {o.last_name}
                    </SelectItem>
                  ))}
                  {operators.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Aucun opérateur disponible</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Équipe</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.code} — {t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Créneau</Label>
              <Select value={shiftType} onValueChange={setShiftType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SHIFT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {kind === "production" && (
            <>
              <div>
                <Label>Ligne de production *</Label>
                <Select value={lineId} onValueChange={setLineId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    {lines.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.code} — {l.designation}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>OF (optionnel)</Label>
                <Select value={ofId} onValueChange={setOfId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucun</SelectItem>
                    {ofs
                      .filter((o) => !lineId || o.line_id === lineId)
                      .map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.numero}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {(kind === "maintenance" || kind === "quality") && (
            <div>
              <Label>{kind === "maintenance" ? "Lignes couvertes *" : "Lignes contrôlées *"}</Label>
              <div className="border rounded-md p-2 max-h-48 overflow-auto space-y-1 mt-1">
                {lines.map((l) => (
                  <label key={l.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent/50 rounded cursor-pointer">
                    <Checkbox
                      checked={selectedLineIds.includes(l.id)}
                      onCheckedChange={(c) =>
                        setSelectedLineIds((prev) =>
                          c ? [...prev, l.id] : prev.filter((id) => id !== l.id)
                        )
                      }
                    />
                    <span className="text-sm">{l.code} — {l.designation}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpenDialog(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button onClick={handleOpenSession} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ouvrir la session
            </Button>
          </div>
        </div>
      </ResponsiveDialog>

      {summarySession && (
        <ShiftSummaryDialog
          kind={kind}
          session={summarySession}
          open={!!summarySession}
          onOpenChange={(o) => !o && setSummarySession(null)}
        />
      )}
    </div>
  );
}
