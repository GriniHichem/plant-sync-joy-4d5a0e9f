import { describe, it, expect } from "vitest";
import {
  evalOperator, opsForKind, describeCondition, resolveField,
  OPERATOR_ARITY, OPERATORS,
} from "@/lib/conditionOps";

describe("conditionOps — evalOperator", () => {
  it("eq / neq are tolerant across string & number", () => {
    expect(evalOperator("eq", 10, "10")).toBe(true);
    expect(evalOperator("eq", "HIGH", "high")).toBe(true);
    expect(evalOperator("neq", "high", "low")).toBe(true);
    expect(evalOperator("eq", null, "high")).toBe(false);
  });

  it("boolean equality accepts string/number forms", () => {
    expect(evalOperator("eq", true, "true")).toBe(true);
    expect(evalOperator("eq", false, true)).toBe(false);
    expect(evalOperator("eq", 1, true)).toBe(true);
  });

  it("numeric comparisons coerce numeric strings but reject text", () => {
    expect(evalOperator("gt", "10", 5)).toBe(true);
    expect(evalOperator("gte", 10, 10)).toBe(true);
    expect(evalOperator("lt", 4, 5)).toBe(true);
    expect(evalOperator("lte", "4,5", 5)).toBe(true);
    expect(evalOperator("gt", "abc", 5)).toBe(false);
    expect(evalOperator("gt", undefined, 5)).toBe(false);
  });

  it("between is inclusive and bound-order agnostic", () => {
    expect(evalOperator("between", 10, [5, 15])).toBe(true);
    expect(evalOperator("between", 10, [15, 5])).toBe(true);
    expect(evalOperator("between", 5, [5, 15])).toBe(true);
    expect(evalOperator("between", 20, [5, 15])).toBe(false);
    expect(evalOperator("between", 20, [5])).toBe(false);
  });

  it("in / nin accept arrays and comma strings", () => {
    expect(evalOperator("in", "high", ["high", "critical"])).toBe(true);
    expect(evalOperator("in", "high", "high, critical")).toBe(true);
    expect(evalOperator("in", "low", ["high"])).toBe(false);
    expect(evalOperator("nin", "low", ["high"])).toBe(true);
    expect(evalOperator("nin", "low", [])).toBe(true);
  });

  it("string operators are case-insensitive", () => {
    expect(evalOperator("contains", "Hello World", "world")).toBe(true);
    expect(evalOperator("not_contains", "Hello", "zz")).toBe(true);
    expect(evalOperator("starts_with", "TCK-2026-1", "tck")).toBe(true);
    expect(evalOperator("ends_with", "TCK-2026-1", "1")).toBe(true);
    expect(evalOperator("contains", null, "x")).toBe(false);
  });

  it("is_empty / not_empty cover null, empty string and empty array", () => {
    expect(evalOperator("is_empty", null, undefined)).toBe(true);
    expect(evalOperator("is_empty", "", undefined)).toBe(true);
    expect(evalOperator("is_empty", [], undefined)).toBe(true);
    expect(evalOperator("is_empty", 0, undefined)).toBe(false);
    expect(evalOperator("not_empty", "x", undefined)).toBe(true);
  });

  it("date strings compare chronologically", () => {
    expect(evalOperator("gte", "2026-08-02", "2026-08-01")).toBe(true);
    expect(evalOperator("lte", "2026-08-01", "2026-08-02")).toBe(true);
  });
});

describe("conditionOps — metadata", () => {
  it("opsForKind proposes type-appropriate operators", () => {
    expect(opsForKind("number")).toContain("between");
    expect(opsForKind("number")).not.toContain("contains");
    expect(opsForKind("enum")).toContain("in");
    expect(opsForKind("boolean")).toEqual(["eq", "neq"]);
    expect(opsForKind("string")).toContain("starts_with");
  });

  it("every operator declares an arity", () => {
    for (const o of OPERATORS) {
      expect(OPERATOR_ARITY[o.value]).toBe(o.arity);
    }
  });

  it("resolveField supports flat keys and dotted paths", () => {
    expect(resolveField({ a: 1 }, "a")).toBe(1);
    expect(resolveField({ metadata: { crit: "A" } }, "metadata.crit")).toBe("A");
    expect(resolveField({}, "nope.deep")).toBeUndefined();
  });

  it("describeCondition renders readable labels", () => {
    expect(describeCondition("priority", "eq", "high")).toBe("priority = high");
    expect(describeCondition("duration_minutes", "between", [5, 10])).toContain("entre 5 et 10");
    expect(describeCondition("priority", "in", ["high", "critical"])).toContain("[high, critical]");
    expect(describeCondition("comment", "is_empty", undefined)).toBe("comment est vide");
  });
});
