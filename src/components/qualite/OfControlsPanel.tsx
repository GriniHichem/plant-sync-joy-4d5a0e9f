import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollTable } from "@/components/responsive/ScrollTable";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Save, CheckCircle2, XCircle, Clock, AlertTriangle, Pin, PinOff, LayoutGrid, Table2 } from "lucide-react";
import { logAudit } from "@/lib/audit";
import { notifyCheckOutOfTolerance } from "@/lib/qualityNotifications";
import { parseDecimal, CATEGORIES } from "@/pages/qualite/QualiteIndicateurs";
import { computeConformity } from "@/pages/qualite/QualiteControles";
import type { ActiveQualityShift } from "@/hooks/useActiveQualityShift";
import { useQualityShiftPins } from "@/hooks/useQualityShiftPins";

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
  value_boolean: string;
  selected_value: string;
  comment: string;
}

const emptyDraft = (): Draft => ({ value_text: "", value_boolean: "", selected_value: "", comment: "" });
const catLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;

function dueInfo(lastAt: string | null, minutes: number | null) {
  if (!minutes || minutes <= 0) {
    return { level: lastAt ? "ok" : "todo", label: lastAt ? "À la demande" : "À saisir", minsLeft: null as number | null };
  }
  if (!lastAt) return { level: "todo", label: "À saisir maintenant", minsLeft: 0 };
  const elapsed = (Date.now() - new Date(lastAt).getTime()) / 60000;
  const left = Math.round(minutes - elapsed);
  if (left <= 0) return { level: "overdue", label: `En retard de ${Math.abs(left)} min`, minsLeft: left };
  return { level: "ok", label: `Prochain dans ${left} min`, minsLeft: left };
}

interface Props {
  ofId: string;
  ofNumero?: string | null;
  productId?: string | null;
  lineId?: string | null;
  activeQualityShift: ActiveQualityShift | null;
  onSaved?: () => void;
}

/**
 * OF-centric quality control entry: loads the OF control plan, supports filtering
 * (category / status / search), pinning priority controls for the shift, and live
 * conformity feedback.
 */
