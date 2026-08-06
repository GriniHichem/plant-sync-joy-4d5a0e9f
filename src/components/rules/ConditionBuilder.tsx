import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { getConditionFields, type ConditionFieldDef } from "@/lib/ruleCatalog";
import {
  OPERATOR_LABEL, OPERATOR_ARITY, opsForKind, describeCondition,
  type CondOperator,
} from "@/lib/conditionOps";

// =============================================
// Format de conditions normalisé (compatible notif & validation)
// { combinator: "all"|"any", rules: [{field, op, value}] }
// =============================================
export type CondOp = CondOperator;

export type CondValue = string | number | boolean | Array<string | number>;
export interface CondLeaf { field: string; op: CondOp; value?: CondValue }
export interface CondTree { combinator: "all" | "any"; rules: CondLeaf[] }

// =============================================
// Adaptateurs vers les formats moteur
// =============================================
/** Format Notifications: {all:[{field,op,value}]} ou {any:[…]} */
export function toNotifConditions(tree: CondTree | null): Record<string, unknown> | null {
  if (!tree || tree.rules.length === 0) return null;
  return { [tree.combinator]: tree.rules };
}

/**
 * Format Validation natif : { combinator, rules:[{field, op, value}] }.
 * Le moteur (matchConditions) évalue exactement cette structure → ce que
 * l'admin construit dans l'UI est ce qui s'exécute (plus de raccourcis lossy).
 */
export function toValidationConditions(tree: CondTree | null): Record<string, unknown> | null {
  if (!tree || tree.rules.length === 0) return null;
  return { combinator: tree.combinator, rules: tree.rules };
}

/** Tente de parser un format existant en CondTree (best effort) */
export function fromAnyConditions(raw: unknown): CondTree {
  const empty: CondTree = { combinator: "all", rules: [] };
  if (!raw || typeof raw !== "object") return empty;
  const obj = raw as Record<string, unknown>;
  const asLeaves = (arr: unknown[]): CondLeaf[] =>
    arr.filter((r) => typeof r === "object" && r && "field" in r) as CondLeaf[];

  // Native format { combinator, rules }
  if (Array.isArray(obj.rules) && typeof obj.combinator === "string") {
    return {
      combinator: obj.combinator === "any" ? "any" : "all",
      rules: asLeaves(obj.rules as unknown[]),
    };
  }
  // Notif format
  if (Array.isArray(obj.all)) return { combinator: "all", rules: asLeaves(obj.all) };
  if (Array.isArray(obj.any)) return { combinator: "any", rules: asLeaves(obj.any) };
  // Validation legacy OR format
  if (Array.isArray(obj.or)) {
    const rules: CondLeaf[] = [];
    for (const g of obj.or) {
      if (g && typeof g === "object") {
        for (const [k, v] of Object.entries(g as Record<string, unknown>)) {
          rules.push(decodeShortcut(k, v));
        }
      }
    }
    return { combinator: "any", rules };
  }
  // Plain object → AND
  const rules: CondLeaf[] = [];
  for (const [k, v] of Object.entries(obj)) rules.push(decodeShortcut(k, v));
  return { combinator: "all", rules };
}

function decodeShortcut(key: string, value: unknown): CondLeaf {
  if (key === "min_duration_minutes") return { field: "duration_minutes", op: "gte", value: Number(value) };
  if (key === "ecart_seuil_pct") return { field: "ecart_pct", op: "gte", value: Number(value) };
  if (key === "min_age_hours") return { field: "age_hours", op: "gte", value: Number(value) };
  if (Array.isArray(value)) return { field: key, op: "in", value: value as Array<string | number> };
  return { field: key, op: "eq", value: value as CondValue };
}

/** Résumé lisible d'un arbre de conditions (affichage / audit). */
export function summarizeConditions(tree: CondTree | null): string {
  if (!tree || tree.rules.length === 0) return "Toujours (aucune condition)";
  const joiner = tree.combinator === "any" ? " OU " : " ET ";
  return tree.rules.map((r) => describeCondition(r.field, r.op, r.value)).join(joiner);
}

/** Valide un arbre : renvoie la liste des problèmes détectés. */
export function validateConditionTree(tree: CondTree, module: string): string[] {
  const issues: string[] = [];
  const fields = getConditionFields(module);
  const known = new Map(fields.map((f) => [f.key, f]));
  tree.rules.forEach((r, i) => {
    const n = i + 1;
    if (!r.field) { issues.push(`Condition ${n} : champ manquant.`); return; }
    const def = known.get(r.field);
    if (!def) { issues.push(`Condition ${n} : le champ « ${r.field} » n'est pas standard pour ce module.`); }
    const arity = OPERATOR_ARITY[r.op];
    if (arity === 0) return;
    if (arity === 2) {
      const v = Array.isArray(r.value) ? r.value : [];
      if (v.length < 2 || v.some((x) => x === "" || x === undefined || x === null)) {
        issues.push(`Condition ${n} : « entre » nécessite deux bornes.`);
      }
      return;
    }
    if (arity === "list") {
      const v = Array.isArray(r.value) ? r.value : String(r.value ?? "").split(",").filter(Boolean);
      if (v.length === 0) issues.push(`Condition ${n} : aucune valeur sélectionnée.`);
      return;
    }
    if (r.value === "" || r.value === undefined || r.value === null) {
      issues.push(`Condition ${n} : valeur manquante.`);
    } else if (def?.type === "number" && Number.isNaN(Number(r.value))) {
      issues.push(`Condition ${n} : « ${def.label} » attend un nombre.`);
    }
  });
  return issues;
}

