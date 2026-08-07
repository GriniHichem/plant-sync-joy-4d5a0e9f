import { useState } from "react";
import { useNavWithFrom } from "@/hooks/useNavWithFrom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertTriangle, CalendarCheck, Clock, RefreshCw, Users, Package,
  ShieldAlert, ClipboardCheck, ChevronDown, Loader2, Hourglass, ArrowDownUp, Settings2,
} from "lucide-react";
import { formatDuration } from "@/lib/utils";
import { useMaintenanceRespOverview } from "@/hooks/useMaintenanceRespOverview";
import { RespShiftConsole } from "@/components/shift/RespShiftConsole";
import { SelfOpenShiftDialog } from "@/components/shift/SelfOpenShiftDialog";
import { useActiveMaintenanceShift } from "@/hooks/useActiveMaintenanceShift";
import { Wrench } from "lucide-react";

function ageMinutes(iso?: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { label: string; variant: "destructive" | "secondary" | "outline" }> = {
    critique: { label: "Critique", variant: "destructive" },
    haute: { label: "Haute", variant: "destructive" },
    normale: { label: "Normale", variant: "secondary" },
    basse: { label: "Basse", variant: "outline" },
  };
  const info = map[priority] || map.normale;
  return <Badge variant={info.variant} className="text-[10px] px-1.5 py-0">{info.label}</Badge>;
}

