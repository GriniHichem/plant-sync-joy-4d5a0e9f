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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveDialog } from "@/components/responsive/ResponsiveDialog";
import { Plus, Edit, RotateCcw, Search, Trash2, Link2 } from "lucide-react";
import { logAudit } from "@/lib/audit";
import { FREQUENCIES } from "@/pages/qualite/QualiteIndicateurs";

const NONE = "__none__";
const ALL = "__all__";

export interface AssignmentFormState {
  indicator_id: string;
  product_id: string;
  product_family_id: string;
  production_line_id: string;
  recipe_id: string;
  is_required: boolean;
  is_blocking: boolean;
  frequency_type: string; // "" = inherit
  frequency_minutes: string; // "" = inherit
  notes: string;
}

export const emptyAssignmentForm = (): AssignmentFormState => ({
  indicator_id: "",
  product_id: NONE,
  product_family_id: NONE,
  production_line_id: NONE,
  recipe_id: NONE,
  is_required: false,
  is_blocking: false,
  frequency_type: "",
  frequency_minutes: "",
  notes: "",
});

const orNull = (v: string) => (v && v !== NONE ? v : null);

const minutesOrNull = (s: string): number | null => {
  const t = (s ?? "").toString().trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

export function buildAssignmentPayload(f: AssignmentFormState) {
  return {
    indicator_id: f.indicator_id,
    product_id: orNull(f.product_id),
    product_family_id: orNull(f.product_family_id),
    production_line_id: orNull(f.production_line_id),
    recipe_id: orNull(f.recipe_id),
    is_required: !!f.is_required,
    is_blocking: !!f.is_blocking,
    frequency_type: f.frequency_type ? f.frequency_type : null,
    frequency_minutes: minutesOrNull(f.frequency_minutes),
    notes: f.notes.trim(),
  };
}

export function validateAssignment(f: AssignmentFormState, allowGlobal: boolean): string | null {
  if (!f.indicator_id) return "Indicateur obligatoire";
  const hasScope =
    orNull(f.product_id) || orNull(f.product_family_id) ||
    orNull(f.production_line_id) || orNull(f.recipe_id);
  if (!hasScope && !allowGlobal) return "Sélectionnez au moins une cible (ou cochez Global)";
  return null;
}

export function scopeOf(a: { product_id: string | null; product_family_id: string | null; production_line_id: string | null; recipe_id: string | null }) {
  if (a.recipe_id) return "recipe";
  if (a.product_id) return "product";
  if (a.product_family_id) return "family";
  if (a.production_line_id) return "line";
  return "global";
}

const SCOPE_LABEL: Record<string, string> = {
  global: "Global", product: "Produit", family: "Famille", line: "Ligne", recipe: "Recette",
};

interface Indicator { id: string; code: string; name: string; is_active: boolean; }
interface NamedRow { id: string; code?: string | null; name?: string | null; designation?: string | null; }
interface Assignment {
  id: string;
  indicator_id: string;
  product_id: string | null;
  product_family_id: string | null;
  production_line_id: string | null;
  recipe_id: string | null;
  is_required: boolean;
  is_blocking: boolean;
  frequency_type: string | null;
  frequency_minutes: number | null;
  notes: string;
  updated_at: string;
}

const labelOf = (r?: NamedRow | null) => {
  if (!r) return "—";
  return r.name || r.designation || r.code || r.id.slice(0, 6);
};

export default function QualityIndicatorAssignments() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { toast } = useToast();

  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [products, setProducts] = useState<NamedRow[]>([]);
  const [families, setFamilies] = useState<NamedRow[]>([]);
  const [lines, setLines] = useState<NamedRow[]>([]);
  const [recipes, setRecipes] = useState<NamedRow[]>([]);
  const [rows, setRows] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [fIndicator, setFIndicator] = useState(ALL);
  const [fScope, setFScope] = useState(ALL);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AssignmentFormState>(emptyAssignmentForm());
  const [explicitGlobal, setExplicitGlobal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Assignment | null>(null);

  const canManage = canCreate("qualite_indicateurs") || canEdit("qualite_indicateurs");

  const load = async () => {
    setLoading(true);
    const [ind, prod, fam, ln, rec, asg] = await Promise.all([
      (supabase as any).from("quality_indicators").select("id, code, name, is_active").order("code"),
      (supabase as any).from("products").select("id, code, name, designation").order("name", { nullsFirst: false }),
      (supabase as any).from("product_families").select("id, name").order("name"),
      (supabase as any).from("production_lines").select("id, code, name, designation").order("name", { nullsFirst: false }),
      (supabase as any).from("recipes").select("id, code, name, designation").order("name", { nullsFirst: false }),
      (supabase as any).from("quality_indicator_assignments").select("*").order("updated_at", { ascending: false }),
    ]);
    if (ind.error) toast({ title: "Erreur indicateurs", description: ind.error.message, variant: "destructive" });
    setIndicators(ind.data || []);
    setProducts(prod.data || []);
    setFamilies(fam.data || []);
    setLines(ln.data || []);
    setRecipes(rec.data || []);
    setRows(asg.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const indById = useMemo(() => new Map(indicators.map((i) => [i.id, i])), [indicators]);
  const prodById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const famById = useMemo(() => new Map(families.map((f) => [f.id, f])), [families]);
  const lineById = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines]);
  const recById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  const filtersActive = q.trim() !== "" || fIndicator !== ALL || fScope !== ALL;
  const resetFilters = () => { setQ(""); setFIndicator(ALL); setFScope(ALL); };

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (fIndicator !== ALL && r.indicator_id !== fIndicator) return false;
      const sc = scopeOf(r);
      if (fScope !== ALL && sc !== fScope) return false;
      if (ql) {
        const ind = indById.get(r.indicator_id);
        const target =
          labelOf(prodById.get(r.product_id || "")) + " " +
          labelOf(famById.get(r.product_family_id || "")) + " " +
          labelOf(lineById.get(r.production_line_id || "")) + " " +
          labelOf(recById.get(r.recipe_id || ""));
        const hay = `${ind?.code ?? ""} ${ind?.name ?? ""} ${target}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [rows, q, fIndicator, fScope, indById, prodById, famById, lineById, recById]);

  const openNew = () => {
    setEditId(null);
    setForm(emptyAssignmentForm());
    setExplicitGlobal(false);
    setOpen(true);
  };

  const openEdit = (a: Assignment) => {
    setEditId(a.id);
    setForm({
      indicator_id: a.indicator_id,
      product_id: a.product_id || NONE,
      product_family_id: a.product_family_id || NONE,
      production_line_id: a.production_line_id || NONE,
      recipe_id: a.recipe_id || NONE,
      is_required: a.is_required,
      is_blocking: a.is_blocking,
      frequency_type: a.frequency_type ?? "",
      frequency_minutes: a.frequency_minutes != null ? String(a.frequency_minutes) : "",
      notes: a.notes ?? "",
    });
    setExplicitGlobal(scopeOf(a) === "global");
    setOpen(true);
  };

  const handleSave = async () => {
    const err = validateAssignment(form, explicitGlobal);
    if (err) { toast({ title: err, variant: "destructive" }); return; }
    const payload = buildAssignmentPayload(form);
    const isEdit = !!editId;

    // Garde anti-doublon : même indicateur déjà affecté au même périmètre
    const dup = rows.find(
      (a) =>
        a.id !== editId &&
        a.indicator_id === payload.indicator_id &&
        (a.product_id ?? null) === payload.product_id &&
        (a.product_family_id ?? null) === payload.product_family_id &&
        (a.production_line_id ?? null) === payload.production_line_id &&
        (a.recipe_id ?? null) === payload.recipe_id,
    );
    if (dup) {
      toast({
        title: "Contrôle déjà affecté",
        description: "Ce contrôle est déjà affecté à ce périmètre. Modifiez l'affectation existante.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const meta = isEdit
      ? { ...payload, updated_by: user?.id ?? null }
      : { ...payload, created_by: user?.id ?? null, updated_by: user?.id ?? null };

    const res = isEdit
      ? await (supabase as any).from("quality_indicator_assignments").update(meta).eq("id", editId).select().single()
      : await (supabase as any).from("quality_indicator_assignments").insert(meta).select().single();

    if (res.error) {
      const isDup = res.error.code === "23505" || /déjà existante|duplicate key/i.test(res.error.message ?? "");
      toast({
        title: isDup ? "Contrôle déjà affecté" : "Erreur",
        description: isDup
          ? "Ce contrôle est déjà affecté à ce périmètre. Modifiez l'affectation existante."
          : res.error.message,
        variant: "destructive",
      });
      setSaving(false);
      return;
    }


    const ind = indById.get(payload.indicator_id);
    await logAudit({
      action_type: isEdit ? "update" : "create",
      module: "parametres" as any,
      entity_type: "quality_indicator_assignment",
      entity_id: res.data.id,
      entity_label: ind ? `${ind.code} – ${ind.name}` : "Affectation indicateur",
      action_label: isEdit ? "Affectation indicateur modifiée" : "Affectation indicateur créée",
      new_values: payload,
      severity: "info",
    });
    toast({ title: isEdit ? "Affectation modifiée" : "Affectation créée" });
    setOpen(false);
    setSaving(false);
    load();
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    const a = confirmDel;
    const { error } = await (supabase as any)
      .from("quality_indicator_assignments").delete().eq("id", a.id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    const ind = indById.get(a.indicator_id);
    await logAudit({
      action_type: "delete",
      module: "parametres" as any,
      entity_type: "quality_indicator_assignment",
      entity_id: a.id,
      entity_label: ind ? `${ind.code} – ${ind.name}` : "Affectation indicateur",
      action_label: "Affectation indicateur supprimée",
      old_values: { ...a } as any,
      severity: "low",
    });
    toast({ title: "Affectation supprimée" });
    setConfirmDel(null);
    load();
  };

  const renderTarget = (a: Assignment) => {
    const sc = scopeOf(a);
    if (sc === "global") return <span className="text-muted-foreground">—</span>;
    if (sc === "recipe") return labelOf(recById.get(a.recipe_id!));
    if (sc === "product") return labelOf(prodById.get(a.product_id!));
    if (sc === "family") return labelOf(famById.get(a.product_family_id!));
    return labelOf(lineById.get(a.production_line_id!));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Affectations des indicateurs
          </h2>
          <p className="text-sm text-muted-foreground">
            Définissez quels indicateurs s'appliquent par produit, famille, ligne ou recette.
          </p>
        </div>
        {canCreate("qualite_indicateurs") && (
          <Button onClick={openNew}><Plus className="h-4 w-4" /> Nouvelle affectation</Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Recherche indicateur ou cible…"
                className="pl-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Select value={fIndicator} onValueChange={setFIndicator}>
              <SelectTrigger><SelectValue placeholder="Indicateur" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous indicateurs</SelectItem>
                {indicators.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.code} – {i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fScope} onValueChange={setFScope}>
              <SelectTrigger><SelectValue placeholder="Portée" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Toutes portées</SelectItem>
                {Object.entries(SCOPE_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                <TableHead>Indicateur</TableHead>
                <TableHead>Portée</TableHead>
                <TableHead>Cible</TableHead>
                <TableHead>Requis</TableHead>
                <TableHead>Bloquant</TableHead>
                <TableHead>Fréquence (override)</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Chargement…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Aucune affectation</TableCell></TableRow>
              ) : filtered.map((a) => {
                const ind = indById.get(a.indicator_id);
                const sc = scopeOf(a);
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      {ind ? <><span className="font-mono text-xs">{ind.code}</span> · {ind.name}</> : a.indicator_id.slice(0, 6)}
                    </TableCell>
                    <TableCell><Badge variant="outline">{SCOPE_LABEL[sc]}</Badge></TableCell>
                    <TableCell>{renderTarget(a)}</TableCell>
                    <TableCell>{a.is_required ? <Badge>Oui</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{a.is_blocking ? <Badge variant="destructive">Oui</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      {a.frequency_type ? (FREQUENCIES.find((f) => f.value === a.frequency_type)?.label ?? a.frequency_type) : <span className="text-muted-foreground">hérité</span>}
                      {a.frequency_minutes != null && <span className="ml-1 text-xs text-muted-foreground">({a.frequency_minutes} min)</span>}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {canEdit("qualite_indicateurs") && (
                        <Button size="sm" variant="ghost" onClick={() => openEdit(a)}><Edit className="h-4 w-4" /></Button>
                      )}
                      {canDelete("qualite_indicateurs") && (
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDel(a)}><Trash2 className="h-4 w-4" /></Button>
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
        title={editId ? "Modifier l'affectation" : "Nouvelle affectation d'indicateur"}
        className="sm:max-w-2xl"
      >
        <div className="space-y-4">
          <div>
            <Label>Indicateur *</Label>
            <Select value={form.indicator_id} onValueChange={(v) => setForm({ ...form, indicator_id: v })}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un indicateur" /></SelectTrigger>
              <SelectContent>
                {indicators.filter((i) => i.is_active).map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.code} – {i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Périmètre</Label>
                <p className="text-xs text-muted-foreground">
                  Sélectionnez une ou plusieurs cibles, ou cochez Global pour appliquer à tous.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={explicitGlobal} onCheckedChange={(v) => {
                  setExplicitGlobal(v);
                  if (v) setForm({ ...form, product_id: NONE, product_family_id: NONE, production_line_id: NONE, recipe_id: NONE });
                }} />
                Global
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Produit</Label>
                <Select disabled={explicitGlobal} value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {products.map((p) => <SelectItem key={p.id} value={p.id}>{labelOf(p)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Famille produit</Label>
                <Select disabled={explicitGlobal} value={form.product_family_id} onValueChange={(v) => setForm({ ...form, product_family_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {families.map((f) => <SelectItem key={f.id} value={f.id}>{labelOf(f)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ligne</Label>
                <Select disabled={explicitGlobal} value={form.production_line_id} onValueChange={(v) => setForm({ ...form, production_line_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {lines.map((l) => <SelectItem key={l.id} value={l.id}>{labelOf(l)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Recette</Label>
                <Select disabled={explicitGlobal} value={form.recipe_id} onValueChange={(v) => setForm({ ...form, recipe_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {recipes.map((r) => <SelectItem key={r.id} value={r.id}>{labelOf(r)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Fréquence (override)</Label>
              <Select value={form.frequency_type || NONE} onValueChange={(v) => setForm({ ...form, frequency_type: v === NONE ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="hérité" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Hériter de l'indicateur</SelectItem>
                  {FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fréquence (minutes)</Label>
              <Input
                inputMode="numeric"
                value={form.frequency_minutes}
                onChange={(e) => setForm({ ...form, frequency_minutes: e.target.value })}
                placeholder="hérité — ex : 30, 60"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2"><Switch checked={form.is_required} onCheckedChange={(v) => setForm({ ...form, is_required: v })} /> Requis</label>
            <label className="flex items-center gap-2"><Switch checked={form.is_blocking} onCheckedChange={(v) => setForm({ ...form, is_blocking: v })} /> Bloquant</label>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving || !canManage}>
              {saving ? "Enregistrement…" : editId ? "Modifier" : "Créer"}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'affectation ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
