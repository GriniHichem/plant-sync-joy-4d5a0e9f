import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ResponsiveDialog } from "@/components/responsive/ResponsiveDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChevronsUpDown, ClipboardList, Factory, Package, Plus, RotateCcw, Search, X } from "lucide-react";
import QualityIndicatorAssignments from "@/components/qualite/QualityIndicatorAssignments";

interface OfRow {
  id: string;
  numero: string;
  statut: string;
  product_id: string;
  products?: { code: string; designation: string } | null;
}

interface PlanRow {
  indicator_id: string;
  code: string;
  name: string;
  category: string;
  unit: string | null;
  effective_frequency_minutes: number | null;
  effective_is_required: boolean;
  effective_is_blocking: boolean;
  match_scope: string;
  assignment_id: string | null;
}

interface OverrideRow {
  id: string;
  indicator_id: string;
  mode: "add" | "exclude";
  notes: string;
}

const SCOPE_LABEL: Record<string, string> = {
  of: "Local (OF)",
  recipe: "Recette",
  product: "Produit",
  family: "Famille",
  line: "Ligne",
  global: "Global",
};

export default function QualitePlanControleOf() {
  const { user } = useAuth();
  const { canEdit, canCreate } = usePermissions();
  const mayManage = canCreate("qualite_plan_controle") || canEdit("qualite_plan_controle");

  const [ofs, setOfs] = useState<OfRow[]>([]);
  const [ofId, setOfId] = useState<string>("");
  const [ofOpen, setOfOpen] = useState(false);
  const [plan, setPlan] = useState<PlanRow[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [indicators, setIndicators] = useState<{ id: string; code: string; name: string; category: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: ofData }, { data: indData }] = await Promise.all([
        supabase
          .from("ordres_fabrication")
          .select("id, numero, statut, product_id, products(code, designation)")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(300),
        supabase.from("quality_indicators").select("id, code, name, category").eq("is_active", true).order("code"),
      ]);
      setOfs((ofData ?? []) as unknown as OfRow[]);
      setIndicators((indData ?? []) as any[]);
    })();
  }, []);

  const selectedOf = useMemo(() => ofs.find((o) => o.id === ofId) ?? null, [ofs, ofId]);

  const loadPlan = async (id: string) => {
    if (!id) { setPlan([]); setOverrides([]); return; }
    setLoading(true);
    const [{ data: planData, error }, { data: ovData }] = await Promise.all([
      (supabase as any).rpc("get_quality_indicators_for_of", { p_of_id: id }),
      (supabase as any).from("quality_of_indicator_overrides").select("id, indicator_id, mode, notes").eq("of_id", id),
    ]);
    if (error) toast.error(error.message);
    setPlan((planData ?? []) as PlanRow[]);
    setOverrides((ovData ?? []) as OverrideRow[]);
    setLoading(false);
  };

  useEffect(() => { loadPlan(ofId); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ofId]);

  const excluded = useMemo(() => overrides.filter((o) => o.mode === "exclude"), [overrides]);
  const excludedIndicators = useMemo(
    () => excluded.map((o) => ({ ov: o, ind: indicators.find((i) => i.id === o.indicator_id) })).filter((x) => x.ind),
    [excluded, indicators],
  );

  const availableToAdd = useMemo(() => {
    const inPlan = new Set(plan.map((p) => p.indicator_id));
    const q = search.trim().toLowerCase();
    return indicators
      .filter((i) => !inPlan.has(i.id))
      .filter((i) => !q || i.code.toLowerCase().includes(q) || i.name.toLowerCase().includes(q));
  }, [indicators, plan, search]);

  const addLocal = async (indicatorId: string) => {
    const existing = overrides.find((o) => o.indicator_id === indicatorId);
    const { error } = existing
      ? await (supabase as any)
          .from("quality_of_indicator_overrides")
          .update({ mode: "add", updated_by: user?.id })
          .eq("id", existing.id)
      : await (supabase as any).from("quality_of_indicator_overrides").insert({
          of_id: ofId, indicator_id: indicatorId, mode: "add", created_by: user?.id, updated_by: user?.id,
        });
    if (error) return toast.error(error.message);
    toast.success("Contrôle ajouté à cet OF uniquement");
    setAddOpen(false); setSearch("");
    loadPlan(ofId);
  };

  const removeFromOf = async (row: PlanRow) => {
    if (row.match_scope === "of") {
      const ov = overrides.find((o) => o.indicator_id === row.indicator_id && o.mode === "add");
      if (ov) {
        const { error } = await (supabase as any).from("quality_of_indicator_overrides").delete().eq("id", ov.id);
        if (error) return toast.error(error.message);
      }
      toast.success("Ajout local retiré");
    } else {
      const existing = overrides.find((o) => o.indicator_id === row.indicator_id);
      const { error } = existing
        ? await (supabase as any).from("quality_of_indicator_overrides").update({ mode: "exclude", updated_by: user?.id }).eq("id", existing.id)
        : await (supabase as any).from("quality_of_indicator_overrides").insert({
            of_id: ofId, indicator_id: row.indicator_id, mode: "exclude", created_by: user?.id, updated_by: user?.id,
          });
      if (error) return toast.error(error.message);
      toast.success("Contrôle retiré de cet OF uniquement (le produit reste inchangé)");
    }
    loadPlan(ofId);
  };

  const restore = async (ovId: string) => {
    const { error } = await (supabase as any).from("quality_of_indicator_overrides").delete().eq("id", ovId);
    if (error) return toast.error(error.message);
    toast.success("Contrôle hérité rétabli");
    loadPlan(ofId);
  };

  const filteredPlan = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || addOpen) return plan;
    return plan.filter((p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
  }, [plan, search, addOpen]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" /> Plan de contrôle OF
        </h1>
        <p className="text-sm text-muted-foreground">
          Les contrôles affectés à un produit fini sont hérités automatiquement par tous ses OF. Chaque OF peut
          recevoir un ajout local ou un retrait ponctuel sans impacter le produit.
        </p>
      </div>

      <Tabs defaultValue="of">
        <TabsList>
          <TabsTrigger value="of"><Factory className="h-4 w-4 mr-1" /> Par OF</TabsTrigger>
          <TabsTrigger value="produit"><Package className="h-4 w-4 mr-1" /> Par produit (héritage)</TabsTrigger>
        </TabsList>

        <TabsContent value="of" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ordre de fabrication</CardTitle>
              <CardDescription>Sélectionnez un OF pour visualiser et ajuster son plan de contrôle.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Popover open={ofOpen} onOpenChange={setOfOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-11 min-w-[280px] justify-between">
                    {selectedOf
                      ? `${selectedOf.numero} — ${selectedOf.products?.designation ?? ""}`
                      : "Choisir un OF…"}
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[min(92vw,420px)]" align="start">
                  <Command>
                    <CommandInput placeholder="Rechercher un OF ou un produit…" />
                    <CommandList>
                      <CommandEmpty>Aucun OF.</CommandEmpty>
                      <CommandGroup>
                        {ofs.map((o) => (
                          <CommandItem
                            key={o.id}
                            value={`${o.numero} ${o.products?.code ?? ""} ${o.products?.designation ?? ""}`}
                            onSelect={() => { setOfId(o.id); setOfOpen(false); }}
                          >
                            <span className="font-medium">{o.numero}</span>
                            <span className="ml-2 text-xs text-muted-foreground truncate">
                              {o.products?.designation}
                            </span>
                            <Badge variant="outline" className="ml-auto text-[10px]">{o.statut}</Badge>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {selectedOf && (
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="h-11 pl-8"
                    placeholder="Filtrer les contrôles…"
                    value={addOpen ? "" : search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              )}

              {selectedOf && mayManage && (
                <Button className="h-11" onClick={() => { setSearch(""); setAddOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Ajouter un contrôle
                </Button>
              )}
            </CardContent>
          </Card>

          {!selectedOf ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              Sélectionnez un ordre de fabrication.
            </CardContent></Card>
          ) : loading ? (
            <div className="grid gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : (
            <>
              <section className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Plan effectif ({filteredPlan.length})
                </h2>
                {filteredPlan.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
                    Aucun contrôle applicable à cet OF.
                  </CardContent></Card>
                ) : (
                  <div className="grid gap-2">
                    {filteredPlan.map((p) => (
                      <Card key={p.indicator_id} className={cn(p.match_scope === "of" && "border-primary/50")}>
                        <CardContent className="py-3 flex flex-wrap items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
                              {p.code} — {p.name}
                              {p.unit ? <span className="text-muted-foreground"> ({p.unit})</span> : null}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <Badge variant={p.match_scope === "of" ? "default" : "secondary"} className="text-[10px]">
                                {SCOPE_LABEL[p.match_scope] ?? p.match_scope}
                              </Badge>
                              {p.effective_is_required && <Badge variant="outline" className="text-[10px]">Obligatoire</Badge>}
                              {p.effective_is_blocking && <Badge variant="destructive" className="text-[10px]">Bloquant</Badge>}
                              {p.effective_frequency_minutes ? (
                                <Badge variant="outline" className="text-[10px]">Toutes les {p.effective_frequency_minutes} min</Badge>
                              ) : null}
                            </div>
                          </div>
                          {mayManage && (
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeFromOf(p)}>
                              <X className="h-4 w-4 mr-1" />
                              {p.match_scope === "of" ? "Retirer l'ajout" : "Retirer sur cet OF"}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>

              {excludedIndicators.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Retirés localement ({excludedIndicators.length})
                  </h2>
                  <div className="grid gap-2">
                    {excludedIndicators.map(({ ov, ind }) => (
                      <Card key={ov.id} className="opacity-80">
                        <CardContent className="py-3 flex items-center gap-2">
                          <p className="text-sm flex-1 truncate line-through text-muted-foreground">
                            {ind!.code} — {ind!.name}
                          </p>
                          {mayManage && (
                            <Button size="sm" variant="outline" onClick={() => restore(ov.id)}>
                              <RotateCcw className="h-4 w-4 mr-1" /> Rétablir
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="produit" className="mt-4">
          <QualityIndicatorAssignments />
        </TabsContent>
      </Tabs>

      <ResponsiveDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Ajouter un contrôle à cet OF"
        description="Ajout local : les autres OF du même produit ne sont pas impactés."
      >
        <div className="space-y-3">
          <Input
            className="h-11"
            placeholder="Rechercher un contrôle…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-[50vh] overflow-auto grid gap-1.5">
            {availableToAdd.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Aucun contrôle disponible.</p>
            ) : (
              availableToAdd.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => addLocal(i.id)}
                  className="text-left rounded-md border p-2.5 hover:bg-accent/50 transition-colors"
                >
                  <p className="text-sm font-medium">{i.code} — {i.name}</p>
                  <p className="text-[11px] text-muted-foreground">{i.category}</p>
                </button>
              ))
            )}
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
