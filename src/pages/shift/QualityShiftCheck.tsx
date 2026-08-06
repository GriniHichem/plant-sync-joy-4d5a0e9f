import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useActiveShift } from "@/contexts/ActiveShiftContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardCheck, Save, ArrowLeft } from "lucide-react";
import { logAudit } from "@/lib/audit";
import { parseNumericInput } from "@/lib/formValidation";
import { useShiftRealtime } from "@/hooks/useShiftRealtime";

/**
 * Quick quality check entry — auto fills team_id, shift_id, quality_shift_id from active context.
 */
export default function QualityShiftCheck() {
  const { qualityShift, refresh } = useActiveShift();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [ofs, setOfs] = useState<any[]>([]);
  const [ofId, setOfId] = useState<string>("");
  const [indicators, setIndicators] = useState<any[]>([]);
  const [indicatorId, setIndicatorId] = useState<string>("");
  const [valueNum, setValueNum] = useState("");
  const [valueText, setValueText] = useState("");
  const [valueBool, setValueBool] = useState<string>("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadOfs = () => {
    if (!qualityShift) return;
    const lineIds = qualityShift.lines.map((l) => l.id);
    if (lineIds.length === 0) { setOfs([]); return; }
    supabase
      .from("ordres_fabrication")
      .select("id, numero, line_id, products(code, designation), production_lines(id, code)")
      .in("line_id", lineIds)
      .eq("statut", "en_cours" as any)
      .order("numero")
      .then(({ data }) => setOfs(data ?? []));
  };

  // Load OFs running on covered lines
  useEffect(() => {
    loadOfs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qualityShift?.id]);

  useShiftRealtime(
    `qual-ofs-${qualityShift?.id ?? "none"}`,
    "ordres_fabrication",
    loadOfs,
    !!qualityShift?.id,
  );

  useEffect(() => {
    if (!ofId) { setIndicators([]); return; }
    supabase
      .rpc("get_quality_indicators_for_of" as any, { p_of_id: ofId } as any)
      .then(({ data }) => setIndicators((data as any[]) ?? []));
  }, [ofId]);

  const indicator = useMemo(
    () => indicators.find((i: any) => i.indicator_id === indicatorId),
    [indicators, indicatorId]
  );

  if (!qualityShift) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="p-6 text-center text-muted-foreground">Aucun shift qualité actif.</CardContent>
      </Card>
    );
  }

  async function handleSubmit() {
    if (!qualityShift) return;
    if (!ofId || !indicatorId || !indicator) {
      toast({ title: "OF et indicateur requis", variant: "destructive" });
      return;
    }

    // Build payload depending on indicator type
    const payload: any = {
      of_id: ofId,
      indicator_id: indicatorId,
      controlled_by: user?.id,
      control_time: new Date().toISOString(),
      comment: comment || "",
      status: "submitted",
      validation_status: "not_required",
      // Auto-context from active shift:
      quality_shift_id: qualityShift.id,
      team_id: qualityShift.shift_team_id,
      shift_id: qualityShift.production_shift_ids[0] ?? null,
      production_line_id: ofs.find((o) => o.id === ofId)?.line_id ?? null,
      target_value: indicator.target_value,
      min_value: indicator.min_value,
      max_value: indicator.max_value,
      unit: indicator.unit,
    };

    if (indicator.indicator_type === "numeric") {
      const v = parseNumericInput(valueNum);
      if (v === null) { toast({ title: "Valeur numérique requise", variant: "destructive" }); return; }
      payload.measured_value_numeric = v;
    } else if (indicator.indicator_type === "boolean") {
      if (valueBool === "") { toast({ title: "Choisir Conforme ou Non conforme", variant: "destructive" }); return; }
      payload.measured_value_boolean = valueBool === "true";
    } else if (indicator.indicator_type === "select") {
      if (!valueText) { toast({ title: "Sélectionner une valeur", variant: "destructive" }); return; }
      payload.selected_value = valueText;
    } else {
      if (!valueText.trim()) { toast({ title: "Valeur requise", variant: "destructive" }); return; }
      payload.measured_value_text = valueText;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.from("quality_checks" as any).insert(payload as any).select("id, is_conform").single();
      if (error) throw error;

      await logAudit({
        action_type: "create",
        module: "qualite" as any,
        entity_type: "quality_check",
        entity_id: (data as any).id,
        action_label: "Contrôle qualité (kiosque shift)",
        new_values: { quality_shift_id: qualityShift.id, of_id: ofId, indicator_id: indicatorId },
      });

      toast({
        title: "Contrôle enregistré",
        description: (data as any).is_conform === false ? "⚠ Non conforme — pensez à créer une NC." : undefined,
      });
      setIndicatorId(""); setValueNum(""); setValueText(""); setValueBool(""); setComment("");
      await refresh();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate("/qualite/shift")}>
        <ArrowLeft className="h-4 w-4 mr-1.5" /> Retour shift
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardCheck className="h-5 w-5 text-primary" /> Saisir un contrôle
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Ordre de fabrication *</Label>
            <Select value={ofId} onValueChange={setOfId}>
              <SelectTrigger className="min-h-[48px] mt-1"><SelectValue placeholder="Choisir un OF en cours" /></SelectTrigger>
              <SelectContent>
                {ofs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.numero} — {o.products?.code ?? ""} ({o.production_lines?.code ?? "—"})
                  </SelectItem>
                ))}
                {ofs.length === 0 && <div className="p-2 text-xs text-muted-foreground">Aucun OF actif sur vos lignes.</div>}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Indicateur *</Label>
            <Select value={indicatorId} onValueChange={setIndicatorId} disabled={!ofId}>
              <SelectTrigger className="min-h-[48px] mt-1"><SelectValue placeholder="Choisir un indicateur" /></SelectTrigger>
              <SelectContent>
                {indicators.map((i: any) => (
                  <SelectItem key={i.indicator_id} value={i.indicator_id}>
                    {i.code} — {i.name} {i.unit ? `(${i.unit})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {indicator && indicator.indicator_type === "numeric" && (
            <div>
              <Label>
                Mesure {indicator.unit ? `(${indicator.unit})` : ""}
                {(indicator.min_value !== null || indicator.max_value !== null) && (
                  <span className="text-xs text-muted-foreground ml-2">
                    [{indicator.min_value ?? "–"} ... {indicator.max_value ?? "–"}]
                  </span>
                )}
              </Label>
              <Input
                inputMode="decimal"
                value={valueNum}
                onChange={(e) => setValueNum(e.target.value)}
                className="min-h-[48px] text-lg tabular-nums"
              />
            </div>
          )}

          {indicator && indicator.indicator_type === "boolean" && (
            <div>
              <Label>Résultat *</Label>
              <Select value={valueBool} onValueChange={setValueBool}>
                <SelectTrigger className="min-h-[48px] mt-1"><SelectValue placeholder="Conforme / Non conforme" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">✓ Conforme</SelectItem>
                  <SelectItem value="false">✗ Non conforme</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {indicator && indicator.indicator_type === "select" && Array.isArray(indicator.select_options) && (
            <div>
              <Label>Valeur *</Label>
              <Select value={valueText} onValueChange={setValueText}>
                <SelectTrigger className="min-h-[48px] mt-1"><SelectValue placeholder="Choisir une valeur" /></SelectTrigger>
                <SelectContent>
                  {indicator.select_options.map((o: string) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {indicator && indicator.indicator_type === "text" && (
            <div>
              <Label>Observation *</Label>
              <Textarea value={valueText} onChange={(e) => setValueText(e.target.value)} rows={2} />
            </div>
          )}

          <div>
            <Label>Commentaire</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
          </div>

          <Button onClick={handleSubmit} disabled={submitting || !indicator} className="w-full min-h-[52px]">
            <Save className="h-5 w-5 mr-2" /> {submitting ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
