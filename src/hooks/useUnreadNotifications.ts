import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UnreadNotification {
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
  action_url: string | null;
  is_critical: boolean;
}

export function useUnreadNotifications(limit = 10) {
  const { user } = useAuth();
  const [items, setItems] = useState<UnreadNotification[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // Recent notifications (any status) for the bell preview
    const { data } = await supabase
      .from("notifications")
      .select("id,created_at,title,message,notification_type,module,entity_type,entity_id,entity_code,entity_label,severity,status,action_url,is_critical")
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(limit);
    setItems((data as unknown as UnreadNotification[]) ?? []);

    const { count: c } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("status", "unread");
    setCount(c ?? 0);
    setLoading(false);
  }, [user, limit]);

  useEffect(() => {
    void fetchData();
    if (!user) return;
    const ch = supabase
      .channel("notifications_bell")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => { void fetchData(); }
      )
      .subscribe();
    const interval = window.setInterval(() => { void fetchData(); }, 60000);
    return () => {
      supabase.removeChannel(ch);
      window.clearInterval(interval);
    };
  }, [user, fetchData]);

  return { items, count, loading, refetch: fetchData };
}
