import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";
import { matchConditions, type ValidationRule } from "@/lib/validation";
import { MODULES, VALIDATION_ACTIONS_BY_MODULE, ROLES } from "@/lib/ruleCatalog";
import { preflightValidationRule } from "@/lib/ruleValidation";
import {
  ConditionBuilder,
  fromAnyConditions,
  toValidationConditions,
  type CondTree,
} from "@/components/rules/ConditionBuilder";
import { PreflightBanner, DryRunTester } from "@/components/rules/RulePreflight";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rule: ValidationRule | null;
  onSaved: () => void;
}

interface FormState {
  name: string;
  description: string;
  module: string;
  entity_type: string;
  action_type: string;
  enforcement: "post_hoc" | "blocking";
  priority: ValidationRule["priority"];
  is_active: boolean;
  is_required: boolean;
  validator_roles: string[];
  validator_users: string[];
  auto_approve_if_low_risk: boolean;
  conditions: CondTree;
}

const EMPTY: FormState = {
  name: "", description: "", module: "pdr_stock", entity_type: "", action_type: "",
  enforcement: "post_hoc", priority: "medium", is_active: true, is_required: true,
  validator_roles: [], validator_users: [], auto_approve_if_low_risk: false,
  conditions: { combinator: "all", rules: [] },
};

interface ProfileOption { user_id: string; name: string }

