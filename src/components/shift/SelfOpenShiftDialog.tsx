/**
 * Dialogue self-open : permet à un opérateur de démarrer son shift
 * sans dépendre de son responsable. Utile quand aucun plan d'affectation
 * n'a été configuré (anti-blocage).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useActiveShiftOptional, ShiftKind } from "@/contexts/ActiveShiftContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Loader2 } from "lucide-react";
import { logAudit } from "@/lib/audit";

function deriveShiftTypeFromHour(hour: number): "matin" | "apres_midi" | "nuit" {
  if (hour >= 5 && hour < 13) return "matin";
  if (hour >= 13 && hour < 21) return "apres_midi";
  return "nuit";
}

function shiftTypeFromTemplate(code?: string | null): "matin" | "apres_midi" | "nuit" {
  switch (code) {
    case "matin": return "matin";
    case "soir":
    case "midi": return "apres_midi";
    case "nuit": return "nuit";
    default: return deriveShiftTypeFromHour(new Date().getHours());
  }
}

interface PlanContext {
  teamId: string | null;
  templateCode: string | null;
  lineIds: string[];
  isOnShift: boolean;
  autorisationLibre: boolean;
}

interface Props {
  kind: ShiftKind;
}

export function SelfOpenShiftDialog({ kind }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const activeShift = useActiveShiftOptional();
  const refresh = activeShift?.refresh ?? (async () => {});
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [teams, setTeams] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [ofs, setOfs] = useState<any[]>([]);
  const [teamId, setTeamId] = useState("__none__");
  const [lineId, setLineId] = useState("");
  const [ofId, setOfId] = useState("__none__");
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [plan, setPlan] = useState<PlanContext | null>(null);
  const [shiftType, setShiftType] = useState<"matin" | "apres_midi" | "nuit">(
    deriveShiftTypeFromHour(new Date().getHours()),
  );

  // Planning issu de la rotation par équipe (lignes/équipe/créneau).
  const hasPlan = !!plan && (plan.lineIds.length > 0 || !!plan.teamId);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [tRes, lRes] = await Promise.all([
        supabase.from("shift_teams").select("id, code, name").eq("is_active", true).order("code"),
        supabase.from("production_lines").select("id, code, designation").eq("is_active", true).order("code"),
      ]);
      setTeams(tRes.data ?? []);
      setLines(lRes.data ?? []);
      if (kind === "production") {
        // Production : pas d'auto-ouverture, ni de pré-remplissage par planning.
        setPlan(null);
        setShiftType(deriveShiftTypeFromHour(new Date().getHours()));
        const { data } = await supabase
          .from("ordres_fabrication")
          .select("id, numero, line_id")
          .in("statut", ["en_cours", "planifie"])
          .order("numero", { ascending: false });
        setOfs(data ?? []);
        return;
      }

      // Maintenance / Qualité : portée selon le rôle + lignes issues du planning.
      const scope = kind === "maintenance" ? "maintenance" : "quality";
      if (user) {
        const { data: rows } = await supabase.rpc("get_scope_shift_context" as any, {
          _user_id: user.id,
          _scope: scope,
        });
        const r = Array.isArray(rows) ? rows[0] : rows;
        if (r && (r.team_id || (r.line_ids && r.line_ids.length))) {
          const planLines: string[] = r.line_ids ?? [];
          setPlan({
            teamId: r.team_id ?? null,
            templateCode: r.template_code ?? null,
            lineIds: planLines,
            isOnShift: !!r.is_on_shift,
            autorisationLibre: !!r.autorisation_libre,
          });
          setTeamId(r.team_id ?? "__none__");
          setSelectedLineIds(planLines);
          setShiftType(shiftTypeFromTemplate(r.template_code));
          // Qualité : les lignes restent déduites automatiquement des OF actifs.
          if (kind !== "quality") return;
        } else {
          // Aucun planning : repli manuel (anti-blocage).
          setPlan(null);
          setShiftType(deriveShiftTypeFromHour(new Date().getHours()));
        }
      } else {
        setPlan(null);
        setShiftType(deriveShiftTypeFromHour(new Date().getHours()));
      }

      // Qualité : les lignes ciblées sont automatiquement déduites des OF actifs.
      if (kind === "quality") {
        const { data: ofRows } = await supabase
          .from("ordres_fabrication")
          .select("line_id")
          .eq("statut", "en_cours" as any);
        const derived = Array.from(
          new Set((ofRows ?? []).map((o: any) => o.line_id).filter(Boolean)),
        ) as string[];
        setSelectedLineIds(derived);
      }
    })();
  }, [open, kind, user]);


  async function handleStart() {
    if (!user) return;
    setSubmitting(true);
    try {
      if (kind === "production") {
        if (!lineId) { toast({ title: "Sélectionnez une ligne", variant: "destructive" }); setSubmitting(false); return; }
        if (ofId === "__none__") { toast({ title: "Sélectionnez un OF en cours", variant: "destructive" }); setSubmitting(false); return; }
        // preflight duplicate
        const today = (new Date()).toISOString().slice(0, 10);
        const { data: dup } = await supabase
          .from("shifts")
          .select("id")
          .eq("of_id", ofId)
          .eq("line_id", lineId)
          .eq("date_shift", today)
          .eq("shift_type", shiftType)
          .eq("is_active", true)
          .maybeSingle();
        if (dup) {
          toast({ title: "Session déjà ouverte pour ce créneau", description: "Aucune nouvelle session créée." });
          setOpen(false); await refresh(); setSubmitting(false); return;
        }
        const { error } = await supabase.from("shifts").insert({
          of_id: ofId,
          line_id: lineId,
          shift_type: shiftType,
          shift_team_id: teamId === "__none__" ? null : teamId,
          chef_ligne_id: user.id,
          heure_debut: new Date().toISOString(),
          is_active: true,
          opened_by: user.id,
        } as any);
        if (error) throw error;
        await logAudit({
          action_type: "create", module: "gpao", action: "shift_self_open",
          entity_type: "shifts", description: "Démarrage shift par l'opérateur (self-open)",
        });
      } else if (kind === "maintenance") {
        if (selectedLineIds.length === 0) { toast({ title: "Sélectionnez au moins une ligne", variant: "destructive" }); setSubmitting(false); return; }
        const { error } = await supabase.from("maintenance_shifts" as any).insert({
          shift_type: shiftType,
          shift_team_id: teamId === "__none__" ? null : teamId,
          maintenancier_id: user.id,
          line_ids: selectedLineIds,
          heure_debut: new Date().toISOString(),
          is_active: true,
          opened_by: user.id,
        });
        if (error) throw error;
        await logAudit({
          action_type: "create", module: "interventions", action: "maintenance_shift_self_open",
          entity_type: "maintenance_shifts", description: "Démarrage shift maintenance par l'opérateur",
        });
      } else {
        // Qualité : les lignes sont déduites automatiquement (planning ou OF actifs), pas de blocage.
        const { data: qs, error } = await supabase.from("quality_shifts" as any).insert({
          shift_type: shiftType,
          shift_team_id: teamId === "__none__" ? null : teamId,
          controller_id: user.id,
          heure_debut: new Date().toISOString(),
          is_active: true,
          opened_by: user.id,
        }).select().single();
        if (error) throw error;
        const rows = selectedLineIds.map((lid) => ({ quality_shift_id: (qs as any).id, production_line_id: lid }));
        if (rows.length) await supabase.from("quality_shift_lines" as any).insert(rows);
        await logAudit({
          action_type: "create", module: "qualite" as any, action: "quality_shift_self_open",
          entity_type: "quality_shifts", description: "Démarrage shift qualité par l'opérateur",
        });
      }

      toast({ title: "Shift démarré" });
      setOpen(false);
      await refresh();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  function toggleLine(id: string) {
    setSelectedLineIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  const slotLabel = shiftType === "matin" ? "Matin" : shiftType === "apres_midi" ? "Après-midi" : "Nuit";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Play className="h-4 w-4 mr-2" /> Démarrer mon shift maintenant
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Démarrer mon shift — {slotLabel}</DialogTitle>
          <DialogDescription>
            {kind === "production"
              ? "La production n'est pas ouverte automatiquement. Sélectionnez la ligne et l'OF en cours."
              : hasPlan
                ? "Votre créneau est défini par le planning de rotation de votre équipe. Équipe et lignes sont pré-remplies."
                : "Aucun planning n'a été configuré par votre responsable. Vous pouvez ouvrir votre session vous-même."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {hasPlan && kind !== "production" && (
            <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              Créneau planifié : <span className="font-medium text-foreground">{slotLabel}</span>
              {plan?.templateCode ? ` (${plan.templateCode})` : ""}
              {!plan?.isOnShift && plan?.autorisationLibre ? " — hors créneau (autorisation libre)" : ""}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Équipe {hasPlan ? "(planning)" : "(optionnel)"}</Label>
            <Select value={teamId} onValueChange={setTeamId} disabled={hasPlan && !!plan?.teamId}>
              <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Aucune —</SelectItem>
                {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.code} — {t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {kind === "production" ? (
            <>
              <div className="space-y-1.5">
                <Label>Ligne *</Label>
                <Select value={lineId} onValueChange={setLineId}>
                  <SelectTrigger><SelectValue placeholder="Choisir une ligne…" /></SelectTrigger>
                  <SelectContent>
                    {lines.map((l) => <SelectItem key={l.id} value={l.id}>{l.code} — {l.designation}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>OF en cours *</Label>
                <Select value={ofId} onValueChange={setOfId}>
                  <SelectTrigger><SelectValue placeholder="Choisir un OF…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Aucun —</SelectItem>
                    {ofs
                      .filter((o) => !lineId || o.line_id === lineId)
                      .map((o) => <SelectItem key={o.id} value={o.id}>{o.numero}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : kind === "quality" ? (
            <div className="space-y-1.5">
              <Label>Lignes ciblées</Label>
              <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                Les lignes sont déterminées automatiquement à partir des OF actifs — aucune sélection nécessaire.
              </div>
              {selectedLineIds.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {lines
                    .filter((l) => selectedLineIds.includes(l.id))
                    .map((l) => (
                      <span key={l.id} className="inline-flex items-center rounded-md bg-accent px-2 py-1 text-xs">
                        <span className="font-medium">{l.code}</span>&nbsp;— {l.designation}
                      </span>
                    ))}
                </div>
              ) : (
                <p className="text-xs text-amber-600 px-1">Aucun OF actif pour le moment — vous pourrez saisir des contrôles dès qu'un OF démarre.</p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Lignes couvertes * {hasPlan && <span className="text-xs text-muted-foreground">(définies par le planning)</span>}</Label>
              <div className="border rounded-md p-2 max-h-48 overflow-auto space-y-1">
                {lines
                  .filter((l) => !hasPlan || selectedLineIds.includes(l.id))
                  .map((l) => (
                    <label key={l.id} className={`flex items-center gap-2 text-sm py-1 px-1 rounded ${hasPlan ? "opacity-90" : "hover:bg-accent cursor-pointer"}`}>
                      <Checkbox
                        checked={selectedLineIds.includes(l.id)}
                        disabled={hasPlan}
                        onCheckedChange={() => !hasPlan && toggleLine(l.id)}
                      />
                      <span><span className="font-medium">{l.code}</span> — {l.designation}</span>
                    </label>
                  ))}
                {hasPlan && selectedLineIds.length === 0 && (
                  <p className="text-xs text-amber-600 px-1 py-2">Aucune ligne définie dans le planning pour ce créneau.</p>
                )}
              </div>
            </div>
          )}
        </div>


        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Annuler</Button>
          <Button onClick={handleStart} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Démarrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
