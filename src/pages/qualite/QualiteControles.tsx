import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveDialog } from "@/components/responsive/ResponsiveDialog";
import { ClipboardList, Plus, RotateCcw, Search, Download, AlertOctagon } from "lucide-react";
import { Link } from "react-router-dom";
import { exportToCsv } from "@/lib/exportCsv";
import { logAudit } from "@/lib/audit";
import { parseDecimal } from "@/pages/qualite/QualiteIndicateurs";
import { notifyCheckOutOfTolerance } from "@/lib/qualityNotifications";
import { useActiveQualityShift } from "@/hooks/useActiveQualityShift";

const ALL = "__all__";
const NONE = "__none__";

// ----------------- Pure helpers (exported for tests) -----------------

export interface ConformityInput {
  indicator_type: "numeric" | "boolean" | "text" | "select";
  measured_value_numeric?: number | null;
  measured_value_boolean?: boolean | null;
  target_value?: number | null;
  min_value?: number | null;
  max_value?: number | null;
  tolerance_minus?: number | null;
  tolerance_plus?: number | null;
}

export interface ConformityResult {
  is_conform: boolean | null;
  deviation_value: number | null;
  deviation_percent: number | null;
  out_of_tolerance: boolean;
}

export function computeConformity(i: ConformityInput): ConformityResult {
  let is_conform: boolean | null = null;
  let deviation_value: number | null = null;
  let deviation_percent: number | null = null;
  let out_of_tolerance = false;

  if (i.indicator_type === "numeric" && i.measured_value_numeric != null) {
    const v = i.measured_value_numeric;
    const minOk = i.min_value == null || v >= i.min_value;
    const maxOk = i.max_value == null || v <= i.max_value;
    is_conform = minOk && maxOk;
    if (i.target_value != null) {
      deviation_value = v - i.target_value;
      deviation_percent = i.target_value !== 0 ? (deviation_value / i.target_value) * 100 : null;
      const tm = i.tolerance_minus;
      const tp = i.tolerance_plus;
      if ((tm != null && v < i.target_value - tm) || (tp != null && v > i.target_value + tp)) {
        out_of_tolerance = true;
      }
    }
  } else if (i.indicator_type === "boolean" && i.measured_value_boolean != null) {
    is_conform = i.measured_value_boolean;
  }
  return { is_conform, deviation_value, deviation_percent, out_of_tolerance };
}

export interface CheckFormState {
  of_id: string;
  indicator_id: string;
  value_text: string; // numeric or text input
  value_boolean: boolean;
  selected_value: string;
  comment: string;
}

export const emptyCheckForm = (): CheckFormState => ({
  of_id: "",
  indicator_id: "",
  value_text: "",
  value_boolean: false,
  selected_value: "",
  comment: "",
});

export function validateCheck(
  f: CheckFormState,
  indicatorType?: string,
): string | null {
  if (!f.of_id) return "OF obligatoire";
  if (!f.indicator_id) return "Indicateur obligatoire";
  if (indicatorType === "numeric") {
    const v = parseDecimal(f.value_text);
    if (v == null) return "Valeur numérique obligatoire";
  } else if (indicatorType === "text") {
    if (!f.value_text.trim()) return "Valeur obligatoire";
  } else if (indicatorType === "select") {
    if (!f.selected_value) return "Choix obligatoire";
  }
  return null;
}

// ----------------- Filtering helpers -----------------

export interface FilterState {
  q: string;
  of: string;
  product: string;
  line: string;
  conformity: string; // all | conform | nonconform | unknown
  dateFrom: string;
  dateTo: string;
}

export const emptyFilters = (): FilterState => ({
  q: "", of: ALL, product: ALL, line: ALL, conformity: ALL, dateFrom: "", dateTo: "",
});

export interface QcRow {
  id: string;
  of_id: string;
  product_id: string | null;
  production_line_id: string | null;
  indicator_id: string;
  measured_value_numeric: number | null;
  measured_value_text: string | null;
  measured_value_boolean: boolean | null;
  selected_value: string | null;
  unit: string | null;
  target_value: number | null;
  min_value: number | null;
  max_value: number | null;
  is_conform: boolean | null;
  control_time: string;
  comment: string;
  controlled_by: string | null;
}

