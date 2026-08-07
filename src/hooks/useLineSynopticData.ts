import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type EntityKind = "machine" | "equipement" | "organe";

export interface MachineRow {
  id: string;
  code: string;
  designation: string;
  statut: string;
  criticite: string;
  criticite_maintenance: string;
  role_fonctionnel: string;
  impact_ligne: string;
  disponibilite_pdr: string;
  marque?: string | null;
  modele?: string | null;
  sort_order: number;
}

export interface EquipementRow {
  id: string;
  code: string;
  designation: string;
  type: string;
  statut: string;
  criticite: string;
  role_fonctionnel: string;
  machine_id: string | null;
  line_id: string | null;
  criticite_maintenance?: string | null;
}

export interface OrganeRow {
  id: string;
  code: string;
  designation: string;
  type: string;
  statut: string;
  criticite: string;
  machine_id: string | null;
  equipement_id: string | null;
}

export interface TicketRow {
  id: string;
  numero: string;
  statut: string;
  priorite: string;
  description: string;
  machine_id: string | null;
  equipement_id: string | null;
  organe_id: string | null;
  heure_declaration: string;
}

export interface PreventivePlanRow {
  id: string;
  title: string;
  frequence: string;
  prochaine_echeance: string | null;
  derniere_execution: string | null;
  statut_plan: string;
  is_active: boolean;
  machine_id: string | null;
  equipement_id: string | null;
  organe_id: string | null;
}

export interface PdrLinkRow {
  id: string;
  pdr_id: string;
  entity_type: string;
  entity_id: string;
  quantite_recommandee: number;
  pdr: {
    id: string;
    reference: string;
    designation: string;
    stock_actuel: number;
    stock_min: number;
    stock_securite: number;
    statut_pdr: string;
  } | null;
}

export interface EntityCounters {
  ticketsOpen: number;
  ticketsCritical: number;
  preventiveOverdue: number;
  pdrCritical: number;
  pdrRupture: number;
}

export interface LineSynopticData {
  loading: boolean;
  error: string | null;
  line: any;
  machines: MachineRow[];
  equipements: EquipementRow[];
  organes: OrganeRow[];
  tickets: TicketRow[];
  preventivePlans: PreventivePlanRow[];
  pdrLinks: PdrLinkRow[];
  imageMap: Record<string, string>;
  countersByEntity: Record<string, EntityCounters>;
  refetch: () => void;
}

const OPEN_TICKET_STATUSES = ["ouvert", "pris_en_charge", "en_cours"] as const;
const CRITICAL_PRIORITIES = ["critique", "haute"];

function isPdrCritical(pdr: PdrLinkRow["pdr"]) {
  if (!pdr) return false;
  return pdr.stock_actuel <= (pdr.stock_securite || pdr.stock_min || 0) && pdr.stock_actuel > 0;
}
function isPdrRupture(pdr: PdrLinkRow["pdr"]) {
  if (!pdr) return false;
  return pdr.stock_actuel <= 0;
}