export function OfControlsPanel({ ofId, ofNumero, productId, lineId, activeQualityShift, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [indicators, setIndicators] = useState<ApplicableIndicator[]>([]);
  const [lastByIndicator, setLastByIndicator] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const { isPinned, togglePin } = useQualityShiftPins(activeQualityShift?.id ?? null);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const loadForOf = async () => {
      if (!ofId) { setIndicators([]); setLastByIndicator({}); return; }
      setLoading(true);
      const [ind, checks] = await Promise.all([
        (supabase as any).rpc("get_quality_indicators_for_of", { p_of_id: ofId }),
        (supabase as any)
          .from("quality_checks")
          .select("indicator_id, control_time")
          .eq("of_id", ofId)
          .order("control_time", { ascending: false }),
      ]);
      if (ind.error) toast({ title: "Erreur", description: ind.error.message, variant: "destructive" });
      const list: ApplicableIndicator[] = (ind.data || []).filter((i: ApplicableIndicator) => i.effective_is_required);
      setIndicators(list);
      const last: Record<string, string> = {};
      (checks.data || []).forEach((c: any) => { if (!last[c.indicator_id]) last[c.indicator_id] = c.control_time; });
      setLastByIndicator(last);
      setDrafts((d) => {
        const next = { ...d };
        list.forEach((i) => { if (!next[i.indicator_id]) next[i.indicator_id] = emptyDraft(); });
        return next;
      });
      setLoading(false);
    };
    loadForOf();
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
    if (t === "numeric" && parseDecimal(draft.value_text) == null) { toast({ title: "Valeur numérique requise", variant: "destructive" }); return; }
    if (t === "boolean" && draft.value_boolean === "") { toast({ title: "Choisir Conforme / Non conforme", variant: "destructive" }); return; }
    if (t === "select" && !draft.selected_value) { toast({ title: "Choix requis", variant: "destructive" }); return; }
    if (t === "text" && !draft.value_text.trim()) { toast({ title: "Valeur requise", variant: "destructive" }); return; }

    setSavingId(ind.indicator_id);
    let prodShiftId: string | null = null;
    if (activeQualityShift && lineId) {
      const { data: prodShift } = await (supabase as any)
        .from("shifts").select("id")
        .eq("line_id", lineId).eq("is_active", true)
        .eq("date_shift", new Date().toISOString().slice(0, 10))
        .limit(1).maybeSingle();
      prodShiftId = prodShift?.id ?? null;
    }

    const payload: any = {
      of_id: ofId,
      product_id: productId ?? null,
      production_line_id: lineId ?? null,
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
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); setSavingId(null); return; }
    await logAudit({
      action_type: "create",
      module: "parametres" as any,
      entity_type: "quality_check",
      entity_id: data.id,
      entity_label: `${ind.code} – ${ofNumero ?? ""}`,
      action_label: "Contrôle qualité (tableau shift)",
      new_values: payload,
      severity: data.is_conform === false ? "low" : "info",
    });
    if (data.is_conform === false) {
      await notifyCheckOutOfTolerance({ entity_id: data.id, entity_label: ind.code, of_label: ofNumero ?? null });
    }
    const nc = await createDraftNcForCheck({
      check: { id: data.id, ...payload },
      indicator: ind,
      ofNumero: ofNumero ?? null,
      declaredBy: user?.id ?? null,
      isConform: data.is_conform ?? null,
    });
    toast({
      title: "Contrôle enregistré",
      description: nc
        ? `⚠ Non conforme BLOQUANT — NC brouillon ${nc.nc_number ?? ""} créée automatiquement.`
        : data.is_conform === false
          ? (ind.effective_is_blocking ? "⚠ Non conforme BLOQUANT — créez une NC / un ticket." : "⚠ Non conforme — pensez à créer une NC.")
          : undefined,
      variant: data.is_conform === false ? "destructive" : undefined,
    });

    setDraft(ind.indicator_id, { value_text: "", value_boolean: "", selected_value: "", comment: "" });
    setLastByIndicator((l) => ({ ...l, [ind.indicator_id]: payload.control_time }));
    setSavingId(null);
    onSaved?.();
  };

  const visible = useMemo(() => {
    void tick;
    return indicators.filter((i) => {
      if (catFilter !== "all" && i.category !== catFilter) return false;
      if (search && !`${i.code} ${i.name}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "all") {
        const d = dueInfo(lastByIndicator[i.indicator_id] ?? null, i.effective_frequency_minutes);
        if (statusFilter === "todo" && !(d.level === "overdue" || d.level === "todo")) return false;
        if (statusFilter === "overdue" && d.level !== "overdue") return false;
        if (statusFilter === "ok" && d.level !== "ok") return false;
      }
      return true;
    });
  }, [indicators, catFilter, search, statusFilter, lastByIndicator, tick]);

  const sorted = useMemo(() => {
    const qsId = activeQualityShift?.id;
    return [...visible].sort((a, b) => {
      const pa = qsId && isPinned(ofId, a.indicator_id) ? 1 : 0;
      const pb = qsId && isPinned(ofId, b.indicator_id) ? 1 : 0;
      return pb - pa;
    });
  }, [visible, isPinned, ofId, activeQualityShift?.id]);

  const dueCount = useMemo(() => {
    void tick;
    return indicators.filter((i) => {
      const d = dueInfo(lastByIndicator[i.indicator_id] ?? null, i.effective_frequency_minutes);
      return d.level === "overdue" || d.level === "todo";
    }).length;
  }, [indicators, lastByIndicator, tick]);

  const availableCats = useMemo(
    () => Array.from(new Set(indicators.map((i) => i.category))),
    [indicators],
  );

  const renderField = (ind: ApplicableIndicator, draft: Draft, compact = false) => {
    const h = compact ? "min-h-[40px]" : "min-h-[48px]";
    if (ind.indicator_type === "numeric") {
      return (
        <Input
          inputMode="decimal"
          placeholder="Valeur mesurée"
          value={draft.value_text}
          onChange={(e) => setDraft(ind.indicator_id, { value_text: e.target.value })}
          className={compact ? "tabular-nums h-9 w-[130px]" : "text-lg tabular-nums min-h-[48px]"}
        />
      );
    }
    if (ind.indicator_type === "text") {
      return (
        <Textarea rows={compact ? 1 : 2} placeholder="Observation" value={draft.value_text}
          onChange={(e) => setDraft(ind.indicator_id, { value_text: e.target.value })}
          className={compact ? "min-w-[160px]" : ""} />
      );
    }
    if (ind.indicator_type === "boolean") {
      return (
        <Select value={draft.value_boolean} onValueChange={(v) => setDraft(ind.indicator_id, { value_boolean: v })}>
          <SelectTrigger className={compact ? "h-9 w-[170px]" : h}><SelectValue placeholder="Conforme / Non conforme" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="true">✓ Conforme</SelectItem>
            <SelectItem value="false">✗ Non conforme</SelectItem>
          </SelectContent>
        </Select>
      );
    }
    if (ind.indicator_type === "select" && Array.isArray(ind.select_options)) {
      return (
        <Select value={draft.selected_value} onValueChange={(v) => setDraft(ind.indicator_id, { selected_value: v })}>
          <SelectTrigger className={compact ? "h-9 w-[150px]" : h}><SelectValue placeholder="Choisir" /></SelectTrigger>
          <SelectContent>
            {ind.select_options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    return null;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={dueCount > 0 ? "destructive" : "default"}>
          {dueCount > 0 ? `${dueCount} contrôle(s) à saisir` : "Contrôles à jour"}
        </Badge>
        <Input
          placeholder="Rechercher un contrôle…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-[200px]"
        />
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Catégorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {availableCats.map((c) => <SelectItem key={c} value={c}>{catLabel(c)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="todo">À saisir</SelectItem>
            <SelectItem value="overdue">En retard</SelectItem>
            <SelectItem value="ok">À jour</SelectItem>
          </SelectContent>
        </Select>
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(v) => v && setViewMode(v as "cards" | "table")}
          className="ml-auto"
        >
          <ToggleGroupItem value="cards" aria-label="Vue cartes" title="Vue cartes" className="h-9">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Vue tableau" title="Vue tableau" className="h-9">
            <Table2 className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Chargement des contrôles…</p>}

      {ofId && !loading && indicators.length === 0 && (
        <Card><CardContent className="p-6 text-center text-muted-foreground">
          Aucun contrôle obligatoire configuré pour le produit de cet OF.
        </CardContent></Card>
      )}

      {viewMode === "cards" && (
      <div className="grid gap-3 md:grid-cols-2">
        {sorted.map((ind) => {
          const draft = drafts[ind.indicator_id] ?? emptyDraft();
          const preview = previewFor(ind, draft);
          const due = dueInfo(lastByIndicator[ind.indicator_id] ?? null, ind.effective_frequency_minutes);
          const pinned = !!activeQualityShift?.id && isPinned(ofId, ind.indicator_id);
          void tick;
          const conformClass =
            preview?.is_conform === true ? "border-green-500/60 bg-green-500/5"
            : preview?.is_conform === false ? "border-destructive/60 bg-destructive/5"
            : pinned ? "border-primary/50" : "";
          return (
            <Card key={ind.indicator_id} className={conformClass}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs text-muted-foreground">{ind.code}</span>
                    <span className="truncate">{ind.name}</span>
                    {ind.unit ? <span className="text-xs text-muted-foreground">({ind.unit})</span> : null}
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    {ind.effective_is_blocking && <Badge variant="destructive" className="text-[10px]">Bloquant</Badge>}
                    {activeQualityShift?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-7 w-7 ${pinned ? "text-primary" : "text-muted-foreground"}`}
                        onClick={() => togglePin(ofId, ind.indicator_id)}
                        title={pinned ? "Désépingler" : "Épingler comme prioritaire"}
                      >
                        {pinned ? <Pin className="h-4 w-4 fill-current" /> : <PinOff className="h-4 w-4" />}
                      </Button>
                    )}
                  </span>
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
                {renderField(ind, draft)}


                {preview?.is_conform != null && (
                  <div className={`flex items-center gap-1.5 text-sm font-medium ${preview.is_conform ? "text-green-600" : "text-destructive"}`}>
                    {preview.is_conform ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {preview.is_conform ? "Conforme" : "Non conforme"}
                    {preview.out_of_tolerance && <span className="text-amber-600">· hors tolérance</span>}
                  </div>
                )}

                <Input placeholder="Commentaire (optionnel)" value={draft.comment}
                  onChange={(e) => setDraft(ind.indicator_id, { comment: e.target.value })} />

                <Button onClick={() => handleSave(ind)} disabled={savingId === ind.indicator_id} className="w-full min-h-[44px]">
                  <Save className="h-4 w-4 mr-1.5" />
                  {savingId === ind.indicator_id ? "Enregistrement…" : "Enregistrer le contrôle"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      )}

      {viewMode === "table" && sorted.length > 0 && (
        <ScrollTable>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Contrôle</TableHead>
                <TableHead>Norme</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead>Saisie</TableHead>
                <TableHead>Conformité</TableHead>
                <TableHead>Commentaire</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((ind) => {
                const draft = drafts[ind.indicator_id] ?? emptyDraft();
                const preview = previewFor(ind, draft);
                const due = dueInfo(lastByIndicator[ind.indicator_id] ?? null, ind.effective_frequency_minutes);
                const pinned = !!activeQualityShift?.id && isPinned(ofId, ind.indicator_id);
                void tick;
                const rowClass =
                  preview?.is_conform === true ? "bg-green-500/5"
                  : preview?.is_conform === false ? "bg-destructive/5"
                  : pinned ? "bg-primary/5" : "";
                return (
                  <TableRow key={ind.indicator_id} className={rowClass}>
                    <TableCell>
                      {activeQualityShift?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-7 w-7 ${pinned ? "text-primary" : "text-muted-foreground"}`}
                          onClick={() => togglePin(ofId, ind.indicator_id)}
                          title={pinned ? "Désépingler" : "Épingler comme prioritaire"}
                        >
                          {pinned ? <Pin className="h-4 w-4 fill-current" /> : <PinOff className="h-4 w-4" />}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{ind.code}</span>
                        <span>{ind.name}</span>
                        {ind.unit ? <span className="text-xs text-muted-foreground">({ind.unit})</span> : null}
                        {ind.effective_is_blocking && <Badge variant="destructive" className="text-[10px]">Bloquant</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {ind.indicator_type === "numeric" && (ind.min_value != null || ind.max_value != null)
                        ? `${ind.min_value ?? "–"} … ${ind.max_value ?? "–"}${ind.target_value != null ? ` (cible ${ind.target_value})` : ""}`
                        : "–"}
                    </TableCell>
                    <TableCell>
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
                      </Badge>
                    </TableCell>
                    <TableCell>{renderField(ind, draft, true)}</TableCell>
                    <TableCell>
                      {preview?.is_conform != null && (
                        <div className={`flex items-center gap-1 text-sm font-medium ${preview.is_conform ? "text-green-600" : "text-destructive"}`}>
                          {preview.is_conform ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          {preview.is_conform ? "Conforme" : "Non conforme"}
                          {preview.out_of_tolerance && <span className="text-amber-600">·hors tol.</span>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input placeholder="Commentaire" value={draft.comment}
                        onChange={(e) => setDraft(ind.indicator_id, { comment: e.target.value })}
                        className="h-9 min-w-[140px]" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => handleSave(ind)} disabled={savingId === ind.indicator_id}>
                        <Save className="h-4 w-4 mr-1.5" />
                        {savingId === ind.indicator_id ? "…" : "Enregistrer"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollTable>
      )}
    </div>
  );
}
