import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ValidationPermission {
  view_own: boolean;
  view_all: boolean;
  submit: boolean;
  approve: boolean;
  reject: boolean;
  cancel: boolean;
  configure_rules: boolean;
  view_technical_details: boolean;
}

const EMPTY: ValidationPermission = {
  view_own: false, view_all: false, submit: false, approve: false,
  reject: false, cancel: false, configure_rules: false, view_technical_details: false,
};

export function useValidationPermissions() {
  const { roles } = useAuth();
  const [perm, setPerm] = useState<ValidationPermission>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roles || roles.length === 0) {
      setPerm(EMPTY);
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("validation_permissions")
        .select("*")
        .in("role", roles);
      if (data && data.length > 0) {
        const merged: ValidationPermission = { ...EMPTY };
        for (const row of data as unknown as ValidationPermission[]) {
          (Object.keys(merged) as Array<keyof ValidationPermission>).forEach((k) => {
            merged[k] = merged[k] || row[k];
          });
        }
        setPerm(merged);
      } else {
        setPerm(EMPTY);
      }
      setLoading(false);
    })();
  }, [roles]);

  return { ...perm, loading };
}
