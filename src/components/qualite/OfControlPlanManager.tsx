import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";

import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollTable } from "@/components/responsive/ScrollTable";
import { Plus, RotateCcw, Trash2, Search, Info } from "lucide-react";
import { logAudit } from "@/lib/audit";

/** Scope returned by get_quality_indicators_for_of */
export type PlanScope = "of" | "recipe" | "product" | "family" | "line" | "global";

export interface PlanIndicator {
  indicator_id: string;
  code: string;
  name: string;
  category: string;
  unit: string | null;
  effective_is_required: boolean;
  effective_is_blocking: boolean;
  match_scope: PlanScope;
}

export interface OverrideRow {
  id: string;
  of_id: string;
  indicator_id: string;
  mode: "add" | "remove";
  notes: string | null;
}

export interface CatalogIndicator {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string | null;
}

export interface PlanRow {
  indicator_id: string;
  code: string;
  name: string;
  category: string;
  unit: string | null;
  required: boolean;
  blocking: boolean;
  origin: "local" | "inherited";
  scope: PlanScope;
  removed: boolean;
  overrideId: string | null;
}

export const SCOPE_LABEL: Record<PlanScope, string> = {
  of: "Local (OF)",
  recipe: "Hérité — recette",
  product: "Hérité — produit",
  family: "Hérité — famille",
  line: "Hérité — ligne",
  global: "Hérité — global",
};

/**
 * Merge the resolved OF control plan with the local OF overrides so removed
 * (but inherited) controls stay visible and restorable.
 */
export function buildPlanRows(
  plan: PlanIndicator[],
  overrides: OverrideRow[],
  catalog: CatalogIndicator[],
): PlanRow[] {
  const ovByInd = new Map(overrides.map((o) => [o.indicator_id, o]));
  const rows: PlanRow[] = plan.map((p) => {
    const ov = ovByInd.get(p.indicator_id);
    return {
      indicator_id: p.indicator_id,
      code: p.code,
      name: p.name,
      category: p.category,
      unit: p.unit,
      required: p.effective_is_required,
      blocking: p.effective_is_blocking,
      origin: ov?.mode === "add" ? "local" : "inherited",
      scope: p.match_scope,
      removed: false,
      overrideId: ov?.id ?? null,
    };
  });

  for (const ov of overrides) {
    if (ov.mode !== "remove") continue;
    if (rows.some((r) => r.indicator_id === ov.indicator_id)) continue;
    const c = catalog.find((i) => i.id === ov.indicator_id);
    rows.push({
      indicator_id: ov.indicator_id,
      code: c?.code ?? "—",
      name: c?.name ?? "Indicateur",
      category: c?.category ?? "",
      unit: c?.unit ?? null,
      required: false,
      blocking: false,
      origin: "inherited",
      scope: "product",
      removed: true,
      overrideId: ov.id,
    });
  }

  return rows.sort((a, b) => Number(a.removed) - Number(b.removed) || a.code.localeCompare(b.code));
}

/** Indicators available to be added locally on the OF. */
export function availableToAdd(catalog: CatalogIndicator[], rows: PlanRow[]): CatalogIndicator[] {
  const used = new Set(rows.filter((r) => !r.removed).map((r) => r.indicator_id));
  return catalog.filter((c) => !used.has(c.id));
}

interface Props {
  ofId: string;
  ofNumero?: string | null;
  canManage?: boolean;
}