export function useLineSynopticData(lineId: string | undefined): LineSynopticData {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [line, setLine] = useState<any>(null);
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [equipements, setEquipements] = useState<EquipementRow[]>([]);
  const [organes, setOrganes] = useState<OrganeRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [preventivePlans, setPreventivePlans] = useState<PreventivePlanRow[]>([]);
  const [pdrLinks, setPdrLinks] = useState<PdrLinkRow[]>([]);
  const [imageMap, setImageMap] = useState<Record<string, string>>({});
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!lineId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [lRes, mlaRes, eqRes] = await Promise.all([
          supabase.from("production_lines").select("*").eq("id", lineId).single(),
          supabase
            .from("machine_line_assignments")
            .select(
              "sort_order, priority, machines(id, code, designation, statut, criticite, criticite_maintenance, role_fonctionnel, impact_ligne, disponibilite_pdr, marque, modele)"
            )
            .eq("line_id", lineId)
            .order("sort_order"),
          supabase
            .from("equipements")
            .select("id, code, designation, type, statut, criticite, criticite_maintenance, role_fonctionnel, machine_id, line_id")
            .eq("line_id", lineId)
            .order("code"),
        ]);

        if (cancelled) return;
        if (lRes.error) throw lRes.error;
        const ms: MachineRow[] = (mlaRes.data || [])
          .map((r: any) => (r.machines ? { ...r.machines, sort_order: r.sort_order } : null))
          .filter(Boolean);
        const eqs: EquipementRow[] = eqRes.data || [];

        const machineIds = ms.map((m) => m.id);
        const equipementIds = eqs.map((e) => e.id);

        // Now fetch dependent entities in parallel
        const [orgRes, tkRes, ppRes, pdrRes] = await Promise.all([
          // Organes attached to any machine OR equipement of the line
          machineIds.length || equipementIds.length
            ? supabase
                .from("organes")
                .select("id, code, designation, type, statut, criticite, machine_id, equipement_id, sort_order")
                .or(
                  [
                    machineIds.length ? `machine_id.in.(${machineIds.join(",")})` : "",
                    equipementIds.length ? `equipement_id.in.(${equipementIds.join(",")})` : "",
                  ]
                    .filter(Boolean)
                    .join(",")
                )
                .eq("is_active", true)
                .order("sort_order")
            : Promise.resolve({ data: [], error: null } as any),
          // Open tickets on machines/equipements/organes (we'll filter organes after)
          machineIds.length || equipementIds.length
            ? supabase
                .from("tickets")
                .select("id, numero, statut, priorite, description, machine_id, equipement_id, organe_id, heure_declaration")
                .in("statut", OPEN_TICKET_STATUSES)
                .or(
                  [
                    machineIds.length ? `machine_id.in.(${machineIds.join(",")})` : "",
                    equipementIds.length ? `equipement_id.in.(${equipementIds.join(",")})` : "",
                  ]
                    .filter(Boolean)
                    .join(",")
                )
            : Promise.resolve({ data: [], error: null } as any),
          // Active preventive plans
          machineIds.length || equipementIds.length
            ? supabase
                .from("preventive_plans")
                .select(
                  "id, title, frequence, prochaine_echeance, derniere_execution, statut_plan, is_active, machine_id, equipement_id, organe_id"
                )
                .eq("is_active", true)
                .or(
                  [
                    machineIds.length ? `machine_id.in.(${machineIds.join(",")})` : "",
                    equipementIds.length ? `equipement_id.in.(${equipementIds.join(",")})` : "",
                  ]
                    .filter(Boolean)
                    .join(",")
                )
            : Promise.resolve({ data: [], error: null } as any),
          // PDR links for machines + equipements
          machineIds.length || equipementIds.length
            ? supabase
                .from("pdr_entity_links")
                .select(
                  "id, pdr_id, entity_type, entity_id, quantite_recommandee, pdr:pdr_id(id, reference, designation, stock_actuel, stock_min, stock_securite, statut_pdr)"
                )
                .or(
                  [
                    machineIds.length ? `and(entity_type.eq.machine,entity_id.in.(${machineIds.join(",")}))` : "",
                    equipementIds.length ? `and(entity_type.eq.equipement,entity_id.in.(${equipementIds.join(",")}))` : "",
                  ]
                    .filter(Boolean)
                    .join(",")
                )
            : Promise.resolve({ data: [], error: null } as any),
        ]);

        if (cancelled) return;

        const orgs: OrganeRow[] = orgRes.data || [];
        const organeIds = orgs.map((o) => o.id);

        // Extra fetch: tickets + plans + pdr links for organes
        const [orgTkRes, orgPpRes, orgPdrRes] = await Promise.all([
          organeIds.length
            ? supabase
                .from("tickets")
                .select("id, numero, statut, priorite, description, machine_id, equipement_id, organe_id, heure_declaration")
                .in("statut", OPEN_TICKET_STATUSES)
                .in("organe_id", organeIds)
            : Promise.resolve({ data: [], error: null } as any),
          organeIds.length
            ? supabase
                .from("preventive_plans")
                .select(
                  "id, title, frequence, prochaine_echeance, derniere_execution, statut_plan, is_active, machine_id, equipement_id, organe_id"
                )
                .eq("is_active", true)
                .in("organe_id", organeIds)
            : Promise.resolve({ data: [], error: null } as any),
          organeIds.length
            ? supabase
                .from("pdr_entity_links")
                .select(
                  "id, pdr_id, entity_type, entity_id, quantite_recommandee, pdr:pdr_id(id, reference, designation, stock_actuel, stock_min, stock_securite, statut_pdr)"
                )
                .eq("entity_type", "organe")
                .in("entity_id", organeIds)
            : Promise.resolve({ data: [], error: null } as any),
        ]);

        if (cancelled) return;

        // Merge and deduplicate
        const allTickets: TicketRow[] = [
          ...((tkRes.data || []) as TicketRow[]),
          ...((orgTkRes.data || []) as TicketRow[]),
        ];
        const dedupTickets = Array.from(new Map(allTickets.map((t) => [t.id, t])).values());

        const allPlans: PreventivePlanRow[] = [
          ...((ppRes.data || []) as PreventivePlanRow[]),
          ...((orgPpRes.data || []) as PreventivePlanRow[]),
        ];
        const dedupPlans = Array.from(new Map(allPlans.map((p) => [p.id, p])).values());

        const allPdr: PdrLinkRow[] = [
          ...((pdrRes.data || []) as any),
          ...((orgPdrRes.data || []) as any),
        ];
        const dedupPdr = Array.from(new Map(allPdr.map((p) => [p.id, p])).values());

        // Images: machines + equipements + organes
        const allEntityIds = [
          ...machineIds.map((id) => ["machine", id] as const),
          ...equipementIds.map((id) => ["equipement", id] as const),
          ...organeIds.map((id) => ["organe", id] as const),
        ];
        const imgMap: Record<string, string> = {};
        for (const type of ["machine", "equipement", "organe"] as const) {
          const ids = allEntityIds.filter(([t]) => t === type).map(([, id]) => id);
          if (ids.length) {
            const { data } = await supabase
              .from("entity_images")
              .select("entity_id, image_url, is_primary, sort_order")
              .eq("entity_type", type)
              .in("entity_id", ids)
              .order("is_primary", { ascending: false })
              .order("sort_order");
            (data || []).forEach((row: any) => {
              const key = `${type}:${row.entity_id}`;
              if (!imgMap[key]) imgMap[key] = row.image_url;
            });
          }
        }

        setLine(lRes.data);
        setMachines(ms);
        setEquipements(eqs);
        setOrganes(orgs);
        setTickets(dedupTickets);
        setPreventivePlans(dedupPlans);
        setPdrLinks(dedupPdr);
        setImageMap(imgMap);
        setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Erreur de chargement");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lineId, tick]);

  const countersByEntity = useMemo<Record<string, EntityCounters>>(() => {
    const map: Record<string, EntityCounters> = {};
    const ensure = (key: string) => {
      if (!map[key])
        map[key] = { ticketsOpen: 0, ticketsCritical: 0, preventiveOverdue: 0, pdrCritical: 0, pdrRupture: 0 };
      return map[key];
    };
    const now = Date.now();
    for (const t of tickets) {
      const isCrit = CRITICAL_PRIORITIES.includes(t.priorite);
      if (t.machine_id) {
        const c = ensure(`machine:${t.machine_id}`);
        c.ticketsOpen++;
        if (isCrit) c.ticketsCritical++;
      }
      if (t.equipement_id) {
        const c = ensure(`equipement:${t.equipement_id}`);
        c.ticketsOpen++;
        if (isCrit) c.ticketsCritical++;
      }
      if (t.organe_id) {
        const c = ensure(`organe:${t.organe_id}`);
        c.ticketsOpen++;
        if (isCrit) c.ticketsCritical++;
      }
    }
    for (const p of preventivePlans) {
      const overdue = !!p.prochaine_echeance && new Date(p.prochaine_echeance).getTime() < now;
      if (!overdue) continue;
      if (p.machine_id) ensure(`machine:${p.machine_id}`).preventiveOverdue++;
      if (p.equipement_id) ensure(`equipement:${p.equipement_id}`).preventiveOverdue++;
      if (p.organe_id) ensure(`organe:${p.organe_id}`).preventiveOverdue++;
    }
    for (const link of pdrLinks) {
      const key = `${link.entity_type}:${link.entity_id}`;
      const c = ensure(key);
      if (isPdrRupture(link.pdr)) c.pdrRupture++;
      else if (isPdrCritical(link.pdr)) c.pdrCritical++;
    }
    return map;
  }, [tickets, preventivePlans, pdrLinks]);

  return {
    loading,
    error,
    line,
    machines,
    equipements,
    organes,
    tickets,
    preventivePlans,
    pdrLinks,
    imageMap,
    countersByEntity,
    refetch,
  };
}
