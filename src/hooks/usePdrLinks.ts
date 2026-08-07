import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PdrEntityType = "machine" | "equipement" | "organe";

export interface PdrEntityLink {
  id: string;
  pdr_id: string;
  entity_type: PdrEntityType;
  entity_id: string;
  quantite_recommandee: number;
  commentaire: string | null;
  created_at: string;
}

/** Links for a given PDR (all assets linked to it). */
export function usePdrLinksByPdr(pdrId?: string) {
  const [links, setLinks] = useState<PdrEntityLink[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!pdrId) return;
    setLoading(true);
    const { data } = await supabase
      .from("pdr_entity_links" as any)
      .select("*")
      .eq("pdr_id", pdrId)
      .order("created_at", { ascending: false });
    setLinks((data as any) || []);
    setLoading(false);
  }, [pdrId]);

  useEffect(() => { reload(); }, [reload]);

  return { links, loading, reload };
}

/** PDRs linked to a given asset (machine | equipement | organe). */
export function usePdrLinksByEntity(entityType?: PdrEntityType, entityId?: string) {
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!entityType || !entityId) return;
    setLoading(true);
    const { data } = await supabase
      .from("pdr_entity_links" as any)
      .select("*, pdr(*)")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId);
    setLinks((data as any) || []);
    setLoading(false);
  }, [entityType, entityId]);

  useEffect(() => { reload(); }, [reload]);

  return { links, loading, reload };
}

export async function linkPdrToEntity(
  pdrId: string,
  entityType: PdrEntityType,
  entityId: string,
  quantite_recommandee = 1,
  commentaire = "",
) {
  return supabase.from("pdr_entity_links" as any).insert({
    pdr_id: pdrId, entity_type: entityType, entity_id: entityId,
    quantite_recommandee, commentaire,
  } as any);
}

export async function unlinkPdr(linkId: string) {
  return supabase.from("pdr_entity_links" as any).delete().eq("id", linkId);
}
