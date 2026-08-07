import { useEffect, useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveDialog } from "@/components/responsive/ResponsiveDialog";
import { Wrench, ShieldAlert, Plus, ExternalLink, RefreshCw, OctagonAlert, PlayCircle } from "lucide-react";
import { logAudit } from "@/lib/audit";
import { cn } from "@/lib/utils";

interface MaintCtxRow {
  kind: "ticket" | "preventive";
  id: string;
  numero: string | null;
  label: string;
  statut: string;
  priorite: string | null;
  machine_id: string | null;
  ligne_id: string | null;
}

interface LineRow {
  id: string;
  code: string | null;
  designation: string | null;
  machine_id: string | null;
}

interface MachineRow {
  id: string;
  code: string | null;
  designation: string | null;
}

interface Props {
  ofId: string;
  ofNumero?: string | null;
  lineId?: string | null;
  qualityShiftId?: string | null;
}

const LEVELS = [
  { value: "mineur", label: "Mineur" },
  { value: "majeur", label: "Majeur" },
  { value: "critique", label: "Critique" },
];

const levelBadgeClass = (level?: string | null) => {
  switch (level) {
    case "critique":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "majeur":
      return "bg-amber-500/10 text-amber-600 border-amber-500/30";
    default:
      return "bg-muted text-muted-foreground";
  }
};

/**
 * Shows maintenance risks (open tickets + active preventive plans) related to the
 * OF's line/machine, and lets quality staff declare a maintenance ticket from a
 * detected quality risk (line + machine + severity + production decision), or
 * attach a quality risk to an already-open ticket. Connects the quality shift to
 * the maintenance shift.
 */
