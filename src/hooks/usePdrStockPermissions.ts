import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PdrStockPerms {
  can_view_suppliers: boolean;
  can_create_supplier: boolean;
  can_edit_supplier: boolean;
  can_delete_supplier: boolean;
  can_create_entry: boolean;
  can_create_exit: boolean;
  can_correct_stock: boolean;
  can_inventory: boolean;
  can_cancel_movement: boolean;
}

const EMPTY: PdrStockPerms = {
  can_view_suppliers: false,
  can_create_supplier: false,
  can_edit_supplier: false,
  can_delete_supplier: false,
  can_create_entry: false,
  can_create_exit: false,
  can_correct_stock: false,
  can_inventory: false,
  can_cancel_movement: false,
};

export function usePdrStockPermissions() {
  const { roles } = useAuth();
  const [perms, setPerms] = useState<PdrStockPerms>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (roles.length === 0) {
      setPerms(EMPTY);
      setLoading(false);
      return;
    }

    async function load() {
      const { data } = await supabase
        .from("pdr_stock_permissions")
        .select("*")
        .in("role", roles as string[]);

      if (data && data.length > 0) {
        const merged: PdrStockPerms = { ...EMPTY };
        for (const row of data) {
          merged.can_view_suppliers = merged.can_view_suppliers || row.can_view_suppliers;
          merged.can_create_supplier = merged.can_create_supplier || row.can_create_supplier;
          merged.can_edit_supplier = merged.can_edit_supplier || row.can_edit_supplier;
          merged.can_delete_supplier = merged.can_delete_supplier || row.can_delete_supplier;
          merged.can_create_entry = merged.can_create_entry || row.can_create_entry;
          merged.can_create_exit = merged.can_create_exit || row.can_create_exit;
          merged.can_correct_stock = merged.can_correct_stock || row.can_correct_stock;
          merged.can_inventory = merged.can_inventory || row.can_inventory;
          merged.can_cancel_movement = merged.can_cancel_movement || row.can_cancel_movement;
        }
        setPerms(merged);
      } else {
        setPerms(EMPTY);
      }
      setLoading(false);
    }

    load();
  }, [roles]);

  return { ...perms, loading };
}