export default function OfControlPlanManager({ ofId, ofNumero, canManage = true }: Props) {
  // Retirer un contrôle du plan est une suppression : droit "delete" requis.
  const { canDelete } = usePermissions();
  const canRemove = canManage && canDelete("qualite_indicateurs");

  const { user } = useAuth();
  const { toast } = useToast();
  const [plan, setPlan] = useState<PlanIndicator[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toAdd, setToAdd] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    if (!ofId) return;
    setLoading(true);
    const [planRes, ovRes, catRes] = await Promise.all([
      (supabase as any).rpc("get_quality_indicators_for_of", { p_of_id: ofId }),
      (supabase as any).from("quality_of_indicator_overrides").select("*").eq("of_id", ofId),
      (supabase as any).from("quality_indicators").select("id, code, name, category, unit").eq("is_active", true).order("code"),
    ]);
    setPlan(planRes.data || []);
    setOverrides(ovRes.data || []);
    setCatalog(catRes.data || []);
    setLoading(false);
  }, [ofId]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => buildPlanRows(plan, overrides, catalog), [plan, overrides, catalog]);
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? rows.filter((r) => `${r.code} ${r.name}`.toLowerCase().includes(s)) : rows;
  }, [rows, q]);
  const addable = useMemo(() => availableToAdd(catalog, rows), [catalog, rows]);

  const audit = (label: string, extra: Record<string, unknown>, actionType: "update" | "delete" = "update") =>
    logAudit({
      action_type: actionType,
      module: "parametres" as any,
      entity_type: "quality_of_indicator_override",
      entity_id: ofId,
      entity_label: `${ofNumero ?? "OF"} – ${label}`,
      action_label: "Plan de contrôle OF",
      new_values: extra,
      severity: "info",

    });

  const addLocal = async () => {
    if (!toAdd) return;
    // Garde anti-doublon : le contrôle est déjà présent (local ou hérité) dans ce plan
    const existing = rows.find((r) => r.indicator_id === toAdd && !r.removed);
    if (existing) {
      toast({
        title: "Contrôle déjà présent",
        description: `Ce contrôle est déjà dans le plan de cet OF (${SCOPE_LABEL[existing.scope]}).`,
        variant: "destructive",
      });
      return;
    }
    setBusy(toAdd);
    const { error } = await (supabase as any)
      .from("quality_of_indicator_overrides")
      .upsert(
        { of_id: ofId, indicator_id: toAdd, mode: "add", created_by: user?.id ?? null },
        { onConflict: "of_id,indicator_id" },
      );
    setBusy(null);
    if (error) {
      const isDup = error.code === "23505" || /déjà présent|duplicate key/i.test(error.message ?? "");
      toast({
        title: isDup ? "Contrôle déjà présent" : "Erreur",
        description: isDup ? "Ce contrôle est déjà dans le plan de cet OF." : error.message,
        variant: "destructive",
      });
      return;
    }
    await audit("ajout local", { indicator_id: toAdd, mode: "add" });
    toast({ title: "Contrôle ajouté à cet OF" });
    setToAdd("");
    load();
  };


  const removeRow = async (r: PlanRow) => {
    if (!canRemove) {
      toast({ title: "Accès refusé", description: "Le retrait d'un contrôle requiert le droit de suppression.", variant: "destructive" });
      return;
    }
    setBusy(r.indicator_id);
    let error: any = null;
    if (r.origin === "local" && r.overrideId) {
      ({ error } = await (supabase as any).from("quality_of_indicator_overrides").delete().eq("id", r.overrideId));
    } else {
      ({ error } = await (supabase as any)
        .from("quality_of_indicator_overrides")
        .upsert(
          { of_id: ofId, indicator_id: r.indicator_id, mode: "remove", created_by: user?.id ?? null },
          { onConflict: "of_id,indicator_id" },
        ));
    }
    setBusy(null);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    await audit("retrait du plan", { indicator_id: r.indicator_id, origin: r.origin }, "delete");

    toast({
      title: r.origin === "local" ? "Contrôle local supprimé" : "Contrôle retiré de cet OF",
      description: r.origin === "local" ? undefined : "Le contrôle reste affecté au produit.",
    });
    load();
  };

  const restoreRow = async (r: PlanRow) => {
    if (!r.overrideId) return;
    setBusy(r.indicator_id);
    const { error } = await (supabase as any).from("quality_of_indicator_overrides").delete().eq("id", r.overrideId);
    setBusy(null);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    await audit("restauration héritage", { indicator_id: r.indicator_id });
    toast({ title: "Héritage rétabli" });
    load();
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Rechercher un contrôle…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {canManage && (
            <div className="flex items-center gap-2">
              <Select value={toAdd} onValueChange={setToAdd}>
                <SelectTrigger className="w-[220px]"><SelectValue placeholder="Ajouter un contrôle…" /></SelectTrigger>
                <SelectContent>
                  {addable.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={addLocal} disabled={!toAdd || busy !== null}>
                <Plus className="h-4 w-4 mr-1" /> Ajouter
              </Button>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Les contrôles affectés au produit sont hérités automatiquement par tous ses OF. Un ajout ou un retrait
          effectué ici n'affecte que cet OF (dérogation ponctuelle).
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Chargement…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Aucun contrôle dans le plan de cet OF.</p>
        ) : (
          <ScrollTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Contrôle</TableHead>
                  <TableHead>Origine</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((r) => (
                  <TableRow key={r.indicator_id} className={r.removed ? "opacity-60" : undefined}>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell className={r.removed ? "line-through" : undefined}>
                      {r.name}{r.unit ? ` (${r.unit})` : ""}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.origin === "local" ? "default" : "secondary"}>{SCOPE_LABEL[r.scope]}</Badge>
                    </TableCell>
                    <TableCell className="space-x-1">
                      {r.removed
                        ? <Badge variant="destructive">Retiré de l'OF</Badge>
                        : <>
                            {r.required && <Badge variant="outline">Obligatoire</Badge>}
                            {r.blocking && <Badge variant="destructive">Bloquant</Badge>}
                          </>}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.removed
                        ? canManage && (
                            <Button size="sm" variant="ghost" disabled={busy === r.indicator_id} onClick={() => restoreRow(r)}>
                              <RotateCcw className="h-4 w-4 mr-1" /> Rétablir
                            </Button>
                          )
                        : canRemove && (
                            <Button size="sm" variant="ghost" disabled={busy === r.indicator_id} onClick={() => removeRow(r)}>
                              <Trash2 className="h-4 w-4 mr-1" /> Retirer
                            </Button>
                          )}

                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollTable>
        )}
      </CardContent>
    </Card>
  );
}