export function filterChecks(
  rows: QcRow[],
  f: FilterState,
  ctx: {
    ofLabel: (id: string) => string;
    indLabel: (id: string) => string;
  },
): QcRow[] {
  const ql = f.q.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.of !== ALL && r.of_id !== f.of) return false;
    if (f.product !== ALL && (r.product_id || "") !== f.product) return false;
    if (f.line !== ALL && (r.production_line_id || "") !== f.line) return false;
    if (f.conformity === "conform" && r.is_conform !== true) return false;
    if (f.conformity === "nonconform" && r.is_conform !== false) return false;
    if (f.conformity === "unknown" && r.is_conform != null) return false;
    if (f.dateFrom && r.control_time < f.dateFrom) return false;
    if (f.dateTo && r.control_time > f.dateTo + "T23:59:59") return false;
    if (ql) {
      const hay = `${ctx.ofLabel(r.of_id)} ${ctx.indLabel(r.indicator_id)} ${r.comment ?? ""}`.toLowerCase();
      if (!hay.includes(ql)) return false;
    }
    return true;
  });
}

// ----------------- Component -----------------

interface OFRow { id: string; numero: string; product_id: string | null; line_id: string | null; }
interface ProductRow { id: string; name: string | null; designation: string | null; code: string | null; }
interface LineRow { id: string; name: string | null; designation: string | null; code: string | null; }
interface IndicatorRow {
  indicator_id: string;
  code: string;
  name: string;
  indicator_type: string;
  unit: string | null;
  target_value: number | null;
  min_value: number | null;
  max_value: number | null;
  tolerance_minus: number | null;
  tolerance_plus: number | null;
  select_options: string[] | null;
  effective_is_required: boolean;
  effective_is_blocking: boolean;
}

const labelOf = (r?: { name?: string | null; designation?: string | null; code?: string | null; id?: string }) => {
  if (!r) return "—";
  return r.name || r.designation || r.code || r.id?.slice(0, 6) || "—";
};