export function RuleEditorDialog({ open, onOpenChange, rule, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [expertMode, setExpertMode] = useState(false);
  const [expertJson, setExpertJson] = useState("");
  const [forceWarnings, setForceWarnings] = useState(false);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id,first_name,last_name")
        .order("first_name");
      const opts: ProfileOption[] = (data ?? []).map((p: { user_id: string; first_name: string | null; last_name: string | null }) => ({
        user_id: p.user_id,
        name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.user_id.slice(0, 8),
      }));
      setProfiles(opts);
    })();
  }, [open]);

  useEffect(() => {
    if (rule) {
      setForm({
        name: rule.name ?? "",
        description: rule.description ?? "",
        module: rule.module ?? "pdr_stock",
        entity_type: rule.entity_type ?? "",
        action_type: rule.action_type ?? "",
        enforcement: rule.enforcement ?? "post_hoc",
        priority: rule.priority ?? "medium",
        is_active: rule.is_active ?? true,
        is_required: rule.is_required ?? true,
        validator_roles: rule.validator_roles ?? [],
        validator_users: rule.validator_users ?? [],
        auto_approve_if_low_risk: rule.auto_approve_if_low_risk ?? false,
        conditions: fromAnyConditions(rule.conditions),
      });
      setExpertJson(rule.conditions ? JSON.stringify(rule.conditions, null, 2) : "");
    } else {
      setForm(EMPTY);
      setExpertJson("");
    }
    setExpertMode(false);
    setForceWarnings(false);
  }, [rule, open]);

  const actions = useMemo(() => VALIDATION_ACTIONS_BY_MODULE[form.module] ?? [], [form.module]);
  const currentAction = useMemo(() => actions.find((a) => a.value === form.action_type), [actions, form.action_type]);
  const sampleCtx = currentAction?.sampleContext ?? {};

  const conditionsObj: Record<string, unknown> | null = useMemo(() => {
    if (expertMode && expertJson.trim()) {
      try { return JSON.parse(expertJson); } catch { return null; }
    }
    return toValidationConditions(form.conditions);
  }, [expertMode, expertJson, form.conditions]);

  const preflight = useMemo(() => preflightValidationRule({
    name: form.name,
    module: form.module,
    action_type: form.action_type,
    enforcement: form.enforcement,
    validator_roles: form.validator_roles,
    validator_users: form.validator_users,
    conditions: expertMode ? expertJson : conditionsObj,
    allowCustom: false,
  }), [form, expertMode, expertJson, conditionsObj]);

  const toggleRole = (r: string) => {
    setForm({ ...form, validator_roles: form.validator_roles.includes(r) ? form.validator_roles.filter((x) => x !== r) : [...form.validator_roles, r] });
  };

  const toggleUser = (uid: string) => {
    setForm({ ...form, validator_users: form.validator_users.includes(uid) ? form.validator_users.filter((x) => x !== uid) : [...form.validator_users, uid] });
  };

  const save = async () => {
    if (preflight.errors.length > 0) {
      toast({ title: "Corrige les erreurs avant d'enregistrer", variant: "destructive" });
      return;
    }
    if (preflight.warnings.length > 0 && !forceWarnings) {
      setForceWarnings(true);
      toast({ title: "Vérifie les avertissements", description: "Cliquez à nouveau pour confirmer." });
      return;
    }
    setBusy(true);
    const payload = {
      name: form.name,
      description: form.description,
      module: form.module,
      entity_type: form.entity_type || null,
      action_type: form.action_type,
      enforcement: form.enforcement,
      priority: form.priority,
      is_active: form.is_active,
      is_required: form.is_required,
      validator_roles: form.validator_roles,
      validator_users: form.validator_users,
      auto_approve_if_low_risk: form.auto_approve_if_low_risk,
      conditions: conditionsObj,
    };
    const { error } = rule
      ? await supabase.from("validation_rules").update(payload as never).eq("id", rule.id)
      : await supabase.from("validation_rules").insert(payload as never);
    setBusy(false);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    await logAudit({
      action_type: rule ? "update" : "create",
      module: "system",
      entity_type: "validation_rule",
      entity_id: rule?.id ?? null,
      entity_label: form.name,
      severity: form.enforcement === "blocking" ? "high" : "medium",
      new_values: payload as Record<string, unknown>,
    });
    toast({ title: rule ? "Règle modifiée" : "Règle créée" });
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? "Modifier" : "Créer"} une règle de validation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Identité */}
          <div>
            <Label>Nom *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>

          {/* Cible */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Module *</Label>
              <Select value={form.module} onValueChange={(v) => {
                const acts = VALIDATION_ACTIONS_BY_MODULE[v] ?? [];
                const first = acts[0];
                setForm({
                  ...form,
                  module: v,
                  action_type: first?.value ?? "",
                  entity_type: first?.entity ?? "",
                  enforcement: first?.defaultEnforcement ?? form.enforcement,
                });
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODULES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Action *</Label>
              {actions.length > 0 ? (
                <Select value={form.action_type} onValueChange={(v) => {
                  const act = actions.find((a) => a.value === v);
                  setForm({ ...form, action_type: v, entity_type: act?.entity ?? form.entity_type });
                }}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                  <SelectContent>
                    {actions.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={form.action_type} onChange={(e) => setForm({ ...form, action_type: e.target.value })} />
              )}
            </div>
            <div>
              <Label>Type d'entité</Label>
              <Input value={form.entity_type} placeholder="auto" onChange={(e) => setForm({ ...form, entity_type: e.target.value })} />
            </div>
            <div>
              <Label>Priorité</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as ValidationRule["priority"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Faible</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="high">Élevée</SelectItem>
                  <SelectItem value="critical">Critique</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Mode d'application</Label>
              <Select value={form.enforcement} onValueChange={(v) => setForm({ ...form, enforcement: v as "post_hoc" | "blocking" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="post_hoc">A posteriori (n'arrête pas le terrain)</SelectItem>
                  <SelectItem value="blocking">Bloquante (action en attente)</SelectItem>
                </SelectContent>
              </Select>
              {form.enforcement === "blocking" && (
                <p className="text-xs text-orange-600 mt-1">
                  ⚠️ Cette règle bloquera l'opération en attendant validation.
                </p>
              )}
            </div>
          </div>

          {/* Validateurs */}
          <div>
            <Label>Rôles validateurs</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {ROLES.map((r) => {
                const sel = form.validator_roles.includes(r);
                return (
                  <Badge
                    key={r}
                    variant={sel ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleRole(r)}
                  >
                    {r.replace(/_/g, " ")}
                  </Badge>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Tous les utilisateurs ayant l'un de ces rôles pourront traiter la demande.
            </p>
          </div>

          {/* Validateurs nominatifs */}
          <div>
            <Label>Validateurs nominatifs (optionnel)</Label>
            <div className="flex flex-wrap gap-2 mt-2 max-h-32 overflow-y-auto">
              {profiles.length === 0 && (
                <span className="text-xs text-muted-foreground italic">Aucun utilisateur chargé.</span>
              )}
              {profiles.map((p) => {
                const sel = form.validator_users.includes(p.user_id);
                return (
                  <Badge
                    key={p.user_id}
                    variant={sel ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleUser(p.user_id)}
                  >
                    {p.name}
                  </Badge>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Le premier validateur nominatif sera assigné directement à la demande.
            </p>
          </div>

          {/* Conditions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Conditions de déclenchement</Label>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-primary underline"
                onClick={() => {
                  if (!expertMode) setExpertJson(JSON.stringify(toValidationConditions(form.conditions) ?? {}, null, 2));
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
            onTest={(ctx) => matchConditions(conditionsObj as Record<string, unknown> | null, ctx)}
          />

          {/* Switches */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="flex items-center justify-between rounded-md border p-2">
              <Label>Active</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-2">
              <Label>Validation obligatoire</Label>
              <Switch checked={form.is_required} onCheckedChange={(v) => setForm({ ...form, is_required: v })} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-2 col-span-2">
              <div>
                <Label>Auto-approuver si risque faible</Label>
                <p className="text-xs text-muted-foreground">
                  Les demandes a posteriori de priorité « faible » sont approuvées automatiquement.
                </p>
              </div>
              <Switch
                checked={form.auto_approve_if_low_risk}
                onCheckedChange={(v) => setForm({ ...form, auto_approve_if_low_risk: v })}
                disabled={form.enforcement === "blocking"}
              />
            </div>
          </div>

          {/* Preflight */}
          <PreflightBanner result={preflight} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={save} disabled={busy || preflight.errors.length > 0}>
            {busy ? "..." : forceWarnings && preflight.warnings.length > 0 ? "Confirmer & enregistrer" : (rule ? "Enregistrer" : "Créer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
