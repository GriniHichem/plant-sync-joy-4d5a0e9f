import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDuration } from "@/lib/utils";
import type { ShiftKind } from "@/contexts/ActiveShiftContext";

export interface ShiftKpi {
  label: string;
  value: number | string;
  hint?: string;
}

export interface ShiftSessionStats {
  loading: boolean;
  primary: ShiftKpi;
  secondary: ShiftKpi;
  tertiary?: ShiftKpi;
  /** Extra KPIs for downtime / intervention time / conformity */
  extras: ShiftKpi[];
}

/** Format minutes -> "1h23" / "47 min". */
function fmtMinutes(min: number): string {
  return formatDuration(min);
}

/** Compute minute delta between two ISO timestamps; clamped to >= 0. */
function diffMinutes(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return (b - a) / 60000;
}

/**
 * Live KPIs for a single shift session, used by the responsable console.
 * Business rules (validated):
 *  - Production: cumul arrêts (somme duree_minutes ou heure_fin-heure_debut, en cours = jusqu'à now()).
 *  - Maintenance: temps d'intervention = somme(date_fin - date_debut) du technicien dans la fenêtre du shift,
 *                 + temps d'arrêt = somme(temps_arret_minutes) des tickets clôturés sur la session.
 *  - Qualité: taux de conformité = contrôles conformes / total contrôles validés (status != 'rejected').
 */
