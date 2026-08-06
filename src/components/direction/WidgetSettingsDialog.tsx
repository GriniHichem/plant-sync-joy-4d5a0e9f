import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ACCENTS } from "@/components/direction/WidgetCard";
import { FilterSelect, FilterOptions } from "@/components/direction/DashboardFilters";
import {
  DashboardWidget,
  PERIOD_PRESETS,
  PeriodPresetId,
  WIDGETS_BY_ID,
} from "@/lib/directionWidgets";

interface Props {
  item: DashboardWidget | null;
  options?: FilterOptions;
  onOpenChange: (v: boolean) => void;
  onChange: (uid: string, patch: Partial<DashboardWidget>) => void;
}

export function WidgetSettingsDialog({ item, options, onOpenChange, onChange }: Props) {
  if (!item) return null;
  const def = WIDGETS_BY_ID.get(item.widgetId);
  const set = (p: Partial<DashboardWidget>) => onChange(item.uid, p);
  const supported = def?.filters ?? [];
  const local = item.filters ?? {};
  const setLocal = (k: string, v: string | null) => set({ filters: { ...local, [k]: v } });

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-hidden">
        <DialogHeader>
          <DialogTitle className="truncate">
            {item.title || def?.title || item.widgetId}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-3">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Titre personnalisé</Label>
              <Input
                value={item.title ?? ""}
                placeholder={def?.title}
                onChange={(e) => set({ title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Largeur</Label>
                <Select
                  value={String(item.w)}
                  onValueChange={(v) => set({ w: Number(v) as DashboardWidget["w"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {[1, 2, 3, 4].map((w) => (
                      <SelectItem key={w} value={String(w)}>
                        {w} colonne{w > 1 ? "s" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Hauteur</Label>
                <Select value={item.h} onValueChange={(v: any) => set({ h: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="sm">Compacte</SelectItem>
                    <SelectItem value="md">Moyenne</SelectItem>
                    <SelectItem value="lg">Grande</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Couleur d'accent</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ACCENTS).map(([k, c]) => (
                  <button
                    key={k}
                    aria-label={`Couleur ${k}`}
                    onClick={() => set({ accent: k })}
                    className={cn(
                      "h-7 w-7 rounded-full border-2",
                      item.accent === k ? "border-foreground" : "border-transparent",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {def?.kind === "kpi" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Alignement</Label>
                  <Select value={item.align ?? "left"} onValueChange={(v: any) => set({ align: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="left">Gauche</SelectItem>
                      <SelectItem value="center">Centré</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Typographie</Label>
                  <Select
                    value={item.emphasis ?? "normal"}
                    onValueChange={(v: any) => set({ emphasis: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="normal">Standard</SelectItem>
                      <SelectItem value="large">Grande</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Période du widget</Label>
              <Select
                value={item.period ?? "__global__"}
                onValueChange={(v) =>
                  set({ period: v === "__global__" ? null : (v as PeriodPresetId) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="__global__">Période globale du dashboard</SelectItem>
                  {PERIOD_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {item.period === "custom" && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={item.customFrom ?? ""}
                    onChange={(e) => set({ customFrom: e.target.value })}
                  />
                  <Input
                    type="date"
                    value={item.customTo ?? ""}
                    onChange={(e) => set({ customTo: e.target.value })}
                  />
                </div>
              )}
            </div>

            {def?.kind === "kpi" && (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Comparer à la période précédente</p>
                  <p className="text-xs text-muted-foreground">Affiche l'évolution en %</p>
                </div>
                <Switch checked={!!item.compare} onCheckedChange={(v) => set({ compare: v })} />
              </div>
            )}

            {!!supported.length && (
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Filtres globaux</p>
                    <p className="text-xs text-muted-foreground">
                      Désactiver pour appliquer des filtres locaux
                    </p>
                  </div>
                  <Switch
                    checked={item.useGlobalFilters !== false}
                    onCheckedChange={(v) => set({ useGlobalFilters: v })}
                  />
                </div>
                {item.useGlobalFilters === false && (
                  <div className="flex flex-wrap gap-2">
                    {supported.includes("line") && (
                      <FilterSelect
                        label="Ligne"
                        value={local.lineId}
                        options={options?.lines ?? []}
                        onChange={(v) => setLocal("lineId", v)}
                      />
                    )}
                    {supported.includes("product") && (
                      <FilterSelect
                        label="Produit"
                        value={local.productId}
                        options={options?.products ?? []}
                        onChange={(v) => setLocal("productId", v)}
                      />
                    )}
                    {supported.includes("supplier") && (
                      <FilterSelect
                        label="Fournisseur"
                        value={local.supplierId}
                        options={options?.suppliers ?? []}
                        onChange={(v) => setLocal("supplierId", v)}
                      />
                    )}
                    {supported.includes("campaign") && (
                      <FilterSelect
                        label="Campagne"
                        value={local.campaignId}
                        options={options?.campaigns ?? []}
                        onChange={(v) => setLocal("campaignId", v)}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Terminer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
