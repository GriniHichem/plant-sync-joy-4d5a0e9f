import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Package, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PackagingLevel {
  id?: string;
  level_order: number;
  unite_name: string;
  coefficient: number;
  poids: number;
}

interface PackagingConfigProps {
  entityType: "product" | "article";
  entityId: string;
  poidsUnitaire?: number;
  uniteBase?: string;
}

export function PackagingConfig({ entityType, entityId, poidsUnitaire = 0, uniteBase = "g" }: PackagingConfigProps) {
  const { toast } = useToast();
  const [levels, setLevels] = useState<PackagingLevel[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("packaging_levels")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("level_order");
      if (data && data.length > 0) {
        setLevels(data.map((d: any) => ({
          id: d.id,
          level_order: d.level_order,
          unite_name: d.unite_name,
          coefficient: Number(d.coefficient),
          poids: Number(d.poids),
        })));
      }
    };
    if (entityId) load();
  }, [entityType, entityId]);

  const calculatedWeights = useMemo(() => {
    const weights: number[] = [];
    levels.forEach((l, i) => {
      if (i === 0) {
        weights.push(l.coefficient * poidsUnitaire);
      } else {
        weights.push(l.coefficient * (weights[i - 1] || 0));
      }
    });
    return weights;
  }, [levels, poidsUnitaire]);

  const addLevel = () => {
    setLevels((prev) => [
      ...prev,
      { level_order: prev.length, unite_name: "", coefficient: 1, poids: 0 },
    ]);
  };

  const removeLevel = (idx: number) => {
    setLevels((prev) => prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, level_order: i })));
  };

  const updateLevel = (idx: number, field: keyof PackagingLevel, value: any) => {
    setLevels((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const save = async () => {
    setSaving(true);
    // Delete existing
    await supabase.from("packaging_levels").delete().eq("entity_type", entityType).eq("entity_id", entityId);
    
    if (levels.length > 0) {
      const rows = levels.map((l, i) => ({
        entity_type: entityType,
        entity_id: entityId,
        level_order: i,
        unite_name: l.unite_name,
        coefficient: l.coefficient,
        poids: calculatedWeights[i] || 0,
      }));
      const { error } = await supabase.from("packaging_levels").insert(rows as any);
      if (error) {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Conditionnement enregistré" });
      }
    } else {
      toast({ title: "Conditionnement supprimé" });
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          Niveaux de conditionnement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Base unit info */}
        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-xs text-muted-foreground">Unité de base</p>
          <p className="text-sm font-medium">{poidsUnitaire} {uniteBase} / unité</p>
        </div>

        {levels.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucun niveau de conditionnement défini</p>
        ) : (
          <div className="space-y-3">
            {levels.map((level, i) => (
              <div key={i}>
                {i > 0 && (
                  <div className="flex justify-center py-1">
                    <ArrowDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex items-start gap-2 p-3 rounded-lg border bg-background">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Nom de l'unité</Label>
                      <Input
                        value={level.unite_name}
                        onChange={(e) => updateLevel(i, "unite_name", e.target.value)}
                        placeholder="ex: Boîte, Carton, Palette"
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">
                        Coefficient ({i === 0 ? `× unité de base` : `× ${levels[i - 1]?.unite_name || "niveau " + i}`})
                      </Label>
                      <Input
                        value={String(level.coefficient).replace(".", ",")}
                        onChange={(e) => { const v = e.target.value; if (/^[0-9]*[,.]?[0-9]{0,4}$/.test(v) || v === "") updateLevel(i, "coefficient", Number(v.replace(",", ".")) || 0); }}
                        className="h-9 text-sm"
                        inputMode="decimal"
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0 pt-5">
                    <p className="text-sm font-bold tabular-nums text-primary">
                      {(calculatedWeights[i] || 0).toLocaleString("fr-FR")} {uniteBase}
                    </p>
                    <Button variant="ghost" size="icon" className="h-7 w-7 mt-1" onClick={() => removeLevel(i)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {levels.length > 0 && (
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs text-muted-foreground mb-1">Récapitulatif conversion</p>
            <div className="space-y-0.5">
              {levels.map((l, i) => {
                const totalUnitsBase = levels.slice(0, i + 1).reduce((acc, lv) => acc * lv.coefficient, 1);
                return (
                  <p key={i} className="text-xs tabular-nums">
                    1 {l.unite_name || `Niveau ${i + 1}`} = {totalUnitsBase} unité(s) de base = {(calculatedWeights[i] || 0).toLocaleString("fr-FR")} {uniteBase}
                  </p>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={addLevel}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter un niveau
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
