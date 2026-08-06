// =============================================
// Moteur d'opérateurs partagé (Notifications & Validations)
// Un seul endroit pour la sémantique des conditions afin que
// l'UI, le moteur notif et le moteur validation soient alignés.
// =============================================

export type CondOperator =
  | "eq" | "neq"
  | "gt" | "gte" | "lt" | "lte"
  | "between"
  | "in" | "nin"
  | "contains" | "not_contains" | "starts_with" | "ends_with"
  | "is_empty" | "not_empty"
  | "changed";

export const OPERATORS: Array<{ value: CondOperator; label: string; arity: 0 | 1 | 2 | "list" }> = [
  { value: "eq", label: "=", arity: 1 },
  { value: "neq", label: "≠", arity: 1 },
  { value: "gt", label: ">", arity: 1 },
  { value: "gte", label: "≥", arity: 1 },
  { value: "lt", label: "<", arity: 1 },
  { value: "lte", label: "≤", arity: 1 },
  { value: "between", label: "entre", arity: 2 },
  { value: "in", label: "parmi", arity: "list" },
  { value: "nin", label: "hors de", arity: "list" },
  { value: "contains", label: "contient", arity: 1 },
  { value: "not_contains", label: "ne contient pas", arity: 1 },
  { value: "starts_with", label: "commence par", arity: 1 },
  { value: "ends_with", label: "finit par", arity: 1 },
  { value: "is_empty", label: "est vide", arity: 0 },
  { value: "not_empty", label: "est renseigné", arity: 0 },
];

export const OPERATOR_LABEL: Record<CondOperator, string> = OPERATORS.reduce((acc, o) => {
  acc[o.value] = o.label;
  return acc;
}, {} as Record<CondOperator, string>);

export const OPERATOR_ARITY: Record<CondOperator, 0 | 1 | 2 | "list"> = OPERATORS.reduce((acc, o) => {
  acc[o.value] = o.arity;
  return acc;
}, { changed: 0 } as Record<CondOperator, 0 | 1 | 2 | "list">);

export type FieldKind = "number" | "string" | "enum" | "boolean" | "date";

/** Opérateurs proposés dans l'UI selon le type de champ */
export function opsForKind(kind: FieldKind): CondOperator[] {
  switch (kind) {
    case "number":
      return ["eq", "neq", "gt", "gte", "lt", "lte", "between", "is_empty", "not_empty"];
    case "enum":
      return ["eq", "neq", "in", "nin", "is_empty", "not_empty"];
    case "boolean":
      return ["eq", "neq"];
    case "date":
      return ["gte", "lte", "between", "is_empty", "not_empty"];
    default:
      return ["eq", "neq", "contains", "not_contains", "starts_with", "ends_with", "in", "nin", "is_empty", "not_empty"];
  }
}

function isBlank(v: unknown): boolean {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  if (typeof v === "string") {
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

function toList(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  if (isBlank(v)) return [];
  return [v];
}

function looseEq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (isBlank(a) || isBlank(b)) return false;
  if (typeof a === "boolean" || typeof b === "boolean") {
    const norm = (x: unknown) => x === true || x === "true" || x === 1 || x === "1";
    return norm(a) === norm(b);
  }
  const na = asNumber(a);
  const nb = asNumber(b);
  if (na !== null && nb !== null) return na === nb;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

/**
 * Évalue un opérateur unique. Toute comparaison numérique sur une valeur
 * non numérique renvoie false (pas de faux positif silencieux).
 */
export function evalOperator(op: CondOperator, actual: unknown, expected: unknown): boolean {
  switch (op) {
    case "is_empty": return isBlank(actual);
    case "not_empty": return !isBlank(actual);
    case "changed": return !isBlank(actual);
    case "eq": return looseEq(actual, expected);
    case "neq": return !looseEq(actual, expected);
    case "gt": case "gte": case "lt": case "lte": {
      const a = asNumber(actual);
      const b = asNumber(expected);
      if (a === null || b === null) return false;
      if (op === "gt") return a > b;
      if (op === "gte") return a >= b;
      if (op === "lt") return a < b;
      return a <= b;
    }
    case "between": {
      const a = asNumber(actual);
      const bounds = toList(expected).map(asNumber);
      if (a === null || bounds.length < 2 || bounds[0] === null || bounds[1] === null) return false;
      const lo = Math.min(bounds[0]!, bounds[1]!);
      const hi = Math.max(bounds[0]!, bounds[1]!);
      return a >= lo && a <= hi;
    }
    case "in": return toList(expected).some((e) => looseEq(actual, e));
    case "nin": {
      const list = toList(expected);
      if (list.length === 0) return true;
      return !list.some((e) => looseEq(actual, e));
    }
    case "contains":
      return !isBlank(actual) && String(actual).toLowerCase().includes(String(expected ?? "").toLowerCase());
    case "not_contains":
      return isBlank(actual) || !String(actual).toLowerCase().includes(String(expected ?? "").toLowerCase());
    case "starts_with":
      return !isBlank(actual) && String(actual).toLowerCase().startsWith(String(expected ?? "").toLowerCase());
    case "ends_with":
      return !isBlank(actual) && String(actual).toLowerCase().endsWith(String(expected ?? "").toLowerCase());
    default:
      return false;
  }
}

/** Résout un chemin pointé (`metadata.criticality`) dans un objet. */
export function resolveField(data: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined;
  if (path in data) return data[path];
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
    return undefined;
  }, data);
}

/** Description lisible d'une condition, pour l'UI et les rapports. */
export function describeCondition(field: string, op: CondOperator, value: unknown): string {
  const label = OPERATOR_LABEL[op] ?? op;
  if (op === "is_empty" || op === "not_empty") return `${field} ${label}`;
  if (op === "between") {
    const [a, b] = toList(value);
    return `${field} ${label} ${a ?? "?"} et ${b ?? "?"}`;
  }
  if (op === "in" || op === "nin") return `${field} ${label} [${toList(value).join(", ")}]`;
  return `${field} ${label} ${String(value ?? "")}`;
}
