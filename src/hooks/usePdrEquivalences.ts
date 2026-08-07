import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type EquivalenceType = "equivalent" | "compatible" | "remplacement" | "depannage";
export type ValidationStatus = "non_valide" | "valide" | "rejete";

export interface PdrEquivalence {
  id: string;
  pdr_id: string;
  equivalent_pdr_id: string | null;
  external_reference: string | null;
  manufacturer: string | null;
  brand: string | null;
  equivalence_type: EquivalenceType;
  validation_status: ValidationStatus;
  validated_by: string | null;
  validated_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  equivalent_pdr?: { id: string; reference: string; designation: string } | null;
}

export function usePdrEquivalences(pdrId?: string) {
  const [items, setItems] = useState<PdrEquivalence[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const reload = useCallback(async () => {
    if (!pdrId) return;
    setLoading(true);
    const { data } = await supabase
      .from("pdr_equivalences" as any)
      .select("*, equivalent_pdr:pdr!pdr_equivalences_equivalent_pdr_id_fkey(id, reference, designation)")
      .eq("pdr_id", pdrId)
      .order("created_at", { ascending: false });
    setItems((data as any) || []);
    setLoading(false);
  }, [pdrId]);

  useEffect(() => { reload(); }, [reload]);

  const add = async (payload: Partial<PdrEquivalence>) => {
    if (!pdrId) return { error: new Error("pdr_id required") };
    return supabase.from("pdr_equivalences" as any).insert({
      pdr_id: pdrId,
      equivalent_pdr_id: payload.equivalent_pdr_id || null,
      external_reference: payload.external_reference || null,
      manufacturer: payload.manufacturer || null,
      brand: payload.brand || null,
      equivalence_type: payload.equivalence_type || "equivalent",
      notes: payload.notes || "",
      created_by: user?.id || null,
    } as any);
  };

  const validate = async (id: string, status: ValidationStatus) => {
    return supabase.from("pdr_equivalences" as any).update({
      validation_status: status,
      validated_by: status === "non_valide" ? null : user?.id || null,
      validated_at: status === "non_valide" ? null : new Date().toISOString(),
      updated_by: user?.id || null,
    } as any).eq("id", id);
  };

  const remove = async (id: string) => {
    return supabase.from("pdr_equivalences" as any).delete().eq("id", id);
  };

  return { items, loading, reload, add, validate, remove };
}
