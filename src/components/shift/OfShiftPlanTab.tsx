/**
 * Plan de shifts d'un OF.
 *
 * Permet au responsable production (ou créateur de l'OF) d'affecter une équipe
 * + un chef de ligne à chaque créneau (matin, après-midi, nuit).
 * Contrôle aussi `auto_generate_shifts` sur l'OF : quand activé, les sessions
 * de shift sont auto-créées au démarrage du kiosk pour chaque chef de ligne
 * affecté, jusqu'à la clôture de l'OF (trigger `tg_of_close_cascade_shifts`).
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Trash2, Users, Sun, Sunset, Moon, Info } from "lucide-react";
import { logAudit } from "@/lib/audit";

type ShiftType = "matin" | "apres_midi" | "nuit";

const SLOTS: { type: ShiftType; label: string; icon: typeof Sun; hours: string }[] = [
  { type: "matin", label: "Matin", icon: Sun, hours: "05h–13h" },
  { type: "apres_midi", label: "Après-midi", icon: Sunset, hours: "13h–21h" },
  { type: "nuit", label: "Nuit", icon: Moon, hours: "21h–05h" },
];

interface Props {
  ofId: string;
  ofStatut: string;
  autoGenerate: boolean;
  ofCreatedBy: string | null;
  onChange?: () => void;
}

export function OfShiftPlanTab({ ofId, ofStatut, autoGenerate, ofCreatedBy, onChange }: Props) {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teams, setTeams] = useState<any[]>([]);
  const [chefs, setChefs] = useState<any[]>([]);
  const [autoOn, setAutoOn] = useState(autoGenerate);
  const [assignments, setAssignments] = useState<Record<ShiftType, { team_id: string; chef_ligne_id: string; id?: string } | null>>({
    matin: null,
    apres_midi: null,
    nuit: null,
  });

  const canManage = useMemo(() => {
    return (
      hasRole("admin" as any) ||
      hasRole("resp_production" as any) ||
      (user?.id && ofCreatedBy === user.id)
    );
  }, [hasRole, user, ofCreatedBy]);

  const editable = canManage && ofStatut !== "termine" && ofStatut !== "annule";

  useEffect(() => { setAutoOn(autoGenerate); }, [autoGenerate]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [tRes, cRes, aRes] = await Promise.all([
        supabase.from("shift_teams").select("id, code, name, color").eq("is_active", true).order("code"),
        supabase
          .from("user_roles")
          .select("user_id, profiles:profiles!inner(user_id, first_name, last_name)")
          .eq("role", "chef_ligne" as any),
        supabase
          .from("of_shift_assignments" as any)
          .select("*")
          .eq("of_id", ofId),
      ]);
      setTeams(tRes.data ?? []);
      const chefRows = (cRes.data ?? []).map((r: any) => ({
        user_id: r.profiles?.user_id ?? r.user_id,
        full_name: [r.profiles?.first_name, r.profiles?.last_name].filter(Boolean).join(" ") || "Sans nom",
      }));
      setChefs(chefRows);
      const next: any = { matin: null, apres_midi: null, nuit: null };
      for (const row of (aRes.data ?? []) as any[]) {
        next[row.shift_type] = {
          id: row.id,
          team_id: row.shift_team_id,
          chef_ligne_id: row.chef_ligne_id,
        };
      }
      setAssignments(next);
      setLoading(false);
    })();
  }, [ofId]);

  function update(slot: ShiftType, patch: Partial<{ team_id: string; chef_ligne_id: string }>) {
    setAssignments((prev) => ({
      ...prev,
      [slot]: { team_id: prev[slot]?.team_id ?? "", chef_ligne_id: prev[slot]?.chef_ligne_id ?? "", ...prev[slot], ...patch },
    }));
  }

  async function save() {
    if (!editable) return;
    setSaving(true);
    try {
      // 1. Toggle auto_generate
      if (autoOn !== autoGenerate) {
        const { error } = await supabase
          .from("ordres_fabrication")
          .update({ auto_generate_shifts: autoOn } as any)
          .eq("id", ofId);
        if (error) throw error;
        await logAudit({
          action_type: "update",
          module: "of",
          action: "of_auto_generate_shifts_toggled",
          entity_type: "ordres_fabrication",
          entity_id: ofId,
          new_values: { auto_generate_shifts: autoOn },
        });
      }

      // 2. Upsert / delete assignments
      for (const slot of SLOTS) {
        const cur = assignments[slot.type];
        if (!cur || !cur.team_id || !cur.chef_ligne_id) {
          // delete if existed
          if (cur?.id) {
            await supabase.from("of_shift_assignments" as any).delete().eq("id", cur.id);
          }
          continue;
        }
        if (cur.id) {
          await supabase
            .from("of_shift_assignments" as any)
            .update({
              shift_team_id: cur.team_id,
              chef_ligne_id: cur.chef_ligne_id,
            })
            .eq("id", cur.id);
        } else {
          await supabase.from("of_shift_assignments" as any).insert({
            of_id: ofId,
            shift_type: slot.type,
            shift_team_id: cur.team_id,
            chef_ligne_id: cur.chef_ligne_id,
            created_by: user?.id ?? null,
          });
        }
      }

      await logAudit({
        action_type: "update",
        module: "of",
        action: "of_shift_plan_updated",
        entity_type: "ordres_fabrication",
        entity_id: ofId,
        new_values: { assignments, auto_generate_shifts: autoOn },
      });

      toast({ title: "Plan de shifts enregistré" });
      onChange?.();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function clearSlot(slot: ShiftType) {
    setAssignments((prev) => ({ ...prev, [slot]: null }));
  }

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Auto-génération des sessions de shift
          </CardTitle>
          <CardDescription>
            Si activé, les sessions de shift sont créées automatiquement au démarrage de chaque créneau,
            pour le chef de ligne affecté, jusqu'à la clôture de l'OF.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Switch checked={autoOn} onCheckedChange={setAutoOn} disabled={!editable} />
            <Label className="text-sm">{autoOn ? "Activée" : "Désactivée"}</Label>
          </div>
          <Badge variant={autoOn ? "default" : "outline"}>
            {autoOn ? "Auto" : "Manuel"}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Affectation par créneau</CardTitle>
          <CardDescription>
            Choisissez l'équipe et le chef de ligne titulaire pour chaque créneau de la journée.
            Les créneaux non affectés ne génèrent pas de session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {SLOTS.map(({ type, label, icon: Icon, hours }) => {
            const cur = assignments[type];
            return (
              <div key={type} className="grid grid-cols-1 md:grid-cols-[160px_1fr_1fr_auto] gap-2 items-center p-3 border rounded-md">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-sm">{label}</div>
                    <div className="text-[10px] text-muted-foreground">{hours}</div>
                  </div>
                </div>
                <Select
                  value={cur?.team_id ?? "__none__"}
                  onValueChange={(v) => update(type, { team_id: v === "__none__" ? "" : v })}
                  disabled={!editable}
                >
                  <SelectTrigger className="h-10"><SelectValue placeholder="Équipe…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Aucune —</SelectItem>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.code} — {t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={cur?.chef_ligne_id ?? "__none__"}
                  onValueChange={(v) => update(type, { chef_ligne_id: v === "__none__" ? "" : v })}
                  disabled={!editable}
                >
                  <SelectTrigger className="h-10"><SelectValue placeholder="Chef de ligne…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Aucun —</SelectItem>
                    {chefs.map((c) => (
                      <SelectItem key={c.user_id} value={c.user_id}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={!editable || !cur}
                  onClick={() => clearSlot(type)}
                  title="Vider ce créneau"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}

          {editable && (
            <div className="flex justify-end pt-2">
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Enregistrer le plan
              </Button>
            </div>
          )}

          {!editable && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 p-2 rounded">
              <Info className="h-3.5 w-3.5 mt-0.5" />
              <span>
                {ofStatut === "termine" || ofStatut === "annule"
                  ? "OF clôturé : le plan ne peut plus être modifié."
                  : "Vous n'avez pas le droit de modifier le plan de shifts de cet OF."}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
