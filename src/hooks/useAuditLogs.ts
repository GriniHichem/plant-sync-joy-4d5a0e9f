import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AuditLogRow {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  user_full_name: string | null;
  action: string | null;
  action_type: string | null;
  action_label: string | null;
  module: string | null;
  table_name: string | null;
  record_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  entity_code: string | null;
  entity_label: string | null;
  description: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_fields: string[] | null;
  ip_address: string | null;
  user_agent: string | null;
  status: string;
  severity: string;
  source: string;
  metadata: Record<string, unknown> | null;
  archived_at: string | null;
}

export interface AuditFilters {
  dateFrom?: string;        // ISO date YYYY-MM-DD
  dateTo?: string;          // ISO date YYYY-MM-DD (inclusive)
  userId?: string;
  module?: string;
  actionType?: string;
  status?: string;
  severity?: string;
  entityType?: string;
  entityCode?: string;
  source?: string;
  search?: string;          // global text search
  includeArchived?: boolean;
}

export interface UseAuditLogsOptions {
  filters: AuditFilters;
  page: number;
  pageSize: number;
}

export function useAuditLogs({ filters, page, pageSize }: UseAuditLogsOptions) {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const stableFilters = useMemo(() => JSON.stringify(filters), [filters]);

  const buildQuery = useCallback((countOnly = false) => {
    let q = supabase
      .from("audit_logs")
      .select("*", countOnly ? { count: "exact", head: true } : { count: "exact" });

    if (filters.dateFrom) q = q.gte("created_at", `${filters.dateFrom}T00:00:00.000Z`);
    if (filters.dateTo)   q = q.lte("created_at", `${filters.dateTo}T23:59:59.999Z`);
    if (filters.userId)   q = q.eq("user_id", filters.userId);
    if (filters.module)   q = q.eq("module", filters.module);
    if (filters.actionType) q = q.eq("action_type", filters.actionType);
    if (filters.status)   q = q.eq("status", filters.status);
    if (filters.severity) q = q.eq("severity", filters.severity);
    if (filters.entityType) q = q.eq("entity_type", filters.entityType);
    if (filters.entityCode) q = q.ilike("entity_code", `%${filters.entityCode}%`);
    if (filters.source)   q = q.eq("source", filters.source);
    if (!filters.includeArchived) q = q.is("archived_at", null);

    if (filters.search && filters.search.trim()) {
      const s = filters.search.trim().replace(/[%,]/g, "");
      q = q.or(
        [
          `description.ilike.%${s}%`,
          `user_email.ilike.%${s}%`,
          `user_full_name.ilike.%${s}%`,
          `module.ilike.%${s}%`,
          `action_type.ilike.%${s}%`,
          `action_label.ilike.%${s}%`,
          `entity_type.ilike.%${s}%`,
          `entity_code.ilike.%${s}%`,
          `entity_label.ilike.%${s}%`,
        ].join(",")
      );
    }

    return q;
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const from = page * pageSize;
    const to = from + pageSize - 1;
    buildQuery()
      .order("created_at", { ascending: false })
      .range(from, to)
      .then(({ data, count: c, error }) => {
        if (cancelled) return;
        if (error) { setError(error.message); setRows([]); setCount(0); }
        else { setRows((data ?? []) as unknown as AuditLogRow[]); setCount(c ?? 0); }
        setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableFilters, page, pageSize]);

  return { rows, count, loading, error };
}

/** Fetch ALL filtered rows in pages of 1000, for export. */
export async function fetchAllAuditLogs(filters: AuditFilters): Promise<AuditLogRow[]> {
  const all: AuditLogRow[] = [];
  const PAGE = 1000;
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = supabase.from("audit_logs").select("*").order("created_at", { ascending: false });
    if (filters.dateFrom) q = q.gte("created_at", `${filters.dateFrom}T00:00:00.000Z`);
    if (filters.dateTo)   q = q.lte("created_at", `${filters.dateTo}T23:59:59.999Z`);
    if (filters.userId)   q = q.eq("user_id", filters.userId);
    if (filters.module)   q = q.eq("module", filters.module);
    if (filters.actionType) q = q.eq("action_type", filters.actionType);
    if (filters.status)   q = q.eq("status", filters.status);
    if (filters.severity) q = q.eq("severity", filters.severity);
    if (filters.entityType) q = q.eq("entity_type", filters.entityType);
    if (filters.entityCode) q = q.ilike("entity_code", `%${filters.entityCode}%`);
    if (filters.source)   q = q.eq("source", filters.source);
    if (!filters.includeArchived) q = q.is("archived_at", null);
    if (filters.search && filters.search.trim()) {
      const s = filters.search.trim().replace(/[%,]/g, "");
      q = q.or([
        `description.ilike.%${s}%`,
        `user_email.ilike.%${s}%`,
        `user_full_name.ilike.%${s}%`,
        `entity_code.ilike.%${s}%`,
        `entity_label.ilike.%${s}%`,
      ].join(","));
    }
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as unknown as AuditLogRow[];
    all.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
    if (all.length > 100000) break; // safety guard
  }
  return all;
}

// =============================================
// KPI helpers — lightweight count queries
// =============================================

export interface AuditKpis {
  total: number;
  today: number;
  critical: number;
  denied: number;
  errors: number;
  loginsToday: number;
  sensitiveChanges: number;
  pdrStock: number;
}

export function useAuditKpis(refreshKey: number = 0) {
  const [kpis, setKpis] = useState<AuditKpis>({
    total: 0, today: 0, critical: 0, denied: 0,
    errors: 0, loginsToday: 0, sensitiveChanges: 0, pdrStock: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    // Use direct supabase calls per metric for clarity
    Promise.all([
      supabase.from("audit_logs").select("*", { count: "exact", head: true }).is("archived_at", null),
      supabase.from("audit_logs").select("*", { count: "exact", head: true }).is("archived_at", null).gte("created_at", todayIso),
      supabase.from("audit_logs").select("*", { count: "exact", head: true }).is("archived_at", null).eq("severity", "critical"),
      supabase.from("audit_logs").select("*", { count: "exact", head: true }).is("archived_at", null).eq("status", "denied"),
      supabase.from("audit_logs").select("*", { count: "exact", head: true }).is("archived_at", null).eq("action_type", "error"),
      supabase.from("audit_logs").select("*", { count: "exact", head: true }).is("archived_at", null).eq("action_type", "login").gte("created_at", todayIso),
      supabase.from("audit_logs").select("*", { count: "exact", head: true }).is("archived_at", null).in("action_type", ["role_change", "permission_change", "delete"]).gte("created_at", todayIso),
      supabase.from("audit_logs").select("*", { count: "exact", head: true }).is("archived_at", null).eq("module", "pdr_stock").gte("created_at", todayIso),
    ]).then((results) => {
      if (cancelled) return;
      const [total, today, critical, denied, errors, loginsToday, sensitive, pdr] = results;
      setKpis({
        total: total.count ?? 0,
        today: today.count ?? 0,
        critical: critical.count ?? 0,
        denied: denied.count ?? 0,
        errors: errors.count ?? 0,
        loginsToday: loginsToday.count ?? 0,
        sensitiveChanges: sensitive.count ?? 0,
        pdrStock: pdr.count ?? 0,
      });
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [refreshKey]);

  return { kpis, loading };
}
