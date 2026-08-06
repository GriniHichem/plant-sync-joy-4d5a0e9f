import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveDialog } from "@/components/responsive/ResponsiveDialog";
import { ShieldCheck, Plus, Eye, AlertOctagon, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { logAudit } from "@/lib/audit";
import {
  computeConformity,
  emptyCheckForm,
  validateCheck,
  type CheckFormState,
  type ConformityInput,
  type ConformityResult,
} from "@/pages/qualite/QualiteControles";
import { parseDecimal } from "@/pages/qualite/QualiteIndicateurs";
import OfControlPlanManager from "@/components/qualite/OfControlPlanManager";

export const QUALITY_STATUS_OPTIONS = [
  { value: "non_demarre", label: "Non démarré", variant: "secondary" as const },
  { value: "en_controle", label: "En contrôle", variant: "default" as const },
  { value: "conforme", label: "Conforme", variant: "default" as const },
  { value: "conforme_sous_reserve", label: "Conforme sous réserve", variant: "secondary" as const },
  { value: "non_conforme", label: "Non conforme", variant: "destructive" as const },
  { value: "bloque", label: "Bloqué", variant: "destructive" as const },
  { value: "libere", label: "Libéré", variant: "default" as const },
  { value: "rebute", label: "Rebuté", variant: "destructive" as const },
  { value: "a_retraiter", label: "À retraiter", variant: "secondary" as const },
];

export function qualityStatusLabel(s: string | null | undefined): string {
  if (!s) return "Non démarré";
  return QUALITY_STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;
}

// ----------------- KPI helpers (pure, exported for tests) -----------------

export interface QualityKpis {
  applicable: number;
  required: number;
  performed: number;
  missing: number;
  outOfTolerance: number;
}

export function computeQualityKpis(
  applicableIndicators: Array<{ indicator_id: string; effective_is_required: boolean }>,
  checks: Array<{ indicator_id: string; is_conform: boolean | null }>,
): QualityKpis {
  const applicable = applicableIndicators.length;
  const required = applicableIndicators.filter((i) => i.effective_is_required).length;
  const performedSet = new Set(checks.map((c) => c.indicator_id));
  const performed = performedSet.size;
  const requiredIds = new Set(
    applicableIndicators.filter((i) => i.effective_is_required).map((i) => i.indicator_id),
  );
  let missing = 0;
  requiredIds.forEach((id) => { if (!performedSet.has(id)) missing++; });
  const outOfTolerance = checks.filter((c) => c.is_conform === false).length;
  return { applicable, required, performed, missing, outOfTolerance };
}

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

interface CheckRow {
  id: string;
  indicator_id: string;
  measured_value_numeric: number | null;
  measured_value_text: string | null;
  measured_value_boolean: boolean | null;
  selected_value: string | null;
  unit: string | null;
  is_conform: boolean | null;
  control_time: string;
  comment: string | null;
}

interface Props {
  ofId: string;
  ofNumero: string;
  productId: string | null;
  lineId: string | null;
  qualityStatus: string | null;
  canManage: boolean;
  onChanged?: () => void;
}

export default function OfQualityTab({
  ofId, ofNumero, productId, lineId, qualityStatus, canManage, onChanged,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [applicable, setApplicable] = useState<IndicatorRow[]>([]);
  const [checks, setChecks] = useState<CheckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipeInfo, setRecipeInfo] = useState<any | null>(null);
  const [statusValue, setStatusValue] = useState<string>(qualityStatus ?? "non_demarre");
  const [statusReason, setStatusReason] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CheckFormState>(emptyCheckForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => { setStatusValue(qualityStatus ?? "non_demarre"); }, [qualityStatus]);

  const load = async () => {
    setLoading(true);
    const [appRes, checksRes, recipeRes] = await Promise.all([
      (supabase as any).rpc("get_quality_indicators_for_of", { p_of_id: ofId }),
      (supabase as any).from("quality_checks").select("*").eq("of_id", ofId).order("control_time", { ascending: false }),
      (supabase as any).rpc("get_recipe_for_of", { p_of_id: ofId }),
    ]);
    setApplicable(appRes.data || []);
    setChecks(checksRes.data || []);
    const r = Array.isArray(recipeRes.data) ? recipeRes.data[0] : recipeRes.data;
    setRecipeInfo(r || null);
    setLoading(false);
  };

  useEffect(() => { if (ofId) load(); /* eslint-disable-next-line */ }, [ofId]);

  const kpis = useMemo(() => computeQualityKpis(applicable, checks), [applicable, checks]);

  const lastCheckByIndicator = useMemo(() => {
    const m = new Map<string, CheckRow>();
    checks.forEach((c) => { if (!m.has(c.indicator_id)) m.set(c.indicator_id, c); });
    return m;
  }, [checks]);

  const indicatorMap = useMemo(() => {
    const m = new Map<string, IndicatorRow>();
    applicable.forEach((i) => m.set(i.indicator_id, i));
    return m;
  }, [applicable]);

  const handleSaveStatus = async () => {
    setSavingStatus(true);
    const { error } = await (supabase as any).rpc("set_of_quality_status", {
      p_of_id: ofId,
      p_status: statusValue,
      p_reason: statusReason || null,
    });
    setSavingStatus(false);
    if (error) {
      toast({ title: "Erreur statut qualité", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Statut qualité mis à jour" });
    setStatusReason("");
    onChanged?.();
  };

  const openNew = () => { setForm({ ...emptyCheckForm(), of_id: ofId }); setOpen(true); };

  const currentIndicator = applicable.find((i) => i.indicator_id === form.indicator_id);

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

  const handleSave = async () => {
    const err = validateCheck(form, currentIndicator?.indicator_type);
    if (err) { toast({ title: err, variant: "destructive" }); return; }
    setSaving(true);
    const t = currentIndicator!.indicator_type;
    const payload: any = {
      of_id: ofId,
      product_id: productId,
      production_line_id: lineId,
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
      entity_label: `${currentIndicator!.code} – ${ofNumero}`,
      action_label: "Contrôle qualité enregistré (OF)",
      new_values: payload,
      severity: data.is_conform === false ? "low" : "info",
    });
    toast({ title: "Contrôle enregistré" });
    setOpen(false);
    setSaving(false);
    load();
  };

  const renderCheckValue = (c: CheckRow) => {
    if (c.measured_value_numeric != null) return `${c.measured_value_numeric}${c.unit ? " " + c.unit : ""}`;
    if (c.measured_value_boolean != null) return c.measured_value_boolean ? "Oui" : "Non";
    if (c.selected_value) return c.selected_value;
    if (c.measured_value_text) return c.measured_value_text;
    return "—";
  };

  return (
    <div className="space-y-4">
      {/* Quality status */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-medium">Statut qualité :</span>
            <Badge variant={QUALITY_STATUS_OPTIONS.find((o) => o.value === (qualityStatus ?? "non_demarre"))?.variant ?? "secondary"}>
              {qualityStatusLabel(qualityStatus)}
            </Badge>
            <span className="text-xs text-muted-foreground ml-2">
              Indépendant du statut production
            </span>
          </div>
          {canManage && (
            <div className="grid gap-3 md:grid-cols-[200px_1fr_auto] items-end">
              <div>
                <Label className="text-xs">Nouveau statut</Label>
                <Select value={statusValue} onValueChange={setStatusValue}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QUALITY_STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Motif (optionnel)</Label>
                <Input value={statusReason} onChange={(e) => setStatusReason(e.target.value)} className="h-10" />
              </div>
              <Button
                onClick={handleSaveStatus}
                disabled={savingStatus || statusValue === (qualityStatus ?? "non_demarre")}
                className="h-10"
              >
                Mettre à jour
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recipe followed by this OF */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-medium">Recette suivie</span>
            {recipeInfo ? (
              <>
                <Badge variant="outline">v{recipeInfo.version}</Badge>
                <Badge variant={recipeInfo.status === "active" ? "default" : recipeInfo.status === "draft" ? "outline" : "secondary"}>
                  {recipeInfo.status === "active" ? "Active" : recipeInfo.status === "draft" ? "Brouillon" : "Archivée"}
                </Badge>
                <span className="text-sm text-muted-foreground">— {recipeInfo.recipe_name}</span>
              </>
            ) : (
              <span className="text-sm text-destructive">Aucune recette liée à cet OF</span>
            )}
          </div>
          {recipeInfo && Array.isArray(recipeInfo.quality_sensitive_components) && recipeInfo.quality_sensitive_components.length > 0 && (
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-2">Composants qualité-sensibles ({recipeInfo.quality_sensitive_components.length})</div>
              <div className="rounded border divide-y">
                {recipeInfo.quality_sensitive_components.map((c: any) => (
                  <div key={c.article_id} className="px-3 py-2 text-xs flex items-center gap-3 flex-wrap">
                    <AlertTriangle className="h-3 w-3 text-destructive" />
                    <span className="font-medium">{c.code}</span>
                    <span className="text-muted-foreground">{c.designation}</span>
                    <span className="ml-auto tabular-nums">{c.quantity} {c.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {recipeInfo && Array.isArray(recipeInfo.components) && (
            <div className="mt-3 text-xs text-muted-foreground">
              {recipeInfo.components.length} composant(s) au total · {Array.isArray(recipeInfo.steps) ? recipeInfo.steps.length : 0} étape(s)
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><ShieldCheck className="h-3.5 w-3.5" /> Indicateurs applicables</div>
          <div className="text-2xl font-semibold mt-1">{kpis.applicable}</div>
          <div className="text-xs text-muted-foreground">dont {kpis.required} requis</div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><CheckCircle2 className="h-3.5 w-3.5" /> Contrôles réalisés</div>
          <div className="text-2xl font-semibold mt-1">{kpis.performed}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><Clock className="h-3.5 w-3.5" /> Manquants (requis)</div>
          <div className={`text-2xl font-semibold mt-1 ${kpis.missing > 0 ? "text-destructive" : ""}`}>{kpis.missing}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><AlertTriangle className="h-3.5 w-3.5" /> Hors tolérance</div>
          <div className={`text-2xl font-semibold mt-1 ${kpis.outOfTolerance > 0 ? "text-destructive" : ""}`}>{kpis.outOfTolerance}</div>
        </CardContent></Card>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {canManage && (
          <Button onClick={openNew} className="h-11">
            <Plus className="h-4 w-4 mr-1" /> Ajouter contrôle qualité
          </Button>
        )}
        <Button variant="outline" onClick={() => navigate(`/qualite/controles?of=${encodeURIComponent(ofNumero)}`)} className="h-11">
          <Eye className="h-4 w-4 mr-1" /> Voir contrôles qualité
        </Button>
        <Button variant="outline" disabled className="h-11" title="Module Non-conformité à venir">
          <AlertOctagon className="h-4 w-4 mr-1" /> Créer non-conformité
        </Button>
      </div>

      {/* Plan de contrôle : hérité du produit + dérogations locales */}
      <div>
        <div className="font-medium mb-2">Plan de contrôle de l'OF</div>
        <OfControlPlanManager ofId={ofId} ofNumero={ofNumero} canManage={canManage} />
      </div>

      {/* Applicable indicators */}
      <Card>
        <CardContent className="pt-6">
          <div className="font-medium mb-3">Indicateurs attendus</div>
          {loading ? (
            <div className="text-sm text-muted-foreground">Chargement…</div>
          ) : applicable.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aucun indicateur applicable à cet OF.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Requis</TableHead>
                <TableHead>Dernier contrôle</TableHead>
                <TableHead>État</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {applicable.map((i) => {
                  const last = lastCheckByIndicator.get(i.indicator_id);
                  let stateBadge: JSX.Element;
                  if (!last) stateBadge = <Badge variant="secondary">Manquant</Badge>;
                  else if (last.is_conform === false) stateBadge = <Badge variant="destructive">Hors tolérance</Badge>;
                  else if (last.is_conform === true) stateBadge = <Badge>Conforme</Badge>;
                  else stateBadge = <Badge variant="secondary">N/A</Badge>;
                  return (
                    <TableRow key={i.indicator_id}>
                      <TableCell className="font-mono text-xs">{i.code}</TableCell>
                      <TableCell>{i.name}</TableCell>
                      <TableCell className="text-xs">{i.indicator_type}</TableCell>
                      <TableCell>{i.effective_is_required ? <Badge>Requis</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-xs">{last ? new Date(last.control_time).toLocaleString() : "—"}</TableCell>
                      <TableCell>{stateBadge}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent checks */}
      <Card>
        <CardContent className="pt-6">
          <div className="font-medium mb-3">Contrôles réalisés ({checks.length})</div>
          {checks.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aucun contrôle pour cet OF.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Indicateur</TableHead>
                <TableHead>Valeur</TableHead>
                <TableHead>Conformité</TableHead>
                <TableHead>Commentaire</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {checks.slice(0, 50).map((c) => {
                  const ind = indicatorMap.get(c.indicator_id);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs">{new Date(c.control_time).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{ind ? `${ind.code} ${ind.name}` : c.indicator_id.slice(0, 6)}</TableCell>
                      <TableCell>{renderCheckValue(c)}</TableCell>
                      <TableCell>
                        {c.is_conform === true && <Badge>Conforme</Badge>}
                        {c.is_conform === false && <Badge variant="destructive">Non conforme</Badge>}
                        {c.is_conform == null && <Badge variant="secondary">N/A</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{c.comment || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add check dialog */}
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Ajouter contrôle qualité"
        description={`OF ${ofNumero}`}
      >
        <div className="space-y-4">
          <div>
            <Label>Indicateur</Label>
            <Select value={form.indicator_id} onValueChange={(v) => setForm((f) => ({ ...f, indicator_id: v }))}>
              <SelectTrigger className="h-11"><SelectValue placeholder={applicable.length ? "Choisir un indicateur" : "Aucun indicateur applicable"} /></SelectTrigger>
              <SelectContent>
                {applicable.map((i) => (
                  <SelectItem key={i.indicator_id} value={i.indicator_id}>
                    {i.code} – {i.name}{i.effective_is_required ? " (requis)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentIndicator?.indicator_type === "numeric" && (
            <div>
              <Label>Valeur mesurée {currentIndicator.unit ? `(${currentIndicator.unit})` : ""}</Label>
              <Input
                value={form.value_text}
                onChange={(e) => setForm((f) => ({ ...f, value_text: e.target.value }))}
                inputMode="decimal"
                className="h-11"
              />
              {currentIndicator.target_value != null && (
                <div className="text-xs text-muted-foreground mt-1">
                  Cible : {currentIndicator.target_value}
                  {currentIndicator.min_value != null ? ` · min ${currentIndicator.min_value}` : ""}
                  {currentIndicator.max_value != null ? ` · max ${currentIndicator.max_value}` : ""}
                </div>
              )}
            </div>
          )}

          {currentIndicator?.indicator_type === "boolean" && (
            <div className="flex items-center gap-3">
              <Switch checked={form.value_boolean} onCheckedChange={(v) => setForm((f) => ({ ...f, value_boolean: v }))} />
              <span>{form.value_boolean ? "Conforme (Oui)" : "Non conforme (Non)"}</span>
            </div>
          )}

          {currentIndicator?.indicator_type === "select" && (
            <div>
              <Label>Choix</Label>
              <Select value={form.selected_value} onValueChange={(v) => setForm((f) => ({ ...f, selected_value: v }))}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {(currentIndicator.select_options || []).map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {currentIndicator?.indicator_type === "text" && (
            <div>
              <Label>Valeur</Label>
              <Input value={form.value_text} onChange={(e) => setForm((f) => ({ ...f, value_text: e.target.value }))} className="h-11" />
            </div>
          )}

          <div>
            <Label>Commentaire</Label>
            <Textarea value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} />
          </div>

          {preview && currentIndicator?.indicator_type === "numeric" && (
            <div className="text-sm">
              {preview.is_conform === true && <Badge>Conforme</Badge>}
              {preview.is_conform === false && <Badge variant="destructive">Non conforme</Badge>}
              {preview.out_of_tolerance && <Badge variant="destructive" className="ml-2">Hors tolérance</Badge>}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="h-11">Annuler</Button>
            <Button onClick={handleSave} disabled={saving} className="h-11">Enregistrer</Button>
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
