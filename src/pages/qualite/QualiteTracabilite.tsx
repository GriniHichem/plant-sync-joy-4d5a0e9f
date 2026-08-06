import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollTable } from "@/components/responsive/ScrollTable";
import { ResponsiveDialog } from "@/components/responsive/ResponsiveDialog";
import { Download, Search, Lock, Unlock, AlertTriangle, RotateCcw, ListFilter, Clock, CheckCircle2, Trash2, GitBranch, RefreshCw, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { logAudit } from "@/lib/audit";
import {
  notifyOfQualityPending,
} from "@/lib/qualityNotifications";
import {
  buildTracabiliteCsv,
  downloadTracabiliteCsv,
  type TracabilitePayload,
} from "./components/TracabiliteCsv";

const ALL = "__all__";

type OfRow = {
  id: string;
  numero: string;
  product_id: string | null;
  line_id: string | null;
  recipe_id: string | null;
  bom_id: string | null;
  statut: string | null;
  quality_status: string | null;
  quantite_prevue: number | null;
  quantite_produite: number | null;
  quantite_rebut: number | null;
};

const QUALITY_STATUS_LABELS: Record<string, string> = {
  en_attente: "En attente",
  libere: "Libéré",
  bloque: "Bloqué",
  rebut: "Rebut",
};

const QUALITY_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  en_attente: "secondary",
  libere: "default",
  bloque: "destructive",
  rebut: "outline",
};

