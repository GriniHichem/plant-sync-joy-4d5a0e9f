import { CalendarRange, Filter, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PERIOD_PRESETS,
  PeriodPresetId,
  SavedFilter,
  WidgetFilters,
} from "@/lib/directionWidgets";
import { Option } from "@/hooks/useDashboardFilterOptions";

const NONE = "__all__";

export interface FilterOptions {
  lines: Option[];
  products: Option[];
  suppliers: Option[];
  campaigns: Option[];
}

interface Props {
  period: PeriodPresetId;
  customFrom?: string | null;
  customTo?: string | null;
  filters: WidgetFilters;
  compare: boolean;
  options?: FilterOptions;
  savedFilters: SavedFilter[];
  onChange: (
    p: Partial<{
      period: PeriodPresetId;
      customFrom: string | null;
      customTo: string | null;
      filters: WidgetFilters;
      compare: boolean;
    }>,
  ) => void;
  onSaveFavorite?: () => void;
  onApplyFavorite?: (f: SavedFilter) => void;
  onRemoveFavorite?: (id: string) => void;
  compact?: boolean;
}

export function FilterSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  value?: string | null;
  options: Option[];
  onChange: (v: string | null) => void;
  placeholder?: string;
}) {
  return (
    <div className="min-w-[150px] flex-1 space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Select
        value={value ?? NONE}
        onValueChange={(v) => onChange(v === NONE ? null : v)}
        disabled={!options.length}
      >
        <SelectTrigger className="h-9">
          <SelectValue placeholder={placeholder ?? "Tous"} />
        </SelectTrigger>
        <SelectContent className="max-h-72 bg-popover">
          <SelectItem value={NONE}>Tous</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function DashboardFilters({
  period,
  customFrom,
  customTo,
  filters,
  compare,
  options,
  savedFilters,
  onChange,
  onSaveFavorite,
  onApplyFavorite,
  onRemoveFavorite,
}: Props) {
  const setFilter = (k: keyof WidgetFilters, v: string | null) =>
    onChange({ filters: { ...filters, [k]: v } });

  const active = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[170px] flex-1 space-y-1">
          <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarRange className="h-3 w-3" /> Période
          </Label>
          <Select value={period} onValueChange={(v: PeriodPresetId) => onChange({ period: v })}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              {PERIOD_PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {period === "custom" && (
          <>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Du</Label>
              <Input
                type="date"
                className="h-9"
                value={customFrom ?? ""}
                onChange={(e) => onChange({ customFrom: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Au</Label>
              <Input
                type="date"
                className="h-9"
                value={customTo ?? ""}
                onChange={(e) => onChange({ customTo: e.target.value })}
              />
            </div>
          </>
        )}

        <Button
          variant={compare ? "default" : "outline"}
          size="sm"
          className="h-9"
          onClick={() => onChange({ compare: !compare })}
        >
          Comparer N-1
        </Button>

        {onSaveFavorite && (
          <Button variant="outline" size="sm" className="h-9" onClick={onSaveFavorite}>
            <Star className="mr-1 h-3.5 w-3.5" /> Favori
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <FilterSelect
          label="Ligne de production"
          value={filters.lineId}
          options={options?.lines ?? []}
          onChange={(v) => setFilter("lineId", v)}
        />
        <FilterSelect
          label="Produit"
          value={filters.productId}
          options={options?.products ?? []}
          onChange={(v) => setFilter("productId", v)}
        />
        <FilterSelect
          label="Fournisseur"
          value={filters.supplierId}
          options={options?.suppliers ?? []}
          onChange={(v) => setFilter("supplierId", v)}
        />
        <FilterSelect
          label="Campagne"
          value={filters.campaignId}
          options={options?.campaigns ?? []}
          onChange={(v) => setFilter("campaignId", v)}
        />
        {active > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => onChange({ filters: {} })}
          >
            <X className="mr-1 h-3.5 w-3.5" /> Réinitialiser
          </Button>
        )}
      </div>

      {!!savedFilters.length && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Filter className="h-3 w-3" /> Favoris
          </span>
          {savedFilters.map((f) => (
            <Badge key={f.id} variant="outline" className="gap-1 pr-1">
              <button className="text-xs" onClick={() => onApplyFavorite?.(f)}>
                {f.name}
              </button>
              {onRemoveFavorite && (
                <button
                  className="rounded p-0.5 hover:bg-muted"
                  onClick={() => onRemoveFavorite(f.id)}
                  aria-label={`Supprimer le favori ${f.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
