import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ResolvedPeriod } from "@/lib/directionWidgets";

export interface Option {
  value: string;
  label: string;
}

/**
 * Options de filtres contextuels, restreintes aux données réellement
 * présentes sur la période sélectionnée (filtres dynamiques et cohérents).
 */
export function useDashboardFilterOptions(period: ResolvedPeriod) {
  const from = period.from.toISOString();
  const to = period.to.toISOString();

  return useQuery({
    queryKey: ["direction_filter_options", from, to],
    staleTime: 120_000,
    queryFn: async () => {
      const [lines, products, suppliers, campaigns, ofs, tickets] = await Promise.all([
        supabase.from("production_lines").select("id, code, designation").eq("is_active", true),
        supabase.from("products").select("id, code, designation").eq("is_active", true).limit(500),
        supabase.from("reception_suppliers").select("id, nom").eq("actif", true).limit(500),
        supabase
          .from("inventory_campaigns")
          .select("id, code, label")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("ordres_fabrication")
          .select("line_id, product_id")
          .gte("created_at", from)
          .lte("created_at", to),
        supabase
          .from("reception_tickets")
          .select("supplier_id, product_id, campaign_id")
          .gte("created_at", from)
          .lte("created_at", to),
      ]);

      const usedLines = new Set((ofs.data ?? []).map((r: any) => r.line_id).filter(Boolean));
      const usedProducts = new Set((ofs.data ?? []).map((r: any) => r.product_id).filter(Boolean));
      const usedSuppliers = new Set(
        (tickets.data ?? []).map((r: any) => r.supplier_id).filter(Boolean),
      );
      const usedCampaigns = new Set(
        (tickets.data ?? []).map((r: any) => r.campaign_id).filter(Boolean),
      );

      const keep = <T extends { id: string }>(rows: T[] | null, used: Set<any>) => {
        const list = rows ?? [];
        const filtered = list.filter((r) => used.has(r.id));
        return filtered.length ? filtered : list;
      };

      return {
        lines: keep(lines.data as any, usedLines).map((r: any) => ({
          value: r.id,
          label: `${r.code ?? ""} ${r.designation ?? ""}`.trim() || r.id,
        })) as Option[],
        products: keep(products.data as any, usedProducts).map((r: any) => ({
          value: r.id,
          label: `${r.code ?? ""} ${r.designation ?? ""}`.trim() || r.id,
        })) as Option[],
        suppliers: keep(suppliers.data as any, usedSuppliers).map((r: any) => ({
          value: r.id,
          label: r.nom ?? r.id,
        })) as Option[],
        campaigns: keep(campaigns.data as any, usedCampaigns).map((r: any) => ({
          value: r.id,
          label: `${r.code ?? ""} ${r.label ?? ""}`.trim() || r.id,
        })) as Option[],
      };
    },
  });
}
