import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardCheck, Save, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { logAudit } from "@/lib/audit";
import { notifyCheckOutOfTolerance } from "@/lib/qualityNotifications";
import { useActiveQualityShift } from "@/hooks/useActiveQualityShift";
import { parseDecimal, CATEGORIES } from "@/pages/qualite/QualiteIndicateurs";
import { computeConformity } from "@/pages/qualite/QualiteControles";
import { dueInfo, requiredIndicators, lastCheckByIndicator } from "@/lib/qualityShiftLogic";

interface OFRow {
  id: string;
  numero: string;
  product_id: string | null;
  line_id: string | null;
  statut: string;
}

interface ApplicableIndicator {
  indicator_id: string;
  code: string;
  name: string;
  indicator_type: "numeric" | "boolean" | "text" | "select";
  category: string;
  unit: string | null;
  target_value: number | null;
  min_value: number | null;
  max_value: number | null;
  tolerance_minus: number | null;
  tolerance_plus: number | null;
  select_options: string[] | null;
  effective_frequency_minutes: number | null;
  effective_is_required: boolean;
  effective_is_blocking: boolean;
}

interface Draft {
  value_text: string;
  value_boolean: string; // "" | "true" | "false"
  selected_value: string;
  comment: string;
}

const emptyDraft = (): Draft => ({ value_text: "", value_boolean: "", selected_value: "", comment: "" });

const catLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;

