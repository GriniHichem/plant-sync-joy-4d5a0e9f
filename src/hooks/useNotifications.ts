import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface NotificationFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: "unread" | "read" | "archived" | "all";
  module?: string;
  notification_type?: string;
  severity?: string;
  recipient_user_id?: string;
  recipient_role?: string;
  entity_code?: string;
  search?: string;
}

export interface NotificationRow {
  id: string;
  created_at: string;
  title: string;
  message: string;
  notification_type: string;
  module: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_code: string | null;
  entity_label: string | null;
  severity: "info" | "low" | "medium" | "high" | "critical";
  status: "unread" | "read" | "archived";
  recipient_user_id: string | null;
  recipient_role: string | null;
  triggered_by_user_id: string | null;
  source: string;
  action_url: string | null;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  is_critical: boolean;
}

const PAGE_SIZE = 20;

export function useNotifications(filters: NotificationFilters, page: number) {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom);
    if (filters.dateTo) q = q.lte("created_at", filters.dateTo);
    if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
    if (filters.module) q = q.eq("module", filters.module);
    if (filters.notification_type) q = q.eq("notification_type", filters.notification_type);
    if (filters.severity) q = q.eq("severity", filters.severity as "info"|"low"|"medium"|"high"|"critical");
    if (filters.recipient_user_id) q = q.eq("recipient_user_id", filters.recipient_user_id);
    if (filters.recipient_role) q = q.eq("recipient_role", filters.recipient_role);
    if (filters.entity_code) q = q.ilike("entity_code", `%${filters.entity_code}%`);
    if (filters.search) {
      const s = filters.search.replace(/[%,]/g, "");
      q = q.or(
        `title.ilike.%${s}%,message.ilike.%${s}%,module.ilike.%${s}%,notification_type.ilike.%${s}%,entity_code.ilike.%${s}%,entity_label.ilike.%${s}%`
      );
    }

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, count } = await q.range(from, to);
    setRows((data as unknown as NotificationRow[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [filters, page]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  return { rows, total, loading, pageSize: PAGE_SIZE, refetch: fetchData };
}