export default function QualiteTracabilite() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [ofs, setOfs] = useState<OfRow[]>([]);
  const [products, setProducts] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<Record<string, string>>({});
  const [recipes, setRecipes] = useState<Record<string, { name: string; version: number | null }>>({});
  const [boms, setBoms] = useState<Record<string, { version: number | null }>>({});
  const [articles, setArticles] = useState<Record<string, string>>({});
  const [indicators, setIndicators] = useState<Record<string, string>>({});

  const [filterQ, setFilterQ] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>(ALL);
  const [openOf, setOpenOf] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, TracabilitePayload | undefined>>({});
  const [decisionFor, setDecisionFor] = useState<OfRow | null>(null);
  const [decision, setDecision] = useState<string>("en_attente");
  const [decisionReason, setDecisionReason] = useState<string>("");
  const [savingDecision, setSavingDecision] = useState(false);

  const filtersActive = filterQ !== "" || filterStatus !== ALL;

  const load = async () => {
    setLoading(true);
    const [ofRes, prodRes, lineRes, recRes, bomRes, artRes, indRes] = await Promise.all([
      (supabase as any).from("ordres_fabrication").select("id, numero, product_id, line_id, recipe_id, bom_id, statut, quality_status, quantite_prevue, quantite_produite, quantite_rebut").order("created_at", { ascending: false }).limit(200),
      (supabase as any).from("products").select("id, code, designation"),
      (supabase as any).from("production_lines").select("id, code, designation"),
      (supabase as any).from("recipes").select("id, name, version"),
      (supabase as any).from("bill_of_materials").select("id, version"),
      (supabase as any).from("articles").select("id, code, designation"),
      (supabase as any).from("quality_indicators").select("id, code, name"),
    ]);
    setOfs((ofRes.data ?? []) as OfRow[]);
    setProducts(Object.fromEntries((prodRes.data ?? []).map((p: any) => [p.id, `${p.code} – ${p.designation}`])));
    setLines(Object.fromEntries((lineRes.data ?? []).map((l: any) => [l.id, `${l.code} – ${l.designation}`])));
    setRecipes(Object.fromEntries((recRes.data ?? []).map((r: any) => [r.id, { name: r.name, version: r.version ?? null }])));
    setBoms(Object.fromEntries((bomRes.data ?? []).map((b: any) => [b.id, { version: b.version ?? null }])));
    setArticles(Object.fromEntries((artRes.data ?? []).map((a: any) => [a.id, `${a.code} – ${a.designation}`])));
    setIndicators(Object.fromEntries((indRes.data ?? []).map((i: any) => [i.id, `${i.code} – ${i.name}`])));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const filtered = useMemo(() => {
    const q = filterQ.trim().toLowerCase();
    return ofs.filter((o) => {
      if (filterStatus !== ALL && (o.quality_status ?? "en_attente") !== filterStatus) return false;
      if (q) {
        const hay = [
          o.numero,
          products[o.product_id ?? ""] ?? "",
          lines[o.line_id ?? ""] ?? "",
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [ofs, filterQ, filterStatus, products, lines]);

  const loadDetails = async (ofId: string) => {
    if (details[ofId]) return;
    const o = ofs.find((x) => x.id === ofId);
    if (!o) return;
    const [shiftsRes, consRes, checksRes, ncsRes, actsRes, teamsRes, profilesRes] = await Promise.all([
      (supabase as any).from("shifts").select("id, date_shift, shift_type, shift_team_id, chef_ligne_id").eq("of_id", ofId),
      (supabase as any).from("consumptions").select("article_id, quantite, unite, lot_number, batch_number, supplier_lot, expiry_date").eq("of_id", ofId),
      (supabase as any).from("quality_checks").select("id, control_time, indicator_id, measured_value_numeric, measured_value_text, measured_value_boolean, selected_value, is_conform").eq("of_id", ofId).order("control_time", { ascending: false }),
      (supabase as any).from("quality_non_conformities").select("id, nc_number, title, severity, status, decision").eq("of_id", ofId).order("created_at", { ascending: false }),
      (supabase as any).from("quality_actions").select("id, title, action_type, status, due_date").eq("of_id", ofId).order("created_at", { ascending: false }),
      (supabase as any).from("shift_teams").select("id, name"),
      (supabase as any).from("profiles").select("user_id, first_name, last_name"),
    ]);
    const teamMap = new Map((teamsRes.data ?? []).map((t: any) => [t.id, t.name]));
    const profMap = new Map((profilesRes.data ?? []).map((p: any) => [p.user_id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()]));

    const recipe = o.recipe_id ? recipes[o.recipe_id] : null;
    const bom = o.bom_id ? boms[o.bom_id] : null;
    const payload: TracabilitePayload = {
      of: {
        numero: o.numero,
        product_label: products[o.product_id ?? ""] ?? null,
        line_label: lines[o.line_id ?? ""] ?? null,
        statut: o.statut,
        quality_status: o.quality_status,
        recipe_label: recipe ? `${recipe.name}${recipe.version != null ? ` v${recipe.version}` : ""}` : null,
        bom_label: bom ? `BOM v${bom.version ?? "?"}` : null,
        quantite_prevue: o.quantite_prevue,
        quantite_produite: o.quantite_produite,
        quantite_rebut: o.quantite_rebut,
      },
      shifts: (shiftsRes.data ?? []).map((s: any) => ({
        date_shift: s.date_shift,
        shift_type: s.shift_type,
        team_label: s.shift_team_id ? (teamMap.get(s.shift_team_id) as string) : null,
        chef_label: s.chef_ligne_id ? (profMap.get(s.chef_ligne_id) as string) : null,
      })),
      consumptions: (consRes.data ?? []).map((c: any) => ({
        article_label: articles[c.article_id ?? ""] ?? "—",
        quantite: c.quantite,
        unite: c.unite,
        lot_number: c.lot_number,
        batch_number: c.batch_number,
        supplier_lot: c.supplier_lot,
        expiry_date: c.expiry_date,
      })),
      checks: (checksRes.data ?? []).map((c: any) => ({
        control_time: c.control_time,
        indicator_label: indicators[c.indicator_id] ?? "—",
        measured: c.measured_value_numeric ?? c.measured_value_text ?? c.selected_value ?? (c.measured_value_boolean == null ? "" : c.measured_value_boolean ? "OUI" : "NON"),
        is_conform: c.is_conform,
      })),
      ncs: (ncsRes.data ?? []).map((n: any) => ({
        nc_number: n.nc_number,
        title: n.title,
        severity: n.severity,
        status: n.status,
        decision: n.decision,
      })),
      actions: (actsRes.data ?? []).map((a: any) => ({
        title: a.title,
        action_type: a.action_type,
        status: a.status,
        due_date: a.due_date,
      })),
    };
    setDetails((prev) => ({ ...prev, [ofId]: payload }));
  };

  const toggleOpen = async (id: string) => {
    if (openOf === id) { setOpenOf(null); return; }
    setOpenOf(id);
    await loadDetails(id);
  };

  const handleExport = (ofId: string) => {
    const p = details[ofId];
    if (!p) return;
    downloadTracabiliteCsv(p);
  };

  const openDecision = (o: OfRow) => {
    setDecisionFor(o);
    setDecision(o.quality_status ?? "en_attente");
    setDecisionReason("");
  };

  const saveDecision = async () => {
    if (!decisionFor) return;
    if (!decision) { toast({ title: "Décision requise", variant: "destructive" }); return; }
    setSavingDecision(true);
    const { error } = await (supabase as any).rpc("set_of_quality_status", {
      p_of_id: decisionFor.id,
      p_status: decision,
      p_reason: decisionReason || null,
    });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      setSavingDecision(false);
      return;
    }
    await logAudit({
      action_type: "update",
      module: "qualite" as any,
      entity_type: "of",
      entity_id: decisionFor.id,
      entity_code: decisionFor.numero,
      entity_label: decisionFor.numero,
      action_label: `Décision qualité OF : ${QUALITY_STATUS_LABELS[decision] ?? decision}`,
      old_values: { quality_status: decisionFor.quality_status },
      new_values: { quality_status: decision, reason: decisionReason || null },
      severity: decision === "bloque" || decision === "rebut" ? "high" : "info",
    });
    if (decision === "en_attente") {
      await notifyOfQualityPending({
        entity_id: decisionFor.id,
        entity_code: decisionFor.numero,
        entity_label: decisionFor.numero,
      });
    }
    toast({ title: "Statut qualité mis à jour" });
    setDecisionFor(null);
    setSavingDecision(false);
    setDetails((prev) => ({ ...prev, [decisionFor.id]: undefined as any }));
    load();
  };

  const resetFilters = () => { setFilterQ(""); setFilterStatus(ALL); };

  const counts = useMemo(() => {
    const c = { total: ofs.length, en_attente: 0, libere: 0, bloque: 0, rebut: 0 } as Record<string, number>;
    ofs.forEach((o) => { const k = o.quality_status ?? "en_attente"; if (k in c) c[k] += 1; });
    return c;
  }, [ofs]);

  const STATUS_CHIPS: { value: string; label: string; icon: typeof Lock; tone: string }[] = [
    { value: ALL, label: "Tous", icon: ListFilter, tone: "text-foreground" },
    { value: "en_attente", label: "En attente", icon: Clock, tone: "text-warning" },
    { value: "libere", label: "Libérés", icon: CheckCircle2, tone: "text-success" },
    { value: "bloque", label: "Bloqués", icon: Lock, tone: "text-destructive" },
    { value: "rebut", label: "Rebut", icon: Trash2, tone: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" /> Traçabilité OF
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Vue complète par ordre de fabrication : recette, nomenclature, consommations et lots, contrôles, non-conformités et actions.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </Button>
      </div>

      {/* Filtres rapides par statut */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {STATUS_CHIPS.map((s) => {
          const active = filterStatus === s.value;
          const n = s.value === ALL ? counts.total : counts[s.value];
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => setFilterStatus(s.value)}
              className={`shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted text-muted-foreground"
              }`}
            >
              <s.icon className={`h-3.5 w-3.5 ${active ? "" : s.tone}`} />
              {s.label}
              <span className="tabular-nums opacity-80">{n}</span>
            </button>
          );
        })}
      </div>

      {/* Recherche */}
      <div className="flex flex-wrap gap-2 items-center rounded-lg border bg-muted/30 p-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un OF, un produit, une ligne…"
            className="pl-8 bg-background"
            value={filterQ}
            onChange={(e) => setFilterQ(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[170px] bg-background"><SelectValue placeholder="Statut qualité" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous statuts</SelectItem>
            <SelectItem value="en_attente">En attente</SelectItem>
            <SelectItem value="libere">Libéré</SelectItem>
            <SelectItem value="bloque">Bloqué</SelectItem>
            <SelectItem value="rebut">Rebut</SelectItem>
          </SelectContent>
        </Select>
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={resetFilters}><RotateCcw className="h-4 w-4 mr-1" />Réinitialiser</Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[76px] rounded-lg border bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-14 text-center">
          <GitBranch className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Aucun OF ne correspond aux filtres.</p>
          {filtersActive && <Button variant="outline" size="sm" onClick={resetFilters}>Réinitialiser les filtres</Button>}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{filtered.length} OF affiché{filtered.length > 1 ? "s" : ""}</p>
          {filtered.map((o) => {
            const qs = o.quality_status ?? "en_attente";
            const recipe = o.recipe_id ? recipes[o.recipe_id] : null;
            const bom = o.bom_id ? boms[o.bom_id] : null;
            const isOpen = openOf === o.id;
            const detail = details[o.id];
            const accent =
              qs === "libere" ? "before:bg-success"
              : qs === "bloque" ? "before:bg-destructive"
              : qs === "rebut" ? "before:bg-muted-foreground"
              : "before:bg-warning";
            return (
              <Card
                key={o.id}
                className={`relative overflow-hidden transition-shadow before:absolute before:inset-y-0 before:left-0 before:w-1 ${accent} ${isOpen ? "shadow-md ring-1 ring-primary/20" : "hover:shadow-sm"}`}
              >
                <button
                  type="button"
                  onClick={() => toggleOpen(o.id)}
                  aria-expanded={isOpen}
                  className="w-full text-left p-4 pl-5 flex items-center gap-3"
                >
                  <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold font-mono text-sm sm:text-base truncate">{o.numero}</div>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">
                      {products[o.product_id ?? ""] ?? "—"} · {lines[o.line_id ?? ""] ?? "—"}
                    </p>
                  </div>
                  <div className="hidden md:flex items-center gap-1.5">
                    <Badge variant="outline" className="font-normal">{recipe ? `${recipe.name} v${recipe.version ?? "?"}` : "Sans recette"}</Badge>
                    <Badge variant="outline" className="font-normal">{bom ? `BOM v${bom.version ?? "?"}` : "Sans BOM"}</Badge>
                  </div>
                  <Badge variant={QUALITY_STATUS_VARIANT[qs] ?? "secondary"} className="shrink-0">{QUALITY_STATUS_LABELS[qs] ?? qs}</Badge>
                </button>

                {isOpen && (
                  <CardContent className="space-y-4 border-t pt-4 pl-5">
                    <div className="flex md:hidden flex-wrap gap-1.5">
                      <Badge variant="outline" className="font-normal">{recipe ? `${recipe.name} v${recipe.version ?? "?"}` : "Sans recette"}</Badge>
                      <Badge variant="outline" className="font-normal">{bom ? `BOM v${bom.version ?? "?"}` : "Sans BOM"}</Badge>
                    </div>
                    {!detail ? (
                      <div className="space-y-2">
                        {[0, 1, 2].map((i) => <div key={i} className="h-6 rounded bg-muted animate-pulse" />)}
                      </div>
                    ) : (
                      <Tabs defaultValue="overview">
                        <TabsList className="w-full justify-start overflow-x-auto">
                          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
                          <TabsTrigger value="shifts">Shifts ({detail.shifts.length})</TabsTrigger>
                          <TabsTrigger value="cons">Consommations ({detail.consumptions.length})</TabsTrigger>
                          <TabsTrigger value="checks">Contrôles ({detail.checks.length})</TabsTrigger>
                          <TabsTrigger value="ncs">NC ({detail.ncs.length})</TabsTrigger>
                          <TabsTrigger value="actions">Actions ({detail.actions.length})</TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview" className="pt-4">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {[
                              { label: "Qté prévue", value: detail.of.quantite_prevue ?? "—" },
                              { label: "Qté produite", value: detail.of.quantite_produite ?? "—" },
                              { label: "Rebut", value: detail.of.quantite_rebut ?? "—" },
                            ].map((k) => (
                              <div key={k.label} className="rounded-lg border bg-muted/30 p-3">
                                <div className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">{k.label}</div>
                                <div className="text-lg font-bold tabular-nums">{k.value}</div>
                              </div>
                            ))}
                          </div>
                          <dl className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                            <div className="flex justify-between gap-2 border-b py-1">
                              <dt className="text-muted-foreground">Recette</dt><dd className="font-medium text-right">{detail.of.recipe_label ?? "—"}</dd>
                            </div>
                            <div className="flex justify-between gap-2 border-b py-1">
                              <dt className="text-muted-foreground">Nomenclature</dt><dd className="font-medium text-right">{detail.of.bom_label ?? "non lié"}</dd>
                            </div>
                          </dl>
                        </TabsContent>

                        <TabsContent value="shifts" className="pt-4">
                          {detail.shifts.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Aucun shift.</p> : (
                            <ul className="space-y-2">{detail.shifts.map((s, i) => (
                              <li key={i} className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2.5 text-sm">
                                <Badge variant="secondary" className="font-mono">{s.date_shift}</Badge>
                                <span className="font-medium">{s.shift_type}</span>
                                <span className="text-muted-foreground">Équipe : {s.team_label ?? "—"}</span>
                                <span className="text-muted-foreground">Chef : {s.chef_label ?? "—"}</span>
                              </li>
                            ))}</ul>
                          )}
                        </TabsContent>

                        <TabsContent value="cons" className="pt-4">
                          {detail.consumptions.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Aucune consommation.</p> : (
                            <ScrollTable>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Article</TableHead><TableHead className="text-right">Qté</TableHead><TableHead>Unité</TableHead>
                                    <TableHead>Lot</TableHead><TableHead>Batch</TableHead><TableHead>Lot four.</TableHead><TableHead>Péremption</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {detail.consumptions.map((c, i) => (
                                    <TableRow key={i} className="odd:bg-muted/20">
                                      <TableCell className="font-medium">{c.article_label}</TableCell>
                                      <TableCell className="text-right tabular-nums">{c.quantite ?? "—"}</TableCell>
                                      <TableCell>{c.unite ?? "—"}</TableCell>
                                      <TableCell className="font-mono text-xs">{c.lot_number ?? "—"}</TableCell>
                                      <TableCell className="font-mono text-xs">{c.batch_number ?? "—"}</TableCell>
                                      <TableCell className="font-mono text-xs">{c.supplier_lot ?? "—"}</TableCell>
                                      <TableCell>{c.expiry_date ?? "—"}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </ScrollTable>
                          )}
                        </TabsContent>

                        <TabsContent value="checks" className="pt-4">
                          {detail.checks.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Aucun contrôle.</p> : (
                            <ul className="space-y-1.5 max-h-[45vh] overflow-y-auto pr-1">{detail.checks.map((c, i) => (
                              <li key={i} className={`flex items-center gap-3 rounded-md border p-2.5 text-sm ${c.is_conform === false ? "border-destructive/40 bg-destructive/5" : "bg-card"}`}>
                                <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-[110px]">
                                  {new Date(c.control_time).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                </span>
                                <span className="flex-1 min-w-0 truncate">{c.indicator_label}</span>
                                <span className="font-semibold tabular-nums">{String(c.measured) || "—"}</span>
                                {c.is_conform === false ? (
                                  <Badge variant="outline" className="border-destructive/40 text-destructive gap-1 shrink-0"><AlertTriangle className="h-3.5 w-3.5" /> Non conf.</Badge>
                                ) : c.is_conform === true ? (
                                  <Badge variant="outline" className="border-success/40 text-success gap-1 shrink-0"><CheckCircle2 className="h-3.5 w-3.5" /> Conforme</Badge>
                                ) : <span className="text-xs text-muted-foreground shrink-0">—</span>}
                              </li>
                            ))}</ul>
                          )}
                        </TabsContent>

                        <TabsContent value="ncs" className="pt-4">
                          {detail.ncs.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Aucune NC.</p> : (
                            <ul className="space-y-2">{detail.ncs.map((n) => (
                              <li key={n.nc_number} className="rounded-md border bg-card p-2.5 text-sm flex flex-wrap items-center gap-2">
                                <span className="font-mono font-semibold">{n.nc_number}</span>
                                <span className="flex-1 min-w-[120px]">{n.title}</span>
                                <Badge variant={n.severity === "critique" || n.severity === "majeure" ? "destructive" : "secondary"}>{n.severity}</Badge>
                                <Badge variant="outline">{n.status}</Badge>
                                {n.decision && <Badge variant="outline">{n.decision}</Badge>}
                              </li>
                            ))}</ul>
                          )}
                        </TabsContent>

                        <TabsContent value="actions" className="pt-4">
                          {detail.actions.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Aucune action.</p> : (
                            <ul className="space-y-2">{detail.actions.map((a, i) => (
                              <li key={i} className="rounded-md border bg-card p-2.5 text-sm flex flex-wrap items-center gap-2">
                                <span className="flex-1 min-w-[140px] font-medium">{a.title}</span>
                                <Badge variant="secondary">{a.action_type}</Badge>
                                <Badge variant="outline">{a.status}</Badge>
                                {a.due_date && <span className="text-xs text-muted-foreground">échéance {a.due_date}</span>}
                              </li>
                            ))}</ul>
                          )}
                        </TabsContent>
                      </Tabs>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => handleExport(o.id)} disabled={!detail}>
                        <Download className="h-4 w-4 mr-1" /> Export CSV
                      </Button>
                      <Button size="sm" onClick={() => openDecision(o)}>
                        {qs === "bloque" ? <Unlock className="h-4 w-4 mr-1" /> : <Lock className="h-4 w-4 mr-1" />}
                        Décision qualité
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ResponsiveDialog
        open={decisionFor !== null}
        onOpenChange={(v) => { if (!v && !savingDecision) setDecisionFor(null); }}
        title={decisionFor ? `Décision qualité — ${decisionFor.numero}` : ""}
        description="Le statut qualité de l'OF est historisé dans l'audit."
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Statut</label>
            <Select value={decision} onValueChange={setDecision}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en_attente">En attente</SelectItem>
                <SelectItem value="libere">Libérer</SelectItem>
                <SelectItem value="bloque">Bloquer</SelectItem>
                <SelectItem value="rebut">Rebut</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Motif (optionnel)</label>
            <Input placeholder="Ex. contrôle poids non conforme" value={decisionReason} onChange={(e) => setDecisionReason(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" disabled={savingDecision} onClick={() => setDecisionFor(null)}>Annuler</Button>
            <Button disabled={savingDecision} onClick={saveDecision}>{savingDecision ? "Enregistrement…" : "Enregistrer"}</Button>
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}