function defaultValueFor(def: ConditionFieldDef | undefined, op: CondOp): CondValue | undefined {
  const arity = OPERATOR_ARITY[op];
  if (arity === 0) return undefined;
  if (arity === 2) return [0, 0];
  if (arity === "list") return [];
  if (!def) return "";
  if (def.type === "number") return 0;
  if (def.type === "boolean") return true;
  return def.values?.[0] ?? "";
}

// =============================================
// Composant
// =============================================
interface Props {
  module: string;
  value: CondTree;
  onChange: (next: CondTree) => void;
}

export function ConditionBuilder({ module, value, onChange }: Props) {
  const fields = useMemo(() => getConditionFields(module), [module]);
  const fieldByKey = useMemo(() => {
    const m = new Map<string, ConditionFieldDef>();
    fields.forEach((f) => m.set(f.key, f));
    return m;
  }, [fields]);

  const issues = useMemo(() => validateConditionTree(value, module), [value, module]);

  const addRule = () => {
    const first = fields[0];
    if (!first) return;
    const op = opsForKind(first.type)[0];
    onChange({ ...value, rules: [...value.rules, { field: first.key, op, value: defaultValueFor(first, op) }] });
  };

  const updateRule = (i: number, patch: Partial<CondLeaf>) => {
    const next = value.rules.slice();
    next[i] = { ...next[i], ...patch };
    onChange({ ...value, rules: next });
  };

  const removeRule = (i: number) => {
    onChange({ ...value, rules: value.rules.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="space-y-2 rounded-md border p-3 bg-muted/30">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Déclencher si</span>
        <Select value={value.combinator} onValueChange={(v) => onChange({ ...value, combinator: v as "all" | "any" })}>
          <SelectTrigger className="h-7 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">TOUTES vraies</SelectItem>
            <SelectItem value="any">AU MOINS UNE vraie</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">des conditions :</span>
      </div>

      {value.rules.length === 0 && (
        <p className="text-xs text-muted-foreground italic px-1">
          Aucune condition : la règle se déclenchera systématiquement.
        </p>
      )}

      {value.rules.map((r, i) => {
        const def = fieldByKey.get(r.field);
        const ops = opsForKind(def?.type ?? "string");
        const arity = OPERATOR_ARITY[r.op];
        const listValues: Array<string | number> = Array.isArray(r.value)
          ? r.value
          : String(r.value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
        const bounds = Array.isArray(r.value) ? r.value : [];

        return (
          <div key={i} className="flex flex-wrap items-center gap-1.5">
            <Select value={r.field} onValueChange={(v) => {
              const newDef = fieldByKey.get(v);
              const newOp = opsForKind(newDef?.type ?? "string")[0];
              updateRule(i, { field: v, op: newOp, value: defaultValueFor(newDef, newOp) });
            }}>
              <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {fields.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}{f.unit ? ` (${f.unit})` : ""}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={r.op} onValueChange={(v) => {
              const op = v as CondOp;
              updateRule(i, { op, value: defaultValueFor(def, op) });
            }}>
              <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ops.map((o) => <SelectItem key={o} value={o}>{OPERATOR_LABEL[o]}</SelectItem>)}
              </SelectContent>
            </Select>

            {arity === 0 ? null : arity === 2 ? (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  className="h-8 w-24"
                  value={String(bounds[0] ?? "")}
                  onChange={(e) => updateRule(i, { value: [Number(e.target.value), Number(bounds[1] ?? 0)] })}
                />
                <span className="text-xs text-muted-foreground">et</span>
                <Input
                  type="number"
                  className="h-8 w-24"
                  value={String(bounds[1] ?? "")}
                  onChange={(e) => updateRule(i, { value: [Number(bounds[0] ?? 0), Number(e.target.value)] })}
                />
              </div>
            ) : arity === "list" && def?.type === "enum" ? (
              <div className="flex flex-wrap gap-1">
                {(def.values ?? []).map((v) => {
                  const active = listValues.includes(v);
                  return (
                    <Badge
                      key={v}
                      variant={active ? "default" : "outline"}
                      className="cursor-pointer text-[10px]"
                      onClick={() => updateRule(i, {
                        value: active ? listValues.filter((x) => x !== v) : [...listValues, v],
                      })}
                    >
                      {v}
                    </Badge>
                  );
                })}
              </div>
            ) : arity === "list" ? (
              <Input
                className="h-8 w-52"
                placeholder="valeurs séparées par des virgules"
                value={listValues.join(", ")}
                onChange={(e) => updateRule(i, { value: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
              />
            ) : def?.type === "enum" ? (
              <Select value={String(r.value ?? "")} onValueChange={(v) => updateRule(i, { value: v })}>
                <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(def.values ?? []).map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : def?.type === "boolean" ? (
              <Select value={String(r.value ?? "true")} onValueChange={(v) => updateRule(i, { value: v === "true" })}>
                <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Oui</SelectItem>
                  <SelectItem value="false">Non</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input
                className="h-8 w-40"
                type={def?.type === "number" ? "number" : "text"}
                value={String(r.value ?? "")}
                onChange={(e) => updateRule(i, {
                  value: def?.type === "number" ? Number(e.target.value) : e.target.value,
                })}
              />
            )}

            {def?.unit && <span className="text-xs text-muted-foreground">{def.unit}</span>}

            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeRule(i)}>
              <X size={14} />
            </Button>
          </div>
        );
      })}

      <Button type="button" variant="outline" size="sm" className="h-7" onClick={addRule}>
        <Plus size={13} /> Ajouter une condition
      </Button>

      {value.rules.length > 0 && (
        <p className="text-[11px] text-muted-foreground pt-1 border-t">
          Résumé : {summarizeConditions(value)}
        </p>
      )}

      {issues.length > 0 && (
        <ul className="text-[11px] text-destructive list-disc pl-4">
          {issues.map((it, i) => <li key={i}>{it}</li>)}
        </ul>
      )}
    </div>
  );
}
