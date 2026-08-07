import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_MAX_MB = 5;
const cache: Record<string, number> = {};

export function useImageMaxSize(entityType: string) {
  const key = `image_max_size_${entityType}`;
  const [maxSizeMb, setMaxSizeMb] = useState(cache[key] ?? DEFAULT_MAX_MB);

  useEffect(() => {
    if (cache[key] !== undefined) {
      setMaxSizeMb(cache[key]);
      return;
    }
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle()
      .then(({ data }) => {
        const val = data ? Number(data.value) : DEFAULT_MAX_MB;
        const mb = isNaN(val) || val <= 0 ? DEFAULT_MAX_MB : val;
        cache[key] = mb;
        setMaxSizeMb(mb);
      });
  }, [key]);

  return {
    maxSizeMb,
    maxSizeBytes: maxSizeMb * 1024 * 1024,
  };
}
