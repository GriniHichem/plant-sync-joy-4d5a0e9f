import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarRange, Filter, RotateCcw, Star } from "lucide-react";
import { PERIOD_OPTIONS, describeFilters, resolveCtx, type DashboardFilters } from "@/lib/direction/filters";

const NONE = "__none__";

interface Props {
  value: DashboardFilters;
  onChange: (f: DashboardFilters) => void;
  /** Filtres contextuels à proposer (déduits des widgets du dashboard). */
  contexts?: ("line" | "product" | "supplier" | "campaign")[];
  favorites?: { name: string; filters: DashboardFilters }[];
  onSaveFavorite?: () => void;
  onApplyFavorite?: (f: DashboardFilters) => void;
  onDeleteFavorite?: (name: string) => void;
}

export function DirectionFilterBar({
  value,
  onChange,
  contexts = ["line", "product", "supplier", "campaign"],
  favorites = [],
  onSaveFavorite,
  onApplyFavorite,
  onDeleteFavorite,
}: Props) {
  const ctx = useMemo(() => resolveCtx(value), [value]);

  const { data: refs } = useQuery({
    queryKey: ["direction_filter_refs"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [lines, products, suppliers, campaigns] = await Promise.all([
        supabase.from("production_lines").select("id, designation").eq("is_active", true).order("designation"),
        supabase.from("products").select("id, designation").eq("is_active", true).order("designation").limit(500),
        supabase.from("reception_suppliers").select("id, nom").eq("actif", true).order("nom").limit(500),
        supabase.from("reception_campaigns").select("id, libelle").order("date_debut", { ascending: false }).limit(100),
      ]);
      return {
        lines: (lines.data ?? []) as any[],
        products: (products.data ?? []) as any[],
        suppliers: (suppliers.data ?? []) as any[],
        campaigns: (campaigns.data ?? []) as any[],
      };
    },
  });

  // Filtres dynamiques : identifiants réellement présents sur la période (réception).
  const { data: seen } = useQuery({
    queryKey: ["direction_filter_seen", ctx.fromDate, ctx.toDate],
    staleTime: 60_000,
    enabled: contexts.includes("supplier") || contexts.includes("campaign"),
    queryFn: async () => {
      const { data } = await supabase
        .from("v_reception_global" as any)
        .select("supplier_id, campaign_id, product_id")
        .gte("date_ticket", ctx.fromDate)
        .lte("date_ticket", ctx.toDate)
        .limit(5000);
      const rows = (data ?? []) as any[];
      return {
        suppliers: new Set(rows.map((r) => r.supplier_id).filter(Boolean)),
        campaigns: new Set(rows.map((r) => r.campaign_id).filter(Boolean)),
      };
    },
  });

  const set = (patch: Partial<DashboardFilters>) => onChange({ ...value, ...patch });
  const activeCount = [value.lineId, value.productId, value.supplierId, value.campaignId].filter(Boolean).length;

  const renderSelect = (
    key: "lineId" | "productId" | "supplierId" | "campaignId",
    label: string,
    options: { id: string; label: string; disabled?: boolean }[],
  ) => (
    <div className="min-w-[150px] flex-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Select
        value={(value as any)[key] || NONE}
        onValueChange={(v) => set({ [key]: v === NONE ? undefined : v } as any)}
      >
        <SelectTrigger className="h-10"><SelectValue placeholder="Tous" /></SelectTrigger>
        <SelectContent className="max-h-64">
          <SelectItem value={NONE}>Tous</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id} disabled={o.disabled}>
              {o.label}{o.disabled ? " (hors période)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="rounded-lg border bg-card/60 backdrop-blur p-2.5 space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <CalendarRange className="h-4 w-4 text-muted-foreground shrink-0" />
        {PERIOD_OPTIONS.filter((p) => p.key !== "custom").map((p) => (
          <Button
            key={p.key}
            size="sm"
            variant={value.period === p.key ? "default" : "outline"}
            className="h-8 px-2.5 text-xs"
            onClick={() => set({ period: p.key })}
          >
            {p.short}
          </Button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant={value.period === "custom" ? "default" : "outline"} className="h-8 px-2.5 text-xs">
              Perso
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-2 pointer-events-auto" align="start">
            <div>
              <Label className="text-xs">Du</Label>
              <Input type="date" className="h-10" value={value.from ?? ""} onChange={(e) => set({ period: "custom", from: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Au</Label>
              <Input type="date" className="h-10" value={value.to ?? ""} onChange={(e) => set({ period: "custom", to: e.target.value })} />
            </div>
          </PopoverContent>
        </Popover>

        <div className="mx-1 h-5 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <Switch id="cmp" checked={!!value.compare} onCheckedChange={(c) => set({ compare: c })} />
          <Label htmlFor="cmp" className="text-xs cursor-pointer">Comparer</Label>
        </div>

        <div className="flex-1" />
        <Badge variant="secondary" className="text-[11px]">{describeFilters(value)}</Badge>
        {activeCount > 0 && (
          <Badge variant="outline" className="text-[11px] gap-1"><Filter className="h-3 w-3" />{activeCount}</Badge>
        )}
        {onSaveFavorite && (
          <Button size="sm" variant="ghost" className="h-8" onClick={onSaveFavorite} title="Enregistrer ces filtres">
            <Star className="h-4 w-4" />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-8"
          onClick={() => onChange({ period: "7d" })}
          title="Réinitialiser les filtres"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {contexts.includes("line") &&
          renderSelect("lineId", "Ligne", (refs?.lines ?? []).map((l) => ({ id: l.id, label: l.designation })))}
        {contexts.includes("product") &&
          renderSelect("productId", "Produit", (refs?.products ?? []).map((p) => ({ id: p.id, label: p.designation })))}
        {contexts.includes("supplier") &&
          renderSelect(
            "supplierId",
            "Fournisseur",
            (refs?.suppliers ?? []).map((s) => ({
              id: s.id,
              label: s.nom,
              disabled: seen ? !seen.suppliers.has(s.id) : false,
            })),
          )}
        {contexts.includes("campaign") &&
          renderSelect(
            "campaignId",
            "Campagne",
            (refs?.campaigns ?? []).map((c) => ({
              id: c.id,
              label: c.libelle,
              disabled: seen ? !seen.campaigns.has(c.id) : false,
            })),
          )}
      </div>

      {favorites.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5 border-t">
          <span className="text-[11px] text-muted-foreground">Favoris :</span>
          {favorites.map((f) => (
            <Badge
              key={f.name}
              variant="outline"
              className="cursor-pointer gap-1 text-[11px] hover:bg-accent"
              onClick={() => onApplyFavorite?.(f.filters)}
            >
              {f.name}
              {onDeleteFavorite && (
                <span
                  className="ml-0.5 text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDeleteFavorite(f.name); }}
                >
                  ×
                </span>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