export default function QualiteControles() {
  const { user } = useAuth();
  const { canCreate } = usePermissions();
  const { toast } = useToast();
  const { shift: activeQualityShift } = useActiveQualityShift();

  const [rows, setRows] = useState<QcRow[]>([]);
  const [ofs, setOfs] = useState<OFRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [lines, setLines] = useState<LineRow[]>([]);
  const [allIndicators, setAllIndicators] = useState<Record<string, { code: string; name: string }>>({});
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState<FilterState>(emptyFilters());

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CheckFormState>(emptyCheckForm());
  const [applicable, setApplicable] = useState<IndicatorRow[]>([]);
  const [loadingApplicable, setLoadingApplicable] = useState(false);
  const [saving, setSaving] = useState(false);

  const ofById = useMemo(() => new Map(ofs.map((o) => [o.id, o])), [ofs]);
  const prodById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const lineById = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines]);

  const load = async () => {
    setLoading(true);
    const [qc, of, pr, ln, qi] = await Promise.all([
      (supabase as any).from("quality_checks").select("*").order("control_time", { ascending: false }).limit(500),
      (supabase as any).from("ordres_fabrication").select("id, numero, product_id, line_id").order("created_at", { ascending: false }).limit(500),
      (supabase as any).from("products").select("id, name, designation, code"),
      (supabase as any).from("production_lines").select("id, name, designation, code"),
      (supabase as any).from("quality_indicators").select("id, code, name"),
    ]);
    setRows(qc.data || []);
    setOfs(of.data || []);
    setProducts(pr.data || []);
    setLines(ln.data || []);
    const idx: Record<string, { code: string; name: string }> = {};
    (qi.data || []).forEach((i: any) => { idx[i.id] = { code: i.code, name: i.name }; });
    setAllIndicators(idx);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const ofLabel = (id: string) => ofById.get(id)?.numero ?? id.slice(0, 6);
  const indLabel = (id: string) => {
    const r = allIndicators[id];
    return r ? `${r.code} ${r.name}` : id.slice(0, 6);
  };

  const filtered = useMemo(
    () => filterChecks(rows, filters, { ofLabel, indLabel }),
    [rows, filters, ofById, allIndicators],
  );

  const filtersActive =
    filters.q.trim() !== "" || filters.of !== ALL || filters.product !== ALL ||
    filters.line !== ALL || filters.conformity !== ALL || filters.dateFrom !== "" || filters.dateTo !== "";

  const resetFilters = () => setFilters(emptyFilters());

  // When OF changes in dialog, fetch applicable indicators.
  useEffect(() => {
    if (!form.of_id) { setApplicable([]); return; }
    setLoadingApplicable(true);
    (supabase as any).rpc("get_quality_indicators_for_of", { p_of_id: form.of_id })
      .then(({ data, error }: any) => {
        if (error) toast({ title: "Erreur indicateurs", description: error.message, variant: "destructive" });
        setApplicable(data || []);
        setLoadingApplicable(false);
      });
  }, [form.of_id]);

  const currentIndicator = applicable.find((i) => i.indicator_id === form.indicator_id);
  const currentOf = form.of_id ? ofById.get(form.of_id) : undefined;
  const currentProduct = currentOf?.product_id ? prodById.get(currentOf.product_id) : undefined;
  const currentLine = currentOf?.line_id ? lineById.get(currentOf.line_id) : undefined;

  // Live conformity preview
  const preview: ConformityResult | null = useMemo(() => {
    if (!currentIndicator) return null;
    const t = currentIndicator.indicator_type as ConformityInput["indicator_type"];
    return computeConformity({
      indicator_type: t,
      measured_value_numeric: t === "numeric" ? parseDecimal(form.value_text) : null,
      measured_value_boolean: t === "boolean" ? form.value_boolean : null,
      target_value: currentIndicator.target_value,
      min_value: currentIndicator.min_value,
      max_value: currentIndicator.max_value,
      tolerance_minus: currentIndicator.tolerance_minus,
      tolerance_plus: currentIndicator.tolerance_plus,
    });
  }, [currentIndicator, form.value_text, form.value_boolean]);

  const openNew = () => { setForm(emptyCheckForm()); setApplicable([]); setOpen(true); };

  const handleSave = async () => {
    const err = validateCheck(form, currentIndicator?.indicator_type);
    if (err) { toast({ title: err, variant: "destructive" }); return; }
    setSaving(true);
    const t = currentIndicator!.indicator_type;
    // Auto-fill quality shift context if controller has an active shift
    let prodShiftId: string | null = null;
    if (activeQualityShift && currentOf?.line_id) {
      const { data: prodShift } = await (supabase as any)
        .from("shifts")
        .select("id")
        .eq("line_id", currentOf.line_id)
        .eq("is_active", true)
        .eq("date_shift", new Date().toISOString().slice(0, 10))
        .limit(1)
        .maybeSingle();
      prodShiftId = prodShift?.id ?? null;
    }
    const payload: any = {
      of_id: form.of_id,
      product_id: currentOf?.product_id ?? null,
      production_line_id: currentOf?.line_id ?? null,
      indicator_id: form.indicator_id,
      measured_value_numeric: t === "numeric" ? parseDecimal(form.value_text) : null,
      measured_value_text: t === "text" ? form.value_text.trim() : null,
      measured_value_boolean: t === "boolean" ? form.value_boolean : null,
      selected_value: t === "select" ? form.selected_value : null,
      unit: currentIndicator!.unit,
      target_value: currentIndicator!.target_value,
      min_value: currentIndicator!.min_value,
      max_value: currentIndicator!.max_value,
      comment: form.comment.trim(),
      controlled_by: user?.id ?? null,
      quality_shift_id: activeQualityShift?.id ?? null,
      shift_id: prodShiftId,
      team_id: activeQualityShift?.shift_team_id ?? null,
      status: "submitted",
      validation_status: "not_required",
    };
    const { data, error } = await (supabase as any)
      .from("quality_checks").insert(payload).select().single();
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    await logAudit({
      action_type: "create",
      module: "parametres" as any,
      entity_type: "quality_check",
      entity_id: data.id,
      entity_label: `${currentIndicator!.code} – ${ofLabel(form.of_id)}`,
      action_label: "Contrôle qualité enregistré",
      new_values: payload,
      severity: data.is_conform === false ? "low" : "info",
    });
    toast({ title: "Contrôle enregistré" });
    if (data.is_conform === false) {
      await notifyCheckOutOfTolerance({ entity_id: data.id, entity_label: currentIndicator?.code ?? null, of_label: ofLabel(form.of_id) });
    }
    setOpen(false);
    setSaving(false);
    load();
  };

  const handleExport = () => {
    exportToCsv(filtered as any, [
      { key: "control_time", label: "Date" },
      { key: "of_id", label: "OF", format: (v) => ofLabel(v as string) },
      { key: "indicator_id", label: "Indicateur", format: (v) => indLabel(v as string) },
      { key: "measured_value_numeric", label: "Valeur (num)" },
      { key: "measured_value_text", label: "Valeur (texte)" },
      { key: "measured_value_boolean", label: "Valeur (bool)" },
      { key: "selected_value", label: "Choix" },
      { key: "unit", label: "Unité" },
      { key: "target_value", label: "Cible" },
      { key: "min_value", label: "Min" },
      { key: "max_value", label: "Max" },
      { key: "is_conform", label: "Conforme", format: (v) => v == null ? "—" : v ? "Oui" : "Non" },
      { key: "comment", label: "Commentaire" },
    ], "controles_qualite");
  };

  const renderConformityBadge = (r: QcRow) => {
    if (r.is_conform == null) return <span className="text-muted-foreground">—</span>;
    return r.is_conform
      ? <Badge>Conforme</Badge>
      : <Badge variant="destructive">Non conforme</Badge>;
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Historique des contrôles
          </h1>
          <p className="text-sm text-muted-foreground">Journal et suivi des contrôles réalisés par OF</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          {canCreate("qualite") && (
            <Button onClick={openNew}><Plus className="h-4 w-4" /> Nouveau contrôle</Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Recherche OF, indicateur, commentaire…"
                className="pl-9"
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              />
            </div>
            <Select value={filters.of} onValueChange={(v) => setFilters({ ...filters, of: v })}>
              <SelectTrigger><SelectValue placeholder="OF" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous OFs</SelectItem>
                {ofs.map((o) => <SelectItem key={o.id} value={o.id}>{o.numero}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.line} onValueChange={(v) => setFilters({ ...filters, line: v })}>
              <SelectTrigger><SelectValue placeholder="Ligne" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Toutes lignes</SelectItem>
                {lines.map((l) => <SelectItem key={l.id} value={l.id}>{labelOf(l)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.product} onValueChange={(v) => setFilters({ ...filters, product: v })}>
              <SelectTrigger><SelectValue placeholder="Produit" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous produits</SelectItem>
                {products.map((p) => <SelectItem key={p.id} value={p.id}>{labelOf(p)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.conformity} onValueChange={(v) => setFilters({ ...filters, conformity: v })}>
              <SelectTrigger><SelectValue placeholder="Conformité" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Toutes</SelectItem>
                <SelectItem value="conform">Conformes</SelectItem>
                <SelectItem value="nonconform">Non conformes</SelectItem>
                <SelectItem value="unknown">Non évalués</SelectItem>
              </SelectContent>
            </Select>
            <div>
              <Label className="text-xs">Du</Label>
              <Input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Au</Label>
              <Input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
            </div>
          </div>
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <RotateCcw className="h-4 w-4" /> Réinitialiser les filtres
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>OF</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Ligne</TableHead>
                <TableHead>Indicateur</TableHead>
                <TableHead>Valeur</TableHead>
                <TableHead>Cible / Min-Max</TableHead>
                <TableHead>Conformité</TableHead>
                <TableHead>Commentaire</TableHead>
                <TableHead className="w-[100px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">Chargement…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">Aucun contrôle</TableCell></TableRow>
              ) : filtered.map((r) => {
                const value =
                  r.measured_value_numeric != null ? `${r.measured_value_numeric}${r.unit ? " " + r.unit : ""}` :
                  r.measured_value_boolean != null ? (r.measured_value_boolean ? "Oui" : "Non") :
                  r.selected_value ? r.selected_value :
                  r.measured_value_text ?? "—";
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">{new Date(r.control_time).toLocaleString("fr-FR")}</TableCell>
                    <TableCell className="font-mono text-xs">{ofLabel(r.of_id)}</TableCell>
                    <TableCell>{r.product_id ? labelOf(prodById.get(r.product_id)) : "—"}</TableCell>
                    <TableCell>{r.production_line_id ? labelOf(lineById.get(r.production_line_id)) : "—"}</TableCell>
                    <TableCell>{indLabel(r.indicator_id)}</TableCell>
                    <TableCell className="font-medium">{value}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {r.target_value ?? "—"} / [{r.min_value ?? "—"}, {r.max_value ?? "—"}]
                    </TableCell>
                    <TableCell>{renderConformityBadge(r)}</TableCell>
                    <TableCell className="max-w-xs truncate">{r.comment || "—"}</TableCell>
                    <TableCell>
                      {r.is_conform === false && (
                        <Button asChild size="sm" variant="outline" title="Créer une non-conformité">
                          <Link to={`/qualite/non-conformites?from_check=${r.id}`}>
                            <AlertOctagon className="h-3.5 w-3.5" /> NC
                          </Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Nouveau contrôle qualité"
        className="sm:max-w-2xl"
      >
        <div className="space-y-4">
          <div>
            <Label>OF *</Label>
            <Select value={form.of_id || NONE} onValueChange={(v) => setForm({ ...form, of_id: v === NONE ? "" : v, indicator_id: "" })}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un OF" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {ofs.map((o) => <SelectItem key={o.id} value={o.id}>{o.numero}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {currentOf && (
            <div className="grid gap-3 sm:grid-cols-2 rounded-md border p-3 bg-muted/30">
              <div>
                <Label className="text-xs text-muted-foreground">Produit</Label>
                <div className="text-sm">{currentProduct ? labelOf(currentProduct) : "—"}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Ligne</Label>
                <div className="text-sm">{currentLine ? labelOf(currentLine) : "—"}</div>
              </div>
            </div>
          )}

          <div>
            <Label>Indicateur applicable *</Label>
            <Select
              value={form.indicator_id || NONE}
              onValueChange={(v) => setForm({ ...form, indicator_id: v === NONE ? "" : v, value_text: "", value_boolean: false, selected_value: "" })}
              disabled={!form.of_id || loadingApplicable}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingApplicable ? "Chargement…" : (applicable.length === 0 ? "Aucun indicateur applicable" : "Sélectionner")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {applicable.map((i) => (
                  <SelectItem key={i.indicator_id} value={i.indicator_id}>
                    {i.code} – {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentIndicator && (
            <div className="rounded-md border p-3 space-y-3">
              <div className="text-xs text-muted-foreground">
                Cible: {currentIndicator.target_value ?? "—"}{currentIndicator.unit ? " " + currentIndicator.unit : ""}
                {" · "}Min/Max: [{currentIndicator.min_value ?? "—"}, {currentIndicator.max_value ?? "—"}]
              </div>

              {currentIndicator.indicator_type === "numeric" && (
                <div>
                  <Label>Valeur mesurée *</Label>
                  <Input
                    inputMode="decimal"
                    value={form.value_text}
                    onChange={(e) => setForm({ ...form, value_text: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
              )}
              {currentIndicator.indicator_type === "boolean" && (
                <label className="flex items-center gap-2">
                  <Switch checked={form.value_boolean} onCheckedChange={(v) => setForm({ ...form, value_boolean: v })} />
                  Conforme
                </label>
              )}
              {currentIndicator.indicator_type === "text" && (
                <div>
                  <Label>Valeur *</Label>
                  <Textarea rows={2} value={form.value_text} onChange={(e) => setForm({ ...form, value_text: e.target.value })} />
                </div>
              )}
              {currentIndicator.indicator_type === "select" && (
                <div>
                  <Label>Choix *</Label>
                  <Select value={form.selected_value || NONE} onValueChange={(v) => setForm({ ...form, selected_value: v === NONE ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>—</SelectItem>
                      {(currentIndicator.select_options ?? []).map((o) => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {preview && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {preview.is_conform === true && <Badge>Conforme</Badge>}
                  {preview.is_conform === false && <Badge variant="destructive">Non conforme</Badge>}
                  {preview.is_conform == null && <Badge variant="outline">Non évalué</Badge>}
                  {preview.out_of_tolerance && <Badge variant="destructive">Hors tolérance</Badge>}
                  {preview.deviation_value != null && (
                    <Badge variant="outline">Δ {preview.deviation_value}</Badge>
                  )}
                  {preview.deviation_percent != null && (
                    <Badge variant="outline">Δ {preview.deviation_percent.toFixed(2)}%</Badge>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <Label>Commentaire</Label>
            <Textarea rows={2} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving || !form.of_id || !form.indicator_id}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