export function useShiftSessionStats(kind: ShiftKind, sessionId: string | null): ShiftSessionStats {
  const [stats, setStats] = useState<ShiftSessionStats>({
    loading: true,
    primary: { label: "—", value: 0 },
    secondary: { label: "—", value: 0 },
    extras: [],
  });

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    async function load() {
      if (kind === "production") {
        const [{ data: decl }, { data: stops }, { data: shiftTickets }] = await Promise.all([
          supabase
            .from("production_declarations")
            .select("quantite_produite, quantite_rebut")
            .eq("shift_id", sessionId),
          supabase
            .from("production_stops")
            .select("duree_minutes, heure_debut, heure_fin, ticket_id")
            .eq("shift_id", sessionId),
          supabase
            .from("tickets")
            .select("id, temps_arret_minutes, statut")
            .eq("shift_id", sessionId),
        ]);
        const totalProd = (decl ?? []).reduce((s, d: any) => s + Number(d.quantite_produite || 0), 0);
        const rebut = (decl ?? []).reduce((s, d: any) => s + Number(d.quantite_rebut || 0), 0);
        const conforme = Math.max(totalProd - rebut, 0);
        const conformite = totalProd > 0 ? Math.round((conforme / totalProd) * 100) : null;

        const stopDowntime = (stops ?? []).reduce((acc, s: any) => {
          const d = Number(s.duree_minutes ?? 0);
          if (d > 0) return acc + d;
          return acc + diffMinutes(s.heure_debut, s.heure_fin ?? new Date().toISOString());
        }, 0);

        // L5: add ticket downtime not already covered by a stop (dedup via production_stops.ticket_id).
        const stoppedTicketIds = new Set((stops ?? []).map((s: any) => s.ticket_id).filter(Boolean));
        const ticketDowntime = (shiftTickets ?? []).reduce((acc, t: any) => {
          if (stoppedTicketIds.has(t.id)) return acc;
          return acc + Number(t.temps_arret_minutes || 0);
        }, 0);
        const downtime = stopDowntime + ticketDowntime;
        const ticketsCount = (shiftTickets ?? []).length;

        if (cancelled) return;
        setStats({
          loading: false,
          primary: { label: "Production", value: totalProd, hint: `${rebut} rebut` },
          secondary: { label: "Arrêts", value: stops?.length ?? 0, hint: fmtMinutes(downtime) },
          tertiary: { label: "Tickets", value: ticketsCount },
          extras: [
            { label: "Temps d'arrêt", value: fmtMinutes(downtime) },
            { label: "Conformité", value: conformite === null ? "—" : `${conformite}%`, hint: `${conforme}/${totalProd}` },
          ],
        });
      } else if (kind === "maintenance") {
        const { data: shiftRow } = await supabase
          .from("maintenance_shifts" as any)
          .select("maintenancier_id, heure_debut, heure_fin")
          .eq("id", sessionId)
          .maybeSingle();
        if (!shiftRow) {
          if (!cancelled)
            setStats({
              loading: false,
              primary: { label: "Interventions", value: 0 },
              secondary: { label: "Tickets clôturés", value: 0 },
              extras: [],
            });
          return;
        }
        const s = shiftRow as any;
        const endTs = s.heure_fin ?? new Date().toISOString();
        const [{ data: interv }, { data: closedTickets }] = await Promise.all([
          supabase
            .from("interventions")
            .select("date_debut, date_fin, statut, description, role, ticket_id")
            .eq("technicien_id", s.maintenancier_id)
            .gte("date_debut", s.heure_debut)
            .lte("date_debut", endTs),
          supabase
            .from("tickets")
            .select("temps_arret_minutes, temps_intervention_minutes")
            // C2: valid enum is resolu|cloture (never 'ferme'). Includes both lifecycle endpoints.
            .in("statut", ["resolu", "cloture"] as any)
            .gte("heure_resolution", s.heure_debut)
            .lte("heure_resolution", endTs),
        ]);

        // L1: exclude bookkeeping rows (transfer/release/collab) from intervention count.
        // Real interventions = lead role OR (no role set AND description ≠ "Prise en charge"/"Collaboration").
        const realInterv = (interv ?? []).filter((i: any) => {
          if (i.statut === "transferee" || i.statut === "liberee") return false;
          const desc = (i.description || "").toLowerCase();
          if (desc.startsWith("collaboration") || desc === "prise en charge") return false;
          return true;
        });
        const intervCount = realInterv.length;
        const intervMinutes = (interv ?? []).reduce(
          (acc, i: any) => acc + diffMinutes(i.date_debut, i.date_fin ?? endTs),
          0,
        );
        const closedCount = closedTickets?.length ?? 0;
        const downtime = (closedTickets ?? []).reduce(
          (acc, t: any) => acc + Number(t.temps_arret_minutes || 0),
          0,
        );
        const ticketIntervMinutes = (closedTickets ?? []).reduce(
          (acc, t: any) => acc + Number(t.temps_intervention_minutes || 0),
          0,
        );
        // Use ticket-recorded intervention time when available, fallback to computed
        const totalInterv = ticketIntervMinutes > 0 ? ticketIntervMinutes : intervMinutes;

        if (cancelled) return;
        setStats({
          loading: false,
          primary: { label: "Interventions", value: intervCount, hint: fmtMinutes(totalInterv) },
          secondary: { label: "Tickets clôturés", value: closedCount },
          tertiary: { label: "Temps d'arrêt", value: fmtMinutes(downtime) },
          extras: [
            { label: "Temps d'intervention", value: fmtMinutes(totalInterv) },
            { label: "MTTR moy.", value: closedCount > 0 ? fmtMinutes(totalInterv / closedCount) : "—" },
          ],
        });
      } else {
        const [{ data: checks }, { count: ncs }] = await Promise.all([
          supabase
            .from("quality_checks" as any)
            .select("is_conform, status")
            .eq("quality_shift_id", sessionId),
          supabase
            .from("quality_non_conformities" as any)
            .select("id", { count: "exact", head: true })
            .eq("quality_shift_id", sessionId),
        ]);
        // Business rule: exclude rejected checks from the conformity rate
        const valid = (checks ?? []).filter((c: any) => c.status !== "rejected");
        const total = valid.length;
        const nonConf = valid.filter((c: any) => c.is_conform === false).length;
        const conform = total - nonConf;
        const rate = total > 0 ? Math.round((conform / total) * 100) : null;

        if (cancelled) return;
        setStats({
          loading: false,
          primary: { label: "Contrôles", value: checks?.length ?? 0, hint: `${total} validés` },
          secondary: { label: "Conformité", value: rate === null ? "—" : `${rate}%`, hint: `${conform}/${total}` },
          tertiary: { label: "NC", value: ncs ?? 0 },
          extras: [
            { label: "Taux de conformité", value: rate === null ? "—" : `${rate}%` },
            { label: "Non-conformes", value: nonConf },
          ],
        });
      }
    }

    load();

    const tables =
      kind === "production"
        ? ["production_declarations", "production_stops", "tickets"]
        : kind === "maintenance"
          ? ["interventions", "tickets"]
          : ["quality_checks", "quality_non_conformities"];

    const channels = tables.map((tbl) =>
      supabase
        .channel(`stats-${kind}-${sessionId}-${tbl}`)
        .on("postgres_changes" as any, { event: "*", schema: "public", table: tbl }, () => load())
        .subscribe(),
    );

    return () => {
      cancelled = true;
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [kind, sessionId]);

  return stats;
}
