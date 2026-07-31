import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, BarChart3, Boxes, ClipboardCheck, Factory, PieChart, Plus, Search, Table2, Truck, Wrench,
} from "lucide-react";
import {
  CATEGORY_META, WIDGET_CATEGORIES, kindLabel, type WidgetCategory, type WidgetDef,
} from "@/lib/direction/widgetCatalog";

const CATEGORY_ICON: Record<WidgetCategory, any> = {
  Maintenance: Wrench,
  Production: Factory,
  Qualité: ClipboardCheck,
  "Stock PDR": Boxes,
  Inventaire: Table2,
  Réception: Truck,
  Alertes: AlertTriangle,
};

const KIND_ICON = { kpi: BarChart3, chart: PieChart, table: Table2 } as const;

interface Props {
  widgets: WidgetDef[];
  onAdd: (widgetId: string) => void;
  className?: string;
}

export function WidgetLibraryPanel({ widgets, onAdd, className }: Props) {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<WidgetCategory | "all">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return widgets.filter(
      (w) =>
        (cat === "all" || w.category === cat) &&
        (!q || w.title.toLowerCase().includes(q) || w.description.toLowerCase().includes(q) || w.category.toLowerCase().includes(q)),
    );
  }, [widgets, search, cat]);

  const categories = WIDGET_CATEGORIES.filter((c) => widgets.some((w) => w.category === c));

  return (
    <div className={cn("flex flex-col min-h-0", className)}>
      <div className="p-2 space-y-2 border-b">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 h-10"
            placeholder="Rechercher un composant…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant={cat === "all" ? "default" : "outline"} className="h-7 px-2 text-[11px]" onClick={() => setCat("all")}>
            Tous
          </Button>
          {categories.map((c) => {
            const Icon = CATEGORY_ICON[c];
            return (
              <Button
                key={c}
                size="sm"
                variant={cat === c ? "default" : "outline"}
                className="h-7 px-2 text-[11px] gap-1"
                onClick={() => setCat(c)}
              >
                <Icon className="h-3 w-3" />
                {c}
              </Button>
            );
          })}
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-3">
          {categories
            .filter((c) => filtered.some((w) => w.category === c))
            .map((c) => {
              const Icon = CATEGORY_ICON[c];
              const meta = CATEGORY_META[c];
              return (
                <div key={c} className="space-y-1.5">
                  <p className={cn("flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide", meta.color)}>
                    <Icon className="h-3.5 w-3.5" /> {c}
                  </p>
                  {filtered
                    .filter((w) => w.category === c)
                    .map((w) => {
                      const KIcon = KIND_ICON[w.kind];
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => onAdd(w.id)}
                          className="w-full text-left rounded-md border p-2 hover:bg-accent/60 hover:border-primary/40 transition-colors group"
                        >
                          <div className="flex items-center gap-2">
                            <span className={cn("rounded p-1", meta.badge)}>
                              <KIcon className="h-3.5 w-3.5" />
                            </span>
                            <span className="text-[13px] font-medium truncate flex-1">{w.title}</span>
                            <Badge variant="outline" className="text-[9px] shrink-0">{kindLabel(w)}</Badge>
                            <Plus className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-primary shrink-0" />
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{w.description}</p>
                        </button>
                      );
                    })}
                </div>
              );
            })}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground p-3">Aucun composant ne correspond (ou droits insuffisants).</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
