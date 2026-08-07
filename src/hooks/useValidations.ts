import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ValidationRequest, ValidationStatus, ValidationEnforcement, ValidationPriority } from "@/lib/validation";

export interface ValidationFiltersState {
  date_from?: string;
  date_to?: string;
  status?: ValidationStatus | "all";
  module?: string | "all";
  request_type?: string | "all";
  priority?: ValidationPriority | "all";
  enforcement?: ValidationEnforcement | "all";
  submitted_by?: string | "all";
  search?: string;
}

export function useValidations(filters: ValidationFiltersState) {
  const [items, setItems] = useState<ValidationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    let q = supabase
      .from("validation_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (filters.date_from) q = q.gte("created_at", filters.date_from);
    if (filters.date_to) q = q.lte("created_at", filters.date_to);
    if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
    if (filters.module && filters.module !== "all") q = q.eq("module", filters.module);
    if (filters.request_type && filters.request_type !== "all") q = q.eq("request_type", filters.request_type);
    if (filters.priority && filters.priority !== "all") q = q.eq("priority", filters.priority);
    if (filters.enforcement && filters.enforcement !== "all") q = q.eq("enforcement", filters.enforcement);
    if (filters.submitted_by && filters.submitted_by !== "all") q = q.eq("submitted_by_user_id", filters.submitted_by);
    if (filters.search && filters.search.trim().length > 1) {
      const s = filters.search.trim().replace(/[%,]/g, "");
      q = q.or(
        [
          `title.ilike.%${s}%`,
          `description.ilike.%${s}%`,
          `justification.ilike.%${s}%`,
          `entity_code.ilike.%${s}%`,
          `entity_label.ilike.%${s}%`,
          `module.ilike.%${s}%`,
          `request_type.ilike.%${s}%`,
          `submitted_by_name.ilike.%${s}%`,
          `submitted_by_email.ilike.%${s}%`,
        ].join(",")
      );
    }

    const { data, error: e } = await q;
    if (e) setError(e.message);
    setItems((data as unknown as ValidationRequest[]) ?? []);
    setLoading(false);
  }, [filters]);

  useEffect(() => { void reload(); }, [reload]);

  return { items, loading, error, reload };
}

export interface ValidationKpis {
  pending: number;
  critical: number;
  approved_today: number;
  rejected: number;
  mine: number;
  stock: number;
  maintenance: number;
  production: number;
  pending_post_hoc: number;
  pending_blocking: number;
}

export function useValidationKpis(currentUserId: string | null) {
  const [kpis, setKpis] = useState<ValidationKpis>({
    pending: 0, critical: 0, approved_today: 0, rejected: 0,
    mine: 0, stock: 0, maintenance: 0, production: 0,
    pending_post_hoc: 0, pending_blocking: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("validation_requests")
        .select("status,priority,module,enforcement,submitted_by_user_id,validated_at")
        .limit(1000);
      const items = (data ?? []) as Array<{
        status: ValidationStatus; priority: ValidationPriority;
        module: string; enforcement: ValidationEnforcement;
        submitted_by_user_id: string | null; validated_at: string | null;
      }>;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const k: ValidationKpis = {
        pending: 0, critical: 0, approved_today: 0, rejected: 0,
        mine: 0, stock: 0, maintenance: 0, production: 0,
        pending_post_hoc: 0, pending_blocking: 0,
      };
      for (const i of items) {
        const isPending = i.status === "submitted" || i.status === "pending_post_hoc";
        if (isPending) k.pending++;
        if (isPending && i.priority === "critical") k.critical++;
        if (isPending && i.enforcement === "post_hoc") k.pending_post_hoc++;
        if (isPending && i.enforcement === "blocking") k.pending_blocking++;
        if (i.status === "rejected") k.rejected++;
        if ((i.status === "approved" || i.status === "applied") && i.validated_at && new Date(i.validated_at) >= today) k.approved_today++;
        if (currentUserId && i.submitted_by_user_id === currentUserId) k.mine++;
        if (i.module.startsWith("pdr")) k.stock++;
        if (["tickets", "interventions", "preventif", "machines", "equipements", "organes", "lignes"].includes(i.module)) k.maintenance++;
        if (["gpao", "consommations", "arrets", "of", "produits", "articles"].includes(i.module)) k.production++;
      }
      setKpis(k);
      setLoading(false);
    })();
  }, [currentUserId]);

  return { kpis, loading };
}
