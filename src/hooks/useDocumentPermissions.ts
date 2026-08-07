import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DocPermissions {
  can_view: boolean;
  can_upload: boolean;
  can_download: boolean;
  can_delete: boolean;
  can_edit_metadata: boolean;
}

const EMPTY: DocPermissions = {
  can_view: false,
  can_upload: false,
  can_download: false,
  can_delete: false,
  can_edit_metadata: false,
};

export function useDocumentPermissions(entityType: string) {
  const { roles, user } = useAuth();
  const [perms, setPerms] = useState<DocPermissions>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || roles.length === 0) {
      setPerms(EMPTY);
      setLoading(false);
      return;
    }

    async function load() {
      const { data } = await supabase
        .from("document_permissions")
        .select("can_view, can_upload, can_download, can_delete, can_edit_metadata, role")
        .eq("entity_type", entityType)
        .in("role", roles as string[]);

      if (data && data.length > 0) {
        // Merge across roles with OR logic
        const merged: DocPermissions = { ...EMPTY };
        for (const row of data) {
          merged.can_view = merged.can_view || row.can_view;
          merged.can_upload = merged.can_upload || row.can_upload;
          merged.can_download = merged.can_download || row.can_download;
          merged.can_delete = merged.can_delete || row.can_delete;
          merged.can_edit_metadata = merged.can_edit_metadata || row.can_edit_metadata;
        }
        setPerms(merged);
      } else {
        setPerms(EMPTY);
      }
      setLoading(false);
    }

    load();
  }, [roles, entityType, user]);

  const logAction = useCallback(
    async (
      action: string,
      entityId: string,
      documentId: string | null,
      documentName: string,
      details?: Record<string, any>
    ) => {
      if (!user) return;
      await supabase.from("document_audit_logs").insert({
        user_id: user.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        document_id: documentId,
        document_name: documentName,
        details: details || {},
      } as any);
    },
    [user, entityType]
  );

  return { ...perms, loading, logAction };
}