function Kpi({ label, value, sub, tone = "default", onClick }: { label: string; value: number; sub?: string; tone?: "default" | "danger" | "primary" | "amber"; onClick?: () => void }) {
  const toneCls =
    tone === "danger" ? "text-destructive" :
    tone === "primary" ? "text-primary" :
    tone === "amber" ? "text-amber-600" : "";
  return (
    <Card className={onClick ? "cursor-pointer hover:bg-accent/30 transition" : ""} onClick={onClick}>
      <CardContent className="p-4">
        <div className="text-[11px] uppercase text-muted-foreground tracking-wider">{label}</div>
        <div className={`text-3xl font-bold mt-1 tabular-nums ${toneCls}`}>{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export function MaintenanceRespDashboard() {
  const navigate = useNavWithFrom();
  const { tickets, preventives, movements, activeTechs, loading, reload, kpis } = useMaintenanceRespOverview();
  const { shift: maintenanceShift } = useActiveMaintenanceShift();
  const [showSessions, setShowSessions] = useState(false);

  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // Ticket advancement state
  const ticketState = (t: typeof tickets[number]) => {
    if (t.waiting_parts) return { label: "En attente pièces", icon: Hourglass, cls: "text-amber-600" };
    if (t.statut === "pris_en_charge") return { label: "Pris en charge", icon: ClipboardCheck, cls: "text-primary" };
    return { label: "Ouvert — non pris", icon: AlertTriangle, cls: "text-destructive" };
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Console Responsable Maintenance</h1>
          <p className="text-sm text-muted-foreground capitalize">{today}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {maintenanceShift ? (
            <Button size="sm" onClick={() => navigate("/maintenance/shift/live")}>
              <Wrench className="h-4 w-4 mr-1.5" /> Aller à mon poste maintenancier
            </Button>
          ) : (
            <SelfOpenShiftDialog kind="maintenance" />
          )}
          <Button variant="outline" size="sm" onClick={reload}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Rafraîchir
          </Button>
        </div>
      </div>

      {maintenanceShift && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 flex items-center gap-2">
          <Wrench className="h-4 w-4 shrink-0" />
          Mode intervention urgente actif — vous avez une session maintenancier ouverte. Vous pouvez prendre en charge des tickets et exécuter des interventions.
        </div>
      )}

      {/* KPIs - Using a more compact grid to reduce initial vertical space */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <Kpi label="Ouverts" value={kpis.openTickets} tone="danger" onClick={() => navigate("/tickets")} />
        <Kpi label="Urgents" value={kpis.urgentTickets} tone="danger" />
        <Kpi label="Aujourd'hui" value={kpis.todayTickets} />
        <Kpi label="Préventifs" value={kpis.preventiveInProgress} tone="primary" />
        <Kpi label="Actifs" value={kpis.activeTechCount} tone="primary" />
        <Kpi label="PDR" value={kpis.movementsToday} tone="amber" />
      </div>

      {loading && tickets.length === 0 ? (
        <div className="p-10 text-center text-muted-foreground flex flex-col items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <p className="text-xs">Chargement des données en cours...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Curative tickets */}
          <Card className="lg:col-span-2">
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-destructive" /> Tickets curatifs en cours ({tickets.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {tickets.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Aucun ticket ouvert.</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {tickets.map((t) => {
                    const st = ticketState(t);
                    const age = ageMinutes(t.heure_declaration);
                    const stalledOpen = t.statut === "ouvert" && age > 60;
                    const StIcon = st.icon;
                    return (
                      <div key={t.id} className="p-3 hover:bg-accent/30 transition cursor-pointer flex items-start gap-3"
                        onClick={() => navigate(`/tickets/${t.id}`, { state: { from: "/maintenance/shift" } })}>
                        <StIcon className={`h-4 w-4 shrink-0 mt-0.5 ${st.cls}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold">{t.numero}</span>
                            <PriorityBadge priority={t.priorite} />
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${st.cls}`}>{st.label}</Badge>
                            {stalledOpen && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Non pris depuis {formatDuration(age)}</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{t.description}</p>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground/80 flex-wrap">
                            {t.machine && <span className="font-mono">{t.machine.code}</span>}
                            {t.ligne && <span>{t.ligne.code}</span>}
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(age)}</span>
                            {t.declarant_name && <span>Décl. : {t.declarant_name}</span>}
                            {t.statut === "pris_en_charge" && t.assignee_name && <span className="text-primary">→ {t.assignee_name}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preventives in progress */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-primary" /> Préventifs commencés ({preventives.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {preventives.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Aucune intervention préventive en cours.</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {preventives.map((p) => {
                    const elapsed = ageMinutes(p.heure_debut);
                    const late = p.prochaine_echeance && new Date(p.prochaine_echeance) < new Date();
                    return (
                      <div key={p.id} className="p-3 hover:bg-accent/30 transition cursor-pointer flex items-start gap-3"
                        onClick={() => navigate(`/preventif/${p.plan_id}`)}>
                        <CalendarCheck className={`h-4 w-4 shrink-0 mt-0.5 ${late ? "text-destructive" : "text-primary"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {p.plan_numero && <span className="font-mono text-xs font-bold">{p.plan_numero}</span>}
                            <span className="text-sm">{p.plan_title}</span>
                            {late && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">En retard</Badge>}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground/80 flex-wrap">
                            {p.machine && <span className="font-mono">{p.machine.code}</span>}
                            {p.executor_name && <span className="text-primary">{p.executor_name}</span>}
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(elapsed)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active technicians */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Maintenanciers actifs ({activeTechs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {activeTechs.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Aucun maintenancier en intervention.</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {activeTechs.map((a) => (
                    <div key={a.user_id} className="p-3 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {a.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{a.name}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                          {a.curative > 0 && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{a.curative} curatif</Badge>}
                          {a.preventive > 0 && <Badge className="text-[10px] px-1.5 py-0 bg-primary">{a.preventive} préventif</Badge>}
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />depuis {formatDuration(ageMinutes(a.since))}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* PDR movements */}
          <Card className="lg:col-span-2">
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowDownUp className="h-4 w-4 text-amber-600" /> Mouvements PDR du jour ({movements.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {movements.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Aucun mouvement de pièce aujourd'hui.</div>
              ) : (
                <div className="divide-y divide-border/50 max-h-80 overflow-auto">
                  {movements.map((m) => (
                    <div key={m.id} className="p-2.5 flex items-center gap-3 text-sm">
                      <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={m.type === "sortie" ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0 capitalize">{m.type}</Badge>
                          <span className="font-mono text-xs">{m.pdr?.reference}</span>
                          <span className="text-muted-foreground truncate">{m.pdr?.designation}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground/80 flex-wrap">
                          <span className="tabular-nums">{m.quantite} {m.pdr?.unite_stock ?? ""}</span>
                          {m.ref_label && <span>{m.ref_label}</span>}
                          {m.agent_name && <span>{m.agent_name}</span>}
                          <span>{new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sessions management — secondary, collapsible */}
      <Collapsible open={showSessions} onOpenChange={setShowSessions}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> Gestion des sessions de shift</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showSessions ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <RespShiftConsole kind="maintenance" />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