export default function QualiteSaisieLigne() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { shift: activeQualityShift } = useActiveQualityShift();
  const [params, setParams] = useSearchParams();

  const [ofs, setOfs] = useState<OFRow[]>([]);
  const [ofId, setOfId] = useState<string>(params.get("of") || "");
  const [indicators, setIndicators] = useState<ApplicableIndicator[]>([]);
  const [lastByIndicator, setLastByIndicator] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Refresh due countdowns each minute
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (supabase as any)
      .from("ordres_fabrication")
      .select("id, numero, product_id, line_id, statut")
      .in("statut", ["en_cours", "planifie"])
      .order("created_at", { ascending: false })
      .limit(300)
      .then(({ data }: any) => setOfs(data || []));
  }, []);

  const currentOf = useMemo(() => ofs.find((o) => o.id === ofId), [ofs, ofId]);

  const loadForOf = async (id: string) => {
    if (!id) { setIndicators([]); setLastByIndicator({}); return; }
    setLoading(true);
    const [ind, checks] = await Promise.all([
      (supabase as any).rpc("get_quality_indicators_for_of", { p_of_id: id }),
      (supabase as any)
        .from("quality_checks")
        .select("indicator_id, control_time")
        .eq("of_id", id)
        .order("control_time", { ascending: false }),
    ]);
    if (ind.error) toast({ title: "Erreur", description: ind.error.message, variant: "destructive" });
    const list: ApplicableIndicator[] = requiredIndicators<ApplicableIndicator>(ind.data || []);
    setIndicators(list);
    setLastByIndicator(lastCheckByIndicator(checks.data || []));
    setDrafts((d) => {
      const next = { ...d };
      list.forEach((i) => { if (!next[i.indicator_id]) next[i.indicator_id] = emptyDraft(); });
      return next;
    });
    setLoading(false);
  };

  useEffect(() => {
    if (ofId) { setParams({ of: ofId }); loadForOf(ofId); }
    else setParams({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ofId]);

  const setDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? emptyDraft()), ...patch } }));

  const previewFor = (ind: ApplicableIndicator, draft: Draft) => {
    if (ind.indicator_type === "numeric" && !draft.value_text.trim()) return null;
    if (ind.indicator_type === "boolean" && draft.value_boolean === "") return null;
    return computeConformity({
      indicator_type: ind.indicator_type,
      measured_value_numeric: ind.indicator_type === "numeric" ? parseDecimal(draft.value_text) : null,
      measured_value_boolean: ind.indicator_type === "boolean" ? draft.value_boolean === "true" : null,
      target_value: ind.target_value,
      min_value: ind.min_value,
      max_value: ind.max_value,
      tolerance_minus: ind.tolerance_minus,
      tolerance_plus: ind.tolerance_plus,
    });
  };

  const handleSave = async (ind: ApplicableIndicator) => {
    const draft = drafts[ind.indicator_id] ?? emptyDraft();
    const t = ind.indicator_type;
    if (t === "numeric" && parseDecimal(draft.value_text) == null) {
      toast({ title: "Valeur numérique requise", variant: "destructive" }); return;
    }
    if (t === "boolean" && draft.value_boolean === "") {
      toast({ title: "Choisir Conforme / Non conforme", variant: "destructive" }); return;
    }
    if (t === "select" && !draft.selected_value) { toast({ title: "Choix requis", variant: "destructive" }); return; }
    if (t === "text" && !draft.value_text.trim()) { toast({ title: "Valeur requise", variant: "destructive" }); return; }

    setSavingId(ind.indicator_id);
    let prodShiftId: string | null = null;
    if (activeQualityShift && currentOf?.line_id) {
      const { data: prodShift } = await (supabase as any)
        .from("shifts").select("id")
        .eq("line_id", currentOf.line_id).eq("is_active", true)
        .eq("date_shift", new Date().toISOString().slice(0, 10))
        .limit(1).maybeSingle();
      prodShiftId = prodShift?.id ?? null;
    }

    const payload: any = {
      of_id: ofId,
      product_id: currentOf?.product_id ?? null,
      production_line_id: currentOf?.line_id ?? null,
      indicator_id: ind.indicator_id,
      measured_value_numeric: t === "numeric" ? parseDecimal(draft.value_text) : null,
      measured_value_text: t === "text" ? draft.value_text.trim() : null,
      measured_value_boolean: t === "boolean" ? draft.value_boolean === "true" : null,
      selected_value: t === "select" ? draft.selected_value : null,
      unit: ind.unit,
      target_value: ind.target_value,
      min_value: ind.min_value,
      max_value: ind.max_value,
      comment: draft.comment.trim(),
      controlled_by: user?.id ?? null,
      control_time: new Date().toISOString(),
      quality_shift_id: activeQualityShift?.id ?? null,
      shift_id: prodShiftId,
      team_id: activeQualityShift?.shift_team_id ?? null,
      status: "submitted",
      validation_status: "not_required",
    };

    const { data, error } = await (supabase as any).from("quality_checks").insert(payload).select().single();
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      setSavingId(null); return;
    }
    await logAudit({
      action_type: "create",
      module: "parametres" as any,
      entity_type: "quality_check",
      entity_id: data.id,
      entity_label: `${ind.code} – ${currentOf?.numero ?? ""}`,
      action_label: "Contrôle qualité (saisie en ligne)",
      new_values: payload,
      severity: data.is_conform === false ? "low" : "info",
    });
    if (data.is_conform === false) {
      await notifyCheckOutOfTolerance({ entity_id: data.id, entity_label: ind.code, of_label: currentOf?.numero ?? null });
    }
    toast({
      title: "Contrôle enregistré",
      description: data.is_conform === false ? "⚠ Non conforme — pensez à créer une NC." : undefined,
    });
    setDraft(ind.indicator_id, { value_text: "", value_boolean: "", selected_value: "", comment: "" });
    setLastByIndicator((l) => ({ ...l, [ind.indicator_id]: payload.control_time }));
    setSavingId(null);
  };

  const grouped = useMemo(() => {
    const map = new Map<string, ApplicableIndicator[]>();
    indicators.forEach((i) => {
      const arr = map.get(i.category) ?? [];
      arr.push(i);
      map.set(i.category, arr);
    });
    return Array.from(map.entries());
  }, [indicators]);

  const dueCount = useMemo(() => {
    void tick;
    return indicators.filter((i) => {
      const d = dueInfo(lastByIndicator[i.indicator_id] ?? null, i.effective_frequency_minutes);
      return d.level === "overdue" || d.level === "todo";
    }).length;
  }, [indicators, lastByIndicator, tick]);

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-primary" />
          Saisie en ligne
        </h1>
        <p className="text-sm text-muted-foreground">
          Sélectionnez un OF, saisissez les contrôles obligatoires selon leur fréquence.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <Label>Ordre de fabrication *</Label>
              <Select value={ofId} onValueChange={setOfId}>
                <SelectTrigger className="min-h-[48px] mt-1"><SelectValue placeholder="Choisir un OF" /></SelectTrigger>
                <SelectContent>
                  {ofs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.numero}</SelectItem>
                  ))}
                  {ofs.length === 0 && <div className="p-2 text-xs text-muted-foreground">Aucun OF en cours.</div>}
                </SelectContent>
              </Select>
            </div>
            {ofId && (
              <div className="text-sm">
                <Badge variant={dueCount > 0 ? "destructive" : "default"}>
                  {dueCount > 0 ? `${dueCount} contrôle(s) à saisir` : "Contrôles à jour"}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {loading && <p className="text-sm text-muted-foreground">Chargement des contrôles…</p>}

      {ofId && !loading && indicators.length === 0 && (
        <Card><CardContent className="p-6 text-center text-muted-foreground">
          Aucun contrôle obligatoire configuré pour le produit de cet OF.
        </CardContent></Card>
      )}

      {grouped.map(([cat, list]) => (
        <div key={cat} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{catLabel(cat)}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {list.map((ind) => {
              const draft = drafts[ind.indicator_id] ?? emptyDraft();
              const preview = previewFor(ind, draft);
              const due = dueInfo(lastByIndicator[ind.indicator_id] ?? null, ind.effective_frequency_minutes);
              void tick;
              const conformClass =
                preview?.is_conform === true ? "border-green-500/60 bg-green-500/5"
                : preview?.is_conform === false ? "border-destructive/60 bg-destructive/5"
                : "";
              return (
                <Card key={ind.indicator_id} className={conformClass}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{ind.code}</span>
                        {ind.name}
                        {ind.unit ? <span className="text-xs text-muted-foreground">({ind.unit})</span> : null}
                      </span>
                      {ind.effective_is_blocking && <Badge variant="destructive" className="text-[10px]">Bloquant</Badge>}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {ind.indicator_type === "numeric" && (ind.min_value != null || ind.max_value != null) && (
                        <span className="text-muted-foreground">
                          Norme : {ind.min_value ?? "–"} … {ind.max_value ?? "–"}
                          {ind.target_value != null ? ` (cible ${ind.target_value})` : ""}
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          due.level === "overdue" ? "border-destructive text-destructive"
                          : due.level === "todo" ? "border-amber-500 text-amber-600"
                          : "text-muted-foreground"
                        }
                      >
                        {due.level === "overdue" ? <AlertTriangle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                        {due.label}
                        {ind.effective_frequency_minutes ? ` · ${ind.effective_frequency_minutes} min` : ""}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {ind.indicator_type === "numeric" && (
                      <Input
                        inputMode="decimal"
                        placeholder="Valeur mesurée"
                        value={draft.value_text}
                        onChange={(e) => setDraft(ind.indicator_id, { value_text: e.target.value })}
                        className="text-lg tabular-nums min-h-[48px]"
                      />
                    )}
                    {ind.indicator_type === "text" && (
                      <Textarea
                        rows={2}
                        placeholder="Observation"
                        value={draft.value_text}
                        onChange={(e) => setDraft(ind.indicator_id, { value_text: e.target.value })}
                      />
                    )}
                    {ind.indicator_type === "boolean" && (
                      <Select value={draft.value_boolean} onValueChange={(v) => setDraft(ind.indicator_id, { value_boolean: v })}>
                        <SelectTrigger className="min-h-[48px]"><SelectValue placeholder="Conforme / Non conforme" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">✓ Conforme</SelectItem>
                          <SelectItem value="false">✗ Non conforme</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {ind.indicator_type === "select" && Array.isArray(ind.select_options) && (
                      <Select value={draft.selected_value} onValueChange={(v) => setDraft(ind.indicator_id, { selected_value: v })}>
                        <SelectTrigger className="min-h-[48px]"><SelectValue placeholder="Choisir" /></SelectTrigger>
                        <SelectContent>
                          {ind.select_options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}

                    {preview?.is_conform != null && (
                      <div className={`flex items-center gap-1.5 text-sm font-medium ${preview.is_conform ? "text-green-600" : "text-destructive"}`}>
                        {preview.is_conform ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        {preview.is_conform ? "Conforme" : "Non conforme"}
                        {preview.out_of_tolerance && <span className="text-amber-600">· hors tolérance</span>}
                      </div>
                    )}

                    <Input
                      placeholder="Commentaire (optionnel)"
                      value={draft.comment}
                      onChange={(e) => setDraft(ind.indicator_id, { comment: e.target.value })}
                    />

                    <Button
                      onClick={() => handleSave(ind)}
                      disabled={savingId === ind.indicator_id}
                      className="w-full min-h-[44px]"
                    >
                      <Save className="h-4 w-4 mr-1.5" />
                      {savingId === ind.indicator_id ? "Enregistrement…" : "Enregistrer le contrôle"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
