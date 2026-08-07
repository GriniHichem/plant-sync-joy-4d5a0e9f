import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { evaluateConditions } from "@/lib/notifications";
import { MODULES, MODULE_GROUPS, NOTIF_EVENTS_BY_MODULE, ROLES, suggestedRolesForModule } from "@/lib/ruleCatalog";
import { preflightNotifRule } from "@/lib/ruleValidation";
import {
  ConditionBuilder,
  fromAnyConditions,
  toNotifConditions,
  validateConditionTree,
  type CondTree,
} from "@/components/rules/ConditionBuilder";

import { PreflightBanner, DryRunTester } from "@/components/rules/RulePreflight";

const SEVERITIES = ["info","low","medium","high","critical"] as const;
const FREQUENCIES = ["immediate","grouped_hourly","grouped_daily"] as const;
const CHANNELS: Array<"in_app"|"email"|"push"> = ["in_app","email","push"];

interface RuleForm {
  id?: string;
  name: string;
  description: string;
  is_active: boolean;
  module: string;
  event_type: string;
  severity: typeof SEVERITIES[number];
  target_roles: string[];
  channels: Array<"in_app"|"email"|"push">;
  frequency: typeof FREQUENCIES[number];
  conditions: CondTree;
  is_critical: boolean;
}

const EMPTY: RuleForm = {
  name: "", description: "", is_active: true, module: "tickets", event_type: "",
  severity: "medium", target_roles: [], channels: ["in_app"], frequency: "immediate",
  conditions: { combinator: "all", rules: [] }, is_critical: false,
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rule: (Partial<Omit<RuleForm, "conditions">> & { id?: string; conditions?: unknown }) | null;
  onSaved: () => void;
}