export function MaintenanceRiskPanel({ ofId, ofNumero, lineId, qualityShiftId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const backState = { from: location.pathname + location.search };
  const [rows, setRows] = useState<MaintCtxRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [riskFlags, setRiskFlags] = useState<Record<string, { risk: boolean; level: string | null }>>({});

  const [lines, setLines] = useState<LineRow[]>([]);
  const [machines, setMachines] = useState<MachineRow[]>([]);

  // Create dialog
  const [open, setOpen] = useState(false);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(lineId ?? null);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [priorite, setPriorite] = useState("normale");
  const [level, setLevel] = useState("majeur");
  const [decision, setDecision] = useState<"arret" | "maintien">("maintien");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Attach-to-existing dialog
  const [attachTicket, setAttachTicket] = useState<MaintCtxRow | null>(null);
  const [attachLevel, setAttachLevel] = useState("majeur");
  const [attachDecision, setAttachDecision] = useState<"arret" | "maintien">("maintien");
  const [attachNote, setAttachNote] = useState("");
  const [attaching, setAttaching] = useState(false);

  const load = useCallback(async () => {
    if (!ofId) return;
    setLoading(true);
    const ctxRes = await (supabase as any).rpc("get_maintenance_context_for_of", { p_of_id: ofId });
    const ctxRows = (((ctxRes.data as any[]) ?? []) as MaintCtxRow[]);
    setRows(ctxRows);

    const ticketIds = ctxRows.filter((r) => r.kind === "ticket").map((r) => r.id);
    if (ticketIds.length) {
      const { data: flags } = await supabase
        .from("tickets")
        .select("id, quality_risk, quality_risk_level")
        .in("id", ticketIds);
      const map: Record<string, { risk: boolean; level: string | null }> = {};
      for (const f of (flags as any[]) ?? []) map[f.id] = { risk: !!f.quality_risk, level: f.quality_risk_level };
      setRiskFlags(map);
    } else {
      setRiskFlags({});
    }
    setLoading(false);
  }, [ofId]);

  useEffect(() => {
    load();
  }, [load]);

  // Load active lines for the create dialog.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("production_lines")
        .select("id, code, designation, machine_id")
        .eq("is_active", true)
        .order("code");
      setLines(((data as any[]) ?? []) as LineRow[]);
    })();
  }, []);

  // Load machines assigned to the selected line (+ the line's main machine).
  useEffect(() => {
    (async () => {
      if (!selectedLineId) { setMachines([]); return; }
      const line = lines.find((l) => l.id === selectedLineId);
      const { data: assigns } = await supabase
        .from("machine_line_assignments")
        .select("machine_id, machines(id, code, designation)")
        .eq("line_id", selectedLineId)
        .order("sort_order");
      const list: MachineRow[] = [];
      const seen = new Set<string>();
      for (const a of (assigns as any[]) ?? []) {
        const m = a.machines;
        if (m && !seen.has(m.id)) { list.push(m); seen.add(m.id); }
      }
      if (line?.machine_id && !seen.has(line.machine_id)) {
        const { data: mainM } = await supabase
          .from("machines")
          .select("id, code, designation")
          .eq("id", line.machine_id)
          .maybeSingle();
        if (mainM) list.unshift(mainM as any);
      }
      setMachines(list);
      setSelectedMachineId((prev) => (prev && list.some((m) => m.id === prev) ? prev : list[0]?.id ?? null));
    })();
  }, [selectedLineId, lines]);

  const tickets = rows.filter((r) => r.kind === "ticket");
  const preventifs = rows.filter((r) => r.kind === "preventive");

  const notifyMaintenance = async (ticketId: string, numero: string | null, level: string, decision: string) => {
    try {
      const { data: resp } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "resp_maintenance" as any);
      const recipients = ((resp as any[]) ?? []).map((r) => r.user_id).filter((uid) => uid && uid !== user?.id);
      const arret = decision === "arret";
      const payload = recipients.map((uid) => ({
        notification_type: "ticket_quality_risk",
        module: "tickets",
        title: `Risque qualité ${level}${arret ? " — arrêt production" : ""}`,
        message: `Ticket ${numero ?? ""} signalé en risque qualité par le contrôle qualité.`,
        recipient_user_id: uid,
        triggered_by_user_id: user?.id,
        entity_type: "ticket",
        entity_id: ticketId,
        entity_code: numero,
        action_url: `/tickets/${ticketId}`,
        severity: (arret || level === "critique" ? "warning" : "info") as any,
      }));
      if (payload.length) await supabase.from("notifications").insert(payload as any);
    } catch {
      /* notifications best-effort */
    }
  };

  const handleCreateTicket = async () => {
    if (!description.trim()) {
      toast({ title: "Description requise", variant: "destructive" });
      return;
    }
    const machineId = selectedMachineId ?? lines.find((l) => l.id === selectedLineId)?.machine_id ?? null;
    if (!machineId) {
      toast({ title: "Aucune machine", description: "Sélectionnez une machine (aucune n'est liée à cette ligne).", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("tickets")
        .insert({
          machine_id: machineId,
          ligne_id: selectedLineId ?? null,
          of_id: ofId,
          priorite: priorite as any,
          description: `[Risque qualité] ${description.trim()}`,
          declarant_id: user?.id,
          numero: "",
          is_from_gpao: false,
          quality_risk: true,
          quality_risk_level: level,
          quality_risk_note: description.trim(),
          quality_production_decision: decision,
          quality_risk_declared_by: user?.id,
          quality_risk_declared_at: new Date().toISOString(),
          quality_shift_id: qualityShiftId ?? null,
        } as any)
        .select("id, numero")
        .single();
      if (error) throw error;
      const tId = (data as any).id;
      const tNum = (data as any).numero;
      await logAudit({
        action_type: "create",
        module: "gmao" as any,
        entity_type: "ticket",
        entity_id: tId,
        action_label: "Ticket maintenance depuis risque qualité",
        new_values: { of_id: ofId, ligne_id: selectedLineId, origine: "qualite", quality_risk_level: level, decision },
        severity: decision === "arret" ? "high" : "medium",
      });
      await notifyMaintenance(tId, tNum, level, decision);
      toast({ title: "Ticket créé", description: `Risque qualité signalé (OF ${ofNumero ?? ""})` });
      setOpen(false);
      setDescription("");
      setPriorite("normale");
      setLevel("majeur");
      setDecision("maintien");
      await load();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttach = async () => {
    if (!attachTicket) return;
    if (!attachNote.trim()) {
      toast({ title: "Note requise", variant: "destructive" });
      return;
    }
    setAttaching(true);
    try {
      const { error } = await (supabase as any).rpc("attach_quality_risk_to_ticket", {
        p_ticket_id: attachTicket.id,
        p_level: attachLevel,
        p_note: attachNote.trim(),
        p_decision: attachDecision,
        p_shift_id: qualityShiftId ?? null,
        p_check_id: null,
        p_nc_id: null,
      });
      if (error) throw error;
      await logAudit({
        action_type: "update",
        module: "gmao" as any,
        entity_type: "ticket",
        entity_id: attachTicket.id,
        action_label: "Risque qualité ajouté à un ticket",
        new_values: { quality_risk_level: attachLevel, decision: attachDecision, origine: "qualite" },
        severity: attachDecision === "arret" ? "high" : "medium",
      });
      await notifyMaintenance(attachTicket.id, attachTicket.numero, attachLevel, attachDecision);
      toast({ title: "Risque qualité ajouté", description: `Ticket ${attachTicket.numero ?? ""}` });
      setAttachTicket(null);
      setAttachNote("");
      setAttachLevel("majeur");
      setAttachDecision("maintien");
      await load();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setAttaching(false);
    }
  };

  const DecisionToggle = ({ value, onChange }: { value: "arret" | "maintien"; onChange: (v: "arret" | "maintien") => void }) => (
    <div className="grid grid-cols-2 gap-2">
      <Button
        type="button"
        variant={value === "arret" ? "destructive" : "outline"}
        onClick={() => onChange("arret")}
        className="h-11"
      >
        <OctagonAlert className="h-4 w-4 mr-1.5" /> Arrêter
      </Button>
      <Button
        type="button"
        variant={value === "maintien" ? "default" : "outline"}
        onClick={() => onChange("maintien")}
        className="h-11"
      >
        <PlayCircle className="h-4 w-4 mr-1.5" /> Maintenir
      </Button>
    </div>
  );

  return (
    <Card className="border-amber-500/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" /> Risques &amp; maintenance
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button size="sm" onClick={() => { setSelectedLineId(lineId ?? null); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Déclarer un ticket
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-1.5">
            <Wrench className="h-3.5 w-3.5" /> Tickets ouverts ({tickets.length})
          </div>
          {tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun ticket maintenance ouvert sur cette ligne.</p>
          ) : (
            <div className="space-y-1.5">
              {tickets.map((t) => {
                const flag = riskFlags[t.id];
                return (
                  <div key={t.id} className="flex items-center justify-between gap-2 text-sm border rounded-md px-2.5 py-1.5">
                    <div className="min-w-0 flex items-center gap-1.5">
                      {flag?.risk && <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />}
                      <span className="font-medium">{t.numero || t.id.slice(0, 6)}</span>
                      <span className="text-muted-foreground truncate">{t.label}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {flag?.risk ? (
                        <Badge variant="outline" className={cn("text-[10px]", levelBadgeClass(flag.level))}>
                          Risque {flag.level ?? ""}
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => { setAttachTicket(t); }}
                        >
                          <ShieldAlert className="h-3.5 w-3.5 mr-1" /> Risque qualité
                        </Button>
                      )}
                      {t.priorite && <Badge variant="outline" className="text-[10px]">{t.priorite}</Badge>}
                      <Badge variant="secondary" className="text-[10px]">{t.statut}</Badge>
                      <Button asChild size="sm" variant="ghost" className="h-7 px-2">
                        <Link to={`/tickets/${t.id}`} state={backState}><ExternalLink className="h-3.5 w-3.5" /></Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            Préventifs actifs ({preventifs.length})
          </div>
          {preventifs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun plan préventif actif sur cet équipement.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {preventifs.map((p) => (
                <Badge key={p.id} variant="outline" className="py-1">
                  <Link to={`/preventif/${p.id}`} state={backState} className="hover:underline">{p.numero || ""} {p.label}</Link>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      {/* Create ticket dialog */}
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Déclarer un ticket maintenance"
        description={`Risque qualité constaté sur l'OF ${ofNumero ?? ""}. Le ticket sera lié à l'OF et au shift qualité.`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Ligne</Label>
              <Select value={selectedLineId ?? undefined} onValueChange={(v) => setSelectedLineId(v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Choisir une ligne" /></SelectTrigger>
                <SelectContent>
                  {lines.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.code} — {l.designation}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Machine</Label>
              <Select value={selectedMachineId ?? undefined} onValueChange={(v) => setSelectedMachineId(v)} disabled={!machines.length}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={machines.length ? "Choisir une machine" : "Aucune machine"} /></SelectTrigger>
                <SelectContent>
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.code} — {m.designation}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Priorité</Label>
              <Select value={priorite} onValueChange={setPriorite}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basse">Basse</SelectItem>
                  <SelectItem value="normale">Normale</SelectItem>
                  <SelectItem value="haute">Haute</SelectItem>
                  <SelectItem value="critique">Critique</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Gravité qualité</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Décision production</Label>
            <div className="mt-1"><DecisionToggle value={decision} onChange={setDecision} /></div>
          </div>

          <div>
            <Label>Description du risque *</Label>
            <Textarea
              className="mt-1"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez le problème constaté (dérive machine, fuite, non-conformité récurrente...)"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Annuler</Button>
            <Button onClick={handleCreateTicket} disabled={submitting}>
              <Plus className="h-4 w-4 mr-1" /> {submitting ? "Création..." : "Créer le ticket"}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>

      {/* Attach quality risk to existing ticket dialog */}
      <ResponsiveDialog
        open={!!attachTicket}
        onOpenChange={(o) => { if (!o) setAttachTicket(null); }}
        title="Ajouter un risque qualité"
        description={`Ticket ${attachTicket?.numero ?? ""} — ${attachTicket?.label ?? ""}`}
      >
        <div className="space-y-4">
          <div>
            <Label>Gravité qualité</Label>
            <Select value={attachLevel} onValueChange={setAttachLevel}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Décision production</Label>
            <div className="mt-1"><DecisionToggle value={attachDecision} onChange={setAttachDecision} /></div>
          </div>
          <div>
            <Label>Note *</Label>
            <Textarea
              className="mt-1"
              rows={4}
              value={attachNote}
              onChange={(e) => setAttachNote(e.target.value)}
              placeholder="Précisez le risque qualité lié à ce ticket..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAttachTicket(null)} disabled={attaching}>Annuler</Button>
            <Button onClick={handleAttach} disabled={attaching}>
              <ShieldAlert className="h-4 w-4 mr-1" /> {attaching ? "Ajout..." : "Ajouter le risque"}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>
    </Card>
  );
}
