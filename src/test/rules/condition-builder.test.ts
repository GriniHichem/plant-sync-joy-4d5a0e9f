import { describe, it, expect } from "vitest";
import {
  fromAnyConditions, toNotifConditions, toValidationConditions,
  summarizeConditions, validateConditionTree, type CondTree,
} from "@/components/rules/ConditionBuilder";
import { evaluateConditions } from "@/lib/notifications";
import { matchConditions } from "@/lib/validation";

const tree = (rules: CondTree["rules"], combinator: "all" | "any" = "all"): CondTree => ({ combinator, rules });

describe("ConditionBuilder — adapters", () => {
  it("round-trips the notif format", () => {
    const t = tree([{ field: "priority", op: "in", value: ["high", "critical"] }]);
    const notif = toNotifConditions(t);
    expect(notif).toEqual({ all: t.rules });
    expect(fromAnyConditions(notif)).toEqual(t);
  });

  it("round-trips the native validation format", () => {
    const t = tree([{ field: "ecart_pct", op: "between", value: [5, 20] }], "any");
    const val = toValidationConditions(t);
    expect(val).toEqual({ combinator: "any", rules: t.rules });
    expect(fromAnyConditions(val)).toEqual(t);
  });

  it("returns null for empty trees", () => {
    expect(toNotifConditions(tree([]))).toBeNull();
    expect(toValidationConditions(tree([]))).toBeNull();
  });

  it("decodes legacy shortcuts and arrays", () => {
    const t = fromAnyConditions({ min_duration_minutes: 60, priority: ["high", "critical"] });
    expect(t.combinator).toBe("all");
    expect(t.rules).toEqual([
      { field: "duration_minutes", op: "gte", value: 60 },
      { field: "priority", op: "in", value: ["high", "critical"] },
    ]);
  });

  it("decodes legacy OR groups into an ANY tree", () => {
    const t = fromAnyConditions({ or: [{ priority: "critical" }, { ecart_seuil_pct: 10 }] });
    expect(t.combinator).toBe("any");
    expect(t.rules).toHaveLength(2);
  });
});

describe("ConditionBuilder — validation & summary", () => {
  it("flags unknown fields and missing values", () => {
    const issues = validateConditionTree(
      tree([
        { field: "unknown_field", op: "eq", value: "x" },
        { field: "priority", op: "eq", value: "" },
        { field: "duration_minutes", op: "between", value: [5] },
        { field: "priority", op: "in", value: [] },
      ]),
      "tickets"
    );
    expect(issues).toHaveLength(4);
  });

  it("accepts valid trees, including 0-arity operators", () => {
    expect(validateConditionTree(tree([
      { field: "priority", op: "is_empty" },
      { field: "duration_minutes", op: "gte", value: 30 },
    ]), "tickets")).toEqual([]);
  });

  it("summarizes conditions in human-readable form", () => {
    expect(summarizeConditions(tree([]))).toContain("Toujours");
    const s = summarizeConditions(tree([
      { field: "priority", op: "in", value: ["high"] },
      { field: "duration_minutes", op: "gt", value: 30 },
    ], "any"));
    expect(s).toContain(" OU ");
  });
});

describe("Both engines evaluate the builder output identically", () => {
  const cases: Array<{ t: CondTree; ctx: Record<string, unknown>; expected: boolean }> = [
    { t: tree([{ field: "priority", op: "in", value: ["high", "critical"] }]), ctx: { priority: "high" }, expected: true },
    { t: tree([{ field: "priority", op: "nin", value: ["high"] }]), ctx: { priority: "low" }, expected: true },
    { t: tree([{ field: "duration_minutes", op: "between", value: [10, 60] }]), ctx: { duration_minutes: 45 }, expected: true },
    { t: tree([{ field: "duration_minutes", op: "between", value: [10, 60] }]), ctx: { duration_minutes: 90 }, expected: false },
    { t: tree([{ field: "comment", op: "is_empty" }]), ctx: {}, expected: true },
    { t: tree([{ field: "comment", op: "not_empty" }]), ctx: { comment: "ok" }, expected: true },
    { t: tree([{ field: "numero", op: "starts_with", value: "TCK" }]), ctx: { numero: "tck-1" }, expected: true },
    {
      t: tree([
        { field: "is_conforme", op: "eq", value: false },
        { field: "category", op: "in", value: ["produit_fini", "poids"] },
      ]),
      ctx: { is_conforme: false, category: "poids" },
      expected: true,
    },
    {
      t: tree([
        { field: "nc_severity", op: "eq", value: "critical" },
        { field: "quantite_impactee", op: "gte", value: 500 },
      ], "any"),
      ctx: { nc_severity: "minor", quantite_impactee: 900 },
      expected: true,
    },
  ];

  it.each(cases)("case %#", ({ t, ctx, expected }) => {
    expect(evaluateConditions(ctx, toNotifConditions(t) as never)).toBe(expected);
    expect(matchConditions(toValidationConditions(t), ctx)).toBe(expected);
  });

  it("notif engine also understands the native builder format", () => {
    const t = tree([{ field: "priority", op: "eq", value: "high" }]);
    expect(evaluateConditions({ priority: "high" }, toValidationConditions(t) as never)).toBe(true);
  });
});