export function RuleEditorDialog({ open, onOpenChange, rule, onSaved }: Props) {
  const [form, setForm] = useState<RuleForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [expertMode, setExpertMode] = useState(false);
  const [expertJson, setExpertJson] = useState("");
  const [forceWarnings, setForceWarnings] = useState(false);

  useEffect(() => {
    if (rule) {
      const tree = fromAnyConditions(rule.conditions);
      setForm({
        ...EMPTY,
        ...rule,
        target_roles: (rule.target_roles as string[]) ?? [],
        channels: (rule.channels as Array<"in_app"|"email"|"push">) ?? ["in_app"],
        conditions: tree,
      } as RuleForm);
      setExpertJson(rule.conditions ? JSON.stringify(rule.conditions, null, 2) : "");
    } else {
      setForm(EMPTY);
      setExpertJson("");
    }
    setExpertMode(false);
    setForceWarnings(false);
  }, [rule, open]);

  const events = useMemo(() => NOTIF_EVENTS_BY_MODULE[form.module] ?? [], [form.module]);
  const sampleCtx = useMemo(
    () => events.find((e) => e.value === form.event_type)?.sampleContext ?? {},
    [events, form.event_type]
  );

  const conditionsObj: Record<string, unknown> | null = useMemo(() => {
    if (expertMode && expertJson.trim()) {
      try { return JSON.parse(expertJson); } catch { return null; }
    }
    return toNotifConditions(form.conditions);
  }, [expertMode, expertJson, form.conditions]);

  const treeIssues = useMemo(
    () => (expertMode ? [] : validateConditionTree(form.conditions, form.module)),
    [expertMode, form.conditions, form.module]
  );

  const preflight = useMemo(() => {
    const base = preflightNotifRule({
      name: form.name,
      module: form.module,
      event_type: form.event_type,
      target_roles: form.target_roles,
      channels: form.channels,
      severity: form.severity,
      is_critical: form.is_critical,
      frequency: form.frequency,
      conditions: expertMode ? expertJson : conditionsObj,
      allowCustom: false,
    });
    return { errors: [...base.errors, ...treeIssues], warnings: base.warnings };
  }, [form, expertMode, expertJson, conditionsObj, treeIssues]);

  const toggleArr = <T,>(arr: T[], v: T): T[] => arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];


  const save = async () => {
    if (preflight.errors.length > 0) {
      toast({ title: "Corrige les erreurs avant d'enregistrer", variant: "destructive" });
      return;
    }
    if (preflight.warnings.length > 0 && !forceWarnings) {
      setForceWarnings(true);
      toast({ title: "Vérifie les avertissements", description: "Cliquez à nouveau sur Enregistrer pour confirmer." });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      name: form.name,
      description: form.description,
      is_active: form.is_active,
      module: form.module,
      event_type: form.event_type,
      severity: form.severity,
      target_roles: form.target_roles,
      channels: form.channels,
      frequency: form.frequency,
      conditions: conditionsObj as never,
      is_critical: form.is_critical,
      updated_by: user?.id ?? null,
    };
    let error;
    if (form.id) {
      ({ error } = await supabase.from("notification_rules").update(payload).eq("id", form.id));
    } else {
      ({ error } = await supabase.from("notification_rules").insert({ ...payload, created_by: user?.id ?? null }));
    }
    setSaving(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    await logAudit({
      action_type: form.id ? "update" : "create",
      module: "notifications",
      entity_type: "notification_rule",
      entity_id: form.id ?? null,
      entity_label: form.name,
      severity: "medium",
      new_values: payload as Record<string, unknown>,
    });
    toast({ title: form.id ? "Règle mise à jour" : "Règle créée" });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Modifier la règle" : "Nouvelle règle de notification"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Identité */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nom *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="flex items-end gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_critical} onCheckedChange={(v) => setForm({ ...form, is_critical: v })} />
                <Label>Critique</Label>
              </div>
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          {/* Cible */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Module *</Label>
              <Select value={form.module} onValueChange={(v) => setForm({ ...form, module: v, event_type: "", conditions: { combinator: "all", rules: [] } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODULE_GROUPS.map((g) => (
                    <div key={g}>
                      <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">{g}</div>
                      {MODULES.filter((m) => m.group === g).map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Événement *</Label>
              {events.length > 0 ? (
                <Select
                  value={form.event_type}
                  onValueChange={(v) => {
                    const ev = events.find((e) => e.value === v);
                    setForm({ ...form, event_type: v, severity: ev?.defaultSeverity ?? form.severity });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                  <SelectContent>
                    {events.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input placeholder="ex: ticket_created" value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} />
              )}
            </div>
            <div>
              <Label>Sévérité</Label>
              <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v as RuleForm["severity"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Destinataires */}
          <div>
            <div className="flex items-center justify-between">
              <Label>Rôles destinataires</Label>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-primary underline"
                onClick={() => setForm({ ...form, target_roles: suggestedRolesForModule(form.module) })}
              >
                Rôles conseillés
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {ROLES.map((r) => (
                <Badge
                  key={r}
                  variant={form.target_roles.includes(r) ? "default" : "outline"}
                  className="cursor-pointer text-[10px]"
                  onClick={() => setForm({ ...form, target_roles: toggleArr(form.target_roles, r) })}
                >
                  {r.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>

          </div>

          {/* Canaux + Fréquence */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Canaux</Label>
              <div className="flex gap-3 mt-2">
                {CHANNELS.map((c) => (
                  <label key={c} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={form.channels.includes(c)}
                      onCheckedChange={() => setForm({ ...form, channels: toggleArr(form.channels, c) })}
                    />
                    {c}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>Fréquence</Label>
              <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v as RuleForm["frequency"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immédiate (anti-doublon 5 min)</SelectItem>
                  <SelectItem value="grouped_hourly">Groupée / heure</SelectItem>
                  <SelectItem value="grouped_daily">Groupée / jour</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Conditions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Conditions de déclenchement</Label>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-primary underline"
                onClick={() => {
                  if (!expertMode) setExpertJson(JSON.stringify(toNotifConditions(form.conditions) ?? {}, null, 2));
                  setExpertMode(!expertMode);
                }}
              >
                {expertMode ? "Mode visuel" : "Mode expert (JSON)"}
              </button>
            </div>
            {expertMode ? (
              <Textarea
                rows={5}
                className="font-mono text-xs"
                placeholder='{"all":[{"field":"priority","op":"eq","value":"high"}]}'
                value={expertJson}
                onChange={(e) => setExpertJson(e.target.value)}
              />
            ) : (
              <ConditionBuilder
                module={form.module}
                value={form.conditions}
                onChange={(v) => setForm({ ...form, conditions: v })}
              />
            )}
          </div>

          {/* Dry-run */}
          <DryRunTester
            sampleContext={sampleCtx}
            onTest={(ctx) => evaluateConditions(ctx, conditionsObj as never)}
          />

          {/* Preflight */}
          <PreflightBanner result={preflight} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={save} disabled={saving || preflight.errors.length > 0}>
            {saving ? "..." : forceWarnings && preflight.warnings.length > 0 ? "Confirmer & enregistrer" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
