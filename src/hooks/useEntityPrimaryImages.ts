import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches primary images for a set of entity IDs of a given type.
 * Returns a map: entityId → image_url
 */
export function useEntityPrimaryImages(
  entityType: string,
  entityIds: string[]
) {
  const [imageMap, setImageMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const uniqueIds = [...new Set(entityIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      setImageMap({});
      return;
    }

    supabase
      .from("entity_images")
      .select("entity_id, image_url, is_primary, sort_order")
      .eq("entity_type", entityType)
      .in("entity_id", uniqueIds)
      .order("is_primary", { ascending: false })
      .order("sort_order")
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data || []).forEach((row) => {
          // Keep only the first (primary) per entity
          if (!map[row.entity_id]) {
            map[row.entity_id] = row.image_url;
          }
        });
        setImageMap(map);
      });
  }, [entityType, entityIds.join(",")]);

  return imageMap;
}

